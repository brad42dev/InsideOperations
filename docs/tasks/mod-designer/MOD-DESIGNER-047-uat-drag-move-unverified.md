---
id: MOD-DESIGNER-047
unit: MOD-DESIGNER
title: Canvas drag-to-move element position could not be confirmed in UAT
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

UAT Scenario 3 could not confirm that dragging a selected element on the designer canvas moves it to a new position. Multiple drag attempts either created additional elements (misrouted as palette drag events) or triggered unintended navigation.

The specific behavior that must be verified working:
- User places an element on canvas
- User clicks the element to select it
- User drags the element (mousedown on element → mousemove → mouseup at new location)
- Element moves to the new position
- No new elements are created
- No navigation away from /designer occurs

The MOD-DESIGNER-002 spec requires: `handleMouseMove` for `inter.type === 'drag'` updates SVG DOM directly (translate transform on `<g>` elements), without calling executeCmd() on each tick. On mouseup, `MoveNodesCommand` is called once with the final position.

## Acceptance Criteria

- [ ] Clicking a placed element and dragging it moves the element to the new position
- [ ] After drag+drop, element's position in the scene reflects the drop location
- [ ] No additional elements are created as a side effect of dragging existing elements
- [ ] The undo button shows "Undo: Move" after a successful drag-to-move

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create graphic, drag Text Readout from palette to canvas
- [ ] Click the placed element to select it (selection handles visible)
- [ ] Drag the element 100px to the right — element visually follows the cursor
- [ ] Release mouse — element settles at new position, not original position
- [ ] Toolbar shows "Undo: Move" confirming a MoveNodesCommand was committed
- [ ] Scene tree still shows 1 element (not 2) after the drag

## Do NOT

- Do not leave drag events unhandled so every drag creates a new element
- Do not let mousedown on a canvas element fall through to the canvas's "start drag from palette" handler

## Dev Notes

UAT failure 2026-03-26: Automated drag attempts routed to palette drop system instead of moving existing element. Right-click at same coordinates (630, 325) correctly showed node context menu, confirming element IS accessible at that position. The issue appears to be that mousedown on a placed element is not captured before the canvas-level drag handler.
Spec reference: MOD-DESIGNER-002 (drag ghost / DOM-ahead-of-store)
