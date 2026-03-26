---
task_id: DD-06-029
unit: DD-06
status: completed
attempt: 1
claimed_at: 2026-03-26T10:00:00Z
last_heartbeat: 2026-03-26T10:50:00Z
rate_limited: false
---

## Prior Attempt Fingerprints

| Attempt | Changed Files | Before Hash | Result |
|---------|---------------|-------------|--------|
| 1 | frontend/src/shared/layout/AppShell.tsx | 54cc02800b7b907b5aff4cb26416890b5393cd52 | SUCCESS |

## Current Attempt (1) — CLOSED

### Phase
CLOSED

### Work Log
- 2026-03-26T10:00:00Z — Claimed task DD-06-029, attempt 1
- 2026-03-26T10:20:00Z — Loaded: AppShell.tsx, registry.ts, main.tsx, prior attempt files (6 files)
- 2026-03-26T10:25:00Z — Root cause identified: gKeyNavTarget state pattern (added in DD-06-021) introduces a React 18 concurrent mode race. When navigate() is called inside a useEffect with v7_startTransition:true, the immediate setGKeyNavTarget(null) in the same effect creates an urgent (non-transition) state update that may interrupt the pending navigation transition. Fix: revert to calling _navigateRef.current?.(path) directly — the ref is updated in render body so it is always the live navigate function, and calling navigate() directly from a synchronous keyboard handler is the correct React Router usage pattern.
- 2026-03-26T10:28:00Z — TS baseline: 0 pre-existing errors
- 2026-03-26T10:35:00Z — Modified frontend/src/shared/layout/AppShell.tsx: removed gKeyNavTarget state, _setGKeyNavTarget ref, and deferred useEffect; changed _setGKeyNavTarget.current?.(path) to _navigateRef.current?.(path)
- 2026-03-26T10:37:00Z — Build check: PASS (0 TS errors, BUILD_EXIT:0)
- 2026-03-26T10:40:00Z — Tests: PASS (2 pre-existing failures in permissions.test.ts unrelated to this change)
- 2026-03-26T10:42:00Z — Circular imports: PASS (No circular dependency found)
- 2026-03-26T10:44:00Z — Scope check: PASS — only AppShell.tsx modified (in-task scope)
- 2026-03-26T10:45:00Z — ✅ scope check passed — all modified files are in-task scope

### Exit Checklist
- [x] Attempt file written: attempts/001.md
- [x] Attempt file read back and verified non-empty
- [x] CURRENT.md updated with final status and fingerprints
- [ ] CURRENT.md read back — status field confirmed
