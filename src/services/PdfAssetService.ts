import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfAssetStatus = 'processing' | 'uploading' | 'verifying' | 'ready' | 'failed';

export interface PdfAssetDescriptor {
  id: string;
  sourceName: string;
  sourceHash: string;
  pageCount: number;
  status: PdfAssetStatus;
}

export interface RenderedPdfPage {
  pageNumber: number;
  image: Blob;
}

export interface PdfAssetProgress {
  currentPage: number;
  pageCount: number;
}

export interface RenderPdfAssetOptions {
  onPage: (page: RenderedPdfPage) => Promise<void> | void;
  onProgress?: (progress: PdfAssetProgress) => void;
  signal?: AbortSignal;
}

const MAX_RENDER_PIXELS = 4_000_000;
const MAX_RENDER_WIDTH = 1_800;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const abortError = () => new DOMException('PDF asset rendering was cancelled.', 'AbortError');

async function sha256(source: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', source);
  return toHex(new Uint8Array(digest));
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('ASSET_RENDER_FAILED'));
    }, 'image/webp', 0.88);
  });
}

async function renderPage(pdf: PDFDocumentProxy, pageNumber: number): Promise<Blob> {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    2,
    MAX_RENDER_WIDTH / Math.max(baseViewport.width, 1),
    Math.sqrt(MAX_RENDER_PIXELS / Math.max(baseViewport.width * baseViewport.height, 1)),
  );
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ASSET_RENDER_FAILED');

  try {
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return await canvasToWebp(canvas);
  } finally {
    canvas.width = 1;
    canvas.height = 1;
    page.cleanup();
  }
}

/**
 * Reads only the durable identity and page count. The descriptor is safe to
 * persist; it intentionally never contains the PDF body or rendered pixels.
 */
export async function inspectPdfAsset(file: File, signal?: AbortSignal): Promise<PdfAssetDescriptor> {
  if (signal?.aborted) throw abortError();
  const source = await file.arrayBuffer();
  if (signal?.aborted) throw abortError();
  const sourceHash = await sha256(source);
  const loadingTask = getDocument({ data: new Uint8Array(source) });

  try {
    const pdf = await loadingTask.promise;
    if (signal?.aborted) throw abortError();
    return {
      id: `pdf-${sourceHash.slice(0, 24)}`,
      sourceName: file.name,
      sourceHash,
      pageCount: pdf.numPages,
      status: 'processing',
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw Object.assign(new Error('ASSET_PDF_INVALID'), { cause: error });
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Renders and yields one page at a time. Callers upload/store the Blob inside
 * onPage, so no page image array is retained in memory or Firestore.
 */
export async function renderPdfAssetPages(file: File, options: RenderPdfAssetOptions): Promise<PdfAssetDescriptor> {
  if (options.signal?.aborted) throw abortError();
  const source = await file.arrayBuffer();
  const sourceHash = await sha256(source);
  const loadingTask = getDocument({ data: new Uint8Array(source) });

  try {
    const pdf = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      if (options.signal?.aborted) throw abortError();
      const image = await renderPage(pdf, pageNumber);
      if (options.signal?.aborted) throw abortError();
      await options.onPage({ pageNumber, image });
      options.onProgress?.({ currentPage: pageNumber, pageCount: pdf.numPages });
    }
    return {
      id: `pdf-${sourceHash.slice(0, 24)}`,
      sourceName: file.name,
      sourceHash,
      pageCount: pdf.numPages,
      status: 'verifying',
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw Object.assign(new Error('ASSET_RENDER_FAILED'), { cause: error });
  } finally {
    await loadingTask.destroy();
  }
}
