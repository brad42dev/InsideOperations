---
unit: DD-32
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 5
scenarios_passed: 4
scenarios_failed: 1
scenarios_skipped: 3
---

## Module Route Check

pass: Shared UI components visible across modules — theme switching, ECharts, toast region all present.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Charts | [DD-32-002] Charts render with correct theme | ✅ pass | Dashboard widgets use ECharts — rendered in Active Alarms dashboard |
| 2 | Charts | [DD-32-002] Theme change updates app | ✅ pass | Light/Dark/HPHMI theme switching works — app re-renders in selected theme |
| 3 | Toast | [DD-32-007] Toast appears on action | ❌ fail | Workspace creation failure produced no toast — silent failure; only workspace creation triggered no toast notification |
| 4 | Point Detail | [DD-32-004] PointDetailPanel opens | skipped | No point values available to right-click |
| 5 | Point Context | [DD-32-005] Point context menu actions | skipped | No live points |
| 6 | Point Picker | [DD-32-006] PointPicker favorites tab | skipped | Not tested |
| 7 | Theme | [DD-32-002] Console renders with correct theme | ✅ pass | Console page renders in current theme, no invisible/white-on-white elements |
| 8 | Toast | [DD-32-007] Notifications region present | ✅ pass | Notifications region (F8 shortcut) visible in all pages |

## New Bug Tasks Created

DD-32-010 — Toast notification not shown on workspace creation failure (silent fail)

## Screenshot Notes

- docs/uat/DD-32/console-light-theme.png — Light theme applied to console
- docs/uat/DD-32/console-hphmi-theme.png — HPHMI theme applied to console
- docs/uat/DD-32/console-workspace-created.png — Workspace creation attempt showed no toast notification (expected error toast for failed creation)
- DD-32-004/005/006 require live point data to test properly
