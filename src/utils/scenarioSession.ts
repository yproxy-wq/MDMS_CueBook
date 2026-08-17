import type { AppState, Scenario } from '../types';
import type { ScenarioSessionSnapshot } from '../services/StorageService';

export function createTimerStatesForScenario(scenario: Scenario): AppState['timerStates'] {
  const timers: AppState['timerStates'] = {};
  (scenario.phases || []).forEach(phase => {
    (phase.timers || []).forEach(timer => {
      timers[timer.id] = { seconds: timer.durationMinutes * 60, isRunning: false, startTime: null };
    });
  });
  return timers;
}

export function createScenarioSessionSnapshot(state: AppState, savedAt = Date.now()): ScenarioSessionSnapshot {
  return {
    scenarioId: state.currentScenario.id,
    currentPhaseId: state.currentPhaseId,
    previewPhaseId: state.previewPhaseId,
    timerStates: state.timerStates,
    phaseResults: state.phaseResults,
    phaseDurations: state.phaseDurations,
    activeImageId: state.activeImageId,
    gmActiveImageId: state.gmActiveImageId,
    syncConfig: state.syncConfig,
    sessionStartTime: state.sessionStartTime,
    phaseStartTime: state.phaseStartTime,
    exitTime: state.exitTime,
    isPaused: state.isPaused,
    savedAt,
  };
}
