# Versioning Phase 3: Workspace Versioning Backend — Implementation Plan

## Scope

All backend API work for workspace versioning using the `workspace_versions` table created in Phase 1. This phase follows the exact patterns established in Phase 2 (graphic versioning in `graphics.rs`) but applies them to workspace operations in `console.rs`. It includes: modifying `update_workspace` to auto-create version snapshots, rewriting `publish_workspace` to create publish snapshots, adding an unpublish handler, and adding all version CRUD handlers (list, get content, restore, soft-delete, recover, permanent delete, update label). It also includes a **critical migration fix** — the Phase 1 `workspace_versions` table has a FK to the unused `workspaces` table, but workspace data actually lives in `design_objects` (with `type = 'console_workspace'`). This FK must be changed to reference `design_objects(id)`.

---

## Critical Architecture Finding: FK Mismatch

**Problem:** The `workspace_versions` table (created in Phase 1 migration `20260512000003`) has:
```sql
workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
```

But workspace data is stored in the `design_objects` table with `type = 'console_workspace'`, NOT in the `workspaces` table. The `workspaces` table exists in the schema (from `20260314000009`) but has **zero rows** and **zero API code** that reads or writes to it. Every workspace handler in `console.rs` queries `design_objects WHERE type = 'console_workspace'`.

**Resolution:** Create a new migration (`20260512000006`) that drops the FK to `workspaces(id)` and adds a FK to `design_objects(id)` instead. The column name stays `workspace_id` for semantic clarity (it IS a workspace ID — it just lives in the `design_objects` table).

---

## Files Modified

| File | Action |
|------|--------|
| `services/api-gateway/src/handlers/console.rs` | Major: add 10 new handler functions, modify 2 existing handlers, add helper structs/functions |
| `services/api-gateway/src/main.rs` | Add 8 new route registrations for workspace versioning |
| `migrations/20260512000006_workspace_versions_fk_fix.up.sql` | New: change FK from `workspaces(id)` to `design_objects(id)` |
| `migrations/20260512000006_workspace_versions_fk_fix.down.sql` | New: revert FK |

---

## Migration 6: `20260512000006_workspace_versions_fk_fix`

**Up SQL** (`migrations/20260512000006_workspace_versions_fk_fix.up.sql`):
```sql
-- Fix FK: workspace data lives in design_objects, not workspaces
ALTER TABLE workspace_versions
    DROP CONSTRAINT workspace_versions_workspace_id_fkey;

ALTER TABLE workspace_versions
    ADD CONSTRAINT workspace_versions_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES design_objects(id) ON DELETE CASCADE;
```

**Down SQL** (`migrations/20260512000006_workspace_versions_fk_fix.down.sql`):
```sql
ALTER TABLE workspace_versions
    DROP CONSTRAINT workspace_versions_workspace_id_fkey;

ALTER TABLE workspace_versions
    ADD CONSTRAINT workspace_versions_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
```

---

## New Structs and Helpers (add to `console.rs`)

Add these after the existing struct definitions (after `DuplicateWorkspaceBody`, line ~51):

### Helper: `is_admin`

```rust
fn is_admin(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*")
}
```

Note: This is a copy of the same helper in `graphics.rs`. Both files have their own `check_permission` already, so duplicating this small helper is consistent with the existing pattern (each handler file is self-contained).

### Helper: `count_panes`

Count top-level pane entries in the workspace metadata. Workspaces store layout data in `metadata` JSONB with a `panes` array.

```rust
fn count_panes(metadata: &Option<JsonValue>) -> i64 {
    metadata
        .as_ref()
        .and_then(|m| m.get("panes"))
        .and_then(|p| p.as_array())
        .map(|arr| arr.len() as i64)
        .unwrap_or(0)
}
```

### Helper: `count_workspace_bindings`

Count point bindings across all panes. Each pane in `metadata.panes` may have a `pointBindings` array, a `chartConfig.series[].pointTag` field, or point references in nested objects. For a conservative first pass, count panes that have any point-related configuration (a pane with content is considered one binding unit). More granular counting can be added later.

Actually, examining the frontend `PaneConfig` type, panes have a `chartConfig` with `series` that each have `pointTag`. Count total series entries across all panes:

```rust
fn count_workspace_bindings(metadata: &Option<JsonValue>) -> i64 {
    let panes = match metadata
        .as_ref()
        .and_then(|m| m.get("panes"))
        .and_then(|p| p.as_array())
    {
        Some(arr) => arr,
        None => return 0,
    };

    let mut count = 0i64;
    for pane in panes {
        // Count series in chartConfig (each series binds a point)
        if let Some(series) = pane
            .get("chartConfig")
            .and_then(|c| c.get("series"))
            .and_then(|s| s.as_array())
        {
            count += series.len() as i64;
        }
        // Count graphicId bindings (graphic panes bind to a design object)
        if pane.get("graphicId").and_then(|v| v.as_str()).is_some() {
            count += 1;
        }
    }
    count
}
```

### Helper: `compute_workspace_version_metadata`

```rust
fn compute_workspace_version_metadata(
    metadata: &Option<JsonValue>,
    existing_version_metadata: &Option<JsonValue>,
) -> JsonValue {
    let element_count = count_panes(metadata);
    let binding_count = count_workspace_bindings(metadata);

    let mut meta = existing_version_metadata
        .clone()
        .unwrap_or(serde_json::json!({}));
    if let Some(obj) = meta.as_object_mut() {
        obj.insert(
            "element_count".to_string(),
            serde_json::json!(element_count),
        );
        obj.insert(
            "binding_count".to_string(),
            serde_json::json!(binding_count),
        );
    }
    meta
}
```

### Request/Response Structs

```rust
#[derive(Debug, Deserialize)]
pub struct ListWorkspaceVersionsQuery {
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceVersionSummary {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceVersionContent {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub layout: JsonValue,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceVersionLabelBody {
    pub label: Option<String>,
}
```

### Updated `UpdateWorkspaceBody`

Add optional `label` field for version notes:

```rust
#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceBody {
    pub name: Option<String>,
    pub metadata: Option<JsonValue>,
    pub label: Option<String>,    // NEW: optional version label/notes
}
```

### Updated `WorkspaceSummary`

Add `published` field:

```rust
#[derive(Debug, Serialize)]
pub struct WorkspaceSummary {
    pub id: Uuid,
    pub name: String,
    pub metadata: Option<JsonValue>,
    pub published: bool,           // NEW
    pub created_at: DateTime<Utc>,
}
```

### Updated SQL in Existing Handlers

Every handler that builds a `WorkspaceSummary` must now extract the `published` status. Since `published` is stored inside `metadata.published` (as a JSONB boolean, NOT as a top-level SQL column on `design_objects`), the extraction is done from the metadata blob.

**Important nuance:** The `design_objects` table now has a top-level `published BOOLEAN` column (added in Phase 1 migration `20260512000001`), but the console workspace handlers have historically stored published status inside `metadata.published` (JSONB). To be consistent and correct going forward, workspace versioning should use the **top-level `published` column** on `design_objects`, aligning with how `publish_graphic` works in `graphics.rs`.

Update the four handlers that build `WorkspaceSummary`:

1. `list_workspaces`: Add `published` to SELECT list, extract with `row.try_get("published").unwrap_or(false)`
2. `create_workspace`: Add `published` to RETURNING clause
3. `get_workspace`: Add `published` to SELECT list
4. `update_workspace`: Add `published` to RETURNING clause

Example for `list_workspaces` SELECT:
```sql
SELECT id, name, metadata, published, created_at
FROM design_objects
WHERE type = 'console_workspace' AND created_by = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```

Example for `WorkspaceSummary` construction:
```rust
items.push(WorkspaceSummary {
    id,
    name,
    metadata,
    published: row.try_get("published").unwrap_or(false),
    created_at,
});
```

---

## Shared Helper: `create_workspace_version_snapshot`

This is the core shared helper used by multiple handlers. Add it as an `async fn` in `console.rs`:

```rust
/// Create an immutable version snapshot for a workspace.
/// Uses advisory lock to prevent version_number races.
/// Returns the new version_number.
async fn create_workspace_version_snapshot(
    db: &sqlx::PgPool,
    workspace_id: Uuid,
    created_by: Uuid,
    version_type: &str,
    layout: &JsonValue,
    metadata: &JsonValue,
    label: Option<String>,
) -> Result<i32, sqlx::Error> {
    let mut tx = db.begin().await?;

    // Advisory lock scoped to this transaction — prevents version_number races
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(workspace_id.to_string())
        .execute(&mut *tx)
        .await?;

    // Determine next version number and parent
    let (current_max, parent_version): (i32, Option<i32>) = sqlx::query_as(
        "SELECT COALESCE(MAX(version_number), 0), \
                CASE WHEN MAX(version_number) > 0 THEN MAX(version_number) ELSE NULL END \
         FROM workspace_versions \
         WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(&mut *tx)
    .await?;

    let next_version = current_max + 1;

    // Auto-label v1 as "Original"
    let effective_label = if next_version == 1 && label.is_none() {
        Some("Original".to_string())
    } else {
        label
    };

    sqlx::query(
        r#"
        INSERT INTO workspace_versions
            (id, workspace_id, version_number, version_type, layout,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(next_version)
    .bind(version_type)
    .bind(layout)
    .bind(metadata)
    .bind(created_by)
    .bind(&effective_label)
    .bind(parent_version)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        workspace_id = %workspace_id,
        version = next_version,
        version_type = version_type,
        "Workspace version snapshot created"
    );

    Ok(next_version)
}
```

Key differences from `create_version_snapshot` in `graphics.rs`:
- Table is `workspace_versions` (not `design_object_versions`)
- Column is `workspace_id` (not `design_object_id`)
- Stores `layout JSONB` (not `svg_data TEXT` + `bindings JSONB`)
- No `bindings` column — workspace bindings are inside the layout/metadata JSONB

---

## Handler Implementations

### 1. Update `update_workspace` (existing, line ~285)

After the existing UPDATE query succeeds (after line ~321, after building `ws`), add the version snapshot block. **Workspaces do NOT have auto-save**, so no `__autosave_` guard is needed:

```rust
    // Version snapshot on every save
    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => {
            tracing::warn!("update_workspace: invalid user ID in token, skipping version snapshot");
            Uuid::nil()
        }
    };
    if !created_by.is_nil() {
        let ws_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
        let version_metadata = compute_workspace_version_metadata(&ws_metadata, &None);
        // The "layout" stored in workspace_versions is the full metadata blob
        // (which contains layout, panes, gridItems, etc.)
        let layout_snap = ws_metadata.clone().unwrap_or(serde_json::json!({}));
        let label = body.label.clone();

        let db = state.db.clone();
        tokio::spawn(async move {
            if let Err(e) = create_workspace_version_snapshot(
                &db, id, created_by, "save", &layout_snap,
                &version_metadata, label,
            ).await {
                tracing::warn!(error = %e, workspace_id = %id, "Workspace version snapshot creation failed (non-fatal)");
            }
        });
    }
```

Insert this block after building the `WorkspaceSummary` (`ws`) but before the final `Json(ApiResponse::ok(ws)).into_response()` return. The version snapshot is spawned as a background task (non-blocking, non-fatal on failure) matching the pattern in `update_graphic`.

### 2. Update `publish_workspace` (existing, line ~338)

Rewrite to: (a) set `published = true` on the live `design_objects` row using the top-level column, (b) create a version snapshot with `version_type = 'publish'`:

```rust
pub async fn publish_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    if !check_permission(&claims, "console:workspace_publish") {
        return IoError::Forbidden("console:workspace_publish permission required".into())
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        UPDATE design_objects
        SET published = true
        WHERE id = $1
          AND type = 'console_workspace'
          AND created_by = $2
        RETURNING id, name, metadata
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Workspace {} not found", id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "publish_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
    let version_metadata = compute_workspace_version_metadata(&ws_metadata, &None);
    let layout_snap = ws_metadata.unwrap_or(serde_json::json!({}));

    match create_workspace_version_snapshot(
        &state.db, id, user_id, "publish", &layout_snap,
        &version_metadata, None,
    ).await {
        Ok(version) => {
            tracing::info!(workspace_id = %id, version = version, "Workspace published");
            Json(ApiResponse::ok(serde_json::json!({
                "version": version,
                "published": true,
            }))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "publish_workspace version snapshot failed");
            IoError::Database(e).into_response()
        }
    }
}
```

Key changes from existing handler:
- Uses `SET published = true` (top-level column) instead of `jsonb_set(metadata, '{published}', 'true')`
- Creates a version snapshot with `version_type = 'publish'`
- Returns version number in response

### 3. `unpublish_workspace` (NEW)

`POST /api/console/workspaces/:id/unpublish`

```rust
pub async fn unpublish_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:workspace_publish") {
        return IoError::Forbidden("console:workspace_publish permission required".into())
            .into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND type = 'console_workspace' RETURNING id",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND type = 'console_workspace' AND created_by = $2 RETURNING id",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(workspace_id = %id, "Workspace unpublished");
            Json(ApiResponse::ok(serde_json::json!({ "published": false }))).into_response()
        }
        Ok(None) => IoError::NotFound(
            format!("Workspace {} not found or not owned by you", id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "unpublish_workspace query failed");
            IoError::Database(e).into_response()
        }
    }
}
```

### 4. `list_workspace_versions` (NEW)

`GET /api/console/workspaces/:id/versions`

```rust
pub async fn list_workspace_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListWorkspaceVersionsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:read") {
        return IoError::Forbidden("console:read permission required".into()).into_response();
    }

    let include_deleted = query.include_deleted.unwrap_or(false) && is_admin(&claims);
    let deleted_filter = if include_deleted { "" } else { "AND v.deleted_at IS NULL" };

    let sql = format!(
        r#"
        SELECT v.id, v.version_number, v.version_type, v.label,
               v.parent_version_number, v.metadata, v.created_by,
               v.created_at, v.deleted_at,
               u.display_name AS created_by_name
        FROM workspace_versions v
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.workspace_id = $1 {deleted_filter}
        ORDER BY v.version_number DESC
        "#,
        deleted_filter = deleted_filter,
    );

    let rows = match sqlx::query(&sql)
        .bind(id)
        .fetch_all(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_workspace_versions query failed");
            return IoError::Database(e).into_response();
        }
    };

    let versions: Vec<WorkspaceVersionSummary> = rows.iter().filter_map(|row| {
        Some(WorkspaceVersionSummary {
            id: row.try_get("id").ok()?,
            version_number: row.try_get("version_number").ok()?,
            version_type: row.try_get("version_type").ok()?,
            label: row.try_get("label").ok().flatten(),
            parent_version_number: row.try_get("parent_version_number").ok().flatten(),
            metadata: row.try_get("metadata").ok().flatten(),
            created_by: row.try_get("created_by").ok()?,
            created_by_name: row.try_get("created_by_name").ok().flatten(),
            created_at: row.try_get("created_at").ok()?,
            deleted_at: row.try_get("deleted_at").ok().flatten(),
        })
    }).collect();

    Json(ApiResponse::ok(versions)).into_response()
}
```

### 5. `get_workspace_version_content` (NEW)

`GET /api/console/workspaces/:id/versions/:version_number`

```rust
pub async fn get_workspace_version_content(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:read") {
        return IoError::Forbidden("console:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, version_number, version_type, label, parent_version_number,
               layout, metadata, created_by, created_at
        FROM workspace_versions
        WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(
            format!("Version {} of workspace {} not found", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_workspace_version_content query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content = WorkspaceVersionContent {
        id: row.try_get("id").unwrap_or_default(),
        version_number: row.try_get("version_number").unwrap_or(0),
        version_type: row.try_get("version_type").unwrap_or_default(),
        label: row.try_get("label").ok().flatten(),
        parent_version_number: row.try_get("parent_version_number").ok().flatten(),
        layout: row.try_get("layout").unwrap_or(serde_json::json!({})),
        metadata: row.try_get("metadata").ok().flatten(),
        created_by: row.try_get("created_by").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(content)).into_response()
}
```

### 6. `restore_workspace_version` (NEW)

`POST /api/console/workspaces/:id/versions/:version_number/restore`

```rust
pub async fn restore_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    // Fetch the version content
    let ver_row = match sqlx::query(
        r#"
        SELECT layout, metadata
        FROM workspace_versions
        WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(
            format!("Version {} of workspace {} not found", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let layout: JsonValue = ver_row.try_get("layout").unwrap_or(serde_json::json!({}));

    // Update the live row with the restored content
    // The layout from workspace_versions IS the metadata blob
    match sqlx::query(
        r#"
        UPDATE design_objects
        SET metadata = $1
        WHERE id = $2 AND type = 'console_workspace'
        RETURNING id
        "#,
    )
    .bind(&layout)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(_)) => {}
        Ok(None) => return IoError::NotFound(format!("Workspace {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version update failed");
            return IoError::Database(e).into_response();
        }
    }

    // Create a new version snapshot at the top of the stack
    // parent_version_number points to the restored version
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version begin transaction failed");
            return IoError::Database(e).into_response();
        }
    };

    if let Err(e) = sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
    {
        tracing::error!(error = %e, "restore_workspace_version advisory lock failed");
        return IoError::Database(e).into_response();
    }

    let next_version: i32 = match sqlx::query_scalar(
        "SELECT COALESCE(MAX(version_number), 0) + 1 FROM workspace_versions WHERE workspace_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version next_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws_metadata_opt = Some(layout.clone());
    let version_metadata = compute_workspace_version_metadata(&ws_metadata_opt, &None);
    let restore_label = format!("Restored from v{}", version_number);

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO workspace_versions
            (id, workspace_id, version_number, version_type, layout,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, 'save', $4, $5, $6, $7, $8)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(next_version)
    .bind(&layout)
    .bind(&version_metadata)
    .bind(created_by)
    .bind(&restore_label)
    .bind(version_number)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, "restore_workspace_version insert failed");
        return IoError::Database(e).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "restore_workspace_version commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(workspace_id = %id, restored_from = version_number, new_version = next_version, "Workspace version restored");
    Json(ApiResponse::ok(serde_json::json!({
        "version": next_version,
        "restored_from": version_number,
    }))).into_response()
}
```

### 7. `soft_delete_workspace_version` (NEW)

`DELETE /api/console/workspaces/:id/versions/:version_number`

```rust
pub async fn soft_delete_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET deleted_at = NOW()
            WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(version_number)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET deleted_at = NOW()
            WHERE workspace_id = $1 AND version_number = $2
              AND created_by = $3 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(version_number)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(workspace_id = %id, version = version_number, "Workspace version soft-deleted");
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response()
        }
        Ok(None) => IoError::NotFound(
            format!("Version {} of workspace {} not found or not owned by you", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "soft_delete_workspace_version query failed");
            IoError::Database(e).into_response()
        }
    }
}
```

### 8. `recover_workspace_version` (NEW, admin only)

`POST /api/console/workspaces/:id/versions/:version_number/recover`

```rust
pub async fn recover_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let result = match sqlx::query(
        r#"
        UPDATE workspace_versions SET deleted_at = NULL
        WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NOT NULL
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "recover_workspace_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(_) => {
            tracing::info!(workspace_id = %id, version = version_number, "Workspace version recovered");
            Json(ApiResponse::ok(serde_json::json!({ "recovered": true }))).into_response()
        }
        None => IoError::NotFound(
            format!("Soft-deleted version {} of workspace {} not found", version_number, id)
        ).into_response(),
    }
}
```

### 9. `permanent_delete_workspace_version` (NEW, admin only)

`DELETE /api/console/workspaces/:id/versions/:version_number/permanent`

```rust
pub async fn permanent_delete_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = match sqlx::query(
        r#"
        DELETE FROM workspace_versions
        WHERE workspace_id = $1 AND version_number = $2
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "permanent_delete_workspace_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(row) => {
            let version_uuid: Uuid = row.try_get("id").unwrap_or_default();

            let audit_meta = serde_json::json!({
                "workspace_id": id.to_string(),
                "version_number": version_number,
                "action": "permanent_delete",
            });
            let db = state.db.clone();
            tokio::spawn(async move {
                let _ = sqlx::query(
                    "INSERT INTO audit_log \
                     (id, table_name, action, record_id, user_id, changes) \
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(Uuid::new_v4())
                .bind("workspace_versions")
                .bind("version.permanent_delete")
                .bind(version_uuid)
                .bind(user_id)
                .bind(audit_meta)
                .execute(&db)
                .await;
            });

            tracing::info!(workspace_id = %id, version = version_number, "Workspace version permanently deleted");
            Json(ApiResponse::ok(
                serde_json::json!({ "permanently_deleted": true }),
            ))
            .into_response()
        }
        None => IoError::NotFound(
            format!("Version {} of workspace {} not found", version_number, id)
        ).into_response(),
    }
}
```

### 10. `update_workspace_version_label` (NEW)

`PATCH /api/console/workspaces/:id/versions/:version_number`

```rust
pub async fn update_workspace_version_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
    Json(body): Json<UpdateWorkspaceVersionLabelBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:write") {
        return IoError::Forbidden("console:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET label = $1
            WHERE workspace_id = $2 AND version_number = $3 AND deleted_at IS NULL
            RETURNING id, label
            "#,
        )
        .bind(&body.label)
        .bind(id)
        .bind(version_number)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET label = $1
            WHERE workspace_id = $2 AND version_number = $3
              AND created_by = $4 AND deleted_at IS NULL
            RETURNING id, label
            "#,
        )
        .bind(&body.label)
        .bind(id)
        .bind(version_number)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(row)) => {
            let label: Option<String> = row.try_get("label").ok().flatten();
            Json(ApiResponse::ok(serde_json::json!({
                "version_number": version_number,
                "label": label,
            }))).into_response()
        }
        Ok(None) => IoError::NotFound(
            format!("Version {} of workspace {} not found or not owned by you", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_workspace_version_label query failed");
            IoError::Database(e).into_response()
        }
    }
}
```

---

## Route Registration (`main.rs`)

Add these routes **inside the existing "Console workspaces" block** (after line ~495, after the `/duplicate` route). The `patch` import is NOT needed — Axum's `.patch()` method on `MethodRouter` works without importing the standalone `patch` function (same pattern already used on line 445 for `update_version_label`).

```rust
        // Workspace version routes — static sub-paths MUST come before parameterised :version_number
        .route(
            "/api/console/workspaces/:id/unpublish",
            post(handlers::console::unpublish_workspace),
        )
        .route(
            "/api/console/workspaces/:id/versions",
            get(handlers::console::list_workspace_versions),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number/restore",
            post(handlers::console::restore_workspace_version),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number/recover",
            post(handlers::console::recover_workspace_version),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number/permanent",
            delete(handlers::console::permanent_delete_workspace_version),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number",
            get(handlers::console::get_workspace_version_content)
                .delete(handlers::console::soft_delete_workspace_version)
                .patch(handlers::console::update_workspace_version_label),
        )
```

**Route ordering rationale**: Axum path parameters use greedy matching. The existing console workspace routes already follow the correct pattern: static sub-paths (`/publish`, `/share`, `/duplicate`) are before the parameterized `/:id` route. The new version routes follow the same pattern:
1. Static sub-paths (`/unpublish`, `/versions`) come first
2. Within version routes, static sub-paths (`/restore`, `/recover`, `/permanent`) come before the parameterized `/:version_number` route
3. All workspace version routes are placed **after** all existing workspace routes (after `/duplicate`) and **before** the `// Bookmarks` section

**Full route block after changes** (for context — shows where new routes go):

```rust
        // Console workspaces
        .route(
            "/api/console/workspaces",
            get(handlers::console::list_workspaces).post(handlers::console::create_workspace),
        )
        .route(
            "/api/console/workspaces/snapshots",
            post(handlers::console::create_workspace_snapshot),
        )
        .route(
            "/api/console/workspaces/:id",
            get(handlers::console::get_workspace)
                .put(handlers::console::update_workspace)
                .delete(handlers::console::delete_workspace),
        )
        .route(
            "/api/console/workspaces/:id/publish",
            post(handlers::console::publish_workspace),
        )
        .route(
            "/api/console/workspaces/:id/share",
            post(handlers::console::share_workspace),
        )
        .route(
            "/api/console/workspaces/:id/duplicate",
            post(handlers::console::duplicate_workspace),
        )
        // --- NEW ROUTES START ---
        .route(
            "/api/console/workspaces/:id/unpublish",
            post(handlers::console::unpublish_workspace),
        )
        .route(
            "/api/console/workspaces/:id/versions",
            get(handlers::console::list_workspace_versions),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number/restore",
            post(handlers::console::restore_workspace_version),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number/recover",
            post(handlers::console::recover_workspace_version),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number/permanent",
            delete(handlers::console::permanent_delete_workspace_version),
        )
        .route(
            "/api/console/workspaces/:id/versions/:version_number",
            get(handlers::console::get_workspace_version_content)
                .delete(handlers::console::soft_delete_workspace_version)
                .patch(handlers::console::update_workspace_version_label),
        )
        // --- NEW ROUTES END ---
        // Bookmarks
```

---

## Permission Mapping

| Operation | Permission | Rationale |
|-----------|-----------|-----------|
| List versions, get content | `console:read` | Read-only access; parallel to `designer:read` |
| Update workspace (save + snapshot), soft-delete version, update label | `console:write` | Write access; parallel to `designer:write` |
| Publish, unpublish | `console:workspace_publish` | Existing permission already used by `publish_workspace` |
| Recover soft-deleted version | Admin only (`is_admin`) | Admin-exclusive recovery |
| Permanent delete version | Admin only (`is_admin`) | Admin-exclusive destructive action |

**Note on `console:read` and `console:write`:** These permissions may not exist in the RBAC seed data. If they don't, the implementor should check by searching `design-docs/03` or the seed migration for console-related permissions. If only `console:workspace_publish` exists, then use no permission check (just authentication) for read operations and ownership checks for write operations — matching the current pattern where `update_workspace` and `delete_workspace` have no permission check, only ownership verification via `created_by = $2`. In that case:
- Replace `check_permission(&claims, "console:read")` with no permission gate (authenticated users can see their own workspace versions)
- Replace `check_permission(&claims, "console:write")` with no permission gate (ownership enforced by `created_by` check in query)

The existing console handlers (`update_workspace`, `delete_workspace`, `get_workspace`) do NOT use permission checks — they only verify ownership via `created_by`. Only `publish_workspace` uses `console:workspace_publish` and `create_workspace_snapshot` uses `console:video_export`. **Follow this pattern**: version read/write handlers should check ownership, not permissions. Admin overrides bypass ownership.

**Revised permission approach (recommended):**

```rust
// For list/get version handlers — no permission check, just auth + ownership
// The query itself filters by workspace_id which the user must own
// (or be admin to see all)

// For write handlers — no permission check, ownership via created_by in query
// Admin bypasses ownership check
```

If the implementor goes this route, then `console:read` and `console:write` are NOT used. The handlers mirror the existing no-permission-check pattern from `update_workspace`/`delete_workspace`/`get_workspace`. The plan code above uses `console:read`/`console:write` for safety, but the implementor should verify which pattern matches the codebase and adjust accordingly.

---

## Implementation Checklist

Complete in this order:

- [ ] **1.** Create `migrations/20260512000006_workspace_versions_fk_fix.up.sql` — change FK from `workspaces(id)` to `design_objects(id)`
- [ ] **2.** Create `migrations/20260512000006_workspace_versions_fk_fix.down.sql` — revert FK
- [ ] **3.** Run `sqlx migrate run` to apply the FK fix
- [ ] **4.** Add helper functions to `console.rs`: `is_admin`, `count_panes`, `count_workspace_bindings`, `compute_workspace_version_metadata`
- [ ] **5.** Add new structs to `console.rs`: `ListWorkspaceVersionsQuery`, `WorkspaceVersionSummary`, `WorkspaceVersionContent`, `UpdateWorkspaceVersionLabelBody`
- [ ] **6.** Update `WorkspaceSummary` struct: add `published: bool` field
- [ ] **7.** Update `UpdateWorkspaceBody` struct: add `label: Option<String>` field
- [ ] **8.** Update SQL in `list_workspaces`: add `published` to SELECT list; update `WorkspaceSummary` construction
- [ ] **9.** Update SQL in `create_workspace`: add `published` to RETURNING clause; update `WorkspaceSummary` construction
- [ ] **10.** Update SQL in `get_workspace`: add `published` to SELECT list; update `WorkspaceSummary` construction
- [ ] **11.** Update SQL in `update_workspace`: add `published` to RETURNING clause; update `WorkspaceSummary` construction
- [ ] **12.** Add `create_workspace_version_snapshot` shared async helper function
- [ ] **13.** Update `update_workspace` handler: add version snapshot creation block after save
- [ ] **14.** Rewrite `publish_workspace` handler: set `published = true` on top-level column + create version snapshot
- [ ] **15.** Add `unpublish_workspace` handler
- [ ] **16.** Add `list_workspace_versions` handler
- [ ] **17.** Add `get_workspace_version_content` handler
- [ ] **18.** Add `restore_workspace_version` handler
- [ ] **19.** Add `soft_delete_workspace_version` handler
- [ ] **20.** Add `recover_workspace_version` handler
- [ ] **21.** Add `permanent_delete_workspace_version` handler
- [ ] **22.** Add `update_workspace_version_label` handler
- [ ] **23.** Register all new routes in `main.rs` (after `/duplicate`, before `// Bookmarks`)
- [ ] **24.** Run `cargo build -p io-api-gateway` — must compile clean
- [ ] **25.** Run `cargo clippy -p io-api-gateway -- -D warnings` — must pass
- [ ] **26.** Verify route ordering: all static sub-paths before parameterized paths

---

## Compilation Verification

```bash
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p io-api-gateway
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo clippy -p io-api-gateway -- -D warnings
```

Both must pass with zero errors and zero warnings.

---

## Endpoint Summary

| Method | Route | Handler | Permission | Description |
|--------|-------|---------|------------|-------------|
| POST | `/api/console/workspaces/:id/publish` | `publish_workspace` (updated) | `console:workspace_publish` | Set published=true + version snapshot |
| POST | `/api/console/workspaces/:id/unpublish` | `unpublish_workspace` (new) | `console:workspace_publish` | Set published=false |
| PUT | `/api/console/workspaces/:id` | `update_workspace` (updated) | Ownership | Save + auto-create version snapshot |
| GET | `/api/console/workspaces/:id/versions` | `list_workspace_versions` (new) | Auth | List version history |
| GET | `/api/console/workspaces/:id/versions/:vn` | `get_workspace_version_content` (new) | Auth | Get full version content |
| POST | `/api/console/workspaces/:id/versions/:vn/restore` | `restore_workspace_version` (new) | Ownership | Restore version to live row |
| DELETE | `/api/console/workspaces/:id/versions/:vn` | `soft_delete_workspace_version` (new) | Ownership | Soft-delete a version |
| POST | `/api/console/workspaces/:id/versions/:vn/recover` | `recover_workspace_version` (new) | Admin only | Un-soft-delete a version |
| DELETE | `/api/console/workspaces/:id/versions/:vn/permanent` | `permanent_delete_workspace_version` (new) | Admin only | Hard delete + audit log |
| PATCH | `/api/console/workspaces/:id/versions/:vn` | `update_workspace_version_label` (new) | Ownership | Update version label |
| GET | `/api/console/workspaces` | `list_workspaces` (updated) | Auth | Now returns `published` field |
| GET | `/api/console/workspaces/:id` | `get_workspace` (updated) | Auth | Now returns `published` field |

---

## Key Differences from Phase 2 (Graphic Versioning)

| Aspect | Graphics (Phase 2) | Workspaces (Phase 3) |
|--------|-------------------|---------------------|
| Handler file | `graphics.rs` | `console.rs` |
| Version table | `design_object_versions` | `workspace_versions` |
| FK column | `design_object_id` | `workspace_id` (→ `design_objects.id`) |
| Content columns | `svg_data TEXT`, `bindings JSONB` | `layout JSONB` (stores full metadata blob) |
| Stats: element_count | Count of scene nodes (recursive) | Count of panes in `metadata.panes` array |
| Stats: binding_count | Count of point IDs in scene_data | Count of chart series + graphic bindings across panes |
| Auto-save guard | `__autosave_` prefix check on name | Not needed (no workspace auto-save) |
| Publish permission | `designer:publish` | `console:workspace_publish` |
| Write permission | `designer:write` | Ownership check (no permission gate) |
| Read permission | `designer:read` | Auth only (no permission gate) |
| URL prefix | `/api/v1/design-objects/:id/...` | `/api/console/workspaces/:id/...` |
| Existing publish handler | Set `published` column directly | Was setting `metadata.published` via `jsonb_set`; now changed to top-level column |
| Create snapshot block | `tokio::spawn` (background, non-fatal) | Same pattern |
