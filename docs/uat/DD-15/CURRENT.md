---
unit: DD-15
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 8
scenarios_passed: 4
scenarios_failed: 3
scenarios_skipped: 1
---

## Module Route Check

pass: Settings page loads with comprehensive sidebar; 3 specific pages fail

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Settings | Page renders | ✅ pass | Settings page loads with 22-item sidebar |
| 2 | Settings | MFA/API Keys/SCIM routes | ✅ pass | MFA, API Keys, SCIM links all present in settings sidebar |
| 3 | Settings | OPC form client cert + platform | ✅ pass | Client cert dropdown, platform dropdown, min interval all in OPC form |
| 4 | Settings | Group Management CRUD | ❌ fail | No Groups page in settings sidebar; /settings/groups route missing |
| 5 | Settings | Role edit idle timeout | ❌ fail | Role edit dialog crashes: 'Cannot read properties of undefined (reading map)' |
| 6 | Settings | Point Configuration page | skipped | No /settings/points in sidebar |
| 7 | Settings | EULA markdown editor | ❌ fail | EULA page shows 'Access Denied' for admin user |
| 8 | Settings | Export buttons in settings | ✅ pass | Export buttons present on OPC Sources and Roles pages |
| 9 | Settings | Data Category in source config | ✅ pass | Data category dropdown visible in OPC source form |

## New Bug Tasks Created

DD-15-010 — EULA settings page returns Access Denied for admin user
DD-15-011 — Settings role edit dialog crashes with TypeError on open
DD-15-012 — Group Management CRUD is missing from settings sidebar

## Screenshot Notes

Screenshots: dd15-role-edit-crash.png. EULA Access Denied for admin suggests wrong permission guard. Role edit crashes on undefined.map.
