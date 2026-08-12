import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';

initializeApp();

const db = getFirestore();
const dropboxAppKey = defineSecret('DROPBOX_APP_KEY');
const dropboxAppSecret = defineSecret('DROPBOX_APP_SECRET');
const dropboxTokenKey = defineSecret('DROPBOX_TOKEN_ENCRYPTION_KEY');
const dropboxRedirectUri = defineString('DROPBOX_REDIRECT_URI');

const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const DROPBOX_AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type DropboxToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  account_id?: string;
};

type AssetManifest = {
  scenarioId: string;
  sourceHash: string;
  sourceName: string;
  pageCount: number;
  status: 'processing' | 'uploading' | 'verifying' | 'ready' | 'failed';
  pagePaths: string[];
};

function requireUser(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Dropbox操作にはログインが必要です。');
  return uid;
}

function requireString(value: unknown, field: string, maxLength = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} が不正です。`);
  }
  return value;
}

function assetPath(scenarioId: string, assetId: string, pageNumber: number): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(scenarioId) || !/^pdf-[a-f0-9]{12,64}$/.test(assetId) || pageNumber < 1) {
    throw new HttpsError('invalid-argument', 'アセット識別子またはページ番号が不正です。');
  }
  return `/CueBook/${scenarioId}/${assetId}/page-${String(pageNumber).padStart(3, '0')}.webp`;
}

function encryptionKey(): Buffer {
  const key = Buffer.from(dropboxTokenKey.value(), 'base64');
  if (key.length !== 32) throw new Error('DROPBOX_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

function encryptToken(token: DropboxToken): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(token), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

function decryptToken(value: string): DropboxToken {
  const payload = Buffer.from(value, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as DropboxToken;
}

async function refreshToken(token: DropboxToken): Promise<DropboxToken> {
  if (token.expires_at > Date.now() + 5 * 60 * 1000) return token;
  const basic = Buffer.from(`${dropboxAppKey.value()}:${dropboxAppSecret.value()}`).toString('base64');
  const response = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
  });
  if (!response.ok) throw new HttpsError('unauthenticated', 'Dropbox認証の更新に失敗しました。再接続してください。');
  const result = await response.json() as { access_token: string; expires_in: number; account_id?: string };
  return { ...token, access_token: result.access_token, expires_at: Date.now() + result.expires_in * 1000, account_id: result.account_id || token.account_id };
}

async function getAccessToken(uid: string): Promise<string> {
  const ref = db.doc(`users/${uid}/private/dropbox`);
  const snapshot = await ref.get();
  const encrypted = snapshot.get('encryptedToken');
  if (typeof encrypted !== 'string') throw new HttpsError('failed-precondition', 'Dropboxが接続されていません。');
  const token = await refreshToken(decryptToken(encrypted));
  await ref.set({ encryptedToken: encryptToken(token), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return token.access_token;
}

async function dropboxApi<T>(accessToken: string, endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${DROPBOX_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new HttpsError('internal', `Dropbox APIエラー (${response.status})`);
  return await response.json() as T;
}

export const beginDropboxAuthorization = onCall({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey] }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const state = randomBytes(32).toString('hex');
  await db.doc(`dropboxOauthStates/${state}`).set({ uid, expiresAt: Date.now() + OAUTH_STATE_TTL_MS, createdAt: FieldValue.serverTimestamp() });
  const params = new URLSearchParams({
    client_id: dropboxAppKey.value(),
    response_type: 'code',
    token_access_type: 'offline',
    redirect_uri: dropboxRedirectUri.value(),
    state,
  });
  return { authorizationUrl: `${DROPBOX_AUTHORIZE_URL}?${params.toString()}` };
});

export const getDropboxConnectionStatus = onCall({ region: 'asia-northeast1', invoker: 'public' }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const snapshot = await db.doc(`users/${uid}/private/dropbox`).get();
  return { connected: typeof snapshot.get('encryptedToken') === 'string' };
});

export const dropboxOAuthCallback = onRequest({ region: 'asia-northeast1', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request, response) => {
  const state = typeof request.query.state === 'string' ? request.query.state : '';
  const code = typeof request.query.code === 'string' ? request.query.code : '';
  if (!state || !code) {
    response.status(400).send('Dropbox authorization has expired. Return to CueBook and try again.');
    return;
  }
  const stateRef = db.doc(`dropboxOauthStates/${state}`);
  const stateSnapshot = await stateRef.get();
  const uid = stateSnapshot.get('uid');
  const expiresAt = stateSnapshot.get('expiresAt');
  if (typeof uid !== 'string' || typeof expiresAt !== 'number' || expiresAt < Date.now()) {
    response.status(400).send('Dropbox authorization has expired. Return to CueBook and try again.');
    return;
  }

  const basic = Buffer.from(`${dropboxAppKey.value()}:${dropboxAppSecret.value()}`).toString('base64');
  const tokenResponse = await fetch(DROPBOX_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: dropboxRedirectUri.value() }),
  });
  if (!tokenResponse.ok) {
    // Do not log the authorization code or credentials. Dropbox's error body
    // is needed to distinguish an invalid redirect URI from invalid app
    // credentials when diagnosing a failed OAuth callback.
    const errorBody = (await tokenResponse.text()).slice(0, 512);
    console.error('[Dropbox OAuth] Token exchange failed', {
      status: tokenResponse.status,
      error: errorBody,
    });
    response.status(502).send(`Dropbox token exchange failed (HTTP ${tokenResponse.status}). Return to CueBook and try again.`);
    return;
  }
  const tokenResponseBody = await tokenResponse.json() as { access_token: string; refresh_token: string; expires_in: number; account_id?: string };
  if (!tokenResponseBody.refresh_token) {
    response.status(502).send('Dropbox did not return an offline refresh token.');
    return;
  }
  const token: DropboxToken = { ...tokenResponseBody, expires_at: Date.now() + tokenResponseBody.expires_in * 1000 };
  await db.doc(`users/${uid}/private/dropbox`).set({ encryptedToken: encryptToken(token), accountId: token.account_id || null, connectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await stateRef.delete();
  response.type('html').send('<!doctype html><title>CueBook</title><script>window.close()</script><p>Dropbox connected. You can close this tab.</p>');
});

export const createPdfAssetManifest = onCall({ region: 'asia-northeast1', invoker: 'public' }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const scenarioId = requireString(request.data?.scenarioId, 'scenarioId');
  const assetId = requireString(request.data?.assetId, 'assetId');
  const sourceHash = requireString(request.data?.sourceHash, 'sourceHash', 128);
  const sourceName = requireString(request.data?.sourceName, 'sourceName', 512);
  const pageCount = request.data?.pageCount;
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 200) throw new HttpsError('invalid-argument', 'pageCount が不正です。');
  const manifest: AssetManifest = { scenarioId, sourceHash, sourceName, pageCount, status: 'processing', pagePaths: Array.from({ length: pageCount }, (_, i) => assetPath(scenarioId, assetId, i + 1)) };
  await db.doc(`users/${uid}/pdfAssets/${assetId}`).set({ ...manifest, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: false });
  return { assetId, pagePaths: manifest.pagePaths };
});

export const createPdfPageUploadLink = onCall({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const assetId = requireString(request.data?.assetId, 'assetId');
  const pageNumber = request.data?.pageNumber;
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new HttpsError('invalid-argument', 'pageNumber が不正です。');
  const manifest = await db.doc(`users/${uid}/pdfAssets/${assetId}`).get();
  const data = manifest.data() as AssetManifest | undefined;
  if (!data || pageNumber > data.pageCount) throw new HttpsError('not-found', 'PDFアセットまたはページが見つかりません。');
  const accessToken = await getAccessToken(uid);
  const result = await dropboxApi<{ link: string }>(accessToken, '/files/get_temporary_upload_link', { commit_info: { path: data.pagePaths[pageNumber - 1], mode: 'overwrite', autorename: false, mute: true } });
  await manifest.ref.set({ status: 'uploading', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { uploadUrl: result.link, path: data.pagePaths[pageNumber - 1] };
});

export const finalizePdfAsset = onCall({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const assetId = requireString(request.data?.assetId, 'assetId');
  const manifestRef = db.doc(`users/${uid}/pdfAssets/${assetId}`);
  const manifestSnapshot = await manifestRef.get();
  const manifest = manifestSnapshot.data() as AssetManifest | undefined;
  if (!manifest) throw new HttpsError('not-found', 'PDFアセットが見つかりません。');
  const accessToken = await getAccessToken(uid);
  await manifestRef.set({ status: 'verifying', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  try {
    await Promise.all(manifest.pagePaths.map((path) => dropboxApi(accessToken, '/files/get_metadata', { path })));
    await manifestRef.set({ status: 'ready', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { assetId, status: 'ready', pageCount: manifest.pageCount };
  } catch (error) {
    await manifestRef.set({ status: 'failed', failureCode: 'DROPBOX_VERIFY_FAILED', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});

/**
 * Public viewers prove access with the existing timer-session capability. The
 * Dropbox token remains server-side; neither the token nor a permanent file
 * URL is exposed to the shared window.
 */
export const getPdfPageTemporaryLink = onCall({ region: 'asia-northeast1', invoker: 'public', secrets: [dropboxAppKey, dropboxAppSecret, dropboxTokenKey] }, async (request) => {
  const ownerUid = requireString(request.data?.ownerUid, 'ownerUid', 128);
  const shareId = requireString(request.data?.shareId, 'shareId', 64);
  const assetId = requireString(request.data?.assetId, 'assetId');
  const pageNumber = request.data?.pageNumber;
  if (!/^[a-f0-9]{64}$/.test(shareId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new HttpsError('invalid-argument', '共有情報またはページ番号が不正です。');
  }
  const session = await db.doc(`timerSessions/${ownerUid}/sessions/${shareId}`).get();
  if (!session.exists || session.get('shareId') !== shareId) throw new HttpsError('permission-denied', '共有セッションを確認できません。');
  const manifest = await db.doc(`users/${ownerUid}/pdfAssets/${assetId}`).get();
  const data = manifest.data() as AssetManifest | undefined;
  if (!data || data.status !== 'ready' || pageNumber > data.pageCount) throw new HttpsError('not-found', '指定ページを表示できません。');
  const accessToken = await getAccessToken(ownerUid);
  const result = await dropboxApi<{ link: string }>(accessToken, '/files/get_temporary_link', { path: data.pagePaths[pageNumber - 1] });
  return { url: result.link, expiresInSeconds: 4 * 60 * 60 };
});
