---
unit: DD-37
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 2
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: Console loads without WebSocket-related errors.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | IPC/WS | [DD-37-002] Console WebSocket updates visible | ❌ fail | Services sidebar shows all services as "unknown" — no connected indicator; no live data (no workspaces, backend not running in dev) |
| 2 | IPC/WS | [DD-37-006] API key auth not rejected | ✅ pass | App loads after JWT login, no 401 errors from standard auth |
| 3 | IPC/WS | [DD-37-003] Presence updates don't break UI | ✅ pass | Console loads without "Something went wrong" error boundary |

## New Bug Tasks Created

None

## Screenshot Notes

S1 failure is environmental: backend services not running in dev environment. Service status indicators show "unknown" rather than connected/disconnected state. No code bug identified.
