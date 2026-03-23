# UAT Scenarios — DD-29

## Authentication
Scenario 1: [DD-29-009] Login page renders without error — navigate to /login → login form visible, no error boundary
Scenario 2: [DD-29-009] Login with valid credentials works — submit admin/changeme → redirects to /console
Scenario 3: [DD-29-008] Login with invalid credentials shows error — submit admin/wrongpass → "Invalid username or password" error message visible
Scenario 4: [DD-29-011] No PIN lock screen visible on normal login — navigate to /console → no PIN lock screen shown (PIN lock is optional feature)
Scenario 5: [DD-29-005] No unexpected MFA screen on admin login — submit admin/changeme → redirected to console without MFA prompt (admin has no MFA configured)
