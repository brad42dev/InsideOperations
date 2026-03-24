---
unit: DD-31
date: 2026-03-24
uat_mode: auto
verdict: fail
scenarios_tested: 2
scenarios_passed: 0
scenarios_failed: 2
scenarios_skipped: 7
---

## Module Route Check

fail: Navigating to /alerts triggers JavaScript error boundary — "templates.find is not a function". Module crashes on load.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Alerts | [DD-31-014] Alert compose shows multiple channels | ❌ fail | Module crashes before compose form is reachable |
| 2 | Alerts | [DD-31-015] Channels API not 404 | ❌ fail | Module crash with "templates.find is not a function" — templates API returns non-array |
| 3 | Alerts | [DD-31-016] Notification channels API working | skipped | Module crashes — cannot reach alert compose |
| 4 | Alerts | [DD-31-003] Template variable definitions | skipped | Module crashes — cannot inspect templates |
| 5 | Alerts | [DD-31-005] Available channels from config | skipped | Module crashes on load |
| 6 | Alerts | [DD-31-006] Real-time delivery status | skipped | Module crashes on load |
| 7 | Alerts | [DD-31-007] Export Unaccounted List | skipped | Module crashes on load |
| 8 | Alerts | [DD-31-008] Export button in Alert History | skipped | Module crashes on load |
| 9 | Alerts | [DD-31-010] Loading skeletons present | skipped | Module crashes — error boundary shown instead of skeleton |

## New Bug Tasks Created

DD-31-017 — Alerts module crashes on load — templates.find is not a function

## Screenshot Notes

Crash screenshot: docs/uat/DD-31/alerts-crash.png
Error: "Alerts failed to load / templates.find is not a function / Reload Alerts" button shown.
Error boundary button says "Reload Alerts" not "Reload Module" — confirms DD-32 label bug.
