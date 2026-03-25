# Parallel Pipeline Plan
_Created: 2026-03-25. Extends io-orchestrator to parallelize every non-interactive agent._
_Update `[ ]` checkboxes and status lines as waves complete. This file is the prompt source for each wave._

---

## Context

The orchestrator currently parallelizes only `implement`. Everything else is serial:
- `./io-run.sh uat` — parallel internally via `run_parallel_uat()` but CLI accepts no P/N args
- `./io-run.sh audit` — serial: one `audit-orchestrator` session per round, one unit per session
- `auto` mode — only dispatches implement + UAT, ignores pending audit work
- `needs_decomposition` tasks — never auto-dispatched; sit until manually handled

**Goal:** Every non-interactive mode gets `P N` CLI args (P = parallel agents, N = item limit).
All three types of work (audit, implement, UAT) run proportionally in `auto` mode.

**Key design decisions:**

- **Audit agents do NOT use worktrees.** Audit is read-heavy; writes go to unit-specific
  `docs/tasks/{unit}/` and `docs/catalogs/{unit}.md` dirs. Different units → no file conflicts.
  No git commits in audit — verified as acceptance criteria.
- **Unit-level claim lock** added to `io_queue` (`claimed_at`/`claimed_by`) — same pattern
  as `io_tasks`. `BEGIN IMMEDIATE` prevents two audit agents claiming the same unit.
- **Decompose** tasks dispatched fire-and-forget alongside implement agents (same slot pool).
- **Auto mode** gets a three-way proportional allocation: audit + impl + uat = `AUTO_PARALLEL`.

**Audit-orchestrator interface (confirmed):**
```bash
claude --agent audit-orchestrator "audit force {unit_id} 1"   # one specific unit
claude --agent audit-orchestrator "implement force {task_id} 1"  # one specific task
```
The `1` at the end sets `run_limit=1` — agent exits after one unit/task, no checkpoint prompt.

---

## Key files

- Orchestrator runner: `io-run.sh`
- DB schema: `comms/schema.sql`
- DB migration: `comms/migrate_to_sqlite.py`
- Live DB: `comms/tasks.db`
- Config: `io-orchestrator.config.json`
- Audit agent: `.claude/agents/audit-orchestrator.md`
- UAT agent: `.claude/agents/uat-agent.md`

---

## Wave 1 — UAT parallel CLI args
**Status: [ ] not started**
**Priority: HIGH — simplest change, immediate value**

`run_parallel_uat()` already exists and works. The only gap: the CLI ignores any P/N args.

### What to change in `io-run.sh`

**`uat` mode** — fully automated, parallelism makes sense:
- Parse `./io-run.sh uat [P [N]]`
  - `P` = parallel agents (default: `CFG_MAX_PARALLEL`)
  - `N` = max units to process this run (default: 0 = unlimited)
- Pass `P` to `run_parallel_uat()` (replace hardcoded `${CFG_MAX_PARALLEL:-3}`)
- Slice `$UNITS` to at most `N` units before calling `run_parallel_uat`

**`human-uat` mode** — human provides pass/fail per unit; must stay serial:
- Parse `./io-run.sh human-uat [N]`
  - `N` = unit limit only — no P arg (parallelizing this would split human attention
    across N simultaneous approval prompts in the same terminal, which is unworkable)
- Slice `$UNITS` to at most `N` before the serial loop
- Useful for "I only have time to review 3 units today"

**`release-uat` mode** — human provides approve/reject per feature; must stay serial:
- Parse `./io-run.sh release-uat [N]`
  - `N` = unit limit only — same reasoning as `human-uat`
- Slice `$UNITS` to at most `N` before the serial loop

**Usage line** (update to reflect new args):
```
./io-run.sh uat [P [N]]       P = parallel agents (default: CFG_MAX_PARALLEL), N = unit limit (0 = all)
./io-run.sh human-uat [N]     N = unit limit; always serial — human pass/fail required per unit
./io-run.sh release-uat [N]   N = unit limit; always serial — human approve/reject required per feature
```

### Acceptance criteria

- [ ] `./io-run.sh uat 2 3` runs at most 2 agents in parallel, processes at most 3 units
- [ ] `./io-run.sh uat 1` runs 1 agent (serial), unlimited units — backwards compatible
- [ ] `./io-run.sh uat` (no args) behaves identically to current behavior
- [ ] `./io-run.sh human-uat 2` processes at most 2 units serially, then stops
- [ ] `./io-run.sh release-uat 5` processes at most 5 units serially, then stops
- [ ] `./io-run.sh human-uat` and `./io-run.sh release-uat` (no args) behave identically to current
- [ ] P is capped at `CFG_MAX_PARALLEL` with a warning if exceeded
- [ ] N=0 means unlimited (backwards compatible)
- [ ] `bash -n io-run.sh` passes clean

---

## Wave 2 — Parallel audit: schema + claim
**Status: [ ] not started**
**Priority: HIGH — enables Wave 3**

### What to add to `comms/schema.sql`

Add two columns to `io_queue`:
```sql
-- Add to io_queue table definition:
claimed_at  TEXT,   -- ISO-8601; NULL when unit is not claimed by any audit agent
claimed_by  TEXT    -- worker identifier; NULL when not claimed
```

These are already in `io_tasks`. Reuse the same semantics.

### What to add to `comms/migrate_to_sqlite.py`

In `upgrade_schema()`, add:
```python
# Wave 2: parallel audit claim columns on io_queue
for col, typedef in [("claimed_at", "TEXT"), ("claimed_by", "TEXT")]:
    try:
        con.execute(f"ALTER TABLE io_queue ADD COLUMN {col} {typedef}")
    except Exception:
        pass  # already exists
```

### What to add to `io-run.sh`

**`claim_next_unit(worker)`** — analogous to `claim_next_task()`:

```python
# BEGIN IMMEDIATE write lock
# Pick unit eligible for audit:
#   last_audit_round IS NULL                          → never audited
#   OR verified_since_last_audit > 0                  → new verified tasks since last audit
# AND (claimed_at IS NULL OR claimed_at < stale_cutoff)  → not currently claimed
# ORDER BY last_audit_round ASC NULLS FIRST, unit ASC
# UPDATE claimed_at, claimed_by
# COMMIT; print unit id
```

Full eligibility query:
```sql
SELECT unit FROM io_queue
WHERE (last_audit_round IS NULL OR verified_since_last_audit > 0)
  AND (claimed_at IS NULL
       OR claimed_at < strftime('%Y-%m-%dT%H:%M:%SZ',
                                datetime('now', '-' || ? || ' minutes')))
ORDER BY last_audit_round ASC NULLS FIRST,
         CASE WHEN last_audit_round IS NULL THEN 0 ELSE 1 END,
         unit ASC
LIMIT 1
```

**`reclaim_stale_units()`** — analogous to `reclaim_stale_tasks()`:
- Find `io_queue` rows where `claimed_at < now - CFG_STALE_MINUTES` (no heartbeat check needed
  for audit — audit agents don't write a heartbeat file, so just use the claim timestamp)
- Reset `claimed_at=NULL`, `claimed_by=NULL`
- Print: `⚠ Reclaimed stale audit unit {unit} (stuck for Xm)`

**`release_unit_claim(unit_id)`** — called after audit completes (success or failure):
```sql
UPDATE io_queue SET claimed_at=NULL, claimed_by=NULL WHERE unit=?
```

### Acceptance criteria

- [ ] `claimed_at` and `claimed_by` columns exist in `io_queue` after `--upgrade`
- [ ] `python3 comms/migrate_to_sqlite.py --verify` passes
- [ ] `claim_next_unit()` returns empty string when all units are claimed or ineligible
- [ ] Two concurrent `claim_next_unit()` calls never return the same unit (SQLite WAL guarantee)
- [ ] `reclaim_stale_units()` resets claims older than `CFG_STALE_MINUTES`
- [ ] `release_unit_claim()` clears the claim after audit completes

---

## Wave 3 — Parallel audit: runner + CLI
**Status: [ ] not started**
**Priority: HIGH — depends on Wave 2**

### What to add to `io-run.sh`

**`run_parallel_audit(N)`** — analogous to `run_parallel_implement()`:

```bash
run_parallel_audit() {
    local max_agents="${1:-1}"
    local agent_pids=()
    local agent_units=()

    reclaim_stale_units

    for i in $(seq 1 "$max_agents"); do
        local unit_id
        unit_id=$(claim_next_unit "io-audit-$$-${i}") || break
        [ -z "$unit_id" ] && { echo "  No more units eligible for audit."; break; }

        echo "  Audit agent ${i}: claimed unit ${unit_id}"
        local agent_file
        agent_file=$(expand_agent_to_tmp "audit-orchestrator")
        # Launch audit-orchestrator in main repo (no worktree — audit is non-committing)
        # "audit force {unit_id} 1" = audit exactly this unit and exit
        local pid
        pid=$(
            (
                claude --dangerously-skip-permissions \
                       --agent "$agent_file" \
                       --print "audit force ${unit_id} 1" < /dev/null
                release_unit_claim "$unit_id"
                rm -rf "$_AGENT_TMP_DIR" 2>/dev/null || true
            ) >&2 &
            echo $!
        )
        agent_pids+=("$pid")
        agent_units+=("$unit_id")
        echo "  Audit agent ${i}: PID ${pid}"
    done

    # Wait for all audit agents
    for idx in "${!agent_pids[@]}"; do
        wait "${agent_pids[$idx]}" || true
    done
}
```

**Important:** Audit agents run in the main repo working tree, not a worktree. They only
read source files and write task/catalog files to unit-specific directories. No git commits.
Verify this as part of acceptance criteria.

**`./io-run.sh audit [P [N]]`** mode changes:
- Parse `P` (parallel agents, default 1 for backwards compat) and `N` (unit limit, default 0)
- If `P == 1`: current behavior (single `claude --agent audit-orchestrator "audit N"`)
- If `P > 1`: call `run_parallel_audit(P)` in a loop until N units done or no work left

**`./io-run.sh full [P [N]]`** — audit P units in parallel then implement P tasks:
- Run `run_parallel_audit(P)` for the audit step
- Run `run_parallel_implement(P)` for the implement step

**`./io-run.sh audit` with no args** must behave identically to current (single agent, `CHECKPOINT_EVERY` units).

### Verify no git commits in audit-runner

Before implementing, verify: read `.claude/agents/audit-runner.md` and confirm the agent
does not call `git commit`, `git add -A`, or similar. If it does, add a pre-flight check
that aborts parallel audit if there are uncommitted changes that could create conflicts.

### Acceptance criteria

- [ ] `./io-run.sh audit 3` launches 3 parallel audit agents on 3 different units
- [ ] `./io-run.sh audit 3 6` audits at most 6 units using up to 3 agents at a time
- [ ] `./io-run.sh audit` (no args) behaves identically to current behavior
- [ ] `./io-run.sh full 2` runs 2 parallel audit agents then 2 parallel implement agents
- [ ] Two audit agents never claim the same unit simultaneously
- [ ] Stale claimed units are reclaimed before each batch
- [ ] Audit agents do NOT commit to git (verified by reading audit-runner.md)
- [ ] `bash -n io-run.sh` passes clean

---

## Wave 4 — Auto mode: three-way proportional dispatch + decompose
**Status: [ ] not started**
**Priority: MEDIUM — depends on Wave 3**

### Current auto allocation (two-way):

```
impl_slots + uat_slots = AUTO_PARALLEL
```

### New auto allocation (three-way):

```
audit_slots + impl_slots + uat_slots = AUTO_PARALLEL
```

**Algorithm:**
1. `pending_audit` = units eligible for audit (same query as `claim_next_unit` eligibility)
2. `pending_impl` = tasks with status pending/failed
3. `pending_uat` = units with verified tasks and uat_status NULL or partial
4. `total_work` = pending_audit + pending_impl + pending_uat
5. If total_work = 0: done
6. Allocate proportionally, minimum 1 per type if that type has work:
   ```python
   audit_slots = ceil(AUTO_PARALLEL * pending_audit / total_work)
   impl_slots  = ceil(AUTO_PARALLEL * pending_impl  / total_work)
   uat_slots   = AUTO_PARALLEL - audit_slots - impl_slots
   # Clamp: each slot type is 0 if its pending count is 0, otherwise ≥ 1
   ```
7. Launch `run_parallel_audit(audit_slots)`, `run_parallel_implement(impl_slots)`,
   and the UAT batch all in parallel subshells, wait for all three.

**C2 kill switch update:** Count audit completions in `BATCH_PROGRESS`:
```bash
BATCH_PROGRESS=$((BATCH_AUDIT_DONE + BATCH_IMPL_VERIFIED + BATCH_UAT_PASSED))
```

**Auto mode batch output** (update existing print):
```
  Batch N: {audit_slots} audit + {impl_slots} implement + {uat_slots} UAT agents
  (pending: {pending_audit} unit(s), {pending_impl} impl task(s), {pending_uat} UAT unit(s))
```

### Decompose dispatch

Tasks in `needs_decomposition` status are never dispatched by the current system.
Add fire-and-forget decompose dispatch alongside the implement launch:

In `run_parallel_implement()` (or auto mode), before launching implement agents:
1. Query `io_tasks` for up to `impl_slots` tasks with `status='needs_decomposition'`
2. For each, launch `decompose-agent` in a worktree (uses same `launch_agent_in_worktree` pattern)
   with prompt: `TASK_ID: {task_id}`
3. Fire-and-forget via `&` — do NOT wait for them before launching implement agents
4. Print: `🔧 Launched N decompose agent(s) in background`

Note: decompose-agent output is handled by the agent itself (it updates the DB and creates
sub-tasks). The parent does not need to wait or collect results.

### Config additions

Add to `io-orchestrator.config.json` and both fallback blocks in `load_config()`:
```json
"max_audit_parallel": 2
```
Default: min(2, max_parallel). Separate cap because audit sessions are heavier than
implement sessions on the Claude context side.

### Acceptance criteria

- [ ] `./io-run.sh auto 4` allocates slots across audit + impl + UAT proportionally
- [ ] Batch summary line shows three-way allocation
- [ ] Pending audit work shows in batch count
- [ ] `needs_decomposition` tasks trigger background decompose agents
- [ ] C2 kill switch counts audit completions in progress
- [ ] `auto` with no pending audit still works correctly (audit_slots = 0)
- [ ] `bash -n io-run.sh` passes clean

---

## Wave 5 — Review
**Status: [ ] not started**
**Priority: REQUIRED — do not ship without this**

Full review of all waves 1–4 against acceptance criteria in the live code.
Treat checkboxes in this plan as untrusted — read the actual code.

### Review checklist

- [ ] Wave 1: `uat P N`, `human-uat N`, `release-uat P N` — all arg forms work
- [ ] Wave 2: schema columns exist, `--verify` passes, claim functions work correctly
- [ ] Wave 3: parallel audit launches, unit isolation confirmed, no git commits
- [ ] Wave 4: three-way auto dispatch, decompose fire-and-forget, kill switch counts audit
- [ ] All `bash -n io-run.sh` passes
- [ ] `python3 comms/migrate_to_sqlite.py --verify` passes
- [ ] `bash scripts/test-orchestrator-install.sh` passes
- [ ] No regression in `./io-run.sh status`, `implement`, `uat`, `auto` (no-op runs)
- [ ] Usage string in `./io-run.sh` is up to date with all new arg forms
- [ ] Fix any blockers found before completing

---

## Wave Prompts

### Wave 1 Start Prompt
```
Read docs/PARALLEL_PIPELINE_PLAN.md fully, then read io-run.sh (focus on the uat, human-uat, and release-uat mode sections, and the run_parallel_uat function).

You are implementing Wave 1 of the parallel pipeline plan: UAT parallel CLI args.

Key design constraint (already decided — do not second-guess):
- ./io-run.sh uat [P [N]]      — P parallel agents + N unit limit (auto UAT, fully automated)
- ./io-run.sh human-uat [N]    — N unit limit ONLY, always serial (human pass/fail per unit)
- ./io-run.sh release-uat [N]  — N unit limit ONLY, always serial (human approve/reject per feature)
human-uat and release-uat must NOT get a P arg — parallelizing them would split human
attention across N simultaneous approval prompts, which is unworkable.

Complete all Wave 1 acceptance criteria. When done:
1. Mark Wave 1 complete in docs/PARALLEL_PIPELINE_PLAN.md (update status + checkboxes)
2. Run bash -n io-run.sh to verify syntax
3. Give me the Wave 2 start prompt from this file
```

### Wave 2 Start Prompt
```
Read docs/PARALLEL_PIPELINE_PLAN.md fully, then read io-run.sh (focus on claim_next_task and reclaim_stale_tasks functions), comms/schema.sql, and comms/migrate_to_sqlite.py.

You are implementing Wave 2 of the parallel pipeline plan: parallel audit schema + claim functions.

Complete all Wave 2 acceptance criteria. When done:
1. Mark Wave 2 complete in docs/PARALLEL_PIPELINE_PLAN.md
2. Run python3 comms/migrate_to_sqlite.py --upgrade and --verify
3. Run bash -n io-run.sh to verify syntax
4. Give me the Wave 3 start prompt from this file
```

### Wave 3 Start Prompt
```
Read docs/PARALLEL_PIPELINE_PLAN.md fully, then read io-run.sh (focus on run_parallel_implement and launch_agent_in_worktree), .claude/agents/audit-orchestrator.md, and .claude/agents/audit-runner.md.

You are implementing Wave 3 of the parallel pipeline plan: parallel audit runner and CLI args.

IMPORTANT: Before implementing run_parallel_audit(), read audit-runner.md and verify it does NOT call git commit/add. Document your finding in the acceptance criteria.

Complete all Wave 3 acceptance criteria. When done:
1. Mark Wave 3 complete in docs/PARALLEL_PIPELINE_PLAN.md
2. Run bash -n io-run.sh to verify syntax
3. Give me the Wave 4 start prompt from this file
```

### Wave 4 Start Prompt
```
Read docs/PARALLEL_PIPELINE_PLAN.md fully, then read io-run.sh (focus on the auto mode section and run_parallel_implement), .claude/agents/decompose-agent.md, and io-orchestrator.config.json.

You are implementing Wave 4 of the parallel pipeline plan: three-way auto mode dispatch and decompose fire-and-forget.

Complete all Wave 4 acceptance criteria. When done:
1. Mark Wave 4 complete in docs/PARALLEL_PIPELINE_PLAN.md
2. Run bash -n io-run.sh to verify syntax
3. Give me the Wave 5 start prompt from this file
```

### Wave 5 Start Prompt
```
Read docs/PARALLEL_PIPELINE_PLAN.md fully, then read io-run.sh, comms/schema.sql, and comms/migrate_to_sqlite.py.

You are doing the Wave 5 review of the parallel pipeline plan. Do not trust the checkboxes — read the live code for every acceptance criterion.

Run:
  bash -n io-run.sh
  python3 comms/migrate_to_sqlite.py --verify
  bash scripts/test-orchestrator-install.sh
  ./io-run.sh status

For each wave (1–4): verify every acceptance criterion against live code. Flag anything marked complete that is missing or broken. Fix any blockers. List minor issues without fixing.

When done:
1. Mark Wave 5 complete in docs/PARALLEL_PIPELINE_PLAN.md
2. Write a brief summary of what was found and fixed
```
