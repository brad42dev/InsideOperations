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

    task_registry = data.get("task_registry", [])
    queue         = data.get("queue", [])
    print(f"Source: {len(task_registry)} tasks, {len(queue)} queue entries")

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

        depends_on = json.dumps(task.get("depends_on") or [])
        spec_body  = read_spec_body(task_id, unit)
        if spec_body is None:
            missing_files.append(task_id)

        con.execute(
            """
            INSERT OR REPLACE INTO io_tasks
                (id, unit, wave, title, status, priority, uat_status, source,
                 depends_on, audit_round, spec_body)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        tasks_total    = len(unit_tasks)
        tasks_verified = sum(1 for t in unit_tasks if t.get("status") == "verified")
        tasks_uat_added = sum(1 for t in unit_tasks if t.get("source") == "uat")

        con.execute(
            """
            INSERT OR REPLACE INTO io_queue
                (unit, wave, tasks_total, tasks_verified, tasks_uat_added,
                 uat_status, verified_since_last_audit, last_audit_at, status)
            VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ),
        )
        inserted_queue += 1

    con.commit()
    con.close()

    # 6. Validate
    con2 = sqlite3.connect(DB_FILE)
    db_task_count  = con2.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    db_queue_count = con2.execute("SELECT COUNT(*) FROM io_queue").fetchone()[0]
    con2.close()

    print(f"\nMigration complete:")
    print(f"  io_tasks  rows: {db_task_count}  (source: {len(task_registry)})")
    print(f"  io_queue  rows: {db_queue_count} (source: {len(queue)})")

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

    print(f"\n  AUDIT_PROGRESS.json preserved as backup (still writable — agents use it until Wave 3).")

    return 0


def verify() -> int:
    """Verify DB counts match JSON without re-migrating."""
    if not JSON_FILE.exists():
        print(f"ERROR: {JSON_FILE} not found", file=sys.stderr)
        return 1
    if not DB_FILE.exists():
        print(f"ERROR: {DB_FILE} not found — run without --verify first", file=sys.stderr)
        return 1

    with open(JSON_FILE, encoding="utf-8") as f:
        data = json.load(f)

    json_tasks = len(data.get("task_registry", []))
    json_queue = len(data.get("queue", []))

    con = sqlite3.connect(DB_FILE)
    db_tasks = con.execute("SELECT COUNT(*) FROM io_tasks").fetchone()[0]
    db_queue = con.execute("SELECT COUNT(*) FROM io_queue").fetchone()[0]
    db_pending = con.execute("SELECT COUNT(*) FROM io_tasks WHERE status IN ('pending','failed')").fetchone()[0]
    db_verified = con.execute("SELECT COUNT(*) FROM io_tasks WHERE status = 'verified'").fetchone()[0]
    con.close()

    ok = True
    if db_tasks != json_tasks:
        print(f"MISMATCH: io_tasks={db_tasks}, json={json_tasks}", file=sys.stderr)
        ok = False
    if db_queue != json_queue:
        print(f"MISMATCH: io_queue={db_queue}, json={json_queue}", file=sys.stderr)
        ok = False

    if ok:
        print(f"OK: {db_tasks} tasks ({db_verified} verified, {db_pending} pending/failed), {db_queue} queue entries")
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate AUDIT_PROGRESS.json → comms/tasks.db")
    parser.add_argument("--verify", action="store_true", help="Verify counts only, no migration")
    parser.add_argument("--dry-run", action="store_true", help="Parse JSON and report, no DB write")
    args = parser.parse_args()

    if args.verify:
        sys.exit(verify())
    else:
        sys.exit(migrate(dry_run=args.dry_run))
