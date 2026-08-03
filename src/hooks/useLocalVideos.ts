import { useState, useEffect, useMemo } from 'react';
import { MediaItem } from '../types';

export function useLocalVideos(baseImages: MediaItem[] = []) {
  const [localVideos, setLocalVideos] = useState<MediaItem[]>([]);

  useEffect(() => {
    const loadLocalVideos = () => {
      try {
        const saved = localStorage.getItem('cuebook_local_videos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLocalVideos(parsed.map((item: { id: string; name: string; url?: string }) => ({
              id: item.id,
              name: item.name,
              url: item.url || '',
              type: 'video' as const,
              updatedAt: Date.now(),
            })));
          }
        } else {
          setLocalVideos([]);
        }
      } catch (err) {
        console.error('Failed to load local videos in useLocalVideos', err);
      }
    };

    loadLocalVideos();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cuebook_local_videos') {
        loadLocalVideos();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleCustomUpdate = () => {
      loadLocalVideos();
    };
    window.addEventListener('storage_local_videos_updated', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('storage_local_videos_updated', handleCustomUpdate);
    };
  }, []);

  const combinedImages = useMemo(() => {
    const existingIds = new Set(baseImages.map(img => String(img.id).toLowerCase()));
    const existingNames = new Set(baseImages.map(img => String(img.name).toLowerCase()));

    const uniqueLocalVideos = localVideos.filter(vid =>
      !existingIds.has(vid.id.toLowerCase()) &&
      !existingNames.has(vid.name.toLowerCase())
    );

    return [...baseImages, ...uniqueLocalVideos];
  }, [baseImages, localVideos]);

  return { localVideos, combinedImages };
}
