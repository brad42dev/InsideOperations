-- io-orchestrator SQLite schema
-- Apply via: sqlite3 comms/tasks.db < comms/schema.sql
-- WAL mode is enabled by migrate_to_sqlite.py (PRAGMA journal_mode=WAL)
-- This file defines tables and indexes only.

-- Per-task state. SQLite is the authoritative store — agents write here directly.
CREATE TABLE IF NOT EXISTS io_tasks (
    id                         TEXT PRIMARY KEY,
    unit                       TEXT NOT NULL,
    wave                       INTEGER,
    title                      TEXT NOT NULL,
    status                     TEXT NOT NULL DEFAULT 'pending',
    priority                   TEXT DEFAULT 'medium',
    uat_status                 TEXT,
    source                     TEXT,
    depends_on                 TEXT DEFAULT '[]',   -- JSON array of task IDs
    audit_round                INTEGER DEFAULT 0,
    spec_body                  TEXT,                -- full content of task .md file
    claimed_at                 TEXT,                -- ISO-8601
    claimed_by                 TEXT,
    cycle_count                INTEGER DEFAULT 0,
    attempt_count              INTEGER DEFAULT 0,   -- total implement attempts (replaces task_attempts map)
    answer_file                TEXT,                -- path to answers file for needs_input tasks
    decomposed_from            TEXT,                -- parent task ID if this is a sub-task
    decomposed_into            TEXT DEFAULT '[]',   -- JSON array of sub-task IDs (set on the original task)
    context_enriched_at        TEXT,                -- ISO-8601; NULL if catcher has not yet enriched this task
    created_at                 TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at                 TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Per-attempt history for implement-agent runs.
CREATE TABLE IF NOT EXISTS io_task_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT REFERENCES io_tasks(id),
    attempt_number  INTEGER,
    started_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    finished_at     TEXT,
    result          TEXT,
    notes           TEXT,
    changed_files   TEXT DEFAULT '[]',  -- JSON array
    context_injection_tokens  INTEGER,  -- approx tokens at session start (D2)
    context_final_tokens      INTEGER,  -- approx tokens at session end (D2)
    context_utilization_pct   REAL,     -- final/max * 100 (D2)
    task_file_bytes           INTEGER,  -- byte size of task spec (spec_body) at launch time
    linked_impl_avg_util_pct  REAL,     -- UAT only: avg context util of preceding verified impl attempts for this unit
    linked_impl_max_util_pct  REAL,     -- UAT only: max context util (worst-case impl for this unit)
    linked_impl_task_count    INTEGER   -- UAT only: number of tasks linked (denominator for avg)
);

-- Per-unit audit queue. Tracks audit status and wave-gate state.
CREATE TABLE IF NOT EXISTS io_queue (
    unit                       TEXT PRIMARY KEY,
    wave                       INTEGER,
    tasks_total                INTEGER DEFAULT 0,
    tasks_verified             INTEGER DEFAULT 0,
    tasks_uat_added            INTEGER DEFAULT 0,
    uat_status                 TEXT,
    verified_since_last_audit  INTEGER DEFAULT 0,
    last_audit_at              TEXT,
    last_audit_round           INTEGER,             -- audit_round value at last audit
    last_audit_date            TEXT,                -- ISO-8601 timestamp of last audit completion
    status                     TEXT DEFAULT 'pending',
    attempts                   INTEGER DEFAULT 0,   -- audit attempt count for this unit
    repair_attempts            INTEGER DEFAULT 0,   -- spec-repair attempts for current failure
    catalog                    TEXT,                -- path to catalog file
    tasks_open                 TEXT DEFAULT '[]',   -- JSON array of open task IDs from last audit
    completed_at               TEXT,
    notes                      TEXT,
    claimed_at                 TEXT,   -- ISO-8601; NULL when unit is not claimed by any audit agent
    claimed_by                 TEXT    -- worker identifier; NULL when not claimed
);

-- Global key-value store for orchestrator-wide state.
-- Keys: audit_round, checkpoint_count, last_updated, current_unit
CREATE TABLE IF NOT EXISTS io_global (
    key    TEXT PRIMARY KEY,
    value  TEXT
);

-- Per-task file ownership. Populated by migrate_to_sqlite --populate-files at task creation,
-- confirmed by implement-agent at completion. Used by claim logic to prevent two agents
-- from touching the same file simultaneously.
CREATE TABLE IF NOT EXISTS io_task_files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT NOT NULL REFERENCES io_tasks(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,   -- repo-relative path
    status      TEXT NOT NULL DEFAULT 'predicted',  -- 'predicted' | 'confirmed'
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON io_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_unit            ON io_tasks(unit);
CREATE INDEX IF NOT EXISTS idx_tasks_wave            ON io_tasks(wave);
CREATE INDEX IF NOT EXISTS idx_tasks_status_wave     ON io_tasks(status, wave);
CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id ON io_task_attempts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_files_task_id    ON io_task_files(task_id);
CREATE INDEX IF NOT EXISTS idx_task_files_path       ON io_task_files(file_path);
