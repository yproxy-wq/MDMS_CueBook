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

/** Restore only identities still present in the target scenario. Keep running timer baselines intact. */
export function restoreScenarioSession(scenario: Scenario, saved: ScenarioSessionSnapshot | null, fallbackSync: AppState['syncConfig']) {
  const session = saved?.scenarioId === scenario.id ? saved : null;
  const phases = new Set(scenario.phases.map(phase => phase.id));
  const firstPhase = scenario.phases[0]?.id || '';
  const timerStates = createTimerStatesForScenario(scenario);
  for (const id of Object.keys(timerStates)) {
    const timer = session?.timerStates[id];
    if (timer && Number.isFinite(timer.seconds) && (!timer.isRunning || Number.isFinite(timer.startTime))) {
      timerStates[id] = { ...timer };
    }
  }
  const media = new Set([...(scenario.images || []), ...(scenario.playerImages || [])].map(image => image.id));
  const validImage = (id?: string | null) => id && media.has(id) ? id : null;
  const syncConfig = session?.syncConfig || scenario.syncConfig || fallbackSync;
  return {
    currentPhaseId: session && phases.has(session.currentPhaseId) ? session.currentPhaseId : firstPhase,
    previewPhaseId: session && phases.has(session.previewPhaseId) ? session.previewPhaseId : firstPhase,
    timerStates,
    phaseResults: Object.fromEntries(Object.entries(session?.phaseResults || {}).filter(([id]) => phases.has(id))),
    phaseDurations: Object.fromEntries(Object.entries(session?.phaseDurations || {}).filter(([id]) => phases.has(id))),
    activeImageId: validImage(session?.activeImageId),
    gmActiveImageId: validImage(session?.gmActiveImageId),
    syncConfig: { ...syncConfig, activeImageId: validImage(syncConfig?.activeImageId) },
    sessionStartTime: session?.sessionStartTime,
    phaseStartTime: session && phases.has(session.currentPhaseId) ? session.phaseStartTime : undefined,
    exitTime: session?.exitTime || '',
    isPaused: session?.isPaused ?? false,
  };
}
