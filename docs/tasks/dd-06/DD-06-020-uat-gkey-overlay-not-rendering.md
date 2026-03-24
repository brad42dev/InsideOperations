---
id: DD-06-020
unit: DD-06
title: G-key hint overlay does not render — navigation works but overlay is invisible
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The G-key navigation hint overlay is not rendering when the user presses G. The underlying navigation state machine still works (pressing G then P/R/D correctly navigates to the target module), but the visual "Go to…" overlay that should appear within 100ms of pressing G is completely absent from the DOM.

The task DD-06-019 was created to fix the React Strict Mode ref reset issue that caused G+letter navigation to not execute. The implementation fixed navigation execution but did not restore the overlay rendering. The hint overlay must appear in the DOM within 100ms of pressing G, list module shortcuts with their key letters, and auto-dismiss after 2000ms if no second key is pressed.

UAT evidence: After pressing G on /console, `document.querySelectorAll('[class*="overlay"], [class*="hint"]')` returns empty. `document.body.innerText` does not contain "Go to". The accessibility snapshot shows no new elements after G is pressed.

## Acceptance Criteria

- [ ] Pressing G on /console shows a hint overlay within 100ms containing "Go to" text and module shortcuts (P=Process, R=Reports, D=Designer, etc.)
- [ ] The overlay lists at least the module shortcut key letters with their target module names
- [ ] The overlay dismisses immediately when a valid second key (G+P, G+R, G+D, etc.) is pressed and navigation executes
- [ ] The overlay auto-dismisses after 2000ms if no second key is pressed, without navigating anywhere
- [ ] Navigation continues to work: G+P→/process, G+R→/reports, G+D→/designer all within 500ms

## Verification Checklist

- [ ] Navigate to /console, press G — hint overlay with "Go to…" text appears on screen within 100ms
- [ ] Overlay contains at least P (Process), R (Reports), D (Designer) shortcuts
- [ ] Press G then wait 2.5s — overlay auto-dismisses, URL stays at /console
- [ ] Press G then P — overlay dismisses AND URL changes to /process
- [ ] `document.querySelectorAll('[class*="hint"], [class*="overlay"]')` returns elements after G press

## Do NOT

- Do not stub the overlay with a TODO comment
- Do not break the navigation execution that currently works (G+P/R/D are functional)
- Do not use isTrusted checks that block Playwright synthetic events — the overlay must render for all keyboard events that trigger navigation

## Dev Notes

UAT failure from 2026-03-24: Pressing G produces no visible overlay. Navigation works (G+P→/process, G+R→/reports, G+D→/designer all succeed), confirming the keydown handler fires. The overlay render path is broken — likely the component that should mount on G-key state change is not rendering, possibly due to the React Strict Mode ref reset fix in DD-06-019 removing the overlay mount trigger.

Spec reference: DD-06-019 (G-key navigation fix), DD-06-003 (original G-key overlay spec), DD-06-015 (G-key hint overlay not showing UAT finding)
