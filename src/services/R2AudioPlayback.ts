import type { SoundConfig } from '../types';
import { auth } from '../lib/firebase';
import { audioService } from './AudioService';
import { getR2AssetIdFromUrl, getR2OwnerTemporaryUrl } from './R2AssetService';

type Source = { url: string; bytes: number; lastUsedAt: number; soundIds: Set<string> };
const sources = new Map<string, Source>();
const pending = new Map<string, Promise<Source>>();
const MAX_CACHE_BYTES = 200 * 1024 * 1024;

function trimIdleSources(keep: string) {
  let bytes = [...sources.values()].reduce((sum, source) => sum + source.bytes, 0);
  for (const [key, source] of sources) {
    if (bytes <= MAX_CACHE_BYTES && sources.size <= 8) break;
    // Protect sources handed to an engine whose initial decode is still pending.
    if (key === keep || Date.now() - source.lastUsedAt < 60_000 || [...source.soundIds].some(id => audioService.isPlaying(id) || audioService.isPaused(id))) continue;
    URL.revokeObjectURL(source.url);
    bytes -= source.bytes;
    sources.delete(key);
  }
}

/** Download once into a local playback source so a five-minute link expiring cannot interrupt a long BGM. */
export async function resolveR2Sound(sound: SoundConfig): Promise<SoundConfig> {
  const assetId = getR2AssetIdFromUrl(sound.url);
  if (!assetId) return sound;
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('音声ストレージの利用にはログインが必要です。');
  const key = `${uid}:${assetId}`;
  let source = sources.get(key);
  if (!source) {
    let request = pending.get(key);
    if (!request) {
      request = (async () => {
        const link = await getR2OwnerTemporaryUrl(assetId);
        const response = await fetch(link.url);
        if (!response.ok) throw new Error(`R2_AUDIO_READ_FAILED:${response.status}`);
        const blob = await response.blob();
        if (blob.size < 1 || blob.size > 100 * 1024 * 1024 || !blob.type.startsWith('audio/')) throw new Error('保存した音声の形式またはサイズが不正です。');
        if (auth.currentUser?.uid !== uid) throw new Error('ログイン状態が変わりました。もう一度再生してください。');
        const downloaded = { url: URL.createObjectURL(blob), bytes: blob.size, lastUsedAt: Date.now(), soundIds: new Set<string>() };
        sources.set(key, downloaded);
        return downloaded;
      })();
      pending.set(key, request);
    }
    try { source = await request; } finally { if (pending.get(key) === request) pending.delete(key); }
  }
  if (auth.currentUser?.uid !== uid) throw new Error('ログイン状態が変わりました。もう一度再生してください。');
  source.lastUsedAt = Date.now();
  sources.delete(key); sources.set(key, source);
  source.soundIds.add(sound.id);
  trimIdleSources(key);
  return { ...sound, url: source.url };
}
