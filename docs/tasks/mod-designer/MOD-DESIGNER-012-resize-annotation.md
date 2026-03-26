---
id: MOD-DESIGNER-012
unit: MOD-DESIGNER
title: Add bounding box resize for annotation nodes (subtype-aware)
status: pending
priority: medium
depends-on: []
source: feature
decision: docs/decisions/designer-resize-completeness.md
---

## What to Build

Add an `else if (target?.type === 'annotation')` branch to the resize mouseup commit block in
`DesignerCanvas.tsx`. Annotation resize is subtype-dependent.

### Annotation node structure

```typescript
interface Annotation extends SceneNodeBase {
  type: 'annotation';
  annotationType: 'callout' | 'legend' | 'border' | 'title_block' | 'north_arrow'
                | 'header' | 'footer' | 'section_break' | 'page_break' | 'dimension_line';
  width: number;
  height: number;
  // ... other fields
}
```

### Per-subtype resize behavior

| `annotationType` | Resize axes | Min W | Min H | Notes |
|---|---|---|---|---|
| `callout` | W + H | 40 | 20 | Free resize |
| `legend` | W + H | 60 | 30 | Free resize |
| `border` | W + H | 100 | 40 | Free resize |
| `title_block` | W + H | 100 | 40 | Free resize |
| `north_arrow` | W + H, proportional | 20 | 20 | Lock W=H: use min(nw, nh) for both |
| `header` | W only | 40 | 16 | Clamp ny = prevT.position.y; nh stays as prev value (H not resizable by drag) |
| `footer` | W only | 40 | 16 | Same as header |
| `section_break` | W only | 20 | 4 | Clamp H to fixed 4px |
| `page_break` | W only | 20 | 4 | Clamp H to fixed 4px |
| `dimension_line` | **No bounding box resize** | — | — | Skip — return early |

Implementation:

```
target.type === 'annotation':
  const ann = target as Annotation
  if (ann.annotationType === 'dimension_line') {
    inter.type = 'none'; return  // excluded
  }

  let finalW = nw, finalH = nh
  if (ann.annotationType === 'north_arrow') {
    const side = max(20, min(nw, nh))
    finalW = side; finalH = side
  } else if (['header','footer'].includes(ann.annotationType)) {
    finalW = max(40, nw); finalH = ann.height  // height unchanged
    ny = inter.resizeOrigTransform.position.y  // vertical position unchanged
  } else if (['section_break','page_break'].includes(ann.annotationType)) {
    finalW = max(20, nw); finalH = 4
    ny = inter.resizeOrigTransform.position.y
  } else {
    // callout, legend, border, title_block
    const MINS = { callout:[40,20], legend:[60,30], border:[100,40], title_block:[100,40] }
    const [mw, mh] = MINS[ann.annotationType] ?? [20,20]
    finalW = max(mw, nw); finalH = max(mh, nh)
  }

  const prevT = inter.resizeOrigTransform
  const newT = { ...prevT, position: { x: nx, y: ny } }
  executeCmd(new ResizeNodeWithDimsCommand(
    inter.resizeNodeId,
    newT, { width: finalW, height: finalH },
    prevT, { width: ann.width, height: ann.height },
  ))
```

Also ensure `getNodeBounds()` returns correct dimensions for annotations (it should read `node.width` and
`node.height` directly — verify and fix if it returns a fallback).

### Handle visibility: do not show handles on dimension_line

In the `SelectionOverlay` or wherever resize handles are conditionally rendered, check if the selected node
is an annotation with `annotationType === 'dimension_line'` — if so, suppress the bounding box handles
(or render endpoint-drag handles instead, which is the subject of a future task).

## Acceptance Criteria

- [ ] Resizing a `callout`, `legend`, `border`, or `title_block` annotation commits W+H changes. Undo restores.
- [ ] Resizing a `north_arrow` always results in W = H (square), minimum 20×20.
- [ ] `header` and `footer` annotations can only be resized on the W axis; vertical position and height stay fixed.
- [ ] `section_break` and `page_break` annotations can only be resized on the W axis; height is locked at 4px.
- [ ] `dimension_line` annotations show no bounding box handles (no crash, no accidental resize).
- [ ] Resize handles for all non-dimension_line annotations appear at the correct positions.
- [ ] Undo works for all annotation types that support resize.

## Do NOT

- Do not implement dimension_line endpoint dragging in this task.
- Do not change any non-annotation resize behavior.
- Do not add auto-height or scroll behavior (that is designer-cross-mode-palette tasks).

## Dev Notes

File to edit: `frontend/src/pages/designer/DesignerCanvas.tsx`
Add the annotation branch immediately after the `embedded_svg` branch (around line 2211).
`ResizeNodeWithDimsCommand` is in `frontend/src/shared/graphics/commands.ts`.
The `Annotation` TypeScript type is in `frontend/src/shared/types/graphics.ts` — check that all subtypes
listed above are in the `annotationType` union. If some are missing, add them.
`inter.resizeOrigBounds` = pre-drag `{x, y, w, h}`. `inter.resizeOrigTransform` = pre-drag transform.
The `nx, ny, nw, nh` local variables (computed earlier in the mouseup block) hold the post-drag snapped
values — use these as inputs and adjust per-subtype as described above.
