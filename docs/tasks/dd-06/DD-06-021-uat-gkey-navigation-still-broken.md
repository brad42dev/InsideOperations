---
id: DD-06-021
unit: DD-06
title: G+letter navigation still broken — overlay appears but second key does not navigate
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

G-key navigation is still broken despite previous fix attempts (DD-06-018 fix and DD-06-019 Strict Mode fix). The G-key hint overlay renders correctly — pressing G shows the "Go to…" overlay with all 11 module shortcuts. However, pressing the second key (P, R, D, etc.) does NOT navigate. The URL stays at /console after the full G+letter sequence.

Observed in UAT 2026-03-25:
- Press G → overlay appears with "Go to…" and module shortcuts ✅
- Press P (Process shortcut) → URL stays at /console, no navigation ❌
- Same failure for R (Reports), D (Designer), and inferred for all other shortcuts

The overlay dismisses after pressing the second key (no longer visible), suggesting the keydown event IS being received, but the navigation callback is not executing.

## Acceptance Criteria

- [ ] Press G on /console, then P → URL changes to /process within 500ms
- [ ] Press G on /console, then R → URL changes to /reports within 500ms
- [ ] Press G on /console, then D → URL changes to /designer within 500ms
- [ ] The hint overlay dismisses when a valid second key navigates
- [ ] No silent no-op: if G is pressed and a valid shortcut key is pressed, navigation MUST happen

## Verification Checklist

- [ ] Navigate to /console, press G — overlay appears
- [ ] Press P — URL changes to /process and overlay dismisses
- [ ] Navigate to /console, press G — overlay appears
- [ ] Press R — URL changes to /reports and overlay dismisses
- [ ] Navigate to /console, press G — overlay appears
- [ ] Press D — URL changes to /designer and overlay dismisses
- [ ] No console errors during any key sequence

## Do NOT

- Do not stub this with a TODO — the overlay appears but navigation silently fails
- Do not just check that the event handler fires — verify actual URL change

## Dev Notes

UAT failure from 2026-03-25: G+P, G+R, G+D all failed to navigate. URL remained at /console.
The overlay dismissed on second key press (event received) but navigation callback did not fire.
Prior fix attempts: DD-06-018 (original report), DD-06-019 (React Strict Mode ref reset fix).
Spec reference: DD-06-018, DD-06-019
