---
id: MOD-CONSOLE-002
title: Implement detached window support for Console panes
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Operators can "pop out" a Console workspace into a separate browser window. The detached window shows the workspace with a minimal shell (no sidebar, no module switcher, no left nav panel), shares the SharedWorker WebSocket connection, and subscribes to points independently. Multiple detached windows can be open simultaneously. Changes to the workspace layout in the main window are not reflected in detached windows until reload (detached windows are read-only for layout).

## Spec Excerpt (verbatim)

> ### 12.1 Route
> Detached Console windows use the route: `/detached/console/:workspaceId`
>
> ### 12.2 Shell
> Detached windows render a minimal shell:
> - **Thin title bar**: workspace name, connection status indicator, clock
> - **Basic controls**: pane swap mode, resize handles, zoom, full-screen toggle
> - **No sidebar navigation**: workspace content only
> - **No module switcher**: cannot navigate to other modules from a detached window
> - **No left navigation panel**
>
> ### 12.3 WebSocket Sharing
> Detached windows share the WebSocket connection via SharedWorker: The SharedWorker maintains a single WebSocket connection. Each detached window registers its own point subscriptions with the SharedWorker. The SharedWorker de-duplicates subscriptions and routes updates to the correct windows.
> — console-implementation-spec.md, §12

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` — route definitions; the `/detached/console/:workspaceId` route should be added here
- `frontend/src/pages/console/index.tsx` — main Console page; the "detach" action needs a `window.open()` call
- `frontend/src/shared/hooks/useWsWorker.ts` — SharedWorker connector; already handles multi-window via SharedWorker semantics

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Route `/detached/console/:workspaceId` exists in `App.tsx` and renders a `DetachedConsolePage` component
- [ ] `DetachedConsolePage` renders a minimal shell: thin title bar (name + dot + clock), no sidebar, no left nav, no module switcher
- [ ] A "Detach" or "Pop Out" action exists on a pane (right-click context menu or pane header button) that calls `window.open('/detached/console/:workspaceId', '_blank', 'noopener')`
- [ ] Detached page loads workspace config from `/api/workspaces/:id` and renders panes read-only (no edit mode)
- [ ] SharedWorker connection is reused — no new WebSocket is created in the detached window
- [ ] `useWsWorker.ts` handles multiple `port.onmessage` listeners simultaneously (SharedWorker supports this natively)

## Assessment

After checking:
- **Status**: ❌ Missing — No `/detached/console/` route exists. No `window.open()` for pane detach anywhere in `frontend/src/pages/console/`. `useWsWorker.ts` correctly uses SharedWorker (multi-window is inherently supported), so the WebSocket layer is ready; only the UI route and minimal shell are missing.

## Fix Instructions (if needed)

1. **Create `DetachedConsolePage`** at `frontend/src/pages/console/DetachedConsolePage.tsx`:
   - Load workspace via `GET /api/workspaces/:workspaceId` using React Query
   - Render `WorkspaceGrid` with `editMode={false}` and `selectedPaneIds` always empty
   - Thin title bar: workspace name, green/red dot from `useRealtimeStore().connectionStatus`, clock (live `Date` updated every second)
   - No `ConsolePalette`, no workspace tabs, no `ConsoleStatusBar` toolbar

2. **Add route in `App.tsx`**: `/detached/console/:workspaceId` → `<DetachedConsolePage />`
   This route should NOT be wrapped in the `AppShell` layout component (detached = no shell chrome at all).

3. **Add "Pop Out" action**: In `PaneWrapper.tsx` right-click menu, add a "Pop Out Window" item that calls:
   ```typescript
   window.open(`/detached/console/${workspaceId}`, '_blank', 'noopener,width=1280,height=800')
   ```

4. **SharedWorker**: No changes needed — `useWsWorker.ts` already uses `new SharedWorker(...)`, which is shared across all same-origin windows automatically by the browser.

Do NOT:
- Create a new WebSocket in the detached page — the SharedWorker handles this.
- Allow editing workspace layout from a detached window — it must be read-only.
- Wrap `DetachedConsolePage` in `AppShell` — it must render without the application sidebar and topbar.
