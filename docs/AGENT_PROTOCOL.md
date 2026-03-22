# Agent Protocol — Hard Rules for All Implementation Agents

This document defines the mandatory entry, checkpoint, and exit protocol for every agent that implements code in this project. The protocol is non-negotiable. It exists to prevent context loss, task confusion, cycling, and silent failure.

**Spec and state are separate:**
- Spec files (`docs/tasks/{unit}/{task-id}.md`) — written by the audit system, read-only for implementation agents
- State files (`docs/state/{unit}/{task-id}/`) — written by implementation agents and the orchestrator

---

## State File Structure

```
docs/state/
  INDEX.md                          # Global scoreboard — ~50 lines max, always current
  ledger/
    {unit-id}.md                    # Verified completions for this unit (git-anchored)
  {unit-id}/
    INDEX.md                        # Unit-level task status summary
    {task-id}/
      CURRENT.md                    # Current attempt state — rewritten each attempt
      attempts/
        001.md                      # Attempt 1 record (permanent, never overwritten)
        002.md                      # Attempt 2 record
        ...
```

---

## CURRENT.md Format

Written by the implementation agent at claim time and updated throughout. Rewritten fresh at the start of each new attempt (prior attempt data moves to its `attempts/NNN.md` file first).

```markdown
---
task_id: {TASK-ID}
unit: {unit-id}
status: claimed | implementing | verifying | completed | failed | cycle_detected | needs_input | needs_research | checkpoint
attempt: {N}
claimed_at: {ISO-8601 timestamp}
last_heartbeat: {ISO-8601 timestamp}
---

## Prior Attempt Fingerprints

| Attempt | Fingerprint | Before Hash | After Hash | Result |
|---------|-------------|-------------|------------|--------|
| 1       | sha256:abc… | sha256:def… | sha256:ghi… | FAILED |
| 2       | sha256:jkl… | sha256:mno… | sha256:pqr… | FAILED |

## Current Attempt ({N})

### Phase
{CLAIM | LOAD | IMPLEMENT | VERIFY | CLOSE}

### Files Loaded
- [ ] docs/AGENT_PROTOCOL.md
- [ ] docs/state/INDEX.md
- [ ] docs/state/{unit}/{task-id}/CURRENT.md
- [ ] docs/tasks/{unit}/{task-id}.md (task spec)
- [ ] {any code files read}

### Work Log
{Append-only. Each entry: timestamp — action taken.}
- {timestamp} — Claimed task, attempt {N}
- {timestamp} — Loaded context: {files}
- {timestamp} — Modified {file}: {what changed}
- {timestamp} — Ran verification: {result}

### Exit Checklist
- [ ] attempts/{NNN}.md written
- [ ] attempts/{NNN}.md read back and verified non-empty
- [ ] CURRENT.md updated with final status and fingerprints
- [ ] CURRENT.md read back and verified — status field matches intended final status
- [ ] TASK_INDEX / unit INDEX updated if status changed
```

---

## Attempt File Format (attempts/NNN.md)

Written once, never modified after the attempt closes. Permanent record.

```markdown
---
attempt: {N}
task_id: {TASK-ID}
started: {ISO-8601}
closed: {ISO-8601}
result: SUCCESS | FAILED | CYCLE_DETECTED | NEEDS_INPUT | NEEDS_RESEARCH | CHECKPOINT
---

## What Was Attempted
{Describe the approach taken — specific, not vague.}

## Files Modified
- {path}: {what changed and why}

## Patch Fingerprint
fingerprint: sha256:{hash of sorted changed hunks}
before_state: sha256:{hash of relevant lines before}
after_state: sha256:{hash of relevant lines after}

## Verification
command: {exact command run}
result: PASS | FAIL
output: {relevant output — errors, warnings, or "clean"}

## Cycle Check
{Did any prior attempt fingerprint match? YES → explain. NO → "No collision detected."}

## Why This Attempt {Succeeded | Failed}
{Honest, specific. If failed: what was tried, what went wrong, what is blocking.}

## Notes for Next Attempt
{If failed: what to try differently. If succeeded: nothing.}
```

---

## ENTRY PROTOCOL (mandatory — complete before any implementation)

**Step E1 — Read the global index.**
Read `docs/state/INDEX.md`. Find your assigned task ID. Confirm it matches what you were given in your prompt.

**Step E2 — Read the unit index.**
Read `docs/state/{unit}/INDEX.md`. Confirm the task is listed as pending or in_progress.

**Step E3 — Read CURRENT.md.**
Read `docs/state/{unit}/{task-id}/CURRENT.md`. If it exists and shows `status: claimed` or `status: implementing` with a recent heartbeat (< 15 minutes ago), **stop** — another agent may be working this task. Return `RESULT: CONFLICT` to the orchestrator.

**Step E4 — Read prior attempts.**
If CURRENT.md exists, extract the Prior Attempt Fingerprints table. You will need these for cycle detection. If 2+ attempts exist, also read the most recent `attempts/NNN.md` file for context on what failed and why.

**Step E5 — Read the task spec.**
Read `docs/tasks/{unit}/{task-id}.md`. This is your implementation target.

**Step E6 — Triple-confirm task identity.**
Before writing anything, state explicitly (in your working response):
> "I am claiming task {task-id} ({title}), attempt {N}. Prior attempts: {count}. Prior fingerprints: {list}. No cycle detected / Cycle detected: {explain}."

If a cycle is detected (your planned approach matches a prior fingerprint), **do not proceed** — return `RESULT: CYCLE_DETECTED` immediately.

**Step E7 — Write the claim.**
Write `CURRENT.md` with `status: claimed`, `attempt: N`, `claimed_at: now`. Then immediately read it back. Confirm the `status` field reads `claimed` and `attempt` matches N. If not, something went wrong with the write — report `RESULT: FAILED | REASON: claim_write_failed`.

---

## CHECKPOINT PROTOCOL (mandatory — during implementation)

Write a checkpoint to CURRENT.md whenever:
- You complete a file modification
- You run a verification command
- You make a significant decision
- You are about to attempt something risky
- Approximately every 10 meaningful actions (read a file, write a file, run a command)

Checkpoint write format: update `last_heartbeat` timestamp and append to Work Log. Then read back the `last_heartbeat` field to confirm the write succeeded.

If you detect you are approaching ~85% context capacity:
1. Write CURRENT.md with `status: checkpoint`, full Work Log, files modified so far
2. Write `attempts/{NNN}.md` with `result: CHECKPOINT` and everything done so far
3. Read both back to verify
4. Return `RESULT: CHECKPOINT` to the orchestrator

---

## EXIT PROTOCOL (mandatory — complete before returning any result)

**Do not skip this even if returning FAILED, NEEDS_INPUT, or NEEDS_RESEARCH.**

**Step X1 — Compute patch fingerprint.**
Hash the sorted changed hunks from all files you modified. Record `before_state` and `after_state` hashes.

**Step X2 — Check for cycles.**
Compare your `after_state` hash against all prior `before_state` hashes in CURRENT.md. If your after_state matches any prior before_state, you have produced a reversion cycle. Change your result to `CYCLE_DETECTED` and do not finalize the change.

**Step X3 — Write the attempt file.**
Write `docs/state/{unit}/{task-id}/attempts/{NNN}.md` (where NNN is zero-padded attempt number). Include everything: what was tried, files modified, fingerprint, verification result, why it succeeded or failed, notes for next attempt.

**Step X4 — Verify the attempt file.**
Read `docs/state/{unit}/{task-id}/attempts/{NNN}.md` back. Confirm it is non-empty and contains the correct `task_id` and `attempt` fields. If the read fails or returns empty, retry the write once. If it fails again, report this explicitly.

**Step X5 — Update CURRENT.md.**
Rewrite CURRENT.md with:
- `status`: your final result (completed, failed, cycle_detected, needs_input, needs_research, checkpoint)
- `last_heartbeat`: now
- Updated Prior Attempt Fingerprints table (add current attempt's fingerprint)
- Exit Checklist (check off X3 and X4)

**Step X6 — Verify CURRENT.md.**
Read CURRENT.md back. Confirm `status` field matches your intended final status. Confirm the fingerprints table includes the current attempt. Check off the remaining Exit Checklist items.

**Step X7 — Return result to orchestrator.**
Only after X1–X6 are complete. Your return message must include:
```
RESULT: {result}
TASK_ID: {task-id}
ATTEMPT: {N}
STATE_FILE: docs/state/{unit}/{task-id}/CURRENT.md
ATTEMPT_FILE: docs/state/{unit}/{task-id}/attempts/{NNN}.md
```

---

## Ledger Entry Format (docs/state/ledger/{unit-id}.md)

Written by the **orchestrator only**, never by the implementation agent. An entry is added only after external verification passes.

```
{TASK-ID} | {title} | verified {date} | commit {hash} | {verification-command} | PASS
```

Example:
```
GFX-CORE-002 | NavigationLink on all node types | verified 2026-03-21 | commit a3f9c12 | tsc --noEmit | PASS
```

The orchestrator writes this after running the verification command independently. The agent does not write to the ledger.

---

## Zombie Detection (Orchestrator Responsibility)

Before assigning any task, the orchestrator reads `CURRENT.md`. A task is **zombie** (abandoned mid-run) if:
- `status` is `claimed` or `implementing`
- `last_heartbeat` is more than 15 minutes ago

For a zombie task: increment attempt count, preserve the partial Work Log in a new attempt file marked `result: ZOMBIE`, reset status to `pending`, reassign.

---

## Cycle Escalation Rules

| Condition | Action |
|-----------|--------|
| Current fingerprint matches attempt N-1 (immediate reversion) | CYCLE_DETECTED — escalate to orchestrator immediately |
| Current fingerprint matches any prior attempt | CYCLE_DETECTED — escalate |
| 3 attempts, all FAILED, no cycle | Escalate to user — may need task decomposition |
| 2 attempts with same FAILURE_REASON | Include prior failure in prompt for attempt 3 — do not repeat same approach |

---

## What the Protocol Does NOT Control

- Which approach the agent takes to implement the task
- What files the agent reads for research
- How the agent structures the code
- What order the agent completes subtasks in
- How the agent handles unexpected findings in the codebase

The protocol controls entry, checkpointing, exit, and verification. Everything else is the agent's judgment.
