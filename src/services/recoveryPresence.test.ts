// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryPresence, recoveryOwnerLock } from './recoveryPresence';
const instances: RecoveryPresence[] = [];
afterEach(() => { instances.splice(0).forEach(p => p.close()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function presence(owner: string) { const p = new RecoveryPresence(owner); instances.push(p); return p; }
function locks() {
  const held = new Set<string>();
  const manager = {
    query: async () => ({ held: Array.from(held, name => ({ name })), pending: [] }),
    request: async (name: string, options: unknown, callback?: (lock: object | null) => Promise<void>) => {
      const fn = typeof options === 'function' ? options as typeof callback : callback!;
      if (held.has(name)) return fn!(null);
      held.add(name); try { await fn!({ name }); } finally { held.delete(name); }
    },
  };
  Object.defineProperty(navigator, 'locks', { configurable: true, value: manager });
  return held;
}
describe('recovery owner presence', () => {
  it('holds an owner lock until the document closes; a background owner remains alive without heartbeats', async () => {
    const held = locks(); const a = presence('a'), b = presence('b');
    expect(await b.status('a')).toBe('alive'); expect(held.has(recoveryOwnerLock('a'))).toBe(true);
    a.close(); await Promise.resolve(); await Promise.resolve();
    expect(await b.status('a')).toBe('absent');
  });
  it('reserves a candidate once without waiting for a competing startup', async () => {
    locks(); const a = presence('a'), b = presence('b');
    const release = await a.claim('snapshot'); expect(release).not.toBeNull();
    expect(await b.claim('snapshot')).toBeNull(); release!();
  });
  it('does not infer absence when neither API can establish ownership', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    vi.stubGlobal('BroadcastChannel', undefined); expect(await presence('a').status('b')).toBe('unknown');
  });
  it('failed lock queries fall back to unknown, not a false crash', async () => {
    locks(); vi.spyOn(navigator.locks, 'query').mockRejectedValue(new Error('disabled'));
    vi.stubGlobal('BroadcastChannel', undefined); expect(await presence('a').status('b')).toBe('unknown');
  });
  it('fallback accepts a positive reply but treats a sleeping/no-reply owner as unknown', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    class Channel extends EventTarget {
      onmessage: ((event: MessageEvent) => void) | null = null;
      close() {}
      postMessage(data: { type: string; owner: string; probe: string }) {
        if (data.type === 'probe' && data.owner === 'awake') {
          queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: { ...data, type: 'alive' } })));
        }
      }
    }
    vi.stubGlobal('BroadcastChannel', Channel);
    const p = presence('a'); expect(await p.status('awake')).toBe('alive');
    const unknown = p.status('sleeping'); await vi.advanceTimersByTimeAsync(350);
    expect(await unknown).toBe('unknown'); vi.useRealTimers();
  });
});
