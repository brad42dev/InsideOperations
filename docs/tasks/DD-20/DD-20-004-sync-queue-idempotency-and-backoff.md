---
id: DD-20-004
title: Add idempotency keys and exponential backoff to offline sync queue
unit: DD-20
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Each queued offline round response must carry a client-generated UUID idempotency key so the server can detect and reject duplicate submissions (e.g., if the queue drains but the network drops before the ack is received and the client retries). Failed sync items must be retried with exponential backoff (max 30 seconds) and flagged for user review on validation errors. A "Synced" confirmation toast must appear when the queue clears. A "Sync failed — tap for details" warning badge must appear when sync fails persistently.

## Spec Excerpt (verbatim)

> Round checkpoint writes while offline are queued with idempotency keys:
> 1. User performs action offline (submit checkpoint, capture photo for a round)
> 2. Action saved to `sync-queue` with idempotency key (client-generated UUID)
> ...
> - On server error: increment retry count, exponential backoff (max 30s)
> - On validation error: flag for user review, do not retry
>
> **Failure**: If sync fails, badge turns warning color with "Sync failed — tap for details" message.
> **Completion**: Brief "Synced" confirmation toast when queue is empty.
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Offline Architecture > Sync Queue

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/hooks/useOfflineRounds.ts` — `PendingRoundResponse` type (line 45-55), `saveOfflineResponse` (line 182-196), `syncPending` (line 233-256), `batchSyncRounds` (line 73-105)
- `frontend/src/pages/rounds/index.tsx` — sync badge UI (line 304-334)

## Verification Checklist

- [ ] `PendingRoundResponse` has an `idempotencyKey: string` field (client-generated UUID set in `saveOfflineResponse`)
- [ ] `PendingRoundResponse` has `retryCount: number` and `lastFailedAt?: string` fields
- [ ] `batchSyncRounds` sends idempotency keys in the payload to `/api/mobile/rounds/sync`
- [ ] `syncPending` or its caller implements exponential backoff: 1s, 2s, 4s, 8s ... up to 30s max
- [ ] Validation errors (4xx from server) mark the item as `requiresReview: true` and stop retrying
- [ ] A "Synced" toast fires when `pendingCount` drops to 0 after an active sync
- [ ] The sync badge shows a warning state (distinct color) when any item has `retryCount > 0` with no resolution

## Assessment

- **Status**: ❌ Missing — `PendingRoundResponse` has no idempotency key field; `syncPending` has no retry logic or backoff; no failure notification exists

## Fix Instructions

### 1. Update `PendingRoundResponse` type in `useOfflineRounds.ts`:

```typescript
export interface PendingRoundResponse {
  id?: number
  instanceId: string
  checkpointId: string
  value: string | number | boolean | null
  notes: string
  timestamp: string
  synced: boolean
  idempotencyKey: string   // ← add: crypto.randomUUID()
  retryCount: number       // ← add: starts at 0
  lastError?: string       // ← add: server error message on last failure
  requiresReview?: boolean // ← add: true on 4xx validation error
}
```

### 2. Update `saveOfflineResponse` to set `idempotencyKey`:

```typescript
tx.objectStore(STORE_NAME).add({
  ...response,
  synced: false,
  idempotencyKey: crypto.randomUUID(),
  retryCount: 0,
})
```

### 3. Update `batchSyncRounds` to send the idempotency key:

In `useOfflineRounds.ts` line 77, the `MobileSyncPayload` map should include an `idempotency_key` field from each pending item. Also update the `MobileSyncPayload` type in `api/mobile.ts` to include `idempotency_key?: string`.

### 4. Add exponential backoff to the sync dispatch in `RoundPlayer.tsx` or a new hook:

The auto-sync triggered in `useOfflineRounds.ts` lines 260-274 currently only fires background sync once. After a failed sync, schedule a retry with: `setTimeout(retry, Math.min(1000 * 2 ** retryCount, 30000))`. Increment `retryCount` in IndexedDB after each failure.

### 5. Add "Synced" toast in `RoundPlayer.tsx`:

When `prevPendingCount > 0 && pendingCount === 0`, call `showToast({ title: 'Synced', variant: 'success', duration: 3000 })` using the existing Toast component.

### 6. Add warning badge state in `rounds/index.tsx`:

Expose a `hasSyncFailures` boolean from `useOfflineRounds` (true when any item has `retryCount > 0 && !requiresReview`). When true, render the badge in a warning color with text "Sync failed — tap for details".

Do NOT:
- Delete retry items on 5xx server errors — only mark them with incremented retry count
- Retry items flagged `requiresReview` — those require explicit user action
