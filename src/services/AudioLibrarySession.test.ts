// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioLibrarySession } from './AudioLibrarySession';
import { SoundType, type SoundConfig } from '../types';
const song: SoundConfig = { id: 'song', name: 'Song', type: SoundType.SE, url: 'r2://r2-' + 'a'.repeat(36), storageProvider: 'r2', storageAssetId: 'r2-' + 'a'.repeat(36) };
const sessions: ReturnType<typeof createAudioLibrarySession>[] = [];
function setup(initial: SoundConfig[] = [], save = vi.fn(async (_base: SoundConfig[], local: SoundConfig[]) => local)) {
  let receive!: (sounds: SoundConfig[] | null) => void;
  const apply = vi.fn(); const fail = vi.fn(); const unsubscribe = vi.fn();
  const session = createAudioLibrarySession({ initial, pendingKey: 'pending', apply, fail, save, subscribe: callback => { receive = callback; return unsubscribe; } });
  sessions.push(session);
  return { session, receive: (sounds: SoundConfig[] | null) => receive(sounds), apply, fail, save, unsubscribe };
}
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.useRealTimers(); });
describe('audio library persistence boundaries', () => {
  it('never writes before the authoritative first snapshot or seeds an empty device', async () => {
    const test = setup(); test.session.edit([song]); await vi.advanceTimersByTimeAsync(2000); expect(test.save).not.toHaveBeenCalled();
    test.session.edit([]); test.receive(null); await vi.advanceTimersByTimeAsync(2000); expect(test.save).not.toHaveBeenCalled();
  });
  it('uses exponential retries and persists unsaved edits', async () => {
    const save = vi.fn(async (_base: SoundConfig[], local: SoundConfig[]) => local).mockRejectedValueOnce(new Error('offline'));
    const test = setup([], save); test.receive([]); test.session.edit([song]);
    await vi.advanceTimersByTimeAsync(500); expect(test.fail).toHaveBeenCalledTimes(1); expect(localStorage.getItem('pending')).toContain('Song');
    await vi.advanceTimersByTimeAsync(1500); expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500); expect(save).toHaveBeenCalledTimes(2); expect(localStorage.getItem('pending')).toBeNull();
  });
  it('restores pending edits after restarting against a newer remote library', async () => {
    localStorage.setItem('pending', JSON.stringify({ base: [song], local: [{ ...song, name: 'Offline edit' }] }));
    const test = setup([song]); test.receive([{ ...song, volume: .3 }]); await vi.advanceTimersByTimeAsync(500);
    expect(test.apply).toHaveBeenLastCalledWith([{ ...song, name: 'Offline edit', volume: .3 }]);
  });
  it('flushes pending changes on scenario exit and ignores late subscriptions', async () => {
    const test = setup(); test.receive([]); test.session.edit([song]); test.session.dispose();
    await vi.advanceTimersByTimeAsync(0); expect(test.save).toHaveBeenCalledTimes(1); expect(test.unsubscribe).toHaveBeenCalled();
    test.apply.mockClear(); test.receive([]); expect(test.apply).not.toHaveBeenCalled();
  });
  it('does not persist device-only audio payloads or blob addresses', async () => {
    const test = setup(); test.receive([]); test.session.edit([{ ...song, url: 'data:audio/wav;base64,AAAA' }]); await vi.advanceTimersByTimeAsync(500);
    expect(test.save.mock.calls[0][1][0].url).toBe('');
  });
});
