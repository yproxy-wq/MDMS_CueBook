// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import type { AppState } from '../types';
import type { TimerSyncData } from '../services/SyncService';

const transport = vi.hoisted(() => ({
  receive: null as null | ((data: TimerSyncData) => void),
  instant: vi.fn(), routine: vi.fn(),
}));
vi.mock('../services/SyncService', () => ({ syncService: {
  subscribeToTimer: (_id: string, receive: (data: TimerSyncData) => void) => { transport.receive = receive; return () => {}; },
  setTimerInstant: transport.instant, updateTimer: transport.routine,
} }));
vi.mock('../lib/firebase', () => ({ isQuotaExceeded: () => false }));
vi.mock('../services/R2AssetService', () => ({ getR2AssetId: () => null, isR2Asset: () => false }));
import { useTimerSync } from './useTimerSync';

let root: Root;
let host: HTMLDivElement;
let state: AppState;
const user = { uid: 'echo-test' } as User;
function Harness({ value }: { value: AppState }) {
  useTimerSync(user, value, false, value.currentScenario.phases[0], 0);
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  transport.instant.mockReset(); transport.routine.mockReset();
  state = { currentScenario: { id: 'echo', syncShareId: crypto.randomUUID().replaceAll('-', '').repeat(2), phases: [{ id: 'phase', timers: [{ id: 'timer', durationMinutes: 2 }] }] }, currentPhaseId: 'phase', timerStates: { timer: { seconds: 120, isRunning: false, startTime: null } } } as unknown as AppState;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('does not resend a local snapshot echo before durable acknowledgement, but sends a changed timer immediately', async () => {
  let finish!: () => void;
  transport.instant.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await act(() => root.render(<Harness value={state} />));
  expect(transport.instant).toHaveBeenCalledTimes(1);
  const payload = transport.instant.mock.calls[0][1];
  await act(() => transport.receive!({ ...payload }));
  await act(() => transport.receive!({ ...payload }));
  expect(transport.instant).toHaveBeenCalledTimes(1);
  await act(() => finish());
  await act(() => transport.receive!({ ...payload }));
  expect(transport.instant).toHaveBeenCalledTimes(1);
  const next = { ...state, timerStates: { timer: { seconds: 120, isRunning: true, startTime: 123456 } } };
  await act(() => root.render(<Harness value={next} />));
  expect(transport.instant).toHaveBeenCalledTimes(2);
  expect(transport.instant.mock.calls[1][1]).toMatchObject({ remainingSeconds: 120, startTime: 123456, isRunning: true });
  await act(() => finish());
});

it('releases the pending signature after failure so a later state change can retry', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  let fail!: (error: Error) => void;
  transport.instant.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; })).mockResolvedValue(undefined);
  await act(() => root.render(<Harness value={state} />));
  await act(() => fail(new Error('offline')));
  await act(() => root.render(<Harness value={{ ...state, timerStates: { ...state.timerStates } }} />));
  expect(transport.instant).toHaveBeenCalledTimes(2);
});

it('sends a new start while the stopped snapshot is pending and an older acknowledgement cannot release it', async () => {
  const finishes: Array<() => void> = [];
  transport.instant.mockImplementation(() => new Promise<void>(resolve => { finishes.push(resolve); }));
  await act(() => root.render(<Harness value={state} />));
  const next = { ...state, timerStates: { timer: { seconds: 120, isRunning: true, startTime: 654321 } } };
  await act(() => root.render(<Harness value={next} />));
  expect(transport.instant).toHaveBeenCalledTimes(2);
  await act(() => finishes[0]());
  await act(() => transport.receive!({ ...transport.instant.mock.calls[1][1] }));
  expect(transport.instant).toHaveBeenCalledTimes(2);
  await act(() => finishes[1]());
});
