---
unit: DD-32
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 6
scenarios_passed: 3
scenarios_failed: 3
scenarios_skipped: 3
---

## Module Route Check

pass: Navigating to /console loads real implementation — console page with workspace tabs, asset palette, and process graphic pane visible.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Health | [DD-32-010] Console page renders without error | ✅ pass | Page loads with full nav, workspace "Reactor Overview", asset palette, graphic pane |
| 2 | Workspace Toast | [DD-32-010] Workspace creation shows toast | ❌ fail | Clicked + → Done; no toast appeared in Notifications (F8). Backend returned 404 on workspace save. Silent failure. |
| 3 | Workspace Toast | [DD-32-010] Toast visible in notifications area | ❌ fail | Notifications (F8) region present but empty list after workspace creation. |
| 4 | PointContextMenu | [DD-32-005] Console page has interactive elements | ✅ pass | Workspace tab, asset palette, graphics pane all present. |
| 5 | PointContextMenu | [DD-32-005] Right-click on console element shows context menu | ✅ pass | Right-clicking "Reactor Overview" tab showed [role="menu"] with Switch/Rename/Duplicate/Publish/Delete items. |
| 6 | PointContextMenu | [DD-32-005] Context menu contains expected point actions | skipped | No OPC point elements accessible (OPC offline, graphic failed to load). Cannot test Trend/Investigate/Report actions. |
| 7 | Toast Component | [DD-32-007] Toast component renders when triggered | ❌ fail | Duplicated workspace via right-click → Duplicate; API returned 404; no error toast shown. Notifications (F8) empty. |
| 8 | Toast Component | [DD-32-007] Toast max enforcement (3-toast max with badge) | skipped | Cannot test max enforcement — no toasts appeared in any tested operation. |
| 9 | Toast Component | [DD-32-007] Toast area location | skipped | Cannot verify toast location — no toasts appeared to observe placement. |

## New Bug Tasks Created

DD-32-015 — No toast shown when workspace duplication fails — silent 404 error

## Screenshot Notes

- fail-scenario2-no-toast.png: Console after + → Done; Notifications region visible but empty. Workspace count stays at 1 (save failed silently with 404).
- fail-scenario7-no-toast-duplicate.png: Console after right-click → Duplicate; Notifications region empty despite 404 error from backend. Toast component not firing for workspace CRUD failures.
- DD-32-005 point context menu cannot be fully tested without OPC connection (no data-bound SVG elements available to right-click).
