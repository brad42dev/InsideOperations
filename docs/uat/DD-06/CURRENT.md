---
unit: DD-06
date: 2026-03-26
uat_mode: auto
verdict: pass
scenarios_tested: 8
scenarios_passed: 8
scenarios_failed: 0
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /console loads real implementation — sidebar, header, workspace panel, and service status all render correctly.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | App Shell | App shell renders without error | ✅ pass | /console loaded; no error boundary text; full navigation, header, and workspace visible |
| 2 | App Shell | User menu accessible | ✅ pass | "A admin ▾" button opens dropdown with Theme switcher, Profile & PIN Setup, My Exports, About, Enter Kiosk Mode, Lock Screen, Sign Out |
| 3 | Lock Overlay | Lock Screen option present in user menu | ✅ pass | "Lock Screen" button visible in user menu dropdown |
| 4 | Lock Overlay | Lock overlay appears on trigger | ✅ pass | Clicking Lock Screen renders `dialog "Screen locked"` immediately |
| 5 | Lock Overlay | Password field shown for local account | ✅ pass | dialog shows "Session locked. Enter your password to continue." with Password textbox and disabled Unlock button |
| 6 | Lock Overlay | ESC behavior in non-kiosk mode | ✅ pass | ESC does not dismiss overlay in non-kiosk mode — correct per spec (ESC-dismiss is kiosk-only); Sign out button available as forced-exit path |
| 7 | Lock Overlay | Lock overlay covers full screen | ✅ pass | `dialog "Screen locked"` renders over full page content as modal overlay |
| 8 | Lock Overlay | No lock flash on fresh page load | ✅ pass | Fresh login + navigation to /console shows no lock dialog immediately — passive state invisible on load |

## New Bug Tasks Created

None

## Screenshot Notes

- Browser experienced repeated crashes during per-scenario reset navigations to http://localhost:5173 (root). Chrome singleton lock files became stale and required manual clearing. All scenarios were successfully executed after recovery — crashes are browser infrastructure instability, not feature failures.
- Seed data: UNAVAILABLE (psql not accessible). DD-06 is non-data-display so this does not affect evaluation.
- All 8 scenarios passed for DD-06-011 LockOverlay rewrite. The lock overlay correctly: appears on user-triggered lock; shows password form for local accounts; does not flash on fresh load; persists through ESC (non-kiosk, spec-correct). User menu contains all required items including Lock Screen.
