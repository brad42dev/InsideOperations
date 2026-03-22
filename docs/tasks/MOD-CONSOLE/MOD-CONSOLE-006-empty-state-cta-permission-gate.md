---
id: MOD-CONSOLE-006
title: Gate "Create Workspace" empty-state CTA on console:write permission
unit: MOD-CONSOLE
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When the Console module has no workspaces (empty state), the "Create Workspace" call-to-action button should only be visible to users who have the `console:write` permission. Users with only `console:read` should see the empty state but without the CTA (they cannot create workspaces). This matches the CX-RBAC pattern where CTAs must be permission-aware.

## Spec Excerpt (verbatim)

> **Empty state CTA permission-aware**: The CTA in the empty state must check the same permission as the action it triggers.
> — docs/SPEC_MANIFEST.md, CX-RBAC contract §Empty state CTA

> | Permission | Code | Description |
> |------------|------|-------------|
> | Edit Own | `console:write` | Create and edit personal workspaces. |
> — console-implementation-spec.md, §17

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — empty state at lines 1331-1381; "Create Workspace" button at line 1366

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A `canWrite` (or similar) permission check using `usePermission('console:write')` is present near the empty state
- [ ] The "Create Workspace" button is only rendered when `canWrite` is true
- [ ] When `canWrite` is false, the empty state still shows the illustration and explanation text, but not the button

## Assessment

After checking:
- **Status**: ❌ Missing — `index.tsx:1366-1380` renders "Create Workspace" button unconditionally. Only `canExport = usePermission('console:export')` is checked at line 371; no `console:write` check exists for the empty-state CTA.

## Fix Instructions (if needed)

In `frontend/src/pages/console/index.tsx`:

1. Add `const canWrite = usePermission('console:write')` near line 371 alongside `canExport`.

2. Wrap the "Create Workspace" button at line 1366:
   ```tsx
   {canWrite && (
     <button onClick={createWorkspace} ...>
       Create Workspace
     </button>
   )}
   ```

3. Optionally, when `!canWrite`, render a note below the explanation text: "Contact your administrator to gain access." in `var(--io-text-muted)` color.

Do NOT:
- Hide the entire empty state for users without `console:write` — they should still see the module and understand why it's empty.
- Gate the button on `console:workspace_write` — that permission is for editing any workspace, not just creating personal ones. `console:write` is the correct permission for creation.
