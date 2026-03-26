---
id: MOD-DESIGNER-021
unit: MOD-DESIGNER
title: Group management — create with name prompt, rename, ungroup, keyboard shortcuts
status: pending
priority: high
depends-on: []
source: feature
decision: docs/decisions/designer-groups-and-tabs.md
---

## What to Build

Implement the core group management UX. Groups already have a `group` node type in the scene graph and
`GroupNodesCommand` / `UngroupCommand` in `commands.ts`. This task wires the UX around them.

### 1. Name prompt on group creation

When the user triggers group creation (Ctrl+G or right-click "Group Selection..." — keyboard shortcut wired
in this task, right-click item added in this task):

Show a **name prompt** before creating the group. Simplest implementation: a small `<dialog>` or inline
popover near the selection bounding box (or center of viewport if bounding box is off-screen):

```tsx
// Pseudo-structure
<NameGroupPrompt
  defaultName={nextGroupName(doc)}   // "Group 1", "Group 2", etc.
  onConfirm={(name) => executeGroupCmd(name)}
  onCancel={() => {/* no-op */}}
/>
```

`nextGroupName(doc)`: walk `doc.children` recursively, collect all group node names matching `/^Group (\d+)$/`,
return `"Group {max+1}"`.

On confirm: execute `GroupNodesCommand` with the name embedded in the new group node's `name` field.
On cancel (Escape or Cancel button): do nothing. No group created.

The `GroupNodesCommand` must set `node.name` on the created group node. Verify this is already in the
command's implementation — if not, add a `name` parameter to `GroupNodesCommand`.

### 2. Group rename

Three paths that all call the same `NameGroupPrompt` (pre-filled with current name):

**(a) Layer panel** — double-clicking a group's layer panel row triggers inline rename. The layer panel
row becomes an `<input>` with the current name pre-filled. On blur or Enter: `ChangePropertyCommand` on
`node.name`. On Escape: cancel.

**(b) Property panel** — when a group node is selected, the property panel's identity section shows a
"Name" field (text input). Editing it (debounced 500ms) creates `ChangePropertyCommand` on `node.name`.
The Group type likely has a minimal property panel — ensure a Name field is shown there.

**(c) Right-click menu on group** — "Rename..." item → same `NameGroupPrompt` popover.

### 3. Keyboard shortcuts

Add to the global keydown handler in `DesignerCanvas.tsx`:

- **Ctrl+G**: if ≥2 non-pipe nodes selected → trigger name prompt → group. If a single group is selected:
  noop (not a re-group shortcut).
- **Ctrl+Shift+G**: if a single group node is selected → execute `UngroupCommand`. If multiple items
  selected but no group among them: noop. If a group AND other nodes selected: only ungroup the group(s)
  in the selection.

### 4. Right-click menu items for groups

Add to the context menu system:

**(a) Multi-selection context menu (RC-DES-8 or equivalent):**
When ≥2 nodes are selected and right-clicked:
- Add "Group Selection..." item → triggers name prompt → group
- This item should only appear when none of the selected items is a locked node

**(b) Group node context menu:**
When a single group node is right-clicked, add:
- "Rename..." → name prompt (pre-filled)
- "Ungroup" (Ctrl+Shift+G) → ungroup
- "Enter Group" → same as double-click (triggers Group Edit Mode — see MOD-DESIGNER-022)
- "Open in Tab" → group sub-tab (see MOD-DESIGNER-024)
- "Promote to Shape..." → group promotion wizard (see MOD-DESIGNER-026)
- Separator before these items; they come after the standard base items (Move to Layer, Lock, etc.)

### 5. Ungroup behavior

`UngroupCommand` already exists. Verify it correctly:
- Removes the group node
- Inserts children back into the parent (root or containing group) at the group's former z-order position
- Preserves each child's `layerId`
- Returns children as the new selection after ungroup

If `UngroupCommand` doesn't do all of the above, fix it here.

### 6. Layer panel display

Groups appear in the layer panel as collapsible rows with a chevron icon. The group name is shown.
Expanding the group shows its children as indented rows. This may already work if the layer panel renders
the scene graph tree — verify and fix if group children don't appear nested.

## Acceptance Criteria

- [ ] Ctrl+G with ≥2 nodes selected shows the name prompt. Confirming creates a named group node. Escape
      cancels with no group created.
- [ ] Auto-numbered default name: "Group 1", "Group 2", etc. (finds next unused number).
- [ ] Group name is editable via layer panel double-click, property panel Name field, and right-click → Rename.
- [ ] Rename is undoable with Ctrl+Z.
- [ ] Ctrl+Shift+G with a group selected ungroups it. Children retain their layers. Children are selected
      after ungroup. Ctrl+Z re-creates the group with its original name.
- [ ] Right-click on multi-selection shows "Group Selection..." item.
- [ ] Right-click on a group node shows Rename, Ungroup, Enter Group, Open in Tab, Promote to Shape items.
- [ ] Layer panel shows groups as collapsible rows with their names. Children are nested below.

## Do NOT

- Do not implement the Group Edit Mode (in-place canvas editing) here — that is MOD-DESIGNER-022.
- Do not implement the Group/Ungroup toolbar buttons here — that is MOD-DESIGNER-022 (toolbar changes
  are combined with the selector icon addition).
- Do not implement group sub-tabs here — that is MOD-DESIGNER-024.
- Do not implement Promote to Shape here — that is MOD-DESIGNER-026.
- Do not allow grouping of a single node (Ctrl+G with 1 node selected = noop with no prompt).

## Dev Notes

Files to edit:
- `frontend/src/pages/designer/DesignerCanvas.tsx` — keyboard handler (Ctrl+G, Ctrl+Shift+G); right-click
  menu additions for multi-selection and group nodes
- `frontend/src/shared/graphics/commands.ts` — verify/fix GroupNodesCommand (name param), UngroupCommand
- `frontend/src/shared/types/graphics.ts` — verify Group interface has `name: string`
- `frontend/src/pages/designer/panels/PropertyPanel.tsx` or `DesignerRightPanel.tsx` — Name field for group
- Layer panel: likely in `DesignerCanvas.tsx` or a panel component — verify group collapsible row

The `NameGroupPrompt` can be a small React component: a `<dialog>` element (HTML native) with an input,
OK and Cancel buttons, auto-focused on open. Keep it simple — no complex Radix Dialog needed for this.

For the right-click context menu additions: find the existing RC-DES handling in `DesignerCanvas.tsx`
(the Radix `ContextMenu` implementation added in MOD-DESIGNER-001). Add the new items to the appropriate
menu sections. The multi-selection menu may need a new dedicated section or can extend the existing
"multiple selected" case.
