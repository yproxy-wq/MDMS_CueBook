import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import { createScenarioSessionSnapshot, createTimerStatesForScenario, restoreScenarioSession } from './scenarioSession';

describe('scenarioSession', () => {
  it('creates stopped timer state for every timer in a scenario', () => {
    const timers = createTimerStatesForScenario(INITIAL_SCENARIO);
    const firstTimer = INITIAL_SCENARIO.phases[0]?.timers?.[0];
    if (!firstTimer) throw new Error('Initial scenario requires a timer for this test');

    expect(timers[firstTimer.id]).toEqual({
      seconds: firstTimer.durationMinutes * 60,
      isRunning: false,
      startTime: null,
    });
  });

  it('scopes a session snapshot to the active scenario', () => {
    const snapshot = createScenarioSessionSnapshot({
      currentScenario: INITIAL_SCENARIO,
      currentPhaseId: 'phase-a', previewPhaseId: 'phase-b', timerStates: {}, phaseResults: {}, phaseDurations: {},
      isPlaying: {}, volume: 0.8, isDucking: false, isEditorMode: false, isPaused: false, usedSounds: new Set(),
      exitTime: '', activeImageId: null, gmActiveImageId: null, syncConfig: INITIAL_SCENARIO.syncConfig, pdfPageStates: {},
    }, 123);

    expect(snapshot).toMatchObject({ scenarioId: INITIAL_SCENARIO.id, currentPhaseId: 'phase-a', savedAt: 123 });
  });
});


describe('restoring scenario progress', () => {
  const scenario = { ...INITIAL_SCENARIO, phases: [
    { ...INITIAL_SCENARIO.phases[0], id: 'p1', timers: [{ id: 't1', label: 'Timer', durationMinutes: 10 }] },
    { ...INITIAL_SCENARIO.phases[0], id: 'p2', timers: [] },
  ] };
  const saved = { scenarioId: scenario.id, currentPhaseId: 'p1', previewPhaseId: 'p2',
    timerStates: { t1: { seconds: 599, isRunning: false, startTime: null }, deleted: { seconds: 1, isRunning: false } },
    phaseResults: { p1: 12, deleted: 3 }, phaseDurations: { p1: 15 }, savedAt: 123, isPaused: true };

  it('restores paused time and the independently viewed phase after switching away and back', () => {
    expect(restoreScenarioSession(scenario, saved, scenario.syncConfig)).toMatchObject({
      currentPhaseId: 'p1', previewPhaseId: 'p2', timerStates: { t1: { seconds: 599, isRunning: false } }, isPaused: true,
    });
  });
  it('preserves a running timer baseline without restarting the clock', () => {
    const running = { ...saved, timerStates: { t1: { seconds: 599, isRunning: true, startTime: 123456 } } };
    expect(restoreScenarioSession(scenario, running, scenario.syncConfig).timerStates.t1).toEqual(running.timerStates.t1);
  });
  it('drops deleted identities and initializes newly added timers', () => {
    const restored = restoreScenarioSession(scenario, { ...saved, currentPhaseId: 'deleted', previewPhaseId: 'deleted', activeImageId: 'deleted' }, scenario.syncConfig);
    expect(restored.currentPhaseId).toBe('p1');
    expect(restored.previewPhaseId).toBe('p1');
    expect(Object.keys(restored.timerStates)).toEqual(['t1']);
    expect(restored.phaseResults).toEqual({ p1: 12 });
    expect(restored.activeImageId).toBeNull();
    expect(restoreScenarioSession(scenario, null, scenario.syncConfig).timerStates.t1.seconds).toBe(600);
  });
  it('uses initial timers for older saved sessions without timerStates', () => {
    expect(restoreScenarioSession(scenario, { ...saved, timerStates: undefined } as unknown as typeof saved, scenario.syncConfig).timerStates.t1.seconds).toBe(600);
  });
  it('ignores another scenario snapshot and invalid running baselines', () => {
    expect(restoreScenarioSession(scenario, { ...saved, scenarioId: 'other' }, scenario.syncConfig).timerStates.t1.seconds).toBe(600);
    expect(restoreScenarioSession(scenario, { ...saved, timerStates: { t1: { seconds: 3, isRunning: true, startTime: null } } }, scenario.syncConfig).timerStates.t1.isRunning).toBe(false);
  });
});
