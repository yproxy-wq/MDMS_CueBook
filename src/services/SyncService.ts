import { doc, setDoc, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { getHandoutDocumentId, parseSessionId, parseHandoutId } from '../utils/syncHelper';
import { networkMonitor } from './NetworkMonitor';

export interface TimerSyncData {
  scenarioId: string;
  phaseId: string;
  timerId: string;
  remainingSeconds: number;
  isRunning: boolean;
  startTime?: number | null; // タイマー開始時刻を同期
  syncTimerEnabled?: boolean;
  syncContentEnabled?: boolean;
  timerSize?: 'small' | 'medium' | 'large';
  timerPosition?: 'top' | 'bottom';
  imageFit?: 'contain' | 'cover' | 'fill' | 'width' | 'height';
  timerForceHidden?: boolean;
  /** Opaque capability ID; required for every publicly readable v2 session document. */
  shareId?: string;
  label?: string;
  activeImageId?: string | null;
  activeImageUrl?: string | null;
  activeImageName?: string | null;
  activeResourceType?: 'image' | 'pdf' | 'video' | null;
  pdfPage?: number;
  lastUpdated?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  lapTimes?: number[] | null;
  lapTexts?: Record<number, string> | null;
  
  // Video playback synchronization fields
  videoPlaying?: boolean;
  videoProgress?: number;
  videoDuration?: number;
  videoVolume?: number;
  videoLoop?: boolean;

  // Lap display synchronization fields
  lapDisplayMode?: 'hidden' | 'overlay' | 'persistent';
  lapDisplayPosition?: 'top' | 'bottom';
  lapNotificationText?: string | null;

  // New要求: オーバーレイと文字色
  overlayType?: 'black' | 'white' | 'none';
  overlayIntensity?: number; // 0.0 - 1.0
  timerColor?: 'black' | 'white';

  // New要求 (v0.86): ラップバナーの帯の大きさ、文字サイズ、タイマー名の文字
  lapBandSize?: 'small' | 'medium' | 'large';
  lapFontSize?: 'small' | 'medium' | 'large';
  timerLabelText?: string;
  urgentShakeEnabled?: boolean;
  imageConfigs?: Record<string, { timerColor?: 'black' | 'white'; overlayType?: 'black' | 'white' | 'none'; overlayIntensity?: number }>;
}

export interface HandoutSyncData {
  /** Opaque capability ID; required for every publicly readable v2 handout. */
  shareId?: string;
  characterId: string;
  characterName: string;
  characterRole?: string;
  characterColor?: string;
  message?: string;
  messages?: string[];
  scenarioTitle?: string;
  playerPresentAt?: unknown;
  lastUpdated?: unknown;
}

// Storage for pending data to ensure latest version is sent
const pendingTimerUpdates = new Map<string, { data: TimerSyncData; isCritical: boolean; scheduledTime: number }>();
const timerFlushIntervals = new Map<string, NodeJS.Timeout>();

const pendingHandoutData = new Map<string, Partial<HandoutSyncData>>();
const debounceTimers = new Map<string, NodeJS.Timeout>();
const lastHandoutSyncCache = new Map<string, string>();
const DEBOUNCE_MS = 500; 

// Automatic safeguard class to detect and prevent Firebase write bloat (frequent automatic writes)
export class WriteBloatGuardian {
  private static attempts = new Map<string, number[]>();
  private static throttles = new Map<string, NodeJS.Timeout>();
  private static pendingTasks = new Map<string, () => Promise<void>>();
  private static pendingWaiters = new Map<string, Array<{ resolve: () => void; reject: (error: unknown) => void }>>();

  private static waitForCoalescedWrite(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const waiters = this.pendingWaiters.get(path) ?? [];
      waiters.push({ resolve, reject });
      this.pendingWaiters.set(path, waiters);
    });
  }

  /**
   * Tracks write attempts for a given Firestore resource path. 
   * If a path experiences 3 or more write requests within a sliding window of 3 seconds:
   * 1. It blocks immediate execution of current/subsequent writes on that path.
   * 2. It holds the latest callback function in memory.
   * 3. It schedules a single throttled save after a 1.5-second cooldown safety delay, coalescing the updates.
   */
  public static async execute(path: string, task: () => Promise<void>): Promise<void> {
    const now = Date.now();
    const timestamps = this.attempts.get(path) || [];
    
    // Slidely clean up old timestamps beyond 3 seconds
    const recent = timestamps.filter(t => now - t < 3000);
    recent.push(now);
    this.attempts.set(path, recent);

    // Keep the absolute latest task callback
    this.pendingTasks.set(path, task);

    // If 3 or more writes occur in 3 seconds: Write Bloat Identified
    if (recent.length >= 3) {
      console.warn(`[WriteBloatGuardian] WRITE BLOAT THRESHOLD EXCEEDED (Path: '${path}', Attempts: ${recent.length} in <3s). Intercepting write to preserve Firestore allocation quota. Enforcing automatic safety throttle & single aggregated flush.`);
      
      if (this.throttles.has(path)) {
        // Coalescing is already active & scheduled, newest function is saved, wait for flush
        return;
      }

      const timeout = setTimeout(async () => {
        this.throttles.delete(path);
        const latestTask = this.pendingTasks.get(path);
        this.pendingTasks.delete(path);
        const waiters = this.pendingWaiters.get(path) ?? [];
        this.pendingWaiters.delete(path);
        if (latestTask) {
          console.log(`[WriteBloatGuardian] Autonomic aggregation complete. Flushing coalesced protected write to path: '${path}'`);
          try {
            await latestTask();
            waiters.forEach(waiter => waiter.resolve());
          } catch (err) {
            console.error(`[WriteBloatGuardian] Coalesced flush failed for '${path}':`, err);
            waiters.forEach(waiter => waiter.reject(err));
          }
        } else {
          waiters.forEach(waiter => waiter.resolve());
        }
      }, 1500);

      this.throttles.set(path, timeout);
      return this.waitForCoalescedWrite(path);
    }

    // Delay-execute if actively in cooldown mode
    if (this.throttles.has(path)) {
      return this.waitForCoalescedWrite(path);
    }

    // Regular pass-through mode
    this.pendingTasks.delete(path);
    await task();
  }
}

/** Removes values Firestore rejects while preserving FieldValue/Timestamp objects. */
export function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, sanitizeForFirestore(fieldValue)])
    ) as T;
  }
  return value;
}

function prepareDataForFirestore(data: TimerSyncData): TimerSyncData {
  const dataToSync = sanitizeForFirestore({ ...data });
  // Safety: Prevent 1MB Firestore limit breach and inform the user
  if (dataToSync.activeImageUrl && dataToSync.activeImageUrl.length > 1000000) {
    console.warn(`[SyncService] Resource URL too large (${Math.round(dataToSync.activeImageUrl.length/1024)}KB). Syncing ID only.`);
    dataToSync.activeImageUrl = null; 
  }
  return dataToSync;
}

// Flush routine to execute combined timer & content writes
async function flushTimerWrite(sessionId: string) {
  const pending = pendingTimerUpdates.get(sessionId);
  if (!pending) return;

  // Release only the timer handle. Keep the payload until the durable write succeeds.
  timerFlushIntervals.delete(sessionId);

  if (isQuotaExceeded()) return;

  const { userId, subSessionId, isSecure } = parseSessionId(sessionId);
  if (!isSecure) {
    console.warn('[SyncService] Refused to write legacy predictable timer session.');
    return;
  }
  const timerRef = doc(db, 'timerSessions', userId, 'sessions', subSessionId);
  const dataToSync = { ...prepareDataForFirestore(pending.data), shareId: subSessionId };

  console.log(`[SyncService] Coalesced/Batched write flushed to Firestore for session ${subSessionId} (Critical/Instant: ${pending.isCritical})`);

  const writePath = `timerSessions/${userId}/sessions/${subSessionId}`;
  try {
    await WriteBloatGuardian.execute(writePath, async () => {
      await networkMonitor.withExponentialBackoff(
        `updateTimerState: ${subSessionId}`,
        () => setDoc(timerRef, {
          ...dataToSync,
          lastUpdated: serverTimestamp()
        }, { merge: true })
      );
    });
    // Do not remove a newer update that arrived while this write was in flight.
    if (pendingTimerUpdates.get(sessionId) === pending) {
      pendingTimerUpdates.delete(sessionId);
    }
  } catch (error) {
    // Preserve the pending payload for an explicit retry/instant flush.
    handleFirestoreError(error, OperationType.WRITE, writePath);
  }
}

export const syncService = {
  async updateTimer(sessionId: string, data: TimerSyncData) {
    if (isQuotaExceeded()) return;
    
    // Merge data into the current aggregated timer session update
    const existing = pendingTimerUpdates.get(sessionId);
    const mergedData = existing ? { ...existing.data, ...data } : data;
    
    pendingTimerUpdates.set(sessionId, {
      data: mergedData,
      isCritical: existing?.isCritical || false,
      scheduledTime: existing?.scheduledTime || Date.now()
    });

    // Schedule or hold routine flush - throttles updates up to 2000ms
    if (!timerFlushIntervals.has(sessionId)) {
      const timeout = setTimeout(() => {
        flushTimerWrite(sessionId);
      }, 2000); // 2-second routine aggregation & batching window
      timerFlushIntervals.set(sessionId, timeout);
    }
  },

  async resetTimerSession(sessionId: string) {
    if (isQuotaExceeded()) return;
    
    // Clear pending queue on session resets to keep state clean
    if (timerFlushIntervals.has(sessionId)) {
      clearTimeout(timerFlushIntervals.get(sessionId)!);
      timerFlushIntervals.delete(sessionId);
    }
    pendingTimerUpdates.delete(sessionId);

    const { userId, subSessionId, isSecure } = parseSessionId(sessionId);
    if (!isSecure) return;
    const timerRef = doc(db, 'timerSessions', userId, 'sessions', subSessionId);
    const writePath = `timerSessions/${userId}/sessions/${subSessionId}`;
    try {
      await WriteBloatGuardian.execute(writePath, async () => {
        await networkMonitor.withExponentialBackoff(
          `resetTimerSession: ${subSessionId}`,
          () => deleteDoc(timerRef)
        );
      });
      console.log(`[SyncService] Session reset: ${userId}/sessions/${subSessionId}`);
    } catch (error) {
       handleFirestoreError(error, OperationType.DELETE, writePath);
    }
  },

  async setTimerInstant(sessionId: string, data: TimerSyncData) {
    if (isQuotaExceeded()) return;
    
    // Cancel any pending deferred timer updates and flush write immediately
    if (timerFlushIntervals.has(sessionId)) {
      clearTimeout(timerFlushIntervals.get(sessionId)!);
      timerFlushIntervals.delete(sessionId);
    }

    const existing = pendingTimerUpdates.get(sessionId);
    const mergedData = existing ? { ...existing.data, ...data } : data;

    pendingTimerUpdates.set(sessionId, {
      data: mergedData,
      isCritical: true,
      scheduledTime: Date.now()
    });

    await flushTimerWrite(sessionId);
  },

  subscribeToTimer(sessionId: string, onUpdate: (data: TimerSyncData | null) => void) {
    if (isQuotaExceeded()) {
      return () => {};
    }
    const { userId, subSessionId, isSecure } = parseSessionId(sessionId);
    if (!isSecure) {
      queueMicrotask(() => onUpdate(null));
      return () => {};
    }
    const timerRef = doc(db, 'timerSessions', userId, 'sessions', subSessionId);
    return onSnapshot(timerRef, (docSnap) => {
      networkMonitor.setFirebaseConnectionState(true);
      networkMonitor.recordSuccess();
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as TimerSyncData);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      networkMonitor.setFirebaseConnectionState(false);
      networkMonitor.recordFailure(error, `subscribeToTimer: ${subSessionId}`);
      handleFirestoreError(error, OperationType.GET, `timerSessions/${userId}/sessions/${subSessionId}`);
    });
  },

  async updateHandout(fullSessionId: string, data: Partial<HandoutSyncData>) {
    if (isQuotaExceeded()) return;
    const key = `handout_${fullSessionId}`;
    
    // Always merge the newest partial data
    const existingData = pendingHandoutData.get(key) || {};
    pendingHandoutData.set(key, { ...existingData, ...data });

    if (debounceTimers.has(key)) return;

    const timeout = setTimeout(async () => {
      debounceTimers.delete(key);
      const latestData = pendingHandoutData.get(key);
      pendingHandoutData.delete(key);

      if (!latestData || isQuotaExceeded()) return;

      const { userId, isSecure } = parseHandoutId(fullSessionId);
      if (!isSecure) {
        console.warn('[SyncService] Refused to write legacy predictable handout session.');
        return;
      }
      const handoutDocumentId = getHandoutDocumentId(fullSessionId);

      // Create stable comparable entry
      const cacheEntry = {
        characterId: latestData.characterId,
        characterName: latestData.characterName,
        characterRole: latestData.characterRole,
        characterColor: latestData.characterColor,
        scenarioTitle: latestData.scenarioTitle,
      };
      
      const stringified = JSON.stringify(cacheEntry);
      if (lastHandoutSyncCache.get(key) === stringified) {
        console.log(`[SyncService] Skipping redundant handout metadata write: ${userId}/characters/${handoutDocumentId}`);
        return;
      }

      // Record in cache before we initiate setDoc to block downstream duplicates
      lastHandoutSyncCache.set(key, stringified);

      console.log(`[SyncService] Updating handout (stable debounce): ${userId}/characters/${handoutDocumentId}`, latestData);
      const handoutRef = doc(db, 'handouts', userId, 'characters', handoutDocumentId);
      const writePath = `handouts/${userId}/characters/${handoutDocumentId}`;
      try {
        await WriteBloatGuardian.execute(writePath, async () => {
          await networkMonitor.withExponentialBackoff(
            `updateHandout: ${handoutDocumentId}`,
          () => setDoc(handoutRef, sanitizeForFirestore({
              ...latestData,
              shareId: handoutDocumentId,
              lastUpdated: serverTimestamp()
            }), { merge: true })
          );
        });
      } catch (error) {
        console.error(`[SyncService] Update handout failed: ${writePath}`, error);
        // Clear cache if write fails so we can retry on next change
        lastHandoutSyncCache.delete(key);
        handleFirestoreError(error, OperationType.WRITE, writePath);
      }
    }, DEBOUNCE_MS);

    debounceTimers.set(key, timeout);
  },

  async sendHandoutMessage(fullSessionId: string, message: string) {
    if (isQuotaExceeded()) return;
    const key = `handout_${fullSessionId}`;
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key)!);
      debounceTimers.delete(key);
    }

    console.log(`[SyncService] Sending message to handout: ${fullSessionId}`, message);
    const { userId, isSecure } = parseHandoutId(fullSessionId);
    if (!isSecure) return;
    const handoutDocumentId = getHandoutDocumentId(fullSessionId);
    const handoutRef = doc(db, 'handouts', userId, 'characters', handoutDocumentId);
    const writePath = `handouts/${userId}/characters/${handoutDocumentId}`;
    try {
      const { arrayUnion } = await import('firebase/firestore');
      await WriteBloatGuardian.execute(writePath, async () => {
        await networkMonitor.withExponentialBackoff(
          `sendHandoutMessage: ${handoutDocumentId}`,
          () => setDoc(handoutRef, {
            messages: arrayUnion(message),
            message: message,
            lastUpdated: serverTimestamp()
          }, { merge: true })
        );
      });
    } catch (error) {
      console.error(`[SyncService] Send handout message failed: ${fullSessionId}`, error);
      handleFirestoreError(error, OperationType.WRITE, writePath);
    }
  },

  async clearHandoutMessages(fullSessionId: string) {
    if (isQuotaExceeded()) return;
    const key = `handout_${fullSessionId}`;
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key)!);
      debounceTimers.delete(key);
    }

    console.log(`[SyncService] Clearing messages for handout: ${fullSessionId}`);
    const { userId, isSecure } = parseHandoutId(fullSessionId);
    if (!isSecure) return;
    const handoutDocumentId = getHandoutDocumentId(fullSessionId);
    const handoutRef = doc(db, 'handouts', userId, 'characters', handoutDocumentId);
    const writePath = `handouts/${userId}/characters/${handoutDocumentId}`;
    try {
      await WriteBloatGuardian.execute(writePath, async () => {
        await networkMonitor.withExponentialBackoff(
          `clearHandoutMessages: ${handoutDocumentId}`,
          () => setDoc(handoutRef, {
            messages: [],
            message: "",
            lastUpdated: serverTimestamp()
          }, { merge: true })
        );
      });
    } catch (error) {
      console.error(`[SyncService] Clear handout messages failed: ${fullSessionId}`, error);
      handleFirestoreError(error, OperationType.WRITE, writePath);
    }
  },

  subscribeToHandout(fullSessionId: string, onUpdate: (data: HandoutSyncData | null) => void, onError?: (error: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (isQuotaExceeded()) {
      onUpdate(null);
      return () => {};
    }
    const { userId, isSecure } = parseHandoutId(fullSessionId);
    if (!isSecure) {
      queueMicrotask(() => onUpdate(null));
      return () => {};
    }
    const handoutDocumentId = getHandoutDocumentId(fullSessionId);
    const handoutRef = doc(db, 'handouts', userId, 'characters', handoutDocumentId);
    return onSnapshot(handoutRef, (docSnap) => {
      networkMonitor.setFirebaseConnectionState(true);
      networkMonitor.recordSuccess();
      if (docSnap.exists()) {
        const data = docSnap.data() as HandoutSyncData;
        
        // Feed the cache to prevent redundant loops
        const key = `handout_${fullSessionId}`;
        const cacheEntry = {
          characterId: data.characterId,
          characterName: data.characterName,
          characterRole: data.characterRole,
          characterColor: data.characterColor,
          scenarioTitle: data.scenarioTitle,
        };
        lastHandoutSyncCache.set(key, JSON.stringify(cacheEntry));
        
        onUpdate(data);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      networkMonitor.setFirebaseConnectionState(false);
      networkMonitor.recordFailure(error, `subscribeToHandout: ${handoutDocumentId}`);
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.GET, `handouts/${userId}/characters/${handoutDocumentId}`);
      }
    });
  },

  async notifyPresence(fullSessionId: string) {
    if (isQuotaExceeded()) return;
    const { userId, isSecure } = parseHandoutId(fullSessionId);
    if (!isSecure) return;
    const handoutDocumentId = getHandoutDocumentId(fullSessionId);
    const handoutRef = doc(db, 'handouts', userId, 'characters', handoutDocumentId);
    const writePath = `handouts/${userId}/characters/${handoutDocumentId}`;
    try {
      await WriteBloatGuardian.execute(writePath, async () => {
        await networkMonitor.withExponentialBackoff(
          `notifyPresence: ${handoutDocumentId}`,
          () => setDoc(handoutRef, {
            playerPresentAt: serverTimestamp()
          }, { merge: true })
        );
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, writePath);
    }
  },

  clearSession(sessionId: string) {
    if (timerFlushIntervals.has(sessionId)) {
      clearTimeout(timerFlushIntervals.get(sessionId)!);
      timerFlushIntervals.delete(sessionId);
    }
    pendingTimerUpdates.delete(sessionId);

    // Clean up handouts associated with this sessionId
    const handoutPrefix = `handout_${sessionId}`;
    for (const key of Array.from(debounceTimers.keys())) {
      if (key.startsWith(handoutPrefix)) {
        clearTimeout(debounceTimers.get(key)!);
        debounceTimers.delete(key);
      }
    }
    for (const key of Array.from(pendingHandoutData.keys())) {
      if (key.startsWith(handoutPrefix)) {
        pendingHandoutData.delete(key);
      }
    }
    for (const key of Array.from(lastHandoutSyncCache.keys())) {
      if (key.startsWith(handoutPrefix)) {
        lastHandoutSyncCache.delete(key);
      }
    }
    console.log(`[SyncService] Session cache and timers fully cleared for sessionId: ${sessionId}`);
  }
};
