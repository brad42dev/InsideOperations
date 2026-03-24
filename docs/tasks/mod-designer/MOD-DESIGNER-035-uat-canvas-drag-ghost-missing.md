---
id: MOD-DESIGNER-035
unit: MOD-DESIGNER
title: Canvas drag ghost missing — no preview when dragging shape on canvas
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When dragging a shape that is already placed on the canvas (move operation), no translucent ghost/preview element appears following the cursor during the drag. The shape moves (the drop works correctly), but users get no visual feedback about where the shape will land during the drag.

**Observed in UAT (2026-03-24):** A real Playwright mouse drag (mousedown → 10 × mousemove steps → mouseup) was performed on a Text Readout element at canvas position (630, 325). A MutationObserver monitored document.body for any added elements with opacity < 1 or class names containing "ghost"/"preview"/"drag". **Zero ghost elements were detected.** Element correctly moved to (680, 295) confirming the drag itself works.

**Contrast:** When dragging a shape FROM the palette to the canvas (Scenario 7), the ghost DOES appear — a `DIV` with `opacity: 0.7, position: fixed` was detected. So the palette-drag ghost is implemented but the canvas-drag ghost is not.

**Expected behavior:** When drag-moving a shape on the canvas, a translucent ghost (opacity < 1, DOM overlay element) of the shape should follow the cursor. The original element should remain visible (faded) at its original position. On mouseup, the shape snaps to drop position and the ghost disappears.

## Acceptance Criteria

- [ ] When drag-moving a shape on the canvas, a ghost/preview element (opacity < 1) is added to the DOM during the drag
- [ ] The ghost follows the cursor position during drag
- [ ] The ghost is visually distinct (lower opacity, dashed border, or color change) from the placed element
- [ ] On mouseup, the shape lands at the cursor position and the ghost is removed from the DOM
- [ ] The behavior matches the already-working palette-drag ghost

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create a graphic, drag a shape from palette to canvas
- [ ] Click the shape to select it, then drag it to a new position
- [ ] Confirm a ghost overlay element appears in the DOM mid-drag (opacity < 1)
- [ ] Release — confirm shape moved to drop position, ghost is gone
- [ ] Use MutationObserver to confirm ghostDetected=true during canvas drag (same method as UAT)

## Do NOT

- Do not stub this with a comment — the palette drag ghost already works, align canvas drag ghost with that implementation
- Do not just move the element without visual feedback during drag

## Dev Notes

UAT failure 2026-03-24: MutationObserver found ghostDetected=false during real mouse drag on canvas. Palette drag ghost (DIV opacity=0.7 position=fixed) confirmed working — canvas drag ghost code path must be missing or disabled.
Spec references: MOD-DESIGNER-002 (60fps visual drag ghost, uat_status=fail), MOD-DESIGNER-031 (prior UAT bug task for same issue)
