---
id: DD-20-007
title: Implement full IndexedDB schema (5 stores: sync-queue, rounds-data, media-blobs, point-cache, tile-cache)
unit: DD-20
status: pending
priority: high
depends-on: [DD-20-004]
---

## What This Feature Should Do

The spec defines a single `io-offline` IndexedDB database with five object stores: `sync-queue` (pending round mutations), `rounds-data` (in-progress round definitions + checkpoint data), `media-blobs` (photos, videos, audio as Blobs), `point-cache` (last-known point values for offline graphics), and `tile-cache` (graphic tile pyramids for offline viewing, LRU up to 10 graphics). Currently only `pending-rounds` exists — the store name is wrong and four stores are missing.

## Spec Excerpt (verbatim)

> ```
> IndexedDB Database: "io-offline"
> ├── sync-queue        // Pending round mutations only
> ├── rounds-data       // In-progress round definitions + checkpoint data
> ├── media-blobs       // Photos, videos, audio (as Blobs)
> ├── point-cache       // Last-known point values for offline graphic display
> └── tile-cache        // Graphic tile pyramids (LRU, up to 10 graphics)
> ```
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Offline Architecture > IndexedDB Storage

Also:
> **Adaptive caching**: Cache tile sets for the 10 most recently viewed graphics using LRU eviction. Detect available storage via `navigator.storage.estimate()`, budget 70% of available quota...
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Phone Graphics > Offline Support

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/hooks/useOfflineRounds.ts` — lines 21-39: `openDb()` only creates `pending-rounds` store at DB_VERSION 1
- `frontend/src/shared/components/TileGraphicViewer.tsx` — currently loads tiles from network with no IndexedDB caching

## Verification Checklist

- [ ] `openDb()` in `useOfflineRounds.ts` creates all 5 stores: `sync-queue`, `rounds-data`, `media-blobs`, `point-cache`, `tile-cache`
- [ ] DB version is bumped (e.g. to 2) so existing `pending-rounds` entries are migrated to `sync-queue`
- [ ] `STORE_NAME` constant references `sync-queue` instead of `pending-rounds`
- [ ] A `pointCacheDb` helper (or extended `openDb`) can write/read last-known values from `point-cache`
- [ ] A `tileCacheDb` helper can store and retrieve tile Blobs from `tile-cache` with LRU metadata (graphicId, accessedAt, sizeBytes)
- [ ] `navigator.storage.estimate()` is called before caching new tile sets; cache is capped at min(10 graphics, 70% of available quota)

## Assessment

- **Status**: ❌ Missing — `openDb()` creates only `pending-rounds`; spec requires `sync-queue` plus 4 additional stores; store name is also wrong

## Fix Instructions

### 1. Update `openDb()` in `useOfflineRounds.ts`:

Bump `DB_VERSION` from 1 to 2 and migrate in `onupgradeneeded`:
```typescript
const DB_VERSION = 2
const STORE_NAME = 'sync-queue'  // renamed from 'pending-rounds'

request.onupgradeneeded = (e) => {
  const db = (e.target as IDBOpenDBRequest).result
  const oldVersion = e.oldVersion

  // Migrate from v1 (pending-rounds) to v2 (sync-queue)
  if (oldVersion < 2 && db.objectStoreNames.contains('pending-rounds')) {
    db.deleteObjectStore('pending-rounds')
  }

  const stores = ['sync-queue', 'rounds-data', 'media-blobs', 'point-cache', 'tile-cache']
  for (const name of stores) {
    if (!db.objectStoreNames.contains(name)) {
      db.createObjectStore(name, { keyPath: 'id', autoIncrement: true })
    }
  }
}
```

### 2. Create a `pointCacheDb.ts` helper at `frontend/src/shared/hooks/`:

Export `cachePointValues(graphicId: string, values: Record<string, PointValue>)` and `getPointCache(graphicId: string)` that read/write from the `point-cache` store. Each entry: `{ id: graphicId, values, cachedAt: ISO-string }`.

### 3. Create a `tileCacheDb.ts` helper at `frontend/src/shared/hooks/`:

Export:
- `cacheTile(graphicId: string, z: number, x: number, y: number, blob: Blob)` — writes to `tile-cache`, records `accessedAt` and `sizeBytes`
- `getTile(graphicId: string, z: number, x: number, y: number)` — reads from `tile-cache`, updates `accessedAt`
- `evictLRU()` — call before writing new tiles; check `navigator.storage.estimate()`, evict oldest graphic tiles if total size exceeds 70% of quota or exceeds 10 unique graphics

### 4. Integrate into `TileGraphicViewer.tsx`:

Override Leaflet's tile loading with a custom tile layer class (extend `L.TileLayer`) that checks `getTile()` before fetching from the network, and calls `cacheTile()` after a successful network fetch.

Do NOT:
- Store tile data in the Cache API — iOS Safari has a 50MB Cache API limit; IndexedDB's ~500MB limit is required for tile pyramids
- Delete the `pending-rounds` store without migrating existing data in production builds — handle `oldVersion < 2` in `onupgradeneeded`
