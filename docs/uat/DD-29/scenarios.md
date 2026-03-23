# UAT Scenarios — DD-29

## Authentication (DD-29) — /login

Scenario 1: [DD-29-001] Login page renders — navigate to /login → login form visible, no error boundary
Scenario 2: [DD-29-001] EULA acceptance gate — attempt login with unaccepted EULA → EULA acceptance dialog or gate shown before JWT
Scenario 3: [DD-29-004] MFA settings accessible — navigate to /settings/mfa as admin → MFA configuration page loads
Scenario 4: [DD-29-009] Verify-password flow — check lock screen or session lock → password re-entry field visible
Scenario 5: [DD-29-010] Session lock state — trigger session lock → lock overlay shows server-synced state
Scenario 6: [DD-29-011] PIN unlock option — check lock screen → PIN entry option visible alongside password
Scenario 7: [DD-29-007] OIDC/SAML provider config — navigate to /settings/auth → identity provider configuration page loads
