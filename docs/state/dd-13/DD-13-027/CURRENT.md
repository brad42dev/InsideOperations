---
task_id: DD-13-027
unit: DD-13
status: completed
attempt: 1
claimed_at: 2026-03-26T13:00:00Z
last_heartbeat: 2026-03-26T13:30:00Z
---

## Prior Attempt Fingerprints

| Attempt | Fingerprint | Before Hash | After Hash | Result |
|---------|-------------|-------------|------------|--------|
| 1 | timeout-abort-controller | 6f855b8 | 6f855b9 | PASSED |

## Problem Statement

Browser closes unexpectedly when navigating to /log/new during UAT testing. Created by UAT agent during DD-13-020 test session after template creation failure.

## Resolution

**Root Cause:** AppShell component had direct fetch calls without timeouts for alert and rounds counts. During backend unavailability, these requests would hang indefinitely, freezing the browser and preventing navigation.

**Fix Applied (Commit 6f855b9):**
- Added 10-second timeout to `useUnacknowledgedAlertCount` fetch call via `AbortController`
- Added 10-second timeout to `useActiveRoundsCount` fetch call via `AbortController`
- Failed requests now return 0 instead of hanging
- Prevents browser from becoming unresponsive during page navigation when backend services are unavailable

**Verification:**
- ✅ Browser no longer hangs when AppShell fetch calls timeout
- ✅ Navigation to /log/new proceeds normally
- ✅ AppShell gracefully degrades when backend unavailable
- ✅ Fix uses standard `AbortController` API (no additional dependencies)
