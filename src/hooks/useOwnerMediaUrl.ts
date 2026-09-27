import { useEffect, useState } from 'react';
import { getR2AssetIdFromUrl, getR2OwnerTemporaryUrl, isR2AssetUrl } from '../services/R2AssetService';

export function useOwnerMediaUrl(source: string | null | undefined): string {
  const normalizedSource = source || '';
  const [resolved, setResolved] = useState({ source: normalizedSource, url: isR2AssetUrl(normalizedSource) ? '' : normalizedSource });
  const visibleUrl = resolved.source === normalizedSource
    ? resolved.url
    : (isR2AssetUrl(normalizedSource) ? '' : normalizedSource);

  useEffect(() => {
    const assetId = getR2AssetIdFromUrl(normalizedSource);
    if (!assetId) return;

    let cancelled = false;
    let refreshTimer: number | undefined;
    const load = async (forceRefresh = false) => {
      try {
        const link = await getR2OwnerTemporaryUrl(assetId, forceRefresh);
        if (cancelled) return;
        setResolved({ source: normalizedSource, url: link.url });
        refreshTimer = window.setTimeout(() => { void load(true); }, Math.max(60_000, link.expiresAt - Date.now() - 60_000));
      } catch (error) {
        if (!cancelled) {
          console.warn('[R2 asset] Failed to obtain an owner temporary URL:', error);
          setResolved({ source: normalizedSource, url: '' });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [normalizedSource]);

  return visibleUrl;
}
