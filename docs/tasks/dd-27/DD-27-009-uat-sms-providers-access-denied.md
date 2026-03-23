---
id: DD-27-009
unit: DD-27
title: SMS Providers settings page shows "Access Denied" for admin user
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

Navigating to /settings/sms-providers as the admin user displays an "Access Denied — You do not have permission to view this page" error. The admin user should have full access to all settings pages including SMS provider configuration.

Either the RBAC permission required for SMS Providers is not assigned to the admin role, or the route guard is using a permission that doesn't exist or isn't seeded.

## Acceptance Criteria

- [ ] Admin user can navigate to /settings/sms-providers without seeing "Access Denied"
- [ ] SMS Providers page renders with the ability to add/manage SMS providers (Twilio, Vonage, etc.)
- [ ] The admin role has the necessary permission(s) to access SMS provider configuration

## Verification Checklist

- [ ] Log in as admin, navigate to /settings/sms-providers → page renders, no access denied
- [ ] SMS providers page shows add/configure interface
- [ ] Non-admin role (e.g., Viewer) correctly cannot access the page (RBAC enforced)

## Do NOT

- Do not bypass RBAC by removing permission checks
- Do not grant all users access — only admin and appropriate system configuration roles

## Dev Notes

UAT failure from 2026-03-23: admin user navigated to /settings/sms-providers and received "Access Denied — You do not have permission to view this page".
All other settings pages (OPC Sources, Email, Auth Providers, MFA, SCIM, Import, Recognition) were accessible to admin.
Spec reference: DD-27-007 (SMS/push notification channel adapters)
