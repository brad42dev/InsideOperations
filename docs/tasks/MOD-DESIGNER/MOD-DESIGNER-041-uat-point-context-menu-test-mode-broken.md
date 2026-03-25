---
id: MOD-DESIGNER-041
unit: MOD-DESIGNER
title: PointContextMenu does not fire in test mode for point-bound display elements
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When the Designer is in **Test mode** (toggled via the "Test" button in the toolbar) and the user right-clicks on a point-bound display element (e.g., a Text Readout, Analog Bar, or other display element with a bound process point), the expected behavior is to show a **PointContextMenu** — a context menu with point-data operations such as:

- Navigate to Point
- Show Trend
- Show in Forensics
- Acknowledge Alarm (if applicable)

Currently, right-clicking any element in Test mode shows the standard **edit-mode node context menu** instead — with items like Cut, Copy, Paste, Duplicate, Delete, Lock, Bind Point…

The fix is to detect that the Designer is in `testMode` and, for elements that have a bound point, dispatch the PointContextMenu (same context menu fired from other modules like Console and Process) instead of the edit-mode context menu.

## Acceptance Criteria

- [ ] Right-clicking a point-bound display element in Test mode shows PointContextMenu (NOT the edit-mode node menu)
- [ ] PointContextMenu includes point-data operations appropriate to the bound point's data type
- [ ] Right-clicking an unbound display element in Test mode shows a minimal context menu (or none), NOT the full edit-mode menu
- [ ] Right-clicking in Edit mode continues to show the standard node context menu (no regression)
- [ ] Switching from Edit mode to Test mode and back (and right-clicking in each state) behaves correctly

## Verification Checklist

- [ ] Navigate to /designer, place a Text Readout display element, bind it to a point via "Bind Point…"
- [ ] Click the "Test" button to enter Test mode
- [ ] Right-click the bound Text Readout — confirm a PointContextMenu appears (NOT Cut/Copy/Delete/Lock)
- [ ] Right-click an unbound element in Test mode — confirm no full edit-mode menu appears
- [ ] Return to Edit mode — right-click the element — confirm edit-mode context menu reappears
- [ ] No regression: standard node context menu (Cut, Copy, Delete, Lock, etc.) still works in Edit mode

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not check `testMode` only on the root context menu handler — check it at the element level so unbound elements don't show point-data operations
- Do not show the PointContextMenu in Edit mode — it must only fire in Test mode

## Dev Notes

UAT failure from 2026-03-25: Right-click on Text Readout display element in Test mode showed edit-mode context menu (Cut, Delete, Lock, Bind Point…). Screenshot: docs/uat/MOD-DESIGNER/designer-testmode-rightclick-fail.png

Spec reference: MOD-DESIGNER-009 (original task for PointContextMenu in test mode), context-menu-implementation-spec.md, display-elements-implementation-spec.md
