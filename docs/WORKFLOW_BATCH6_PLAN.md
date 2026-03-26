# Workflow Batch 6 — Remaining Improvements
_Created: 2026-03-25 — From third deep review. Work through top to bottom._
_Update Status lines as items complete. Read this file at session start._

---

## Context

All Batch 1–5 items are done (see docs/WORKFLOW_IMPROVEMENT_PLAN.md).
This file covers the remaining medium/hard items from the third review.
MOD-CONSOLE queue status was fixed (in_progress → completed, 2026-03-25).

Current project state when this was written:
- 407 verified, 1 pending (DD-29-017)
- 70 tasks uat_status=null across 17 units
- 2 tasks uat_status=partial (DD-06, DD-29)
- 12 units need re-audit (verified_since_last_audit > 0)

---

## Items — Work Top to Bottom

### B6-A: H6 — queue[] and task_registry[] diverge when UAT creates bug tasks
**Effort: LOW — Spec edit only (uat-agent.md)**
**File: .claude/agents/uat-agent.md**

When UAT Phase 6 writes new bug tasks to task_registry, it does NOT update
the corresponding queue[] entry's task count. The status display is wrong
and wave gating may be affected.

Fix: In Phase 6, after writing each bug task to task_registry, also find the
unit's queue[] entry and increment a `tasks_uat_added` counter (or update
`tasks_open` to reflect the new total). The simplest fix: after the full
Phase 6 loop, do one final registry write that also updates the queue entry:
  queue[unit].tasks_uat_added = (existing value + count of new bug tasks)

Status: [x] done

---

### B6-B: M4 — Escalation verdicts not surfaced
**Effort: LOW — Spec edit only (audit-orchestrator.md)**
**File: .claude/agents/audit-orchestrator.md**

When escalation-agent runs, it writes comms/escalated/{task-id}.md but
nothing aggregates these. At scale, the user must read each file manually.

Fix: After each escalation, the orchestrator should:
1. Read comms/escalated/{task-id}.md
2. Print a one-line summary: "⛔ {task-id} — {verdict}: {first line of diagnosis}"
3. Append the same line to comms/ESCALATION_SUMMARY.md (create if missing)

The ESCALATION_SUMMARY.md format:
```
# Escalation Summary
| Task | Verdict | Date | Summary |
|------|---------|------|---------|
| DD-29-017 | AMBIGUOUS_SPEC | 2026-03-25 | Unclear whether endpoint is auth service or API gateway |
```

Status: [x] done

---

### B6-C: H5 — No scope enforcement in implement-agent
**Effort: MEDIUM — Spec edit (implement-agent.md)**
**File: .claude/agents/implement-agent.md**

implement-agent can touch files outside the task scope with no guard.
Out-of-scope edits corrupt patch fingerprints, can hide TS regressions
(delta=0 trick), and introduce changes that break later tasks.

Fix: Add a scope check to the Exit Protocol between X1 and X2:

**X1b — Scope check (new step, runs after X1 fingerprint, before X2 cycle check):**
```bash
git diff HEAD --name-only
```
Compare this list against the "Files to Create or Modify" section of the task spec.
If any file in the diff is NOT in the task spec's file list:
- If the file is a state file (docs/state/*, docs/uat/*): ignore — these are always allowed
- If the file is a test file for a file that IS in scope: warn but allow
- If the file is unrelated production code: ❌ — record as out-of-scope edit in attempt file,
  set result to FAILED with reason "out_of_scope_edit: {filename}", run git checkout -- {filename}
  to undo just that file before proceeding.

The agent should NOT fail the entire task for out-of-scope edits — just revert them
and note it. The goal is to prevent accidental scope creep, not to punish the agent.

Status: [x] done

---

### B6-D: H4 — VERIFY phase missing critical checks
**Effort: MEDIUM — Spec edit (implement-agent.md)**
**File: .claude/agents/implement-agent.md**

Current VERIFY phase catches: TypeScript errors (delta), unit tests, build,
import wiring, route registration, TODO stubs.

Missing checks that catch real bugs:

**D1 — SQLx query validation (Rust tasks only):**
After cargo check, if the task touches any file with sqlx::query!, run:
```bash
cd /home/io/io-dev/io && cargo sqlx prepare --check 2>&1 | tail -20
```
If this fails: ❌ — SQL queries don't match the database schema.
If `cargo sqlx prepare --check` is not available (offline mode not set up): skip with ⚠.

**D2 — API response shape check (new endpoints):**
If the task creates a new HTTP handler (contains `Router::new()` or `.route(` in Rust,
or a new `export async function` in a route file for frontend), check that the response
shape matches doc 37 (IPC_CONTRACTS). Specifically:
- Success responses must have: `{ status: "success", data: {...}, trace_id: "..." }`
- Error responses must use io-error crate types
- Check by grepping the new handler for these patterns. If missing: ❌ with note.

**D3 — Circular import detection (TypeScript tasks only):**
After tsc --noEmit, run:
```bash
cd frontend && npx madge --circular src/ 2>&1 | head -20
```
If madge is not installed: skip with ⚠ (do not fail).
If circular imports found: ❌ — list the cycles.

Note: D1 is highest value (SQLx mismatches cause runtime panics). D2 is medium value.
D3 is low value unless madge is already installed.

Status: [x] done

---

### B6-E: C4 — Data flow scenario template too generic
**Effort: MEDIUM — Spec edit (uat-agent.md)**
**File: .claude/agents/uat-agent.md**

Phase 2.5 enforces that `data flow:` appears in scenarios.md but the fallback
template is: "navigate to route, trigger data load → UI shows content"
This is trivially satisfied by a loading spinner or empty-state message.

Fix: Replace the generic fallback template in Phase 2.5 with a structured one
that requires specifying the API endpoint and the expected DOM evidence:

```
Scenario N: [{primary-task-id}] — data flow: GET /api/v1/{resource} —
  1. Navigate to {route}
  2. Perform action that triggers load: {specific action — click button, load page, etc.}
  3. Wait for response: browser_wait_for time=3000
  4. Snapshot and check: UI must show [{specific element or text that proves data loaded}]
     — NOT just "content visible" — name a specific field, count, label, or row
  Pass: {element} is present AND does not say "Loading..." or show an error boundary
  Fail: element missing, still loading, error boundary, or "No data" when seed data exists
```

Also update Phase 2's data flow requirement to include the same structure:
Every data flow scenario must name:
- The API endpoint called (e.g., GET /api/v1/dashboards)
- The specific DOM evidence that proves data arrived (e.g., "dashboard name visible in list")

Status: [x] done

---

### B6-F: C3 — LOAD PHASE doesn't enforce spec_doc reading
**Effort: HIGH — Spec edit + task spec format change (implement-agent.md)**
**File: .claude/agents/implement-agent.md, docs/tasks/**

The most dangerous gap. implement-agent reads task files and target source files
but nothing requires reading the spec_doc or cross-cutting contracts before writing.
Implementations that skip this violate architectural decisions silently.

Fix: Two-part change:

**Part 1 — Task spec format:** Add a required `spec-doc` field to task spec frontmatter:
```yaml
---
id: MOD-CONSOLE-014
unit: MOD-CONSOLE
spec-doc: /home/io/spec_docs/console-implementation-spec.md
cx-contracts: [CX-RBAC, CX-TOKENS, CX-ERROR]
---
```
New tasks from audit-runner should always populate these fields.
For existing tasks, the fields may be absent — handle gracefully.

**Part 2 — LOAD PHASE addition:** After reading target files, add:

```
If the task spec has a `spec-doc` field: read that file (or the relevant section).
Record in Work Log: "Read spec-doc: {path}"

If the task spec has `cx-contracts`: for each listed contract, find the relevant
section in docs/SPEC_MANIFEST.md (search for the contract ID) and read it.
Record in Work Log: "Read CX contracts: {list}"

If the task spec has neither field: check CLAUDE.md for the relevant module's
spec-doc based on the unit ID prefix (MOD-CONSOLE → console-implementation-spec.md,
MOD-DESIGNER → designer-implementation-spec.md, etc.) and read it anyway.
```

This is the most impactful item — every implementation that skips spec_docs risks
violating CX-RBAC, CX-TOKENS, CX-ERROR, or IPC contracts.

Status: [x] done

---

### B6-G: C2 — Cycle detection redesign
**Effort: HIGH — Spec edit (implement-agent.md)**
**File: .claude/agents/implement-agent.md**

Current: SHA256 of sorted diff lines. Two different approaches that touch the same
lines produce the same hash. Two identical approaches can produce different hashes
if unrelated files were touched. Fundamentally unreliable.

Fix: Replace fingerprint with semantic comparison.

**New cycle detection approach (two-layer):**

Layer 1 — Prose comparison (E6, already exists as advisory):
Before writing any code, the agent states its planned approach in one sentence
and compares against "What Was Attempted" in prior attempt files. If substantially
the same: return NEEDS_INPUT immediately (no dirty changes). This is the early gate.

Layer 2 — File+function diff (X2, replaces hash):
Instead of hashing the entire diff, record:
```
changed_files: [list of files modified]
changed_functions: [list of function/component names modified, extracted from diff]
```
Cycle detection at X2: compare changed_files list against prior attempts.
If changed_files is identical to a prior attempt AND the attempt failed:
→ CYCLE_DETECTED (same files, same failure = cycle).
If changed_files overlaps but differs: warn but allow (different approach touching some same files).

The changed_functions list is stored in the attempt file for human review,
not used in automated detection (too noisy).

Implementation in X1:
```bash
# Changed files (replaces diff hash)
git diff HEAD --name-only | sort > /tmp/io-changed-files.txt
cat /tmp/io-changed-files.txt
# Changed function names (for attempt file record only)
git diff HEAD --unified=0 | grep "^+.*function\|^+.*const.*=.*(" | head -20
```

In X2: compare /tmp/io-changed-files.txt against prior attempt changed_files lists.

Status: [x] done

---

## Execution Order

Work B6-A through B6-G in order. Each item:
1. Read the target file(s) first
2. Make the edit
3. Verify with bash -n (for io-run.sh) or grep check (for .md files)
4. Update Status to [x] done

B6-A and B6-B are low effort — do first.
B6-C, B6-D, B6-E are medium effort — do next.
B6-F and B6-G are high effort — do last, they may need discussion.

---

## Notes

- bash -n io-run.sh after any io-run.sh change
- For agent .md files: grep check key phrases after edit to confirm landing
- AUDIT_PROGRESS.json: python3 -c "import json; json.load(open('comms/AUDIT_PROGRESS.json'))" to validate
- Read this file at session start — compact may have cleared context
