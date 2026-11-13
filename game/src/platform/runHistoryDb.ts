import {
  RUN_HISTORY_VERSION,
  type RunHistoryStore,
  type StoredRun,
} from '../persistence/runHistory';

/** The run history's own database, apart from the save in localStorage. */
const DB_NAME = 'simlab.history';
const RUNS = 'runs';

const promised = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

/**
 * The run history in IndexedDB: one store of runs keyed by `runId`. The database is opened once,
 * on first use, and shared; a failure to open (no IndexedDB, storage blocked, an upgrade blocked
 * by another tab) rejects every call, which the game reports — it never reaches the save.
 */
export function createRunHistoryDb(): RunHistoryStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(DB_NAME, RUN_HISTORY_VERSION);
      request.onupgradeneeded = () => {
        // Version 1 creates the store; later versions upgrade its records here, keeping them.
        if (!request.result.objectStoreNames.contains(RUNS)) {
          request.result.createObjectStore(RUNS, { keyPath: 'runId' });
        }
      };
      request.onblocked = () => reject(new Error('the run history is open in an older tab'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close(); // let a newer tab upgrade it
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not open'));
    }));

  /** Runs `work` in one transaction on the runs store; resolves once it is committed. */
  const write = async (work: (runs: IDBObjectStore) => void) => {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(RUNS, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      work(tx.objectStore(RUNS));
    });
  };

  return {
    load: async () =>
      promised<unknown[]>((await open()).transaction(RUNS).objectStore(RUNS).getAll()),
    put: (run: StoredRun) => write((runs) => runs.put(run)),
    delete: (runId: string) => write((runs) => runs.delete(runId)),
  };
}
