---
id: DD-27-012
unit: DD-27
title: Alerts module crashes on load — templates.find is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

The /alerts page triggers an error boundary on load with the message:
"Alerts failed to load — templates.find is not a function"

The JavaScript error is: `TypeError: templates.find is not a function` at chunk-EMBGZOEE.js:19137.

The `SendAlert` component (or a component it renders) calls `.find()` on a `templates` value that is not an array — it appears to be `undefined` or a non-array object (e.g., a paginated response `{ data: [], total: N }` instead of a plain array).

Fix the Alerts module so that it:
1. Correctly unwraps the templates API response before calling array methods
2. Handles the case where templates are not yet loaded (null/undefined) with a loading state rather than a crash

## Acceptance Criteria

- [ ] Navigating to /alerts renders the Alerts module without an error boundary
- [ ] The module loads even when there are no alert templates configured
- [ ] The `templates` value passed to array methods is always an array (or the code guards against non-array values)

## Verification Checklist

- [ ] Navigate to /alerts as admin → page renders without "Alerts failed to load" error
- [ ] No console error "templates.find is not a function"
- [ ] If no templates exist, the page shows an appropriate empty state

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not only fix the happy path — ensure the module loads when templates list is empty

## Dev Notes

UAT failure from 2026-03-24: /alerts page hits error boundary with "templates.find is not a function"
Console error: `TypeError: templates.find is not a function` at chunk-EMBGZOEE.js:19137
Screenshot: docs/uat/DD-27/scenario4-alerts-error.png
Spec reference: DD-27-007, DD-27-008
