# Tiling System Rewrite Plan: Scan-Line Compaction with Pre-Gesture Snapshots

**Date:** 2026-04-03  
**Status:** Ready for implementation  
**Research:** `/home/io/io-dev/io/frontend/src/pages/console/OVERLAP_RESEARCH.md`

---

## 1. Problem Statement

The current console pane tiling system uses a two-phase approach:
1. `resolveCollisions()` — called on every drag/resize frame (directional push + shrink)
2. `finalizeLayout()` — called at gesture stop (scan-line placement as safety net)

This fails after 3-4 resizes because:
- `resolveCollisions` is a greedy directional push that commits positions without knowing downstream constraints
- The intermediate mess it creates leaves `finalizeLayout` with corrupted candidate coordinates
- The 10-pass cascade loop in Phase 2 of `resolveCollisions` can oscillate without converging
- The column-aware batch push (`_columnBatchPush`) adds complexity without fixing the fundamental greedy-push problem

---

## 2. Architecture Overview

### Core Insight (from research Option B)

**Do nothing during the gesture. Resolve everything in one pass at gesture stop.**

```
Gesture START  →  Snapshot pre-gesture layout of all OTHER panes
During gesture →  allowOverlap: true; no collision resolution; panes overlap freely
Gesture STOP   →  Run scanLineCompact(movedPane, snapshot, pinnedIds) once
                   Result: zero overlaps, deterministic, single pass
```

### Why This Works

1. The scan-line algorithm processes panes in reading order (y, x), placing each into the first conflict-free slot
2. Each placed pane is added to a "settled" list and never reconsidered
3. The moved pane is treated as a fixed obstacle (like a pinned pane) — it gets its final position from the user's gesture
4. All other panes are placed relative to their PRE-GESTURE positions (not corrupted intermediate positions)
5. Zero overlaps are guaranteed because every pane is checked against ALL settled panes before placement

---

## 3. Files to Modify

### 3.1 `/home/io/io-dev/io/frontend/src/pages/console/layout-utils.ts`

**Delete the following functions entirely:**
- `resolveCollisions()` — the greedy directional push resolver
- `_batchPush()` — batch push helper for resolveCollisions
- `_columnBatchPush()` — column-aware batch push helper
- `_yieldAway()` — yield-to-pinned helper for resolveCollisions
- `_pushBestEffort()` — cascade push helper
- `_capacityAround()` — capacity estimation for size cap
- `_computeMaxMovedSize()` — binary search size cap

**Delete the following export:**
- `export type ResizeAxisHint = "x" | "y"` — no longer needed

**Keep the following functions unchanged:**
- `GRID_SCALE`, `GRID_COLS`, `GRID_ROWS`, `MIN_W`, `MIN_H` — constants
- `defaultSlots()` — preset slot definitions
- `presetToGridItems()` — maps presets to grid items
- `reflowPanesToPreset()` — reflows panes into new template
- `_overlap()` — AABB overlap check (useful for assertions/tests)
- `_clamp()` — boundary clamping
- `_overlapsAnySettled()` — overlap check against settled list
- `_findNearestSlot()` — nearest conflict-free slot search
- `migrateGridItems()` — coordinate migration

**Replace `finalizeLayout()` with `scanLineCompact()`:**

The existing `finalizeLayout` scan-line logic is the right idea but lacks the pre-gesture snapshot parameter. The change is:
1. Rename to `scanLineCompact`
2. Add `movedId: string | null` — the moved pane is treated as a fixed obstacle
3. Add `preGestureLayout: GridItem[] | null` — seeds each movable pane's starting (x, y) for nearest-slot search
4. Remove the old `finalizeLayout` export name

### 3.2 `/home/io/io-dev/io/frontend/src/pages/console/WorkspaceGrid.tsx`

**Changes:**

1. **Remove imports:** `resolveCollisions`, `ResizeAxisHint`, `finalizeLayout`
2. **Add import:** `scanLineCompact`
3. **Add ref:** `preGestureLayoutRef = useRef<GridItem[] | null>(null)` — stores layout snapshot at gesture start
4. **Modify `handleDragStart`:** Snapshot `gridItemsRef.current` into `preGestureLayoutRef`
5. **Modify `handleResizeStart`:** Snapshot `gridItemsRef.current` into `preGestureLayoutRef`
6. **Simplify `handleDrag`:** Replace `resolveCollisions` call with `scanLineCompact` for preview ghosts (or no preview — see section 4.4)
7. **Simplify `handleResize`:** Same replacement
8. **Simplify `handleDragStop`:** Replace `finalizeLayout(resolveCollisions(...))` with single `scanLineCompact(...)` using pre-gesture snapshot
9. **Simplify `handleResizeStop`:** Same. Remove all `axisHint` logic. Keep Shift+corner AR lock (it modifies `finalW`/`finalH` before calling scanLineCompact)
10. **Remove:** `rawGestureLayoutRef` — no longer needed (was used to detect resolveCollisions capping the active pane)
11. **Simplify ghost preview:** Remove active-pane cap ghost (no longer applicable)

### 3.3 `/home/io/io-dev/io/frontend/src/test/consoleGrid.test.ts`

**Changes:**
- Existing tests for `presetToGridItems` and `GRID_SCALE` are unchanged
- Add new test suite for `scanLineCompact` (see section 5.2)

---

## 4. New Functions

### 4.1 `scanLineCompact` signature

```typescript
/**
 * Produce a zero-overlap layout after a single pane has been moved/resized.
 *
 * @param layout           Current layout (moved pane already at gesture-stop position)
 * @param movedId          ID of the pane just moved/resized (treated as fixed obstacle).
 *                         Pass null for pure compaction (e.g. initial layout setup).
 * @param pinnedIds        Set of pinned pane IDs (never moved)
 * @param preGestureLayout Snapshot of all panes' positions BEFORE the gesture started.
 *                         Used as the "original position" for nearest-slot search.
 *                         Pass null to use current positions.
 * @param cols             Grid width (default GRID_COLS = 288)
 * @param rows             Grid height (default GRID_ROWS = 288)
 * @returns                New layout with zero overlaps. Same length and IDs as input.
 *
 * Algorithm:
 *   1. Clone all items. Clamp all to grid bounds.
 *   2. Build fixed set: pinned panes + moved pane.
 *      If moved overlaps a pinned pane, shrink/shift moved to not overlap (pinned wins).
 *   3. Sort remaining (movable) panes by pre-gesture (y, x) reading order.
 *   4. Initialize settled = [...fixed panes].
 *   5. For each movable pane in sorted order:
 *      a. Restore (x, y) to pre-gesture position. Keep current (w, h) clamped to grid.
 *      b. If no overlap with settled: add to settled, continue.
 *      c. findNearestSlot from pre-gesture position.
 *      d. If no slot at current size: shrink to MIN_W x MIN_H, retry findNearestSlot.
 *      e. Emergency fallback: coarse grid scan (MIN_H steps).
 *   6. Return items in original input order.
 *
 * Guarantees:
 *   - Zero overlaps (each pane checked against all settled before placement)
 *   - No pane pushed off-screen (all positions clamped)
 *   - No pane below MIN_W x MIN_H
 *   - Pinned panes never moved
 *   - Moved pane stays at gesture-stop position
 *   - Deterministic (same input → same output)
 *   - Single pass: O(n²) with n ≤ 16 ≈ 256 operations
 */
export function scanLineCompact(
  layout: GridItem[],
  movedId: string | null,
  pinnedIds: Set<string>,
  preGestureLayout: GridItem[] | null,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
): GridItem[]
```

### 4.2 Updated `handleDragStart` / `handleResizeStart`

```typescript
const preGestureLayoutRef = useRef<GridItem[] | null>(null);

const handleDragStart = useCallback(() => {
  isDraggingRef.current = true;
  preGestureLayoutRef.current = gridItemsRef.current.map((it) => ({ ...it }));
}, []);

const handleResizeStart = useCallback(
  (_layout, _oldItem, newItem) => {
    isResizingRef.current = true;
    preGestureLayoutRef.current = gridItemsRef.current.map((it) => ({ ...it }));
    if (newItem) {
      resizeStartRef.current = {
        i: newItem.i,
        x: newItem.x,
        y: newItem.y,
        w: newItem.w,
        h: newItem.h,
      };
    }
  },
  [],
);
```

### 4.3 Updated `handleDragStop` / `handleResizeStop`

```typescript
const handleDragStop = useCallback(
  (_layout, _oldItem, newItem) => {
    requestAnimationFrame(() => {
      isDraggingRef.current = false;
    });
    setPreviewLayout(null);
    gestureIdRef.current = null;
    const preGesture = preGestureLayoutRef.current;
    preGestureLayoutRef.current = null;

    if (locked || !onGridLayoutChange || !newItem) return;

    const withNewPos = gridItemsRef.current.map(
      (item): GridItem =>
        item.i === newItem.i
          ? { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
          : item,
    );

    onGridLayoutChange(
      scanLineCompact(
        withNewPos,
        newItem.i,
        pinnedIds,
        preGesture,
        GRID_COLS,
        GRID_ROWS,
      ),
    );
  },
  [locked, pinnedIds, onGridLayoutChange],
);
```

### 4.4 Simplified `handleDrag` / `handleResize` (preview)

**Option A — Live ghost preview (recommended):**

During the gesture, run `scanLineCompact` to compute where panes WILL end up and show ghost outlines. This gives visual feedback without affecting the real layout.

```typescript
const handleDrag = useCallback(
  (_layout, _old, newItem) => {
    if (!newItem) return;
    gestureIdRef.current = newItem.i;
    const withNewPos = gridItemsRef.current.map((item): GridItem =>
      item.i === newItem.i
        ? { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
        : item,
    );
    setPreviewLayout(
      scanLineCompact(
        withNewPos,
        newItem.i,
        pinnedIds,
        preGestureLayoutRef.current,
        GRID_COLS,
        GRID_ROWS,
      ),
    );
  },
  [pinnedIds],
);
```

**Option B — No preview:** Remove `previewLayout` state and ghost rendering entirely. Simpler but less visual feedback.

---

## 5. Test Updates

### 5.1 Existing Tests (no changes needed)

`consoleGrid.test.ts` only tests `presetToGridItems` and `GRID_SCALE`. Both functions are unchanged.

### 5.2 New Unit Tests for `scanLineCompact`

```typescript
import { scanLineCompact, GRID_COLS, GRID_ROWS, MIN_W, MIN_H } from "../pages/console/layout-utils";
import type { GridItem } from "../pages/console/types";

function gi(i: string, x: number, y: number, w: number, h: number): GridItem {
  return { i, x, y, w, h };
}

function hasOverlap(layout: GridItem[]): boolean {
  for (let a = 0; a < layout.length; a++) {
    for (let b = a + 1; b < layout.length; b++) {
      const dw =
        Math.min(layout[a].x + layout[a].w, layout[b].x + layout[b].w) -
        Math.max(layout[a].x, layout[b].x);
      const dh =
        Math.min(layout[a].y + layout[a].h, layout[b].y + layout[b].h) -
        Math.max(layout[a].y, layout[b].y);
      if (dw > 0 && dh > 0) return true;
    }
  }
  return false;
}

function allInBounds(layout: GridItem[]): boolean {
  return layout.every(
    (it) =>
      it.x >= 0 &&
      it.y >= 0 &&
      it.x + it.w <= GRID_COLS &&
      it.y + it.h <= GRID_ROWS &&
      it.w >= MIN_W &&
      it.h >= MIN_H,
  );
}

describe("scanLineCompact", () => {
  it("unchanged layout when no overlaps exist", () => { ... });
  it("2x2 drag: dragging top-left over top-right → zero overlaps", () => { ... });
  it("4x4 resize east to grid edge → zero overlaps, 16 panes", () => { ... });
  it("4x4 resize south to grid edge → zero overlaps, 16 panes", () => { ... });
  it("4x4 SE corner resize to 75% coverage → zero overlaps", () => { ... });
  it("pinned pane is never moved", () => { ... });
  it("moved pane stays at gesture-stop position", () => { ... });
  it("all panes remain in bounds after compact", () => { ... });
  it("no pane shrinks below MIN_W x MIN_H", () => { ... });
  it("deterministic: same input always produces same output", () => { ... });
  it("handles 16 panes in 4x4 grid (maximum density)", () => { ... });
  it("pre-gesture positions used for slot search, not intermediate positions", () => { ... });
  it("touching panes (shared edge, zero gap) do not count as overlapping", () => { ... });
  it("movedId=null runs pure compaction", () => { ... });
  it("multiple pinned panes act as fixed obstacles", () => { ... });
});
```

---

## 6. Implementation Sequence

### Step 1: Write `scanLineCompact` in `layout-utils.ts`
Add alongside existing code. Do NOT delete old functions yet.  
**Verify:** New unit tests all pass.

### Step 2: Wire into `WorkspaceGrid.tsx`
Add `preGestureLayoutRef`, update start/stop/preview handlers, remove `axisHint`, remove cap ghost.  
**Verify:** Manual browser test — 2x2 drag, 4x4 resize, no overlaps.

### Step 3: Delete old functions from `layout-utils.ts`
Remove `resolveCollisions`, `_batchPush`, `_columnBatchPush`, `_yieldAway`, `_pushBestEffort`, `_capacityAround`, `_computeMaxMovedSize`, `finalizeLayout`, `ResizeAxisHint`.  
**Verify:** `tsc --noEmit` clean. All unit tests pass. Zero grep matches for deleted names.

### Step 4: Playwright UAT
Run Sonnet+Playwright on the 8 verification scenarios from section 8.

---

## 7. Edge Cases

| # | Edge Case | Expected Behavior |
|---|-----------|-------------------|
| 1 | Moved pane overlaps a pinned pane | Before adding moved to settled, shrink/shift moved to not overlap pinned panes. Pinned always wins. |
| 2 | Pane resized to 288×288 (full grid) | Other panes shrink to MIN_W×MIN_H. If no gap, emergency fallback places them at (0,0) — degenerate state, prevented in practice by RGL min constraints. |
| 3 | 16 panes at maximum density (4×4 at 72×72) | Any resize forces displaced panes to MIN size slots. scanLineCompact handles this cleanly. |
| 4 | Rapid consecutive gestures | `preGestureLayoutRef` is snapshotted from `gridItemsRef.current` at gesture START. Each gesture starts from the previous gesture's resolved state. No race condition. |
| 5 | Corner resize (both axes change) | No axis hint needed. Moved pane is placed at final (x, y, w, h). All others resolved relative to it. |
| 6 | Shift+corner aspect ratio lock | AR calculation happens in `handleResizeStop` BEFORE calling `scanLineCompact`. Computed `finalW`/`finalH` are the moved pane's dimensions passed to compact. |
| 7 | Panel completely surrounded by moved pane | Surrounded pane is displaced to nearest conflict-free slot. `_findNearestSlot` checks edges of settled items for candidate positions. |
| 8 | All space consumed by pinned panes | Non-pinned panes use emergency fallback at (0,0). Degenerate state — UI should prevent pinning all available space. |
| 9 | Moved pane dragged partially off-screen | `_clamp` applied to moved pane before placement. Shifted/shrunk to fit within grid bounds. |
| 10 | Template switch (preset change) | Handled by `reflowPanesToPreset` independently. Preset slots are non-overlapping by construction. |
| 11 | Workspace locked | All handlers early-return when `locked=true`. No change needed. |
| 12 | `preGestureLayout` is null (first render) | Fall back to using current positions as "pre-gesture" positions. This is safe — `_findNearestSlot` still finds valid slots. |

---

## 8. Verification Scenarios (Playwright UAT)

### Scenario 1: Basic 2×2 Drag
1. Create workspace with 2×2 layout (4 panes)
2. Drag pane 0 (top-left) to the right, overlapping pane 1 (top-right)
3. Release mouse
4. **Assert:** Zero overlaps. All 4 panes visible. All within grid bounds.

### Scenario 2: 4×4 East Resize
1. Create workspace with 4×4 layout (16 panes)
2. Resize pane 0 by dragging east handle to right edge of grid
3. Release
4. **Assert:** Zero overlaps. All 16 panes visible. Pane 0 right edge near x=288.

### Scenario 3: 4×4 South Resize
1. Create workspace with 4×4 layout
2. Resize pane 0 by dragging south handle to bottom of grid
3. Release
4. **Assert:** Zero overlaps. All 16 panes visible. Pane 0 bottom edge near y=288.

### Scenario 4: 4×4 SE Corner Resize (75% coverage)
1. Create workspace with 4×4 layout
2. Resize pane 0 SE corner to 216×216
3. Release
4. **Assert:** Zero overlaps. Remaining 15 panes packed into L-shaped area. All within bounds.

### Scenario 5: Pinned Pane Protection
1. Create workspace with 2×2 layout
2. Pin pane 1 (top-right)
3. Drag pane 0 to overlap pane 1's position
4. Release
5. **Assert:** Pane 1 has NOT moved. Zero overlaps. Pane 0 displaced around pane 1.

### Scenario 6: Sequential Resize Stability (CRITICAL)
1. Create workspace with 3×3 layout (9 panes)
2. Resize pane 0 east → release → **assert zero overlaps**
3. Resize pane 0 south → release → **assert zero overlaps**
4. Resize pane 0 east again → release → **assert zero overlaps**
5. Shrink pane 0 east back → release → **assert zero overlaps**
6. Shrink pane 0 south back → release → **assert zero overlaps**
7. **Assert:** Zero overlaps after EVERY gesture. This is the critical regression test.

### Scenario 7: Drag to Bottom-Right Corner
1. Create workspace with 2×2 layout
2. Drag pane 0 to bottom-right area (overlapping pane 3)
3. Release
4. **Assert:** Zero overlaps. No pane off-screen.

### Scenario 8: 16-Pane Stress Test
1. Create workspace with 4×4 layout (16 panes, each 72×72)
2. Resize pane 0 east to x=216 (triple width)
3. Release
4. **Assert:** Zero overlaps. All 16 panes visible. Min size respected.

### Pass/Fail Criteria

For each scenario, verify:
1. **Zero overlaps:** For every pair (i, j): `AABB_overlap(i, j) === false`
2. **All in bounds:** Every pane has `x >= 0, y >= 0, x+w <= gridW, y+h <= gridH`
3. **Min size:** Every pane has `w >= MIN_W_px, h >= MIN_H_px` (pixel equivalents)
4. **Pinned immovable:** Any pane in pinnedIds has identical bounding rect before and after
5. **Pane count preserved:** Same number of panes before and after

### How to Measure in Playwright

Query `[data-grid-item-id]` or `[data-pane-id]` elements. Use `getBoundingClientRect()` relative to the grid container to get pixel positions. Convert to grid units using `colWidth = containerWidth / GRID_COLS` and `rowHeight = containerHeight / GRID_ROWS`. Run overlap/bounds checks in `page.evaluate()`.

---

## 9. Two-Agent Workflow

1. **Opus** implements Steps 1–4 from section 6
2. **Sonnet** runs Playwright UAT (section 8) after Opus signals completion
3. If Sonnet finds failures, Opus fixes and Sonnet re-tests

---

## Kickoff Prompt

Paste this prompt verbatim in a fresh context to start the implementation:

---

```
Read these two files completely before starting any work:

  Plan:     /home/io/io-dev/io/frontend/src/pages/console/TILING_REWRITE_PLAN.md
  Research: /home/io/io-dev/io/frontend/src/pages/console/OVERLAP_RESEARCH.md

Then read the current implementation:

  /home/io/io-dev/io/frontend/src/pages/console/layout-utils.ts
  /home/io/io-dev/io/frontend/src/pages/console/WorkspaceGrid.tsx
  /home/io/io-dev/io/frontend/src/pages/console/types.ts
  /home/io/io-dev/io/frontend/src/test/consoleGrid.test.ts

---

## Your task

Fully reimplement the console pane tiling system so that panes can be freely dragged and
resized without any overlaps. The previous implementation (`resolveCollisions` +
`finalizeLayout`) has been abandoned — it is a greedy directional push that fails after 3-4
resizes. Replace it with `scanLineCompact` using pre-gesture snapshots.

---

## Step 1 — Write `scanLineCompact` in layout-utils.ts

Add this new exported function (do NOT delete old functions yet):

```typescript
export function scanLineCompact(
  layout: GridItem[],
  movedId: string | null,
  pinnedIds: Set<string>,
  preGestureLayout: GridItem[] | null,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
): GridItem[]
```

Algorithm (must follow this exactly):

1. Deep-clone all items. Build a Map of pre-gesture positions:
   `preMap[id] = { x, y, w, h }` from `preGestureLayout` (fall back to current layout if null).

2. Clamp all items to grid bounds using `_clamp`.

3. Partition into:
   - `fixed` = pinned panes + moved pane (all go into settled immediately)
   - `movable` = everything else

4. Before adding the moved pane to settled:
   For each pinned pane already in settled, if moved overlaps it, shrink/shift moved away
   (pinned always wins). Use center-based direction: if moved's center is left of pinned's
   center, shrink moved's right edge; if right, move moved's x to pinned's right edge; etc.

5. Sort `movable` by pre-gesture reading order: `preMap[id].y` ASC, then `preMap[id].x` ASC.

6. Initialize `settled = [...pinnedPanes, movedPane]` (clamped).

7. For each pane in `movable`:
   a. Set `pane.x = preMap[pane.id].x`, `pane.y = preMap[pane.id].y`.
      Keep `pane.w` and `pane.h` from the current layout (clamped to MIN and grid bounds).
   b. If `_overlapsAnySettled(pane.x, pane.y, pane.w, pane.h, settled)` is false:
      add to settled, continue.
   c. Call `_findNearestSlot(pane.x, pane.y, pane.w, pane.h, settled, cols, rows)`.
      If a slot is found: set pane.(x,y) to the slot, add to settled, continue.
   d. Shrink `pane.w = MIN_W`, `pane.h = MIN_H`. Retry `_findNearestSlot`.
      If found: set pane.(x,y), add to settled, continue.
   e. Emergency fallback: scan `ty` from 0 to `rows - MIN_H` in steps of `MIN_H`,
      inner loop `tx` from 0 to `cols - MIN_W` in steps of `MIN_W`. Place pane at
      first `(tx, ty)` where `_overlapsAnySettled` is false. If nothing found (should
      not happen), place at `(0, 0)`. Add to settled.

8. Return items in their ORIGINAL input order (not the settled order).
   The `items` array was cloned and mutated in place — return it.

Reuse these existing private helpers (already correct in the file):
- `_overlapsAnySettled(x, y, w, h, settled)` — already implemented
- `_findNearestSlot(origX, origY, w, h, settled, cols, rows)` — already implemented
- `_clamp(item, cols, rows)` — already implemented
- `_overlap(a, b)` — already implemented

---

## Step 2 — Wire into WorkspaceGrid.tsx

Replace all gesture handling to use `scanLineCompact`. Exact changes:

1. Add `import { scanLineCompact } from "./layout-utils"` (remove old imports:
   `resolveCollisions`, `finalizeLayout`, `ResizeAxisHint`).

2. Add ref at component top level:
   `const preGestureLayoutRef = useRef<GridItem[] | null>(null);`

3. `handleDragStart`: add `preGestureLayoutRef.current = gridItemsRef.current.map(it => ({ ...it }));`

4. `handleResizeStart`: add the same snapshot line.

5. `handleDragStop`: replace the `finalizeLayout(resolveCollisions(...))` block with:
   ```typescript
   const preGesture = preGestureLayoutRef.current;
   preGestureLayoutRef.current = null;
   const withNewPos = gridItemsRef.current.map((item): GridItem =>
     item.i === newItem.i
       ? { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
       : item,
   );
   onGridLayoutChange(
     scanLineCompact(withNewPos, newItem.i, pinnedIds, preGesture, GRID_COLS, GRID_ROWS),
   );
   ```

6. `handleResizeStop`: same replacement. Keep the Shift+corner aspect-ratio lock code
   that computes `finalW`/`finalH` — just replace the final `onGridLayoutChange(...)` call.
   Remove ALL `axisHint` logic (it is no longer used).

7. `handleDrag` / `handleResize`: for preview ghost outlines, replace `resolveCollisions`
   with `scanLineCompact(withNewPos, newItem.i, pinnedIds, preGestureLayoutRef.current, ...)`.
   This shows where panes will land before mouse-up.

8. Remove `rawGestureLayoutRef` and the "active-pane cap ghost" rendering block.

9. Remove any remaining `axisHint` references.

---

## Step 3 — Delete old code from layout-utils.ts

After WorkspaceGrid.tsx is wired and working, delete:
- `resolveCollisions` function and its JSDoc/type export (`ResizeAxisHint`)
- `_batchPush`
- `_columnBatchPush`
- `_yieldAway`
- `_pushBestEffort`
- `_capacityAround`
- `_computeMaxMovedSize`
- `finalizeLayout`

Verify with grep:
```
grep -r "resolveCollisions\|finalizeLayout\|ResizeAxisHint\|_batchPush\|_columnBatchPush\|_yieldAway\|_pushBestEffort\|_capacityAround\|_computeMaxMovedSize" \
  /home/io/io-dev/io/frontend/src/pages/console/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "OVERLAP_RESEARCH\|TILING_REWRITE"
```
Must return zero results.

---

## Step 4 — Add unit tests

Add to `/home/io/io-dev/io/frontend/src/test/consoleGrid.test.ts`:

Import `scanLineCompact`, `MIN_W`, `MIN_H` from layout-utils.

Write a `describe("scanLineCompact", ...)` block with these tests:
- Returns unchanged layout when no overlaps exist
- 2×2 drag: dragging top-left over top-right → zero overlaps in result
- 4×4 resize east to grid edge → zero overlaps, all 16 panes present
- 4×4 resize south to grid edge → zero overlaps, all 16 panes present
- Pinned pane never moves
- Moved pane stays at exact gesture-stop position
- All panes remain within grid bounds (x≥0, y≥0, x+w≤GRID_COLS, y+h≤GRID_ROWS)
- No pane shrinks below MIN_W × MIN_H
- Deterministic: calling twice with same input gives identical output
- 16-pane 4×4 grid with one pane at triple width → zero overlaps
- Pre-gesture positions are used (not current positions) for slot search
- Touching panes (shared edge, dw=0 or dh=0) are NOT counted as overlapping
- movedId=null runs pure compaction with no fixed moved pane
- Multiple pinned panes act as independent fixed obstacles

---

## Step 5 — Verify

Run these commands. ALL must succeed:

```bash
cd /home/io/io-dev/io/frontend

# TypeScript
pnpm tsc --noEmit

# All unit tests
pnpm test

# No references to deleted functions
grep -r "resolveCollisions\|finalizeLayout\|ResizeAxisHint" src/pages/console/ \
  --include="*.ts" --include="*.tsx" | grep -v "OVERLAP_RESEARCH\|TILING_REWRITE"
```

---

## Step 6 — Playwright UAT (run after Steps 1-5 pass)

Launch a Sonnet agent with the uat-agent subagent_type to run these 8 scenarios.
The app runs at http://localhost:5173. Admin credentials: admin / changeme.

For each scenario, navigate to Console, create a workspace with the specified layout,
perform the gesture, then verify the pass criteria using DOM measurements.

**Scenario 1 — 2×2 basic drag:**
Layout: 2×2. Drag pane 0 (top-left) rightward onto pane 1 (top-right). Release.
Assert: zero overlaps, all 4 panes in bounds, pane count = 4.

**Scenario 2 — 4×4 east resize:**
Layout: 4×4. Resize pane 0 east handle to right edge. Release.
Assert: zero overlaps, all 16 panes in bounds.

**Scenario 3 — 4×4 south resize:**
Layout: 4×4. Resize pane 0 south handle to bottom edge. Release.
Assert: zero overlaps, all 16 panes in bounds.

**Scenario 4 — 4×4 SE corner 75% coverage:**
Layout: 4×4. Drag pane 0 SE resize handle to 75% of grid width and height. Release.
Assert: zero overlaps, all 16 panes in bounds.

**Scenario 5 — Pinned pane protection:**
Layout: 2×2. Pin pane 1 (top-right). Drag pane 0 onto pane 1's position. Release.
Assert: pane 1 bounding rect unchanged, zero overlaps.

**Scenario 6 — Sequential stability (CRITICAL):**
Layout: 3×3. Perform in order, asserting zero overlaps after EACH release:
  - Resize pane 0 east (wider)
  - Resize pane 0 south (taller)
  - Resize pane 0 east again
  - Shrink pane 0 east back
  - Shrink pane 0 south back
Assert: zero overlaps after every single gesture.

**Scenario 7 — Drag to bottom-right:**
Layout: 2×2. Drag pane 0 to bottom-right area. Release.
Assert: zero overlaps, no pane off-screen.

**Scenario 8 — 16-pane stress:**
Layout: 4×4. Resize pane 0 east to ~3× original width. Release.
Assert: zero overlaps, all 16 panes visible.

**How to measure overlaps in Playwright:**
```javascript
const overlaps = await page.evaluate(() => {
  const grid = document.querySelector('.react-grid-layout');
  const gridRect = grid.getBoundingClientRect();
  const panes = [...grid.querySelectorAll('.react-grid-item')].map(el => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left - gridRect.left,
      y: r.top - gridRect.top,
      w: r.width,
      h: r.height,
    };
  });
  const pairs = [];
  for (let i = 0; i < panes.length; i++) {
    for (let j = i + 1; j < panes.length; j++) {
      const a = panes[i], b = panes[j];
      const dw = Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x);
      const dh = Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y);
      if (dw > 1 && dh > 1) pairs.push([i, j, dw, dh]); // >1px tolerance for borders
    }
  }
  return pairs;
});
expect(overlaps).toHaveLength(0);
```

Pass criteria for EVERY scenario:
- `overlaps.length === 0`
- Every pane has `x >= 0, y >= 0, x+w <= gridRect.width, y+h <= gridRect.height`
- Every pane has `w >= 1, h >= 1` (non-zero size)
- Pane count is unchanged
```
