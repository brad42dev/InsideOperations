---
id: DD-27-011
unit: DD-27
title: SMS Providers settings page shows Access Denied for admin user
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

The /settings/sms-providers page displays "Access Denied" when accessed by the admin user. Admin should have all permissions including SMS provider configuration. Either the route requires a specific permission not granted to admin, or the permission name is incorrect.

## Acceptance Criteria

- [ ] Admin user can access /settings/sms-providers without "Access Denied" error
- [ ] SMS Providers settings page shows provider configuration UI (Twilio, etc.)
- [ ] Admin role includes the permission required for SMS provider settings access

## Verification Checklist

- [ ] Log in as admin, navigate to /settings/sms-providers → page loads without Access Denied
- [ ] SMS provider configuration form is visible and functional
- [ ] Non-admin user without the permission cannot access the page

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not remove permission checks — fix the admin role to include the correct permission

## Dev Notes

UAT failure from 2026-03-24: /settings/sms-providers shows "Access Denied" for admin user. Screenshot at docs/uat/DD-27/sms-access-denied.png confirms the error. Admin should have all permissions including settings:sms-providers or equivalent.
Spec reference: DD-27-002 (SMS provider settings), DD-27-003 (admin access)
