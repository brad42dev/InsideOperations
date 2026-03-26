---
id: CX-KIOSK-FULLSCREEN
title: Kiosk mode — browser fullscreen entry and exit behavior
status: decided
contract: CX-KIOSK
decided: 2026-03-26
---

## What Was Decided

All kiosk entry methods uniformly enter browser fullscreen. Because browsers
require a user gesture to call `requestFullscreen()`, URL-param and
programmatic entry (where no gesture may be present) shows a minimal
"Enter fullscreen?" prompt that the user clicks to confirm. Keyboard
shortcut entry (Ctrl+Shift+K) may call `requestFullscreen()` directly
since a keypress counts as a user gesture. Exit kiosk always exits
browser fullscreen first. The two-step Escape sequence (first press exits
fullscreen, second exits kiosk) from design doc 06 is retained.

Note: the existing decision file `cx-console-workspace-fullscreen.md`
documents the *independent* console toolbar fullscreen button.
That is separate from kiosk — the fullscreen button does not enter kiosk,
and kiosk fullscreen is not the toolbar button. They can coexist.

---

## Questions and Answers

**Q1**: Should all kiosk entry methods (URL param, UI button, Ctrl+Shift+K)
enter browser fullscreen, or only some?
**A**: All methods should behave uniformly — they all enter fullscreen.

**Q2**: URL-param and UI-button entry may not have a valid user gesture,
causing `requestFullscreen()` to be rejected by the browser. How do we handle
this?
**A**: Show a small non-blocking prompt (e.g. a persistent banner or toast with
an "Enter fullscreen" button) that the user clicks. The click provides the
required gesture and calls `requestFullscreen()`. The prompt dismisses once
fullscreen is active or the user explicitly closes it.

**Q3**: On exit, should `exitKiosk()` call `document.exitFullscreen()` only if
`document.fullscreenElement` is non-null, or always?
**A**: Guard with `document.fullscreenElement` — only call `exitFullscreen()`
if the browser is actually in fullscreen. This avoids a harmless but noisy
DOMException when kiosk was entered but fullscreen was never granted.

**Q4**: Does the Escape key two-step sequence from doc 06 still apply?
**A**: Yes. If in fullscreen: first Escape exits fullscreen (calls
`document.exitFullscreen()`), second Escape exits kiosk. If not in fullscreen,
single Escape exits kiosk.

**Q5**: What happens in a locked kiosk when the user tries to exit?
**A**: Locked kiosk already requires authentication (PIN/password) before the
"Exit Kiosk" option appears (see `visual-lock-overhaul.md`). This is
unchanged. Browser fullscreen is exited as part of the same exit flow, after
authentication succeeds.

---

## Resulting Specification

### Entering Fullscreen on Kiosk Entry

1. **Keyboard shortcut (Ctrl+Shift+K)** — call
   `document.documentElement.requestFullscreen().catch(() => setNeedsFullscreenPrompt(true))`.
   If the call fails (rejected by browser), fall back to showing the fullscreen
   prompt (see below).

2. **UI button ("Enter Kiosk Mode" from user menu) and URL param (`?kiosk=true`
   / `?mode=kiosk`)** — cannot guarantee a user gesture is active at the moment
   kiosk code runs. Attempt `requestFullscreen()` and, if rejected or the
   document is already waiting for a gesture, show the fullscreen prompt.

3. **Fullscreen prompt** — a small, non-dismissable (until resolved) banner
   rendered inside the kiosk content area:
   > "For the best experience, click to enter fullscreen."  [Enter fullscreen] [Skip]
   - "Enter fullscreen" button calls `document.documentElement.requestFullscreen()`.
     On success, the prompt dismisses automatically via `fullscreenchange`.
   - "Skip" closes the prompt; kiosk remains active without browser fullscreen.
   - The prompt must not block module content — render it as an overlay ribbon
     at the top of the content area (below topbar, which is hidden).

### Exiting Fullscreen on Kiosk Exit

4. In `exitKiosk()`:
   ```ts
   if (document.fullscreenElement) {
     await document.exitFullscreen().catch(() => undefined)
   }
   ```
   Call this before (or concurrently with) restoring sidebar/topbar state.

### Escape Key Sequence

5. When `isKiosk` is true and the screen is not locked:
   - If `document.fullscreenElement` is non-null: first Escape calls
     `document.exitFullscreen()` (kiosk remains active, chrome still hidden).
   - If `document.fullscreenElement` is null: Escape calls `exitKiosk()`.
   - This means two Escape presses are required to fully exit when in fullscreen
     kiosk. One press to drop fullscreen, one to restore app chrome.

### State Tracking

6. Add a `fullscreenchange` event listener in AppShell. Maintain a boolean
   `isBrowserFullscreen` synced to `!!document.fullscreenElement`. This:
   - Drives the Escape two-step logic (see above).
   - Dismisses the fullscreen prompt automatically when fullscreen activates.
   - Detects when the user exits fullscreen via browser-native controls
     (physical Escape in non-kiosk fullscreen, browser's own exit button) so
     kiosk can remain active even if fullscreen was exited independently.
   Clean up the listener on unmount.

### Independence from Console Toolbar Fullscreen Button

7. The console workspace toolbar fullscreen button (`cx-console-workspace-fullscreen.md`)
   is a separate, independent control. It does not enter or exit kiosk.
   Kiosk fullscreen does not change the toolbar button's state (both track
   `document.fullscreenElement` via `fullscreenchange`, so they stay in sync
   as a side effect — no extra wiring needed).

---

## Implementation Notes

- `enterKiosk()` is in `AppShell.tsx`. Add `requestFullscreen()` call
  immediately after the sidebar/topbar state changes. Show prompt on `.catch()`.
- `exitKiosk()` is in the same file. Add the `exitFullscreen()` guard before
  restoring state.
- The Escape handler is in the keyboard `useEffect` in AppShell. Add a check
  for `isBrowserFullscreen` (tracked via `fullscreenchange`) before deciding
  between exit-fullscreen and exit-kiosk.
- The fullscreen prompt can be a simple `<div>` positioned fixed at top of
  viewport — not a modal, does not intercept content interaction.
- `fullscreenchange` fires on both entry and exit — use it to drive all
  `isBrowserFullscreen` state. Do not poll.

## Open Questions

None — all questions resolved.
