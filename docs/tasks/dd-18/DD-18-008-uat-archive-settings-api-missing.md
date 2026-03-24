---
id: DD-18-008
unit: DD-18
title: Archive settings API endpoint /api/archive/settings returns 404 — form never loads
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-18/CURRENT.md
---

## What to Build

The `/settings/archive` frontend page exists and renders correctly, but the API endpoint it calls — `GET /api/archive/settings` — returns 404 Not Found. As a result, the user only ever sees the error message "Failed to load archive settings. Ensure the archive service is running." and cannot view or configure any archive settings.

The archive service needs to expose a `GET /api/archive/settings` (or routed equivalent via the API gateway at `/api/archive/settings`) that returns the current archive configuration including retention periods, compression settings, and continuous aggregate schedules.

A corresponding `PUT /api/archive/settings` endpoint is also required to allow the frontend to save changes.

## Acceptance Criteria

- [ ] GET /api/archive/settings returns 200 with current archive configuration (retention periods, compression enabled/disabled, continuous aggregate refresh intervals)
- [ ] The /settings/archive page successfully loads and displays the archive settings form
- [ ] Form fields for retention periods, compression toggles, and continuous aggregate settings are visible and editable
- [ ] Saving changes via the form calls PUT /api/archive/settings and persists the configuration

## Verification Checklist

- [ ] Navigate to /settings/archive — page loads without error message, real form visible
- [ ] Retention period inputs are present and show current values
- [ ] Compression toggle(s) are present and reflect current state
- [ ] Continuous aggregate settings are present
- [ ] Submitting the form does not show an error

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — ensure error states (e.g., archive service unreachable) are handled gracefully

## Dev Notes

UAT failure from 2026-03-24: Navigating to /settings/archive shows "Failed to load archive settings. Ensure the archive service is running." Console error: "Failed to load resource: the server responded with Not Found @ /api/archive/settings"
Spec reference: DD-18-007 (frontend page implementation), DD-18 task suite (archive service implementation)
Screenshot: docs/uat/DD-18/scenario4-archive-api-404.png
