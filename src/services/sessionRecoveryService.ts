import { AppState } from '../types';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'TheMastermindDeckDB';
const STORE_NAME = 'sessions';
const BINDING_STORE_NAME = 'scenarioBindings';
// Keep this aligned with StorageService. Opening a lower explicit version than
// an existing database throws VersionError before onupgradeneeded can recover.
const DB_VERSION = 3;
const BACKUP_KEY = 'session_recovery_backup';

export interface RecoveryBackup {
  state: AppState;
  timestamp: number;
  key: string;
  generation: string;
  owner: string;
  scope: string;
  scenarioId: string;
}
export const recoveryPrefix = (scope: string, scenarioId: string) =>
  `session_recovery_v2:${JSON.stringify([scope, scenarioId])}:`;
export const recoveryCleanKey = (owner: string) => `cuebook_recovery_clean_v2:${owner}`;

export function validRecoveryState(state: AppState): boolean {
  const record = (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  return Boolean(state?.currentScenario?.id && Array.isArray(state.currentScenario.phases) &&
    typeof state.currentPhaseId === 'string' && typeof state.previewPhaseId === 'string' &&
    Number.isFinite(state.volume) && state.volume >= 0 && state.volume <= 1 &&
    record(state.isPlaying) && record(state.phaseResults) && record(state.phaseDurations) && record(state.timerStates) &&
    (Array.isArray(state.usedSounds) || state.usedSounds instanceof Set) &&
    Object.values(state.timerStates).every(timer => timer && Number.isFinite(timer.seconds) && timer.seconds >= 0 &&
      typeof timer.isRunning === 'boolean' && (timer.startTime == null || Number.isFinite(timer.startTime))));
}

export function validRecoveryBackup(value: RecoveryBackup, scope: string, scenarioId: string, now = Date.now()): boolean {
  return Boolean(value && value.scope === scope && value.scenarioId === scenarioId &&
    value.state?.currentScenario?.id === scenarioId && validRecoveryState(value.state) &&
    value.owner && value.generation && value.key === recoveryPrefix(scope, scenarioId) + value.owner &&
    Number.isFinite(value.timestamp) && value.timestamp <= now && now - value.timestamp < 345600000);
}

class SessionRecoveryService {
  private db: IDBDatabase | null = null;

  async saveOwnedBackup(state: AppState, scope: string, owner: string): Promise<void> {
    const db = await this.getDB();
    const scenarioId = state.currentScenario.id;
    const sanitizeUrl = (url: string) => url?.startsWith('data:') && url.length > 50000 ? '' : url;
    const backup = {
      key: recoveryPrefix(scope, scenarioId) + owner, generation: uuidv4(),
      scope, owner, scenarioId, timestamp: Date.now(),
      state: { ...state, usedSounds: Array.from(state.usedSounds || []), currentScenario: {
        ...state.currentScenario,
        images: state.currentScenario.images?.map(image => ({ ...image, url: sanitizeUrl(image.url) })),
        sounds: state.currentScenario.sounds?.map(sound => ({ ...sound, url: sanitizeUrl(sound.url) })),
      } },
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(backup, backup.key);
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  }

  async listOwnedBackups(scope: string, scenarioId: string): Promise<RecoveryBackup[]> {
    const db = await this.getDB();
    const prefix = recoveryPrefix(scope, scenarioId);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      request.onsuccess = () => resolve(request.result
        .filter(value => validRecoveryBackup(value, scope, scenarioId))
        .map(value => ({ ...value, state: { ...value.state, usedSounds: new Set(value.state.usedSounds || []) } }))
        .sort((a, b) => b.timestamp - a.timestamp));
      request.onerror = () => reject(request.error);
    });
  }

  // Read and delete inside one transaction: a newer generation is never lost.
  async consumeBackup(backup: RecoveryBackup): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      let consumed = false;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(backup.key);
      request.onsuccess = () => {
        if (request.result?.generation === backup.generation) {
          store.delete(backup.key);
          consumed = true;
        }
      };
      transaction.oncomplete = () => resolve(consumed);
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const openDB = (version?: number) => {
        const request = indexedDB.open(DB_NAME, version);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('scenarios')) {
            db.createObjectStore('scenarios');
            console.log(`[IndexedDB/Session] Created object store 'scenarios' during upgrade.`);
          }
          if (!db.objectStoreNames.contains('sessions')) {
            db.createObjectStore('sessions');
            console.log(`[IndexedDB/Session] Created object store 'sessions' during upgrade.`);
          }
          if (!db.objectStoreNames.contains(BINDING_STORE_NAME)) {
            db.createObjectStore(BINDING_STORE_NAME);
            console.log(`[IndexedDB/Session] Created object store '${BINDING_STORE_NAME}' during upgrade.`);
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn(`[IndexedDB/Session] Object store '${STORE_NAME}' is missing! Triggering self-healing upgrade to version ${db.version + 1}...`);
            const nextVersion = db.version + 1;
            db.close();
            openDB(nextVersion);
          } else {
            this.db = db;
            db.onversionchange = () => {
              db.close();
              if (this.db === db) this.db = null;
            };
            resolve(db);
          }
        };

        request.onerror = (event) => {
          const error = (event.target as IDBOpenDBRequest).error;
          // A previous app version may already have upgraded the shared DB.
          // Retry without an explicit version to open that current schema.
          if (version !== undefined && error?.name === 'VersionError') {
            openDB();
            return;
          }
          reject(error);
        };
      };

      openDB(DB_VERSION);
    });
  }

  async getBackup(): Promise<{ state: AppState; timestamp: number } | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(BACKUP_KEY);
        request.onsuccess = () => {
          const result = request.result;
          if (result && validRecoveryState(result.state)) {
            // Restore Set for usedSounds
            if (Array.isArray(result.state.usedSounds)) {
              result.state.usedSounds = new Set(result.state.usedSounds);
            } else {
              result.state.usedSounds = new Set();
            }
            resolve(result);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Failed to load session backup from IndexedDB:", e);
      throw e;
    }
  }


}

export const sessionRecoveryService = new SessionRecoveryService();
