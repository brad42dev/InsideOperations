# UAT Scenarios — DD-15

## Settings Module
Scenario 1: [DD-15-001] Settings page renders — navigate to /settings → page loads without error
Scenario 2: [DD-15-010] EULA settings page accessible — navigate to EULA settings → does NOT show Access Denied for admin
Scenario 3: [DD-15-011] Role edit dialog opens — navigate to Settings → Users & Roles → click edit on a role → dialog opens without crash
Scenario 4: [DD-15-012] Group Management in settings — settings sidebar has Group Management section

## Settings Features
Scenario 5: [DD-15-002] MFA settings route exists — navigate to /settings/mfa → page loads (not 404)
Scenario 6: [DD-15-005] Role edit has idle timeout — role edit dialog has idle timeout and max concurrent sessions fields
Scenario 7: [DD-15-006] Point Configuration page — navigate to settings → look for Point Configuration section
Scenario 8: [DD-15-008] ErrorBoundary wraps settings — settings has error boundary (navigating to broken subsection shows bounded error)
Scenario 9: [DD-15-009] Data Category in source config — OPC source config has Data Category field
