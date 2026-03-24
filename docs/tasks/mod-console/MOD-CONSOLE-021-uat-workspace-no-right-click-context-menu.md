---
id: MOD-CONSOLE-021
unit: MOD-CONSOLE
title: Workspace list items missing right-click context menu
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Right-clicking a workspace row in the left nav Assets → Workspaces panel produces no context menu. The implementation uses only an inline star button for Add/Remove Favorites, but the spec requires a right-click context menu on workspace rows.

Observed: right-clicking "Reactor Overview" workspace row → no [role="menu"] appears; row just becomes active/selected.

Expected: right-click on a workspace row opens a context menu containing at minimum "Add to Favorites" / "Remove from Favorites" option (and potentially other workspace actions like Rename, Delete, Open in New Window).

## Acceptance Criteria

- [ ] Right-clicking a workspace row in the Workspaces panel opens a [role="menu"] context menu
- [ ] The context menu contains "Add to Favorites" when workspace is not favorited
- [ ] The context menu contains "Remove from Favorites" when workspace is already favorited
- [ ] The context menu closes on Escape or clicking outside

## Verification Checklist

- [ ] Navigate to /console → open Assets panel → Workspaces tab
- [ ] Right-click a non-favorited workspace row → [role="menu"] appears with "Add to Favorites"
- [ ] Right-click an already-favorited workspace row → [role="menu"] appears with "Remove from Favorites"
- [ ] Clicking "Add to Favorites" from menu adds workspace to Favorites group
- [ ] No silent no-ops: right-click must produce visible context menu

## Do NOT

- Do not remove the existing inline star button — it can coexist with the context menu
- Do not stub with a TODO comment
- Do not show a browser native context menu — use a Radix UI ContextMenu component

## Dev Notes

UAT failure from 2026-03-24: right-click on workspace row (button element in Workspaces panel) → no menu appeared. Inline Add/Remove Favorites star button works correctly but right-click context menu is absent.
Spec reference: MOD-CONSOLE-016 (Favorites group), context-menu-implementation-spec.md
