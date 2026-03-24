---
id: DD-23-022
unit: DD-23
title: Drag-and-drop from palette into group container interior still does not work
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

Dragging a tile from the palette into a group `(…)` container's empty drop zone does not insert the tile as a child of the container. The HTML5 drag event fires (status bar shows "Draggable item palette-constant was dropped") but the tile is placed outside the container (or nowhere), not inside it.

This was previously filed as DD-23-018 and marked verified, but UAT on 2026-03-24 confirmed the issue persists.

Expected behavior: when a user drags the "Enter Value" (or any palette tile) button and drops it onto the group's "Click palette tiles to insert, or drag them here" empty-state zone, the tile should appear inside the group as a child — indented with level-2 nesting color styling. The "Click palette tiles to insert…" text should disappear once the tile is inside.

## Acceptance Criteria

- [ ] Dragging a palette tile and dropping onto a container's "Drop tiles here" interior inserts the tile as a child of that container
- [ ] The inserted tile appears visually inside the container with level-2 nesting color styling
- [ ] The "(…) container must have at least one child tile" error clears after a tile is dropped inside
- [ ] Dropping a tile onto the gap between existing child tiles (sibling gap) also works correctly

## Verification Checklist

- [ ] Navigate to /settings/expressions, click Edit on a saved expression
- [ ] Add a `(…)` group container to the workspace via the palette button
- [ ] Drag "Enter Value" from the VALUES palette and drop onto the group's "Click palette tiles to insert, or drag them here" zone
- [ ] Confirm the tile appears INSIDE the group (indented, level-2 styled) — NOT outside it
- [ ] Confirm the group error message clears (no more "must have at least one child tile")
- [ ] Add a second tile by dragging onto the gap inside the group — confirm it inserts between existing children

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not rely only on click-to-insert behavior; drag-and-drop from the palette must work for container targets
- Check the drag event handler for the drop zone — the event fires but the drop target logic for nested containers may be skipping the insert

## Dev Notes

UAT failure from 2026-03-24: status bar confirms "Draggable item palette-constant was dropped" but group content is unchanged after drop. The drag fires but the drop target resolver for the container interior is not inserting the tile as a child.
Spec reference: DD-23-012 (original drag-and-drop spec), DD-23-018 (prior UAT bug task)
Screenshot: docs/uat/DD-23/scenario4-drag-fail.png
