---
id: MOD-DESIGNER-020
unit: MOD-DESIGNER
title: Implement auto-height scrollable canvas for Report and Dashboard modes
status: pending
priority: medium
depends-on: [MOD-DESIGNER-016, MOD-DESIGNER-017, MOD-DESIGNER-019]
source: feature
decision: docs/decisions/designer-cross-mode-palette.md
---

## What to Build

When `canvas.autoHeight = true`, the canvas grows vertically to fit content. The designer canvas panel
gains a vertical scrollbar. The canvas boundary has no bottom edge — instead a guide line appears at
`canvas.height` (the declared minimum/page height).

### TypeScript type change

In `frontend/src/shared/types/graphics.ts`, the `GraphicDocument.canvas` type already has `width`,
`height`, `backgroundColor`. Add:
```typescript
autoHeight?: boolean;  // default false. true for report graphics
```
`autoHeight: undefined` and `autoHeight: false` are equivalent (backwards compatible with existing graphics).

### Canvas height computation

In `DesignerCanvas.tsx`, where `canvasH` is computed:
```typescript
const canvasH = doc?.canvas.height ?? 1080
```

Replace with:
```typescript
const declaredH = doc?.canvas.height ?? 1080
const autoHeight = doc?.canvas.autoHeight ?? false
const canvasH = autoHeight
  ? Math.max(declaredH, contentBoundingBoxBottom + 80)  // 80px padding below content
  : declaredH
```

Where `contentBoundingBoxBottom` is the maximum `(bounds.y + bounds.h)` of all visible, non-locked nodes.
This should be computed using the existing `getNodeBounds()` helper applied to all top-level nodes.

**Performance:** `contentBoundingBoxBottom` should be memoized or computed only when the scene graph changes
(not on every render tick). Use `useMemo` dependent on `doc?.children`.

### SVG and viewport behavior

When `autoHeight = true`:
- The SVG element's `viewBox` height uses `canvasH` (the auto-computed value)
- The canvas container div gains `overflow-y: auto` (or the existing scroll mechanism is re-used)
- Vertical pan (`panY`) still works, but the content should also be accessible by native scroll when zoomed
  at 100%
- The bottom boundary edge is NOT rendered (the boundary rect from MOD-DESIGNER-018 should skip the bottom
  segment or be replaced with three separate line elements for top, left, right)
- The page guide line (horizontal dashed line at `y = declaredH`) IS rendered as described in MOD-DESIGNER-018

### HTML widget overlay layer

Widget nodes render in the HTML overlay. The overlay div's height must also auto-grow to match `canvasH`.
Currently the overlay is `position: absolute; inset: 0`. Change to:
```css
position: absolute;
left: 0; right: 0; top: 0;
height: {canvasH * zoom}px;   /* grows with content */
pointer-events: none;
```

Widget div positions (left/top/width/height) are already computed via `canvasToScreen()` — these continue
to work correctly as `canvasH` grows.

### Defaults on creation

When a new graphic is created with mode=`report`, set `autoHeight: true` in the `GraphicDocument` (wired
in MOD-DESIGNER-016). When mode=`graphic` or `dashboard`, `autoHeight` defaults to `false` (not set).

### View-only mode (Console/Process panes)

When a report graphic with `autoHeight=true` is rendered in a Console pane or Process view, the SVG also
auto-sizes its height using the same `contentBoundingBoxBottom` computation. The pane's scroll mechanism
(if any) handles overflow. This does NOT require changes to the Console or Process modules — it is a
consequence of the SVG height being larger than the pane's clip area.

### Properties dialog integration

When `autoHeight` is toggled ON in the CanvasPropertiesDialog (MOD-DESIGNER-017):
- The Height input is relabeled "Min. Height / Page Height"
- A tooltip explains: "The canvas grows automatically to fit content. This value sets the minimum height."
- When toggled OFF: the Height input reverts to "Height" and the canvas is clamped to that value again.
  Nodes that are outside the new fixed bounds show a warning (same logic as MOD-DESIGNER-017 out-of-bounds warning).

## Acceptance Criteria

- [ ] New Report graphics (created via New Graphic dialog) open with `autoHeight=true`. The canvas expands
      vertically as content is added below the declared height.
- [ ] In Designer edit mode, the canvas panel shows a vertical scrollbar when the auto-height canvas extends
      beyond the viewport height.
- [ ] The content bounding box is recalculated when nodes are added, moved, or deleted, causing the canvas
      to grow or shrink accordingly (with an 80px bottom padding).
- [ ] The bottom canvas boundary edge is not drawn when `autoHeight=true`. The page guide line at
      `canvas.height` is drawn instead.
- [ ] Widget HTML overlay divs are correctly positioned on an auto-height canvas.
- [ ] Toggling `autoHeight` OFF in Properties dialog returns the canvas to its fixed declared height. Nodes
      outside the new bounds trigger the warning in the Properties dialog.
- [ ] Existing `autoHeight=false` canvases (all pre-existing graphics) are unaffected — they continue to
      behave exactly as today.
- [ ] Dashboard canvases default to `autoHeight=false` but can be toggled on in Properties dialog.

## Do NOT

- Do not implement horizontal auto-width (width is always fixed).
- Do not implement report pagination or page-break rendering (that is a report generation feature).
- Do not change the Console or Process module rendering logic — the SVG size change propagates naturally.
- Do not implement this before MOD-DESIGNER-016 (which adds autoHeight to the type definition and new graphic
  dialog), MOD-DESIGNER-017 (which adds the Properties toggle), or MOD-DESIGNER-018 (which handles the
  boundary visual for autoHeight).

## Dev Notes

Files to edit:
- `frontend/src/shared/types/graphics.ts` — add `autoHeight?: boolean` to canvas field
- `frontend/src/pages/designer/DesignerCanvas.tsx` — `canvasH` computation; SVG viewBox; overlay height;
  `contentBoundingBoxBottom` memo
- `frontend/src/pages/designer/components/CanvasPropertiesDialog.tsx` — auto-grow toggle relabels H input

`contentBoundingBoxBottom` pseudo-code:
```typescript
const contentBoundingBoxBottom = useMemo(() => {
  if (!doc || !doc.canvas.autoHeight) return doc?.canvas.height ?? 1080
  let maxY = 0
  for (const node of doc.children) {
    if (!node.visible) continue
    const b = getNodeBounds(node)
    if (b) maxY = Math.max(maxY, b.y + b.h)
  }
  return maxY
}, [doc?.children, doc?.canvas.autoHeight])

const canvasH = doc?.canvas.autoHeight
  ? Math.max(doc.canvas.height, contentBoundingBoxBottom + 80)
  : (doc?.canvas.height ?? 1080)
```

For the SVG viewBox: `viewBox="${panX} ${panY} ${canvasW / zoom} ${canvasH / zoom}"` — `canvasH` now varies.
The existing viewBox computation likely uses the fixed height; update it to use `canvasH`.
