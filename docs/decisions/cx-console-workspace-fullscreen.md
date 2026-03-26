---
id: CX-CONSOLE-WORKSPACE-FULLSCREEN
title: Console main workspace — browser fullscreen button
status: decided
contract: CX-CONSOLE-WORKSPACE-FULLSCREEN
decided: 2026-03-26
---

## What Was Decided

The main Console workspace toolbar gets a browser fullscreen button in the far-right position. It calls `document.documentElement.requestFullscreen()` (whole page, matching Process behavior). It is independent from kiosk mode — the two can be combined but the fullscreen button does not trigger kiosk. The button stays in sync with the actual browser fullscreen state via a `fullscreenchange` event listener, so it correctly reflects the state if the user exits fullscreen natively (Escape, browser F11).

## Inventory (What Exists Today)

| Module / Entity | Implemented? | Current behavior | Gap found |
|-----------------|-------------|-----------------|-----------|
| Process (main) | ✅ | Toolbar [⛶] button + F11. `document.documentElement.requestFullscreen()`. process/index.tsx:969–975, 1742 | None |
| Process (detached) | ✅ | Same button in detached title bar. ProcessDetachedView.tsx:321–327 | None |
| Console (detached) | ✅ | [⤢/⤡] button in detached title bar. WorkspaceView.tsx:115–124, 186–199 | No `fullscreenchange` listener — can desync |
| Console (main) | ❌ | `toggleFullscreen` + `isFullscreen` defined in WorkspaceView.tsx lines 115–124 but only wired in `detached=true` path. Dead code in normal AppShell mode. No button in index.tsx toolbar. | Button missing from toolbar |
| Dashboards | ❌ | None | Not in scope |
| Forensics | ❌ | None | Not in scope |
| Reports | ❌ | None | Not in scope |

**Kiosk mode (related but separate):** Design doc 06 §Kiosk explicitly states "Kiosk mode is NOT browser fullscreen — it removes I/O's application chrome." Kiosk hides the app sidebar + topbar. Browser fullscreen hides the browser chrome. They are independent.

## Questions and Answers

**Q1**: Should the main Console workspace toolbar have a browser fullscreen button?
**A**: Yes — add to toolbar. Mirrors Process. Dead code in WorkspaceView.tsx already exists — just wire it in.

**Q2**: Where in the toolbar does the fullscreen button live, and what does it cover?
**A**: Far right of toolbar, fullscreens entire page. Matches Process behavior. `document.documentElement.requestFullscreen()`. Hides browser chrome. App sidebar/topbar remain visible unless kiosk is also active.

**Q3**: Should the button also toggle kiosk mode at the same time?
**A**: No — keep them independent. Fullscreen button = browser fullscreen only. Kiosk = separate shortcut (Ctrl+Shift+K). User can combine manually.

**Q4**: Should the button stay in sync with the actual browser fullscreen state?
**A**: Yes — listen to `fullscreenchange` event. When the browser exits fullscreen (Escape, F11, or clicking out), the button icon updates to match.

## Resulting Specification

### Console Main Workspace — Fullscreen Button

1. **Location**: Far-right position in the Console workspace toolbar (index.tsx right-side controls), after the Edit button, always visible when a workspace is active (same visibility condition as the AR toggle).

2. **Behavior on click**:
   - If not fullscreen: call `document.documentElement.requestFullscreen().catch(() => undefined)`. Button shows "exit fullscreen" icon.
   - If fullscreen: call `document.exitFullscreen().catch(() => undefined)`. Button shows "enter fullscreen" icon.

3. **Icon**: Use the same expand/contract SVG already used in WorkspaceView.tsx detached path (`⤢` / `⤡` glyphs or equivalent 4-corner expand/contract SVG icons). Tooltip: "Enter fullscreen" / "Exit fullscreen".

4. **State sync**: Add a `document.addEventListener('fullscreenchange', ...)` listener that sets `isFullscreen` to `!!document.fullscreenElement`. This prevents desync when the user exits fullscreen via browser native controls (Escape key, browser F11, clicking the browser's own exit button). Clean up the listener on unmount.

5. **F11 keyboard shortcut**: F11 in the workspace (when no pane fullscreen is active) should also toggle browser fullscreen. Note: the existing F11 handler in WorkspaceGrid.tsx handles pane fullscreen. When no pane is fullscreen and no pane is selected, F11 should trigger workspace browser fullscreen instead. If a pane is selected, F11 still goes to pane fullscreen (existing behavior). This precedence: pane fullscreen > workspace browser fullscreen.

6. **Independence from kiosk**: The fullscreen button does not enter or exit kiosk mode. A user can be in browser fullscreen without kiosk, in kiosk without browser fullscreen, or both simultaneously.

### Console Detached Window — Fix Existing Desync

The existing detached window fullscreen button in WorkspaceView.tsx (lines 115–124, 186–199) does not listen to `fullscreenchange`. It should be updated with the same `fullscreenchange` listener described above so its button state stays correct.

### Module-Specific Rules

**Console main** (index.tsx toolbar):
- Add `[⛶]` icon button far-right in toolbar, always visible when workspace active.
- State tracked by `isFullscreen` boolean + `fullscreenchange` listener.
- Tooltip: "Enter fullscreen" / "Exit fullscreen".

**Console detached** (WorkspaceView.tsx):
- Fix existing button to add `fullscreenchange` listener (same fix as above).

**Process**: No changes needed — already implemented and specced correctly. Does not use `fullscreenchange` listener but that is a pre-existing gap, not in scope of this decision.

### Explicitly Out of Scope

- Dashboards, Forensics, Reports, Log, Rounds, Settings, Alerts, Shifts — no fullscreen buttons needed.
- Combining fullscreen + kiosk as a single button action — they remain independent.
- Changing the kiosk mode implementation as part of this work.
- Adding any new keyboard shortcut beyond the F11 precedence rule above.

## Implementation Notes

- `WorkspaceView.tsx` already has `toggleFullscreen` and `isFullscreen` defined — only the normal (non-detached) render path needs to expose the button. Move the state and listener to a shared place if both paths use them.
- The `fullscreenchange` listener should check `document.fullscreenElement` (not `document.webkitFullscreenElement` — standard API is sufficient per browser support matrix for this project's targets).
- The listener cleanup must be in the `useEffect` return to prevent memory leaks.
- Use the same `toolbarBtnStyle` pattern from Process index.tsx for visual consistency.

## Open Questions

None — all questions resolved.
