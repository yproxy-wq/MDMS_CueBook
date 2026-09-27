import { describe, expect, it } from 'vitest';
import { SyncConfig } from '../types';
import { createDefaultSyncConfig, setSyncActiveMedia, setSyncTimerVisibility } from './syncConfig';

describe('sync config commands', () => {
  it('uses one operator-facing timer visibility switch', () => {
    const hidden = setSyncTimerVisibility({ ...createDefaultSyncConfig(), timerForceHidden: true }, false);
    expect(hidden.timerEnabled).toBe(false);
    expect(hidden.timerForceHidden).toBe(false);

    const shown = setSyncTimerVisibility(hidden, true);
    expect(shown.timerEnabled).toBe(true);
    expect(shown.timerForceHidden).toBe(false);
  });

  it('selects a media item and restores its saved display settings', () => {
    const config = {
      ...createDefaultSyncConfig(),
      imageConfigs: {
        moon: { timerColor: 'black', overlayType: 'white', overlayIntensity: 0.3 },
      },
    } as SyncConfig;
    expect(setSyncActiveMedia(config, ' moon ')).toMatchObject({
      activeImageId: 'moon',
      timerColor: 'black',
      overlayType: 'white',
      overlayIntensity: 0.3,
    });
  });
});
