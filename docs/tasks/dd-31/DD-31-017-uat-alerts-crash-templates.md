---
id: DD-31-017
unit: DD-31
title: Alerts module crashes on load — "templates.find is not a function"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The Alerts module at /alerts crashes immediately on load with a JavaScript runtime error: "templates.find is not a function". This causes the full module to show the error boundary ("Reload Alerts"). The `templates` variable is expected to be an array but is not being initialized correctly — likely undefined or null when .find() is called.

## Acceptance Criteria

- [ ] /alerts loads without JavaScript runtime errors
- [ ] Alert list or empty state is visible on load (no error boundary)
- [ ] The `templates` variable is correctly initialized as an array before .find() is called

## Verification Checklist

- [ ] Navigate to /alerts → page loads without error boundary
- [ ] No "templates.find is not a function" error in console
- [ ] Alert creation and management UI is visible

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not catch the error silently — fix the root cause (templates must be an array)

## Dev Notes

UAT failure from 2026-03-24: /alerts crashes with "templates.find is not a function". Error boundary shows "Reload Alerts". Screenshot at docs/uat/DD-31/alerts-crash.png. The templates data structure is either not initialized or arrives as a non-array type.
Spec reference: DD-31-001 through DD-31-016 (Alerts module specs)
