import { describe, expect, it } from 'vitest';
import { LapNotificationTracker } from './LapNotificationTracker';

describe('player lap notification events', () => {
  it('fires once across repeated sync snapshots, pause/resume and continuing ticks', () => {
    const tracker = new LapNotificationTracker();
    tracker.reconcile('timer', [2, 1], 130);
    expect(tracker.takeTriggers('timer', [2, 1], 120)).toEqual([2]);
    for (const seconds of [119, 118, 118, 117, 110]) {
      expect(tracker.reconcile('timer', [2, 1], seconds)).toBe(false);
      expect(tracker.takeTriggers('timer', [2, 1], seconds)).toEqual([]);
    }
    expect(tracker.takeTriggers('timer', [2, 1], 60)).toEqual([1]);
    expect(tracker.takeTriggers('timer', [2, 1], 0)).toEqual([]);
  });
  it('does not replay elapsed laps on joining a running timer', () => {
    const tracker = new LapNotificationTracker();
    expect(tracker.takeTriggers('timer', [2, 1], 104)).toEqual([]);
    expect(tracker.takeTriggers('timer', [2, 1], 103)).toEqual([]);
    expect(tracker.takeTriggers('timer', [2, 1], 60)).toEqual([1]);
  });
  it('rearms after a reset or timer change without replaying already elapsed laps', () => {
    const tracker = new LapNotificationTracker();
    tracker.reconcile('first', [2], 130);
    expect(tracker.takeTriggers('first', [2], 119)).toEqual([2]);
    expect(tracker.reconcile('first', [2], 130)).toBe(true);
    expect(tracker.takeTriggers('first', [2], 120)).toEqual([2]);
    expect(tracker.takeTriggers('second', [2], 104)).toEqual([]);
    tracker.reconcile('second', [2], 130);
    expect(tracker.takeTriggers('second', [2], 120)).toEqual([2]);
  });
});
