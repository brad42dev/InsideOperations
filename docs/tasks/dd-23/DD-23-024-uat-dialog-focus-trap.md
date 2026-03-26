---
id: DD-23-024
unit: DD-23
title: Expression builder dialog has no focus trap; keyboard navigation escapes to app shell
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

The expression builder dialog (Edit Expression) does not trap keyboard focus. When a user clicks on a tile in the workspace (giving it focus), pressing arrow keys (e.g., ArrowLeft) does not navigate the insertion cursor within the workspace — instead, focus escapes the dialog and triggers the sidebar navigation, navigating the app to a different route (observed: pressing ArrowLeft navigated to /rounds).

This means:
1. Arrow key cursor navigation within the workspace is completely broken — arrow keys are consumed by the sidebar navigation instead
2. The dialog has no focus trap, violating accessibility expectations (keyboard users cannot interact with the expression builder without accidentally navigating away)

## Acceptance Criteria

- [ ] Pressing ArrowLeft/ArrowRight inside the expression workspace moves the insertion cursor within the expression, not the app navigation
- [ ] The expression builder dialog traps keyboard focus — Tab, arrow keys, and other keyboard events stay within the dialog while it is open
- [ ] Clicking on a workspace tile positions focus within the workspace so subsequent keyboard events are captured there
- [ ] Pressing Escape closes the dialog (standard modal behavior)

## Verification Checklist

- [ ] Navigate to /settings/expressions, open Edit on an expression
- [ ] Click a tile in the workspace — tile shows [active][selected]
- [ ] Press ArrowLeft — cursor should move before the tile, NOT navigate the app to a different route
- [ ] Press ArrowRight — cursor should move after the tile
- [ ] Press Tab — focus should cycle within the dialog, not escape to the sidebar
- [ ] Press Escape — dialog should close

## Do NOT

- Do not stub this with a TODO comment
- Do not only fix ArrowLeft — fix focus trapping for all keyboard navigation
- Do not break existing mouse-based interactions (clicking tiles, dragging from palette)

## Dev Notes

UAT failure from 2026-03-25: After clicking tile [ref=e283] in workspace (tile became [active][selected]), pressed ArrowLeft. Browser navigated to /rounds. The dialog is mounted without a focus trap — keyboard events are reaching the sidebar link elements.

Fix: wrap the dialog content in a focus trap (e.g., using @radix-ui/react-dialog which includes built-in focus trapping, or add a manual focusTrap utility). Also ensure the workspace `application` element captures arrow key events and dispatches MOVE_CURSOR actions rather than letting them propagate.

Spec reference: DD-23-011 (insertion cursor keyboard navigation), design-docs/23_EXPRESSION_BUILDER.md §6.3
