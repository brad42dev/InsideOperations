---
id: MOD-DESIGNER-052
unit: MOD-DESIGNER
title: Escape key drag-cancel untestable — depends on broken canvas drag-to-move (MOD-DESIGNER-051)
status: pending
priority: high
depends-on: ["MOD-DESIGNER-051"]
source: uat
uat_session: docs/uat/MOD-DESIGNER/CURRENT.md
---

## What to Build

Pressing Escape during an in-progress canvas drag must cancel the drag and return the element to its original position. UAT Scenario 11 could not be tested because the underlying drag-to-move (MOD-DESIGNER-051) is broken — a drag that never starts cannot be cancelled.

**Observed in UAT (2026-03-26):** Could not initiate a canvas drag (see MOD-DESIGNER-051). Therefore Escape cancel behavior is untestable until drag-to-move works.

**Expected:** When a canvas drag is in progress (element has been picked up and is being moved), pressing Escape must:
- Return the element to its original position
- NOT commit a MoveNodesCommand
- Undo history must NOT show "Undo: Move" after an Escape-cancelled drag

## Acceptance Criteria

- [ ] MOD-DESIGNER-051 (canvas drag-to-move) must be passing first
- [ ] Begin dragging a canvas element, press Escape mid-drag → element snaps back to original position
- [ ] Undo history does NOT contain "Undo: Move" after the cancelled drag
- [ ] The element is still selected after Escape cancel

## Verification Checklist

- [ ] Navigate to /designer, place a shape, select it
- [ ] Begin dragging the shape (pointerdown + pointermove, do NOT release)
- [ ] Press Escape key
- [ ] Confirm element returns to original position
- [ ] Confirm undo stack does NOT include a Move entry

## Do NOT

- Do not implement Escape cancel without first fixing the drag-to-move — the cancel handler has no effect if drag never starts
- Do not call commitMove with the original position as a workaround — no command should be committed on cancel

## Dev Notes

UAT failure from 2026-03-26 (Scenario 11): drag itself broken, cancel untestable.
Spec reference: MOD-DESIGNER-048 (prior fix attempt, marked verified but UAT failed due to drag broken)
Blocked by: MOD-DESIGNER-051 (canvas drag-to-move fix required first)
