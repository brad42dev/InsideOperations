---
id: DD-23-020
unit: DD-23
title: No breadcrumb navigation when cursor is inside nested container
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

When the insertion cursor is positioned inside a nested container (e.g., inside a `round(…)` or `(…)` group), a breadcrumb trail should appear above the equation workspace showing the nesting path (e.g., "Root > round > (…)"). This helps users understand their position in the expression tree and navigate back to parent levels.

Currently, when inside a nested container, no breadcrumb appears — there is no visual indication of the current nesting path or a way to navigate up to a parent container via the UI.

UAT Scenario 7 [DD-23-013]: cursor inside nested container → breadcrumb trail visible above workspace → not present.

## Acceptance Criteria

- [ ] When cursor is at root level, no breadcrumb is shown (or shows "Root")
- [ ] When cursor is inside a container tile, breadcrumb appears above workspace showing the nesting path
- [ ] Each breadcrumb item is clickable and moves the cursor back to that nesting level
- [ ] Breadcrumb updates dynamically as user navigates into/out of containers

## Verification Checklist

- [ ] Navigate to /settings/expressions, open Edit on an expression
- [ ] Add a `(…)` group and enter it (click inside the group)
- [ ] Confirm breadcrumb appears above workspace showing "Root > (…)" or similar
- [ ] Click the "Root" breadcrumb item and confirm cursor moves back to root level
- [ ] Add a nested container inside the group, enter it, confirm breadcrumb shows both levels

## Do NOT

- Do not stub with a TODO — the breadcrumb must actually work
- Do not show the breadcrumb only when 2+ levels deep — show it at level 1 (first nesting)

## Dev Notes

UAT failure from 2026-03-24: screenshot (expression-builder-nested.png) shows active nested container (round(1)) with no breadcrumb or path indicator visible above or below the workspace. Accessibility snapshot shows no breadcrumb region in the dialog.
Spec reference: DD-23-013 (breadcrumb navigation inside containers)
