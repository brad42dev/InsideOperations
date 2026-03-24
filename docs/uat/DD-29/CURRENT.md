---
unit: DD-29
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 5
scenarios_failed: 2
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /login redirects to /console (already authenticated) — real implementation loaded, no error boundary

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Baseline | [DD-29-010] Login page renders without error | ✅ pass | Redirects to /console as expected for authenticated user |
| 2 | Session Lock UI | [DD-29-010] Lock screen trigger exists in user menu | ✅ pass | "Lock Screen" button present in "A admin ▾" user menu |
| 3 | Session Lock UI | [DD-29-010] Lock screen activates on click | ✅ pass | `dialog "Screen locked"` appeared with password field; note: /api/auth/lock returns 404 (server-side state not persisted) |
| 4 | Session Lock UI | [DD-29-010] Lock screen shows PIN entry field | ❌ fail | Only Password field visible — no PIN option. Root cause: /api/auth/lock returns 404 and /api/auth/pin returns 404, so PIN cannot be set |
| 5 | PIN Management | [DD-29-011] Profile page has PIN section | ✅ pass | /profile loads with "My Profile" heading, Security section with "Lock Screen PIN" description |
| 6 | PIN Management | [DD-29-011] PIN can be set from profile | ✅ pass | "Set PIN" opens form with New PIN, Confirm PIN, Current Password fields and "Save PIN" button |
| 7 | PIN Management | [DD-29-011] PIN save endpoint works | ❌ fail | /api/auth/pin returns 404 Not Found; UI shows "Failed to parse server response" |

## New Bug Tasks Created

DD-29-014 — Session lock/unlock API endpoints missing — /api/auth/lock and /api/auth/verify-password return 404
DD-29-015 — PIN set/delete/verify endpoints missing — /api/auth/pin returns 404

## Screenshot Notes

- docs/uat/DD-29/fail-lock-screen-no-pin-field.png: Lock screen shows only Password field ("Session locked. Enter your password to continue."), no PIN input visible. Console error: 404 on /api/auth/lock confirms server-side lock state not persisted.
- docs/uat/DD-29/fail-pin-endpoint-404.png: PIN Set form filled (123456/123456/admin) and "Save PIN" clicked — "Failed to parse server response" alert shown. Console error: 404 on /api/auth/pin.
- DD-29-010 backend issue: /api/auth/lock returns 404 (lock), /api/auth/verify-password returns error (unlock). Session lock state is client-side only — not persisted server-side.
- DD-29-011 backend issue: /api/auth/pin endpoint completely missing (404). UI for PIN setup exists and is well-formed, but the backing API is absent.
