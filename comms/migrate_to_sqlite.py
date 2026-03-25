#!/usr/bin/env python3
"""
migrate_to_sqlite.py — One-time migration from comms/AUDIT_PROGRESS.json to comms/tasks.db

Usage:
    python3 comms/migrate_to_sqlite.py

Reads:  comms/AUDIT_PROGRESS.json
Writes: comms/tasks.db  (created/replaced)

AUDIT_PROGRESS.json is NOT modified. It becomes a read-only backup.

After running:
    python3 comms/migrate_to_sqlite.py --verify
validates counts match without re-migrating.
"""

import argparse
import glob
import json
import os
import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).parent.parent

# Read paths from io-orchestrator.config.json if present
_config_file = REPO / "io-orchestrator.config.json"
if _config_file.exists():
    try:
        _c = json.loads(_config_file.read_text())
        _p = _c.get("paths", {})
        _ts = _c.get("task_store", {})
        _db = _p.get("registry_db") or _ts.get("path") or "comms/tasks.db"
        JSON_FILE   = REPO / _p.get("registry_file", "comms/AUDIT_PROGRESS.json")
        DB_FILE     = REPO / _db
        SCHEMA_FILE = REPO / "comms" / "schema.sql"
        TASKS_DIR   = REPO / _p.get("task_dir", "docs/tasks")
    except Exception:
        JSON_FILE   = REPO / "comms" / "AUDIT_PROGRESS.json"
        DB_FILE     = REPO / "comms" / "tasks.db"
        SCHEMA_FILE = REPO / "comms" / "schema.sql"
        TASKS_DIR   = REPO / "docs" / "tasks"
else:
    JSON_FILE   = REPO / "comms" / "AUDIT_PROGRESS.json"
    DB_FILE     = REPO / "comms" / "tasks.db"
    SCHEMA_FILE = REPO / "comms" / "schema.sql"
    TASKS_DIR   = REPO / "docs" / "tasks"


# ── task file lookup ──────────────────────────────────────────────────────────

def find_task_file(task_id: str, unit: str) -> Path | None:
    """
    Find the .md file for a task. Tries:
      1. docs/tasks/<unit-lowercase>/<task_id>*.md
      2. docs/tasks/<unit>/<task_id>*.md  (uppercase, legacy)
    Returns the Path of the first match, or None.
    """
    candidates = [
        TASKS_DIR / unit.lower(),
        TASKS_DIR / unit,
    ]
    for base in candidates:
        matches = list(base.glob(f"{task_id}*.md"))
        if matches:
            return matches[0]
    return None


def read_spec_body(task_id: str, unit: str) -> str | None:
    path = find_task_file(task_id, unit)
    if path is None:
        return None
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


# ── migration ─────────────────────────────────────────────────────────────────

def migrate(dry_run: bool = False) -> int:
    """Migrate AUDIT_PROGRESS.json to SQLite. Returns exit code."""

    # 1. Read source
    if not JSON_FILE.exists():
        print(f"ERROR: {JSON_FILE} not found", file=sys.stderr)
        return 1

    with open(JSON_FILE, encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"ERROR: {JSON_FILE} is malformed: {e}", file=sys.stderr)
            return 1

    task_registry  = data.get("task_registry", [])
    queue          = data.get("queue", [])
    task_attempts  = data.get("task_attempts", {})
    audit_round    = data.get("audit_round", 1)
    checkpoint_cnt = data.get("checkpoint_count", 0)
    print(f"Source: {len(task_registry)} tasks, {len(queue)} queue entries, audit_round={audit_round}")

    if dry_run:
        print("Dry-run mode — no database written.")
        return 0

    # 2. Open / create database
    if DB_FILE.exists():
        DB_FILE.unlink()
        print(f"Removed existing {DB_FILE}")

    con = sqlite3.connect(DB_FILE)
    con.row_factory = sqlite3.Row

    # Enable WAL mode first, before creating tables
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")   # safe with WAL
    con.commit()

    # 3. Create schema
    schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")
    con.executescript(schema_sql)
    con.commit()

    # 4. Migrate task_registry → io_tasks
    missing_files = []
    inserted_tasks = 0

    for task in task_registry:
        task_id = task.get("id", "")
        unit    = task.get("unit", "")

        depends_on      = json.dumps(task.get("depends_on") or [])
        decomposed_into = json.dumps(task.get("decomposed_into") or [])
        spec_body       = read_spec_body(task_id, unit)
        if spec_body is None:
            missing_files.append(task_id)

        # attempt_count: prefer io_tasks field; fall back to task_attempts map from JSON root
        attempt_count = task.get("attempt_count", task_attempts.get(task_id, 0))

        con.execute(
            """
            INSERT OR REPLACE INTO io_tasks
                (id, unit, wave, title, status, priority, uat_status, source,
                 depends_on, audit_round, spec_body, attempt_count,
                 answer_file, decomposed_from, decomposed_into)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                unit,
                task.get("wave"),
                task.get("title", ""),
                task.get("status", "pending"),
                task.get("priority", "medium"),
                task.get("uat_status"),
                task.get("source"),
                depends_on,
                task.get("audit_round", 0),
                spec_body,
                attempt_count,
                task.get("answer_file"),
                task.get("decomposed_from"),
                decomposed_into,
            ),
        )
        inserted_tasks += 1

    con.commit()

    # 5. Migrate queue → io_queue
    inserted_queue = 0
    for entry in queue:
        unit = entry.get("unit") or entry.get("id", "")
        if not unit:
            continue

        # Compute totals from task_registry for this unit
        unit_tasks = [t for t in task_registry if t.get("unit") == unit]
        tasks_total     = len(unit_tasks)
        tasks_verified  = sum(1 for t in unit_tasks if t.get("status") == "verified")
        tasks_uat_added = sum(1 for t in unit_tasks if t.get("source") == "uat")

        con.execute(
            """
            INSERT OR REPLACE INTO io_queue
                (unit, wave, tasks_total, tasks_verified, tasks_uat_added,
                 uat_status, verified_since_last_audit, last_audit_at, status,
                 last_audit_round, last_audit_date, attempts, repair_attempts,
                 catalog, tasks_open, completed_at, notes)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                unit,
                entry.get("wave"),
                tasks_total,
                tasks_verified,
                tasks_uat_added,
                entry.get("uat_status"),
                entry.get("verified_since_last_audit", 0),
                entry.get("completed_at"),
                entry.get("status", "pending"),
                entry.get("last_audit_round"),
                entry.get("last_audit_date"),
                entry.get("attempts", 0),
                entry.get("repair_attempts", 0),
                entry.get("catalog"),
                json.dumps(entry.get("tasks_open") or []),
                entry.get("completed_at"),
                entry.get("notes"),
            ),
        )
        inserted_queue += 1

    con.commit()

    # 6. Migrate global fields → io_global
    now = __import__("datetime").datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    globals_to_write = [
        ("audit_round",      str(audit_round)),
        ("checkpoint_count", str(checkpoint_cnt)),
        ("last_updated",     data.get("last_updated", now)),
        ("current_unit",     data.get("current_unit", "")),
    ]
    for key, value in globals_to_write:
        con.execute("INSERT OR REPLACE INTO io_global(key, value) VALUES(?,?)", (key, value))
    con.commit()
    con.close()

    # 7. Validate
    con2 = sqlite3.connect(DB_FILE)
    db_task_count   = con2.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    db_queue_count  = con2.execute("SELECT COUNT(*) FROM io_queue").fetchone()[0]
    db_global_count = con2.execute("SELECT COUNT(*) FROM io_global").fetchone()[0]
    con2.close()

    print(f"\nMigration complete:")
    print(f"  io_tasks  rows: {db_task_count}  (source: {len(task_registry)})")
    print(f"  io_queue  rows: {db_queue_count} (source: {len(queue)})")
    print(f"  io_global rows: {db_global_count} (audit_round, checkpoint_count, last_updated, current_unit)")

    ok = True
    if db_task_count != len(task_registry):
        print(f"  ERROR: task count mismatch ({db_task_count} != {len(task_registry)})", file=sys.stderr)
        ok = False
    if db_queue_count != len(queue):
        print(f"  ERROR: queue count mismatch ({db_queue_count} != {len(queue)})", file=sys.stderr)
        ok = False

    if missing_files:
        print(f"\n  WARNING: {len(missing_files)} task(s) have no .md file (spec_body=NULL):")
        for tid in missing_files[:20]:
            print(f"    {tid}")
        if len(missing_files) > 20:
            print(f"    ... and {len(missing_files) - 20} more")

    if not ok:
        return 1

    print(f"\n  SQLite is now authoritative. AUDIT_PROGRESS.json is preserved as a read-only backup.")
    print(f"  Agents write directly to {DB_FILE} — no sync step required.")

    return 0


def upgrade_schema() -> int:
    """Add new columns to an existing DB without re-migrating all data. Safe to re-run."""
    if not DB_FILE.exists():
        print(f"ERROR: {DB_FILE} not found — run migrate first", file=sys.stderr)
        return 1

    con = sqlite3.connect(DB_FILE)
    con.execute("PRAGMA journal_mode=WAL")

    # io_tasks new columns
    new_task_cols = [
        ("answer_file",     "TEXT"),
        ("decomposed_from", "TEXT"),
        ("decomposed_into", "TEXT DEFAULT '[]'"),
    ]
    # io_queue new columns
    new_queue_cols = [
        ("last_audit_round",  "INTEGER"),
        ("last_audit_date",   "TEXT"),
        ("attempts",          "INTEGER DEFAULT 0"),
        ("repair_attempts",   "INTEGER DEFAULT 0"),
        ("catalog",           "TEXT"),
        ("tasks_open",        "TEXT DEFAULT '[]'"),
        ("completed_at",      "TEXT"),
        ("notes",             "TEXT"),
    ]

    added = 0
    for col, typedef in new_task_cols:
        try:
            con.execute(f"ALTER TABLE io_tasks ADD COLUMN {col} {typedef}")
            added += 1
            print(f"  + io_tasks.{col}")
        except sqlite3.OperationalError:
            pass  # column already exists

    for col, typedef in new_queue_cols:
        try:
            con.execute(f"ALTER TABLE io_queue ADD COLUMN {col} {typedef}")
            added += 1
            print(f"  + io_queue.{col}")
        except sqlite3.OperationalError:
            pass  # column already exists

    # Create io_task_files table if missing
    con.execute("""
        CREATE TABLE IF NOT EXISTS io_task_files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id     TEXT NOT NULL REFERENCES io_tasks(id) ON DELETE CASCADE,
            file_path   TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'predicted',
            created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )
    """)
    con.execute("CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON io_task_files(task_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_task_files_path    ON io_task_files(file_path)")

    # Create io_global table if missing
    con.execute("""
        CREATE TABLE IF NOT EXISTS io_global (
            key    TEXT PRIMARY KEY,
            value  TEXT
        )
    """)
    # Seed io_global from JSON backup if empty (preserves real audit_round/checkpoint_count)
    if con.execute("SELECT COUNT(*) FROM io_global").fetchone()[0] == 0:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        # Try to read real values from JSON backup; fall back to safe defaults
        json_audit_round = 1
        json_checkpoint  = 0
        json_last_updated = now
        json_current_unit = ""
        if JSON_FILE.exists():
            try:
                import json as _json
                _data = _json.loads(JSON_FILE.read_text(encoding="utf-8"))
                json_audit_round  = _data.get("audit_round", 1)
                json_checkpoint   = _data.get("checkpoint_count", 0)
                json_last_updated = _data.get("last_updated", now)
                json_current_unit = _data.get("current_unit", "") or ""
            except Exception:
                pass  # malformed JSON — use defaults
        con.execute("INSERT OR IGNORE INTO io_global(key,value) VALUES('audit_round',?)",  (str(json_audit_round),))
        con.execute("INSERT OR IGNORE INTO io_global(key,value) VALUES('checkpoint_count',?)", (str(json_checkpoint),))
        con.execute("INSERT OR IGNORE INTO io_global(key,value) VALUES('last_updated',?)",  (json_last_updated,))
        con.execute("INSERT OR IGNORE INTO io_global(key,value) VALUES('current_unit',?)",  (json_current_unit,))
        print(f"  + io_global seeded (audit_round={json_audit_round}, checkpoint_count={json_checkpoint})")

    con.commit()
    con.close()

    if added:
        print(f"Schema upgraded: {added} new column(s) added.")
    else:
        print("Schema already up-to-date.")
    return 0


def verify() -> int:
    """Verify DB state (no JSON comparison required — SQLite is now authoritative)."""
    if not DB_FILE.exists():
        print(f"ERROR: {DB_FILE} not found — run migrate first", file=sys.stderr)
        return 1

    con = sqlite3.connect(DB_FILE)
    db_tasks   = con.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    db_queue   = con.execute("SELECT COUNT(*) FROM io_queue").fetchone()[0]
    db_pending = con.execute("SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed')").fetchone()[0]
    db_verified = con.execute("SELECT COUNT(*) FROM io_tasks WHERE status = 'verified'").fetchone()[0]
    try:
        db_global = con.execute("SELECT COUNT(*) FROM io_global").fetchone()[0]
        audit_round = con.execute("SELECT value FROM io_global WHERE key='audit_round'").fetchone()
        audit_round = audit_round[0] if audit_round else "?"
    except sqlite3.OperationalError:
        db_global = 0
        audit_round = "? (io_global missing — run --upgrade)"
    con.close()

    print(f"OK: {db_tasks} tasks ({db_verified} verified, {db_pending} pending/failed), "
          f"{db_queue} queue entries, audit_round={audit_round}, io_global={db_global} keys")
    return 0


def populate_predicted_files() -> int:
    """Parse spec_body for each task and insert predicted file paths into io_task_files.
    Safe to re-run — skips tasks that already have predicted entries.
    """
    if not DB_FILE.exists():
        print(f"ERROR: {DB_FILE} not found — run migrate first", file=sys.stderr)
        return 1

    import re

    # Match backtick-quoted paths like `frontend/src/Foo.tsx`
    backtick_re = re.compile(
        r'`((?:[a-zA-Z0-9_.@-]+/)+[a-zA-Z0-9_.@-]+\.[a-zA-Z0-9]{1,10})`'
    )
    # Match bare paths on their own line (leading bullet/dash/space optional)
    bare_re = re.compile(
        r'(?:^|(?<=\n))\s*[-*]?\s*((?:[a-zA-Z0-9_.@-]+/)+[a-zA-Z0-9_.@-]+\.[a-zA-Z0-9]{1,10})\b'
    )

    con = sqlite3.connect(DB_FILE)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=10000")

    # Ensure table exists (in case --upgrade wasn't run yet)
    con.execute("""
        CREATE TABLE IF NOT EXISTS io_task_files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id     TEXT NOT NULL REFERENCES io_tasks(id) ON DELETE CASCADE,
            file_path   TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'predicted',
            created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )
    """)
    con.execute("CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON io_task_files(task_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_task_files_path    ON io_task_files(file_path)")
    con.commit()

    rows = con.execute("SELECT id, spec_body FROM io_tasks WHERE spec_body IS NOT NULL").fetchall()
    tasks_with_files = 0
    total_inserted = 0
    skipped = 0

    for task_id, spec_body in rows:
        # Skip tasks that already have predicted entries
        existing = con.execute(
            "SELECT COUNT(*) FROM io_task_files WHERE task_id=? AND status='predicted'",
            (task_id,)
        ).fetchone()[0]
        if existing > 0:
            skipped += 1
            continue

        # Extract file paths from spec_body
        found_paths: set[str] = set()
        for m in backtick_re.finditer(spec_body):
            p = m.group(1)
            if p and '/' in p and len(p) < 200:
                found_paths.add(p)
        for m in bare_re.finditer(spec_body):
            p = m.group(1)
            if p and '/' in p and len(p) < 200 and ' ' not in p:
                found_paths.add(p)

        if not found_paths:
            continue

        tasks_with_files += 1
        for fp in sorted(found_paths):
            con.execute(
                "INSERT OR IGNORE INTO io_task_files(task_id, file_path, status) VALUES(?, ?, 'predicted')",
                (task_id, fp)
            )
            total_inserted += 1

    con.commit()
    con.close()

    total_tasks = len(rows)
    pct = (tasks_with_files / total_tasks * 100) if total_tasks > 0 else 0.0
    print(f"populate_predicted_files: {tasks_with_files}/{total_tasks} tasks ({pct:.0f}%) have predicted files")
    print(f"  Inserted {total_inserted} file entries; skipped {skipped} already-populated tasks.")
    if total_tasks > 0 and tasks_with_files < total_tasks * 0.5:
        print(f"  WARNING: coverage {pct:.0f}% < 50% — spec bodies may lack file path patterns")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate AUDIT_PROGRESS.json → comms/tasks.db")
    parser.add_argument("--verify",         action="store_true", help="Verify DB state, no migration")
    parser.add_argument("--upgrade",        action="store_true", help="Add new columns to existing DB without full re-migration")
    parser.add_argument("--populate-files", action="store_true", help="Parse spec_body and insert predicted file paths into io_task_files")
    parser.add_argument("--dry-run",        action="store_true", help="Parse JSON and report, no DB write")
    args = parser.parse_args()

    if args.verify:
        sys.exit(verify())
    elif args.upgrade:
        sys.exit(upgrade_schema())
    elif args.populate_files:
        sys.exit(populate_predicted_files())
    else:
        sys.exit(migrate(dry_run=args.dry_run))
