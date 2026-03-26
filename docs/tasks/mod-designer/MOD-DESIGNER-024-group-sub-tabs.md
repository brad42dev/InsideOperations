---
id: MOD-DESIGNER-024
unit: MOD-DESIGNER
title: Group sub-tabs — open group content in a dedicated tab for deep editing
status: pending
priority: medium
depends-on: [MOD-DESIGNER-021, MOD-DESIGNER-023]
source: feature
decision: docs/decisions/designer-groups-and-tabs.md
---

## What to Build

Extend the file tab system from MOD-DESIGNER-023 to support **group sub-tabs**: a tab that shows the
contents of a group node in an isolated, full-featured editing environment. The user opens a group sub-tab
by right-clicking a group → "Open in Tab".

### Tab type extension

Extend the `DesignerTab` interface from MOD-DESIGNER-023:

```typescript
interface DesignerTab {
  id: string;
  type: 'graphic' | 'group';       // 'group' = sub-tab
  graphicId: string;                // parent graphic's ID (same for all sub-tabs of a graphic)
  graphicName: string;              // parent graphic name
  groupNodeId?: NodeId;             // for type='group': the group node's ID in the scene graph
  groupName?: string;               // for type='group': the group's name
  isModified: boolean;
  viewport: ViewportState;
}
```

Tab label for group sub-tabs:
```
[Graphic Name] › [Group Name]
```
truncated as: `[first 12 chars of graphic] › [first 12 chars of group]...`

### Opening a group sub-tab

Triggered by right-click on group → "Open in Tab" (wired in MOD-DESIGNER-021).

```typescript
function openGroupInTab(groupNodeId: NodeId, groupName: string) {
  // Check if a sub-tab for this group already exists
  const existing = tabs.find(t => t.type === 'group' && t.groupNodeId === groupNodeId)
  if (existing) { switchToTab(existing.id); return }

  // Create the sub-tab
  const tab: DesignerTab = {
    id: crypto.randomUUID(),
    type: 'group',
    graphicId: currentTab.graphicId,
    graphicName: currentTab.graphicName,
    groupNodeId,
    groupName,
    isModified: false,
    viewport: computeGroupFitViewport(groupNodeId),  // zoom to fit group bounding box
  }
  addTab(tab)
  switchToTab(tab.id)
}
```

### Canvas behavior in a group sub-tab

When the active tab is `type === 'group'`:

1. **Scope**: only the group's direct children are shown on the canvas. The root scene graph and all
   non-group nodes are not visible (and not rendered). The canvas background and grid are still shown.

2. **Canvas dimensions**: the canvas viewport is fitted to the group's bounding box (with 10% padding)
   on first open. The user can pan/zoom freely. The "canvas size" concept is not shown — there is no
   canvas boundary rect in sub-tab mode.

3. **Full palette access**: all palette sections are shown and functional. Dragging an element from the
   palette creates a new child of the group (same as Group Edit Mode in MOD-DESIGNER-022).

4. **Full property panel**: all property panel sections work, including point binding for display elements.
   This is the primary value of sub-tabs over in-place editing — the property panel is never obscured
   by the parent canvas's content.

5. **All tools available**: draw tools, select tool, pipe tool, all work within the group scope.
   New nodes created by drawing are added as group children.

### Live sync to parent scene graph

The group sub-tab shares the same underlying `sceneStore` as the parent graphic tab. Mutations made in
the group sub-tab (via commands) modify the group's children in the shared scene graph — there is no
separate document.

Implementation: when rendering the group sub-tab canvas, filter `doc.children` to find the group node
by `groupNodeId`, then render only `group.children`. All commands use the existing sceneStore — they
just happen to target nodes within the group.

When the user switches back to the parent graphic tab, the group's children reflect all changes made in
the sub-tab (live sync is automatic via shared store).

### Modified state tracking

A group sub-tab is "modified" if any commands were executed while it was the active tab. When the parent
graphic tab is saved, all changes (including sub-tab changes) are saved (same scene graph). The sub-tab's
`isModified` flag is set to `false` after parent save.

The group sub-tab's close prompt: "Unsaved changes will be saved when you save [graphic name]. Close anyway?"
[Close] [Cancel] — no independent save for sub-tabs. Closing a group sub-tab never triggers a separate save.

### Indicator in parent canvas

When a group node has an open sub-tab, show a small "tab" icon (📑 or a custom SVG icon) in the top-right
corner of the group's bounding box overlay in the parent canvas. This is a purely visual indicator, not
interactive (no click behavior beyond normal group click behavior).

### Closing a group sub-tab

- Click the × on the tab
- Ctrl+W when the sub-tab is active

No save prompt specific to the sub-tab (since changes auto-persist to the parent graphic's scene graph).
Just close the tab. If there are unsaved changes in the scene (the parent graphic is modified), the standard
"Modified" dot on the parent graphic tab indicates this.

If the parent graphic tab is closed while a group sub-tab is open: close the group sub-tab first (no prompt),
then apply the save prompt to the parent graphic tab.

## Acceptance Criteria

- [ ] Right-click on a group → "Open in Tab" creates a group sub-tab. Opening the same group again focuses
      the existing sub-tab.
- [ ] The sub-tab label shows `[Graphic Name] › [Group Name]`.
- [ ] The sub-tab canvas shows only the group's children. Other scene graph nodes are not shown.
- [ ] The full palette is available in the sub-tab. Dragging from palette creates a group child.
- [ ] The full property panel is available. Point bindings can be set on display elements within the group.
- [ ] Changes made in the sub-tab are immediately visible when switching back to the parent graphic tab.
- [ ] The group in the parent canvas shows a "tab open" indicator icon while its sub-tab is active.
- [ ] Closing the group sub-tab does not trigger an independent save prompt (changes are part of parent graphic).
- [ ] Closing the parent graphic tab first closes any open group sub-tabs for that graphic, then prompts
      for the parent save.

## Do NOT

- Do not implement a separate "group document" save mechanism — group sub-tabs always save via the parent.
- Do not implement nested sub-tabs (a group within a group cannot be opened in yet another sub-tab from
  within a sub-tab — not in this pass).
- Do not implement sub-tabs for non-group node types in this task.

## Dev Notes

Files to edit:
- `frontend/src/pages/designer/index.tsx` — extend tab open logic for group sub-tabs; extend tab close
  logic (close group sub-tabs when parent closes); render CanvasForGroupTab component
- `frontend/src/store/designer/tabStore.ts` (or wherever tabs are managed from MOD-DESIGNER-023)
- `frontend/src/pages/designer/DesignerCanvas.tsx` — group sub-tab indicator icon in parent canvas;
  the canvas rendering already supports filtering by group context (from MOD-DESIGNER-022's `groupEditContext`) —
  the sub-tab rendering is a more formal version of the same concept

`computeGroupFitViewport(groupNodeId)`: find the group node, get its bounding box via `getNodeBounds`, compute
zoom = `min(viewportW / bboxW, viewportH / bboxH) * 0.9`, pan to center the bbox. This is the same "fit to
content" logic used by Ctrl+0, just scoped to the group.

The "full palette in sub-tab" is automatic if the palette already reads from `uiStore.activeMode` — the
sub-tab uses the same mode as the parent graphic tab. No palette changes needed.

"Tab open" indicator icon: a simple `<svg>` icon (e.g., a small tab shape) rendered in the top-right of
the group's bounding box overlay rectangle, similar to how the lock icon and navigation link icon are
rendered on nodes. Use `pointer-events: none`, `fill: var(--io-accent)`, size 10×10 SVG units.
