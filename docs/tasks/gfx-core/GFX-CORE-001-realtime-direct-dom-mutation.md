---
id: GFX-CORE-001
title: Implement pointToElements map with direct DOM mutation for real-time updates
unit: GFX-CORE
status: done
priority: high
depends-on: []
---

## What This Feature Should Do

When a WebSocket message delivers a point value update, the graphics layer must update affected SVG elements directly in the DOM without triggering a React re-render. The correct architecture is: WebSocket → mutable buffer → `requestAnimationFrame` drain loop → O(1) lookup in a `pointToElements` map → direct SVG DOM mutation. This keeps 10,000+ concurrent data points updating at sub-frame latency with zero React overhead on the hot path.

## Spec Excerpt (verbatim)

> **Step 4: Build point-to-element lookup**
> ```typescript
> const pointToElements = new Map<string, {
>   svgElements: SVGElement[];
>   expressionRefs: { expressionKey: string; dependentElements: SVGElement[] }[];
> }>();
> ```
> **Step 10: On point update — O(1) lookup, direct DOM update**
> ```typescript
> function onPointUpdate(pointId: string, value: PointValue) {
>   const targets = pointToElements.get(pointId);
>   if (!targets) return;
>   for (const el of targets.svgElements) {
>     updateDisplayElement(el, value); // Direct DOM mutation, bypasses React
>   }
> }
> ```
> This is the hot path. Direct DOM updates bypass React for minimal latency. The `pointToElements` map is rebuilt only on structural scene graph changes (node added/removed), not on value updates.
> — graphics-scene-graph-implementation-spec.md, §5.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — `liveSubscribe` prop (line ~62); `nodeConfigMapRef` and `pointToElementsRef` declarations and their `useEffect` blocks; `applyPointValue` function at the bottom of the file
- `frontend/src/pages/console/panes/GraphicPane.tsx` — `liveSubscribe={!isHistorical}` on SceneRenderer; `tooltipValuesRef` wsManager subscription

## Architecture as Implemented

The implementation uses `liveSubscribe?: boolean` on `SceneRenderer` to activate the direct-DOM path:

- **`liveSubscribe=true`** (desktop live mode): SceneRenderer subscribes to `wsManager` directly. Incoming `PointValue` messages go into `pendingDomRef` (a mutable ref, no React state). A `requestAnimationFrame` drain loop reads the buffer and calls `applyPointValue()` for each affected element. React is not involved after initial render.
- **`liveSubscribe=false`** (designer mode, historical/playback): SceneRenderer uses the `pointValues` prop (React rendering) as before.

Two parallel data structures (both refs, not state):
1. `nodeConfigMapRef: Map<nodeId, {displayType, config, binding}>` — built by walking the scene graph JSON. Provides config for `applyPointValue` without DOM queries.
2. `pointToElementsRef: Map<pointId, SVGGElement[]>` — built after each render by `svgRef.current.querySelectorAll('[data-point-id]')`. Provides O(1) element lookup.

`applyPointValue(el, displayType, config, pv)` is a module-level pure function that does targeted DOM mutations using `data-role` attributes on child elements (`data-role="value"`, `"box"`, `"bg"`, `"pointer"`, `"pointer-line"`, `"numeric"`, `"fill"`). Covers: `text_readout`, `analog_bar`, `digital_status`, `fill_gauge`, `symbol_state` (equipment CSS class).

In `GraphicPane`:
- `useWebSocketRaf` now only subscribes when `isPhone && !isHistorical` (for `TileGraphicViewer`)
- A separate `tooltipValuesRef` tracks latest values via a direct `wsManager.subscribe` (no React state), used by the hover tooltip

## Verification Checklist

- [ ] `SceneRenderer` has a `liveSubscribe?: boolean` prop. When `true`, the direct-DOM path is active.
- [ ] A `pointToElementsRef` (type `Map<string, SVGGElement[]>`) is populated via `useEffect` using `svgRef.current.querySelectorAll('[data-point-id]')`. It is rebuilt when `document.id` or `children` changes — NOT on every point update.
- [ ] A `nodeConfigMapRef` (type `Map<string, {displayType, config, binding}>`) is populated by walking `children` in a `useEffect` that depends on `document.id`. Provides display config without DOM queries.
- [ ] Incoming point updates write to a `pendingDomRef` (mutable ref, not state). The handler schedules one `requestAnimationFrame` if none is already pending — does NOT call `setState`.
- [ ] The rAF callback drains `pendingDomRef`, looks up elements in `pointToElementsRef`, and calls `applyPointValue`. No React state is touched inside the rAF callback.
- [ ] `applyPointValue` (module-level function) handles `text_readout`, `analog_bar`, `digital_status`, `fill_gauge`, and `symbol_state` via `data-role` attribute queries on child elements.
- [ ] In `GraphicPane`, `useWebSocketRaf` only subscribes when `isPhone && !isHistorical`. Desktop live mode does not feed `pointValues` into SceneRenderer.
- [ ] `SceneRenderer` in `GraphicPane` receives `liveSubscribe={!isHistorical}` and `pointValues={isHistorical ? pointValues : undefined}`.
- [ ] Display elements still show "---" placeholder on first render; live values appear after the first rAF drain (acceptable initial state).

## Assessment

- **Status**: ❌ Missing (was), pending implementation verification
- **What needs to change**: Described above. The key architectural error was `pointValues` as a React prop causing full re-renders on every rAF tick.

## Do NOT

- Keep `pointValues` as the live update path — it causes full SceneRenderer re-renders
- Use Zustand or any React state for point values in the rAF drain callback
- Rebuild `pointToElementsRef` on every point update — only rebuild on `document.id` / `children` change
- Use `innerHTML` for display element updates — use targeted attribute and `textContent` mutations via `data-role` queries
- Apply `liveSubscribe=true` in designer mode — designer uses `pointValues` prop for static preview
