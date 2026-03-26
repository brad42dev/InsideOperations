---
id: MOD-DESIGNER-046
unit: MOD-DESIGNER
title: Group "Open in Tab" missing; Ctrl+G does not create group node in scene tree
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Two bugs found during UAT on 2026-03-26 related to group management:

**Bug 1 — Ctrl+G does not create group node:**
After selecting all elements (Ctrl+A) and pressing Ctrl+G, the scene tree still shows the same 4 separate elements (Text, Text, Text Readout, Display). No "Group" node appeared in the scene tree. The multi-selection properties panel shows a "Group (Ctrl+G)" button but the keyboard shortcut is not working. When right-clicking after the Ctrl+G attempt, the menu showed "Group Selection… (Ctrl+G)" and "Group" as menu items — confirming the elements are selected but not yet grouped.

**Bug 2 — "Open in Tab" missing from group context menu:**
Per spec (MOD-DESIGNER-024), right-clicking a group node should show "Open in Tab" to open the group in a new designer tab. The multi-select context menu (30+ items) does not contain "Open in Tab". This item is only meaningful for actual group nodes, so Bug 1 must be fixed first to properly test Bug 2.

## Acceptance Criteria

- [ ] Pressing Ctrl+G with elements selected creates a Group node in the scene tree
- [ ] The group context menu contains "Open in Tab"
- [ ] Clicking "Open in Tab" opens the group contents in a new file tab
- [ ] The Ctrl+G keyboard shortcut works when the canvas has focus (not caught by browser)

## Verification Checklist

- [ ] Create graphic, place 2+ elements on canvas
- [ ] Press Ctrl+A to select all, then Ctrl+G — confirm scene tree shows a "Group" node
- [ ] Right-click on the Group node — confirm "Open in Tab" is present
- [ ] Click "Open in Tab" — confirm a new tab opens showing group contents

## Do NOT

- Do not only implement "Open in Tab" without fixing group creation first
- Do not intercept Ctrl+G at the browser level — ensure canvas has focus before the shortcut fires

## Dev Notes

UAT failure from 2026-03-26: Ctrl+A selected all (multi-select toolbar appeared). Ctrl+G did not create group (scene unchanged). Right-click context showed multi-select menu with 32 items but no "Open in Tab". Scene text confirmed: "Text Text Text Readout Display" (4 separate elements, no Group).
Spec reference: MOD-DESIGNER-021, MOD-DESIGNER-022, MOD-DESIGNER-024 (group-sub-tabs)
