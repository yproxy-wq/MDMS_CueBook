import { AppState } from '../types';

export function browsePhase(state: AppState, phaseId: string): AppState {
  return state.previewPhaseId === phaseId || !state.currentScenario.phases.some(p => p.id === phaseId)
    ? state : { ...state, previewPhaseId: phaseId };
}

/** Only an explicit timer action moves the timer/projection target. */
export function toggleSelectedTimer(state: AppState, timerId: string, now: number): AppState {
  const phase = state.currentScenario.phases.find(p => p.timers?.some(t => t.id === timerId));
  const timer = phase?.timers.find(t => t.id === timerId);
  if (!phase || !timer) return state;
  const previous = state.timerStates[timerId] || { seconds: timer.durationMinutes * 60, isRunning: false, startTime: null };
  const seconds = previous.isRunning && previous.startTime != null
    ? Math.max(0, previous.seconds - (now - previous.startTime) / 1000) : previous.seconds;
  return { ...state, currentPhaseId: phase.id, timerStates: {
    ...state.timerStates,
    [timerId]: { ...previous, seconds, isRunning: !previous.isRunning, startTime: previous.isRunning ? null : now },
  }};
}
