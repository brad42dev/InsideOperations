---
id: DD-15-010
unit: DD-15
title: EULA settings page returns Access Denied for admin user
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

UAT Scenario [DD-15-007]: The EULA settings page (/settings/eula or similar) returns an "Access Denied" error even when logged in as admin. Admin users should have full access to all settings pages. This indicates a missing or misconfigured RBAC permission guard on the EULA route.

## Acceptance Criteria

- [ ] Admin user can navigate to EULA settings page without Access Denied error
- [ ] EULA editor content is visible to admin
- [ ] EULA acceptance records are visible to admin

## Verification Checklist

- [ ] Login as admin/changeme, navigate to EULA settings page
- [ ] Confirm page loads without 'Access Denied' or 403 error
- [ ] EULA content editor is visible and functional

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that the interaction actually completes

## Dev Notes

UAT failure from 2026-03-23: EULA settings page showed 'Access Denied' for admin user. Spec reference: DD-15-007
