---
id: MOD-DESIGNER-047
unit: MOD-DESIGNER
title: Drag ghost not cancelled when Escape pressed during palette drag
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

When dragging a shape or element from the palette to the canvas, pressing Escape should cancel the drag and remove the drag ghost. Currently, the Escape key handler exists for canvas-to-canvas drags (DesignerCanvas.tsx) but not for palette-to-canvas drags (DesignerLeftPalette.tsx).

During UAT on 2026-03-26:
- Code inspection shows 4/5 drag ghost scenarios are correctly implemented
- Palette drag ghost appears: ✓
- Ghost follows cursor: ✓
- Ghost disappears on drop: ✓
- Ghost shows label: ✓
- **Ghost disappears on Escape: ✗** — NOT IMPLEMENTED

When user presses Escape during a palette tile drag, the ghost should immediately disappear and the drag should be cancelled. Currently, nothing happens; the user must complete the drag or switch focus away.

## Acceptance Criteria

- [ ] Pressing Escape during a palette tile drag removes the ghost element from DOM
- [ ] Pressing Escape cancels the drag (no drop event dispatched)
- [ ] Works for all palette tile types: Shape, DisplayElement, Widget, ReportElement, Point
- [ ] Ghost element is no longer visible after Escape (display:none or removed)

## Verification Checklist

- [ ] Navigate to /designer, open a graphic
- [ ] Begin dragging a shape tile (ghost appears under cursor)
- [ ] Press Escape while dragging
- [ ] Verify `document.getElementById('io-canvas-drag-ghost')` returns null or is hidden
- [ ] Verify no `io:shape-drop` event was dispatched (canvas should not have added an element)
- [ ] Repeat for DisplayElement, Widget, ReportElement tiles to verify consistency

## Do NOT

- Do not remove the Escape handler from canvas-to-canvas drag (DesignerCanvas.tsx already has it)
- Do not dispatch a drop event when Escape is pressed (drag should be cancelled, not completed)
- Do not implement in canvas only (must be in palette for all tile types)

## Dev Notes

UAT findings from 2026-03-26:

**Correct implementation** (DesignerLeftPalette.tsx lines 301-346):
- Ghost element created with id='io-canvas-drag-ghost'
- Ghost positioned fixed with pointer-events:none
- Ghost text set to item.label
- onMove handler updates position on mousemove
- onUp handler removes ghost on mouseup
- Custom 'io:shape-drop' event dispatched

**Missing implementation:**
- No keydown listener during palette drag
- No check for e.key === 'Escape' in drag handlers
- No removal of ghost or cancellation of drag on Escape

**Reference:** DesignerCanvas.tsx lines 3331-3353 show correct Escape handler pattern for canvas drag — replicate this pattern in palette drag handlers but for the palette ghost.

**Need to handle in:**
1. ShapeTile.handleMouseDown (line 293)
2. DisplayElementTile.handleMouseDown (similar)
3. WidgetTile.handleMouseDown (similar)
4. ReportElementTile.handleMouseDown (similar)
5. PointsTile.handleMouseDown (similar)

Each should add:
```javascript
const onEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    ghost.remove()
    el.removeAttribute('data-dragging')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.removeEventListener('keydown', onEscape)
  }
}
document.addEventListener('keydown', onEscape, true)
```

And clean up in both onUp and onEscape:
```javascript
document.removeEventListener('keydown', onEscape)
```
