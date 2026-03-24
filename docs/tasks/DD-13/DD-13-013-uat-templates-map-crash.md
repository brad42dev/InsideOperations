---
id: DD-13-013
unit: DD-13
title: Log module crashes — templates.map TypeError when API returns non-array
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-13/CURRENT.md
---

## What to Build

Both `LogPage` (/log) and `LogSchedulesPage` (/log/schedules) call `.map()` on templates data returned from the API without guarding against non-array responses. When `/api/logs/templates` returns a non-array (e.g. a 429 error object, a paginated wrapper, or a 404 error body), the component crashes immediately with:

- `(templatesData ?? []).map is not a function` on /log
- `templates.map is not a function` on /log/schedules

The `?? []` guard is insufficient — it only handles `null` or `undefined`, not a truthy object like `{ error: "...", status: 429 }`.

**Observed:** Every load of /log and /log/schedules hits the error boundary within ~2 seconds of the API response arriving. The UI structure renders correctly in the brief window before the crash, confirming the layout is implemented but the data guard is broken.

**Root cause:** The template filter dropdown and the schedule form both depend on a templates list. When the API call fails or returns an unexpected shape, the component does not fall back to an empty array.

## Acceptance Criteria

- [ ] LogPage does not crash when `/api/logs/templates` returns a non-array (error object, pagination wrapper, empty response)
- [ ] LogSchedulesPage does not crash when `/api/logs/templates` returns a non-array
- [ ] Both pages show the template filter/combobox with an empty or "All templates" default when the templates API fails
- [ ] Both pages remain usable (no error boundary) even when the templates endpoint is unreachable or rate-limited

## Verification Checklist

- [ ] Navigate to /log — page stays mounted, no "Log failed to load" error boundary, full UI visible
- [ ] Navigate to /log/schedules — page stays mounted, shows schedule list (empty OK) and "+ New Schedule" button
- [ ] With backend unavailable, /log loads with template filter showing default "All templates" option
- [ ] Clicking Export dropdown on /log shows CSV, XLSX, PDF, JSON options (previously blocked by crash)
- [ ] Clicking "+ New Schedule" on /log/schedules opens a form (previously blocked by crash)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not assume the API always returns an array — the guard must handle objects, null, undefined, and error shapes
- Do not only fix LogPage without fixing LogSchedulesPage — both have the same bug

## Dev Notes

UAT failure from 2026-03-24: `/api/logs/templates` returned 429 (Too Many Requests). Both `(templatesData ?? []).map is not a function` and `templates.map is not a function` observed in browser console.
Spec reference: DD-13-007 (template filter), DD-13-008 (schedule management UI)
Screenshots: docs/uat/DD-13/scenario1-error-boundary.png, docs/uat/DD-13/scenario10-schedule-crash.png
