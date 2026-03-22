---
decision: designer-groups-and-tabs
unit: MOD-DESIGNER
type: new
date: 2026-03-22
author: feature-agent
---

# Designer — Group Management, Tabs, and Promote Group to Shape

## Context

The Designer has a `group` node type in the scene graph (type #8) but no implemented group management UX:
no creation flow, no naming, no in-place editing, no keyboard shortcuts, no toolbar integration. Additionally,
the Designer is specified to support multiple open graphics simultaneously (file-level tabs) but this is not
built. Users also need a path from a group of assembled elements (shapes + display elements) to a reusable
named shape in the library — extending the existing Promote to Shape wizard for this use case.

## Decision

### Group creation and naming

Groups are created by three equivalent methods:
1. **Ctrl+G** with ≥2 nodes selected
2. **Right-click menu** on a multi-selection → "Group Selection..."
3. **Toolbar button** (Group icon, see toolbar section below)

All three paths immediately open a small **Name Group** inline prompt (a text input popover near the selection
bounding box, or a small modal — either is acceptable). The input pre-fills with "Group 1" (auto-numbered,
finding the next unused number). The user edits the name and presses Enter or clicks OK. Pressing Escape cancels
the group operation entirely — no group node is created.

On confirmation: a `GroupNodesCommand` is executed, which:
1. Creates a new `group` node with the given name as `node.name`
2. Moves all selected nodes into the group as children
3. Places the group node at the z-order position of the topmost selected node
4. Each child retains its own `layerId` — layers are not changed by grouping

A `GroupNodesCommand` is added to the undo stack. Ctrl+Z ungroups and restores original positions and z-order.

### Group renaming

Groups can be renamed after creation by:
- Double-clicking the group's name in the **layer panel** (inline text edit)
- **Property panel** → Name field (when a group node is selected and not in group-edit mode)
- **Right-click menu on group node** → "Rename..." → same inline name prompt

Renaming creates a `ChangePropertyCommand` on `node.name`. Undoable.

### Ungroup

Three equivalent methods:
1. **Ctrl+Shift+G** with a group node selected
2. **Right-click menu on group node** → "Ungroup"
3. **Toolbar Ungroup button** (visible/active when a group is selected)

Ungrouping executes `UngroupCommand`, which:
1. Removes the group node from the scene graph
2. Inserts each child node back into the root scene graph (or parent group, if the group was nested) at
   the same z-order position the group occupied, in original child order
3. Each child retains its `layerId` (no layer change)
4. The ungrouped children are left selected after the operation
5. The undo of Ungroup recreates the group with the original name and child set

### In-place group editing (double-click to enter)

Double-clicking a group node enters **Group Edit Mode**:
- All nodes NOT inside the group are dimmed to 30% opacity
- The group's children are fully interactive (selectable, movable, resizable, bindable)
- The canvas title area shows a breadcrumb: `Graphic Name › Group Name`
- The full left palette is available (shapes, widgets, etc. can be dragged into the group)
- The full property panel is available for any selected child (including point binding)
- A thin colored border appears around the group's bounding box
- The active tool reverts to Select on entry

Exiting Group Edit Mode:
- Click anywhere on the dimmed area outside the group
- Press Escape
- Click the breadcrumb root ("Graphic Name") to pop back to root

Mutations inside Group Edit Mode create commands that target the group's children in the scene graph as normal.
The group itself is not a separate document — it is the same sceneStore, just with an "active group context"
filter in uiStore: `uiStore.groupEditContext: NodeId | null`.

### Top toolbar additions

The top toolbar gains three elements (in order from left, before the draw tools):

```
[←Selector] [Group] [Ungroup] | [Rect] [Ellipse] [Line] ... (existing draw tools)
```

**Selector icon** (arrow cursor): clicking activates the Select tool. This is the canonical way to explicitly
return to the select tool (as opposed to pressing Escape or finishing a draw). Always visible.

**Group button**: icon = two overlapping rectangles with a dotted bounding box. Enabled when ≥2 nodes are
selected. Disabled (grayed) otherwise. Clicking triggers the same name-prompt flow as Ctrl+G.

**Ungroup button**: icon = bounding box splitting into separate rectangles. Enabled only when a single group
node is selected. Disabled otherwise. Clicking triggers ungroup.

A separator (`|`) between Group/Ungroup and the draw tools keeps the toolbar organized.

### Designer file tabs (multiple open graphics)

The Designer gains a **tab bar** between the main toolbar and the canvas area. Each open graphic occupies
one tab.

Tab anatomy:
- Tab label: graphic name (truncated to 20 chars with ellipsis)
- Modified indicator: a dot (●) before the name if the graphic has unsaved changes
- Close button (×) on each tab — prompts "Save changes?" if modified before closing
- Active tab is highlighted with `--io-accent` underline

Opening a graphic (from the graphics list) adds a new tab. If the graphic is already open in a tab, that
tab is focused instead of opening a duplicate.

Tab bar behavior:
- Tabs are horizontally scrollable if they overflow the bar width
- Right-click on a tab: "Close", "Close Others", "Close All", "Copy Name"
- Max 10 simultaneous open tabs. Opening an 11th replaces the least-recently-used tab (after save prompt if
  modified). A small tooltip warns: "Max tabs reached — replacing oldest."

Keyboard shortcuts:
- Ctrl+W: close active tab
- Ctrl+Tab / Ctrl+Shift+Tab: cycle through open tabs
- Ctrl+1 through Ctrl+9: jump to tab by position

Each tab maintains its own viewport state (pan/zoom position) in uiStore, keyed by graphic ID.

### Group sub-tabs (open group in dedicated tab)

Right-click on a group node → **"Open in Tab"** opens the group's contents in a new tab.

The sub-tab:
- Label: `[parent graphic name] › [group name]` (e.g., "Boiler Overview › Pump A Assembly")
- Has its own viewport (starts zoomed to fit the group's bounding box)
- Shows ONLY the group's children on the canvas (other nodes from the parent are hidden)
- Has full palette access — all element types can be dragged in (they become children of the group)
- Has full property panel for selected children, including point binding
- Has its own undo/redo stack scoped to commands executed within this tab context

**Live sync**: changes made in the group sub-tab immediately update the parent graphic's scene graph (same
`sceneStore` instance, same `historyStore` for the parent file — but the sub-tab's undo only undoes actions
taken in that tab, not actions from the parent).

Closing a group sub-tab:
- If the parent graphic is still open: the group reflects all changes made in the sub-tab
- If the parent graphic was closed while the sub-tab was open: the sub-tab shows a banner
  "Parent graphic was closed. Changes preserved in the graphic file." and the tab's changes were auto-saved
  back into the parent graphic

A group that has a sub-tab open shows a small "tab" indicator icon on its selection handle in the parent
canvas.

### Promote group to shape (extended wizard)

Right-click on a **group node** → "Promote to Shape..." opens the existing 8-step Promote to Shape wizard,
with group-aware extensions.

**What the wizard does with a group source** (differences from single-SVG promotion):

**Step 1 — Source analysis:**
The wizard scans the group's children and categorizes them:
- `primitive` nodes → SVG geometry (will be composited into shape SVG)
- `symbol_instance` nodes → SVG geometry (shape SVGs composited in at current transform)
- `embedded_svg` nodes → SVG geometry (included as-is)
- `display_element` nodes → identified as "data slots" → will become `valueAnchors` in sidecar
- `pipe` nodes → identified as connections → will become `connections` in sidecar
- `text_block` nodes → identified as "text zones" → will become `textZones` in sidecar
- `widget` nodes → **not promotable** — the wizard shows a warning: "Widgets cannot be included in a shape
  and will be excluded from the promotion." User can proceed (widgets excluded) or cancel.
- nested `group` nodes → flattened recursively

The wizard shows a summary: "Found: 3 geometry elements, 2 data slots (will become value anchors),
1 text zone. No incompatible elements."

**Step 2–7 — Standard wizard steps** (name, category, connection points, text zones, etc.) run as normal.
Pre-populated defaults:
- Shape name: the group's current name
- Text zones: auto-populated from detected `text_block` nodes (using their content as zone label)
- Value anchors: auto-generated from detected `display_element` nodes (position from display element's
  canvas position, label from the display element type: "Level", "Temperature", etc.)

**Step 8 — Review and Promote:**
Shows a preview of the resulting shape SVG with value anchor positions marked as teal dots.
On confirm: creates the shape in the Custom shapes library. Optionally replaces the group in the current
graphic with a `SymbolInstance` of the new shape (default: yes, with a toggle).

**Result in the library:** A Custom shape with pre-wired `valueAnchors` at the positions of the original
display elements. When placed as a `SymbolInstance`, display elements auto-attach at those anchors. Users
bind point IDs to those display elements via the property panel.

This is the primary path for creating complex reusable shapes like "Vessel with Level + Temperature +
Pressure displays" — build it once, save as shape, reuse anywhere with different point bindings.

## Acceptance Criteria

1. Ctrl+G, right-click → "Group Selection...", and toolbar Group button all trigger a name prompt. Pressing
   Enter creates the group; Escape cancels with no group created.
2. Group name is editable after creation via layer panel, property panel, and right-click → Rename.
3. Ctrl+Shift+G, right-click → Ungroup, and toolbar Ungroup button all ungroup correctly. Children return
   to their previous layer. Ctrl+Z re-creates the group.
4. Double-clicking a group enters Group Edit Mode: non-group nodes dim to 30%, breadcrumb shows, full
   palette + property panel available, click-outside or Escape exits.
5. Point bindings can be set on display element children while inside Group Edit Mode.
6. The top toolbar has a Selector icon, Group button, and Ungroup button. Group is enabled only with ≥2
   nodes selected; Ungroup only with a group selected.
7. The Designer shows a file tab bar. Opening multiple graphics creates multiple tabs. Ctrl+W closes active
   tab; Ctrl+Tab cycles tabs. Modified indicator (●) appears on unsaved tabs.
8. Right-click on a group → "Open in Tab" opens the group in a dedicated sub-tab. Changes made in the sub-tab
   are immediately reflected in the parent graphic.
9. The Promote to Shape wizard accepts a group as input, categorizes children, converts display elements to
   value anchors, and produces a working Custom shape in the library.
10. Widget children in a promoted group are excluded with a warning. The promotion proceeds without them.
11. After promotion, the user can choose to replace the group with a SymbolInstance of the new shape.

## Out of Scope

- Nested group sub-tabs (opening a group-within-a-group in yet another sub-tab) — not in this pass.
- Shared/linked groups (like Figma components) — groups are simple containers, not linked instances.
- Group locking / unlocking at the group level (individual children lock independently).
- Dragging tabs to reorder them (tab order is creation order).
- Detaching a group sub-tab into a separate browser window.

## Files Expected to Change

- `frontend/src/pages/designer/DesignerCanvas.tsx` — double-click group enter/exit, Group Edit Mode dim
  overlay, group breadcrumb, in-place drag/edit within group context
- `frontend/src/pages/designer/DesignerToolbar.tsx` — Selector icon, Group button, Ungroup button
- `frontend/src/pages/designer/index.tsx` — file tab bar component, tab state management, group sub-tab
  open logic
- `frontend/src/pages/designer/DesignerLeftPalette.tsx` — (no change needed; palette already works in
  group edit context)
- `frontend/src/pages/designer/components/PromoteToShapeWizard.tsx` — group source analysis, display
  element → valueAnchor conversion, text_block → textZone extraction
- `frontend/src/shared/graphics/commands.ts` — verify GroupNodesCommand and UngroupCommand are correct;
  add NameGroupCommand if rename is not covered by ChangePropertyCommand
- `frontend/src/store/designer/` — uiStore: add `groupEditContext: NodeId | null` and tab state
- `frontend/src/shared/types/graphics.ts` — verify Group interface has `name: string` field

## Dependencies

- None for tasks 021–023 (foundations, toolbar, in-place edit).
- MOD-DESIGNER-023 (file tabs) is a dependency for MOD-DESIGNER-024 (group sub-tabs).
- MOD-DESIGNER-021 (group creation) is a dependency for MOD-DESIGNER-026 (promote group to shape).
