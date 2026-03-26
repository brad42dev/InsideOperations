# io-orchestrator: Discussion Topics
_Created: 2026-03-25 — Pre-discussion notes for 5 topics. Each section is written before discussion so context survives compaction._
_After discussing each topic, update its Status line and append decisions made._
_Reference: docs/IO_ORCHESTRATOR_PLAN.md, docs/research/00_INDEX.md_

---

## How to Use This File

Each topic below is a self-contained pre-discussion briefing. The structure is:
- **Blunt assessment** of the question as asked
- **Key tensions / open questions** that need a decision
- **Options with honest tradeoffs**
- **Status** — updated after discussion

Work through topics 1–5 in order. Compact between each one. At the end of each topic discussion, the session closes with a prompt for the next topic.

---

## Topic 1 — Parallelism and Worktrees

### The Tier 4 question

The 3–5 agent cap from the research is NOT primarily about rate limits. At Tier 4 (4,000 RPM, 2M ITPM for Sonnet), rate limits are effectively not a constraint for 5–8 agents. You could push to 6–7 before rate limits become the binding constraint.

The real limits at Tier 4 are:
1. **Coordination overhead** — grows non-linearly with N agents. At 7+ agents, time spent merging branches, resolving conflicts, and handling crashes starts eating the speed gain.
2. **Sequential bottlenecks** — cargo build, pnpm build, and database migrations cannot parallelize. If 7 agents all finish simultaneously, you serialize 7 builds. This is worse than 3 agents finishing in staggered waves.
3. **Merge complexity** — 7 concurrent branches touching the same repo means 7-way merge risk. With good file isolation (per-unit locking, next topic), this is manageable. Without it, it's a mess.

**Honest recommendation for Tier 4:** 5–6 is the practical ceiling for this project. Beyond that the coordination cost outweighs the benefit. 4 is the safe default. 6 is the aggressive ceiling. 7+ is theoretically possible but produces diminishing returns and real operational pain.

### Smart orchestration: queue-aware agent mix

The idea of inspecting the queue and spinning up the right agent types is correct and should be implemented. The logic:

```
inspect queue →
  N_uat   = tasks where uat_status = null or partial
  N_impl  = tasks where status = pending
  N_audit = units where verified_since_last_audit > threshold

  allocate agents proportionally, with caps:
    uat_agents  = min(N_uat,  floor(max_agents * 0.6))
    impl_agents = min(N_impl, floor(max_agents * 0.4))
    audit_agents = 1 if N_audit > 0 else 0
```

The ratios are tunable. The key constraint: at least 1 implement agent when impl work exists, at least 1 UAT agent when UAT work exists, audit gets 1 slot max (audit is fast and serializes naturally).

`./io-run.sh auto` with no number: scan queue, compute reasonable N, cap at 4 by default (configurable). This is achievable and should be implemented in Wave 3.

### Looping until done

Yes. The outer loop should be: spawn wave → wait for all agents in wave to complete → merge branches → scan queue again → spawn next wave → repeat until queue empty. This is the supervisor loop pattern. The orchestrator never exits until all work is done or it hits an error it can't recover from.

The risk: an infinite loop caused by tasks that always fail and reset to pending. Mitigate with a per-task attempt cap (already exists in the system) and a wave-level kill switch: if N consecutive waves produce zero verified tasks, stop and alert.

### Full claude CLI agents vs subagents: tool access

Blunt answer: **full independent `claude` CLI invocations have full tool access including spawning subagents and using skills. Subagents spawned via the Agent tool cannot spawn their own subagents (no nesting) but can use all other tools.**

This matters for the orchestration model:
- `io-run.sh` launches full `claude` CLI processes → these are full agents, can use all skills
- audit-orchestrator (already a claude session) spawns audit-runner, implement-agent, etc. via Agent tool → these are subagents, cannot nest further
- If you want an implement-agent to spawn its own explore subagent mid-task: YES, it can do this because implement-agent is launched as a full CLI session by io-run.sh, not as a subagent of something else

The current architecture is already correct for this. The confusion: audit-orchestrator running inside a claude session spawns subagents via Agent tool. Those subagents are nested. But io-run.sh launching `claude --agent implement-agent` is a full CLI session, not a subagent.

### Most efficient hands-off workflow design

The supervisor loop model:

```
io-run.sh auto [N]
  → scan queue, determine work mix
  → for each agent slot:
      claim task from registry (atomic)
      create git worktree
      launch claude CLI with agent file + injected task context
  → wait for all agents (with watchdog)
  → collect results, merge branches
  → log wave summary
  → loop until empty
```

Key properties that make this hands-off:
- Agents self-report results into registry
- Orchestrator validates results (not just trust agent's self-report)
- Failed tasks auto-reset with attempt counter incremented
- Stale tasks auto-reset after timeout
- Orchestrator sends notification (stdout summary, optional webhook) after each wave
- Orchestrator stops only on: empty queue, unrecoverable error, attempt cap hit

**Open questions for discussion:**
- What's the right default for `auto` with no N? (Suggested: 4)
- Should UAT and implement run in the same wave or separate waves?
- Should audit ever run automatically in the supervisor loop, or stay manual?
- What's the right stale-task timeout? (Suggested: 30 min for implement, 15 min for UAT)

### Decisions (2026-03-25)

| Decision | Value |
|---|---|
| Default parallel agent count | 4 (configurable, hard ceiling 6) |
| UAT + implement wave mixing | Same wave, 60% impl / 40% UAT slot allocation |
| Full audit in supervisor loop | Manual only — full audit injects new scope, must be human-initiated |
| Post-implement verify | Automatic — queued into next wave after each implement task completes |
| Stale timeout (implement) | 30 min **heartbeat-gated** (not wall-clock) |
| Stale timeout (UAT) | 15 min **heartbeat-gated** |
| Heartbeat interval | Agent writes heartbeat every 5 min to task status file |
| On timeout | Write partial work + last status to attempt log, reset to pending, increment attempt counter |
| Tier 4 binding constraint | Coordination overhead, not rate limits |
| Agent Teams feature | No — experimental, documented instability (no session resume, task lag, no nested teams) |
| Full CLI vs subagent | io-run.sh launches full CLI sessions; those sessions can use subagents/skills internally |

Status: [x] discussed — decisions recorded above

---

## Topic 2 — Context for Accuracy: GitHub Issues vs PostgreSQL

### The real question

The user's insight is correct and important: **pre-baked context in the task record → better one-shot implementations → fewer wasted tokens overall**. This is more valuable than any speed gain from parallelism. An implement agent that reads a well-prepared task spec and succeeds on the first attempt costs 1x. One that fails and retries costs 3x+.

GitHub Issues were floated as the container for this context. That part of the idea is valid. The storage medium (GitHub Issues vs PostgreSQL vs SQLite) is a separate question from the content design.

### What "good context" means for one-shot implementation

A task record that drives a one-shot implementation needs:

1. **What to build** — spec body describing the feature, not just a title
2. **Where to build it** — exact file paths, function names, component names
3. **The contracts it must respect** — CX-RBAC, CX-ERROR, IPC wire format, etc. (currently the agent discovers these by reading manifests)
4. **Prior attempt history** — what was tried, what failed, what the error was. This is the single biggest driver of second-attempt quality.
5. **Related code examples** — a snippet of an adjacent implemented feature that uses the same pattern. If implementing a new dashboard widget, include the body of an existing working widget.
6. **Acceptance criteria** — what "done" looks like, stated as checkable conditions, not prose.
7. **Blast radius** — what other things this touches that must not break (tests, other modules).

The current system provides 1 (partially), 3 (agents must discover this themselves), and 4 (attempt logs exist but aren't injected at launch). Items 2, 5, 6, 7 are effectively missing from what agents receive at launch.

### Why agents currently underperform on first attempts

They spend a large fraction of their context budget on discovery:
- Reading CLAUDE.md (big)
- Reading the task spec (small)
- Finding the relevant source files (several reads)
- Reading the relevant design docs (huge)
- Reading the relevant spec docs (huge)
- Finding adjacent examples (several reads)

By the time they start writing code, they've consumed 40–60% of their context on things that could have been pre-computed once at task creation time and injected.

### The fix: rich task records, computed at audit time

The audit-runner already reads all this material. It should extract and store in the task record:
- File paths it identified as relevant (already partially done via task spec)
- Relevant contract IDs (CX-RBAC etc.) and the text of those contracts
- A snippet of an analogous already-implemented feature
- Acceptance criteria as a checklist (currently in prose form)

Then at agent launch time, the orchestrator injects this pre-computed context directly into the agent's startup prompt, not as "go read these files" but as the actual content.

**This is context engineering.** The orchestrator is a context assembler, not just a task dispatcher.

### GitHub Issues for this purpose: honest assessment

GitHub Issues can store this richly. But the reasons against using them as the authoritative store still apply:
- No atomic claim for parallel agents
- Network dependency (agents need internet access to read their own task)
- Latency: every task read is an API call vs a local DB query
- Rate limits on comment writes if many agents are running simultaneously

The correct answer for the storage question: **PostgreSQL or SQLite, with a `context_blob JSONB` column per task that stores the pre-computed context package.** The agent receives this blob as part of its startup prompt injection. GitHub Issues can mirror this for human visibility.

The context package format (stored in DB, injected at launch):
```json
{
  "spec_body": "...",
  "relevant_files": ["frontend/src/foo/Bar.tsx", "..."],
  "contracts": { "CX-RBAC": "...", "CX-ERROR": "..." },
  "analogous_example": { "file": "frontend/src/baz/Widget.tsx", "snippet": "..." },
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "blast_radius": ["frontend/src/router.tsx (do not modify)"],
  "prior_attempts": [
    { "attempt": 1, "result": "fail", "error": "TSC error: type X not assignable to Y", "files_changed": ["..."] }
  ]
}
```

This package is assembled once (at audit time or when the task is created), stored in the DB, and injected verbatim into the agent's system prompt at launch. The agent doesn't need to discover anything — it starts with everything it needs.

**Open questions for discussion:**
- Who assembles the context package: audit-runner at task creation, or orchestrator at task claim time?
- How do you keep the context package from becoming bloated? (Each contract section is potentially huge.)
- How do you handle the case where an analogous example doesn't exist yet (early in the project)?
- Should prior attempt history be summarized or injected raw?
- Is there a maximum context package size beyond which you're hurting rather than helping?

### Decisions (2026-03-25)

| Decision | Value |
|---|---|
| Context delivery model | Pre-packaged at task record; implement agent starts with everything, does no spec discovery |
| Who builds context, when | Two-phase: audit-runner builds static parts (spec_body, contracts, acceptance_criteria, blast_radius, relevant_file_paths) at task creation; orchestrator refreshes dynamic parts (analogous_example snippet, file path verification) at claim time |
| Agent escape hatches | Typed flags only — three types: (1) missing/wrong file → orchestrator fixes, auto-retry; (2) conflicting code patterns/interoperability → catcher agent; (3) true spec conflict/unspecced behavior → human |
| Gap routing boundary | Fact-finding (code patterns, service communication, CLAUDE.md authority questions) → agent-resolvable via catcher. Behavioral conflicts (how something should work, same-level spec contradictions) → human |
| Catcher agent | Non-blocking enrichment agent. Researches fact-finding gaps, updates context package, writes lightweight decision records. 15-min heartbeat timeout. Failures logged in status output but do not block pipeline |
| Prior attempt injection — 3-strike model | Attempt 1: base context only. Attempt 2: base context + attempt 1 summary + catcher patch. Attempt 3: base context (reset) + catcher "do not repeat" note only (no full history — breaks anchoring). After attempt 3 fails: human escalation |
| "Do not repeat" note | Written by catcher after attempt 2. Captures what approach failed twice and what to avoid. Forward-looking, not a history dump. If catcher fails after attempt 2, orchestrator launches attempt 3 with base context anyway; catcher gets another shot after attempt 3 |
| Catcher failure visibility | Logged in per-wave status summaries produced as each agent finishes; visible via status agent call; does not block anything |
| Task store backend | Pluggable. SQLite default (WAL mode, zero install, just a file). PostgreSQL optional for projects already running it. JSON flat file deprecated — not a supported backend |
| Context package size cap | 10–12K token soft cap, config-overridable. Conservative until 4.6-specific long-context data is available. Target under 130K total session tokens per implement run |
| Context metrics tracking | Extra columns on attempt row: `context_injection_tokens`, `context_final_tokens`, `context_utilization_pct`. UAT attempt row also stores the impl context numbers it ran against. Status agent surfaces averages and UAT failure rate by context band (under 80K, 80–110K, 110–130K, over 130K) |
| GitHub Issues | Mirror only for human visibility (Projects v2 kanban). Not source of truth. PostgreSQL/SQLite is authoritative |
| Lost in the middle mitigation | Mirror acceptance criteria and blast radius at both top and bottom of context package |

Status: [x] discussed — decisions recorded above

---

## Topic 3 — Units, Tasks, and File Conflicts

### The honest problem with the current unit structure

The current units (DD-06, MOD-CONSOLE, etc.) map to design doc sections, not to file ownership. A unit like "DD-06" (Frontend Shell) touches files across the entire frontend — routing, theming, navigation, global state. Two agents working on DD-06-003 and DD-06-009 simultaneously will almost certainly conflict.

The unit-as-file-owner model breaks down at the design doc level. It works at the individual task level if tasks are decomposed small enough.

### The file overlap matrix

This is the right idea. The matrix is: for each task, which files does it expect to modify? The orchestrator uses this matrix when claiming tasks to ensure no two active tasks share a file.

The challenge: the matrix has to be populated. Options:
1. **Audit-runner populates it** — during audit, the runner reads the spec and identifies likely files. This is imperfect (specs name features, not files) but gets you 70–80% accuracy.
2. **Implement-agent updates it after first run** — agent reports actual files changed in its exit protocol. Subsequent runs use actual data, not predicted data.
3. **Static analysis** — parse imports/exports to build a dependency graph, use it to predict which files a feature touches. Complex, language-specific, and still imperfect.

Option 2 is the best for accuracy but only helps after the first run. Option 1 is the best you can do upfront. Both together is correct: start with predicted, update with actual.

The matrix in PostgreSQL:
```sql
CREATE TABLE io_task_files (
    task_id TEXT REFERENCES io_tasks(id),
    file_path TEXT,
    predicted BOOLEAN,  -- false = confirmed by agent
    PRIMARY KEY (task_id, file_path)
);

-- Claim check: reject claim if any file is already in use
SELECT COUNT(*) FROM io_task_files tf
JOIN io_tasks t ON tf.task_id = t.id
WHERE t.status = 'implementing'
  AND tf.file_path IN (SELECT file_path FROM io_task_files WHERE task_id = $claimed_task_id);
```

If count > 0: skip this task, find one with no file conflicts.

### Task decomposition for parallelism

The current tasks range from trivial (add a CSS token) to large (implement an entire module). Large tasks are:
1. More likely to touch many files (conflict risk)
2. More likely to require multiple agent attempts (retry cost)
3. More likely to exhaust context mid-task (compaction risk)
4. More likely to produce wrong implementations (accuracy cost)

The ideal task size for parallel execution: **1–5 files changed, completable in one agent session without compaction, verifiable with a concrete test or visual check.**

The decompose-agent (already in `.claude/agents/decompose-agent.md`) should enforce this. Tasks above a certain complexity threshold get split before they hit the implement queue. The threshold is fuzzy but can be estimated from the task spec length and the number of files mentioned.

### Shared files: the hardest problem

Some files will always be shared: `router.tsx`, `App.tsx`, `constants.ts`, `api-client.ts`, global CSS files. These are touched by many tasks. Options:

1. **Serialize all tasks touching shared files** — safe but eliminates parallelism for a large class of tasks. Implement shared-file tasks in dedicated single-agent waves.
2. **Extract shared files into their own tasks** — "add route for X" is a task. "implement X component" is a separate task. The route task runs alone; the component task can parallelize.
3. **Accept conflicts, use git merge** — git merge handles non-overlapping edits to the same file gracefully (different functions, different sections). Only true overlapping edits produce conflicts. With good task decomposition, true conflicts are rare.

Option 3 is underrated. Git's line-level merge is surprisingly good. Two agents adding different routes to `router.tsx` in different sections will merge cleanly 90% of the time. The risk is agents that reformat the whole file.

**Open questions for discussion:**
- Should the file overlap matrix be implemented in Wave 1 or Wave 3?
- What's the right maximum task size before decompose-agent splits it?
- How should the orchestrator handle the case where every pending task conflicts with an active task? (Wait? Pick the safest conflict?)
- Should shared-file tasks always run in their own single-agent wave?

### Decisions (2026-03-25)

| Decision | Value |
|---|---|
| Unit taxonomy | Unchanged — units are for auditing/organizing only, not parallelism enforcement |
| Atomic execution unit | Task, not unit |
| Decompose-agent hard cap | 3–5 files per task, ~15–45 min human-equivalent work |
| Slice orientation | Vertical (complete behavior: handler + service + migration + component). Horizontal layer-only tasks allowed only when genuinely independent |
| Role priming | Killed. Replace with: one-line tech-stack orienting sentence + behavioral process instructions + task-specific constraints. No credential stacking |
| File overlap matrix | Safety net, not load-bearing. Populate predicted files at decompose/audit time. Implement-agent updates with actual files on completion. Wave 3 delivery |
| Central/shared files | Identified statically per project. Serialized: either orchestrator writes them directly, or dedicated single-agent tasks. Never left for parallel discovery. Known list for this project: `frontend/src/router.tsx`, `frontend/src/lib/constants.ts`, global type files, RBAC permission lists (doc 03), migration sequences, `Cargo.toml`, crate `lib.rs` re-exports |
| Acceptable conflicts | Git merge handles non-overlapping edits on worktree branches. True same-line conflicts → merge fails → task reset + attempt counter increment → retry after conflicting task merges |
| File overlap check timing | At task claim time, not at decompose time |
| Runtime file lock safety net | Agents drop `<filename>.lock` in `comms/locks/` before any write, remove on close. Lock file contains: agent PID, task ID, timestamp. All agents check lock folder before opening any file for write. If locked: agent signals orchestrator "file in use", orchestrator sets `retry_after` = now + 30 min, picks next available task. Watchdog scans lock folder between waves — any lock whose PID is dead is removed (crash cleanup). Repeated holds on same file → orchestrator adds that file to the central/shared list |
| Lock file path encoding | Replace `/` with `_` in filename. Hash if path depth causes filename length issues |

Status: [x] discussed — decisions recorded above

---

## Topic 4 — IO-Specific vs Generic + Task Store Backend

### The config-first design goal

Agreed: everything new should use config-file tokens rather than hardcoded paths and values. This costs almost nothing during IO development (just use a constant instead of a literal) and makes genericization later a matter of populating the config, not rewriting the code.

Concrete rule for all new code in this project going forward: **no hardcoded paths, no magic numbers. Everything is `$CONFIG_TASK_DIR`, `$CONFIG_TEST_COMMAND`, `$CONFIG_REGISTRY_DB`, etc.** io-run.sh sources the config at startup and exports these. Agent markdown files use template tokens that io-run.sh substitutes before launching.

This is a development habit, not a project phase. It can start immediately.

### PostgreSQL for orchestration: the real question

PostgreSQL is the right backend for IO's application data. Is it the right backend for the orchestration task queue?

Honest answer: **it works perfectly for IO but is a poor choice for a generic orchestration tool.** Requiring PostgreSQL means:
- Users must have PostgreSQL installed and running
- Users must have a database created, user created, permissions set
- Connection string must be configured and kept secret
- The database must be up for agents to do any work

This is a non-trivial dependency for a tool that should be droppable into any project.

**Better backend for the generic case: SQLite.**

SQLite tradeoffs:
- Single file, zero service, zero configuration
- WAL mode supports concurrent reads + serialized writes — adequate for 5 agents
- Handles the `SELECT ... FOR UPDATE` equivalent via `BEGIN IMMEDIATE` + application-level locking
- No `SKIP LOCKED` — the lock is table-level, not row-level, meaning task claiming serializes. At 5 agents claiming tasks every 30–60 minutes, this serialization is microseconds, not seconds.
- Portable: the DB file can live in `comms/tasks.db`, excluded from git, backed up trivially
- No network dependency
- Python's `sqlite3` is in stdlib — no install required

**The one thing SQLite can't do that PostgreSQL can: LISTEN/NOTIFY.** Agents can't be woken on new work appearing. They must poll. For a system where tasks take 10–60 minutes each, polling every 30 seconds is completely fine.

**The pragmatic answer for this project:**
- Use SQLite now (for portability and no extra infrastructure)
- Design the backend as a pluggable interface with SQLite as default and PostgreSQL as an optional override
- IO uses PostgreSQL override since it's already running; new projects default to SQLite

**The pluggable interface** is just a shell function set. `claim_next_task()`, `update_task_status()`, `get_task_context()`, etc. Implemented twice: once with sqlite3 CLI, once with psql. io-run.sh sources the right implementation based on config.

**Open questions for discussion:**
- Is SQLite's serialized-write acceptable for the target parallelism level (4–5 agents)?
- Should the config support both backends or just default to SQLite with a PostgreSQL upgrade path?
- For IO specifically: use the existing IO PostgreSQL DB, or a separate SQLite file to keep orchestration state isolated from application state?
- Should the task registry DB file live in the repo (tracked) or outside (untracked)?

### Decisions (2026-03-25)

| Decision | Value |
|---|---|
| Orchestration state backend for IO | SQLite — separate from IO app DB, even though PostgreSQL is available |
| Why not IO's PostgreSQL | No concurrency pressure justifies it. 4–5 agents claiming tasks every 30–60 min = microsecond lock contention. Orchestration state is tooling metadata, not product data. Clean separation outweighs marginal PG benefits |
| Orchestration DB location | `comms/tasks.db` — gitignored, runtime state. NOT tracked |
| What IS tracked | Task spec files (`docs/tasks/*.md`), decision files, ledger entries. `tasks.db` is a derived operational index of that content |
| AUDIT_PROGRESS.json role change | Demoted to generated human-readable snapshot from tasks.db. No longer authoritative. JSON flat file not a supported backend |
| Config file | `io-orchestrator.config.json` — tracked, in repo root. Sections: `project`, `commands`, `paths`, `agents`, `units`, `never_touch`, `task_store` |
| Task store config shape | `task_store.type: "sqlite"\|"postgresql"`. SQLite: `path: "comms/tasks.db"`. PostgreSQL: `connection_env: "IO_ORCHESTRATOR_DATABASE_URL"` (connection string in env, not config) |
| Pluggable backend interface | Shell function set: `claim_next_task()`, `update_task_status()`, `get_task_context()`, etc. io-run.sh sources the right implementation at startup based on `task_store.type`. Two implementations: sqlite3 CLI and psql |
| Config-first habit | Starts immediately. No hardcoded paths, ports, or commands in any new code. All values via `$IO_CONFIG_*` env vars sourced from config at io-run.sh startup. Agent markdown files use `{{ config.* }}` template tokens substituted by io-run.sh before launching each session |
| Distribution strategy (v1) | Copy-once: agent files to `.claude/agents/`, runner to project root. Version comment in each agent file (`# io-orchestrator-version: x.y.z`). Manual update only in v1 — no copier/npm automation |
| Tech stack verify modules | Rust and TypeScript built-in. Other languages via `commands.*` config fields — no language-specific heuristics for them |

Status: [x] discussed — decisions recorded above

---

## Topic 5 — Guardrails, Spec Engineering, Prompt/Context/Intent Engineering

### The hierarchy stated

Accuracy > Efficiency > Effectiveness > Safety > Speed

Blunt assessment: the current system optimizes for Safety (git reverts) and Speed (parallel agents) while giving Accuracy and Efficiency too little structural support. That's backwards given the stated priorities.

### Where accuracy failures happen (root causes)

1. **Agent doesn't read the spec** — reads task title, infers the rest. Implement-agent has spec-reading in LOAD PHASE but enforcement is weak.
2. **Agent reads the wrong version of the spec** — design-doc says X, spec_doc says Y (Y wins), agent reads design-doc. Currently: agents are trusted to find the right doc.
3. **Agent is under-informed about contracts** — doesn't know CX-RBAC applies to the new endpoint it's adding. Adds the endpoint without auth. Passes TS check. UAT passes (no auth test). Gets to prod.
4. **Agent uses stale context** — reads `AUDIT_PROGRESS.json` at launch, state is already 10 minutes old by the time it acts on it.
5. **Agent self-reports pass on a shaky implementation** — the verdict is the agent's own judgment. If the agent is uncertain, it might report PASS to avoid marking itself as failed.

### Prompt engineering: what actually works

The research is clear on this. The things that reliably improve accuracy:

1. **Positive + negative examples** — show the agent a correct implementation AND a common wrong implementation. "This is how CX-RBAC is applied correctly. This is the wrong way that looks right but isn't."
2. **Explicit acceptance criteria as a checklist** — not "the feature should work" but "[ ] endpoint returns 403 for viewer role [ ] endpoint returns 200 for admin role [ ] response shape matches IPC_CONTRACTS §4.2"
3. **Constrain the search space** — tell the agent exactly which files are in scope. Out-of-scope files are already implemented via X1b scope check but the constraint should also be in the startup prompt, not just the exit protocol.
4. **State the anti-pattern explicitly** — "Do not use useEffect for data fetching. Use TanStack Query." If you don't say it, agents use whatever pattern they know.
5. **Calibrate confidence** — ask the agent to rate its confidence before writing code. Low-confidence agents should flag for human review rather than guess.

### Context engineering: the goldilocks zone

Real data from Anthropic's research: agent performance peaks at 60–80% context utilization. Under 40% means the agent wasn't given enough information. Over 90% means compaction happens, the agent loses track of constraints, and accuracy drops.

The goldilocks zone for a ~200K context window is roughly **100–140K tokens of content before the agent starts writing code.** That leaves 60–100K for the agent's own reasoning and output.

What this means practically:
- CLAUDE.md should be under 600 lines (~15K tokens). Currently it's large.
- Task context package (spec, contracts, prior attempts): target 20–40K tokens
- Relevant source files: target 20–40K tokens
- Reserve 60K+ for agent reasoning

If the pre-loaded context exceeds ~80K tokens, either trim it (summarize contracts instead of full text) or split the task smaller.

### Intent engineering: what it is and why it matters

Intent engineering means every agent launch includes an explicit statement of:
- What we want to achieve (the goal)
- What we want to avoid (the failure mode)
- What success looks like (measurable)
- What matters more when there's a tradeoff

Current system: agents get a task description. They infer intent from context. This produces inconsistent behavior — agents prioritize differently depending on how they interpret ambiguous specs.

The fix: a short "intent header" prepended to every agent launch prompt:

```
INTENT: Implement [task-id] with one-shot accuracy as the primary goal.
PRIORITY: Correctness over speed. Do not commit speculative code.
FAILURE MODE TO AVOID: Implementing the visible behavior without the underlying contract compliance.
SUCCESS CRITERIA: All items in the task acceptance checklist are checkable green.
IF UNCERTAIN: Stop and report NEEDS_INPUT rather than guessing.
```

This is different from the task spec. The spec says what to build. The intent header says how to think about building it.

### Spec engineering: the oracle model

The spec is the oracle. Every implementation is measured against it. If an implementation would contradict the spec, the agent must either:
1. Stop and flag it (NEEDS_INPUT with a clear explanation of the contradiction)
2. Not contradict it (find a way to comply)

The current system has this in theory but enforcement is weak. The implement-agent reads specs but isn't required to produce a spec-compliance statement before writing code.

The fix: add a mandatory "spec compliance check" step to implement-agent's LOAD PHASE:

```
After reading the spec, before writing any code:
1. State in one sentence what the spec requires this task to do.
2. State any constraint from CX-* contracts that applies.
3. State whether your planned approach complies with both.
4. If any contradiction: STOP, write NEEDS_INPUT with explanation, exit.
```

This is cheap (200–400 tokens) and catches spec misreads before they produce wrong code.

### Hooks for hard enforcement

Claude Code hooks execute shell commands before/after tool use. They can reject tool calls by returning non-zero exit codes. This is the hardest enforcement layer.

What hooks can enforce:
- **Pre-Write hook**: before any file write, check the file path against `never_touch` list. Reject if match. This is absolute — the agent cannot bypass it.
- **Pre-Bash hook**: before any shell command, check for destructive patterns (rm -rf, git reset --hard, DROP TABLE). Reject if match.
- **Post-Write hook**: after any file write, run linter on the changed file. If lint fails badly (not just warnings), write the violation to a log. (Don't reject — the agent may be mid-edit.)

What hooks cannot enforce:
- Whether the agent understood the spec correctly
- Whether the implementation is semantically correct
- Whether the agent is about to write to a file it shouldn't (it could write to a temp file and then mv — hooks see the Write tool call, not the file system result)

### MCP for structured spec access

Instead of agents reading spec files via Read tool (getting raw markdown they then parse), a custom MCP server could expose specs as structured queries:

```
get_spec(unit_id) → { title, acceptance_criteria[], contracts[], analogous_example }
get_contract(contract_id) → { summary, rules[], examples[] }
```

This is lower token cost than reading full spec files, and the structure forces the spec to be machine-readable, which in turn forces better spec writing.

The MCP server is a local HTTP server (Node or Python, ~200 lines). It reads the spec files and exposes them via the MCP protocol. Agents call `mcp__spec__get_spec("MOD-CONSOLE-014")` instead of `Read("spec_docs/console-implementation-spec.md")`.

This is Worth Building but not on the critical path. It can come after the core parallelism work.

### The effective non-interactive enforcement stack (in order of enforcement strength)

| Layer | Mechanism | What it enforces | Bypass risk |
|-------|-----------|-----------------|-------------|
| 1 (hardest) | Hooks | File paths, destructive commands | Low — hooks run outside agent |
| 2 | Startup prompt intent header | Priorities, failure modes, IF UNCERTAIN behavior | Medium — agent can ignore prose |
| 3 | Mandatory LOAD PHASE compliance check | Spec reading, contract identification | Medium — agent can skip if not enforced |
| 4 | Structured context package | Correct spec version delivered, no discovery needed | Low — agent gets the right thing |
| 5 | Exit protocol validation | Self-reported verdict checked against objective criteria | Medium — validation is in agent, not outside |
| 6 (softest) | UAT | Behavioral correctness after implementation | High — UAT is a separate agent, can miss things |

The current system has layers 5 and 6. It's missing layers 1–4 almost entirely. Adding layers 1–4 is what moves the needle on first-attempt accuracy.

### On spec contradictions requiring human review

The current NEEDS_INPUT flow works but is passive — the agent stops and waits. For a fully automated system, you want:

1. Agent detects contradiction → writes to a structured escalation queue
2. Orchestrator reads escalation queue after each wave
3. Orchestrator can either: auto-resolve (if the contradiction matches a known pattern), or: pause the relevant task and continue with other work, alerting the human via the wave summary

This is the escalation-agent's job (already exists). The missing piece is the orchestrator picking up escalations and routing them correctly rather than silently leaving them in `comms/needs_input/`.

**Open questions for discussion:**
- Which enforcement layers to prioritize? (Suggestion: hooks first, then context packages, then startup intent header)
- Should the spec compliance check in LOAD PHASE be a hard gate (STOP if contradiction) or advisory (flag but continue)?
- Is the MCP spec server worth building for IO, or is structured context injection into the startup prompt sufficient?
- What's the right escalation handling in the supervisor loop? (Pause affected tasks? Alert human? Auto-resolve from decision files?)
- How do you handle spec updates mid-project? (If a contract changes, all in-flight tasks using that contract need their context packages regenerated.)

### Decisions (2026-03-25)

| Decision | Value |
|---|---|
| Enforcement layer priority | Context packages first (highest accuracy ROI). PostToolUse linting hook for incremental feedback. Stop/TaskCompleted verification hook as external hard gate. Hooks are structural safety + completion verification — not accuracy enforcement |
| CLAUDE.md | Reduced 341 → 156 lines. Non-negotiable constraints belong in hooks, agent-specific behavior in agent definition files, task-specific context in injected message. Done. |
| Spec compliance check in LOAD PHASE | Advisory — agent writes structured cited output (spec section + quote + compliance assertion), not a prose promise. Agents do not self-enforce stop instructions reliably (~61% compliance). Hard gate is the external verifier, not the LOAD PHASE instruction |
| Verification agent — dimensional scoring | Five dimensions checked independently: (1) spec compliance — each cited spec requirement matched, (2) contract compliance — each CX-* contract satisfied, (3) acceptance criteria — each checklist item checkable green, (4) blast radius — never-touch files untouched, (5) build integrity — compiles clean AND lints clean (separate checks). Routing based on which dimensions fail and severity, not a single confidence score |
| Verification agent — routing | All pass → auto-merge. Build/lint only → auto-retry once. Acceptance criteria fail → reset to pending, inject failure detail into attempt 2. Contract fail (CX-RBAC, CX-ERROR etc.) → human escalation, no auto-retry. Spec contradiction → human escalation |
| Linting | PostToolUse hook on Write/Edit: runs linter on changed file immediately, injects results back while agent has context for fixing. Verification agent checks compile and lint as separate dimensions. Add tsc --noEmit as distinct TypeScript check (currently absent). cargo clippy -D warnings already enforced |
| MCP spec server | Not for implement-agent (pre-assembled context covers it). Build for spec-scout, audit-runner, feature-agent, design-qa in Wave 2–3. Embeds spec_docs > design_docs authority hierarchy — single interface means all research agents automatically get the authoritative version. Capabilities: get_spec(unit_id), get_contract(contract_id), list_units(), search_specs(keywords) |
| Escalation categories | CONTRACT_CONFLICT, MISSING_SPEC, AMBIGUOUS_REQUIREMENT, TECHNICAL_BLOCKER. TECHNICAL_BLOCKER: orchestrator auto-resolves by sequencing, no human needed. Others route to escalation-agent |
| Escalation-agent role | Research-and-interview agent, not a router. Does targeted research before presenting to human: reads conflicting spec sections, checks existing decision files, finds adjacent implemented patterns. Presents 2–4 viable options (multiple choice). Options document design space — rejected options are recorded too |
| Human interaction model | Orchestrator continues other tasks while escalation waits. Human notified: `./io-run.sh resolve <task-id>`. Interactive session with escalation-agent. Output: decision file written to docs/decisions/ immediately, blocked task re-queued with decision injected into context package |
| Decision file compounding | Decision files persist and prevent recurrence. Same class of question auto-resolves on future tasks. System gets cheaper to run as decision library grows |
| MISSING_SPEC sub-cases | Three sub-cases with different routing: (1) context assembly failure — spec content exists but wasn't injected, fix context package, auto-retry, log as signal for audit-runner improvement; (2) spec_docs gap — behavior in design-docs but no spec_doc written yet, proceed on design-doc authority, flag for spec_doc authoring; (3) genuine gap — not in spec_docs, not in design-docs, not inferable — human escalation, interactive session, new decision file or spec addition |
| Context assembly failure tracking | Pattern tracked in orchestrator metrics. Repeated context assembly failures for the same spec section surface as a signal that audit-runner's extraction logic needs improvement for that section |
| Spec updates mid-project | Lazy hash invalidation: context package records hash of all included spec files. On task claim: orchestrator recomputes hashes, mismatch → regenerate context package before launching agent. No rebuild storm on spec commits — only rebuilds when task is actually claimed |
| Spec update signal flow | Two directions: passive (hash invalidation on claim) + active (escalation resolution immediately re-queues blocked tasks with updated context). In-flight tasks: flagged in wave summary after merge, not blocked mid-run |
| Spec change sources | feature-agent sessions, /design-qa, escalation-agent approved additions, bug investigations. All four route through the same hash invalidation and re-queue mechanisms — no special handling per source |

Status: [x] discussed — decisions recorded above

---

## Topic Decision Log

_Updated after each discussion_

| Topic | Decision | Date |
|-------|----------|------|
| 1 — Parallelism | Default 4 agents (ceiling 6), same-wave UAT+impl mixing, heartbeat-gated timeouts, full audit manual-only | 2026-03-25 |
| 2 — Context for accuracy | Pre-packaged context, two-phase assembly, typed escape hatches, catcher agent, 3-strike model, SQLite default backend, 10–12K token cap | 2026-03-25 |
| 3 — Units and file conflicts | Tasks are atomic unit (3–5 files), vertical slices, role-priming killed, file overlap matrix Wave 3, runtime lock folder safety net | 2026-03-25 |
| 4 — IO vs generic + task store | SQLite for IO (not app DB), config-first habit now, pluggable backend, tasks.db untracked | 2026-03-25 |
| 5 — Guardrails and spec engineering | Dimensional verification (not binary), advisory LOAD PHASE check + external verifier, MCP for research agents Wave 2–3, categorized escalation with research-and-interview agent, lazy hash invalidation for spec updates | 2026-03-25 |

---

## Prompts to Continue Each Topic

Use these prompts to start each session. Compact before starting each one.

**Topic 1 prompt:**
> Read docs/IO_ORCHESTRATOR_DISCUSSION.md Topic 1 section and docs/research/01_claude_parallel_agents.md. We are discussing Topic 1 — Parallelism and Worktrees. I am on Anthropic API Tier 4. Focus on: the right agent cap for Tier 4, the smart queue-aware agent mix logic, the supervisor loop design, and the most hands-off automated workflow. Answer the open questions in that section. At the end, summarize decisions made and give me the prompt for Topic 2.

**Topic 2 prompt:**
> Read docs/IO_ORCHESTRATOR_DISCUSSION.md Topic 2 section and docs/research/02_github_issues_workflow.md and docs/research/03_parallelism_safety.md §4. We are discussing Topic 2 — Context for Accuracy. Focus on: what goes in a task context package, who assembles it, how to prevent context bloat, prior attempt injection, and whether SQLite or PG stores this. This is the most important topic for one-shot accuracy. Answer the open questions. Summarize decisions and give me the Topic 3 prompt.

**Topic 3 prompt:**
> Read docs/IO_ORCHESTRATOR_DISCUSSION.md Topic 3 section and docs/research/03_parallelism_safety.md §3 and §6. We are discussing Topic 3 — Units, Tasks, and File Conflicts. Focus on: the file overlap matrix design, task decomposition rules, shared-file handling, and when conflicts are acceptable vs when they must be prevented. Answer the open questions. Summarize decisions and give me the Topic 4 prompt.

**Topic 4 prompt:**
> Read docs/IO_ORCHESTRATOR_DISCUSSION.md Topic 4 section and docs/research/04_generic_orchestration.md §4 and §7. We are discussing Topic 4 — IO-specific vs Generic and task store backend. Focus on: config-first design habit starting now, SQLite vs PostgreSQL for orchestration state, pluggable backend design, and whether IO uses the app DB or a separate orchestration DB. Answer the open questions. Summarize decisions and give me the Topic 5 prompt.

**Topic 5 prompt:**
> Read docs/IO_ORCHESTRATOR_DISCUSSION.md Topic 5 section. We are discussing Topic 5 — Guardrails, Spec Engineering, and Prompt/Context/Intent Engineering. This is the most nuanced topic. Focus on: which enforcement layers to prioritize, the spec compliance check design, hook implementation, the MCP spec server tradeoff, escalation handling in the supervisor loop, and spec update propagation. Answer the open questions. Summarize all 5 topic decisions and give me a prompt to start the IO_ORCHESTRATOR_PLAN.md wave implementation.
