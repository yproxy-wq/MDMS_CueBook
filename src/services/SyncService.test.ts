import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandoutSessionId, createTimerSessionId } from '../utils/syncHelper';

const firestore = vi.hoisted(() => ({
  doc: vi.fn((...path: unknown[]) => ({ path })),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  arrayUnion: vi.fn((value: unknown) => ({ arrayUnion: value })),
}));

const firebase = vi.hoisted(() => ({
  db: { name: 'test-db' },
  handleFirestoreError: vi.fn(),
  isQuotaExceeded: vi.fn(() => false),
  OperationType: { GET: 'GET', WRITE: 'WRITE', DELETE: 'DELETE' },
}));

vi.mock('firebase/firestore', () => firestore);
vi.mock('../lib/firebase', () => firebase);
vi.mock('./NetworkMonitor', () => ({
  networkMonitor: {
    withExponentialBackoff: vi.fn(async (_operation: string, task: () => Promise<void>) => task()),
    setFirebaseConnectionState: vi.fn(),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

import { sanitizeForFirestore, syncService, TimerSyncData, WriteBloatGuardian } from './SyncService';

const timerData: TimerSyncData = {
  scenarioId: 'scenario-1',
  phaseId: 'phase-1',
  timerId: 'timer-1',
  remainingSeconds: 120,
  isRunning: true,
  startTime: 1000,
};

describe('SyncService capability integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebase.isQuotaExceeded.mockReturnValue(false);
  });

  it('writes a secure timer only to the capability document and persists its matching shareId', async () => {
    const shareId = 'a'.repeat(64);
    await syncService.setTimerInstant(createTimerSessionId('gm-a', shareId), timerData);

    expect(firestore.doc).toHaveBeenCalledWith(firebase.db, 'timerSessions', 'gm-a', 'sessions', shareId);
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ...timerData, shareId }),
      { merge: true },
    );
    expect(firestore.setDoc.mock.calls[0][1]).not.toHaveProperty('pinCode');
    expect(firestore.setDoc.mock.calls[0][1]).not.toHaveProperty('updatedBy');
  });

  it('removes undefined fields recursively before a Firestore write', () => {
    expect(sanitizeForFirestore({
      imageConfigs: undefined,
      nested: { timerColor: 'white', overlayType: undefined },
      list: ['kept', undefined],
    })).toEqual({
      nested: { timerColor: 'white' },
      list: ['kept'],
    });
  });

  it('never sends an undefined imageConfigs field to Firestore', async () => {
    const shareId = 'c'.repeat(64);
    await syncService.setTimerInstant(createTimerSessionId('gm-c', shareId), {
      ...timerData,
      imageConfigs: undefined,
    });

    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ imageConfigs: undefined }),
      { merge: true },
    );
  });

  it('rejects writes and subscriptions that use a predictable legacy session ID', async () => {
    const update = vi.fn();
    await expect(syncService.setTimerInstant('gm-a_scenario-1', timerData)).rejects.toThrow('Timer sync write failed');
    syncService.subscribeToTimer('gm-a_scenario-1', update);
    await Promise.resolve();

    expect(firestore.doc).not.toHaveBeenCalled();
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(null);
  });

  it('keeps existing handout content when a presence-only update is debounced and flushed', async () => {
    vi.useFakeTimers();
    const shareId = 'b'.repeat(64);
    const sessionId = createHandoutSessionId('gm-b', shareId);

    const completion = syncService.updateHandout(sessionId, { playerPresentAt: 'presence-marker' });
    await vi.advanceTimersByTimeAsync(500);
    await completion;

    expect(firestore.doc).toHaveBeenCalledWith(firebase.db, 'handouts', 'gm-b', 'characters', shareId);
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ playerPresentAt: 'presence-marker', shareId }),
      { merge: true },
    );
    vi.useRealTimers();
  });

  it('waits for durable handout completion and retries a failed write without dropping the payload', async () => {
    vi.useFakeTimers();
    const shareId = 'd'.repeat(64);
    const sessionId = createHandoutSessionId('gm-d', shareId);
    const firstError = new Error('offline');
    firestore.setDoc.mockRejectedValueOnce(firstError).mockResolvedValue(undefined);

    const completion = syncService.updateHandout(sessionId, { characterId: 'char-d', characterName: 'D' });
    const rejection = completion.catch((error) => error);
    await vi.advanceTimersByTimeAsync(500);
    await expect(rejection).resolves.toBe(firstError);

    await vi.advanceTimersByTimeAsync(2000);
    expect(firestore.setDoc).toHaveBeenCalledTimes(2);
    expect(firestore.setDoc.mock.calls[1][1]).toEqual(expect.objectContaining({
      characterId: 'char-d',
      characterName: 'D',
      shareId,
    }));
    vi.useRealTimers();
  });

  it('does not acknowledge a throttled write before its coalesced task completes', async () => {
    vi.useFakeTimers();
    const path = `test-path-${Date.now()}`;
    const task = vi.fn().mockResolvedValue(undefined);

    await WriteBloatGuardian.execute(path, task);
    await WriteBloatGuardian.execute(path, task);
    const pending = WriteBloatGuardian.execute(path, task);
    let settled = false;
    void pending.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(1499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
    expect(task).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('keeps every write after the throttle threshold pending until the latest task is durable', async () => {
    vi.useFakeTimers();
    const path = `burst-path-${Date.now()}`;
    const first = vi.fn().mockResolvedValue(undefined);
    const latest = vi.fn().mockResolvedValue(undefined);

    await WriteBloatGuardian.execute(path, first);
    await WriteBloatGuardian.execute(path, first);
    const third = WriteBloatGuardian.execute(path, first);
    const fourth = WriteBloatGuardian.execute(path, latest);
    let thirdSettled = false;
    let fourthSettled = false;
    void third.then(() => { thirdSettled = true; });
    void fourth.then(() => { fourthSettled = true; });

    await vi.advanceTimersByTimeAsync(1499);
    expect(thirdSettled).toBe(false);
    expect(fourthSettled).toBe(false);
    expect(latest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(Promise.all([third, fourth])).resolves.toEqual([undefined, undefined]);
    expect(latest).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('rejects every throttled caller when the latest coalesced write fails', async () => {
    vi.useFakeTimers();
    const path = `failed-burst-path-${Date.now()}`;
    const failure = new Error('durable write failed');
    const first = vi.fn().mockResolvedValue(undefined);
    const latest = vi.fn().mockRejectedValue(failure);

    await WriteBloatGuardian.execute(path, first);
    await WriteBloatGuardian.execute(path, first);
    const third = WriteBloatGuardian.execute(path, first);
    const fourth = WriteBloatGuardian.execute(path, latest);
    const thirdOutcome = third.catch(error => error);
    const fourthOutcome = fourth.catch(error => error);

    await vi.advanceTimersByTimeAsync(1500);
    await expect(thirdOutcome).resolves.toBe(failure);
    await expect(fourthOutcome).resolves.toBe(failure);
    expect(latest).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
