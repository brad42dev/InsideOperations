# Versioning Phase 4 — Saved Charts Backend + localStorage Migration

## Overview

This phase replaces the localStorage-backed `savedChartsStore` with a database-backed API. It covers:
- A new Rust handler module `saved_charts.rs` with full CRUD + publish/unpublish endpoints
- Route registration in `main.rs`
- A new frontend API client `frontend/src/api/savedCharts.ts`
- Rewrite of `frontend/src/store/savedChartsStore.ts` to use the API instead of Zustand persist/localStorage
- One-time migration flow for users with existing localStorage data

**Architecture reference:** `docs/architecture/versioning-and-publishing.md`
**Schema (Task 1, complete):** `migrations/20260512000004_saved_charts.up.sql`

**No chart versioning in this phase.** The architecture doc marks `saved_chart_versions` as "future". This phase gets charts into the database and removes the localStorage dependency.

---

## File Inventory

**Files to create (2):**

1. `services/api-gateway/src/handlers/saved_charts.rs` — all handler functions
2. `frontend/src/api/savedCharts.ts` — typed API client

**Files to modify (3):**

3. `services/api-gateway/src/handlers/mod.rs` — add `pub mod saved_charts;`
4. `services/api-gateway/src/main.rs` — register 7 new routes
5. `frontend/src/store/savedChartsStore.ts` — rewrite: remove persist middleware, add API integration

---

## Database Schema Reference

The `saved_charts` table already exists (Task 1):

```sql
CREATE TABLE saved_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    chart_type INTEGER NOT NULL,
    config JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_charts_created_by ON saved_charts(created_by);
CREATE INDEX idx_saved_charts_published ON saved_charts(published) WHERE published = true;

CREATE TRIGGER trg_saved_charts_updated_at
    BEFORE UPDATE ON saved_charts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Part 1: Backend Handler — `saved_charts.rs`

### File: `services/api-gateway/src/handlers/saved_charts.rs`

Follow the patterns established in `console.rs` and `graphics.rs`. Use the same imports, permission helpers, and response envelope types.

### Imports and helpers

```rust
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PageParams, PagedResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

fn is_admin(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*")
}
```

### Request/Response types

```rust
#[derive(Debug, Deserialize)]
pub struct CreateSavedChartBody {
    pub name: String,
    pub description: Option<String>,
    pub chart_type: i32,
    pub config: JsonValue,
    pub published: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSavedChartBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub chart_type: Option<i32>,
    pub config: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct SavedChartSummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub chart_type: i32,
    pub config: JsonValue,
    pub published: bool,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListSavedChartsQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    /// Admin-only: when "true", include all users' charts (not just the caller's)
    pub all_users: Option<String>,
}
```

### Handler 1: `POST /api/v1/saved-charts` — create

**Function signature:**
```rust
pub async fn create_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSavedChartBody>,
) -> impl IntoResponse
```

**RBAC:** `console:write`

**SQL:**
```sql
INSERT INTO saved_charts (id, name, description, chart_type, config, published, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, name, description, chart_type, config, published, created_by, created_at, updated_at
```

**Logic:**
- Parse `claims.sub` as UUID for `created_by`.
- Validate `body.name` is non-empty (trim, check).
- `published` defaults to `false` if not provided — only set to `true` if `body.published == Some(true)` AND user has `console:workspace_publish` permission.
- Generate `Uuid::new_v4()` for the id.
- Return `ApiResponse::ok(SavedChartSummary { ... })`.

### Handler 2: `GET /api/v1/saved-charts` — list

**Function signature:**
```rust
pub async fn list_saved_charts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListSavedChartsQuery>,
) -> impl IntoResponse
```

**RBAC:** `console:read`

**SQL (normal user):**
```sql
-- Count
SELECT COUNT(*) FROM saved_charts
WHERE deleted_at IS NULL
  AND (created_by = $1 OR published = true)

-- Data
SELECT id, name, description, chart_type, config, published, created_by, created_at, updated_at
FROM saved_charts
WHERE deleted_at IS NULL
  AND (created_by = $1 OR published = true)
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3
```

**SQL (admin with `all_users=true`):**
```sql
-- Count
SELECT COUNT(*) FROM saved_charts WHERE deleted_at IS NULL

-- Data
SELECT id, name, description, chart_type, config, published, created_by, created_at, updated_at
FROM saved_charts
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT $1 OFFSET $2
```

**Logic:**
- If `params.all_users == Some("true")` and `is_admin(&claims)`, use the admin query (no user filter).
- Otherwise, filter to `created_by = user_id OR published = true`.
- Standard pagination using `PageParams` pattern (default page=1, per_page=50).
- Return `PagedResponse::new(items, page, per_page, total)`.

### Handler 3: `GET /api/v1/saved-charts/:id` — get single

**Function signature:**
```rust
pub async fn get_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse
```

**RBAC:** `console:read`

**SQL:**
```sql
SELECT id, name, description, chart_type, config, published, created_by, created_at, updated_at
FROM saved_charts
WHERE id = $1 AND deleted_at IS NULL
```

**Logic:**
- Fetch the row.
- If not found: return 404.
- Visibility check: if `row.created_by != user_id` AND `!row.published` AND `!is_admin(&claims)`, return 404 (treat as not found rather than forbidden — do not leak existence).
- Return `ApiResponse::ok(SavedChartSummary { ... })`.

### Handler 4: `PUT /api/v1/saved-charts/:id` — update

**Function signature:**
```rust
pub async fn update_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSavedChartBody>,
) -> impl IntoResponse
```

**RBAC:** `console:write`

**SQL:**
```sql
UPDATE saved_charts
SET
    name       = COALESCE($1, name),
    description = COALESCE($2, description),
    chart_type = COALESCE($3, chart_type),
    config     = COALESCE($4, config)
WHERE id = $5
  AND deleted_at IS NULL
  AND created_by = $6
RETURNING id, name, description, chart_type, config, published, created_by, created_at, updated_at
```

**Logic:**
- Only the chart owner can update (filter by `created_by = user_id`). Admins are NOT exempt from ownership check for updates — they should use the UI owner's context.
- If no row returned: 404.
- Return `ApiResponse::ok(SavedChartSummary { ... })`.

### Handler 5: `DELETE /api/v1/saved-charts/:id` — soft delete

**Function signature:**
```rust
pub async fn delete_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse
```

**RBAC:** `console:write`

**SQL (non-admin):**
```sql
UPDATE saved_charts
SET deleted_at = NOW()
WHERE id = $1 AND deleted_at IS NULL AND created_by = $2
RETURNING id
```

**SQL (admin):**
```sql
UPDATE saved_charts
SET deleted_at = NOW()
WHERE id = $1 AND deleted_at IS NULL
RETURNING id
```

**Logic:**
- Owner or admin can delete. Admins can delete any chart.
- If no row returned: 404.
- Return `ApiResponse::ok(json!({ "deleted": true }))`.

### Handler 6: `POST /api/v1/saved-charts/:id/publish`

**Function signature:**
```rust
pub async fn publish_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse
```

**RBAC:** `console:workspace_publish`

**SQL:**
```sql
UPDATE saved_charts
SET published = true
WHERE id = $1 AND deleted_at IS NULL AND created_by = $2
RETURNING id
```

**Logic:**
- Only the chart owner can publish. (Admin override: if `is_admin`, skip `created_by` check.)
- If no row returned: 404.
- Return `ApiResponse::ok(json!({ "id": id, "published": true }))`.

### Handler 7: `POST /api/v1/saved-charts/:id/unpublish`

**Function signature:**
```rust
pub async fn unpublish_saved_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse
```

**RBAC:** `console:workspace_publish`

**SQL (non-admin):**
```sql
UPDATE saved_charts
SET published = false
WHERE id = $1 AND deleted_at IS NULL AND created_by = $2
RETURNING id
```

**SQL (admin):**
```sql
UPDATE saved_charts
SET published = false
WHERE id = $1 AND deleted_at IS NULL
RETURNING id
```

**Logic:**
- Owner or admin can unpublish.
- If no row returned: 404.
- Return `ApiResponse::ok(json!({ "id": id, "published": false }))`.

---

## Part 2: Handler module registration

### File: `services/api-gateway/src/handlers/mod.rs`

Add one line:

```rust
pub mod saved_charts;
```

---

## Part 3: Route registration in `main.rs`

### File: `services/api-gateway/src/main.rs`

Add routes in the `api` Router builder, after the existing console workspace routes (after the `workspace_versions` block, before the bookmarks block). Use the `/api/v1/saved-charts` prefix.

**Route ordering rule:** Static sub-paths (`/publish`, `/unpublish`) MUST be registered before the parameterised `/:id` route. Place the collection route first, then static sub-paths of `/:id`, then the parameterised `/:id` route.

```rust
// Saved charts
.route(
    "/api/v1/saved-charts",
    get(handlers::saved_charts::list_saved_charts)
        .post(handlers::saved_charts::create_saved_chart),
)
.route(
    "/api/v1/saved-charts/:id/publish",
    post(handlers::saved_charts::publish_saved_chart),
)
.route(
    "/api/v1/saved-charts/:id/unpublish",
    post(handlers::saved_charts::unpublish_saved_chart),
)
.route(
    "/api/v1/saved-charts/:id",
    get(handlers::saved_charts::get_saved_chart)
        .put(handlers::saved_charts::update_saved_chart)
        .delete(handlers::saved_charts::delete_saved_chart),
)
```

---

## Part 4: Frontend API client

### File: `frontend/src/api/savedCharts.ts`

Follow the pattern established in `frontend/src/api/console.ts` and `frontend/src/api/graphics.ts`. Use the `api` client from `./client`.

```typescript
import { api, type ApiResult, type PaginatedResult } from "./client";
import type { ChartConfig } from "../shared/components/charts/chart-config-types";

// ---------------------------------------------------------------------------
// Types matching backend response shapes
// ---------------------------------------------------------------------------

export interface SavedChartResponse {
  id: string;
  name: string;
  description?: string | null;
  chart_type: number;
  config: ChartConfig;
  published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedChartRequest {
  name: string;
  description?: string;
  chart_type: number;
  config: ChartConfig;
  published?: boolean;
}

export interface UpdateSavedChartRequest {
  name?: string;
  description?: string;
  chart_type?: number;
  config?: ChartConfig;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const savedChartsApi = {
  /** List saved charts (user's own + published; admin can pass all_users=true) */
  list: (params?: { allUsers?: boolean }) =>
    api.get<PaginatedResult<SavedChartResponse>>(
      `/api/v1/saved-charts${params?.allUsers ? "?all_users=true" : ""}`,
    ),

  /** Get a single saved chart by ID */
  get: (id: string) =>
    api.get<SavedChartResponse>(`/api/v1/saved-charts/${id}`),

  /** Create a new saved chart */
  create: (body: CreateSavedChartRequest) =>
    api.post<SavedChartResponse>("/api/v1/saved-charts", body),

  /** Update an existing saved chart */
  update: (id: string, body: UpdateSavedChartRequest) =>
    api.put<SavedChartResponse>(`/api/v1/saved-charts/${id}`, body),

  /** Soft-delete a saved chart */
  remove: (id: string) =>
    api.delete(`/api/v1/saved-charts/${id}`),

  /** Publish a saved chart (makes it visible to all users) */
  publish: (id: string) =>
    api.post<{ id: string; published: boolean }>(
      `/api/v1/saved-charts/${id}/publish`,
      {},
    ),

  /** Unpublish a saved chart */
  unpublish: (id: string) =>
    api.post<{ id: string; published: boolean }>(
      `/api/v1/saved-charts/${id}/unpublish`,
      {},
    ),
};
```

---

## Part 5: Store migration — `savedChartsStore.ts`

### File: `frontend/src/store/savedChartsStore.ts`

Complete rewrite. The new store:
- Removes Zustand `persist` middleware (no more localStorage writes).
- Keeps charts in Zustand state for reactive UI.
- All mutations go through the API first, then update local state on success.
- On initialization, fetches charts from the API.
- Handles one-time localStorage migration.

### New `SavedChart` interface

The existing interface remains mostly the same, but field names align with the API response:

```typescript
export interface SavedChart {
  id: string;
  name: string;
  description?: string;
  chartType: number;      // frontend camelCase (mapped from API's chart_type)
  config: ChartConfig;
  published: boolean;     // no longer optional
  createdBy?: string;     // mapped from API's created_by
  createdAt: string;      // mapped from API's created_at
  updatedAt?: string;     // mapped from API's updated_at
}
```

Note: `owner_id` from the old interface is replaced by `createdBy`.

### New `SavedChartsState` interface

```typescript
interface SavedChartsState {
  charts: SavedChart[];
  loading: boolean;
  initialized: boolean;
  migrationPending: boolean;   // true if localStorage has charts to migrate

  // Actions
  fetchCharts: () => Promise<void>;
  saveChart: (data: Omit<SavedChart, "id" | "createdAt" | "updatedAt" | "createdBy"> & { id?: string }) => Promise<SavedChart | null>;
  publishChart: (id: string, published: boolean) => Promise<void>;
  deleteChart: (id: string) => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
  dismissMigration: () => void;
}
```

### Mapping helper

```typescript
function mapApiToLocal(api: SavedChartResponse): SavedChart {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    chartType: api.chart_type,
    config: api.config,
    published: api.published,
    createdBy: api.created_by,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}
```

### Store implementation (pseudocode)

```typescript
export const useSavedChartsStore = create<SavedChartsState>()((set, get) => ({
  charts: [],
  loading: false,
  initialized: false,
  migrationPending: false,

  fetchCharts: async () => {
    set({ loading: true });
    const result = await savedChartsApi.list();
    if (result.success) {
      const items = Array.isArray(result.data.data)
        ? result.data.data
        : (result.data as unknown as SavedChartResponse[]);
      const charts = items.map(mapApiToLocal);

      // Check if localStorage has saved charts that aren't in the DB yet
      const localRaw = localStorage.getItem("io_saved_charts");
      let migrationPending = false;
      if (localRaw && charts.length === 0) {
        try {
          const parsed = JSON.parse(localRaw);
          if (parsed?.state?.charts?.length > 0) {
            migrationPending = true;
          }
        } catch { /* ignore parse errors */ }
      }

      set({ charts, loading: false, initialized: true, migrationPending });
    } else {
      set({ loading: false, initialized: true });
    }
  },

  saveChart: async (data) => {
    const body = {
      name: data.name,
      description: data.description,
      chart_type: data.chartType,
      config: data.config,
      published: data.published,
    };

    if (data.id) {
      // Update existing
      const result = await savedChartsApi.update(data.id, body);
      if (result.success) {
        const chart = mapApiToLocal(result.data);
        set((s) => ({
          charts: s.charts.map((c) => (c.id === chart.id ? chart : c)),
        }));
        return chart;
      }
    } else {
      // Create new
      const result = await savedChartsApi.create(body);
      if (result.success) {
        const chart = mapApiToLocal(result.data);
        set((s) => ({ charts: [...s.charts, chart] }));
        return chart;
      }
    }
    return null;
  },

  publishChart: async (id, published) => {
    const result = published
      ? await savedChartsApi.publish(id)
      : await savedChartsApi.unpublish(id);
    if (result.success) {
      set((s) => ({
        charts: s.charts.map((c) =>
          c.id === id ? { ...c, published } : c,
        ),
      }));
    }
  },

  deleteChart: async (id) => {
    const result = await savedChartsApi.remove(id);
    if (result.success) {
      set((s) => ({ charts: s.charts.filter((c) => c.id !== id) }));
    }
  },

  migrateFromLocalStorage: async () => {
    const localRaw = localStorage.getItem("io_saved_charts");
    if (!localRaw) return;
    try {
      const parsed = JSON.parse(localRaw);
      const localCharts = parsed?.state?.charts ?? [];
      for (const lc of localCharts) {
        await savedChartsApi.create({
          name: lc.name,
          description: lc.description,
          chart_type: lc.chartType,
          config: lc.config,
          published: lc.published ?? false,
        });
      }
      // Clean up localStorage
      localStorage.removeItem("io_saved_charts");
      // Re-fetch to get server-assigned IDs
      await get().fetchCharts();
    } catch (e) {
      console.error("Failed to migrate saved charts from localStorage:", e);
    }
    set({ migrationPending: false });
  },

  dismissMigration: () => {
    localStorage.removeItem("io_saved_charts");
    set({ migrationPending: false });
  },
}));
```

### Key design decisions

1. **`saveChart` returns `Promise<SavedChart | null>`** instead of the old synchronous `SavedChart`. Consumers that use the return value (TrendPane line 701) must be updated to await the result.

2. **`fetchCharts` is called once on initialization.** The store exposes `initialized` so consumers can show a loading state or skip rendering until charts are loaded.

3. **Migration detection:** On first `fetchCharts`, if the API returns zero charts but localStorage has data, `migrationPending` is set to `true`. The ConsolePalette UI can show a banner: "Migrate saved charts from this browser?" with Migrate / Dismiss buttons.

4. **No optimistic updates.** All mutations hit the API first, then update local state on success. The operations are fast (simple DB writes), and this avoids consistency issues.

5. **`owner_id` removal.** The old store had an optional `owner_id` field that was never populated. Replaced by `createdBy` which is always set by the server from the JWT.

---

## Part 6: Consumer updates

### File: `frontend/src/pages/console/panes/TrendPane.tsx`

**Change at line ~255:** The `saveChart` call is now async. Update `handleSaveChart` (line 695):

```typescript
// Before:
function handleSaveChart(cfg: ChartConfig, name: string, description: string, publish: boolean) {
  const saved = saveChart({ ... });
  if (publish) publishChart(saved.id, true);
  setSaveModal(null);
}

// After:
async function handleSaveChart(cfg: ChartConfig, name: string, description: string, publish: boolean) {
  const saved = await saveChart({
    name,
    description: description || undefined,
    chartType: cfg.chartType,
    config: cfg,
    published: publish || undefined,
  });
  if (saved && publish) await publishChart(saved.id, true);
  setSaveModal(null);
}
```

### File: `frontend/src/pages/console/ConsolePalette.tsx`

**Change at line ~1176:** `deleteChart` and `publishChart` are now async. No functional change needed in the JSX callbacks — they're already used in fire-and-forget event handlers (`onPublish`, `onDelete`). The void return from the async call is harmless.

**Add migration banner** in the `ChartsSection` component, before the chart list:

```typescript
const { charts, publishChart, deleteChart, migrationPending, migrateFromLocalStorage, dismissMigration } = useSavedChartsStore();

// In JSX, before the chart list:
{migrationPending && (
  <div style={{ padding: "8px", background: "var(--io-surface-elevated)", borderRadius: 4, margin: "4px 8px" }}>
    <div style={{ fontSize: 11, color: "var(--io-text)", marginBottom: 4 }}>
      Found saved charts in this browser. Migrate to the server?
    </div>
    <div style={{ display: "flex", gap: 4 }}>
      <button onClick={() => migrateFromLocalStorage()}>Migrate</button>
      <button onClick={dismissMigration}>Dismiss</button>
    </div>
  </div>
)}
```

### Store initialization

The store must be initialized on app load. Add a `fetchCharts` call in the Console module mount or in the ConsolePalette mount:

```typescript
// In ConsolePalette or ConsoleLayout useEffect:
const { fetchCharts, initialized } = useSavedChartsStore();
useEffect(() => {
  if (!initialized) fetchCharts();
}, [initialized, fetchCharts]);
```

---

## RBAC Permission Mapping

| Endpoint | Permission | Notes |
|----------|-----------|-------|
| `GET /api/v1/saved-charts` | `console:read` | All authenticated users can list |
| `GET /api/v1/saved-charts/:id` | `console:read` | Visibility filtering in code |
| `POST /api/v1/saved-charts` | `console:write` | Create |
| `PUT /api/v1/saved-charts/:id` | `console:write` | Update (owner only) |
| `DELETE /api/v1/saved-charts/:id` | `console:write` | Soft delete (owner or admin) |
| `POST /api/v1/saved-charts/:id/publish` | `console:workspace_publish` | Owner or admin |
| `POST /api/v1/saved-charts/:id/unpublish` | `console:workspace_publish` | Owner or admin |

**Note:** The existing ConsolePalette and TrendPane use `usePermission("console:publish")` — this permission does not exist in the permission type system. It should be changed to `console:workspace_publish` to match the backend. Fix this as part of this phase.

---

## Verification Steps

```bash
# 1. Compile backend
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p io-api-gateway

# 2. Compile frontend
cd frontend && pnpm build

# 3. Start dev environment
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" ./dev.sh start

# 4. Manual API smoke tests (use admin token)
# Create
curl -X POST http://localhost:4200/api/v1/saved-charts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Chart","chart_type":1,"config":{"chartType":1,"points":[]}}'

# List
curl http://localhost:4200/api/v1/saved-charts \
  -H "Authorization: Bearer $TOKEN"

# Get single (replace $ID with the returned id)
curl http://localhost:4200/api/v1/saved-charts/$ID \
  -H "Authorization: Bearer $TOKEN"

# Update
curl -X PUT http://localhost:4200/api/v1/saved-charts/$ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Chart"}'

# Publish
curl -X POST http://localhost:4200/api/v1/saved-charts/$ID/publish \
  -H "Authorization: Bearer $TOKEN"

# Unpublish
curl -X POST http://localhost:4200/api/v1/saved-charts/$ID/unpublish \
  -H "Authorization: Bearer $TOKEN"

# Delete
curl -X DELETE http://localhost:4200/api/v1/saved-charts/$ID \
  -H "Authorization: Bearer $TOKEN"

# 5. Frontend verification
# - Log in as admin
# - Open Console module
# - If localStorage had saved charts, verify migration banner appears
# - Create a chart via TrendPane > Save Chart
# - Verify it appears in the ConsolePalette Charts section
# - Publish/unpublish/delete the chart
# - Refresh the page — chart should persist (no localStorage)
# - Open browser DevTools > Application > Local Storage — confirm "io_saved_charts" key is absent

# 6. Check DB directly
psql postgresql://io:io_password@localhost:5432/io_dev -c "SELECT id, name, chart_type, published, created_by, created_at FROM saved_charts;"
```

---

## Implementation Checklist

### Backend

- [ ] Create `services/api-gateway/src/handlers/saved_charts.rs` with all 7 handler functions
- [ ] Add `pub mod saved_charts;` to `services/api-gateway/src/handlers/mod.rs`
- [ ] Register all 7 routes in `services/api-gateway/src/main.rs` (after console workspace routes, before bookmarks)
- [ ] Verify route ordering: static sub-paths (`/publish`, `/unpublish`) before parameterised `/:id`
- [ ] Run `cargo build -p io-api-gateway` — compiles clean
- [ ] Run `cargo clippy -p io-api-gateway -- -D warnings` — no warnings

### Frontend API client

- [ ] Create `frontend/src/api/savedCharts.ts` with `savedChartsApi` object (7 methods)
- [ ] Verify TypeScript types match backend response shapes

### Store migration

- [ ] Rewrite `frontend/src/store/savedChartsStore.ts`:
  - [ ] Remove `import { persist } from "zustand/middleware"`
  - [ ] Remove `persist(...)` wrapper from store creation
  - [ ] Add `import { savedChartsApi, type SavedChartResponse } from "../api/savedCharts"`
  - [ ] Add `mapApiToLocal` helper function
  - [ ] Change `saveChart` to async (returns `Promise<SavedChart | null>`)
  - [ ] Change `publishChart` to async (returns `Promise<void>`)
  - [ ] Change `deleteChart` to async (returns `Promise<void>`)
  - [ ] Add `fetchCharts` action
  - [ ] Add `migrateFromLocalStorage` action
  - [ ] Add `dismissMigration` action
  - [ ] Add `loading`, `initialized`, `migrationPending` state fields
- [ ] Update `SavedChart` interface: `published` is `boolean` (not optional), add `createdBy`, `updatedAt`

### Consumer updates

- [ ] Update `TrendPane.tsx`: make `handleSaveChart` async, await `saveChart` return
- [ ] Update `ConsolePalette.tsx`: add migration banner UI, add `fetchCharts` initialization effect
- [ ] Fix permission: change `usePermission("console:publish")` to `usePermission("console:workspace_publish")` in both `ConsolePalette.tsx` (line 1177) and `TrendPane.tsx` (line 256)

### Verification

- [ ] `pnpm build` in `frontend/` — compiles clean with no type errors
- [ ] `cargo build -p io-api-gateway` — compiles clean
- [ ] Manual smoke test: create/list/get/update/publish/unpublish/delete via curl
- [ ] Manual smoke test: save chart from TrendPane UI, verify it persists across page refresh
- [ ] Manual smoke test: verify migration banner appears for users with existing localStorage data
- [ ] Verify `localStorage.getItem("io_saved_charts")` returns `null` after migration or fresh usage

---

## Known limitations (future phases)

1. **No chart versioning.** The architecture doc reserves `saved_chart_versions` for a future phase. This phase stores only the latest chart state.
2. **No "Save As" for charts.** The current UI only has Save and Save+Publish. Save As (fork to new chart) can be added later when the version history dialog is implemented for charts.
3. **No recovery dialog for charts.** Soft-deleted charts are invisible to non-admins. Admin recovery UI is out of scope for this phase.
4. **`all_users` admin toggle not wired in ConsolePalette.** The API supports it, but the UI toggle is a future item (shared "admin filter toggles" feature across all list views).
