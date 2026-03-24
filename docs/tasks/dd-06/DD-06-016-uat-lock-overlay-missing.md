---
id: DD-06-016
unit: DD-06
title: Lock overlay not implemented in app shell
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The app shell is missing the lock overlay feature. When a user locks the screen (G key or lock button), a lock overlay should appear over the application requiring re-authentication before proceeding. In UAT, pressing G on the keyboard or navigating to a lock screen produced no visible lock overlay.

## Acceptance Criteria

- [ ] Lock overlay appears when screen lock is triggered (G key or lock button)
- [ ] Lock overlay covers the full viewport and requires re-authentication
- [ ] After re-authentication, the overlay dismisses and the app resumes

## Verification Checklist

- [ ] Navigate to /console, press G key → full-screen lock overlay appears
- [ ] Enter correct credentials on lock overlay → overlay dismisses
- [ ] App shell shows lock button in header → clicking it triggers the same overlay

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the overlay actually requires credentials

## Dev Notes

UAT failure from 2026-03-24: G key press on /console produced no visible lock overlay. The lock screen feature appears unimplemented in the app shell.
Spec reference: DD-06-004 (lock screen), DD-06-011 (G key shortcut)
