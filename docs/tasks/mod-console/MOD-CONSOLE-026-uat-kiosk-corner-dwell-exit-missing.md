---
id: MOD-CONSOLE-026
unit: MOD-CONSOLE
title: Kiosk mode corner dwell exit trigger not implemented
status: pending
priority: low
depends-on: []
source: uat
uat_session: docs/uat/MOD-CONSOLE/CURRENT.md
---

## What to Build

Kiosk mode (activated via `?kiosk=true`) must support a corner dwell exit trigger: when the user hovers the mouse in any of the 4 screen corners for 1.5 seconds, a small semi-transparent "Exit Kiosk" button appears near that corner. Clicking it exits kiosk mode. The button disappears when the mouse leaves the corner area.

Currently, the only exit method is the Escape key. The corner dwell trigger is not implemented.

The spec (SPEC_MANIFEST.md, CX-KIOSK non-negotiable #3) requires:
> Exiting kiosk mode: `Escape` key or a hoverable corner trigger (mouse dwell 1.5s on corner) reveals a minimal exit button.

## Acceptance Criteria

- [ ] Hovering the mouse in any screen corner for 1.5s reveals an "Exit Kiosk" button/overlay
- [ ] The button is small and semi-transparent (not a large modal)
- [ ] Clicking "Exit Kiosk" exits kiosk mode and restores app chrome
- [ ] Moving the mouse away from the corner before 1.5s cancels the trigger (button does not appear)
- [ ] Escape key continues to work as exit method (already implemented — do not break it)

## Verification Checklist

- [ ] Navigate to /console?kiosk=true
- [ ] Move mouse to top-left corner and hold for 1.5s → "Exit Kiosk" button appears
- [ ] Move mouse away immediately → button does not appear
- [ ] Click "Exit Kiosk" → app chrome restored
- [ ] Test all 4 corners (top-left, top-right, bottom-left, bottom-right)

## Do NOT

- Do not remove the Escape key exit — it works and must stay
- Do not use a large modal or full-screen overlay — it must be a small corner button

## Dev Notes

UAT failure from 2026-03-25: In kiosk mode, hovering mouse to corner position (clientX=0, clientY=0) + waiting 2s produced no "Exit Kiosk" element in the DOM. No element with data-testid containing "kiosk" or class containing "kiosk-exit" or "corner" found.
Screenshot: docs/uat/MOD-CONSOLE/scenario12-kiosk-no-corner-dwell.png
Spec reference: MOD-CONSOLE-011
