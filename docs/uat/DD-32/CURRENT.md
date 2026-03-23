---
unit: DD-32
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 5
scenarios_passed: 2
scenarios_failed: 3
scenarios_skipped: 4
---

## Module Route Check

pass: Console and dashboard pages load without error.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Toast | [DD-32-007] Toast appears on triggered action | ❌ fail | Dashboard Save action produced no toast notification (silent success/failure) |
| 2 | Toast | [DD-32-007] Error toasts persist | skipped | Cannot test — no toast appeared in S1 |
| 3 | Toast | [DD-32-010] Toast shown on workspace failure | ❌ fail | Save action on dashboard produced no visible toast feedback |
| 4 | Context Menu | [DD-32-005] PointContextMenu has correct actions | skipped | No accessible point values in console (no workspaces) |
| 5 | Context Menu | [DD-32-005] Context menu renders on point right-click | skipped | No accessible point values to right-click |
| 6 | Point Detail | [DD-32-004] PointDetailPanel shows all sections | skipped | No accessible point values in UI |
| 7 | ECharts | [DD-32-002] ECharts renders in current theme | ✅ pass | Dashboards load without theme errors or error boundaries |
| 8 | PointPicker | [DD-32-006] PointPicker has Favorites tab | ❌ fail | Widget config "Metric" field is plain text input with "Search points..." placeholder — no Browse/Search/Favorites tabs |
| 9 | Shared | [DD-32-002] Console renders without error | ✅ pass | /console loads without error boundary |

## New Bug Tasks Created

DD-32-011 — No toast notification shown on dashboard save (silent action — no success/error feedback)
DD-32-012 — PointPicker is plain text input, missing Browse/Search/Favorites tab interface

## Screenshot Notes

Widget config accessed via ⋯ → Edit in Reactor Unit 1 KPIs dashboard. Metric field is a simple text input, not a tabbed point picker component.
