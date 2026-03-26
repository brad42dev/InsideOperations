---
id: MOD-CONSOLE-036
unit: MOD-CONSOLE
title: Pane resize broken in edit mode — no onResizeStop handler, no neighbor adjustment
status: pending
priority: major
depends-on: []
source: bug
bug_report: "Workspace panes are not resizable; resizing should resize neighbors to maintain grid coherence"
---

## What's Broken

Two distinct failures that together make pane resize completely non-functional:

**1. No `onResizeStop` handler wired up**

`frontend/src/pages/console/WorkspaceGrid.tsx` renders `<GridLayout>` with `onDragStop={handleDragStop}` and `onLayoutChange={handleLayoutChange}` but has **no `onResizeStop` prop**. When a user drags a resize handle in edit mode, the library fires `onResizeStop` — but since no handler exists, the new pane size is never committed with neighbor adjustments. The `handleLayoutChange` fires too, but it passes the raw layout (with overlap or gaps) and has no logic to fix neighbors.

**2. No neighbor auto-resize algorithm**

The spec requires that resizing one pane auto-adjusts its neighbors so the grid stays gap-free and overlap-free. No such logic exists anywhere in `WorkspaceGrid.tsx`. The compactor is `noCompactor` (intentional — fixed positions), so react-grid-layout itself will not adjust neighbors. This must be done in the `onResizeStop` callback.

The editMode gate (`resizeConfig={{ enabled: editMode }}`) is correct — resize handles should only appear in edit mode.

## Expected Behavior

Per spec §5.7 (console-implementation-spec.md line 604–616):

> Every pane border is a resize handle. Resizing one pane auto-resizes its neighbors to maintain grid coherence.
> - Drag a shared border between two panes: both panes resize symmetrically (one grows, the other shrinks)
> - Minimum pane size: 2 grid columns × 1 grid row
> - On resize end: final layout captured in undo history, content re-renders at new size

## Root Cause

Code exists but is incomplete:
- `WorkspaceGrid.tsx` line 437–440: `resizeConfig` with handles defined, but `onResizeStop` never wired
- `WorkspaceGrid.tsx` line 444: only `onLayoutChange` and `onDragStop` are passed; `onResizeStop` is absent
- No neighbor adjustment function exists anywhere in the console module

## Acceptance Criteria

- [ ] In edit mode, dragging any resize handle on a pane produces immediate visual feedback (handle is grabbable, pane grows/shrinks in real time)
- [ ] On resize stop, neighboring panes that share the dragged border are adjusted to fill the space — no gaps, no overlaps
- [ ] Neighbor priority when space is contested: reading order (row-major: sort by `y` ascending, then `x` ascending — lower index wins, higher index yields)
- [ ] Resized pane and affected neighbors are clamped to `minW=2, minH=2` — no pane can be shrunk below minimum
- [ ] If a neighbor cannot fully yield space (would go below min), it yields as much as it can; the resize of the source pane is clamped accordingly
- [ ] Resize only works in edit mode (existing `resizeConfig.enabled = editMode` must remain)
- [ ] After resize stop, `onGridLayoutChange` is called with the adjusted layout (neighbor positions updated) — this triggers the auto-save pipeline
- [ ] No regression: drag-swap behavior (`handleDragStop`) still works correctly after this change

## Verification

1. Open Console, select or create a workspace with 2+ panes (e.g., 2x1 layout)
2. Enter edit mode (pencil/edit button in toolbar)
3. Hover over the shared border between two panes — resize cursor should appear
4. Drag the border — both panes resize symmetrically
5. Release — no gap or overlap between panes; layout saves (dirty indicator appears)
6. Test with 3×3 (9 panes), resize pane 1 (top-left) to the right — pane 2 (top-middle) shrinks. Pane 4 (middle-left) is unaffected.
7. Try to shrink a pane below 2 columns — it should stop at minimum
8. No browser console errors during or after resize

## Neighbor Adjustment Algorithm

The `onResizeStop` handler receives `(layout, oldItem, newItem)`:
- `oldItem` = pane dimensions before resize
- `newItem` = pane dimensions after resize (what the user dragged to)

**Right edge moved** (newItem.w > oldItem.w or newItem.x < oldItem.x expanding right):
- Find all panes whose `x` equals `oldItem.x + oldItem.w` (previously right-adjacent)
- Shift/shrink them by the delta, sorted by reading order (y asc, x asc)

**Bottom edge moved** (newItem.h > oldItem.h or newItem.y < oldItem.y expanding down):
- Find all panes whose `y` equals `oldItem.y + oldItem.h` (previously below)
- Shift/shrink them by the delta, sorted by reading order

**Left/top edge moved** (newItem.x > oldItem.x or newItem.y > oldItem.y shrinking from left/top):
- Find panes sharing the left or top border; adjust symmetrically

After computing adjustments, clamp all affected panes to minW/minH. If a pane would be clamped, also clamp the source pane's resize so total grid space adds up correctly.

Call `onGridLayoutChange(adjustedLayout)` at the end.

## Spec Reference

`/home/io/spec_docs/console-implementation-spec.md`
- §4.1 line 400: "`onResizeStop`: neighbor auto-resize and undo capture"
- §5.7 lines 604–616: Full pane resize behavior spec

## Do NOT

- Stub the neighbor algorithm — that is the entire point of this task
- Remove the `editMode` gate on `resizeConfig.enabled`
- Use `verticalCompactor` or `horizontalCompactor` from react-grid-layout — they compact the whole grid; we need targeted border-sharing adjustment only
- Mutate `oldItem` or `newItem` directly — build a new layout array
