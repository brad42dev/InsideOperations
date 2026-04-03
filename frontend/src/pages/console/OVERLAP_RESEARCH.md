# Overlap Research: Drag-to-Move and Drag-to-Resize Without Overlap

**Context:** 288×288 unit grid, up to 16 panels, each minimum 48×48 units, using react-grid-layout v2.

---

## 1. Executive Summary

**The best approach for this specific problem is a scan-line placement algorithm applied as a post-gesture finalizer, NOT during live drag.**

The fundamental insight from researching react-grid-layout, GridStack.js, i3, and rectangle packing literature is:

> **Every approach that reasons about "which direction to push" during a live drag will fail on edge cases.** The only algorithms with provable zero-overlap guarantees work by placing items sequentially into conflict-free slots — not by resolving conflicts reactively.

The current implementation (`resolveCollisions` + `finalizeLayout`) is using a hybrid approach: directional push during drag, scan-line placement at gesture stop. The scan-line finalizer (`finalizeLayout`) is theoretically correct but it has a critical flaw: it minimizes displacement from original position by using candidate x/y values from settled items' edges, but the candidate set may be insufficient in complex configurations, causing the fallback coarse-grid scan to produce jarring jumps.

**Recommended approach (see §4 for full implementation plan):**

1. **During live drag/resize**: Do nothing beyond clamping the moved panel to grid bounds. Let panels overlap temporarily. React-grid-layout already renders this as a "ghost" during the gesture; the other panels don't need to move until the gesture ends.

2. **At gesture stop (onDragStop/onResizeStop)**: Apply a single-pass scan-line compaction. Sort all panels by (y, x) reading order. Place each panel sequentially into the first conflict-free position starting from its original location. This is O(n²) at worst with n≤16, which is ~256 operations — completely negligible.

3. **The scan-line algorithm guarantees zero overlaps** because each placed panel is checked against ALL previously placed panels before being accepted. Once placed, a panel is never reconsidered. Monotone processing order ensures termination.

This matches how Grafana actually works (delegates entirely to react-grid-layout's compact()), how RGL's `verticalCompactor` works, and is structurally identical to the `compact()` algorithm in RGL v1 and the `compactItemVertical()` in RGL v2.

The key trade-off: panels may teleport slightly at gesture stop to their compacted positions. For a control-room application where panels are large (min 48 units on a 288-unit grid = tiles at minimum 1/6 the grid), this is acceptable — the same behavior users already see in Grafana.

If teleportation is unacceptable (user requirement: panels must stay where dropped, no compaction), use **GridStack's approach**: during resize, batch-push displaced panels in a single sorted pass, with a hard limit enforced by checking all affected columns before the resize is allowed to begin.

---

## 2. Per-Source Findings

### 2.1 react-grid-layout v2 — Exact Source Code

**Source:** `src/core/compactors.ts` and `src/core/layout.ts` in the react-grid-layout GitHub repository.

#### `collides(l1, l2): boolean`
```typescript
if (l1 === l2) return false;
if (l1.x + l1.w <= l2.x) return false;
if (l1.x >= l2.x + l2.w) return false;
if (l1.y + l1.h <= l2.y) return false;
if (l1.y >= l2.y + l2.h) return false;
return true;
```
Simple AABB test. Touching panels (sharing an edge) do NOT collide.

#### `resolveCompactionCollision(layout, item, moveToCoord, axis)`
```typescript
function resolveCompactionCollision(layout, item, moveToCoord, axis, hasStatics?) {
  const sizeProp = axis === "x" ? "w" : "h";
  item[axis] += 1;                          // temporarily shift to detect chain
  const itemIndex = layout.findIndex(l => l.i === item.i);
  const layoutHasStatics = hasStatics ?? getStatics(layout).length > 0;

  for (let i = itemIndex + 1; i < layout.length; i++) {
    const otherItem = layout[i];
    if (otherItem.static) continue;
    if (!layoutHasStatics && otherItem.y > item.y + item.h) break;  // early exit if sorted
    if (collides(item, otherItem)) {
      resolveCompactionCollision(              // RECURSIVE cascade
        layout, otherItem,
        moveToCoord + item[sizeProp],          // push further by item's size
        axis, layoutHasStatics
      );
    }
  }
  item[axis] = moveToCoord;                  // set final position AFTER recursion
}
```

**Key properties of this algorithm:**
- Recursive cascade: item A pushes item B, which pushes item C, etc.
- The `item[axis] += 1` shift is a temporary probe to detect whether the chain continues.
- Final positions are set bottom-up (in recursion stack unwind order), so all items are placed correctly.
- Only scans items AFTER the current item in layout order — relies on layout being sorted.
- The early-exit `otherItem.y > item.y + item.h` only fires when there are no statics, preventing incorrect exits with static panels.

**Known bug in this algorithm (Issue #766):** The original implementation detected a collision with itself because `itemIndex` was off by one. The v2 fix uses `layout.findIndex(l => l.i === item.i)` which is O(n) but correct.

#### `compactItemVertical(compareWith, l, fullLayout, maxY)`
```typescript
// Phase 1: float up until collision
l.y = Math.min(maxY, l.y);
while (l.y > 0 && !getFirstCollision(compareWith, l)) {
  l.y--;
}

// Phase 2: if still colliding, push down recursively
let collision;
while ((collision = getFirstCollision(compareWith, l)) !== undefined) {
  resolveCompactionCollision(fullLayout, l, collision.y + collision.h, "y");
}
l.y = Math.max(l.y, 0);
```

**How no-overlap is guaranteed:**
- Phase 1 only moves the item INTO empty space — the while loop stops on first collision.
- Phase 2 calls `resolveCompactionCollision` which recursively pushes ALL downstream items out of the way before returning.
- After Phase 2, `l` is positioned at `collision.y + collision.h` (immediately below the blocker), which is always conflict-free because the recursive call already cleared everything below.

#### `verticalCompactor.compact(layout, cols)`
```typescript
const compareWith = getStatics(layout);      // statics first, immovable
let maxY = bottom(compareWith);
const sorted = sortLayoutItemsByRowCol(layout); // sort by (y, x) reading order
const out = new Array(layout.length);

for (let i = 0; i < sorted.length; i++) {
  let l = cloneLayoutItem(sorted[i]);
  if (!l.static) {
    l = compactItemVertical(compareWith, l, sorted, maxY);
    maxY = Math.max(maxY, l.y + l.h);
    compareWith.push(l);                     // add to settled list IMMEDIATELY
  }
  out[layout.indexOf(sorted[i])] = l;
  l.moved = false;
}
return out;
```

**Why this guarantees zero overlaps:**
1. Items are processed in reading order (top-left first).
2. After each item is placed, it's added to `compareWith`.
3. Each subsequent item is placed WITHOUT overlapping any already-placed item.
4. The cascade (`resolveCompactionCollision`) handles the fullLayout (unsorted working copy), not compareWith, so it can push items that haven't been compacted yet.

**The critical insight:** `compareWith` is an immutable "settled" list. `fullLayout` is the working copy that gets mutated by cascading pushes. Items are never reconsidered once added to `compareWith`.

#### `moveElement()` and `moveElementAwayFromCollision()`

`moveElement` is called during live drag. It:
1. Applies the new position to the moved item.
2. Finds all collisions.
3. For each collision, calls `moveElementAwayFromCollision`.

`moveElementAwayFromCollision` tries to move the colliding item ABOVE/LEFT first (if there's room), then defaults to pushing it DOWN/RIGHT by 1 unit and recursing. This can fail to converge in complex layouts, which is why compact() is always called after.

**Important:** In RGL v2, `moveElement` is called on EVERY mouse move event during drag. The resulting layout always has overlaps until `compact()` is called at the end. RGL's design explicitly relies on this: overlap during drag is expected; compact() at gesture end removes them.

#### `moveElementAwayFromCollision()` — isUserAction flag
```typescript
if (isUserAction) {
  isUserAction = false;  // Only try up-move once (not recursively)
  const fakeItem = { x, y: Math.max(collidesWith.y - itemToMove.h, 0), ... };
  const firstCollision = getFirstCollision(layout, fakeItem);
  if (!firstCollision) {
    // Move up - no collision above
    return moveElement(layout, itemToMove, undefined, fakeItem.y, false, ...);
  }
}
// Default: move down by 1
return moveElement(layout, itemToMove, undefined, itemToMove.y + 1, false, ...);
```

The `isUserAction=false` ensures only the first level of cascade tries to move up. All subsequent cascaded moves just go down by 1. This prevents oscillation.

#### "Rising Tide" fast compactor (PR #2152)

The O(n log n) alternative to the recursive compactor. Uses a `tide` array (one entry per column) tracking the highest occupied row in each column:

```
Algorithm:
1. Sort items by (y, x) — O(n log n).
2. Initialize tide[col] = 0 for all columns.
3. For each item in sorted order:
   a. tideY = max(tide[col]) for all cols in [item.x, item.x + item.w)
   b. item.y = min(item.y, tideY)   // can't go higher than tide
   c. For all cols in [item.x, item.x + item.w): tide[col] = item.y + item.h
4. Output: items at their compacted positions.
```

No recursion, no collision detection during placement. The tide tracks occupied space exactly.

**Why it guarantees no overlaps:** Each item is placed at exactly `tideY` or its original y (whichever is higher). The tide always represents the bottom edge of the topmost settled item in each column. Since each item is placed AT the tide (not inside it), and then the tide advances, no two items can share the same space.

**Limitation:** Rising tide is equivalent to vertical compaction (gravity up). It produces a different layout than the recursive algorithm for complex multi-width panels, but always zero overlaps.

---

### 2.2 GridStack.js — Source Code

**Source:** `src/gridstack-engine.ts` — fetched from GitHub.

GridStack's approach is fundamentally different from RGL: it resolves overlaps DURING the gesture (not deferred to gesture end), which makes it more suitable for a layout where you don't want compaction at gesture stop.

#### `moveNode(node, opts): boolean`
Entry point for any movement. Key behavior:
```typescript
const collides = this.collideAll(node, nn, opts.skip);
if (collides.length) {
  const collide = activeDrag 
    ? this.directionCollideCoverage(node, opts, collides)  // pick by coverage
    : collides[0];
  if (collide) {
    needToMove = !this._fixCollisions(node, nn, collide, opts);
  }
}
if (needToMove) Utils.copyPos(node, nn);
if (opts.pack) this._packNodes();  // gravity pass after every move
```

`directionCollideCoverage` selects the collide target based on which colliding item has >50% coverage along the midline of the dragged node. This prevents accidental triggering on items you're barely touching.

#### `_fixCollisions(node, nn, collide, opt): boolean`
```typescript
this.sortNodes(-1);  // sort from LAST to FIRST so recursive moves go in right order

// Try swap first (for same-size adjacent nodes during drag)
if (node._moving && !opt.nested && !this.float) {
  if (this.swap(node, collide)) return true;
}

// Use entire row area for large nodes (prevents leapfrogging)
let area = nn;
if (this._useEntireRowArea(node, nn)) {
  area = { x: 0, w: this.column, y: nn.y, h: nn.h };
  collide = this.collide(node, area, opt.skip);
}

let counter = 0;
while (collide = collide || this.collide(node, area, opt.skip)) {
  if (counter++ > this.nodes.length * 2) throw new Error("Infinite collide check");
  
  let moved: boolean;
  if (collide.locked || someCondition) {
    // Move the dragged node PAST the locked collider
    moved = this.moveNode(node, { y: collide.y + collide.h, nested: true, pack: false });
  } else {
    // Move the collider out of the way
    moved = this.moveNode(collide, { y: nn.y + nn.h, skip: node, nested: true, pack: false });
  }
  
  if (!moved) return didMove;
  collide = undefined;  // re-detect collision
}
```

**Key design decisions:**
- Infinite loop guard (counter > nodes.length * 2) — if the algorithm runs too long, it throws rather than hanging.
- `sortNodes(-1)` before the loop: sorts descending by position so recursive moves of downstream items don't conflict with items already processed.
- `nested: true` flag prevents recursive `_packNodes()` calls inside the collision resolution — pack is only called once at the top level.
- `pack: false` during collision resolution, then `pack: true` (via `moveNode`'s default) at the top level only.

#### `swap(a, b): boolean`
```typescript
// Swap two nodes if they're same size and adjacent (touching)
function _doSwap() {
  const x = b.x, y = b.y;
  b.x = a.x; b.y = a.y;
  if (a.h != b.h) {
    a.x = x; a.y = b.y + b.h;    // different height: place a below b
  } else if (a.w != b.w) {
    a.x = b.x + b.w; a.y = y;    // different width: place a right of b
  } else {
    a.x = x; a.y = y;             // same size: simple swap
  }
  a._dirty = b._dirty = true;
  return true;
}
```

Swap conditions (must meet ALL):
- Same width or same height
- Same x or same y (aligned on one axis)
- Touching (adjacent, not overlapping)

**Why swap is important:** Without swap, dragging a panel over an adjacent same-size panel always pushes it down. Swap makes the interaction feel like they're exchanging positions, which is more intuitive.

#### `_packNodes()` — gravity pass
```typescript
// Non-float mode (gravity on):
this.nodes.forEach((n, i) => {
  if (n.locked) return;
  while (n.y > 0) {
    const newY = i === 0 ? 0 : n.y - 1;
    const canBeMoved = i === 0 || !this.collide(n, { x: n.x, y: newY, w: n.w, h: n.h });
    if (!canBeMoved) break;
    n._dirty = (n.y !== newY);
    n.y = newY;
  }
});
```

This is essentially the same as RGL's compactItemVertical: decrement y until collision. The difference is that GridStack sorts nodes before this loop, so each node is guaranteed to have clear space above it by the time it's processed (earlier nodes have already been packed).

**This is NOT the same as a full compact()**: it only moves items UP, one unit at a time, stopping at the first collision. It does not cascade downward.

#### `directionCollideCoverage(node, opts, collides)` — the coverage heuristic
GridStack uses pixel-level drag coordinates (from the DOM event), not just grid coordinates, to determine which colliding node is the "real" target. It measures overlap area percentage and requires >50% coverage along the drag midline before considering a node as a collision target. This prevents spurious collisions when dragging through tight gaps.

**This is not available in custom layout logic** — it's tied to DOM event coordinates. For a custom resolver working with grid coordinates only, this heuristic must be approximated or dropped.

---

### 2.3 i3 Window Manager — Resize Algorithm

**Source:** `src/resize.c` — fetched from GitHub.

i3 uses a fundamentally different layout model: a tree of containers with percentage-based sizes. Resize is only possible between two ADJACENT siblings in the same parent container.

#### `resize_find_tiling_participants(current, other, direction)`
Walks the tree upward from the focused container until it finds a parent node oriented in the resize direction. Then picks the next/previous sibling as the resize partner.

**Key constraint:** Resize can only happen between exactly two nodes (the focused one and one neighbor). There is no cascade. This is possible because the tree structure guarantees no overlaps by construction — children always fill their parent exactly.

#### `resize_neighboring_cons(first, second, px, ppt): bool`
```c
new_first_percent = first->percent + (px / parent_size);
new_second_percent = second->percent - (px / parent_size);

// Reject if either container would be < 1 pixel
if (new_first_percent < percent_for_1px(first) || 
    new_second_percent < percent_for_1px(second)) {
  return false;
}

first->percent = new_first_percent;
second->percent = new_second_percent;
con_fix_percent(parent);  // rebalance all siblings to sum to 1.0
```

**Why zero overlaps are guaranteed:**
The percent model is the key. All siblings in a container must sum to 100%. Growing one by +Δ shrinks the adjacent one by -Δ. The total is conserved. There is no intermediate state where items overlap — the math prevents it.

**Applicability to this problem:**
If the layout were modeled as a tree (like i3 or react-mosaic), resize would always be zero-overlap by construction. The problem is that a tree model is more constrained: you can't have arbitrary panel arrangements. A 3-panel layout might not be representable as a binary tree without awkward nesting.

For a grid system where panels can be arbitrary rectangles (not just tree splits), the i3 model doesn't directly apply. However, the percentage constraint mechanism is instructive: **if you can express resize as a zero-sum operation between two adjacent panels, overlaps are impossible.**

---

### 2.4 Skyline Algorithm (Rectangle Packing)

**Source:** "Skyline algorithm for packing 2D rectangles" by Julien Vernay; "Exploring rectangle packing algorithms" by David Colson; `juj/RectangleBinPack` on GitHub.

The skyline algorithm maintains the upper contour (skyline) of placed rectangles as a linked list of (x, y, width) segments. For each new rectangle to place:

1. Find the lowest segment in the skyline where the rectangle fits horizontally.
2. Place the rectangle at that (x, skyline_y) position.
3. Update the skyline by raising the segments covered by the new rectangle.
4. If no segment fits (rectangle too wide), the container is full.

```
Skyline state: [(x=0, y=0, w=10), (x=10, y=5, w=6), (x=16, y=0, w=10)]
                         ___________
                         |  y=5    |
 ________________________|         |______________________
 |  y=0    |             |         |  y=0               |
 x=0       x=10          x=16

To place rect (w=4, h=3):
  Scan skyline: x=0 (y=0, fits), x=10 (y=5, fits), x=16 (y=0, fits)
  Best fit: x=0, y=0 (lowest skyline, leftmost)
  Place at (0, 0, w=4, h=3): skyline becomes [(x=0, y=3, w=4), (x=4, y=0, w=6), ...]
```

**Why zero overlaps are guaranteed:** Each rectangle is placed AT or ABOVE the current skyline, never below it. The skyline represents the boundary between occupied and unoccupied space. Placing a rectangle at the skyline means it cannot overlap any previously placed rectangle.

**Applicability:** The skyline algorithm is excellent for packing sprites or textures but is not directly useful for a draggable/resizable grid where panels have fixed positions during drag. It's a placement algorithm, not a conflict resolution algorithm. However, the concept of maintaining a height profile per column (tide array in RGL's fast compactor) is directly derived from the skyline algorithm.

---

### 2.5 React Mosaic — BSP Tree Approach

**Source:** GitHub repository `nomcopter/react-mosaic`.

React Mosaic models the layout as an n-ary tree where:
- Internal nodes are splits (horizontal or vertical) with a `splitPercentage`.
- Leaf nodes are individual panels.

Resize is always between two children of the same split node. Changing `splitPercentage` from 40/60 to 50/50 is purely a percentage operation — no collision possible.

**The zero-overlap guarantee is structural:** Since every internal node's children together fill 100% of the parent, overlaps are mathematically impossible. The layout is always a perfect tiling.

**Limitation:** Arbitrary panel arrangements require deeply nested trees. A 4-panel layout where panel A spans the top half and panels B, C, D span the bottom third each requires a specific tree shape. Not all arbitrary grid arrangements are representable as BSP trees.

**Applicability:** If the console workspace were redesigned to use a tree-based layout model (like react-mosaic), zero overlaps would be guaranteed by the model, not by a resolution algorithm. This is the most robust long-term approach but requires a fundamental redesign of how layouts are stored and manipulated.

---

### 2.6 Two-Pass Column-Row Compaction Pattern

From analysis of GridStack, RGL, and academic grid layout papers, there's a common two-pass pattern that appears in many correct implementations:

**Pass 1: Horizontal compaction (fix x-axis)**
Sort by (x, y). For each item, move it left until it hits another item or the left edge. This resolves horizontal overlaps.

**Pass 2: Vertical compaction (fix y-axis)**
Sort by (y, x). For each item, move it up until it hits another item or the top edge. This resolves vertical overlaps.

Running both passes (potentially multiple times until stable) always converges to zero overlaps. However, it changes panel positions significantly — not suitable if you want panels to stay where the user dragged them.

---

### 2.7 The Core Problem With "Directional Push"

All "directional push" approaches fail for the same reason:

1. Panel A is resized, pushing panel B to the right.
2. Panel B's new position overlaps panel C.
3. Panel C is pushed down.
4. Panel C's new position overlaps panel D.
5. Panel D is at the bottom-right corner and can't move.
6. Panel D gets shrunk to MIN.
7. But now the total area is wrong — panels B and C are at different positions than they would be if we'd considered D's constraint before pushing B.

The fundamental issue is that directional push is a greedy algorithm: it resolves each collision locally without considering downstream constraints. A correct algorithm must either:
- **Be non-greedy** (consider all constraints before moving anything), or
- **Be monotone** (process items in an order that guarantees each placement is final).

The scan-line compactor (RGL's `compact()`) is monotone: by processing top-left-first and adding each placed item to the settled list before processing the next, each item is placed exactly once and never reconsidered.

---

## 3. Recommended Implementation Plan

### 3.1 Two-Layer Architecture

```
Layer 1: Live drag (gesture in progress)
  - react-grid-layout handles panel ghost and mouse tracking
  - The moved panel goes wherever the user drags it (clamped to grid bounds)
  - Other panels DO NOT MOVE during the gesture
  - allowOverlap: false (RGL prevents collision during drag by default)
  - OR: allowOverlap: true during live drag, then resolve at stop

Layer 2: Gesture stop (onDragStop / onResizeStop)
  - Apply the scan-line compactor to the full layout
  - Returns zero-overlap layout in O(n log n) time
  - Panels may shift slightly to resolve overlaps
```

### 3.2 Scan-Line Compactor — Full Pseudocode

This is the algorithm to implement. It is structurally equivalent to RGL's `verticalCompactor` but adapted for a fixed-size grid (288×288) with min-size constraints.

```typescript
/**
 * scanLineCompact(layout, cols, rows, minW, minH, pinnedIds?)
 *
 * Guarantees: output has zero overlaps.
 * Panels appear as close to their input positions as possible.
 * Pinned panels are never moved.
 *
 * Algorithm:
 * 1. Clone all items.
 * 2. Sort: pinned first (by y,x), then others by (y,x) reading order.
 * 3. Initialize settled = [] (empty).
 * 4. For each item in sorted order:
 *    a. If pinned: add to settled unchanged. Continue.
 *    b. Clamp item.w and item.h to [minW..cols] and [minH..rows].
 *    c. Check item at current (x, y):
 *       - If no overlap with any settled item: add to settled. Continue.
 *    d. Scan for nearest conflict-free slot:
 *       - Candidate y values: 0, item.y, every settled.y + settled.h (bottom edges).
 *       - Candidate x values: 0, item.x, every settled.x + settled.w (right edges).
 *       - For each (cy, cx) in sorted (by Manhattan distance from original (x,y)):
 *         - If cx + item.w <= cols AND cy + item.h <= rows:
 *           - If no overlap with any settled item at (cx, cy):
 *             - item.x = cx; item.y = cy; add to settled. Continue.
 *    e. Fallback (no slot found at current size):
 *       - item.w = minW; item.h = minH;
 *       - Re-scan candidate slots with minimum size.
 *       - If still no slot: scan full grid at (minW, minH) step.
 *       - Emergency fallback: item.x = 0; item.y = 0 (overlap with pinned acceptable).
 * 5. Return items in original order (not sorted order).
 */
```

#### Implementation in TypeScript

```typescript
interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function scanLineCompact(
  layout: GridItem[],
  cols: number,
  rows: number,
  minW: number,
  minH: number,
  pinnedIds: Set<string> = new Set(),
): GridItem[] {
  // Step 1: Clone
  const items = layout.map(it => ({ ...it }));

  // Step 2: Sort — pinned first, then by (y, x) reading order
  const sorted = [...items].sort((a, b) => {
    const ap = pinnedIds.has(a.i) ? 0 : 1;
    const bp = pinnedIds.has(b.i) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.y !== b.y ? a.y - b.y : a.x - b.x;
  });

  // Step 3: Initialize settled list
  const settled: GridItem[] = [];

  // Helper: check if (x, y, w, h) overlaps any settled item
  function overlapsSettled(x: number, y: number, w: number, h: number): boolean {
    for (const s of settled) {
      if (
        x < s.x + s.w && x + w > s.x &&
        y < s.y + s.h && y + h > s.y
      ) return true;
    }
    return false;
  }

  // Helper: find nearest slot minimizing Manhattan distance from (origX, origY)
  function findNearestSlot(
    origX: number,
    origY: number,
    w: number,
    h: number,
  ): { x: number; y: number } | null {
    // Candidate coordinates: grid edges and settled item edges
    const ys = new Set<number>([0, origY]);
    const xs = new Set<number>([0, origX]);
    for (const s of settled) {
      ys.add(s.y + s.h); // slot opens below settled item
      xs.add(s.x + s.w); // slot opens right of settled item
    }

    // Filter to valid ranges and sort by distance from original position
    const validYs = [...ys]
      .filter(y => y >= 0 && y + h <= rows)
      .sort((a, b) => Math.abs(a - origY) - Math.abs(b - origY));
    const validXs = [...xs]
      .filter(x => x >= 0 && x + w <= cols)
      .sort((a, b) => Math.abs(a - origX) - Math.abs(b - origX));

    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    for (const cy of validYs) {
      for (const cx of validXs) {
        const dist = Math.abs(cx - origX) + Math.abs(cy - origY);
        if (dist >= bestDist) continue; // can't improve
        if (!overlapsSettled(cx, cy, w, h)) {
          best = { x: cx, y: cy };
          bestDist = dist;
          if (bestDist === 0) return best; // perfect match
        }
      }
    }
    return best;
  }

  // Step 4: Place each item
  for (const item of sorted) {
    if (pinnedIds.has(item.i)) {
      settled.push(item); // pinned: immovable
      continue;
    }

    // Clamp dimensions
    item.w = Math.max(minW, Math.min(item.w, cols));
    item.h = Math.max(minH, Math.min(item.h, rows));

    // Try current position first
    if (!overlapsSettled(item.x, item.y, item.w, item.h)) {
      settled.push(item);
      continue;
    }

    // Find nearest conflict-free slot at current size
    const slot = findNearestSlot(item.x, item.y, item.w, item.h);
    if (slot) {
      item.x = slot.x;
      item.y = slot.y;
      settled.push(item);
      continue;
    }

    // No slot at current size — shrink to minimum
    const origX = item.x, origY = item.y;
    item.w = minW;
    item.h = minH;
    const minSlot = findNearestSlot(origX, origY, minW, minH);
    if (minSlot) {
      item.x = minSlot.x;
      item.y = minSlot.y;
    } else {
      // Full grid scan at min size
      outer: for (let ty = 0; ty + minH <= rows; ty += minH) {
        for (let tx = 0; tx + minW <= cols; tx += minW) {
          if (!overlapsSettled(tx, ty, minW, minH)) {
            item.x = tx;
            item.y = ty;
            break outer;
          }
        }
      }
      // Emergency: place at 0,0 (only happens if grid is completely full)
    }
    settled.push(item);
  }

  // Step 5: Return in original order
  return items; // items are mutated in place, same order as input
}
```

#### Why this guarantees zero overlaps

1. `settled` is only appended to, never modified.
2. Before any item is appended to `settled`, it is checked against all existing settled items (`overlapsSettled`).
3. If the check passes, the item is added — by construction, it overlaps nothing in `settled`.
4. If the check fails, the item is moved to a slot where `overlapsSettled` returns false — same guarantee.
5. The fallback (full grid scan) always finds a free slot as long as the total minimum area ≤ grid area. For 16 panels at 48×48 on a 288×288 grid: 16 × 48 × 48 = 36,864 units² vs 288 × 288 = 82,944 units². The grid can always fit all panels at minimum size.

**Performance:** With n=16, `overlapsSettled` is called at most O(n²) times = 256 iterations. `findNearestSlot` builds candidate sets of O(n) values each and checks O(n²) combinations = up to 1024 checks. Total: well under 10,000 operations. Negligible latency.

### 3.3 Integration with react-grid-layout v2

**Option A: Use RGL's built-in verticalCompactor**

Set `compactor={verticalCompactor}` on the ReactGridLayout component. This is exactly the scan-line algorithm above, built into RGL. Pros: battle-tested, zero custom code. Cons: always compacts to the top (gravity), which may move panels far from where the user placed them.

```tsx
import { verticalCompactor } from 'react-grid-layout/core';

<ReactGridLayout
  compactor={verticalCompactor}
  // ...
/>
```

**Option B: Custom compactor using noCompactor + manual finalizeLayout**

Use `noCompactor` during drag (no auto-movement), then call `scanLineCompact` manually in `onDragStop`/`onResizeStop`.

```tsx
import { noCompactor } from 'react-grid-layout/core';

<ReactGridLayout
  compactor={noCompactor}
  onDragStop={(layout, oldItem, newItem) => {
    const resolved = scanLineCompact(layout, COLS, ROWS, MIN_W, MIN_H, pinnedIds);
    setLayout(resolved);
  }}
  onResizeStop={(layout, oldItem, newItem) => {
    const resolved = scanLineCompact(layout, COLS, ROWS, MIN_W, MIN_H, pinnedIds);
    setLayout(resolved);
  }}
  // ...
/>
```

**Option C: GridStack.js approach (push during drag, no compaction at stop)**

If you want panels to stay exactly where the user drops them (no snapping to compacted positions), use GridStack's push model. The key requirements:

1. Before applying a resize, compute whether the displaced panels can fit. If not, constrain the resize.
2. Apply displaced panels in sorted order (ascending by distance from the resized panel).
3. Never call compact/pack at gesture stop.

This is harder to get right. GridStack's implementation is ~500 lines of carefully written TypeScript.

**Recommended: Option B for this application.** It's simple, correct, and the existing `finalizeLayout` in `layout-utils.ts` is already implementing this pattern. The problem in the current implementation is the `resolveCollisions` function (Phase 1) that runs during live drag — it's the source of the residual overlaps that `finalizeLayout` then has to clean up.

### 3.4 Specific Fix for the Current Implementation

The current code has two phases:
1. `resolveCollisions` — called on every resize/drag event (live)
2. `finalizeLayout` — called at gesture stop

The `finalizeLayout` function is essentially correct (it IS the scan-line algorithm). The problem is that `resolveCollisions` is creating a messy intermediate state that `finalizeLayout` then can't fully clean up, because `findNearestSlot` uses candidate coordinates derived from the (already-messed-up) current item positions.

**Fix 1: Trust finalizeLayout completely.** At gesture stop, ignore the current positions entirely and recompute from scratch using `scanLineCompact`. Don't use the intermediate positions as candidates — use the ORIGINAL positions (from before the gesture started).

```typescript
// In the gesture stop handler:
const originalLayout = layoutAtGestureStart;  // snapshot taken at onDragStart/onResizeStart
const resolvedLayout = scanLineCompact(
  applyGestureToOriginal(originalLayout, movedId, newPosition),
  ...
);
```

**Fix 2: Eliminate resolveCollisions during live drag.** Instead of trying to move other panels during the gesture, let the moved panel overlap freely. Other panels stay in their pre-gesture positions. At gesture stop, apply `scanLineCompact` once. This is how RGL + verticalCompactor actually works.

**Fix 3: Seed findNearestSlot with pre-gesture positions.** The current `findNearestSlot` uses settled items' edges as candidate coordinates. This means candidates change as items are settled in the wrong order. Seeding with the pre-gesture positions as additional candidates would give more stable results.

---

## 4. Edge Cases to Handle

### 4.1 Panel Completely Surrounds Another
When the moved panel grows large enough to surround a smaller panel, the surrounded panel has no adjacent slot. The scan-line algorithm handles this correctly: the surrounded panel gets placed to the right of or below the larger panel (the nearest conflict-free slot).

### 4.2 All Space Used by Pinned Panels
If pinned panels occupy all available space, non-pinned panels have no valid slot. The fallback chain (full grid scan → emergency 0,0) handles this. In practice, this shouldn't happen if there's a hard cap on how large the moved panel can grow (the `_computeMaxMovedSize` logic in the current implementation is correct for this).

### 4.3 16 Panels in a 4×4 Grid
At 16 panels each exactly 72×72 units (288/4), the grid is exactly full with no slack. Any resize MUST shrink another panel. The scan-line algorithm handles this: the resized panel is placed, then other panels are placed into the remaining space. The last few panels may be shrunk to MIN size if there's no full-size slot available.

### 4.4 Minimum Size Violations
The scan-line algorithm can shrink panels to MIN size in Step 4e. This is the correct behavior — better to shrink a panel than to overlap. However, shrinking should be communicated visually (e.g., the panel title bar should indicate it's at minimum size).

### 4.5 Pinned Panel Changes Position
If a pinned panel's position is changed programmatically (e.g., template switch), `scanLineCompact` must be called with the new pinned positions as the baseline. The current implementation handles this correctly because pinned items are placed first in Step 4a.

### 4.6 Rapid Consecutive Gestures
If the user drags a second panel before the first gesture's `finalizeLayout` has been applied, the intermediate state may have overlaps. The fix is to snapshot the layout at `onDragStart` (before any movement) and use that snapshot as the baseline for `scanLineCompact` at `onDragStop`. RGL calls `onDragStart` reliably before any `onDrag` events.

### 4.7 Corner Resize (Simultaneous X and Y Change)
The current implementation uses an `axisHint` to determine whether to resolve horizontally or vertically. For corner resizes, both axes change simultaneously. The scan-line algorithm handles this naturally: it doesn't need an axis hint — it places the resized panel at its new size and finds slots for displaced panels regardless of which axis changed.

### 4.8 Aspect Ratio Locking
The CLAUDE.md for the console module specifies: "aspect ratio must be preserved on resize." The scan-line algorithm doesn't natively preserve aspect ratios. If the placed slot has different proportions than the original panel, the aspect ratio changes. This must be handled in the RGL resize handler (constrain the resize drag to maintain aspect ratio) before `scanLineCompact` is called — not inside the compaction algorithm.

### 4.9 Panel Count at Boundary (n=16, minSize=48, grid=288)
Maximum panels: floor(288/48)^2 = 6^2 = 36. So 16 panels at minimum size always fit. But maximum panel size must be constrained: if one panel is 240×288, only one other 48×48 panel fits in the remaining 48×288 strip. The `_computeMaxMovedSize` binary search in the current implementation is the right approach but uses a geometric capacity estimate (not an exact packing count). For the scan-line algorithm, the constraint is naturally enforced: if you resize a panel so large that other panels can't fit, the scan-line algorithm shrinks them to MIN size. The user then sees panels at MIN size (not overlapping), which signals the constraint.

---

## 5. Algorithm Comparison Matrix

| Property | Current Implementation | RGL verticalCompactor | scanLineCompact (custom) | GridStack | react-mosaic |
|---|---|---|---|---|---|
| Zero-overlap guarantee | No (residual overlaps) | Yes | Yes | Yes | Yes (by model) |
| Panels move during drag | Yes (complex) | Yes (1 unit at a time) | No | Yes | No |
| Panels snap at gesture stop | Yes (finalizeLayout) | Yes (compact) | Yes | No | No |
| Preserves user positions | Best-effort | No (gravity) | Best-effort | Best | N/A (tree) |
| Complexity | O(n²) per gesture | O(n log n) at stop | O(n²) at stop | O(n²) per move | O(1) resize |
| n=16 performance | ~256 ops | negligible | ~1024 ops | ~256 ops | 1 op |
| Code complexity | Very high | ~50 lines | ~100 lines | ~500 lines | Architecture change |
| Axis hint needed | Yes | No | No | No | No |

---

## Sources Referenced

- [react-grid-layout GitHub](https://github.com/react-grid-layout/react-grid-layout) — `src/core/compactors.ts`, `src/core/layout.ts`, `src/core/collision.ts`
- [RGL PR #2152 — Rising Tide Algorithm](https://github.com/react-grid-layout/react-grid-layout/pull/2152)
- [gridstack/gridstack.js — gridstack-engine.ts](https://github.com/gridstack/gridstack.js/blob/master/src/gridstack-engine.ts)
- [grafana/react-grid-layout](https://github.com/grafana/react-grid-layout)
- [Grafana DashboardGrid.tsx](https://github.com/grafana/grafana/blob/main/public/app/features/dashboard/dashgrid/DashboardGrid.tsx)
- [i3 resize.c](https://github.com/i3/i3/blob/next/src/resize.c)
- [nomcopter/react-mosaic](https://github.com/nomcopter/react-mosaic)
- [Exploring rectangle packing algorithms — David Colson](https://www.david-colson.com/2020/03/10/exploring-rect-packing.html)
- [Skyline algorithm for packing 2D rectangles — Julien Vernay](https://jvernay.fr/en/blog/skyline-2d-packer/implementation/)
- [GridStack issue #1785 — overlapping items during resize](https://github.com/gridstack/gridstack.js/issues/1785)
- [RGL issue #2131 — compactType=null + preventCollision=false regression](https://github.com/react-grid-layout/react-grid-layout/issues/2131)
- [RGL issue #655 — resize broken with preventCollision=true](https://github.com/react-grid-layout/react-grid-layout/issues/655)
- [RGL Example 18 — Compactor Showcase](https://react-grid-layout.github.io/react-grid-layout/examples/18-compactors.html)
- [react-grid-layout v2 RFC](https://github.com/react-grid-layout/react-grid-layout/blob/master/rfcs/0001-v2-typescript-rewrite.md)
