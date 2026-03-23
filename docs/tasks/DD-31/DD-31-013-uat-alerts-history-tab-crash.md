---
id: DD-31-013
unit: DD-31
title: Alerts History tab crashes with messages.map TypeError
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

UAT Scenario [DD-31-003]: The Alerts History tab crashes with "messages.map is not a function" when navigated to. This is a runtime TypeError where the component assumes `messages` is an array but receives a non-array value (likely undefined or an object). The history tab should display a list of past alert notifications.

## Acceptance Criteria

- [ ] Alerts History tab loads without JavaScript runtime errors
- [ ] Past alert history items are displayed (or empty state shown if no history)
- [ ] No 'messages.map is not a function' crash

## Verification Checklist

- [ ] Navigate to /alerts, click History tab
- [ ] Confirm tab loads without crash or error overlay
- [ ] History list renders (or empty state message shown)
- [ ] No TypeError in browser console

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: Alerts History tab crash — 'messages.map is not a function'. Spec reference: DD-31-003
