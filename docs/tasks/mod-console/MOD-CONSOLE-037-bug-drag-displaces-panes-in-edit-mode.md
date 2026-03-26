---
id: MOD-CONSOLE-037
unit: MOD-CONSOLE
title: Drag in workspace edit mode displaces and hides non-dragged panes
status: pending
priority: major
depends-on: []
source: bug
bug_report: "Dragging a pane in edit mode displaces other panes off-screen instead of only moving the dragged pane"
---

## What's Broken

In `WorkspaceGrid.tsx`, `handleDragStop` (lines 242–288) has two branches:

1. **Swap branch** (overlap > 50%): correctly exchanges the dragged pane with the
   target pane's grid coordinates — works.
2. **No-swap branch** (lines 266–269): emits the full `layout` array returned by
   react-grid-layout's `onDragStop` callback — **broken**.

RGL's built-in collision handling pushes non-dragged panes to new positions during
the drag to resolve overlaps. When `noCompactor` is active (fixed positions), those
displaced coordinates are baked into the `layout` snapshot at drag stop. The code
then commits this entire displaced layout via `onGridLayoutChange`, permanently
moving panes that the user never touched.

With `maxRows: Infinity` (line 429) and `dragConfig.bounded: false` (line 434),
displaced panes can land at grid rows beyond 12, taking them below the visible
container. They are not removed — they just become unreachable.

**Files:**
- `frontend/src/pages/console/WorkspaceGrid.tsx` — `handleDragStop` (lines 242–288)

## Expected Behavior

Per spec §5.5 (console-implementation-spec.md line 579):

> "If no overlap: pane stays at final position (standard move)"

"Standard move" means **only the dragged pane changes position**. All other panes
must retain their pre-drag grid coordinates. The `layout` array from RGL's drag
callback must never be used as-is for the non-swap path — it contains RGL's internal
collision displacements.

Per spec §5.6 (line 592):

> "Dragging a pane outside the workspace boundary removes it from the grid.
> Detection: `onDragStop` checks if final position is outside grid bounds."

Currently no out-of-bounds detection exists. A pane dropped outside the 12-col ×
12-row grid should be **removed**, not silently placed at an unreachable coordinate.

## Root Cause

The no-swap branch (line 266–269) passes the full RGL-computed layout to
`onGridLayoutChange` instead of only applying the dragged pane's new position:

```ts
// Current (BROKEN): uses RGL layout which contains displaced non-dragged panes
if (!swapCandidate) {
  onGridLayoutChange(layout.map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h })))
  return
}
```

The fix must reconstruct the layout using the **pre-drag positions** for all panes
except the dragged one, which gets `newItem`'s coordinates.

## Acceptance Criteria

- [ ] Dragging a pane and dropping it on empty grid space: only the dragged pane
      moves; all other panes remain at their exact pre-drag positions
- [ ] Dragging a pane and dropping it with >50% overlap on another pane: swap
      behavior unchanged (both panes exchange grid coordinates)
- [ ] Dragging a pane outside the 12×12 grid boundary (final `x+w > 12`,
      `y+h > 12`, `x < 0`, or `y < 0` per `newItem`): the pane is removed from the
      workspace (same effect as Delete-key removal); remaining panes are unaffected
- [ ] No pane ever ends up at an unreachable off-screen coordinate after any drag
      operation
- [ ] `onGridLayoutChange` is called exactly once per drag stop with the corrected
      layout
- [ ] Undo/redo: drag-move produces one history entry restoring to pre-drag positions

## Verification

1. Open Console, select a workspace with a 2×1 layout (two side-by-side panes)
2. Enter edit mode
3. Drag the left pane slightly to the right without crossing 50% into the right pane
4. Release — left pane lands at new position, right pane stays exactly where it was
5. Open Console with a 3×3 layout; drag center pane 10px to the right (no 50%
   overlap with any pane); confirm all 8 surrounding panes are unmoved
6. Drag any pane entirely off-screen to the right — pane is removed, remaining
   panes are undisturbed; undo restores it
7. No browser console errors during or after any drag

## Fix Approach

In `handleDragStop`, the no-swap branch should be rewritten to:

```ts
// Correct: preserve pre-drag positions for non-dragged panes
// `_oldItem` has the pre-drag position of the dragged pane
// `newItem` has the post-drag position of the dragged pane
if (!swapCandidate) {
  // Out-of-bounds check: remove the pane if dragged outside the grid
  if (newItem.x + newItem.w > GRID_COLS || newItem.x < 0 ||
      newItem.y + newItem.h > GRID_ROWS || newItem.y < 0) {
    // Trigger pane removal (same as Delete-key path)
    onRemovePane(newItem.i)
    return
  }
  // Only update the dragged pane; keep all others at pre-drag coords
  const updated = gridItems.map((item): GridItem => {
    if (item.i === newItem.i) {
      return { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
    }
    return item  // pre-drag position from workspace state, not from RGL layout
  })
  onGridLayoutChange(updated)
  return
}
```

Note: `gridItems` (from workspace state) holds pre-drag positions. Do not use the
`layout` parameter for non-dragged panes.

## Spec Reference

- `/home/io/spec_docs/console-implementation-spec.md`
  - §5.5 lines 568–580: Pane swapping — "If no overlap: pane stays at final position"
  - §5.6 lines 586–596: Drag-outside removal with grid bounds detection

## Do NOT

- Use the `layout` array from RGL's `onDragStop` for non-dragged panes — that's the
  bug
- Set `bounded: true` as a workaround — it prevents drag-outside removal (§5.6)
- Add vertical compaction (`compactType: 'vertical'`) — the spec explicitly sets
  `compactType: null` (line 386); noCompactor must remain for fixed-position grid
- Break the existing swap behavior (overlap > 50% path)
- Conflict with MOD-CONSOLE-036 (resize/neighbor-adjust) — these are independent
  fixes to different callbacks (`onDragStop` vs `onResizeStop`)
