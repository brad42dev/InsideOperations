# Versioning Phase 2: Graphic Versioning Backend — Implementation Plan

## Scope

All backend API work for `design_objects` versioning as specified in `docs/architecture/versioning-and-publishing.md`. This phase assumes Task 1 (schema migrations) is complete — the four new migration files (`20260512000001` through `20260512000004`) exist and have been applied.

---

## Files Modified

| File | Action |
|------|--------|
| `services/api-gateway/src/handlers/graphics.rs` | Major: add 10 new handler functions, modify 3 existing handlers, add helper structs/functions |
| `services/api-gateway/src/main.rs` | Add 8 new route registrations, add `patch` to routing import |
| `migrations/20260512000005_version_type_check_fix.up.sql` | New: ALTER CHECK constraint on `design_object_versions.version_type` |
| `migrations/20260512000005_version_type_check_fix.down.sql` | New: Revert CHECK constraint |
| `services/api-gateway/src/handlers/iographic.rs` | Fix: change `"published"` to `"publish"` and `"draft"` to `"save"` at line ~2818 |

---

## Critical Design Decision: version_type Values

The existing `design_object_versions.version_type` CHECK constraint allows `('draft', 'publish')`. The architecture doc specifies `('save', 'publish')`. The iographic handler uses `"published"` which is a bug (violates the CHECK constraint).

**Resolution**: Align with the architecture doc. Create a migration to ALTER the CHECK constraint from `('draft', 'publish')` to `('save', 'publish')`. Also update any existing rows from `'draft'` to `'save'`. Fix the iographic handler to use `"publish"` and `"save"`.

---

## Migration 5: `20260512000005_version_type_check_fix`

**Up SQL** (`migrations/20260512000005_version_type_check_fix.up.sql`):
```sql
-- Update existing rows
UPDATE design_object_versions SET version_type = 'save' WHERE version_type = 'draft';
-- Drop the old constraint and add the new one
ALTER TABLE design_object_versions DROP CONSTRAINT IF EXISTS design_object_versions_version_type_check;
ALTER TABLE design_object_versions ADD CONSTRAINT design_object_versions_version_type_check CHECK (version_type IN ('save', 'publish'));
```

**Down SQL** (`migrations/20260512000005_version_type_check_fix.down.sql`):
```sql
UPDATE design_object_versions SET version_type = 'draft' WHERE version_type = 'save';
ALTER TABLE design_object_versions DROP CONSTRAINT IF EXISTS design_object_versions_version_type_check;
ALTER TABLE design_object_versions ADD CONSTRAINT design_object_versions_version_type_check CHECK (version_type IN ('draft', 'publish'));
```

---

## New Structs and Helpers (add to `graphics.rs`)

Add these after the existing struct definitions (after line ~116):

### Helper: `is_admin`

```rust
fn is_admin(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*")
}
```

### Helper: `count_scene_nodes`

Recursively count all nodes in the scene_data JSON. A "node" is any JSON object within a `"children"` array, counted recursively.

```rust
fn count_scene_nodes(scene_data: &JsonValue) -> i64 {
    fn count_recursive(val: &JsonValue) -> i64 {
        match val {
            JsonValue::Object(map) => {
                let mut count = 1i64;
                if let Some(children) = map.get("children").and_then(|v| v.as_array()) {
                    for child in children {
                        count += count_recursive(child);
                    }
                }
                count
            }
            _ => 0,
        }
    }
    count_recursive(scene_data)
}
```

### Helper: `count_point_bindings`

Reuses the existing `collect_point_ids` function:

```rust
fn count_point_bindings(scene_data: &JsonValue) -> i64 {
    collect_point_ids(scene_data).len() as i64
}
```

### Helper: `compute_version_metadata`

```rust
fn compute_version_metadata(
    scene_data: &Option<JsonValue>,
    existing_metadata: &Option<JsonValue>,
) -> JsonValue {
    let element_count = scene_data.as_ref().map(count_scene_nodes).unwrap_or(0);
    let binding_count = scene_data.as_ref().map(count_point_bindings).unwrap_or(0);

    let mut meta = existing_metadata.clone().unwrap_or(serde_json::json!({}));
    if let Some(obj) = meta.as_object_mut() {
        obj.insert("element_count".to_string(), serde_json::json!(element_count));
        obj.insert("binding_count".to_string(), serde_json::json!(binding_count));
    }
    meta
}
```

### Request/Response Structs

```rust
#[derive(Debug, Deserialize)]
pub struct ListVersionsQuery {
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct VersionSummary {
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
pub struct VersionContent {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub svg_data: String,
    #[serde(rename = "scene_data")]
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVersionLabelBody {
    pub label: Option<String>,
}
```

### Updated `GraphicDetail` Struct

Add `published: bool` field:

```rust
pub struct GraphicDetail {
    pub id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub svg_data: Option<String>,
    #[serde(rename = "scene_data")]
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub parent_id: Option<Uuid>,
    pub published: bool,           // NEW
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}
```

### Updated `row_to_detail` Helper

Add `published` field extraction:

```rust
fn row_to_detail(row: &sqlx::postgres::PgRow) -> Result<GraphicDetail, sqlx::Error> {
    // ... existing fields ...
    let published: bool = row.try_get("published").unwrap_or(false);
    Ok(GraphicDetail {
        // ... existing fields ...
        published,
        // ...
    })
}
```

### Updated SQL in Four Existing Handlers

Every query that uses `row_to_detail` must add `published` to the SELECT/RETURNING list:

1. `get_graphic` (~line 424): Add `published` to SELECT list
2. `get_design_object` (~line 1040): Add `published` to SELECT list
3. `create_graphic` (~line 348): Add `published` to RETURNING clause
4. `update_graphic` (~line 471): Add `published` to RETURNING clause

### Updated `UpsertDesignObjectBody`

Add optional `label` field for version notes:

```rust
pub struct UpsertDesignObjectBody {
    pub name: String,
    #[serde(rename = "type", default = "default_graphic_type")]
    pub object_type: String,
    pub svg_data: Option<String>,
    #[serde(alias = "scene_data")]
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub parent_id: Option<Uuid>,
    pub label: Option<String>,    // NEW: optional version label/notes
}
```

---

## Shared Helper: `create_version_snapshot`

This is the core shared helper used by multiple handlers. Add it as an `async fn` in `graphics.rs`:

```rust
/// Create an immutable version snapshot for a design object.
/// Uses advisory lock to prevent version_number races.
/// Returns the new version_number.
async fn create_version_snapshot(
    db: &sqlx::PgPool,
    design_object_id: Uuid,
    created_by: Uuid,
    version_type: &str,
    svg_data: &str,
    bindings: &Option<JsonValue>,
    metadata: &JsonValue,
    label: Option<String>,
) -> Result<i32, sqlx::Error> {
    let mut tx = db.begin().await?;

    // Advisory lock scoped to this transaction — prevents version_number races
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(design_object_id.to_string())
        .execute(&mut *tx)
        .await?;

    // Determine next version number and parent
    let (current_max, parent_version): (i32, Option<i32>) = sqlx::query_as(
        "SELECT COALESCE(MAX(version_number), 0), \
                CASE WHEN MAX(version_number) > 0 THEN MAX(version_number) ELSE NULL END \
         FROM design_object_versions \
         WHERE design_object_id = $1",
    )
    .bind(design_object_id)
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
        INSERT INTO design_object_versions
            (id, design_object_id, version_number, version_type, svg_data, bindings,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(design_object_id)
    .bind(next_version)
    .bind(version_type)
    .bind(svg_data)
    .bind(bindings)
    .bind(metadata)
    .bind(created_by)
    .bind(&effective_label)
    .bind(parent_version)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        graphic_id = %design_object_id,
        version = next_version,
        version_type = version_type,
        "Version snapshot created"
    );

    Ok(next_version)
}
```

---

## Handler Implementations

### 1. Update `update_graphic` (existing, ~line 455)

After the existing UPDATE query succeeds (after line ~499, before the tile rebuild block), add this version snapshot block:

```rust
    // Version snapshot — skip for auto-save rows
    let row_name: String = row.try_get("name").unwrap_or_default();
    if !row_name.starts_with("__autosave_") {
        let created_by = match claims.sub.parse::<Uuid>() {
            Ok(u) => u,
            Err(_) => {
                tracing::warn!("update_graphic: invalid user ID in token, skipping version snapshot");
                Uuid::nil()
            }
        };
        if !created_by.is_nil() {
            let scene_data_for_stats = row.try_get::<Option<JsonValue>, _>("bindings").ok().flatten();
            let existing_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
            let version_metadata = compute_version_metadata(&scene_data_for_stats, &existing_metadata);
            let svg_data_snap: String = row.try_get::<Option<String>, _>("svg_data").ok().flatten().unwrap_or_default();
            let bindings_snap: Option<JsonValue> = row.try_get("bindings").ok().flatten();
            let label = body.label.clone();

            let db = state.db.clone();
            tokio::spawn(async move {
                if let Err(e) = create_version_snapshot(
                    &db, id, created_by, "save", &svg_data_snap, &bindings_snap,
                    &version_metadata, label,
                ).await {
                    tracing::warn!(error = %e, graphic_id = %id, "Version snapshot creation failed (non-fatal)");
                }
            });
        }
    }
```

### 2. Update `publish_graphic` (existing, ~line 595)

Rewrite to: (a) set `published = true` on the live row, (b) create a version snapshot with `version_type = 'publish'`:

```rust
pub async fn publish_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:publish") {
        return IoError::Forbidden("designer:publish permission required".into()).into_response();
    }

    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let row = match sqlx::query(
        r#"
        UPDATE design_objects SET published = true WHERE id = $1
        RETURNING id, name, svg_data, bindings, metadata
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "publish_graphic fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let name: String = row.try_get("name").unwrap_or_default();
    if name.starts_with("__autosave_") {
        return IoError::BadRequest("Cannot publish an auto-save row".into()).into_response();
    }

    let svg_data: String = row.try_get::<Option<String>, _>("svg_data").ok().flatten().unwrap_or_default();
    let bindings: Option<JsonValue> = row.try_get("bindings").ok().flatten();
    let existing_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
    let version_metadata = compute_version_metadata(&bindings, &existing_metadata);

    match create_version_snapshot(
        &state.db, id, created_by, "publish", &svg_data, &bindings,
        &version_metadata, None,
    ).await {
        Ok(version) => {
            tracing::info!(graphic_id = %id, version = version, "Graphic published");
            Json(ApiResponse::ok(serde_json::json!({
                "version": version,
                "published": true,
            }))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "publish_graphic version snapshot failed");
            IoError::Database(e).into_response()
        }
    }
}
```

### 3. `unpublish_graphic` (NEW)

`POST /api/v1/design-objects/:id/unpublish`

```rust
pub async fn unpublish_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:publish") {
        return IoError::Forbidden("designer:publish permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 RETURNING id",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND created_by = $2 RETURNING id",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(graphic_id = %id, "Graphic unpublished");
            Json(ApiResponse::ok(serde_json::json!({ "published": false }))).into_response()
        }
        Ok(None) => IoError::NotFound(format!("Graphic {} not found or not owned by you", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "unpublish_graphic query failed");
            IoError::Database(e).into_response()
        }
    }
}
```

### 4. `list_versions` (NEW)

`GET /api/v1/design-objects/:id/versions`

```rust
pub async fn list_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListVersionsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    let include_deleted = query.include_deleted.unwrap_or(false) && is_admin(&claims);
    let deleted_filter = if include_deleted { "" } else { "AND v.deleted_at IS NULL" };

    let sql = format!(
        r#"
        SELECT v.id, v.version_number, v.version_type, v.label,
               v.parent_version_number, v.metadata, v.created_by,
               v.created_at, v.deleted_at,
               u.display_name AS created_by_name
        FROM design_object_versions v
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.design_object_id = $1 {deleted_filter}
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
            tracing::error!(error = %e, "list_versions query failed");
            return IoError::Database(e).into_response();
        }
    };

    let versions: Vec<VersionSummary> = rows.iter().filter_map(|row| {
        Some(VersionSummary {
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

### 5. `get_version_content` (NEW)

`GET /api/v1/design-objects/:id/versions/:version_number`

```rust
pub async fn get_version_content(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, version_number, version_type, label, parent_version_number,
               svg_data, bindings, metadata, created_by, created_at
        FROM design_object_versions
        WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(
            format!("Version {} of graphic {} not found", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_version_content query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content = VersionContent {
        id: row.try_get("id").unwrap_or_default(),
        version_number: row.try_get("version_number").unwrap_or(0),
        version_type: row.try_get("version_type").unwrap_or_default(),
        label: row.try_get("label").ok().flatten(),
        parent_version_number: row.try_get("parent_version_number").ok().flatten(),
        svg_data: row.try_get("svg_data").unwrap_or_default(),
        bindings: row.try_get("bindings").ok().flatten(),
        metadata: row.try_get("metadata").ok().flatten(),
        created_by: row.try_get("created_by").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(content)).into_response()
}
```

### 6. `restore_version` (NEW)

`POST /api/v1/design-objects/:id/versions/:version_number/restore`

```rust
pub async fn restore_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    // Fetch the version content
    let ver_row = match sqlx::query(
        r#"
        SELECT svg_data, bindings, metadata
        FROM design_object_versions
        WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(
            format!("Version {} of graphic {} not found", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "restore_version fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let svg_data: String = ver_row.try_get::<Option<String>, _>("svg_data").ok().flatten().unwrap_or_default();
    let bindings: Option<JsonValue> = ver_row.try_get("bindings").ok().flatten();
    let existing_metadata: Option<JsonValue> = ver_row.try_get("metadata").ok().flatten();

    // Update the live row with the restored content
    match sqlx::query(
        r#"
        UPDATE design_objects
        SET svg_data = $1, bindings = $2, metadata = $3
        WHERE id = $4
        RETURNING id
        "#,
    )
    .bind(&svg_data)
    .bind(&bindings)
    .bind(&existing_metadata)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(_)) => {}
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "restore_version update failed");
            return IoError::Database(e).into_response();
        }
    }

    // Create a new version snapshot at the top of the stack
    // parent_version_number points to the restored version (not the previous max)
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(error = %e, "restore_version begin transaction failed");
            return IoError::Database(e).into_response();
        }
    };

    if let Err(e) = sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
    {
        tracing::error!(error = %e, "restore_version advisory lock failed");
        return IoError::Database(e).into_response();
    }

    let next_version: i32 = match sqlx::query_scalar(
        "SELECT COALESCE(MAX(version_number), 0) + 1 FROM design_object_versions WHERE design_object_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "restore_version next_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    let version_metadata = compute_version_metadata(&bindings, &existing_metadata);
    let restore_label = format!("Restored from v{}", version_number);

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO design_object_versions
            (id, design_object_id, version_number, version_type, svg_data, bindings,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, 'save', $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(next_version)
    .bind(&svg_data)
    .bind(&bindings)
    .bind(&version_metadata)
    .bind(created_by)
    .bind(&restore_label)
    .bind(version_number)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, "restore_version insert failed");
        return IoError::Database(e).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "restore_version commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(graphic_id = %id, restored_from = version_number, new_version = next_version, "Version restored");
    Json(ApiResponse::ok(serde_json::json!({
        "version": next_version,
        "restored_from": version_number,
    }))).into_response()
}
```

### 7. `soft_delete_version` (NEW)

`DELETE /api/v1/design-objects/:id/versions/:version_number`

```rust
pub async fn soft_delete_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE design_object_versions SET deleted_at = NOW()
            WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NULL
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
            UPDATE design_object_versions SET deleted_at = NOW()
            WHERE design_object_id = $1 AND version_number = $2
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
            tracing::info!(graphic_id = %id, version = version_number, "Version soft-deleted");
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response()
        }
        Ok(None) => IoError::NotFound(
            format!("Version {} of graphic {} not found or not owned by you", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "soft_delete_version query failed");
            IoError::Database(e).into_response()
        }
    }
}
```

### 8. `recover_version` (NEW, admin only)

`POST /api/v1/design-objects/:id/versions/:version_number/recover`

```rust
pub async fn recover_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let result = match sqlx::query(
        r#"
        UPDATE design_object_versions SET deleted_at = NULL
        WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NOT NULL
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
            tracing::error!(error = %e, "recover_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(_) => {
            tracing::info!(graphic_id = %id, version = version_number, "Version recovered");
            Json(ApiResponse::ok(serde_json::json!({ "recovered": true }))).into_response()
        }
        None => IoError::NotFound(
            format!("Soft-deleted version {} of graphic {} not found", version_number, id)
        ).into_response(),
    }
}
```

### 9. `permanent_delete_version` (NEW, admin only)

`DELETE /api/v1/design-objects/:id/versions/:version_number/permanent`

```rust
pub async fn permanent_delete_version(
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
        DELETE FROM design_object_versions
        WHERE design_object_id = $1 AND version_number = $2
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
            tracing::error!(error = %e, "permanent_delete_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(row) => {
            let version_uuid: Uuid = row.try_get("id").unwrap_or_default();

            let audit_meta = serde_json::json!({
                "design_object_id": id.to_string(),
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
                .bind("design_object_versions")
                .bind("version.permanent_delete")
                .bind(version_uuid)
                .bind(user_id)
                .bind(audit_meta)
                .execute(&db)
                .await;
            });

            tracing::info!(graphic_id = %id, version = version_number, "Version permanently deleted");
            Json(ApiResponse::ok(serde_json::json!({ "permanently_deleted": true }))).into_response()
        }
        None => IoError::NotFound(
            format!("Version {} of graphic {} not found", version_number, id)
        ).into_response(),
    }
}
```

### 10. `update_version_label` (NEW)

`PATCH /api/v1/design-objects/:id/versions/:version_number`

```rust
pub async fn update_version_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
    Json(body): Json<UpdateVersionLabelBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE design_object_versions SET label = $1
            WHERE design_object_id = $2 AND version_number = $3 AND deleted_at IS NULL
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
            UPDATE design_object_versions SET label = $1
            WHERE design_object_id = $2 AND version_number = $3
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
            format!("Version {} of graphic {} not found or not owned by you", version_number, id)
        ).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_version_label query failed");
            IoError::Database(e).into_response()
        }
    }
}
```

---

## Route Registration (`main.rs`)

**Step 1**: Add `patch` to the routing import (line ~6):
```rust
    routing::{any, delete, get, patch, post, put},
```

**Step 2**: Add these routes. They MUST be placed **before** the parameterized `/api/v1/design-objects/:id` route. Insert after the publish route and before the `:id` route:

```rust
        .route(
            "/api/v1/design-objects/:id/unpublish",
            post(handlers::graphics::unpublish_graphic),
        )
        .route(
            "/api/v1/design-objects/:id/versions",
            get(handlers::graphics::list_versions),
        )
        // Static sub-paths MUST come before parameterised :version_number routes
        .route(
            "/api/v1/design-objects/:id/versions/:version_number/restore",
            post(handlers::graphics::restore_version),
        )
        .route(
            "/api/v1/design-objects/:id/versions/:version_number/recover",
            post(handlers::graphics::recover_version),
        )
        .route(
            "/api/v1/design-objects/:id/versions/:version_number/permanent",
            delete(handlers::graphics::permanent_delete_version),
        )
        .route(
            "/api/v1/design-objects/:id/versions/:version_number",
            get(handlers::graphics::get_version_content)
                .delete(handlers::graphics::soft_delete_version)
                .patch(handlers::graphics::update_version_label),
        )
```

**Route ordering rationale**: Axum path parameters use greedy matching. Static sub-paths (`/restore`, `/recover`, `/permanent`) MUST be registered before the parameterized `/:version_number` route to avoid conflicts.

---

## Fix in `iographic.rs` (~line 2818)

Change:
```rust
    let version_type = if options.import_as == "published" {
        "published"
    } else {
        "draft"
    };
```
To:
```rust
    let version_type = if options.import_as == "published" {
        "publish"
    } else {
        "save"
    };
```

---

## Implementation Checklist

Complete in this order:

- [ ] **1.** Create `migrations/20260512000005_version_type_check_fix.up.sql` with CHECK constraint ALTER + data migration
- [ ] **2.** Create `migrations/20260512000005_version_type_check_fix.down.sql` with revert
- [ ] **3.** Fix `iographic.rs` ~line 2818: `"published"` → `"publish"`, `"draft"` → `"save"`
- [ ] **4.** Add helper functions to `graphics.rs`: `is_admin`, `count_scene_nodes`, `count_point_bindings`, `compute_version_metadata`
- [ ] **5.** Add new structs to `graphics.rs`: `ListVersionsQuery`, `VersionSummary`, `VersionContent`, `UpdateVersionLabelBody`
- [ ] **6.** Update `GraphicDetail` struct: add `published: bool` field
- [ ] **7.** Update `row_to_detail`: extract `published` from row
- [ ] **8.** Update SQL in `get_graphic`: add `published` to SELECT list
- [ ] **9.** Update SQL in `get_design_object`: add `published` to SELECT list
- [ ] **10.** Update SQL in `create_graphic`: add `published` to RETURNING clause
- [ ] **11.** Update SQL in `update_graphic`: add `published` to RETURNING clause
- [ ] **12.** Add `label: Option<String>` to `UpsertDesignObjectBody`
- [ ] **13.** Add `create_version_snapshot` shared async helper function
- [ ] **14.** Update `update_graphic` handler: add version snapshot creation block after save (with `__autosave_` guard)
- [ ] **15.** Rewrite `publish_graphic` handler: set `published = true` + create version snapshot via shared helper
- [ ] **16.** Add `unpublish_graphic` handler
- [ ] **17.** Add `list_versions` handler
- [ ] **18.** Add `get_version_content` handler
- [ ] **19.** Add `restore_version` handler
- [ ] **20.** Add `soft_delete_version` handler
- [ ] **21.** Add `recover_version` handler
- [ ] **22.** Add `permanent_delete_version` handler
- [ ] **23.** Add `update_version_label` handler
- [ ] **24.** Update `main.rs` routing import: add `patch`
- [ ] **25.** Register all new routes in `main.rs` (after `/publish`, before `/:id`)
- [ ] **26.** Run `cargo build -p io-api-gateway` — must compile clean
- [ ] **27.** Run `cargo clippy -p io-api-gateway -- -D warnings` — must pass
- [ ] **28.** Verify route ordering: all static sub-paths before parameterized paths

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
| POST | `/api/v1/design-objects/:id/publish` | `publish_graphic` (updated) | `designer:publish` | Set published=true + version snapshot |
| POST | `/api/v1/design-objects/:id/unpublish` | `unpublish_graphic` (new) | `designer:publish` | Set published=false |
| PUT | `/api/v1/design-objects/:id` | `update_graphic` (updated) | `designer:write` | Save + auto-create version snapshot |
| GET | `/api/v1/design-objects/:id/versions` | `list_versions` (new) | `designer:read` | List version history |
| GET | `/api/v1/design-objects/:id/versions/:vn` | `get_version_content` (new) | `designer:read` | Get full version content |
| POST | `/api/v1/design-objects/:id/versions/:vn/restore` | `restore_version` (new) | `designer:write` | Restore version to live row |
| DELETE | `/api/v1/design-objects/:id/versions/:vn` | `soft_delete_version` (new) | `designer:write` | Soft-delete a version |
| POST | `/api/v1/design-objects/:id/versions/:vn/recover` | `recover_version` (new) | Admin only | Un-soft-delete a version |
| DELETE | `/api/v1/design-objects/:id/versions/:vn/permanent` | `permanent_delete_version` (new) | Admin only | Hard delete + audit log |
| PATCH | `/api/v1/design-objects/:id/versions/:vn` | `update_version_label` (new) | `designer:write` | Update version label |
| GET | `/api/v1/design-objects/:id` | `get_design_object` (updated) | `designer:read` | Now returns `published` field |
