# Legacy JSON → SQLite Cleanup Plan

**Goal:** Remove all AUDIT_PROGRESS.json read/write calls from agents and io-run.sh. SQLite (`comms/tasks.db`) becomes the sole authoritative store.

**Status:** In progress (2026-03-26)

---

## Context / Background

- `comms/AUDIT_PROGRESS.json` was the original state store (408 tasks, 36 queue entries)
- Migrated to `comms/tasks.db` (SQLite) — all orchestration now reads from SQLite
- Agents still read/write JSON → updates are lost or cause loops
- `LAST_ROUND.json` (35 bytes) — round progress, still used by io-run.sh only, keep as-is
- `ingest_task_files()` in io-run.sh already handles picking up task .md files from disk → agents don't need to register tasks in JSON for them to be picked up

## Already Fixed (this session)

- `io-run.sh auto` post-processing: propagates UAT verdict → `io_tasks.uat_status` after each UAT run
- `ingest_task_files()`: scans `docs/tasks/**/*.md`, inserts unregistered tasks into `io_tasks`
- `claim_next_task`: resilient `depends_on` JSON parsing, bad rows fixed in DB

---

## Files To Change

### Priority 1 — uat-agent.md (733 lines)

Most critical: broken today. Agent writes uat_status to JSON, tasks.db never sees it.

**Phase 1 (load tasks)** — currently reads `AUDIT_PROGRESS.json` `task_registry` filtered by unit + uat_status=null/partial.
Replace with:
```python
import sqlite3
con = sqlite3.connect('comms/tasks.db', timeout=10)
con.execute('PRAGMA journal_mode=WAL')
rows = con.execute("""
    SELECT id, title, status, uat_status, depends_on
    FROM io_tasks
    WHERE unit=? AND status='verified'
      AND (uat_status IS NULL OR uat_status='partial')
    ORDER BY id
""", (UNIT,)).fetchall()
con.close()
```

**Phase 6 (write new bug tasks)** — currently writes task file to disk AND appends to JSON registry.
Keep the disk write (ingest_task_files handles it). Remove JSON registry write entirely.
Keep queue update (`verified_since_last_audit`) — but write to `io_queue` table:
```python
con.execute("UPDATE io_queue SET verified_since_last_audit=verified_since_last_audit+1 WHERE unit=?", (unit,))
```

**Phase 7 (update uat_status)** — currently reads JSON, mutates, writes back.
Replace with direct SQLite UPDATE:
```python
# For each task from Phase 1 loaded set, determine uat_status (pass/fail/partial)
# then:
con.execute("""
    UPDATE io_tasks SET uat_status=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id=?
""", (new_status, task_id))
```

**Phase 1 next-task-num** — currently reads JSON to find max task number for new bug task IDs.
Replace with:
```python
rows = con.execute("SELECT id FROM io_tasks WHERE unit=? ORDER BY id DESC LIMIT 1", (unit,)).fetchone()
# parse suffix from rows[0] if exists
```

**Remove:** All `os.replace`, `json.load`, `json.dump` calls related to AUDIT_PROGRESS.json.
**Remove:** `{{PROGRESS_JSON}}` template token references.
**Keep:** CURRENT.md writes (these are UAT result files, not the registry).
**Keep:** scenarios.md writes (UAT test plan files).
**Keep:** task .md file writes (ingest picks them up).

---

### Priority 2 — bug-agent.md (425 lines)

Writes new task to JSON registry + task .md file to disk.
- Remove JSON registry write entirely (ingest handles .md file)
- For task ID allocation: query `io_tasks` for max suffix in unit
- Keep task .md file write

```python
# Allocate next ID
con = sqlite3.connect('comms/tasks.db', timeout=10)
rows = con.execute("SELECT id FROM io_tasks WHERE unit=? ORDER BY id DESC", (UNIT,)).fetchall()
# find max numeric suffix, add 1
next_num = max((int(r[0].split('-')[-1]) for r in rows if r[0].split('-')[-1].isdigit()), default=0) + 1
new_id = f"{UNIT}-{next_num:03d}"
# INSERT the new task
con.execute("INSERT OR IGNORE INTO io_tasks (id, unit, title, status, priority, source, spec_body, created_at, updated_at) VALUES (?,?,?,?,?,?,?,strftime(...),strftime(...))",
    (new_id, unit, title, 'pending', priority, 'bug-agent', spec_body))
con.commit()
```

Remove: All JSON read/write/os.replace patterns.
Remove: `{{PROGRESS_JSON}}` and `registry_file` config reads.

---

### Priority 3 — feature-agent.md (351 lines)

Same pattern as bug-agent: writes multiple tasks to JSON + disk.
- Remove JSON registry writes
- Write task .md files to disk (ingest handles registration)
- For ID allocation: query tasks.db
- Direct INSERT into io_tasks

---

### Priority 4 — decompose-agent.md (117 lines)

- Reads JSON registry to find max task suffix for sub-task ID allocation
- Writes decomposed sub-tasks to JSON registry + marks original as decomposed
- Replace both with SQLite read/write

```python
# Read max suffix
con.execute("SELECT id FROM io_tasks WHERE unit=? ORDER BY id DESC LIMIT 5", (unit,))
# Write sub-tasks
con.execute("INSERT OR IGNORE INTO io_tasks (...) VALUES (...)")
# Mark original decomposed
con.execute("UPDATE io_tasks SET status='decomposed', decomposed_into=? WHERE id=?", (json.dumps(sub_ids), original_id))
```

---

### Priority 5 — audit-orchestrator.md (850 lines)

Most complex. Used for both `audit` mode and `implement force <task_id>` mode.

The `implement force` path: already reads from SQLite (implement-agent.md line 75-82 checks io_tasks directly). The JSON references in audit-orchestrator are for the audit/full modes.

Changes:
- Load task registry: replace JSON read with `SELECT * FROM io_tasks`
- Load queue: replace JSON read with `SELECT * FROM io_queue`
- Update task status: replace JSON write with `UPDATE io_tasks SET status=?`
- Load globals (audit_round): replace with `SELECT value FROM io_global WHERE key='audit_round'`
- Write checkpoint: replace AUDIT_PROGRESS.json backup write with `UPDATE io_global`

This is the most invasive change. Can be deferred slightly — io-run.sh auto mode doesn't use audit-orchestrator for UAT (it calls uat-agent directly). It only uses audit-orchestrator for implement tasks, and those already work via SQLite (implement-agent reads tasks.db directly).

---

### Priority 6 — io-run.sh cleanup

Remove/archive:
- `CFG_LAST_ROUND_JSON` — keep (not AUDIT_PROGRESS, small coordination file)
- Any remaining `AUDIT_PROGRESS` references (currently none found in live code)
- After all agents updated: move `comms/AUDIT_PROGRESS.json` to `comms/AUDIT_PROGRESS.json.archive`

---

### Priority 7 — Post-cleanup

- Delete `comms/AUDIT_PROGRESS.json.bak`
- Archive `comms/AUDIT_PROGRESS.json` → `comms/AUDIT_PROGRESS.json.archive`
- Update `io-orchestrator.config.json`: remove `registry_file` key
- Update `comms/migrate_to_sqlite.py`: add note that migration is complete
- `LAST_ROUND.json` — keep as-is (io-run.sh only, 35 bytes, not an agent concern)

---

## SQLite Schema Reference

Tables in `comms/tasks.db`:
- `io_tasks` — id, unit, wave, title, status, priority, uat_status, source, depends_on, audit_round, spec_body, claimed_at, claimed_by, cycle_count, attempt_count, created_at, updated_at, answer_file, decomposed_from, decomposed_into, context_enriched_at
- `io_task_attempts` — id, task_id, attempt_number, started_at, finished_at, result, context_injection_tokens, context_final_tokens, context_utilization_pct, task_file_bytes, ...
- `io_queue` — unit, wave, status, tasks_open, tasks_total, tasks_verified, uat_status, verified_since_last_audit, last_audit_round, last_audit_date, attempts, repair_attempts, completed_at, catalog, notes
- `io_global` — key, value (audit_round, checkpoint_count, last_updated, current_unit)
- `io_task_files` — task_id, file_path, status
