---
unit: DD-27
date: 2026-03-24
uat_mode: auto
verdict: fail
scenarios_tested: 2
scenarios_passed: 0
scenarios_failed: 2
scenarios_skipped: 2
---

## Module Route Check

fail: /settings/sms-providers shows "Access Denied" for admin user — RBAC configuration bug.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | SMS | [DD-27-009] SMS Providers settings accessible | ❌ fail | /settings/sms-providers shows "Access Denied" for admin |
| 2 | SMS | [DD-27-010] SMS Providers page loads | ❌ fail | "You do not have permission to view this page." displayed |
| 3 | Alert | [DD-27-007] Channel adapters in alert compose | skipped | Alerts module crashed before reaching compose form |
| 4 | Alert | [DD-27-007] Alert settings page renders | skipped | Alerts module crashes on load — cannot test settings page |

## New Bug Tasks Created

DD-27-011 — SMS Providers settings page shows Access Denied for admin user

## Screenshot Notes

SMS Access Denied screenshot: docs/uat/DD-27/sms-access-denied.png
Admin user lacks permission for sms-providers and eula settings pages — same RBAC bug pattern as DD-15.
