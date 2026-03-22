---
task_id: DD-16-005
unit: DD-16
status: completed
attempt: 1
claimed_at: 2026-03-22T00:00:00Z
last_heartbeat: 2026-03-22T00:10:00Z
---

## Prior Attempt Fingerprints

| Attempt | Fingerprint | Before Hash | After Hash | Result |
|---------|-------------|-------------|------------|--------|
| 1 | 301e20ea1d6a5b218c1e4cb52f23241337fa2bc61c61769b78a449bf14ada31e | 0000000000000000000000000000000000000000000000000000000000000000 | 94e75f5a323e39a8ed96ef4b143ec00b6e3bad9343f1ac09a06dc6b80da19e7c | SUCCESS |

## Current Attempt (1) — CLOSED

### Phase
CLOSED

### Work Log
- 2026-03-22T00:00:00Z — Claimed task DD-16-005, attempt 1
- 2026-03-22T00:01:00Z — Read docs/state/INDEX.md
- 2026-03-22T00:01:00Z — Read docs/state/DD-16/INDEX.md
- 2026-03-22T00:01:00Z — Read docs/state/DD-16/DD-16-005/CURRENT.md
- 2026-03-22T00:01:00Z — Read docs/tasks/DD-16/DD-16-005-sharedworker-per-window-subscriptions.md
- 2026-03-22T00:02:00Z — Read frontend/src/workers/wsWorker.ts
- 2026-03-22T00:03:00Z — Modified wsWorker.ts: replaced subscribedPoints with windowSubscriptions + serverSubscription + recomputeAndSync helper
- 2026-03-22T00:04:00Z — Modified wsWorker.ts: added port.addEventListener('close') in onconnect
- 2026-03-22T00:05:00Z — Modified wsWorker.ts: updated removePort to delete windowSubscriptions entry and call recomputeAndSync
- 2026-03-22T00:06:00Z — Modified wsWorker.ts: updated subscribe/unsubscribe handlers to use per-window sets
- 2026-03-22T00:07:00Z — Modified wsWorker.ts: updated openSocket to use serverSubscription on reconnect
- 2026-03-22T00:07:00Z — Modified wsWorker.ts: updated closeSocket to clear serverSubscription and windowSubscriptions
- 2026-03-22T00:08:00Z — Modified wsWorker.ts: added jitter to scheduleReconnect
- 2026-03-22T00:09:00Z — Build check: PASS (tsc --noEmit, clean)
- 2026-03-22T00:09:00Z — Checklist: windowSubscriptions Map at module scope — ✅
- 2026-03-22T00:09:00Z — Checklist: subscribe handler union-diff — ✅
- 2026-03-22T00:09:00Z — Checklist: unsubscribe handler union-diff — ✅
- 2026-03-22T00:09:00Z — Checklist: port onclose event handler — ✅
- 2026-03-22T00:09:00Z — Checklist: removePort calls recomputeAndSync — ✅
- 2026-03-22T00:09:00Z — Checklist: scheduleReconnect jitter — ✅

### Exit Checklist
- [x] Attempt file written: attempts/001.md
- [x] Attempt file read back and verified non-empty
- [x] CURRENT.md updated with final status and fingerprints
- [x] CURRENT.md read back — status field confirmed
