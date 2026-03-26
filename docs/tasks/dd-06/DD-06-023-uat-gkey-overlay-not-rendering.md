---
id: DD-06-023
unit: DD-06
title: G-key hint overlay not rendering after G press
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The G-key navigation hint overlay is not rendering when the user presses G from /console with body focus. Both DD-06-003 (add overlay) and DD-06-020 (fix invisible overlay) were verified as implemented, but the overlay still does not appear in the browser.

DOM query after G press: `document.querySelectorAll('[class*="hint"], [class*="overlay"], [class*="gkey"], [class*="g-key"], [class*="nav-hint"]')` returns 0 elements. The accessibility tree shows no new elements after G press. Visual screenshot confirms blank console page with no overlay.

The overlay must appear visibly in the DOM within 100ms of pressing G when no text input is focused.

## Acceptance Criteria

- [ ] Pressing G on /console from body focus shows a visible hint overlay within 100ms
- [ ] Overlay contains module shortcut entries including P (Process), R (Reports), D (Designer)
- [ ] Overlay text includes "Go to" or equivalent prompt
- [ ] Overlay is present in DOM (DOM query for overlay/hint class returns ≥ 1 element)
- [ ] Overlay auto-dismisses after 2000ms if no second key pressed

## Verification Checklist

- [ ] Navigate to /console, click body to ensure body focus, press G — overlay appears on screen within 100ms
- [ ] `document.querySelectorAll('[class*="hint"], [class*="overlay"]')` returns elements after G press
- [ ] Overlay contains at least P, R, D shortcut entries
- [ ] Press G, wait 2.5s — overlay disappears, URL stays at /console

## Do NOT

- Do not stub this with a TODO comment
- Do not render overlay off-screen or with opacity: 0 / visibility: hidden
- Do not gate overlay on WebSocket connection state

## Dev Notes

UAT failure from 2026-03-25: G press produced no DOM changes. Two prior tasks (DD-06-003, DD-06-020) were marked verified but overlay still not visible in browser.
Spec reference: DD-06-003, DD-06-020
