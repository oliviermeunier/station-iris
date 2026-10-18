// Tiny IndexedDB cache for API responses. Degrades to "no cache" when IndexedDB is
// unavailable (private mode, tests) — the site must work without it.

const DB_NAME = 'station-iris';
const STORE = 'http';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

interface Entry {
  url: string;
  t: number;
  data: unknown;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'url' });
      req.onsuccess = () => {
        const db = req.result;
        void prune(db);
        resolve(db);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function prune(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (Date.now() - (cursor.value as Entry).t > MAX_AGE_MS) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function cacheGet<T>(url: string, ttlMs: number): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get(url);
    req.onsuccess = () => {
      const entry = req.result as Entry | undefined;
      resolve(entry && Date.now() - entry.t < ttlMs ? (entry.data as T) : undefined);
    };
    req.onerror = () => resolve(undefined);
  });
}

export async function cachePut(url: string, data: unknown): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ url, t: Date.now(), data } satisfies Entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
