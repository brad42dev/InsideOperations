---
id: MOD-DESIGNER-040
unit: MOD-DESIGNER
title: Shape palette tile right-click places element instead of showing context menu
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Per MOD-DESIGNER-007 spec, right-clicking a shape palette tile should show a context menu with options like "Add to Favorites", "Place at Center", "View Documentation", etc. Instead, right-clicking a palette tile triggers placement of that element on the canvas (the same behavior as a left-click). No `[role="menu"]` or Radix ContextMenu appeared.

Observed behavior (2026-03-25 UAT):
- Right-click on "Text Readout" palette tile in the Display Elements section
- The element was placed on the canvas (same as a left-click would do)
- No context menu appeared

Expected behavior:
- `onContextMenu` handler on each palette tile should prevent default and open a Radix ContextMenu
- Context menu should contain palette-tile-specific actions per the spec

## Acceptance Criteria

- [ ] Right-clicking a shape palette tile shows a context menu
- [ ] Context menu does NOT trigger element placement on the canvas
- [ ] Context menu contains at minimum "Place at Center" and "Add to Favorites" actions
- [ ] Left-clicking a palette tile still places the element normally

## Verification Checklist

- [ ] Navigate to /designer, ensure shape palette is visible
- [ ] Right-click any palette tile → `[role="menu"]` appears, no element placed on canvas
- [ ] Context menu has expected items per MOD-DESIGNER-007 spec
- [ ] Left-click palette tile → element placed on canvas (normal behavior preserved)
- [ ] Click elsewhere to dismiss context menu → menu closes without placing element

## Do NOT

- Do not remove placement on left-click — only right-click should show the context menu
- Do not stub the context menu items — they must actually function (at minimum "Place at Center")

## Dev Notes

UAT failure from 2026-03-25: Right-click on palette tile placed element on canvas instead of showing context menu. The palette tile component likely lacks an `onContextMenu` handler, or the handler calls the same placement action as `onClick`. The `contextmenu` browser event bubbles up to whatever click handler exists on the tile, triggering placement.
Spec reference: MOD-DESIGNER-007
