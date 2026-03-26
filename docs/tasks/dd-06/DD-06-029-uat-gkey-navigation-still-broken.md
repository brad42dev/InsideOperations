---
id: DD-06-029
unit: DD-06
title: G-key navigation still broken — G+P, G+D, G+R are silent no-ops
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

G+letter keyboard navigation is completely non-functional. After pressing G then immediately pressing P, D, or R on /console, the URL does not change. This was supposed to be fixed by DD-06-021 and DD-06-024 but navigation still does not work.

The G-key state machine must:
1. Enter "awaiting second key" mode after G press (gKeyActive = true)
2. On second key press (P/D/R/etc.), navigate to the corresponding module route
3. Navigation must complete within 500ms

## Acceptance Criteria

- [ ] Press G then P on /console → URL changes to /process within 500ms
- [ ] Press G then D on /console → URL changes to /designer within 500ms
- [ ] Press G then R on /console → URL changes to /reports within 500ms
- [ ] The overlay (when fixed per DD-06-028) dismisses immediately when a valid second key navigates
- [ ] No silent no-ops: if G is pressed and a valid shortcut key is pressed, navigation MUST happen
- [ ] No console errors thrown during G-key navigation sequence

## Verification Checklist

- [ ] Navigate to /console, click body for body focus, press G then P — URL changes to /process
- [ ] Navigate to /console, click body for body focus, press G then D — URL changes to /designer
- [ ] Navigate to /console, click body for body focus, press G then R — URL changes to /reports
- [ ] Check browser console for unhandled exceptions after each sequence
- [ ] Confirm keyboard event listener is registered on document (not on a React ref that may be null)

## Do NOT

- Do not add only the overlay without wiring up the navigation handler
- Do not rely on a React ref for the keyboard handler — use document-level addEventListener
- Do not implement only G+P — all module shortcuts must work

## Dev Notes

UAT failure from 2026-03-26: Pressed G then P on /console — URL stayed at /console. Same for G+D and G+R. The G key does not crash (DD-06-022 fix held) but the second-key handler is not firing or the navigation call is not executing. The gKeyActive state may not be persisting between keydown events, or the second key listener is not being registered after the first key.
Spec reference: DD-06-021, DD-06-024, DD-06-019 (prior G-key fix attempts)
