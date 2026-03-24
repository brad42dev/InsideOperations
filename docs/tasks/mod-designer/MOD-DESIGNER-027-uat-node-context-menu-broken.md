---
id: MOD-DESIGNER-027
unit: MOD-DESIGNER
title: Node context menu identical to empty canvas menu — node-specific items missing
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Right-clicking on a selected shape/node in the Designer shows the same context menu as right-clicking on an empty canvas area. The node-specific menu items (Lock/Unlock, Nav Link, Properties, and type-specific items) never appear. The context menu always shows: Paste (disabled), Select All, Grid, Zoom, Properties — regardless of whether a node is selected.

## Acceptance Criteria

- [ ] Right-clicking a selected node shows a different menu from empty canvas right-click
- [ ] Node context menu includes: Lock/Unlock, Nav Link, Properties
- [ ] Node context menu is distinct from empty canvas context menu
- [ ] Different node types (shape, group, display element) show type-specific items

## Verification Checklist

- [ ] Add a shape to canvas, select it, right-click → node menu appears (not canvas menu)
- [ ] Node menu contains Lock/Unlock option
- [ ] Node menu contains Nav Link option
- [ ] Node menu contains Properties option
- [ ] Right-click empty canvas → canvas menu (Paste, Select All, Grid, Zoom)
- [ ] Right-click selected node → node menu (different from canvas menu)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only one menu item — all specified items must appear

## Dev Notes

UAT failure from 2026-03-24: Right-clicking canvas (with Gate Valve shape selected) shows: Paste (disabled), Select All, Grid, Zoom, Properties — same as empty canvas. Lock/Unlock, Nav Link not present. Node context menu event handling is broken or not wired to the canvas right-click handler.
Spec reference: MOD-DESIGNER-004 (different menus for canvas vs node), MOD-DESIGNER-005 (base node items), MOD-DESIGNER-006 (type-specific items)
