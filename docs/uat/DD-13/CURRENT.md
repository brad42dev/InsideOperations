---
unit: DD-13
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 11
scenarios_passed: 8
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /log loads real implementation — Active Logs, Completed, Templates tabs visible, search/filter panel present, no error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | RBAC | [DD-13-017] Log module renders without error | ✅ pass | Active Logs, Completed, Templates tabs visible |
| 2 | RBAC | [DD-13-017] /log/templates accessible for admin | ✅ pass | Page loads with "Log Templates" heading, no PermissionGuard block |
| 3 | RBAC | [DD-13-017] /log/schedules accessible for admin | ✅ pass | Page loads with "Log Schedules" heading, no PermissionGuard block |
| 4 | Data Flow | [DD-13-024] data flow: GET /api/v1/logs/templates | ✅ pass | 6 templates returned (Font Test Template, PointContextMenu Test, Test Template, UAT Test Template, etc.) — dropdown populated |
| 5 | Template Dropdown | [DD-13-024] Template dropdown populates on /log/new | ✅ pass | 6 named options visible after 3s load |
| 6 | Template Dropdown | [DD-13-024] Start Entry enables after template selection | ✅ pass | Button went from disabled to enabled on select |
| 7 | Instance Creation | [DD-13-023] Start Entry navigates to editor | ✅ pass | Navigated to /log/{uuid} editor with template content loaded |
| 8 | WYSIWYG | [DD-13-016] Font-family control visible in toolbar | ✅ pass | combobox "Font family" present with options: Default, Inter, Serif, Monospace, Arial, Georgia. Note: 2 Tiptap warnings about duplicate extension names |
| 9 | Context Menu | [DD-13-019] Right-click template row opens menu | ❌ fail | No template rows in /log/templates or /log Templates tab — both show empty state "No templates yet" despite 6 templates existing in DB and loading in /log/new dropdown |
| 10 | Context Menu | [DD-13-019] Template context menu contains expected items | ❌ fail | Cannot test — no rows to right-click (see scenario 9) |
| 11 | Point Context Menu | [DD-13-018] Right-click point row in PointDataSegment | ❌ fail | All PointDataSegment instances show "No points configured for this segment." — no point rows exist to right-click |

## New Bug Tasks Created

DD-13-029 — Log templates list empty — /log/templates and Templates tab fetch from broken endpoint
DD-13-030 — PointDataSegment shows no point rows — cannot verify PointContextMenu wiring

## Screenshot Notes

- dd13-scenario9-no-template-rows.png: /log Templates tab showing "No templates yet" — templates exist in DB but don't appear in list views (/log/templates and /log Templates tab). /log/new fetches from a working endpoint while list views appear to call a different/broken route.
- dd13-scenario11-no-point-rows.png: PointContextMenu Test instance showing "No points configured for this segment." — PointDataSegment renders correctly but has no data rows to test right-click against.
- Seed data status: UNAVAILABLE (psql not accessible during pre-check). Templates confirmed present via API responses logged in browser console.
- Tiptap duplicate extension warning on LogEditor load (font-family extension registered twice).
