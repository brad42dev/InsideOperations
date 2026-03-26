# Parallelism Safety for AI Agents: Deep Research

**Date:** 2026-03-25
**Context:** I/O project running up to 7 parallel Claude Code agents (claude CLI invocations), each reading task specs from `docs/tasks/*.md`, writing to source files, updating `comms/AUDIT_PROGRESS.json`, running bash commands, and writing to `docs/state/ledger/*.md`.

---

## Table of Contents

1. [File Locking Strategies in Bash](#1-file-locking-strategies-in-bash)
2. [Task Ownership / Reservation Protocol](#2-task-ownership--reservation-protocol)
3. [File Conflict Prevention for Parallel Agents](#3-file-conflict-prevention-for-parallel-agents)
4. [Database as Coordination Layer](#4-database-as-coordination-layer)
5. [Crash Recovery and Zombie Agent Detection](#5-crash-recovery-and-zombie-agent-detection)
6. [Git-Based Parallelism Strategies](#6-git-based-parallelism-strategies)
7. [Token / Context Considerations for Parallel Agents](#7-token--context-considerations-for-parallel-agents)
8. [Synthesis: Recommended Architecture for This Project](#8-synthesis-recommended-architecture-for-this-project)

---

## 1. File Locking Strategies in Bash

### 1.1 flock(1) Advisory Locks

`flock` provides POSIX advisory file locking via `fcntl(2)`. Advisory means: the kernel enforces the lock only between cooperating processes that all call `flock` on the same file descriptor. Any process that ignores `flock` and writes directly will not be blocked.

**What flock protects:**
- Mutual exclusion between processes that both call `flock` on the same file path
- Automatically released when the process exits or closes the FD, even on crash — the kernel cleans up
- Works across NFS (with caveats) and local filesystems

**What flock does NOT protect:**
- Processes that do not call `flock` at all (e.g., a text editor, `echo >file`, or any tool that writes without checking)
- Agents invoking different lock files for the same logical resource
- The file content itself — after acquiring the lock you must implement your own read-modify-write protocol

**Basic patterns:**

```bash
# Pattern A: Lock a file for exclusive write, auto-release on exit
exec 9>/tmp/agent-registry.lock
flock -x 9
# ... critical section ...
# Lock auto-released when FD 9 is closed or process dies

# Pattern B: Non-blocking trylock — fail fast instead of waiting
exec 9>/tmp/agent-registry.lock
if ! flock -n 9; then
    echo "Resource busy — another agent holds the lock."
    exit 1
fi

# Pattern C: Timeout — wait up to 10 seconds
exec 9>/tmp/agent-registry.lock
if ! flock -w 10 9; then
    echo "Timed out waiting for lock after 10s."
    exit 1
fi

# Pattern D: Lock a specific task file (per-task granularity)
TASK_LOCK="/tmp/io-task-${TASK_ID}.lock"
exec 9>"$TASK_LOCK"
flock -x 9
# work on task
flock -u 9   # explicit unlock (optional — FD close also releases)
```

**Critical failure modes:**
- `flock` on a file in `/tmp` is lost across reboots — cold-start agents will find a stale file but no lock (OK for kernel-managed locks; the lock is gone, the file may or may not be gone)
- If you lock a symlink: some systems lock the symlink, others the target — do not use symlinks as lock targets
- `flock` and `lockf` are NOT compatible — do not mix them
- Docker containers share the host kernel's lock table but only within the same host; NFS locks require `lockd` and are notoriously unreliable

**Current usage in this project:** `io-run.sh` already uses this pattern correctly:

```bash
LOCK_FILE="/tmp/io-run.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "ERROR: Another io-run.sh instance is already running."
    exit 1
fi
trap '_io_lock_cleanup' EXIT
```

This prevents concurrent `io-run.sh` invocations — but it serializes ALL agent launches. For parallel agents you need per-task granularity instead.

### 1.2 Lock Files vs Lock Directories (atomic mkdir)

`flock` requires a cooperating partner. An alternative that works even for non-cooperating processes is `mkdir`, which is atomic on all POSIX filesystems:

```bash
# Atomic claim via mkdir — succeeds for exactly one caller
CLAIM_DIR="/tmp/io-task-${TASK_ID}.claim"
if mkdir "$CLAIM_DIR" 2>/dev/null; then
    echo "Claimed task ${TASK_ID}"
    # write PID so staleness is detectable
    echo $$ > "$CLAIM_DIR/pid"
    echo "$(date -Iseconds)" > "$CLAIM_DIR/started_at"
    # ... do work ...
    rm -rf "$CLAIM_DIR"   # release on success
else
    echo "Task ${TASK_ID} already claimed by another agent."
fi
```

**Advantages over flock:**
- Works between any processes, not just cooperating ones
- No FD management required
- The directory itself can store metadata (PID, agent ID, timestamp)

**Disadvantages:**
- NOT automatically released on crash — you get a zombie claim directory
- Requires explicit cleanup (or a watchdog)
- Slightly more overhead than `flock` on high-contention paths

### 1.3 PID Files for Ownership and Staleness Detection

A PID file lets a watchdog determine whether the owner process is still alive:

```bash
LOCK_DIR="/tmp/io-task-${TASK_ID}.claim"
PID_FILE="$LOCK_DIR/pid"

claim_task() {
    local task_id="$1"
    local lock_dir="/tmp/io-task-${task_id}.claim"
    local pid_file="$lock_dir/pid"

    # Atomic claim
    if mkdir "$lock_dir" 2>/dev/null; then
        echo $$ > "$pid_file"
        return 0  # claimed
    fi

    # Already claimed — check if owner is alive
    if [ -f "$pid_file" ]; then
        local owner_pid
        owner_pid=$(cat "$pid_file" 2>/dev/null)
        if [ -n "$owner_pid" ] && kill -0 "$owner_pid" 2>/dev/null; then
            return 1  # owner alive, back off
        fi
        # Owner dead — this is a stale claim
        echo "Stale claim detected for ${task_id} (owner PID ${owner_pid} is dead). Taking over."
        # Atomic takeover: remove stale dir and re-claim
        rm -rf "$lock_dir"
        if mkdir "$lock_dir" 2>/dev/null; then
            echo $$ > "$pid_file"
            return 0
        fi
    fi
    return 1  # race — another agent beat us
}
```

**Failure modes:**
- PID recycling: process A dies, its PID is reused by unrelated process B, watchdog sees B is alive and thinks the claim is still valid. Mitigation: store the start time and compare with `/proc/<pid>/stat` field 22.
- Clock skew: comparing creation times across machines is unreliable for distributed scenarios.
- Race between "check dead" and "mkdir": two agents can both see the old PID is dead and both try to `mkdir` simultaneously — `mkdir` atomicity ensures only one wins.

### 1.4 How to Detect Dead Lock Holders

```bash
is_process_alive() {
    local pid="$1"
    local expected_start="$2"  # optional: epoch seconds from /proc/pid/stat

    if ! kill -0 "$pid" 2>/dev/null; then
        return 1  # dead
    fi

    # Verify it's the same process (not PID reuse)
    if [ -n "$expected_start" ] && [ -f "/proc/$pid/stat" ]; then
        local actual_start
        actual_start=$(awk '{print $22}' /proc/"$pid"/stat 2>/dev/null)
        if [ "$actual_start" != "$expected_start" ]; then
            return 1  # PID reused — original is dead
        fi
    fi
    return 0
}

# Store start time in the claim dir
echo "$(awk '{print $22}' /proc/$$/stat)" > "$LOCK_DIR/start_jiffies"
```

### 1.5 Lock Granularity: Per-File vs Per-Directory vs Per-Resource

| Granularity | Lock Target | Pros | Cons |
|-------------|-------------|------|------|
| Per-file | Each source file being written | Maximum parallelism | O(N) locks, complex bookkeeping |
| Per-task | One lock per task ID | Good balance | Two tasks could still touch same file |
| Per-directory | Lock the directory being written to | Simple | Too coarse — serializes unrelated work |
| Per-resource | Named lock for each shared resource (e.g., AUDIT_PROGRESS.json) | Precise | Requires explicit resource registry |

**Recommendation for this project:** Use per-task locks for task claim and per-resource locks for shared files like `AUDIT_PROGRESS.json`. Source code files (`.tsx`, `.rs`) are task-specific and do not need a separate lock if the task-claiming protocol is correct.

---

## 2. Task Ownership / Reservation Protocol

### 2.1 The "Claiming" Pattern

The fundamental operation: mark a task as "in progress" before doing any work, so no other agent starts the same task.

**Naive (broken) approach:**
```bash
# BAD — TOCTOU race: two agents both read "pending", both start
STATUS=$(jq -r '.task_registry[] | select(.id=="DD-06-009") | .status' AUDIT_PROGRESS.json)
if [ "$STATUS" = "pending" ]; then
    # ... start working (another agent can win here) ...
fi
```

**Correct atomic claim using flock + jq in-place:**
```bash
claim_task_in_json() {
    local task_id="$1"
    local agent_id="$2"
    local registry="comms/AUDIT_PROGRESS.json"
    local lock="/tmp/io-registry.lock"

    exec 9>"$lock"
    flock -x 9

    # Read inside the lock
    local status
    status=$(jq -r --arg id "$task_id" \
        '.task_registry[] | select(.id==$id) | .status' "$registry")

    if [ "$status" != "pending" ]; then
        flock -u 9
        return 1  # not available
    fi

    # Write inside the lock — atomic claim
    local tmp
    tmp=$(mktemp)
    jq --arg id "$task_id" --arg agent "$agent_id" --arg ts "$(date -Iseconds)" '
        .task_registry |= map(
            if .id == $id then
                . + {"status": "implementing", "claimed_by": $agent, "claimed_at": $ts}
            else . end
        )
    ' "$registry" > "$tmp" && mv "$tmp" "$registry"

    flock -u 9
    return 0
}
```

**Why `mv` matters:** Writing to a temp file then `mv`-ing atomically swaps the inode. Any reader that has the file open at the moment of swap continues reading the old version. This prevents corrupt partial-reads.

### 2.2 Optimistic Locking with Version Fields

For JSON registries, add a `version` field and reject writes where the version has changed since you read:

```bash
# Read
VERSION=$(jq '.version' comms/AUDIT_PROGRESS.json)
STATUS=$(jq -r --arg id "$TASK_ID" '.task_registry[] | select(.id==$id) | .status' comms/AUDIT_PROGRESS.json)

# ... prepare your update ...

# Write — only if version unchanged
exec 9>/tmp/io-registry.lock
flock -x 9
CURRENT_VERSION=$(jq '.version' comms/AUDIT_PROGRESS.json)
if [ "$CURRENT_VERSION" != "$VERSION" ]; then
    echo "Conflict: registry was updated by another agent. Retry."
    flock -u 9
    exit 1
fi
jq --argjson v "$((VERSION + 1))" '.version = $v | ...' comms/AUDIT_PROGRESS.json > /tmp/new.json
mv /tmp/new.json comms/AUDIT_PROGRESS.json
flock -u 9
```

This is optimistic in the sense that you don't hold the lock during the long computation, only during the final compare-and-swap.

### 2.3 Atomic Operations Available in Bash

| Operation | Atomic? | Notes |
|-----------|---------|-------|
| `mv` (same filesystem) | Yes | Atomic inode swap — the canonical safe write |
| `mkdir` | Yes | Fails if exists; exactly-once semantics |
| `flock` + write | Yes (with lock) | Atomicity depends on all writers respecting the lock |
| `echo > file` | No | Truncates then writes — partial write visible |
| `jq . file > file` | No | Reads and writes same file — data loss |
| `cp src dst` | No | Dst is partially written during copy |
| `ln -s` | Yes | Atomic symlink creation |
| `ln` (hard link) | Yes | Atomic |

**The safe write pattern** (always use this for JSON files):
```bash
# NEVER: jq ... file > file
# ALWAYS:
tmp=$(mktemp "$(dirname "$file")/tmp.XXXXXXXX")
jq '...' "$file" > "$tmp"
mv "$tmp" "$file"
```

### 2.4 Git as a Coordination Mechanism

Git's object store is append-only and content-addressed. Commits, blobs, and trees are written atomically (write to `.git/objects/`, then link). However, `git commit` is NOT atomic at the ref level across concurrent callers:

```
Agent A: git add frontend/Foo.tsx && git commit  → succeeds
Agent B: git add frontend/Bar.tsx && git commit  → succeeds IF A's commit is not HEAD
         OR fails with "non-fast-forward" if A already moved HEAD
```

This is Git's fundamental design: concurrent commits to the same branch cause non-fast-forward rejections on push, but local commits may silently diverge.

**Git as a coordination mechanism** (branch-per-task, covered in section 6) isolates this risk by giving each agent its own branch.

---

## 3. File Conflict Prevention for Parallel Agents

### 3.1 Two Agents Working on Different Tasks — Is It Safe?

**Scenario:** Agent A works on `MOD-CONSOLE-014`, Agent B works on `DD-06-009`.

**Safe if:**
- They write to completely disjoint file sets
- They each acquire exclusive locks before writing `AUDIT_PROGRESS.json`
- They use the `mv`-based write pattern for all JSON files

**Unsafe if:**
- Both tasks modify the same source file (e.g., both touch `frontend/src/constants.ts`)
- One agent runs `cargo build` while the other modifies Rust source — `cargo` lock file (`Cargo.lock`) gets written concurrently

**Detection approach — build a "files in use" set:**
```bash
# Each agent registers files it will touch when claiming a task
claim_with_files() {
    local task_id="$1"
    shift
    local files=("$@")   # list of files this task will modify

    exec 9>/tmp/io-registry.lock
    flock -x 9

    # Check for conflicts
    local in_use
    in_use=$(jq -r '.files_in_use // [] | .[]' comms/AUDIT_PROGRESS.json)
    for f in "${files[@]}"; do
        if echo "$in_use" | grep -qxF "$f"; then
            echo "File conflict: $f is already in use by another agent."
            flock -u 9
            return 1
        fi
    done

    # Register files + claim task
    local tmp
    tmp=$(mktemp)
    jq --arg id "$task_id" --argjson files "$(printf '%s\n' "${files[@]}" | jq -R . | jq -s .)" '
        .files_in_use = ((.files_in_use // []) + $files | unique) |
        .task_registry |= map(if .id == $id then . + {"status": "implementing"} else . end)
    ' comms/AUDIT_PROGRESS.json > "$tmp" && mv "$tmp" comms/AUDIT_PROGRESS.json

    flock -u 9
    return 0
}

# On task completion, remove files from in-use set
release_files() {
    local files=("$@")
    exec 9>/tmp/io-registry.lock
    flock -x 9
    local tmp
    tmp=$(mktemp)
    jq --argjson files "$(printf '%s\n' "${files[@]}" | jq -R . | jq -s .)" '
        .files_in_use = ((.files_in_use // []) - $files)
    ' comms/AUDIT_PROGRESS.json > "$tmp" && mv "$tmp" comms/AUDIT_PROGRESS.json
    flock -u 9
}
```

**Honest assessment:** AI agents are not good at predicting which files they will modify before they start. The "files in use" approach works if the task spec explicitly enumerates the files it touches, which is not always the case. A simpler approximation: forbid two agents from working on the same design-doc unit simultaneously (e.g., no two agents on `DD-06-*`), since tasks within a unit often touch the same files.

### 3.2 Shared Files: The Global Constants Problem

Some files are touched by many tasks:
- `frontend/src/lib/constants.ts`
- `frontend/src/styles/tokens.css`
- `frontend/src/router.tsx`
- Cargo workspace `Cargo.toml`

**Strategies:**

**Option A: Serialize access with a named lock**
```bash
SHARED_LOCK="/tmp/io-shared-constants.lock"
exec 8>"$SHARED_LOCK"
flock -x -w 60 8 || { echo "Timeout waiting for shared constants lock"; exit 1; }
# ... modify constants.ts ...
flock -u 8
```
Downside: one agent holds up all others for the duration of the edit.

**Option B: Merge-friendly task design**
Design tasks so they add to constants files rather than rewriting them. Use append operations where possible. Use Git's merge to reconcile additions from different branches (works well for additive changes, fails for structural changes).

**Option C: Queue tasks that touch shared files**
The orchestrator detects that a task touches a known shared file and queues it (sets status to `queued_for_shared_file` rather than immediately dispatching). Only one such task runs at a time.

**Option D: Patch-and-merge model (branch-per-task)**
Each agent commits to its own branch. The orchestrator merges branches sequentially. Merge conflicts in shared files are resolved at merge time, not at write time. This is the most robust strategy for frequent shared-file modifications.

### 3.3 Git Merge Conflicts: Two Agents Run `git commit`

**Scenario:** Agent A and Agent B both work on `main`, both run `git add` and `git commit`.

```
Time:  A reads HEAD=abc  B reads HEAD=abc
       A commits → HEAD=def
       B commits → HEAD=ghi (parent=abc, not def)
```

Now the repo has two commits with the same parent. `git log --oneline main` shows only whichever commit happened to win the ref update race. The other commit is an orphan (reachable via `git reflog`, but not `HEAD`).

**On Linux, `git update-ref` (which moves HEAD) uses the kernel's rename semantics — it is atomic, but the process is:**
1. Write new ref to `.git/refs/heads/main.lock`
2. Rename to `.git/refs/heads/main`

If both agents try step 2 simultaneously, one wins the rename and the other gets an error ("ref file locked"). Git handles this by returning an error to the loser. The loser's commit is written but HEAD does not point to it.

**Result:** Agent B's commit is lost unless B detects the failure, rebases, and retries.

**Safe multi-agent commit protocol:**
```bash
commit_with_retry() {
    local message="$1"
    local max_retries=5
    for i in $(seq 1 $max_retries); do
        git add -A
        if git commit -m "$message"; then
            return 0
        fi
        # Commit failed — likely non-fast-forward
        echo "Commit failed (attempt $i). Rebasing..."
        git fetch origin main
        git rebase origin/main || { git rebase --abort; return 1; }
    done
    return 1
}
```

This works if commits are independent. It FAILS if two agents modified the same file — rebase will hit a conflict that requires human resolution.

### 3.4 File-Level Locking Registry

A minimal registry in `comms/AUDIT_PROGRESS.json`:

```json
{
  "files_in_use": [
    {
      "path": "frontend/src/modules/console/ConsoleLayout.tsx",
      "task_id": "MOD-CONSOLE-014",
      "agent_pid": 12345,
      "claimed_at": "2026-03-25T10:00:00Z"
    }
  ]
}
```

On agent startup: read, check for conflicts, atomically add entry.
On agent completion: atomically remove entry.
On agent crash: watchdog removes stale entries (see section 5).

**Failure mode:** If two agents crash simultaneously while holding file locks, both entries remain. The next agent must detect that both PIDs are dead before clearing entries.

---

## 4. Database as Coordination Layer

### 4.1 SQLite with WAL Mode as a Task Queue

SQLite in WAL (Write-Ahead Logging) mode allows one writer and multiple concurrent readers without blocking:

```sql
-- Enable WAL mode (set once per database)
PRAGMA journal_mode=WAL;

-- Task queue table
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, claimed, done, failed
    claimed_by TEXT,                          -- agent identifier
    claimed_at TEXT,                          -- ISO-8601 timestamp
    heartbeat_at TEXT,                        -- last heartbeat
    unit TEXT,
    priority INTEGER DEFAULT 0
);

-- Atomic claim (SQLite serializes writes via WAL)
UPDATE task_queue
SET status = 'claimed',
    claimed_by = 'agent-3',
    claimed_at = datetime('now'),
    heartbeat_at = datetime('now')
WHERE id = (
    SELECT id FROM task_queue
    WHERE status = 'pending'
    ORDER BY priority DESC, rowid ASC
    LIMIT 1
)
AND status = 'pending';  -- optimistic check

-- Check if we won the claim
SELECT changes();  -- returns 1 if we won, 0 if another agent beat us
```

SQLite's WAL mode guarantees that concurrent writers are serialized. The `AND status = 'pending'` in the WHERE clause implements optimistic locking — only one agent can succeed for any given row.

**Downside:** SQLite is a file-based database. Concurrent writes from 7 agents will see write serialization — this is fine for task claiming (infrequent) but bad for heartbeats (frequent writes from all agents simultaneously). Consider WAL mode + a longer heartbeat interval (30s).

### 4.2 PostgreSQL Advisory Locks

This project already has PostgreSQL running. Advisory locks are session-scoped, released automatically on disconnect (agent crash), and require no schema changes:

```sql
-- Try to acquire a lock for a specific task (non-blocking)
-- hashtext() converts any string to an integer suitable for advisory lock
SELECT pg_try_advisory_lock(hashtext('task:DD-06-009'));
-- Returns TRUE if acquired, FALSE if another session holds it

-- Release the lock
SELECT pg_advisory_unlock(hashtext('task:DD-06-009'));

-- Block until lock is available (use in scripts that can wait)
SELECT pg_advisory_lock(hashtext('task:DD-06-009'));

-- Check who holds locks (for debugging)
SELECT
    pid,
    locktype,
    classid,
    objid,
    granted
FROM pg_locks
WHERE locktype = 'advisory';
```

**Full agent claim flow using PostgreSQL:**

```bash
claim_task_postgres() {
    local task_id="$1"
    local agent_id="$2"
    local DB="postgresql://localhost/io_ops"

    # Try advisory lock
    local got_lock
    got_lock=$(psql "$DB" -tAq -c \
        "SELECT pg_try_advisory_lock(hashtext('task:${task_id}'))")

    if [ "$got_lock" != "t" ]; then
        return 1  # another agent has it
    fi

    # Lock acquired — update task status in app table
    psql "$DB" -c "
        UPDATE tasks SET status='implementing', agent_id='${agent_id}', started_at=now()
        WHERE id='${task_id}' AND status='pending'
    "

    # Lock held for remainder of session. Agent death = connection close = lock released.
    # Note: we do NOT explicitly release here; it stays for the process lifetime.
}
```

**Key advantage:** PostgreSQL advisory locks are automatically released when the backend connection drops (i.e., the agent process dies). There is NO zombie lock from a dead agent. This is the strongest staleness guarantee available.

**Key disadvantage:** Requires all agents to maintain a PostgreSQL connection. If the agent is a Claude Code subprocess that runs and exits, the advisory lock is released on exit. This is fine if you model the lock as: "hold the lock for the duration of the agent process."

### 4.3 SKIP LOCKED Pattern for Work Queues

PostgreSQL 9.5+ supports `SKIP LOCKED`, which allows multiple workers to pull from a queue without competing:

```sql
-- Schema
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    unit TEXT,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Each agent runs this atomically to claim one task
BEGIN;
SELECT id, unit
FROM task_queue
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;

-- If a row was returned, claim it
UPDATE task_queue SET status='claimed', claimed_at=now(), agent_id=$1
WHERE id=$claimed_id;
COMMIT;
```

`FOR UPDATE SKIP LOCKED` means: lock the row for update, but if any row is already locked, skip it and try the next one. This gives O(1) claim operations even with 7 concurrent agents — no waiting, no spinning.

**This is the gold standard for work queues with multiple workers.** Each `BEGIN`/`COMMIT` pair is atomic. Two agents cannot claim the same task. Crashed agents can be detected by heartbeat timeout (their row stays `claimed` but heartbeat goes stale).

```bash
# Full bash implementation of SKIP LOCKED claim
claim_next_task() {
    local agent_id="$1"
    local DB="postgresql://localhost/io_ops"

    psql "$DB" -tAq <<SQL
BEGIN;
WITH claimed AS (
    SELECT id, unit
    FROM task_queue
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE task_queue t
SET status = 'claimed',
    claimed_by = '${agent_id}',
    claimed_at = now(),
    heartbeat_at = now()
FROM claimed
WHERE t.id = claimed.id
RETURNING t.id, t.unit;
COMMIT;
SQL
}
```

### 4.4 Using the Existing PostgreSQL as Coordination Layer

The I/O project has PostgreSQL running as its primary database. Using it for agent coordination requires:

1. A `agent_tasks` or `task_queue` table (separate from the application schema, or in a `coordination` schema)
2. Each agent connects as a service user with narrow permissions
3. Advisory locks for fast mutual exclusion without schema changes

**Recommended minimal schema:**
```sql
CREATE SCHEMA IF NOT EXISTS coordination;

CREATE TABLE coordination.agent_tasks (
    task_id     TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'pending',
    agent_id    TEXT,
    claimed_at  TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result      TEXT,  -- 'ok', 'failed', 'needs_input'
    notes       TEXT
);

CREATE INDEX ON coordination.agent_tasks(status, claimed_at);
```

**Pros of using existing PostgreSQL:**
- Zero additional infrastructure
- Advisory locks auto-release on crash
- Full ACID guarantees for status updates
- Queryable for dashboards and status checks

**Cons:**
- Adds a hard dependency: agents fail if PostgreSQL is down
- Requires a connection string and credentials in every agent environment
- Schema migrations must be coordinated with application migrations

---

## 5. Crash Recovery and Zombie Agent Detection

### 5.1 Detection Timeout and Heartbeat Files

A crashed agent leaves its task in `implementing` status with no further updates. Detection requires a liveness signal.

**Heartbeat file approach:**
```bash
# Agent writes its heartbeat every 30 seconds in background
start_heartbeat() {
    local hb_file="$1"
    local interval="${2:-30}"
    (
        while true; do
            date -Iseconds > "$hb_file" 2>/dev/null
            sleep "$interval"
        done
    ) &
    HEARTBEAT_PID=$!
    echo "$HEARTBEAT_PID" > "${hb_file}.hb_pid"
    trap 'kill $HEARTBEAT_PID 2>/dev/null; rm -f "$hb_file" "${hb_file}.hb_pid"' EXIT
}

# Watchdog checks heartbeats
check_heartbeats() {
    local stale_threshold=120  # 2 minutes without heartbeat = dead
    for hb_file in /tmp/io-agent-*.heartbeat; do
        [ -f "$hb_file" ] || continue
        local last_beat
        last_beat=$(cat "$hb_file")
        local last_epoch
        last_epoch=$(date -d "$last_beat" +%s 2>/dev/null || echo 0)
        local now
        now=$(date +%s)
        if [ $((now - last_epoch)) -gt $stale_threshold ]; then
            local task_id
            task_id=$(basename "$hb_file" | sed 's/io-agent-\(.*\)\.heartbeat/\1/')
            echo "STALE: task ${task_id} heartbeat is $((now - last_epoch))s old. Releasing claim."
            release_stale_task "$task_id"
            rm -f "$hb_file"
        fi
    done
}
```

**Heartbeat in PostgreSQL:**
```sql
-- Agent updates its own row every 30 seconds
UPDATE coordination.agent_tasks
SET heartbeat_at = now()
WHERE task_id = $1;

-- Watchdog query: find tasks with stale heartbeats
SELECT task_id, agent_id, heartbeat_at
FROM coordination.agent_tasks
WHERE status = 'claimed'
  AND heartbeat_at < now() - interval '2 minutes';
```

### 5.2 Process Group Management

Claude Code agent processes may spawn child processes (cargo build, pnpm build, git). Killing just the top-level agent leaves orphans running.

**Use process groups:**
```bash
# Launch agent in its own process group
# setsid creates a new session (and process group)
setsid claude --agent implement-agent "TASK_ID: ${TASK_ID}" &
AGENT_PID=$!

# Store the PGID (same as PID for setsid)
echo "$AGENT_PID" > "/tmp/io-agent-${TASK_ID}.pgid"

# Kill the entire process group tree
kill_agent() {
    local task_id="$1"
    local pgid_file="/tmp/io-agent-${task_id}.pgid"
    if [ -f "$pgid_file" ]; then
        local pgid
        pgid=$(cat "$pgid_file")
        kill -- -"$pgid" 2>/dev/null   # negative PID = kill process group
        rm -f "$pgid_file"
    fi
}
```

**Alternative: cgroups (Linux)**
```bash
# Create a cgroup for the agent
cgcreate -g memory,cpu:io-agent-${TASK_ID}
cgexec -g memory,cpu:io-agent-${TASK_ID} claude --agent implement-agent "TASK_ID: ${TASK_ID}" &

# Kill everything in the cgroup
cgdelete -r memory,cpu:io-agent-${TASK_ID}  # kills all processes first
```

Cgroups are more reliable than process groups for deeply-nested subprocess trees, but require root or cgroup delegation. Process groups are simpler and sufficient for most cases.

### 5.3 Orphaned Lock Cleanup

```bash
cleanup_orphaned_claims() {
    local registry="comms/AUDIT_PROGRESS.json"

    exec 9>/tmp/io-registry.lock
    flock -x 9

    # Find all claimed tasks and check if their agent is alive
    local tmp
    tmp=$(mktemp)

    python3 - "$registry" <<'EOF'
import json, os, sys

registry_path = sys.argv[1]
with open(registry_path) as f:
    data = json.load(f)

changed = False
for task in data.get("task_registry", []):
    if task.get("status") != "implementing":
        continue
    pid = task.get("agent_pid")
    if pid is None:
        continue
    try:
        os.kill(int(pid), 0)  # check if process alive
        # alive — leave it
    except OSError:
        # dead — release
        print(f"Releasing orphaned claim: {task['id']} (agent PID {pid} is dead)")
        task["status"] = "pending"
        task.pop("agent_pid", None)
        task.pop("claimed_by", None)
        task.pop("claimed_at", None)
        changed = True

if changed:
    with open(registry_path + ".tmp", "w") as f:
        json.dump(data, f, indent=2)
    os.rename(registry_path + ".tmp", registry_path)
EOF

    flock -u 9
}
```

**When to run cleanup:** At orchestrator startup, and periodically (e.g., every 5 minutes via a watchdog loop).

### 5.4 Compound Crash Scenario: Multiple Simultaneous Deaths

If 3 agents crash at once and the watchdog runs cleanup_orphaned_claims, the `python3` script handles all of them in one locked transaction — no partial releases.

But: if the watchdog itself crashes during cleanup, the JSON file may be partially written. The `mv`-based write (writing to `.tmp` then renaming) ensures either the old file or the new file is visible — never a partial write.

---

## 6. Git-Based Parallelism Strategies

### 6.1 Branch-Per-Task Strategy

Each agent creates its own branch before making any changes:

```bash
# Agent startup
BRANCH="agent/${TASK_ID}-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH"

# ... do all work and commit on this branch ...

git add -p   # or git add specific files
git commit -m "implement: ${TASK_ID} — ${DESCRIPTION}"

# Signal orchestrator: branch is ready
echo "$BRANCH" > "/tmp/io-ready-${TASK_ID}.branch"
```

**Orchestrator merges completed branches:**
```bash
merge_completed_branches() {
    for branch_file in /tmp/io-ready-*.branch; do
        [ -f "$branch_file" ] || continue
        local branch
        branch=$(cat "$branch_file")
        local task_id
        task_id=$(basename "$branch_file" .branch | sed 's/io-ready-//')

        git checkout main
        if git merge --no-ff "$branch" -m "merge: ${task_id}"; then
            git branch -d "$branch"
            rm -f "$branch_file"
            echo "Merged ${task_id} successfully."
        else
            echo "CONFLICT merging ${task_id} — needs manual resolution."
            git merge --abort
            # Re-queue task or flag for human review
        fi
    done
}
```

### 6.2 Pros and Cons of Branch-Per-Task vs All-On-Main

**Branch-Per-Task:**

Pros:
- Complete isolation: no agent can corrupt another's working tree
- Merge conflicts are visible and addressable without blocking work
- Git history is clean: one branch per task, one merge commit per task
- Easy rollback: `git revert` the merge commit drops the entire task
- Agents can start immediately without waiting for others to commit
- `git stash` is never needed (each branch IS the stash)

Cons:
- Orchestrator must manage branch lifecycle (create, merge, delete)
- Merge conflicts on shared files still require human resolution
- Stale branches accumulate if agents crash before merging
- Rebase-based merges require linear history, which conflicts with parallel branch creation
- The working tree is single on a single machine — multiple agents cannot `git checkout` simultaneously without worktrees

**Critical realization: Git worktrees solve the working-tree problem**

Multiple agents cannot `git checkout` to different branches on the same working tree. Git worktrees create multiple working directories from the same repo:

```bash
# Create a worktree for each agent task
git worktree add /tmp/io-worktree-DD06009 -b agent/DD-06-009
git worktree add /tmp/io-worktree-DD10005 -b agent/DD-10-005

# Agent A works in /tmp/io-worktree-DD06009
# Agent B works in /tmp/io-worktree-DD10005
# No conflict — completely separate working trees, same git repo

# Cleanup when done
git worktree remove /tmp/io-worktree-DD06009
git branch -d agent/DD-06-009
```

The implement-agent definition already includes `isolation: worktree` — this is the correct approach.

### 6.3 Auto-Merge Strategies

**Rebase (cleanest history, most fragile for parallelism):**
```bash
git checkout main
git rebase agent/DD-06-009
# Fails if any commit touches the same file as a concurrent commit to main
```

**Merge commit (standard, records parallelism in history):**
```bash
git checkout main
git merge --no-ff agent/DD-06-009 -m "merge: DD-06-009"
# Preserves the branch topology — shows work happened in parallel
# Fails only if there are actual content conflicts
```

**Squash merge (clean main, loses granularity):**
```bash
git checkout main
git merge --squash agent/DD-06-009
git commit -m "implement: DD-06-009 — one-line summary"
# All commits from the branch collapsed to one
# Good for "implement" work; bad for audit trails
```

**Recommendation:** Use `--no-ff` merge for the primary merge strategy. Preserve the task branch in history. For additive changes to disjoint files (which is the common case when tasks are well-scoped), merge will succeed automatically. Only shared-file modifications cause conflicts.

### 6.4 Conflict Detection Before Commit

**Check for potential conflicts before launching an agent:**
```bash
would_conflict() {
    local task_branch="$1"
    local base_branch="${2:-main}"

    # Get the files this task's branch has modified
    local task_files
    task_files=$(git diff --name-only "$base_branch"..."$task_branch")

    # Get files modified by other pending task branches
    for other_branch in $(git branch --list 'agent/*' | grep -v "$task_branch"); do
        local other_files
        other_files=$(git diff --name-only "$base_branch"..."$other_branch")
        local intersection
        intersection=$(comm -12 \
            <(echo "$task_files" | sort) \
            <(echo "$other_files" | sort))
        if [ -n "$intersection" ]; then
            echo "CONFLICT: ${task_branch} and ${other_branch} both modify:"
            echo "$intersection"
            return 1
        fi
    done
    return 0
}
```

**Detect conflicts before merge attempt (safer):**
```bash
safe_merge() {
    local branch="$1"
    # Dry-run merge: if it would conflict, report without touching main
    git merge --no-commit --no-ff "$branch" 2>&1
    local result=$?
    git merge --abort 2>/dev/null
    return $result
}
```

---

## 7. Token / Context Considerations for Parallel Agents

### 7.1 Context Budget per Agent

Each Claude Code agent invocation gets its own context window. As of the Claude Sonnet 4.x family, the context window is approximately 200K tokens. With 7 parallel agents:

- 7 × 200K = 1.4M total tokens in flight simultaneously
- Each agent's context is completely independent — no sharing between agents
- Token cost scales linearly with the number of agents

**Practical context budget breakdown for an implement agent:**
- System prompt + CLAUDE.md: ~8K tokens
- Task spec file: ~2-4K tokens
- Files read during implementation: ~20-80K tokens (varies enormously)
- Code written: ~5-30K tokens
- Conversation history (tool calls + results): ~20-60K tokens
- **Total per agent:** 55–182K tokens — within the 200K window for most tasks

**Agents that blow the context window:**
- Tasks requiring reading many large files (e.g., reading all 40 design-docs)
- Tasks where build errors generate multi-KB error outputs repeatedly
- Tasks with many failed attempts (history accumulates)

**Detection:** An agent that exceeds its context window will truncate earlier messages, potentially losing critical task spec details or prior error messages. This causes silent degradation, not a hard failure. The agent continues but may repeat mistakes it already made.

### 7.2 Context Isolation vs Context Sharing Tradeoffs

**Full isolation (current approach):**
- Each agent loads CLAUDE.md, spec docs, and task files independently
- No cross-contamination between agents
- Each agent can be killed without affecting others
- Simple mental model

**Shared context problems:**
- Not architecturally possible with separate CLI invocations — each `claude` process has its own context
- Would require a multi-agent framework with a shared memory layer (not available in claude CLI)

**What isolation costs:**
- Redundant file reads: if 7 agents all read `CLAUDE.md` and the same design-doc, that's 7× the I/O and token cost for shared background knowledge
- No learning transfer: if Agent A discovers a bug in a shared utility, Agent B will not know about it
- Inconsistent state: Agent A updates `AUDIT_PROGRESS.json`, Agent B has an older snapshot in context and may make decisions based on stale data

### 7.3 Context Injection at Agent Startup

Rather than letting agents discover context themselves (which causes redundant file reads and inconsistency), inject focused context at startup:

```bash
# Orchestrator prepares a context packet for each agent
prepare_agent_context() {
    local task_id="$1"
    local unit="$2"
    local context_file="/tmp/io-context-${task_id}.md"

    cat > "$context_file" <<EOF
## Agent Context Packet — $(date -Iseconds)

### Task
$(cat "docs/tasks/${unit}/${task_id}.md")

### Current Registry State (snapshot at dispatch time)
$(jq --arg id "$task_id" '.task_registry[] | select(.id==$id)' comms/AUDIT_PROGRESS.json)

### Files in Use by Other Agents
$(jq -r '.files_in_use // [] | .[] | .path' comms/AUDIT_PROGRESS.json)

### Prior Attempt Notes
$(cat "docs/state/${unit}/${task_id}/CURRENT.md" 2>/dev/null || echo "No prior attempts.")

### Known Shared File Conflicts to Avoid
$(cat /tmp/io-shared-files-in-use.txt 2>/dev/null || echo "None.")
EOF

    echo "$context_file"
}

# Launch agent with injected context
context_file=$(prepare_agent_context "$TASK_ID" "$UNIT")
claude --agent implement-agent < "$context_file" &
```

**What to inject vs what to let agents discover:**

| Information | Inject | Discover |
|-------------|--------|----------|
| Task spec (exact task requirements) | Yes | No (too important to miss) |
| Current registry status | Yes | No (stale by the time agent reads it) |
| Files in use by other agents | Yes | No |
| Prior attempt notes | Yes | No |
| Design-doc content | No | Yes (agent reads what it needs) |
| Source code files to modify | No | Yes (agent explores) |
| Build/lint results | No | Yes (agent runs them) |

### 7.4 Context Staleness in Long-Running Parallel Sessions

With 7 agents each running for 5-20 minutes, the state of `AUDIT_PROGRESS.json` in any agent's context becomes stale. An agent that read the registry at startup will make decisions based on a snapshot that is N minutes old.

**Mitigation:** Agents should always re-read `AUDIT_PROGRESS.json` immediately before any write operation (not rely on their cached copy). The locking protocol ensures reads inside the lock are always current.

**Failure to do this causes:**
- Agent claims a task that another agent just completed ("it was pending when I started")
- Agent writes stale status to registry, overwriting a more recent update

**In the implement-agent protocol (E3 — Read CURRENT.md and check for active claim):** this step re-reads the CURRENT.md file before proceeding, which partially mitigates staleness. But it does not re-read the full registry — only the task-specific state file.

---

## 8. Synthesis: Recommended Architecture for This Project

### 8.1 What to Build

The I/O project's agent infrastructure (`io-run.sh`, `AUDIT_PROGRESS.json`, implement-agent) is already well-structured for sequential operation. Moving to parallel operation requires these additions:

**Layer 1: Task Claim Lock (per-task, per-registry write)**
Use `flock` on a single registry lock file for all registry writes. The critical section is fast (JSON read-modify-write). Even with 7 agents competing, wait times will be milliseconds.

```bash
REGISTRY_LOCK="/tmp/io-registry.lock"
```

**Layer 2: Git Worktrees for Working Tree Isolation**
The `implement-agent` already declares `isolation: worktree`. Ensure the orchestrator creates a worktree for each agent in a deterministic path:

```bash
WORKTREE_PATH="/tmp/io-worktree-${TASK_ID}"
git worktree add "$WORKTREE_PATH" -b "agent/${TASK_ID}"
```

**Layer 3: Agent PID Tracking + Heartbeat**
Store agent PID in `AUDIT_PROGRESS.json` when claiming a task. Run a lightweight watchdog (every 60s) that checks if claiming PIDs are alive and releases stale claims.

**Layer 4: Shared File Registry (simple unit-level lock)**
Rather than tracking individual files, forbid two agents from working on the same unit simultaneously. This eliminates 90% of shared-file conflicts with minimal bookkeeping:

```bash
# In registry: one entry per unit
"units_in_progress": ["dd-06", "dd-10"]

# Claiming logic: task's unit must not be in units_in_progress
```

**Layer 5: PostgreSQL Advisory Locks (optional, for robustness)**
If the project wants bulletproof crash recovery, use PostgreSQL advisory locks as the claim mechanism. This gives automatic release on agent death, ACID guarantees, and zero zombie claims. The project already runs PostgreSQL.

### 8.2 The Concrete Failure Matrix

| Scenario | Consequence | Mitigation |
|----------|-------------|------------|
| Two agents claim same task | Duplicate work, file corruption | Per-task flock on registry write |
| Agent crashes with lock held (flock) | No zombie — kernel releases flock | Inherent in flock design |
| Agent crashes with mkdir claim | Zombie claim directory | Watchdog + PID staleness check |
| Agent crashes with advisory lock | No zombie — PostgreSQL releases on disconnect | Inherent in advisory lock design |
| Two agents modify same file (no branch) | Last-write-wins corruption | Unit-level exclusion OR branch-per-task |
| Git commit race on main | One commit orphaned silently | Branch-per-task + sequential merge |
| Context staleness causes stale write | Registry corruption | Always re-read inside lock before write |
| Heartbeat file grows unboundedly | Disk pressure | Single-line overwrite (not append) |
| 7 agents all `cargo build` simultaneously | CPU/RAM saturation | Build lock: only one `cargo build` at a time |
| `pnpm build` concurrently | pnpm cache corruption | pnpm store lock (pnpm handles this internally) |
| Git worktree cleanup after crash | Orphaned worktrees | `git worktree prune` at orchestrator startup |

### 8.3 `cargo build` Concurrency Warning

This is a non-obvious hazard: `cargo` uses a per-workspace file lock (`.cargo-lock` or via `cargo`'s own locking in the target directory). Multiple concurrent `cargo build` invocations for the same workspace will serialize automatically — the second will wait for the first. This is safe but not parallel. Mitigation: do not run `cargo build` from within each agent's task. Instead, run a single `cargo build` in the main tree after all agents complete.

For frontend (`pnpm build`), pnpm uses a content-addressable store and per-project locking. Multiple `pnpm build` invocations in different project directories should not conflict, but they share the store cache — high I/O contention is possible.

### 8.4 Minimum Viable Parallel Protocol for This Project

Given the existing infrastructure, the minimum-viable change to support safe parallel agents:

1. **Remove the global `flock -n` in `io-run.sh`** that prevents all parallel invocations.
2. **Add per-task claiming with flock** in the orchestrator before launching each agent.
3. **Add unit-level exclusion** (`units_in_progress` set in `AUDIT_PROGRESS.json`) to prevent same-unit collisions.
4. **Use git worktrees** for each agent (already declared in implement-agent).
5. **Add a post-completion merge step** in the orchestrator that merges agent worktree branches back to main sequentially.
6. **Add `agent_pid` to claiming metadata** and run cleanup at orchestrator startup.
7. **Ensure all registry writes use the mv-based pattern** — no direct overwrites.

These 7 changes transform the sequential pipeline into a parallel one with acceptable safety guarantees for up to 7 agents working on disjoint units.

---

## Appendix A: Quick Reference — Atomic Operations

```bash
# SAFE atomic write
tmp=$(mktemp "$(dirname "$file")/tmp.XXXXXXXX")
jq '...' "$file" > "$tmp" && mv "$tmp" "$file"

# SAFE atomic claim
mkdir "$CLAIM_DIR" 2>/dev/null && echo $$ > "$CLAIM_DIR/pid"

# SAFE exclusive lock
exec 9>"$LOCK_FILE"
flock -x [-n|-w SECS] 9
# ... critical section ...
flock -u 9

# SAFE git worktree
git worktree add /tmp/io-wt-${TASK_ID} -b "agent/${TASK_ID}"
# ... work ...
git worktree remove /tmp/io-wt-${TASK_ID} --force

# SAFE PostgreSQL claim
psql $DB -c "SELECT pg_try_advisory_lock(hashtext('task:${TASK_ID}'))"
```

## Appendix B: Quick Reference — Failure Detection

```bash
# Is a process alive? (with PID-reuse detection)
is_alive() {
    local pid="$1" start_jiffies="$2"
    kill -0 "$pid" 2>/dev/null || return 1
    [ -z "$start_jiffies" ] && return 0
    local actual; actual=$(awk '{print $22}' /proc/"$pid"/stat 2>/dev/null)
    [ "$actual" = "$start_jiffies" ]
}

# Staleness from heartbeat file
is_heartbeat_stale() {
    local hb_file="$1" threshold="${2:-120}"
    local last; last=$(date -d "$(cat "$hb_file" 2>/dev/null || echo '1970-01-01')" +%s 2>/dev/null || echo 0)
    [ $(( $(date +%s) - last )) -gt "$threshold" ]
}
```

## Appendix C: PostgreSQL Advisory Lock Reference

```sql
-- Non-blocking try (returns bool)
SELECT pg_try_advisory_lock(hashtext('task:DD-06-009'));
SELECT pg_try_advisory_lock(hashtext('task:DD-06-009'), 1);  -- with subkey

-- Blocking acquire
SELECT pg_advisory_lock(hashtext('task:DD-06-009'));

-- Release
SELECT pg_advisory_unlock(hashtext('task:DD-06-009'));
SELECT pg_advisory_unlock_all();  -- release all in session

-- Inspect current locks
SELECT pid, locktype, classid, objid, granted
FROM pg_locks WHERE locktype = 'advisory';

-- SKIP LOCKED work queue
BEGIN;
SELECT id FROM work_queue WHERE status='pending' FOR UPDATE SKIP LOCKED LIMIT 1;
-- use returned id
UPDATE work_queue SET status='claimed' WHERE id=$1;
COMMIT;
```

---

*Research complete. All findings are grounded in POSIX/Linux behavior, PostgreSQL documentation, and direct analysis of the I/O project's existing infrastructure.*
