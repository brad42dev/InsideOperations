---
id: MOD-CONSOLE-039
unit: MOD-CONSOLE
title: Fix pane fullscreen — position:fixed trapped inside RGL transform ancestor; add double-click activation
status: pending
priority: medium
depends-on: []
source: bug
bug_report: Console pane fullscreen hides other panes and shows Exit button but the pane itself doesn't expand to fill the screen
---

## What's Broken

Two defects in pane fullscreen (spec §5.11):

**Defect 1 — Pane does not visually expand.**
`PaneWrapper.tsx` applies `position: fixed; inset: 0; zIndex: 500` to make the
fullscreened pane cover the viewport. However, every pane is a child of
react-grid-layout, which positions items using inline `transform: translate(x, y)`
CSS. Per the CSS spec, `position: fixed` is relative to the nearest ancestor with
a `transform`, `will-change`, or `perspective` property — not the viewport.
Result: the pane's `fixed; inset: 0` is contained inside the RGL item box and
the pane stays in its grid cell. The only visible effect is that other panes
disappear (`display: none`) and an "Exit Full Screen" button appears — the pane
does not grow at all.

**Defect 2 — Double-click activation missing.**
Spec §5.11 activation methods:
- Double-click on a pane (no text/element under cursor) → fullscreen
- Right-click → Full Screen (present, works as a trigger)
- F11 when pane selected (present)

There is no `onDoubleClick` handler on PaneWrapper or on the WorkspaceGrid item.
Double-click does nothing.

Code locations:
- `frontend/src/pages/console/PaneWrapper.tsx` — fullscreenStyle, Exit button
- `frontend/src/pages/console/WorkspaceGrid.tsx` — fullscreenPaneId state, F11 handler, display:none

## Expected Behavior

Per spec §5.11:
- Selected pane **expands to fill the workspace grid area** with a 200ms ease CSS transition.
- All other panes are hidden (`display: none`). WebSocket subscriptions remain active.
- A small "Exit Full Screen" button appears in the top-right corner of the expanded pane.
- Exit: Escape, F11 again, or click "Exit Full Screen" — all panes restore to grid positions
  with reverse transition.

The expansion must visually cover the workspace grid area (not just hide others).

## Root Cause (if known)

`position: fixed` inside a CSS-transformed ancestor is a well-known browser rendering
constraint. react-grid-layout v2 uses `transform: translate()` for item positioning,
which creates a containing block for `fixed` descendants.

**Correct approach:** render the fullscreen pane via a React portal into the workspace
container element (or document.body), using `position: absolute; inset: 0` relative
to the workspace container (which must have `position: relative`). The portal should
be placed OUTSIDE the `<GridLayout>` but inside the workspace root div so it still
obeys workspace-level stacking and z-index.

Alternative (simpler): apply the fullscreen style to the RGL item's wrapper div
(the `<div key={pane.id}>` in WorkspaceGrid) rather than inside PaneWrapper —
but this still won't escape the RGL item's transform.

Portal approach is the correct fix.

## Acceptance Criteria

- [ ] When pane fullscreen is activated (button, F11, double-click), the pane visually
      expands to cover the entire workspace grid area (all columns and rows), covering
      the grid completely.
- [ ] Expansion uses a 200ms ease CSS transition (both enter and exit).
- [ ] All other panes are hidden while one pane is fullscreen.
- [ ] "Exit Full Screen" button appears in the top-right corner of the expanded pane.
- [ ] Pressing Escape exits fullscreen and all panes restore to their grid positions.
- [ ] Pressing F11 again exits fullscreen.
- [ ] Clicking "Exit Full Screen" button exits fullscreen.
- [ ] Double-clicking a pane (not on a point-bound element) activates fullscreen for
      that pane. Double-click on a point-bound element must NOT trigger fullscreen
      (it opens Point Detail instead — check that this distinction is preserved).
- [ ] WebSocket subscriptions for hidden panes remain active during fullscreen
      (do not unsubscribe when pane is display:none).
- [ ] Fullscreen works correctly in both view mode and does NOT activate in edit mode
      (drag handles in edit mode intercept double-click).

## Verification

1. Navigate to `/console`, open a workspace with 2+ panes
2. Click the fullscreen button on any pane — pane must EXPAND to fill the workspace
   area, not just sit in place while others disappear
3. Confirm 200ms transition animation visible
4. Confirm "Exit Full Screen" button visible in expanded pane top-right
5. Press Escape — all panes restore to grid positions, reverse transition plays
6. Double-click on a pane background (not on a graphic element) — pane enters fullscreen
7. Double-click on a point-bound graphic element — Point Detail opens, fullscreen does NOT activate
8. Press F11 with a pane selected — fullscreen toggles
9. Open browser DevTools → no errors during any of the above

## Spec Reference

`/home/io/spec_docs/console-implementation-spec.md` §5.11 "Pane Full-Screen" (line 662–682)

> "Selected pane expands to fill the workspace grid area with a CSS transition (200ms ease)"
> "All other panes are hidden (display: none)"
> "Keyboard: F11 when a pane is selected (not browser fullscreen — pane fullscreen within workspace)"

## Do NOT

- Stub this — the existing implementation is already a stub (CSS fix without actual expansion)
- Use `position: fixed` inside the react-grid-layout tree — this never works with CSS transforms
- Unsubscribe WebSocket data for hidden panes
- Allow fullscreen activation in edit mode (drag handles take precedence)
- Replace the `position: absolute; inset: 0` pane with an entirely new component —
  reuse PaneWrapper, just render it via portal outside the GridLayout
