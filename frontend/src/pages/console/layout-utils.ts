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
// Collision resolver
// ---------------------------------------------------------------------------

/**
 * Resolves overlaps after pane `movedId` has been dragged/resized.
 *
 * Guarantees after resolution:
 *   - Every pane is within [0,cols]×[0,rows]
 *   - Every pane has w ≥ MIN_W, h ≥ MIN_H
 *   - No pane is pushed off-screen; at worst it shrinks to minimum size
 *   - Panes pushed in the same direction maintain their original left-to-right
 *     (or top-to-bottom) order — no swapping
 *
 * Strategy:
 *   Phase 1 — moved vs neighbors, batch-per-direction:
 *     1a. Pinned neighbors: moved yields to them first
 *     1b. Left-shrink: neighbors to the left get their right edge trimmed
 *     1c. Up-shrink: neighbors above get their bottom edge trimmed
 *     1d. Right-push (batch): all right-side neighbors sorted by original x,
 *         packed sequentially; moved shrinks only enough to fit all at MIN_W
 *     1e. Down-push (batch): same, vertical axis
 *   Phase 2 — cascade up to 5 passes: resolve any inter-neighbor overlaps
 *     created by Phase 1 pushes
 *   Phase 3 — hard clamp all items to grid bounds
 */
/**
 * Optional axis hint — when the caller knows the operation is a single-axis resize,
 * this overrides the overlap-area heuristic used to pick the resolution axis.
 * "x" → resolve horizontally (east/west resize); "y" → resolve vertically (north/south resize).
 * Omit for drags or corner resizes where the heuristic should apply.
 */
export type ResizeAxisHint = "x" | "y";

export function resolveCollisions(
  layout: GridItem[],
  movedId: string,
  pinnedIds: Set<string>,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
  axisHint?: ResizeAxisHint,
): GridItem[] {
  const items = layout.map((it) => ({ ...it }));
  const moved = items.find((it) => it.i === movedId);
  if (!moved) return items;

  // Clamp moved to grid bounds first
  _clamp(moved, cols, rows);

  // ── Phase 1a: pinned neighbors — moved yields to them ───────────────────

  for (const other of items) {
    if (other.i === movedId) continue;
    if (!pinnedIds.has(other.i)) continue;
    const [dw, dh] = _overlap(moved, other);
    if (dw <= 0 || dh <= 0) continue;
    _yieldAway(moved, other, dw, dh);
  }
  _clamp(moved, cols, rows);

  // ── Phase 1b-e: shrink-first, push-as-fallback ──────────────────────────
  // For each overlapping neighbor, determine which axis to resolve on, then:
  //   - Shrink other's TRAILING edge if moved's center is past other's center
  //     (moved approaching from behind — same as old Phase 1b/c).
  //   - Shrink other's LEADING edge if moved's center is before other's center
  //     (moved's expanding edge pushes into the neighbor — new behavior).
  //     Only fall back to push if the shrink would violate MIN size.
  // This ensures e.g. expanding a pane's bottom edge shrinks the pane below
  // in place (anchored at its far edge) rather than pushing it into further panes.

  const rightPushSet = new Set<string>();
  const rightPush: GridItem[] = [];
  const downPushSet = new Set<string>();
  const downPush: GridItem[] = [];

  for (const other of items) {
    if (other.i === movedId || pinnedIds.has(other.i)) continue;
    const [dw, dh] = _overlap(moved, other);
    if (dw <= 0 || dh <= 0) continue;

    // Pick resolution axis: honour caller hint for single-axis resizes; fall back
    // to the overlap-area heuristic (smaller overlap axis = easier to resolve) for
    // drags and corner resizes where both axes may have moved.
    const resolveHoriz =
      axisHint === "x" ? true : axisHint === "y" ? false : dw <= dh;

    if (resolveHoriz) {
      // Horizontal resolution
      if (moved.x + moved.w * 0.5 > other.x + other.w * 0.5) {
        // Moved is right of other → shrink other's right (trailing) edge
        other.w = Math.max(MIN_W, moved.x - other.x);
        // If other hit MIN_W and moved still overlaps, clamp moved's left edge
        const otherRight = other.x + other.w;
        if (moved.x < otherRight) {
          const excess = otherRight - moved.x;
          moved.x = otherRight;
          moved.w = Math.max(MIN_W, moved.w - excess);
        }
      } else {
        // Moved is left of other → shrink other's left (leading) edge in place
        const newX = moved.x + moved.w;
        const newW = (other.x + other.w) - newX;
        if (newW >= MIN_W) {
          other.x = newX;
          other.w = newW;
        } else {
          // Can't absorb by shrinking — fall back to push
          rightPushSet.add(other.i);
          rightPush.push(other);
        }
      }
    } else {
      // Vertical resolution
      if (moved.y + moved.h * 0.5 > other.y + other.h * 0.5) {
        // Moved is below other → shrink other's bottom (trailing) edge
        other.h = Math.max(MIN_H, moved.y - other.y);
        // If other hit MIN_H and moved still overlaps, clamp moved's top edge
        const otherBottom = other.y + other.h;
        if (moved.y < otherBottom) {
          const excess = otherBottom - moved.y;
          moved.y = otherBottom;
          moved.h = Math.max(MIN_H, moved.h - excess);
        }
      } else {
        // Moved is above other → shrink other's top (leading) edge in place
        const newY = moved.y + moved.h;
        const newH = (other.y + other.h) - newY;
        if (newH >= MIN_H) {
          other.y = newY;
          other.h = newH;
        } else {
          // Can't absorb by shrinking — fall back to push
          downPushSet.add(other.i);
          downPush.push(other);
        }
      }
    }
  }
  _clamp(moved, cols, rows);

  // ── Right-push batch: BFS + pack (only panes that couldn't shrink in place)

  for (let qi = 0; qi < rightPush.length; qi++) {
    const current = rightPush[qi];
    for (const other of items) {
      if (other.i === movedId || rightPushSet.has(other.i) || pinnedIds.has(other.i)) continue;
      const [dw, dh] = _overlap(current, other);
      if (dw <= 0 || dh <= 0) continue;
      if (dw <= dh && current.x + current.w * 0.5 <= other.x + other.w * 0.5) {
        rightPushSet.add(other.i);
        rightPush.push(other);
      }
    }
  }

  if (rightPush.length > 0) {
    _batchPush(moved, rightPush, "x", "w", cols, MIN_W);
  }

  // ── Down-push batch: BFS + pack (only panes that couldn't shrink in place)

  for (let qi = 0; qi < downPush.length; qi++) {
    const current = downPush[qi];
    for (const other of items) {
      if (other.i === movedId || downPushSet.has(other.i) || pinnedIds.has(other.i)) continue;
      const [dw, dh] = _overlap(current, other);
      if (dw <= 0 || dh <= 0) continue;
      if (dh < dw && current.y + current.h * 0.5 <= other.y + other.h * 0.5) {
        downPushSet.add(other.i);
        downPush.push(other);
      }
    }
  }

  if (downPush.length > 0) {
    _batchPush(moved, downPush, "y", "h", rows, MIN_H);
  }

  // ── Phase 2: cascade — resolve inter-neighbor overlaps (up to 5 passes) ──

  for (let pass = 0; pass < 5; pass++) {
    let anyChange = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].i === movedId) continue;
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].i === movedId) continue;
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
    if (!anyChange) break;
  }

  // ── Phase 3: hard clamp all items to grid bounds ─────────────────────────

  for (const item of items) {
    _clamp(item, cols, rows);
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
 * Batch-push a group of overlapping neighbors away from `moved` along one axis.
 *
 * Neighbors are sorted by their current position on the axis (preserving visual
 * order), then packed sequentially starting at `moved`'s trailing edge.
 * `moved` is only shrunk if there isn't enough room to fit all neighbors at
 * their minimum size — and only shrunk once (not once per neighbor).
 *
 * @param pos   axis position key: "x" or "y"
 * @param size  axis size key: "w" or "h"
 * @param limit grid bound in this axis (cols or rows)
 * @param min   minimum size in this axis (MIN_W or MIN_H)
 */
function _batchPush(
  moved: GridItem,
  neighbors: GridItem[],
  pos: "x" | "y",
  size: "w" | "h",
  limit: number,
  min: number,
): void {
  // Sort neighbors by original position on this axis to preserve visual order
  const sorted = [...neighbors].sort((a, b) => a[pos] - b[pos]);

  const minNeeded = sorted.length * min;
  const trailingEdge = moved[pos] + moved[size];

  // Shrink moved once if there isn't enough room for all neighbors at minimum size
  if (trailingEdge + minNeeded > limit) {
    moved[size] = Math.max(min, limit - moved[pos] - minNeeded);
  }

  // Pack neighbors sequentially from moved's trailing edge.
  // Cap each pane at its original trailing edge to prevent cascading into
  // further panes when an earlier pane absorbs its full original size.
  let cursor = moved[pos] + moved[size];
  for (let i = 0; i < sorted.length; i++) {
    const pane = sorted[i];
    const panesLeft = sorted.length - i;
    const spaceTillEnd = limit - cursor;
    const originalTrailing = pane[pos] + pane[size]; // capture before move
    pane[pos] = cursor;
    pane[size] = Math.max(
      min,
      Math.min(
        pane[size],
        originalTrailing - cursor,
        spaceTillEnd - (panesLeft - 1) * min,
      ),
    );
    cursor = pane[pos] + pane[size];
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
 * Push `victim` away from `source` in cascade phase — best-effort, no clamping
 * of source. Victim is shrunk to MIN size if pushed to the boundary.
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
