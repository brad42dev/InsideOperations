---
unit: DD-27
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 0
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

pass: /alerts loads. /settings/sms-providers shows "Access Denied".

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Alert System | [DD-27-010] SMS Providers page without Access Denied | ❌ fail | /settings/sms-providers still shows "Access Denied — You do not have permission to view this page." for admin user |
| 2 | Alert System | [DD-27-007] Alert channels shows multiple types | ❌ fail | Alerts compose CHANNELS section shows only "websocket" checkbox. No email/SMS/other channels. |
| 3 | Alert System | [DD-27-010] Settings renders without permission error | ❌ fail | Same as Scenario 1 — RBAC permission fix not applied |

## New Bug Tasks Created

None

## Screenshot Notes

- Screenshot docs/uat/DD-27/dd27-010-sms-access-denied.png: Access Denied for admin on /settings/sms-providers
- DD-27-003, DD-27-004 (CancellationToken, startup recovery) are backend behavioral changes not browser-testable
