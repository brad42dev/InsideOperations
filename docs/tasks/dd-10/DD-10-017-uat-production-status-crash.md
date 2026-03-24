---
id: DD-10-017
unit: DD-10
title: ProductionStatus widget crashes — sources.filter is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The Executive Summary dashboard crashes entirely on load with:

  TypeError: sources.filter is not a function

This error originates in the `ProductionStatus` widget component. The widget calls
`.filter()` on its data (likely the OPC sources or point data), but the value is not
an array. The widget must safely handle non-array API responses and display a proper
empty or error state rather than crashing the entire dashboard error boundary.

## Acceptance Criteria

- [ ] Executive Summary dashboard opens without throwing a module-level error boundary
- [ ] ProductionStatus widget renders production status content or a proper empty/loading/error state
- [ ] When API returns non-array data, the widget shows "No data" or "Failed to load" — not a JS crash
- [ ] No raw type-string badge "production-status" visible as widget content

## Verification Checklist

- [ ] Navigate to /dashboards, open Executive Summary — page loads without "Dashboards failed to load" error
- [ ] ProductionStatus widget area shows content, empty state, or loading spinner — not a crash
- [ ] Check browser console: no TypeError from sources.filter

## Do NOT

- Do not stub this with a TODO comment
- Do not assume the API always returns a bare array; guard with Array.isArray() before calling .filter()

## Dev Notes

UAT failure from 2026-03-24: Executive Summary dashboard crashes. Console error:
  TypeError: sources.filter is not a function (chunk-EMBGZOEE.js line 19198)
Error boundary: [IO ErrorBoundary / Dashboards]
Screenshot: docs/uat/DD-10/fail-executive-summary.png
Spec reference: DD-10-015
