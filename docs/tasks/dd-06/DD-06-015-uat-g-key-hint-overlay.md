---
id: DD-06-015
unit: DD-06
title: G-key navigation hint overlay not showing when G is pressed
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The G-key navigation hint overlay is not appearing. Per spec (DD-06-003), pressing the G key (with no text input focused) should trigger a small fixed panel near the sidebar that lists all 11 module shortcuts with their key letter and module name (e.g., "G then C → Console", "G then P → Process", etc.). This overlay should auto-dismiss after 2 seconds, dismiss on the second key press (which navigates), or dismiss on Escape.

UAT test: pressed G key on /console page with no input focused — no overlay appeared.

## Acceptance Criteria

- [ ] Pressing G key (no input focused) shows a small overlay panel near the sidebar
- [ ] Overlay lists all 11 module shortcuts with key letter + module name
- [ ] Overlay disappears after 2 seconds automatically
- [ ] Pressing Escape dismisses overlay without navigating
- [ ] Pressing the second key (e.g., C for Console) dismisses overlay AND navigates to that module
- [ ] Overlay does not appear when a text input or textarea is focused

## Verification Checklist

- [ ] Navigate to /console, press G — small hint panel appears near sidebar with module shortcuts
- [ ] Panel shows at minimum: C→Console, P→Process, D→Dashboards
- [ ] Wait 2 seconds — panel auto-dismisses
- [ ] Press G again, then Escape — panel dismisses, no navigation
- [ ] Click a text input, press G — no panel appears (input receives character)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not skip the auto-dismiss timeout — 2 seconds is required by spec

## Dev Notes

UAT failure 2026-03-23: pressed G key on /console with no input focused. No hint overlay appeared. Page state unchanged.
Spec reference: DD-06-003 — "Add visual hint overlay for G-key navigation"
