---
id: DD-32-019
unit: DD-32
title: F8 key does not open Notifications history panel or drawer
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

The DD-32-010 spec and DD-32-014 spec require that the Notifications region (accessible via F8) shows toast history — the user presses F8 and a panel/drawer opens showing recent notifications including past toasts. 

UAT confirmed: pressing F8 while on /console puts the `region "Notifications (F8)"` list into an `[active]` state (keyboard focus lands there) but no visible panel or drawer expands. There is no way for the user to review toast history — once a toast auto-dismisses, it is gone with no way to review it.

## Acceptance Criteria

- [ ] Pressing F8 on any page with the Notifications region opens a visible history panel or drawer
- [ ] The panel shows recent toast notifications (at minimum the last N toasts that have fired)
- [ ] The panel can be dismissed (Escape, clicking outside, or a close button)
- [ ] The F8 keyboard shortcut is indicated in the UI (the region is already labelled "Notifications (F8)" — verify this label is visible)

## Verification Checklist

- [ ] Navigate to /console, trigger a toast (e.g., create a workspace), let it dismiss, press F8 — notification history panel opens showing the past toast
- [ ] Panel is visually distinct (drawer, popover, or side panel — not just focus on the invisible notification list)
- [ ] Press Escape — panel closes
- [ ] Empty state: press F8 when no toasts have fired → panel opens with "No notifications" or similar empty state

## Do NOT

- Do not just move keyboard focus to the notification list container — that is what currently happens and is not sufficient
- Do not implement only the happy path — test that the panel opens even when the notifications list is empty

## Dev Notes

UAT failure from 2026-03-25: Pressed F8 on /console. The accessibility snapshot changed from `region "Notifications (F8)": list` to `region "Notifications (F8)": list [active]` — indicating keyboard focus moved to the list element. No new DOM nodes appeared, no panel/drawer was rendered, no visual change was observable in the screenshot. The feature exists as a keyboard shortcut label but has no panel implementation behind it.
Spec reference: DD-32-010, DD-32-014 (Notifications region accessible via F8 must show toast history)
