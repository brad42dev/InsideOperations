---
id: DD-27-010
unit: DD-27
title: SMS Providers settings page returns Access Denied for admin user
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

Navigating to /settings/sms-providers as the admin user shows "Access Denied — You do not have permission to view this page." The admin role should have full access to all settings pages including SMS provider configuration.

## Acceptance Criteria

- [ ] Admin user can access /settings/sms-providers without Access Denied error
- [ ] SMS provider configuration page renders with provider list or empty state
- [ ] RBAC permission for SMS providers is granted to admin/Administrator role

## Verification Checklist

- [ ] Log in as admin, navigate to /settings/sms-providers
- [ ] Confirm page renders with SMS provider configuration (not Access Denied)
- [ ] Check that the Administrator role has the required permission in RBAC config

## Do NOT

- Do not remove the permission check — fix it to grant admin access

## Dev Notes

UAT failure 2026-03-23: /settings/sms-providers shows Access Denied for admin account. Screenshot at docs/uat/DD-27/sms-providers-access-denied.png.
Spec reference: DD-27-009
