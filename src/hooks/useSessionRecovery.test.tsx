// @vitest-environment jsdom
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import type { AppState } from '../types';
import { useSessionRecovery } from './useSessionRecovery';
import { recoveryCleanKey, type RecoveryBackup } from '../services/sessionRecoveryService';

const mocks = vi.hoisted(() => ({ list: vi.fn(), legacy: vi.fn(), save: vi.fn(), consume: vi.fn(), status: vi.fn(), claim: vi.fn(), release: vi.fn(), close: vi.fn() }));
vi.mock('../services/sessionRecoveryService', async importOriginal => ({
  ...await importOriginal<typeof import('../services/sessionRecoveryService')>(),
  sessionRecoveryService: { listOwnedBackups: mocks.list, getBackup: mocks.legacy, saveOwnedBackup: mocks.save, consumeBackup: mocks.consume },
}));
vi.mock('../services/recoveryPresence', () => ({ RecoveryPresence: class {
  status = mocks.status; claim = mocks.claim; close = mocks.close;
} }));
const state: AppState = { currentScenario: INITIAL_SCENARIO, usedSounds: new Set(['track']), volume: .4,
  currentPhaseId: 'phase', previewPhaseId: 'phase', isPlaying: {}, isDucking: false, isEditorMode: true,
  phaseResults: {}, phaseDurations: {},
  timerStates: { timer: { seconds: 120, isRunning: true, startTime: 1000 } } };
const candidate = (): RecoveryBackup => ({ state, timestamp: Date.now(), key: 'candidate-key', generation: 'one', owner: 'other-tab', scope: 'user-a', scenarioId: INITIAL_SCENARIO.id });
let result: ReturnType<typeof useSessionRecovery>;
let root: Root;
let container: HTMLDivElement;
function Harness({ ready = true, scope = 'user-a', data = state }: { ready?: boolean; scope?: string | null; data?: AppState }) {
  const recovery = useSessionRecovery(ready, data, scope);
  useEffect(() => { result = recovery; });
  return null;
}
async function render(props: React.ComponentProps<typeof Harness> = {}) {
  await act(() => root.render(<Harness {...props} />));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); localStorage.clear();
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.list.mockResolvedValue([candidate()]); mocks.legacy.mockResolvedValue(null);
  mocks.save.mockResolvedValue(undefined); mocks.consume.mockResolvedValue(true);
  mocks.status.mockResolvedValue('alive'); mocks.claim.mockResolvedValue(mocks.release);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('scoped session recovery', () => {
  it('starts and saves with secure random bytes when randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    mocks.list.mockResolvedValue([]); await render();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(mocks.save.mock.calls[0][2]).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(result.showRecoveryModal).toBe(false);
  });
  it('does not block a healthy additional tab, and rerenders do not restart startup checks', async () => {
    await render(); await render({ data: { ...state, volume: .8 } });
    expect(result.showRecoveryModal).toBe(false); expect(result.backupData).toBeNull();
    expect(mocks.list).toHaveBeenCalledTimes(1); expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('waits for scenario and authentication readiness instead of cancelling a slow pre-ready lookup', async () => {
    await render({ ready: false, scope: null }); expect(mocks.list).not.toHaveBeenCalled();
    await render({ ready: true, scope: null }); expect(mocks.list).not.toHaveBeenCalled();
    mocks.status.mockResolvedValue('absent'); await render();
    expect(result.showRecoveryModal).toBe(true);
  });
  it('freezes a crashed-owner candidate while saving the new tab separately for more than 20 seconds', async () => {
    const saved = candidate(); mocks.list.mockResolvedValue([saved]); mocks.status.mockResolvedValue('absent');
    await render(); await act(() => vi.advanceTimersByTimeAsync(36000));
    expect(result.backupData).toBe(saved); expect(result.showRecoveryModal).toBe(true);
    expect(mocks.save).toHaveBeenCalledTimes(3);
    expect(mocks.save.mock.calls.every(([, scope, owner]) => scope === 'user-a' && owner !== saved.owner)).toBe(true);
    expect(mocks.consume).not.toHaveBeenCalled();
  });
  it('another tab exiting cannot mark this candidate clean; BFCache does not mark this tab clean', async () => {
    localStorage.setItem(recoveryCleanKey('unrelated-tab'), 'true'); mocks.status.mockResolvedValue('absent');
    await render(); expect(result.showRecoveryModal).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(5000)); const owner = mocks.save.mock.calls[0][2];
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    expect(localStorage.getItem(recoveryCleanKey(owner))).toBeNull();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    expect(localStorage.getItem(recoveryCleanKey(owner))).toBe('true');
    window.dispatchEvent(new PageTransitionEvent('pageshow')); expect(localStorage.getItem(recoveryCleanKey(owner))).toBeNull();
  });
  it('unknown owner status offers optional recovery; a clean owner does not need recovery', async () => {
    mocks.status.mockResolvedValue('unknown'); await render();
    expect(result.backupData).not.toBeNull(); expect(result.showRecoveryModal).toBe(false);
    await act(() => result.dismiss()); expect(mocks.consume).not.toHaveBeenCalled();
    localStorage.setItem(recoveryCleanKey('other-tab'), 'true');
    await render({ ready: false }); await render(); expect(result.backupData).toBeNull();
  });
  it('does not show a duplicate dialog when another startup has reserved the candidate', async () => {
    mocks.status.mockResolvedValue('absent'); mocks.claim.mockResolvedValue(null); await render();
    expect(result.backupData).toBeNull(); expect(result.showRecoveryModal).toBe(false);
  });
  it('ignores a stale lookup after an account change', async () => {
    let resolve!: (value: RecoveryBackup[]) => void;
    mocks.list.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await render(); mocks.list.mockResolvedValue([]); await render({ scope: 'user-b' });
    await act(() => resolve([candidate()])); expect(result.backupData).toBeNull();
  });
  it('keeps backup on a failed destination save; retry preserves timer base and R2 state', async () => {
    mocks.status.mockResolvedValue('absent'); await render(); const restore = vi.fn();
    mocks.save.mockRejectedValueOnce(new Error('quota'));
    await act(() => result.complete(restore)); expect(restore).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled(); expect(result.backupData).not.toBeNull();
    await act(() => result.complete(restore));
    expect(restore).toHaveBeenCalledWith(state); expect(result.backupData).toBeNull();
    expect(mocks.consume).toHaveBeenCalledTimes(1);
  });
  it('does not apply a pending restore to a switched account or scenario', async () => {
    mocks.status.mockResolvedValue('absent'); await render(); let resolve!: () => void;
    mocks.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
    const restore = vi.fn(); let pending!: Promise<void>;
    await act(() => { pending = result.complete(restore); });
    mocks.list.mockResolvedValue([]); await render({ scope: 'user-b' });
    await act(async () => { resolve(); await pending; });
    expect(restore).not.toHaveBeenCalled(); expect(mocks.consume).not.toHaveBeenCalled();
  });
  it('keeps unowned legacy data nonblocking and never deletes it automatically or on opt-in restore', async () => {
    mocks.list.mockResolvedValue([]); mocks.legacy.mockResolvedValue({ state, timestamp: Date.now() });
    await render(); expect(result.legacyAvailable).toBe(true); expect(result.showRecoveryModal).toBe(false);
    expect(result.backupData).toBeNull();
    await act(() => result.inspectLegacy()); expect(result.showRecoveryModal).toBe(true);
    await act(() => result.complete(vi.fn())); expect(mocks.consume).not.toHaveBeenCalled();
  });
  it('does not consume or apply a pending restoration after the recovery screen unmounts', async () => {
    mocks.status.mockResolvedValue('absent'); await render(); let resolve!: () => void;
    mocks.save.mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
    const restore = vi.fn(); let pending!: Promise<void>;
    await act(() => { pending = result.complete(restore); });
    await act(() => root.render(null));
    await act(async () => { resolve(); await pending; });
    expect(restore).not.toHaveBeenCalled(); expect(mocks.consume).not.toHaveBeenCalled();
  });
});
