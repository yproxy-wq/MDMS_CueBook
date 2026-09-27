import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import { AppState } from '../types';
import { browsePhase, toggleSelectedTimer } from './timerNavigation';

function fixture() {
  const first = { ...INITIAL_SCENARIO.phases[0], id: 'a', timers: [{ id: 'ta', label: 'A', durationMinutes: 2 }] };
  const second = { ...first, id: 'b', isLockedByPrevious: true, isCompleted: true, timers: [{ id: 'tb', label: 'B', durationMinutes: 3 }] };
  return { currentScenario: { ...INITIAL_SCENARIO, phases: [first, second] }, currentPhaseId: 'a', previewPhaseId: 'a',
    timerStates: { ta: { seconds: 120, isRunning: true, startTime: 1000 } }, phaseResults: { a: 8 }, phaseStartTime: 500, isPlaying: { music: true } } as unknown as AppState;
}
describe('browsing and timer ownership', () => {
  it('browses locked/completed phases without changing lifecycle, sound, timers or projection', () => {
    const before = fixture(), after = browsePhase(before, 'b');
    expect(after.previewPhaseId).toBe('b');
    expect(after.currentPhaseId).toBe('a');
    for (const key of ['timerStates', 'currentScenario', 'phaseResults', 'phaseStartTime', 'isPlaying'] as const) expect(after[key]).toBe(before[key]);
    expect(browsePhase(after, 'b')).toBe(after);
    expect(browsePhase(after, 'missing')).toBe(after);
  });
  it('starts a previously uninitialized timer only on explicit action', () => {
    const before = fixture(), after = toggleSelectedTimer(before, 'tb', 5000);
    expect(after.timerStates.tb).toEqual({ seconds: 180, isRunning: true, startTime: 5000 });
    expect(after.currentPhaseId).toBe('b');
    expect(after.timerStates.ta).toBe(before.timerStates.ta);
    expect(after.phaseResults).toBe(before.phaseResults);
    expect(after.currentScenario).toBe(before.currentScenario);
  });
  it('captures fractional elapsed time on pause and resumes from that value', () => {
    const stopped = toggleSelectedTimer(fixture(), 'ta', 2250);
    expect(stopped.timerStates.ta).toEqual({ seconds: 118.75, isRunning: false, startTime: null });
    expect(toggleSelectedTimer(stopped, 'ta', 8000).timerStates.ta).toEqual({ seconds: 118.75, isRunning: true, startTime: 8000 });
    expect(toggleSelectedTimer(stopped, 'missing', 8000)).toBe(stopped);
  });
});
