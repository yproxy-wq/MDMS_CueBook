// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import type { AppState, SoundConfig } from '../types';
import { SoundType } from '../types';
const backend = vi.hoisted(() => ({ listeners: new Map<string, Set<(sounds: SoundConfig[] | null) => void>>(), data: new Map<string, SoundConfig[]>(), saves: vi.fn() }));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('../services/AudioLibraryService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/AudioLibraryService')>();
  return { ...actual,
    subscribeAudioLibrary: (uid: string, id: string, receive: (sounds: SoundConfig[] | null) => void) => {
      const key = `${uid}/${id}`;
      const listeners = backend.listeners.get(key) || new Set(); backend.listeners.set(key, listeners); listeners.add(receive);
      queueMicrotask(() => { if (listeners.has(receive)) receive(backend.data.get(key) || null); });
      return () => { listeners.delete(receive); };
    },
    saveAudioLibrary: async (uid: string, id: string, base: SoundConfig[], local: SoundConfig[]) => {
      backend.saves(uid, id, local);
      const key = `${uid}/${id}`;
      const remote = backend.data.get(key);
      const saved = remote ? actual.mergeSounds(base, local, remote) : local;
      backend.data.set(key, saved);
      for (const receive of backend.listeners.get(key) || []) receive(saved);
      return saved;
    },
  };
});
import { useAudioLibrarySync } from './useAudioLibrarySync';
const sound = (id: string): SoundConfig => ({ id, name: id, url: `https://example.test/${id}.mp3`, type: SoundType.BGM, volume: 1 });
const roots: Root[] = [];
const nodes: HTMLElement[] = [];
const controls = new Map<string, (sounds: SoundConfig[], scenarioId?: string, uid?: string) => void>();
function Device({ name, initial, uid = 'owner', scenarioId = 'scenario' }: { name: string; initial: SoundConfig[]; uid?: string; scenarioId?: string }) {
  const [user, setUser] = useState({ uid, getIdTokenResult: async () => ({ claims: { cuebookPlan: 'biz' } }) } as unknown as User);
  const [state, setState] = useState({ currentScenario: { id: scenarioId, sounds: initial }, timerStates: { unchanged: true } } as unknown as AppState);
  controls.set(name, (sounds, id = state.currentScenario.id, userId = user.uid) => { if (userId !== user.uid) setUser({ uid: userId, getIdTokenResult: async () => ({ claims: { cuebookPlan: 'biz' } }) } as unknown as User); setState(previous => ({ ...previous, currentScenario: { ...previous.currentScenario, id, sounds } })); });
  useAudioLibrarySync(user, true, state, setState, () => {});
  return <output>{JSON.stringify(state.currentScenario.sounds)}</output>;
}
async function mount(name: string, initial: SoundConfig[], uid?: string, scenarioId?: string) {
  const node = document.createElement('div'); document.body.append(node); nodes.push(node);
  const root = createRoot(node); roots.push(root);
  await act(async () => { root.render(<Device {...{ name, initial, uid, scenarioId }} />); });
  return () => JSON.parse(node.textContent || '[]') as SoundConfig[];
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(1200); }); }
beforeEach(() => { localStorage.clear(); vi.stubEnv('VITE_CUEBOOK_TENANT', 'xtv'); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); backend.data.clear(); backend.listeners.clear(); backend.saves.mockClear(); });
afterEach(async () => { for (const root of roots.splice(0)) await act(() => root.unmount()); for (const node of nodes.splice(0)) node.remove(); controls.clear(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('two independent device audio libraries', () => {
  it('seeds existing sounds and hydrates an empty second device without deleting songs', async () => {
    const first = await mount('first', [sound('song')]); await tick();
    const second = await mount('second', []); await tick();
    expect(second()).toEqual(first()); expect(backend.data.get('owner/scenario')).toHaveLength(1);
  });
  it('propagates additions, edits and deletion without a save echo', async () => {
    const first = await mount('first', [sound('song')]); await tick();
    const second = await mount('second', []); await tick(); backend.saves.mockClear();
    await act(() => controls.get('first')!([...first(), sound('new')])); await tick();
    expect(second()).toHaveLength(2);
    await act(() => controls.get('second')!(second().map(s => ({ ...s, name: 'renamed' })))); await tick();
    expect(first()[0].name).toBe('renamed');
    await act(() => controls.get('first')!([])); await tick();
    expect(second()).toEqual([]); expect(backend.saves).toHaveBeenCalledTimes(3);
  });
  it('preserves independent simultaneous edits to the same sound', async () => {
    const first = await mount('first', [sound('song')]); await tick();
    const second = await mount('second', []); await tick();
    await act(() => { controls.get('first')!([{ ...first()[0], name: 'changed' }]); controls.get('second')!([{ ...second()[0], volume: .2 }]); });
    await tick();
    expect(first()[0]).toMatchObject({ name: 'changed', volume: .2 }); expect(second()).toEqual(first());
  });
  it('isolates accounts and scenario switches', async () => {
    backend.data.set('owner/other', [sound('other')]); backend.data.set('different/scenario', [sound('private')]);
    const current = await mount('first', [sound('song')]); await tick();
    await act(() => controls.get('first')!([], 'other')); await tick(); expect(current()[0].id).toBe('other');
    await act(() => controls.get('first')!([], 'scenario', 'different')); await tick(); expect(current()[0].id).toBe('private');
    expect(backend.data.get('owner/scenario')?.[0].id).toBe('song');
  });
  it('does not connect or write in Stable', async () => {
    vi.stubEnv('VITE_CUEBOOK_TENANT', ''); await mount('first', [sound('song')]); await tick();
    expect(backend.listeners.size).toBe(0); expect(backend.saves).not.toHaveBeenCalled();
  });
});


