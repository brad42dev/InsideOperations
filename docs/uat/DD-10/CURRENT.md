---
unit: DD-10
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 2
scenarios_failed: 4
scenarios_skipped: 1
---

## Module Route Check

pass: Navigating to /dashboards loads real implementation — dashboard list with 9 system dashboards (Active Alarms, Alarm KPI Summary, etc.), search and filter controls visible.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Dashboard List | [DD-10-009] Dashboards page renders without error | ✅ pass | Page loads, no error boundary |
| 2 | Dashboard List | [DD-10-009] Dashboards shows list or empty state | ✅ pass | 9 system dashboards visible with categories and descriptions |
| 3 | Dashboard Viewer | [DD-10-008] Playback bar visible in dashboard viewer | ❌ fail | Only static time-range selector (15m/1h/6h/24h/7d/30d + From/To fields). No interactive Playback Bar with play/pause/seek controls |
| 4 | Dashboard Viewer | [DD-10-006] Widget config panel accessible | ❌ fail | No widget config panel visible in viewer mode; widgets show "Unknown widget type" errors |
| 5 | Dashboard Viewer | [DD-10-002] Kebab menu on widget | ❌ fail | No per-widget ⋯ kebab menu visible on widget cards in viewer |
| 6 | Widget Values | [DD-10-005] Point context menu on widget value | ⏭ skipped | No point values visible — all widgets show "Unknown widget type" errors |
| 7 | Widget Values | [DD-10-007] Widget values display | ❌ fail | All 4 widgets show "Unknown widget type: alarm-count-by-severity / unack-count / alarm-rate / alarm-list" |

## New Bug Tasks Created

DD-10-010 — Dashboard widgets render "Unknown widget type" for alarm-count-by-severity, unack-count, alarm-rate, alarm-list
DD-10-011 — Playback Bar (play/pause/seek) not implemented — only static time range selector in DashboardViewer

## Screenshot Notes

Dashboard viewer shows correct layout (title, time range bar, widget grid) but all 4 widgets in the "Active Alarms" dashboard render "Unknown widget type: X" instead of actual content. Widget type registry is missing implementations for: alarm-count-by-severity, unack-count, alarm-rate, alarm-list. The time range bar has preset buttons (15m/1h) and From/To date fields but no Playback Bar component with play/pause/seek for time-context mode.
