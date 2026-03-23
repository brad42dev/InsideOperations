---
id: DD-15-011
unit: DD-15
title: Settings role edit dialog crashes with TypeError on open
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

UAT Scenario [DD-15-003]: When clicking to edit a role in /settings/roles, the role edit dialog crashes with "Cannot read properties of undefined (reading 'map')". This is a runtime TypeError caused by the component attempting to map over permissions data before it is loaded or when the data has an unexpected shape.

## Acceptance Criteria

- [ ] Role edit dialog opens without JavaScript errors
- [ ] Role permissions are displayed in the edit dialog
- [ ] Role can be saved after editing

## Verification Checklist

- [ ] Navigate to /settings/roles, click edit on any role
- [ ] Confirm dialog opens without crash or error overlay
- [ ] Permissions list renders in the dialog
- [ ] Save button is functional

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: Role edit dialog crash — 'Cannot read properties of undefined (reading "map")'. Spec reference: DD-15-003
