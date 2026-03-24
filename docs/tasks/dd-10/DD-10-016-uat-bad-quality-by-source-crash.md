---
id: DD-10-016
unit: DD-10
title: BadQualityBySource widget crashes — sources.map is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The Equipment Health dashboard crashes entirely on load with:

  TypeError: sources.map is not a function

This error originates in the `BadQualityBySource` widget component. The widget
calls `.map()` on the API response for `/api/opc/points/status?filter=bad_quality&limit=50`,
but the value is not an array (it may be an error object, a wrapped `{data:[]}` response,
or null/undefined when the OPC service is unavailable).

The widget must safely handle non-array API responses and show a proper empty/error state
instead of crashing the entire dashboard error boundary.

## Acceptance Criteria

- [ ] Equipment Health dashboard opens without throwing a module-level error boundary
- [ ] BadQualityBySource widget renders actual content or a proper empty/loading/error state
- [ ] When the `/api/opc/points/status` endpoint returns non-array data (e.g., error object, wrapped response), the widget shows "No data" or "Failed to load" — not a JS crash
- [ ] No raw type-string badge "bad-quality-by-source" visible as widget content

## Verification Checklist

- [ ] Navigate to /dashboards, open Equipment Health — page loads without "Dashboards failed to load" error
- [ ] BadQualityBySource widget area shows content, empty state, or loading spinner — not a crash
- [ ] Check browser console: no TypeError from sources.map

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not assume the API always returns a bare array; guard with Array.isArray() before calling .map()

## Dev Notes

UAT failure from 2026-03-24: Equipment Health dashboard crashes. Console error:
  TypeError: sources.map is not a function (chunk-EMBGZOEE.js line 19137)
Error boundary: [IO ErrorBoundary / Dashboards]
Screenshot: docs/uat/DD-10/fail-equipment-health.png
OPC service not running — /api/opc/points/status returned 404, response is not an array.
Spec reference: DD-10-015 (Several widget types still render as raw type-label badges on non-alarm dashboards)
