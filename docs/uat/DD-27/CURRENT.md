---
unit: DD-27
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 9
scenarios_passed: 1
scenarios_failed: 8
scenarios_skipped: 0
---

## Module Route Check

fail: Navigating to /alerts triggers an error boundary — "Alerts failed to load: templates.find is not a function". The /settings/sms-providers route loads correctly.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Alerts Module Rendering | [DD-27-007] Alerts page renders without error | ❌ fail | Error boundary: "Alerts failed to load — templates.find is not a function" |
| 2 | Alerts Module Rendering | [DD-27-007] Alert composer accessible | ❌ fail | Cannot access — page crashed before composer could be reached |
| 3 | Channel Adapter Visibility | [DD-27-007] SMS channel option present in alert composer | ❌ fail | Cannot access — page crashed |
| 4 | Channel Adapter Visibility | [DD-27-007] PA channel option present in alert composer | ❌ fail | Cannot access — page crashed |
| 5 | Channel Adapter Visibility | [DD-27-007] Radio channel option present in alert composer | ❌ fail | Cannot access — page crashed |
| 6 | Channel Adapter Visibility | [DD-27-007] Push/BrowserPush channel option present in alert composer | ❌ fail | Cannot access — page crashed |
| 7 | Channel Interaction | [DD-27-007] Channel checkbox toggleable | ❌ fail | Cannot access — page crashed |
| 8 | Channel Interaction | [DD-27-007] Alert templates page renders | ❌ fail | Cannot access — page crashed |
| 9 | SMS Providers Settings | [DD-27-007] SMS Providers settings accessible | ✅ pass | /settings/sms-providers renders "SMS Providers" heading, "Add Provider" button, no Access Denied |

## New Bug Tasks Created

DD-27-013 — Alerts module channel adapters untestable — module crashes on load (templates.find is not a function)

## Screenshot Notes

- docs/uat/DD-27/fail-alerts-crash.png — Error boundary visible at /alerts: "Alerts failed to load — templates.find is not a function". This is the same crash already tracked as DD-27-012 (pending). All channel adapter scenarios (SMS, PA, Radio, Push) for DD-27-007 cannot be verified until this crash is resolved.
- SMS Providers (/settings/sms-providers) loaded correctly with "Add Provider" button visible. The "Loading…" text below is a backend API issue (404 on provider list), not a frontend crash.
