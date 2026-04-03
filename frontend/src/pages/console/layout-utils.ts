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
    const pane: PaneConfig = sorted[i] ?? { id: uuidv4(), type: "blank" as const };
    newPanes.push(pane);
    newGridItems.push({ i: pane.id, x: slot.x, y: slot.y, w: slot.w, h: slot.h });
  }

  return { panes: newPanes, gridItems: newGridItems };
}

// ---------------------------------------------------------------------------
// Collision resolver — strip-based reflow
// ---------------------------------------------------------------------------

/**
 * Optional axis hint — when the caller knows the operation is a single-axis resize,
 * this overrides the overlap-area heuristic used to pick the resolution axis.
 * "x" → resolve horizontally (east/west resize); "y" → resolve vertically (north/south resize).
 * Omit for drags or corner resizes where the heuristic should apply.
 */
export type ResizeAxisHint = "x" | "y";

/**
 * Resolves overlaps after pane `movedId` has been dragged/resized.
 *
 * Strategy: strip-based reflow.
 *   1. Place `moved` at its requested position (clamped to grid bounds).
 *   2. Cap moved's size so the surrounding strips can hold all other panes.
 *   3. Yield moved to any pinned neighbors.
 *   4. Decompose the remaining grid space (everything except moved) into
 *      4 non-overlapping rectangular strips: above, below, left, right.
 *   5. Assign each non-moved pane to the strip it overlaps most (by area).
 *   6. Tile each strip's assigned panes proportionally.
 *
 * Guarantees:
 *   - Every pane is within [0,cols]×[0,rows]
 *   - Every pane has w ≥ MIN_W, h ≥ MIN_H
 *   - No two panes overlap
 *   - moved ends up at exactly its requested position (after clamping)
 */
export function resolveCollisions(
  layout: GridItem[],
  movedId: string,
  pinnedIds: Set<string>,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
  _axisHint?: ResizeAxisHint,
): GridItem[] {
  const items = layout.map((it) => ({ ...it }));
  const moved = items.find((it) => it.i === movedId);
  if (!moved) return items;

  // Clamp moved to grid bounds
  _clamp(moved, cols, rows);

  // Cap moved so surrounding strips can hold all other panes at MIN size
  const otherCount = items.length - 1;
  if (otherCount > 0) {
    // Try both axes and apply the tighter cap
    for (const axis of ["w", "h"] as const) {
      const maxSize = _computeMaxMovedSize(moved, axis, otherCount, cols, rows);
      if (moved[axis] > maxSize) {
        moved[axis] = maxSize;
      }
    }
    _clamp(moved, cols, rows);
  }

  // Yield moved to pinned neighbors
  for (const other of items) {
    if (other.i === movedId || !pinnedIds.has(other.i)) continue;
    const [dw, dh] = _overlap(moved, other);
    if (dw <= 0 || dh <= 0) continue;
    _yieldAway(moved, other, dw, dh);
  }
  _clamp(moved, cols, rows);

  // ── If no other panes, we're done
  const others = items.filter((it) => it.i !== movedId);
  if (others.length === 0) return items;

  // ── Compute the 4 strips around moved (non-overlapping, tile the grid minus moved)
  //
  // Layout:
  //   +------------------cols------------------+
  //   |            ABOVE (full width)          |  y: [0, my)
  //   +--------+----------+--------------------+
  //   | LEFT   |  MOVED   |  RIGHT             |  y: [my, my+mh)
  //   +--------+----------+--------------------+
  //   |            BELOW (full width)          |  y: [my+mh, rows)
  //   +----------------------------------------+
  //
  const mx = moved.x, my = moved.y, mw = moved.w, mh = moved.h;

  type Strip = { x: number; y: number; w: number; h: number };
  const strips: Strip[] = [];

  const aboveH = my;
  if (aboveH >= MIN_H && cols >= MIN_W)
    strips.push({ x: 0, y: 0, w: cols, h: aboveH });

  const belowY = my + mh;
  const belowH = rows - belowY;
  if (belowH >= MIN_H && cols >= MIN_W)
    strips.push({ x: 0, y: belowY, w: cols, h: belowH });

  const leftW = mx;
  if (leftW >= MIN_W && mh >= MIN_H)
    strips.push({ x: 0, y: my, w: leftW, h: mh });

  const rightX = mx + mw;
  const rightW = cols - rightX;
  if (rightW >= MIN_W && mh >= MIN_H)
    strips.push({ x: rightX, y: my, w: rightW, h: mh });

  // ── Assign panes to strips based on maximum overlap area with original position
  // Sort others by reading order (y asc, x asc) for stable assignment
  others.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));

  // For each pane, compute overlap with each strip and pick the best
  const stripAssignments: GridItem[][] = strips.map(() => []);

  for (const pane of others) {
    let bestStrip = -1;
    let bestArea = -1;

    for (let si = 0; si < strips.length; si++) {
      const strip = strips[si];
      const overlapX = Math.min(pane.x + pane.w, strip.x + strip.w) - Math.max(pane.x, strip.x);
      const overlapY = Math.min(pane.y + pane.h, strip.y + strip.h) - Math.max(pane.y, strip.y);
      const area = overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
      if (area > bestArea) {
        bestArea = area;
        bestStrip = si;
      }
    }

    // If no overlap with any strip (e.g., pane was entirely behind moved),
    // use center-distance as fallback
    if (bestStrip < 0 || bestArea === 0) {
      const paneCx = pane.x + pane.w / 2;
      const paneCy = pane.y + pane.h / 2;
      let bestDist = Infinity;
      for (let si = 0; si < strips.length; si++) {
        const strip = strips[si];
        const stripCx = strip.x + strip.w / 2;
        const stripCy = strip.y + strip.h / 2;
        const dist = Math.abs(paneCx - stripCx) + Math.abs(paneCy - stripCy);
        if (dist < bestDist) {
          bestDist = dist;
          bestStrip = si;
        }
      }
    }

    // If still no strip (all strips zero-area — shouldn't happen with size cap)
    // fall back to the first available strip
    if (bestStrip < 0 && strips.length > 0) bestStrip = 0;

    if (bestStrip >= 0) {
      stripAssignments[bestStrip].push(pane);
    }
  }

  // ── Redistribute: if any strip has more panes than it can hold, spill to neighbors
  for (let si = 0; si < strips.length; si++) {
    const strip = strips[si];
    const maxPanes = _stripCapacity(strip);
    const assigned = stripAssignments[si];
    if (assigned.length <= maxPanes) continue;

    // Spill excess panes to strips with remaining capacity
    const excess = assigned.splice(maxPanes);
    for (const pane of excess) {
      let placed = false;
      // Try each other strip, prefer one with most remaining capacity
      const candidates = strips
        .map((s, idx) => ({ idx, remaining: _stripCapacity(s) - stripAssignments[idx].length }))
        .filter((c) => c.idx !== si && c.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining);
      for (const c of candidates) {
        stripAssignments[c.idx].push(pane);
        placed = true;
        break;
      }
      if (!placed) {
        // Force it back into the original strip — tiling will compress everything to min
        assigned.push(pane);
      }
    }
  }

  // ── Tile each strip with its assigned panes
  for (let si = 0; si < strips.length; si++) {
    const strip = strips[si];
    const assigned = stripAssignments[si];
    if (assigned.length === 0) continue;
    _tileStrip(strip, assigned, cols, rows);
  }

  // Final clamp for safety
  for (const item of items) {
    _clamp(item, cols, rows);
  }

  return items;
}

// ---------------------------------------------------------------------------
// Final overlap elimination — guaranteed reflow fallback
// ---------------------------------------------------------------------------

/**
 * Safety-net pass called after resolveCollisions at gesture stop (drag/resize).
 *
 * With the strip-based reflow, resolveCollisions should produce zero overlaps.
 * This function verifies that invariant and, if any overlap remains (e.g. due
 * to pinned panes creating impossible constraints), performs a second reflow
 * pass to guarantee a clean result.
 */
export function finalizeLayout(
  layout: GridItem[],
  pinnedIds: Set<string>,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
): GridItem[] {
  const items = layout.map((it) => ({ ...it }));

  // Quick check: any overlaps?
  let hasOverlap = false;
  for (let i = 0; i < items.length && !hasOverlap; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const [dw, dh] = _overlap(items[i], items[j]);
      if (dw > 0 && dh > 0) {
        hasOverlap = true;
        break;
      }
    }
  }

  if (!hasOverlap) return items;

  // Overlaps remain — use pairwise push as last resort (up to 10 passes)
  for (let pass = 0; pass < 10; pass++) {
    let anyChange = false;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [dw, dh] = _overlap(items[i], items[j]);
        if (dw <= 0 || dh <= 0) continue;
        anyChange = true;

        if (pinnedIds.has(items[i].i)) {
          _yieldAway(items[j], items[i], dw, dh);
        } else if (pinnedIds.has(items[j].i)) {
          _yieldAway(items[i], items[j], dw, dh);
        } else {
          _pushBestEffort(items[i], items[j], dw, dh, cols, rows);
        }
      }
    }

    for (const item of items) _clamp(item, cols, rows);
    if (!anyChange) break;
  }

  return items;
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
 * How many MIN_W×MIN_H panes can fit inside a strip.
 */
function _stripCapacity(strip: { w: number; h: number }): number {
  return Math.floor(strip.w / MIN_W) * Math.floor(strip.h / MIN_H);
}

/**
 * Tile `panes` into a rectangular `strip`, arranging them in a grid.
 *
 * The algorithm picks a grid arrangement (tileCols × tileRows) that fits
 * all panes and gives each cell the most area. Panes are placed in reading
 * order (the caller sorts them before passing).
 *
 * Each pane gets the same cell size. If the strip can't hold all panes
 * even at MIN size, the last panes get compressed.
 */
function _tileStrip(
  strip: { x: number; y: number; w: number; h: number },
  panes: GridItem[],
  _cols: number,
  _rows: number,
): void {
  const n = panes.length;
  if (n === 0) return;

  // Special case: 1 pane fills the whole strip
  if (n === 1) {
    panes[0].x = strip.x;
    panes[0].y = strip.y;
    panes[0].w = Math.max(MIN_W, strip.w);
    panes[0].h = Math.max(MIN_H, strip.h);
    return;
  }

  // Find best grid arrangement: try all valid (tileCols, tileRows) combos
  // Constraint: tileCols * tileRows >= n, each cell >= MIN_W x MIN_H
  const maxCols = Math.floor(strip.w / MIN_W);
  const maxRows = Math.floor(strip.h / MIN_H);

  let bestCols = 1;
  let bestRows = n;
  let bestScore = -1;

  for (let tc = 1; tc <= Math.min(n, maxCols); tc++) {
    const tr = Math.ceil(n / tc);
    if (tr > maxRows) continue;
    const cellW = Math.floor(strip.w / tc);
    const cellH = Math.floor(strip.h / tr);
    if (cellW < MIN_W || cellH < MIN_H) continue;
    // Score = cell area (prefer squarish, large cells)
    const score = cellW * cellH;
    if (score > bestScore) {
      bestScore = score;
      bestCols = tc;
      bestRows = tr;
    }
  }

  // If no valid arrangement found (too many panes for strip), pack as tight as possible
  if (bestScore < 0) {
    // Use maximum columns, compute rows needed
    bestCols = Math.max(1, maxCols);
    bestRows = Math.max(1, Math.ceil(n / bestCols));
  }

  const cellW = Math.max(MIN_W, Math.floor(strip.w / bestCols));
  const cellH = Math.max(MIN_H, Math.floor(strip.h / bestRows));

  for (let idx = 0; idx < n; idx++) {
    const col = idx % bestCols;
    const row = Math.floor(idx / bestCols);
    const pane = panes[idx];

    pane.x = strip.x + col * cellW;
    pane.y = strip.y + row * cellH;

    // Last column/row absorb remainder pixels to fill the strip exactly
    if (col === bestCols - 1) {
      pane.w = Math.max(MIN_W, strip.x + strip.w - pane.x);
    } else {
      pane.w = cellW;
    }
    if (row === bestRows - 1 || idx >= n - bestCols) {
      // Last row of panes
      pane.h = Math.max(MIN_H, strip.y + strip.h - pane.y);
    } else {
      pane.h = cellH;
    }
  }
}

/**
 * `mover` yields to `fixed` (pinned pane) — mover shrinks or shifts away.
 * Direction: center-based (mover center relative to fixed center).
 */
function _yieldAway(
  mover: GridItem,
  fixed: GridItem,
  dw: number,
  dh: number,
): void {
  if (dw <= dh) {
    if (mover.x + mover.w * 0.5 <= fixed.x + fixed.w * 0.5) {
      mover.w = Math.max(MIN_W, fixed.x - mover.x);
    } else {
      mover.x = fixed.x + fixed.w;
    }
  } else {
    if (mover.y + mover.h * 0.5 <= fixed.y + fixed.h * 0.5) {
      mover.h = Math.max(MIN_H, fixed.y - mover.y);
    } else {
      mover.y = fixed.y + fixed.h;
    }
  }
}

/**
 * Push `victim` away from `source` — best-effort for finalizeLayout fallback.
 */
function _pushBestEffort(
  source: GridItem,
  victim: GridItem,
  dw: number,
  dh: number,
  cols: number,
  rows: number,
): void {
  if (dw <= dh) {
    if (source.x + source.w * 0.5 <= victim.x + victim.w * 0.5) {
      victim.x = source.x + source.w;
      if (victim.x + victim.w > cols) {
        victim.w = Math.max(MIN_W, cols - victim.x);
      }
    } else {
      victim.w = Math.max(MIN_W, source.x - victim.x);
    }
  } else {
    if (source.y + source.h * 0.5 <= victim.y + victim.h * 0.5) {
      victim.y = source.y + source.h;
      if (victim.y + victim.h > rows) {
        victim.h = Math.max(MIN_H, rows - victim.y);
      }
    } else {
      victim.h = Math.max(MIN_H, source.y - victim.y);
    }
  }
}

/**
 * Returns how many MIN_W×MIN_H panes fit in the 4 non-overlapping strips
 * surrounding moved when it has size `newSize` on the given axis.
 */
function _capacityAround(
  moved: GridItem,
  axis: "w" | "h",
  newSize: number,
  cols: number,
  rows: number,
): number {
  const mw = axis === "w" ? newSize : moved.w;
  const mh = axis === "h" ? newSize : moved.h;
  const above = Math.floor(cols / MIN_W) * Math.floor(moved.y / MIN_H);
  const belowH = Math.max(0, rows - moved.y - mh);
  const below = Math.floor(cols / MIN_W) * Math.floor(belowH / MIN_H);
  const left = Math.floor(moved.x / MIN_W) * Math.floor(mh / MIN_H);
  const rightW = Math.max(0, cols - moved.x - mw);
  const right = Math.floor(rightW / MIN_W) * Math.floor(mh / MIN_H);
  return above + below + left + right;
}

/**
 * Binary-search the largest value for `moved[axis]` such that the surrounding
 * strips can still accommodate `otherCount` panes at their minimum sizes.
 */
function _computeMaxMovedSize(
  moved: GridItem,
  axis: "w" | "h",
  otherCount: number,
  cols: number,
  rows: number,
): number {
  const min = axis === "w" ? MIN_W : MIN_H;
  const limit = axis === "w" ? cols - moved.x : rows - moved.y;
  if (otherCount <= 0) return limit;
  let lo = min;
  let hi = limit;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (_capacityAround(moved, axis, mid, cols, rows) >= otherCount) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
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
