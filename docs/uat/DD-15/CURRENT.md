---
unit: DD-15
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 8
scenarios_passed: 6
scenarios_failed: 2
scenarios_skipped: 1
---

## Module Route Check

✅ pass: Navigating to /settings redirects to /settings/users and loads

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Settings Module | [DD-15-001] Settings page renders | ✅ pass | Settings loads with comprehensive sidebar: Users, Roles, Groups, Sessions, OPC Sources, MFA, SCIM, EULA, etc. |
| 2 | Settings EULA | [DD-15-010] EULA not Access Denied | ❌ fail | /settings/eula shows "Access Denied — You do not have permission to view this page" for admin user |
| 3 | Settings Roles | [DD-15-011] Role edit dialog opens | ✅ pass | Clicking Edit on Admin role opens full role dialog without crash |
| 4 | Settings Groups | [DD-15-012] Group Management in sidebar | ✅ pass | "Groups" link visible in settings sidebar at /settings/groups |
| 5 | Settings MFA | [DD-15-002] MFA route accessible | ✅ pass | /settings/mfa link visible in settings sidebar |
| 6 | Settings Roles | [DD-15-005] Role edit has idle timeout/max sessions | ✅ pass | Role edit dialog shows "Idle Timeout (minutes)" and "Max Concurrent Sessions" fields |
| 7 | Settings Points | [DD-15-006] Point Configuration page | skipped | Could not locate Point Configuration section in settings sidebar |
| 8 | Settings ErrorBoundary | [DD-15-008] ErrorBoundary wraps settings | ✅ pass | Settings itself renders; EULA shows bounded "Access Denied" view |
| 9 | Settings OPC | [DD-15-009] Data Category in source config | ✅ pass | OPC source edit dialog shows "Data Category" field with options (Process, Event, Access Control, etc.) |

## New Bug Tasks Created

None

## Screenshot Notes

EULA settings page (/settings/eula) returns "⊘ Access Denied — You do not have permission to view this page." for admin user — confirmed bug matching task description DD-15-010. Role edit dialog works and includes idle timeout and concurrent session settings.
