import { R2_AUDIO_TYPES, canUploadR2Audio } from './r2AudioPolicy';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';

if (getApps().length === 0) initializeApp();
const db = getFirestore();

export const r2AccessKeyId = defineSecret('R2_ACCESS_KEY_ID');
export const r2SecretAccessKey = defineSecret('R2_SECRET_ACCESS_KEY');
export const r2AccountId = defineString('R2_ACCOUNT_ID');
export const r2BucketName = defineString('R2_BUCKET_NAME');

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_USER_BYTES = 1024 * 1024 * 1024;
const MAX_SCENARIO_BYTES = 250 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 5 * 60;
const VIEW_TTL_SECONDS = 5 * 60;
const UNREFERENCED_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const PENDING_RETENTION_MS = 24 * 60 * 60 * 1000;

type R2Asset = {
  assetId: string;
  ownerUid: string;
  scenarioId: string;
  objectKey: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: 'pending' | 'ready';
  lastReferencedAt: FirebaseFirestore.Timestamp;
};

type AuthInfo = { uid?: string; token?: Record<string, unknown> } | undefined;

function requireBizUser(auth: AuthInfo): string {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'CueBookストレージにはログインが必要です。');
  if (auth.token?.cuebookPlan !== 'biz') {
    throw new HttpsError('permission-denied', 'CueBookストレージはBizプラン専用です。');
  }
  return auth.uid;
}

function requireString(value: unknown, field: string, maxLength = 256): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new HttpsError('invalid-argument', field + ' が不正です。');
  }
  return value.trim();
}

function requireScenarioId(value: unknown): string {
  const scenarioId = requireString(value, 'scenarioId', 128);
  if (!/^[A-Za-z0-9_-]+$/.test(scenarioId)) {
    throw new HttpsError('invalid-argument', 'scenarioId が不正です。');
  }
  return scenarioId;
}

function requireContentType(value: unknown): string {
  const contentType = requireString(value, 'contentType', 128).toLowerCase();
  const supported = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    ...R2_AUDIO_TYPES,
  ];
  if (!supported.includes(contentType)) {
    throw new HttpsError('invalid-argument', '対応していないファイル形式です。');
  }
  return contentType;
}

function requireSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_FILE_BYTES) {
    throw new HttpsError('invalid-argument', 'ファイルサイズは1Bから100MBまでです。');
  }
  return value;
}

function safeFileName(name: string): string {
  const extension = name.includes('.') ? '.' + (name.split('.').pop() || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12) : '';
  const stem = name.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'asset';
  return stem + extension;
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase());
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function awsDate(now: Date): { full: string; date: string } {
  const full = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { full, date: full.slice(0, 8) };
}

function endpoint(): { host: string; baseUrl: string; bucket: string } {
  const accountId = r2AccountId.value();
  const bucket = r2BucketName.value();
  if (!accountId || !bucket) throw new Error('R2_ACCOUNT_ID と R2_BUCKET_NAME を設定してください。');
  const host = accountId + '.r2.cloudflarestorage.com';
  return { host, baseUrl: 'https://' + host, bucket };
}

function signingKey(date: string): Buffer {
  const dateKey = hmac('AWS4' + r2SecretAccessKey.value(), date);
  const regionKey = hmac(dateKey, 'auto');
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function canonicalPath(bucket: string, objectKey: string): string {
  return '/' + awsEncode(bucket) + '/' + objectKey.split('/').map(awsEncode).join('/');
}

function createPresignedUrl(
  method: 'GET' | 'PUT' | 'HEAD',
  objectKey: string,
  expiresInSeconds: number,
  contentType?: string,
): string {
  const now = new Date();
  const date = awsDate(now);
  const { host, baseUrl, bucket } = endpoint();
  const scope = date.date + '/auto/s3/aws4_request';
  const headers: Record<string, string> = { host };
  if (contentType) headers['content-type'] = contentType;
  const sortedHeaderNames = Object.keys(headers).sort();
  const signedHeaders = sortedHeaderNames.join(';');
  const canonicalHeaders = sortedHeaderNames.map((name) => name + ':' + headers[name] + '\n').join('');
  const query = new Map<string, string>([
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', r2AccessKeyId.value() + '/' + scope],
    ['X-Amz-Date', date.full],
    ['X-Amz-Expires', String(expiresInSeconds)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]);
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => awsEncode(key) + '=' + awsEncode(value))
    .join('&');
  const path = canonicalPath(bucket, objectKey);
  const canonicalRequest = method + '\n' + path + '\n' + canonicalQuery + '\n' + canonicalHeaders + '\n' + signedHeaders + '\nUNSIGNED-PAYLOAD';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + date.full + '\n' + scope + '\n' + sha256(canonicalRequest);
  const signature = createHmac('sha256', signingKey(date.date)).update(stringToSign).digest('hex');
  return baseUrl + path + '?' + canonicalQuery + '&X-Amz-Signature=' + signature;
}

function createSignedDelete(objectKey: string): { url: string; headers: Record<string, string> } {
  const now = new Date();
  const date = awsDate(now);
  const { host, baseUrl, bucket } = endpoint();
  const scope = date.date + '/auto/s3/aws4_request';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': date.full,
  };
  const sortedHeaderNames = Object.keys(headers).sort();
  const signedHeaders = sortedHeaderNames.join(';');
  const canonicalHeaders = sortedHeaderNames.map((name) => name + ':' + headers[name] + '\n').join('');
  const path = canonicalPath(bucket, objectKey);
  const canonicalRequest = 'DELETE\n' + path + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;
  const stringToSign = 'AWS4-HMAC-SHA256\n' + date.full + '\n' + scope + '\n' + sha256(canonicalRequest);
  const signature = createHmac('sha256', signingKey(date.date)).update(stringToSign).digest('hex');
  headers.Authorization = 'AWS4-HMAC-SHA256 Credential=' + r2AccessKeyId.value() + '/' + scope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
  delete headers.host;
  return { url: baseUrl + path, headers };
}

async function deleteR2Object(objectKey: string): Promise<void> {
  const request = createSignedDelete(objectKey);
  const response = await fetch(request.url, { method: 'DELETE', headers: request.headers });
  if (!response.ok && response.status !== 404) {
    throw new Error('R2_DELETE_FAILED:' + response.status);
  }
}

async function inspectR2Object(objectKey: string): Promise<{ sizeBytes: number; contentType: string }> {
  const response = await fetch(createPresignedUrl('HEAD', objectKey, 60), { method: 'HEAD' });
  if (!response.ok) throw new HttpsError('failed-precondition', 'アップロード済み素材を確認できません。');
  const sizeBytes = Number(response.headers.get('content-length') || 0);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase().split(';')[0];
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
    throw new HttpsError('failed-precondition', 'アップロード済み素材のサイズを確認できません。');
  }
  return { sizeBytes, contentType };
}

async function releasePendingAsset(assetRef: FirebaseFirestore.DocumentReference, asset: R2Asset): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const usageRef = db.doc('users/' + asset.ownerUid + '/private/storage');
    const scenarioUsageRef = db.doc('users/' + asset.ownerUid + '/storageScenarioUsage/' + asset.scenarioId);
    const [usageSnapshot, scenarioUsageSnapshot] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(scenarioUsageRef),
    ]);
    transaction.set(usageRef, { reservedBytes: Math.max(0, Number(usageSnapshot.get('reservedBytes') || 0) - asset.sizeBytes), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(scenarioUsageRef, { reservedBytes: Math.max(0, Number(scenarioUsageSnapshot.get('reservedBytes') || 0) - asset.sizeBytes), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.delete(assetRef);
  });
}

export const createR2UploadIntent = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [r2AccessKeyId, r2SecretAccessKey],
}, async (request) => {
  const uid = requireBizUser(request.auth);
  const scenarioId = requireScenarioId(request.data?.scenarioId);
  const name = requireString(request.data?.name, 'name', 512);
  const contentType = requireContentType(request.data?.contentType);
  if (contentType.startsWith('audio/') && !canUploadR2Audio(process.env.GCLOUD_PROJECT, request.auth?.token.cuebookPlan)) {
    throw new HttpsError('permission-denied', '音声ストレージはBiz配備先専用です。');
  }
  const sizeBytes = requireSize(request.data?.sizeBytes);
  const assetId = 'r2-' + randomBytes(18).toString('hex');
  const objectKey = 'users/' + uid + '/scenarios/' + scenarioId + '/' + assetId + '/' + safeFileName(name);
  const usageRef = db.doc('users/' + uid + '/private/storage');
  const assetRef = db.doc('users/' + uid + '/r2Assets/' + assetId);
  const scenarioUsageRef = db.doc('users/' + uid + '/storageScenarioUsage/' + scenarioId);

  await db.runTransaction(async (transaction) => {
    const [usageSnapshot, scenarioUsageSnapshot] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(scenarioUsageRef),
    ]);
    const storedBytes = Number(usageSnapshot.get('storedBytes') || 0);
    const reservedBytes = Number(usageSnapshot.get('reservedBytes') || 0);
    const scenarioStoredBytes = Number(scenarioUsageSnapshot.get('storedBytes') || 0);
    const scenarioReservedBytes = Number(scenarioUsageSnapshot.get('reservedBytes') || 0);
    if (storedBytes + reservedBytes + sizeBytes > MAX_USER_BYTES) {
      throw new HttpsError('resource-exhausted', 'Bizストレージの合計上限（1GB）を超えます。');
    }
    if (scenarioStoredBytes + scenarioReservedBytes + sizeBytes > MAX_SCENARIO_BYTES) {
      throw new HttpsError('resource-exhausted', 'このシナリオのストレージ上限（250MB）を超えます。');
    }
    transaction.set(assetRef, {
      assetId,
      ownerUid: uid,
      scenarioId,
      objectKey,
      name,
      contentType,
      sizeBytes,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      lastReferencedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(usageRef, { reservedBytes: reservedBytes + sizeBytes, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(scenarioUsageRef, { reservedBytes: scenarioReservedBytes + sizeBytes, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return {
    assetId,
    uploadUrl: createPresignedUrl('PUT', objectKey, UPLOAD_TTL_SECONDS, contentType),
    expiresInSeconds: UPLOAD_TTL_SECONDS,
    maxFileBytes: MAX_FILE_BYTES,
  };
});

export const finalizeR2AssetUpload = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [r2AccessKeyId, r2SecretAccessKey],
}, async (request) => {
  const uid = requireBizUser(request.auth);
  const assetId = requireString(request.data?.assetId, 'assetId', 128);
  const assetRef = db.doc('users/' + uid + '/r2Assets/' + assetId);
  const usageRef = db.doc('users/' + uid + '/private/storage');

  const assetSnapshot = await assetRef.get();
  const asset = assetSnapshot.data() as R2Asset | undefined;
  if (!asset || asset.ownerUid !== uid || asset.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'アップロード対象が見つからないか、既に確定しています。');
  }
  try {
    const uploaded = await inspectR2Object(asset.objectKey);
    if (uploaded.sizeBytes !== asset.sizeBytes || uploaded.contentType !== asset.contentType) {
      throw new HttpsError('invalid-argument', 'アップロード済み素材の種類またはサイズが申請内容と一致しません。');
    }
  } catch (error) {
    await deleteR2Object(asset.objectKey).catch(() => undefined);
    await releasePendingAsset(assetRef, asset);
    throw error;
  }

  await db.runTransaction(async (transaction) => {
    const currentAsset = (await transaction.get(assetRef)).data() as R2Asset | undefined;
    if (!currentAsset || currentAsset.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'アップロード対象の状態が変化しました。');
    }
    const scenarioUsageRef = db.doc('users/' + uid + '/storageScenarioUsage/' + asset.scenarioId);
    const [usageSnapshot, scenarioUsageSnapshot] = await Promise.all([
      transaction.get(usageRef),
      transaction.get(scenarioUsageRef),
    ]);
    transaction.update(assetRef, { status: 'ready', lastReferencedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.set(usageRef, {
      storedBytes: Number(usageSnapshot.get('storedBytes') || 0) + asset.sizeBytes,
      reservedBytes: Math.max(0, Number(usageSnapshot.get('reservedBytes') || 0) - asset.sizeBytes),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(scenarioUsageRef, {
      storedBytes: Number(scenarioUsageSnapshot.get('storedBytes') || 0) + asset.sizeBytes,
      reservedBytes: Math.max(0, Number(scenarioUsageSnapshot.get('reservedBytes') || 0) - asset.sizeBytes),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { assetId, storageProvider: 'r2' as const };
});

export const getR2OwnerTemporaryLink = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [r2AccessKeyId, r2SecretAccessKey],
}, async (request) => {
  const uid = requireBizUser(request.auth);
  const assetId = requireString(request.data?.assetId, 'assetId', 128);
  const snapshot = await db.doc('users/' + uid + '/r2Assets/' + assetId).get();
  const asset = snapshot.data() as R2Asset | undefined;
  if (!asset || asset.ownerUid !== uid || asset.status !== 'ready') {
    throw new HttpsError('not-found', 'R2アセットが見つかりません。');
  }
  await snapshot.ref.update({ lastReferencedAt: FieldValue.serverTimestamp() });
  return { url: createPresignedUrl('GET', asset.objectKey, VIEW_TTL_SECONDS), expiresInSeconds: VIEW_TTL_SECONDS };
});

export const getR2SharedTemporaryLink = onCall({
  region: 'asia-northeast1',
  invoker: 'public',
  secrets: [r2AccessKeyId, r2SecretAccessKey],
}, async (request) => {
  const ownerUid = requireString(request.data?.ownerUid, 'ownerUid', 128);
  const shareId = requireString(request.data?.shareId, 'shareId', 64);
  const assetId = requireString(request.data?.assetId, 'assetId', 128);
  if (!/^[a-f0-9]{64}$/.test(shareId)) {
    throw new HttpsError('invalid-argument', '共有情報が不正です。');
  }
  const session = await db.doc('timerSessions/' + ownerUid + '/sessions/' + shareId).get();
  if (!session.exists || session.get('shareId') !== shareId) {
    throw new HttpsError('permission-denied', '共有セッションを確認できません。');
  }
  const snapshot = await db.doc('users/' + ownerUid + '/r2Assets/' + assetId).get();
  const asset = snapshot.data() as R2Asset | undefined;
  if (!asset || asset.status !== 'ready' || asset.scenarioId !== session.get('scenarioId')) {
    throw new HttpsError('not-found', '共有対象のR2アセットが見つかりません。');
  }
  await snapshot.ref.update({ lastReferencedAt: FieldValue.serverTimestamp() });
  return { url: createPresignedUrl('GET', asset.objectKey, VIEW_TTL_SECONDS), expiresInSeconds: VIEW_TTL_SECONDS };
});

export const touchR2AssetReferences = onCall({ region: 'asia-northeast1', invoker: 'public' }, async (request) => {
  const uid = requireBizUser(request.auth);
  const assetIds = request.data?.assetIds;
  if (!Array.isArray(assetIds) || assetIds.length > 100 || assetIds.some((value) => typeof value !== 'string')) {
    throw new HttpsError('invalid-argument', 'assetIds が不正です。');
  }
  const batch = db.batch();
  assetIds.forEach((assetId) => {
    if (/^r2-[a-f0-9]{36}$/.test(assetId)) {
      batch.update(db.doc('users/' + uid + '/r2Assets/' + assetId), { lastReferencedAt: FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
  return { touched: assetIds.length };
});

export const cleanupUnreferencedR2Assets = onSchedule({
  schedule: 'every day 03:30',
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1',
  secrets: [r2AccessKeyId, r2SecretAccessKey],
}, async () => {
  const now = Date.now();
  const readyCutoff = Timestamp.fromMillis(now - UNREFERENCED_RETENTION_MS);
  const pendingCutoff = Timestamp.fromMillis(now - PENDING_RETENTION_MS);
  const ready = await db.collectionGroup('r2Assets')
    .where('status', '==', 'ready')
    .where('lastReferencedAt', '<=', readyCutoff)
    .limit(100)
    .get();
  const pending = await db.collectionGroup('r2Assets')
    .where('status', '==', 'pending')
    .where('lastReferencedAt', '<=', pendingCutoff)
    .limit(100)
    .get();

  for (const snapshot of [...ready.docs, ...pending.docs]) {
    const asset = snapshot.data() as R2Asset;
    try {
      await deleteR2Object(asset.objectKey);
      await db.runTransaction(async (transaction) => {
        const usageRef = db.doc('users/' + asset.ownerUid + '/private/storage');
        const scenarioUsageRef = db.doc('users/' + asset.ownerUid + '/storageScenarioUsage/' + asset.scenarioId);
        const [usageSnapshot, scenarioUsageSnapshot] = await Promise.all([
          transaction.get(usageRef),
          transaction.get(scenarioUsageRef),
        ]);
        if (asset.status === 'ready') {
          transaction.set(usageRef, { storedBytes: Math.max(0, Number(usageSnapshot.get('storedBytes') || 0) - asset.sizeBytes), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          transaction.set(scenarioUsageRef, { storedBytes: Math.max(0, Number(scenarioUsageSnapshot.get('storedBytes') || 0) - asset.sizeBytes), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else {
          transaction.set(usageRef, { reservedBytes: Math.max(0, Number(usageSnapshot.get('reservedBytes') || 0) - asset.sizeBytes), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          transaction.set(scenarioUsageRef, { reservedBytes: Math.max(0, Number(scenarioUsageSnapshot.get('reservedBytes') || 0) - asset.sizeBytes), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        transaction.delete(snapshot.ref);
      });
    } catch (error) {
      console.error('R2 cleanup failed', { path: snapshot.ref.path, error: String(error) });
    }
  }
});
