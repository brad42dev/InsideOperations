# UAT Scenarios — DD-21

## Page Renders
Scenario 1: [DD-21-004] Settings page renders without error — navigate to /settings → page loads, no error boundary "Something went wrong"

## Input Validation — User Form
Scenario 2: [DD-21-004] Add User form opens — navigate to /settings/users, click Add User button → dialog with user form appears
Scenario 3: [DD-21-004] Empty username shows validation error — open Add User form, submit without filling username → inline error "Username is required" or similar appears below username field
Scenario 4: [DD-21-004] Empty email shows validation error — open Add User form, submit without filling email → inline error "Email is required" or similar appears below email field
Scenario 5: [DD-21-004] Empty password shows validation error — open Add User form, submit without filling password → inline error "Password is required" or similar appears below password field

## Input Validation — Login Form
Scenario 6: [DD-21-004] Login form renders — navigate to /login → login form visible with username and password fields
Scenario 7: [DD-21-004] Empty login submission shows error — submit login form with empty fields → validation error or error message visible
