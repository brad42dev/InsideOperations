---
id: MOD-CONSOLE-006
title: Implement detached window support (window.open per pane) via SharedWorker
unit: MOD-CONSOLE
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

A user must be able to detach any pane into a separate browser window that: (1) shares the same SharedWorker WebSocket connection, (2) subscribes independently to its pane's points, and (3) remains live while the main Console window is open. Detached windows are useful for multi-monitor operator setups. Currently no detach mechanism exists.

## Spec Excerpt (verbatim)

> **Detached window support via SharedWorker** — `window.open()` for a pane opens a new window that shares the same SharedWorker connection and subscribes independently.
> — docs/SPEC_MANIFEST.md, MOD-CONSOLE non-negotiable #9

> If `targetGraphicId` is set: load that graphic in the same pane. If Ctrl+click: open in a new pane (if grid space available) or a new detached window.
> — console-implementation-spec.md, §7.4

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/PaneWrapper.tsx` — pane context menu (add "Open in New Window" item)
- `frontend/src/workers/wsWorker.ts` — SharedWorker that already handles multiple ports
- `frontend/src/shared/hooks/useWsWorker.ts` — SharedWorker connector (add `getPort()` to expose connection)

## Verification Checklist

- [ ] PaneWrapper right-click context menu includes "Open in New Window" item
- [ ] Clicking "Open in New Window" calls `window.open('/console/pane/{paneId}', '_blank', 'width=1200,height=800')`
- [ ] The detached window page connects to the existing SharedWorker (same origin = same worker)
- [ ] The detached window subscribes to its pane's points and receives live updates
- [ ] Closing the detached window does not affect the main Console window or other panes

## Assessment

- **Status**: ❌ Missing
- No `window.open()` calls anywhere in `frontend/src/pages/console/`
- No `/console/pane/:id` route exists in `App.tsx`
- `PaneWrapper.tsx` context menu has no "Open in New Window" item

## Fix Instructions

**Step 1 — Add a `/console/pane/:paneId` route** to `App.tsx`. This route renders a standalone PaneView component with the specified pane config fetched from the server.

**Step 2 — Create `DetachedPaneView.tsx`** that:
1. Reads `paneId` from URL params
2. Fetches workspace + pane config from `consoleApi.getWorkspace(workspaceId)`
3. Renders `GraphicPane` (or TrendPane/PointTablePane as appropriate)
4. Connects to the SharedWorker via `wsWorkerConnector.connect()` — the SharedWorker is already shared at origin level

**Step 3 — Add "Open in New Window" to PaneWrapper context menu.** On click:
```typescript
window.open(
  `/console/pane/${config.id}?workspace=${workspaceId}`,
  '_blank',
  'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
)
```

The SharedWorker in `wsWorker.ts` already supports multiple ports via `ports[]` array — the detached window will automatically get a new port on `onconnect` and share the existing WebSocket.

Do NOT:
- Open a new WebSocket in the detached window (the SharedWorker handles this)
- Try to pass the live pane state via `localStorage` (use the server API to fetch pane config by ID)
- Disconnect the SharedWorker when the detached window closes (the `port_close` message handles cleanup already)
