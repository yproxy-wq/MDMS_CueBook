import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import { createScenarioSessionSnapshot, createTimerStatesForScenario } from './scenarioSession';

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
