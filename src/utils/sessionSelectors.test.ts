import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import { Phase, SoundConfig, SoundType, SyncConfig } from '../types';
import {
  isSyncContentVisible,
  isSyncTimerVisible,
  selectSyncActiveMediaId,
  selectTimer,
  selectTimerTargetPhase,
  selectViewedPhase,
  selectViewedPhaseRecommendedBgmSounds,
  selectViewedPhaseRecommendedSoundIds,
} from './sessionSelectors';

const phases: Phase[] = [
  { ...INITIAL_SCENARIO.phases[0], id: 'timer-phase', recommendedSounds: ['timer-bgm'], timers: [{ id: 't1', label: 'T1', durationMinutes: 1 }] },
  { ...INITIAL_SCENARIO.phases[0], id: 'viewed-phase', recommendedSounds: ['viewed-bgm'], timers: [{ id: 't2', label: 'T2', durationMinutes: 2 }] },
];
const scenario = { ...INITIAL_SCENARIO, phases };

describe('session selectors', () => {
  it('keeps the timer target separate from the viewed phase', () => {
    const timerTarget = selectTimerTargetPhase(scenario, 'timer-phase');
    const viewed = selectViewedPhase(scenario, 'viewed-phase');
    expect(timerTarget?.id).toBe('timer-phase');
    expect(viewed?.id).toBe('viewed-phase');
    expect(selectTimer(timerTarget, 0)?.id).toBe('t1');
    expect(selectViewedPhaseRecommendedSoundIds(viewed)).toEqual(['viewed-bgm']);
  });

  it('selects only BGM recommendations for the persistent audio controls', () => {
    const viewed = { ...phases[1], recommendedSounds: ['bgm', 'se'] };
    const sounds: SoundConfig[] = [
      { id: 'bgm', name: 'BGM', url: '', type: SoundType.BGM },
      { id: 'se', name: 'SE', url: '', type: SoundType.SE },
    ];
    expect(selectViewedPhaseRecommendedBgmSounds(sounds, viewed).map((sound) => sound.id)).toEqual(['bgm']);
  });

  it('falls back safely when saved selections are stale', () => {
    const timerTarget = selectTimerTargetPhase(scenario, 'missing');
    expect(timerTarget?.id).toBe('timer-phase');
    expect(selectViewedPhase(scenario, 'missing')?.id).toBe('timer-phase');
    expect(selectTimer(timerTarget, 99)?.id).toBe('t1');
  });

  it('uses syncConfig as sync media authority with a legacy fallback', () => {
    expect(selectSyncActiveMediaId(undefined, 'legacy')).toBe('legacy');
    expect(selectSyncActiveMediaId({ activeImageId: ' synced ' } as SyncConfig, 'legacy')).toBe('synced');
    expect(selectSyncActiveMediaId({ activeImageId: null } as SyncConfig, 'legacy')).toBeNull();
  });

  it('centralizes timer and content visibility conditions', () => {
    expect(isSyncTimerVisible(undefined)).toBe(true);
    expect(isSyncTimerVisible({ timerEnabled: true, timerForceHidden: true } as SyncConfig)).toBe(false);
    expect(isSyncTimerVisible({ timerEnabled: false, timerForceHidden: false } as SyncConfig)).toBe(false);
    expect(isSyncContentVisible(undefined)).toBe(true);
    expect(isSyncContentVisible({ contentEnabled: false } as SyncConfig)).toBe(false);
  });
});
