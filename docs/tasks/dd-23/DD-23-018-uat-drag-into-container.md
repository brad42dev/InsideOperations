---
id: DD-23-018
unit: DD-23
title: Drag-and-drop tile into container does not work
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

When a user drags a tile from the palette into an existing container tile (group, round, abs, etc.) in the expression workspace, the tile should be inserted as a child of that container. Currently, the DnD framework fires the drop event correctly ("Draggable item was dropped") but the tile is not inserted inside the container — it only appears as a sibling at the parent level.

UAT Scenario 3 [DD-23-012]: drag-and-drop from palette to container → tile appears as child inside container.

The fix should ensure that:
1. When a tile is dropped onto a container's interior drop zone, it is inserted as a child of that container
2. The visual "Drop tiles here" placeholder inside empty containers accepts drops and inserts at position 0

## Acceptance Criteria

- [ ] Dragging a palette tile and dropping onto a container's interior inserts the tile as a child of that container
- [ ] "Drop tiles here" empty state in a container acts as a valid drop target
- [ ] Dropping a tile onto a sibling gap (between tiles at the same level) still works correctly
- [ ] The inserted tile appears visually inside the container with appropriate nesting color

## Verification Checklist

- [ ] Navigate to /settings/expressions, open Edit on an expression
- [ ] Add a `(…)` group container to workspace
- [ ] Drag "Enter Value" tile from palette onto the group's "Drop tiles here" zone
- [ ] Confirm the value tile appears inside the group (indented, with level-2 color styling)
- [ ] Drag another tile onto the gap inside the group (between existing child tiles) — confirm it inserts at that position

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not only fix the empty-container case — also fix mid-container drag insertion

## Dev Notes

UAT failure from 2026-03-24: DnD kit fires drop event, console shows "Draggable item palette-constant was dropped" but tile not inserted inside container; tile appears as sibling at root level instead.
Spec reference: DD-23-012 (drag-and-drop tile insertion)
