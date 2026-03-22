---
id: MOD-DESIGNER-015
unit: MOD-DESIGNER
title: Enable multi-node resize (CompoundCommand wrapping per-node resize commands)
status: pending
priority: medium
depends-on: [MOD-DESIGNER-011, MOD-DESIGNER-012, MOD-DESIGNER-013, MOD-DESIGNER-014]
source: feature
decision: docs/decisions/designer-resize-completeness.md
---

## What to Build

Currently the resize interaction is gated to single-selection (`selectedIds.size === 1` guard). Remove this
gate and implement multi-node resize: when multiple nodes are selected and the user drags a resize handle,
all selected nodes scale proportionally within the shared selection bounding box.

### Changes to the resize start (`startResize` helper)

The `startResize` function currently stores a single `resizeNodeId`. Extend `interactionRef` to also store:
- `resizeNodeIds: NodeId[]` — all selected node IDs participating in resize
- `resizeNodeOrigTransforms: Map<NodeId, Transform>` — per-node original transforms
- `resizeNodeOrigDims: Map<NodeId, { w: number; h: number }>` — per-node original dimensions (from `getNodeBounds`)
- `resizeOrigSelectionBBox: { x, y, w, h }` — union bounding box of all selected nodes

On `startResize`, populate these from the current selection. Exclude pipe nodes (pipes are never resized
by bounding box — skip them silently).

### Changes to the mouseup resize commit

Replace the single-node dispatch with a multi-node loop:

```
// Compute selection-level scale factors
const origSel = inter.resizeOrigSelectionBBox
const finalSelW = max(20, nw)   // nw/nh are the new bounding box dims from handle math
const finalSelH = max(20, nh)
const sx = finalSelW / origSel.w
const sy = finalSelH / origSel.h
const newSelOriginX = nx   // top-left of new selection bounding box
const newSelOriginY = ny

const perNodeCommands: SceneCommand[] = []
for (const nodeId of inter.resizeNodeIds) {
  const node = findNode(doc.children, nodeId)
  if (!node || node.type === 'pipe') continue

  const origT = inter.resizeNodeOrigTransforms.get(nodeId)!
  const origDims = inter.resizeNodeOrigDims.get(nodeId)!

  // Position of node relative to selection origin
  const relX = origT.position.x - origSel.x
  const relY = origT.position.y - origSel.y

  // New position
  const newX = newSelOriginX + relX * sx
  const newY = newSelOriginY + relY * sy

  // New size (clamped to node-type minimum)
  const rawW = origDims.w * sx
  const rawH = origDims.h * sy

  // Build the appropriate command based on node type (reuse same logic as single-node resize)
  const cmd = buildResizeCommand(node, origT, { x: newX, y: newY }, rawW, rawH)
  if (cmd) perNodeCommands.push(cmd)
}

if (perNodeCommands.length === 1) {
  executeCmd(perNodeCommands[0])
} else if (perNodeCommands.length > 1) {
  executeCmd(new CompoundCommand(perNodeCommands))
}
```

The `buildResizeCommand(node, origTransform, newPos, rawW, rawH)` function encapsulates the per-node-type
command creation (extracted from the single-node dispatch logic). It applies node-type minimums and returns
the appropriate SceneCommand or null for pipes.

### Remove the single-selection guard

Find and remove any `if (selectedIds.size !== 1) return` or similar guard in the `startResize` trigger code
(in the `SelectionOverlay` handle's `onMouseDown`).

Update `interactionRef` type to store `resizeNodeIds` (plural). Keep `resizeNodeId` for backward compatibility
or remove it and update all references.

## Acceptance Criteria

- [ ] With 2+ nodes selected, dragging a bounding box resize handle resizes all selected nodes proportionally.
- [ ] Each node in a multi-selection enforces its own minimum size (a tiny node won't go below its min even
      if the overall selection scale would require it).
- [ ] Ctrl+Z undoes the entire multi-node resize in one step.
- [ ] Pipe nodes in a multi-selection are silently skipped (they do not participate in bounding box resize).
- [ ] Single-node resize continues to work correctly (no regression).
- [ ] The resize handle position during a multi-selection correctly shows the union bounding box of all
      selected nodes, not just the first selected node.

## Do NOT

- Do not implement this before MOD-DESIGNER-011 through MOD-DESIGNER-014 are complete (those add the
  per-node command logic that this task orchestrates).
- Do not implement live visual preview during multi-node drag (that is MOD-DESIGNER-002).
- Do not resize group children individually when the group itself is part of a multi-selection — treat the
  group as a single unit (its own bounding box; use the group resize logic from MOD-DESIGNER-013).

## Dev Notes

Files to edit:
- `frontend/src/pages/designer/DesignerCanvas.tsx` — `startResize` helper, `interactionRef` type, mouseup
  commit block, guard removal
- The `SelectionOverlay` rendering logic (same file, or a sub-component) that shows the bounding box handles
  for multi-selection — verify it computes the union bounding box of all selected nodes and passes the
  correct `bounds` to `startResize`.
`CompoundCommand` is in `frontend/src/shared/graphics/commands.ts`.
The `resizeOrigSelectionBBox` should be computed as the same union bounding box used to render the selection
overlay — reuse that computation, don't recalculate.
For `buildResizeCommand`, this is a refactor of the existing node-type switch in the mouseup block. Extract
it into a named function at the top of the mouseup handler to avoid code duplication.
