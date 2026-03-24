---
id: DD-18-009
unit: DD-18
title: Archive settings API GET/PUT /api/archive/settings returns 404 — form never loads
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-18/CURRENT.md
---

## What to Build

The `/settings/archive` route renders correctly and the sidebar shows the "Archive" link, but the content area immediately shows an error:
**"Failed to load archive settings. Ensure the archive service is running."**

Browser console confirms: `GET /api/archive/settings` returns **404 Not Found**.

The archive service (port 3005) does not implement the `GET /api/archive/settings` endpoint (nor the companion `PUT /api/archive/settings` for saving). The frontend page was built and routes correctly, but the backend endpoint was never added.

**Expected behavior:**
- `GET /api/archive/settings` returns 200 with current archive configuration including:
  - Retention periods for raw and aggregate tiers
  - Compression enabled/disabled flags
  - Continuous aggregate refresh intervals
- `PUT /api/archive/settings` accepts updated configuration and persists it
- The `/settings/archive` page displays a form with these fields, pre-populated from the GET response
- Saving the form calls PUT and shows a success indication

## Acceptance Criteria

- [ ] GET /api/archive/settings returns 200 with archive configuration (not 404)
- [ ] The /settings/archive page loads without error message — real form visible
- [ ] Retention period input fields are visible and show current values
- [ ] Compression toggle(s) are present and reflect current state
- [ ] Continuous aggregate settings section/inputs are visible
- [ ] Submitting/saving the form calls PUT /api/archive/settings and does not show an error

## Verification Checklist

- [ ] Navigate to /settings/archive — no red error message, real form visible
- [ ] Retention period inputs present in the form
- [ ] Compression toggle(s) present in the form
- [ ] Continuous aggregate settings present in the form
- [ ] Save/submit the form — no error, success indication shown
- [ ] No silent no-ops: clicking Save produces visible change (success toast or similar)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the GET endpoint — the PUT endpoint must also work
- Do not return hardcoded values — read/write from the actual database configuration

## Dev Notes

UAT failure from 2026-03-24: Navigated to /settings/archive — page shell loads correctly but content area shows "Failed to load archive settings. Ensure the archive service is running." in red text. Console error: `GET http://localhost:5173/api/archive/settings` → 404 Not Found.

Spec reference: DD-18-007 (archive settings page route), DD-18-008 (this task — the original bug report for the missing API)
