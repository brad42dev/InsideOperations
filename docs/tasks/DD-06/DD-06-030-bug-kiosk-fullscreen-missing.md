---
id: DD-06-030
unit: DD-06
title: Kiosk mode does not enter browser fullscreen
status: pending
priority: medium
depends-on: []
source: bug
bug_report: Kiosk mode does not enter fullscreen
---

## What's Broken

`enterKiosk()` in `frontend/src/shared/layout/AppShell.tsx` (line 649) hides
the sidebar and topbar but never calls `document.documentElement.requestFullscreen()`.
`exitKiosk()` (line 662) similarly never calls `document.exitFullscreen()`.
No `fullscreenchange` listener exists anywhere in AppShell, so the app has no
awareness of whether the browser is in fullscreen mode.

Secondary gap: the Escape key handler (line 856) calls `exitKiosk()` on the
first Escape keypress regardless of fullscreen state. The spec requires a
two-step sequence: first Escape exits fullscreen, second Escape exits kiosk.

## Expected Behavior

Per design-docs/06 §Kiosk and decision file `docs/decisions/cx-kiosk-fullscreen.md`:

1. All kiosk entry methods (URL param, UI button, Ctrl+Shift+K) attempt to
   enter browser fullscreen via `document.documentElement.requestFullscreen()`.
2. If fullscreen is rejected by the browser (no user gesture available),
   a non-blocking prompt appears inside the content area offering an
   "Enter fullscreen" button that the user can click.
3. On kiosk exit, if `document.fullscreenElement` is non-null, call
   `document.exitFullscreen()` before restoring chrome.
4. Escape key: if in fullscreen → first Escape exits fullscreen only; second
   Escape exits kiosk. If not in fullscreen → single Escape exits kiosk.
5. A `fullscreenchange` listener drives a `isBrowserFullscreen` boolean used
   to gate the Escape two-step logic and auto-dismiss the fullscreen prompt.

## Root Cause

`enterKiosk()` was implemented to hide app chrome only. The browser fullscreen
step was never added. No existing kiosk tasks (MOD-CONSOLE-011, MOD-CONSOLE-017,
MOD-CONSOLE-026, DD-06-002, etc.) targeted fullscreen entry — they addressed
URL param naming, corner dwell exit, and chrome visibility only.

## Acceptance Criteria

- [ ] Entering kiosk (all three methods) calls `requestFullscreen()` on
      `document.documentElement`; on success the browser chrome (address bar,
      tabs) is hidden
- [ ] If `requestFullscreen()` is rejected, a non-blocking prompt appears with
      an "Enter fullscreen" button; clicking it succeeds; "Skip" dismisses without
      breaking kiosk
- [ ] Exiting kiosk calls `document.exitFullscreen()` when fullscreen is active;
      browser chrome reappears alongside the app chrome
- [ ] First Escape keypress in fullscreen kiosk exits fullscreen only (chrome
      remains hidden); second Escape exits kiosk fully
- [ ] Single Escape in non-fullscreen kiosk exits kiosk directly (no change
      from current behavior for that path)
- [ ] `fullscreenchange` listener correctly tracks state: entering/exiting via
      browser-native controls (F11, browser exit button) does not break the
      kiosk state machine
- [ ] No regression: Ctrl+Shift+K outside of kiosk still works; corner dwell
      exit still works; locked kiosk still requires auth before exit

## Verification

1. Navigate to any module (e.g. `/console`), press Ctrl+Shift+K — browser
   enters fullscreen (address bar disappears), app chrome hidden
2. Press Escape once — fullscreen exits (browser chrome returns), app chrome
   still hidden (still in kiosk)
3. Press Escape again — kiosk exits, sidebar and topbar restore
4. Navigate to `/console?kiosk=true` — fullscreen prompt appears; click
   "Enter fullscreen" — fullscreen activates
5. In kiosk fullscreen: use browser's native fullscreen exit (F11) — fullscreen
   exits, kiosk remains active, no JS error in console
6. Open user menu → "Enter Kiosk Mode" — fullscreen entered (or prompt shown)

## Spec Reference

- `design-docs/06_FRONTEND_SHELL.md` §Kiosk, lines 541–574
  - Line 549: entry triggers fullscreen
  - Line 569: Escape two-step sequence
  - Line 574: exit clears fullscreen
- Decision file: `docs/decisions/cx-kiosk-fullscreen.md` (all rules canonical)

## Do NOT

- Remove the "Skip" option from the fullscreen prompt — not all deployments
  want forced fullscreen
- Call `requestFullscreen()` and silently swallow errors without showing the
  prompt — the user needs feedback when fullscreen is unavailable
- Gate the Escape two-step on any state other than `document.fullscreenElement`
  — do not use React state for this check (it can be stale)
- Conflate with the Console toolbar fullscreen button (separate control,
  separate task MOD-CONSOLE-039/040 area) — the kiosk fullscreen and the
  toolbar button are independent; both track `fullscreenchange`
