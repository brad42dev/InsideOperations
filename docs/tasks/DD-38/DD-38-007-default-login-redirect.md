---
id: DD-38-007
title: Fix default post-login redirect — use first visible module per user permissions
unit: DD-38
status: pending
priority: medium
depends-on: [DD-38-001]
---

## What This Feature Should Do

After login, users should land on the first module their permissions allow them to access (in sidebar order: Console → Process → Dashboards → Reports → Forensics → Log → Rounds → Alerts → Shifts → Settings → Designer). A user with only `log:read` and `rounds:read` lands on `/log`. Currently all users are redirected to `/settings/users` unconditionally, regardless of their permissions.

## Spec Excerpt (verbatim)

> "The first visible module in sidebar order becomes the default redirect after login. For most roles this is `/console`. If a user only has `log:read` and `rounds:read`, they land on `/log`."
> — 38_FRONTEND_CONTRACTS.md, §1 Default Route After Login

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:127` — current hardcoded `Navigate to="/settings/users"` on the index route
- `frontend/src/shared/layout/AppShell.tsx:39–71` — `NAV_GROUPS`/`NAV_ITEMS` defines sidebar order
- `frontend/src/store/auth.ts` — where `user.permissions` is stored

## Verification Checklist

- [ ] The index route (`/`) does NOT unconditionally redirect to `/settings/users`
- [ ] The default redirect resolves to the first route whose `permission` is in `user.permissions` (in sidebar order)
- [ ] A user with only `console:read` lands on `/console`
- [ ] A user with only `log:read` lands on `/log`
- [ ] An unauthenticated user is redirected to `/login` (not broken by this change)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: App.tsx:127 has `<Navigate to={isAuthenticated ? '/settings/users' : '/login'} replace />`. This sends all authenticated users to `/settings/users` regardless of their permissions, which violates the spec and breaks role-based access (a Viewer with only `console:read` gets a 403 on `/settings/users`).

## Fix Instructions

1. In `frontend/src/App.tsx`, create or extract a `useDefaultRoute()` hook (or compute inline) that finds the first permitted route:

```tsx
function useDefaultRoute(): string {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return '/login'

  // Sidebar order per doc 38 — first visible module for this user
  const ORDERED_MODULE_ROUTES: Array<{ path: string; permission: string | null }> = [
    { path: '/console', permission: 'console:read' },
    { path: '/process', permission: 'process:read' },
    { path: '/dashboards', permission: 'dashboards:read' },
    { path: '/reports', permission: 'reports:read' },
    { path: '/forensics', permission: 'forensics:read' },
    { path: '/log', permission: 'log:read' },
    { path: '/rounds', permission: 'rounds:read' },
    { path: '/alerts', permission: 'alerts:read' },
    { path: '/shifts', permission: 'shifts:read' },
    { path: '/settings', permission: 'settings:read' },
    { path: '/designer', permission: 'designer:read' },
  ]

  const first = ORDERED_MODULE_ROUTES.find(
    (r) => r.permission === null || (user?.permissions ?? []).includes(r.permission)
  )
  return first?.path ?? '/settings'
}
```

2. Replace App.tsx:127:
```tsx
// BEFORE:
<Route index element={<Navigate to={isAuthenticated ? '/settings/users' : '/login'} replace />} />

// AFTER:
function DefaultRedirect() {
  const route = useDefaultRoute()
  return <Navigate to={route} replace />
}
// ...
<Route index element={<DefaultRedirect />} />
```

3. If DD-38-001 is complete, derive `ORDERED_MODULE_ROUTES` from `ROUTE_REGISTRY` instead of a local constant.

Do NOT:
- Hardcode `/console` as the default — use the permission-based lookup.
- Move the unauthenticated check out of PermissionGuard — keep the guard in place; this only changes the post-login index redirect.
- Use `navigate()` in an effect — use `<Navigate>` component in the render path to avoid navigation side effects.
