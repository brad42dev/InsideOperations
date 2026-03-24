# UAT Scenarios — DD-26

## Page Load
Scenario 1: [DD-26-007] Designer page renders without error — navigate to /designer → page loads with no error boundary ("Something went wrong")

## Recognition Entry Point
Scenario 2: [DD-26-007] Recognize Image button visible in Designer — navigate to /designer, look at toolbar/menu → "Recognize Image" or "Import from P&ID" or equivalent button/menu item is present
Scenario 3: [DD-26-007] Clicking Recognize Image opens a dialog — click the recognition entry point → [role="dialog"] appears (wizard dialog opens)

## Wizard Content
Scenario 4: [DD-26-007] Wizard has a file upload area — after opening wizard → a file input or dropzone for uploading an image/.iomodel file is visible
Scenario 5: [DD-26-007] Wizard has a close/cancel button — after opening wizard → a close button (X) or Cancel button is present
Scenario 6: [DD-26-007] Close button dismisses wizard — click close/cancel button → dialog disappears from snapshot
