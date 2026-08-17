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
  /** Generated PDF page-image asset. The child view exchanges this ID for a short-lived URL. */
  pdfAssetId?: string | null;
  pdfPageCount?: number | null;
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
const pendingTimerWaiters = new Map<string, Array<{ resolve: () => void; reject: (error: unknown) => void }>>();

const pendingHandoutData = new Map<string, Partial<HandoutSyncData>>();
const debounceTimers = new Map<string, NodeJS.Timeout>();
const lastHandoutSyncCache = new Map<string, string>();
const pendingHandoutWaiters = new Map<string, Array<{ resolve: () => void; reject: (error: unknown) => void }>>();
const DEBOUNCE_MS = 500; 
const HANDOUT_RETRY_MS = 2000;
const TIMER_RETRY_MS = 2000;

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
        // Coalescing is already active & scheduled. Every caller must wait for the
        // same durable flush; resolving here would let callers mark unsaved data as
        // synchronized.
        return this.waitForCoalescedWrite(path);
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

function handoutCacheSignature(data: Partial<HandoutSyncData>) {
  return JSON.stringify(sanitizeForFirestore(data));
}

function settleHandoutWaiters(key: string, error?: unknown) {
  const waiters = pendingHandoutWaiters.get(key) ?? [];
  pendingHandoutWaiters.delete(key);
  waiters.forEach((waiter) => error === undefined ? waiter.resolve() : waiter.reject(error));
}

function settleTimerWaiters(sessionId: string, error?: unknown) {
  const waiters = pendingTimerWaiters.get(sessionId) ?? [];
  pendingTimerWaiters.delete(sessionId);
  waiters.forEach((waiter) => error === undefined ? waiter.resolve() : waiter.reject(error));
}

function scheduleTimerFlush(sessionId: string, delayMs = 2000) {
  if (timerFlushIntervals.has(sessionId)) return;
  const timeout = setTimeout(() => {
    void flushTimerWrite(sessionId);
  }, delayMs);
  timerFlushIntervals.set(sessionId, timeout);
}

function scheduleHandoutFlush(key: string, fullSessionId: string, delayMs = DEBOUNCE_MS) {
  if (debounceTimers.has(key)) return;
  const timeout = setTimeout(() => {
    debounceTimers.delete(key);
    void flushHandoutWrite(key, fullSessionId);
  }, delayMs);
  debounceTimers.set(key, timeout);
}

async function flushHandoutWrite(key: string, fullSessionId: string) {
  const latestData = pendingHandoutData.get(key);
  if (!latestData) {
    settleHandoutWaiters(key);
    return;
  }

  if (isQuotaExceeded()) {
    settleHandoutWaiters(key, new Error('Firestore quota is currently exceeded.'));
    return;
  }

  const { userId, isSecure } = parseHandoutId(fullSessionId);
  if (!isSecure) {
    pendingHandoutData.delete(key);
    settleHandoutWaiters(key, new Error('Refused to write a legacy predictable handout session.'));
    return;
  }

  const handoutDocumentId = getHandoutDocumentId(fullSessionId);
  const handoutRef = doc(db, 'handouts', userId, 'characters', handoutDocumentId);
  const writePath = `handouts/${userId}/characters/${handoutDocumentId}`;
  const payload = sanitizeForFirestore({
    ...latestData,
    shareId: handoutDocumentId,
    lastUpdated: serverTimestamp()
  });

  try {
    await WriteBloatGuardian.execute(writePath, async () => {
      await networkMonitor.withExponentialBackoff(
        `updateHandout: ${handoutDocumentId}`,
        () => setDoc(handoutRef, payload, { merge: true })
      );
    });

    // Keep a newer payload that arrived while this write was in flight.
    if (pendingHandoutData.get(key) === latestData) {
      pendingHandoutData.delete(key);
    }
    lastHandoutSyncCache.set(key, handoutCacheSignature(latestData));
    settleHandoutWaiters(key);
  } catch (error) {
    // Preserve the payload and retry later; a failed durable write must not acknowledge the update.
    console.error(`[SyncService] Update handout failed: ${writePath}`, error);
    lastHandoutSyncCache.delete(key);
    settleHandoutWaiters(key, error);
    scheduleHandoutFlush(key, fullSessionId, HANDOUT_RETRY_MS);
    handleFirestoreError(error, OperationType.WRITE, writePath);
  }
}

// Flush routine to execute combined timer & content writes
async function flushTimerWrite(sessionId: string): Promise<boolean> {
  const pending = pendingTimerUpdates.get(sessionId);
  if (!pending) {
    settleTimerWaiters(sessionId);
    return true;
  }

  // Release only the timer handle. Keep the payload until the durable write succeeds.
  timerFlushIntervals.delete(sessionId);

  if (isQuotaExceeded()) {
    settleTimerWaiters(sessionId, new Error('Firestore quota is currently exceeded.'));
    return false;
  }

  const { userId, subSessionId, isSecure } = parseSessionId(sessionId);
  if (!isSecure) {
    console.warn('[SyncService] Refused to write legacy predictable timer session.');
    pendingTimerUpdates.delete(sessionId);
    settleTimerWaiters(sessionId, new Error('Refused to write a legacy predictable timer session.'));
    return false;
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
    settleTimerWaiters(sessionId);
    return true;
  } catch (error) {
    // Preserve the pending payload and retry later; a failed durable write must not acknowledge it.
    handleFirestoreError(error, OperationType.WRITE, writePath);
    settleTimerWaiters(sessionId, error);
    scheduleTimerFlush(sessionId, TIMER_RETRY_MS);
    return false;
  }
}

export const syncService = {
  async updateTimer(sessionId: string, data: TimerSyncData) {
    if (isQuotaExceeded()) return Promise.reject(new Error('Firestore quota is currently exceeded.'));
    
    // Merge data into the current aggregated timer session update
    const existing = pendingTimerUpdates.get(sessionId);
    const mergedData = existing ? { ...existing.data, ...data } : data;
    
    pendingTimerUpdates.set(sessionId, {
      data: mergedData,
      isCritical: existing?.isCritical || false,
      scheduledTime: existing?.scheduledTime || Date.now()
    });

    const completion = new Promise<void>((resolve, reject) => {
      const waiters = pendingTimerWaiters.get(sessionId) ?? [];
      waiters.push({ resolve, reject });
      pendingTimerWaiters.set(sessionId, waiters);
    });
    // Schedule or hold routine flush - throttles updates up to 2000ms
    scheduleTimerFlush(sessionId, 2000);
    return completion;
  },

  async resetTimerSession(sessionId: string) {
    if (isQuotaExceeded()) return;
    
    // Clear pending queue on session resets to keep state clean
    if (timerFlushIntervals.has(sessionId)) {
      clearTimeout(timerFlushIntervals.get(sessionId)!);
      timerFlushIntervals.delete(sessionId);
    }
    pendingTimerUpdates.delete(sessionId);
    settleTimerWaiters(sessionId, new Error('Timer session was reset before the write completed.'));

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
    if (isQuotaExceeded()) return Promise.reject(new Error('Firestore quota is currently exceeded.'));
    
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

    const succeeded = await flushTimerWrite(sessionId);
    if (!succeeded) {
      throw new Error(`Timer sync write failed for ${sessionId}`);
    }
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
    if (isQuotaExceeded()) return Promise.reject(new Error('Firestore quota is currently exceeded.'));
    const key = `handout_${fullSessionId}`;
    
    // Always merge the newest partial data
    const existingData = pendingHandoutData.get(key) || {};
    pendingHandoutData.set(key, { ...existingData, ...data });

    if (lastHandoutSyncCache.get(key) === handoutCacheSignature(pendingHandoutData.get(key)!)) {
      return Promise.resolve();
    }

    const completion = new Promise<void>((resolve, reject) => {
      const waiters = pendingHandoutWaiters.get(key) ?? [];
      waiters.push({ resolve, reject });
      pendingHandoutWaiters.set(key, waiters);
    });
    scheduleHandoutFlush(key, fullSessionId);
    return completion;
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
    settleTimerWaiters(sessionId, new Error('Session was cleared before the timer write completed.'));

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
    for (const key of Array.from(pendingHandoutWaiters.keys())) {
      if (key.startsWith(handoutPrefix)) {
        settleHandoutWaiters(key, new Error('Session was cleared before the handout write completed.'));
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
