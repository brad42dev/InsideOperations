---
id: MOD-DESIGNER-022
unit: MOD-DESIGNER
title: Group in-place editing (double-click enter/exit) and toolbar selector/group buttons
status: pending
priority: high
depends-on: [MOD-DESIGNER-021]
source: feature
decision: docs/decisions/designer-groups-and-tabs.md
---

## What to Build

Two things in one task because they share a dependency on group infrastructure from MOD-DESIGNER-021:

### Part 1 — Top toolbar additions

Add three elements to the top toolbar, immediately before the draw tools:

```
[Selector ▸] [Group □□] [Ungroup ⊡] | [Rect] [Ellipse] [Line] ...
```

**Selector button** (arrow/cursor icon):
- Clicking sets `uiStore.activeTool = 'select'`
- Highlighted (accent background) when `activeTool === 'select'`
- Always enabled
- Tooltip: "Select (V)"

**Group button** (two overlapping rectangles with dashed bounding box icon):
- Clicking triggers the group name prompt (same as Ctrl+G)
- Enabled only when `selectedNodeIds.size >= 2` AND at least 2 non-pipe nodes are selected
- Disabled (grayed, `opacity: 0.4`, cursor: not-allowed) otherwise
- Tooltip: "Group Selection (Ctrl+G)"

**Ungroup button** (bounding box splitting apart icon):
- Clicking triggers ungroup (same as Ctrl+Shift+G)
- Enabled only when `selectedNodeIds.size === 1` AND the selected node is a `group`
- Disabled otherwise
- Tooltip: "Ungroup (Ctrl+Shift+G)"

A vertical separator (`|` — 1px border-subtle, 16px tall) between Ungroup and the draw tools.

The toolbar reads selection state from `uiStore.selectedNodeIds` and the scene graph to determine
enabled/disabled state. This must be reactive (updates as selection changes).

### Part 2 — In-place Group Edit Mode

Double-clicking a group node enters Group Edit Mode.

**uiStore addition:**
```typescript
groupEditContext: NodeId | null  // null = root canvas; NodeId = editing inside this group
```

**On double-click of a group node:**
1. Set `uiStore.groupEditContext = group.nodeId`
2. Set `uiStore.activeTool = 'select'`
3. Clear current selection (`uiStore.selectedNodeIds = new Set()`)

**Canvas rendering changes when `groupEditContext !== null`:**

*Dimming non-group nodes:*
All nodes NOT inside the active group render at 30% opacity. Implementation: wrap non-group nodes' SVG `<g>`
elements in `opacity={0.3}`. Non-group widget divs in the HTML overlay also get `opacity: 0.3; pointer-events: none`.

*Group bounding box border:*
Render a thin (`2px / zoom`) teal (`--io-accent`) dashed rect around the active group's bounding box. This
is a non-interactive SVG overlay element (same layer as the canvas boundary visual from MOD-DESIGNER-018).

*Breadcrumb in canvas title area:*
Above the canvas (or in the toolbar's center section), show:
```
[Graphic Name] › [Group Name]
```
"Graphic Name" is a clickable link that exits Group Edit Mode. "Group Name" is static text.
If the toolbar already has a center section for graphic name display, add the breadcrumb there.
If not, add a small breadcrumb div above the canvas container.

*Interaction inside Group Edit Mode:*
- Clicking on a child node of the active group: normal selection behavior (select, multi-select with Shift)
- Clicking on a non-group node (dimmed): noop — dimmed nodes are not interactive
- Clicking on empty canvas area inside the group bounding box: deselect (same as normal)
- Clicking on empty canvas area OUTSIDE the group bounding box: exit Group Edit Mode
- Dragging from palette onto canvas: creates new node as a child of the active group (not as a root node)
  → `AddNodeCommand` with `parentId = groupEditContext`
- All commands (move, resize, property changes) operate on the group's children normally
- The undo stack is the same as the root canvas (group edit mode is not isolated)

**Exiting Group Edit Mode:**
- Press Escape
- Click outside the group bounding box
- Click the breadcrumb "Graphic Name" link
- On exit: `uiStore.groupEditContext = null`, selection cleared

**Nested groups:** If the user double-clicks a nested group while already in Group Edit Mode, the
`groupEditContext` updates to the nested group's ID (breadcrumb gains another level:
`Graphic Name › Outer Group › Inner Group`). Clicking the outer group name in the breadcrumb goes back
one level.

## Acceptance Criteria

- [ ] Top toolbar has a Selector button, Group button, and Ungroup button before the draw tools, with a
      separator after Ungroup.
- [ ] Selector button activates the select tool and stays highlighted when select is active.
- [ ] Group button is enabled only when ≥2 nodes are selected (non-pipe). Clicking it triggers the name prompt.
- [ ] Ungroup button is enabled only when a single group node is selected. Clicking ungroups it.
- [ ] Double-clicking a group node enters Group Edit Mode: non-group nodes dim to 30% and become
      non-interactive; a teal dashed border appears around the group; breadcrumb shows.
- [ ] Inside Group Edit Mode, the full palette and property panel are available. Point bindings can be
      set on child display elements.
- [ ] Dragging an element from the palette onto the canvas inside Group Edit Mode creates the element as
      a child of the active group.
- [ ] Clicking outside the group bounding box or pressing Escape exits Group Edit Mode.
- [ ] Breadcrumb "Graphic Name" link exits Group Edit Mode.
- [ ] Double-clicking a nested group while in Group Edit Mode enters the nested group (breadcrumb gains a level).

## Do NOT

- Do not implement group sub-tabs here (that is MOD-DESIGNER-024).
- Do not gate the toolbar buttons behind a separate "group mode" — they should always be visible, just
  enabled/disabled based on selection state.
- Do not change the existing draw tool buttons or their order.

## Dev Notes

Files to edit:
- `frontend/src/pages/designer/DesignerToolbar.tsx` — add Selector, Group, Ungroup buttons
- `frontend/src/store/designer/uiStore.ts` (or wherever uiStore is defined) — add `groupEditContext: NodeId | null`
- `frontend/src/pages/designer/DesignerCanvas.tsx`:
  - Double-click handler: detect group node → set `groupEditContext`
  - Canvas rendering: filter/dim nodes not in active group
  - Click handler: detect click outside group bounding box → exit group edit
  - Escape key handler: if `groupEditContext !== null` → exit group edit (don't propagate to other Escape actions)
  - AddNode drop handler: use `groupEditContext` as `parentId` when non-null

Breadcrumb: if the toolbar already shows the current graphic name somewhere, extend it. Otherwise add a
`<div>` bar between the toolbar and canvas with the breadcrumb. Use `var(--io-text-muted)` for the ">"
separator and inactive segments; `var(--io-text-primary)` for the active (rightmost) segment.

The dimming of non-group nodes: iterate `doc.children` in the render function; for each root-level node,
check if it is the active group or a descendant of the active group. If not → render with opacity 0.3 and
`pointerEvents: 'none'` on the `<g>`. For the HTML overlay widgets: set inline style on their container divs.

Finding nodes in active group: `doc.children.find(n => n.id === groupEditContext)?.children` — the group's
direct children. For deeper nesting, the active group at each level is always the direct parent.
