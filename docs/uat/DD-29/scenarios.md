# UAT Scenarios — DD-29

## Login / Auth
Scenario 1: [DD-29-002] Login page renders without error — navigate to /login → login form visible, no error boundary
Scenario 2: [DD-29-002] Login form accepts credentials — navigate to /login, enter admin/admin → login succeeds, redirected to app
Scenario 3: [DD-29-007] Login shows error on wrong credentials — navigate to /login, enter wrong password → error message shown
Scenario 4: [DD-29-005] MFA option visible in settings — navigate to /settings → MFA/two-factor authentication section visible
Scenario 5: [DD-29-006] SCIM/user management accessible — navigate to /settings → user/group management section visible
Scenario 6: [DD-29-008] Auth session works after login — log in, navigate around app → session maintained without re-login prompts
Scenario 7: [DD-29-011] PIN/lock screen option accessible — navigate to /settings or profile → PIN set/unlock option visible
