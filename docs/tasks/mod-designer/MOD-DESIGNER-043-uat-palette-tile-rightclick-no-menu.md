---
id: MOD-DESIGNER-043
unit: MOD-DESIGNER
title: Palette tile right-click shows no context menu (no Place at Center / Favorites)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Right-clicking on shape palette tiles (Display Elements section, Equipment section) must show a context menu with options like "Place at Center" and "Add to Favorites" per the shape palette context menu spec.

During UAT on 2026-03-26, right-clicking on the Text Readout palette tile at screen coordinates (88, 422) produced NO context menu. No [role="menu"] or menuitem elements appeared. The tiles also have no `draggable="true"` attribute — drag-and-drop uses pointer events via browser_drag (dragTo), not the HTML5 drag API.

Expected: right-click on any palette tile → context menu with at least "Place at Center" and "Add to Favorites" options.

## Acceptance Criteria

- [ ] Right-clicking on an Equipment palette tile shows a context menu
- [ ] Right-clicking on a Display Elements palette tile shows a context menu
- [ ] Context menu includes "Place at Center" (places element at canvas center)
- [ ] Context menu includes "Add to Favorites" (or "Remove from Favorites" if already favorited)
- [ ] Context menu appears without page reload or navigation

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create a new graphic
- [ ] In the Equipment tab of the palette, right-click on any shape tile
- [ ] Confirm [role="menu"] appears with "Place at Center" and "Add to Favorites" items
- [ ] Switch to Display Elements tab, right-click on Text Readout tile
- [ ] Confirm same context menu structure

## Do NOT

- Do not use the HTML5 drag API (tiles don't use draggable="true") — use pointer events
- Do not stub with console.log

## Dev Notes

UAT failure from 2026-03-26: right-click at (88, 422) on Text Readout tile — no context menu appeared. No [role="menu"] elements found. Existing task MOD-DESIGNER-007 (shape-palette-right-click) and MOD-DESIGNER-040 (palette-tile-rightclick-no-menu) both track this — still broken after those verifications.
Spec reference: MOD-DESIGNER-007, MOD-DESIGNER-040, context-menu-implementation-spec.md
