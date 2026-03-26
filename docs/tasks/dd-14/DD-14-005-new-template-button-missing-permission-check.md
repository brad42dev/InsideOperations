---
id: DD-14-005
title: Gate "+ New Template" button in index.tsx on rounds:template_manage permission
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The "+ New Template" button in the main Rounds page must only be visible to users who have the `rounds:template_manage` permission (or `rounds:create`). Currently it renders for any authenticated user who switches to the Templates tab, regardless of permissions.

## Spec Excerpt (verbatim)

> Action buttons (Create, Edit, Delete, Export, Print) are **hidden** (not disabled) when the user lacks permission.
> — docs/SPEC_MANIFEST.md, §CX-RBAC Non-negotiables #2

> `rounds:create` — Create/edit round templates — Default Roles: Supervisor, Admin
> — 14_ROUNDS_MODULE.md, §Permissions

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/index.tsx` — line 389-405; "+ New Template" button renders when `tab === 'templates'` with no permission check
- `frontend/src/store/auth.ts` — `useAuthStore` provides `user.permissions` array
- `frontend/src/pages/rounds/RoundTemplates.tsx` — line 55; the standalone templates page already has an ungated "+ New Template" button (same problem)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] index.tsx reads user permissions via `useAuthStore` and checks for `rounds:template_manage` or `rounds:create` before rendering the "+ New Template" button
- [ ] The button is absent (not disabled) when the user lacks the required permission
- [ ] RoundTemplates.tsx line 55 "+ New Template" button also has a permission check
- [ ] The empty state text "Create one to get started." in index.tsx:490 is either removed or only shown when user has create permission

## Assessment

After checking:
- **Status**: ⚠️ Wrong
- **What's wrong**: index.tsx lines 389-405 render the "+ New Template" button conditionally only on `tab === 'templates'`, with no permission check. RoundTemplates.tsx line 55 also has no permission check. Any authenticated user with `rounds:read` can see and click these buttons (the API will reject them, but the UI is wrong).

## Fix Instructions (if needed)

In `frontend/src/pages/rounds/index.tsx`:

1. Add a permissions check near the top of `RoundsPage`, alongside the existing `useOfflineRounds` call. `useAuthStore` is already imported (line 6 or similar):
   ```tsx
   const permissions = useAuthStore((s) => s.user?.permissions ?? [])
   const canManageTemplates = permissions.includes('rounds:template_manage') || permissions.includes('rounds:create')
   ```

2. Wrap the "+ New Template" button render condition (line 389):
   ```tsx
   {tab === 'templates' && canManageTemplates && (
     <button onClick={...}>+ New Template</button>
   )}
   ```

3. In the Templates tab empty state (line 489-491), change:
   ```
   No templates yet. Create one to get started.
   ```
   to be conditional:
   - With permission: "No templates yet. Create one to get started." (with a "+ New Template" CTA button)
   - Without permission: "No round templates have been created yet." (description only, no CTA)

4. Apply the same fix in `RoundTemplates.tsx` line 55 (the standalone templates page "+ New Template" button).

Do NOT:
- Disable the button with a tooltip — hide it entirely per CX-RBAC rule
- Check `rounds:admin` only — supervisors need `rounds:template_manage` or `rounds:create` per the permissions table
