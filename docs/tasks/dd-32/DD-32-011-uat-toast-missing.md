---
id: DD-32-011
unit: DD-32
title: No toast notification shown on dashboard save — silent success/failure
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

Clicking Save in the dashboard editor produces no visible feedback (no toast notification). The user cannot tell if the save succeeded or failed. The spec requires a toast notification to confirm save success or display errors.

## Acceptance Criteria

- [ ] Saving a dashboard shows a success toast ("Dashboard saved" or similar)
- [ ] If save fails (network error, validation error), an error toast appears with the reason
- [ ] Toast is visible for at least 3 seconds before auto-dismissing (except error toasts which should persist)

## Verification Checklist

- [ ] Navigate to /designer/dashboards/{id}/edit, click Save
- [ ] Confirm toast notification appears with success message
- [ ] Trigger a save failure (e.g., disconnect network) — confirm error toast appears and persists

## Do NOT

- Do not silently ignore save results
- Do not use browser alert() for feedback

## Dev Notes

UAT failure 2026-03-23: Clicking Save in dashboard editor produces no visible toast or feedback. Page state unchanged after 2 seconds.
Spec reference: DD-32-007, DD-32-010
