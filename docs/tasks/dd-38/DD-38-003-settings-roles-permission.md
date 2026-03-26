---
id: DD-38-003
title: Fix /settings/roles permission guard — use system:manage_roles not system:manage_users
unit: DD-38
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `/settings/roles` route should be guarded with the `system:manage_roles` permission. Currently it uses `system:manage_users`, which grants role management access to any user who can manage users — conflating two distinct RBAC permissions.

## Spec Excerpt (verbatim)

> | `/settings/roles` | `RoleManagement` | `system:manage_roles` | Settings > Roles |
> — 38_FRONTEND_CONTRACTS.md, §1 Settings Sub-Routes

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:817–823` — current `<Route path="roles">` with wrong permission
- `frontend/src/shared/types/permissions.ts` — verify `system:manage_roles` is defined

## Verification Checklist

- [ ] App.tsx route for `settings/roles` uses `permission="system:manage_roles"` (not `system:manage_users`)
- [ ] `system:manage_roles` exists in `frontend/src/shared/types/permissions.ts`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: App.tsx:820 passes `permission="system:manage_users"` to PermissionGuard on the roles route. Spec requires `system:manage_roles`.

## Fix Instructions

In `frontend/src/App.tsx`, find the roles route (currently around line 817):

```tsx
// BEFORE (wrong):
<Route
  path="roles"
  element={
    <PermissionGuard permission="system:manage_users">
      <RolesPage />
    </PermissionGuard>
  }
/>

// AFTER (correct):
<Route
  path="roles"
  element={
    <PermissionGuard permission="system:manage_roles">
      <RolesPage />
    </PermissionGuard>
  }
/>
```

Do NOT:
- Change any other route permissions in this fix — this is a single targeted correction.
- Remove the `system:manage_users` permission from the users route — only the roles route changes.
