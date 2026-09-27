import { httpsCallable } from 'firebase/functions';
import type { ImageResource } from '../types';
import { functions } from '../lib/firebase';

const R2_URL_PREFIX = 'r2://';
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const R2_ASSET_ID_PATTERN = /^r2-[a-f0-9]{36}$/;

type UploadIntent = {
  assetId: string;
  uploadUrl: string;
  expiresInSeconds: number;
  maxFileBytes: number;
};

type TemporaryLink = {
  url: string;
  expiresInSeconds: number;
};

type CachedLink = TemporaryLink & { expiresAt: number };

const createUploadIntent = httpsCallable<{ scenarioId: string; name: string; contentType: string; sizeBytes: number }, UploadIntent>(
  functions,
  'createR2UploadIntent',
);
const finalizeUpload = httpsCallable<{ assetId: string }, { assetId: string; storageProvider: 'r2' }>(
  functions,
  'finalizeR2AssetUpload',
);
const getOwnerTemporaryLink = httpsCallable<{ assetId: string }, TemporaryLink>(functions, 'getR2OwnerTemporaryLink');
const getSharedTemporaryLink = httpsCallable<{ ownerUid: string; shareId: string; assetId: string }, TemporaryLink>(
  functions,
  'getR2SharedTemporaryLink',
);
const touchReferences = httpsCallable<{ assetIds: string[] }, { touched: number }>(functions, 'touchR2AssetReferences');

const ownerLinkCache = new Map<string, CachedLink>();

function normalizeContentType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.pdf')) return 'application/pdf';
  return '';
}

export function isR2AssetUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(R2_URL_PREFIX) && R2_ASSET_ID_PATTERN.test(url.slice(R2_URL_PREFIX.length));
}

export function getR2AssetIdFromUrl(url: string | null | undefined): string | null {
  if (!isR2AssetUrl(url)) return null;
  return String(url).slice(R2_URL_PREFIX.length);
}

export function getR2AssetId(resource: Pick<ImageResource, 'id' | 'url' | 'storageProvider' | 'storageAssetId'> | null | undefined): string | null {
  if (!resource || resource.storageProvider !== 'r2') return null;
  const assetId = resource.storageAssetId || getR2AssetIdFromUrl(resource.url) || resource.id;
  return R2_ASSET_ID_PATTERN.test(assetId) ? assetId : null;
}

export function isR2Asset(resource: Pick<ImageResource, 'id' | 'url' | 'storageProvider' | 'storageAssetId'> | null | undefined): boolean {
  return getR2AssetId(resource) !== null;
}

export function r2AssetUrl(assetId: string): string {
  if (!R2_ASSET_ID_PATTERN.test(assetId)) throw new Error('R2_ASSET_ID_INVALID');
  return R2_URL_PREFIX + assetId;
}

export function getR2StorageErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return 'CueBookストレージへの保存に失敗しました。接続と容量を確認してください。';
}

export async function uploadR2Asset(scenarioId: string, file: File): Promise<ImageResource> {
  const contentType = normalizeContentType(file);
  if (!contentType) throw new Error('対応していないファイル形式です。JPEG / PNG / WebP / GIF / PDF を選択してください。');
  if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error('ファイルサイズは1Bから100MBまでです。');

  const { data: intent } = await createUploadIntent({
    scenarioId,
    name: file.name,
    contentType,
    sizeBytes: file.size,
  });
  const response = await fetch(intent.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!response.ok) throw new Error(`R2_UPLOAD_FAILED:${response.status}`);
  await finalizeUpload({ assetId: intent.assetId });

  return {
    id: intent.assetId,
    storageAssetId: intent.assetId,
    storageProvider: 'r2',
    name: file.name,
    url: r2AssetUrl(intent.assetId),
    type: contentType === 'application/pdf' ? 'pdf' : 'image',
    sizeBytes: file.size,
    updatedAt: Date.now(),
  };
}

export async function getR2OwnerTemporaryUrl(assetId: string, forceRefresh = false): Promise<CachedLink> {
  if (!R2_ASSET_ID_PATTERN.test(assetId)) throw new Error('R2_ASSET_ID_INVALID');
  const cached = ownerLinkCache.get(assetId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 60_000) return cached;
  const { data } = await getOwnerTemporaryLink({ assetId });
  const result = { ...data, expiresAt: Date.now() + data.expiresInSeconds * 1000 };
  ownerLinkCache.set(assetId, result);
  return result;
}

export async function getR2SharedTemporaryUrl(ownerUid: string, shareId: string, assetId: string): Promise<CachedLink> {
  if (!R2_ASSET_ID_PATTERN.test(assetId)) throw new Error('R2_ASSET_ID_INVALID');
  const { data } = await getSharedTemporaryLink({ ownerUid, shareId, assetId });
  return { ...data, expiresAt: Date.now() + data.expiresInSeconds * 1000 };
}

export async function touchR2AssetReferences(assetIds: readonly string[]): Promise<void> {
  const uniqueIds = [...new Set(assetIds.filter((assetId) => R2_ASSET_ID_PATTERN.test(assetId)))];
  for (let start = 0; start < uniqueIds.length; start += 100) {
    await touchReferences({ assetIds: uniqueIds.slice(start, start + 100) });
  }
}
