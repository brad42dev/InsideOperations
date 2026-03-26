# Generic AI Agent Orchestration: Research Findings

**Date:** 2026-03-25
**Subject:** Extracting io-orchestrator into a standalone, reusable tool
**Source system:** io-run.sh (~751 lines), 11 agent markdown files, AUDIT_PROGRESS.json, docs/tasks/ spec files

---

## What This Document Covers

The current I/O project has a working Claude Code orchestration system built from bash, markdown agent definitions, and a JSON task registry. This document researches whether and how to extract that into a standalone generic tool ("io-orchestrator") installable into arbitrary projects. It covers existing frameworks, config design, bootstrapping, distribution, and a realistic assessment of what is actually achievable.

---

## 1. Existing Agent Orchestration Frameworks

### The Main Contenders

**LangGraph** (Python, LangChain ecosystem)
Graph-based workflow system for stateful multi-step processes. LangGraph 1.0 shipped October 2025 — first stable major release. Strong model for conditional branching, cyclical patterns, precise state management. Built around Python and assumes LangChain's model abstraction layer. Does not integrate with Claude Code CLI at all — it wraps API calls directly, not the Claude Code agent system. Incompatible with the "fresh Claude Code session per task" model because LangGraph manages its own context continuity.

**CrewAI** (Python)
Role-based agent framework for linear or parallel task execution. Assigns roles to agents and coordinates them through a crew. Requires Python runtime. Same problem as LangGraph: wraps API calls, not CLI sessions. Has no concept of git worktree isolation or task spec files.

**AutoGen / AG2** (Python/TypeScript)
AutoGen focuses on conversational multi-turn agent collaboration. AutoGen 0.4 is a complete rewrite heading toward Microsoft Semantic Kernel integration. AG2 is the community fork of the pre-rewrite 0.2 architecture. Both wrap API calls directly. No CLI session model.

**Ruflo (formerly Claude-Flow)** (TypeScript/WASM)
The most Claude-specific option in this space. Explicitly designed for Claude Code. Rebuilds Claude Code into a "multi-agent swarm platform" — 54+ specialized agents, shared memory, consensus mechanisms. 250,000+ lines of TypeScript and WASM. This is not a lightweight tool you install and configure in a day. It is a full platform with its own architecture. Per the project's own claims, it reduces token consumption by 75-80% in real usage. Whether those numbers hold up in practice is unknown. Heavy dependency footprint.

**ccswarm** (Rust)
Multi-agent orchestration using Claude Code CLI with git worktree isolation. Closest in spirit to the io-orchestrator approach — coordinates specialized agent pools (Frontend, Backend, DevOps, QA) in isolated worktrees. Written in Rust, uses Claude Code CLI directly, not API calls. Actively maintained. This is the most architecturally similar existing tool.

**AWS CLI Agent Orchestrator (CAO)**
Lightweight orchestration via tmux terminals. Uses MCP servers for inter-agent communication. Each agent runs in an isolated tmux session. Supervisor provides only necessary context per worker agent — directly matches the "fresh context per task" model. Bash-native in spirit. Language-agnostic. Less opinionated about task structure.

**Shipyard**
Commercial multi-agent orchestration for Claude Code. Less public architecture documentation.

### What Makes These Good or Bad for the "Fresh Context" Model

The io-orchestrator's key architectural insight is that each task runs in a completely fresh Claude Code session. This has concrete benefits: no context pollution between tasks, smaller per-session token budgets, clean error isolation, and the ability to restart mid-session without losing other tasks' work.

**Frameworks that fight this model:** LangGraph, CrewAI, AutoGen, AG2. All assume persistent agent state across a workflow run. Their value is memory across steps. Using them for fresh-context-per-task is like using a database ORM to run raw SQL — technically possible but working against the tool's design.

**Frameworks that support this model:** ccswarm, CAO, and (partially) Ruflo. These treat each agent invocation as stateless, with state persisted externally (files, databases, shared memory stores).

**Claude Code's own agent teams feature** (built-in, documented at code.claude.com/docs/en/agent-teams) is the most relevant native mechanism. Key behavior:
- Each teammate gets its own context window
- Teammates load CLAUDE.md and MCP servers but NOT the lead's conversation history
- The lead's context stays clean — only results flow back
- Token usage: approximately 3-4x a single sequential session for a 3-teammate team; up to 7x when teammates run in plan mode
- Worktree isolation: `isolation: worktree` in agent frontmatter creates a per-agent branch at `<repo>/.claude/worktrees/<n>`

The io-orchestrator already uses this system. The implement-agent frontmatter specifies `isolation: worktree`. The audit-orchestrator spawns subagents via the Agent tool. This is correct usage of Claude Code's native multi-agent model.

### Honest Assessment of Framework Fit

None of the Python-based frameworks (LangGraph, CrewAI, AutoGen) are useful here. They are API-centric, not CLI-centric. They impose a Python dependency and their own runtime model that is incompatible with "run a fresh claude CLI session per task."

Ruflo is the most ambitious Claude-specific option but has extreme complexity overhead for a tool that should be installable in minutes. It is better treated as a reference for ideas than as a dependency.

ccswarm is the most directly comparable open-source tool. Worth studying its configuration model and agent pool definitions as a reference for what a generic io-orchestrator config might look like.

The right path for io-orchestrator is not to use any of these frameworks. The bash + markdown agent model works, is already proven on a real project, and integrates directly with Claude Code's native capabilities. The question is purely about making it configurable and portable.

---

## 2. Generic Project Scaffolding Patterns

### How Established Tools Handle Portability

**cookiecutter** (Python)
Template files with Jinja2 variables. Designed for new-project bootstrapping. Can be applied to existing projects for specific file generation (e.g., adding a new Redux component to an existing React app), but that is not its primary use case. Configuration is a `cookiecutter.json` at the template root. Simple, explicit, no magic.

**Yeoman** (Node.js)
Generator-based. Generators are Node modules with their own package.json. Designed to be run inside existing projects. Can generate files, prompt users, install dependencies. More flexible than cookiecutter but heavier — requires Node.js and the yo CLI globally installed.

**Copier** (Python)
Modern cookiecutter alternative with update support — can re-apply a template to an existing project and merge changes. This is relevant: copier can ship updates to previously-installed copies of a template.

**Nx** (TypeScript monorepo)
Convention over configuration but with explicit workspace.json / nx.json config files. Nx is not a useful model for io-orchestrator — it assumes monorepo structure and its own build graph system.

**mise** (polyglot tool version manager)
Uses `.mise.toml` per project. Auto-detects language version requirements from existing files (`.node-version`, `.python-version`, `.nvmrc`, etc.) and merges them into its own config. This is a useful pattern: scan for existing convention files, emit a unified config that respects what's already there.

### Convention Over Configuration vs. Explicit Config

**Convention over configuration strengths:**
Zero-friction setup. Developer follows known directory layout, tool just works. Breaks down when project deviates from convention (different test command, nonstandard directory structure, polyglot stack).

**Explicit config strengths:**
Works for any project structure. Self-documenting. Easy to see what the tool knows about the project. More debuggable when something goes wrong.

**For io-orchestrator: use explicit config with convention-driven defaults.**

The setup flow should be:
1. Run `io-orchestrator init`
2. Tool scans the codebase and infers defaults (language, test command, build command, entry points)
3. Tool presents a config file with inferred values filled in
4. User confirms or edits
5. Config file is committed to the repo

This is the pattern used by tools like ESLint, Prettier, and Jest — they have init commands that generate config files with sensible defaults, not silent convention detection that breaks when you don't know the conventions.

---

## 3. Project Bootstrapping and Onboarding

### The Core Problem

The current system is hardcoded to the I/O project:
- `REPO_ROOT: /home/io/io-dev/io` appears literally in agent prompts
- `comms/AUDIT_PROGRESS.json` is a hardcoded path
- Design doc references (`design-docs/`, `spec_docs/`) are io-project-specific
- Tech stack assumptions (Rust/React/TypeScript/Cargo/pnpm) are embedded in verify phase logic

For a generic tool, a new project needs to declare:
- Where the repo root is (trivial — the tool can detect this via `git rev-parse --show-toplevel`)
- What "units" exist (the project's modules, services, or components)
- What the test, build, and lint commands are
- What files agents should never touch (secrets, lock files, generated files)
- What spec/design documents exist and where

### The One-Time Setup Flow

A realistic onboarding sequence for installing io-orchestrator into a new project:

**Step 1: Install**
```bash
# Option A: Copy files
curl -fsSL https://raw.githubusercontent.com/org/io-orchestrator/main/install.sh | bash
# Option B: npm package (installs scripts, agent files)
npx io-orchestrator init
```

**Step 2: Run the bootstrap agent**

A dedicated bootstrap/onboarding agent reads the codebase and generates an initial config. This agent would:
- Run `git ls-files` to understand the file tree
- Detect language(s) from file extensions and config files (package.json → Node, Cargo.toml → Rust, go.mod → Go, pyproject.toml → Python)
- Find existing test commands from package.json scripts, Makefile, etc.
- Ask the user a small set of questions: "What are the main modules/units in this project? What does 'verified' mean for a unit — does it have tests? A deployed service? A UI component?"
- Write `io-orchestrator.config.json`

**Step 3: Generate initial SPEC_MANIFEST equivalent**

For an existing project with no spec docs, the unit registry starts as a list of modules with no tasks. The human then uses feature-agent or an equivalent to add tasks to the queue.

For a project with existing spec docs (like I/O), the bootstrap agent reads those docs and populates the task registry.

### What Project Metadata Is Actually Needed

Minimum viable set:
- `project_root` — absolute path (auto-detected from git)
- `test_command` — command to run tests (e.g., `cargo test`, `pnpm test`, `pytest`)
- `build_command` — command to build (e.g., `cargo build`, `pnpm build`, `npm run build`)
- `lint_command` — command to lint (e.g., `cargo clippy`, `pnpm lint`, `ruff check`)
- `check_command` — fast type/compile check without full build (e.g., `cargo check`, `npx tsc --noEmit`)
- `task_dir` — where task spec files live (default: `docs/tasks/`)
- `state_dir` — where agent state files live (default: `docs/state/`)
- `registry_file` — task registry JSON (default: `comms/AUDIT_PROGRESS.json`)
- `units` — list of unit definitions (id, name, source_paths, spec_doc)
- `never_touch` — globs for files agents must not modify (default: `*.lock`, `.env*`, `secrets/`)
- `agent_behavior` — max retries per task, checkpoint frequency

This is approximately 15-20 fields. Not overwhelming.

---

## 4. Config File Design

### Proposed `io-orchestrator.config.json` Schema

```json
{
  "schema": "io-orchestrator/v1",
  "project": {
    "name": "my-project",
    "root": ".",
    "description": "Optional: what this project does"
  },
  "commands": {
    "test": "cargo test",
    "build": "cargo build",
    "lint": "cargo clippy -- -D warnings",
    "check": "cargo check",
    "frontend_test": "cd frontend && pnpm test",
    "frontend_build": "cd frontend && pnpm build",
    "frontend_check": "cd frontend && npx tsc --noEmit"
  },
  "paths": {
    "task_dir": "docs/tasks",
    "state_dir": "docs/state",
    "registry_file": "comms/AUDIT_PROGRESS.json",
    "spec_docs": "docs/spec",
    "decisions_dir": "docs/decisions",
    "uat_dir": "docs/uat",
    "comms_dir": "comms"
  },
  "agents": {
    "max_attempts_per_task": 3,
    "checkpoint_every": 5,
    "max_parallel": 1
  },
  "units": [
    {
      "id": "mod-api",
      "name": "API Service",
      "source_paths": ["services/api/src/"],
      "spec_doc": "docs/spec/api.md",
      "language": "rust"
    },
    {
      "id": "mod-frontend",
      "name": "Frontend App",
      "source_paths": ["frontend/src/"],
      "spec_doc": "docs/spec/frontend.md",
      "language": "typescript"
    }
  ],
  "never_touch": [
    "*.lock",
    "*.lockb",
    ".env*",
    "secrets/**",
    "*.pem",
    "*.key"
  ],
  "task_id_format": "{unit_id}-{number:03d}",
  "custom_agent_prompts": {
    "implement_suffix": "",
    "audit_context": ""
  }
}
```

### Key Design Decisions

**Language-agnostic commands:** The config provides commands as strings, not language names. The agent doesn't need to know whether `cargo test` is Rust — it just runs the command and parses the output for errors.

**Multiple command sets:** A polyglot project (Rust backend + TypeScript frontend) needs separate check/test/build commands per language area. The config should allow per-unit command overrides that fall back to the global commands.

**`never_touch` globs:** This is critical for safety. Agents must never modify lock files, secrets, or generated files. This is currently enforced in the implement-agent's scope check (X1b) by comparing git diff against the task spec's file list. In a generic tool, the `never_touch` list provides a second layer: even if a task spec accidentally lists a lock file, the agent refuses.

**`units` as explicit declarations:** Do not try to auto-detect units from directory structure. Auto-detection is brittle across project styles. The developer declares what the units are during init, and the bootstrap agent suggests based on what it sees.

**`task_id_format`:** The current system uses formats like `DD-10-001`, `MOD-CONSOLE-002`, `GFX-SHAPES-001`. In a generic tool, the format should be configurable but default to `{unit_id}-{number:03d}`.

---

## 5. SPEC_MANIFEST.md Portability

### Current State

`docs/SPEC_MANIFEST.md` in the I/O project is a manually maintained master rulebook: all units, non-negotiables, false-DONE patterns, and cross-cutting contracts. It is ~io-project-specific~ by definition — it describes I/O's 40 design documents, RBAC contracts, and IPC wire formats.

### What a Generic Equivalent Looks Like

There are two viable approaches:

**Option A: Thin generic manifest, rich per-unit spec docs**

The SPEC_MANIFEST equivalent in a generic install contains only:
- The list of units (pulled from config)
- Cross-cutting contracts that apply to all units (configurable per project)
- Links to per-unit spec docs

Per-unit spec docs (equivalent to I/O's `spec_docs/*.md`) remain project-specific and human-authored. The tool does not try to generate these from code — that is not realistic. What tools like JSDoc, OpenAPI, and swagger-jsdoc generate is *API documentation from code annotations*, not *behavioral specs from business requirements*. These are fundamentally different things. Behavioral specs require human authorship.

**Option B: No SPEC_MANIFEST at all — embed unit config in io-orchestrator.config.json**

The manifest concept merges into the config file. Each unit entry in the config has a `spec_doc` path that points to the human-authored spec. The audit-orchestrator reads this path when it needs to check a unit against its spec.

Option B is cleaner for a generic tool. The SPEC_MANIFEST in I/O grew organically to solve an I/O-specific coordination problem (40 docs, multiple developers, 118 RBAC permissions). A generic tool with 5-10 units does not need it.

### Auto-Generation Realism Check

Tools like OpenAPI/JSDoc generate *descriptions of what code does* from code annotations. They require the annotations to exist. For a new project with no annotations, you get nothing.

The more useful auto-generation direction: use the bootstrap agent to scan the codebase and draft unit descriptions (not behavioral specs, just "unit X appears to contain: [file list, major exports/handlers]"). This gives the human a starting point for authoring real specs. It is not a replacement for human spec authorship.

---

## 6. Separation of Concerns: Generic vs. Project-Specific

### What Is Genuinely Generic

**implement-agent behavior** (entry, claim, implement, verify, exit protocol) is almost entirely generic. The only io-specific content:
- Hardcoded `REPO_ROOT: /home/io/io-dev/io` — replace with config lookup
- Rust-specific verify commands (cargo check, cargo test) — replace with config `check_command` and `test_command`
- TypeScript-specific verify commands (tsc --noEmit, pnpm test, pnpm build) — same
- SQLx query validation (D1) — io-specific, should become an optional per-unit check
- Design doc references in spec-reading logic — replace with `spec_doc` from unit config

After removing those, the entry/claim/implement/verify/exit protocol is a reusable pattern applicable to any codebase.

**audit-orchestrator modes** (audit, implement, full, review_input) are generic. The queue management, task dispatching, checkpoint logic, and needs_input handling are not io-specific.

**uat-agent behavior** is partially generic. The pattern (open browser, test features, write verdict file, update registry) is generic. The Playwright-specific setup (port 5173 frontend, port 3000 backend) is partially io-specific but configurable.

**decompose-agent** is fully generic — it splits large tasks into smaller ones based on file count, which is a project-agnostic heuristic.

**escalation-agent** is fully generic — it diagnoses failure patterns (AMBIGUOUS_SPEC, MISSING_DEPENDENCY, SCOPE_TOO_LARGE, IMPLEMENTATION_FAILURE) from attempt file content, which is pattern-based and codebase-agnostic.

**feature-agent** is generic in structure but io-specific in examples and module knowledge. The "list all modules" feature would pull from `units` in config. The Q&A flow is generic.

**io-run.sh** modes are mostly generic. The hardcoded paths (`/home/io/io-dev/io`, `comms/AUDIT_PROGRESS.json`, `frontend/`, `dev.sh`) need to become config-driven.

### What Is Io-Project-Specific

- All references to design-docs, spec_docs, SPEC_MANIFEST
- The `DD-`, `MOD-`, `GFX-` task ID prefixes
- Rust/React/TimescaleDB tech stack verification steps as defaults
- Port numbers (3000 backend, 5173 frontend dev server)
- `dev.sh` startup script reference
- The RBAC/IPC contract checks in implement-agent (D2 handler shape check)
- The pnpm/cargo/sqlx assumptions baked into verify steps

Most of these are configurable with one layer of indirection: read from config instead of hardcoding.

### What Cannot Be Made Generic Without Loss of Quality

**Tech stack-specific verification wisdom:** The implement-agent knows that `todo!()` in Rust compiles but panics at runtime. It knows that a TypeScript component not imported in App.tsx is unreachable. It knows that a Rust handler not registered in the Axum router is dead code. These are tech-stack-specific heuristics that make the agent genuinely useful.

A truly generic tool would lose these checks or they would become optional per-language modules. The tradeoff is real: a generic Rust configuration section, a generic TypeScript configuration section, a generic Python configuration section — each with its own verify heuristics. This is achievable but requires writing and maintaining multiple language-specific verify modules.

The simplest approach: ship with Rust and TypeScript/JavaScript modules built-in (the two languages in I/O), and document how to add modules for other languages. Do not try to support every language from day one.

---

## 7. Distribution and Installation

### Option Analysis

**Shell script installer (curl | bash)**
- Pros: zero dependencies, works on any Unix system, familiar pattern
- Cons: security concerns (piping to bash), no version management, no easy updates
- Best for: initial bootstrap of an empty project
- Verdict: acceptable as the install mechanism but not as the ongoing update mechanism

**npm package (`npx io-orchestrator init`)**
- Pros: versioned, updatable via npm, familiar to JS/TS developers
- Cons: requires Node.js (not always present on Rust/Go/Python-only projects), adds npm metadata to non-JS projects
- Best for: TypeScript/JavaScript projects
- Verdict: good secondary option, not the primary

**GitHub Template Repository**
- Pros: the simplest possible distribution for "start a new project with this scaffold"
- Cons: cannot update installed copies — template repos are one-time copies with no link back to origin
- Best for: greenfield projects, not for install-into-existing or updates
- Verdict: useful for the "new project" use case only

**Git Submodule**
- Pros: language-agnostic, can receive updates, pinned to specific commit, no runtime dependency
- Cons: developer friction (git submodule update --init --recursive), confusing for newcomers, complicates branch switching, submodule state is notoriously error-prone in practice
- Verdict: avoid. The friction outweighs the benefits. Multiple teams have written postmortems on abandoning submodule approaches.

**Copier (Python template with update support)**
- Pros: can re-apply template updates to existing installations, supports variable interpolation, supports update migrations
- Cons: requires Python, copier binary must be installed
- Verdict: best option for "install + stay updated" if the tooling overhead is acceptable

**Separate invokable CLI (`io-orchestrator` binary or script added to PATH)**
- Pros: keeps the tool out of the consuming repo's history, clear separation of concerns
- Cons: version pinning is harder, harder to customize per project without forking
- Verdict: viable for the runner script (`io-orchestrator implement 5`) but agent files still need to live in the repo (CLAUDE.md and .claude/agents/ are read from the repo context)

### Recommended Distribution Strategy

Given the constraint that `.claude/agents/*.md` files must live in the consuming repo (Claude Code reads them from the working directory), the tool cannot be purely external. Some files must be copied into the project.

**Recommended: two-component model**

1. **Runner binary/script** — installed globally or per-project as an executable. This is io-run.sh generalized. It reads `io-orchestrator.config.json` from the current directory and drives the Claude Code sessions. Distributed as a shell script or small Rust binary. Updated independently of the project.

2. **Agent files** — copied into `.claude/agents/` during init, checked into the consuming project's repo, versioned with the project. Updated by re-running `io-orchestrator update` which uses copier-style template merging to bring in new agent file versions without overwriting project-specific customizations.

This mirrors how ESLint handles plugins and configs: a globally-installed runner with per-project configuration files checked into the repo.

### Update Strategy

The hardest problem in template-based tools. Options:

- **Semantic versioning + changelog:** When io-orchestrator 1.1 ships, the changelog lists which agent files changed. Developers manually update their copies. Simple but relies on humans.
- **Copier-style update:** `io-orchestrator update` fetches the latest template and merges changes into existing agent files, showing diffs. Requires Python + copier.
- **Agent file versioning:** Include a `# io-orchestrator-version: 1.0.3` comment in each agent file. The runner checks this on startup and warns if agent files are stale.
- **No automated updates:** Ship as a copy-once tool. Users fork it, make it their own. This is the honest answer for many projects — the agent files are project-specific enough that upstream updates are rarely applicable.

**Realistic recommendation:** For v1, do not try to solve automatic updates. Ship with a version comment in each agent file. Provide a manual update command that overwrites generic agent files while preserving project-specific ones. Define which files are generic (never touched by users: implement-agent, uat-agent, decompose-agent, escalation-agent) and which are project-specific (audit-orchestrator parameters, feature-agent examples, unit definitions in config).

---

## 8. Multi-Project Token Usage Reality Check

### What the Numbers Look Like

From the Claude Code documentation and community reports:
- Each agent teammate runs in its own context window
- A 3-teammate team uses approximately 3-4x the tokens of a single sequential session
- Teams in plan mode use approximately 7x
- The current io-orchestrator model (1 task at a time, fresh session per task) avoids the parallelism multiplier — each task is sequential, not concurrent

**For the current io-orchestrator model (sequential, 1 agent at a time):**
- Each implement round = 1 Claude Code session
- Each session loads: CLAUDE.md, the task spec, all files the task touches, and runs build checks
- Typical session: 50,000-200,000 input tokens depending on file sizes and iteration count
- At claude-3-5-sonnet-20241022 pricing ($3/M input, $15/M output): $0.15-$0.60 per task for API users
- Claude Max subscription: included in subscription cost, no per-token charge

**For a parallelized version (3 agents simultaneously):**
- 3x token consumption, 3x faster wall-clock time
- Context windows don't share state, so there is no cross-contamination benefit to parallelism — just raw speed vs. cost tradeoff

**Per-task context injection (pre-filled context summaries):**
This is what the implement-agent's `PRIOR_ATTEMPT_NOTES` and `ANSWERED_QUESTIONS` inputs do — they pass distilled context instead of full history. This is already the right pattern. For a generic tool, the same pattern applies: the orchestrator summarizes prior attempt results and passes the summary (not the full attempt file content) to the next agent. This is practical and already proven.

**What is not practical at scale:**
Injecting full spec documents, full codebase context, or full design doc sets into every agent invocation. At 40 design docs averaging 10,000 tokens each, that is 400,000 tokens of context per task before any code is read. The I/O implement-agent handles this correctly by reading only the relevant spec doc for the unit being implemented, not all 40. A generic tool must follow the same discipline: inject only task-relevant context, not project-wide context.

**Realistic expectation for cross-project use:**
If io-orchestrator is used on a project with a good `io-orchestrator.config.json` and well-written per-unit spec docs, token usage per task will be similar to I/O's experience: 50-200K tokens per task, decreasing as the implement-agent's verify steps converge faster on a smaller codebase. The economics are the same regardless of the project.

---

## 9. What Is Actually Achievable vs. Vaporware

### Achievable in a Short Timeframe (Days to Weeks)

1. **Parameterize io-run.sh** — replace all hardcoded paths with config file reads. This is purely mechanical bash work. The result is a runner that works for any project with a valid `io-orchestrator.config.json`. Effort: low.

2. **Parameterize the agent files** — replace `REPO_ROOT: /home/io/io-dev/io` and tech-stack-specific commands with config-driven values. The implement-agent already documents what it needs (task spec path, state dir, registry file). These become template variables substituted from config at session start. Effort: medium — requires a clean way to inject config into agent prompts.

3. **Write the bootstrap/init agent** — an agent that scans a new project and generates `io-orchestrator.config.json`. Effort: medium. The hard part is inferring units correctly; this requires at least one interactive Q&A turn with the developer.

4. **Write install.sh** — copies agent files to `.claude/agents/`, generates a starter config, adds io-run.sh (renamed to `orchestrator`) to the project. Effort: low.

### Achievable With More Effort (Weeks to Months)

5. **Multi-language verify modules** — separate verify logic for Rust, TypeScript, Python, Go as optional config-activated modules in implement-agent. Each module knows the idiomatic gotchas for its language. Effort: high — requires writing and testing each module.

6. **GitHub Template Repository** — clean version of the tool ready to "Use this template" for greenfield projects. Effort: low once the parameterization work is done.

7. **npm package distribution** — wrap the tool in an npm package with `io-orchestrator init`, `io-orchestrator update`, `io-orchestrator implement N` commands. Effort: medium.

8. **Copier-based update system** — define the template structure so copier can apply updates to existing installs. Effort: medium-high.

### Not Achievable / Vaporware

- **Auto-generating behavioral specs from code:** Not achievable. Code describes what was built, not what should be built. Specs require human authorship.
- **Zero-config detection of "units" from directory structure:** Not reliably achievable. A "unit" is a semantic concept (a module, a service, a bounded context) that does not map reliably to directory structure across all projects.
- **Automatic cross-project SPEC_MANIFEST:** Not achievable without project-specific spec documents. The SPEC_MANIFEST is a derivative of specs, not an auto-generation target.
- **70-80% token reduction vs. the current model:** Ruflo claims this, but the current io-orchestrator's sequential, fresh-context model is already fairly efficient. A 70-80% improvement would require dramatically reducing what each agent reads, which is already constrained to task-relevant content.

### The Realistic Scope for a v1 Generic Tool

A v1 io-orchestrator generic tool is:
- A parameterized version of io-run.sh that reads from io-orchestrator.config.json
- The same agent files with hardcoded paths and tech-stack assumptions replaced by config variables
- An `init` command that walks a developer through generating the config
- A bootstrap agent that scans the repo and suggests unit definitions
- Documentation for how to write unit spec docs that the implement-agent can consume
- Support for Rust and TypeScript/JavaScript out of the box; other languages via custom command configuration

This is concrete, achievable, and useful. It is not a platform, not a swarm framework, and not a zero-config magic tool. It is an opinionated workflow automation harness that requires the developer to author specs and declare units.

---

## 10. Summary: Config-Driven Architecture

The key change from io-project-specific to generic is a single indirection layer: read configuration from a file instead of hardcoding values in agent prompts and bash scripts.

**Before (io-specific):**
```
REPO_ROOT: /home/io/io-dev/io
PROGRESS_FILE: /home/io/io-dev/io/comms/AUDIT_PROGRESS.json
Verify: cd frontend && npx tsc --noEmit
Verify: cargo check 2>&1 | head -30
```

**After (config-driven):**
```
REPO_ROOT: {{ config.project.root }}
PROGRESS_FILE: {{ config.paths.registry_file }}
Verify: {{ config.commands.check }}
```

The agent files become templates. The orchestrator (io-run.sh descendant) reads the config, substitutes values, and passes the instantiated prompt to each Claude Code session.

The core protocol (entry → claim → implement → verify → exit) is language-agnostic and should not change. The protocol is the tool's value — it is what prevents false-DONE implementations, cycle loops, zombie tasks, and scope creep. Preserve it exactly.

---

## Sources Consulted

- [Orchestrate teams of Claude Code sessions — Claude Code Docs](https://code.claude.com/docs/en/agent-teams)
- [ccswarm — Multi-agent orchestration with Claude Code CLI and git worktree isolation](https://github.com/nwiizo/ccswarm)
- [Ruflo (Claude-Flow) — Claude orchestration platform](https://github.com/ruvnet/ruflo)
- [Shipyard — Multi-agent orchestration for Claude Code in 2026](https://shipyard.build/blog/claude-code-multi-agent/)
- [Git Worktree Isolation in Claude Code](https://medium.com/@richardhightower/git-worktree-isolation-in-claude-code-parallel-development-without-the-chaos-262e12b85cc5)
- [Claude Code — Built-in git worktree support](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/)
- [Manage costs effectively — Claude Code Docs](https://code.claude.com/docs/en/costs)
- [The Claude Code Subagent Cost Explosion](https://www.aicosts.ai/blog/claude-code-subagent-cost-explosion-887k-tokens-minute-crisis)
- [30 Tips for Claude Code Agent Teams](https://getpushtoprod.substack.com/p/30-tips-for-claude-code-agent-teams)
- [CrewAI vs LangGraph vs AutoGen — DataCamp](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)
- [LangGraph vs AutoGen vs CrewAI — Latenode](https://latenode.com/blog/platform-comparisons-alternatives/automation-platform-comparisons/langgraph-vs-autogen-vs-crewai-complete-ai-agent-framework-comparison-architecture-analysis-2025)
- [AI Agent Frameworks 2026 — OpenAgents](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)
- [Convention over Configuration — Wikipedia](https://en.wikipedia.org/wiki/Convention_over_configuration)
- [Cookiecutter vs Yeoman — OpsLevel](https://www.opslevel.com/resources/cookiecutter-vs-yeoman-choosing-the-right-scaffolder-for-your-service)
- [Git Submodules — pros and cons](https://blog.timhutt.co.uk/against-submodules/)
- [Automate Project Environments with Devbox and Direnv](https://www.jetify.com/blog/automated-dev-envs-with-devbox-and-direnv)
- [AWS CLI Agent Orchestrator](https://github.com/awslabs/cli-agent-orchestrator)
- [Squad — coordinated AI agents inside repositories](https://github.blog/ai-and-ml/github-copilot/how-squad-runs-coordinated-ai-agents-inside-your-repository/)
- [Subagents and Context Isolation — ClaudeWorld](https://claude-world.com/tutorials/s04-subagents-and-context-isolation/)
