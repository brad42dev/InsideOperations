---
id: DD-23-006
title: Fix Share checkbox permission to use system:expression_manage
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The "Share with Other Users" checkbox is only visible and enabled for users who hold the `system:expression_manage` permission (Admin role). The current code gates on `users:write` which is a different, unrelated permission.

## Spec Excerpt (verbatim)

> **Share with Other Users**: Unchecked by default. Only visible/enabled for users with `system:expression_manage` permission (Admin role).
> — design-docs/23_EXPRESSION_BUILDER.md, §4

> Only users with Admin role (or `system:expression_manage` permission) see the "Share" checkbox
> — design-docs/23_EXPRESSION_BUILDER.md, §10.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1053–1054` — isAdmin check uses `users:write`

## Verification Checklist

- [ ] Line 1054 checks `user?.permissions.includes('system:expression_manage')` not `'users:write'`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Line 1054: `const isAdmin = user?.permissions.includes('users:write') ?? false` — `users:write` is the permission to manage user accounts, not expression sharing. A user with expression management rights but not user-management rights would not see the Share checkbox.

## Fix Instructions (if needed)

In `frontend/src/shared/components/expression/ExpressionBuilder.tsx` line 1054, change:
```typescript
const isAdmin = user?.permissions.includes('users:write') ?? false
```
to:
```typescript
const isAdmin = user?.permissions.includes('system:expression_manage') ?? false
```

Do NOT:
- Add an OR check against `users:write` — only `system:expression_manage` is the correct gate per spec
