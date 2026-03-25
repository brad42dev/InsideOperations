# io-orchestrator Fix Plan
_Created: 2026-03-25. Based on gap analysis comparing IO_ORCHESTRATOR_PLAN.md + IO_ORCHESTRATOR_DISCUSSION.md against live implementation._
_Update the `[ ]` checkboxes and status lines as work completes. This file is the source of truth for all fix waves._

---

## Context

A deep-dive gap analysis found that while Waves 1–5 of the orchestrator plan shipped, several planned features were deferred or never implemented. This plan tracks fixing them in priority order.

**Key files:**
- Orchestrator runner: `io-run.sh`
- DB schema: `comms/schema.sql`
- DB migration: `comms/migrate_to_sqlite.py`
- Live DB: `comms/tasks.db`
- Config: `io-orchestrator.config.json`
- Agents: `.claude/agents/*.md`

**Conventions:**
- All SQLite writes use `PRAGMA journal_mode=WAL` + `PRAGMA busy_timeout=10000`
- All agent files use `{{TOKEN}}` placeholders expanded by `expand_agent_tokens()` in io-run.sh
- `io-run.sh` is called via `pid=$(launch_agent_in_worktree ...)` — all stdout except `echo $!` must go to stderr

---

## Wave A — Stale Task Watchdog + Rate Limit Backoff
**Status: [x] COMPLETE — 2026-03-25**
**Priority: CRITICAL — tasks can hang indefinitely; rate limits cause silent failures**

### A1: Stale Task Reclaim Watchdog

**Problem:** When an agent crashes or is force-killed, the task stays in `status='implementing'` forever with a stale `claimed_at`. Nothing reclaims it.

**Planned behavior (from discussion):** Heartbeat-gated reclaim — if `claimed_at` is older than `stale_task_threshold_min` AND no heartbeat has been written recently, reset the task to `pending` and increment `attempt_count`.

**What to build in `io-run.sh`:**

Add a `reclaim_stale_tasks()` function that:
1. Queries `io_tasks` for rows where `status = 'implementing'` AND `claimed_at < now - CFG_STALE_MINUTES`
2. For each, checks if `docs/state/{unit}/{task_id}/CURRENT.md` has been updated within the stale window (heartbeat check)
3. If no recent heartbeat: sets `status='pending'`, clears `claimed_at`/`claimed_by`, increments `attempt_count`
4. Prints a warning for each reclaimed task

Call `reclaim_stale_tasks()`:
- At the top of the main implement loop (before each batch)
- At the start of `auto` mode before checking pending count

**Schema:** No changes needed — `claimed_at`, `claimed_by`, `attempt_count` already exist.

**Acceptance criteria:**
- [x] `reclaim_stale_tasks()` function exists in io-run.sh
- [x] Called before every implement batch in both `implement` mode and `auto` mode
- [x] Tasks stuck in `implementing` for > CFG_STALE_MINUTES with no heartbeat are reset to `pending`
- [x] Reclaimed tasks have `attempt_count` incremented
- [x] Warning printed: "⚠ Reclaimed stale task {id} (stuck for Xm, attempt N)"
- [x] Tasks at `attempt_count >= CFG_MAX_IMPL_ATTEMPTS` are set to `failed` instead of `pending`

---

### A2: Rate Limit Backoff in implement-agent

**Problem:** When the Claude API returns a rate limit error, `launch_agent_in_worktree` exits non-zero and the task is marked `failed`. No retry.

**What to build in `io-run.sh`:**

Modify the `run_parallel_implement` batch loop:
- After `wait "$pid"` returns non-zero, inspect the agent's worktree CURRENT.md for a `rate_limited: true` signal written by the agent
- If rate limited: sleep 60s, then re-queue the task as `pending` (don't count as a failure)
- Add `CFG_RATE_LIMIT_BACKOFF_SEC` config field (default 60)

**What to add to `io-orchestrator.config.json`:**
```json
"rate_limit_backoff_sec": 60
```

**What to add to `io-run.sh` `load_config()`:**
```bash
CFG_RATE_LIMIT_BACKOFF_SEC=60   # in both fallback blocks
```
And in the python config reader:
```python
print(f"CFG_RATE_LIMIT_BACKOFF_SEC={ag.get('rate_limit_backoff_sec', 60)!r}")
```

**What to add to `implement-agent.md`:**
In the EXIT PROTOCOL section — before writing final status, detect rate limit:
- If claude's own output contains "rate limit" or exit code is 429-related, write `rate_limited: true` to CURRENT.md header
- Do NOT mark task as failed

**Acceptance criteria:**
- [x] `CFG_RATE_LIMIT_BACKOFF_SEC` config field exists and is loaded
- [x] `run_parallel_implement` checks CURRENT.md for `rate_limited: true` after agent exits non-zero
- [x] Rate-limited tasks are reset to `pending` with a 60s sleep, not marked `failed`
- [x] implement-agent writes `rate_limited: true` when it detects rate limit errors
- [x] Warning printed: "⚠ Task {id} rate-limited — waiting 60s then re-queuing"

---

### Wave A Completion Checklist
- [x] A1 stale watchdog implemented and tested
- [x] A2 rate limit backoff implemented
- [x] `bash -n io-run.sh` passes clean
- [x] Update this file: mark Wave A complete, update status line above

---

## Wave B — File Overlap Conflict Detection
**Status: [x] COMPLETE — 2026-03-25**
**Priority: HIGH — parallel agents can silently corrupt each other's work**

### B1: Schema — `io_task_files` Table

**Problem:** No mechanism prevents two parallel agents from modifying the same file.

**Add to `comms/schema.sql`:**
```sql
-- Per-task file ownership. Populated by audit-runner at task creation,
-- confirmed by implement-agent at completion. Used by claim logic to
-- prevent two agents from touching the same file simultaneously.
CREATE TABLE IF NOT EXISTS io_task_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT NOT NULL REFERENCES io_tasks(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,   -- repo-relative path
    status      TEXT NOT NULL DEFAULT 'predicted',  -- 'predicted' | 'confirmed'
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_task_files_task_id  ON io_task_files(task_id);
CREATE INDEX IF NOT EXISTS idx_task_files_path     ON io_task_files(file_path);
```

**Add to `comms/migrate_to_sqlite.py` `upgrade_schema()`:**
- Add `io_task_files` table creation to the upgrade path so existing DBs get it without full re-migration

**Acceptance criteria:**
- [x] Table exists in `comms/schema.sql`
- [x] `migrate_to_sqlite.py --upgrade` creates the table on existing DBs
- [x] `python3 comms/migrate_to_sqlite.py --verify` passes

---

### B2: Conflict Check in `claim_next_task()`

**Problem:** `claim_next_task()` in `io-run.sh` only checks task status. It doesn't check if a candidate task's predicted files are already being touched by an active agent.

**What to add to `claim_next_task()` in `io-run.sh`:**

After selecting a candidate task but before `UPDATE ... SET status='implementing'`:
1. Look up predicted files for the candidate in `io_task_files` where `status='predicted'`
2. Look up files for all currently-implementing tasks in `io_task_files`
3. If any overlap: skip this task and try the next candidate
4. If no overlap (or no predicted files): proceed with claim

The conflict check query (within the same `BEGIN IMMEDIATE` transaction):
```sql
-- Files owned by currently-implementing tasks
SELECT DISTINCT tf.file_path
FROM io_task_files tf
JOIN io_tasks t ON t.id = tf.task_id
WHERE t.status = 'implementing'
  AND tf.file_path IN (
      SELECT file_path FROM io_task_files WHERE task_id = ?
  )
```

If this returns any rows, skip the candidate.

**Acceptance criteria:**
- [x] `claim_next_task()` checks for file conflicts before claiming
- [x] Two agents never simultaneously claim tasks with overlapping predicted files
- [x] Tasks with no predicted files in `io_task_files` are claimed without restriction (backwards compatible)
- [x] Conflict skip is logged: "  Skipping {id} — file conflict with active task {other_id}"

---

### B3: Populate Predicted Files from Task Spec

**Problem:** `io_task_files` is empty unless something populates it. The easiest source is the task `.md` file body — it usually lists files in a "Files to change" or "Target files" section.

**What to add to `comms/migrate_to_sqlite.py`:**

Add a `populate_predicted_files()` function that:
1. For each task in `io_tasks` that has a `spec_body`
2. Extracts file paths using a regex: lines matching `` `path/to/file` `` or `path/to/file.rs` within "Files" sections
3. Inserts them into `io_task_files` with `status='predicted'`
4. Skips tasks that already have rows in `io_task_files`

Add `--populate-files` argument to the CLI to invoke it.

**What to add to `implement-agent.md` EXIT PROTOCOL:**
After completing work, write confirmed changed files:
```python
# In EXIT PROTOCOL — after verifying the task
changed = [list of files actually modified, from git diff --name-only HEAD~1]
for f in changed:
    con.execute("""
        INSERT OR IGNORE INTO io_task_files(task_id, file_path, status)
        VALUES (?, ?, 'confirmed')
    """, (TASK_ID, f))
```

**Acceptance criteria:**
- [x] `migrate_to_sqlite.py --populate-files` parses spec_body and inserts predicted files
- [x] implement-agent writes confirmed files to `io_task_files` at exit
- [x] `io_task_files` has rows for at least 50% of tasks after running `--populate-files` (73% achieved)

---

### Wave B Completion Checklist
- [x] B1 schema done + --upgrade path works
- [x] B2 conflict check in claim_next_task
- [x] B3 populate_predicted_files + implement-agent exit writes
- [x] `bash -n io-run.sh` passes clean
- [x] Update this file: mark Wave B complete

---

## Wave C — Queue-Aware Auto Mode + Wave Kill Switch
**Status: [x] COMPLETE — 2026-03-25**
**Priority: MEDIUM — auto mode is functional but not optimal**

### C1: Queue-Aware Agent Allocation in `auto` Mode

**Problem:** Current `auto` mode does implement-all then UAT-all serially by type. The discussion planned proportional allocation: inspect queue, allocate agents by work ratio.

**Planned algorithm (from discussion):**
- Count pending implement tasks vs pending UAT units
- Allocate agents proportionally: if 80% of work is implement and 20% is UAT, run 4 implement + 1 UAT in parallel
- Minimum: always run at least 1 of each type if both have work
- If only one type has work: give it all agents

**What to change in `auto` mode:**

Replace the current "implement all → UAT all" sequential cycle with a work-aware batch dispatcher:
1. Count `pending_impl` = tasks with status pending/failed
2. Count `pending_uat` = units with uat_status NULL or partial
3. Total work = pending_impl + pending_uat
4. Allocate: `impl_slots = ceil(AUTO_PARALLEL * pending_impl / total_work)`, `uat_slots = AUTO_PARALLEL - impl_slots`
5. Launch `impl_slots` implement agents + `uat_slots` UAT agents IN PARALLEL in the same batch
6. Wait for all, collect results
7. Repeat until nothing left

This eliminates the artificial implement-then-UAT sequencing and uses all agents efficiently at all times.

**Acceptance criteria:**
- [x] `auto` mode computes impl_slots and uat_slots before each batch
- [x] Both implement and UAT agents can run simultaneously in the same batch
- [x] Slot allocation prints: "  Batch N: {impl_slots} implement + {uat_slots} UAT agents"
- [x] Proportional allocation tested: when 75% impl work, ~75% of agents do implement

---

### C2: Wave-Level Kill Switch

**Problem:** If N consecutive implement cycles produce zero verified tasks, something is wrong. The system should alert and stop rather than loop indefinitely.

**What to add to `io-run.sh`:**

Track `CONSECUTIVE_ZERO_IMPL` counter:
- Reset to 0 whenever at least one task is verified in a batch
- Increment when a batch completes with 0 verified tasks
- If counter reaches `CFG_MAX_ZERO_WAVES` (default 3): print alert, set `AUTO_ROUND_FAILED=1`, break

Add `CFG_MAX_ZERO_WAVES=3` to config and both load_config fallback blocks.

**Acceptance criteria:**
- [x] `CFG_MAX_ZERO_WAVES` config field loaded
- [x] Counter tracks consecutive zero-verified batches
- [x] After N consecutive zero batches: alert printed + loop exits with failure
- [x] Counter resets correctly when work is done

---

### Wave C Completion Checklist
- [x] C1 queue-aware allocation implemented
- [x] C2 kill switch implemented
- [x] `bash -n io-run.sh` passes clean
- [x] Update this file: mark Wave C complete

---

## Wave D — Catcher Agent + Context Package Pre-computation
**Status: [x] COMPLETE — 2026-03-25**
**Priority: MEDIUM — efficiency improvement; not blocking**

### D1: Catcher Agent

**Problem:** The discussion planned a "catcher agent" — a lightweight non-blocking agent that runs fact-finding enrichment on tasks before they're claimed by implement-agent. This reduces the context an implement-agent wastes on self-discovery.

**What to build:**

Create `.claude/agents/catcher-agent.md`:
- Input: a task ID
- Reads the task spec_body
- Resolves: which files exist for the mentioned components, what the current implementation looks like, what spec says vs what code says
- Writes enrichment to `comms/context/{task_id}.md` (a pre-computed context package)
- Does NOT modify task status — purely additive
- Short-circuits gracefully if task has already been enriched

The catcher agent should be cheap and fast — it just reads files and writes a summary. Model: claude-haiku-4-5 (fast, cheap).

**Wire into `io-run.sh`:**
- After `run_unblock_pass()`, launch catcher agents for all pending tasks that don't have a context package yet
- Run up to `AUTO_PARALLEL` catchers in parallel, don't wait for them (fire and forget via `&`)
- Context packages are optional — implement-agent uses them if present, self-discovers if not

**What to add to implement-agent:**
In the STARTUP section — check for `comms/context/{TASK_ID}.md` and prepend it to the working context if present.

**Schema addition:**
```sql
ALTER TABLE io_tasks ADD COLUMN context_enriched_at TEXT;  -- ISO timestamp; NULL if not enriched
```
Add via `--upgrade` in `migrate_to_sqlite.py`.

**Acceptance criteria:**
- [x] `.claude/agents/catcher-agent.md` exists with full agent protocol
- [x] `comms/context/` directory used for pre-computed context packages
- [x] Catcher launched fire-and-forget for pending tasks without context packages
- [x] implement-agent prepends context package if available
- [x] `context_enriched_at` column tracks enrichment timestamp

---

### D2: Context Package Schema Columns

**Problem:** No tracking of context efficiency metrics — can't tell if enrichment is helping.

**Add to `comms/schema.sql` in `io_task_attempts`:**
```sql
context_injection_tokens  INTEGER,   -- tokens at start of agent session
context_final_tokens      INTEGER,   -- tokens at end of session
context_utilization_pct   REAL       -- final/max * 100
```

**Add via `migrate_to_sqlite.py --upgrade`.**

**What to add to implement-agent EXIT PROTOCOL:**
Write context metrics if available (claude doesn't expose exact token counts directly, but utilization % is shown in context bar — agent should record approximate value if visible).

**Acceptance criteria:**
- [x] Columns exist in schema and --upgrade path
- [x] implement-agent writes approximate utilization if detectable
- [x] `./io-run.sh status` shows average context utilization across recent attempts

---

### Wave D Completion Checklist
- [x] D1 catcher agent written and wired
- [x] D2 context columns in schema + --upgrade
- [x] status command shows context metrics
- [x] Update this file: mark Wave D complete

---

## Wave E — Context Utilization in Status + Miscellaneous Cleanup
**Status: [ ] not started**
**Priority: LOW — polish and observability**

### E1: Status Command Context Metrics

Show average context utilization, enrichment rate, and file overlap avoidance stats in `./io-run.sh status`.

### E2: AUDIT_PROGRESS.json Demotion

`io-orchestrator.config.json` still lists `registry_file: "comms/AUDIT_PROGRESS.json"` and `never_touch` includes it. This is confusing — SQLite is authoritative.

**Changes:**
- Remove `registry_file` from config (or rename to `registry_file_backup`)
- Add a comment to AUDIT_PROGRESS.json noting it's a read-only backup
- Remove from `never_touch` (it's never written; no need to protect it)
- Add `comms/context/` to `never_touch` (context packages shouldn't be overwritten by agents)

### E3: Merge Conflict Recovery

When `merge_completed_branches()` hits a conflict, it renames the branch `CONFLICT-{task_id}` and moves on. But no automated recovery exists.

Add to `io-run.sh`: after `merge_completed_branches()`, check for `CONFLICT-*` branches and print clear remediation instructions (3-way diff command, how to resolve and re-merge).

### E4: Test Project Validation Script

Wave 5 acceptance criterion: "Running the full pipeline on a NEW empty test project works end-to-end." Never validated.

Create `scripts/test-orchestrator-install.sh` that:
1. Creates a temp dir with a minimal project structure
2. Copies io-orchestrator files into it
3. Runs `./io-run.sh status` and verifies it exits 0
4. Cleans up

### Wave E Completion Checklist
- [ ] E1 context metrics in status
- [ ] E2 AUDIT_PROGRESS.json demotion cleaned up
- [ ] E3 merge conflict remediation instructions
- [ ] E4 test project validation script
- [ ] Update this file: mark Wave E complete

---

## Wave F — Standalone Repo Extraction
**Status: [ ] not started**
**Priority: FUTURE — only needed when distributing to other projects**

This wave extracts io-orchestrator into its own git repo so it can be installed into any project.

Files that belong in the standalone repo:
- `io-run.sh`
- `.claude/agents/*.md` (all orchestrator agents)
- `comms/schema.sql`
- `comms/migrate_to_sqlite.py`
- `io-orchestrator.config.json` (as a template: `io-orchestrator.config.example.json`)
- `scripts/` (any install/update scripts)

Files that stay in the project repo:
- `comms/tasks.db` (project-specific state)
- `comms/AUDIT_PROGRESS.json` (backup)
- `docs/tasks/`, `docs/state/`, `docs/uat/`, etc. (project work product)

**Deliverables:**
- [ ] Standalone repo structure defined
- [ ] `install.sh` — copies orchestrator files into a target project, creates config template
- [ ] `io-orchestrator-update.sh` — safe update that merges new orchestrator version into existing project (3-way merge, preserves project config)
- [ ] README for standalone repo

---

## Wave Prompts

Use these prompts after compaction to start each wave. The wave prefix gets you started; always read this file first.

### Wave A Start Prompt
```
Read docs/ORCHESTRATOR_FIX_PLAN.md fully, then read io-run.sh and .claude/agents/implement-agent.md.

You are implementing Wave A of the orchestrator fix plan: stale task watchdog (A1) and rate limit backoff (A2).

Complete all Wave A acceptance criteria. When done:
1. Mark Wave A complete in docs/ORCHESTRATOR_FIX_PLAN.md
2. Run bash -n io-run.sh to verify syntax
3. Give me the Wave B start prompt from this file
```

### Wave B Start Prompt
```
Read docs/ORCHESTRATOR_FIX_PLAN.md fully, then read io-run.sh, comms/schema.sql, comms/migrate_to_sqlite.py, and .claude/agents/implement-agent.md.

You are implementing Wave B of the orchestrator fix plan: file overlap conflict detection (B1, B2, B3).

Complete all Wave B acceptance criteria. When done:
1. Mark Wave B complete in docs/ORCHESTRATOR_FIX_PLAN.md
2. Run bash -n io-run.sh and python3 comms/migrate_to_sqlite.py --verify to check
3. Give me the Wave C start prompt from this file
```

### Wave C Start Prompt
```
Read docs/ORCHESTRATOR_FIX_PLAN.md fully, then read io-run.sh (especially the auto mode section starting around the auto mode comment) and io-orchestrator.config.json.

You are implementing Wave C of the orchestrator fix plan: queue-aware auto mode (C1) and wave kill switch (C2).

Complete all Wave C acceptance criteria. When done:
1. Mark Wave C complete in docs/ORCHESTRATOR_FIX_PLAN.md
2. Run bash -n io-run.sh to verify syntax
3. Give me the Wave D start prompt from this file
```

### Wave D Start Prompt
```
Read docs/ORCHESTRATOR_FIX_PLAN.md fully, then read io-run.sh, comms/schema.sql, comms/migrate_to_sqlite.py, and .claude/agents/implement-agent.md.

You are implementing Wave D of the orchestrator fix plan: catcher agent (D1) and context package schema (D2).

Complete all Wave D acceptance criteria. When done:
1. Mark Wave D complete in docs/ORCHESTRATOR_FIX_PLAN.md
2. Run python3 comms/migrate_to_sqlite.py --upgrade and --verify
3. Give me the Wave E start prompt from this file
```

### Wave E Start Prompt
```
Read docs/ORCHESTRATOR_FIX_PLAN.md fully, then read io-run.sh, io-orchestrator.config.json, and comms/schema.sql.

You are implementing Wave E of the orchestrator fix plan: status metrics (E1), AUDIT_PROGRESS.json cleanup (E2), merge conflict recovery (E3), and test validation script (E4).

Complete all Wave E acceptance criteria. When done:
1. Mark Wave E complete in docs/ORCHESTRATOR_FIX_PLAN.md
2. Run bash -n io-run.sh to verify syntax
3. Summarize what remains (Wave F) and whether it's worth doing now
```
