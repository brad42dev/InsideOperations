# Pipeline Improvement Plan
# Inside/Operations — Orchestration Hardening

---

## HOW TO USE THIS FILE

This file is the persistent memory for a multi-session implementation project. Each phase runs in a fresh context (after /clear). The agent for each phase reads this file, implements exactly what the phase describes, marks it DONE, and prints the next prompt. You paste that prompt after /clear to start the next session.

**IMPORTANT FOR EVERY PHASE AGENT:** You are running with a completely fresh context. You have no memory of prior sessions. Do not assume anything. Read every file listed under "Files to Read First" before taking any action. The plan below is your only source of truth.

**Current Phase: COMPLETE**

---

## NEXT PROMPT TO PASTE

```
All pipeline improvement phases are complete. See docs/PIPELINE_PLAN.md for the full record. Run ./io-run.sh integration-test to verify the baseline still passes.
```

---

## BACKGROUND: WHY THIS PLAN EXISTS

This plan fixes six confirmed failure modes in the orchestration pipeline. All six were identified through deep code review and codebase analysis. Summary:

**1. Wave 0 contracts have no enforcement.**
`docs/SPEC_MANIFEST.md` defines 12 cross-cutting contracts (CX-EXPORT, CX-POINT-CONTEXT, etc.) that must be decided via `/design-qa` before auditing any unit they apply to. `audit-orchestrator.md` has no code that enforces this. A unit can be audited before its Wave 0 decision files exist, producing tasks that assume undefined behavior. When the decision is written later, the unit needs re-auditing but the smart filter won't trigger it.

**2. NEEDS_INPUT tasks disappear silently.**
When implement-agent returns NEEDS_INPUT, the task sits in `comms/needs_input/` with no timeout, no staleness alert, no escalation path. The orchestrator reports a count but no elapsed times. Tasks can wait indefinitely with no notification.

**3. Escalation is a black hole.**
After 3 failures, a task is marked `escalated` and the orchestrator moves on. No agent reads the failure pattern and diagnoses: ambiguous spec? missing dependency? task too large for context window? The user has to manually read attempt files to figure out why.

**4. Large tasks will CHECKPOINT forever.**
A task requiring 15+ files will hit the ~85% context limit, write CHECKPOINT, and the re-spawned agent hits the same limit (must re-load all files). The current rule "Do not auto-decompose tasks" means tasks exceeding one context window can never succeed. This must change — decomposition must be automatic when scope is confirmed to exceed context.

**5. No integration test exists.**
UAT tests individual task behaviors in isolation. There is no test for complete user journeys (login → console → load workspace → see data). You can have 100% UAT pass and still have a non-functional product because task outputs don't connect across unit boundaries.

**What is already correctly implemented (do not touch):**
- Dependency validation at task selection (orchestrator already checks `depends_on`)
- Zombie detection and startup reconciliation
- Wave gating (Wave 2 blocked until Wave 1 complete)
- Cycle detection via fingerprinting in implement-agent

---

## PHASE OVERVIEW

| Phase | Type | What it does | Files touched |
|-------|------|-------------|---------------|
| 1 | IMPLEMENT | Wave 0 pre-audit gate + cross-unit re-audit trigger | `audit-orchestrator.md` |
| 1R | REVIEW | Verify Phase 1 changes are correct and complete | `audit-orchestrator.md` |
| 2 | IMPLEMENT | NEEDS_INPUT staleness reporting + auto-escalation | `audit-orchestrator.md`, `io-run.sh` |
| 2R | REVIEW | Verify Phase 2 changes are correct and complete | `audit-orchestrator.md`, `io-run.sh` |
| 3 | IMPLEMENT | Escalation diagnosis agent (4 verdicts) | new `escalation-agent.md`, `audit-orchestrator.md` |
| 3R | REVIEW | Verify escalation agent protocol and orchestrator hook | `escalation-agent.md`, `audit-orchestrator.md` |
| 4 | IMPLEMENT | Task decomposition agent + proactive size gate | new `decompose-agent.md`, `audit-orchestrator.md` |
| 4R | REVIEW | Verify decomposition agent and size gate logic | `decompose-agent.md`, `audit-orchestrator.md` |
| 5 | IMPLEMENT | Integration test infrastructure + 5 journey stubs | new `frontend/tests/integration/`, `io-run.sh` |
| 5R | REVIEW | Verify test infrastructure compiles and io-run.sh is correct | all Phase 5 files |
| 6 | IMPLEMENT | Fill integration test scenarios with real assertions | `frontend/tests/integration/journeys/*.test.ts` |
| 6R | REVIEW | Run tests, fix failures, document baseline | all journey files, `BASELINE.md` |

---

---

## PHASE 1 — Wave 0 Enforcement (IMPLEMENT)
**Status: DONE — 2026-03-23**
**Type: IMPLEMENT**

### Context (read this before touching anything)

You are adding two enforcement mechanisms to the audit orchestrator. Currently the orchestrator has no concept of Wave 0 contracts — it will audit any unit regardless of whether the required decision files exist. This causes circular dependency loops: unit audited before contract decided → tasks generated with undefined behavior → Wave 0 decided → unit needs re-audit → conflict.

The fix has two parts:
1. **Pre-audit gate**: Before spawning audit-runner for a unit, check that all Wave 0 contracts that apply to that unit have decision files in `docs/decisions/`. Block audit if any are missing.
2. **Cross-unit re-audit trigger**: When a Wave 0 decision file is newer than a unit's `last_audit_date`, flag that unit as eligible for re-audit even if `verified_since_last_audit == 0`.

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — read the full file. You are modifying it.
2. `/home/io/io-dev/io/docs/SPEC_MANIFEST.md` — find the Wave 0 section. Extract the full applies-to matrix: which Wave 0 contracts apply to which unit IDs.

### What to implement

**Step 1: Add DECISIONS_DIR constant**

In the Constants section of `audit-orchestrator.md`, add:
```
DECISIONS_DIR:   /home/io/io-dev/io/docs/decisions
```

**Step 2: Add the Wave 0 Pre-Audit Gate**

In the Audit Loop section, find the "For each eligible unit:" loop. Immediately before the existing step 1 ("Update PROGRESS_FILE: set unit status: in_progress"), insert a new step 0:

```
0. **Wave 0 Pre-Audit Gate**: Before auditing this unit, verify all applicable Wave 0 contracts have decision files.

   Applicable contracts per unit (from SPEC_MANIFEST.md Wave 0 applies-to matrix):
   {paste the extracted matrix here — unit ID → list of contract slugs}

   Contract slug convention: lowercase contract ID with hyphens (e.g., CX-EXPORT → cx-export).

   For each applicable contract for this unit:
   - Check: does `docs/decisions/{contract-slug}.md` exist?
   - Command: `ls docs/decisions/{contract-slug}.md 2>/dev/null && echo EXISTS || echo MISSING`

   If ANY contract file is MISSING:
   - Skip this unit entirely (do not update status, do not spawn audit-runner)
   - Report: `⚠️  {unit-id} skipped — missing Wave 0 decision file(s): {contract-slug}. Run /design-qa {contract-slug} first, then re-run audit.`
   - Continue to next unit

   If ALL contract files EXIST: proceed to step 1.
```

**Step 3: Add Wave 0 recency check to the Smart Filter**

Find the Smart Filter section that says:
> "Smart filter (default `audit` mode): Select units where: `last_audit_round` is null (never audited), OR `verified_since_last_audit > 0`"

Add a third condition:
> OR any Wave 0 contract that applies to this unit has a decision file with modification time newer than this unit's `last_audit_date`.

Add the bash pattern to check this:
```bash
# Check if any applicable decision file is newer than unit's last audit
# Create a reference file touched at last_audit_date, then use find -newer
touch -t {last_audit_date formatted as YYYYMMDDhhmm} /tmp/io-audit-ref-{unit-id}
find docs/decisions/ -name "{contract-slug}.md" -newer /tmp/io-audit-ref-{unit-id} 2>/dev/null
# If any output: unit is eligible for re-audit
```

Note: `last_audit_date` is not currently stored in AUDIT_PROGRESS.json per-unit. Add it: when writing the SUCCESS handler for audit completion, store `"last_audit_date": "{ISO timestamp}"` on the unit's queue entry in addition to `last_audit_round`. For units with no `last_audit_date`, treat as epoch (always eligible).

**Step 4: Update the Rules section**

Add this rule:
> Wave 0 contracts must have decision files before their applicable units are audited. A missing decision file blocks audit for that unit — it does NOT block implement for existing tasks on that unit. Run `/design-qa {contract-slug}` to generate the missing decision file.

**Step 5: Write back the file**

Write the updated `audit-orchestrator.md`. Do not change any other sections.

### When Done

1. Verify the file was written: `grep -c "Wave 0 Pre-Audit Gate" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — should return 1.
2. Verify the constant was added: `grep "DECISIONS_DIR" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — should return the line.
3. Verify last_audit_date is mentioned: `grep "last_audit_date" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — should return lines in SUCCESS handler and smart filter.
4. Update this plan file (`docs/PIPELINE_PLAN.md`):
   - Change Phase 1 Status from `CURRENT` to `DONE — {today's date}`
   - Change Phase 1R Status from `PENDING` to `CURRENT`
   - Update the NEXT PROMPT TO PASTE block at the top of the file to the standard prompt (it doesn't change — the prompt is always the same)
5. Print:
   ```
   Phase 1 complete. Paste this prompt after /clear to start Phase 1R:

   Read /home/io/io-dev/io/docs/PIPELINE_PLAN.md in full. Find the phase marked CURRENT and follow its instructions exactly — including the "Files to Read First" list, every step, and the "When Done" instructions at the bottom of the phase. Do not skip any step. You are running in a fresh context with no memory of prior sessions — everything you need is in this document and the files it points to.
   ```

---

## PHASE 1R — Review Phase 1 Changes
**Status: DONE — 2026-03-23 (0 checklist items fixed — all clean)**
**Type: REVIEW**

### Context (read this before touching anything)

You are reviewing the changes made in Phase 1. Phase 1 modified `audit-orchestrator.md` to add Wave 0 enforcement. You did not write those changes — a previous session did. Your job is to verify they are correct, complete, and don't break anything that was already working.

**What Phase 1 was supposed to add:**
1. A `DECISIONS_DIR` constant
2. A Wave 0 Pre-Audit Gate in the Audit Loop (step 0 before "For each eligible unit")
3. A third condition in the Smart Filter (Wave 0 file recency check using `find -newer`)
4. `last_audit_date` field stored on unit queue entries in the SUCCESS handler
5. A new rule about Wave 0 blocking audit (not implement)

**What Phase 1 was NOT supposed to change:**
- Implement Loop
- Task Selection
- Review Input mode
- Rules other than the one new rule
- Checkpoint behavior
- Any file other than `audit-orchestrator.md`

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — read the full file

### Verification Checklist

Work through every item. Mark ✅ or ❌. Fix every ❌ before moving on.

**Additions present:**
- [ ] `DECISIONS_DIR` constant exists in Constants section
- [ ] "Wave 0 Pre-Audit Gate" heading exists in Audit Loop
- [ ] The gate checks `docs/decisions/{contract-slug}.md` existence (not some other path)
- [ ] The gate uses lowercase contract slug convention (CX-EXPORT → cx-export)
- [ ] The gate SKIPS the unit (does not fail the run) when a file is missing
- [ ] The gate reports which contract slugs are missing, not just "missing files"
- [ ] The gate continues to the next unit after skipping (does not abort the entire audit run)
- [ ] Smart Filter has a third condition for Wave 0 recency
- [ ] Wave 0 recency check uses `find -newer` or equivalent timestamp comparison
- [ ] `last_audit_date` is written in the Audit Loop SUCCESS handler
- [ ] `last_audit_date` defaults to epoch for units that don't have it (always eligible)
- [ ] New rule added about Wave 0 blocking audit but not implement

**No regressions:**
- [ ] Implement Loop is unchanged (no Wave 0 references in implement sections)
- [ ] Task Selection is unchanged
- [ ] CHECKPOINT behavior is unchanged
- [ ] `force` and `force-all` modes still work (check that the gate applies to smart mode only — `force` should bypass the gate, `force-all` should also bypass, since force means "audit anyway")

**Edge cases:**
- [ ] A unit with NO applicable Wave 0 contracts (e.g., pure backend units) passes the gate automatically — the gate doesn't incorrectly block it
- [ ] The applies-to matrix in the gate is actually present (not a placeholder like "{paste matrix here}") — it should have real unit IDs and contract slugs from SPEC_MANIFEST.md
- [ ] If `docs/decisions/` directory doesn't exist yet, the check degrades gracefully (returns MISSING, not a bash error that crashes the agent)

**Fix any ❌ items** by editing `audit-orchestrator.md` directly. Do not leave broken items and note them — fix them.

### When Done

1. Run: `grep -c "Wave 0 Pre-Audit Gate" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must be 1.
2. Run: `grep -c "DECISIONS_DIR" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must be ≥ 1.
3. Run: `grep -c "last_audit_date" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must be ≥ 2 (written in SUCCESS handler, read in smart filter).
4. Update this plan file:
   - Change Phase 1R Status to `DONE — {today's date}`, note how many checklist items were fixed (0 if clean)
   - Change Phase 2 Status to `CURRENT`
   - Update NEXT PROMPT TO PASTE at top of file (same prompt text)
5. Print the standard next-phase prompt.

---

## PHASE 2 — NEEDS_INPUT Staleness (IMPLEMENT)
**Status: DONE — 2026-03-23**
**Type: IMPLEMENT**

### Context (read this before touching anything)

Currently, when implement-agent returns NEEDS_INPUT, the task sits in `comms/needs_input/` indefinitely. The `io-run.sh status` command shows a count but no elapsed times. Tasks can wait 48+ hours with no user notification.

You are adding staleness detection and auto-escalation in two places:
1. `audit-orchestrator.md` — scan for stale needs_input files at the start of each implement run, auto-escalate ancient ones
2. `io-run.sh` — update the status display to show per-task elapsed times

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — read the Implement Loop startup section and the Needs Input File Format section
2. `/home/io/io-dev/io/io-run.sh` — read the full status mode Python block (the `if [ "$MODE" = "status" ]` section, approximately lines 25-115)

### What to implement

**Step 1: Add NEEDS_INPUT_STALE_HOURS constant**

In the Constants section, add:
```
NEEDS_INPUT_STALE_HOURS: 48    (warn threshold)
NEEDS_INPUT_ESCALATE_HOURS: 144  (auto-escalate threshold — 6 days)
```

**Step 2: Add staleness scan to Implement Loop startup**

In the Implement Loop, immediately after "Run zombie detection pass" (step 1) and before task selection, insert a new step 1b:

```
1b. **NEEDS_INPUT Staleness Scan**: Before selecting tasks, scan for stale needs_input files.

   Run: `ls comms/needs_input/*.md 2>/dev/null`
   If no files: skip this step.

   For each needs_input file found:
   a. Read the file — extract `task_id`, `created` (ISO timestamp), and the first line of the Question section
   b. Calculate elapsed hours: (current time - created timestamp) in hours
   c. If elapsed >= NEEDS_INPUT_ESCALATE_HOURS (144h):
      - Update registry: set task status to `escalated`
      - Move file: `mv comms/needs_input/{task-id}.md comms/needs_input/stale/{task-id}.md` (create stale/ dir if needed)
      - Report: `⛔ {task-id} — NEEDS_INPUT unanswered for {N} days, auto-escalated. See comms/needs_input/stale/{task-id}.md`
   d. If elapsed >= NEEDS_INPUT_STALE_HOURS (48h) but < NEEDS_INPUT_ESCALATE_HOURS:
      - Report: `⚠️  {task-id} — waiting {N}h for answer. Question: {first line of question}`

   After scanning all files, if any were reported: pause and prompt user:
   ```
   {N} task(s) need your answers before they can continue. Run: claude --agent audit-orchestrator review_input
   ```
   Then continue with normal task selection (do not stop the run).
```

**Step 3: Update io-run.sh status display**

Find the Python block in `io-run.sh` status mode that currently does:
```python
ni = glob.glob("comms/needs_input/*.md")
if ni:
    print(f"  ⏸  {len(ni)} task(s) awaiting your answers:")
    for f in ni:
        print(f"       {f}")
```

Replace it with a richer version:
```python
import glob, os
from datetime import datetime, timezone

ni_files = glob.glob("comms/needs_input/*.md")
stale_files = glob.glob("comms/needs_input/stale/*.md")
if ni_files or stale_files:
    print(f"")
    print(f"  Pending Questions ({len(ni_files)} active, {len(stale_files)} auto-escalated)")
    now = datetime.now(timezone.utc)
    for fpath in sorted(ni_files):
        task_id = os.path.basename(fpath).replace(".md", "")
        created_str = ""
        question_line = ""
        try:
            with open(fpath) as f:
                lines = f.readlines()
            for line in lines:
                if line.startswith("created:"):
                    created_str = line.split(":", 1)[1].strip()
                if line.startswith("## Question"):
                    # get the next non-empty line
                    idx = lines.index(line)
                    for qline in lines[idx+1:]:
                        if qline.strip():
                            question_line = qline.strip()[:80]
                            break
        except Exception:
            pass
        elapsed = ""
        flag = "  ⏸ "
        if created_str:
            try:
                created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                hours = (now - created_dt).total_seconds() / 3600
                if hours >= 144:
                    elapsed = f"  ⚠️  {int(hours/24)}d (auto-escalating soon)"
                    flag = "  ⚠️ "
                elif hours >= 48:
                    elapsed = f"  ⚠️  {int(hours)}h"
                    flag = "  ⚠️ "
                else:
                    elapsed = f"  {int(hours)}h"
            except Exception:
                elapsed = "  ?"
        print(f"    {flag} {task_id}{elapsed}")
        if question_line:
            print(f"         → {question_line}")
    print(f"     Run: claude --agent audit-orchestrator  (enter review_input mode)")
```

### When Done

1. Verify constants added: `grep "NEEDS_INPUT_STALE_HOURS" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md`
2. Verify staleness scan added: `grep -c "Staleness Scan" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must be 1
3. Verify io-run.sh updated: `grep -c "elapsed" /home/io/io-dev/io/io-run.sh` — must be ≥ 1
4. Update this plan file: Phase 2 → `DONE — {date}`, Phase 2R → `CURRENT`
5. Print the standard next-phase prompt.

---

## PHASE 2R — Review Phase 2 Changes
**Status: DONE — 2026-03-23 (0 checklist items fixed — all clean)**
**Type: REVIEW**

### Context (read this before touching anything)

Phase 2 modified two files:
1. `audit-orchestrator.md` — added NEEDS_INPUT staleness scan in Implement Loop startup + two new constants
2. `io-run.sh` — replaced the simple needs_input count display with a per-task elapsed time display

**What was added:**
- Constants: `NEEDS_INPUT_STALE_HOURS: 48`, `NEEDS_INPUT_ESCALATE_HOURS: 144`
- Implement Loop step 1b: scans `comms/needs_input/*.md`, calculates elapsed hours, auto-escalates at 144h, warns at 48h
- `io-run.sh` status: shows per-task elapsed time with ⚠️ flag for stale, first line of question

**What was NOT supposed to change:**
- Audit Loop
- Task selection logic
- Any other section of audit-orchestrator.md
- Any section of io-run.sh other than the needs_input display block

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md`
2. `/home/io/io-dev/io/io-run.sh`

### Verification Checklist

**audit-orchestrator.md:**
- [ ] `NEEDS_INPUT_STALE_HOURS: 48` in Constants
- [ ] `NEEDS_INPUT_ESCALATE_HOURS: 144` in Constants
- [ ] Step 1b exists in Implement Loop, positioned after zombie detection and before task selection
- [ ] Step 1b reads each needs_input file and extracts `created` field
- [ ] Step 1b calculates elapsed hours (not days, not minutes — hours)
- [ ] Auto-escalate at ≥ 144h: updates registry status to `escalated`, moves file to `stale/` subdir
- [ ] Warn at ≥ 48h but < 144h: reports to user without stopping the run
- [ ] After scanning: prompts user to run `review_input` but continues with task selection (does NOT halt the run)
- [ ] Gracefully handles missing `comms/needs_input/` directory (no crash if dir doesn't exist)
- [ ] Gracefully handles malformed `created` field (no crash, reports unknown elapsed time)

**io-run.sh:**
- [ ] Per-task elapsed time display present (not just a count)
- [ ] Shows ⚠️ flag for files ≥ 48h
- [ ] Shows question text excerpt (first non-empty line after ## Question)
- [ ] Still handles the case where `comms/needs_input/` is empty (no output, no crash)
- [ ] `set -euo pipefail` compatibility: Python block is wrapped in `if ! ... ; then` error handling (consistent with other Python blocks in the file)
- [ ] Stale directory (`comms/needs_input/stale/`) is handled in the count display

**No regressions:**
- [ ] Audit Loop is unchanged
- [ ] implement/audit/full/uat mode logic in io-run.sh is unchanged
- [ ] The `PYEOF` heredoc syntax is correct (consistent with existing Python blocks in io-run.sh)

**Fix any ❌ items** by editing the files directly.

### When Done

1. Update this plan file: Phase 2R → `DONE — {date}`, Phase 3 → `CURRENT`
2. Print the standard next-phase prompt.

---

## PHASE 3 — Escalation Diagnosis Agent (IMPLEMENT)
**Status: DONE — 2026-03-23**
**Type: IMPLEMENT**

### Context (read this before touching anything)

Currently when a task fails 3 times (hits MAX_IMPL), it is marked `escalated` and the orchestrator moves on. There is no diagnosis. The user wakes up to N escalated tasks and has to read attempt files manually.

You are creating a new agent (`escalation-agent.md`) that runs BEFORE the final escalation and produces a diagnosis. The orchestrator then branches based on the diagnosis verdict.

**Four verdicts:**
- `AMBIGUOUS_SPEC` — spec has an unresolvable ambiguity; needs `/design-qa`
- `MISSING_DEPENDENCY` — task depends on something not yet implemented
- `SCOPE_TOO_LARGE` — task exceeds one context window; needs decomposition (Phase 4 handles this)
- `IMPLEMENTATION_FAILURE` — genuine code/logic problem; escalate to user with summary

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — read the FAILED result handler in the Implement Loop and the escalation path
2. `/home/io/io-dev/io/.claude/agents/implement-agent.md` — read the X4 (attempt file format) and X8 (return result format) sections — escalation-agent will read these files

### What to implement

**Step 1: Create `/home/io/io-dev/io/.claude/agents/escalation-agent.md`**

Write the full agent file. It should follow the style of `implement-agent.md` (numbered steps, explicit field names, bash commands). Content:

```markdown
---
name: escalation-agent
description: Diagnoses why a task failed after MAX_IMPL attempts and produces a verdict: AMBIGUOUS_SPEC, MISSING_DEPENDENCY, SCOPE_TOO_LARGE, or IMPLEMENTATION_FAILURE. Called by audit-orchestrator before final escalation.
---

# Escalation Agent

You diagnose one task. Read the attempt files, identify the failure pattern, write a diagnosis file, and return a verdict. Do not implement anything. Do not modify any source code files.

## Input

TASK_ID: <task-id>
UNIT: <unit>
REPO_ROOT: /home/io/io-dev/io

## Protocol

### Step 1 — Read all attempt files

Run: `ls docs/state/{unit}/{task-id}/attempts/`
Read every attempt file found (docs/state/{unit}/{task-id}/attempts/001.md, 002.md, etc.)
Extract from each: `result`, "Why This Attempt Failed" section, "Files Modified" section, "Verification" section.

### Step 2 — Read the task spec

Use the Read tool on `docs/tasks/{unit}/{task-id}.md` (glob if name uncertain).
Extract: title, "Files to Create or Modify" list, Verification Checklist, "Do NOT" items.

### Step 3 — Count files in spec

Count the number of entries in the "Files to Create or Modify" section.
If count > 12: this is a strong signal for SCOPE_TOO_LARGE.

### Step 4 — Identify failure pattern

Read the "Why This Attempt Failed" sections from all attempts. Look for:

**AMBIGUOUS_SPEC signals:**
- Multiple attempts all fail on the same verification checklist item
- The checklist item references behavior not described in the spec (e.g., "export should include filters" — but the spec never defines which filters)
- Attempt notes say things like "spec doesn't clarify", "unclear whether", "no definition for"
- Agent returned NEEDS_INPUT on the same question multiple times

**MISSING_DEPENDENCY signals:**
- Attempts fail with "cannot find module", "function does not exist", "API endpoint returns 404"
- The missing thing is in `docs/tasks/` for another unit that is not yet verified
- Grep the codebase to confirm: `grep -r "missing_function_name" /home/io/io-dev/io/frontend/src/` — if nothing found, it's genuinely missing

**SCOPE_TOO_LARGE signals:**
- All attempts returned CHECKPOINT
- "Files Modified" section lists 10+ files across multiple attempts
- Attempt notes say "context limit", "ran out of context", "too many files"
- Spec has > 12 files in "Files to Create or Modify"

**IMPLEMENTATION_FAILURE signals:**
- Attempts fail with different errors each time (not the same checklist item)
- Build check fails for reasons that are fixable (type errors, import errors, logic bugs)
- No pattern suggesting ambiguity or missing code

### Step 5 — Write diagnosis file

Create `comms/escalated/` directory if it doesn't exist.
Write `comms/escalated/{task-id}.md`:

```markdown
---
task_id: {task-id}
unit: {unit}
verdict: {AMBIGUOUS_SPEC | MISSING_DEPENDENCY | SCOPE_TOO_LARGE | IMPLEMENTATION_FAILURE}
diagnosed_at: {ISO timestamp}
---

## Evidence

{For each attempt: one paragraph summarizing what it tried and why it failed}

## Verdict: {verdict}

{For AMBIGUOUS_SPEC: quote the exact ambiguous phrase from the spec. Identify what decision is needed.}
{For MISSING_DEPENDENCY: name the exact missing function/module/endpoint. Identify which unit/task likely implements it.}
{For SCOPE_TOO_LARGE: state how many files the spec requires. Recommend decomposition into N sub-tasks with brief descriptions of each.}
{For IMPLEMENTATION_FAILURE: summarize what went wrong technically. Provide specific fix suggestions.}

## Recommended Action

{AMBIGUOUS_SPEC: Run /design-qa for {specific contract or decision needed}. Then re-queue task.}
{MISSING_DEPENDENCY: Block task on {specific dependency task ID if known, or "unknown task implementing X"}. Do not retry until dependency is verified.}
{SCOPE_TOO_LARGE: Decompose into sub-tasks (see Phase 4 of PIPELINE_PLAN.md). Decompose-agent will handle automatically.}
{IMPLEMENTATION_FAILURE: Human review required. See attempt files for specific error details.}
```

### Step 6 — Return verdict

```
VERDICT: {verdict}
TASK_ID: {task-id}
DIAGNOSIS_FILE: comms/escalated/{task-id}.md
SUMMARY: {one sentence describing the root cause}
```
```

**Step 2: Modify audit-orchestrator.md — FAILED result handler**

Find the FAILED result handler section in the Implement Loop. Find the block that handles `task_attempts == MAX_IMPL`. Replace the current escalation with:

```
If attempts == MAX_IMPL:
  1. Spawn escalation-agent:
     ```
     Agent(escalation-agent):
       TASK_ID: <task-id>
       UNIT: <unit>
       REPO_ROOT: /home/io/io-dev/io
     ```
  2. Read the verdict from the result:
     - `AMBIGUOUS_SPEC`: set registry status `escalated`, report: `⛔ {task-id} — spec ambiguous. Run /design-qa. See comms/escalated/{task-id}.md`
     - `MISSING_DEPENDENCY`: set registry status `blocked`, report: `🔒 {task-id} — blocked on missing dependency. See comms/escalated/{task-id}.md`
     - `SCOPE_TOO_LARGE`: set registry status `needs_decomposition`, report: `📐 {task-id} — too large for one context. Will be decomposed. See comms/escalated/{task-id}.md`
     - `IMPLEMENTATION_FAILURE`: set registry status `escalated`, report: `⛔ {task-id} — implementation failed after {N} attempts. Human review needed. See comms/escalated/{task-id}.md`
  3. Continue to next task
```

**Step 3: Add `escalation-agent` to tools frontmatter**

In the frontmatter of `audit-orchestrator.md`, add `escalation-agent` to the `tools:` list.

**Step 4: Add `ESCALATED_DIR` constant**

In Constants: `ESCALATED_DIR: /home/io/io-dev/io/comms/escalated`

**Step 5: Add `blocked` and `needs_decomposition` statuses**

In the Registry Update section, add `blocked` and `needs_decomposition` as valid status values with their meanings.

### When Done

1. Verify: `ls /home/io/io-dev/io/.claude/agents/escalation-agent.md` — must exist
2. Verify: `grep -c "escalation-agent" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must be ≥ 2 (frontmatter + spawn point)
3. Verify: `grep "SCOPE_TOO_LARGE\|AMBIGUOUS_SPEC\|MISSING_DEPENDENCY\|IMPLEMENTATION_FAILURE" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — all four should appear
4. Update this plan file: Phase 3 → `DONE — {date}`, Phase 3R → `CURRENT`
5. Print the standard next-phase prompt.

---

## PHASE 3R — Review Phase 3 Changes
**Status: DONE — 2026-03-23 (0 checklist items fixed — all clean)**
**Type: REVIEW**

### Context (read this before touching anything)

Phase 3 created a new agent and hooked it into the orchestrator. Two files were changed:
1. **New file**: `.claude/agents/escalation-agent.md` — 6-step diagnosis protocol
2. **Modified**: `.claude/agents/audit-orchestrator.md` — FAILED handler now spawns escalation-agent; new statuses `blocked` and `needs_decomposition` added; `ESCALATED_DIR` constant added; `escalation-agent` in tools frontmatter

**What was supposed to be added to orchestrator:**
- `escalation-agent` in tools frontmatter
- `ESCALATED_DIR` constant
- `blocked` and `needs_decomposition` as valid statuses in Registry Update section
- FAILED handler at MAX_IMPL now spawns escalation-agent and branches on 4 verdicts

**What was NOT supposed to change:**
- Audit Loop
- Task selection logic (other than handling `blocked` and `needs_decomposition` skip)
- NEEDS_INPUT, CHECKPOINT, CYCLE_DETECTED, CONFLICT handlers
- Phase 2's staleness scan (step 1b)

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/escalation-agent.md`
2. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — FAILED handler and Registry Update section

### Verification Checklist

**escalation-agent.md:**
- [ ] File exists at `.claude/agents/escalation-agent.md`
- [ ] Has valid frontmatter with `name:` and `description:`
- [ ] Step 1: reads all attempt files using `ls` then Read tool
- [ ] Step 2: reads the task spec file
- [ ] Step 3: counts files in "Files to Create or Modify" — threshold > 12 signals SCOPE_TOO_LARGE
- [ ] Step 4: defines detection logic for all 4 verdicts with specific signals (not vague)
- [ ] Step 5: writes to `comms/escalated/{task-id}.md` with correct frontmatter fields
- [ ] Step 6: returns `VERDICT:` on its own line (parseable by orchestrator)
- [ ] Agent is read-only with respect to source code (explicitly states "Do not modify any source code files")
- [ ] Diagnosis file format includes "Recommended Action" section for each verdict type

**audit-orchestrator.md:**
- [ ] `escalation-agent` appears in the `tools:` frontmatter list
- [ ] `ESCALATED_DIR` constant added
- [ ] `blocked` status defined in Registry Update section
- [ ] `needs_decomposition` status defined in Registry Update section
- [ ] FAILED handler at MAX_IMPL spawns escalation-agent (not the old direct escalation)
- [ ] All 4 verdicts handled with distinct registry statuses and distinct report messages
- [ ] Task selection skips `blocked` status (same as `escalated`)
- [ ] Task selection skips `needs_decomposition` status

**Integration check:**
- [ ] The escalation-agent's return format (`VERDICT: {verdict}`) is what the orchestrator reads (not `RESULT:` or some other field name)
- [ ] The `SCOPE_TOO_LARGE` verdict path sets status `needs_decomposition` — this is the hook Phase 4 will use
- [ ] The orchestrator creates `comms/escalated/` directory if it doesn't exist before spawning escalation-agent (or escalation-agent creates it — but one of them must)

**Fix any ❌ items** by editing the files directly.

### When Done

1. Update this plan file: Phase 3R → `DONE — {date}`, Phase 4 → `CURRENT`
2. Print the standard next-phase prompt.

---

## PHASE 4 — Task Decomposition (IMPLEMENT)
**Status: DONE — 2026-03-23**
**Type: IMPLEMENT**

### Context (read this before touching anything)

A task with `status: needs_decomposition` in the registry is a task that escalation-agent (Phase 3) diagnosed as `SCOPE_TOO_LARGE`. It cannot be implemented in a single context window. It needs to be split into 2–4 sequential sub-tasks.

You are creating a decompose-agent and hooking it into the orchestrator's implement startup. You are also adding a proactive size gate so obviously large tasks are caught before wasting 3 implement attempts.

**Current rule to change:** `audit-orchestrator.md` currently says "Do not auto-decompose tasks." This must be changed to allow decomposition specifically for SCOPE_TOO_LARGE verdict or proactive size gate triggers.

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — read: Implement Loop, Task Selection, Rules section
2. `/home/io/io-dev/io/.claude/agents/escalation-agent.md` — read the SCOPE_TOO_LARGE diagnosis output format in the diagnosis file (Step 5) — decompose-agent reads this

### What to implement

**Step 1: Create `/home/io/io-dev/io/.claude/agents/decompose-agent.md`**

```markdown
---
name: decompose-agent
description: Splits a SCOPE_TOO_LARGE task into 2-4 sequential sub-tasks. Called by audit-orchestrator when a task has status needs_decomposition. Creates new task spec files, registers them in AUDIT_PROGRESS.json, and marks the original task as decomposed.
---

# Decompose Agent

You split one oversize task into smaller tasks. Do not implement any code. Only create task spec files and update the registry.

## Input

TASK_ID: <task-id>
UNIT: <unit>
REPO_ROOT: /home/io/io-dev/io
DIAGNOSIS_FILE: comms/escalated/{task-id}.md

## Protocol

### Step 1 — Read the diagnosis

Read `DIAGNOSIS_FILE`. Extract the "Recommended Action" section for SCOPE_TOO_LARGE. This contains the recommended sub-task descriptions from escalation-agent.

### Step 2 — Read the original task spec

Read `docs/tasks/{unit}/{task-id}.md`. Extract: title, full "Files to Create or Modify" list, Verification Checklist, priority, depends-on.

### Step 3 — Determine new task IDs

Read `comms/AUDIT_PROGRESS.json`. Find all task IDs for this unit. Find the highest numeric suffix (the last hyphen-separated number in each ID, e.g., MOD-CONSOLE-012 → 12). New sub-tasks start at highest + 1 and increment (MOD-CONSOLE-013, MOD-CONSOLE-014, etc.).

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

{For sub-tasks 1 to N-1: minimal checklist — just the files in this sub-task}
{For sub-task N (last): full checklist from original task}

## Do NOT

- Touch any file not listed in this sub-task's "Files to Create or Modify"
- Implement functionality belonging to a later sub-task
- {other Do NOTs from original task}
```

### Step 6 — Update registry and state files

Read `comms/AUDIT_PROGRESS.json`.

For each new sub-task:
1. Add entry to `task_registry`: `{id, unit, title, status: "pending", priority, depends_on, uat_status: null, decomposed_from: original-task-id}`
2. Create `docs/state/{unit}/{new-task-id}/` directory
3. Create `docs/state/{unit}/{new-task-id}/attempts/` directory
4. Create `docs/state/{unit}/{new-task-id}/CURRENT.md` with status: pending, attempt: 0

For the original task:
- Update registry status to `decomposed`
- Add field `decomposed_into: [list of new task IDs]`

Write `comms/AUDIT_PROGRESS.json` back.

### Step 7 — Return result

```
DECOMPOSED: {original-task-id}
NEW_TASKS: {comma-separated new task IDs}
COUNT: {N}
```
```

**Step 2: Add `decompose-agent` to orchestrator tools frontmatter**

**Step 3: Add needs_decomposition handling to Implement Loop startup**

In the Implement Loop, after step 1b (staleness scan) and before normal task selection, insert step 1c:

```
1c. **Decomposition Pass**: Before selecting tasks, check for tasks with status `needs_decomposition`.

   Scan registry for entries with `status: "needs_decomposition"`.
   For each:
   - Check that `comms/escalated/{task-id}.md` exists (diagnosis file from escalation-agent)
   - Spawn decompose-agent:
     ```
     Agent(decompose-agent):
       TASK_ID: <task-id>
       UNIT: <unit>
       REPO_ROOT: /home/io/io-dev/io
       DIAGNOSIS_FILE: comms/escalated/{task-id}.md
     ```
   - Report: `📐 {task-id} → decomposed into {new-task-ids}`

   After all decompositions: re-read AUDIT_PROGRESS.json (registry was updated by decompose-agent).
   Continue to normal task selection.
```

**Step 4: Add proactive size gate to Implement Loop**

In the Implement Loop, after step 2 (state file initialization) and before step 4a (mark as implementing), insert step 2a:

```
2a. **Proactive Size Gate**: Before marking as implementing, check if this task is too large.

   Read the task spec file: `docs/tasks/{unit}/{task-id}.md`
   Count lines matching file paths in the "Files to Create or Modify" section:
   ```bash
   grep -c "^\s*[-•]\s*\|^\s*[0-9]\+\." docs/tasks/{unit}/{task-id}.md | head -1
   ```
   (More precisely: count the entries between the "Files to Create or Modify" heading and the next ## heading)

   If file count > 12:
   - Update registry: set status `needs_decomposition`
   - Write `comms/escalated/{task-id}.md` with:
     verdict: SCOPE_TOO_LARGE
     evidence: "Proactive size gate triggered — {N} files in spec exceeds 12-file limit"
     recommended_action: "Decompose into sub-tasks of ≤ 8 files each"
   - Report: `📐 {task-id} — proactive size gate triggered ({N} files). Will be decomposed.`
   - Skip this task (do NOT proceed to step 4a). Re-run step 1c to decompose immediately.

   If file count ≤ 12: continue to step 3.
```

**Step 5: Update Rules section**

Replace: "Do not auto-decompose tasks. After MAX_IMPL failures, escalate to user."

With: "Tasks are decomposed automatically in two cases: (1) escalation-agent returns SCOPE_TOO_LARGE after MAX_IMPL failures, or (2) the proactive size gate triggers (task spec has > 12 files). In both cases, decompose-agent creates sub-tasks automatically — do not surface SCOPE_TOO_LARGE to the user for manual decomposition."

### When Done

1. Verify: `ls /home/io/io-dev/io/.claude/agents/decompose-agent.md` — must exist
2. Verify: `grep -c "decompose-agent" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must be ≥ 2
3. Verify: `grep "Proactive Size Gate" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must exist
4. Verify: `grep "Decomposition Pass" /home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — must exist
5. Verify: the old "Do not auto-decompose" rule is gone from Rules section
6. Update this plan file: Phase 4 → `DONE — {date}`, Phase 4R → `CURRENT`
7. Print the standard next-phase prompt.

---

## PHASE 4R — Review Phase 4 Changes
**Status: DONE — 2026-03-23 (0 checklist items fixed — all clean)**
**Type: REVIEW**

### Context (read this before touching anything)

Phase 4 created `decompose-agent.md` and added two new sections to the Implement Loop in `audit-orchestrator.md`:
- Step 1c: Decomposition Pass (runs before task selection, handles existing `needs_decomposition` tasks)
- Step 2a: Proactive Size Gate (runs before marking a task as implementing)

It also changed the rule from "do not auto-decompose" to "decompose automatically for SCOPE_TOO_LARGE".

**What was NOT supposed to change:**
- escalation-agent.md (Phase 3 output)
- Audit Loop
- NEEDS_INPUT, CHECKPOINT, CYCLE_DETECTED handlers
- Phase 2's staleness scan (step 1b)

### Files to Read First

1. `/home/io/io-dev/io/.claude/agents/decompose-agent.md`
2. `/home/io/io-dev/io/.claude/agents/audit-orchestrator.md` — Implement Loop and Rules section

### Verification Checklist

**decompose-agent.md:**
- [ ] File exists
- [ ] Step 1: reads `DIAGNOSIS_FILE` (not a hardcoded path)
- [ ] Step 2: reads original task spec
- [ ] Step 3: determines new task IDs by reading the registry (not hardcoding numbers)
- [ ] Step 4: design rules include: foundational first, UI second, last sub-task carries full checklist, sequential depends-on chain
- [ ] Step 5: sub-task spec files have `decomposed-from` field
- [ ] Step 5: sub-task specs have "Do NOT touch files not in this sub-task" rule
- [ ] Step 6: updates registry with new tasks AND marks original as `decomposed` with `decomposed_into` field
- [ ] Step 6: creates state directories and CURRENT.md stubs for new tasks
- [ ] Step 7: returns parseable `DECOMPOSED:` and `NEW_TASKS:` lines
- [ ] Agent is explicitly read-only for source code (only creates task spec files and updates registry)

**audit-orchestrator.md:**
- [ ] `decompose-agent` in tools frontmatter
- [ ] Step 1c exists in Implement Loop (after 1b, before task selection)
- [ ] Step 1c re-reads AUDIT_PROGRESS.json after decompositions complete (registry was updated)
- [ ] Step 2a exists in Implement Loop (after step 2, before step 4a)
- [ ] Step 2a threshold is > 12 files (not > 10 or > 15)
- [ ] Step 2a creates the escalated file itself (not spawning escalation-agent — proactive gate is direct)
- [ ] Step 2a loops back to step 1c for immediate decomposition (not deferring to next run)
- [ ] Old "Do not auto-decompose" rule is gone from Rules section
- [ ] New rule explicitly covers both cases (escalation-agent verdict AND proactive gate)

**Integration check:**
- [ ] The `decomposed` status is not the same as `escalated` — tasks in `decomposed` status are skipped at selection (they're done, replaced by sub-tasks)
- [ ] `needs_decomposition` tasks in step 1c are decomposed before task selection picks any task — ordering is correct
- [ ] The proactive gate (step 2a) fires before `status: implementing` is written to registry — if gate triggers, status stays at current (pending/failed), not implementing

**Fix any ❌ items** by editing the files directly.

### When Done

1. Update this plan file: Phase 4R → `DONE — {date}`, Phase 5 → `CURRENT`
2. Print the standard next-phase prompt.

---

## PHASE 5 — Integration Test Harness (IMPLEMENT)
**Status: DONE — 2026-03-23**
**Type: IMPLEMENT**

### Context (read this before touching anything)

There is currently no end-to-end test. UAT (uat-agent.md) tests individual task behaviors in isolation using Playwright MCP tools in an AI agent context. What we need is a conventional automated test suite: TypeScript files using the Playwright library directly, runnable with `npx tsx`, that follow complete user journeys.

This phase creates the infrastructure and 5 stub journey files. The stubs have real navigation/login code but placeholder verify steps (`// TODO`) because we cannot write accurate assertions without first knowing which features actually work in the browser.

**Credentials:** admin / admin (primary) or admin / changeme (fallback — write the login helper to try admin/admin first).
**App URL:** http://localhost:5173 (frontend dev server).
**Backend:** http://localhost:3000.

### Files to Read First

1. `/home/io/io-dev/io/io-run.sh` — read the full UAT mode section (lines ~117-289) to understand the startup pattern you will replicate
2. `/home/io/io-dev/io/frontend/package.json` — check for `playwright` and `tsx` dependencies

### What to implement

**Step 1: Add dependencies if missing**

Check `frontend/package.json` for `playwright` and `tsx` in devDependencies. If missing, add them. Do not run `pnpm install` — just update the JSON. The user will install.

**Step 2: Create directory structure**

```
frontend/tests/integration/
  runner.ts
  helpers.ts
  report.ts
  journeys/
    01-login.test.ts
    02-console-workspace.test.ts
    03-designer-roundtrip.test.ts
    04-data-binding.test.ts
    05-report-generation.test.ts
```

**Step 3: Write `helpers.ts`**

```typescript
import { chromium, Browser, Page } from 'playwright';

export const BASE_URL = 'http://localhost:5173';
export const API_URL = 'http://localhost:3000';

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function login(page: Page, username = 'admin', password = 'admin'): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
  await page.fill('input[name="username"], input[type="text"]', username);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  try {
    await page.waitForURL(url => !url.includes('/login'), { timeout: 10000 });
    return true;
  } catch {
    // Try alternate credentials
    if (username === 'admin' && password === 'admin') {
      return login(page, 'admin', 'changeme');
    }
    return false;
  }
}

export async function navigate(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
}

export async function takeNamedScreenshot(page: Page, name: string): Promise<void> {
  const dir = 'docs/uat/integration/screenshots';
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

export interface Step {
  name: string;
  run: (page: Page) => Promise<void>;
  verify: (page: Page) => Promise<void>;
}

export interface Journey {
  name: string;
  steps: Step[];
  cleanup?: (page: Page) => Promise<void>;
}
```

**Step 4: Write `runner.ts`**

```typescript
import { launchBrowser, login, type Journey } from './helpers';
import { writeReport } from './report';
import * as path from 'path';
import * as fs from 'fs';

// Dynamically import all journey files
const journeyFiles = fs.readdirSync(path.join(__dirname, 'journeys'))
  .filter(f => f.endsWith('.test.ts'))
  .sort();

async function runAll() {
  const results: Array<{journey: string, steps: Array<{name: string, passed: boolean, error?: string}>}> = [];

  for (const file of journeyFiles) {
    const mod = await import(`./journeys/${file.replace('.ts', '')}`);
    const journey: Journey = mod.default;
    console.log(`\n▶ ${journey.name}`);
    const stepResults: Array<{name: string, passed: boolean, error?: string}> = [];

    const browser = await launchBrowser();
    const page = await browser.newPage();

    try {
      const loggedIn = await login(page);
      if (!loggedIn) {
        stepResults.push({ name: 'login', passed: false, error: 'Login failed — check credentials and backend' });
      } else {
        for (const step of journey.steps) {
          try {
            await step.run(page);
            await step.verify(page);
            stepResults.push({ name: step.name, passed: true });
            console.log(`  ✅ ${step.name}`);
          } catch (e: any) {
            stepResults.push({ name: step.name, passed: false, error: e.message });
            console.log(`  ❌ ${step.name}: ${e.message}`);
          }
        }
      }
    } finally {
      if (journey.cleanup) await journey.cleanup(page).catch(() => {});
      await browser.close();
    }

    results.push({ journey: journey.name, steps: stepResults });
  }

  await writeReport(results);

  const totalSteps = results.flatMap(r => r.steps).length;
  const passedSteps = results.flatMap(r => r.steps).filter(s => s.passed).length;
  const failedJourneys = results.filter(r => r.steps.some(s => !s.passed)).length;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Integration Test Results`);
  console.log(`  Journeys: ${results.length} total, ${results.length - failedJourneys} passed, ${failedJourneys} failed`);
  console.log(`  Steps:    ${totalSteps} total, ${passedSteps} passed, ${totalSteps - passedSteps} failed`);
  console.log(`  Report:   docs/uat/integration/REPORT.md`);

  process.exit(failedJourneys > 0 ? 1 : 0);
}

runAll().catch(e => { console.error(e); process.exit(1); });
```

**Step 5: Write `report.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

export async function writeReport(results: Array<{journey: string, steps: Array<{name: string, passed: boolean, error?: string}>}>) {
  const dir = 'docs/uat/integration';
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(`${dir}/screenshots`, { recursive: true });

  const timestamp = new Date().toISOString();
  const totalSteps = results.flatMap(r => r.steps).length;
  const passedSteps = results.flatMap(r => r.steps).filter(s => s.passed).length;
  const passedJourneys = results.filter(r => r.steps.every(s => s.passed)).length;

  let md = `# Integration Test Report\nGenerated: ${timestamp}\n\n`;
  md += `## Summary\n`;
  md += `- Journeys: ${results.length} total, ${passedJourneys} passed, ${results.length - passedJourneys} failed\n`;
  md += `- Steps: ${totalSteps} total, ${passedSteps} passed, ${totalSteps - passedSteps} failed\n\n`;
  md += `## Results\n`;

  for (const r of results) {
    const icon = r.steps.every(s => s.passed) ? '✅' : '❌';
    md += `\n### ${icon} ${r.journey}\n`;
    for (const s of r.steps) {
      md += `  ${s.passed ? '✅' : '❌'} ${s.name}${s.error ? ` — ${s.error}` : ''}\n`;
    }
  }

  fs.writeFileSync(path.join(dir, 'REPORT.md'), md);

  // Also write JSON for programmatic use
  fs.writeFileSync(path.join(dir, 'REPORT.json'), JSON.stringify({ timestamp, results }, null, 2));
}
```

**Step 6: Write the 5 journey stub files**

Each journey file exports a default `Journey` object. Navigation and login steps are real. Verify steps are stubs with `// TODO` comments.

`01-login.test.ts`:
```typescript
import { type Journey, navigate, takeNamedScreenshot } from '../helpers';
export default {
  name: 'Login and Session',
  steps: [
    {
      name: 'login page loads',
      run: async (page) => { await page.goto('http://localhost:5173/login'); },
      verify: async (page) => {
        await page.waitForSelector('input[type="password"]', { timeout: 5000 });
        // TODO: verify login form has username field, password field, submit button
      }
    },
    {
      name: 'successful login redirects to app',
      run: async (page) => { /* login is handled by runner */ },
      verify: async (page) => {
        // TODO: after login, verify user is on the main dashboard or console route
        // Expected: URL does not contain /login
        if (page.url().includes('/login')) throw new Error('Still on login page after auth');
      }
    },
    {
      name: 'app shell renders',
      run: async (page) => { await takeNamedScreenshot(page, '01-app-shell'); },
      verify: async (page) => {
        // TODO: verify sidebar navigation is visible with at least 3 module links
        // TODO: verify user avatar or username is visible in header
      }
    }
  ]
} satisfies Journey;
```

Write similar stubs for journeys 02–05. Each should have 3–5 steps. Use real `page.goto` calls to actual routes (`/console`, `/designer`, `/reports`). The verify steps should be `// TODO` stubs except where trivially verifiable (e.g., URL check, page title).

**Step 7: Add integration-test mode to io-run.sh**

In `io-run.sh`, immediately after the `human-uat` mode block closes (`fi`) and before the `validate implement/audit/full` block, add:

```bash
# ── integration-test mode ─────────────────────────────────────────────────────
if [ "$MODE" = "integration-test" ]; then
    # Reuse the same backend/frontend startup logic as uat mode
    BACKEND_STARTED=""
    DEV_SERVER_PID=""
    trap 'if [ -n "$DEV_SERVER_PID" ]; then kill "$DEV_SERVER_PID" 2>/dev/null || true; fi; if [ -n "$BACKEND_STARTED" ]; then "$REPO/dev.sh" stop > /dev/null 2>&1 || true; fi' EXIT

    if ! curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
        echo "Starting backend..."
        "$REPO/dev.sh" start > /tmp/io-integration-backend.log 2>&1 &
        BACKEND_STARTED=1
        for i in $(seq 1 900); do
            sleep 1
            if curl -sf --max-time 2 --connect-timeout 1 http://localhost:3000/health/live > /dev/null 2>&1; then
                echo "Backend ready."; break
            fi
            [ "$i" = "900" ] && echo "ERROR: Backend failed to start." && exit 1
        done
    fi

    if ! curl -s --max-time 5 http://localhost:5173 > /dev/null 2>&1; then
        echo "Starting frontend..."
        ( cd "$REPO/frontend" && exec pnpm dev ) > /tmp/io-integration-devserver.log 2>&1 &
        DEV_SERVER_PID=$!
        for i in $(seq 1 40); do
            sleep 1
            if curl -s --max-time 3 http://localhost:5173 > /dev/null 2>&1; then
                sleep 4; echo "Frontend ready."; break
            fi
            [ "$i" = "40" ] && echo "ERROR: Frontend failed to start." && exit 1
        done
    fi

    echo ""
    echo "Running integration tests..."
    cd "$REPO/frontend" && npx tsx tests/integration/runner.ts
    EXIT_CODE=$?
    echo ""
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ All integration tests passed."
    else
        echo "❌ Integration tests failed. See docs/uat/integration/REPORT.md"
    fi
    exit $EXIT_CODE
fi
```

Also add `integration-test` to the usage comment at the top of io-run.sh.

### When Done

1. Verify: `ls /home/io/io-dev/io/frontend/tests/integration/runner.ts` — must exist
2. Verify: `ls /home/io/io-dev/io/frontend/tests/integration/journeys/` — must show 5 files
3. Verify: `grep "integration-test" /home/io/io-dev/io/io-run.sh` — must appear
4. Verify: `grep "playwright" /home/io/io-dev/io/frontend/package.json` — must appear in devDependencies
5. Update this plan file: Phase 5 → `DONE — {date}`, Phase 5R → `CURRENT`
6. Print the standard next-phase prompt.

---

## PHASE 5R — Review Phase 5 Changes
**Status: DONE — 2026-03-23 (1 checklist item fixed — set -euo pipefail compatibility in io-run.sh)**
**Type: REVIEW**

### Context (read this before touching anything)

Phase 5 created the integration test infrastructure. Multiple files were created/modified:
- **New**: `frontend/tests/integration/runner.ts`, `helpers.ts`, `report.ts`
- **New**: `frontend/tests/integration/journeys/01` through `05`
- **Modified**: `frontend/package.json` (playwright + tsx devDependencies)
- **Modified**: `io-run.sh` (integration-test mode added)

Your job: verify the TypeScript files are correctly typed and structured, the io-run.sh addition is bash-correct, and the test infrastructure will actually work when invoked.

**What was NOT supposed to change:**
- Any existing io-run.sh modes (uat, human-uat, implement, audit, full, status)
- Any backend source code
- Any existing frontend source files
- Any existing agent files

### Files to Read First

1. `/home/io/io-dev/io/frontend/tests/integration/runner.ts`
2. `/home/io/io-dev/io/frontend/tests/integration/helpers.ts`
3. `/home/io/io-dev/io/frontend/tests/integration/report.ts`
4. `/home/io/io-dev/io/frontend/tests/integration/journeys/01-login.test.ts` (spot check)
5. `/home/io/io-dev/io/io-run.sh` — the new integration-test block

### Verification Checklist

**TypeScript correctness:**
- [ ] `helpers.ts` exports `Journey`, `Step`, `login`, `navigate`, `takeNamedScreenshot`, `launchBrowser`
- [ ] `runner.ts` imports from `./helpers` and `./report` (relative paths, no `.ts` extension in imports)
- [ ] `runner.ts` dynamically imports journey files — the path construction is correct for the directory structure
- [ ] `report.ts` creates `docs/uat/integration/` directory recursively before writing (won't crash on first run)
- [ ] `report.ts` writes both `REPORT.md` and `REPORT.json`
- [ ] Journey files use `satisfies Journey` type annotation (or equivalent)
- [ ] `runner.ts` exits with code 1 on any failed journey (so io-run.sh captures failure)
- [ ] `runner.ts` closes the browser in a `finally` block (won't leak browser processes)

**Journey stubs:**
- [ ] All 5 journey files exist
- [ ] Each journey has at least 3 steps
- [ ] Each journey file exports `default` (not named export)
- [ ] TODO verify steps are properly commented — they should throw an error if the TODO is not yet filled in, OR be genuine no-ops. They must NOT silently pass without checking anything. Check: a step with only `// TODO` comment and no assertion will pass vacuously — this is wrong.
- [ ] At least the login journey's "still on login page" check is a real assertion (non-stub)
- [ ] Screenshots directory path is consistent between helpers.ts and report.ts

**io-run.sh:**
- [ ] `integration-test` appears in the usage comment at top of file
- [ ] The new block is inside `if [ "$MODE" = "integration-test" ]; then ... fi`
- [ ] The EXIT trap is set before any process is started (same pattern as uat mode)
- [ ] `set -euo pipefail` compatibility: `$EXIT_CODE` captured from npx tsx, not from `$?` of a subsequent command
- [ ] The block ends with `exit $EXIT_CODE` (doesn't fall through to the implement/audit/full validation)
- [ ] No `cd` without absolute path that could break if CWD changes

**package.json:**
- [ ] `playwright` in devDependencies
- [ ] `tsx` in devDependencies
- [ ] JSON is valid (not corrupted)

**Fix any ❌ items.** Specifically: fix any journey step that would pass vacuously (empty verify function). Replace with a `throw new Error('TODO: fill in after running human-UAT')` so the test fails explicitly until filled in — failing explicitly is better than passing silently.

### When Done

1. Run: `cd /home/io/io-dev/io/frontend && npx tsc --noEmit 2>&1 | grep "tests/integration" | head -20`
   - If TypeScript errors in the integration test files: fix them.
   - Pre-existing errors in other files: ignore.
2. Update this plan file: Phase 5R → `DONE — {date}`, Phase 6 → `CURRENT`
3. Print the standard next-phase prompt.

---

## PHASE 6 — Fill Integration Test Scenarios (IMPLEMENT)
**Status: DONE — 2026-03-23**
**Type: IMPLEMENT**

### Pre-conditions (check before starting)

This phase requires the app to be running. Before starting, verify:
```bash
curl -sf http://localhost:3000/health/live && echo "backend: OK" || echo "backend: NOT RUNNING"
curl -s http://localhost:5173 | head -5 && echo "frontend: OK" || echo "frontend: NOT RUNNING"
```
If either is not running, run `./io-run.sh integration-test` which auto-starts them, observe what fails, then work from those failures.

### Context (read this before touching anything)

The journey stubs from Phase 5 have `// TODO` verify steps and explicit `throw new Error('TODO: fill in...')` stubs. Your job is to replace them with real Playwright assertions. You do this by: first running the tests to see what's actually accessible, then writing assertions for what works.

You cannot write accurate assertions without observing actual app behavior. Use the Playwright MCP tools (browser_navigate, browser_snapshot, etc.) to explore the running app manually before writing the assertions.

### Files to Read First

1. `/home/io/io-dev/io/frontend/tests/integration/helpers.ts`
2. All 5 journey files in `/home/io/io-dev/io/frontend/tests/integration/journeys/`
3. `/home/io/io-dev/io/docs/uat/integration/REPORT.md` (if it exists from a prior run)

### What to implement

**Step 1: Run the tests to establish baseline**

```bash
cd /home/io/io-dev/io/frontend && npx tsx tests/integration/runner.ts 2>&1 | tail -40
```

Note which steps fail with "TODO: fill in" (infrastructure is fine, just needs assertions) vs which steps fail with navigation errors (feature may not exist or route is wrong).

**Step 2: Explore the app manually**

Use Playwright MCP tools to navigate to each route used in the journeys:
- `http://localhost:5173/login` — confirm login form selectors
- `http://localhost:5173/console` — confirm what renders (workspace list? stub? real UI?)
- `http://localhost:5173/designer` — confirm what renders
- `http://localhost:5173/reports` — confirm what renders

**Step 3: Fill in assertions for what works**

For each journey step that fails with "TODO: fill in":
- If the feature EXISTS and renders: replace the TODO with real `page.waitForSelector` / `page.textContent` / `page.url()` assertions
- If the feature is a STUB or does not exist: keep the `throw new Error('TODO')` but change the message to `throw new Error('SKIP: {feature name} not yet implemented')`

Mark genuinely skipped steps in the journey file with a comment:
```typescript
// SKIP: {reason} — fill in when {dependency} is implemented
```

**Step 4: Run tests again and confirm clean baseline**

After filling in assertions, re-run. Target: all non-SKIP steps pass. Document remaining SKIP steps.

**Step 5: Write BASELINE.md**

Write `docs/uat/integration/BASELINE.md`:
```markdown
# Integration Test Baseline
Date: {today}

## Results
- {N} steps passing
- {N} steps skipped (feature not yet implemented)
- 0 steps failing (all failures are either passing or explicitly skipped)

## Skipped Steps and Reasons
| Journey | Step | Reason | Unblocked By |
|---------|------|--------|-------------|
| {journey name} | {step name} | {reason} | {which task/feature would unblock it} |

## Rerun Command
./io-run.sh integration-test
```

### When Done

1. Verify: `./io-run.sh integration-test` exits 0 (or exits 1 only due to `throw new Error('SKIP:...')` steps — if those are treated as failures, consider marking them as skipped via a try/catch that logs but doesn't rethrow)
2. Verify: `docs/uat/integration/BASELINE.md` exists
3. Update this plan file: Phase 6 → `DONE — {date}`, Phase 6R → `CURRENT`
4. Print the standard next-phase prompt.

---

## PHASE 6R — Final Review and Completion
**Status: DONE — 2026-03-23 (1 fix: report.ts/helpers.ts path resolved to project root via import.meta.url)**
**Type: REVIEW**

### Context (read this before touching anything)

This is the final phase. Phase 6 filled in real assertions in the integration test journey files and wrote BASELINE.md. Your job is to verify the test suite is honest (no vacuous passes), the baseline document is accurate, and the full pipeline improvement is complete.

### Files to Read First

1. `/home/io/io-dev/io/docs/uat/integration/BASELINE.md`
2. `/home/io/io-dev/io/docs/uat/integration/REPORT.md` (most recent run)
3. Two or three journey files of your choice

### Verification Checklist

- [ ] BASELINE.md exists and has a date, results count, and skipped steps table
- [ ] REPORT.md reflects a recent run (not from before Phase 6)
- [ ] No journey step has an empty verify function (would pass vacuously)
- [ ] Skipped steps use explicit `throw new Error('SKIP:...')` pattern (fail loudly, not silently)
- [ ] `./io-run.sh integration-test` is documented in `io-run.sh` usage comment
- [ ] All 6 pipeline improvements are reflected in agent files (spot check):
  - [ ] `grep "Wave 0 Pre-Audit Gate" .claude/agents/audit-orchestrator.md` — exists
  - [ ] `grep "Staleness Scan" .claude/agents/audit-orchestrator.md` — exists
  - [ ] `ls .claude/agents/escalation-agent.md` — exists
  - [ ] `ls .claude/agents/decompose-agent.md` — exists
  - [ ] `grep "Proactive Size Gate" .claude/agents/audit-orchestrator.md` — exists
  - [ ] `ls frontend/tests/integration/runner.ts` — exists

**Fix any ❌ items.**

### When Done

Update this plan file — replace the COMPLETION section at the bottom with:

```
## COMPLETION
ALL PHASES COMPLETE — {date}

New commands available:
  ./io-run.sh integration-test   → end-to-end journey tests

Pipeline safeguards now active:
  ✅ Wave 0 pre-audit gate (blocks audit until decision files exist)
  ✅ Wave 0 cross-unit re-audit trigger (recency check in smart filter)
  ✅ NEEDS_INPUT staleness: warn at 48h, auto-escalate at 144h
  ✅ Escalation diagnosis: 4 verdicts (ambiguous_spec, missing_dep, too_large, impl_failure)
  ✅ Task decomposition: automatic for SCOPE_TOO_LARGE + proactive >12-file gate
  ✅ Integration test harness: 5 user journeys, regression baseline established
```

Also update NEXT PROMPT TO PASTE at the top:
```
All pipeline improvement phases are complete. See docs/PIPELINE_PLAN.md for the full record. Run ./io-run.sh integration-test to verify the baseline still passes.
```

Print a completion message to the user.

---

## COMPLETION
ALL PHASES COMPLETE — 2026-03-23

New commands available:
  ./io-run.sh integration-test   → end-to-end journey tests

Pipeline safeguards now active:
  ✅ Wave 0 pre-audit gate (blocks audit until decision files exist)
  ✅ Wave 0 cross-unit re-audit trigger (recency check in smart filter)
  ✅ NEEDS_INPUT staleness: warn at 48h, auto-escalate at 144h
  ✅ Escalation diagnosis: 4 verdicts (ambiguous_spec, missing_dep, too_large, impl_failure)
  ✅ Task decomposition: automatic for SCOPE_TOO_LARGE + proactive >12-file gate
  ✅ Integration test harness: 5 user journeys, regression baseline established
