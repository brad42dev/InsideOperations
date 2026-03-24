---
id: MOD-DESIGNER-029
unit: MOD-DESIGNER
title: No file tab bar visible in designer when multiple graphics are open
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

The Designer does not show a file tab bar when multiple graphics are open. Per spec, opening multiple graphic files should show tabs at the top of the designer area, similar to a code editor. No tab bar is visible even when navigating between graphics.

## Acceptance Criteria

- [ ] Opening a graphic file shows a tab at the top of the designer
- [ ] Opening a second graphic shows a second tab alongside the first
- [ ] Clicking a tab switches to that graphic
- [ ] Closing a tab removes it from the tab bar

## Verification Checklist

- [ ] Open a graphic in designer → tab bar appears with current file tab
- [ ] Open a second graphic → second tab appears, both tabs visible
- [ ] Click first tab → first graphic displayed
- [ ] Close a tab → tab removed from bar

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the visual tab — tab switching must work

## Dev Notes

UAT failure from 2026-03-24: No tab bar visible in designer. Opening graphics navigates to the graphic but no per-file tab bar appears at the top of the editor. The multi-file tab feature is unimplemented.
Spec reference: MOD-DESIGNER-023 (file tabs for multiple open graphics)
