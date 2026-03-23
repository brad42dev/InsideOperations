---
unit: DD-18
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 2
scenarios_passed: 1
scenarios_failed: 1
scenarios_skipped: 1
---

## Module Route Check

✅ pass: App is running — archive service is online (health check returns 5/5 services healthy)

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Archive API | [DD-18-001] Archive API responds | ✅ pass | System Health page shows archive-service as Healthy |
| 2 | Archive | [DD-18-002] Historical data loads in trend | ❌ fail | Console module crashes preventing any trend/historical data display |
| 3 | Archive | [DD-18-005] No archive-related errors | skipped | Cannot verify — console module failing for unrelated reason |

## New Bug Tasks Created

None

## Screenshot Notes

Backend units (DD-18) are mostly not browser-testable. Archive service shows as Healthy in /settings/health.
