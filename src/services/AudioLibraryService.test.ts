import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SoundConfig } from '../types';
import { SoundType } from '../types';
const firestore = vi.hoisted(() => ({ subscribe: vi.fn(), transaction: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_db: unknown, ...path: string[]) => path.join('/'), onSnapshot: firestore.subscribe, runTransaction: firestore.transaction }));
import { saveAudioLibrary, subscribeAudioLibrary } from './AudioLibraryService';
const song: SoundConfig = { id: 'song', name: 'Song', url: '', type: SoundType.SE };
beforeEach(() => { vi.clearAllMocks(); firestore.transaction.mockImplementation((_db, callback) => callback({ get: firestore.read, set: firestore.write })); });
describe('Firestore audio-library adapter', () => {
  it('waits for server metadata before accepting missing/cached or pending data', () => {
    const receive = vi.fn(); const fail = vi.fn();
    subscribeAudioLibrary('owner', 'scenario', receive, fail);
    const callback = firestore.subscribe.mock.calls[0][2];
    callback({ metadata: { fromCache: true }, exists: () => false });
    callback({ metadata: { hasPendingWrites: true }, exists: () => false });
    expect(receive).not.toHaveBeenCalled();
    callback({ metadata: { fromCache: false, hasPendingWrites: false }, exists: () => false });
    expect(receive).toHaveBeenCalledWith(null);
    expect(firestore.subscribe.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
    expect(firestore.subscribe.mock.calls[0][0]).toBe('users/owner/audioLibraries/scenario');
  });
  it('merges a transaction against the newest remote snapshot', async () => {
    firestore.read.mockResolvedValue({ exists: () => true, data: () => ({ sounds: [{ ...song, volume: .2 }] }) });
    expect(await saveAudioLibrary('owner', 'scenario', [song], [{ ...song, name: 'local edit' }])).toEqual([{ ...song, volume: .2, name: 'local edit' }]);
  });
  it('reports malformed remote data instead of erasing the local library', async () => {
    firestore.read.mockResolvedValue({ exists: () => true, data: () => ({ sounds: 'invalid' }) });
    await expect(saveAudioLibrary('owner', 'scenario', [], [song])).rejects.toThrow('不正'); expect(firestore.write).not.toHaveBeenCalled();
  });
});
