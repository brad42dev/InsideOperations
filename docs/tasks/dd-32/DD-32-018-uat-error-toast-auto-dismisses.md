---
id: DD-32-018
unit: DD-32
title: Error toasts auto-dismiss instead of persisting until manually dismissed
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

Error variant toasts are auto-dismissing after approximately 5-6 seconds, the same as info/success/warning toasts. Per the DD-32-007 spec, error toasts must be persistent — they must remain visible until the user explicitly clicks the dismiss (×) button. No setTimeout should fire for error variant toasts.

UAT confirmed: a "Failed to create workspace" error toast appeared, and after 6 seconds the Notifications region was empty — the toast had auto-dismissed without user interaction.

## Acceptance Criteria

- [ ] Error variant toasts do NOT auto-dismiss — they stay visible until the user clicks the dismiss (×) button
- [ ] No setTimeout or timer is attached to the error toast dismiss lifecycle
- [ ] Info, success, and warning variant toasts continue to auto-dismiss after ~5 seconds (no regression)
- [ ] After manually clicking dismiss (×) on an error toast, it disappears immediately

## Verification Checklist

- [ ] Trigger an error toast (e.g., by causing workspace creation to fail via a network condition or API error)
- [ ] Wait 10 seconds — error toast must still be visible in the Notifications region
- [ ] Click the dismiss (×) button — toast must disappear immediately
- [ ] Trigger a success toast — confirm it auto-dismisses after ~5 seconds (regression check)

## Do NOT

- Do not remove the dismiss button from error toasts
- Do not disable auto-dismiss for ALL toast variants — only error should be persistent
- Do not implement only the happy path — test that error toasts stay visible after the default auto-dismiss window

## Dev Notes

UAT failure from 2026-03-25: Error toast "Failed to create workspace / Workspace UUID not found" appeared in Notifications region with a dismiss (×) button. After waiting 6 seconds (browser_wait_for time=6), the Notifications list was empty — the error toast had auto-dismissed. Spec DD-32-007 explicitly requires error toasts to not auto-dismiss.
Spec reference: DD-32-007 (error variant toast should not fire setTimeout for auto-dismiss)
