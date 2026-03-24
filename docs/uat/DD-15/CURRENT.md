---
unit: DD-15
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 4
scenarios_passed: 1
scenarios_failed: 3
scenarios_skipped: 1
---

## Module Route Check

pass: Navigating to /settings/users loads real settings implementation — user management table visible.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Settings | [DD-15-003] Settings/OPC page renders | ✅ pass | /settings/opc-sources loaded with source list and configuration form visible |
| 2 | Settings | [DD-15-003] OPC source form fields | skipped | Client cert, platform, publish interval fields not tested in detail |
| 3 | Groups | [DD-15-004] Group Management CRUD | ❌ fail | /settings/groups shows "Failed to parse server response" — API returns 404 for /api/groups |
| 4 | EULA | [DD-15-007] EULA settings page | ❌ fail | /settings/eula shows "Access Denied" for admin user — not a markdown editor |
| 5 | EULA | [DD-15-010] EULA accessible to admin | ❌ fail | /settings/eula shows "Access Denied" — admin lacks required permission |

## New Bug Tasks Created

DD-15-013 — Group management page fails with API 404 on /api/groups
DD-15-014 — EULA settings page shows Access Denied for admin user

## Screenshot Notes

EULA Access Denied screenshot: docs/uat/DD-15/eula-access-denied.png
Groups API 404: /api/groups endpoint returns 404 — "Failed to parse server response" shown.
