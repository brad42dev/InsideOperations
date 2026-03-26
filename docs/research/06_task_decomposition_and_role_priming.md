# Task Decomposition and Role Priming for Parallel AI Agents

**Date:** 2026-03-25
**Context:** Research commissioned to inform Topic 3 of IO_ORCHESTRATOR_DISCUSSION.md — unit structure, task granularity, and whether role-priming is worth using in agent context packages.

---

## 1. Task Decomposition Strategy

### Vertical vs. Horizontal: Verdict

**Vertical (feature) slicing wins. HIGH confidence — peer-reviewed evidence.**

- arXiv 2601.22667 ("From Horizontal Layering to Vertical Integration", Jan 2026): transitioning from horizontal layer silos to vertical integration produced 8x–33x reduction in resource consumption. Coordination overhead is the mechanism — horizontal decomposition forces cross-agent coordination that vertical slices eliminate.
- MAST taxonomy (arXiv 2503.13657, Berkeley/CMU, ICLR 2025, kappa=0.88): analyzed 1,600+ multi-agent failure traces across 7 frameworks. Top failure modes in horizontal decomposition: inter-agent misalignment (individually correct outputs that are incompatible at integration), information withholding (outputs not reaching dependent agents), task derailment (agents drifting into adjacent scope). All three are structurally more likely with horizontal decomposition because integration happens after the fact.

**Layer-based context benefit is real but achievable without layer decomposition:**
Anthropic context engineering guidance (Sept 2025): "the smallest possible set of high-signal tokens" — relevance filtering, not layer restriction. A feature slice with injected cross-layer interface specs has tighter context than all React files across a large project.

### Granularity Sweet Spot

**3–5 files, ~15–45 human-minutes of work. HIGH confidence — benchmark data.**

- SWE-Bench Pro (arXiv 2509.16941, 1,865 real enterprise problems): average reference solution = 107 lines across 4.1 files. Frontier models (GPT-5, Claude Opus 4.1): 23% on these tasks vs 70%+ on single-file tasks. Below 10% at 10+ files.
- METR longitudinal (arXiv 2503.14499, March 2025): 50% reliability horizon at ~50 minutes of human task time. Near 100% success on tasks under 4 human-minutes. Below 10% success over 4 human hours.
- For Rust + React + PostgreSQL vertical slices: one Rust endpoint (handler + service method) + one SQL migration + one React component = 3–4 files. Upper edge of the accuracy band. Tasks larger than this should be decomposed into sequenced sub-tasks with verified interface contracts.

### Shared/Central Files

Every documented parallel agent system (ccswarm, Replit Agent 4, DoltHub) hits the same collision points:
- Routing/registry files (`router.tsx`, `App.tsx`)
- Global constants/types
- Workspace manifests (`Cargo.toml`)
- Permission/RBAC lists
- Migration sequences

These cannot be parallelized safely. Must be serialized: orchestrator owns them directly or assigns to a dedicated single-agent task that runs alone.

### Production Systems Surveyed

| System | Strategy | Key Finding |
|---|---|---|
| ccswarm (nwiizo/ccswarm) | Horizontal layer specialization, Git worktrees | Central files are documented weakness; no automated solution |
| Replit Agent 4 | Vertical features, parallel sub-agents within feature, dependency-ordered | 90% auto-resolve on merge conflicts; sequential dependency reasoning before parallelizing |
| DoltHub parallel agents | Docker isolation, Dolt branch-per-agent | Parallelism solved at DB layer; not just code layer |
| Liza (liza-mas/liza) | Concern-based with explicit interface contracts, human review gates | Explicitly rejects layer decomposition |
| Tessl Refactor SDK | 1 spec = 1 file, directory-boundary decomposition, atomic commits | Spec carries long-horizon intent; task stays in manageable working set |

---

## 2. Role Priming for Coding Agents

### Verdict: Do Not Use Generic Role Priming

**Generic "you are an expert X engineer" personas do not improve code quality on frontier models and measurably hurt knowledge retrieval. HIGH confidence.**

Key studies:
- USC, arXiv:2603.18507 (March 2026): 6 models tested. MMLU accuracy: 71.6% baseline → 68.0% with expert persona (-3.6 points). MT-Bench coding category: no improvement. Mechanism: expert personas activate "performing expertise" mode, diverting from pretraining knowledge retrieval.
- EMNLP 2024 Findings (arXiv:2311.10054): 162 personas, 4 model families, 2,410 MMLU questions. "Adding personas in system prompts does not improve model performance." In-domain role effect: 0.004 coefficient — statistically significant, practically meaningless. Note: this paper originally claimed personas helped (2023), reversed conclusion in 2024 after expanding the experiment.

### What Actually Works Instead

Evidence-based ranking:
1. **Behavioral process instructions** — `"Read the spec before writing any code. Write type skeletons before filling in logic."` Changes actual task execution flow. Demonstrably effective.
2. **Task context richness** — constraints, spec references, output format requirements. arXiv:2508.03678: detailed task descriptions improved HumanEval pass@1 substantially (Qwen-14B: 0.667 → 0.967 with maximum task specificity).
3. **One-line orienting context** — `"You are implementing a Rust async web service using Axum and Tokio."` Sets vocabulary. Costs nothing. Is task context, not credential claim.
4. **Detailed LLM-generated personas** — modest effect at best, not studied for coding specifically.
5. **Generic credential personas** (`"senior Rust developer"`) — negligible to no effect.
6. **Credential stacking** (`"expert", "world-class", "principal"`) — correlates with accuracy degradation per USC study.

### Is This GPT-3.5-Era Baggage?

Yes. LearnPrompting.org: "efficacy of this strategy appears to have diminished with newer models such as GPT-3.5 or GPT-4." Frontier models exhibit domain behaviors from RLHF training; credential labels add nothing. Anthropic's own docs: "Modern models are sophisticated enough that heavy-handed role prompting is often unnecessary." Claude Code's own system prompt does not define Claude as a senior engineer — it establishes identity and loads behavioral constraints.

### Known Harms

- Accuracy degradation on knowledge tasks: measured (-3.6 MMLU points)
- Overconfidence: expert persona may suppress uncertainty signals, reducing NEEDS_INPUT flags from agents
- Scope narrowing: `"you ONLY know Rust"` prevents flagging when the task has cross-cutting constraints

### What to Inject Instead (for IO orchestrator context packages)

```
One-line stack context: "You are implementing [component] using [specific tech]."
Behavioral instructions: "Read the referenced spec section before writing any code. Write type definitions before logic."
Task constraints: "All handlers must use io-error crate error types. No LGPL/GPL dependencies."
Acceptance criteria checklist
Blast radius (do not modify list)
```

---

## Sources

- arXiv:2601.22667 — From Horizontal Layering to Vertical Integration
- arXiv:2503.13657 — Why Do Multi-Agent LLM Systems Fail? (MAST)
- arXiv:2509.16941 — SWE-Bench Pro
- arXiv:2503.14499 — METR: Measuring AI Ability to Complete Long Tasks
- arXiv:2603.18507 — Expert Personas Improve LLM Alignment but Damage Accuracy
- EMNLP 2024 Findings (arXiv:2311.10054) — Personas in System Prompts Do Not Improve LLM Performances
- arXiv:2508.03678 — Probing the Impact of Prompt Specificity on LLM Code Generation
- Anthropic: Effective Context Engineering for AI Agents (Sept 2025)
- Anthropic: Prompt Engineering Best Practices (platform.claude.com/docs)
- Martin Fowler: Context Engineering for Coding Agents (Böckeler, 2025)
- dbreunig.com: System Prompts Define the Agent as Much as the Model (Feb 2026)
- ccswarm: github.com/nwiizo/ccswarm
- Liza: github.com/liza-mas/liza
- Tessl Refactor SDK: tessl.io/blog
- DoltHub: dolthub.com/blog
