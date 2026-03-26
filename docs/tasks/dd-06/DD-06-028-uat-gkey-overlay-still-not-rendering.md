---
id: DD-06-028
unit: DD-06
title: G-key hint overlay still not rendering after G press
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The G-key hint overlay does not appear in the DOM when G is pressed on /console. This was supposed to be fixed by DD-06-023 but the fix did not hold — pressing G produces no visible overlay and `document.querySelectorAll('[class*="hint"], [class*="overlay"]')` returns 0 elements.

The overlay must appear within 100ms of pressing G and must contain module shortcut entries (P for Process, R for Reports, D for Designer, etc.). It must auto-dismiss after 2000ms if no second key is pressed.

## Acceptance Criteria

- [ ] Pressing G on /console from body focus shows a visible hint overlay within 100ms
- [ ] Overlay contains module shortcut entries: P (Process), R (Reports), D (Designer) at minimum
- [ ] Overlay text includes "Go to" or equivalent prompt
- [ ] `document.querySelectorAll('[class*="hint"], [class*="overlay"]')` returns ≥ 1 element after G press
- [ ] Overlay auto-dismisses after 2000ms if no second key is pressed
- [ ] Page URL remains /console after auto-dismiss

## Verification Checklist

- [ ] Navigate to /console, click body for body focus, press G — overlay appears on screen
- [ ] DOM query for hint/overlay class returns elements after G press
- [ ] Overlay contains at least P, R, D shortcut entries
- [ ] Press G, wait 2.5s — overlay disappears, URL stays at /console
- [ ] No console errors during the G key sequence

## Do NOT

- Do not stub this — the overlay must actually render in the DOM
- Do not use display:none to "hide" the overlay while still mounting it — it must be visually present

## Dev Notes

UAT failure from 2026-03-26: querySelectorAll('[class*="hint"], [class*="overlay"]') returned 0 elements after pressing G. The G-key handler appears to be registered (no crash) but the overlay state mutation or rendering is broken. This may be a React state update not triggering a re-render, or the overlay component being unmounted before it can render.
Spec reference: DD-06-023, DD-06-019 (prior G-key fix attempts)
