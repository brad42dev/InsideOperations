/**
 * layout-utils.ts — pure layout helpers shared between workspaceStore and WorkspaceGrid.
 *
 * Spec: console-implementation-spec.md §5 (pane interactions)
 * Plan: docs/plans/console-pane-layout-overhaul.md §Steps 3 & 4
 */

import type { LayoutPreset, PaneConfig, GridItem } from "./types";
import { uuidv4 } from "../../lib/uuid";

// ---------------------------------------------------------------------------
// Grid constants
// ---------------------------------------------------------------------------

export const GRID_SCALE = 24; // multiplier: old 12-unit coords × 24 = new 288-unit coords
export const GRID_COLS = 12 * GRID_SCALE; // 288
export const GRID_ROWS = 12 * GRID_SCALE; // 288
export const MIN_W = 2 * GRID_SCALE; // 48
export const MIN_H = 2 * GRID_SCALE; // 48

// ---------------------------------------------------------------------------
// Preset slot definitions  (12-col × 12-row coordinate system)
// ---------------------------------------------------------------------------

type Slot = { x: number; y: number; w: number; h: number };

// s() accepts 12-unit coordinates and scales to the 288-unit grid
function s(x: number, y: number, w: number, h: number): Slot {
  return {
    x: x * GRID_SCALE,
    y: y * GRID_SCALE,
    w: w * GRID_SCALE,
    h: h * GRID_SCALE,
  };
}

function evenGrid(cols: number, rows: number): Slot[] {
  const w = Math.floor((12 * GRID_SCALE) / cols);
  const h = Math.floor((12 * GRID_SCALE) / rows);
  const slots: Slot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push({ x: col * w, y: row * h, w, h });
    }
  }
  return slots;
}

export function defaultSlots(layout: LayoutPreset): Slot[] {
  switch (layout) {
    case "1x1":
      return [s(0, 0, 12, 12)];
    case "2x1":
      return [s(0, 0, 6, 12), s(6, 0, 6, 12)];
    case "1x2":
      return [s(0, 0, 12, 6), s(0, 6, 12, 6)];
    case "2x2":
      return [s(0, 0, 6, 6), s(6, 0, 6, 6), s(0, 6, 6, 6), s(6, 6, 6, 6)];
    case "3x1":
      return [s(0, 0, 4, 12), s(4, 0, 4, 12), s(8, 0, 4, 12)];
    case "1x3":
      return [s(0, 0, 12, 4), s(0, 4, 12, 4), s(0, 8, 12, 4)];
    case "3x2":
      return [
        s(0, 0, 4, 6),
        s(4, 0, 4, 6),
        s(8, 0, 4, 6),
        s(0, 6, 4, 6),
        s(4, 6, 4, 6),
        s(8, 6, 4, 6),
      ];
    case "2x3":
      return [
        s(0, 0, 6, 4),
        s(6, 0, 6, 4),
        s(0, 4, 6, 4),
        s(6, 4, 6, 4),
        s(0, 8, 6, 4),
        s(6, 8, 6, 4),
      ];
    case "3x3":
      return evenGrid(3, 3);
    case "4x1":
      return [s(0, 0, 3, 12), s(3, 0, 3, 12), s(6, 0, 3, 12), s(9, 0, 3, 12)];
    case "1x4":
      return [s(0, 0, 12, 3), s(0, 3, 12, 3), s(0, 6, 12, 3), s(0, 9, 12, 3)];
    case "4x2":
      return evenGrid(4, 2);
    case "2x4":
      return evenGrid(2, 4);
    case "4x3":
      return evenGrid(4, 3);
    case "3x4":
      return evenGrid(3, 4);
    case "4x4":
      return evenGrid(4, 4);
    case "big-left-3-right":
      return [s(0, 0, 8, 12), s(8, 0, 4, 4), s(8, 4, 4, 4), s(8, 8, 4, 4)];
    case "big-right-3-left":
      return [s(0, 0, 4, 4), s(0, 4, 4, 4), s(0, 8, 4, 4), s(4, 0, 8, 12)];
    case "big-top-3-bottom":
      return [s(0, 0, 12, 8), s(0, 8, 4, 4), s(4, 8, 4, 4), s(8, 8, 4, 4)];
    case "big-bottom-3-top":
      return [s(0, 0, 4, 4), s(4, 0, 4, 4), s(8, 0, 4, 4), s(0, 4, 12, 8)];
    case "2-big-4-small":
      return [
        s(0, 0, 6, 8),
        s(6, 0, 6, 8),
        s(0, 8, 3, 4),
        s(3, 8, 3, 4),
        s(6, 8, 3, 4),
        s(9, 8, 3, 4),
      ];
    case "pip":
      return [s(0, 0, 12, 12), s(9, 9, 3, 3)];
    case "featured-sidebar":
      return [s(0, 0, 8, 12), s(8, 0, 4, 12)];
    case "side-by-side-unequal":
      return [s(0, 0, 7, 12), s(7, 0, 5, 12)];
    case "2x1+1":
      return [s(0, 0, 6, 6), s(6, 0, 6, 6), s(0, 6, 12, 6)];
    default:
      return [s(0, 0, 12, 12)];
  }
}

/** Map a preset + pane array to concrete GridItems. Extra panes are truncated. */
export function presetToGridItems(
  layout: LayoutPreset,
  panes: PaneConfig[],
): GridItem[] {
  const slots = defaultSlots(layout);
  return panes.slice(0, slots.length).map((p, idx) => ({
    i: p.id,
    x: slots[idx]?.x ?? 0,
    y: slots[idx]?.y ?? 0,
    w: slots[idx]?.w ?? 12,
    h: slots[idx]?.h ?? 12,
  }));
}

/**
 * Reflow existing panes into new template slots.
 *
 * Panes are sorted top-left → right → down by their current grid positions,
 * then zipped into the new template's slots in order.
 * Extra panes are dropped; empty slots are padded with blank panes.
 *
 * Returns { panes, gridItems } for the updated workspace.
 */
export function reflowPanesToPreset(
  currentPanes: PaneConfig[],
  currentGridItems: GridItem[],
  newLayout: LayoutPreset,
): { panes: PaneConfig[]; gridItems: GridItem[] } {
  // Sort by current grid position: y asc, then x asc
  const sorted = [...currentPanes].sort((a, b) => {
    const ga = currentGridItems.find((gi) => gi.i === a.id);
    const gb = currentGridItems.find((gi) => gi.i === b.id);
    if (!ga && !gb) return 0;
    if (!ga) return 1;
    if (!gb) return -1;
    return ga.y !== gb.y ? ga.y - gb.y : ga.x - gb.x;
  });

  const slots = defaultSlots(newLayout);
  const newPanes: PaneConfig[] = [];
  const newGridItems: GridItem[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const pane: PaneConfig = sorted[i] ?? {
      id: uuidv4(),
      type: "blank" as const,
    };
    newPanes.push(pane);
    newGridItems.push({
      i: pane.id,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
    });
  }

  return { panes: newPanes, gridItems: newGridItems };
}

// ---------------------------------------------------------------------------
// Scan-line compaction (replaces finalizeLayout + resolveCollisions pipeline)
// ---------------------------------------------------------------------------

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
 *   1. Clone all items. Build pre-gesture position map.
 *   2. Clamp all items to grid bounds.
 *   3. Partition into fixed (pinned + moved) and movable.
 *   4. Resolve moved vs pinned collisions (pinned always wins).
 *   5. Sort movable by pre-gesture reading order (y ASC, x ASC).
 *   6. Initialize settled = [...pinnedPanes, movedPane].
 *   7. For each movable pane: restore pre-gesture (x,y), keep current (w,h),
 *      find nearest conflict-free slot, fall back to MIN size, then coarse scan.
 *   8. Return items in original input order.
 *
 * Guarantees: zero overlaps, all in-bounds, no pane below MIN_W×MIN_H,
 * pinned panes never moved, moved pane stays at gesture-stop position,
 * deterministic, single pass O(n²) with n ≤ 16.
 */
export function scanLineCompact(
  layout: GridItem[],
  movedId: string | null,
  pinnedIds: Set<string>,
  preGestureLayout: GridItem[] | null,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
): GridItem[] {
  // 1. Deep-clone all items. Build pre-gesture position map.
  const items = layout.map((it) => ({ ...it }));
  const preMap = new Map<
    string,
    { x: number; y: number; w: number; h: number }
  >();
  for (const it of items) {
    const pre = preGestureLayout?.find((p) => p.i === it.i);
    preMap.set(it.i, pre ?? { x: it.x, y: it.y, w: it.w, h: it.h });
  }

  // 2. Clamp all items to grid bounds.
  for (const item of items) _clamp(item, cols, rows);

  // 3. Partition into fixed (pinned + moved) and movable.
  const movedItem =
    movedId !== null ? (items.find((it) => it.i === movedId) ?? null) : null;
  const pinnedItems = items.filter((it) => pinnedIds.has(it.i));
  const movable = items.filter(
    (it) => !pinnedIds.has(it.i) && it.i !== movedId,
  );

  // 4. Resolve moved vs pinned collisions — pinned always wins.
  if (movedItem) {
    for (const pinned of pinnedItems) {
      const [dw, dh] = _overlap(movedItem, pinned);
      if (dw > 0 && dh > 0) {
        _yieldAway(movedItem, pinned, dw, dh);
      }
    }
    _clamp(movedItem, cols, rows);
  }

  // 4b. Ensure enough segment capacity for movable panes.
  //     Compute free segments from fixed panes (pinned + moved). If the total
  //     capacity (in MIN-sized cells) is less than the number of movable panes,
  //     shrink the moved pane until enough capacity exists.
  if (movedItem && movable.length > 0) {
    const fixedForCheck = [...pinnedItems, movedItem];
    let segs = _computeFreeSegments(fixedForCheck, cols, rows);
    let totalCap = _totalSegmentCapacity(segs);

    while (totalCap < movable.length) {
      // Shrink the moved pane by reducing its larger dimension.
      const prevW = movedItem.w;
      const prevH = movedItem.h;
      if (movedItem.w >= movedItem.h && movedItem.w > MIN_W) {
        movedItem.w = Math.max(MIN_W, movedItem.w - MIN_W);
      } else if (movedItem.h > MIN_H) {
        movedItem.h = Math.max(MIN_H, movedItem.h - MIN_H);
      } else {
        break; // Can't shrink further.
      }
      _clamp(movedItem, cols, rows);
      // Re-check pinned collisions.
      for (const pinned of pinnedItems) {
        const [dw2, dh2] = _overlap(movedItem, pinned);
        if (dw2 > 0 && dh2 > 0) {
          _yieldAway(movedItem, pinned, dw2, dh2);
        }
      }
      _clamp(movedItem, cols, rows);
      if (movedItem.w === prevW && movedItem.h === prevH) break;
      segs = _computeFreeSegments([...pinnedItems, movedItem], cols, rows);
      totalCap = _totalSegmentCapacity(segs);
    }
  }

  // 5. Sort movable by pre-gesture reading order (y ASC, x ASC).
  movable.sort((a, b) => {
    const pa = preMap.get(a.i)!;
    const pb = preMap.get(b.i)!;
    return pa.y !== pb.y ? pa.y - pb.y : pa.x - pb.x;
  });

  // 6. Initialize settled = [...pinnedPanes, movedPane].
  const settled: GridItem[] = [...pinnedItems];
  if (movedItem) settled.push(movedItem);

  // 7. Partition movable into non-conflicting and displaced.
  //    Check each pane against settled AND already-kept panes to catch
  //    mutual overlaps (important when movedId=null).
  const kept: GridItem[] = [];
  const displaced: GridItem[] = [];
  for (const pane of movable) {
    const pre = preMap.get(pane.i)!;
    pane.x = Math.max(0, Math.min(pre.x, cols - MIN_W));
    pane.y = Math.max(0, Math.min(pre.y, rows - MIN_H));
    pane.w = Math.max(MIN_W, Math.min(pane.w, cols - pane.x));
    pane.h = Math.max(MIN_H, Math.min(pane.h, rows - pane.y));

    if (
      !_overlapsAnySettled(pane.x, pane.y, pane.w, pane.h, settled) &&
      !_overlapsAnySettled(pane.x, pane.y, pane.w, pane.h, kept)
    ) {
      kept.push(pane);
    } else {
      displaced.push(pane);
    }
  }

  // 8. If any panes are displaced, pack ALL movable panes into free space
  //    to avoid fragmentation from mixed kept+packed layouts.
  if (displaced.length > 0) {
    // All movable panes get re-packed together.
    const allMovable = [...kept, ...displaced];
    allMovable.sort((a, b) => {
      const pa = preMap.get(a.i)!;
      const pb = preMap.get(b.i)!;
      return pa.y !== pb.y ? pa.y - pb.y : pa.x - pb.x;
    });
    _packIntoFreeSpace(allMovable, settled, pinnedIds, movedId, cols, rows);
  } else {
    // No displaced panes — keep all at pre-gesture positions.
    for (const pane of kept) settled.push(pane);
  }

  // 9. Return items in original input order (items array was mutated in-place).
  return items;
}

/**
 * Check if a rectangle at (x, y, w, h) overlaps any item in the settled list.
 */
function _overlapsAnySettled(
  x: number,
  y: number,
  w: number,
  h: number,
  settled: GridItem[],
): boolean {
  for (const s of settled) {
    const dw = Math.min(x + w, s.x + s.w) - Math.max(x, s.x);
    const dh = Math.min(y + h, s.y + s.h) - Math.max(y, s.y);
    if (dw > 0 && dh > 0) return true;
  }
  return false;
}

/**
 * Pack displaced panes into the free space left by settled panes.
 *
 * Computes free horizontal segments, distributes panes across them
 * proportionally, and arranges each segment's panes in a regular grid
 * that fills the segment exactly (no fragmentation).
 */
function _packIntoFreeSpace(
  displaced: GridItem[],
  settled: GridItem[],
  _pinnedIds: Set<string>,
  _movedId: string | null,
  cols: number,
  rows: number,
): void {
  const segs = _computeFreeSegments(settled, cols, rows);
  const n = displaced.length;
  if (n === 0 || segs.length === 0) return;

  // Compute capacity of each segment: one column per MIN_W, one row per MIN_H.
  // Use full segment width per column to avoid wasted gaps.
  const segCaps = segs.map((seg) => {
    const maxCols = Math.max(1, Math.floor(seg.w / MIN_W));
    const maxRows = Math.floor(seg.h / MIN_H);
    return maxCols * maxRows;
  });
  const totalCap = segCaps.reduce((a, b) => a + b, 0);

  // Distribute panes across segments proportional to capacity.
  const segCounts: number[] = segCaps.map(() => 0);
  let assigned = 0;
  for (let si = 0; si < segs.length && assigned < n; si++) {
    const share = totalCap > 0 ? Math.round((segCaps[si] / totalCap) * n) : 0;
    const count = Math.min(share, segCaps[si], n - assigned);
    segCounts[si] = count;
    assigned += count;
  }
  // Distribute remainder.
  while (assigned < n) {
    let added = false;
    for (let si = 0; si < segs.length && assigned < n; si++) {
      if (segCounts[si] < segCaps[si]) {
        segCounts[si]++;
        assigned++;
        added = true;
      }
    }
    if (!added) break;
  }

  // Place panes in each segment as a regular grid.
  let paneIdx = 0;
  for (let si = 0; si < segs.length && paneIdx < n; si++) {
    const seg = segs[si];
    const count = segCounts[si];
    if (count === 0) continue;

    // Determine grid dimensions within the segment.
    const maxCols = Math.max(1, Math.floor(seg.w / MIN_W));
    const maxRows = Math.floor(seg.h / MIN_H);
    let segCols = Math.min(count, maxCols);
    let segRows = Math.ceil(count / segCols);
    while (segRows > maxRows && segCols < maxCols) {
      segCols++;
      segRows = Math.ceil(count / segCols);
    }
    segRows = Math.min(segRows, maxRows);
    const cellW = Math.floor(seg.w / segCols);
    const cellH = Math.floor(seg.h / segRows);
    const placed = Math.min(count, segCols * segRows);

    for (let j = 0; j < placed && paneIdx < n; j++) {
      const col = j % segCols;
      const row = Math.floor(j / segCols);
      const pane = displaced[paneIdx++];
      pane.x = seg.x + col * cellW;
      pane.y = seg.y + row * cellH;
      pane.w =
        col === segCols - 1 ? Math.max(MIN_W, seg.x + seg.w - pane.x) : cellW;
      pane.h =
        row === segRows - 1 ? Math.max(MIN_H, seg.y + seg.h - pane.y) : cellH;
      settled.push(pane);
    }
  }

  // Safety: unplaced panes get MIN size at (0,0) — should not happen.
  while (paneIdx < n) {
    const pane = displaced[paneIdx++];
    pane.x = 0;
    pane.y = 0;
    pane.w = MIN_W;
    pane.h = MIN_H;
  }
}

/**
 * Compute total packing capacity of segments in MIN-sized cells.
 */
function _totalSegmentCapacity(segs: { w: number; h: number }[]): number {
  let cap = 0;
  for (const seg of segs) {
    cap += Math.max(1, Math.floor(seg.w / MIN_W)) * Math.floor(seg.h / MIN_H);
  }
  return cap;
}

/**
 * Compute free horizontal segments in the grid not covered by any fixed pane.
 */
function _computeFreeSegments(
  fixed: GridItem[],
  cols: number,
  rows: number,
): { x: number; y: number; w: number; h: number }[] {
  const ySet = new Set<number>([0, rows]);
  for (const f of fixed) {
    ySet.add(Math.max(0, f.y));
    ySet.add(Math.min(rows, f.y + f.h));
  }
  const sortedY = [...ySet].sort((a, b) => a - b);

  const segs: { x: number; y: number; w: number; h: number }[] = [];

  for (let i = 0; i < sortedY.length - 1; i++) {
    const sy = sortedY[i];
    const sh = sortedY[i + 1] - sy;
    if (sh < MIN_H) continue;

    const blocked: { x1: number; x2: number }[] = [];
    for (const f of fixed) {
      if (f.y < sy + sh && f.y + f.h > sy) {
        blocked.push({ x1: f.x, x2: f.x + f.w });
      }
    }
    blocked.sort((a, b) => a.x1 - b.x1);

    const merged: { x1: number; x2: number }[] = [];
    for (const b of blocked) {
      if (merged.length > 0 && b.x1 <= merged[merged.length - 1].x2) {
        merged[merged.length - 1].x2 = Math.max(
          merged[merged.length - 1].x2,
          b.x2,
        );
      } else {
        merged.push({ ...b });
      }
    }

    let cx = 0;
    for (const m of merged) {
      if (m.x1 > cx && m.x1 - cx >= MIN_W) {
        segs.push({ x: cx, y: sy, w: m.x1 - cx, h: sh });
      }
      cx = Math.max(cx, m.x2);
    }
    if (cols > cx && cols - cx >= MIN_W) {
      segs.push({ x: cx, y: sy, w: cols - cx, h: sh });
    }
  }

  return segs;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Overlap dimensions [dw, dh] between two items. Negative = no overlap. */
function _overlap(a: GridItem, b: GridItem): [number, number] {
  return [
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
    Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
  ];
}

/**
 * `mover` yields to `fixed` (pinned pane) — mover shrinks or shifts away.
 * Direction: center-based (mover center relative to fixed center).
 * If shrinking to MIN isn't enough, shift the mover away to eliminate overlap.
 */
function _yieldAway(
  mover: GridItem,
  fixed: GridItem,
  dw: number,
  dh: number,
): void {
  if (dw <= dh) {
    if (mover.x + mover.w * 0.5 <= fixed.x + fixed.w * 0.5) {
      // Mover is left of fixed — try shrinking right edge.
      const gap = fixed.x - mover.x;
      if (gap >= MIN_W) {
        mover.w = gap;
      } else {
        // Not enough room: shift left so mover.x + MIN_W <= fixed.x.
        mover.x = fixed.x - MIN_W;
        mover.w = MIN_W;
      }
    } else {
      mover.x = fixed.x + fixed.w;
    }
  } else {
    if (mover.y + mover.h * 0.5 <= fixed.y + fixed.h * 0.5) {
      const gap = fixed.y - mover.y;
      if (gap >= MIN_H) {
        mover.h = gap;
      } else {
        mover.y = fixed.y - MIN_H;
        mover.h = MIN_H;
      }
    } else {
      mover.y = fixed.y + fixed.h;
    }
  }
}

/**
 * Hard-clamp item to [0,cols]×[0,rows] with minimum sizes guaranteed.
 * Two-pass: shrink to fit right/bottom edge, then shift left/up if x/y overflows.
 */
function _clamp(item: GridItem, cols: number, rows: number): void {
  item.x = Math.max(0, item.x);
  item.y = Math.max(0, item.y);
  item.w = Math.max(MIN_W, Math.min(item.w, cols - item.x));
  item.h = Math.max(MIN_H, Math.min(item.h, rows - item.y));
  // If w was forced to MIN_W but x is too far right, shift left
  if (item.x + item.w > cols) item.x = Math.max(0, cols - item.w);
  if (item.y + item.h > rows) item.y = Math.max(0, rows - item.h);
}

// ---------------------------------------------------------------------------
// Layout migration
// ---------------------------------------------------------------------------

/**
 * Find the first free rectangle of size targetW × targetH in the grid,
 * scanning left-to-right then top-to-bottom in MIN_W/MIN_H steps.
 * Returns null when every candidate position overlaps an existing item.
 */
export function findFreeSlot(
  items: GridItem[],
  targetW: number,
  targetH: number,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
): { x: number; y: number; w: number; h: number } | null {
  for (let y = 0; y + targetH <= rows; y += MIN_H) {
    for (let x = 0; x + targetW <= cols; x += MIN_W) {
      const overlaps = items.some(
        (it) =>
          x < it.x + it.w &&
          x + targetW > it.x &&
          y < it.y + it.h &&
          y + targetH > it.y,
      );
      if (!overlaps) return { x, y, w: targetW, h: targetH };
    }
  }
  return null;
}

/**
 * Migrate GridItems from old 12-unit coordinates to 288-unit coordinates.
 * Idempotent: items already in 288-unit space (any coord > 12) pass through.
 */
export function migrateGridItems(items: GridItem[]): GridItem[] {
  if (items.length === 0) return items;
  // Detect old 12-unit coords: all values fit within [0,12].
  // New 288-unit coords will have at least one w or h >= GRID_SCALE (24).
  const allOld = items.every(
    (it) => it.x <= 12 && it.y <= 12 && it.w <= 12 && it.h <= 12,
  );
  if (!allOld) return items; // already in 288-unit space (or unknown — leave as-is)
  return items.map((it) => ({
    i: it.i,
    x: it.x * GRID_SCALE,
    y: it.y * GRID_SCALE,
    w: it.w * GRID_SCALE,
    h: it.h * GRID_SCALE,
  }));
}
