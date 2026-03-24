---
id: DD-06-019
unit: DD-06
title: G-key navigation broken with trusted keyboard events — React Strict Mode ref reset
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

G+letter navigation does not work when users press keyboard keys in the browser.
After pressing G, the hint overlay does not appear, and pressing a second letter does
not navigate to the corresponding module.

Root cause confirmed via UAT (2026-03-24):
- With trusted keyboard events (real browser input / Playwright): G keydown fires the
  AppShell handler (`e.preventDefault()` is called = handler ran), but `setGKeyHintVisible(true)`
  has no DOM effect and `gKeyPending.current` is `false` when the second key fires.
- With JS-dispatched untrusted events: G+letter works correctly (G+P→/process in ~56ms).
- React 18 Strict Mode in development causes AppShell to remount after the G key state
  update, resetting the `gKeyPending` useRef to `false` before the second key fires. The
  `setGKeyHintVisible` setter is orphaned on the unmounted component instance (React 18
  silently ignores setState on unmounted components).

The fix must ensure `gKeyPending` state survives React Strict Mode's double-mount cycle
and that `setGKeyHintVisible` is always called on the live component instance.

## Acceptance Criteria

- [ ] Pressing G on /console then P navigates to /process within 500ms
- [ ] Pressing G on /console then R navigates to /reports within 500ms
- [ ] Pressing G on /console then D navigates to /designer within 500ms
- [ ] The G-key hint overlay appears in the DOM within 100ms of pressing G
- [ ] The hint overlay lists module shortcuts with correct key letters
- [ ] The hint overlay dismisses immediately when a valid second key is pressed
- [ ] The hint overlay auto-dismisses after 2000ms if no second key is pressed

## Verification Checklist

- [ ] Navigate to /console, press G — hint overlay appears with "Go to…" + module shortcuts
- [ ] Immediately press P — URL changes to /process, overlay dismissed
- [ ] Navigate to /console, press G, immediately press R — URL changes to /reports
- [ ] Navigate to /console, press G, wait 2.5 seconds — overlay auto-dismisses, URL unchanged
- [ ] No console errors during any key sequence

## Suggested Fix Approaches

Option A: Move `gKeyPending` to a module-level `ref` outside the React component
(e.g., `const gKeyPendingGlobal = { current: false }`) so it is not reset on remount.

Option B: Use `useRef` but store the pending state in a `WeakRef` or module variable
that persists across React Strict Mode remounts.

Option C: Register the keyboard listener outside the `useEffect` (at module init time)
and communicate with the component via a stable channel (custom event or module variable).

Option D: Use React's `useCallback` with proper deps to keep a stable handler that
references the latest state via closures, and use a `useRef` for the gKeyPending state
that is explicitly NOT reset by Strict Mode (this is the intended behavior of `useRef`,
but Strict Mode's remount resets it). The real fix is to persist state across remounts.

## Do NOT

- Do not stub this with a TODO comment
- Do not only test with JS-dispatched untrusted events — must work with trusted keyboard input
- Do not remove React.StrictMode from main.tsx as a workaround

## Dev Notes

UAT failure from 2026-03-24: G key hint overlay never appeared in DOM after trusted
keyboard press. MutationObserver showed overlay appears only with untrusted events (56ms
appear → dismiss cycle when G+P dispatched via JS). Playwright bubble spy confirmed:
G press `prevented:true` (handler ran) but P press `prevented:false` (gKeyPending reset).
Spec reference: DD-06-003 (hint overlay), DD-06-015, DD-06-018
