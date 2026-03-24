---
id: DD-26-009
unit: DD-26
title: Recognize Image click does nothing — wizard blocked when recognition service unavailable
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-26/CURRENT.md
---

## What to Build

The "Recognize Image" button on the Designer landing page is visible but non-interactive. When the recognition service is unavailable (i.e., `/api/recognition/status` returns 404), the button is rendered as a disabled `generic` element rather than a clickable `button`. Clicking it produces no response — no wizard dialog opens, no error message, nothing.

The expected behavior is that clicking "Recognize Image" always opens the recognition import wizard, even when the recognition service is currently unavailable. The wizard itself should gracefully handle the unavailable service state (e.g., show an error message in the first step, "Recognition service is unavailable — please contact your administrator"), rather than silently blocking the button.

UAT observed: The button tooltip reads "Recognition service is unavailable. The service may not be running. Contact your administrator." and the element is rendered as a `generic` (not `button`), making it completely non-interactive.

## Acceptance Criteria

- [ ] Clicking "Recognize Image" always opens the recognition import wizard dialog regardless of recognition service status
- [ ] When the service is unavailable, the wizard opens and shows an appropriate error/status message (e.g., "Recognition service is currently unavailable")
- [ ] The wizard has a close/cancel button and can be dismissed
- [ ] The element is rendered as a clickable button (role="button"), not a non-interactive generic element

## Verification Checklist

- [ ] Navigate to /designer → "Recognize Image" button is present
- [ ] Click "Recognize Image" → a wizard dialog (role="dialog") opens
- [ ] If service is unavailable, wizard shows a user-readable message about the service status
- [ ] Close button (X) or Cancel button is present and dismisses the wizard
- [ ] No silent no-op: clicking the button always produces visible UI change

## Do NOT

- Do not hide or disable the wizard entry point when the backend service is unavailable — always let the user open the wizard
- Do not stub with a TODO comment — the feature must actually work
- Do not silently fail — if the service is down, show a helpful message inside the wizard

## Dev Notes

UAT failure from 2026-03-24: Clicking "Recognize Image" (ref=e160) produced no response. Element was rendered as non-interactive `generic` with title attribute "Recognition service is unavailable...". Console showed /api/recognition/status returning 404.
Screenshot: docs/uat/DD-26/scenario4-fail-recognize-image-no-wizard.png
Spec reference: DD-26-007 (recognition wizard implementation), DD-26-008 (button visibility fix)
