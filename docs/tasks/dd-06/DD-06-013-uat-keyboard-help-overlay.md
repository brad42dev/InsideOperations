---
id: DD-06-013
unit: DD-06
title: Keyboard shortcut help overlay (? key) not displayed
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The keyboard shortcut help overlay triggered by pressing `?` is not appearing. When a user presses the `?` key on any app page (with no text input focused), a small overlay panel should appear listing all keyboard shortcuts including sidebar shortcuts (Ctrl+\, Ctrl+Shift+\), kiosk mode (Ctrl+Shift+K), navigation (G+letter), and any other registered bindings.

UAT test: pressed `?` key on /console page with no input focused — no overlay appeared at all.

## Acceptance Criteria

- [ ] Pressing `?` with no text input focused opens a keyboard shortcut help overlay/dialog
- [ ] Overlay lists sidebar shortcuts: Ctrl+\ (toggle expanded/collapsed) and Ctrl+Shift+\ (toggle hidden)
- [ ] Overlay lists kiosk shortcut: Ctrl+Shift+K
- [ ] Overlay lists navigation shortcut: G then letter
- [ ] Overlay can be dismissed with Escape or a close button
- [ ] Overlay does not open when a text input or textarea is focused

## Verification Checklist

- [ ] Navigate to /console, press `?` key — help overlay appears
- [ ] Overlay contains entries for Ctrl+\ and Ctrl+Shift+\ sidebar shortcuts
- [ ] Press Escape to dismiss — overlay closes
- [ ] Click inside a text input, press `?` — no overlay appears (input receives the character instead)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not show a blank or empty overlay — all registered shortcuts must be listed

## Dev Notes

UAT failure 2026-03-23: pressed `?` key on /console, no overlay appeared, page state unchanged.
Spec reference: DD-06-001 (keyboard shortcuts task)
