---
id: MOD-CONSOLE-016
unit: MOD-CONSOLE
title: Favorites group missing from console left nav panel
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The console left navigation panel does not show a "Favorites" group/section. Per spec, users should be able to favorite workspaces and have them appear in a dedicated Favorites group at the top of the navigation panel. The Favorites section is entirely absent from the nav panel.

## Acceptance Criteria

- [ ] Left nav panel includes a "Favorites" group/section
- [ ] Users can add a workspace to Favorites (via right-click or star icon)
- [ ] Favorited workspaces appear in the Favorites group at the top of the nav panel
- [ ] Favorites state persists across sessions

## Verification Checklist

- [ ] Navigate to /console → left nav panel shows "Favorites" section
- [ ] Right-click a workspace → "Add to Favorites" option present in context menu
- [ ] After favoriting → workspace appears under Favorites group
- [ ] Refresh page → Favorites persist

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the visual group — the star/favorite action must work

## Dev Notes

UAT failure from 2026-03-24: Left nav panel in console shows workspace list but no Favorites group or section. The feature is entirely missing.
Spec reference: MOD-CONSOLE-001 (left nav panel with Favorites)
