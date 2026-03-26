---
id: DD-06-024
unit: DD-06
title: G-key navigation broken — G+P and G+D do not navigate
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

G-key two-key navigation is not functioning. After pressing G then P from /console with body focus, the URL remains at /console (expected: /process). Same for G then D (expected: /designer). The keyboard handler either fails to register the G keystroke, fails to enter the "awaiting second key" state, or fails to execute the navigation.

Note: DD-06-019 addressed a React Strict Mode ref reset that broke G-key navigation. Despite being marked verified, navigation still does not work in the browser.

## Acceptance Criteria

- [ ] Pressing G then P on /console navigates to /process within 500ms
- [ ] Pressing G then D on /console navigates to /designer within 500ms
- [ ] Pressing G then R on /console navigates to /reports within 500ms
- [ ] G-key state machine enters "awaiting second key" mode after G press (gKeyActive state = true)
- [ ] No console errors thrown during G-key navigation sequence

## Verification Checklist

- [ ] Navigate to /console, click body for body focus, press G then P — URL changes to /process
- [ ] Navigate to /console, click body for body focus, press G then D — URL changes to /designer
- [ ] Check browser console for unhandled exceptions after G+P sequence
- [ ] Confirm the keyboard event listener is registered on document (not on a React ref that may be null in Strict Mode)

## Do NOT

- Do not use a React ref as the sole attachment point for the keyboard listener — refs can be null in Strict Mode double-invoke
- Do not require overlay rendering for navigation to function — navigation must work independently

## Dev Notes

UAT failure from 2026-03-25: G+P left URL at /console. G+D left URL at /console. Prior fix in DD-06-019 (Strict Mode ref reset) did not resolve the issue in the running browser.
Spec reference: DD-06-019, DD-06-003, DD-06-020
