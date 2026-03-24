---
id: DD-10-018
unit: DD-10
title: TrendChart widget crashes — results.some is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The Reactor Unit 1 KPIs dashboard crashes entirely on load with:

  TypeError: results.some is not a function

This error originates in the `TrendChart` widget component. The widget calls `.some()`
on its fetched results (likely the time-series data or point query results), but the
value is not an array. The widget must safely handle non-array API responses and show
a proper empty/error state instead of crashing the entire dashboard error boundary.

## Acceptance Criteria

- [ ] Reactor Unit 1 KPIs dashboard opens without throwing a module-level error boundary
- [ ] TrendChart widget renders a trend chart or a proper empty/loading/error state — NOT a raw "trend-chart" type badge and NOT a JS crash
- [ ] When API returns non-array data, the widget shows "No data available" or a chart with no points — not a JS crash
- [ ] No raw type-string badge "trend-chart" visible as widget content

## Verification Checklist

- [ ] Navigate to /dashboards, open Reactor Unit 1 KPIs — page loads without "Dashboards failed to load" error
- [ ] Unit 1 Trends widget shows a chart or a "No data" placeholder — not the raw string "trend-chart"
- [ ] Check browser console: no TypeError from results.some

## Do NOT

- Do not stub this with a TODO comment
- Do not assume time-series queries always return a bare array; guard with Array.isArray() before calling .some()

## Dev Notes

UAT failure from 2026-03-24: Reactor Unit 1 KPIs dashboard crashes. Console error:
  TypeError: results.some is not a function (chunk-EMBGZOEE.js line 19137)
Error boundary: [IO ErrorBoundary / Dashboards]
Screenshot: docs/uat/DD-10/fail-reactor-unit1-kpis.png
Spec reference: DD-10-015
