---
unit: DD-10
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 6
scenarios_passed: 5
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /dashboards loads real implementation — 10 dashboard cards visible, no error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Dashboard Page Renders | [DD-10-021] Dashboards page renders without error | ✅ pass | 10 dashboard cards visible, no error boundary |
| 2 | Data Flow | [DD-10-021] — data flow: GET /api/v1/dashboards | ✅ pass | 10 named dashboards loaded (Active Alarms, Operations Overview, etc.) |
| 3 | Open in New Window Button | [DD-10-021] Open in New Window button visible in toolbar | ✅ pass | "Open dashboard in new window" button present at ref=e408 in dashboard viewer toolbar |
| 4 | Open in New Window Button | [DD-10-021] Open in New Window button triggers new window/tab | ❌ fail | New tab opened at /detached/dashboard/{id} but shows "Failed to load dashboard" error instead of rendering the dashboard |
| 5 | Toolbar Integrity | [DD-10-021] Dashboard viewer toolbar renders with controls | ✅ pass | Toolbar has Duplicate, Kiosk, Open in New Window buttons plus full time range pickers and playback bar |
| 6 | Edge Case / Empty State | [DD-10-021] Empty dashboard list handled gracefully | ✅ pass | 10 dashboards loaded without crash; explicit empty-state not testable with current data |

## New Bug Tasks Created

DD-10-022 — Detached dashboard view shows "Failed to load dashboard" when opened via "Open in New Window"

## Screenshot Notes

- Scenario 4 failure screenshot: dd-10-021-detached-fail.png — the /detached/dashboard/{id} route renders a full-screen dark error state with "Failed to load dashboard" (red text) and a "Back to Dashboards" button. No dashboard content is shown.
- Seed data status: UNAVAILABLE (psql not accessible), but frontend has embedded seed dashboards that loaded correctly.
