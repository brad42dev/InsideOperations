---
id: MOD-DESIGNER-034
unit: MOD-DESIGNER
title: Group editing does not open a sub-tab in the Designer tab bar
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When a user double-clicks a group on the canvas to enter group editing mode, the Designer should open a sub-tab in the file tab bar — showing the parent graphic tab alongside a nested "Group 1" tab (or per-spec name). Currently the only navigation indicator when editing a group is an in-canvas breadcrumb ("Untitled Graphic › Group 1"), but there is no tab bar strip with separate tabs for the file and the open group.

The expected behavior: the tab bar (the horizontal strip at the top of the canvas area that shows open files) should display a sub-tab for the active group when in group editing mode. The breadcrumb may remain as secondary navigation, but the primary UX is the tab.

## Acceptance Criteria

- [ ] When double-clicking a group to enter edit mode, a sub-tab appears in the Designer tab bar representing the group
- [ ] The tab bar shows both the parent file tab (e.g. "Untitled Graphic") and the group sub-tab (e.g. "Group 1")
- [ ] Clicking the parent file tab exits group editing mode and returns to the top-level canvas
- [ ] Clicking the group sub-tab returns focus to the group editing context
- [ ] Closing the group sub-tab (if closeable) exits group editing mode

## Verification Checklist

- [ ] Navigate to /designer
- [ ] Create a group (Ctrl+G on selected elements)
- [ ] Double-click the group to enter edit mode
- [ ] Confirm a tab bar strip is visible with two tabs: the parent graphic tab and the group sub-tab
- [ ] Click the parent graphic tab — confirm group editing exits
- [ ] Double-click the group again — confirm sub-tab reappears

## Do NOT

- Do not remove the in-canvas breadcrumb — it may serve as secondary navigation
- Do not implement only the breadcrumb and call it done — a persistent tab in the tab bar is required

## Dev Notes

UAT failure from 2026-03-24: Double-clicking a group showed in-canvas breadcrumb "Untitled Graphic › Group 1" (group edit mode entered correctly) but no tab bar sub-tab appeared. The file tab bar did not show a group tab. Screenshot: docs/uat/MOD-DESIGNER/fail-group-subtab-missing.png
Spec reference: MOD-DESIGNER-024 (group sub-tabs), designer-implementation-spec.md tab bar behavior
