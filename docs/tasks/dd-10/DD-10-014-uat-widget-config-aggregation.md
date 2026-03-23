---
id: DD-10-014
unit: DD-10
title: Widget config missing aggregation type selector
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The Widget Config panel (opened via ⋯ → Edit on a dashboard widget) only shows: Title, Metric (Search points...), Unit, Width, Height. It is missing an aggregation type selector (e.g., Last, Avg, Min, Max, Sum) required for KPI widgets displaying time-aggregated values.

## Acceptance Criteria

- [ ] Widget Config panel includes an aggregation type selector for KPI/value widgets
- [ ] Aggregation options include at minimum: Last, Average, Min, Max
- [ ] Selected aggregation type is saved and applied when the dashboard renders

## Verification Checklist

- [ ] Open a KPI widget in /designer/dashboards/{id}/edit via ⋯ → Edit
- [ ] Confirm aggregation type dropdown/selector is present in the config panel
- [ ] Change aggregation type and save — confirm it persists

## Do NOT

- Do not remove the existing config fields (Title, Metric, Unit, Width, Height)

## Dev Notes

UAT failure 2026-03-23: KPI widget config panel shows Title/Metric/Unit/Width/Height only — no aggregation type field.
Spec reference: DD-10-012
