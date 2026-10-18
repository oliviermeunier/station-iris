// Tiny IndexedDB cache for API responses. Strictly best-effort: any failure (private mode,
// quota exceeded, a connection Safari dropped) degrades to "no cache", never to an error.

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
        // The browser may close the connection behind our back: reopen next time.
        db.onclose = () => (dbPromise = null);
        prune(db);
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Runs one transaction; resolves `fallback` on any failure, including a thrown `transaction()`. */
function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fallback: T,
  body: (store: IDBObjectStore, done: (v: T) => void) => void,
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: T) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const tx = db.transaction(STORE, mode);
      tx.oncomplete = () => done(fallback);
      tx.onerror = () => done(fallback);
      tx.onabort = () => done(fallback);
      body(tx.objectStore(STORE), done);
    } catch {
      dbPromise = null;
      done(fallback);
    }
  });
}

function prune(db: IDBDatabase): void {
  void run(db, 'readwrite', undefined, (store) => {
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (Date.now() - (cursor.value as Entry).t > MAX_AGE_MS) cursor.delete();
      cursor.continue();
    };
  });
}

export async function cacheGet<T>(url: string, ttlMs: number): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return run<T | undefined>(db, 'readonly', undefined, (store, done) => {
    const req = store.get(url);
    req.onsuccess = () => {
      const entry = req.result as Entry | undefined;
      done(entry && Date.now() - entry.t < ttlMs ? (entry.data as T) : undefined);
    };
  });
}

/** Fire-and-forget: callers must not wait on the cache. */
export function cachePut(url: string, data: unknown): void {
  void open().then((db) => {
    if (!db) return;
    return run(db, 'readwrite', undefined, (store) => {
      store.put({ url, t: Date.now(), data } satisfies Entry);
    });
  });
}
