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

  // ── Hard size cap: moved cannot expand past the point where all other
  //   panes would be forced below their minimum size.
  //
  //   The 4 strips around moved (above, below, left, right) tile the rest of
  //   the grid. We binary-search for the largest size on the resize axis such
  //   that those strips can still hold (items.length - 1) panes of MIN_W×MIN_H.
  //   This prevents the "16-pane pile-up in the bottom-right corner" scenario
  //   without any special-casing — the formula is general.
  if (axisHint && items.length > 1) {
    const axis = axisHint === "x" ? "w" : "h";
    const maxSize = _computeMaxMovedSize(moved, axis, items.length - 1, cols, rows);
    if (moved[axis] > maxSize) {
      moved[axis] = maxSize;
    }
    _clamp(moved, cols, rows);
  }

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
        // Moved is right of other (other center is left of moved center).
        if (axisHint === "x" && other.x >= moved.x) {
          // East resize engulfed other (other starts inside moved, not before
          // moved's left edge). Shrinking other's trailing edge and then
          // adjusting moved.x would incorrectly displace the moved pane.
          // Push other away instead.
          if (moved.x + moved.w + MIN_W <= cols) {
            rightPushSet.add(other.i);
            rightPush.push(other);
          } else {
            downPushSet.add(other.i);
            downPush.push(other);
          }
        } else {
          // Other starts before moved's left edge — shrink other's trailing edge.
          other.w = Math.max(MIN_W, moved.x - other.x);
          // If other hit MIN_W and moved still overlaps, clamp moved's left edge
          const otherRight = other.x + other.w;
          if (moved.x < otherRight) {
            const excess = otherRight - moved.x;
            moved.x = otherRight;
            moved.w = Math.max(MIN_W, moved.w - excess);
          }
        }
      } else {
        // Moved is left of other (expanding into it from the left).
        if (axisHint === "x") {
          // East/west resize: batch ALL displaced items together so _batchPush
          // can compute moved's maximum width in one pass. If we shrink some
          // in-place and batch others, both groups land at moved.x+moved.w,
          // causing an overlap that the cascade can't resolve when space runs out.
          // When there's no horizontal room at all (moved spans full width), push down.
          if (moved.x + moved.w + MIN_W <= cols) {
            rightPushSet.add(other.i);
            rightPush.push(other);
          } else {
            downPushSet.add(other.i);
            downPush.push(other);
          }
        } else {
          // Drag or corner resize: try shrink first; push if can't fit.
          const newX = moved.x + moved.w;
          const newW = (other.x + other.w) - newX;
          if (newW >= MIN_W) {
            other.x = newX;
            other.w = newW;
          } else {
            rightPushSet.add(other.i);
            rightPush.push(other);
          }
        }
      }
    } else {
      // Vertical resolution
      if (moved.y + moved.h * 0.5 > other.y + other.h * 0.5) {
        // Moved is below other (other center is above moved center).
        if (axisHint === "y" && other.y >= moved.y) {
          // South resize engulfed other (other starts inside moved, not before
          // moved's top edge). Shrinking other's trailing edge would produce a
          // negative trim and then shift moved.y upward — wrong.
          // Push other down/right instead.
          if (moved.y + moved.h + MIN_H <= rows) {
            downPushSet.add(other.i);
            downPush.push(other);
          } else {
            rightPushSet.add(other.i);
            rightPush.push(other);
          }
        } else {
          // Other starts before moved's top edge — shrink other's trailing edge.
          other.h = Math.max(MIN_H, moved.y - other.y);
          // If other hit MIN_H and moved still overlaps, clamp moved's top edge
          const otherBottom = other.y + other.h;
          if (moved.y < otherBottom) {
            const excess = otherBottom - moved.y;
            moved.y = otherBottom;
            moved.h = Math.max(MIN_H, moved.h - excess);
          }
        }
      } else {
        // Moved is above other (expanding into it from above).
        if (axisHint === "y") {
          // North/south resize: batch ALL displaced items together.
          // Same rationale as the axisHint="x" case above.
          if (moved.y + moved.h + MIN_H <= rows) {
            downPushSet.add(other.i);
            downPush.push(other);
          } else {
            rightPushSet.add(other.i);
            rightPush.push(other);
          }
        } else {
          // Drag or corner resize: try shrink first; push if can't fit.
          const newY = moved.y + moved.h;
          const newH = (other.y + other.h) - newY;
          if (newH >= MIN_H) {
            other.y = newY;
            other.h = newH;
          } else {
            downPushSet.add(other.i);
            downPush.push(other);
          }
        }
      }
    }
  }
  _clamp(moved, cols, rows);

  // ── Pre-expand push sets to catch cascade items in the estimated cursor zone ──
  //
  // Phase 1 adds items that directly overlap moved. But pushed items cascade into
  // adjacent non-overlapping items (e.g. in a 4×4 east resize, pane3 doesn't
  // touch pane0 at intermediate widths, but pane2 when pushed WILL hit pane3).
  // We estimate the final cursor range and pull those items into the push set NOW,
  // so _batchPush sees all displaced items and shrinks moved by the correct amount
  // in one pass — preventing the "pane2 and pane3 both land at x=cols" collision.
  //
  // y-overlap filter (for rightPush) ensures we only include items in the same
  // horizontal band as moved; x-overlap filter (for downPush) does the same.

  if (rightPush.length > 0) {
    const estimatedBound = Math.min(
      cols,
      moved.x + moved.w + rightPush.length * MIN_W,
    );
    for (const other of items) {
      if (other.i === movedId || rightPushSet.has(other.i) || pinnedIds.has(other.i)) continue;
      const yOvlp =
        Math.min(moved.y + moved.h, other.y + other.h) - Math.max(moved.y, other.y);
      if (yOvlp <= 0) continue;
      if (other.x >= moved.x && other.x < estimatedBound) {
        rightPushSet.add(other.i);
        rightPush.push(other);
      }
    }
  }

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

    // Post-batchPush overlap expansion: pushed items at their new positions
    // may overlap non-pushed items that weren't in the estimated cursor zone.
    // Pull those into the set and re-pack (up to 5 iterations).
    for (let iter = 0; iter < 5; iter++) {
      let expanded = false;
      for (const pushed of rightPush) {
        for (const other of items) {
          if (other.i === movedId || rightPushSet.has(other.i) || pinnedIds.has(other.i)) continue;
          const [dw2, dh2] = _overlap(pushed, other);
          if (dw2 <= 0 || dh2 <= 0) continue;
          rightPushSet.add(other.i);
          rightPush.push(other);
          expanded = true;
        }
      }
      if (!expanded) break;
      _batchPush(moved, rightPush, "x", "w", cols, MIN_W);
    }
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
    // Use column-aware packing instead of _batchPush for the y-axis.
    //
    // _batchPush treats all pushed items as a single column and would either:
    //   (a) over-shrink moved.h because items in different x-bands don't
    //       actually compete for vertical space, or
    //   (b) pack pushed items onto existing non-pushed items in the same
    //       x-band (e.g. 4×4 east resize pushes p1/p2/p3 onto p5/p6/p7).
    //
    // _columnBatchPush groups items by x-overlap and includes non-pushed
    // column-mates, so each column is packed independently and correctly.
    //
    // After the initial pack, scan for new overlaps (pushed items may now
    // conflict with non-pushed items not yet in the set) and re-pack.
    _columnBatchPush(moved, downPush, items, movedId, rows, MIN_H);

    for (let iter = 0; iter < 5; iter++) {
      let expanded = false;
      for (const pushed of downPush) {
        for (const other of items) {
          if (other.i === movedId || downPushSet.has(other.i) || pinnedIds.has(other.i)) continue;
          const [dw2, dh2] = _overlap(pushed, other);
          if (dw2 <= 0 || dh2 <= 0) continue;
          downPushSet.add(other.i);
          downPush.push(other);
          expanded = true;
        }
      }
      if (!expanded) break;
      _columnBatchPush(moved, downPush, items, movedId, rows, MIN_H);
    }
  }

  // ── Phase 2: cascade — resolve inter-neighbor overlaps (up to 10 passes) ──
  //
  // moved is allowed as a SOURCE (items[i]) so that any residual overlaps
  // between moved and non-moved panes (e.g. created by the yield-to-pinned
  // path in Phase 1a) are resolved here by pushing non-moved panes away.
  // moved is never allowed as a VICTIM (items[j]) — its final position is
  // set by Phase 1 and must not be disturbed by cascade pushes.

  for (let pass = 0; pass < 10; pass++) {
    let anyChange = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].i === movedId) continue; // moved is never pushed in cascade
        const [dw, dh] = _overlap(items[i], items[j]);
        if (dw <= 0 || dh <= 0) continue;
        anyChange = true;
        if (items[i].i === movedId) {
          // moved is always ground-truth — push victim away
          _pushBestEffort(items[i], items[j], dw, dh, cols, rows);
        } else if (pinnedIds.has(items[i].i)) {
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
// Final overlap elimination pass
// ---------------------------------------------------------------------------

/**
 * Safety-net pass called after resolveCollisions at gesture stop (drag/resize).
 *
 * resolveCollisions reasons about a single "moved" pane and resolves outward
 * from it. Edge cases — complex cascades, corner resizes, multi-pane chain
 * reactions — can leave residual overlaps between non-moved pairs.
 *
 * finalizeLayout re-scans all pairs with no "moved" concept, clamping between
 * passes so off-grid pushes don't hide real overlaps. Up to 10 extra passes
 * are run; most layouts converge in 1–2. Pinned panes still have priority.
 *
 * This does NOT fix spatially impossible cases (e.g. 5 panes each needing
 * MIN_W all crammed into a strip narrower than 5×MIN_W), but it eliminates
 * overlap in every practical layout.
 */
export function finalizeLayout(
  layout: GridItem[],
  pinnedIds: Set<string>,
  cols: number = GRID_COLS,
  rows: number = GRID_ROWS,
): GridItem[] {
  const items = layout.map((it) => ({ ...it }));

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

    // Clamp between passes: out-of-bounds items shrink/shift back into the
    // grid so subsequent iterations see accurate positions. Without this,
    // a pane pushed to x=cols would remain there until the final clamp,
    // masking its true overlap with neighbouring panes.
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
 * Column-aware batch push for the y-axis.
 *
 * When items displaced downward overlap with existing items below `moved`, the
 * standard `_batchPush` treats them as a single column and runs out of space
 * because items at different x-positions don't actually compete for vertical
 * space.
 *
 * This helper groups pushed items by x-overlap, then for each group finds ALL
 * items in the same x-band (including non-pushed ones) below moved, and repacks
 * that column vertically. This ensures pushed items don't land on top of
 * existing panes.
 *
 * May shrink moved.h if the most crowded column can't fit all its items at
 * min size — a per-column cap that supplements the global size cap.
 */
function _columnBatchPush(
  moved: GridItem,
  pushed: GridItem[],
  allItems: GridItem[],
  movedId: string,
  rows: number,
  min: number,
): void {
  if (pushed.length === 0) return;

  // Build groups of pushed items that share x-overlap (union-find style).
  // Each group represents one "column band" that must be packed together.
  const groups: GridItem[][] = [];
  for (const pane of pushed) {
    const overlapping: number[] = [];
    for (let gi = 0; gi < groups.length; gi++) {
      for (const member of groups[gi]) {
        const xOvlp =
          Math.min(pane.x + pane.w, member.x + member.w) -
          Math.max(pane.x, member.x);
        if (xOvlp > 0) {
          overlapping.push(gi);
          break;
        }
      }
    }
    if (overlapping.length === 0) {
      groups.push([pane]);
    } else {
      const target = groups[overlapping[0]];
      for (let oi = overlapping.length - 1; oi >= 1; oi--) {
        target.push(...groups[overlapping[oi]]);
        groups.splice(overlapping[oi], 1);
      }
      target.push(pane);
    }
  }

  // ── Pre-pass: compute per-column item counts and cap moved.h if any column
  //    can't fit its items at min size.
  //
  //    The global size cap (_computeMaxMovedSize) assumes items distribute
  //    evenly across the full grid width. But displaced items stay in their
  //    original columns, so a column with 4 items needs 4×min vertical space.
  //    Without this per-column cap, moved grows past the point where some
  //    columns overflow, causing unresolvable pileups after Phase 3 clamp.
  let maxColumnItems = 0;
  for (const group of groups) {
    let bandLeft = Infinity;
    let bandRight = -Infinity;
    for (const p of group) {
      bandLeft = Math.min(bandLeft, p.x);
      bandRight = Math.max(bandRight, p.x + p.w);
    }
    let count = 0;
    for (const item of allItems) {
      if (item.i === movedId) continue;
      const xOvlp =
        Math.min(bandRight, item.x + item.w) - Math.max(bandLeft, item.x);
      if (xOvlp <= 0) continue;
      if (item.y + item.h <= moved.y) continue;
      count++;
    }
    maxColumnItems = Math.max(maxColumnItems, count);
  }
  if (maxColumnItems > 0) {
    const maxMovedH = rows - moved.y - maxColumnItems * min;
    if (maxMovedH < moved.h && maxMovedH >= min) {
      moved.h = maxMovedH;
    }
  }

  // For each group, collect ALL items in the same x-band below moved and repack
  const repacked = new Set<string>();
  for (const group of groups) {
    // Determine the x-band envelope for this group
    let bandLeft = Infinity;
    let bandRight = -Infinity;
    for (const p of group) {
      bandLeft = Math.min(bandLeft, p.x);
      bandRight = Math.max(bandRight, p.x + p.w);
    }

    // Find ALL items (pushed or not) that x-overlap this band and sit below
    // moved's top edge. Skip moved itself and already-repacked items.
    const columnItems: GridItem[] = [];
    const columnSet = new Set<string>();
    for (const item of allItems) {
      if (item.i === movedId) continue;
      if (repacked.has(item.i)) continue;
      const xOvlp =
        Math.min(bandRight, item.x + item.w) - Math.max(bandLeft, item.x);
      if (xOvlp <= 0) continue;
      if (item.y + item.h <= moved.y) continue; // entirely above moved
      if (!columnSet.has(item.i)) {
        columnSet.add(item.i);
        columnItems.push(item);
      }
    }

    // Sort by y and pack from moved's bottom edge
    columnItems.sort((a, b) => a.y - b.y);
    const cursorStart = moved.y + moved.h;
    const spaceBelow = rows - cursorStart;

    if (spaceBelow >= min) {
      // Normal case: pack below moved
      let cursor = cursorStart;
      for (let i = 0; i < columnItems.length; i++) {
        const pane = columnItems[i];
        const panesLeft = columnItems.length - i;
        const spaceTillEnd = rows - cursor;
        pane.y = cursor;
        pane.h = Math.max(
          min,
          Math.min(pane.h, spaceTillEnd - (panesLeft - 1) * min),
        );
        cursor = pane.y + pane.h;
        repacked.add(pane.i);
      }
    } else {
      // No room below moved (bottom-row resize). Pack items ABOVE moved.
      // Include all items in the same x-band above moved so the full column
      // is repacked together, preventing the displaced items from landing on
      // existing panes.
      const aboveItems: GridItem[] = [];
      const aboveSet = new Set<string>();
      for (const item of allItems) {
        if (item.i === movedId) continue;
        if (columnSet.has(item.i)) continue; // already in columnItems
        if (repacked.has(item.i)) continue;
        const xOvlp =
          Math.min(bandRight, item.x + item.w) - Math.max(bandLeft, item.x);
        if (xOvlp <= 0) continue;
        if (item.y + item.h > moved.y) continue; // not above moved
        if (!aboveSet.has(item.i)) {
          aboveSet.add(item.i);
          aboveItems.push(item);
        }
      }

      // Merge above items and displaced items, sort by y, pack from top to moved.y
      const fullColumn = [...aboveItems, ...columnItems];
      fullColumn.sort((a, b) => a.y - b.y);

      // Pack the entire column into [0, moved.y)
      const availableH = moved.y;
      let cursor = 0;
      for (let i = 0; i < fullColumn.length; i++) {
        const pane = fullColumn[i];
        const panesLeft = fullColumn.length - i;
        const spaceTillEnd = availableH - cursor;
        pane.y = cursor;
        pane.h = Math.max(
          min,
          Math.min(pane.h, spaceTillEnd - (panesLeft - 1) * min),
        );
        cursor = pane.y + pane.h;
        repacked.add(pane.i);
      }
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
 * Returns how many MIN_W×MIN_H panes fit in the 4 non-overlapping strips
 * surrounding moved when it has size `newSize` on the given axis.
 *
 * Strips (non-overlapping, tile the full grid minus moved):
 *   above — full width × moved.y
 *   below — full width × (rows − moved.y − mh)
 *   left  — moved.x × mh
 *   right — (cols − moved.x − mw) × mh
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
  // Fast path: current size already fits.
  if (_capacityAround(moved, axis, moved[axis], cols, rows) >= otherCount) {
    // Still need to verify the exact limit (size may exceed and we need the max).
  }
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
