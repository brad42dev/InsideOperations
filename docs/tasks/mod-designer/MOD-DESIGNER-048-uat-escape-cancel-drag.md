---
id: MOD-DESIGNER-048
unit: MOD-DESIGNER
title: Escape key cancel of in-progress canvas drag not verifiable
status: pending
priority: high
depends-on: [MOD-DESIGNER-047]
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

UAT Scenario 4 could not be tested because the prerequisite (drag-to-move working, MOD-DESIGNER-047) failed. Once drag-to-move is fixed, the Escape key cancel behavior must also be verified.

The MOD-DESIGNER-002 spec requires: on Escape during drag, SVG DOM is reset to original positions and no MoveNodesCommand is committed.

## Acceptance Criteria

- [ ] While dragging an element (mousedown held, mouse moved), pressing Escape cancels the drag
- [ ] After Escape, element returns to its original pre-drag position
- [ ] No MoveNodesCommand is committed (Undo button does NOT show "Undo: Move")
- [ ] Canvas remains in edit mode with no error

## Verification Checklist

- [ ] Navigate to /designer/graphics/new, create graphic, place an element
- [ ] Click element, begin drag (hold mouse down, move 50px)
- [ ] While still dragging, press Escape
- [ ] Element returns to original position
- [ ] Undo button remains "Undo: Add" (not "Undo: Move")

## Do NOT

- Do not commit the move on Escape — the position must be fully reverted

## Dev Notes

UAT failure 2026-03-26: Scenario 4 could not be tested because drag (Scenario 3) failed first.
Depends on MOD-DESIGNER-047 being fixed first.
Spec reference: MOD-DESIGNER-002 (drag ghost / DOM-ahead-of-store)
