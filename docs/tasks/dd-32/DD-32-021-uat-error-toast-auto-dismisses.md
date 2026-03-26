---
id: DD-32-021
unit: DD-32
title: Error toasts auto-dismiss instead of persisting until manually dismissed
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

Error variant toasts are auto-dismissing after approximately 3 seconds, just like success/info toasts. Per the spec (DD-32-007, DD-32-018), error toasts must stay visible until the user clicks the dismiss (×) button — no auto-dismiss timer should fire for the `error` variant.

Observed behavior: clicking "+" to create a workspace triggers an error toast "Failed to create workspace / Workspace {UUID} not found". This toast has a "×" dismiss button. However, it disappears on its own within ~3 seconds without any user action.

Expected behavior: the error toast must remain visible until the user explicitly clicks "×". Info/success/warning toasts continue to auto-dismiss after ~5s (no regression needed on those).

## Acceptance Criteria

- [ ] Error variant toasts do NOT auto-dismiss — they stay until user clicks "×"
- [ ] No setTimeout or timer is attached to the error toast dismiss lifecycle
- [ ] Info, success, and warning variant toasts continue to auto-dismiss after ~5 seconds (no regression)
- [ ] After clicking "×" on an error toast, it disappears immediately

## Verification Checklist

- [ ] Navigate to /console, click "+" (triggers error toast "Failed to create workspace")
- [ ] Wait 10 seconds — error toast must still be visible in the Notifications region
- [ ] Click "×" dismiss button — toast disappears immediately
- [ ] Trigger a success/info toast — confirm it auto-dismisses after ~5 seconds (regression check)

## Do NOT

- Do not remove auto-dismiss from success/info/warning variants — only error must persist
- Do not change the toast appearance — only the dismissal timer behavior

## Dev Notes

UAT failure from 2026-03-26: Error toast "Failed to create workspace" appeared in `region "Notifications (F8)"` after clicking "+". Next snapshot (taken ~3-5s later after clicking "Done") showed the notification list empty — toast had auto-dismissed without user action.
Spec reference: DD-32-007 (error toast persistence), DD-32-018 (error toast auto-dismiss bug)
Screenshot: dd32-scenario7-error-toast-dismissed.png
