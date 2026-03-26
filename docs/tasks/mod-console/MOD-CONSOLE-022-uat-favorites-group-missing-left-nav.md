---
id: MOD-CONSOLE-022
unit: MOD-CONSOLE
title: Favorites group missing from Workspaces section in left nav
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The Workspaces section of the left nav panel (ConsolePalette) must render a collapsible "Favorites" group pinned at the top of the section, above all non-favorited workspace items. Currently, no such group exists — only an inline "Add to Favorites" button appears next to each workspace item, but there is no visible "Favorites" container or section label.

The spec (console-implementation-spec.md §2.3) requires:
- A collapsible group labeled "Favorites" pinned at the top of each section (Workspaces, Graphics, Widgets, Points)
- Items that have been favorited appear inside this group
- When the user has no favorites, the group may either be hidden or show "No favorites yet"
- The group must be collapsible/expandable

## Acceptance Criteria

- [ ] Left nav Workspaces section shows a "Favorites" group/section at the top
- [ ] Favorited workspaces appear inside the Favorites group
- [ ] The Favorites group is collapsible (can be collapsed/expanded)
- [ ] When a workspace is favorited (via "Add to Favorites"), it appears in the Favorites group
- [ ] The same pattern applies to Graphics, Widgets, and Points sections

## Verification Checklist

- [ ] Navigate to /console → Workspaces section → "Favorites" label visible at top of section
- [ ] Click "Add to Favorites" on a workspace → workspace appears under Favorites group
- [ ] Click Favorites group header → group collapses/expands
- [ ] Favorites state persists server-side (reload page → favorites still shown)

## Do NOT

- Do not just rename the existing inline button — a visible group container is required
- Do not implement only for Workspaces — all four sections need this group

## Dev Notes

UAT failure from 2026-03-25: Workspaces section shows "Reactor Overview" + "Add to Favorites" button but NO Favorites collapsible group pinned at top.
Screenshot: docs/uat/MOD-CONSOLE/left-nav-missing-features.png
Spec reference: MOD-CONSOLE-001, MOD-CONSOLE-016
