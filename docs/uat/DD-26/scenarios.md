# UAT Scenarios — DD-26

## Page Load
Scenario 1: [DD-26-009] Designer page renders without error — navigate to /designer → page loads with no error boundary, no "Something went wrong" text

## Recognition Entry Point
Scenario 2: [DD-26-009] Recognize Image button is visible — navigate to /designer → "Recognize Image" or equivalent recognition entry point is present in toolbar/menu
Scenario 3: [DD-26-009] Recognize Image button has correct role — navigate to /designer, inspect element → rendered as role="button" (clickable), not a non-interactive generic element
Scenario 4: [DD-26-009] Clicking Recognize Image opens wizard dialog — click "Recognize Image" → [role="dialog"] appears (not a silent no-op)

## Wizard Content and Service Status
Scenario 5: [DD-26-009] Wizard shows service status message when unavailable — after wizard opens with recognition service unavailable → dialog contains user-readable message about service status (e.g., "unavailable", "service", "recognition")
Scenario 6: [DD-26-010] Wizard has a close/cancel button — with dialog open → a close (X) or Cancel button is present in the dialog
Scenario 7: [DD-26-010] Close button dismisses wizard — click close/cancel → dialog is dismissed, Designer returns to normal state
Scenario 8: [DD-26-010] Recognize Image always produces visible UI change — click "Recognize Image" → something visible changes in the UI (no silent no-op behavior)
