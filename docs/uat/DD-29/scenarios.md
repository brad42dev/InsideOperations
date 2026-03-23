# UAT Scenarios — DD-29

## Login Page
Scenario 1: [DD-29-002] Login page renders without error — navigate to /login → login form visible, no error boundary
Scenario 2: [DD-29-002] Local login works — enter admin/admin, click Sign In → redirected to app (not error page)

## MFA Settings
Scenario 3: [DD-29-012] MFA settings page shows Duo Security card — navigate to /settings/mfa (or /settings/security) → four MFA method cards visible including "Duo Security"
Scenario 4: [DD-29-005] MFA methods page renders without error — navigate to MFA settings → page loads, no error boundary

## Auth Provider Settings
Scenario 5: [DD-29-003] SAML provider config accessible — navigate to /settings/auth-providers → SAML configuration option available
Scenario 6: [DD-29-006] SCIM settings accessible — navigate to /settings/auth (SCIM section) → SCIM configuration visible or link available
Scenario 7: [DD-29-011] PIN settings visible in profile — navigate to user profile or security settings → PIN setup option visible
