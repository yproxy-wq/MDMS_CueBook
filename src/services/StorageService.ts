
import { Scenario } from '../types';
import { validateAndMigrateScenario } from '../utils/scenarioValidator';

const DB_NAME = 'TheMastermindDeckDB';
const STORE_NAME = 'scenarios';
const DB_VERSION = 2;

class StorageService {
  private db: IDBDatabase | null = null;
  private openingDb: Promise<IDBDatabase> | null = null;
  private writeChains = new Map<string, Promise<void>>();

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    if (this.openingDb) return this.openingDb;

    this.openingDb = new Promise<IDBDatabase>((resolve, reject) => {
      const openDB = (version?: number) => {
        const request = indexedDB.open(DB_NAME, version);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('scenarios')) {
            db.createObjectStore('scenarios');
            console.log(`[IndexedDB/Storage] Created object store 'scenarios' during upgrade.`);
          }
          if (!db.objectStoreNames.contains('sessions')) {
            db.createObjectStore('sessions');
            console.log(`[IndexedDB/Storage] Created object store 'sessions' during upgrade.`);
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.onversionchange = () => {
            db.close();
            this.db = null;
          };
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.warn(`[IndexedDB/Storage] Object store '${STORE_NAME}' is missing! Triggering self-healing upgrade to version ${db.version + 1}...`);
            const nextVersion = db.version + 1;
            db.close();
            openDB(nextVersion);
          } else {
            this.db = db;
            resolve(db);
          }
        };

        request.onblocked = () => {
          console.warn('[IndexedDB/Storage] Database upgrade blocked by another connection.');
        };

        request.onerror = (event) => {
          const err = (event.target as IDBOpenDBRequest).error;
          if (err && err.name === 'VersionError' && version !== undefined) {
            console.warn('[IndexedDB/Storage] VersionError encountered, opening current version without explicit version parameter.');
            openDB(undefined);
            return;
          }
          reject(err);
        };
      };

      openDB(DB_VERSION);
    }).finally(() => {
      this.openingDb = null;
    });

    return this.openingDb;
  }

  private async runTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      let result: T;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async saveScenario(id: string, data: Scenario): Promise<void> {
    const previous = this.writeChains.get(id) ?? Promise.resolve();
    const write = previous
      .catch(() => undefined)
      .then(() => this.runTransaction(STORE_NAME, 'readwrite', store => store.put(data, id)))
      .then(() => undefined);
    this.writeChains.set(id, write);
    try {
      await write;
    } finally {
      if (this.writeChains.get(id) === write) this.writeChains.delete(id);
    }
  }

  async loadScenario(id: string): Promise<Scenario | null> {
    return this.runTransaction(STORE_NAME, 'readonly', store => store.get(id)).then(result => result || null);
  }

  migrateScenarioData(scen: Scenario): Scenario {
    return validateAndMigrateScenario(scen);
  }
}

export const storageService = new StorageService();
