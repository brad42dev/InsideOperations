---
id: MOD-DESIGNER-028
unit: MOD-DESIGNER
title: Right-clicking shape in palette adds it to canvas instead of showing context menu
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Right-clicking a shape in the Designer shape palette does not show a context menu — instead it triggers the shape's drag-and-drop "add to canvas" behavior (placing the shape on the canvas). A right-click on a palette shape should open a context menu with options like "Add to Canvas", "View Details", etc.

## Acceptance Criteria

- [ ] Right-clicking a shape in the palette opens a context menu (not adds it to canvas)
- [ ] Context menu appears with relevant options for the palette shape
- [ ] The existing left-click drag-to-add behavior is preserved

## Verification Checklist

- [ ] Right-click a shape in the shape palette → context menu appears
- [ ] Context menu does NOT add the shape to the canvas
- [ ] Left-click drag from palette → shape added to canvas (existing behavior preserved)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not remove the drag-to-add behavior — just add right-click context menu

## Dev Notes

UAT failure from 2026-03-24: Right-clicking a Gate Valve shape in the palette causes it to be added to the canvas at position X=-200 (off-canvas). No context menu appears. The right-click handler is incorrectly triggering the add-to-canvas action.
Spec reference: MOD-DESIGNER-007 (shape palette right-click context menu)
