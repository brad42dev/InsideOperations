---
decision: designer-resize-completeness
unit: MOD-DESIGNER
type: fix
date: 2026-03-22
author: feature-agent
---

# Designer — Resize Completeness for All Node Types

## Context

The Designer canvas has 8 distinct handles (nw, n, ne, e, se, s, sw, w) rendered for selected nodes, and a
well-defined resize interaction loop (mousedown → mousemove preview → mouseup commit via SceneCommand). However,
the mouseup dispatch only handles a subset of node types. Several node types either have no case at all or have
handles that render but never commit.

Additionally, multi-node resize is blocked to single-selection despite the spec explicitly requiring it, and
display elements have no resize handling despite needing it as standalone canvas elements.

## Decision

### Fix: symbol_instance, text_block, stencil — missing mouseup dispatch

These three types all use the `ResizeNodeWithDimsCommand` pattern (explicit width/height stored on the node), but
the mouseup switch in `DesignerCanvas.tsx` has no case for them. The fix is to add their respective branches,
enforcing the minimums defined in the spec:

| Node type | Width stored as | Height stored as | Min W | Min H |
|---|---|---|---|---|
| `symbol_instance` | `transform.scale.x` × natural SVG width | `transform.scale.y` × natural SVG height | 10 | 10 |
| `text_block` | `width` property | auto (line-height × line count) — treat as min height | 20 | 10 |
| `stencil` | `width` property | `height` property | 16 | 16 |

For `symbol_instance`, resize is implemented as a scale transform (not explicit dims): the new scale factors are
`newW / naturalW` and `newH / naturalH` where naturalW/H come from the SVG's viewBox.

### Fix: annotation — resize by subtype

Annotations have multiple subtypes with different resize semantics:

| Subtype | Resize axes | Min W | Min H | Notes |
|---|---|---|---|---|
| `callout` | W + H | 40 | 20 | Free resize |
| `legend` | W + H | 60 | 30 | Free resize |
| `border` / `title_block` | W + H | 100 | 40 | Free resize |
| `north_arrow` | W = H (proportional only) | 20 | 20 | Always square |
| `header` / `footer` | W only | canvas width | 16 | Height free up to 80px max |
| `section_break` / `page_break` | W only | 20 | 4 | Height fixed |
| `dimension_line` | Endpoint drag (not bounding box) | — | — | Excluded from bounding box resize |

All annotation resize uses `ChangePropertyCommand` on the node's `width`/`height` fields.

### New: group — proportional resize (Figma model)

Groups have no explicit width/height — their bounding box is derived from their children. Resizing a group
scales all children proportionally:

```
1. Compute currentGroupBBox = union of all children bounding boxes
2. Compute scale factors: sx = newW / currentGroupBBox.w, sy = newH / currentGroupBBox.h
3. For each child node:
   relativeX = child.transform.position.x - currentGroupBBox.x
   relativeY = child.transform.position.y - currentGroupBBox.y
   child.newPos = { x: currentGroupBBox.x + relativeX * sx, y: currentGroupBBox.y + relativeY * sy }
   child.newScale = { x: child.transform.scale.x * sx, y: child.transform.scale.y * sy }
4. Create a CompoundCommand wrapping one ResizeNodeCommand per child
5. Minimum group size: 20×20 (any smaller and the resulting child sizes become degenerate)
```

Groups are created via the "Group" menu action (Ctrl+G on multi-selection); they are NOT created automatically
on multi-select. A group node in the scene graph has `type: 'group'` and an array of `children`.

### New: display element — resize with drag handles

Display elements placed as standalone canvas nodes (direct children of GraphicDocument) need resize handles.
Display elements that are children of a SymbolInstance (attached to a valueAnchor) are NOT resizable via
bounding box handles — they are repositioned via the anchor system.

Standalone display elements use `ChangePropertyCommand` to update the size-controlling config fields:

| Display element type | Width stored as | Height stored as | Min W | Min H |
|---|---|---|---|---|
| `text_readout` | `width` config field | `height` config field | 40 | 16 |
| `analog_bar` | `barWidth` config field | `barHeight` config field | 10 | 30 |
| `fill_gauge` | `barWidth` config field | `barHeight` config field | 10 | 30 |
| `sparkline` | `sparkWidth` config field | `sparkHeight` config field | 40 | 10 |
| `alarm_indicator` | `width` config field | `height` config field | 20 | 16 |
| `digital_status` | `width` config field | `height` config field | 30 | 16 |

The bounding box helper `getNodeBounds()` must already return correct dimensions for these types (it does for most
— verify and patch any that return hardcoded defaults).

### Fix: multi-node resize — enable CompoundCommand wrap

The current code gates resize interactions to single-selected nodes (`selectedIds.size === 1`). The spec requires
multi-node resize: when multiple nodes are selected and a bounding box handle is dragged, all selected nodes
resize proportionally within the shared selection bounding box, each wrapped in its own command, combined into
a `CompoundCommand`.

Multi-node resize algorithm:
```
1. originalSelectionBBox = union bounding box of all selected nodes
2. On mouseup: compute newSelectionBBox from handle drag
3. sx = newSelectionBBox.w / originalSelectionBBox.w
4. sy = newSelectionBBox.h / originalSelectionBBox.h
5. For each selected node:
   relPos = node.position - originalSelectionBBox.topLeft
   newPos = newSelectionBBox.topLeft + (relPos.x * sx, relPos.y * sy)
   newSize = (node.w * sx, node.h * sy) — clamped to node-type minimum
   → create appropriate command for that node type (ResizePrimitiveCommand,
     ResizeNodeWithDimsCommand, etc.)
6. Wrap all in CompoundCommand, execute, push to history
```

Pipes in a multi-node selection are skipped (pipes use endpoint drag; they are not resized by bounding box).

## Acceptance Criteria

1. Resizing a `symbol_instance` via drag handle commits a scale transform on mouseup; the shape cannot be
   reduced below 10×10 SVG units.
2. Resizing a `text_block` via drag handle commits a width/height change on mouseup; min 20×10.
3. Resizing a `stencil` via drag handle commits a width/height change on mouseup; min 16×16.
4. Resize handles render on all annotation types except `dimension_line`. Resizing commits appropriate
   property changes per the subtype table. `north_arrow` maintains aspect ratio. `section_break` and
   `page_break` only resize on the W axis.
5. Resizing a group scales all children proportionally (position + scale). The undo of a group resize
   restores all children to their original transforms in one undo step.
6. Standalone display elements have resize handles. Dragging them commits size changes to the correct
   config fields. Display elements that are SymbolInstance children do NOT show bounding box handles.
7. Multi-node resize is enabled when ≥2 non-pipe nodes are selected. All selected nodes resize
   proportionally within the shared selection bounding box. One undo step undoes all resizes together.
8. No regression: primitive, image, widget, embedded_svg resize continue to work as before.

## Out of Scope

- Pipe resize via bounding box (endpoint drag only — this is correct per spec).
- Dimension line bounding box resize (endpoint drag only).
- Display elements that are children of a SymbolInstance — those are repositioned via value anchors, not
  resized independently.
- Visual live preview during resize (the mousemove "no visual preview" placeholder — that is a separate
  performance task, MOD-DESIGNER-002).

## Files Expected to Change

- `frontend/src/pages/designer/DesignerCanvas.tsx` — mouseup resize dispatch block; startResize helper;
  multi-node resize selection guard; `getNodeBounds()` fixes for display elements
- `frontend/src/shared/graphics/commands.ts` — verify ResizeNodeWithDimsCommand handles stencil/text_block;
  add ResizeGroupCommand if not present
- `frontend/src/shared/types/graphics.ts` — verify display element config fields exist for width/height

## Dependencies

- None. All changes are in the resize dispatch code path.
