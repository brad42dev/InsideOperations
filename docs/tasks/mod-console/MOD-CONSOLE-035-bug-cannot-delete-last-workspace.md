---
id: MOD-CONSOLE-035
unit: MOD-CONSOLE
title: Remove guard blocking deletion of the last workspace
status: pending
priority: low
depends-on: []
source: bug
bug_report: Cannot delete the last workspace in Console — delete button hides and context-menu item is disabled when only one workspace remains
---

## What's Broken

Two UI guards in `frontend/src/pages/console/index.tsx` prevent deleting the last workspace:

1. **Line 1365** — toolbar delete button is rendered conditionally:
   ```tsx
   {workspaces.length > 1 && (
     <button onClick={deleteActiveWorkspace} ...>
   ```
   When only one workspace exists the button does not render at all.

2. **Line 1893** — context-menu Delete item is explicitly disabled:
   ```tsx
   { label: 'Delete', disabled: workspaces.length <= 1, ... }
   ```

The underlying `deleteActiveWorkspace()` function (line 658) has no minimum check itself — the guards are purely presentational and can simply be removed.

## Expected Behavior

The delete action should be available regardless of how many workspaces exist. Deleting the last workspace transitions the module to the zero-workspace empty state (already implemented at line 1668), from which the user can create a new one.

## Root Cause

Overly conservative UI guards added during initial Console implementation. The spec contains no minimum-workspace requirement. The empty-state already handles zero workspaces correctly.

## Acceptance Criteria

- [ ] When exactly one workspace exists, the toolbar delete button is visible and clickable
- [ ] When exactly one workspace exists, the context-menu "Delete" item is enabled
- [ ] Deleting the last workspace navigates to the zero-workspace empty state (the "Create workspace" CTA)
- [ ] No regression: deleting non-last workspaces still works correctly and activates the next tab

## Verification

1. Open Console with a single workspace → delete button appears in toolbar and "Delete" is enabled in context menu
2. Click delete → module transitions to empty state with "Create workspace" prompt
3. Create a new workspace from empty state → works normally
4. With 2+ workspaces → delete still works as before

## Spec Reference

No spec requirement for a minimum workspace count. console-implementation-spec.md does not mention this restriction. The empty-state path (`workspaces.length === 0`) already exists and is functional.

## Do NOT

- Add a confirmation dialog for the last-workspace case — no other workspace deletion requires one
- Redirect to a different module on deletion — stay in Console and show the empty state
- Leave the `disabled: workspaces.length <= 1` condition in place as a partial fix — both guards must go
