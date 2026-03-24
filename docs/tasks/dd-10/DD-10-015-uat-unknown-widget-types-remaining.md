---
id: DD-10-015
unit: DD-10
title: Several widget types still render as raw type-label badges on non-alarm dashboards
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

Multiple widget types on non-alarm dashboards render their type identifier as a raw text badge
(e.g., "quality-distribution", "production-status", "stale-points") instead of actual widget content.

Dashboards confirmed failing:
- **Equipment Health**: quality-distribution, stale-points, bad-quality-by-source, point-status-table
- **Executive Summary**: alarm-health-kpi, production-status, rounds-completion, open-alerts, system-uptime, alarm-rate-trend
- **Reactor Unit 1 KPIs**: trend-chart (Unit 1 Trends widget)

Dashboards that render correctly:
- **Operations Overview**: alarm-count-kpi, opc-source-health, current-shift, area-status all work

Each unrecognised widget type needs a component implementation wired into the widget registry so it renders
real UI content (or a proper empty/no-data state). It must NOT fall through to a type-label fallback.

## Acceptance Criteria

- [ ] quality-distribution widget renders a chart or table showing OPC data quality distribution
- [ ] stale-points widget renders a count or list of stale OPC points
- [ ] bad-quality-by-source widget renders a breakdown of bad-quality points by OPC source
- [ ] point-status-table widget renders a table of point statuses
- [ ] alarm-health-kpi widget renders an alarm health KPI value or indicator
- [ ] production-status widget renders production status information
- [ ] rounds-completion widget renders rounds completion metric
- [ ] open-alerts widget renders count of open alerts
- [ ] system-uptime widget renders system uptime value
- [ ] alarm-rate-trend widget renders an alarm rate trend chart or value
- [ ] trend-chart widget renders a time-series trend chart
- [ ] No widget on any seeded dashboard shows a raw type-string badge

## Verification Checklist

- [ ] Navigate to /dashboards → open Equipment Health → all 4 widgets render content, no type badges
- [ ] Navigate to /dashboards → open Executive Summary → all 6 failing widgets now render content
- [ ] Navigate to /dashboards → open Reactor Unit 1 KPIs → Unit 1 Trends shows a chart not "trend-chart"
- [ ] Empty/loading state is acceptable — a spinner or "No data" message is not a type badge
- [ ] No widget shows raw type string as visible text (e.g., "alarm-health-kpi", "stale-points")

## Do NOT

- Do not stub unimplemented widgets with a TODO comment — that is exactly what caused this failure
- Do not treat the type label itself as acceptable empty state
- Do not implement only alarm-type widgets and skip non-alarm types

## Dev Notes

UAT failure from 2026-03-24: Equipment Health and Executive Summary dashboards show raw widget type
strings as content. Operations Overview widgets that render real UI (alarm-count, opc-status, shift,
area-status) show the correct pattern for how widgets should be implemented.

Spec reference: DD-10-012 (original audit task for this issue), DD-10-010 (alarm widget types)
Screenshots: docs/uat/DD-10/fail-equipment-health-unknown-types.png
             docs/uat/DD-10/fail-executive-summary-unknown-types.png
