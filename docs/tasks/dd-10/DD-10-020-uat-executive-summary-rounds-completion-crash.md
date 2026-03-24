---
id: DD-10-020
unit: DD-10
title: Executive Summary dashboard crashes — RoundsCompletion widget throws instances.filter is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-10/CURRENT.md
---

## What to Build

The Executive Summary dashboard crashes with a module-level error boundary displaying "Dashboards failed to load — instances.filter is not a function". The crash originates from the RoundsCompletion widget, which calls `.filter()` on data returned from the rounds API before verifying it is an array.

This is the same class of bug as DD-10-017 (ProductionStatus calling `.filter()` on non-array data). The fix for DD-10-017 addressed the ProductionStatus widget but RoundsCompletion still calls `.filter()` on `instances` which may be an error object, wrapped response, or null when the API returns non-2xx or the backend is unreachable.

The fix must guard all array method calls in RoundsCompletion with `Array.isArray()` checks before calling `.filter()`, `.map()`, `.some()`, `.reduce()`, or similar methods.

## Acceptance Criteria

- [ ] Executive Summary dashboard opens without throwing a module-level error boundary
- [ ] RoundsCompletion widget renders actual content or a proper empty/loading/error state
- [ ] When rounds API returns non-array data, widget shows "No data" or "Failed to load" — not a JS crash
- [ ] No raw type-string badge "rounds-completion" visible as widget content

## Verification Checklist

- [ ] Navigate to /dashboards, open Executive Summary — page loads without "Dashboards failed to load" error boundary
- [ ] RoundsCompletion widget area shows content, empty state, or loading spinner — not a crash
- [ ] Check browser console: no TypeError from instances.filter
- [ ] All other widgets on Executive Summary also render without crash (alarm-health-kpi, production-status, open-alerts, system-uptime)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — guard against non-array API responses

## Dev Notes

UAT failure from 2026-03-24: Executive Summary crashed with "instances.filter is not a function", error boundary at ErrorBoundary.tsx:10 — [IO ErrorBoundary / Dashboards].
Screenshot: docs/uat/DD-10/fail-executive-summary-crash.png
Spec reference: DD-10-017 (same pattern — non-array safety), DD-10-015 (widget rendering requirements)
