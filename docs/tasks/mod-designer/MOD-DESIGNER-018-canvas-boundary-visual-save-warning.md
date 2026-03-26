---
id: MOD-DESIGNER-018
unit: MOD-DESIGNER
title: Render canvas boundary visual and add out-of-bounds save warning toast
status: pending
priority: medium
depends-on: []
source: feature
decision: docs/decisions/designer-canvas-size-controls.md
---

## What to Build

Two features specified in designer-implementation-spec.md §2.1 that are missing:

### 1. Canvas boundary visual (dashed 1px border)

In `DesignerCanvas.tsx`, within the SVG layer render function, add a boundary rect element that renders
when the canvas boundary is visible in the viewport.

**When to render:** The boundary is visible when the viewport extends beyond the canvas edges, i.e.:
```
const boundaryVisible =
  panX < 0 || panY < 0 ||
  (panX + viewportW / zoom) > canvasW ||
  (panY + viewportH / zoom) > canvasH
```
where `viewportW` and `viewportH` are the pixel dimensions of the canvas container element.

**How to render:**
```jsx
{boundaryVisible && (
  <rect
    x={0} y={0}
    width={canvasW} height={canvasH}
    fill="none"
    stroke="var(--io-border-subtle)"
    strokeOpacity={0.5}
    strokeWidth={1 / zoom}          // 1px regardless of zoom level
    strokeDasharray={`${8/zoom} ${4/zoom}`}  // 8px dash, 4px gap, scaled for zoom
    pointerEvents="none"
    style={{ position: 'relative', zIndex: -1 }}  // rendered below all content
  />
)}
```

Place this element as the FIRST child inside the SVG `<g>` that contains the scene graph, so it renders
below all content but above the background color rect.

**When autoHeight = true** (Report/Dashboard scrollable canvases): render only the top, left, and right
boundary edges (no bottom edge). Also render a horizontal guide line at `y = canvas.height`:
```jsx
<line
  x1={0} y1={canvasH} x2={canvasW} y2={canvasH}
  stroke="var(--io-border-subtle)"
  strokeOpacity={0.4}
  strokeWidth={1 / zoom}
  strokeDasharray={`${6/zoom} ${4/zoom}`}
  pointerEvents="none"
/>
```

**Only in Designer edit mode:** This visual should NOT render in Console/Process view-only mode or in
kiosk mode. It is a designer tool, not a display feature. Guard with `isDesignerMode` or similar context.

### 2. Save warning toast for out-of-bounds nodes

In the save function (wherever the auto-save or manual save is triggered in `index.tsx` or the store):

1. Walk `doc.children` — for each top-level node, compute `getNodeBounds(node)`.
2. A node is outside bounds if: `bounds.x < 0 || bounds.y < 0 || (bounds.x + bounds.w) > canvasW || (bounds.y + bounds.h) > canvasH`.
3. Collect the out-of-bounds node IDs.
4. If `outOfBoundsIds.length > 0`: trigger a toast notification:
   - Message: `"{N} element{s} outside the canvas boundary"`
   - Variant: warning (`--io-warning` colored icon/border)
   - Action: `[Select]` button — calling `emitSelection(outOfBoundsIds)` or dispatching selection to uiStore
   - Auto-dismiss: 8000ms
5. If 0 out-of-bounds nodes: no toast.

The save itself is NOT blocked. The toast is purely informational.

**Toast implementation:** Use whatever toast system is already in use in the codebase. If none exists, a
simple position:fixed bottom-right notification div is acceptable. Do not pull in a new library.

**Do not spam:** Only show the toast if the save was triggered explicitly (Ctrl+S or File → Save).
Auto-save (the periodic background save) should NOT show this toast to avoid flooding the user.

## Acceptance Criteria

- [ ] Zooming out until the canvas boundary is visible shows a 1px dashed border around the canvas boundary.
      The border scales correctly with zoom (remains visually 1px at all zoom levels).
- [ ] When fully zoomed in so no boundary is visible (canvas fills viewport), the border is not rendered.
- [ ] When `autoHeight=true`, no bottom boundary edge is drawn; a horizontal dashed guide appears at `canvas.height`.
- [ ] The boundary visual does NOT appear in Console or Process view-only mode.
- [ ] On explicit save (Ctrl+S / File → Save), if any nodes extend outside the canvas bounds, a warning toast
      appears with the accurate count.
- [ ] The [Select] button in the toast selects exactly the out-of-bounds nodes.
- [ ] The toast auto-dismisses after 8 seconds.
- [ ] Auto-save does not trigger the warning toast.
- [ ] If no nodes are out of bounds on save, no toast appears.

## Do NOT

- Do not block the save when nodes are out of bounds — the toast is informational only.
- Do not render the boundary visual in view-only mode (Console, Process, kiosk).
- Do not implement canvas resizing here (that is MOD-DESIGNER-017).

## Dev Notes

File to edit: `frontend/src/pages/designer/DesignerCanvas.tsx`
- `canvasW` and `canvasH` are already computed: `doc?.canvas.width ?? 1920` / `doc?.canvas.height ?? 1080`
- `panX`, `panY`, `zoom` are from `viewport` (already destructured)
- `viewportW` / `viewportH`: get from the container ref's `getBoundingClientRect()` — may already be tracked
  in state or you can compute on the fly from the SVG container div
- The boundary rect must be inside the SVG coordinate system (not screen pixels) — SVG units, not px

File to edit: `frontend/src/pages/designer/index.tsx`
- Find the save trigger (likely a `handleSave` or `autoSave` function, and a `useEffect` for Ctrl+S)
- The out-of-bounds check: import or inline `getNodeBounds` from DesignerCanvas. Alternatively, define a
  shared utility function in `frontend/src/shared/graphics/` and import in both places.
- Toast: look for any existing notification/toast context in the codebase before creating new infrastructure.
  Check `frontend/src/shared/components/` for a Toast or Notification component.
- Distinguish explicit vs auto-save with a flag parameter on the save function: `save({ explicit: true })`.
