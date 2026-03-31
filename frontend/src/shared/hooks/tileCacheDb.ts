/**
 * tileCacheDb — IndexedDB helpers for the `tile-cache` store.
 *
 * Caches tile Blobs from the graphic tile pyramid so phones can view graphics
 * while offline.  LRU eviction keeps at most 10 unique graphics and stays
 * within 70% of the available IndexedDB quota.
 *
 * Storage layout (one IDB record per tile):
 *   id:          `${graphicId}/${z}/${x}/${y}`
 *   graphicId:   string   — for per-graphic eviction
 *   z, x, y:     number   — tile coordinates
 *   blob:        Blob     — raw PNG tile data
 *   accessedAt:  string   — ISO-8601, updated on every read and write
 *   sizeBytes:   number   — blob.size at write time
 */

const DB_NAME = "io-offline";
const STORE_NAME = "tile-cache";
const DB_VERSION = 2;

/** Max number of distinct graphic IDs to keep cached simultaneously. */
const MAX_GRAPHICS = 10;
/** Fraction of estimated available quota to stay under. */
const QUOTA_FRACTION = 0.7;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
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

export interface TileCacheRecord {
  /** Composite key: `${graphicId}/${z}/${x}/${y}` */
  id: string;
  graphicId: string;
  z: number;
  x: number;
  y: number;
  blob: Blob;
  accessedAt: string;
  sizeBytes: number;
}

function tileKey(graphicId: string, z: number, x: number, y: number): string {
  return `${graphicId}/${z}/${x}/${y}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read all tile records from the store. */
async function getAllTiles(db: IDBDatabase): Promise<TileCacheRecord[]> {
  return new Promise<TileCacheRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as TileCacheRecord[]);
    req.onerror = () => reject(req.error);
  });
}

/** Delete all tiles for a specific graphicId. */
async function deleteTilesForGraphic(
  db: IDBDatabase,
  graphicId: string,
): Promise<void> {
  const all = await getAllTiles(db);
  const toDelete = all
    .filter((r) => r.graphicId === graphicId)
    .map((r) => r.id);
  if (toDelete.length === 0) return;
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const id of toDelete) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evict cached tiles to stay within quota and the MAX_GRAPHICS limit.
 *
 * Should be called before writing new tile sets.  Eviction strategy:
 * 1. If more than MAX_GRAPHICS distinct graphic IDs are cached, evict the
 *    graphic that was accessed least recently (LRU by max accessedAt across
 *    its tiles).
 * 2. If total cached size exceeds 70% of the estimated available quota,
 *    continue evicting least-recently-used graphics until under budget.
 */
export async function evictLRU(): Promise<void> {
  const db = await getDb();
  const all = await getAllTiles(db);

  // Compute per-graphic stats
  const graphicStats = new Map<
    string,
    { lastAccessed: string; totalBytes: number }
  >();
  let totalBytes = 0;
  for (const record of all) {
    totalBytes += record.sizeBytes;
    const existing = graphicStats.get(record.graphicId);
    if (!existing || record.accessedAt > existing.lastAccessed) {
      graphicStats.set(record.graphicId, {
        lastAccessed: record.accessedAt,
        totalBytes: (existing?.totalBytes ?? 0) + record.sizeBytes,
      });
    } else {
      existing.totalBytes += record.sizeBytes;
    }
  }

  // Determine quota budget
  let budgetBytes = Infinity;
  if (
    "storage" in navigator &&
    typeof navigator.storage?.estimate === "function"
  ) {
    try {
      const estimate = await navigator.storage.estimate();
      const available = estimate.quota ?? 0;
      if (available > 0) {
        budgetBytes = Math.floor(available * QUOTA_FRACTION);
      }
    } catch {
      // estimate() not available — skip quota check
    }
  }

  // Sort graphics LRU → MRU (oldest access first = evict first)
  const sorted = Array.from(graphicStats.entries()).sort(([, a], [, b]) =>
    a.lastAccessed.localeCompare(b.lastAccessed),
  );

  for (const [graphicId, stats] of sorted) {
    const tooManyGraphics = graphicStats.size > MAX_GRAPHICS;
    const overBudget = totalBytes > budgetBytes;

    if (!tooManyGraphics && !overBudget) break;

    await deleteTilesForGraphic(db, graphicId);
    totalBytes -= stats.totalBytes;
    graphicStats.delete(graphicId);
  }
}

/**
 * Write a tile Blob to the cache.
 *
 * Callers should call `evictLRU()` before a batch of writes to avoid
 * exceeding storage limits.
 */
export async function cacheTile(
  graphicId: string,
  z: number,
  x: number,
  y: number,
  blob: Blob,
): Promise<void> {
  const db = await getDb();
  const record: TileCacheRecord = {
    id: tileKey(graphicId, z, x, y),
    graphicId,
    z,
    x,
    y,
    blob,
    accessedAt: new Date().toISOString(),
    sizeBytes: blob.size,
  };
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Read a tile Blob from the cache.
 *
 * Returns `null` if the tile is not cached.  Updates `accessedAt` on a cache
 * hit to maintain accurate LRU ordering.
 */
export async function getTile(
  graphicId: string,
  z: number,
  x: number,
  y: number,
): Promise<Blob | null> {
  const db = await getDb();
  const key = tileKey(graphicId, z, x, y);

  const record = await new Promise<TileCacheRecord | null>(
    (resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as TileCacheRecord) ?? null);
      req.onerror = () => reject(req.error);
    },
  );

  if (!record) return null;

  // Update accessedAt in the background (do not await — don't block the caller)
  getDb()
    .then((d) => {
      const tx = d.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(key);
      getReq.onsuccess = () => {
        const existing = getReq.result as TileCacheRecord | undefined;
        if (existing) {
          store.put({ ...existing, accessedAt: new Date().toISOString() });
        }
      };
    })
    .catch(() => {});

  return record.blob;
}
