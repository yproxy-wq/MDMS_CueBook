import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SoundConfig } from '../types';
import { mergeSounds, portableSounds } from '../utils/audioLibrary';
export { mergeSounds, portableSounds } from '../utils/audioLibrary';

function readSounds(data: Record<string, unknown> | undefined): SoundConfig[] | null {
  if (!data) return null;
  if (!Array.isArray(data.sounds) || data.sounds.length > 1000 ||
      data.sounds.some(s => !s || typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || typeof s.url !== 'string' || !['BGM', 'SE'].includes(s.type)) ||
      new Set(data.sounds.map(s => s.id)).size !== data.sounds.length) {
    throw new Error('音源一覧のクラウドデータが不正です。端末内の音源は保持しています。');
  }
  return data.sounds as SoundConfig[];
}

export function subscribeAudioLibrary(uid: string, scenarioId: string, receive: (sounds: SoundConfig[] | null) => void, fail: (error: unknown) => void) {
  return onSnapshot(doc(db, 'users', uid, 'audioLibraries', scenarioId), { includeMetadataChanges: true }, snapshot => {
    // Cached absence must not initialize or overwrite an existing server library.
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    try { receive(readSounds(snapshot.exists() ? snapshot.data() : undefined)); } catch (error) { fail(error); }
  }, fail);
}

export async function saveAudioLibrary(uid: string, scenarioId: string, base: SoundConfig[], local: SoundConfig[]): Promise<SoundConfig[]> {
  const ref = doc(db, 'users', uid, 'audioLibraries', scenarioId);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const remote = readSounds(snapshot.exists() ? snapshot.data() : undefined);
    const sounds = remote === null ? portableSounds(local) : mergeSounds(base, portableSounds(local), remote);
    if (sounds.length > 1000 || new TextEncoder().encode(JSON.stringify(sounds)).length > 800_000) throw new Error('音源一覧が大きすぎるため同期できません。端末内の音源は保持しています。');
    transaction.set(ref, { sounds, schemaVersion: 1, updatedAt: Date.now() });
    return sounds;
  });
}

