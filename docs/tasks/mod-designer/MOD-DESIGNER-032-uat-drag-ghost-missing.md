---
id: MOD-DESIGNER-032
unit: MOD-DESIGNER
title: Drag ghost overlay missing when dragging shapes from palette to canvas
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When the user drags a shape from the shape palette onto the canvas, a semi-transparent "ghost" overlay of the shape should follow the cursor during the drag to show where the shape will be placed. Currently the browser's native drag image is used but no custom React/DOM ghost element appears. The drag succeeds (the shape lands at the drop position) but there is no visual ghost during the drag motion.

The expected behavior: as soon as the pointer moves after initiating a drag from the palette, a DOM element should appear that follows the cursor — positioned absolutely or fixed, with reduced opacity (e.g. 0.5), showing the shape outline or icon at pointer coordinates.

## Acceptance Criteria

- [ ] When dragging a shape from the shape palette, a ghost element (opacity < 1, following the cursor) is visible during the drag
- [ ] Ghost element renders at the current cursor position during drag move events
- [ ] Ghost disappears when the drag is dropped or cancelled
- [ ] Shape still lands correctly at the drop position after drag completes

## Verification Checklist

- [ ] Navigate to /designer
- [ ] Begin dragging a shape from the left palette toward the canvas
- [ ] Confirm a semi-transparent ghost element (opacity < 1, position:absolute or fixed) appears on screen during mid-drag
- [ ] Release the drag on the canvas — confirm the shape appears at the drop location
- [ ] Cancel the drag (Escape or drag off canvas) — confirm ghost disappears with no shape placed

## Do NOT

- Do not stub this with a TODO comment — the drag lands but the ghost is missing
- Do not rely solely on the browser's built-in drag image — a custom React ghost component is required

## Dev Notes

UAT failure from 2026-03-24: Mid-drag evaluation via page.evaluate() scanned all DOM elements for opacity < 1 and position:fixed/absolute overlays during an active drag — none were found. The native browser drag image was in use but no custom ghost element was rendered.
Spec reference: MOD-DESIGNER-002 (drag ghost implementation)
