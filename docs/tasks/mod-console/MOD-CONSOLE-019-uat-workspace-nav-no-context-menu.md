---
id: MOD-CONSOLE-019
unit: MOD-CONSOLE
title: No right-click context menu on workspace items in Console left nav panel
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Right-clicking a workspace row in the Console left nav panel (Assets → Workspaces list) produces no context menu. There should be a right-click context menu with workspace actions including "Add to Favorites" (or "Remove from Favorites").

Currently, the "Add to Favorites" star button is accessible only as an inline hover button. The context-menu-implementation-spec.md requires context menus on workspace list items.

## Acceptance Criteria

- [ ] Right-clicking a workspace row in the left nav shows a [role="menu"] context menu
- [ ] The context menu includes an "Add to Favorites" / "Remove from Favorites" toggle item
- [ ] The context menu includes other relevant workspace actions (e.g., Rename, Open, Delete if permitted)

## Verification Checklist

- [ ] Navigate to /console, expand Workspaces in left nav, right-click a workspace row → context menu appears
- [ ] Context menu has "Add to Favorites" item (or "Remove from Favorites" if already favorited)
- [ ] Clicking "Add to Favorites" in context menu adds workspace to favorites group

## Do NOT

- Do not remove the inline hover star button — keep it alongside the context menu
- Do not implement only the favorites item — include standard workspace actions per context-menu spec

## Dev Notes

UAT failure from 2026-03-24: Right-clicking workspace row in left nav panel produced no context menu — only made the button [active]. The "Add to Favorites" functionality works via inline hover button only.
Spec reference: MOD-CONSOLE-016 (Favorites group missing), context-menu-implementation-spec.md
