---
id: DD-23-023
unit: DD-23
title: Breadcrumb trail still not shown above workspace when cursor is inside a nested container
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

When the cursor is inside a nested container tile (e.g., a `(…)` group), no breadcrumb trail appears above the workspace. The spec requires a breadcrumb showing the nesting path (e.g., "Root > (…)") to help users understand where they are inside the expression tree.

This was previously filed as DD-23-013 and DD-23-020 and marked verified, but UAT on 2026-03-24 confirmed the issue persists.

Tested by: clicking inside a `(…)` group container (group became `[active]` in accessibility tree, visual cursor appeared inside the group), but no breadcrumb element appeared anywhere in the dialog above the workspace area.

## Acceptance Criteria

- [ ] When cursor is at root level, no breadcrumb is shown above the workspace (or shows "Root" only)
- [ ] When cursor is inside a container tile, a breadcrumb appears above the workspace showing the nesting path (e.g., "Root > (…)")
- [ ] Each breadcrumb item is clickable and moves the cursor back to that nesting level
- [ ] Breadcrumb updates dynamically as user navigates into/out of containers
- [ ] Adding a nested container inside a group and entering it shows both levels in the breadcrumb

## Verification Checklist

- [ ] Navigate to /settings/expressions, click Edit on a saved expression
- [ ] At root level — confirm no breadcrumb trail is visible above workspace
- [ ] Add a `(…)` group container via the palette button
- [ ] Click inside the group to move cursor into it
- [ ] Confirm a breadcrumb trail (e.g., "Root > (…)") appears above the workspace area
- [ ] Click the "Root" breadcrumb item — confirm cursor returns to root, breadcrumb hides
- [ ] Add a nested `(…)` inside the outer group and enter it — confirm breadcrumb shows both levels

## Do NOT

- Do not stub this with a TODO comment
- The breadcrumb must be visible in the DOM (not just a visual CSS trick that disappears from accessibility tree)
- Check: is there a state variable tracking cursor depth that never gets set when clicking into a container?

## Dev Notes

UAT failure from 2026-03-24: clicking inside group container (group shows `[active]`, visual cursor line appeared inside group) but no breadcrumb element was visible between the palette and the workspace in the dialog. Full screenshots: docs/uat/DD-23/group-click.png, docs/uat/DD-23/dialog-full.png
Spec reference: DD-23-013 (original breadcrumb spec), DD-23-020 (prior UAT bug task)
