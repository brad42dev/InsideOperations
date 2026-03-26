# Workflow & Orchestration Improvement Plan
_Created: 2026-03-24 — Source: deep review by 4 parallel agents_
_Update this file as items are completed. Compact+reread at <40% context._

---

## Current State (as of 2026-03-25 — updated after Batch 1+2+3+4+5)

- **Task registry**: 409 entries — 407 verified, 1 pending (DD-39-013), 1 pending (DD-29-017)
- **UAT**: 335 pass, 0 fail (reset), 2 partial, 71 null — all fail tasks reset to null for re-test
- **Backup**: comms/AUDIT_PROGRESS.json.bak exists (saved before P2 changes)
- **P1-P5 critical fixes all applied** (see status lines below)

---

## Priority 1 — io-run.sh Critical Bugs (data loss / false confidence risk)

### P1-A: Remove `|| true` from claude invocations — DONE: yes
Claude crashes are silently swallowed. UAT marks unit as skipped, implement treats round
as complete, zero signal of failure.
- **Files**: io-run.sh lines 302, 432, 468, 628, 637
- **Fix**: Capture exit code separately. Log failures. For UAT, mark as ERROR not skipped.
- **Status**: [x] done — claude invocations now capture exit code; crash logged as ⚠ ERROR

### P1-B: Process kill uses wrong PID — DONE: yes
`DEV_SERVER_PID=$!` captures the subshell, not Vite. `kill $DEV_SERVER_PID` leaves Vite
orphaned on port 5173. Accumulates across runs.
- **Files**: io-run.sh lines 176, 226–227, 342, 374–375
- **Fix**: Kill by port: `kill $(lsof -ti:5173 2>/dev/null) 2>/dev/null || true`
- **Status**: [x] done — added `kill_port()` function, all traps use it; removed DEV_SERVER_PID tracking

### P1-C: Add run-lock to prevent concurrent runs — DONE: yes
Two terminal windows running UAT simultaneously corrupt the database and JSON.
- **Fix**: Create `/tmp/io-run-{REPO_HASH}.lock` with flock at start of each mode
- **Status**: [x] done — flock on /tmp/io-run.lock; status mode exempt

### P1-D: Empty unit list treated as success — NOT A BUG
The `if [ -z "$UNITS" ]` check already handles this correctly.
- **Status**: [x] N/A

### P1-E: Verdict parsing fragile (awk format-sensitive) — DONE: yes
`awk '{print $2}'` fails if `verdict:pass` (no space) or `verdict: pass — extra text`.
Unit silently becomes SKIPPED instead of PASS.
- **Files**: io-run.sh lines 307, 436
- **Fix**: `grep -oP '(?<=verdict: )\S+'` or `sed`-based extraction
- **Status**: [x] done — replaced with `sed 's/verdict:[[:space:]]*//' | awk '{print $1}'`

### P1-F: release-uat UNITS query uses `|| true` (no error check) — DONE: yes
Lines 391–408: no `if !` guard. If Python fails, UNITS is empty, script silently exits.
- **Files**: io-run.sh lines 391–408
- **Fix**: Wrap in `if ! UNITS=$(...)` same as uat mode
- **Status**: [x] done

### P1-G: Atomic JSON writes — DONE: yes
AUDIT_PROGRESS.json is written by agents without fsync/atomic rename. Mid-write crash
= permanent corruption.
- **Fix**: Write to temp file, then `mv` atomically. Add JSON validation step after
  any write in all agents (audit-orchestrator, uat-agent, bug-agent).
- **Status**: [x] done — atomic write protocol added to Shared:Registry Update in orchestrator, Phase 6 and Phase 7 in uat-agent, Phase 4d in bug-agent

---

## Priority 2 — Registry / State Integrity

### P2-A: Fix stuck implementing task (DD-29-017) — DONE: yes
DD-29-017 is stuck `status: implementing`. Block is preventing correct scheduling.
- **Fix**: Reset to pending in registry. Check CURRENT.md for that task.
- **Status**: [x] done — reset to pending via Python script

### P2-B: Investigate + resolve 63 uat_status=fail tasks — DONE: yes
Reset all 63 to null. UAT will re-test them. If still broken, UAT creates new bug tasks.
- **Status**: [x] done — 71 tasks now uat_status=null (63 resets + 8 that were already null)

### P2-B-ADDENDUM: MOD-CONSOLE-012 (in registry, not on disk) — NOT A PROBLEM
Registry says verified+pass. Task was completed and is done. Missing file is expected
for verified tasks in some workflows. No action needed.
- **Status**: [x] N/A
These tasks are all verified (implement ran) but UAT failed. No automatic requeue exists.
Options:
1. If fixes were applied since UAT failed → reset uat_status to null, re-run UAT
2. If no fixes applied → need to determine if the failures are still present
Current approach: reset to null on all 63, run UAT cycle, let UAT create new bug tasks
for anything still broken.
- **Fix**: Script to reset all 63 `uat_status: fail` → `null` so UAT will re-test them
- **Status**: [ ] pending

### P2-C: Sync tasks_open field in queue[] — DEFERRED
`queue[].tasks_open` is a stale list of original audit IDs. The field is cosmetic — it
does not drive scheduling (smart filter uses `verified_since_last_audit`). Low priority.
- **Status**: [ ] deferred — not affecting correctness, schedule for a later pass

### P2-D: Fix DD-39-013 (on disk, not in registry) — DONE: yes (already done)
Task was already in registry when checked.
- **Status**: [x] N/A — DD-39-013 was already in registry

### P2-E: Fix MOD-CONSOLE-012 (in registry, not on disk) — NOT A PROBLEM
Registry entry: verified+pass. Task completed. Missing file expected for done tasks.
- **Status**: [x] N/A

### P2-F: Add pre-flight registry integrity check — DONE: yes
Before each major run, scan for disk/registry mismatches and warn.
- **Fix**: Add `check_registry_integrity()` function called at start of implement/uat/audit
- **Status**: [x] done — function added to io-run.sh, called before implement/uat loops

---

## Priority 3 — Loop Closure and Feedback

### P3-A: Close UAT loop — re-queue after UAT creates bug tasks — DONE: yes
When UAT creates a new bug task (source=uat), that unit's `verified_since_last_audit`
is not incremented. Smart filter won't re-audit it. The loop is broken.
- **Status**: [x] done — uat-agent Phase 6 now increments `verified_since_last_audit`
  after creating bug tasks, triggering re-audit on next pass

### P3-B: UAT query: add fail units to re-test queue — DONE: yes
After fixes are applied, uat_status=fail tasks never get re-tested.
- **Status**: [x] done — audit-orchestrator SUCCESS handler now resets `uat_status:fail`
  → null for all tasks in the same unit when a uat-sourced task is verified; also the
  P2-B reset of 63 fail tasks to null immediately re-queues those units for UAT

### P3-C: Persist ROUND counter — DONE: yes
Ctrl+C + restart resets ROUND=0, losing track of which rounds were done.
- **Status**: [x] done — LAST_ROUND.json updated with rounds_completed/rounds_total
  before each claude invocation in io-run.sh

### P3-D: Auto-run implement after UAT failures — DEFERRED
Lower priority. Current workflow is clear enough with manual steps.
- **Status**: [ ] deferred

---

## Priority 4 — implement-agent Protocol

### P4-A: Pre-write cycle check — DONE: yes
Cycle detection runs AFTER files are modified. When CYCLE_DETECTED, working tree dirty.
- **Status**: [x] done — implement-agent E6 now includes advisory pre-write check:
  describe planned approach vs prior attempt notes before touching any files

### P4-B: Wave gate for implement mode — DEFERRED
Low practical impact at current stage (all Wave 1/2 verified). Will revisit if needed.
- **Status**: [ ] deferred

### P4-C: git checkout on CYCLE_DETECTED — DONE: yes
When cycle is detected, files are already modified. Must undo before moving to next task.
- **Status**: [x] done — `git checkout -- .` added to implement-agent X2 CYCLE_DETECTED

### P4-D: Status field validator — DONE: yes
Unknown status values cause tasks to silently disappear from scheduler.
- **Status**: [x] done — Status Field Validator pass (step 1d) added to orchestrator

---

## Priority 5 — UAT Depth

### P5-A: Enforce minimum data flow scenarios — DONE: yes
Most passing UAT runs are shallow: "page renders without crash."
- **Status**: [x] done — uat-agent Phase 2 now requires ≥1 data flow scenario per
  data-display unit; named with `data flow: {API}` pattern; empty-state explicitly checked

### P5-B: Fix crash = fail verdict math — DONE: yes
8/10 scenarios crash → 2 tested, 2 pass → verdict=pass (wrong).
- **Status**: [x] done — verdict rules rewritten: browser crashes count as FAIL,
  not as excluded; only human-mode explicit skips reduce the denominator

### P5-C: Independent spec gate — DEFERRED
Complex to implement (requires reading design-doc per unit). Will revisit if needed.
- **Status**: [ ] deferred

### P5-D: Data existence pre-check — DONE: yes
UAT runs with 0 data points because seed-uat.sql may not have been applied. Features
that display data show "No data" and are marked pass.
- **Fix**: Add Phase 0 to uat-agent: check that seed data exists before running.
  `SELECT count(*) FROM points_metadata WHERE source_id = '11110000-...' LIMIT 1`
  If 0 rows, print warning but continue. If ≥1 rows, "No data" in data flow = ❌.
- **Status**: [x] done — Phase 0 added to uat-agent; sets evaluation rule for data flow scenarios

### P5-E: Enforce data flow scenario compliance — DONE: yes
Despite the rule existing in Phase 2, 0 of 34 UAT units had data flow scenarios.
Rule existed but was not enforced — agent could write scenarios.md and skip it.
- **Fix**: Add Phase 2.5 to uat-agent: mandatory stop after Phase 2 for data-display
  units. Count `grep -c "data flow:" scenarios.md`. If 0, must add one before Phase 3.
- **Status**: [x] done — Phase 2.5 added as explicit gate between Phase 2 and Phase 3

### P5-F: TS error baseline in implement-agent — DONE: yes
VERIFY PHASE ran `tsc --noEmit` but couldn't distinguish pre-existing errors from
new regressions introduced by the task. Pre-existing errors either blocked good work
or were silently accepted without distinguishing them.
- **Fix**: Capture TS error count at end of LOAD PHASE (baseline). In VERIFY PHASE
  step 1, compare delta: if `after > before`, ❌ (regression); if `delta <= 0`, ✅.
- **Status**: [x] done — baseline capture added to LOAD PHASE; delta check in VERIFY step 1

---

## Priority 6 — Structural / Long-term

### P6-A: Deduplicate startup logic across modes — DEFERRED
The backend/frontend startup block (curl health check, wait loop) is copy-pasted 4 times
in io-run.sh (uat, release-uat, integration-test, and the combined block). Any fix must
be applied 4 times.
- **Fix**: Extract `ensure_backend_running()` and `ensure_frontend_running()` as functions
  at top of script.
- **Status**: [x] done — `ensure_backend_running()` and `ensure_frontend_running()` extracted, 3 copy-pasted blocks replaced (B7-B, 2026-03-25)

### P6-B: Harden log file management — DONE: yes
`/tmp/io-uat-*.log` files accumulate across runs. No cleanup.
- **Fix**: Rotate: keep only last 3 log files per mode. Clean on script start.
- **Status**: [x] done — `rotate_logs()` function added to io-run.sh, called before
  each backend/frontend start in uat mode

### P6-C: Add registry backup — DONE: partial
A backup was made manually (comms/AUDIT_PROGRESS.json.bak during P2 state fixes).
Agents now use atomic writes (P1-G) which eliminates the corruption window.
A `restore-backup` command would be nice but not critical.
- **Status**: [ ] deferred — atomic writes (P1-G) solve the root cause

---

## Execution Order

Work top-to-bottom within each priority. Each item updates its `Status` line to `[x] done`.

**Batch 1 (DONE):**
- [x] P1-A through P1-G: io-run.sh fixes
- [x] P2-A: Unstick DD-29-017
- [x] P2-B: Reset 63 fail tasks

**Batch 2 (DONE):**
- [x] P2-F: integrity check function
- [x] P3-A through P3-C: loop closure
- [x] P6-B: log file cleanup

**Batch 3 (DONE):**
- [x] P4-A, P4-C, P4-D: implement-agent hardening
- [x] P5-A, P5-B: UAT depth improvements

**Batch 4 (DONE):**
- [x] P5-D: uat-agent Phase 0 seed data pre-check
- [x] P5-E: uat-agent Phase 2.5 data flow scenario enforcement gate
- [x] P5-F: implement-agent TS error baseline + delta regression detection

**Batch 5 (DONE):**
- [x] C1: git clean -fd after CYCLE_DETECTED in implement-agent (untracked files left behind)
- [x] C5: PROGRESS_FILE backup after every write in orchestrator (was only once per session)
- [x] C6: Lock file cleanup trap in io-run.sh + EXIT trap for implement/audit/full mode
- [x] C7: LAST_ROUND.json write: remove `|| true`, add warning on failure
- [x] C8: Exit codes for implement/audit/full modes (was always exit 0)
- [x] H1: browser_error verdict clarification in uat-agent (crash recovery contradicted Phase 5)
- [x] H2: psql error handling in Phase 0 (auth errors produced non-numeric output, broke evaluation)
- [x] H7: N/A — uat mode query already includes uat_status:partial units; they are re-queued automatically

**Deferred — medium (third review findings — all now done via B6/B7):**
- [x] C2: Cycle detection redesigned — changed_files list comparison replaces sha256 hash (B6-G, 2026-03-25)
- [x] C3: LOAD PHASE now enforces spec_doc and cx-contracts reading (B6-F, 2026-03-25)
- [x] C4: Data flow scenario template replaced with structured 4-step template requiring API endpoint and DOM evidence (B6-E, 2026-03-25)
- [x] H3: Per-scenario browser reset added to Phase 4 loop (B7-A, 2026-03-25)
- [x] H4: VERIFY phase now includes SQLx check, API shape check, circular import detection (B6-D, 2026-03-25)
- [x] H5: Scope enforcement added at X1b — out-of-scope files reverted automatically (B6-C, 2026-03-25)
- [x] H6: queue[] updated with tasks_uat_added counter when UAT creates bug tasks (B6-A, 2026-03-25)
- M1: verified_since_last_audit stuck on MOD-CONSOLE (status: in_progress, not re-audit-eligible) — no longer relevant, MOD-CONSOLE now has verified tasks
- [x] M4: Escalation verdicts surfaced — orchestrator prints one-liner and appends to ESCALATION_SUMMARY.md (B6-B, 2026-03-25)

**Known systemic limits (UAT will never catch these regardless of protocol):**
- Slow data flow bugs (>3s) — UAT waits 3s max
- Multi-user race conditions — single browser session
- Visual/layout regressions — accessibility tree only, no pixel comparison
- Mobile viewport bugs — tests at desktop resolution unless agent explicitly sets viewport
- Cross-browser bugs — defaults to Chromium only
- Cross-module integration failures — each unit tested in isolation
- Performance regressions — no timing benchmarks
- API/schema breaking changes — no backward-compatibility checks

**Deferred — low (not blocking):**
- P2-C: tasks_open sync (cosmetic)
- P3-D: auto-chain UAT+implement
- P4-B: wave gate for implement
- P5-C: independent spec gate
- [x] P6-A: deduplicate startup logic — done (B7-B, 2026-03-25)
- P6-C: restore-backup command (added; auto-backup deferred)

---

## Notes

- Each fix to io-run.sh requires `bash -n io-run.sh` to pass before saving
- Agents (uat-agent.md, implement-agent.md, etc.) are markdown — syntax check via grep
- AUDIT_PROGRESS.json changes require `python3 -c "import json; json.load(open('comms/AUDIT_PROGRESS.json'))"` to pass
- All Python in io-run.sh is inline heredoc — test each block individually before committing
