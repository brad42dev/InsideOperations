---
id: MOD-DESIGNER-011
unit: MOD-DESIGNER
title: Fix resize mouseup dispatch for symbol_instance, text_block, and stencil
status: pending
priority: high
depends-on: []
source: feature
decision: docs/decisions/designer-resize-completeness.md
---

## What to Build

In `DesignerCanvas.tsx`, the mouseup resize commit block (around line 2138) handles: `primitive`, `image`,
`widget`, `embedded_svg`. Three node types are completely missing:

### 1. `symbol_instance`

A symbol instance is resized by changing its `transform.scale` to achieve the new display dimensions.
The natural (unscaled) dimensions come from the shape's SVG viewBox (stored in `libraryStore` as the shape's
`naturalWidth` and `naturalHeight`). If the natural dimensions are unavailable, fall back to the current
bounding box as the 1x reference.

```
target.type === 'symbol_instance':
  naturalW = libraryStore.getShape(target.shapeRef.shapeId)?.naturalWidth ?? inter.resizeOrigBounds.w
  naturalH = libraryStore.getShape(target.shapeRef.shapeId)?.naturalHeight ?? inter.resizeOrigBounds.h
  newScaleX = max(10, nw) / naturalW
  newScaleY = max(10, nh) / naturalH
  newTransform = { ...prevT, position: { x: nx, y: ny }, scale: { x: newScaleX, y: newScaleY } }
  executeCmd(new ResizeNodeWithDimsCommand(
    inter.resizeNodeId,
    newTransform, { scaleX: newScaleX, scaleY: newScaleY },
    prevT, { scaleX: prevT.scale.x, scaleY: prevT.scale.y },
    ['transform.scale']   // property key hint for ResizeNodeWithDimsCommand
  ))
```

If `ResizeNodeWithDimsCommand` does not support scale-based resize, use a direct `ChangePropertyCommand` on
`transform.scale` or create a `ResizeSymbolCommand` if that already exists.

Minimum: do not allow nw < 10 or nh < 10 (clamp before computing scale).

### 2. `text_block`

TextBlock stores explicit `width` and `height` fields on the node (not transform scale). After resize:

```
target.type === 'text_block':
  newW = max(20, nw)
  newH = max(10, nh)
  executeCmd(new ResizeNodeWithDimsCommand(
    inter.resizeNodeId,
    { ...prevT, position: { x: nx, y: ny } }, { width: newW, height: newH },
    prevT, { width: target.width, height: target.height },
  ))
```

### 3. `stencil`

Same pattern as text_block (explicit width/height on node):

```
target.type === 'stencil':
  newW = max(16, nw)
  newH = max(16, nh)
  executeCmd(new ResizeNodeWithDimsCommand(
    inter.resizeNodeId,
    { ...prevT, position: { x: nx, y: ny } }, { width: newW, height: newH },
    prevT, { width: target.width, height: target.height },
  ))
```

Also verify that `getNodeBounds()` returns correct W/H for `symbol_instance`, `text_block`, and `stencil` so
that the resize handles render at the correct positions before the user begins dragging. If any return (0,0)
or hardcoded fallbacks, fix them.

## Acceptance Criteria

- [ ] Dragging a resize handle on a selected SymbolInstance and releasing commits a scale transform. The
      shape visually matches the dragged size. Undo restores the original scale.
- [ ] Dragging a resize handle on a selected TextBlock commits width and height changes. Min 20×10.
- [ ] Dragging a resize handle on a selected Stencil commits width and height changes. Min 16×16.
- [ ] Resize handles for all three types appear at the correct corners/edges of the node's bounding box.
- [ ] No console errors or null-reference crashes during resize of any of these three types.
- [ ] Existing resize behavior for primitive, image, widget, embedded_svg is unaffected.

## Do NOT

- Do not remove or restructure the existing resize handling for primitive, image, widget, embedded_svg.
- Do not implement live visual preview during drag (that is MOD-DESIGNER-002).
- Do not implement multi-node resize in this task (that is MOD-DESIGNER-015).
- Do not add `ResizeGroupCommand` or group resize logic here.

## Dev Notes

File to edit: `frontend/src/pages/designer/DesignerCanvas.tsx`
The resize commit block starts near the comment `// Resize commit` (around line 2137 currently).
The `findResizeNode()` helper already walks the scene graph — just add the three new `else if` branches.
The `ResizeNodeWithDimsCommand` is imported from `frontend/src/shared/graphics/commands.ts`.
`getNodeBounds()` is a local helper in DesignerCanvas near line 160.
`inter.resizeOrigBounds` has the pre-drag `{ x, y, w, h }` and `inter.resizeOrigTransform` has the
pre-drag transform — use these as the "old" values in the command.
`snap()` local function rounds to the grid if snap is enabled — call it on `nx, ny, nw, nh`.
