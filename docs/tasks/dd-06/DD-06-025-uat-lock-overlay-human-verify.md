---
id: DD-06-025
unit: DD-06
title: Lock overlay structure requires human UAT — cannot trigger via auto mode
status: pending
priority: high
depends-on: [DD-06-011]
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

This is not a code task — it is a human UAT verification task.

The LockOverlay feature (DD-06-011) could not be verified in automated UAT because the idle
timeout is 30 minutes and no programmatic trigger (custom events, Zustand store access) was
found to simulate the locked state. The LockOverlay element was not present in the DOM in the
unlocked state, which is correct per spec — it only renders when the session is locked.

A human tester must verify the following behaviors from DD-06-011:

## Acceptance Criteria

- [ ] After 30 minutes of idle (or via a test shortcut if one exists), the session becomes locked
- [ ] Passive locked state: overlay is visually invisible (transparent), but page content interactions are blocked (pointer-events: none on content layer)
- [ ] First click or keypress after passive lock → overlay fades in (300ms) with password or PIN input visible
- [ ] Overlay does NOT show "Click to continue" — it shows a real password/PIN field
- [ ] Correct unlock input (password) unlocks the session — overlay fades out (200ms)
- [ ] After 60 seconds with no input in the overlay → overlay fades out, session remains locked (passive)
- [ ] Next interaction re-triggers the overlay

## Verification Checklist

- [ ] Log in as admin, navigate to /console, wait for idle lock (or trigger via dev tools if shortcut exists)
- [ ] Confirm passive state: page content visible, data still updating, but clicking produces the overlay not normal actions
- [ ] Confirm overlay shows password input field, not click-to-dismiss
- [ ] Enter correct password → overlay disappears, session unlocked
- [ ] Test 60-second auto-dismiss: trigger overlay, do not type, wait 60s → overlay fades
- [ ] Confirm URL remains at /console throughout (no logout redirect)

## Do NOT

- Do not implement new behavior — this task verifies existing DD-06-011 implementation
- Do not close this task without running human mode UAT: `human DD-06`

## Dev Notes

UAT failure from 2026-03-26 (auto mode): LockOverlay not found in DOM during automated test.
Custom events `session.locked`, `io:lock`, `lock` dispatched to document/window — no overlay appeared.
This is expected if the overlay renders conditionally on lock state received via WebSocket/store.
Spec reference: DD-06-011, DD-06-004
Run `human DD-06` to properly verify this scenario.
