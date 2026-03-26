---
id: MOD-DESIGNER-047
unit: MOD-DESIGNER
title: Canvas drag-to-move element position could not be confirmed in UAT
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## Root Cause

UAT Scenario 3 failed because the Playwright automation queried SVG elements using a broad selector (e.g. `querySelector('svg rect')`) and matched a navigation-sidebar icon SVG `<rect>` at screen coords (28, 92) instead of the canvas element at (630, 325). Clicking the nav icon triggered navigation to /console, making it impossible to confirm the drag outcome.

The underlying product drag-to-move implementation appears complete (drag ghost appended to body, `MoveNodesCommand` committed on mouseup), but two testability gaps make automated verification unreliable:

1. **Canvas SVG has no testid** — `<svg>` rendered by DesignerCanvas has no `data-testid` attribute, so UAT cannot scope element queries to the canvas SVG vs. SVG icons elsewhere in the page.
2. **Node `<g>` elements do not expose canvas-space position as DOM attributes** — after a drag commit, the `transform="translate(x,y)"` value changes, but UAT automation would need to parse SVG transform strings to verify position. A `data-canvas-x` / `data-canvas-y` attribute on each node `<g>` would allow UAT to assert the new position by reading a plain number attribute.

## What to Build

### 1. Add `data-testid="designer-canvas-svg"` to the canvas SVG element

In `DesignerCanvas.tsx`, the main `<svg>` element (rendered inside the `containerRef` div with `data-designer-canvas="true"`) should receive `data-testid="designer-canvas-svg"`.

```tsx
<svg
  data-testid="designer-canvas-svg"
  width="100%"
  height="100%"
  style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}
>
```

This allows UAT to scope all canvas element queries:
```js
const canvasSvg = document.querySelector('[data-testid="designer-canvas-svg"]')
const canvasNode = canvasSvg.querySelector('[data-node-id]')
```

### 2. Add `data-canvas-x` and `data-canvas-y` to node `<g>` elements

Every node `<g>` rendered by DesignerCanvas has `data-node-id={id}`. Add `data-canvas-x` and `data-canvas-y` as integer string attributes reflecting the node's current canvas-space position:

```tsx
// Before (example display element)
<g transform={tx} data-node-id={de.id} opacity={de.opacity} onContextMenu={handleContextMenu}>

// After
<g
  transform={tx}
  data-node-id={de.id}
  data-canvas-x={String(Math.round(de.transform.position.x))}
  data-canvas-y={String(Math.round(de.transform.position.y))}
  opacity={de.opacity}
  onContextMenu={handleContextMenu}
>
```

This applies to **all** node types rendered in the canvas: display elements (Text Readout, Analog Bar, Multistate, LED, Gauge, Animated SVG, Video, etc.), shapes (Rect, Ellipse, Line, Path, Text, Annotation), symbols, and stencils.

The helper `gProps` object at the top of the render function (used for shapes/groups) should also be extended:
```tsx
const gProps = {
  key: id,
  transform: t,
  'data-node-id': id,
  'data-canvas-x': String(Math.round(node.transform.position.x)),
  'data-canvas-y': String(Math.round(node.transform.position.y)),
}
```

After a `MoveNodesCommand` commits, React re-renders the node `<g>` with the updated position, so `data-canvas-x`/`data-canvas-y` automatically reflect the new location.

UAT can then verify drag-to-move with:
```js
const before = parseInt(node.getAttribute('data-canvas-x'))
// ... perform drag ...
const after = parseInt(node.getAttribute('data-canvas-x'))
assert(after !== before)  // position changed
```

### 3. Add `data-canvas-position-committed` sentinel (optional, recommended)

After a drag commit, the ghost is removed (id `io-canvas-drag-ghost` deleted from body). UAT already monitors for ghost removal to detect drag end. No additional sentinel is strictly required, but if the UAT agent needs to know that the position has been written to the DOM, the ghost removal + `data-canvas-x` change together constitute a reliable two-step verification.

## Files to Create or Modify

- `frontend/src/pages/designer/DesignerCanvas.tsx` — add `data-testid`, add `data-canvas-x`/`data-canvas-y` to all node `<g>` elements

## Acceptance Criteria

- [ ] `document.querySelector('[data-testid="designer-canvas-svg"]')` returns the canvas SVG element (not null)
- [ ] `canvasSvg.querySelector('[data-node-id]')` returns only canvas nodes (not nav sidebar icons)
- [ ] After placing a display element on the canvas, its `<g>` has `data-canvas-x` and `data-canvas-y` with integer string values matching its canvas-space position
- [ ] After dragging an element to a new position, `data-canvas-x` / `data-canvas-y` reflect the new position (React re-render updates attributes)
- [ ] All node types (display elements, shapes, symbols, stencils) receive these attributes
- [ ] No regression: drag ghost still appears and disappears; undo/redo still works; MoveNodesCommand still fires

## Do NOT

- Do not add these attributes to overlay elements (selection handles, resize handles, guides, lock icons) — only the actual data nodes
- Do not throttle or debounce the attribute updates — they must be synchronous with the render cycle
- Do not change the `data-node-id` attribute scheme — keep it for backward compatibility

## Dev Notes

UAT failure from 2026-03-26: Playwright drag automation queried `svg rect` globally and found navigation sidebar icon rect at screen (28, 92). Clicking that coord triggered `/console` navigation. The canvas element at (630, 325) was confirmed present by right-click test at same coordinates. The drag feature itself is believed functional; this task adds the testability hooks that allow UAT to verify it reliably.

Spec reference: MOD-DESIGNER-002 (drag ghost implementation), designer-implementation-spec.md.
