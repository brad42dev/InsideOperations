/**
 * pointCacheDb — IndexedDB helpers for the `point-cache` store.
 *
 * Caches the last-known values for all bindings in a graphic so the
 * TileGraphicViewer can display stale-but-useful data while offline.
 *
 * Uses the shared `io-offline` database opened by useOfflineRounds.
 */

const DB_NAME = "io-offline";
const STORE_NAME = "point-cache";
const DB_VERSION = 2;

// Re-open the same shared database.  We keep a module-level promise so we
// only call indexedDB.open() once per page load.
let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      // onupgradeneeded is handled by useOfflineRounds' openDb(); if this
      // open races with it, the IDB spec guarantees only one upgrade runs.
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        const oldVersion = e.oldVersion;
        if (oldVersion < 2 && db.objectStoreNames.contains("pending-rounds")) {
          db.deleteObjectStore("pending-rounds");
        }
        const stores = [
          "sync-queue",
          "rounds-data",
          "media-blobs",
          "point-cache",
          "tile-cache",
        ];
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id", autoIncrement: true });
          }
        }
      };
      request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export interface PointCacheEntry {
  /** Graphic ID — used as the IDB record key. */
  id: string;
  /** Map from pointId to last-known value (as a plain object for JSON serialisation). */
  values: Record<
    string,
    { value: string | number | boolean | null; quality?: string }
  >;
  cachedAt: string; // ISO-8601
}

/**
 * Write (or overwrite) the cached point values for a graphic.
 *
 * @param graphicId  Graphic identifier.
 * @param values     Current live point values to persist.
 */
export async function cachePointValues(
  graphicId: string,
  values: Record<
    string,
    { value: string | number | boolean | null; quality?: string }
  >,
): Promise<void> {
  const db = await getDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const entry: PointCacheEntry = {
      id: graphicId,
      values,
      cachedAt: new Date().toISOString(),
    };
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Read the cached point values for a graphic.
 *
 * @returns The cache entry, or `null` if nothing has been cached yet.
 */
export async function getPointCache(
  graphicId: string,
): Promise<PointCacheEntry | null> {
  const db = await getDb();
  return new Promise<PointCacheEntry | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(graphicId);
    req.onsuccess = () => resolve((req.result as PointCacheEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}
