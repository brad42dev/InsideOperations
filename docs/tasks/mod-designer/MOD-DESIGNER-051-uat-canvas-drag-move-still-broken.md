---
id: MOD-DESIGNER-051
unit: MOD-DESIGNER
title: Canvas drag-to-move still broken after MOD-DESIGNER-047 fix
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Dragging a selected element on the Designer canvas must move it to a new position and commit a MoveNodesCommand to undo history. UAT Scenario 10 confirmed the drag-to-move feature is still broken after MOD-DESIGNER-047 was marked verified.

**Observed in UAT (2026-03-26, two separate attempts):**
1. Playwright browser_drag timed out with error "subtree intercepts pointer events" — a `<rect>` SVG element inside the canvas group blocks mouseup at the target coordinate.
2. Manual JS pointer event dispatch (pointerdown on canvas element + pointermove on document + pointerup on document) executed without error but undo history remained "Undo: Resize" — MoveNodesCommand was never committed.

**Expected:** Selecting an element and dragging it 100+ pixels should:
- Visibly reposition the element on canvas
- Commit MoveNodesCommand so undo shows "Undo: Move"
- Not create duplicate elements
- Not trigger palette drop

## Acceptance Criteria

- [ ] Select a canvas element, drag it 100px right → element moves to new position
- [ ] Undo button shows "Undo: Move" after the drag completes
- [ ] No duplicate elements created during or after drag
- [ ] Playwright browser_drag from element center to offset position does not timeout or fail with "subtree intercepts pointer events"

## Verification Checklist

- [ ] Navigate to /designer, place a shape on canvas
- [ ] Click shape to select it
- [ ] Drag the shape ~100px in any direction
- [ ] Confirm element is at new position (not original)
- [ ] Confirm undo shows "Undo: Move"
- [ ] Confirm scene panel still shows same number of elements (no duplicates)

## Do NOT

- Do not move the element via transform/style update without committing MoveNodesCommand — partial fix causes undo mismatch
- Do not suppress pointer events on the SVG subtree as a workaround — fix the event routing instead
- Do not conflate palette drop handler with canvas move handler — they must be separate

## Dev Notes

UAT failure from 2026-03-26 (Scenario 10): browser_drag timeout + JS event dispatch both failed.
Screenshot: docs/uat/MOD-DESIGNER/fail-s10-drag-move.png
Spec reference: MOD-DESIGNER-047 (prior fix attempt, marked verified but UAT failed)
The SVG canvas uses React synthetic pointer event handlers. The `<rect>` element covering the canvas group is blocking Playwright's mouseup delivery. The underlying pointer event model needs to correctly propagate pointerdown→pointermove→pointerup for a canvas element drag.
