---
id: MOD-DESIGNER-013
unit: MOD-DESIGNER
title: Add group proportional resize (Figma model — scale all children)
status: pending
priority: medium
depends-on: [MOD-DESIGNER-011]
source: feature
decision: docs/decisions/designer-resize-completeness.md
---

## What to Build

Add an `else if (target?.type === 'group')` branch to the resize mouseup commit block in `DesignerCanvas.tsx`.
Group resize scales all children proportionally — their positions relative to the group origin AND their
own sizes all scale by the same factors (sx, sy).

### Algorithm

```
target.type === 'group':
  const grp = target as Group

  // 1. The pre-drag group bounding box (available as inter.resizeOrigBounds)
  const origBBox = inter.resizeOrigBounds  // { x, y, w, h }

  // 2. Enforce minimum group size
  const finalW = max(20, nw)
  const finalH = max(20, nh)

  // 3. Scale factors
  const sx = finalW / origBBox.w
  const sy = finalH / origBBox.h

  // 4. Build one command per child
  const childCommands: SceneCommand[] = grp.children.map(child => {
    // Child position relative to group bounding box origin
    const relX = child.transform.position.x - origBBox.x
    const relY = child.transform.position.y - origBBox.y

    const newChildX = origBBox.x + relX * sx
    const newChildY = origBBox.y + relY * sy
    const newChildScaleX = child.transform.scale.x * sx
    const newChildScaleY = child.transform.scale.y * sy

    // For nodes with explicit width/height (widget, text_block, stencil, image, embedded_svg),
    // also scale those dimensions.
    const newChildTransform: Transform = {
      ...child.transform,
      position: { x: newChildX, y: newChildY },
      scale: { x: newChildScaleX, y: newChildScaleY },
    }

    return new ResizeNodeWithDimsCommand(
      child.id,
      newChildTransform,
      getScaledDims(child, sx, sy),   // helper: returns { width, height } or {} if not applicable
      child.transform,
      getOriginalDims(child),
    )
  })

  // 5. Also update the group node's own transform position to nx, ny
  const groupPositionCmd = new ChangePropertyCommand(
    grp.id, 'transform.position', { x: nx, y: ny }, grp.transform.position
  )

  // 6. Wrap everything in a CompoundCommand
  executeCmd(new CompoundCommand([groupPositionCmd, ...childCommands]))
```

### `getScaledDims(child, sx, sy)` helper

Returns an object with the node's explicit dimension properties scaled:
- `widget`: `{ width: child.width * sx, height: child.height * sy }`
- `text_block`: `{ width: child.width * sx, height: child.height * sy }`
- `stencil`: `{ width: child.width * sx, height: child.height * sy }`
- `image`: `{ displayWidth: child.displayWidth * sx, displayHeight: child.displayHeight * sy }` (different field names)
- `embedded_svg`: `{ width: child.width * sx, height: child.height * sy }`
- `primitive`: returns `{}` (primitives scale via transform.scale)
- `symbol_instance`: returns `{}` (scales via transform.scale)
- all others: returns `{}`

### Nested groups

If a child is itself a group, recursion is NOT implemented in this task. Treat a nested group as a single
unit: scale its transform.position and transform.scale, but do NOT recursively rescale its children. This
produces acceptable results for one level of nesting and avoids stack overflow risk.

### Handle visibility on groups

Ensure `getNodeBounds()` correctly computes the bounding box of a group as the union of all its children's
bounding boxes. If it currently does not, fix it here. This is required for the handles to render correctly.

## Acceptance Criteria

- [ ] Resizing a group moves and scales all direct children proportionally. The relative visual layout of
      the group contents is preserved.
- [ ] Group resize enforces a minimum 20×20 resulting group size.
- [ ] A single Ctrl+Z undoes the entire group resize in one step (all children restored).
- [ ] Groups with no children can be resized without crashing (no children → no child commands, only the
      group position command).
- [ ] Resize handles appear on a selected group at the correct bounding box positions.
- [ ] Existing non-group resize behavior is unaffected.

## Do NOT

- Do not implement recursive nested-group resize in this task.
- Do not attempt to resize a pipe child inside a group (skip pipe children, as pipes use endpoint dragging).
- Do not implement live visual preview during drag.
- Do not touch multi-node resize logic (that is MOD-DESIGNER-015).

## Dev Notes

File to edit: `frontend/src/pages/designer/DesignerCanvas.tsx`
`CompoundCommand` is imported from `frontend/src/shared/graphics/commands.ts`.
`ResizeNodeWithDimsCommand` signature (check commands.ts): takes `(nodeId, newTransform, newDims, oldTransform, oldDims, dimKeys?)`.
The `Group` type is in `frontend/src/shared/types/graphics.ts`.
`inter.resizeOrigBounds` = the pre-drag union bounding box of the selected node (for a group, this should be
the group's children bounding box — verify `getNodeBounds()` computes this correctly before this task runs).
`origBBox.x` and `origBBox.y` are the top-left of the group bounding box in canvas coordinates. Child
positions are also in canvas coordinates (not relative to group) — confirm this with the actual data model.
