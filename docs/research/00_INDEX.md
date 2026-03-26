# io-orchestrator Research Index

Created: 2026-03-25
Purpose: Deep research for parallelizing and genericizing the Claude Code orchestration pipeline.
Referenced by: docs/IO_ORCHESTRATOR_PLAN.md

## Files

| File | Topic | Key Verdict |
|------|-------|-------------|
| 01_claude_parallel_agents.md | Claude parallel CLI instances, Agent Teams, rate limits, token costs | Max 3–5 agents. Agent Teams NOT production-ready. DIY file-based coordination is correct. |
| 02_github_issues_workflow.md | GitHub Issues as task queue, PostgreSQL FOR UPDATE SKIP LOCKED, SQLite, gh CLI examples | GitHub Issues: NO as source of truth (no atomic claim). PostgreSQL: YES. Use Issues as a human-visibility mirror only. |
| 03_parallelism_safety.md | flock, mkdir atomic locks, PID files, git worktrees, PostgreSQL advisory locks, crash recovery, heartbeat | Per-unit serialization + git worktrees + PG advisory locks = safe parallelism. JSON registry cannot handle concurrent writes. |
| 04_generic_orchestration.md | Existing frameworks (ccswarm, LangGraph, CrewAI, Ruflo), config file schema, distribution patterns | No existing framework fits. Bash + markdown agent model is correct. Explicit config file with auto-detected defaults. |
| 06_task_decomposition_and_role_priming.md | Vertical vs horizontal task decomposition, granularity sweet spot, role-priming effectiveness | Vertical slices win (arXiv 2601.22667). 3–5 files / 15–45 min hard cap (SWE-Bench Pro, METR data). Role priming kills accuracy — use behavioral instructions instead. |

## What is NOT in these files

- Implementation code (that is in IO_ORCHESTRATOR_PLAN.md and future wave work)
- Decisions made after research (those are in IO_ORCHESTRATOR_PLAN.md ADRs)
- io project-specific state (that is in AUDIT_PROGRESS.json and WORKFLOW_IMPROVEMENT_PLAN.md)
