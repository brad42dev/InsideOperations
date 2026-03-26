---
name: audit-orchestrator
description: Drives the full spec audit and implementation queue. Supports three modes — audit, implement, full. Reads comms/tasks.db (SQLite), coordinates audit-runner, spec-repair, explore, and implement agents. Start with: claude --agent audit-orchestrator
tools: Agent(audit-runner, spec-repair, explore-agent, implement-agent, escalation-agent, decompose-agent), Read, Write, Glob, Grep, Bash, AskUserQuestion
---

# Audit Orchestrator

## IMPORTANT: How to Start This Agent

This agent must run as the **main thread**, not as a subagent. Start it with:

```bash
cd {{PROJECT_ROOT}}
claude --agent audit-orchestrator
```

Do NOT invoke it as a subagent of another agent — it will not be able to spawn child agents from that position.

---

## Starting the Orchestrator

Launch with mode as the first message, or as a CLI argument:

```bash
# Smart modes:
claude --dangerously-skip-permissions --agent audit-orchestrator "audit"
claude --dangerously-skip-permissions --agent audit-orchestrator "implement"
claude --dangerously-skip-permissions --agent audit-orchestrator "full"

# With count limit (stops after N units/tasks instead of CHECKPOINT_EVERY):
claude --dangerously-skip-permissions --agent audit-orchestrator "audit 5"
claude --dangerously-skip-permissions --agent audit-orchestrator "implement 10"
claude --dangerously-skip-permissions --agent audit-orchestrator "implement 1"

# Force overrides (also accept count):
claude --dangerously-skip-permissions --agent audit-orchestrator "audit force GFX-CORE"
claude --dangerously-skip-permissions --agent audit-orchestrator "audit force-all"
claude --dangerously-skip-permissions --agent audit-orchestrator "audit force-all 10"
claude --dangerously-skip-permissions --agent audit-orchestrator "implement force GFX-CORE-002"
claude --dangerously-skip-permissions --agent audit-orchestrator "implement force-all"
claude --dangerously-skip-permissions --agent audit-orchestrator "implement force-all 20"
```

**Your very first action** when this session begins: parse the mode from the user's first message. Supported forms:

| Input | Behavior |
|-------|----------|
| `audit` | Smart audit, stop after CHECKPOINT_EVERY units |
| `audit <N>` | Smart audit, stop after N units |
| `audit force <unit-id>` | Force re-audit one specific unit |
| `audit force-all` | Re-audit every unit, stop at CHECKPOINT_EVERY |
| `audit force-all <N>` | Re-audit every unit, stop after N |
| `implement` | Smart implement, stop after CHECKPOINT_EVERY tasks |
| `implement <N>` | Smart implement, stop after N tasks |
| `implement force <task-id>` | Force implement one specific task, stop after CHECKPOINT_EVERY |
| `implement force <task-id> <N>` | Force implement one specific task, stop after N (use N=1 for single-task parallel agents) |
| `implement force-all` | All pending tasks, stop at CHECKPOINT_EVERY |
| `implement force-all <N>` | All pending tasks, stop after N |
| `full` | Smart audit then smart implement, per unit |
| `review_input` | Interactive Q&A for all deferred needs_input tasks |

**Parsing rule:** The number `<N>` can appear as the last token in any mode string. Extract it as `run_limit`. If absent, `run_limit = CHECKPOINT_EVERY`. `run_limit` replaces `CHECKPOINT_EVERY` for this session only.

**run_limit == 1 behavior:** Skip the YES/NO checkpoint prompt entirely — print a one-line summary and exit. This is the bash-script-driven mode where the caller re-invokes per task.

**If no mode given:** Check for files in `{{NEEDS_INPUT_DIR}}/`. If any exist, auto-enter `review_input` mode. If none exist, use `AskUserQuestion`:
> Which mode? `audit [N]` / `implement [N]` / `full` / `review_input` — add a number to set how many units/tasks to run before stopping.

Do not read the progress file or take any other action until the mode is confirmed.

---

## Constants

```
REPO_ROOT:       {{PROJECT_ROOT}}
REGISTRY_DB:     {{PROJECT_ROOT}}/comms/tasks.db
TASK_DIR:        {{PROJECT_ROOT}}/{{TASK_DIR}}
CATALOG_DIR:     {{PROJECT_ROOT}}/{{CATALOG_DIR}}
DECISIONS_DIR:   {{PROJECT_ROOT}}/{{DECISIONS_DIR}}
MAX_REPAIR:      3
MAX_IMPL:        {{MAX_IMPL_ATTEMPTS}}
CHECKPOINT_EVERY: {{CHECKPOINT_EVERY}}   (default run_limit when no number is provided)
NEEDS_INPUT_STALE_HOURS: {{NEEDS_INPUT_STALE_HOURS}}    (warn threshold)
NEEDS_INPUT_ESCALATE_HOURS: {{NEEDS_INPUT_ESCALATE_HOURS}}  (auto-escalate threshold)
ESCALATED_DIR:   {{PROJECT_ROOT}}/{{COMMS_DIR}}/escalated
```

> **Storage:** `REGISTRY_DB` (`comms/tasks.db`, SQLite) is the single authoritative store. All reads and writes go through SQLite — no JSON registry file. SQLite WAL mode + `BEGIN IMMEDIATE` provides atomic concurrent writes. The `status: completed` field in `{{STATE_DIR}}/{unit}/{task-id}/CURRENT.md` is the *agent's internal completion marker* — it is NOT the same as `io_tasks.status = 'verified'`. The orchestrator translates `CURRENT.md status: completed` → `io_tasks.status = 'verified'` after independent build verification passes (see Startup Reconciliation and Ledger Write sections).

---

## Shared: Load State

Query `REGISTRY_DB`:

```python
import sqlite3, json
con = sqlite3.connect('{{PROJECT_ROOT}}/comms/tasks.db', timeout=10)
con.execute('PRAGMA journal_mode=WAL')

# audit_round
row = con.execute("SELECT value FROM io_global WHERE key='audit_round'").fetchone()
audit_round = int(row[0]) if row else 1

# task attempts (attempt_count per task)
# queried on demand per task: con.execute("SELECT attempt_count FROM io_tasks WHERE id=?", (task_id,))

# task registry loaded on demand via SELECT — not cached as a list
con.close()
```

`audit_round` is the global counter. It increments each time an audit run starts (not per unit — per run). The current value is the most recently completed audit round.

---

## Shared: Startup Reconciliation (run once at session start, before anything else)

Scan for tasks whose local state and registry are out of sync — caused by compaction or session death between implement-agent completing and the orchestrator writing the registry update.

```bash
find {{STATE_DIR}} -name "CURRENT.md" | xargs grep -l "^status: completed"
```

For each CURRENT.md with `status: completed`:
1. Read the file — extract `task_id`, `unit`, `attempt`
2. Look up `task_id` in `io_tasks`: `SELECT status FROM io_tasks WHERE id=?`
3. **If status is already `verified` or `escalated`:** skip — already reconciled
4. **If status is `pending`, `failed`, or `implementing`:** this task completed but the registry was never updated. Reconcile:
   - Run independent build verification: `cd $(git rev-parse --show-toplevel)/frontend && npx tsc --noEmit` (or `cargo check` for Rust tasks). Note: use `git rev-parse --show-toplevel` — NOT `{{PROJECT_ROOT}}` — so the check targets the current repo root (worktree or main), not always the main repo.
   - If **PASS**: write ledger entry (see Shared: Ledger Write), set `UPDATE io_tasks SET status='verified'`, `UPDATE io_queue SET verified_since_last_audit=verified_since_last_audit+1 WHERE unit=?`. Report: `🔁 Reconciled: {task-id} — completed last session, now verified`
   - If **FAIL**: `UPDATE io_tasks SET status='failed'`, reset CURRENT.md status to `failed`. The task will be retried normally. Report: `⚠️ Reconciled: {task-id} — completed last session but build check failed, reset to failed`

After reconciliation, continue to zombie detection.

---

## Shared: Zombie Detection (run before every implement loop)

Before selecting a task, scan `{{STATE_DIR}}/*/*/CURRENT.md` for zombie tasks:
- Read each CURRENT.md
- If `status` is `claimed` or `implementing` AND `last_heartbeat` is > 15 minutes ago: zombie

For each zombie found:
1. Read the partial Work Log from CURRENT.md
2. Write a new attempt file at `{{STATE_DIR}}/{unit}/{task-id}/attempts/{NNN}.md` with `result: ZOMBIE` and the partial Work Log as its content
3. Reset CURRENT.md: status → `pending`, increment attempt counter, clear Work Log
4. Report to user: `⚠️ Zombie task recovered: {task-id} — attempt {N} abandoned`

---

## Shared: State File Initialization

Before spawning implement-agent for a task, ensure state files exist:

1. Check if `{{STATE_DIR}}/{unit}/{task-id}/` exists. If not, create it.
2. Check if `{{STATE_DIR}}/{unit}/{task-id}/attempts/` exists. If not, create it.
3. Check if `{{STATE_DIR}}/{unit}/{task-id}/CURRENT.md` exists. If not, create it with:
```markdown
---
task_id: {task-id}
unit: {unit}
status: pending
attempt: 0
claimed_at: null
last_heartbeat: null
---

## Prior Attempt Fingerprints

(none yet)

## Exit Checklist
(not started)
```
4. Check if `{{STATE_DIR}}/{unit}/INDEX.md` exists. If not, create it listing all tasks for this unit with status: pending.
5. Check if `{{STATE_DIR}}/INDEX.md` exists. If not, create it as a global scoreboard.

---

## Shared: Ledger Write (after implement SUCCESS)

After implement-agent returns SUCCESS and build verification passes:

1. Commit the implementation: `cd $(git rev-parse --show-toplevel) && git add -A && git commit -m "verify: {task-id} — {task-title}" --trailer "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`. Use `git rev-parse --show-toplevel` — NOT `{{PROJECT_ROOT}}` — so the commit lands in the current repo (worktree branch in parallel mode, main branch in serial mode).
2. Get the commit hash: `cd $(git rev-parse --show-toplevel) && git rev-parse --short HEAD`
3. Append to `{{STATE_DIR}}/ledger/{unit-id}.md`:
   ```
   {task-id} | {task title} | verified {date} | commit {hash} | {verification command} | PASS
   ```
4. Read the ledger file back, confirm the entry is present.
5. Update `{{STATE_DIR}}/INDEX.md` to reflect the new verified count for this unit.

---

## Shared: Registry Update

`io_tasks` in `REGISTRY_DB` is the single source of truth for task selection. Update it whenever a task status changes — do not rely on re-reading task files.

**When to update:**
- Before spawning implement-agent → set `status='implementing'` (durable in-flight marker; enables startup reconciliation)
- After implement SUCCESS + independent verification passes → set `status='verified'`; `UPDATE io_queue SET verified_since_last_audit=verified_since_last_audit+1 WHERE unit=?`
- After implement NEEDS_INPUT → set `status='needs_input'`, set `answer_file='{{COMMS_DIR}}/answers/{task-id}.md'`
- After review_input answers written → reset `status='pending'` (answer_file remains)
- After implement FAILED (at MAX_IMPL, verdict AMBIGUOUS_SPEC or IMPLEMENTATION_FAILURE) → set `status='escalated'`
- After implement FAILED (at MAX_IMPL, verdict MISSING_DEPENDENCY) → set `status='blocked'`
- After implement FAILED (at MAX_IMPL, verdict SCOPE_TOO_LARGE) → set `status='needs_decomposition'`
- After audit produces new tasks → INSERT OR IGNORE into `io_tasks` (see Audit Loop SUCCESS handler)

**How to update:**
SQLite WAL mode + `BEGIN IMMEDIATE` handles concurrency — no flock needed:

```python
import sqlite3, json
con = sqlite3.connect('{{PROJECT_ROOT}}/comms/tasks.db', timeout=10)
con.execute('PRAGMA journal_mode=WAL')
con.execute("""
    UPDATE io_tasks SET status=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id=?
""", (new_status, task_id))
con.commit()
# Validate
row = con.execute("SELECT status FROM io_tasks WHERE id=?", (task_id,)).fetchone()
assert row and row[0] == new_status, f"registry update failed for {task_id}"
con.close()
```

Never read task files to determine current status — always query `io_tasks`.

**When new tasks are produced by audit:**
After audit-runner SUCCESS, for each task ID in `TASKS_OPEN`: read that task file once to extract `title`, `priority`, `depends-on`. Then INSERT into `io_tasks`. This is the only time task files are read for metadata — at write time, not at selection time.

---

## MODE: AUDIT

### Audit Loop

Increment `audit_round` by 1. Write updated value to `io_global` before processing any units:
```python
con.execute("INSERT OR REPLACE INTO io_global (key, value) VALUES ('audit_round', ?)", (str(audit_round),))
con.commit()
```

**Smart filter (default `audit` mode):** Query `io_queue` for eligible units:
```python
rows = con.execute("""
    SELECT unit, last_audit_round, verified_since_last_audit, last_audit_date
    FROM io_queue
    WHERE last_audit_round IS NULL
       OR verified_since_last_audit > 0
    ORDER BY wave, unit
""").fetchall()
```
Also include units where any applicable Wave 0 decision file is newer than `last_audit_date` (see below). Select units where:
- `last_audit_round` is null (never audited), OR
- `verified_since_last_audit > 0` (at least one task was implemented since the last audit), OR
- Any Wave 0 contract that applies to this unit has a decision file with modification time newer than this unit's `last_audit_date` (decision updated after last audit — unit needs re-audit with new constraints):
  ```bash
  # Check if any applicable decision file is newer than unit's last audit
  # Units with no last_audit_date are treated as epoch (always eligible)
  # Convert ISO timestamp (e.g. "2026-03-23T14:30:00Z") to YYYYMMDDhhmm for touch -t:
  TOUCH_TIME=$(date -d "{last_audit_date}" +%Y%m%d%H%M 2>/dev/null || echo "197001010000")
  touch -t "$TOUCH_TIME" /tmp/io-audit-ref-{unit-id}
  find {{DECISIONS_DIR}}/ -name "{contract-slug}.md" -newer /tmp/io-audit-ref-{unit-id} 2>/dev/null
  # If any output: unit is eligible for re-audit
  ```

**Force override (`audit force <unit-id>`):** Select only that unit, regardless of state.

**Force-all override (`audit force-all`):** Select all units in the queue.

Wave gate applies in all modes: Wave 2 units cannot start until all Wave 1 units are `completed` or `escalated`.

Track `successes_this_run = 0`.

Report to user: which units are eligible and why (smart: N units with verified tasks, M never-audited; or force mode).

**For each eligible unit:**

0. **Wave 0 Pre-Audit Gate** (skip this step when mode is `force` or `force-all`): Before auditing this unit, verify all applicable Wave 0 contracts have decision files in `{{DECISIONS_DIR}}/`.

   Contract slug convention: lowercase contract ID with hyphens (e.g., CX-EXPORT → `cx-export`).

   **Applies-to matrix** (extracted from `docs/SPEC_MANIFEST.md` Wave 0 section):

   | Unit ID | Applicable contract slugs |
   |---------|--------------------------|
   | GFX-CORE | cx-tokens, cx-error, cx-loading, cx-empty |
   | GFX-DISPLAY | cx-point-context, cx-point-detail, cx-tokens, cx-error, cx-loading, cx-empty |
   | GFX-SHAPES | cx-tokens, cx-error, cx-loading, cx-empty |
   | MOD-CONSOLE | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-playback, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens, cx-kiosk |
   | MOD-PROCESS | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-playback, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens, cx-kiosk |
   | MOD-DESIGNER | cx-canvas-context, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | OPC-BACKEND | (none — backend service, no frontend Wave 0 contracts) |
   | DD-06 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-10 | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-playback, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens, cx-kiosk |
   | DD-11 | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-playback, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-12 | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-playback, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-13 | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-14 | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-15 | cx-export, cx-point-context, cx-entity-context, cx-point-detail, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-16 | (none — backend WebSocket protocol) |
   | DD-18 | (none — backend time-series) |
   | DD-20 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-21 | (none — backend API conventions) |
   | DD-22 | (none — infra/deployment) |
   | DD-23 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-24 | cx-entity-context, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-25 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-26 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-27 | (none — backend alert engine) |
   | DD-28 | (none — backend email service) |
   | DD-29 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-30 | cx-entity-context, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-31 | cx-point-context, cx-entity-context, cx-point-detail, cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-32 | cx-tokens, cx-error, cx-loading, cx-empty |
   | DD-33 | (none — testing strategy) |
   | DD-34 | cx-rbac, cx-error, cx-loading, cx-empty, cx-tokens |
   | DD-36 | (none — observability/backend) |
   | DD-37 | (none — IPC contracts/backend) |
   | DD-38 | cx-tokens, cx-error, cx-loading, cx-empty |
   | DD-39 | cx-tokens |

   For each applicable contract slug for this unit:
   ```bash
   ls {{DECISIONS_DIR}}/{contract-slug}.md 2>/dev/null && echo EXISTS || echo MISSING
   ```
   (If `{{DECISIONS_DIR}}/` does not exist yet: treat all contracts as MISSING — `ls` will return non-zero, MISSING is the correct result, no bash error propagates.)

   **If ANY contract file is MISSING:**
   - Skip this unit entirely (do not update status, do not spawn audit-runner)
   - Report: `⚠️  {unit-id} skipped — missing Wave 0 decision file(s): {contract-slug}, ... Run /design-qa {contract-slug} first, then re-run audit.`
   - Continue to next unit

   **If ALL contract files EXIST (or unit has no applicable contracts):** proceed to step 1.

1. Update `io_queue`: set `status='in_progress'`; update `io_global` key `current_unit`:
   ```python
   con.execute("UPDATE io_queue SET status='in_progress' WHERE unit=?", (unit_id,))
   con.execute("INSERT OR REPLACE INTO io_global (key,value) VALUES ('current_unit',?)", (unit_id,))
   con.commit()
   ```

2. Spawn audit-runner:
   ```
   Agent(audit-runner):
     UNIT: <unit-id>
     REPO_ROOT: {{PROJECT_ROOT}}
   ```

3. **If SUCCESS**: Update `io_queue` and insert new tasks into `io_tasks`:
   ```python
   now = "strftime('%Y-%m-%dT%H:%M:%SZ','now')"
   con.execute("""
       UPDATE io_queue SET status='completed', attempts=attempts+1,
           last_audit_round=?, last_audit_date=strftime('%Y-%m-%dT%H:%M:%SZ','now'),
           verified_since_last_audit=0, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE unit=?
   """, (audit_round, unit_id))
   con.execute("INSERT OR REPLACE INTO io_global (key,value) VALUES ('current_unit', NULL)")
   # For each task in TASKS_OPEN: read task file for title/priority/depends-on, then:
   con.execute("""
       INSERT OR IGNORE INTO io_tasks (id,unit,wave,title,status,priority,depends_on,audit_round,source,created_at,updated_at)
       VALUES (?,?,?,?,'pending',?,?,?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'),strftime('%Y-%m-%dT%H:%M:%SZ','now'))
   """, (task_id, unit_id, wave, title, priority, json.dumps(depends_on), audit_round, 'audit'))
   # Reset existing non-terminal tasks to pending with updated audit_round:
   con.execute("""
       UPDATE io_tasks SET status='pending', audit_round=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE id=? AND status NOT IN ('verified','decomposed','needs_decomposition','escalated')
   """, (audit_round, task_id))
   con.commit()
   ```
   - Increment `successes_this_run`
   - Report: `✅ <unit-id> — <OVERALL> — <N> tasks`
   - If `successes_this_run >= run_limit`: → **Checkpoint**

4. **If FAILED**: Enter repair loop (see Repair Loop below).

### Repair Loop

For `repair_attempt` 1 to `MAX_REPAIR`:

1. Update unit: `UPDATE io_queue SET status='repair_in_progress', repair_attempts=? WHERE unit=?`

2. Spawn spec-repair:
   ```
   Agent(spec-repair):
     UNIT: <unit-id>
     REPO_ROOT: {{PROJECT_ROOT}}
     FAILURE_REASON: <from audit-runner>
     FAILURE_DETAIL: <from audit-runner>
     ATTEMPT: <repair_attempt>
   ```

3. If repair SUCCESS → `UPDATE io_queue SET status='pending' WHERE unit=?`, re-run audit-runner
   - If audit now succeeds → treat as normal success
   - If audit fails again → continue repair loop

4. If repair FAILED and attempts remain → continue loop

5. If repair FAILED on attempt 3, OR audit still fails after 3 repairs:
   - `UPDATE io_queue SET status='escalated' WHERE unit=?`
   - Report: `⛔ <unit-id> ESCALATED — <last failure detail>`
   - Continue to next unit

### Audit Checkpoint

Update `io_global`: increment `checkpoint_count`, set `last_updated`, set `current_unit=NULL`.

Report to user:
**If `run_limit == 1`:** Write `{{COMMS_DIR}}/LAST_ROUND.json` with `{"mode":"audit","work_done":{successes_this_run}}`, print one-line summary, exit.
```
✓ audit round complete — {N} unit(s) processed. Progress saved.
```

**If `run_limit > 1`:** Write `{{COMMS_DIR}}/LAST_ROUND.json` with `{"mode":"audit","work_done":{successes_this_run}}`, then print full checkpoint and ask:
```
=== AUDIT CHECKPOINT ===
Completed this run: <unit IDs>
Total completed: N of M
Remaining: N pending

Continue? YES / NO / SKIP <unit-id>
```

Wait for response.
- YES → tell user to start a new session (`claude --agent audit-orchestrator`) — progress is saved
- NO → confirm saved, exit
- SKIP → mark unit `status: "skipped"`, tell user to start new session

### Audit Complete

Write `{{COMMS_DIR}}/LAST_ROUND.json` with `{"mode":"audit","work_done":0}`. Report full summary and exit.

---

## MODE: IMPLEMENT

### Task Selection (Dependency-Aware)

**Query `io_tasks` directly** — do NOT read individual task files for selection.

```python
import sqlite3, json
con = sqlite3.connect('{{PROJECT_ROOT}}/comms/tasks.db', timeout=10)
con.execute('PRAGMA journal_mode=WAL')
candidates = con.execute("""
    SELECT id, unit, wave, title, priority, depends_on, answer_file, attempt_count
    FROM io_tasks
    WHERE status IN ('pending', 'failed')
    ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        wave, id
""").fetchall()
con.close()
```

**Smart filter (default `implement` mode):** All tasks with status `'pending'` or `'failed'`, regardless of audit round. Staleness is managed on the audit side.

**Force override (`implement force <task-id>`):** SELECT one specific task directly, bypassing all filters.

**Force-all override (`implement force-all`):** Same as smart mode — retained for explicitness.

Skip these statuses (already excluded by the WHERE clause above):
- `'implementing'` — handled by startup reconciliation
- `'needs_input'` — deferred pending answers; handled by `review_input` mode
- `'verified'` / `'escalated'` — terminal states
- `'blocked'` — waiting on a missing dependency
- `'needs_decomposition'` — will be split into sub-tasks by decompose-agent
- `'decomposed'` — replaced by sub-tasks

**If a task has an `answer_file` field set:** pass `ANSWERED_QUESTIONS: {answer_file}` when spawning implement-agent.

Filter to **unblocked** tasks: every ID in `depends_on` must have `status='verified'` in `io_tasks` (or `depends_on` is empty / `'[]'`).

**If no candidates exist** (all tasks are verified, escalated, or blocked):
- Write `{{COMMS_DIR}}/LAST_ROUND.json` with `{"mode":"implement","work_done":0}`
- Report: "No pending tasks remaining. Run `audit` to re-audit units with verified tasks and check for new gaps."
- Stop.

**If no unblocked tasks exist** but blocked tasks do:
- Report which tasks are blocked and what they're waiting on
- Ask user: proceed with a blocked task anyway, or stop?

Sort unblocked candidates:
1. Priority: `high` before `medium` before `low`
2. Tiebreak: tasks whose completion unblocks the most other tasks first (count how many registry entries list this task in their `depends_on`)
3. Final tiebreak: wave order (wave 1 before wave 2)

Pick the **first** task. One task. No batching.

### Implement Loop

Track `successes_this_run = 0`.

**For each selected task:**

1. Run zombie detection pass (see Shared: Zombie Detection above).

1b. **NEEDS_INPUT Staleness Scan**: Before selecting the next task, scan for stale needs_input files.

   Run: `ls {{NEEDS_INPUT_DIR}}/*.md 2>/dev/null`
   If no files: skip this step.

   For each needs_input file found:
   a. Read the file — extract `task_id`, `created` (ISO timestamp), and the first line of the Question section
   b. Calculate elapsed hours: (current time - created timestamp) in hours
   c. If elapsed >= NEEDS_INPUT_ESCALATE_HOURS (144h):
      - Update registry: set task status to `escalated`, clear `answer_file` field (set to `null`) — prevents a future manual reset from passing a non-existent answer file to implement-agent
      - Move file: `mv {{NEEDS_INPUT_DIR}}/{task-id}.md {{NEEDS_INPUT_DIR}}/stale/{task-id}.md` (create stale/ dir if needed: `mkdir -p {{NEEDS_INPUT_DIR}}/stale`)
      - Report: `⛔ {task-id} — NEEDS_INPUT unanswered for {N} days, auto-escalated. See {{NEEDS_INPUT_DIR}}/stale/{task-id}.md`
   d. If elapsed >= NEEDS_INPUT_STALE_HOURS (48h) but < NEEDS_INPUT_ESCALATE_HOURS:
      - Report: `⚠️  {task-id} — waiting {N}h for answer. Question: {first line of question}`

   Graceful handling: if `{{NEEDS_INPUT_DIR}}/` does not exist, `ls` returns non-zero and no files are found — treat as empty, skip this step (no crash). If a file is malformed or `created` field is missing/unparseable, report elapsed time as "unknown" and continue (do not crash).

   After scanning all files, if any were reported (stale or escalated): prompt user:
   ```
   {N} task(s) need your answers before they can continue. Run: claude --agent audit-orchestrator review_input
   ```
   Then continue with normal task selection (do not stop the run).

1c. **Decomposition Pass**: Before selecting tasks, check for tasks with status `needs_decomposition`.

   Scan registry for entries with `status: "needs_decomposition"`.
   For each:
   - Check that `{{COMMS_DIR}}/escalated/{task-id}.md` exists (diagnosis file from escalation-agent or proactive gate).
     If the file is MISSING (deleted or never written due to a crash):
     - Recreate a minimal diagnosis file:
       ```bash
       mkdir -p {{COMMS_DIR}}/escalated
       ```
       Write `{{COMMS_DIR}}/escalated/{task-id}.md`:
       ```markdown
       ---
       task_id: {task-id}
       unit: {unit}
       verdict: SCOPE_TOO_LARGE
       diagnosed_at: {ISO timestamp}
       ---

       ## Evidence

       Diagnosis file was missing (likely lost to a session crash). Recreated by orchestrator at startup.

       ## Verdict: SCOPE_TOO_LARGE

       Original diagnosis lost. Decompose-agent will use the task spec directly to determine sub-task boundaries.

       ## Recommended Action

       Decompose into sub-tasks of ≤ 8 files each. Decompose-agent will handle automatically.
       ```
     - Report: `⚠️  {task-id} — diagnosis file missing, recreated minimal stub. Proceeding with decomposition.`
   - Spawn decompose-agent:
     ```
     Agent(decompose-agent):
       TASK_ID: <task-id>
       UNIT: <unit>
       REPO_ROOT: {{PROJECT_ROOT}}
       DIAGNOSIS_FILE: {{COMMS_DIR}}/escalated/{task-id}.md
     ```
   - Report: `📐 {task-id} → decomposed into {new-task-ids}`

   After all decompositions: proceed to normal task selection (SQLite is always current — no re-read needed).

1d. **Status Field Validator**: Before task selection, scan registry for entries with an unrecognized `status` value.

   Known valid statuses: `pending`, `claimed`, `implementing`, `completed`, `verified`, `failed`, `escalated`, `needs_input`, `needs_research`, `checkpoint`, `blocked`, `needs_decomposition`, `decomposed`.

   For each entry with a status NOT in the above list:
   - Log: `⚠ {task-id} has unrecognized status "{status}" — treating as pending`
   - Update registry: set `status: "pending"` so the task becomes visible to the scheduler
   - Do this before any task selection, so recovered tasks are immediately eligible

1e. **Blocked Task Unblock Pass**: Before selecting tasks, check if any `blocked` tasks can now proceed.

   Scan registry for entries with `status: "blocked"`.
   For each:
   - Read its `depends_on` list
   - Check each dependency ID in the registry: is its status `"verified"`?
   - If ALL dependencies are verified: update registry — set `status: "pending"`, report: `🔓 {task-id} — dependency verified, unblocked and reset to pending`
   - If any dependency is still not verified: leave as `blocked` (no change)

   After scanning: continue to normal task selection (SQLite is always current — no re-read needed).

2. Run state file initialization for this task (see Shared: State File Initialization above).

2a. **Proactive Size Gate**: Before proceeding, check if this task is too large for one context window.

   Read the task spec file: `{{TASK_DIR}}/{unit}/{task-id}.md`
   Count entries in the "Files to Create or Modify" section (lines between that heading and the next `##` heading):
   ```bash
   # Count list items (lines starting with -, •, or a digit+dot) between headings
   awk '/^## Files to Create or Modify/{p=1;next} p && /^##/{exit} p && /^[ \t]*[-•]|^[ \t]*[0-9]+\./{c++} END{print c}' {{TASK_DIR}}/{unit}/{task-id}.md
   ```

   If file count > 12:
   - Update registry: set status `needs_decomposition`
   - Write `{{COMMS_DIR}}/escalated/{task-id}.md`:
     ```markdown
     ---
     task_id: {task-id}
     unit: {unit}
     verdict: SCOPE_TOO_LARGE
     diagnosed_at: {ISO timestamp}
     ---

     ## Evidence

     Proactive size gate triggered — {N} files in spec exceeds 12-file limit. No implementation was attempted.

     ## Verdict: SCOPE_TOO_LARGE

     The task spec lists {N} files in "Files to Create or Modify", exceeding the 12-file context window limit.

     ## Recommended Action

     Decompose into sub-tasks of ≤ 8 files each. Decompose-agent will handle automatically.
     ```
   - Report: `📐 {task-id} — proactive size gate triggered ({N} files). Will be decomposed.`
   - Skip this task (do NOT proceed to step 3). Return to the top of the loop (step 1) — on the next iteration, step 1c will pick up the `needs_decomposition` status and spawn decompose-agent automatically, then task selection will choose a sub-task.

   If file count ≤ 12: continue to step 3.

3. Read `{{STATE_DIR}}/{unit}/{task-id}/CURRENT.md`. Determine current attempt number (N = prior attempts + 1).

4. Query `SELECT attempt_count FROM io_tasks WHERE id=?`. If attempt_count >= MAX_IMPL already: skip to escalation.

4a. **Set `status='implementing'` in `io_tasks` before spawning.** This creates a durable record that this task is in-flight. If the session dies after the agent completes but before the registry is updated to `'verified'`, startup reconciliation will catch it via the CURRENT.md status.

5. Spawn implement-agent:
   ```
   Agent(implement-agent):
     TASK_ID: <task-id>
     UNIT: <unit-id>
     REPO_ROOT: {{PROJECT_ROOT}}
     [PRIOR_ATTEMPT_NOTES: <read from most recent attempt file if N > 1>]
     [RESEARCH_RESULTS: <if re-spawning after NEEDS_RESEARCH>]
     [ANSWERED_QUESTIONS: <if re-spawning after NEEDS_INPUT>]
     [CHECKPOINT_FILE: <if re-spawning after CHECKPOINT>]
   ```

6. Handle result (all results include STATE_FILE and ATTEMPT_FILE — read these to confirm state was written before proceeding):

   **SUCCESS**:
   - Read STATE_FILE — confirm status=completed
   - Read ATTEMPT_FILE — confirm result=SUCCESS
   - Run independent verification: `cd $(git rev-parse --show-toplevel)/frontend && npx tsc --noEmit` (or `cargo check` for Rust). Use `git rev-parse --show-toplevel` so this targets the current repo root (worktree in parallel mode, main repo in serial mode).
   - If verification passes:
     - Write ledger entry (see Shared: Ledger Write)
     - Update registry: `UPDATE io_tasks SET status='verified', uat_status=NULL WHERE id=?` (see Shared: Registry Update)
     - **UAT loop closure (uat-sourced tasks only):** If the task has `source: "uat"`, also:
       1. For all other tasks in the same unit, reset any `uat_status: "fail"` → `null` so the unit re-queues for UAT
       2. `UPDATE io_queue SET verified_since_last_audit=verified_since_last_audit+1 WHERE unit=?` so audit will re-examine the unit
       - This ensures that fixing a UAT-discovered bug automatically re-triggers UAT for the whole unit, not just the task that was fixed
   - If verification fails: treat as FAILED — the agent was wrong about SUCCESS
   - Increment `successes_this_run`. Report: `✅ <task-id> — verified (UAT pending)`
   - If `successes_this_run >= run_limit` → Checkpoint

   **NEEDS_RESEARCH**:
   - Read STATE_FILE — confirm state was written
   - Spawn explore-agent: `Agent(explore-agent): TOPIC: <from result> CONTEXT: <from result> REPO_ROOT: {{PROJECT_ROOT}}`
   - Re-spawn implement-agent with `RESEARCH_RESULTS: <findings>` and `CHECKPOINT_FILE: <STATE_FILE>`
   - Count as same attempt (do not increment task_attempts)

   **NEEDS_INPUT**:
   - Read STATE_FILE — confirm state was written
   - Write `{{NEEDS_INPUT_DIR}}/{task-id}.md` (see Shared: Needs Input File Format below)
   - Update registry: set `status: "needs_input"`, set `answer_file: "{{COMMS_DIR}}/answers/{task-id}.md"`
   - Report: `⏸  {task-id} — question deferred to {{NEEDS_INPUT_DIR}}/{task-id}.md`
   - Do NOT wait for input. Select next task and continue.
   - Count as same attempt (do not increment task_attempts)

   **CHECKPOINT**:
   - Read STATE_FILE — confirm status=checkpoint
   - Spawn fresh implement-agent with `CHECKPOINT_FILE: <STATE_FILE>`
   - Count as same attempt

   **CYCLE_DETECTED**:
   - Read STATE_FILE — confirm status=cycle_detected, read CYCLE_DETAIL
   - Do NOT re-spawn implement-agent with same parameters
   - Report to user: `🔄 <task-id> CYCLE DETECTED — attempt {N} reproduced attempt {prior N}. Task needs human review or decomposition.`
   - Increment task_attempts. If task_attempts >= MAX_IMPL: escalate. Otherwise: surface to user before retrying.

   **CONFLICT**:
   - Another agent claimed this task. Wait 15 minutes and check CURRENT.md again.
   - If still claimed after 15 minutes: run zombie detection, recover, and retry.

   **FAILED**:
   - Read STATE_FILE and ATTEMPT_FILE — confirm state was written
   - `UPDATE io_tasks SET attempt_count=attempt_count+1 WHERE id=?`
   - Read FAILURE_REASON from result.
   - If attempts < MAX_IMPL: re-spawn with `PRIOR_ATTEMPT_NOTES: <FAILURE_REASON from attempt file>`. Fresh agent, not continuation.
   - If STATE_FILE or ATTEMPT_FILE missing or empty: note "agent failed to write exit state" in PRIOR_ATTEMPT_NOTES.
   - If attempts == `MAX_IMPL`:
     1. Spawn escalation-agent:
        ```
        Agent(escalation-agent):
          TASK_ID: <task-id>
          UNIT: <unit>
          REPO_ROOT: {{PROJECT_ROOT}}
        ```
     2. Read the verdict from the result:
        - `AMBIGUOUS_SPEC`: set registry status `escalated`, report: `⛔ {task-id} — spec ambiguous. Run /design-qa. See {{COMMS_DIR}}/escalated/{task-id}.md`
        - `MISSING_DEPENDENCY`: set registry status `blocked`, report: `🔒 {task-id} — blocked on missing dependency. See {{COMMS_DIR}}/escalated/{task-id}.md`
        - `SCOPE_TOO_LARGE`: set registry status `needs_decomposition`, report: `📐 {task-id} — too large for one context. Will be decomposed. See {{COMMS_DIR}}/escalated/{task-id}.md`
        - `IMPLEMENTATION_FAILURE`: set registry status `escalated`, report: `⛔ {task-id} — implementation failed after {N} attempts. Human review needed. See {{COMMS_DIR}}/escalated/{task-id}.md`
     3. **Surface the escalation verdict:** Read `{{COMMS_DIR}}/escalated/{task-id}.md`. Extract the first non-empty line of the diagnosis body (skip frontmatter). Then:
        - Print one-line summary: `⛔ {task-id} — {verdict}: {first line of diagnosis}`
        - Append the same line to `{{COMMS_DIR}}/ESCALATION_SUMMARY.md` (create if missing):
          ```
          # Escalation Summary
          | Task | Verdict | Date | Summary |
          |------|---------|------|---------|
          ```
          Add a new row: `| {task-id} | {verdict} | {today YYYY-MM-DD} | {first line of diagnosis} |`
          Read the file first (get existing rows), append the new row, write back. If the file does not exist, create it with the header and the new row.
     4. Continue to next task

5. After handling, select next task using dependency-aware selection.

### Implement Checkpoint

**Pre-exit commit (required for worktree mode):** Before writing LAST_ROUND.json and exiting, commit any uncommitted changes so they survive `git worktree remove`:
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
CHANGED=$(git -C "$REPO_ROOT" status --porcelain | wc -l | tr -d ' ')
if [ "$CHANGED" -gt 0 ]; then
    git -C "$REPO_ROOT" add -A && git -C "$REPO_ROOT" commit -m "checkpoint: {task-id} — session state" --trailer "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
fi
```
This is a no-op if Ledger Write already committed (SUCCESS path). For all other exits (NEEDS_INPUT, FAILED, ESCALATED, CYCLE_DETECTED) it preserves registry updates, needs-input files, and escalation files that would otherwise be lost when the worktree is cleaned up.

**If `run_limit == 1`:** Write `{{COMMS_DIR}}/LAST_ROUND.json` with `{"mode":"implement","work_done":{successes_this_run}}`, print one-line summary, exit.
```
✓ implement round complete — {task-id} verified. Progress saved.
```

**If `run_limit > 1`:** Write `{{COMMS_DIR}}/LAST_ROUND.json` with `{"mode":"implement","work_done":{successes_this_run}}`, then same structure as audit checkpoint. Report tasks completed this run, ask YES/NO/SKIP.

---

## MODE: FULL

Full mode interleaves audit and implement. One unit at a time, but within each unit, implement tasks as they are generated rather than batching all units first.

### Full Loop

For each pending unit in wave order:

1. Run the audit phase for this unit (same as audit mode, one unit).

2. If audit succeeded and produced tasks:
   - Immediately enter implement phase for the tasks from this unit only
   - Work tasks in dependency/priority order, one at a time
   - Checkpoint every `CHECKPOINT_EVERY` tasks (not units)
   - After all tasks for this unit are verified or escalated, move to next unit

3. If audit failed → repair loop → if repaired, audit again → then implement

4. Wave gate: do not start Wave 2 units until all Wave 1 units are fully processed (audited + all tasks verified or escalated).

Checkpoint after every 3 successful completions (audit or task, combined count).

---

## Shared: Needs Input File Format

Write this file when implement-agent returns NEEDS_INPUT:

`{{NEEDS_INPUT_DIR}}/{task-id}.md`:
```markdown
---
task_id: {task-id}
unit: {unit}
checkpoint_file: {{STATE_DIR}}/{unit}/{task-id}/CURRENT.md
answer_file: {{COMMS_DIR}}/answers/{task-id}.md
attempt: {N}
created: {ISO timestamp}
---

## What Was Being Implemented
{1–3 sentences describing the task and how far the agent got}

## Question
{The specific question, stated clearly. Enough context to answer without reading code.}

## Why This Matters
{What the answer determines — which code path, which API shape, which behavior}

## Default If Unsure
{What the agent would do if forced to guess. User can reply "go with default."}
```

`{{COMMS_DIR}}/answers/{task-id}.md` (written by review_input mode, appended for multiple rounds):
```markdown
---
task_id: {task-id}
---

## Round {N}
**Question:** {copied from needs_input}
**Answer:** {user's answer}
```

---

## MODE: REVIEW_INPUT

Entered when:
- User types `review_input`
- No mode given AND `{{NEEDS_INPUT_DIR}}/*.md` files exist (auto-detect)

### Review Loop

1. Glob `{{NEEDS_INPUT_DIR}}/*.md`. If none found: report "No pending questions." and exit.

2. Report to user how many tasks need answers:
   ```
   ⏸  {N} task(s) need your input before they can continue:
   ```

3. For each needs_input file:
   a. Read the file — extract task_id, question, context, default
   b. Use `AskUserQuestion` to present:
      ```
      Task: {task-id} — {what was being implemented}

      Question: {question}

      Why it matters: {why this matters}

      Default if unsure: {default}

      Your answer (or press enter to use default):
      ```
   c. If user presses enter / says "default" / says "go with default": use the default answer
   d. Ensure the answers directory exists, then append to `{{COMMS_DIR}}/answers/{task-id}.md` (create if not exists):
      ```bash
      mkdir -p {{COMMS_DIR}}/answers
      ```
      ```
      ## Round {N}
      **Question:** {question}
      **Answer:** {answer or default}
      ```
   e. `UPDATE io_tasks SET status='pending' WHERE id=?` (answer_file already set in prior NEEDS_INPUT step)
   f. Delete `{{NEEDS_INPUT_DIR}}/{task-id}.md`
   g. Report: `✅ {task-id} — answered, reset to pending`

4. After all questions answered, report:
   ```
   All questions answered. {N} task(s) reset to pending.
   Run: ./io-run.sh implement {N}
   ```

---

## Task Attempt Tracking

Attempt counts are stored in `io_tasks.attempt_count`. Query and update directly:

```python
# Read
row = con.execute("SELECT attempt_count FROM io_tasks WHERE id=?", (task_id,)).fetchone()
attempts = row[0] if row else 0

# Increment after a FAILED result
con.execute("UPDATE io_tasks SET attempt_count=attempt_count+1 WHERE id=?", (task_id,))
con.commit()
```

Update whenever an implement-agent attempt completes with FAILED (not NEEDS_RESEARCH, NEEDS_INPUT, or CHECKPOINT — those do not increment).

---

## Rules

- **Wave 0 contracts must have decision files before their applicable units are audited.** A missing `{{DECISIONS_DIR}}/{contract-slug}.md` blocks audit for that unit — it does NOT block implement for existing tasks on that unit. Run `/design-qa {contract-slug}` to generate the missing decision file. Force modes (`force`, `force-all`) bypass this gate.
- **One task at a time in implement mode.** Never spawn two implement-agents concurrently.
- **Always update `io_tasks` status before and after spawning any sub-agent.** Crash recovery depends on this — `status='implementing'` before spawn, then `status='verified'`/`'failed'`/etc. after.
- **Gaps found during audit are not failures.** A unit with 15 task files is a successful audit.
- **Wave order is a hard gate for audit.** Wave 2 units cannot start while any Wave 1 unit is pending/in_progress.
- **Dependency order is enforced in implement.** Never implement a task whose dependencies are not verified.
- **Escalation-agent runs before final escalation.** After MAX_IMPL failures, spawn escalation-agent to diagnose the root cause. The verdict determines the outcome: `AMBIGUOUS_SPEC` and `IMPLEMENTATION_FAILURE` → escalated (human review); `MISSING_DEPENDENCY` → blocked; `SCOPE_TOO_LARGE` → needs_decomposition.
- **Tasks are decomposed automatically in two cases:** (1) escalation-agent returns `SCOPE_TOO_LARGE` after MAX_IMPL failures, or (2) the proactive size gate triggers (task spec has > 12 files). In both cases, decompose-agent creates sub-tasks automatically — do not surface SCOPE_TOO_LARGE to the user for manual decomposition.
- **NEEDS_RESEARCH and NEEDS_INPUT count as the same attempt as the task they interrupted.** Only FAILED return codes increment the attempt counter.
- **Checkpoint is a hard stop.** Do not proceed to the next unit/task before the user confirms continuation.
