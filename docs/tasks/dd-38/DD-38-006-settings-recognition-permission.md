---
id: DD-38-006
title: Fix /settings/recognition permission guard — use settings:admin not settings:write
unit: DD-38
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `/settings/recognition` route should be guarded with `settings:admin` — a higher-privilege permission than `settings:write`. Recognition configuration controls the P&ID/DCS symbol recognition engine, which is an administrative function not appropriate for general settings writers.

## Spec Excerpt (verbatim)

> | `/settings/recognition` | `RecognitionConfig` | `settings:admin` | Settings > Recognition |
> — 38_FRONTEND_CONTRACTS.md, §1 Settings Sub-Routes

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:1006–1013` — current `<Route path="recognition">` with wrong permission
- `frontend/src/shared/types/permissions.ts` — verify `settings:admin` is defined

## Verification Checklist

- [ ] App.tsx route for `settings/recognition` uses `permission="settings:admin"` (not `settings:write`)
- [ ] `settings:admin` exists in `frontend/src/shared/types/permissions.ts`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: App.tsx:1009 passes `permission="settings:write"` to PermissionGuard on the recognition route. Spec requires `settings:admin`.

## Fix Instructions

In `frontend/src/App.tsx`, find the recognition route (currently around line 1006):

```tsx
// BEFORE (wrong):
<Route
  path="recognition"
  element={
    <PermissionGuard permission="settings:write">
      <RecognitionPage />
    </PermissionGuard>
  }
/>

// AFTER (correct):
<Route
  path="recognition"
  element={
    <PermissionGuard permission="settings:admin">
      <RecognitionPage />
    </PermissionGuard>
  }
/>
```

Do NOT:
- Change any other settings route permissions in this fix.
- Use `recognition:configure` — the spec permission is `settings:admin`.
