---
id: DD-18-007
unit: DD-18
title: Archive/timeseries settings page does not exist — route returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-18/CURRENT.md
---

## What to Build

The /settings/archive route returns a 404 Not Found. There is no Archive section in the Settings sidebar, and no UI exists for configuring timeseries retention, compression, or continuous aggregates. The archive service runs and is shown as Healthy in the System Health page, but has no settings UI.

## Acceptance Criteria

- [ ] /settings/archive route loads a real settings page (not 404)
- [ ] Archive settings appear in the Settings sidebar navigation
- [ ] Settings UI allows configuring retention periods, compression, and continuous aggregates

## Verification Checklist

- [ ] Navigate to /settings → Archive section visible in sidebar
- [ ] Click Archive in sidebar → /settings/archive loads without 404
- [ ] Archive settings form is functional (retention period inputs, compression toggles)

## Do NOT

- Do not stub this with a placeholder page — the settings must be functional
- Do not implement only the route — sidebar navigation must also be updated

## Dev Notes

UAT failure from 2026-03-24: /settings/archive returns 404. Settings sidebar has no Archive entry. System Health shows archive-service as Healthy but no settings UI exists.
Spec reference: DD-18-001 through DD-18-006 (archive settings specs)
