import { inspectPdfAsset, PdfAssetProgress, renderPdfAssetPages } from './PdfAssetService';
export { connectDropbox, isDropboxConnected } from './DropboxOAuthService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

type UploadManifestResult = { assetId: string; pagePaths: string[] };
type UploadLinkResult = { uploadUrl: string; path: string };
type FinalizeResult = { assetId: string; status: 'ready'; pageCount: number };
type TemporaryLinkResult = { url: string; expiresInSeconds: number };

export type PdfAssetUploadStage = 'inspecting' | 'creating' | 'uploading' | 'verifying';

export interface PdfAssetUploadProgress extends PdfAssetProgress {
  stage: PdfAssetUploadStage;
}

const createManifest = httpsCallable<{ scenarioId: string; assetId: string; sourceHash: string; sourceName: string; pageCount: number }, UploadManifestResult>(functions, 'createPdfAssetManifest');
const createUploadLink = httpsCallable<{ assetId: string; pageNumber: number }, UploadLinkResult>(functions, 'createPdfPageUploadLink');
const finalizeAsset = httpsCallable<{ assetId: string }, FinalizeResult>(functions, 'finalizePdfAsset');
const getTemporaryLink = httpsCallable<{ ownerUid: string; shareId: string; assetId: string; pageNumber: number }, TemporaryLinkResult>(functions, 'getPdfPageTemporaryLink');

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

async function getScenarioAssetId(scenarioId: string, sourceHash: string): Promise<string> {
  const source = new TextEncoder().encode(`${scenarioId}:${sourceHash}`);
  const digest = await crypto.subtle.digest('SHA-256', source);
  return `pdf-${toHex(new Uint8Array(digest)).slice(0, 48)}`;
}

export async function getPdfPageTemporaryUrl(ownerUid: string, shareId: string, assetId: string, pageNumber: number): Promise<TemporaryLinkResult> {
  const { data } = await getTemporaryLink({ ownerUid, shareId, assetId, pageNumber });
  return data;
}

/**
 * Converts a local PDF page-by-page and uploads each WebP directly to Dropbox.
 * File pixels are never written to Firestore and the OAuth token stays in the
 * Function runtime.
 */
export async function uploadPdfAssetToDropbox(
  scenarioId: string,
  file: File,
  onProgress?: (progress: PdfAssetUploadProgress) => void,
  signal?: AbortSignal,
) {
  onProgress?.({ stage: 'inspecting', currentPage: 0, pageCount: 0 });
  const descriptor = await inspectPdfAsset(file, signal);
  const assetId = await getScenarioAssetId(scenarioId, descriptor.sourceHash);
  onProgress?.({ stage: 'creating', currentPage: 0, pageCount: descriptor.pageCount });
  await createManifest({ scenarioId, assetId, sourceHash: descriptor.sourceHash, sourceName: descriptor.sourceName, pageCount: descriptor.pageCount });

  await renderPdfAssetPages(file, {
    signal,
    onProgress: ({ currentPage, pageCount }) => onProgress?.({ stage: 'uploading', currentPage, pageCount }),
    onPage: async ({ pageNumber, image }) => {
      const { data } = await createUploadLink({ assetId, pageNumber });
      const response = await fetch(data.uploadUrl, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: image, signal });
      if (!response.ok) throw new Error(`DROPBOX_UPLOAD_FAILED:${response.status}`);
    },
  });

  onProgress?.({ stage: 'verifying', currentPage: descriptor.pageCount, pageCount: descriptor.pageCount });
  const { data } = await finalizeAsset({ assetId });
  return data;
}
