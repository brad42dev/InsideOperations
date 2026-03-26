---
unit: DD-32
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 9
scenarios_passed: 5
scenarios_failed: 4
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /console loads real implementation — workspace list, graphics palette, toolbar, Notifications (F8) region all present.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Renders | [DD-32-017][DD-32-020] Console renders without error | ✅ pass | No error boundary; full workspace UI visible |
| 2 | Data Flow | [DD-32-017] GET /api/v1/workspaces | ✅ pass | "Reactor Overview" workspace visible in sidebar and tab bar on page load |
| 3 | Toast — Success | [DD-32-017][DD-32-020] Success toast fires on Done click | ❌ fail | Clicked "+" then "Done" — no success toast appeared; Notifications region empty. Backend 404s on workspace creation, blocking success path |
| 4 | Toast — Success | [DD-32-017][DD-32-020] Success toast message is descriptive | ❌ fail | No toast appeared at all — cannot verify message content |
| 5 | Toast — Success | [DD-32-020] Success toast auto-dismisses after ~5s | ❌ fail | No success toast appeared to observe auto-dismiss behavior |
| 6 | Toast — F8 History | [DD-32-020] F8 opens notification history panel | ✅ pass | F8 opens `dialog "Notifications (F8)"` showing past error toast with timestamp; Escape closes it |
| 7 | Toast — Error Persist | [DD-32-018][DD-32-021] Error toast persists after 11s | ✅ pass | "Failed to create workspace" error toast still visible in Notifications region after 11 seconds |
| 8 | Toast — Error Persist | [DD-32-018][DD-32-021] Error toast manually dismissable | ✅ pass | Clicking × on error toast removed it immediately; Notifications list empty after dismiss |
| 9 | Toast — Regression | [DD-32-018][DD-32-021] Success toast auto-dismisses (regression) | ❌ fail | Backend unavailable — cannot trigger success toast; success auto-dismiss regression untestable |

## New Bug Tasks Created

DD-32-022 — Success toast on workspace creation untestable — Done click silent; success path blocked by backend 404
DD-32-023 — Success toast auto-dismiss regression unverifiable — backend returns 404 on workspace creation

## Screenshot Notes

- ⚠️ Seed data status unknown (psql unavailable)
- Backend API returns 404 for all workspace creation calls (POST /api/v1/workspaces) — error toast fires correctly on "+" click, but "Done" click is silent
- Error toast persistence now works correctly: "Failed to create workspace" persisted for 11+ seconds, dismissed only on manual × click (DD-32-018/021 ✅ FIXED)
- F8 notification history panel works correctly: opens on F8, shows past error toast with timestamp and "Error" label, closes on Escape (DD-32-020 F8 path ✅)
- Success path (workspace creation succeeds → success toast) cannot be verified without a working backend
- Screenshots: fail-s3-no-success-toast-done.png, pass-s6-f8-history-panel.png
