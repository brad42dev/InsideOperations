---
unit: MOD-DESIGNER
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 4
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /designer/graphics/new loads real implementation — full toolbar, shape palette, canvas, file tabs, layer panel all present

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Integrity | [MOD-DESIGNER-047] Designer page renders without error | ✅ pass | No error boundary, full UI loaded |
| 2 | Page Integrity | [MOD-DESIGNER-047] Shape palette is present | ✅ pass | Equipment/Display Elements/Widgets/Points tabs visible |
| 3 | Palette Placement | [MOD-DESIGNER-047] Placing a shape on canvas | ✅ pass | Text Readout dragged from palette → placed on canvas, Undo shows "Undo: Add", no navigation |
| 4 | Selection | [MOD-DESIGNER-047] Clicking placed element selects it | ✅ pass | Properties panel updated to show element properties |
| 5 | Drag-to-Move | [MOD-DESIGNER-047] Dragging placed element moves it | ❌ fail | Element transform changed (100,150→146,150) BUT each mouse interaction also created additional elements via palette drop. After drag: 4 elements in Scene instead of 1. Undo shows "Undo: Add" not "Undo: Move" — no MoveNodesCommand committed |
| 6 | No Duplicate | [MOD-DESIGNER-047] No duplicate element created after drag | ❌ fail | 4 "Text Readout" elements in Scene panel after drag-to-move attempt (expected 1). Screenshot: scenario5-fail-duplicate-elements.png |
| 7 | Undo | [MOD-DESIGNER-047] Undo after drag shows Move action | ❌ fail | Undo button shows "Undo: Add" throughout — MoveNodesCommand was never committed. Canvas mousedown events are still partially routed to the palette drop system |

## New Bug Tasks Created

MOD-DESIGNER-049 — Canvas drag-to-move creates duplicate elements — mousedown misrouted to palette drop handler

## Screenshot Notes

⚠️ seed data status unknown — psql not accessible, data flow scenarios exempt for MOD-DESIGNER (graphics editor, not data-display unit).

scenario5-fail-duplicate-elements.png: Canvas shows 1 element with dashed selection border, but Scene panel lists 4 "Text Readout" entries. Undo button shows "Undo: Add". Demonstrates that canvas mousedown events are being partially misrouted to palette drop handler — each drag operation creates 1-3 additional elements while also moving the selected element's transform.

Root cause: mousedown on a canvas element falls through to the canvas-level "start drag from palette" handler. The original MOD-DESIGNER-047 bug (canvas drag-to-move unverifiable) is still present. The fix implemented for this task was incomplete — the element's SVG transform does update (partial fix), but the mousedown event propagation is not stopped before reaching the palette drop handler, resulting in duplicate elements being added on every canvas interaction.
