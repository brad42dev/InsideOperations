---
id: MOD-DESIGNER-031
unit: MOD-DESIGNER
title: Drag ghost missing — no preview element when dragging shape on canvas
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When dragging a shape on the Designer canvas, there should be a translucent ghost/preview element that follows the cursor to indicate where the shape will be dropped. Currently no ghost element appears — the shape simply moves to its new position without any drag preview.

This is a UX regression: dragging should show a semi-transparent duplicate of the element following the cursor, with the original element remaining in place (or shown faded) until the drop occurs.

## Acceptance Criteria

- [ ] When drag-moving a shape on the canvas, a translucent ghost/preview of the shape follows the cursor
- [ ] The ghost is visually distinct from the actual element (e.g., lower opacity, dashed border, or slight color change)
- [ ] The original element remains visible (faded or in original position) during the drag
- [ ] On mouse-up, the shape snaps to the drop position and the ghost disappears

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, draw a rectangle
- [ ] Click and drag the rectangle — confirm a ghost/preview element appears following the cursor
- [ ] The ghost is visible during the drag (not just at start/end)
- [ ] Release mouse — shape lands at cursor position, ghost disappears

## Do NOT

- Do not implement only the drop — implement the mid-drag visual feedback
- Do not use a CSS cursor change as a substitute for a ghost element

## Dev Notes

UAT failure 2026-03-24: Drawing a rect on canvas, then dragging it — no ghost/preview element was visible during the drag. The shape just moved. Screenshots: docs/uat/MOD-DESIGNER/drag-ghost-mid.png
Spec reference: MOD-DESIGNER-002 (drag ghost was an acceptance criterion for the canvas drag interaction)
