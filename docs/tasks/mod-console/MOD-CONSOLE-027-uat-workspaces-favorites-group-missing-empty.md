---
id: MOD-CONSOLE-027
unit: MOD-CONSOLE
title: Workspaces section Favorites group missing when no favorites are set
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The Workspaces section left nav panel does not show a Favorites collapsible group when no workspaces have been favorited. The Graphics section consistently shows a Favorites group with "No favorites yet" even when empty — but the Workspaces section hides the group entirely until at least one item is favorited.

Expected behavior (matching Graphics section): The Favorites group must always be visible at the top of the Workspaces section, showing "No favorites yet" when empty, and showing favorited workspaces when they exist.

## Acceptance Criteria

- [ ] Workspaces section always shows a "Favorites" collapsible group at the top, even with zero favorited workspaces
- [ ] Empty Favorites group shows "No favorites yet" placeholder text
- [ ] After favoriting a workspace, it appears in the Favorites group
- [ ] Behavior is consistent between Workspaces and Graphics sections

## Verification Checklist

- [ ] Navigate to /console with no favorites set → Workspaces section shows Favorites group with "No favorites yet"
- [ ] Add a favorite → workspace appears under Favorites group
- [ ] Remove all favorites → Favorites group still shows with "No favorites yet"
- [ ] Graphics section shows same pattern (already working — do not break it)

## Do NOT

- Do not hide the Favorites group when empty — it must always be visible
- Do not change the Graphics section behavior

## Dev Notes

UAT failure from 2026-03-26: Initial /console load showed Workspaces section with only "Filter workspaces…" + workspace items. No Favorites group visible. After right-click → "Add to Favorites", group appeared. Graphics section already shows Favorites group with "No favorites yet" when empty.
Screenshot: docs/uat/MOD-CONSOLE/scenario3-no-workspaces-favorites-group.png
Spec reference: MOD-CONSOLE-022
