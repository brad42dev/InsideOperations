---
id: MOD-DESIGNER-045
unit: MOD-DESIGNER
title: Test mode: right-click on display element shows no context menu
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

In Test mode, right-clicking a display element (Text Readout, Analog Bar, etc.) must show the PointContextMenu with point-data operations: Point Detail, Trend This Point, View Alerts, Investigate Point, Report on Point, Copy Tag Name.

During UAT on 2026-03-26:
1. Clicked "Test" button — status bar confirmed "● Test Mode"
2. Right-clicked on Text Readout at screen position (620, 320)
3. Result: NO context menu appeared — zero [role="menuitem"] elements, no floating elements

Note: The display element was unbound (no point ID set). The test may fail only for unbound elements, or Test mode context menus may be entirely broken. The Edit mode context menu for the same element showed all CX-POINT-CONTEXT items (S12 ✅).

Expected: in Test mode, right-clicking on any display element shows at minimum the CX-POINT-CONTEXT menu items.

## Acceptance Criteria

- [ ] In Test mode, right-clicking a display element shows a context menu
- [ ] The context menu in Test mode contains: Point Detail, Trend This Point, View Alerts, Investigate Point, Report on Point, Copy Tag Name
- [ ] Edit-mode-only items (Cut, Copy, Lock, Duplicate, etc.) are NOT shown in Test mode
- [ ] The context menu appears for both bound and unbound display elements

## Verification Checklist

- [ ] Open /designer, create a new graphic, drag a Text Readout to canvas
- [ ] Click "Test" button — verify status bar shows "● Test Mode"
- [ ] Right-click on the Text Readout element
- [ ] Confirm [role="menu"] appears with CX-POINT-CONTEXT items
- [ ] Confirm no edit-only items (Cut, Lock, Duplicate) are present

## Do NOT

- Do not show edit-mode context menu in Test mode — only PointContextMenu
- Do not suppress context menu entirely in Test mode

## Dev Notes

UAT failure from 2026-03-26: Test mode confirmed active via status bar "● Test Mode". Right-click at (620, 320) on Text Readout returned zero menuitem elements. Element was unbound (no point assigned). In Edit mode the same element showed 30+ context menu items including all CX-POINT-CONTEXT items.
Spec reference: MOD-DESIGNER-009, context-menu-implementation-spec.md §test-mode
