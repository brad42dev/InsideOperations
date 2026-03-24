---
unit: DD-10
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 8
scenarios_passed: 1
scenarios_failed: 7
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /dashboards loads real implementation (dashboard list with cards, filter bar, search)

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [DD-10-015] Dashboards page renders without error | ✅ pass | /dashboards loaded correctly with full dashboard list |
| 2 | Equipment Health | [DD-10-015] Equipment Health dashboard loads | ❌ fail | Crashes with "Dashboards failed to load — sources.map is not a function" (BadQualityBySource widget) |
| 3 | Equipment Health | [DD-10-015] Equipment Health widgets show real content | ❌ fail | Untestable — page crashed before any widgets rendered |
| 4 | Executive Summary | [DD-10-015] Executive Summary dashboard loads | ❌ fail | Crashes with "Dashboards failed to load — sources.filter is not a function" (ProductionStatus widget) |
| 5 | Executive Summary | [DD-10-015] Executive Summary widgets show real content | ❌ fail | Untestable — page crashed before any widgets rendered |
| 6 | Reactor Unit 1 KPIs | [DD-10-015] Reactor Unit 1 KPIs dashboard loads | ❌ fail | Crashes with "Dashboards failed to load — results.some is not a function" (TrendChart widget) |
| 7 | Reactor Unit 1 KPIs | [DD-10-015] Trend chart widget renders as chart not type badge | ❌ fail | Untestable — page crashed before TrendChart widget rendered |
| 8 | No Raw Type Strings | [DD-10-015] No raw widget type strings visible across dashboards | ❌ fail | All 3 target dashboards crash entirely. Active Alarms dashboard works (proper empty states, no raw badges) |

## New Bug Tasks Created

DD-10-016 — BadQualityBySource widget crashes — sources.map is not a function
DD-10-017 — ProductionStatus widget crashes — sources.filter is not a function
DD-10-018 — TrendChart widget crashes — results.some is not a function

## Screenshot Notes

- Equipment Health: screenshot at docs/uat/DD-10/fail-equipment-health.png — full module error boundary
- Executive Summary: screenshot at docs/uat/DD-10/fail-executive-summary.png — full module error boundary
- Reactor Unit 1 KPIs: screenshot at docs/uat/DD-10/fail-reactor-unit1-kpis.png — full module error boundary
- All 3 dashboards fail with the same pattern: a widget component calls a method (.map, .filter, .some) on a value that is not an array. Root cause is likely API responses are wrapped objects or error objects rather than bare arrays
- Active Alarms dashboard (alarm widgets) loads and renders correctly — alarm-count-by-severity, unack-count, alarm-list all show proper empty states ("No active alarms", "0")
- The quality-distribution, stale-points, bad-quality-by-source (Equipment Health), production-status (Executive Summary), and trend-chart (Reactor Unit 1 KPIs) widgets all crash their dashboards
