# UAT Scenarios — DD-27

## Alerts Module Rendering
Scenario 1: [DD-27-007] Alerts page renders without error — navigate to /alerts → page loads with no error boundary ("Something went wrong"), module content visible
Scenario 2: [DD-27-007] Alert composer accessible — look for a "Create Alert" / "New Alert" / "Compose" button and click it → alert composer dialog or form opens

## Channel Adapter Visibility
Scenario 3: [DD-27-007] SMS channel option present in alert composer — open alert composer → checkbox or toggle for "SMS" channel is visible
Scenario 4: [DD-27-007] PA channel option present in alert composer — open alert composer → checkbox or toggle for "PA" (public address) channel is visible
Scenario 5: [DD-27-007] Radio channel option present in alert composer — open alert composer → checkbox or toggle for "Radio" channel is visible
Scenario 6: [DD-27-007] Push/BrowserPush channel option present in alert composer — open alert composer → checkbox or toggle for "Push" or "Browser Push" channel is visible

## Channel Interaction
Scenario 7: [DD-27-007] Channel checkbox toggleable — click SMS channel checkbox in composer → checkbox state changes (checked/unchecked), no error
Scenario 8: [DD-27-007] Alert templates page renders — navigate to templates tab or section in /alerts → templates list or empty state shown, no error boundary

## SMS Providers Settings
Scenario 9: [DD-27-007] SMS Providers settings accessible — navigate to /settings/sms-providers → page renders without "Access Denied" or error boundary
