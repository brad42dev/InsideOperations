/**
 * useOfflineRounds — IndexedDB-backed offline queue for round responses.
 *
 * When a technician submits a checkpoint response while offline, the response
 * is written to a local IndexedDB store.  When connectivity is restored, the
 * hook triggers a background-sync event (via the service worker) which in
 * turn messages all open clients, causing them to flush the queue via the
 * `syncPending` callback.
 *
 * The hook deliberately does NOT depend on any global state store so that it
 * can be used in standalone PWA mode without the rest of the app being loaded.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MobileSyncPayload } from '../../api/mobile'
import { showToast } from '../components/Toast'

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'io-offline'
const STORE_NAME = 'sync-queue'
const DB_VERSION = 2

/**
 * All five spec-defined object stores for the io-offline database.
 * - sync-queue:   Pending round mutations awaiting network sync
 * - rounds-data:  In-progress round definitions and checkpoint data
 * - media-blobs:  Photos, videos, audio (stored as Blobs)
 * - point-cache:  Last-known point values for offline graphic display
 * - tile-cache:   Graphic tile pyramids (LRU, up to 10 graphics)
 */
const ALL_STORES = [
  'sync-queue',
  'rounds-data',
  'media-blobs',
  'point-cache',
  'tile-cache',
] as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      const oldVersion = e.oldVersion

      // Migrate from v1: delete legacy pending-rounds store (data loss acceptable;
      // any truly offline-pending data should be rare in dev / test environments).
      if (oldVersion < 2 && db.objectStoreNames.contains('pending-rounds')) {
        db.deleteObjectStore('pending-rounds')
      }

      // Create any missing stores
      for (const name of ALL_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id', autoIncrement: true })
        }
      }
    }

    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    request.onerror = () => reject(request.error)
  })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingRoundResponse {
  /** Auto-assigned by IndexedDB; undefined before first persist. */
  id?: number
  instanceId: string
  checkpointId: string
  value: string | number | boolean | null
  notes: string
  /** ISO-8601 timestamp of when the response was captured offline. */
  timestamp: string
  synced: boolean
  /** Client-generated UUID for server-side idempotency detection. */
  idempotencyKey: string
  /** Number of failed sync attempts; starts at 0. */
  retryCount: number
  /** Server error message from the last failed attempt. */
  lastError?: string
  /** True when the server returned a 4xx validation error; stops retrying. */
  requiresReview?: boolean
}

// ---------------------------------------------------------------------------
// IndexedDB update helper — update a single record's fields by ID
// ---------------------------------------------------------------------------

async function updatePendingRecord(
  id: number,
  patch: Partial<PendingRoundResponse>,
): Promise<void> {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => {
      const existing = req.result as PendingRoundResponse | undefined
      if (!existing) {
        resolve()
        return
      }
      store.put({ ...existing, ...patch })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// Batch sync helper (standalone export — usable outside the hook context)
// ---------------------------------------------------------------------------

/**
 * Submit all pending offline responses for a single round instance to the
 * mobile batch-sync endpoint in one network request.
 *
 * This is far more efficient than `syncPending` (one-at-a-time) on poor
 * mobile connections where every extra round-trip has real cost.
 *
 * @param instanceId  UUID of the round instance
 * @param pending     Pending responses that belong to this instance
 * @returns           Number of responses successfully synced by the server,
 *                    or 0 if the request failed.
 */
export async function batchSyncRounds(
  instanceId: string,
  pending: PendingRoundResponse[],
): Promise<number> {
  const responses: MobileSyncPayload[] = pending.map((p) => ({
    checkpoint_index: parseInt(p.checkpointId, 10),
    response_value: String(p.value ?? ''),
    notes: p.notes || undefined,
    captured_at: p.timestamp,
    idempotency_key: p.idempotencyKey,
  }))

  try {
    const res = await fetch('/api/mobile/rounds/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}`,
      },
      body: JSON.stringify({ instance_id: instanceId, responses }),
    })

    if (!res.ok) return 0

    const data = (await res.json()) as {
      data?: { synced?: number }
      synced?: number
    }
    // Handle both envelope format { data: { synced } } and plain { synced }
    return data.data?.synced ?? (data as { synced?: number }).synced ?? 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineRounds() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [hasSyncFailures, setHasSyncFailures] = useState(false)

  // Track the previous pending count so we can fire the "Synced" toast when
  // the queue transitions from non-zero to zero during an active sync.
  const prevPendingCountRef = useRef<number>(0)
  const wasSyncingRef = useRef<boolean>(false)

  // Refresh both pendingCount and hasSyncFailures from IndexedDB
  const refreshCounts = useCallback(async () => {
    try {
      const db = await openDb()
      const items = await new Promise<PendingRoundResponse[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).getAll()
        req.onsuccess = () => resolve(req.result as PendingRoundResponse[])
        req.onerror = () => reject(req.error)
      })
      const count = items.length
      const failures = items.some((item) => item.retryCount > 0 && !item.requiresReview)
      setPendingCount(count)
      setHasSyncFailures(failures)
    } catch {
      // IndexedDB unavailable (private browsing, etc.) — ignore
    }
  }, [])

  // Track online / offline transitions
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Hydrate pendingCount from IndexedDB on mount
  useEffect(() => {
    refreshCounts()
  }, [refreshCounts])

  // Listen for service-worker sync-complete messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'sync-complete') {
        refreshCounts()
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handler)
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handler)
      }
    }
  }, [refreshCounts])

  /**
   * Persist a checkpoint response to IndexedDB.  Call this instead of the
   * network API when `isOnline` is false.
   */
  const saveOfflineResponse = useCallback(
    async (response: Omit<PendingRoundResponse, 'id' | 'synced' | 'idempotencyKey' | 'retryCount'>): Promise<void> => {
      const db = await openDb()
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).add({
          ...response,
          synced: false,
          idempotencyKey: crypto.randomUUID(),
          retryCount: 0,
        })
        tx.oncomplete = () => {
          setPendingCount((c) => c + 1)
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      })
    },
    []
  )

  /** Read all pending (unsynced) responses from IndexedDB. */
  const getPendingResponses = useCallback(async (): Promise<PendingRoundResponse[]> => {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result as PendingRoundResponse[])
      req.onerror = () => reject(req.error)
    })
  }, [])

  /** Delete synced records from IndexedDB by their auto-increment IDs. */
  const clearSynced = useCallback(async (ids: number[]): Promise<void> => {
    if (ids.length === 0) return
    const db = await openDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      ids.forEach((id) => store.delete(id))
      tx.oncomplete = () => {
        setPendingCount((c) => Math.max(0, c - ids.length))
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }, [])

  /**
   * Attempt to submit every pending response using `submitFn`.
   * Records that are successfully submitted are removed from IndexedDB.
   * Failed records have their retryCount incremented and are scheduled for
   * retry with exponential backoff (up to 30 seconds max).
   * Items that receive a 4xx validation error are flagged requiresReview=true
   * and are not retried.
   *
   * @param submitFn  Async function that submits one response and returns
   *                  `true` on success, `false` on failure.
   *                  Throw an error with `{ status: number }` for HTTP errors,
   *                  or with a `{ validationError: true }` flag to trigger the
   *                  requiresReview path.
   * @returns Number of records that were successfully synced.
   */
  const syncPending = useCallback(
    async (
      submitFn: (response: PendingRoundResponse) => Promise<boolean>,
    ): Promise<number> => {
      const pending = await getPendingResponses()
      // Skip items flagged for manual review — they require explicit user action
      const eligible = pending.filter((item) => !item.requiresReview)

      const synced: number[] = []
      const prevCount = pending.length

      // Record that a sync is in flight (used for the "Synced" toast logic)
      if (prevCount > 0) {
        wasSyncingRef.current = true
        prevPendingCountRef.current = prevCount
      }

      for (const item of eligible) {
        try {
          const success = await submitFn(item)
          if (success && item.id != null) {
            synced.push(item.id)
          } else if (!success && item.id != null) {
            // Generic failure — increment retry count
            const newRetryCount = (item.retryCount ?? 0) + 1
            await updatePendingRecord(item.id, {
              retryCount: newRetryCount,
              lastError: 'Sync failed',
            })
            // Schedule a retry with exponential backoff
            const delayMs = Math.min(1000 * Math.pow(2, newRetryCount - 1), 30000)
            setTimeout(() => {
              syncPending(submitFn).catch(() => {})
            }, delayMs)
          }
        } catch (err: unknown) {
          if (item.id != null) {
            // Check if this is a 4xx validation error
            const isValidationError =
              (err instanceof Error &&
                (err as Error & { status?: number }).status !== undefined &&
                ((err as Error & { status?: number }).status ?? 0) >= 400 &&
                ((err as Error & { status?: number }).status ?? 0) < 500) ||
              (typeof err === 'object' &&
                err !== null &&
                'validationError' in err &&
                (err as { validationError: boolean }).validationError === true)

            if (isValidationError) {
              // 4xx — flag for user review, stop retrying
              await updatePendingRecord(item.id, {
                requiresReview: true,
                lastError: err instanceof Error ? err.message : 'Validation error',
              })
            } else {
              // 5xx or network error — increment retry count, schedule backoff
              const newRetryCount = (item.retryCount ?? 0) + 1
              await updatePendingRecord(item.id, {
                retryCount: newRetryCount,
                lastError: err instanceof Error ? err.message : 'Network error',
              })
              const delayMs = Math.min(1000 * Math.pow(2, newRetryCount - 1), 30000)
              setTimeout(() => {
                syncPending(submitFn).catch(() => {})
              }, delayMs)
            }
          }
        }
      }

      if (synced.length > 0) {
        await clearSynced(synced)
      }

      // Refresh counts and check if queue cleared during this sync
      await refreshCounts()
      const newPending = await getPendingResponses()
      if (wasSyncingRef.current && prevPendingCountRef.current > 0 && newPending.length === 0) {
        wasSyncingRef.current = false
        showToast({ title: 'Synced', variant: 'success', duration: 3000 })
      }

      return synced.length
    },
    [getPendingResponses, clearSynced, refreshCounts],
  )

  // When connectivity is restored and there are pending items, request a
  // background sync from the service worker so the SW can notify all tabs.
  useEffect(() => {
    if (!isOnline || pendingCount === 0) return
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => {
          // Background Sync API — cast to any as TypeScript's DOM lib
          // omits SyncManager from ServiceWorkerRegistration.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (reg as any).sync.register('sync-rounds')
        })
        .catch(() => {
          // Background sync not supported — caller must trigger syncPending manually
        })
    }
  }, [isOnline, pendingCount])

  return {
    isOnline,
    pendingCount,
    hasSyncFailures,
    saveOfflineResponse,
    getPendingResponses,
    clearSynced,
    syncPending,
  }
}
