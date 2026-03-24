---
unit: DD-29
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 6
scenarios_passed: 5
scenarios_failed: 1
scenarios_skipped: 2
---

## Module Route Check

pass: Navigating to /login redirects to /console (already authenticated) — no error boundary, real implementation loaded.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Login Page Baseline | [DD-29-016] Login page renders without error | ✅ pass | Redirects to /console when authenticated |
| 2 | PIN Setup Flow | [DD-29-016] Profile page accessible from user menu | ✅ pass | "Profile & PIN Setup" link visible in admin user menu |
| 3 | PIN Setup Flow | [DD-29-016] Profile page has PIN setup section | ✅ pass | "Lock Screen PIN" section with Set PIN / Remove PIN buttons under Security heading |
| 4 | PIN Setup Flow | [DD-29-016] Set PIN succeeds | ❌ fail | "Failed to set PIN. Please try again." — POST /api/auth/pin returns 401 Unauthorized |
| 5 | Lock Screen PIN Entry | [DD-29-016] Lock Screen option exists in user menu | ✅ pass | "Lock Screen" button visible in admin user menu |
| 6 | Lock Screen PIN Entry | [DD-29-016] Lock screen shows PIN entry after PIN is set | ⏭ skipped | Blocked: PIN cannot be set (Scenario 4 failure) |
| 7 | Lock Screen PIN Entry | [DD-29-016] PIN unlock dismisses lock screen | ⏭ skipped | Blocked: PIN cannot be set (Scenario 4 failure) |
| 8 | Lock Screen PIN Entry | [DD-29-016] Lock screen password-only when no PIN set | ✅ pass | Lock dialog shows only Password field and Unlock button — no PIN option, correct behavior |

## New Bug Tasks Created

DD-29-017 — PIN set endpoint returns 401 Unauthorized — lock screen PIN cannot be set

## Screenshot Notes

- docs/uat/DD-29/scenario4-pin-save-fail.png — PIN form shows "Failed to set PIN. Please try again." error in red. POST /api/auth/pin → 401 Unauthorized.
- docs/uat/DD-29/scenario6-lock-screen-password-fail.png — Lock screen shows password-only (correct when no PIN set), but Unlock via password also fails with "Unable to verify. Check your connection." (POST /api/auth/verify-password → 401). This is a secondary observation; note tracked by DD-29-014 (uat_status: pass but still broken).
- Scenarios 6 and 7 could not be executed because the PIN cannot be saved due to the 401 backend error. The UI for PIN setup is present and correctly structured; the failure is exclusively in the backend auth endpoint.
