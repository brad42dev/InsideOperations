---
unit: DD-14
date: 2026-03-24
uat_mode: auto
verdict: fail
scenarios_tested: 8
scenarios_passed: 0
scenarios_failed: 8
scenarios_skipped: 0
---

## Module Route Check

❌ fail: Navigating to /rounds loads an error boundary — "Rounds failed to load: pendingInstances.map is not a function". The module mounts but immediately crashes.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [DD-14-004] Rounds module renders without error | ❌ fail | Error boundary shown: "Rounds failed to load — pendingInstances.map is not a function" |
| 2 | Printable Checklist | [DD-14-004] Print/Export button visible in rounds view | ❌ fail | Print button briefly appeared then replaced by error boundary; module non-functional |
| 3 | Printable Checklist | [DD-14-004] Print dialog opens with mode options | ❌ fail | Module crashed before interaction possible |
| 4 | Printable Checklist | [DD-14-004] Blank checklist mode initiates action | ❌ fail | Module crashed before interaction possible |
| 5 | Printable Checklist | [DD-14-004] Current results mode initiates action | ❌ fail | Module crashed before interaction possible |
| 6 | Export Button | [DD-14-006] Export button visible on rounds table | ❌ fail | Module crashed; no rounds table visible |
| 7 | Export Button | [DD-14-006] Export action produces output | ❌ fail | Module crashed before interaction possible |
| 8 | Export Button | [DD-14-006] Export button visible on round templates table | ❌ fail | Module crashed before interaction possible |

## New Bug Tasks Created

DD-14-009 — Rounds module crashes on load: pendingInstances.map is not a function

## Screenshot Notes

Screenshot: docs/uat/DD-14/fail-rounds-error-boundary.png
The Rounds page hits an error boundary immediately after loading. The error "pendingInstances.map is not a function" indicates the API returned a non-array (likely null or an object) for pending round instances where the UI code expects an array. The Print button was briefly visible in the DOM before the error boundary replaced the content area, confirming the print feature is implemented but blocked by this crash. All 8 scenarios (print checklist DD-14-004 and export button DD-14-006) are untestable until this crash is resolved.
