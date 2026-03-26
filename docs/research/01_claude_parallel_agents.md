# Claude Parallel Agents: Research Findings

**Date:** 2026-03-25
**Purpose:** Research for the I/O project pipeline — evaluating whether to run 7+ Claude Code agents in parallel to implement specs concurrently.

This document contains raw findings from official Anthropic documentation, engineering posts, and community sources. Where something is a limitation or a risk, it is stated plainly.

---

## 1. Anthropic Multi-Agent Architecture: Official Position

**Primary source:** https://code.claude.com/docs/en/agent-teams
**Secondary source:** https://code.claude.com/docs/en/sub-agents
**Engineering blog:** https://www.anthropic.com/engineering/multi-agent-research-system

Anthropic formally supports two distinct multi-agent patterns in Claude Code as of early 2026:

### Pattern A: Subagents (Within a Single Session)

A subagent is a specialized Claude instance spawned from within a parent session. It runs in its own context window, does work, and returns results to the parent. The parent session is the only one that can receive those results. Subagents cannot communicate with each other — they are purely hierarchical.

Key properties:
- Each subagent has its own context window (fresh, does not inherit parent conversation history)
- Results summarize back to the parent, keeping the parent context smaller
- Can run in background (non-blocking) or foreground (blocking)
- Cannot spawn other subagents — no nesting
- Up to ~10 simultaneous subagents is the documented practical limit before coordination overhead degrades returns
- Token cost: lower than agent teams because only summaries return to parent context

Built-in subagents in Claude Code: `Explore` (Haiku, read-only), `Plan` (read-only), `general-purpose` (all tools), `Bash`, `statusline-setup`, `Claude Code Guide`.

Custom subagents are defined as Markdown files in `.claude/agents/` (project scope) or `~/.claude/agents/` (user scope). They have configurable model, tool access, permission mode, hooks, memory, and isolation.

### Pattern B: Agent Teams (Multiple Fully Independent Sessions)

Agent teams are experimental as of early 2026 and disabled by default. Enable with:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Or in `settings.json`:
```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

**Requires Claude Code v2.1.32 or later.**

Architecture:
- A **team lead** (the originating session) spawns and coordinates teammates
- **Teammates** are fully independent Claude Code sessions, each with its own context window
- A **shared task list** (stored locally in `~/.claude/tasks/{team-name}/`) coordinates work via file locking
- A **mailbox system** enables direct messaging between any two teammates without going through the lead
- Teammates load CLAUDE.md, MCP servers, and skills independently at spawn time
- The lead's conversation history does NOT carry over to teammates

Key difference from subagents: teammates can communicate directly with each other. Subagents can only report back to the single parent.

---

## 2. Claude Code: Running Multiple Instances from Bash

### Can you run `claude` CLI simultaneously?

Yes. You can run `claude` multiple times in parallel from bash scripts — each invocation is a completely independent process with its own context. There is no built-in lock or mutual exclusion between simultaneous CLI invocations.

The officially documented manual pattern is git worktrees:

```bash
# Create a worktree for a separate task
claude --worktree  # creates isolated working directory + branch
```

This gives each session an isolated copy of the repo to work in, preventing same-file overwrites.

### Context isolation

Each `claude` invocation gets a **fresh context window**. There is no shared memory between concurrent CLI sessions unless you explicitly set up file-based communication (files on disk, shared JSON task files, etc.).

### File system access with concurrent agents

This is the primary practical risk with naive parallelism:

- **No built-in coordination.** Two agents editing the same file will cause overwrites, last-writer-wins.
- **Git worktrees isolate working directories** but they still share: local database state, Docker daemon, package caches, and any global configuration.
- **Race conditions on shared state:** Worktrees share the same local database and cache directories. Two agents modifying DB state simultaneously can corrupt it.
- **Disk space:** One developer measured 9.82 GB consumed in a 20-minute session with a ~2GB codebase when worktrees were auto-created.
- **Merge conflicts at integration:** Worktrees create separate branches. Merging them is a manual step and conflicts are not warned about in advance.

The officially documented workaround is: break work so each agent **owns a distinct set of files** with no overlap.

### Documented limits on concurrent Claude Code sessions

There is no hard-coded maximum on the number of simultaneous `claude` CLI processes. The practical limits are:

1. **API rate limits** (see Section 4 below) — shared across all concurrent sessions
2. **Weekly usage quotas** on Claude Pro/Max subscription plans
3. **Token costs** scaling linearly with number of active agents
4. **Coordination overhead** degrading returns beyond ~10 parallel workers

---

## 3. Agent Orchestration Patterns

### Orchestrator-Worker (Hub and Spoke)

Anthropic's documented and internally-used primary pattern:

- One orchestrator agent holds global state, plans work, assigns tasks
- N worker agents each do a focused piece independently
- Workers report results back to orchestrator
- Orchestrator synthesizes and makes next decisions

**Advantages:** Simple to reason about, clear ownership of global state, easy to add retry logic at the orchestrator level.

**Disadvantages:** Orchestrator is a bottleneck; workers cannot coordinate directly; orchestrator context grows with each worker result unless actively summarized.

**Anthropic's own use:** Claude Opus 4.6 as lead/orchestrator, Claude Sonnet 4.x as workers. This specific combo achieved a 90.2% performance improvement over single-agent Opus 4 on research tasks.

### Peer-to-Peer (Agent Teams)

The newer pattern enabled by the experimental Agent Teams feature:

- No single orchestrator — all agents are peers
- Shared task list with file locking for claiming work
- Direct messaging between any pair of agents
- Lead session exists only to spawn and configure the team, not to be the sole coordinator

**Advantages:** More resilient to lead failure; teammates can self-organize; better for exploratory work where the path isn't predetermined.

**Disadvantages:** Harder to reason about global state; more communication overhead; currently experimental with documented instability.

### Supervisor Pattern (Hierarchical)

Not directly documented by Anthropic but discussed in the community:

- One supervisor agent that only reads and routes, never writes
- Multiple specialized workers
- Supervisor maintains a compact state (not full conversation history)
- Workers are granted narrow tool permissions matching their role

This is essentially the orchestrator pattern with an explicit constraint that the orchestrator stays read-only, reducing the risk of the supervisor corrupting shared state.

### Pipeline (Sequential Chain)

Multiple agents chained: output of one is the input of the next. Not parallel — sequential. Use when each step depends on the previous one's results.

Example: `analyst → architect → implementer → tester → security auditor`

**This provides isolation and context management benefits even without parallelism**: each agent starts fresh, so context bloat from earlier phases does not carry forward.

### Parallel Independent Workers

Run N agents simultaneously on N completely independent tasks. No coordination needed. Each agent works on a separate module, separate files, separate branch. Results are merged by a human or orchestrator after all complete.

This is the simplest and most reliable parallelism pattern. It works best when tasks are genuinely independent (no shared files, no shared state).

### Context Handoff vs Subagent

- **Handoff:** Pass a compact summary from one agent's output as the input prompt to the next agent. The receiving agent starts fresh — it does not get the full conversation history, only the structured summary.
- **Subagent:** The parent session spawns a subagent, the subagent works and returns, and results are automatically returned. The parent decides what to keep in its context.

For the I/O project's batch workflow, the handoff pattern is more relevant than subagents — you want isolated agents working on different specs, not agents spawned from a single parent.

---

## 4. Rate Limits and Token Costs (Hard Numbers)

**Source:** https://platform.claude.com/docs/en/api/rate-limits

### API Rate Limits by Tier (as of 2026-03)

| Tier | Sonnet 4.x RPM | Sonnet 4.x ITPM | Sonnet 4.x OTPM |
|------|---------------|----------------|----------------|
| Tier 1 | 50 | 30,000 | 8,000 |
| Tier 2 | 1,000 | 450,000 | 90,000 |
| Tier 3 | 2,000 | 800,000 | 160,000 |
| Tier 4 | 4,000 | 2,000,000 | 400,000 |

Same tiers apply to Opus 4.x. Haiku 4.5 gets 4x the ITPM of Sonnet at each tier.

**Critical:** Rate limits are **per organization**, not per session. Running 7 agents simultaneously means all 7 agents share the same RPM and ITPM pool. At Tier 1 (50 RPM), 7 simultaneous agents can each make roughly 7 requests per minute total — about 1 request per agent per minute. That is effectively useless for parallel agents.

Rate limits use the token bucket algorithm — capacity continuously replenishes, not reset at fixed intervals. Short bursts can exceed RPM limits even if average is below.

**Prompt caching matters:** For most Claude 4.x models, cached input tokens do NOT count toward ITPM. A system prompt or CLAUDE.md loaded at session start that gets cached means subsequent requests have much lower ITPM impact. This is significant for parallel agents that share the same CLAUDE.md.

### Cost of Multi-Agent Work

From Anthropic's own data and engineering blog:
- Standard single agent: baseline cost
- Subagents: ~4x more tokens than a single chat interaction
- Multi-agent systems: ~15x more tokens than a single chat interaction
- Agent teams in plan mode: approximately 7x more tokens than a standard session

The C compiler project used 16 agents over ~2 weeks and cost **~$20,000 in API usage**.

Rough current pricing (Claude Sonnet 4.x, as of early 2026):
- Input: ~$3/million tokens
- Output: ~$15/million tokens

For 7 parallel agents doing substantial implementation work (each consuming, say, 500K tokens/session), expect costs in the range of **$50-200 per full parallel run** depending on model and task complexity.

### Subscription Plan Limits (Claude Max/Pro)

Weekly rate limits introduced August 2025 for heavy users:
- **Pro plan:** 40–80 hours of Sonnet 4 per week
- **Max $100/mo:** 140–280 hours of Sonnet 4, 15–35 hours of Opus 4
- **Max $200/mo:** 240–480 hours of Sonnet 4, 24–40 hours of Opus 4

Running 7 agents simultaneously means 7x the consumption rate against these weekly quotas. Seven simultaneous agents on a Pro plan could exhaust the weekly quota in **5–11 hours of real wall-clock time**.

**The team recommendation from Anthropic's cost docs:**

| Team size | TPM per user | RPM per user |
|-----------|-------------|-------------|
| 1–5 users | 200k–300k | 5–7 |
| 5–20 users | 100k–150k | 2.5–3.5 |

At 5–7 RPM for 1–5 users, running 7 agents is pushing against these ceilings.

---

## 5. Agent Teams Feature: Current Status

**Source:** https://code.claude.com/docs/en/agent-teams

### What it is

Agent teams are a first-class feature in Claude Code that coordinates multiple simultaneous Claude Code instances with:
- Shared task list (file-locked, stored in `~/.claude/tasks/`)
- Direct agent-to-agent messaging (mailbox system)
- Lead session that spawns and manages teammates
- Each teammate is a full, independent Claude Code session

### Current Status

- **Experimental and disabled by default**
- Requires: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Requires: Claude Code v2.1.32 or later
- Introduced: February 2026 with Opus 4.6

### Documented Limitations (Not Production-Ready)

Direct from official docs:

1. **No session resumption with in-process teammates:** `/resume` and `/rewind` do not restore in-process teammates. After resuming, the lead may try to message teammates that no longer exist.
2. **Task status can lag:** Teammates sometimes fail to mark tasks as completed, blocking dependent tasks. Manual intervention required.
3. **Shutdown can be slow:** Teammates finish their current request or tool call before shutting down.
4. **One team per session:** A lead can only manage one team at a time.
5. **No nested teams:** Teammates cannot spawn their own teams.
6. **Lead is fixed:** The session that creates the team is the lead for its lifetime. Cannot promote a teammate or transfer leadership.
7. **Permissions set at spawn:** All teammates start with the lead's permission mode. Cannot set per-teammate modes at spawn time.
8. **Split panes require tmux or iTerm2:** In-process mode works in any terminal. Split-pane mode not supported in VS Code integrated terminal, Windows Terminal, or Ghostty.

### What Problems It Solves vs DIY

Without agent teams, you must manually:
- Start multiple terminal sessions with `claude` in separate directories
- Write coordination files yourself (task JSON files, lock files)
- Poll for completion
- Handle cleanup of orphaned sessions

With agent teams, the coordination infrastructure (task list, messaging, shutdown, cleanup) is built in. The main value is when teammates need to actively communicate and coordinate, not just work independently.

For the I/O project's use case (agents working on isolated spec units), **DIY coordination via shared JSON files is simpler and more reliable than the experimental Agent Teams feature**.

---

## 6. Practical Parallelism: Real-World Data

### Anthropic's Internal C Compiler Project

**Source:** https://www.anthropic.com/engineering/building-c-compiler

16 parallel Claude Code agents (Opus 4.6) built a 100K-line Rust-based C compiler over ~2 weeks, with 2,000+ sessions, costing ~$20,000.

Coordination mechanism used: **Git-based task locking**
- Agents claimed tasks by writing files to a `current_tasks/` directory
- Git's built-in synchronization prevented duplicate work
- Each agent ran in its own Docker container with the repo mounted

Lessons from that project:
1. **Test verification must be nearly perfect.** Agents will solve whatever problem you define — if the verifier is wrong, agents optimize for the wrong thing.
2. **Agents need structured context to self-orient.** README docs, pre-computed statistics, error messages formatted for grep — anything that helps a fresh agent understand the state quickly.
3. **Bottleneck detection:** All 16 agents hitting the same bug simultaneously is a real failure mode. They introduced a GCC comparison oracle so agents could debug different file subsets.
4. **Cascading failures:** New features frequently broke existing functionality. Robust regression testing is not optional.

### Anthropic Research System

**Source:** https://www.anthropic.com/engineering/multi-agent-research-system

- Effort scales dynamically: 1 agent (3–10 API calls) for simple queries, 10+ subagents for complex research
- Parallel tool calling reduced research time by up to 90% for complex queries
- Token usage explains 80% of performance variance; model choice explains ~15%
- Simple queries: better done by single agent. Parallel overhead only pays off past a certain complexity threshold.

### Community-Reported Real Usage

From search results (dev.to, shipyard.build, simonwillison.net, etc.):
- Teams routinely running 4–5 parallel Claude agents: **yes, feasible and common**
- Running 10+ agents: **reported by power users, but rate limits are the binding constraint**
- The sweet spot for most teams: **3–5 agents**, balancing parallelism against token cost and coordination complexity
- Beyond 7 agents: **diminishing returns, significantly higher coordination overhead, rate limit pressure**

---

## 7. Context Window and Token Economics for Parallel Agents

### Context Window Size

Claude Sonnet 4.x and Opus 4.x: 200K token context window per instance.

Each parallel agent gets its own 200K window. They do not share context. Running 7 agents means you have 7 independent 200K windows consuming tokens simultaneously.

### Token Cost Scaling

The scaling is **roughly linear with number of agents**, not sublinear. There is no discount for parallelism.

If a single agent completing a task consumes X tokens, 7 agents completing 7 comparable tasks will consume approximately 7X tokens. Overhead from coordination (messaging, task claiming, status updates) adds additional tokens — roughly 10–20% overhead for well-structured parallel work.

The ~15x multiplier vs single chat mentioned in Anthropic's blog refers to the overhead of agentic behavior (tool calls, reasoning, retries) compared to a single-turn chat, not to the multiplier from parallelism itself.

### Context Bloat and Compaction

Each agent's context grows over the course of a session. Auto-compaction triggers at ~95% capacity (configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`). After compaction, the agent continues from a summarized context.

Compaction events are logged in subagent transcript files. The `preTokens` field shows how many tokens were in use before compaction.

For long-running parallel agents (hours of work), plan for multiple compaction cycles. Compaction quality determines whether the agent stays on track after compaction — unclear or verbose CLAUDE.md instructions survive compaction poorly.

---

## 8. File System Safety and Coordination Patterns

### The Core Problem

Two agents writing to the same file = last-writer-wins overwrite. No warning. No merge. Data loss.

### Safe Parallel Approaches (in order of reliability)

**1. File ownership partition (simplest, most reliable)**
Assign each agent a specific set of files it exclusively owns. No agent touches another agent's files. Use this whenever possible.

**2. Git worktrees (official pattern)**
```bash
# Each agent gets its own branch and working directory
git worktree add ../agent-1-work agent-1-branch
git worktree add ../agent-2-work agent-2-branch
```
Agents work in isolated directories. Integration is a manual merge step at the end. Works well when integration conflicts are expected to be minimal.

**3. File-based task queue (DIY coordination)**
```
tasks/
  pending/    ← unclaimed tasks (JSON files)
  in-progress/ ← claimed tasks (agent writes lock file)
  done/       ← completed tasks
```
Agents atomically move files between directories. Filesystem move operations are atomic on Linux (same filesystem). This is what the I/O project's current audit pipeline uses and it is a proven pattern.

**4. Git-based task locking (what Anthropic used for C compiler)**
Agents claim tasks by writing to a `current_tasks/` directory and committing. Git's synchronization handles the locking. More complex but scales to large teams.

### What NOT to Do

- Do not let multiple agents edit the same file without coordination
- Do not use non-atomic operations (read-check-write) for task claiming — use atomic file moves
- Do not share database state between parallel agents without explicit locking
- Do not rely on "hope" that agents will naturally partition work — specify it explicitly in prompts

---

## 9. Recommendations for the I/O Project

Based on all findings above, specific recommendations for running parallel Claude agents on this project:

### Architecture Recommendation

Use **manual parallel sessions with file-based coordination** rather than the experimental Agent Teams feature. The current pipeline (`comms/` directory with JSON state files) is already the right pattern. Extend it rather than switching to Agent Teams.

### Number of Parallel Agents

**Do not run more than 5 simultaneous agents.** Here's why:
- Rate limit pressure becomes significant at 5+ agents on non-enterprise API tiers
- Coordination overhead grows with N, diminishing returns past ~5
- Integration complexity (merging results, resolving conflicts) scales with N^2

For the I/O project's implementation pipeline: **3–4 simultaneous agents** is the practical optimum. Run in waves of 3–4, not all 7+ specs at once.

### Task Sizing

Each agent's task should be:
- A **single spec unit** (one DD-xx-xxx task), not multiple
- **File-isolated** — each agent owns specific frontend files or a specific backend service, not overlapping
- **Completable in one session** without needing information from another in-progress agent

### Model Selection for Parallel Work

- **Orchestrator / audit agent:** Opus (higher capability, slower, more expensive)
- **Implementation workers:** Sonnet (good capability, lower cost, faster)
- **Exploration / research tasks:** Haiku (fast, cheap, read-only tool access)

The Anthropic research system's 90.2% improvement came from pairing Opus orchestrator with Sonnet workers — not from using Opus for everything.

### Context Minimization

To extend how long parallel agents can run before hitting rate limits and compaction:
- Keep CLAUDE.md under 500 lines; move verbose instructions to Skills
- Use prompt caching — CLAUDE.md is a perfect cache candidate
- Give agents explicit scope boundaries so they don't explore the entire codebase
- Use Haiku-based Explore subagent for codebase navigation within a worker session

### Monitoring During Parallel Runs

- Check `/cost` in each session periodically
- Watch for agents stalling (not making progress) — they may have hit a context or tool call limit
- Have a kill switch: if one agent goes wrong, kill it before it corrupts shared state

---

## 10. Summary Assessment

| Question | Answer |
|----------|--------|
| Can you run claude CLI multiple times simultaneously? | Yes, fully supported |
| Does each invocation get fresh context? | Yes, fully isolated |
| Do parallel agents share file system? | Yes — this is the primary risk |
| Is Agent Teams production-ready? | No — experimental, multiple documented bugs |
| What's the practical max concurrent agents? | 3–5 before rate limits and coordination degrade returns |
| Does 7 agents cost 7x tokens? | Roughly yes, plus 10–20% coordination overhead |
| What's the rate limit risk? | High at Tier 1–2; manageable at Tier 3–4 |
| Best coordination pattern for this project? | File-based task queue (current comms/ approach) |
| Should we use Agent Teams? | No — too unstable for production pipeline |

**Bottom line:** Parallel Claude agents work, and the 3–5 agent range delivers real speed gains. The main failure modes are file conflicts (mitigated by file ownership partitioning), rate limits (mitigated by staying below 5 concurrent agents), and cost (mitigated by using Sonnet over Opus for workers). The experimental Agent Teams feature solves real coordination problems but is not stable enough for a production build pipeline as of March 2026.

---

## Sources

- https://code.claude.com/docs/en/agent-teams — Official Agent Teams documentation
- https://code.claude.com/docs/en/sub-agents — Official Subagents documentation
- https://code.claude.com/docs/en/costs — Cost management and agent team token costs
- https://platform.claude.com/docs/en/api/rate-limits — API rate limits by tier
- https://www.anthropic.com/engineering/multi-agent-research-system — Anthropic multi-agent research architecture
- https://www.anthropic.com/engineering/building-c-compiler — 16 parallel agents building a C compiler
- https://northflank.com/blog/claude-rate-limits-claude-code-pricing-cost — Rate limits explainer
- https://techcrunch.com/2025/07/28/anthropic-unveils-new-rate-limits-to-curb-claude-code-power-users/ — Weekly rate limit announcement
- https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da — Community: 10 instances in parallel
- https://shipyard.build/blog/claude-code-multi-agent/ — Claude Code multi-agent in 2026
- https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/ — Git worktrees for parallel agents
- https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ — Simon Willison on parallel coding agents
