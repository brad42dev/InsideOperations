---
id: MOD-DESIGNER-055
unit: MOD-DESIGNER
title: Escape key drag-cancel still untestable — mid-drag Escape cannot be verified via Playwright atomic drag
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

The Escape key drag-cancel for in-progress canvas drags (pressing Escape while dragging a selected element) could not be tested in UAT because Playwright's `browser_drag` is atomic — it performs pointerdown → pointermove → pointerup in one uninterruptible sequence with no way to inject a keypress mid-drag.

Synthetic pointer events via `dispatchEvent` were attempted but could not confirm that the drag state machine was actually entered before Escape was pressed, making the result indeterminate.

The underlying canvas drag-to-move IS now working (MOD-DESIGNER-049/051 both pass). The Escape cancel behavior needs a dedicated test harness that can split the drag into its constituent pointer events with a keyboard interrupt.

The fix or verification should ensure:
1. During a canvas drag (pointerdown on element + pointermove), pressing Escape before pointerup cancels the drag
2. The element returns to its exact pre-drag position (SVG transform unchanged)
3. No `MoveNodesCommand` is committed to the undo stack
4. The element remains selected after Escape cancel

## Acceptance Criteria

- [ ] Begin dragging a canvas element (pointerdown + pointermove, NOT releasing), press Escape → element snaps back to original position
- [ ] Undo stack does NOT contain a new "Undo: Move" entry after the cancelled drag
- [ ] The element's SVG transform after Escape matches the transform before drag started
- [ ] Element remains selected (selection handles still visible) after Escape cancel

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create graphic, drag an element from palette to canvas
- [ ] Click the element to select it; note its transform value
- [ ] Use Playwright `page.mouse.move` + `page.mouse.down` to start a drag, then `page.keyboard.press('Escape')` before `page.mouse.up`
- [ ] Verify element transform matches pre-drag value
- [ ] Verify undo button does NOT say "Undo: Move" (remains "Undo: Add" or whatever it was before)

## Do NOT

- Do not implement this only via synthetic `dispatchEvent` — the drag state machine may not respond correctly to synthetic events
- Do not mark as pass without a real Playwright native pointer event sequence

## Dev Notes

UAT failure from 2026-03-26: mid-drag Escape untestable via Playwright atomic browser_drag tool. Canvas drag-to-move itself confirmed working (MOD-DESIGNER-049/051 both pass with undo showing "Undo: Move"). This task is purely about verifying the Escape cancel path exists in the implementation.
Spec reference: MOD-DESIGNER-002, MOD-DESIGNER-047, MOD-DESIGNER-051, MOD-DESIGNER-052
