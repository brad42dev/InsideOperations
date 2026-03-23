---
id: DD-27-009
title: "SMS Providers settings page shows Access Denied for admin user"
unit: DD-27
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-27/CURRENT.md
---

## What to Build

The `/settings/sms-providers` page is protected by `PermissionGuard permission="system:configure"` (in `App.tsx`). However, `system:configure` is missing from the `Permission` union type in `frontend/src/shared/types/permissions.ts`, and more importantly, when admin users log in, their JWT does not contain `system:configure` in its permissions list because the migration that grants this permission to the Admin role (`20260323000001_add_missing_system_permissions.up.sql`) was recently added and the seed Admin role needs this permission explicitly.

**Root cause:** The `system:configure` permission is not included in the `Permission` union type in `permissions.ts`, causing TypeScript to miss it. More critically, the admin user's role may not have this permission in the database if the migration hasn't run, or the permission may not be included in the JWT payload for admin users.

**Fix required:**
1. Add `system:configure` and `system:certificates` to the `Permission` union type in `permissions.ts`
2. Ensure the migration `20260323000001_add_missing_system_permissions.up.sql` correctly grants `system:configure` to the Admin role — verify it grants it to the Admin role by role name
3. Verify that the JWT `permissions` array is populated from the user's effective permissions (role-based) correctly

## Acceptance Criteria

- [ ] `system:configure` and `system:certificates` are in the `Permission` union type in `permissions.ts`
- [ ] The Admin role has `system:configure` in `role_permissions` via the migration
- [ ] Admin users can access `/settings/sms-providers` without "Access Denied"
- [ ] No TypeScript compilation errors

## Files to Create or Modify

- `frontend/src/shared/types/permissions.ts` — add `'system:configure'` and `'system:certificates'` to the `Permission` union type
- `migrations/20260323000001_add_missing_system_permissions.up.sql` — verify it grants `system:configure` to Admin role; add `system:configure` grant to any other admin-capable roles if needed (e.g., verify role name matches the seeded Admin role exactly)

## Verification Checklist

- [ ] TypeScript build passes: `cd frontend && npx tsc --noEmit`
- [ ] `system:configure` appears in `permissions.ts` Permission type
- [ ] Migration SQL: Admin role gets `system:configure` and `system:certificates` on `sqlx migrate run`
- [ ] `/settings/sms-providers` accessible to admin user (no Access Denied) — confirm PermissionGuard lets through users with `system:configure`

## Do NOT

- Do not change `PermissionGuard.tsx` — it correctly checks `user?.permissions.includes(permission)`
- Do not remove the `PermissionGuard` from the SMS Providers route
- Do not modify `SmsProviders.tsx`

## Dev Notes

UAT failure 2026-03-23: Admin user sees "Access Denied — You do not have permission to view this page" at `/settings/sms-providers`. The PermissionGuard requires `system:configure`. This permission was added by migration `20260323000001_add_missing_system_permissions` but may not have been applied before UAT, and the TypeScript type is missing the permission string causing potential compile-time mismatches.
