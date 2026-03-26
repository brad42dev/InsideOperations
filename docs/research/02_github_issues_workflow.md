# Research: GitHub Issues as AI Agent Task Queue

**Date:** 2026-03-25
**Context:** Evaluating whether to replace `AUDIT_PROGRESS.json` + `docs/tasks/*.md` + `io-run.sh` with GitHub Issues as the task management backend for the Claude Code agent pipeline.

**Current system:** 408-task JSON registry, local `.md` spec files per task, bash orchestrator, multiple Claude Code agents reading/writing flat files directly.

---

## 1. GitHub Issues as a Task Queue

### Basic mechanics

`gh issue list` supports label, assignee, milestone, and state filters, and can emit JSON:

```bash
# Get pending tasks for a specific unit, JSON output
gh issue list \
  --label "status:pending" \
  --label "unit:DD-06" \
  --state open \
  --limit 100 \
  --json number,title,labels,assignees,body

# Get all pending tasks across all units
gh issue list \
  --label "status:pending" \
  --state open \
  --limit 100 \
  --json number,title,labels
```

Multiple `--label` flags use **AND logic** — the issue must carry all specified labels. This is the correct behavior for filtering: `status:pending` AND `unit:DD-06` returns only issues matching both. This works.

### Field mapping from current task registry

Current task fields and their GitHub Issues equivalents:

| Current field | GitHub Issues mapping | Notes |
|---|---|---|
| `id` (e.g. `DD-06-003`) | Issue title prefix OR label `id:DD-06-003` | Titles are queryable; label per-ID is impractical at 408 scale |
| `unit` | Label `unit:DD-06` | One label per issue |
| `wave` | Label `wave:3` OR milestone | Milestone per wave is cleaner |
| `status` | Label `status:pending`, `status:implementing`, `status:verified`, `status:failed` | State transitions via `gh issue edit --add-label / --remove-label` |
| `uat_status` | Label `uat:pass`, `uat:fail`, `uat:partial`, `uat:pending` | Same label pattern |
| `priority` | Label `priority:high`, `priority:medium`, `priority:low` | Direct mapping |
| `source` | Label `source:uat`, `source:feature`, `source:audit` | Direct mapping |
| `depends_on` | Issue body (JSON block) | No native dependency field in GitHub Issues |
| `audit_round` | Issue body (JSON block) | No native field |
| `title` | Issue title | Direct |
| Task spec body (1–5 KB markdown) | Issue body | See §3 |

**State transitions** work via label swap:

```bash
# Claim a task: change status:pending → status:implementing, assign to bot
gh issue edit 42 \
  --remove-label "status:pending" \
  --add-label "status:implementing" \
  --add-assignee "io-agent-bot"

# Mark verified:
gh issue edit 42 \
  --remove-label "status:implementing" \
  --add-label "status:verified" \
  --remove-assignee "io-agent-bot"
```

**Issue comments as work log:** Yes. Each agent run appends a comment via `gh issue comment 42 --body "..."`. This is append-only by design — comments cannot be edited by a different author, and the audit trail is permanent. This maps cleanly to the current attempt log pattern.

---

## 2. Concurrency and Conflict Prevention

### The core problem

GitHub Issues have no native atomic claim operation. The REST API has no `compareAndSwap`, no `SELECT FOR UPDATE`, no conditional update. The claim sequence is:

```
GET  issue (read status:pending)
PATCH issue (set status:implementing, set assignee)
```

These are two separate HTTP calls. Two agents can both read the same issue as `status:pending` and both attempt to claim it. GitHub will accept both `PATCH` calls and both will succeed — the second write wins on assignee, but both agents think they own the task.

### Workaround approaches teams use

**1. Assignee as a soft lock**

```bash
# Agent reads issues with status:pending AND no assignee
gh issue list \
  --label "status:pending" \
  --assignee "none" \
  --limit 1 \
  --json number

# Agent immediately assigns itself
gh issue edit $NUMBER --add-assignee "@me" --add-label "status:implementing" --remove-label "status:pending"
```

The window between the list and the edit is the race condition window. For agents running every few minutes with human-observable task granularity (tasks take 10–60 minutes each), this is a low-probability problem. But it is not zero.

**2. Conditional claim via issue body checksum**

Not natively supported. GitHub has no `If-Match` style conditional update for issue metadata.

**3. Single orchestrator, no parallelism**

The current `io-run.sh` already enforces single-execution via `flock`. If you keep that design (one agent at a time), the race condition doesn't exist. Multiple concurrent agents would require an external lock anyway.

**4. GitHub Actions concurrency groups**

If agents run as GitHub Actions workflows, the `concurrency:` field prevents two runs of the same workflow from executing simultaneously:

```yaml
concurrency:
  group: io-agent-implement
  cancel-in-progress: false  # queue, don't cancel
```

This moves locking into the CI layer. But `cancel-in-progress: false` queues runs — it doesn't guarantee FIFO order.

### Rate limits

| Limit | Value |
|---|---|
| REST API (authenticated PAT) | 5,000 requests/hour |
| REST POST/PATCH/DELETE | 5 points each (secondary: 900 points/minute) |
| Content creation (comments, issues) | 80/minute, 500/hour |
| Search API | 30 requests/minute |
| Concurrent requests | 100 max |

**For this project's scale (408 tasks):**
- Bulk creation of 408 issues: at 1 request/second, ~7 minutes. Hits content-creation limit at 80/min — need to throttle to 60/min to be safe. Realistically takes 8–10 minutes.
- Per-task operations (claim + 1-2 comments + resolve): ~4 API calls per task. At 408 tasks: ~1,632 API calls. Well within hourly limits.
- Status queries (polling for next task): 1 call per agent loop iteration. At 1 per minute: 60/hour. Trivial.

Rate limits are not a blocker for this scale.

### Stale claim recovery

If an agent crashes mid-task, the issue stays `status:implementing` with the agent assigned indefinitely. Recovery options:

**Option A: Timeout-based watchdog**

```bash
# Find issues implementing for >30 minutes with no recent comment
# Requires querying comments per-issue — expensive at scale
gh api repos/OWNER/REPO/issues \
  --jq '.[] | select(.labels[].name == "status:implementing")'
# Then check updated_at timestamp against a threshold
```

**Option B: Heartbeat comments**

Agent posts a comment every N minutes while working. Watchdog detects issues where the last comment from the agent is older than the timeout threshold. Requires O(N open tasks) API calls to check.

**Option C: Accept orphan risk**

If only one agent runs at a time (current design), crashes are detected by the orchestrator on next startup — it checks for `status:implementing` with no active process and resets to `status:pending`. This already happens in the current JSON-based system.

**Verdict:** Stale claim detection requires either a heartbeat pattern (additional complexity + API calls) or accepting a manual reset step. The current JSON system has the same problem and handles it via orchestrator restart.

---

## 3. Context Storage in Issues

### Size limits

GitHub's documented character limits for issue bodies and comments are **not published in the official API documentation**. From real-world experience and community findings:

- Issue body: ~65,536 characters (64 KB) soft limit; the web UI accepts up to 1,000,000 characters in practice
- Comment body: same ~65,536 character limit documented in community reports
- Title: 256 characters max

**For this project's task spec files:** The sample task spec (`DD-06-001`) is approximately 1,800 characters. Even a large task spec is under 5 KB. Storing task specs in issue bodies is fully feasible — these are nowhere near any limit.

### Structured data in issue bodies

Yes. Store JSON in a fenced code block:

```markdown
## Metadata

```json
{
  "id": "DD-06-003",
  "unit": "DD-06",
  "wave": 3,
  "depends_on": ["DD-06-001"],
  "audit_round": 2,
  "source": "audit"
}
```

## What This Feature Should Do

[spec text here...]
```

Agents extract metadata by parsing the issue body for the JSON block. This is straightforward with any JSON parser. The human-readable spec text follows below it.

### Issue comments as attempt history

Each agent run appends a timestamped comment:

```bash
gh issue comment $NUMBER --body "$(cat <<EOF
**Attempt #2 — $(date -u +%Y-%m-%dT%H:%M:%SZ)**
Agent: io-implement-agent
Result: PARTIAL — test suite passes, integration test failing on \`expect(x).toBe(y)\`
Next: investigate mock setup in test harness
EOF
)"
```

This creates a permanent, ordered audit trail per task. It directly replaces the `task_attempts` counter and local attempt log files. This is actually better than the current system — comments are durable and human-readable in the GitHub UI without additional tooling.

---

## 4. GitHub Projects v2 as Kanban Board

### Capabilities

Projects v2 supports custom fields including single-select fields (up to 50 options each) and status fields with up to 50 named options. Items can be programmatically moved between columns via GraphQL:

```bash
# Move item to "In Progress" column
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PROJECT_ID"
    itemId: "ITEM_ID"
    fieldId: "STATUS_FIELD_ID"
    value: { singleSelectOptionId: "IN_PROGRESS_OPTION_ID" }
  }) {
    projectV2Item { id }
  }
}'
```

### Practical value for this project

**Positive:** The Projects v2 board gives humans a visual view of the pipeline — which tasks are pending, implementing, verified — without reading JSON files. This is a genuine UX improvement.

**Negative:** Projects v2 requires GraphQL, not REST. The `gh` CLI supports it but the syntax is verbose. Every card move is a multi-step operation: find the item ID, find the field ID, find the option ID, then update. There is no simple `gh project item move` command with human-readable column names.

**Verdict:** Projects v2 is useful as a read-only dashboard for humans but adds operational complexity for agents. If you use GitHub Issues, add Projects v2 for human visibility — but don't let agents drive through it.

### Webhook-driven workflows

GitHub can trigger workflows on `issues.labeled`, `issues.assigned`, `issues.commented` events. This enables event-driven agent invocation instead of polling:

```yaml
on:
  issues:
    types: [labeled]

jobs:
  implement:
    if: contains(github.event.label.name, 'status:pending')
    runs-on: ubuntu-latest
    steps:
      - run: claude --agent implement-agent --print "${{ github.event.issue.number }}"
```

This is architecturally clean. However, it requires agents to run inside GitHub Actions, which has cost implications for private repos (see §5).

---

## 5. Practical Concerns

### Bulk migration: 408 issues from JSON

```bash
# Script skeleton — requires gh CLI and jq
python3 - <<'PYEOF'
import json, subprocess, time

with open("comms/AUDIT_PROGRESS.json") as f:
    data = json.load(f)

for task in data["task_registry"]:
    labels = [
        f"unit:{task['unit']}",
        f"wave:{task.get('wave', 0)}",
        f"status:{task['status']}",
        f"priority:{task.get('priority', 'medium')}",
    ]
    if task.get("source"):
        labels.append(f"source:{task['source']}")
    if task.get("uat_status"):
        labels.append(f"uat:{task['uat_status']}")

    # Read spec file if it exists
    spec_path = f"docs/tasks/{task['unit'].lower()}/{task['id']}-*.md"
    import glob
    spec_files = glob.glob(spec_path)
    body = spec_files[0] if spec_files else ""
    if body:
        with open(body) as bf:
            body_content = bf.read()
    else:
        body_content = f"<!-- no spec file found for {task['id']} -->"

    # Prepend JSON metadata block
    metadata = json.dumps({k: task[k] for k in ["id","unit","wave","depends_on","audit_round","source"] if k in task}, indent=2)
    full_body = f"```json\n{metadata}\n```\n\n{body_content}"

    cmd = [
        "gh", "issue", "create",
        "--title", f"[{task['id']}] {task['title']}",
        "--body", full_body,
    ] + [arg for label in labels for arg in ["--label", label]]

    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"{task['id']}: {result.stdout.strip() or result.stderr.strip()}")
    time.sleep(1)  # Stay under content creation rate limit (60/min)
PYEOF
```

**Time estimate:** 408 tasks × 1 second/request = ~7 minutes. Safe under the 80 requests/minute content creation limit.

**Pre-requisites:** Create all labels before bulk import:

```bash
# Create all labels first
for label in \
  "status:pending" "status:implementing" "status:verified" "status:failed" "status:escalated" \
  "priority:high" "priority:medium" "priority:low" \
  "uat:pass" "uat:fail" "uat:partial" "uat:pending" \
  "wave:0" "wave:1" "wave:2" "wave:3" "wave:4" \
  "source:audit" "source:uat" "source:feature" \
  "unit:DD-06" "unit:DD-10" "unit:GFX-CORE" # etc.
do
  gh label create "$label" --color "$(printf '%06x' $RANDOM)" || true
done
```

### Search/filter performance

Filtering 408 issues by two labels (`status:pending` AND `unit:DD-06`) uses the REST list endpoint, not the search endpoint. The REST list endpoint has a 5,000/hour limit — not the search endpoint's 30/minute limit. Pagination at 100 results/page means worst case 5 API calls to scan all issues. At project scale this is fast.

However: **gh issue list with multiple labels uses AND logic** — issues must have all specified labels. This is what you want. The behavior is correct.

### 409+ issues in a single repo: UX impact for humans

**Honest assessment:** It is noisy. A repo with 400+ issues, most of them closed (verified), creates several problems:
- GitHub's issue list UI is paginated at 25–30 items. 400 items means many pages.
- The repo's issue count badge shows 400+ open items (or however many remain open), which looks alarming.
- Search in the GitHub UI works fine but requires knowing label names.
- For this project, most tasks are already `verified` — they should be closed issues. Only `pending` and `failed` tasks need to be open. At any given time, that's a much smaller set (currently 1 pending).

**Mitigation:** Use GitHub Issues open/closed state to mirror task status. `verified` → closed issue. `pending`/`implementing`/`failed` → open issue. This reduces UI noise dramatically.

### Private vs public repo

The project is already private (`git@github.com:brad42dev/InsideOperations.git`). Task specs can include implementation details, security-relevant fixes, and internal architectural notes. Keep it private. GitHub Issues on a private repo are not indexed by search engines.

### GitHub Actions cost (if using webhook-driven agents)

If Claude Code agents run inside GitHub Actions on a private repo:

- Free plan: 2,000 minutes/month of Linux runner time
- Pro plan: 3,000 minutes/month
- Linux runner: $0.006/minute for overages

A single agent invocation (Claude Code implementing one task) takes roughly 10–30 minutes of wall-clock time, most of which is idle waiting for Claude's API responses. GitHub Actions charges for wall-clock time, not CPU time. At 30 min/task, 2,000 free minutes = ~66 tasks/month before overage. At current project pace, this exhausts the free tier quickly.

**If agents run on the build server (current model) and just use GitHub Issues as data store:** Cost is zero. The GitHub API calls are free. Actions minutes are only consumed if you trigger actual GitHub Actions workflows.

---

## 6. Alternatives to GitHub Issues

### Linear.app API

Linear is a purpose-built issue tracker used heavily in software companies. Key characteristics:

- GraphQL API with strong typing (TypeScript SDK available)
- Webhooks on state changes
- Native workflow states (not just labels) — states have defined order
- Rate limits not publicly documented but in practice generous
- No native atomic claim — same race condition problem as GitHub Issues
- **Cost:** Not free. Linear pricing starts at ~$8/user/month. For a single-user project, the Free tier allows 250 issues lifetime. 408 tasks exceeds the free tier.

**Verdict for this project:** Paid tier required. Adds external dependency and cost. Not recommended.

### Jira API

Jira is the incumbent enterprise issue tracker.

- REST API with comprehensive field support
- Workflow states with transition rules (proper state machine)
- Webhooks available
- JQL (Jira Query Language) for complex filtering
- **Cost:** Jira Cloud free plan allows 10 users and unlimited issues. Technically free for a single-user project.
- No atomic claim mechanism either

**Verdict:** JQL is genuinely powerful and Jira's workflow states are a better model than label-based state machines. But the operational overhead (separate service, separate auth, JIRA-flavored API) adds significant complexity. For a solo AI-driven project, this is overkill.

### SQLite as task queue

The project build server already has SQLite available (standard Linux install).

```sql
-- Schema
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    unit TEXT NOT NULL,
    wave INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    uat_status TEXT,
    source TEXT,
    depends_on TEXT,  -- JSON array
    audit_round INTEGER,
    claimed_at TEXT,  -- ISO timestamp or NULL
    claimed_by TEXT,  -- agent name or NULL
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE task_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT REFERENCES tasks(id),
    attempt_number INTEGER,
    started_at TEXT,
    result TEXT,
    notes TEXT
);

-- Atomic claim (single writer, WAL mode)
PRAGMA journal_mode = WAL;
BEGIN IMMEDIATE;
SELECT id FROM tasks
WHERE status = 'pending'
  AND (depends_on = '[]' OR depends_on IS NULL)
ORDER BY wave ASC, priority DESC
LIMIT 1;
-- (application reads result, then:)
UPDATE tasks SET status = 'implementing', claimed_at = datetime('now'), claimed_by = 'agent-1'
WHERE id = '<result from above>';
COMMIT;
```

**Atomicity:** SQLite `BEGIN IMMEDIATE` acquires a write lock at transaction start. No other writer can enter until commit. This is a genuine atomic claim — the race condition that exists with GitHub Issues does not exist here.

**Single writer limitation:** WAL mode allows concurrent readers but only one writer at a time. For the current single-agent model, this is not a limitation. For concurrent agents, writes queue up and execute serially — correct but potentially slow under high concurrency.

**Crash recovery:** Set `PRAGMA synchronous = FULL` and `PRAGMA journal_mode = WAL`. On crash, the WAL journal is replayed on next open. No data loss.

**No external dependency:** SQLite is a file. No network, no auth, no service to manage.

**Human visibility:** Requires a tool (sqlite3 CLI, DB Browser for SQLite) to inspect. Not as accessible as a web UI.

```bash
# Status check equivalent to current io-run.sh status
sqlite3 comms/tasks.db "
SELECT status, COUNT(*) FROM tasks GROUP BY status;
SELECT uat_status, COUNT(*) FROM tasks WHERE status='verified' GROUP BY uat_status;
"
```

**Verdict:** SQLite is a strict upgrade over the current JSON file for reliability and atomicity. It solves the one genuine problem with the current system (concurrent write corruption). Migration is a one-time Python script. No external dependencies, no cost, no rate limits.

### PostgreSQL as task queue

The project already runs PostgreSQL (Docker Compose for dev, native for demo server). PostgreSQL's `SELECT FOR UPDATE SKIP LOCKED` provides textbook atomic task claiming:

```sql
-- Schema (add to existing PG database)
CREATE TABLE io_tasks (
    id TEXT PRIMARY KEY,
    unit TEXT NOT NULL,
    wave INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    uat_status TEXT,
    source TEXT,
    depends_on TEXT[],
    audit_round INTEGER,
    spec_body TEXT,  -- full markdown task spec
    claimed_at TIMESTAMPTZ,
    claimed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE io_task_attempts (
    id SERIAL PRIMARY KEY,
    task_id TEXT REFERENCES io_tasks(id),
    attempt_number INTEGER,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    result TEXT,  -- 'pass'|'fail'|'partial'
    notes TEXT
);

-- Atomic claim — multiple concurrent workers safe
BEGIN;
SELECT id, title, spec_body
FROM io_tasks
WHERE status = 'pending'
  AND (depends_on = '{}' OR depends_on IS NULL)
ORDER BY wave ASC,
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE io_tasks SET status = 'implementing', claimed_at = NOW(), claimed_by = 'agent-1'
WHERE id = '<claimed id>';
COMMIT;
```

**SKIP LOCKED** is the key: if two workers run simultaneously, each sees a different row — the first worker's lock causes the second to skip that row and take the next available task. Zero race conditions.

**LISTEN/NOTIFY for push-based wake-up:**

```sql
-- Trigger fires when a new task is inserted or status resets to pending
CREATE OR REPLACE FUNCTION notify_pending_task() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM pg_notify('task_pending', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER io_task_status_change
  AFTER INSERT OR UPDATE OF status ON io_tasks
  FOR EACH ROW EXECUTE FUNCTION notify_pending_task();
```

Agents `LISTEN` on the `task_pending` channel and wake up only when work appears, instead of polling.

**NOTIFY payload limit:** 8000 bytes. Sufficient for a task ID.

**Verdict:** PostgreSQL is the best option if you want correctness, concurrent agents, and no external dependencies. The database is already running. The schema addition is small. The atomic claim pattern is battle-tested. The only cost is schema migration and rewriting the orchestrator's task-fetch logic.

### Redis LPOP as atomic work queue

Redis provides atomic list operations. A task queue in Redis:

```bash
# Add tasks to queue (right-push, FIFO)
redis-cli RPUSH io:pending:tasks "DD-06-001" "DD-06-002" "DD-06-003"

# Worker atomically pops and moves to processing (atomic, no race)
redis-cli LMOVE io:pending:tasks io:processing:tasks LEFT LEFT
# Returns: "DD-06-001"

# On completion, remove from processing
redis-cli LREM io:processing:tasks 1 "DD-06-001"
redis-cli RPUSH io:completed:tasks "DD-06-001"
```

`LMOVE` (or the older `BRPOPLPUSH`) is atomic at the Redis command level — no two workers can pop the same element.

**Problem for this project:** Redis is not in the current stack. Adding it means running another service. For a ~400-task queue with single-agent execution, adding Redis is unnecessary complexity.

**If you already had Redis running:** It would be an excellent choice. `LMOVE` is the cleanest atomic queue primitive available.

**Verdict:** Not recommended here because Redis is not in the stack and the complexity cost isn't justified.

---

## 7. Summary Assessment

### GitHub Issues: honest verdict

**What works:**
- Label-based filtering is functional and accurate (AND logic on multiple labels)
- Issue body stores task specs easily — 1–5 KB specs are trivial against any limit
- Comments as attempt history are durable and human-readable
- Projects v2 gives humans a visual board without agent complexity
- Bulk migration is scriptable in ~10 minutes
- Rate limits are not a problem at this scale

**What doesn't work:**
- No atomic claim. The race condition between `list` and `edit` is real. For single-agent execution it doesn't matter; for parallel agents it's a bug.
- Label-based state machine is fragile. Adding/removing labels requires two API calls and can desynchronize if one fails.
- State is distributed across labels (status), assignees (claim), and body (spec). It's not a single record — it's a bag of metadata that must be kept consistent manually.
- Human noise: 400+ issues in a repo clutters the standard GitHub workflow. Teammates opening PRs will see hundreds of "issues."
- Operational dependency: agents now require network access to GitHub and a valid PAT. Local dev without internet breaks.
- The current JSON file is human-inspectable with `cat` and machine-parseable without any API calls. GitHub Issues require a network round-trip for every read.

**The fundamental mismatch:** GitHub Issues is a human collaboration tool with an API bolted on. A task queue is a concurrency primitive. Forcing one to be the other produces a system that does neither well.

### Recommendation

**For single-agent execution (current model): stay with local files or migrate to SQLite.**

The current JSON file has one real problem: concurrent write corruption. SQLite solves this without adding any external dependency. The migration is a single Python script. Agents use `sqlite3` CLI or Python's built-in `sqlite3` module. No network, no auth, no rate limits, genuine atomic claims.

**For multi-agent parallel execution (future state): migrate to PostgreSQL.**

The project already runs PostgreSQL. `SELECT FOR UPDATE SKIP LOCKED` is the correct primitive for a work queue. The task spec body fits in a `TEXT` column. LISTEN/NOTIFY replaces the polling loop. This is the architecturally correct solution and requires no new infrastructure.

**GitHub Issues as a complement, not a replacement:**

If you want human visibility into the pipeline without replacing the task store, mirror task status to GitHub Issues:
- Create one issue per task during `audit` runs
- Update issue labels on status changes
- Post agent completion summaries as comments
- Use Projects v2 as a read-only kanban

But keep the authoritative task state in PostgreSQL or SQLite. Do not make GitHub Issues the source of truth.

---

## Appendix: gh CLI Quick Reference

```bash
# List pending tasks for a unit
gh issue list --label "status:pending" --label "unit:DD-06" --json number,title,body

# Claim a task
gh issue edit 42 --remove-label "status:pending" --add-label "status:implementing" --add-assignee "@me"

# Post attempt log
gh issue comment 42 --body "Attempt #1: implemented X, tests pass"

# Mark verified
gh issue edit 42 --remove-label "status:implementing" --add-label "status:verified" --state closed

# Mark failed, release claim
gh issue edit 42 --remove-label "status:implementing" --add-label "status:failed" --remove-assignee "@me"

# Bulk query: all open implementing tasks (stale claim detection)
gh issue list --label "status:implementing" --state open --json number,title,updatedAt

# GraphQL: move project card (Projects v2)
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId, itemId: $itemId, fieldId: $fieldId
    value: { singleSelectOptionId: $optionId }
  }) { projectV2Item { id } }
}' -f projectId="..." -f itemId="..." -f fieldId="..." -f optionId="..."
```
