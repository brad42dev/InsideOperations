---
id: MOD-CONSOLE-003
title: Implement detached window support for individual panes via SharedWorker
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Any pane in the Console workspace can be "popped out" into a separate browser window. The detached window shows only that pane's content (graphic, trend, or table) at full size. The detached window shares the same SharedWorker WebSocket connection as the main window — it does not open a new WebSocket connection. Real-time data continues flowing to both the main workspace and the detached window simultaneously.

## Spec Excerpt (verbatim)

> **Detached window support via SharedWorker** — `window.open()` for a pane opens a new window that shares the same SharedWorker connection and subscribes independently.
> — console-implementation-spec.md, §1 (non-negotiable #9)

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/PaneWrapper.tsx` — right-click context menu on panes. The "Pop out" or "Detach" action should be added here.
- `frontend/src/pages/console/index.tsx` — no window.open call exists anywhere in this file.
- `frontend/src/workers/wsWorker.ts` — SharedWorker handles multiple ports; detached window would add a port automatically via the SharedWorker `onconnect` event.
- `frontend/src/shared/hooks/useWsWorker.ts` — `getPort()` creates the SharedWorker; detached window would call this same function and get the same worker.

## Verification Checklist

- [ ] PaneWrapper right-click context menu includes a "Detach to Window" or "Pop Out" item.
- [ ] Clicking the item calls `window.open()` with a URL that routes to a single-pane view with the pane config encoded in query params or URL.
- [ ] The detached window page connects to the SharedWorker via the same `getPort()` / `new SharedWorker(...)` call — not a new WebSocket.
- [ ] Real-time subscriptions from the detached window are sent through the SharedWorker (not a separate WS connection).
- [ ] Closing the detached window sends a `port_close` message to the SharedWorker to clean up its port.

## Assessment

- **Status**: ❌ Missing
- No `window.open()` call exists in index.tsx or PaneWrapper.tsx. No detached window route exists in the router. The SharedWorker already handles multiple ports correctly (wsWorker.ts has `ports` array and `onconnect`) — the missing piece is the UI trigger and the detached window route/page.

## Fix Instructions

1. **Add a route for the detached pane view.** In `frontend/src/App.tsx` (or router config), add a route like `/console/pane/:paneType` that renders a minimal single-pane page (no sidebar, no toolbar, no status bar).

2. **Create `frontend/src/pages/console/DetachedPane.tsx`** — a page that:
   - Reads pane config from URL params (graphicId, or trend/table config encoded as JSON in a query param).
   - Renders the appropriate pane component (GraphicPane, TrendPane, PointTablePane) at full viewport size.
   - Calls `wsManager.connect()` from useWsWorker — this will reuse the existing SharedWorker since SharedWorker instances are shared per origin.

3. **Add "Pop Out" to PaneWrapper context menu** (`PaneWrapper.tsx`). In the right-click ContextMenu items, add:
   ```typescript
   {
     label: 'Pop Out',
     onClick: () => {
       const config = JSON.stringify(paneConfig)
       window.open(
         `/console/pane?config=${encodeURIComponent(config)}`,
         `pane-${paneId}`,
         'width=1280,height=720,menubar=no,toolbar=no,status=no',
       )
     },
   }
   ```

4. **Cleanup:** The detached window's `beforeunload` event should call `wsManager.disconnect()` so the SharedWorker removes the orphaned port (`{ type: 'port_close' }` message).

Do NOT:
- Open a new `WebSocket` directly in the detached window — it must go through the SharedWorker.
- Serialize the live point values into the URL — the detached window should subscribe fresh via the SharedWorker.
