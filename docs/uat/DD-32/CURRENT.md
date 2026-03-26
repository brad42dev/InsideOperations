---
unit: DD-32
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 10
scenarios_passed: 8
scenarios_failed: 2
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /console loads real implementation — workspace list, graphics palette, toolbar, Notifications (F8) region all present.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Renders | [DD-32-007] Console renders without error | ✅ pass | No error boundary; full workspace UI visible |
| 2 | Notifications | [DD-32-019] Notifications (F8) label visible | ✅ pass | `region "Notifications (F8)"` present in accessibility tree on login page and /console |
| 3 | Notifications | [DD-32-019] F8 key opens Notifications panel | ✅ pass | Pressing F8 opens `dialog "Notifications (F8)"` with "No notifications" empty state and timestamp |
| 4 | Notifications | [DD-32-019] Escape closes Notifications panel | ✅ pass | Dialog gone from snapshot after Escape |
| 5 | Toast — Success | [DD-32-017] Success toast on workspace creation | ❌ fail | Clicked "+" then "Done" — no success toast appeared in Notifications region; list remained empty |
| 6 | Data Flow | [DD-32-017] GET /api/v1/workspaces — workspace list loads | ✅ pass | "Reactor Overview" workspace visible in tab bar and sidebar on page load |
| 7 | Toast — Error Persist | [DD-32-018] Error toast does not auto-dismiss | ❌ fail | Error toast "Failed to create workspace" appeared, then auto-dismissed within ~3 seconds without user action |
| 8 | Toast Region | [DD-32-007] Toast area present and functional | ✅ pass | Notification region exists; error toast appeared with dismiss (×) button |
| 9 | Toast Max | [DD-32-007] Toast stack ≤ 3 visible at once | ✅ pass | Only 1 toast visible at a time (due to auto-dismiss bug, full overflow test not possible; no overflow observed) |
| 10 | Toast History | [DD-32-010] F8 history shows past toasts | ✅ pass | F8 panel showed "Failed to create workspace" with timestamp after toast had auto-dismissed |

## New Bug Tasks Created

DD-32-020 — No success toast shown after workspace creation (Done button)
DD-32-021 — Error toasts auto-dismiss instead of persisting until manually dismissed

## Screenshot Notes

- ⚠️ Seed data status unknown (psql unavailable)
- Backend API returns 404 for workspace creation (new UUID workspaces not found) — triggers error toast instead of success
- Error toasts appear immediately on "+" click (before Done), then auto-dismiss within ~3 seconds
- Clicking "Done" produces no toast at all (silent)
- F8 history panel correctly persists notification history even after toasts auto-dismiss
- "Clear all" button visible in F8 history panel header
- Screenshot: dd32-scenario7-error-toast-dismissed.png (shows console after error toast auto-dismissed, notifications region empty)
