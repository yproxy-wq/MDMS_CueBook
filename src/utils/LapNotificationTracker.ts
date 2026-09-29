/** Tracks notification events independently of repeated sync snapshots. */
export class LapNotificationTracker {
  private scope = '';
  private seconds: number | null = null;
  private reached = new Set<number>();

  reconcile(scope: string, laps: readonly number[], seconds: number): boolean {
    const reset = this.seconds === null || this.scope !== scope || seconds > this.seconds + 1;
    this.scope = scope;
    this.seconds = seconds;
    if (reset) {
      this.reached = new Set(laps.filter(lap => seconds <= lap * 60));
    }
    return reset;
  }

  takeTriggers(scope: string, laps: readonly number[], seconds: number): number[] {
    this.reconcile(scope, laps, seconds);
    if (seconds <= 0) return [];
    const triggers = [...laps].sort((a, b) => b - a).filter(lap => seconds <= lap * 60 && !this.reached.has(lap));
    triggers.forEach(lap => this.reached.add(lap));
    return triggers;
  }
}
