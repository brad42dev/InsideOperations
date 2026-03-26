# Current System Inventory

**Status:** Complete (Wave 0 output)
**Date:** 2026-03-25
**Purpose:** Baseline documentation of the current io-run.sh + agent system. Later waves build from this.

---

## 1. io-run.sh Modes

| Mode | Invocation | What It Does |
|------|-----------|--------------|
| `implement [N]` | `./io-run.sh implement 5` | Runs N rounds (default 5). Each round spawns one full `claude --agent audit-orchestrator "implement 1"` session. Stops if queue empty or Ctrl+C. |
| `audit [N]` | `./io-run.sh audit 3` | Same loop but passes `"audit 1"` to orchestrator. Audits units with unverified work or stale audit dates. |
| `full [N]` | `./io-run.sh full 5` | Passes `"full 1"` to orchestrator — runs audit then implement per unit in each round. |
| `uat [UNIT]` | `./io-run.sh uat` or `./io-run.sh uat DD-10` | Automated Playwright UAT. Starts backend + frontend if not running. Iterates all units with `verified` tasks where `uat_status = null or "partial"`. Calls `uat-agent` per unit. |
| `human-uat [UNIT]` | `./io-run.sh human-uat` | Same as uat but passes `human` mode — uat-agent uses AskUserQuestion for each scenario. |
| `release-uat [UNIT]` | `./io-run.sh release-uat` | Human sign-off pass. Targets units with `uat_status = "pass" or "partial"`. Calls `uat-agent "release {UNIT}"`. |
| `bug` | `./io-run.sh bug` | Interactive bug triage. Launches `bug-agent` which takes a plain-English description and creates a task file + registry entry. |
| `status` | `./io-run.sh status` | Reads AUDIT_PROGRESS.json, prints task counts by status, UAT coverage, orphaned completions, pending needs_input files. Does NOT acquire the run lock. |
| `restore-backup` | `./io-run.sh restore-backup` | Copies `comms/AUDIT_PROGRESS.json.bak` → `comms/AUDIT_PROGRESS.json`. Validates JSON first. |
| `integration-test` | `./io-run.sh integration-test` | Starts backend + frontend, runs `npx tsx tests/integration/runner.ts` from `frontend/`. |

### Loop behavior (implement/audit/full)
- Each round re-checks for available work before spending a session
- Detects `comms/needs_input/*.md` after each round — pauses and launches an interactive orchestrator session to resolve them
- Writes `comms/LAST_ROUND.json` before each round to persist progress across crashes
- Run-lock at `/tmp/io-run.lock` (flock, exclusive) — prevents concurrent invocations; `status` bypasses it

---

## 2. AUDIT_PROGRESS.json Schema

**File:** `comms/AUDIT_PROGRESS.json`
**Schema version:** `audit-progress/v2`

### Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `schema` | string | `"audit-progress/v2"` |
| `last_updated` | ISO-8601 string | Timestamp of last write |
| `checkpoint_count` | integer | How many checkpoint writes have happened this session |
| `next_checkpoint_at` | integer | Task count at which next checkpoint fires |
| `current_unit` | string \| null | Unit being actively audited (set during audit, cleared after) |
| `audit_round` | integer | Global counter — increments each time an audit run starts (not per unit) |
| `task_attempts` | object | Map of `task_id → integer` — attempt count per task |
| `queue` | array | One entry per auditable unit (35 units currently) |
| `task_registry` | array | One entry per task (408 tasks currently) |
| `escalated` | array | Currently empty — escalated task IDs |
| `units` | array | Currently empty — legacy or future field |

### queue entry fields

| Field | Type | Description |
|-------|------|-------------|
| `unit` | string | Unit ID (e.g., `"GFX-CORE"`) |
| `wave` | integer | Build wave (1, 2, or 3) |
| `status` | string | `"completed"` \| `"in_progress"` \| `"pending"` |
| `attempts` | integer | How many audit attempts on this unit |
| `repair_attempts` | integer | How many spec-repair attempts |
| `catalog` | string | Path to catalog file (e.g., `"docs/catalogs/GFX-CORE.md"`) |
| `tasks_open` | array | Task IDs still open (not yet verified) |
| `completed_at` | string | Date audit completed |
| `notes` | string | Human-readable audit notes |
| `last_audit_round` | integer \| null | `audit_round` value when this unit was last audited |
| `verified_since_last_audit` | integer | Count of tasks verified since last audit (triggers re-audit eligibility) |

**Note:** `last_audit_date` field exists on some entries (used by wave0_recency_eligible check in io-run.sh). Not always present.

### task_registry entry fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | always | Task ID (e.g., `"GFX-CORE-001"`) |
| `unit` | string | always | Parent unit ID |
| `wave` | integer | mostly | Build wave (missing on 24/408 entries) |
| `title` | string | always | Human-readable task title |
| `priority` | string | always | `"high"` \| `"medium"` \| `"low"` |
| `status` | string | always | `"pending"` \| `"verified"` \| `"implementing"` \| `"failed"` \| `"escalated"` \| `"needs_input"` |
| `depends_on` | array | always | Task IDs this task depends on |
| `audit_round` | integer | always | Round when this task was created |
| `uat_status` | string \| null | always | `"pass"` \| `"fail"` \| `"partial"` \| `"release-approved"` \| null |
| `source` | string | 129/408 | Origin (e.g., `"uat-bug"`, `"feature-agent"`) |

**Current state (2026-03-25):** 408 tasks total. 407 verified, 1 pending. UAT: 335 pass, 2 partial, 70 not yet run.

---

## 3. Agent Input / Output Files

### audit-orchestrator

**Input reads:**
- `comms/AUDIT_PROGRESS.json` — task registry and queue
- `docs/state/*/*/CURRENT.md` — zombie detection and startup reconciliation
- `comms/needs_input/*.md` — deferred questions
- `docs/decisions/*.md` — wave0 recency check
- `docs/SPEC_MANIFEST.md` — unit metadata

**Output writes:**
- `comms/AUDIT_PROGRESS.json` — updated task status, queue state
- `comms/LAST_ROUND.json` — round progress (written by io-run.sh but also by orchestrator)
- `comms/needs_input/{task-id}.md` — deferred question files (written when agent signals NEEDS_INPUT)
- `docs/state/ledger/DD-*.md` — verification ledger entries (one per verified task)

**Spawns:** audit-runner, implement-agent, spec-repair, explore-agent, escalation-agent, decompose-agent

---

### audit-runner

**Input reads:**
- `docs/SPEC_MANIFEST.md` — unit spec references and non-negotiables
- `/home/io/spec_docs/*.md` — spec files for the unit being audited
- `design-docs/*.md` — design docs for the unit
- `docs/catalogs/<unit-id>.md` — prior catalog if re-auditing
- Source code files (varies by unit)

**Output writes:**
- `docs/catalogs/<unit-id>.md` — audit catalog (gap list)
- `docs/tasks/<unit-lowercase>/<TASK-ID>-*.md` — one file per task found
- `docs/state/<unit-lowercase>/<TASK-ID>/CURRENT.md` — initial pending state
- `docs/state/<unit-lowercase>/<TASK-ID>/attempts/` — directory created

**Returns to orchestrator:** structured result block with task IDs and catalog path

---

### implement-agent

**Input reads:**
- `comms/AUDIT_PROGRESS.json` — verifies task exists in registry (grep check only)
- `docs/tasks/<unit>/<task-id>*.md` — task spec
- `docs/state/<unit>/<task-id>/CURRENT.md` — current state (claim file)
- `docs/state/<unit>/<task-id>/attempts/<N>.md` — prior attempt notes
- Source code files identified in task spec

**Output writes:**
- `docs/state/<unit>/<task-id>/CURRENT.md` — status updates throughout (claimed → implementing → completed/failed)
- `docs/state/<unit>/<task-id>/attempts/<NNN>.md` — attempt record on every terminal exit
- Source code files (the actual implementation changes)

**Returns to orchestrator:** structured result block with RESULT (DONE/FAILED/NEEDS_INPUT/CONFLICT/ESCALATE)

---

### uat-agent

**Input reads:**
- `comms/AUDIT_PROGRESS.json` — task list for the unit
- `docs/tasks/<unit>/<task-id>*.md` — task specs (for scenario derivation)
- `docs/uat/<unit>/CURRENT.md` — prior UAT result (if resuming)
- PostgreSQL (`io_dev` database) — seed data check

**Output writes:**
- `docs/uat/<unit>/CURRENT.md` — UAT result with verdict, screenshots, scenario results
- `comms/AUDIT_PROGRESS.json` — updates `uat_status` on verified tasks
- May create new bug task files in `docs/tasks/<unit>/` and state dirs if scenarios fail

---

### spec-repair

**Input reads:**
- `comms/escalated/<task-id>.md` — escalation diagnosis
- `docs/SPEC_MANIFEST.md` — manifest to check for missing entries
- `/home/io/spec_docs/*.md` — spec files (to read or extend)
- `docs/decisions/<slug>.md` — existing decision files

**Output writes:**
- `docs/decisions/<slug>.md` — new or updated decision file

---

### spec-scout

**Input reads:**
- `comms/AUDIT_PROGRESS.json` — unit list and task registry
- `docs/SPEC_MANIFEST.md`
- `/home/io/spec_docs/*.md`
- `design-docs/*.md`
- `docs/decisions/*.md`
- `docs/state/<unit>/INDEX.md`
- `docs/tasks/<unit>/<task-id>*.md`
- Source code (read-only research)

**Output writes:** None (read-only research agent)

---

### explore-agent

**Input reads:** Arbitrary source files as directed by caller

**Output writes:** None (read-only)

---

### bug-agent

**Input reads:**
- `comms/AUDIT_PROGRESS.json` — existing task list (to avoid duplicates)
- `docs/tasks/` — existing tasks (searched by keyword)
- `/home/io/spec_docs/*.md` and `design-docs/` — spec research
- Source code (read-only)

**Output writes:**
- `docs/tasks/<unit>/<TASK-ID>-bug-<slug>.md` — new bug task file
- `docs/state/<unit>/<TASK-ID>/CURRENT.md` — initial pending state
- `docs/state/<unit>/<TASK-ID>/attempts/` — directory
- `comms/AUDIT_PROGRESS.json` — appends task to `task_registry`
- `docs/state/INDEX.md` — increments unit task/pending count

---

### escalation-agent

**Input reads:**
- `docs/state/<unit>/<task-id>/attempts/*.md` — all attempt files
- `docs/tasks/<unit>/<task-id>*.md` — task spec

**Output writes:**
- `comms/escalated/<task-id>.md` — escalation diagnosis (categorized)

---

### decompose-agent

**Input reads:**
- `comms/escalated/<task-id>.md` — escalation diagnosis (SCOPE_TOO_LARGE)
- `docs/tasks/<unit>/<task-id>.md` — original task spec
- `comms/AUDIT_PROGRESS.json` — existing task IDs (to generate non-colliding new IDs)

**Output writes:**
- `docs/tasks/<unit>/<NEW-TASK-ID>.md` — 2–4 sub-task files
- `comms/AUDIT_PROGRESS.json` — adds sub-tasks to `task_registry`, marks original as decomposed
- `docs/state/<unit>/<new-task-id>/CURRENT.md` — initial pending state per sub-task
- `docs/state/<unit>/<new-task-id>/attempts/` — directory per sub-task

---

### feature-agent

**Input reads:**
- `comms/AUDIT_PROGRESS.json` — existing task IDs and unit registry
- `/home/io/spec_docs/*.md` and `design-docs/` — spec research
- `docs/decisions/*.md` — prior decisions

**Output writes:**
- `docs/decisions/<slug>.md` — decision file for the feature
- `docs/tasks/<unit>/<TASK-ID>-<slug>.md` — one or more task files
- `comms/AUDIT_PROGRESS.json` — appends new tasks to `task_registry`
- `docs/state/<unit>/<TASK-ID>/CURRENT.md` — pending state per task
- `docs/state/<unit>/<TASK-ID>/attempts/` — directory per task

---

## 4. Shared Files (Written by More Than One Agent)

| File / Path | Written By | Risk |
|-------------|-----------|------|
| `comms/AUDIT_PROGRESS.json` | audit-orchestrator, bug-agent, decompose-agent, feature-agent, uat-agent | **CRITICAL** — every agent reads/writes this. Currently protected by io-run.sh flock. Concurrent writes would corrupt it. |
| `docs/tasks/<unit>/<task-id>.md` | audit-runner (creates), bug-agent (creates), feature-agent (creates) | Different agents create different files in same directory — no collision if task IDs don't overlap. |
| `docs/state/<unit>/<task-id>/CURRENT.md` | implement-agent (primary), audit-orchestrator (reconciliation), decompose-agent (initial create) | Per-task exclusive — orchestrator and implement-agent must not write simultaneously. |
| `docs/state/INDEX.md` | bug-agent, (audit-runner creates per-unit INDEX) | Two formats — per-repo INDEX.md vs per-unit INDEX.md. Bug-agent writes root INDEX.md. |
| `docs/uat/<unit>/CURRENT.md` | uat-agent | Per-unit — no collision if UAT runs serially. |

**Key insight:** `comms/AUDIT_PROGRESS.json` is the single most dangerous shared file. It is read and written by 5+ agents and currently has no concurrent-write protection beyond the io-run.sh flock which only prevents concurrent io-run.sh invocations — not concurrent agent writes within a session.

---

## 5. Serial Bottlenecks (Cannot Parallelize Today)

| Bottleneck | Why Serial | Wave That Fixes It |
|------------|-----------|-------------------|
| `comms/AUDIT_PROGRESS.json` writes | JSON file, no atomic claim — concurrent writes corrupt it | Wave 1 (SQLite WAL) |
| All implement rounds run sequentially | io-run.sh spawns one orchestrator per round, one task per round | Wave 3 (parallel loop) |
| One agent per io-run.sh invocation | flock prevents concurrent io-run.sh | Wave 3 (flock replaced by per-task locks) |
| Worktree isolation | No worktrees today — all agents write to main working tree | Wave 2 |
| Branch merge | Not applicable today (no branches) | Wave 2+ |
| Cargo build | Inherently serial (one crate graph, one build) | Not fixable — inherent |
| `pnpm build` | Inherently serial (one bundle) | Not fixable — inherent |
| Database migrations | Must run in sequence, never in parallel | Not fixable — inherent |

---

## 6. Hardcoded Values to Tokenize

These appear in io-run.sh and/or agent files as literals. All should become `$IO_CONFIG_*` tokens (or config-file reads) in Wave 5.

### io-run.sh hardcoded values

| Value | Location | Proposed token |
|-------|---------|----------------|
| `/home/io/io-dev/io` | Line 22 (`REPO=`) | `$IO_CONFIG_REPO_ROOT` |
| `/tmp/io-run.lock` | Line 31 | `$IO_CONFIG_LOCK_FILE` |
| `http://localhost:3000/health/live` | Lines 75, 103 | `$IO_CONFIG_BACKEND_URL` |
| `http://localhost:5173` | Lines 123, 133 | `$IO_CONFIG_FRONTEND_URL` |
| `comms/AUDIT_PROGRESS.json` | Many lines | `$IO_CONFIG_REGISTRY_FILE` |
| `comms/AUDIT_PROGRESS.json.bak` | Lines 185–186 | derived from above |
| `docs/tasks/` | Line 161 | `$IO_CONFIG_TASK_DIR` |
| `docs/state` | Line 265 | `$IO_CONFIG_STATE_DIR` |
| `comms/needs_input/` | Lines 290–291 | `$IO_CONFIG_NEEDS_INPUT_DIR` |
| `comms/LAST_ROUND.json` | Lines 693–695 | `$IO_CONFIG_LAST_ROUND_FILE` |
| `docs/uat/` | Line 425 | `$IO_CONFIG_UAT_DIR` |
| `frontend/tests/integration/runner.ts` | Line 575 | `$IO_CONFIG_INTEGRATION_RUNNER` |
| `docs/decisions/` | Line 634 | `$IO_CONFIG_DECISIONS_DIR` |
| `pnpm dev` | Line 129 | `$IO_CONFIG_FRONTEND_DEV_CMD` |
| `npx tsx` | Line 575 | implicit in integration test command |
| `dev.sh start` / `dev.sh stop` | Lines 82, various | `$IO_CONFIG_BACKEND_START_CMD` / `$IO_CONFIG_BACKEND_STOP_CMD` |

### Agent file hardcoded values (all .claude/agents/*.md)

All 10 agent files with `REPO_ROOT` reference hardcode `/home/io/io-dev/io`. This appears 160 times across agent files. Every instance should become a `{{REPO_ROOT}}` token substituted at session start.

Additional per-agent hardcoded values:

| Value | Files | Proposed token |
|-------|-------|----------------|
| `/home/io/spec_docs/` | bug-agent, spec-scout, feature-agent | `{{SPEC_DOCS_DIR}}` |
| `comms/AUDIT_PROGRESS.json` | all orchestration agents | `{{REGISTRY_FILE}}` |
| `docs/tasks/` | audit-runner, implement-agent, bug-agent, feature-agent, decompose-agent | `{{TASK_DIR}}` |
| `docs/state/` | implement-agent, audit-orchestrator, decompose-agent, escalation-agent | `{{STATE_DIR}}` |
| `docs/catalogs/` | audit-runner, audit-orchestrator | `{{CATALOG_DIR}}` |
| `docs/decisions/` | spec-repair, spec-scout, feature-agent | `{{DECISIONS_DIR}}` |
| `comms/escalated/` | escalation-agent, decompose-agent | `{{ESCALATED_DIR}}` |
| `comms/needs_input/` | audit-orchestrator | `{{NEEDS_INPUT_DIR}}` |
| `docs/uat/` | uat-agent | `{{UAT_DIR}}` |
| `docs/SPEC_MANIFEST.md` | audit-runner, spec-scout | `{{SPEC_MANIFEST}}` |
| `postgres://localhost/io_dev` (implicit) | uat-agent seed check | `{{DB_URL}}` |
| `io_dev` (database name) | uat-agent | `{{DB_NAME}}` |
| `claude-opus-4-6` / `claude-sonnet-4-6` | (not hardcoded in agents — passed via CLI) | config-driven |
| `CHECKPOINT_EVERY: 3` | audit-orchestrator | `{{CHECKPOINT_EVERY}}` |
| `MAX_REPAIR: 3` | audit-orchestrator | `{{MAX_REPAIR}}` |
| `MAX_IMPL: 3` | audit-orchestrator | `{{MAX_IMPL}}` |
| `NEEDS_INPUT_STALE_HOURS: 48` | audit-orchestrator | `{{NEEDS_INPUT_STALE_HOURS}}` |
| `NEEDS_INPUT_ESCALATE_HOURS: 144` | audit-orchestrator | `{{NEEDS_INPUT_ESCALATE_HOURS}}` |

---

## 7. Unexpected / Noteworthy Findings

1. **`units` field in AUDIT_PROGRESS.json is empty.** Top-level `units: []` exists but is never populated. The `queue` array serves the unit-registry role. This field appears vestigial.

2. **Task directory casing is inconsistent.** `docs/tasks/` contains both `dd-06/` and `DD-10/` (mixed case). Agents use lowercase for lookups but the directories are mixed. This will cause cross-platform issues on case-sensitive filesystems and is a Wave 1 cleanup item.

3. **`docs/state/INDEX.md` is stale.** Bug-agent writes to it, but audit-runner creates per-unit `docs/state/<unit>/INDEX.md` files. The root INDEX.md is described in implement-agent as NOT authoritative. These are not the same file. Having two "index" files at different levels with different formats is a maintenance hazard.

4. **flock is the only concurrency guard today.** There is no per-task lock, per-unit lock, or per-file lock. The flock on `/tmp/io-run.lock` prevents concurrent `io-run.sh` invocations but does not protect against two orchestrator invocations within the same session (which can happen in manual use). Wave 1 must add per-task atomic claim to the SQLite/PG store.

5. **`comms/escalated/` path is hardcoded in escalation-agent but the mkdir is inside the agent.** The directory may not exist when the agent first runs. Wave 5 should pre-create all `comms/` subdirectories at `io-orchestrator init` time.

6. **audit-runner's RESULT block returns catalog path and task IDs but not a `spec_body` text.** The Wave 1 schema includes `spec_body TEXT` in io_tasks. This field will need to be populated by reading the task file contents at migration time, not by the runner itself.
