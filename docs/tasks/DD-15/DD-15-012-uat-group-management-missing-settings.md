---
id: DD-15-012
unit: DD-15
title: Group Management CRUD is missing from settings sidebar
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

UAT Scenario [DD-15-004]: Group management (create/read/update/delete user groups) should be accessible from the settings sidebar. During UAT, no group management entry was found in the settings navigation. The groups page was either not implemented or not linked in the sidebar navigation.

## Acceptance Criteria

- [ ] Group Management link visible in settings sidebar
- [ ] Navigating to groups page shows list of user groups
- [ ] Create, edit, and delete group operations are functional

## Verification Checklist

- [ ] Navigate to /settings, look for Groups entry in sidebar
- [ ] Click Groups entry — groups list page loads
- [ ] Create a new group — confirm it appears in the list
- [ ] Delete a group — confirm it is removed

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: Group Management not found in settings sidebar. Spec reference: DD-15-004 (groups management CRUD)
