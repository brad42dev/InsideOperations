---
id: DD-23-017
unit: DD-23
title: Expression Library page returns "Access Denied" for admin user — blocks all expression builder UAT
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

Navigating to /settings/expressions as the admin user shows "⊘ Access Denied / You do not have permission to view this page." This is incorrect — admin should have full access to the Expression Library.

The RBAC permission check on the Expression Library route is either:
1. Checking the wrong permission name
2. Not recognizing admin as having the required permission
3. The admin role is missing the expression-related permissions

## Acceptance Criteria

- [ ] Admin user can navigate to /settings/expressions without "Access Denied" error
- [ ] Expression Library page renders with the expression builder UI
- [ ] The expression builder modal opens when clicking a saved expression

## Verification Checklist

- [ ] Log in as admin, navigate to /settings/expressions → page renders (not Access Denied)
- [ ] Expression builder tile-based UI is visible
- [ ] Can create/edit expressions

## Do NOT

- Do not give expression access to all users — only users with appropriate permissions
- The permission should be system:expression_manage per DD-23-006

## Dev Notes

UAT failure from 2026-03-23: /settings/expressions renders "⊘ Access Denied / You do not have permission to view this page." for admin user. This blocked testing of ALL DD-23 scenarios (nesting depth, Okabe-Ito colors, breadcrumb trail, etc.). Admin role should have system:expression_manage permission. Spec reference: DD-23-006, DD-23 full spec.
