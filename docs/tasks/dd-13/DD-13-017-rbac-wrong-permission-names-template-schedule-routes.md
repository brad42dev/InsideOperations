---
id: DD-13-017
title: Fix wrong RBAC permission names on /log/templates and /log/schedules routes
unit: DD-13
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The `/log/templates` and `/log/schedules` routes must be accessible to users with the `log:admin` permission. Currently they are guarded by `log:template_manage` and `log:schedule_manage` respectively — neither of these permissions is defined in the RBAC model (doc 03). Any user with `log:admin` is blocked from both pages at the route level.

## Spec Excerpt (verbatim)

> | `log:admin` | Log module administration (templates, segments, schedules) | Admin |
> — design-docs/13_LOG_MODULE.md, §Permissions

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:677` — `<PermissionGuard permission="log:template_manage">` on `/log/templates` route
- `frontend/src/App.tsx:687` — `<PermissionGuard permission="log:schedule_manage">` on `/log/schedules` route

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] App.tsx:677 — `PermissionGuard` on `/log/templates` uses `permission="log:admin"`, not `"log:template_manage"`.
- [ ] App.tsx:687 — `PermissionGuard` on `/log/schedules` uses `permission="log:admin"`, not `"log:schedule_manage"`.
- [ ] App.tsx:697 — `/log/templates/:id/edit` already uses `"log:admin"` (no change needed).

## Assessment

After checking:
- **Status**: ⚠️ Wrong — both routes use non-existent permission names. Functional regression: Admin users cannot reach Template or Schedule management pages because their `log:admin` permission does not match the expected `log:template_manage`/`log:schedule_manage` tokens.

## Fix Instructions

In `frontend/src/App.tsx`:

**Line 677** — change:
```tsx
<PermissionGuard permission="log:template_manage">
```
to:
```tsx
<PermissionGuard permission="log:admin">
```

**Line 687** — change:
```tsx
<PermissionGuard permission="log:schedule_manage">
```
to:
```tsx
<PermissionGuard permission="log:admin">
```

Do NOT:
- Add `log:template_manage` or `log:schedule_manage` to the RBAC model as new permissions — the spec explicitly covers these under `log:admin`. Adding them would create a permissions proliferation problem.
- Change line 697 (`/log/templates/:id/edit`) — it already uses `"log:admin"` correctly.
