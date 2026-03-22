---
id: MOD-CONSOLE-008
title: Gate empty-state "Create Workspace" CTA on console:write permission
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a user without `console:write` permission lands on the Console page with no workspaces, they should see the empty state illustration and explanation text, but NOT the "Create Workspace" button. Read-only users who see an action button they cannot use is a UX error and violates the CX-EMPTY and CX-RBAC contracts.

## Spec Excerpt (verbatim)

> CTAs in empty states are **permission-aware**: rendered only if the user has the permission to take the action. If not, show description only (no orphaned "Get started" button the user can't use).
> — SPEC_MANIFEST.md, §CX-EMPTY Non-negotiables #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — empty state at lines 1222-1272; "Create Workspace" button at line 1257
- `frontend/src/shared/hooks/usePermission.ts` — `usePermission` hook

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `usePermission('console:write')` is called (or `canWrite` from existing `useAuthStore`) near the empty state render
- [ ] The "Create Workspace" button at line 1257 is only rendered when the user has `console:write` permission
- [ ] The empty state explanation text ("No workspaces yet. Create your first workspace to start monitoring") still renders for all users regardless of permission
- [ ] The illustration SVG also renders for all users

## Assessment

Current state: `index.tsx:1257` — `<button onClick={createWorkspace} ...>Create Workspace</button>` is inside the empty state block with no permission check. The button always renders even for `console:read`-only users.

## Fix Instructions

1. In `frontend/src/pages/console/index.tsx`, near line 347 where `canExport` is already defined:
   ```typescript
   const canWrite = usePermission('console:write')
   ```

2. Wrap the "Create Workspace" button at line 1257 in a permission check:
   ```tsx
   {canWrite && (
     <button onClick={createWorkspace} style={{ ... }}>
       Create Workspace
     </button>
   )}
   ```

3. The description text above the button should remain visible to all users.

Do NOT:
- Hide the entire empty state from read-only users — they need to see that no workspaces exist
- Disable the button instead of hiding it
- Add a tooltip like "You don't have permission" — just hide the button entirely
