---
id: DD-06-032
unit: DD-06
title: G-key navigation incomplete — G+D and G+R are silent no-ops, only G+P works
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

G+letter keyboard navigation is partially functional. G+P correctly navigates to /process, but
G+D and G+R are silent no-ops — the URL stays at /console. The navigation shortcut mapping is
incomplete: only 'p' is mapped, 'd' (designer) and 'r' (reports) are either missing or broken.

The G-key state machine must map ALL module shortcuts:
- P → /process
- D → /designer
- R → /reports
- (and any others defined in the spec)

## Acceptance Criteria

- [ ] Press G then P on /console → URL changes to /process within 500ms ✅ (already works)
- [ ] Press G then D on /console → URL changes to /designer within 500ms
- [ ] Press G then R on /console → URL changes to /reports within 500ms
- [ ] No silent no-ops: if G is pressed and a valid shortcut key is pressed, navigation MUST happen
- [ ] No console errors thrown during G-key navigation sequence

## Verification Checklist

- [ ] Navigate to /console, click body for body focus, press G then D — URL changes to /designer
- [ ] Navigate to /console, click body for body focus, press G then R — URL changes to /reports
- [ ] G+P still works after fix (regression check)
- [ ] Check browser console for unhandled exceptions after each sequence

## Do NOT

- Do not add only the overlay without wiring up the navigation handler
- Do not implement only one new mapping — all module shortcuts must work

## Dev Notes

UAT failure from 2026-03-26: G+P → /process ✅, G+D → /console (no nav) ❌, G+R → /console (no nav) ❌.
Only the 'p' shortcut is wired up. Check the G-key handler's shortcut map — 'd' and 'r' entries
may be missing or mapped to wrong routes.
Screenshots: docs/uat/DD-06/fail-scenario6-gkey-d-nav.png, docs/uat/DD-06/fail-scenario7-gkey-r-nav.png
Spec reference: DD-06-029, DD-06-019, DD-06-024
