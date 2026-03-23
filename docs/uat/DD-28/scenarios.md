# UAT Scenarios — DD-28

## Email Settings
Scenario 1: [DD-28-009] Email provider type selector has all options — navigate to /settings/email (or email provider settings) → provider type dropdown shows MS Graph, Gmail, SES, SMTP options
Scenario 2: [DD-28-008] Test email provider button visible — in email provider config → "Test" or "Send Test" button present
Scenario 3: [DD-28-008] Test button gives feedback — click test button → result shown (success/failure), not a silent no-op
Scenario 4: [DD-28-005] Email settings page renders without error — navigate to email settings → no error boundary or 404
Scenario 5: [DD-28-007] Email templates list accessible — navigate to email templates section → list renders or empty state shown
