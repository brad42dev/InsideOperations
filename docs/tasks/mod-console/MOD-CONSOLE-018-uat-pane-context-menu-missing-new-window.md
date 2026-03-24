---
id: MOD-CONSOLE-018
unit: MOD-CONSOLE
title: Pane context menu missing "Open in New Window" item for detached window
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

The Console pane right-click context menu does not include an "Open in New Window" option. The spec (MOD-CONSOLE-002 / MOD-CONSOLE-006-detached-window-support) requires that each pane can be detached into a separate browser window via a context menu item.

When the user right-clicks a pane, the context menu shows: Full Screen, Copy, Duplicate, Replace…, Swap With…, Configure Pane…, Zoom to Fit, Reset Zoom, Open in Designer, Remove Pane — but NO "Open in New Window" item.

## Acceptance Criteria

- [ ] Right-clicking a Console pane shows "Open in New Window" in the context menu
- [ ] Clicking "Open in New Window" opens the pane in a new browser window

## Verification Checklist

- [ ] Navigate to /console, right-click on any pane → context menu includes "Open in New Window" item
- [ ] Clicking "Open in New Window" triggers window.open for the pane route
- [ ] The detached window shows the pane content

## Do NOT

- Do not stub this with a TODO comment
- Do not add a disabled/grayed-out menu item — it must be functional

## Dev Notes

UAT failure from 2026-03-24: Right-click on pane showed context menu with 10 items, none named "Open in New Window" or "Detach". Screenshot: docs/uat/MOD-CONSOLE/pane-context-menu-missing-new-window.png
Spec reference: MOD-CONSOLE-002 (Implement detached window support for Console panes)
