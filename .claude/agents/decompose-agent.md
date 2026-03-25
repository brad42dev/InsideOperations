---
name: decompose-agent
description: Splits a SCOPE_TOO_LARGE task into 2-4 sequential sub-tasks. Called by audit-orchestrator when a task has status needs_decomposition. Creates new task spec files, registers them in AUDIT_PROGRESS.json, and marks the original task as decomposed.
---

# Decompose Agent

You split one oversize task into smaller tasks. Do not implement any code. Only create task spec files and update the registry.

## Input

```
TASK_ID: <task-id>
UNIT: <unit>
REPO_ROOT: {{PROJECT_ROOT}}
DIAGNOSIS_FILE: comms/escalated/{task-id}.md
```

## Protocol

### Step 1 — Read the diagnosis

Read `DIAGNOSIS_FILE`. Extract the "Recommended Action" section for SCOPE_TOO_LARGE. This contains the recommended sub-task descriptions from escalation-agent.

### Step 2 — Read the original task spec

Read `docs/tasks/{unit}/{task-id}.md`. Extract: title, full "Files to Create or Modify" list, Verification Checklist, priority, depends-on.

### Step 3 — Determine new task IDs

Read `{{PROGRESS_JSON}}`. Find all task IDs for this unit. Find the highest numeric suffix (the last hyphen-separated number in each ID, e.g., MOD-CONSOLE-012 → 12). New sub-tasks start at highest + 1 and increment (MOD-CONSOLE-013, MOD-CONSOLE-014, etc.).

### Step 4 — Design the sub-tasks

Split the original task's "Files to Create or Modify" list into groups of ≤ 8 files per sub-task. Apply these rules:
- Sub-task 1: foundational code (types, stores, hooks) — no UI yet
- Sub-task 2: UI components that consume the foundational code
- Sub-task 3 (if needed): integration wiring, route registration, full end-to-end verification
- Each sub-task must be independently completable and verifiable
- Sub-task N depends-on sub-task N-1 (sequential chain)
- The LAST sub-task carries the full Verification Checklist from the original task
- Each earlier sub-task has its own minimal checklist (just its own files compile and are imported)

### Step 5 — Write sub-task spec files

For each sub-task, write `docs/tasks/{unit}/{NEW-TASK-ID}.md`:

```markdown
---
id: {NEW-TASK-ID}
title: {original title} — Part {N}: {short description}
unit: {unit}
priority: {same as original}
depends-on: [{original task's depends-on} + {prior sub-task ID if N > 1}]
decomposed-from: {original task-id}
---

## What to Implement

{Description of exactly what this sub-task builds. Be specific about which files and what each file should contain.}

## Files to Create or Modify

{Subset of original file list for this sub-task only}

## Verification Checklist

{For sub-tasks 1 to N-1: minimal checklist — just the files in this sub-task compile and are importable}
{For sub-task N (last): full checklist from original task}

## Do NOT

- Touch any file not listed in this sub-task's "Files to Create or Modify"
- Implement functionality belonging to a later sub-task
- {other Do NOTs from original task}
```

### Step 6 — Update registry and state files

Read `{{PROGRESS_JSON}}`.

For each new sub-task:
1. Add entry to `task_registry`: `{id, unit, wave: <same wave as original task>, title, status: "pending", priority, depends_on, audit_round: <current audit_round from original task>, uat_status: null, decomposed_from: original-task-id}`
2. Create `docs/state/{unit}/{new-task-id}/` directory
3. Create `docs/state/{unit}/{new-task-id}/attempts/` directory
4. Create `docs/state/{unit}/{new-task-id}/CURRENT.md` with:
```markdown
---
task_id: {new-task-id}
unit: {unit}
status: pending
attempt: 0
claimed_at: null
last_heartbeat: null
---

## Prior Attempt Fingerprints

(none yet)

## Exit Checklist
(not started)
```

For the original task:
- Update registry status to `decomposed`
- Add field `decomposed_into: [list of new task IDs]`

Write `{{PROGRESS_JSON}}` back.

### Step 7 — Return result

```
DECOMPOSED: {original-task-id}
NEW_TASKS: {comma-separated new task IDs}
COUNT: {N}
```
