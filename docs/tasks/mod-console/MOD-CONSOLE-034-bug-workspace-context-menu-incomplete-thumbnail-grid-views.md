---
id: MOD-CONSOLE-034
unit: MOD-CONSOLE
title: "Bug: workspace right-click context menu missing Rename/Duplicate/Delete in thumbnail and grid views"
status: pending
priority: medium
depends-on: []
source: bug
bug_report: "Right-click menu on workspace items in thumbnail/grid view is missing Rename, Duplicate, and Delete — only list view has the full menu"
---

## What's Broken

`WorkspaceThumbnailCard` (`frontend/src/pages/console/ConsolePalette.tsx` ~line 612)
renders a context menu with only two items: **Open** and **Add/Remove Favorites**.

`WorkspaceRow` (list view, same file ~line 427) has the full menu: Open,
Add/Remove Favorites, Rename…, Duplicate, separator, Delete.

The `WorkspaceThumbnailCard` component does not declare `onRename`, `onDuplicate`,
`onDelete`, or `canDelete` in its props interface at all. The callers in
`renderWorkspaceList` (~line 796) pass only `onSelect` and `onToggleFavorite`
to card instances, so the missing items can never appear regardless of
permissions.

Affected view modes:
- **Thumbnails** (`viewMode === 'thumbnails'`) — uses `WorkspaceThumbnailCard` with `gridMode={false}`
- **Grid** (`viewMode === 'grid'`) — uses `WorkspaceThumbnailCard` with `gridMode={true}`
- **List** (`viewMode === 'list'`) — uses `WorkspaceRow`, works correctly

## Expected Behavior

Spec (`console-implementation-spec.md` §187) says:
> Right-click: context menu with Rename, Delete (owner only), Duplicate, Share, Publish (permission gated)

The context menu must be identical across all three view modes. View mode only
affects the visual presentation of the workspace item, not the available actions.

## Root Cause (if known)

`WorkspaceThumbnailCard` was added as part of the view-mode selector work
(commit `df0e622` / merge `CONFLICT-MOD-CONSOLE-023`) but the context menu was
only minimally implemented — Open and Favorites were added, and the management
actions (Rename, Duplicate, Delete) were never wired up. The component props
interface never included them.

## Acceptance Criteria

- [ ] `WorkspaceThumbnailCard` accepts `onRename`, `onDuplicate`, `onDelete`,
      and `canDelete` props (matching the `WorkspaceRow` signature)
- [ ] Context menu in thumbnail view shows: Open, separator, Add/Remove Favorites,
      Rename…, Duplicate, separator, Delete — same items as list view
- [ ] Context menu in grid view shows the same full set
- [ ] Delete item is disabled (greyed) when `canDelete` is false (only 1 workspace
      remaining), same as list view behaviour
- [ ] `renderWorkspaceList` passes all four handler props to `WorkspaceThumbnailCard`
      instances in both grid and thumbnails branches (lines ~822 and ~841)
- [ ] No regression: list view context menu unchanged

## Verification

- Switch Workspaces section to **Thumbnails** view → right-click any workspace
  → menu shows Open, Add/Remove Favorites, Rename…, Duplicate, Delete
- Switch to **Grid** view → same test → same full menu
- Stay in **List** view → same test → menu still works (no regression)
- With only one workspace present: Delete is visible but disabled/greyed in all
  three view modes
- No errors in browser console on any right-click

## Spec Reference

`console-implementation-spec.md` §187 (Workspace management interactions):
"Right-click: context menu with Rename, Delete (owner only), Duplicate, Share, Publish (permission gated)"

## Do NOT

- Only fix one of the two card view modes — fix both thumbnail and grid in one pass
- Re-implement the menu from scratch — copy the `WorkspaceRow` menu structure
  and apply it to `WorkspaceThumbnailCard` to keep them in sync
- Remove the animation / styling from the existing card menu — just add items
- Stub the handlers — they must call through to `onRenameWorkspace`, `onDuplicateWorkspace`,
  `onDeleteWorkspace` the same way `WorkspaceRow` does
