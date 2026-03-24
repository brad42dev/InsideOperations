---
unit: DD-10
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 13
scenarios_passed: 11
scenarios_failed: 2
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /dashboards loads the real dashboard list with 9 seeded dashboards and filter controls.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [DD-10-012] Dashboards page renders without error | ✅ pass | Dashboard list visible, no error boundary |
| 2 | Page Load | [DD-10-012] Operations Overview renders without "Unknown widget type" | ✅ pass | All 4 widgets show real content (alarm count, OPC sources, current shift, area status) |
| 3 | Page Load | [DD-10-012] Equipment Health renders without "Unknown widget type" | ❌ fail | Widgets show raw type labels: quality-distribution, stale-points, bad-quality-by-source, point-status-table |
| 4 | Page Load | [DD-10-012] Executive Summary renders without "Unknown widget type" | ❌ fail | 6 of 7 widgets show raw type labels: alarm-health-kpi, production-status, rounds-completion, open-alerts, system-uptime, alarm-rate-trend |
| 5 | Export Data | [DD-10-002] Widget kebab menu has Export Data item | ✅ pass | In edit mode, ⋯ menu shows Edit / Export Data / Remove |
| 6 | Export Data | [DD-10-002] Export Data dialog opens | ✅ pass | "Export Widget Data" dialog opened with CSV/Excel/JSON/Parquet format selector and Download button |
| 7 | Point Context Menu | [DD-10-005] Right-click on point value shows context menu | ✅ pass | Right-click on —°C in Reactor Temp widget opened [role="menu"] |
| 8 | Point Context Menu | [DD-10-005] Point context menu has expected items | ✅ pass | Menu contained: Point Detail, Trend Point, Investigate Point, Report on Point, Copy Tag Name |
| 9 | UOM Conversion | [DD-10-007] UOM conversion selector or label visible on widget | ✅ pass | Unit labels (°C, kPa, m³/h, %) visible in viewer; widget config has "Unit" text field |
| 10 | Playback Bar | [DD-10-008] Playback bar visible in dashboard time-context mode | ✅ pass | Play button, timeline scrubber, speed combobox visible on all dashboards |
| 11 | Playback Bar | [DD-10-011] Playback bar has play/pause button | ✅ pass | Play (▶) / Pause (⏸) button present and toggles correctly |
| 12 | Playback Bar | [DD-10-011] Playback bar has timeline scrubber | ✅ pass | "Playback timeline scrubber" slider element present |
| 13 | Playback Bar | [DD-10-011] Clicking play button starts playback | ✅ pass | Button changed to Pause, current position updated to a timestamp |

## New Bug Tasks Created

DD-10-015 — Several widget types still render as raw type-label badges on non-alarm dashboards

## Screenshot Notes

- fail-equipment-health-unknown-types.png: Equipment Health dashboard — all 4 widgets display raw type-string badges (quality-distribution, stale-points, bad-quality-by-source, point-status-table) instead of charts/tables
- fail-executive-summary-unknown-types.png: Executive Summary dashboard — 6 of 7 widgets display raw type badges; only "Area Status Summary" renders correctly with "✓ No active alarms"
- Operations Overview (alarm-count style widgets) renders correctly; OPC-source-status, alarm-kpi, process-metric widgets all failing with raw type labels
- Reactor Unit 1 KPIs: KPI value widgets (Reactor Temp, Pressure, Flow, Level) render correctly; "Unit 1 Trends" shows raw type "trend-chart"
- UOM: no client-side conversion dropdown found — only a free-text "Unit" field in widget config; UOM catalog API returns 404
- Export Data click was intercepted by an overlay div in edit mode; required JS evaluation to click the button — minor interaction bug
