---
id: DD-10-019
unit: DD-10
title: Equipment Health dashboard crashes — QualityDistribution widget throws sources.filter is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The Equipment Health dashboard crashes with a module-level error boundary displaying "Dashboards failed to load — sources.filter is not a function". The crash originates from the QualityDistribution widget, which calls `.filter()` on data returned from `/api/opc/points/current-quality` before verifying it is an array.

This is the same class of bug as DD-10-016 (BadQualityBySource calling `.map()` on non-array data). The fix for DD-10-016 addressed `.map()` in the BadQualityBySource widget, but the QualityDistribution widget still calls `.filter()` on data that may be an error object, wrapped response, or null when the API returns non-2xx or the backend is unreachable.

The fix must guard all array method calls in QualityDistribution (and any other widgets on this dashboard) with `Array.isArray()` checks before calling `.filter()`, `.map()`, `.some()`, `.reduce()`, or similar methods.

## Acceptance Criteria

- [ ] Equipment Health dashboard opens without throwing a module-level error boundary
- [ ] QualityDistribution widget renders chart/table content or a proper empty/loading/error state
- [ ] When `/api/opc/points/current-quality` returns non-array data, widget shows "No data" or "Failed to load" — not a JS crash
- [ ] No raw type-string badge "quality-distribution" visible as widget content

## Verification Checklist

- [ ] Navigate to /dashboards, open Equipment Health — page loads without "Dashboards failed to load" error boundary
- [ ] QualityDistribution widget area shows content, empty state, or loading spinner — not a crash
- [ ] Check browser console: no TypeError from sources.filter
- [ ] All other widgets on Equipment Health also render without crash (stale-points, bad-quality-by-source, point-status-table)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — guard against non-array API responses

## Dev Notes

UAT failure from 2026-03-24: Equipment Health crashed with "sources.filter is not a function" at chunk-EMBGZOEE.js:19137, error boundary at ErrorBoundary.tsx:10 — [IO ErrorBoundary / Dashboards].
Screenshot: docs/uat/DD-10/fail-equipment-health-crash.png
Spec reference: DD-10-016 (same pattern — non-array safety), DD-10-015 (widget rendering requirements)
