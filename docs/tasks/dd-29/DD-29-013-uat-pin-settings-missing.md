---
id: DD-29-013
unit: DD-29
title: PIN setup option missing from user profile
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

There is no PIN setup option accessible to users. The profile menu (admin ▾ button) shows Theme, My Exports, About, Kiosk Mode, Sign Out but no Profile or PIN Setup link. The /profile route returns 404. The spec requires users to be able to configure a PIN for quick/badge login.

## Acceptance Criteria

- [ ] User profile page accessible (e.g., /profile or /settings/profile)
- [ ] Profile page includes a PIN Setup section
- [ ] Admin can set/change/remove their PIN from the profile page
- [ ] Profile link accessible from the user menu (▾ button in header)

## Verification Checklist

- [ ] Click admin ▾ in header — confirm "My Profile" or similar link visible
- [ ] Navigate to profile page — confirm PIN setup section present
- [ ] No 404 error on profile route

## Do NOT

- Do not stub with a placeholder — implement the full PIN setup form

## Dev Notes

UAT failure 2026-03-23: /profile returns 404. Profile menu dropdown has no profile/PIN option.
Spec reference: DD-29-011
