---
id: MOD-DESIGNER-039
unit: MOD-DESIGNER
title: TextBlock node context menu text-specific items need manual verification
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

UAT Scenario 12 for MOD-DESIGNER-006 (node-type-specific context menu items) could not be completed via automation. The Text tool (T key shortcut) requires drawing on the canvas by click-and-drag, but JS-dispatched pointer events do not trigger React synthetic event handlers on the Designer canvas. As a result, no TextBlock node could be placed and right-click context menu items ("Edit Text", "Change Font…", "Text Alignment") could not be verified.

This task requires a human developer to manually verify the TextBlock context menu, or to add a test fixture / factory method that places a TextBlock node without requiring canvas pointer interaction.

Required verification (per MOD-DESIGNER-006 spec):
- Right-clicking a TextBlock (raw text shape via Text tool) should show: "Edit Text", "Change Font…", "Text Alignment"
- These items should NOT appear on non-text nodes (display elements, shapes)

## Acceptance Criteria

- [ ] Right-clicking a TextBlock node shows "Edit Text" in the context menu
- [ ] Right-clicking a TextBlock node shows "Change Font…" in the context menu
- [ ] Right-clicking a TextBlock node shows "Text Alignment" in the context menu
- [ ] These text-specific items do NOT appear on non-text node context menus

## Verification Checklist

- [ ] Use Text tool (T key) to place a TextBlock on the canvas
- [ ] Right-click the TextBlock → context menu visible with text-specific items
- [ ] Right-click a display element (Text Readout) → text-specific items NOT present
- [ ] "Edit Text" triggers inline text editing when clicked

## Do NOT

- Do not stub context menu items that don't have implementations behind them

## Dev Notes

UAT failure from 2026-03-25: Automation could not place a TextBlock node — Text tool requires drag-draw interaction on canvas SVG which React event system does not accept from JS-dispatched events. This is an automation gap, not necessarily a feature bug. Manual verification required, or add a programmatic fixture for test setup.
Spec reference: MOD-DESIGNER-006
