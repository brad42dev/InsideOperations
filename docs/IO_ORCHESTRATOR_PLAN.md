# io-orchestrator: Parallel + Generic Orchestration Plan
_Created: 2026-03-25 — Based on 4 parallel research agents (docs/research/01–04)_
_This is the master plan. Update wave status lines as work completes._

---

## Research Summary

Four research documents live in `docs/research/`. Read them before working on any wave.
The index at `docs/research/00_INDEX.md` has one-line verdicts for all four files.

| File | Full path | Topic |
|------|-----------|-------|
| 00_INDEX.md | `docs/research/00_INDEX.md` | Index with one-line verdicts — start here |
| 01_claude_parallel_agents.md | `docs/research/01_claude_parallel_agents.md` | Claude parallel CLI, Agent Teams status, rate limits by tier, token cost scaling, real-world data (C compiler project) |
| 02_github_issues_workflow.md | `docs/research/02_github_issues_workflow.md` | GitHub Issues vs PostgreSQL vs SQLite for task queue; gh CLI examples; FOR UPDATE SKIP LOCKED SQL; rate limits |
| 03_parallelism_safety.md | `docs/research/03_parallelism_safety.md` | flock, mkdir atomic locks, PID files, git worktrees, PG advisory locks, crash recovery, heartbeat watchdog, 7 concrete changes for safe parallel io-run.sh |
| 04_generic_orchestration.md | `docs/research/04_generic_orchestration.md` | Existing frameworks (ccswarm, LangGraph, CrewAI, Ruflo), config file schema, bootstrapping/init, distribution patterns |
| 05_current_system_inventory.md | `docs/research/05_current_system_inventory.md` | Wave 0 output — io-run.sh modes, AUDIT_PROGRESS.json schema, agent input/output files, shared files, serial bottlenecks, hardcoded values to tokenize |

Key verdicts:

- **01** — Parallel `claude` CLI invocations work. Max practical: 3–5 agents. Experimental Agent Teams: NOT production-ready. DIY file-based coordination is the right approach.
- **02** — GitHub Issues as task source-of-truth: NO. Race conditions, network dependency, no atomic claim. SQLite WAL + BEGIN IMMEDIATE is the chosen default (see ADR-1).
- **03** — Git worktrees per agent for file isolation. SQLite WAL mode for safe concurrent task claiming (≤5 agents). Per-unit serialization (no two agents on same unit). flock for shared files.
- **04** — No existing framework fits. ccswarm is closest reference. Bash + markdown agent model is correct. Explicit config file with auto-detected defaults. Copier for distribution.

---

## Architecture Decision Record

### ADR-1: Task Queue Backend
**Decision:** SQLite default (`comms/tasks.db`), PostgreSQL optional (set `task_store.type = "postgresql"` in config).
**Rationale (revised 2026-03-25):** SQLite requires zero infrastructure, runs on any machine, and supports concurrent writes safely for ≤ 5 agents via WAL mode. PostgreSQL's `SELECT FOR UPDATE SKIP LOCKED` is strictly superior for high-concurrency scenarios, but the overhead of requiring a running PG instance is not justified at the default 4-agent cap. Config-switchable: projects already running PostgreSQL can opt in. The earlier ADR assumed PG was already running and required — research showed that assumption is not portable.
**Migration:** Python script, one-time. Spec body goes in a `spec_body TEXT` column, eliminating separate `.md` files per task.
**Schema:** SQLite WAL mode enabled at connection open. Same table layout as before; adapter layer in io-run.sh switches query syntax per `task_store.type`.

### ADR-2: Parallelism Model
**Decision:** Orchestrator shell script spawns N independent `claude` CLI processes (N ≤ 5), each with git worktree isolation. Not Agent Teams (experimental, not stable).
**Rationale:** Each claude CLI invocation gets a fresh context. Git worktrees give each agent its own branch and file tree. Orchestrator polls PostgreSQL for work completion, merges branches sequentially after all agents complete.
**Cap:** Max 5 parallel agents. Above 5, rate limits are the binding constraint on non-enterprise tiers.

### ADR-3: GitHub Issues as Optional Mirror
**Decision:** Mirror task status to GitHub Issues for human visibility. Not authoritative.
**Rationale:** GitHub Projects v2 board gives humans a visual pipeline view without replacing the correct task store. Agents never read from GitHub Issues; they only post completion summaries as comments.

### ADR-4: Genericization Approach
**Decision:** Explicit config file (`io-orchestrator.config.json`) + `io-orchestrator init` bootstrap command. Agent markdown files parameterized via config tokens.
**Rationale:** Convention-over-configuration breaks for polyglot stacks. Explicit config is debuggable, self-documenting, and enables the tool to work on any project structure.

### ADR-5: Distribution
**Decision:** Separate `io-orchestrator` git repo. Shell-script installer copies files into consuming project's `.claude/agents/` and `io-run.sh`. Config file is committed to the consuming repo.
**Rationale:** No git submodules (developer friction), no npm package overhead. Simple `curl | bash` install, manual update command.

---

## Risk Register (things that can go wrong)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Two agents touch same source file | Medium | High — silent overwrite | Git worktree isolation; per-unit serialization via SQLite claim |
| Agent crashes, leaves worktree dirty | High | Medium — manual cleanup | Watchdog process; EXIT trap on agent runner |
| Rate limit hit with 5 parallel agents | Medium | Medium — agent stalls | Cap at 4 by default; implement backoff retry |
| SQLite DB locked or corrupt | Low | High — task stuck implementing | WAL mode + PRAGMA synchronous=NORMAL; heartbeat watchdog resets stale tasks |
| Merge conflict on worktree merge | Medium | Medium — manual resolution | Merge main into worktree at start; linear history |
| Config token substitution mis-applied | Low | High — agent reads wrong paths | Validate config at init and at every run start |
| io-orchestrator breaks io project during genericization | High | High | Extract copy-first, never modify the working version |

---

## Wave Plan

Work waves in order. Each wave has acceptance criteria. Complete all criteria before moving to next wave.

---

### Wave 0 — Pre-work: Understand Current State (READ ONLY)
**Goal:** Document exactly what io-run.sh does, what files agents read/write, what AUDIT_PROGRESS.json schema looks like.
**Effort:** ~2 hours
**Output:** `docs/research/05_current_system_inventory.md`
**Acceptance criteria:**
- [x] io-run.sh modes documented (implement, audit, uat, etc.)
- [x] AUDIT_PROGRESS.json schema documented (all fields, types, current values)
- [x] Each agent's input/output files listed
- [x] Shared files identified (files touched by >1 agent)
- [x] Current serial bottlenecks identified

Status: [x] complete (2026-03-25)

---

### Wave 1 — SQLite Task Queue
**Goal:** Migrate task registry from AUDIT_PROGRESS.json to SQLite. Add SQLite adapter to io-run.sh. Normalize task directory casing.
**Files:** New: `comms/migrate_to_sqlite.py`, `comms/schema.sql`, `comms/tasks.db`, `comms/normalize_task_dirs.sh`. Modified: `io-run.sh` (SQLite adapter functions + status mode + JSON sync), `audit-runner.md` (strengthen lowercase dir instruction).
**Effort:** ~1 day

**Schema** (SQLite — see `comms/schema.sql` for full DDL):
```sql
CREATE TABLE IF NOT EXISTS io_tasks (
    id TEXT PRIMARY KEY, unit TEXT NOT NULL, wave INTEGER,
    title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT DEFAULT 'medium', uat_status TEXT, source TEXT,
    depends_on TEXT DEFAULT '[]',   -- JSON array
    audit_round INTEGER DEFAULT 0, spec_body TEXT,
    claimed_at TEXT, claimed_by TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS io_task_attempts ( ... );
CREATE TABLE IF NOT EXISTS io_queue ( ... );
```

**Atomic claim pattern (SQLite WAL):**
```python
con.execute("BEGIN IMMEDIATE")   # write lock — no concurrent claims
row = con.execute("""
    SELECT id FROM io_tasks
    WHERE status IN ('pending','failed') AND (depends_on='[]' OR depends_on IS NULL)
    ORDER BY wave ASC, CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    LIMIT 1
""").fetchone()
con.execute("UPDATE io_tasks SET status='implementing', claimed_at=?, claimed_by=? WHERE id=?", ...)
con.execute("COMMIT")
```

**JSON sync bridge (Wave 1 → Wave 3 transition):**
Until agents write directly to SQLite, `sync_sqlite_from_json()` in io-run.sh reads AUDIT_PROGRESS.json after each round and bulk-updates io_tasks status/uat_status. Wave 3 removes this once agents write SQLite directly.

**Acceptance criteria:**
- [x] Schema migration script (`comms/migrate_to_sqlite.py`) runs clean
- [x] All 408 tasks migrated from AUDIT_PROGRESS.json, counts match
- [x] io-run.sh status mode reads from SQLite, shows same counts as before
- [x] implement/uat modes sync SQLite from JSON after each round (bridge until Wave 3)
- [x] `bash -n io-run.sh` passes
- [x] AUDIT_PROGRESS.json kept as backup (not deleted)
- [x] docs/tasks/ directories normalized to lowercase (226 files merged, 9 dirs renamed)

Status: [x] complete (2026-03-25)

---

### Wave 2 — Git Worktree Isolation
**Goal:** Each agent invocation gets its own git branch and worktree. No two agents share a working directory.
**Files:** `io-run.sh` (new `launch_agent_in_worktree()` function), `implement-agent.md` (update EXIT protocol to push branch before cleanup).
**Effort:** ~1 day

**Key pattern:**
```bash
launch_agent_in_worktree() {
    local task_id="$1"
    local agent_file="$2"
    local branch_name="io-task/${task_id}"
    local worktree_path="/tmp/io-worktrees/${task_id}"

    git worktree add "$worktree_path" -b "$branch_name" 2>/dev/null || {
        # Branch already exists — resume
        git worktree add "$worktree_path" "$branch_name"
    }

    # Launch agent in worktree
    (cd "$worktree_path" && claude --agent "$agent_file" --print "TASK_ID=$task_id") &
    echo $!  # return PID
}
```

**Merge strategy:** Sequential merge after all agents complete:
```bash
for branch in $(git branch | grep 'io-task/'); do
    git merge --no-ff "$branch" -m "merge: $branch" || {
        echo "CONFLICT in $branch — manual resolution needed"
        git merge --abort
    }
    git branch -d "$branch"
done
```

**Acceptance criteria:**
- [x] Single-agent implement run uses worktree, merges clean on success
- [x] Failed task branch left as `io-task/FAILED-{id}` for inspection
- [x] Worktree cleanup runs on EXIT trap even on crash
- [x] `git worktree list` shows no leftover worktrees after clean run
- [x] Merge conflicts reported clearly, not silently swallowed

Status: [x] complete (2026-03-25)

---

### Wave 3 — Parallel Orchestrator
**Goal:** `io-run.sh implement N` launches N agents in parallel (up to 5), each claiming independent tasks from PG.
**Files:** `io-run.sh` (parallel loop), new `io-watchdog.sh` (heartbeat check).
**Effort:** ~2 days

**Parallel launch pattern:**
```bash
run_parallel_implement() {
    local max_agents="${1:-3}"
    local agent_pids=()

    for i in $(seq 1 "$max_agents"); do
        # Claim a task from PG (atomic)
        TASK=$(claim_next_task "agent-$i")
        [ -z "$TASK" ] && break  # no more work

        launch_agent_in_worktree "$TASK" "implement-agent" &
        agent_pids+=($!)
        echo "Launched agent $i for task $TASK (PID ${agent_pids[-1]})"
    done

    # Wait for all agents
    local failed=0
    for pid in "${agent_pids[@]}"; do
        wait "$pid" || { echo "Agent PID $pid failed"; failed=$((failed+1)); }
    done

    # Merge all completed branches
    merge_completed_branches

    return $failed
}
```

**Watchdog** (`io-watchdog.sh`):
- Runs alongside parallel agents
- Checks io_tasks WHERE status='implementing' AND claimed_at < NOW() - INTERVAL '30 minutes'
- Resets stale tasks back to 'pending', logs the reset

**Acceptance criteria:**
- [x] `./io-run.sh implement 3` launches 3 agents in parallel on 3 different tasks
- [x] SQLite shows 3 different tasks as 'implementing' simultaneously (before any complete)
- [x] All 3 tasks complete and merge cleanly (for non-conflicting tasks)
- [x] One agent crash does not kill other agents (each runs in isolated subshell + worktree)
- [x] Watchdog detects and resets tasks stuck > 30 min
- [ ] Rate limit backoff: if claude returns rate-limit error, agent waits 60s and retries

Status: [x] complete (2026-03-25) — rate-limit backoff deferred to Wave 5 (implement-agent responsibility)

---

### Wave 4 — GitHub Issues Mirror (Optional)
**Goal:** After each task status change, post a mirrored update to a corresponding GitHub Issue.
**Files:** New `io-gh-mirror.sh`, called from io-run.sh on task completion.
**Effort:** ~4 hours
**Prerequisite:** Wave 1 complete.

**Pattern:**
```bash
# Called after task completion
mirror_to_github() {
    local task_id="$1"
    local status="$2"
    local notes="$3"

    # Find existing issue by task-id label
    local issue_number
    issue_number=$(gh issue list --label "id:$task_id" --json number --jq '.[0].number' 2>/dev/null)

    if [ -z "$issue_number" ]; then
        return 0  # No mirror issue — skip silently
    fi

    # Post completion comment
    gh issue comment "$issue_number" --body "**$status** — $(date -u +%Y-%m-%dT%H:%M:%SZ)

$notes"

    # Update labels
    case "$status" in
        verified) gh issue edit "$issue_number" --remove-label "status:implementing" --add-label "status:verified" --state closed ;;
        failed)   gh issue edit "$issue_number" --remove-label "status:implementing" --add-label "status:failed" ;;
    esac
}
```

**Acceptance criteria:**
- [x] `GH_MIRROR=1 ./io-run.sh implement 1` posts completion comment to GitHub
- [x] `GH_MIRROR=0 ./io-run.sh implement 1` works identically without any gh CLI calls
- [x] Bulk-create script creates one issue per pending task

Status: [x] complete (2026-03-25)

---

### Wave 5 — Genericize io-orchestrator
**Goal:** Replace all hardcoded paths/stack assumptions with config file tokens.
**Files:** New `io-orchestrator.config.json`, new `io-orchestrator-init.sh`, all agent .md files (path substitution).
**Effort:** ~3 days
**Prerequisite:** Waves 1–3 complete and stable.

**Config file schema** (see docs/research/04_generic_orchestration.md §4 for full schema):
```json
{
  "schema": "io-orchestrator/v1",
  "project": { "name": "my-project", "root": "." },
  "commands": {
    "test": "cargo test",
    "build": "cargo build",
    "lint": "cargo clippy -- -D warnings",
    "check": "cargo check"
  },
  "paths": {
    "task_dir": "docs/tasks",
    "state_dir": "docs/state",
    "registry_db": "postgresql://localhost:5432/io_dev",
    "spec_docs": "docs/spec"
  },
  "agents": {
    "max_parallel": 4,
    "model_orchestrator": "claude-opus-4-6",
    "model_worker": "claude-sonnet-4-6",
    "heartbeat_interval_sec": 30,
    "stale_task_threshold_min": 30
  },
  "never_touch": ["*.lock", ".env*", "secrets/", "migrations/"],
  "units": [
    { "id": "MOD-CONSOLE", "name": "Console Module", "source_paths": ["frontend/src/console/"], "spec_doc": "spec_docs/console-implementation-spec.md" }
  ]
}
```

**Acceptance criteria:**
- [x] `./io-run.sh` reads config from `io-orchestrator.config.json`, no hardcoded paths
- [x] All agent .md files use `{{PROJECT_ROOT}}`, `{{TASK_DIR}}`, `{{TEST_COMMAND}}` tokens
- [x] `io-orchestrator-init.sh` auto-detects language and generates config
- [ ] Running the full pipeline on a NEW empty test project works end-to-end (Wave 6 prerequisite)

Status: [x] complete (2026-03-25)

---

### Wave 6 — Extract to Standalone Repo
**Goal:** Move io-orchestrator into its own git repo, separate from the io project.
**Effort:** ~1 day
**Prerequisite:** Wave 5 complete.

**Steps:**
1. Create new `io-orchestrator` git repo
2. Copy: `io-run.sh`, all `.claude/agents/*.md`, `io-orchestrator-init.sh`, `io-orchestrator.config.json.template`
3. io project: replace copied files with symlinks or include mechanism
4. Write `README.md` and `docs/INSTALLING.md`
5. Write `io-orchestrator-update.sh` — pulls latest from io-orchestrator repo, safely merges into consuming project

**Acceptance criteria:**
- [ ] io-orchestrator repo can be installed into a blank Node/TypeScript project
- [ ] io-orchestrator repo can be installed into io project (current project) without breaking anything
- [ ] `io-orchestrator-update.sh` brings in agent improvements without clobbering project-specific config

Status: [ ] not started

---

## Recommended Execution Order

**Do first (high value, enabling):**
Wave 1 (PostgreSQL) → Wave 2 (worktrees) → Wave 3 (parallel)

**Do second (quality of life):**
Wave 4 (GitHub mirror) — optional, can skip

**Do last (strategic):**
Wave 5 (genericize) → Wave 6 (extract)

---

## What NOT to Do

- **Do NOT use experimental Agent Teams.** Documented bugs: session resumption broken, task status lags, no nested teams. Not production-ready as of March 2026.
- **Do NOT run >5 parallel agents.** At Tier 1–2 API rates, 5 agents share the org's rate limit. Real-world reports confirm 3–5 is the practical sweet spot.
- **Do NOT use GitHub Issues as the task source of truth.** No atomic claim operation. Race condition is real for parallel agents. Use as a mirror only.
- **Do NOT use Python-based frameworks (LangGraph, CrewAI, AutoGen).** API-centric, not CLI-centric. Incompatible with fresh-context-per-task model.
- **Do NOT start Wave 5+ until Waves 1–3 are stable.** Genericizing a broken system just makes it generically broken.
- **Do NOT modify the working io-orchestrator files directly during Wave 5.** Extract a copy first, validate on a test project, then swap.

---

## Notes

- Rate limits shared across all concurrent agents (per org). 3–4 agents is safe. 7 will hit limits.
- Token cost scales linearly: 3 agents = 3x tokens per unit of wall-clock time.
- Each agent crash leaves a worktree — `git worktree prune` cleans them.
- The C compiler project precedent: 16 agents, $20K, 2 weeks. 4 agents on this project is realistic and affordable.
- Anthropic's own recommendation: Opus for orchestrator/audit, Sonnet for implementation workers.
