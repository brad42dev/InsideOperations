---
id: DD-23-003
title: Enforce 5-level nesting depth limit with tooltip feedback
unit: DD-23
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Container tiles (group, square, cube, round, negate, abs, if_then_else) can be nested inside each other. The spec limits nesting to 5 levels. Dropping a container tile at depth 6 or beyond must be blocked and the user shown a tooltip: "Maximum nesting depth (5 levels) reached."

## Spec Excerpt (verbatim)

> **Depth limit**: 5 levels. Attempting to drop a container beyond level 5 is blocked with a tooltip: "Maximum nesting depth (5 levels) reached."
> — design-docs/23_EXPRESSION_BUILDER.md, §6.5

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1109–1117` — handleAddFromPalette; inserts without depth check
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1123–1144` — handleDragEnd; moves tiles without depth check
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:864–901` — DropZoneRow; renders drop targets without depth-aware gating

## Verification Checklist

- [ ] A `getDepth(tiles, id): number` or equivalent function exists that returns the nesting depth of a tile by its id
- [ ] `handleAddFromPalette` checks if the target parent's depth + 1 >= 5 when the tile being added is a container; if so, it shows a tooltip/toast and does not dispatch INSERT_TILE
- [ ] `handleDragEnd` checks depth limit before dispatching MOVE_TILE for container tiles
- [ ] DropZoneRow or WorkspaceTile renders a visual "blocked" indicator (tooltip, disabled drop target) when depth would exceed 5

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `getNestingColor` cycles depths with `depth % NESTING_COLORS.length` (line 125) showing there is no enforced ceiling. Neither `handleAddFromPalette` (line 1109) nor `handleDragEnd` (line 1123) check depth before inserting.

## Fix Instructions (if needed)

1. Add a helper `function getTileDepth(tiles: ExpressionTile[], targetId: string): number` that traverses the tree and returns 0 for top-level tiles, 1 for tiles inside a container at the top level, etc.
2. Add a constant `MAX_NESTING_DEPTH = 5` at the top of ExpressionBuilder.tsx.
3. In `handleAddFromPalette`: if the tile type is a container (group, square, cube, round, negate, abs, if_then_else) AND `state.cursorParentId !== null`, compute depth of `state.cursorParentId` and block + show toast if depth >= MAX_NESTING_DEPTH.
4. In `handleDragEnd`: for container tiles being moved, compute depth of the target parent and block if it would exceed the limit.
5. Pass `depth` to DropZoneRow and add a `data-depth-blocked` attribute or CSS class when `depth >= MAX_NESTING_DEPTH` to visually indicate the zone won't accept container drops.
6. Use the existing Toast component (`frontend/src/shared/components/Toast.tsx`) or a tooltip to show the "Maximum nesting depth (5 levels) reached." message.

Do NOT:
- Block dropping non-container tiles at any depth — only containers are depth-limited
- Remove the depth counter from WorkspaceTile — it is still needed for color display
