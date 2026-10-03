import type { SoundConfig } from '../types';
import { mergeSounds, portableSounds } from '../utils/audioLibrary';

type Pending = { base: SoundConfig[]; local: SoundConfig[] };
export type AudioLibrarySyncStatus = 'local' | 'loading' | 'syncing' | 'synced' | 'retrying' | 'unavailable' | 'offline';
interface Options {
  initial: SoundConfig[];
  pendingKey: string;
  apply: (sounds: SoundConfig[]) => void;
  fail: (error: unknown) => void;
  onStatus?: (status: AudioLibrarySyncStatus) => void;
  subscribe: (receive: (sounds: SoundConfig[] | null) => void, fail: (error: unknown) => void) => () => void;
  save: (base: SoundConfig[], local: SoundConfig[]) => Promise<SoundConfig[]>;
}
const same = (a: SoundConfig[], b: SoundConfig[]) => JSON.stringify(a) === JSON.stringify(b);

/** One subscription per account/scenario; React and the playback engine stay outside. */
export function createAudioLibrarySession(options: Options) {
  let active = true;
  let hydrated = false;
  let writing = false;
  let missing = false;
  let failures = 0;
  let subscriptionFailed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let base = portableSounds(options.initial);
  let local = base;
  try {
    const pending = JSON.parse(localStorage.getItem(options.pendingKey) || 'null') as Pending | null;
    if (Array.isArray(pending?.base) && Array.isArray(pending?.local)) { base = pending.base; local = pending.local; }
  } catch { /* Storage may be unavailable; the ordinary scenario autosave remains active. */ }
  const remember = () => {
    try {
      if (!same(base, local) || (missing && local.length)) localStorage.setItem(options.pendingKey, JSON.stringify({ base, local }));
      else localStorage.removeItem(options.pendingKey);
    } catch { /* Do not block editing when storage is full. */ }
  };
  const publishStatus = (status: AudioLibrarySyncStatus) => { if (active) options.onStatus?.(status); };
  const fail = (error: unknown) => { if (active) { publishStatus('unavailable'); options.fail(error); } };
  const dirty = () => !same(base, local) || (missing && local.length > 0);
  const schedule = () => {
    clearTimeout(timer);
    if (active && hydrated) publishStatus(subscriptionFailed ? 'unavailable' : writing || dirty() ? (failures ? 'retrying' : 'syncing') : 'synced');
    if (!active || !hydrated || writing || !dirty()) return;
    timer = setTimeout(() => { void flush(); }, failures ? Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)) : 500);
  };
  const flush = async () => {
    if (writing || !hydrated || !dirty()) return;
    writing = true;
    publishStatus('syncing');
    const submittedBase = missing ? [] : base;
    const submitted = local;
    try {
      const saved = await options.save(submittedBase, submitted);
      failures = 0;
      local = mergeSounds(submitted, local, saved); base = saved; missing = false;
      remember();
      if (!active) {
        if (dirty()) { base = await options.save(base, local); local = base; remember(); }
        return;
      }
      options.apply(local);
    } catch (error) { failures++; remember(); if (failures === 1) fail(error); publishStatus('retrying'); }
    finally { writing = false; schedule(); }
  };
  publishStatus('loading');
  const unsubscribe = options.subscribe(remote => {
    if (!active) return;
    subscriptionFailed = false;
    hydrated = true; missing = remote === null;
    if (remote !== null) { local = mergeSounds(base, local, remote); base = remote; remember(); options.apply(local); }
    else remember();
    schedule();
  }, error => { subscriptionFailed = true; fail(error); });
  return {
    edit(sounds: SoundConfig[]) { local = portableSounds(sounds); remember(); schedule(); },
    dispose() {
      clearTimeout(timer); unsubscribe();
      if (hydrated && dirty()) void flush();
      active = false;
    },
  };
}
