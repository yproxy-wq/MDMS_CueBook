// One lock per document, held without polling or React updates. A frozen tab
// still holds its lock; a missing BroadcastChannel reply never proves a crash.
export const recoveryOwnerLock = (owner: string) => `cuebook-recovery-owner:${owner}`;
export type OwnerStatus = 'alive' | 'absent' | 'unknown';

export class RecoveryPresence {
  private releaseLock?: () => void;
  private channel?: BroadcastChannel;
  private lockReady: Promise<boolean>;
  private closed = false;

  constructor(readonly owner: string) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('cuebook-recovery-presence-v2');
        this.channel.onmessage = event => {
          if (event.data?.type === 'probe' && event.data.owner === owner) {
            this.channel?.postMessage({ type: 'alive', owner, probe: event.data.probe });
          }
        };
      } catch { /* Capability may exist but be disabled by browser policy. */ }
    }
    this.lockReady = new Promise(resolve => {
      if (!navigator.locks) { resolve(false); return; }
      void navigator.locks.request(recoveryOwnerLock(owner), async () => {
        if (this.closed) { resolve(false); return; }
        await new Promise<void>(release => { this.releaseLock = release; resolve(true); });
      }).catch(() => resolve(false));
    });
  }

  async status(owner: string): Promise<OwnerStatus> {
    if (await this.lockReady) {
      try {
        const snapshot = await navigator.locks.query();
        return snapshot.held?.some(lock => lock.name === recoveryOwnerLock(owner)) ? 'alive' : 'absent';
      } catch { /* Fall back to positive replies only. */ }
    }
    if (!this.channel) return 'unknown';
    const channel = this.channel;
    const probe = crypto.randomUUID();
    return new Promise(resolve => {
      const finish = (status: OwnerStatus) => {
        clearTimeout(timeout);
        channel.removeEventListener('message', receive);
        resolve(status);
      };
      const receive = (event: MessageEvent) => {
        if (event.data?.type === 'alive' && event.data.owner === owner && event.data.probe === probe) finish('alive');
      };
      const timeout = setTimeout(() => finish('unknown'), 350);
      channel.addEventListener('message', receive);
      try { channel.postMessage({ type: 'probe', owner, probe }); }
      catch { finish('unknown'); }
    });
  }

  // Keep a candidate reserved while its dialog is open. Never wait for another
  // dialog, and never consume a candidate merely because it was reserved.
  async claim(key: string): Promise<(() => void) | null> {
    if (!await this.lockReady) return () => {};
    return new Promise(resolve => {
      void navigator.locks.request(`cuebook-recovery-claim:${key}`, { ifAvailable: true }, async lock => {
        if (!lock || this.closed) { resolve(null); return; }
        await new Promise<void>(release => resolve(release));
      }).catch(() => resolve(null));
    });
  }

  close() {
    this.closed = true;
    this.releaseLock?.();
    this.channel?.close();
  }
}
