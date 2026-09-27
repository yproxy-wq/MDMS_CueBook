import { Phase, Scenario, SoundConfig, SoundType, SyncConfig, TimerConfig } from '../types';

const firstPhase = (scenario: Scenario): Phase | undefined => scenario.phases?.[0];

export const selectTimerTargetPhase = (scenario: Scenario, timerTargetPhaseId: string): Phase | undefined =>
  scenario.phases?.find((phase) => phase.id === timerTargetPhaseId) || firstPhase(scenario);

export const selectViewedPhase = (scenario: Scenario, viewedPhaseId: string): Phase | undefined =>
  scenario.phases?.find((phase) => phase.id === viewedPhaseId) || firstPhase(scenario);

export const selectTimer = (
  timerTargetPhase: Phase | null | undefined,
  selectedTimerIndex: number,
): TimerConfig | undefined =>
  timerTargetPhase?.timers?.[selectedTimerIndex] || timerTargetPhase?.timers?.[0];

export const selectViewedPhaseRecommendedSoundIds = (
  viewedPhase: Phase | null | undefined,
): string[] => viewedPhase?.recommendedSounds || [];

export const selectViewedPhaseRecommendedBgmSounds = (
  sounds: SoundConfig[],
  viewedPhase: Phase | null | undefined,
): SoundConfig[] => {
  const recommendedSoundIds = new Set(selectViewedPhaseRecommendedSoundIds(viewedPhase));
  return sounds.filter((sound) => sound.type === SoundType.BGM && recommendedSoundIds.has(sound.id));
};

/** syncConfig is authoritative once present; activeImageId remains a legacy/UI mirror. */
export const selectSyncActiveMediaId = (
  syncConfig: SyncConfig | null | undefined,
  legacyActiveMediaId: string | null | undefined,
): string | null => {
  const activeMediaId = syncConfig ? syncConfig.activeImageId : legacyActiveMediaId;
  return activeMediaId ? String(activeMediaId).trim() : null;
};

export const isSyncTimerVisible = (config: SyncConfig | null | undefined): boolean =>
  (config?.timerEnabled ?? true) && !(config?.timerForceHidden ?? false);

export const isSyncContentVisible = (config: SyncConfig | null | undefined): boolean =>
  config?.contentEnabled ?? true;
