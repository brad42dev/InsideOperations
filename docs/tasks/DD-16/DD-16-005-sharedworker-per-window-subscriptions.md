---
id: DD-16-005
title: Add per-window subscription map, port-close auto-cleanup, and reconnect jitter to SharedWorker
unit: DD-16
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The SharedWorker should track subscriptions per window (per MessagePort) so that if one window unsubscribes or closes, only points that no other window needs are actually unsubscribed from the server. When a port disconnects (including unexpected window crash), the worker should automatically remove that window's subscriptions and unsubscribe any points no longer needed by remaining windows. Reconnect backoff should include random jitter to prevent thundering-herd on broker restart.

## Spec Excerpt (verbatim)

> The SharedWorker maintains a per-window subscription map:
> windowSubscriptions: Map<windowId, Set<pointId>>
> The active server subscription is the union of all window subscription sets. When a window subscribes or unsubscribes:
> 1. Update that window's subscription set
> 2. Recompute the union across all windows
> 3. Diff against the current server subscription
> 4. Send subscribe/unsubscribe messages to the WebSocket for any changes
>
> When a window closes (or its MessagePort disconnects due to crash):
> 1. SharedWorker detects the port close event
> 2. Removes all subscriptions for that window from the per-window map
> 3. Recomputes the subscription union
> 4. Unsubscribes any points that are no longer needed by any remaining window
>
> Client implements exponential backoff with jitter (1s, 2s, 4s, 8s, max 30s)
> — design-docs/16_REALTIME_WEBSOCKET.md, §Multi-Window Connection Pooling

## Where to Look in the Codebase

Primary files:
- `frontend/src/workers/wsWorker.ts:34–215` — entire SharedWorker: uses a single `subscribedPoints: Set<string>` (line 43) with no per-window tracking; `removePort` at line 65 removes the port but does not clean up subscriptions; `scheduleReconnect` at line 207 doubles delay up to 30s but adds no jitter
- `frontend/src/shared/hooks/useWsWorker.ts:220–238` — `subscribe` / `unsubscribe`: posts directly to port without a `windowId`; works with the current flat-set model but will need updating once per-window tracking is added

## Verification Checklist

- [ ] `wsWorker.ts` contains a `windowSubscriptions: Map<string, Set<string>>` (or equivalent keyed by port/windowId) at module scope
- [ ] `subscribe` handler in `handlePortMessage` updates the per-window set, recomputes the union, diffs against the active server subscription, and sends only the delta subscribe/unsubscribe to the WebSocket
- [ ] `unsubscribe` handler performs the same union-diff logic
- [ ] Each `MessagePort` has an `onclose` event handler set that triggers the same cleanup as the explicit `port_close` message
- [ ] `removePort` (or its successor) calls the union-diff logic and sends any required `unsubscribe` messages to the server before removing the window's entry
- [ ] `scheduleReconnect` adds random jitter: `reconnectDelay + Math.random() * reconnectDelay * 0.3` (or similar) before doubling

## Assessment

- **Status**: ❌ Missing (all three items)
- **If partial/missing**: Line 43 — flat `subscribedPoints: Set<string>` shared across all windows. Line 65 — `removePort` only splices the port array; no subscription cleanup. Lines 207–214 — `scheduleReconnect` doubles delay correctly but `reconnectDelay + 0` — no jitter term at all.

## Fix Instructions

**Step 1 — Per-window subscription map**

Replace `const subscribedPoints = new Set<string>()` at line 43 with:

```typescript
// Map from port identity string → Set<pointId>
const windowSubscriptions = new Map<MessagePort, Set<string>>()
// Union of all window sets — the active server subscription
const serverSubscription = new Set<string>()
```

**Step 2 — Union-diff helpers**

```typescript
function recomputeAndSync(ws: WebSocket | null) {
  const newUnion = new Set<string>()
  for (const pts of windowSubscriptions.values()) {
    for (const p of pts) newUnion.add(p)
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    // Update serverSubscription to match the union so reconnect re-subscribes correctly
    serverSubscription.clear()
    for (const p of newUnion) serverSubscription.add(p)
    return
  }
  const toAdd = [...newUnion].filter(p => !serverSubscription.has(p))
  const toRemove = [...serverSubscription].filter(p => !newUnion.has(p))
  if (toAdd.length > 0) ws.send(JSON.stringify({ type: 'subscribe', points: toAdd }))
  if (toRemove.length > 0) ws.send(JSON.stringify({ type: 'unsubscribe', points: toRemove }))
  serverSubscription.clear()
  for (const p of newUnion) serverSubscription.add(p)
}
```

**Step 3 — Update subscribe/unsubscribe handlers in `handlePortMessage`**

```typescript
case 'subscribe': {
  const points = msg.points as string[]
  const set = windowSubscriptions.get(port) ?? new Set<string>()
  for (const p of points) set.add(p)
  windowSubscriptions.set(port, set)
  recomputeAndSync(ws)
  break
}
case 'unsubscribe': {
  const points = msg.points as string[]
  const set = windowSubscriptions.get(port)
  if (set) { for (const p of points) set.delete(p) }
  recomputeAndSync(ws)
  break
}
```

**Step 4 — Port close auto-cleanup**

In the `sharedSelf.onconnect` handler, after `port.start()`:

```typescript
port.addEventListener('close', () => {
  windowSubscriptions.delete(port)
  removePort(port)
  recomputeAndSync(ws)
})
```

Also update `removePort` to call `recomputeAndSync`.

**Step 5 — Add jitter to reconnect backoff**

```typescript
function scheduleReconnect() {
  if (isDestroyed || reconnectTimer) return
  const jitter = Math.random() * reconnectDelay * 0.3
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
    broadcast({ type: 'need_ticket' })
  }, reconnectDelay + jitter)
}
```

**Step 6 — Update `openSocket` resubscribe**

When the socket reopens, use `serverSubscription` (the union) instead of the old `subscribedPoints`:

```typescript
const all = Array.from(serverSubscription)
if (all.length > 0) socket.send(JSON.stringify({ type: 'subscribe', points: all }))
```

**Step 7 — Update `useWsWorker.ts`**

The `subscribe` / `unsubscribe` calls in `useWsWorker.ts` at lines 222–237 post messages to the SharedWorker. They do not need a windowId because the port itself identifies the window uniquely. No change needed there.

Do NOT:
- Remove the explicit `port_close` message handler — it is still needed for intentional cleanup (e.g., logout)
- Send the full union as a subscribe message on reconnect rather than diffing — on initial connect there is nothing to diff against, sending the full union is correct; the diff logic only applies to incremental subscribe/unsubscribe calls
