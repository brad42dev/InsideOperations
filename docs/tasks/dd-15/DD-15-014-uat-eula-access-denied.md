---
id: DD-15-014
unit: DD-15
title: EULA settings page shows Access Denied for admin user
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The /settings/eula page displays "Access Denied" when accessed by the admin user. Admin should have all permissions including access to EULA settings. Either the EULA settings route requires a specific permission that is not granted to admin, or the permission name is incorrect.

## Acceptance Criteria

- [ ] Admin user can access /settings/eula without "Access Denied" error
- [ ] EULA settings page shows a markdown editor for editing the EULA text
- [ ] Admin role includes the permission required for EULA settings access

## Verification Checklist

- [ ] Log in as admin, navigate to /settings/eula → page loads without Access Denied
- [ ] EULA markdown editor is visible and functional
- [ ] Non-admin user without the permission cannot access the page

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not remove permission checks — fix the admin role to include the correct permission

## Dev Notes

UAT failure from 2026-03-24: /settings/eula shows "Access Denied" for admin user. Screenshot at docs/uat/DD-15/eula-access-denied.png confirms the error. Admin should have all permissions including settings:eula or equivalent.
Spec reference: DD-15-007 (EULA settings), DD-15-010 (EULA admin access)
