# DD-13-020 Code Reference

Quick lookup for all relevant code locations related to the font-family toolbar feature.

---

## Frontend

### LogEditor Component
**File:** `/home/io/io-dev/io/frontend/src/pages/log/LogEditor.tsx`

| Lines | Content | Purpose |
|-------|---------|---------|
| 4-5 | `import { useEditor, EditorContent } from '@tiptap/react'` | Editor hooks |
| 14 | `import FontFamily from '@tiptap/extension-font-family'` | **Font extension** |
| 105-124 | `useEditor({ ... FontFamily, ... })` | **Extension registered** |
| 116 | `FontFamily` (in extensions array) | **Extension used in editor** |
| 128-138 | Toolbar div container | Toolbar HTML structure |
| 267-294 | `<select>` element | **FONT-FAMILY SELECTOR** ← Main feature |
| 267 | `title="Font family"` | Tooltip attribute |
| 269 | `editor.getAttributes('textStyle').fontFamily ?? ''` | Get current font |
| 270-277 | `onChange` handler | **Font selection event** |
| 273 | `editor.chain().focus().setFontFamily(value).run()` | **Apply font** |
| 275 | `editor.chain().focus().unsetFontFamily().run()` | Reset to default |
| 287-294 | `<option>` elements | Font options list |

### Font Options
```html
<option value="">Default</option>
<option value="Inter, sans-serif">Inter</option>
<option value="serif">Serif</option>
<option value="monospace">Monospace</option>
<option value="Arial, sans-serif">Arial</option>
<option value="Georgia, serif">Georgia</option>
```

### Status Handling (Related)
**File:** `/home/io/io-dev/io/frontend/src/pages/log/LogEditor.tsx`

| Lines | Content | Purpose |
|-------|---------|---------|
| 25-36 | `StatusBadge` component | Shows instance status |
| 27 | `draft: { ... label: 'Draft' }` | Status "draft" enum |
| 991-997 | `pendingContent` state | Tracks unsaved content |
| 1065-1072 | Content update mapping | Prepares content for API |

### Log API Client
**File:** `/home/io/io-dev/io/frontend/src/api/logs.ts`

| Lines | Content | Purpose |
|-------|---------|---------|
| 114-117 | `createInstance` method | **Create log instance API** |
| 114-117 | `POST /api/logs/instances` | **Endpoint path** |
| 116-117 | `Promise<ApiResult<LogInstance>>` | Response type |

### Log Module Page
**File:** `/home/io/io-dev/io/frontend/src/pages/log/index.tsx`

| Lines | Content | Purpose |
|-------|---------|---------|
| 125 | `draft: { ... }` | Status type definition |
| 137 | `draft: 'Draft'` | Status label |
| 535 | `listInstances({ status: 'draft' })` | Query instances by status |

---

## Backend

### Log Handlers
**File:** `/home/io/io-dev/io/services/api-gateway/src/handlers/logs.rs`

| Lines | Content | Purpose |
|-------|---------|---------|
| 549-603 | `create_instance` handler | **Create instance endpoint** |
| 554 | `check_permission(&claims, "log:write")` | Auth check |
| 559-572 | Template validation | Verify template exists |
| 575-586 | INSERT query | Database insert |
| 584 | `.bind("draft")` | **Status value (FIXED)** |
| 594 | `template_name: None` | Response data |
| 600 | `StatusCode::CREATED` | HTTP 201 response |
| 605-674 | `get_instance` handler | Fetch instance details |
| 745-785 | `submit_instance` handler | Update status to submitted |
| 791-870 | `search_logs` handler | Full-text search |

### Route Wiring
**File:** `/home/io/io-dev/io/services/api-gateway/src/main.rs`

```rust
.route("/api/logs/instances",
    get(handlers::logs::list_instances)
    .post(handlers::logs::create_instance))
```

This line wires:
- `GET /api/logs/instances` → list_instances
- `POST /api/logs/instances` → create_instance ← Our handler

---

## Database

### Status Migration
**File:** `/home/io/io-dev/io/migrations/20260322000002_log_instance_status_states.up.sql`

| Lines | Content | Purpose |
|-------|---------|---------|
| 1-3 | Comments | Migration description |
| 6-7 | UPDATE statements | Rename old values |
| 10 | DROP CONSTRAINT | Remove old constraint |
| 12-15 | ADD CONSTRAINT | **New constraint: draft, in_progress, submitted, reviewed** |
| 18 | ALTER default | Set default to 'draft' |

### Schema Definition
**File:** `/home/io/io-dev/io/migrations/` (initial schema)

The `log_instances` table has columns:
- `id` (UUID, primary key)
- `template_id` (UUID, foreign key to log_templates)
- `status` (TEXT, CHECK constraint)
- `team_name` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ)
- `deleted_at` (TIMESTAMPTZ)

---

## API Types

### Frontend Types
**File:** `/home/io/io-dev/io/frontend/src/api/logs.ts`

```typescript
interface LogInstance {
  id: string
  template_id: string
  template_name?: string
  status: 'draft' | 'in_progress' | 'submitted' | 'reviewed'
  team_name?: string
  created_at: string
  completed_at?: string
}
```

### Backend Types
**File:** `/home/io/io-dev/io/services/api-gateway/src/handlers/logs.rs`

```rust
pub struct LogInstanceRow {
    pub id: Uuid,
    pub template_id: Uuid,
    pub template_name: Option<String>,
    pub status: String,
    pub team_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}
```

---

## Test Files

### Test Documents
- `CURRENT.md` — Main UAT result file
- `DD-13-020-SUMMARY.md` — Feature verification summary
- `dd-13-020-manual-test.md` — Detailed manual test steps
- `DD-13-020-CODE-REFERENCE.md` ← You are here

---

## Search Patterns

### To find font-family related code:
```bash
grep -rn "fontFamily\|font-family\|FontFamily" frontend/src/pages/log/
```

### To find log instance creation:
```bash
grep -rn "create_instance\|createInstance" frontend/src/api/logs.ts
```

### To find status values:
```bash
grep -rn "'draft'\|'in_progress'\|'submitted'\|'reviewed'" \
  frontend/src/pages/log/ \
  services/api-gateway/src/handlers/logs.rs
```

### To find the constraint:
```bash
grep -rn "log_instances.*CHECK\|draft.*in_progress.*submitted.*reviewed" \
  migrations/
```

---

## Key Values

| Parameter | Value | Location |
|-----------|-------|----------|
| API Endpoint | POST /api/logs/instances | main.rs route |
| Permission Required | log:write | logs.rs:554 |
| Initial Status | "draft" | logs.rs:584 |
| Status Options | draft, in_progress, submitted, reviewed | migration SQL, LogInstance type |
| Font Options | Default, Inter, Serif, Monospace, Arial, Georgia | LogEditor.tsx:288-293 |
| Extension Used | @tiptap/extension-font-family | LogEditor.tsx:14, 116 |
| Command Chain | editor.chain().focus().setFontFamily(value).run() | LogEditor.tsx:273 |

---

## Quick Navigation

### "Where is the font-family dropdown?"
→ LogEditor.tsx lines 267-294

### "Where is the API endpoint?"
→ logs.rs lines 549-603, wired in main.rs

### "Where is the status defined?"
→ migrations/20260322000002_*.up.sql, LogInstance type in logs.ts

### "Where is the auth check?"
→ logs.rs line 554

### "What status value should be used?"
→ "draft" (logs.rs:584)

### "What are the valid font options?"
→ Default, Inter, Serif, Monospace, Arial, Georgia (LogEditor.tsx:288-293)

### "How does the font actually apply?"
→ editor.chain().focus().setFontFamily(value).run() (LogEditor.tsx:273)

---

## Related Tasks

- **DD-13-023** — Create instance handler (BLOCKED THIS TASK, NOW RESOLVED)
- **DD-13-019** — Status value bug (NOW RESOLVED — using "draft" not "pending")
- **DD-13** — Log module (parent task)
- **Design Doc 13** — Log Module spec

---

**Last Updated:** 2026-03-26
**Verified:** All code locations confirmed
**Status:** Ready for testing
