import { ImageResource, Scenario } from '../types';

/**
 * Selects the same ordered media list displayed by Sync Studio.
 * Player-shared media is authoritative when present; scenario/local media is
 * used only as a fallback.
 */
export function selectSyncMedia(
  playerImages: ImageResource[] | undefined,
  fallbackMedia: ImageResource[],
): ImageResource[] {
  return playerImages && playerImages.length > 0 ? playerImages : fallbackMedia;
}

/**
 * Media URL Transformer & Helper for Cloud Storage (Dropbox, Google Drive, OneDrive, etc.)
 */

export const transformDropboxUrl = (url: string): string => {
  if (!url) return '';
  let transformed = url.trim();

  if (transformed.includes('dropbox.com') || transformed.includes('db.tt')) {
    // Dropbox documents `raw=1` as the supported way to render a shared file in a browser.
    // Keep the share host and permission tokens (for example rlkey) intact; rewriting the
    // hostname to an undocumented download CDN made new /scl/ links unnecessarily fragile.
    try {
      const urlObj = new URL(transformed);
      if (urlObj.hostname === 'dl.dropboxusercontent.com' || urlObj.hostname === 'dl.dropbox.com') {
        urlObj.hostname = 'www.dropbox.com';
      }
      urlObj.searchParams.delete('dl');
      urlObj.searchParams.delete('preview');
      urlObj.searchParams.set('raw', '1');
      return urlObj.toString();
    } catch {
      // Preserve a usable URL for malformed pasted links; the browser will report the error.
      transformed = transformed
        .replace('dl.dropboxusercontent.com', 'www.dropbox.com')
        .replace('dl.dropbox.com', 'www.dropbox.com')
        .replace(/[?&](dl|preview|raw)=[^&]*/g, '');
      return transformed + (transformed.includes('?') ? '&raw=1' : '?raw=1');
    }
  }

  return transformed;
};

/**
 * Generates alternative fallback URLs if direct loading fails (e.g. for onError in img tags)
 */
export const getFallbackMediaUrl = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();

  // Try Dropbox's direct content endpoint only after its documented raw=1 URL failed.
  // This is deliberately a fallback, not the persisted canonical form.
  if (trimmed.includes('dropbox.com') || trimmed.includes('db.tt')) {
    try {
      const urlObj = new URL(trimmed);
      urlObj.hostname = 'dl.dropboxusercontent.com';
      urlObj.searchParams.delete('dl');
      urlObj.searchParams.delete('preview');
      urlObj.searchParams.delete('raw');
      return urlObj.toString();
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * Resolves the exact media selected for the player display.
 *
 * Player-shared media is intentionally preferred: the Sync Studio presents that
 * collection when it exists. Keeping this lookup in one pure function prevents
 * the selector, writer, and preview from disagreeing about the active resource.
 */
export const findSyncMediaResource = (scenario: Pick<Scenario, 'images' | 'playerImages'>, id: string | null | undefined): ImageResource | null => {
  const normalizedId = id?.trim().toLowerCase();
  if (!normalizedId) return null;

  const media = [...(scenario.playerImages || []), ...(scenario.images || [])];
  return media.find(item => item.id?.trim().toLowerCase() === normalizedId) || null;
};
