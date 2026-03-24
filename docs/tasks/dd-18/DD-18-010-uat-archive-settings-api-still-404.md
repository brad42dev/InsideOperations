---
id: DD-18-010
unit: DD-18
title: Archive settings API /api/archive/settings still returns 404 — form never loads
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-18/CURRENT.md
---

## What to Build

The `/settings/archive` page in the Settings module loads (route exists, sidebar shows Archive link), but the content area immediately fails with "Failed to load archive settings. Ensure the archive service is running." because `GET /api/archive/settings` returns 404.

This task was previously addressed in DD-18-008 and DD-18-009, both of which were marked "verified" — but the UAT session on 2026-03-24 confirmed the API endpoint is still absent at runtime. The backend archive service does not expose a `/api/archive/settings` GET/PUT route.

**Observed:** Browser console shows `Failed to load resource: the server responded with Not Found @ /api/archive/settings`. The page content area shows red error text.

**Expected:** `GET /api/archive/settings` returns HTTP 200 with current archive configuration (retention periods, compression state, continuous aggregate settings). The page should display an editable form with those values.

## Acceptance Criteria

- [ ] GET /api/archive/settings returns 200 with archive configuration (not 404)
- [ ] The /settings/archive page loads without red error message — real form visible
- [ ] Retention period input fields are visible and show current values
- [ ] Compression toggle(s) are present and reflect current state
- [ ] Continuous aggregate settings section/inputs are visible
- [ ] Submitting/saving the form calls PUT /api/archive/settings and shows a success indicator

## Verification Checklist

- [ ] Navigate to /settings/archive — no red error message, real form visible
- [ ] Retention period inputs present in the form
- [ ] Compression toggle(s) present in the form
- [ ] Continuous aggregate settings present in the form
- [ ] Click Save — success toast or similar success indication shown, no error

## Do NOT

- Do not stub this with a TODO comment or an empty handler — that is what caused the repeated failures
- Do not return a mock/hardcoded 200 response — the endpoint must read real configuration from the database or archive service config
- Do not implement only GET — both GET and PUT must work

## Dev Notes

UAT failure from 2026-03-24: `/api/archive/settings` returns 404. Page shows "Failed to load archive settings. Ensure the archive service is running."
Screenshot: docs/uat/DD-18/scenario1-fail-api-404.png
Prior attempts: DD-18-007 (route missing), DD-18-008 (API missing), DD-18-009 (API missing — same fix attempted again). This is the third consecutive failure of the same underlying issue.
