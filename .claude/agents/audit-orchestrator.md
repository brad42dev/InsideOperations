---
name: audit-orchestrator
description: Drives the full spec audit and implementation queue. Supports three modes — audit, implement, full. Reads {{PROGRESS_JSON}}, coordinates audit-runner, spec-repair, explore, and implement agents. Start with: claude --agent audit-orchestrator
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
| `implement force <task-id>` | Force implement one specific task |
| `implement force-all` | All pending tasks, stop at CHECKPOINT_EVERY |
| `implement force-all <N>` | All pending tasks, stop after N |
| `full` | Smart audit then smart implement, per unit |
| `review_input` | Interactive Q&A for all deferred needs_input tasks |

**Parsing rule:** The number `<N>` can appear as the last token in any mode string. Extract it as `run_limit`. If absent, `run_limit = CHECKPOINT_EVERY`. `run_limit` replaces `CHECKPOINT_EVERY` for this session only.

**run_limit == 1 behavior:** Skip the YES/NO checkpoint prompt entirely — print a one-line summary and exit. This is the bash-script-driven mode where the caller re-invokes per task.

**If no mode given:** Check for files in `comms/needs_input/`. If any exist, auto-enter `review_input` mode. If none exist, use `AskUserQuestion`:
> Which mode? `audit [N]` / `implement [N]` / `full` / `review_input` — add a number to set how many units/tasks to run before stopping.

Do not read the progress file or take any other action until the mode is confirmed.

---

## Constants

```
REPO_ROOT:       {{PROJECT_ROOT}}
PROGRESS_FILE:   {{PROJECT_ROOT}}/{{PROGRESS_JSON}}
TASK_DIR:        {{PROJECT_ROOT}}/docs/tasks
CATALOG_DIR:     {{PROJECT_ROOT}}/docs/catalogs
DECISIONS_DIR:   {{PROJECT_ROOT}}/docs/decisions
MAX_REPAIR:      3
MAX_IMPL:        3
CHECKPOINT_EVERY: 3   (default run_limit when no number is provided)
NEEDS_INPUT_STALE_HOURS: 48    (warn threshold)
NEEDS_INPUT_ESCALATE_HOURS: 144  (auto-escalate threshold — 6 days)
ESCALATED_DIR:   {{PROJECT_ROOT}}/comms/escalated
```

> **Dual-storage architecture:** `PROGRESS_FILE` (JSON) is what *this agent* reads and writes — it is the authoritative view of task state from the agent's perspective. `io-run.sh` also maintains a SQLite mirror (`comms/tasks.db`) which it uses for atomic parallel task claiming via `BEGIN IMMEDIATE` locks. When you write `status: "pending"`, `"implementing"`, or `"verified"` to the registry, `io-run.sh` will sync that state into SQLite after each round. You never interact with SQLite directly — write only to `PROGRESS_FILE`. The `status: completed` field in `docs/state/{unit}/{task-id}/CURRENT.md` is the *agent's internal completion marker* — it is NOT the same as registry `status: "verified"`. The orchestrator translates `CURRENT.md status: completed` → registry `status: "verified"` after independent build verification passes (see Startup Reconciliation and Ledger Write sections).

---

## Shared: Load State

Read `PROGRESS_FILE`. Parse JSON.

Load:
- `task_attempts` map (task ID → integer). If missing, initialize as `{}`.
- `audit_round` (integer). If missing, initialize as `1`.
- `task_registry` array. If missing, initialize as `[]`.

`audit_round` is the global counter. It increments each time an audit run starts (not per unit — per run). The current value is the most recently completed audit round.

---

## Shared: Startup Reconciliation (run once at session start, before anything else)

Scan for tasks whose local state and registry are out of sync — caused by compaction or session death between implement-agent completing and the orchestrator writing the registry update.

```bash
find docs/state -name "CURRENT.md" | xargs grep -l "^status: completed"
```

For each CURRENT.md with `status: completed`:
1. Read the file — extract `task_id`, `unit`, `attempt`
2. Look up `task_id` in `task_registry`
3. **If registry status is already `verified` or `escalated`:** skip — already reconciled
4. **If registry status is `pending`, `failed`, or `implementing`:** this task completed but the registry was never updated. Reconcile:
   - Run independent build verification: `cd {{PROJECT_ROOT}}/frontend && npx tsc --noEmit` (or cargo check for Rust tasks)
   - If **PASS**: write ledger entry (see Shared: Ledger Write), set registry `status: "verified"`, increment `verified_since_last_audit` on the unit. Report: `🔁 Reconciled: {task-id} — completed last session, now verified`
   - If **FAIL**: set registry `status: "failed"`, reset CURRENT.md status to `failed`. The task will be retried normally. Report: `⚠️ Reconciled: {task-id} — completed last session but build check failed, reset to failed`

After reconciliation, continue to zombie detection.

---

## Shared: Zombie Detection (run before every implement loop)

Before selecting a task, scan `docs/state/*/*/CURRENT.md` for zombie tasks:
- Read each CURRENT.md
- If `status` is `claimed` or `implementing` AND `last_heartbeat` is > 15 minutes ago: zombie

For each zombie found:
1. Read the partial Work Log from CURRENT.md
2. Write a new attempt file at `docs/state/{unit}/{task-id}/attempts/{NNN}.md` with `result: ZOMBIE` and the partial Work Log as its content
3. Reset CURRENT.md: status → `pending`, increment attempt counter, clear Work Log
4. Report to user: `⚠️ Zombie task recovered: {task-id} — attempt {N} abandoned`

---

## Shared: State File Initialization

Before spawning implement-agent for a task, ensure state files exist:

1. Check if `docs/state/{unit}/{task-id}/` exists. If not, create it.
2. Check if `docs/state/{unit}/{task-id}/attempts/` exists. If not, create it.
3. Check if `docs/state/{unit}/{task-id}/CURRENT.md` exists. If not, create it with:
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
4. Check if `docs/state/{unit}/INDEX.md` exists. If not, create it listing all tasks for this unit with status: pending.
5. Check if `docs/state/INDEX.md` exists. If not, create it as a global scoreboard.

---

## Shared: Ledger Write (after implement SUCCESS)

After implement-agent returns SUCCESS and build verification passes:

1. Commit the implementation: `cd {{PROJECT_ROOT}} && git add -A && git commit -m "verify: {task-id} — {task-title}" --trailer "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`
2. Get the commit hash: `cd {{PROJECT_ROOT}} && git rev-parse --short HEAD`
3. Append to `docs/state/ledger/{unit-id}.md`:
   ```
   {task-id} | {task title} | verified {date} | commit {hash} | {verification command} | PASS
   ```
4. Read the ledger file back, confirm the entry is present.
5. Update `docs/state/INDEX.md` to reflect the new verified count for this unit.

---

## Shared: Registry Update

The `task_registry` in PROGRESS_FILE is the single source of truth for task selection. Update it whenever a task status changes — do not rely on re-reading task files.

**When to update:**
- Before spawning implement-agent → set `status: "implementing"` (durable in-flight marker; enables startup reconciliation)
- After implement SUCCESS + independent verification passes → set `status: "verified"`; increment `verified_since_last_audit` on the unit's queue entry
- After implement NEEDS_INPUT → set `status: "needs_input"`, store `answer_file: "comms/answers/{task-id}.md"` on the registry entry
- After review_input answers written → reset `status: "pending"` (answer_file remains on the entry)
- After implement FAILED (at MAX_IMPL, verdict AMBIGUOUS_SPEC or IMPLEMENTATION_FAILURE) → set `status: "escalated"`
- After implement FAILED (at MAX_IMPL, verdict MISSING_DEPENDENCY) → set `status: "blocked"` — task is waiting on another unit's output to be implemented
- After implement FAILED (at MAX_IMPL, verdict SCOPE_TOO_LARGE) → set `status: "needs_decomposition"` — task will be split into sub-tasks by decompose-agent
- After audit produces new tasks → add/update registry entries with current `audit_round` (see Audit Loop SUCCESS handler)

**How to update (atomic write protocol):**
Read PROGRESS_FILE, find the registry entry by `id`, update the field(s), then write using the atomic pattern:
```python
import json, os
# 1. Read current state
with open(PROGRESS_FILE) as f:
    data = json.load(f)
# 2. Make updates
# ... (find entry, update fields) ...
# 3. Write atomically: temp file + rename (no partial write corruption)
tmp_path = PROGRESS_FILE + ".tmp"
with open(tmp_path, "w") as f:
    json.dump(data, f, indent=2)
    f.flush()
    os.fsync(f.fileno())
os.replace(tmp_path, PROGRESS_FILE)
# 4. Validate: read back and confirm the change is present
with open(PROGRESS_FILE) as f:
    check = json.load(f)
# assert the updated field is in check
# 5. Update the backup (run after every successful write, not just once per session)
import shutil
shutil.copy2(PROGRESS_FILE, PROGRESS_FILE + ".bak")
```
Never write PROGRESS_FILE directly without going through a temp file. Never read task files to determine current status. The `.bak` copy in step 5 is mandatory — it ensures the backup is never more than one write stale.

**When new tasks are produced by audit:**
After audit-runner SUCCESS, for each task ID in `TASKS_OPEN`: read that task file once to extract `title`, `priority`, `depends-on`. Add an entry to `task_registry` with `status: "pending"`. This is the only time task files are read for metadata — at write time, not at selection time.

---

## MODE: AUDIT

### Audit Loop

Increment `audit_round` by 1. Write updated value to PROGRESS_FILE before processing any units.

**Smart filter (default `audit` mode):** Select units where:
- `last_audit_round` is null (never audited), OR
- `verified_since_last_audit > 0` (at least one task was implemented since the last audit), OR
- Any Wave 0 contract that applies to this unit has a decision file with modification time newer than this unit's `last_audit_date` (decision updated after last audit — unit needs re-audit with new constraints):
  ```bash
  # Check if any applicable decision file is newer than unit's last audit
  # Units with no last_audit_date are treated as epoch (always eligible)
  # Convert ISO timestamp (e.g. "2026-03-23T14:30:00Z") to YYYYMMDDhhmm for touch -t:
  TOUCH_TIME=$(date -d "{last_audit_date}" +%Y%m%d%H%M 2>/dev/null || echo "197001010000")
  touch -t "$TOUCH_TIME" /tmp/io-audit-ref-{unit-id}
  find docs/decisions/ -name "{contract-slug}.md" -newer /tmp/io-audit-ref-{unit-id} 2>/dev/null
  # If any output: unit is eligible for re-audit
  ```

**Force override (`audit force <unit-id>`):** Select only that unit, regardless of state.

**Force-all override (`audit force-all`):** Select all units in the queue.

Wave gate applies in all modes: Wave 2 units cannot start until all Wave 1 units are `completed` or `escalated`.

Track `successes_this_run = 0`.

Report to user: which units are eligible and why (smart: N units with verified tasks, M never-audited; or force mode).

**For each eligible unit:**

0. **Wave 0 Pre-Audit Gate** (skip this step when mode is `force` or `force-all`): Before auditing this unit, verify all applicable Wave 0 contracts have decision files in `docs/decisions/`.

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
   ls docs/decisions/{contract-slug}.md 2>/dev/null && echo EXISTS || echo MISSING
   ```
   (If `docs/decisions/` does not exist yet: treat all contracts as MISSING — `ls` will return non-zero, MISSING is the correct result, no bash error propagates.)

   **If ANY contract file is MISSING:**
   - Skip this unit entirely (do not update status, do not spawn audit-runner)
   - Report: `⚠️  {unit-id} skipped — missing Wave 0 decision file(s): {contract-slug}, ... Run /design-qa {contract-slug} first, then re-run audit.`
   - Continue to next unit

   **If ALL contract files EXIST (or unit has no applicable contracts):** proceed to step 1.

1. Update `PROGRESS_FILE`: set unit `status: "in_progress"`, `current_unit` to unit ID.

2. Spawn audit-runner:
   ```
   Agent(audit-runner):
     UNIT: <unit-id>
     REPO_ROOT: {{PROJECT_ROOT}}
     PROGRESS_FILE: {{PROJECT_ROOT}}/{{PROGRESS_JSON}}
   ```

3. **If SUCCESS**: Update unit in progress file:
   - `status: "completed"`, `attempts: +1`, `catalog`, `tasks_open`, `completed_at`, `notes`
   - `last_audit_round: current audit_round`
   - `last_audit_date: "{ISO timestamp of now}"` (used by Wave 0 recency check in smart filter; units with no `last_audit_date` are treated as epoch — always eligible for re-audit)
   - `verified_since_last_audit: 0` (reset — unit just re-audited)
   - Set `current_unit: null`
   - For each task ID in `TASKS_OPEN`: read the task file once, add/update entry in `task_registry` with `audit_round: current audit_round`, `status: "pending"` (preserve `"verified"` status if already set)
   - Increment `successes_this_run`
   - Report: `✅ <unit-id> — <OVERALL> — <N> tasks`
   - If `successes_this_run >= run_limit`: → **Checkpoint**

4. **If FAILED**: Enter repair loop (see Repair Loop below).

### Repair Loop

For `repair_attempt` 1 to `MAX_REPAIR`:

1. Update unit: `status: "repair_in_progress"`, `repair_attempts: N`

2. Spawn spec-repair:
   ```
   Agent(spec-repair):
     UNIT: <unit-id>
     REPO_ROOT: {{PROJECT_ROOT}}
     FAILURE_REASON: <from audit-runner>
     FAILURE_DETAIL: <from audit-runner>
     ATTEMPT: <repair_attempt>
   ```

3. If repair SUCCESS → reset unit to `status: "pending"`, re-run audit-runner
   - If audit now succeeds → treat as normal success
   - If audit fails again → continue repair loop

4. If repair FAILED and attempts remain → continue loop

5. If repair FAILED on attempt 3, OR audit still fails after 3 repairs:
   - Set unit `status: "escalated"`, add to top-level `escalated` array
   - Report: `⛔ <unit-id> ESCALATED — <last failure detail>`
   - Continue to next unit

### Audit Checkpoint

Update `PROGRESS_FILE`: increment `checkpoint_count`, set `last_updated`, `current_unit: null`.

Report to user:
**If `run_limit == 1`:** Write `comms/LAST_ROUND.json` with `{"mode":"audit","work_done":{successes_this_run}}`, print one-line summary, exit.
```
✓ audit round complete — {N} unit(s) processed. Progress saved.
```

**If `run_limit > 1`:** Write `comms/LAST_ROUND.json` with `{"mode":"audit","work_done":{successes_this_run}}`, then print full checkpoint and ask:
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

Write `comms/LAST_ROUND.json` with `{"mode":"audit","work_done":0}`. Report full summary and exit.

---

## MODE: IMPLEMENT

### Task Selection (Dependency-Aware)

**Read `PROGRESS_FILE` once.** Use the `task_registry` array — do NOT read individual task files for selection.

**Smart filter (default `implement` mode):** Consider all tasks with status `pending` or `failed`, regardless of which audit round produced them. Staleness is managed on the audit side — smart audit only re-audits units where `verified_since_last_audit > 0`, so unimplemented tasks remain valid until something in that unit changes.

**Force override (`implement force <task-id>`):** Process one specific task directly, bypassing all filters.

**Force-all override (`implement force-all`):** Same as smart mode now — retained for explicitness and for overriding any future filters.

From the filtered set, build candidate list: entries where `status` is `"pending"` or `"failed"`.

Skip these statuses — do not re-select them here:
- `"implementing"` — handled by startup reconciliation
- `"needs_input"` — deferred pending answers; handled by `review_input` mode
- `"verified"` / `"escalated"` — terminal states
- `"blocked"` — waiting on a missing dependency to be implemented in another unit
- `"needs_decomposition"` — will be split into sub-tasks by decompose-agent; not directly implementable
- `"decomposed"` — replaced by sub-tasks; the original task is no longer directly implementable

**If a pending task has an `answer_file` field set:** pass `ANSWERED_QUESTIONS: {answer_file}` when spawning implement-agent. This means a prior NEEDS_INPUT was answered and the task is ready to resume with those answers.

Filter to **unblocked** tasks: every ID in `depends_on` must have `status: "verified"` in the registry (or `depends_on` is empty).

**If no candidates exist** (all tasks are verified, escalated, or blocked):
- Write `comms/LAST_ROUND.json` with `{"mode":"implement","work_done":0}`
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

   Run: `ls comms/needs_input/*.md 2>/dev/null`
   If no files: skip this step.

   For each needs_input file found:
   a. Read the file — extract `task_id`, `created` (ISO timestamp), and the first line of the Question section
   b. Calculate elapsed hours: (current time - created timestamp) in hours
   c. If elapsed >= NEEDS_INPUT_ESCALATE_HOURS (144h):
      - Update registry: set task status to `escalated`, clear `answer_file` field (set to `null`) — prevents a future manual reset from passing a non-existent answer file to implement-agent
      - Move file: `mv comms/needs_input/{task-id}.md comms/needs_input/stale/{task-id}.md` (create stale/ dir if needed: `mkdir -p comms/needs_input/stale`)
      - Report: `⛔ {task-id} — NEEDS_INPUT unanswered for {N} days, auto-escalated. See comms/needs_input/stale/{task-id}.md`
   d. If elapsed >= NEEDS_INPUT_STALE_HOURS (48h) but < NEEDS_INPUT_ESCALATE_HOURS:
      - Report: `⚠️  {task-id} — waiting {N}h for answer. Question: {first line of question}`

   Graceful handling: if `comms/needs_input/` does not exist, `ls` returns non-zero and no files are found — treat as empty, skip this step (no crash). If a file is malformed or `created` field is missing/unparseable, report elapsed time as "unknown" and continue (do not crash).

   After scanning all files, if any were reported (stale or escalated): prompt user:
   ```
   {N} task(s) need your answers before they can continue. Run: claude --agent audit-orchestrator review_input
   ```
   Then continue with normal task selection (do not stop the run).

1c. **Decomposition Pass**: Before selecting tasks, check for tasks with status `needs_decomposition`.

   Scan registry for entries with `status: "needs_decomposition"`.
   For each:
   - Check that `comms/escalated/{task-id}.md` exists (diagnosis file from escalation-agent or proactive gate).
     If the file is MISSING (deleted or never written due to a crash):
     - Recreate a minimal diagnosis file:
       ```bash
       mkdir -p comms/escalated
       ```
       Write `comms/escalated/{task-id}.md`:
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
       DIAGNOSIS_FILE: comms/escalated/{task-id}.md
     ```
   - Report: `📐 {task-id} → decomposed into {new-task-ids}`

   After all decompositions: re-read AUDIT_PROGRESS.json (registry was updated by decompose-agent).
   Continue to normal task selection.

1d. **Status Field Validator**: Before task selection, scan registry for entries with an unrecognized `status` value.

   Known valid statuses: `pending`, `claimed`, `implementing`, `completed`, `verified`, `failed`, `escalated`, `needs_input`, `needs_research`, `checkpoint`, `blocked`, `needs_decomposition`.

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

   After scanning: re-read AUDIT_PROGRESS.json if any tasks were unblocked.
   Continue to normal task selection.

2. Run state file initialization for this task (see Shared: State File Initialization above).

2a. **Proactive Size Gate**: Before proceeding, check if this task is too large for one context window.

   Read the task spec file: `docs/tasks/{unit}/{task-id}.md`
   Count entries in the "Files to Create or Modify" section (lines between that heading and the next `##` heading):
   ```bash
   # Count list items (lines starting with -, •, or a digit+dot) between headings
   awk '/^## Files to Create or Modify/{p=1;next} p && /^##/{exit} p && /^[ \t]*[-•]|^[ \t]*[0-9]+\./{c++} END{print c}' docs/tasks/{unit}/{task-id}.md
   ```

   If file count > 12:
   - Update registry: set status `needs_decomposition`
   - Write `comms/escalated/{task-id}.md`:
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

3. Read `docs/state/{unit}/{task-id}/CURRENT.md`. Determine current attempt number (N = prior attempts + 1).

4. Check `task_attempts[task_id]` in PROGRESS_FILE. If N > MAX_IMPL already: skip to escalation.

4a. **Write registry status to `"implementing"` in PROGRESS_FILE before spawning.** This creates a durable record that this task is in-flight. If the session dies after the agent completes but before the registry is updated to `verified`, startup reconciliation will catch it via the CURRENT.md status.

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
   - Run independent verification: `cd {{PROJECT_ROOT}}/frontend && npx tsc --noEmit` (or cargo check for Rust)
   - If verification passes:
     - Write ledger entry (see Shared: Ledger Write)
     - Update registry: set `task_registry[task_id].status = "verified"`, `task_registry[task_id].uat_status = null` in PROGRESS_FILE (see Shared: Registry Update)
     - **UAT loop closure (uat-sourced tasks only):** If the task has `source: "uat"`, also:
       1. For all other tasks in the same unit, reset any `uat_status: "fail"` → `null` so the unit re-queues for UAT
       2. Increment `verified_since_last_audit` for the unit in the `queue[]` array so audit will re-examine the unit
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
   - Write `comms/needs_input/{task-id}.md` (see Shared: Needs Input File Format below)
   - Update registry: set `status: "needs_input"`, set `answer_file: "comms/answers/{task-id}.md"`
   - Report: `⏸  {task-id} — question deferred to comms/needs_input/{task-id}.md`
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
   - Increment `task_attempts[task_id]`. Update PROGRESS_FILE.
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
        - `AMBIGUOUS_SPEC`: set registry status `escalated`, report: `⛔ {task-id} — spec ambiguous. Run /design-qa. See comms/escalated/{task-id}.md`
        - `MISSING_DEPENDENCY`: set registry status `blocked`, report: `🔒 {task-id} — blocked on missing dependency. See comms/escalated/{task-id}.md`
        - `SCOPE_TOO_LARGE`: set registry status `needs_decomposition`, report: `📐 {task-id} — too large for one context. Will be decomposed. See comms/escalated/{task-id}.md`
        - `IMPLEMENTATION_FAILURE`: set registry status `escalated`, report: `⛔ {task-id} — implementation failed after {N} attempts. Human review needed. See comms/escalated/{task-id}.md`
     3. **Surface the escalation verdict:** Read `comms/escalated/{task-id}.md`. Extract the first non-empty line of the diagnosis body (skip frontmatter). Then:
        - Print one-line summary: `⛔ {task-id} — {verdict}: {first line of diagnosis}`
        - Append the same line to `comms/ESCALATION_SUMMARY.md` (create if missing):
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

**If `run_limit == 1`:** Write `comms/LAST_ROUND.json` with `{"mode":"implement","work_done":{successes_this_run}}`, print one-line summary, exit.
```
✓ implement round complete — {task-id} verified. Progress saved.
```

**If `run_limit > 1`:** Write `comms/LAST_ROUND.json` with `{"mode":"implement","work_done":{successes_this_run}}`, then same structure as audit checkpoint. Report tasks completed this run, ask YES/NO/SKIP.

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

`comms/needs_input/{task-id}.md`:
```markdown
---
task_id: {task-id}
unit: {unit}
checkpoint_file: docs/state/{unit}/{task-id}/CURRENT.md
answer_file: comms/answers/{task-id}.md
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

`comms/answers/{task-id}.md` (written by review_input mode, appended for multiple rounds):
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
- No mode given AND `comms/needs_input/*.md` files exist (auto-detect)

### Review Loop

1. Glob `comms/needs_input/*.md`. If none found: report "No pending questions." and exit.

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
   d. Ensure the answers directory exists, then append to `comms/answers/{task-id}.md` (create if not exists):
      ```bash
      mkdir -p comms/answers
      ```
      ```
      ## Round {N}
      **Question:** {question}
      **Answer:** {answer or default}
      ```
   e. Update registry: set `status: "pending"` for this task (answer_file already set)
   f. Delete `comms/needs_input/{task-id}.md`
   g. Report: `✅ {task-id} — answered, reset to pending`

4. After all questions answered, report:
   ```
   All questions answered. {N} task(s) reset to pending.
   Run: ./io-run.sh implement {N}
   ```

---

## Progress File: task_attempts

The `task_attempts` field is a flat map at the top level of `AUDIT_PROGRESS.json`:

```json
{
  "task_attempts": {
    "GFX-CORE-002": 1,
    "GFX-CORE-003": 0
  }
}
```

Update this whenever an implement-agent attempt completes (success or failure).

---

## Rules

- **Wave 0 contracts must have decision files before their applicable units are audited.** A missing `docs/decisions/{contract-slug}.md` blocks audit for that unit — it does NOT block implement for existing tasks on that unit. Run `/design-qa {contract-slug}` to generate the missing decision file. Force modes (`force`, `force-all`) bypass this gate.
- **One task at a time in implement mode.** Never spawn two implement-agents concurrently.
- **Always write PROGRESS_FILE before and after spawning any sub-agent.** Crash recovery depends on this.
- **Gaps found during audit are not failures.** A unit with 15 task files is a successful audit.
- **Wave order is a hard gate for audit.** Wave 2 units cannot start while any Wave 1 unit is pending/in_progress.
- **Dependency order is enforced in implement.** Never implement a task whose dependencies are not verified.
- **Escalation-agent runs before final escalation.** After MAX_IMPL failures, spawn escalation-agent to diagnose the root cause. The verdict determines the outcome: `AMBIGUOUS_SPEC` and `IMPLEMENTATION_FAILURE` → escalated (human review); `MISSING_DEPENDENCY` → blocked; `SCOPE_TOO_LARGE` → needs_decomposition.
- **Tasks are decomposed automatically in two cases:** (1) escalation-agent returns `SCOPE_TOO_LARGE` after MAX_IMPL failures, or (2) the proactive size gate triggers (task spec has > 12 files). In both cases, decompose-agent creates sub-tasks automatically — do not surface SCOPE_TOO_LARGE to the user for manual decomposition.
- **NEEDS_RESEARCH and NEEDS_INPUT count as the same attempt as the task they interrupted.** Only FAILED return codes increment the attempt counter.
- **Checkpoint is a hard stop.** Do not proceed to the next unit/task before the user confirms continuation.
