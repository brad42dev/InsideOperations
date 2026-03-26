---
id: DD-18-011
unit: DD-18
title: Archive settings Save button success toast not verified (browser_error during UAT)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-18/CURRENT.md
---

## What to Build

During UAT of DD-18 on 2026-03-25, the browser became unresponsive before Scenario 7 (Save form shows success indicator) could be executed. The "Save Settings" button is present on the /settings/archive page (confirmed in prior snapshot), but clicking it and verifying a success toast/indicator was never tested.

The specific concern: does clicking "Save Settings" on /settings/archive trigger PUT /api/archive/settings and display a success indicator (toast, message, or similar)? The form loads correctly from GET /api/archive/settings, but the save path is unconfirmed.

This needs re-verification in a clean UAT run:
1. Navigate to /settings/archive
2. Click "Save Settings"
3. Confirm a success indicator appears (no error, no silent no-op)

## Acceptance Criteria

- [ ] Clicking "Save Settings" on /settings/archive calls PUT /api/archive/settings
- [ ] A success indicator (toast, alert, or confirmation message) is shown after save
- [ ] No error message appears on successful save
- [ ] The button is not a silent no-op

## Verification Checklist

- [ ] Navigate to /settings/archive — form visible
- [ ] Click "Save Settings" — observe that something visible changes (toast, message, etc.)
- [ ] No silent no-op: state changes after click

## Do NOT

- Do not stub the save handler with a TODO comment
- Do not silently discard the PUT response without showing feedback

## Dev Notes

UAT failure from 2026-03-25: browser_error — browser became unresponsive before Save button could be clicked. The button was visible at ref=e229 in the accessibility snapshot. Prior snapshot confirmed form loads with real API values. The save path (PUT /api/archive/settings + success toast) remains untested.
Spec reference: DD-18-007, DD-18-008, DD-18-009, DD-18-010
