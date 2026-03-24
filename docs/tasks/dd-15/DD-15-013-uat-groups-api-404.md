---
id: DD-15-013
unit: DD-15
title: Group management page fails with API 404 on /api/groups
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The /settings/groups page shows "Failed to parse server response" because the backend API endpoint /api/groups returns a 404 Not Found. The group management CRUD functionality is not connected to a working API endpoint.

## Acceptance Criteria

- [ ] GET /api/groups returns a valid response (200 with group list or empty array)
- [ ] /settings/groups page loads without error and shows group management UI
- [ ] Group CRUD operations (create, rename, delete) work via the UI

## Verification Checklist

- [ ] Navigate to /settings/groups → page loads with group list (or empty state)
- [ ] No "Failed to parse server response" error shown
- [ ] Create a group → it appears in the list

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the GET — all CRUD endpoints must work

## Dev Notes

UAT failure from 2026-03-24: /settings/groups shows "Failed to parse server response". Direct API call to /api/groups returns 404. The endpoint is missing or not registered in the API gateway.
Spec reference: DD-15-004 (group management)
