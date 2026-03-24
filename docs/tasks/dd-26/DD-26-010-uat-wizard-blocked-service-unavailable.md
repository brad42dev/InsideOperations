---
id: DD-26-010
unit: DD-26
title: Recognition wizard entirely blocked when service unavailable — wizard must open showing service status
status: pending
priority: high
depends-on: ["DD-26-009"]
source: uat
uat_session: docs/uat/DD-26/CURRENT.md
---

## What to Build

When the recognition service is unavailable, the "Recognize Image" button in the Designer becomes a non-interactive `generic` element that does nothing when clicked. This completely blocks access to the recognition import wizard.

The correct behavior (per the acceptance criteria in DD-26-009, which remains unimplemented) is:
- "Recognize Image" must always be rendered as `role="button"` (a clickable button)
- Clicking it must always open the recognition import wizard dialog (`[role="dialog"]`)
- When the service is unavailable, the wizard should open and display a human-readable status message (e.g., "Recognition service is currently unavailable. Please contact your administrator.")
- The wizard must have a close/cancel button that dismisses it

Observed in UAT: The button has a tooltip "Recognition service is unavailable. The service may not be running. Contact your administrator." and is rendered as a non-interactive `generic` — clicking it produces absolutely no UI change.

## Acceptance Criteria

- [ ] "Recognize Image" is rendered as `role="button"` (clickable) regardless of recognition service status
- [ ] Clicking "Recognize Image" always opens a wizard dialog ([role="dialog"])
- [ ] When service is unavailable, wizard opens and shows a readable service status message
- [ ] Wizard has a close/cancel button that dismisses the dialog
- [ ] No silent no-op: clicking the button always produces a visible UI change

## Verification Checklist

- [ ] Navigate to /designer → "Recognize Image" button is present as role="button" (not generic)
- [ ] Click "Recognize Image" → wizard dialog [role="dialog"] opens
- [ ] If recognition service is unavailable, wizard shows a user-readable message about service status
- [ ] Close/Cancel button is present in dialog and dismisses it on click
- [ ] After dismissing, page returns to Designer landing state

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not keep the button disabled/non-interactive based on service status — open the wizard and show status there
- Do not silently swallow the service-unavailable state

## Dev Notes

UAT failure 2026-03-24: Clicking "Recognize Image" element (rendered as generic, not button) does nothing. No dialog appears. Element tooltip: "Recognition service is unavailable. The service may not be running. Contact your administrator." Screenshot: docs/uat/DD-26/fail-scenario3-no-dialog.png
Spec reference: DD-26-007 (recognition import wizard), DD-26-009 (prior UAT bug for same root cause — still pending)
UAT scenarios failed: 3 (no dialog), 4 (no upload area), 5 (no close button), 6 (cannot dismiss)
