# Console Pane Layout Overhaul Plan

**Status:** READY TO IMPLEMENT  
**Spec authority:** `/home/io/spec_docs/console-implementation-spec.md`  
**Grid library:** react-grid-layout v2 (non-negotiable per CLAUDE.md)

---

## User Requirements (confirmed)

| Topic | Decision |
|-------|----------|
| Layout model | Grid with snapping (rgl) — gaps allowed, no forced gapless fill |
| Neighbor response | Smart nearest-neighbor shrink: most-overlapped neighbor shrinks first; if it hits min size, recursively try its neighbors; if nothing gives, clamp the drag |
| Pin behaviour | Protected from displacement only — user can still manually move/resize a pinned pane; other panes just can't push/shrink it |
| Lock = ON | Fully frozen: no drag, no resize, no × buttons, no pin UI |
| Lock = OFF | All handles visible; panes freely drag/resize; palette drop adds; right-click removes |
| Edit mode | Removed entirely; lock toggle replaces it |
| Layout presets | Reflow: sort existing panes left→right top→bottom, map to new template slots in same order; extra panes dropped, empty slots left blank |
| Add/remove panes | Palette drop, right-click menu, × button on pane header |

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/console/types.ts` | Add `pinned?: boolean` to `PaneConfig` |
| `src/store/workspaceStore.ts` | Remove `editMode`; add `locked: boolean`; add `toggleLocked`, `pinPane` actions; update `changeLayout` reflow |
| `src/pages/console/WorkspaceGrid.tsx` | Remove editMode deps; implement smart collision resolver in `onDrag`/`onResize`; always show handles unless locked |
| `src/pages/console/PaneWrapper.tsx` | Always show drag handle / resize / × unless locked; add pin button |
| `src/pages/console/index.tsx` | Remove Edit/Done; add lock button to toolbar; remove `editMode` state threading; update layout-preset UI to always be visible |
| `src/pages/console/ConsolePalette.tsx` | Drop-to-add no longer requires edit mode |

---

## Step-by-Step Implementation

### Step 1 — Type changes (`types.ts`)

Add `pinned?: boolean` to `PaneConfig`. No other changes.

---

### Step 2 — Store changes (`workspaceStore.ts`)

**Remove:**
- `editMode: boolean` state
- `setEditMode` action

**Add:**
- `locked: boolean` (default `false`) — persisted per workspace in `WorkspaceLayout`
- `toggleLocked(workspaceId)` — flips `locked` on the workspace
- `pinPane(workspaceId, paneId)` — sets `pane.pinned = true`
- `unpinPane(workspaceId, paneId)` — sets `pane.pinned = false`

**Update `changeLayout(workspaceId, preset)`:**
```
1. Get template slots for new preset (list of {x,y,w,h} in grid units)
2. Get existing panes, sorted: by y asc, then x asc (top-left → right → down)
3. Zip panes to slots:
   - If pane count ≤ slot count: map each pane to a slot, pad with blank panes for remaining slots
   - If pane count > slot count: truncate — extra panes are dropped
4. Each mapped pane keeps its existing content/config; only x,y,w,h change
```

`WorkspaceLayout` gets a new `locked?: boolean` field (persisted in API metadata blob and localStorage).

---

### Step 3 — Collision resolution algorithm

Implement as a pure function in a new file:  
`src/pages/console/layout-utils.ts`

```typescript
// Grid constants
const MIN_W = 2;  // minimum pane width in grid units
const MIN_H = 2;  // minimum pane height in grid units

interface GridItem { i: string; x: number; y: number; w: number; h: number }

/**
 * Resolves collisions after pane `movedId` has been dragged/resized to its
 * new position. Returns the full adjusted layout.
 *
 * Strategy (for each overlapping non-pinned pane B):
 *   1. Determine which side of B that A is encroaching from (left, right, top, bottom)
 *   2. Shrink B on that side
 *   3. If B hits MIN_W/MIN_H, recursively try B's other overlapping neighbors
 *   4. If nobody can give, clamp A back so the overlap is eliminated
 *
 * Pinned panes are immovable — A is clamped instead.
 */
export function resolveCollisions(
  layout: GridItem[],
  movedId: string,
  pinnedIds: Set<string>,
  cols: number,
  rows: number,
): GridItem[]
```

**Shrink direction logic:**

When A (new bounds) overlaps B (current bounds):
- Compute overlap rectangle: `ox = max(ax,bx)..min(ax+aw,bx+bw)`, `oy = max(ay,by)..min(ay+ah,by+bh)`
- Overlap width `dw = min(ax+aw,bx+bw) - max(ax,bx)`
- Overlap height `dh = min(ay+ah,by+bh) - max(ay,by)`
- Choose the axis with the smaller overlap (less disruptive):
  - If `dw < dh`: shrink B horizontally
    - If A's right edge > B's left edge (A encroaches from left): `bx = ax+aw; bw = (oldBx+bw) - bx`
    - Else (A encroaches from right): `bw = ax - bx`
  - Else: shrink B vertically (same logic, vertical axis)
- If resulting `bw < MIN_W` or `bh < MIN_H`:
  - Try to pass the displacement to B's own overlapping neighbors (recursive, depth-limited to 3)
  - If still can't resolve: clamp A's edge so that B stays at MIN size

**Bounds clamping:**
- After resolving, clamp all panes: `x >= 0`, `y >= 0`, `x+w <= cols`, `y+h <= rows`
- If a pane would exceed bounds after shrinking, continue shrinking (minimum wins)

---

### Step 4 — WorkspaceGrid (`WorkspaceGrid.tsx`)

**Remove:** all `editMode` conditionals for handle visibility and drag enable.

**Add:**
- Accept `locked: boolean` and `pinnedIds: Set<string>` props
- When `locked`: pass `isDraggable={false}` and `isResizable={false}` to rgl
- In `onDrag(layout, oldItem, newItem)`:
  1. Run `resolveCollisions(layout, newItem.i, pinnedIds, cols, rows)`
  2. If resolver clamped `newItem`, return the clamped layout (rgl will use it)
- In `onResize(layout, oldItem, newItem)`:
  1. Same collision resolver
- Enforce `minW={MIN_W}` and `minH={MIN_H}` per item
- No layout compaction: keep `compactType={null}`

---

### Step 5 — PaneWrapper (`PaneWrapper.tsx`)

**Remove:** `editMode` prop and all `editMode &&` guards on drag handle, resize handles, and × button.

**Replace with:** `locked: boolean` prop — when `locked`, hide all interactive controls.

**Add:** Pin button in pane header (visible when not locked):
- Icon: pushpin SVG (filled = pinned, outline = unpinned)
- `onClick`: calls `onPinToggle(paneId)`
- Visual: when pinned, header gets a subtle `var(--io-accent-subtle)` background tint and a small pin indicator

Drag handle class (`io-pane-drag-handle`) is always on the title bar div, but rgl respects `isDraggable` at the grid level.

---

### Step 6 — index.tsx

**Remove:**
- `editMode` state and `setEditMode`
- Edit button, Done button, all edit-mode UI (layout picker was in edit mode → move to always-visible toolbar)
- `saveEdit()` function (no longer needed)

**Add to toolbar (always visible when workspace active):**
- Lock button: padlock icon, toggles `locked`. When locked: filled padlock + accent color; when unlocked: open padlock + muted color.
- Layout preset dropdown (moved from edit-mode section to main toolbar)
- × close, duplicate, rename still in right-click context menus and palette sidebar

**Threading:** Replace every `editMode` prop passed to child components with `locked` prop.

**Palette drop:** Remove the guard that required `editMode` to be true before accepting a palette drop — drops always work unless locked (check `locked` and return early if so).

---

### Step 7 — ConsolePalette (`ConsolePalette.tsx`)

Remove any `editMode` check in drop handling. Drops are always accepted unless the workspace is locked (checked in the drop handler in `index.tsx`).

---

## Layout Template Slot Definitions

These are the grid-unit positions for each preset. Grid is 12 cols × 8 rows.

| Preset | Slots (x,y,w,h) |
|--------|-----------------|
| 1×1 | (0,0,12,8) |
| 1×2 | (0,0,6,8)(6,0,6,8) |
| 2×2 | (0,0,6,4)(6,0,6,4)(0,4,6,4)(6,4,6,4) |
| 1+2 | (0,0,8,8)(8,0,4,4)(8,4,4,4) |
| 2+1 | (0,0,4,4)(0,4,4,4)(4,0,8,8) |
| 1×3 | (0,0,4,8)(4,0,4,8)(8,0,4,8) |
| 2×3 | (0,0,4,4)(4,0,4,4)(8,0,4,4)(0,4,4,4)(4,4,4,4)(8,4,4,4) |
| 1+3 | (0,0,6,8)(6,0,6,4)(6,4,3,4)(9,4,3,4) |

(Existing templates from the spec stay; slot definitions were previously hardcoded as template component counts — now they need explicit x,y,w,h values.)

---

## What NOT to Change

- WebSocket/real-time pipeline — untouched
- Pane content components (TrendPane, GraphicPane, etc.) — untouched
- zundo undo/redo — still applies to layout changes
- Auto-save on layout change — still fires via `scheduleSave`
- Aspect ratio toggle — still in toolbar, untouched

---

## Implementation Order

1. `types.ts` — add `pinned`
2. `workspaceStore.ts` — remove editMode, add locked/pin actions, update changeLayout
3. `layout-utils.ts` (new) — pure collision resolver, unit-testable
4. `WorkspaceGrid.tsx` — wire locked, wire collision resolver
5. `PaneWrapper.tsx` — remove editMode, add locked/pin UI
6. `index.tsx` — remove Edit/Done, add lock button, move layout picker
7. `ConsolePalette.tsx` — remove editMode drop guard

---

## Prompt to Paste After Context Clear

```
Implement the console pane layout overhaul described in:
/home/io/io-dev/io/docs/plans/console-pane-layout-overhaul.md

Read that file completely before writing a single line of code.
Follow the step-by-step order exactly. After each step, verify
TypeScript compiles clean with `pnpm tsc --noEmit` before moving on.
Update the plan file's Status field and add a ✓ next to each completed
step as you go. The spec authority is
/home/io/spec_docs/console-implementation-spec.md — read it first.
```
