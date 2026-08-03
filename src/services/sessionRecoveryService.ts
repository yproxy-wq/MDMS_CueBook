import { AppState } from '../types';

const DB_NAME = 'TheMastermindDeckDB';
const STORE_NAME = 'sessions';
const DB_VERSION = 2;
const BACKUP_KEY = 'session_recovery_backup';
const CLEAN_EXIT_KEY = 'session_recovery_clean_exit';

class SessionRecoveryService {
  private db: IDBDatabase | null = null;

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
            resolve(db);
          }
        };

        request.onerror = (event) => {
          reject((event.target as IDBOpenDBRequest).error);
        };
      };

      openDB(DB_VERSION);
    });
  }

  async saveBackup(state: AppState): Promise<void> {
    try {
      const db = await this.getDB();
      
      // Sanitize the scenario data to avoid saving gigantic Base64/data URLs
      const sanitizedScenario = {
        ...state.currentScenario,
        images: state.currentScenario.images?.map(img => ({
          ...img,
          url: img.url && img.url.startsWith('data:') && img.url.length > 50000 ? '' : img.url
        })),
        sounds: state.currentScenario.sounds?.map(snd => ({
          ...snd,
          url: snd.url && snd.url.startsWith('data:') && snd.url.length > 50000 ? '' : snd.url
        }))
      };

      // Since Set cannot be directly serialized, convert usedSounds Set to Array
      const usedSoundsArray = state.usedSounds instanceof Set
        ? Array.from(state.usedSounds)
        : Array.isArray(state.usedSounds)
          ? state.usedSounds
          : [];

      const backupStateData = {
        ...state,
        currentScenario: sanitizedScenario,
        usedSounds: usedSoundsArray
      };

      const backup = {
        state: backupStateData,
        timestamp: Date.now()
      };

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(backup, BACKUP_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Failed to save session backup to IndexedDB:", e);
    }
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
          if (result && result.state) {
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
      return null;
    }
  }

  async clearBackup(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(BACKUP_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Failed to clear session backup from IndexedDB:", e);
    }
  }

  async saveCleanExit(value: boolean): Promise<void> {
    try {
      // Synchronously update localStorage as a robust synchronous backup
      if (value) {
        localStorage.setItem('cuebook_session_clean_exit_fallback', 'true');
      } else {
        localStorage.removeItem('cuebook_session_clean_exit_fallback');
      }

      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, CLEAN_EXIT_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Failed to save clean exit status:", e);
    }
  }

  async isCleanExit(): Promise<boolean> {
    try {
      // Try synchronous fallback first
      if (localStorage.getItem('cuebook_session_clean_exit_fallback') === 'true') {
        return true;
      }

      const db = await this.getDB();
      return new Promise<boolean>((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(CLEAN_EXIT_KEY);
        request.onsuccess = () => {
          resolve(request.result === true);
        };
        request.onerror = () => {
          resolve(true); // Default to clean in case of storage failure
        };
      });
    } catch (e) {
      console.warn("Failed to read clean exit state:", e);
      return true;
    }
  }
}

export const sessionRecoveryService = new SessionRecoveryService();
