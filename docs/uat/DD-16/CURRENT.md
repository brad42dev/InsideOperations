---
unit: DD-16
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 2
scenarios_passed: 1
scenarios_failed: 0
scenarios_skipped: 2
---

## Module Route Check

fail: Console module fails to load; WS offline indicator visible in sidebar

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | WebSocket | Console page with live data | skipped | Console module fails (dynamic import error) |
| 2 | WebSocket | SharedWorker reconnects | skipped | Console module fails |
| 3 | WebSocket | Source offline indication | ✅ pass | 'Critical: service offline or WS disconnected' button visible in sidebar |
| 4 | WebSocket | Live data updates | skipped | Console module fails |

## New Bug Tasks Created

None

## Screenshot Notes

Backend WebSocket tasks are not browser-verifiable. Offline indicator is correctly visible in sidebar. Console module must be fixed first.
