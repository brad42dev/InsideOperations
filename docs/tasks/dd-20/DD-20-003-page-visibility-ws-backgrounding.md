---
id: DD-20-003
title: Implement Page Visibility API backgrounding for WebSocket reconnect
unit: DD-20
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When the mobile app is backgrounded (user switches to another app or locks screen), the WebSocket connection should stop reconnection attempts and set a `pendingReconnect` flag. When the app returns to foreground, it should reconnect immediately with backoff reset. This prevents battery drain from futile reconnect attempts while backgrounded. iOS kills WebSocket connections within 30-60 seconds of backgrounding — the app must handle this gracefully.

## Spec Excerpt (verbatim)

> **Page Visibility API**: When app is backgrounded (`visibilityState === 'hidden'`), stop reconnection attempts. Set `pendingReconnect` flag.
> **Foreground resume**: When `visibilityState === 'visible'` and `pendingReconnect` is set, reconnect immediately with backoff reset.
> iOS kills WebSocket connections within 30-60 seconds of backgrounding. This is expected behavior, not a bug.
> — design-docs/20_MOBILE_ARCHITECTURE.md, §WebSocket on Mobile > Background Behavior

## Where to Look in the Codebase

Primary files:
- `frontend/src/workers/wsWorker.ts` — SharedWorker that manages the WebSocket; reconnect logic lives here
- `frontend/src/shared/hooks/useWsWorker.ts` — main thread connector; could handle visibility and send pause/resume messages to the worker

## Verification Checklist

- [ ] A `visibilitychange` event listener is registered (on `document` in the main thread, or polled in the worker)
- [ ] When `document.visibilityState === 'hidden'`, reconnection attempts pause and a `pendingReconnect` flag is set
- [ ] When `document.visibilityState === 'visible'` and `pendingReconnect` is true, reconnection triggers immediately with backoff counter reset to 0
- [ ] The wsWorker or connector does NOT attempt reconnect while the page is hidden

## Assessment

- **Status**: ❌ Missing — no `visibilitychange` listener anywhere in `useWsWorker.ts`, `useWebSocket.ts`, or `wsWorker.ts`

## Fix Instructions

SharedWorkers cannot access `document.visibilityState` directly. The correct approach is to handle it on the main thread in `useWsWorker.ts` and send control messages to the worker.

In `frontend/src/shared/hooks/useWsWorker.ts`, add at module level (not inside a React component — this is a module-level singleton):

```typescript
// Page Visibility — pause reconnects when backgrounded, resume on foreground
let pendingReconnect = false

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // App is backgrounded — tell worker to stop reconnecting
    port?.postMessage({ type: 'pause' })
  } else if (document.visibilityState === 'visible' && pendingReconnect) {
    // Foregrounded with a pending reconnect — reconnect now, reset backoff
    pendingReconnect = false
    port?.postMessage({ type: 'resume' })
    void issueTicket()
  }
}

document.addEventListener('visibilitychange', handleVisibilityChange)
```

Then in `handleWorkerMessage`, handle the case where the worker reports it lost connection while paused:
```typescript
case 'state': {
  const state = msg.state as WsConnectionState
  currentState = state
  if (state === 'disconnected' && document.visibilityState === 'hidden') {
    pendingReconnect = true  // will reconnect when visible
  }
  stateListeners.forEach((fn) => fn(state))
  break
}
```

In `frontend/src/workers/wsWorker.ts`, add handlers for `pause` and `resume` message types that set an internal `isPaused` flag and skip reconnect scheduling while paused.

Do NOT:
- Implement this only in a React hook's `useEffect` — the WebSocket manager is a module-level singleton and React effects unmount/remount
- Disconnect the socket on background — just stop scheduling reconnects. The OS/browser will close it naturally.
