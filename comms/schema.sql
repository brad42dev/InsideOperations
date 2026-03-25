-- io-orchestrator SQLite schema
-- Apply via: sqlite3 comms/tasks.db < comms/schema.sql
-- WAL mode is enabled by migrate_to_sqlite.py (PRAGMA journal_mode=WAL)
-- This file defines tables and indexes only.

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
    verified_since_last_audit  INTEGER DEFAULT 0,
    spec_body                  TEXT,                -- full content of task .md file
    claimed_at                 TEXT,                -- ISO-8601
    claimed_by                 TEXT,
    cycle_count                INTEGER DEFAULT 0,
    attempt_count              INTEGER DEFAULT 0,
    created_at                 TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at                 TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS io_task_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         TEXT REFERENCES io_tasks(id),
    attempt_number  INTEGER,
    started_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    finished_at     TEXT,
    result          TEXT,
    notes           TEXT,
    changed_files   TEXT DEFAULT '[]'   -- JSON array
);

CREATE TABLE IF NOT EXISTS io_queue (
    unit                       TEXT PRIMARY KEY,
    wave                       INTEGER,
    tasks_total                INTEGER DEFAULT 0,
    tasks_verified             INTEGER DEFAULT 0,
    tasks_uat_added            INTEGER DEFAULT 0,
    uat_status                 TEXT,
    verified_since_last_audit  INTEGER DEFAULT 0,
    last_audit_at              TEXT,
    status                     TEXT DEFAULT 'pending'
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON io_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_unit            ON io_tasks(unit);
CREATE INDEX IF NOT EXISTS idx_tasks_wave            ON io_tasks(wave);
CREATE INDEX IF NOT EXISTS idx_tasks_status_wave     ON io_tasks(status, wave);
CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id ON io_task_attempts(task_id);
