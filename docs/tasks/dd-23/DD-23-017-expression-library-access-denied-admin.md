---
id: DD-23-017
unit: DD-23
title: Expression Library page returns 'Access Denied' for admin user — blocks all expression builder UAT
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

UAT Scenario [DD-23-006]: The `/settings/expressions` (Expression Library) page returns "Access Denied" for admin users. Root cause: the route guard in `frontend/src/App.tsx` uses `permission="system:configure"`, but `system:configure` is not a defined permission in the RBAC system (`frontend/src/shared/types/permissions.ts`). No user — not even Admin — ever has this permission, so the guard always denies access.

The correct permission for Expression Library is `system:expression_manage`, as specified in design-docs/03_SECURITY_RBAC.md §8 (Admin role) and §6.2 (Analyst role): "Expression Builder access (`system:expression_manage`)".

## Acceptance Criteria

- [ ] Admin user can navigate to `/settings/expressions` without seeing "Access Denied"
- [ ] Expression Library page renders its full content for admin users
- [ ] Users without `system:expression_manage` (e.g., Viewer role) still see "Access Denied"
- [ ] TypeScript compiles without errors

## Files to Create or Modify

- `frontend/src/App.tsx` — line ~1092: change `permission="system:configure"` to `permission="system:expression_manage"` on the expressions route

## Fix Instructions

In `frontend/src/App.tsx`, locate the expressions route (approximately line 1092):

```tsx
<Route path="expressions" element={<PermissionGuard permission="system:configure"><ExpressionLibrary /></PermissionGuard>} />
```

Change the permission to:

```tsx
<Route path="expressions" element={<PermissionGuard permission="system:expression_manage"><ExpressionLibrary /></PermissionGuard>} />
```

That is the complete fix. `system:expression_manage` is defined in `frontend/src/shared/types/permissions.ts` (line ~245) and is assigned to Admin and Analyst roles per design-docs/03_SECURITY_RBAC.md.

## Verification Checklist

- [ ] `frontend/src/App.tsx` uses `permission="system:expression_manage"` on the expressions route
- [ ] `system:configure` does not appear in App.tsx on the expressions route
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] Expression Library page title "Expression Library" renders (component line 402)

## Do NOT

- Do not change the ExpressionLibrary component itself — the bug is in App.tsx's route guard only
- Do not add `system:configure` to permissions.ts — that would widen access beyond spec intent
- Do not change other routes using `system:configure` (e.g., Sessions, Security pages) — only the expressions route is wrong

## Dev Notes

UAT failure from 2026-03-23: `/settings/expressions` shows "Access Denied" even for admin user. `system:configure` is not a valid/defined permission — it is not in `ADMIN_PERMISSIONS` array in permissions.ts. Correct permission per doc 03 §8 and §6.2 is `system:expression_manage`. This blocks 10 expression builder UAT scenarios.
