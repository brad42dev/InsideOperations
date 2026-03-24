---
id: DD-13-014
unit: DD-13
title: Log module crashes — templates API response not guarded before .map call
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

The Log module crashes on every load because `(templatesData ?? []).map is not a function`. The API endpoint `/api/logs/templates` returns a non-array value (an error object or 429 Too Many Requests response) and the LogPage component does not guard against this before calling `.map()`.

The `??` null-coalescing guard only handles `null`/`undefined` — it does not protect against an API error response being an object with shape `{ error: {...}, success: false }`.

This is closely related to DD-13-013 ("Log module crashes — templates.map TypeError when API returns non-array") which is status=pending. This task exists to ensure the crash is fixed and the module loads successfully for UAT purposes.

## Acceptance Criteria

- [ ] Navigating to /log does not show the ErrorBoundary "Log failed to load" message
- [ ] When the templates API returns a non-array (error object, 429, network error), the component gracefully handles it (shows empty state or error message inline, does not crash)
- [ ] The `(templatesData ?? []).map` pattern is replaced with proper type-safe access: `Array.isArray(templatesData) ? templatesData.map(...) : []`

## Verification Checklist

- [ ] Navigate to /log → page loads with Log module UI visible (no error boundary)
- [ ] Log module shows log entries list or empty state — not a crash screen
- [ ] Reloading the module does not re-trigger the crash

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not only fix `templates` — audit all similar `.map` calls in LogPage for the same pattern

## Dev Notes

UAT failure from 2026-03-24: Log module at /log immediately triggers ErrorBoundary with message "(templatesData ?? []).map is not a function". The API returns 429 Too Many Requests for /api/logs/templates, resulting in an error response object that fails the .map() call.
Spec reference: DD-13-013 (same root cause, pending implementation)
