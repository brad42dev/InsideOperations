---
name: agent-guide
description: Print a reference guide for all custom agents in this project — what each one does, when to use it, how to launch it, and usage examples.
---

# Agents Reference

Print the following guide exactly. No preamble, no commentary — just the reference.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I/O PROJECT — CUSTOM AGENTS REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All agents live in .claude/agents/. Run from /home/io/io-dev/io.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERACTIVE AGENTS  (start a session, then converse)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────┐
│ SPEC-SCOUT                                              │
│ Read the current state of any module or feature area    │
└─────────────────────────────────────────────────────────┘
Launch:  claude --agent spec-scout
Type:    help  (or ?)  to see usage examples on startup

When to use:
  • Before building anything — understand what exists first
  • When returning to a module after time away
  • When you're not sure if something is already specced or built
  • Before running feature-agent to avoid redundant Q&A

Examples:
  "list"                              → print all unit IDs and names
  "index"                             → same
  "What's implemented in Console?"
  "Where are we at on GFX-CORE?"
  "What does the spec say about alarm routing?"
  "What's pending in the expression builder?"
  "Tell me about point binding in Designer"
  "Are there any conflicts if I add export to Forensics?"
  "What cross-cutting contracts apply to MOD-PROCESS?"

Output: Structured report — what's designed, what's verified,
        what's pending, what's active, conflicts, recommended reading.

──────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│ FEATURE-AGENT                                           │
│ Define a new feature, change, or fix — produces spec    │
│ and task files that feed directly into implement queue  │
└─────────────────────────────────────────────────────────┘
Launch:  claude --agent feature-agent
Type:    help  (or ?)  to see usage examples on startup

When to use:
  • Adding something new that isn't in the spec
  • Changing existing designed behavior
  • Correcting a spec error or wrong behavior
  • Run spec-scout first for non-trivial features

Examples:
  "list"                              → show module names if you've forgotten
  "Add a notification bell with unread count to the app header"
  "Change zoom in Process to support pinch-to-zoom on tablet"
  "The export button in Console produces malformed JSON — fix the spec"
  "Add dark mode persistence to Settings"
  "The alarm escalation timing doesn't match ISA-18.2 — correct the spec"

Output: Decision file (docs/decisions/<slug>.md) + task files
        (docs/tasks/<unit>/) + registry entries in AUDIT_PROGRESS.json.
        Tasks are immediately eligible for implement smart mode.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORCHESTRATION  (pass a mode string on launch, non-interactive)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────┐
│ AUDIT-ORCHESTRATOR                                      │
│ Run audit or implement loops across all units           │
└─────────────────────────────────────────────────────────┘
Launch:  claude --dangerously-skip-permissions \
           --agent audit-orchestrator "<mode>"

IMPLEMENT modes  (build pending tasks):
  "implement"           Smart: tasks from current audit round only
  "implement 10"        Smart, stop after 10 tasks
  "implement force <TASK-ID>"     Force one specific task
  "implement force-all"           All pending regardless of round
  "implement force-all 20"        All pending, stop after 20

AUDIT modes  (verify code against spec):
  "audit"               Smart: only units with verified tasks since last audit
  "audit 5"             Smart, stop after 5 units
  "audit force <UNIT-ID>"         Force re-audit one specific unit
  "audit force-all"               Re-audit all units
  "audit force-all 10"            Re-audit all, stop after 10

Examples:
  claude --dangerously-skip-permissions --agent audit-orchestrator "implement"
  claude --dangerously-skip-permissions --agent audit-orchestrator "implement 30"
  claude --dangerously-skip-permissions --agent audit-orchestrator "audit"
  claude --dangerously-skip-permissions --agent audit-orchestrator "audit force GFX-CORE"
  claude --dangerously-skip-permissions --agent audit-orchestrator "implement force MOD-CONSOLE-005"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBAGENTS  (launched by orchestrator, not directly by user)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────┐
│ IMPLEMENT-AGENT                                         │
│ Implements exactly one task per invocation              │
└─────────────────────────────────────────────────────────┘
Normally launched by audit-orchestrator. Can be run directly:
  claude --dangerously-skip-permissions --agent implement-agent
  Input: "TASK_ID: <id>  UNIT: <unit>  REPO_ROOT: /home/io/io-dev/io"

Runs full entry/implement/verify/exit protocol. Writes attempt files
and CURRENT.md state. Never skips verification. Handles bulk operations
(>10 files) via script rather than individual Read+Edit calls.

──────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│ AUDIT-RUNNER                                            │
│ Audits one unit against its spec, produces task files   │
└─────────────────────────────────────────────────────────┘
Normally launched by audit-orchestrator. Can be run directly:
  claude --dangerously-skip-permissions --agent audit-runner
  Input: "UNIT: <unit-id>  REPO_ROOT: /home/io/io-dev/io"

Reads spec + design-docs, inventories code, produces a gap catalog,
writes task files to docs/tasks/<unit>/, and returns structured result.

──────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│ SPEC-REPAIR                                             │
│ Fixes spec gaps discovered during audit                 │
└─────────────────────────────────────────────────────────┘
Launched by audit-orchestrator when audit-runner flags a spec gap.
Not normally invoked directly.

──────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│ EXPLORE-AGENT                                           │
│ Deep codebase exploration and research                  │
└─────────────────────────────────────────────────────────┘
Launched by implement-agent when NEEDS_RESEARCH is returned.
Not normally invoked directly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK-REFERENCE SKILLS  (type /skillname in any session)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /agent-guide  This reference guide
  /spec-index   All unit IDs + names + task counts (standalone version)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPICAL WORKFLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adding a new feature:
  1. claude --agent spec-scout       "what exists for X?"
  2. claude --agent feature-agent    "add Y to X"
  3. claude --dangerously-skip-permissions --agent audit-orchestrator "implement"

Running a build loop:
  claude --dangerously-skip-permissions --agent audit-orchestrator "implement 30"

After implementing, re-verify changed units:
  claude --dangerously-skip-permissions --agent audit-orchestrator "audit"

Force re-audit a specific unit:
  claude --dangerously-skip-permissions --agent audit-orchestrator "audit force MOD-CONSOLE"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
