---
id: MOD-CONSOLE-040
unit: MOD-CONSOLE
title: Add workspace browser fullscreen button to Console main toolbar
status: pending
priority: medium
depends-on: []
source: bug
bug_report: No full screen button for the whole workspace in the main Console view
---

## What's Broken

The main Console workspace toolbar (`frontend/src/pages/console/index.tsx`) has no
browser fullscreen button. The equivalent button exists in:
- **Process module** (`frontend/src/pages/process/index.tsx:1740–1753`) — explicitly
  specced at process-implementation-spec.md §2.5 line 247
- **Console detached window** (`frontend/src/pages/console/WorkspaceView.tsx:186–199`) —
  explicitly specced at console-implementation-spec.md §12.1 line 1290

In WorkspaceView.tsx, `toggleFullscreen` and `isFullscreen` are defined at lines 115–124
but are only wired inside the `if (detached) { ... }` render path. They are dead code in
the normal AppShell mode.

Additionally, the existing detached window fullscreen button has a desync bug: it has no
`fullscreenchange` event listener, so if the user exits fullscreen natively (Escape, browser
F11), the button icon stays stuck showing "exit fullscreen."

**Decision file**: `docs/decisions/cx-console-workspace-fullscreen.md`

## Expected Behavior

Per the decision (CX-CONSOLE-WORKSPACE-FULLSCREEN, 2026-03-26):

1. A `[⛶]` icon button appears in the far-right of the Console workspace toolbar,
   always visible when a workspace is active (same condition as the AR toggle button).
2. Clicking it calls `document.documentElement.requestFullscreen()` to enter browser
   fullscreen (hides browser chrome — address bar, tabs). Exits with
   `document.exitFullscreen()`.
3. **Independent of kiosk mode** — the button does not enter/exit kiosk. Users can
   combine them manually.
4. **Syncs with actual browser state** via a `document.addEventListener('fullscreenchange')`
   listener that sets `isFullscreen = !!document.fullscreenElement`. Cleans up on unmount.
5. **F11 precedence** in WorkspaceGrid.tsx:
   - Pane selected → F11 triggers pane fullscreen (existing behavior, keep)
   - No pane selected AND no pane currently in pane-fullscreen → F11 triggers workspace
     browser fullscreen
6. Detached window: fix the existing button in WorkspaceView.tsx to also add the
   `fullscreenchange` listener (same desync fix applies there).

## Root Cause

Feature was never added to the main Console view. The dead code in WorkspaceView.tsx
suggests it was planned but the non-detached path was never wired up.

## Acceptance Criteria

- [ ] A fullscreen icon button exists in the Console toolbar right-side controls, far
      right (after the Edit button), visible whenever a workspace is active.
- [ ] Clicking the button enters browser fullscreen (`document.documentElement` level).
      Browser chrome (address bar, tabs) disappears.
- [ ] Clicking the button again (or pressing the on-screen button in fullscreen) exits
      browser fullscreen.
- [ ] If the user exits fullscreen natively (presses Escape or browser F11), the button
      icon correctly updates to "enter fullscreen" — no icon desync.
- [ ] Kiosk mode state is unaffected by the fullscreen button — they are orthogonal.
- [ ] F11 with no pane selected triggers workspace browser fullscreen (not pane fullscreen).
- [ ] F11 with a pane selected still triggers pane fullscreen (no regression).
- [ ] Console detached window fullscreen button also has the `fullscreenchange` listener
      (icon stays correct after native browser exit).
- [ ] No JS errors in browser console during any of the above.

## Verification

1. Navigate to `/console`, open a workspace.
2. Click the new [⛶] button in the top-right of the toolbar — browser chrome disappears,
   workspace fills the full screen including app sidebar and topbar.
3. Click the button again — browser fullscreen exits, chrome returns. Button icon is correct.
4. Enter fullscreen, then press Escape — fullscreen exits AND button icon updates to "enter".
5. Press Escape again — should not crash; nothing more to exit.
6. With no pane selected, press F11 — browser fullscreen toggles.
7. Click a pane to select it, press F11 — pane fullscreen activates (not browser fullscreen).
8. Press Ctrl+Shift+K to enter kiosk — sidebar/topbar hide. Fullscreen button is still visible
   in the now-visible toolbar area OR does the right thing in kiosk context.
9. Navigate to `/detached/console/:id`, enter fullscreen via title bar button, press Escape —
   button icon correctly updates.

## Spec Reference

`docs/decisions/cx-console-workspace-fullscreen.md` — full decision with inventory and rules.

`frontend/src/pages/process/index.tsx:969–976, 1740–1753` — reference implementation to match.

## Do NOT

- Combine fullscreen with kiosk mode entry — the button is browser fullscreen only.
- Remove or change the existing F11 pane fullscreen behavior — add a fallback for when
  no pane is selected, don't replace the existing handler.
- Add a `fullscreenchange` listener without cleaning it up on unmount.
- Use vendor-prefixed fullscreen API (`webkitRequestFullscreen`) — standard API only.
