# UAT Scenarios — DD-21

## Settings User Form Validation
Scenario 1: [DD-21-005] Add User form accessible — navigate to /settings/users → page loads, Add User button visible
Scenario 2: [DD-21-005] Empty submit shows inline validation errors — click Add User, submit empty form → inline error messages appear below required fields (Username, Email, Password)
Scenario 3: [DD-21-005] Errors are inline not alert dialogs — after empty submit → error text visible in component tree, no browser alert dialog
