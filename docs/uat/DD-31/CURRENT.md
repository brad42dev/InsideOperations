---
unit: DD-31
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 5
scenarios_passed: 3
scenarios_failed: 1
scenarios_skipped: 2
---

## Module Route Check

pass: Alerts page loads; History tab crashes

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Alerts UI | Alerts page renders | ✅ pass | Alerts page loads with Send Alert form |
| 2 | Alerts UI | Resolve/Cancel actions on active alert | skipped | No active alerts in test environment |
| 3 | Alerts UI | Channels from config | skipped | Only websocket shown; could be config or hardcoded |
| 4 | Alerts UI | Export Unaccounted List | skipped | No muster active to test |
| 5 | Alerts UI | Export button on Alert History | ❌ fail | History tab crashes: 'messages.map is not a function' |
| 6 | Alerts UI | Right-click template row | ✅ pass | Context menu with Edit/Duplicate/Send/Test appears |
| 7 | Alerts UI | Right-click group row | skipped | Groups tab not tested |
| 8 | Alerts UI | Emergency severity visible | ✅ pass | emergency/critical/warning/info severity buttons in send form |

## New Bug Tasks Created

DD-31-013 — Alerts History tab crashes with messages.map TypeError

## Screenshot Notes

Screenshot: dd31-history-crash.png. Alert History tab throws 'messages.map is not a function'.
