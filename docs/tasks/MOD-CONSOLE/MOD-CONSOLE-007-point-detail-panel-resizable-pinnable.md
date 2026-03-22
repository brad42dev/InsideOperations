---
id: MOD-CONSOLE-007
title: Make PointDetailPanel resizable and pinnable; persist position; use /api/v1/points/:id/detail
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Point Detail panel must be resizable (drag any edge/corner), pinnable (persists across module navigation), minimizable, and must restore its last position and size when reopened. It also must fetch all panel data from a single `GET /api/v1/points/:id/detail` endpoint rather than multiple separate calls.

## Spec Excerpt (verbatim)

> Panel is a **floating window**: draggable, resizable, pinnable (stays on screen during navigation), minimizable. Not a modal.
> **Session-persisted** position and size — refreshing page restores panel state.
> **API**: `GET /api/v1/points/:id/detail` returns all panel data in one request.
> — SPEC_MANIFEST.md, CX-POINT-DETAIL non-negotiables #1, #3, #6

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointDetailPanel.tsx` — line 138: position is `useState` (resets every open). Lines 77-100: uses `getMeta` + `getLatest` separately. No resize handle, no pin, no minimize.
- `frontend/src/api/points.ts` — check whether a `getDetail(id)` function calling `/api/v1/points/:id/detail` exists.
- `frontend/src/App.tsx` — point detail panels opened in GraphicPane are per-pane state, so they unmount on navigation. A pinned panel must live at the shell level.

## Verification Checklist

- [ ] Panel has resize handles on all edges and corners.
- [ ] Panel has a "Pin" toggle button that, when active, keeps the panel mounted during navigation.
- [ ] Panel has a "Minimize" button that collapses it to a title bar.
- [ ] Position and size are saved to `sessionStorage` under `'io-point-detail-{pointId}'` and restored on reopen.
- [ ] Panel data is fetched from `GET /api/v1/points/:id/detail` (single request), not getMeta + getLatest.
- [ ] When refreshing the page, panels that were pinned and open are restored (sessionStorage survives page refresh).

## Assessment

- **Status**: ⚠️ Partial
- PointDetailPanel.tsx implements drag (lines 138-158) but not resize, pin, or minimize. Position uses `useState` — resets every open. Uses `pointsApi.getMeta` + `pointsApi.getLatest` (lines 77-100) instead of the `/detail` endpoint. Panel lives inside `GraphicPane` state so it unmounts on navigation — no shell-level pinning.

## Fix Instructions

**Resize:**
Add a resize overlay using a `useRef` for the panel element and mouse event handlers. The simplest approach is CSS `resize: both; overflow: auto` on the panel div combined with a ResizeObserver to save the new size to sessionStorage. If a more polished resize-handle UI is needed, implement 8 directional drag handles.

**Persist position/size:**
Replace the `useState` position (line 138) with a function that reads from sessionStorage:
```typescript
const storageKey = `io-point-detail-${pointId}`
const [position, setPosition] = useState(() => {
  const saved = sessionStorage.getItem(storageKey)
  return saved ? JSON.parse(saved) : { top: 60, left: window.innerWidth - 340 }
})
// On drag end, save: sessionStorage.setItem(storageKey, JSON.stringify(position))
```

**Pin button:**
Add a pin icon button in the panel header. When pinned, render the panel at the shell level (e.g., in `App.tsx` or `AppShell.tsx`) so it survives navigation. The simplest implementation: move point detail panel state from `GraphicPane` to a shell-level store (or a React context at the root), so pinned panels are not unmounted when the user navigates away from Console.

**Use /detail endpoint:**
Replace the `metaQuery` and `latestQuery` with a single query:
```typescript
const { data } = useQuery({
  queryKey: ['point-detail', pointId],
  queryFn: () => pointsApi.getDetail(pointId),  // GET /api/v1/points/:id/detail
  enabled: pointId !== null,
  staleTime: 5_000,
})
```
Add `getDetail(id: string)` to `frontend/src/api/points.ts` if it does not exist.

Do NOT:
- Remove the drag behavior — it is already implemented correctly.
- Use `localStorage` for position (use `sessionStorage` as spec says session-persisted).
- Block the panel from opening if the /detail endpoint is not yet implemented — fall back to the existing getMeta + getLatest approach until the endpoint exists.
