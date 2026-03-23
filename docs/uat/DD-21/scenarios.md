# UAT Scenarios — DD-21

## API Headers (visible via network/behavior)
Scenario 1: [DD-21-002] Settings page loads without error — navigate to /settings → page renders, no error boundary
Scenario 2: [DD-21-004] Form validation shows inline errors — navigate to /settings, try submitting a form with invalid data → inline validation errors shown (not browser alert dialogs)
Scenario 3: [DD-21-002] API-driven pages render content — navigate to /settings/users → user list loads with data (not blank page or error)
