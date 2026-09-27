import { ImageResource, SyncConfig } from '../types';

export const createDefaultSyncConfig = (): SyncConfig => ({
  timerEnabled: true,
  contentEnabled: true,
  timerSize: 'small',
  timerPosition: 'bottom',
  imageFit: 'cover',
  activeImageId: null,
  timerForceHidden: false,
  lapDisplayMode: 'overlay',
  lapDisplayPosition: 'top',
});

export const normalizeSyncConfig = (config: SyncConfig | null | undefined): SyncConfig => ({
  ...createDefaultSyncConfig(),
  ...config,
  activeImageId: config?.activeImageId ? String(config.activeImageId).trim() : null,
});

/**
 * The main-screen toggle represents the effective player-facing visibility.
 * A write clears the legacy emergency-hide flag, so the visible state is not
 * ambiguous to the operator.
 */
export const setSyncTimerVisibility = (
  config: SyncConfig | null | undefined,
  visible: boolean,
): SyncConfig => ({
  ...normalizeSyncConfig(config),
  timerEnabled: visible,
  timerForceHidden: false,
});

export const setSyncActiveMedia = (
  config: SyncConfig | null | undefined,
  activeImageId: string | null,
  media?: Pick<ImageResource, 'timerColor' | 'overlayType'> | null,
): SyncConfig => {
  const next = normalizeSyncConfig(config);
  const normalizedId = activeImageId ? String(activeImageId).trim() : null;
  const perMediaConfig = normalizedId ? next.imageConfigs?.[normalizedId] : undefined;
  const selectedConfig = perMediaConfig || media;
  return {
    ...next,
    activeImageId: normalizedId,
    ...(selectedConfig?.timerColor ? { timerColor: selectedConfig.timerColor } : {}),
    ...(selectedConfig?.overlayType ? { overlayType: selectedConfig.overlayType } : {}),
    ...(perMediaConfig?.overlayIntensity !== undefined ? { overlayIntensity: perMediaConfig.overlayIntensity } : {}),
  };
};
