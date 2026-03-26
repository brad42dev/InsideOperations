---
id: DD-10-012
title: '"Unknown widget type" error on non-alarm dashboards'
unit: DD-10
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

Non-alarm system dashboards (Operations Overview, Equipment Health, Alarm KPI Summary, etc.) all show "Unknown widget type: {type}" for every widget because the `WidgetContainer.tsx` switch statement only handles alarm-specific widget types. The seed data inserts dashboards with widget types like `alarm-kpi`, `opc-status`, `shift-info`, `area-status-table`, `trend-chart`, `kpi-card`, `service-health`, `production-status`, etc. that have no corresponding React component.

The Active Alarms dashboard works because it uses `alarm-count-by-severity`, `unack-count`, `alarm-rate`, and `alarm-list` — all of which are implemented. All other system dashboards fail.

The fix is to add stub/fallback widget implementations for the missing widget types. Stubs should display the widget title/type in a placeholder card rather than "Unknown widget type: {type}". Optionally, implement real components for the highest-value types.

## Acceptance Criteria

- [ ] Non-alarm system dashboards (Operations Overview, Equipment Health, etc.) no longer show "Unknown widget type"
- [ ] Each unrecognised widget type renders a placeholder card showing its title and type label
- [ ] The existing alarm-specific widget types (`alarm-count-by-severity`, `unack-count`, `alarm-rate`, `alarm-list`) continue to render correctly
- [ ] No TypeScript compilation errors

## Files to Create or Modify

- `frontend/src/pages/dashboards/widgets/WidgetContainer.tsx` — add fallback case for unrecognised types OR add cases for all seed widget types that map to a placeholder component
- `frontend/src/pages/dashboards/widgets/PlaceholderWidget.tsx` (create) — simple placeholder card that shows "Widget: {type}" with a muted style; accepts `config: WidgetConfig` prop

## Widget Types in Seed Data (to handle)

The following widget types appear in system dashboards but have no cases in the switch:
- `alarm-kpi` — KPI card variant for alarm count
- `alarm-health-kpi` — alarm health metric
- `alarm-rate-trend` — trend of alarm rate
- `opc-status` — OPC source health
- `shift-info` — current shift info
- `area-status-table` — area status table
- `point-status-table` — point status table
- `bad-quality-by-source` — bad quality count by source
- `chattering-count` — chattering point count
- `compliance-trend` — alarm compliance trend
- `db-size` — database size metric
- `exceedance-duration` — alarm exceedance duration
- `open-alerts` — open alerts count
- `priority-distribution` — alarm priority distribution chart
- `production-status` — production status
- `quality-distribution` — quality distribution
- `query` — custom query widget
- `rounds-completion` — rounds completion rate
- `service-health` — service health KPI
- `service-health-table` — service health table
- `shelved-count` — shelved alarm count
- `stale-points` — stale points count
- `standing-count` — standing alarm count
- `system-uptime` — system uptime
- `threshold-exceedance-table` — threshold exceedance table
- `trend-chart` — time series trend chart
- `ws-throughput` — WebSocket throughput
- `api-response-time` — API response time

## Verification Checklist

- [ ] TypeScript build passes: `cd frontend && npx tsc --noEmit`
- [ ] Navigate to `/dashboards` — all system dashboards (Operations Overview, Equipment Health, etc.) show placeholder cards instead of "Unknown widget type"
- [ ] Active Alarms dashboard still renders its 4 widget types correctly

## Do NOT

- Do not remove or change the alarm-specific widget implementations
- Do not implement full real-data components for placeholder types (stubs are sufficient)
- Do not add backend calls in placeholder widgets

## Dev Notes

UAT failure 2026-03-23: `docs/uat/DD-10/dashboard-detail.png` shows "Unknown widget type" on Operations Overview, Equipment Health, and other non-alarm dashboards. The `WidgetContainer.tsx` default case renders the raw type string. Fix: add a `PlaceholderWidget` and use it as the default case, or explicitly map all types.
