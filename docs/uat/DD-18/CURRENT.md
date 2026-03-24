---
unit: DD-18
date: 2026-03-24
uat_mode: auto
verdict: fail
scenarios_tested: 2
scenarios_passed: 0
scenarios_failed: 2
scenarios_skipped: 1
---

## Module Route Check

fail: No dedicated archive/timeseries settings route exists. /settings/archive returns 404. Settings sidebar has no Archive link.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Archive | [DD-18-002] Archive API accessible | ❌ fail | No archive/timeseries settings page found — /settings/archive returns 404, no link in settings sidebar |
| 2 | Archive | [DD-18-002] Archive resolution tiers | ❌ fail | No page to test 15m/1d resolution options — archive settings route does not exist |
| 3 | Archive | [DD-18-002] Page renders without error | skipped | No archive page to navigate to — System Health page shows archive-service Healthy but has no settings |

## New Bug Tasks Created

DD-18-007 — Archive/timeseries settings page does not exist — route returns 404

## Screenshot Notes

/settings/archive route returns 404. Settings sidebar shows no Archive or Time-Series settings section. System Health page only shows service status (archive-service: Healthy) but no configuration options.
