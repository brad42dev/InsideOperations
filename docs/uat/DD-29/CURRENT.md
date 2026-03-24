---
unit: DD-29
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 9
scenarios_passed: 8
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /login loads the real login form implementation. /profile loads the full profile page with PIN setup section.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Auth/Login | [DD-29-014] Login page renders without error | ✅ pass | |
| 2 | Auth/Lock | [DD-29-014] User menu shows Lock Screen option | ✅ pass | |
| 3 | Auth/Lock | [DD-29-014] Triggering lock screen shows lock dialog | ✅ pass | dialog "Screen locked" appeared with password field |
| 4 | Auth/Lock | [DD-29-014] Correct password unlocks session | ✅ pass | "changeme" unlocked — dialog dismissed, no error |
| 5 | Auth/PIN | [DD-29-015] Profile page accessible from user menu | ✅ pass | "Profile & PIN Setup" link visible in user dropdown |
| 6 | Auth/PIN | [DD-29-015] Profile page loads with PIN section | ✅ pass | /profile loads Security section with "Lock Screen PIN" |
| 7 | Auth/PIN | [DD-29-015] Set PIN form accepts input | ✅ pass | PIN 123456 saved — "PIN set successfully." toast shown |
| 8 | Auth/PIN | [DD-29-015] Lock screen shows PIN option after PIN set | ❌ fail | Lock screen shows only Password field; no PIN entry option despite PIN being set |
| 9 | Auth/PIN | [DD-29-015] Remove PIN option present on profile | ✅ pass | "Remove PIN" button visible on /profile Security section |

## New Bug Tasks Created

DD-29-016 — Lock screen does not offer PIN entry after PIN is set

## Screenshot Notes

Scenario 8 failure: docs/uat/DD-29/s8-lock-screen-no-pin-option.png
Lock screen shows only "Password" field and "Unlock" button. No PIN tab, PIN toggle, or "Use PIN instead" option visible. The PIN was successfully set (scenario 7 passed with "PIN set successfully." toast) but the lock screen dialog does not reflect this — it remains password-only.

Note: Default admin password is "changeme" (not "admin"). This differs from the UAT agent default credential assumption.
