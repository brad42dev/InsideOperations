---
unit: DD-06
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 4
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /console loads the real Console implementation — sidebar navigation, top bar, workspace panel, and pane grid all rendered correctly.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | App Shell | [DD-06-019] App shell renders without error | ✅ pass | Console page loads with full navigation, no error boundary |
| 2 | G-Key Navigation | [DD-06-019] G-key hint overlay appears after pressing G | ❌ fail | No overlay appeared in DOM or accessibility tree after pressing G — expected "Go to…" hint panel with module shortcuts |
| 3 | G-Key Navigation | [DD-06-019] Overlay lists correct module shortcuts | ❌ fail | Overlay never appeared; shortcuts cannot be verified |
| 4 | G-Key Navigation | [DD-06-019] G+P navigates to /process | ✅ pass | URL changed to /process immediately after G then P |
| 5 | G-Key Navigation | [DD-06-019] G+R navigates to /reports | ✅ pass | URL changed to /reports immediately after G then R |
| 6 | G-Key Navigation | [DD-06-019] G+D navigates to /designer | ✅ pass | URL changed to /designer immediately after G then D |
| 7 | G-Key Navigation | [DD-06-019] Overlay auto-dismisses after 2.5s timeout | ❌ fail | Overlay never appeared so auto-dismiss cannot be verified; URL did stay at /console after 2.5s wait |

## New Bug Tasks Created

DD-06-020 — G-key hint overlay does not render — navigation works but overlay is invisible

## Screenshot Notes

- docs/uat/DD-06/fail-no-gkey-overlay.png — Console page after pressing G key; no hint overlay visible anywhere on screen. Navigation mechanism works (G+P/R/D all execute correctly) but the visual "Go to…" hint overlay is absent. This matches the task title: the overlay rendering is broken due to React Strict Mode ref reset, even though the underlying navigation handler still fires.
- The overlay is completely absent from the DOM (no elements with "overlay", "hint", "gkey", or "Go to" text found via querySelectorAll). The navigation state machine registers keystrokes and executes navigation, but the overlay render path is broken.
