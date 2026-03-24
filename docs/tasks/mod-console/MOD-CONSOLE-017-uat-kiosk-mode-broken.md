---
id: MOD-CONSOLE-017
unit: MOD-CONSOLE
title: Console kiosk mode URL parameter (?kiosk=true) not activating kiosk UI
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Navigating to /console?kiosk=true does not activate kiosk mode. The navigation bar and UI chrome remain visible instead of being hidden for full-screen display mode. The ?kiosk=true URL parameter is not being read or acted upon by the console module.

## Acceptance Criteria

- [ ] Navigating to /console?kiosk=true activates kiosk mode
- [ ] In kiosk mode, the top navigation bar is hidden
- [ ] In kiosk mode, the sidebar/left nav is hidden
- [ ] Content fills the full viewport in kiosk mode

## Verification Checklist

- [ ] Navigate to /console?kiosk=true → navigation bar hidden
- [ ] Navigate to /console?kiosk=true → left nav panel hidden
- [ ] Navigate to /console (no param) → normal UI with navigation visible
- [ ] URL parameter is read on mount, not just initial load

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only visual hiding — the kiosk state should be derived from URL params

## Dev Notes

UAT failure from 2026-03-24: /console?kiosk=true loads normally with all navigation visible. Kiosk mode is not implemented or the URL parameter is not being read by the console module.
Spec reference: MOD-CONSOLE-011 (kiosk mode via URL parameter)
