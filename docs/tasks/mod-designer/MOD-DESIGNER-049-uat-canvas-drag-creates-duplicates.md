---
id: MOD-DESIGNER-049
unit: MOD-DESIGNER
title: Canvas drag-to-move creates duplicate elements — mousedown misrouted to palette drop handler
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Canvas mousedown events on placed elements are still being misrouted to the palette drop handler,
creating duplicate elements instead of (or in addition to) moving the selected element.

UAT on 2026-03-26 reproduced the original MOD-DESIGNER-047 failure:
- 1 Text Readout placed on canvas successfully
- Select tool activated
- Mouse drag performed on the placed element (screen: 630,325 → 730,325)
- Result: **4 elements in Scene panel** (should be 1), Undo shows "Undo: Add" not "Undo: Move"

The element's SVG transform DID change (translate(100,150) → translate(146,150)), which suggests
a partial fix is in place that updates the visual position. However, the mousedown event is not
consumed before reaching the canvas-level palette drop handler, so 1–3 additional elements are
created on every canvas interaction.

The fix must ensure that mousedown events on an existing placed element are captured and used to
initiate a canvas drag-to-move (MoveNodesCommand on mouseup), NOT falling through to the palette
drop handler.

## Acceptance Criteria

- [ ] Clicking a placed element and dragging it moves it to the new position
- [ ] After drag+drop, Scene panel shows the same number of elements as before (no duplicates created)
- [ ] Undo button shows "Undo: Move" after a successful canvas drag-to-move
- [ ] mousedown on a placed canvas element does NOT trigger a palette drop event

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create graphic, drag Text Readout from palette to canvas
- [ ] Verify Scene panel shows exactly 1 element
- [ ] Click placed element to select it
- [ ] Drag the element 100px right
- [ ] Verify Scene panel still shows exactly 1 element (no duplicates)
- [ ] Verify element visually moved to new position
- [ ] Verify Undo button shows "Undo: Move" (not "Undo: Add")
- [ ] Click Undo → element returns to original position (1 element, back at original x)

## Do NOT

- Do not remove the palette drag-ghost system — palette-to-canvas drags must still work
- Do not just suppress the palette drop event globally — only suppress it when dragging an existing element
- Mousedown on empty canvas should still start rubber-band selection (not misrouted)

## Dev Notes

UAT failure 2026-03-26:
- Placed element had SVG transform translate(100,150) before drag
- After drag sequence (mouse down at 630,325, move to 730,325, up), transform became translate(146,150)
- BUT: Scene panel grew from 1 element → 4 elements
- Undo label: "Undo: Add" throughout — no MoveNodesCommand in undo stack
- Screenshot: docs/uat/MOD-DESIGNER/scenario5-fail-duplicate-elements.png

Prior diagnosis (MOD-DESIGNER-047 dev notes): "mousedown on a placed element is not captured before
the canvas-level drag handler." This is confirmed by UAT — the mousedown event propagation path is:
  placed element mousedown → bubbles up → canvas mousedown → palette drop system activated

Fix must intercept mousedown at the placed element level, initiate canvas drag-to-move, and call
event.stopPropagation() to prevent canvas-level palette drop handler from also firing.

Spec reference: MOD-DESIGNER-002 (drag ghost / DOM-ahead-of-store), MOD-DESIGNER-047 (original diagnosis)
