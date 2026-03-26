---
id: MOD-PROCESS-016
title: Implement detached window route /detached/process/:viewId
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Process module must support opening in a detached browser window at the route `/detached/process/:viewId`. The detached window renders a minimal shell (thin title bar + basic controls, no sidebar navigation, no module switcher) and maintains its own independent viewport state and subscription set. This is used when operators open multiple process views side-by-side on a multi-monitor setup.

## Spec Excerpt (verbatim)

> ### 11.1 Route
> Detached Process windows use the route: `/detached/process/:viewId`
>
> ### 11.2 Shell
> Detached windows render a minimal shell:
> - **Thin title bar**: view name, connection status indicator, clock
> - **Basic controls**: zoom in/out, zoom-to-fit, minimap toggle, fullscreen
> - **No sidebar navigation**: view content only
> - **No module switcher**: cannot navigate to other modules from a detached window
>
> ### 11.3 Independent Viewport
> Each detached Process window manages its own viewport independently:
> - Own zoom level and pan position
> - Own LOD level (determined by its own zoom)
> - Own minimap state
> - Own viewport subscription set (determined by its own visible rect)
> — process-implementation-spec.md, §11

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` — router definition; `/detached/process/:viewId` route is absent
- `frontend/src/pages/process/index.tsx` — main Process component to reuse as base
- `frontend/src/pages/console/DetachedConsoleView.tsx` (if it exists) — reference implementation for detached pattern

## Verification Checklist

- [ ] Route `/detached/process/:viewId` is defined in `App.tsx` and renders a component.
- [ ] The detached component loads the graphic specified by `:viewId` directly (no sidebar view selection).
- [ ] Thin title bar shows: view name, connection status dot, and current time.
- [ ] Basic controls present: zoom-in, zoom-out, zoom-to-fit, minimap toggle, fullscreen.
- [ ] No sidebar, no module switcher, no application top bar chrome.
- [ ] Viewport, LOD, and subscriptions are independent per window (own state, not shared with main window).
- [ ] Real-time subscriptions function correctly in the detached window.

## Assessment

- **Status**: ❌ Missing
- No `/detached/process` route exists in `App.tsx`. No `ProcessDetachedView.tsx` or equivalent file exists in `frontend/src/pages/process/`.

## Fix Instructions

1. Create `frontend/src/pages/process/ProcessDetachedView.tsx`. This component:
   - Reads `:viewId` from `useParams()`
   - Reuses the viewport state, binding index, spatial query, and SceneRenderer logic from `index.tsx`
   - Renders a minimal shell: a thin title bar div (height ~32px) with view name, connection dot, clock, and the 4 basic controls. Below it: the full viewport canvas with ProcessMinimap. No ProcessSidebar.

2. Register the route in `App.tsx`:
```tsx
<Route path="/detached/process/:viewId" element={
  <PermissionGuard permission="process:read">
    <ErrorBoundary module="Process-Detached">
      <ProcessDetachedView />
    </ErrorBoundary>
  </PermissionGuard>
} />
```

3. The component must call `useParams<{ viewId: string }>()` and load `graphic` via TanStack Query for that ID — identical to how `index.tsx` loads a graphic, but without needing `selectedId` state (it's fixed to the URL param).

4. Subscriptions use the same `useWebSocketRaf(visiblePointIds)` — no special SharedWorker work needed for the frontend; the SharedWorker already de-duplicates across windows at the WebSocket layer.

Do NOT:
- Try to share viewport state between the main window and detached windows — each manages its own state.
- Implement a custom WebSocket connection in the detached window — `useWebSocketRaf` handles SharedWorker sharing automatically.
- Render the full `ProcessSidebar` or application AppShell in the detached view.
