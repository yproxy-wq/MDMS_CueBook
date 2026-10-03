import { describe, expect, it } from 'vitest';
import { recoveryPrefix, validRecoveryBackup, validRecoveryState, type RecoveryBackup } from './sessionRecoveryService';
import { INITIAL_SCENARIO } from '../constants';
import type { AppState } from '../types';
const now = 1000000000;
const backup: RecoveryBackup = { key: recoveryPrefix('account', INITIAL_SCENARIO.id) + 'tab', scope: 'account',
  scenarioId: INITIAL_SCENARIO.id, owner: 'tab', generation: 'one', timestamp: now,
  state: { currentScenario: INITIAL_SCENARIO, currentPhaseId: 'phase', previewPhaseId: 'phase', volume: .8,
    isPlaying: {}, phaseResults: {}, phaseDurations: {}, timerStates: {}, usedSounds: new Set() } as AppState };
describe('recovery scope and expiry boundaries', () => {
  it('accepts only the exact account/scenario/owner namespace', () => {
    expect(validRecoveryBackup(backup, 'account', INITIAL_SCENARIO.id, now)).toBe(true);
    expect(validRecoveryBackup(backup, 'other', INITIAL_SCENARIO.id, now)).toBe(false);
    expect(validRecoveryBackup(backup, 'account', 'other-scenario', now)).toBe(false);
    expect(validRecoveryBackup({ ...backup, key: backup.key + ':spoof' }, 'account', INITIAL_SCENARIO.id, now)).toBe(false);
  });
  it.each([NaN, Infinity, now + 1, now - 345600000])('rejects malformed/future/expired timestamp %s', timestamp => {
    expect(validRecoveryBackup({ ...backup, timestamp }, 'account', INITIAL_SCENARIO.id, now)).toBe(false);
  });
  it('accepts the last millisecond inside the four-day retention window', () => {
    expect(validRecoveryBackup({ ...backup, timestamp: now - 345599999 }, 'account', INITIAL_SCENARIO.id, now)).toBe(true);
  });
  it('does not confuse delimiter-containing accounts and scenarios', () => {
    expect(recoveryPrefix('a:b', 'c')).not.toBe(recoveryPrefix('a', 'b:c'));
  });
  it('rejects corrupt state and timer fields before offering recovery', () => {
    expect(validRecoveryState({ ...backup.state, timerStates: undefined })).toBe(false);
    expect(validRecoveryState({ ...backup.state, timerStates: { timer: { seconds: NaN, isRunning: true } } })).toBe(false);
    expect(validRecoveryState({ ...backup.state, volume: Infinity })).toBe(false);
  });
});
