---
id: DD-38-004
title: Fix /settings/email permission guard — use email:configure not settings:write
unit: DD-38
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `/settings/email` route should be guarded with the `email:configure` permission. Currently it uses the generic `settings:write` permission, which allows any user with write access to settings to configure the email system — a more privileged operation that requires its own specific permission.

## Spec Excerpt (verbatim)

> | `/settings/email` | `EmailConfig` | `email:configure` | Settings > Email |
> — 38_FRONTEND_CONTRACTS.md, §1 Settings Sub-Routes

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:938–945` — current `<Route path="email">` with wrong permission
- `frontend/src/shared/types/permissions.ts` — verify `email:configure` is defined

## Verification Checklist

- [ ] App.tsx route for `settings/email` uses `permission="email:configure"` (not `settings:write`)
- [ ] `email:configure` exists in `frontend/src/shared/types/permissions.ts`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: App.tsx:941 passes `permission="settings:write"` to PermissionGuard on the email settings route. Spec requires `email:configure`.

## Fix Instructions

In `frontend/src/App.tsx`, find the email settings route (currently around line 938):

```tsx
// BEFORE (wrong):
<Route
  path="email"
  element={
    <PermissionGuard permission="settings:write">
      <EmailSettingsPage />
    </PermissionGuard>
  }
/>

// AFTER (correct):
<Route
  path="email"
  element={
    <PermissionGuard permission="email:configure">
      <EmailSettingsPage />
    </PermissionGuard>
  }
/>
```

Do NOT:
- Change any other route permissions in this fix — this is a single targeted correction.
- Use `email:admin` or `email:manage` — the spec permission is exactly `email:configure`.
