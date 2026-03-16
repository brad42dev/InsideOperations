//! Bulk Update and Change Snapshots handlers (doc 25).
//!
//! Endpoints:
//!   GET    /api/snapshots                         — list snapshots (paginated)
//!   POST   /api/snapshots                         — create manual snapshot
//!   GET    /api/snapshots/:id                     — get snapshot with row data
//!   DELETE /api/snapshots/:id                     — delete snapshot
//!   POST   /api/snapshots/:id/restore             — restore snapshot
//!   GET    /api/bulk-update/template/:target_type — download CSV template
//!   POST   /api/bulk-update/preview               — diff preview (multipart CSV)
//!   POST   /api/bulk-update/apply                 — apply changes (multipart CSV)
//!
//! Permission required: `settings:write`

use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PagedResponse, PageParams};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

fn user_id(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

// ---------------------------------------------------------------------------
// Supported target types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
enum TargetType {
    Users,
    OpcSources,
    AlarmDefinitions,
    ImportConnections,
}

impl TargetType {
    fn from_str(s: &str) -> Option<Self> {
        match s {
            "users" => Some(Self::Users),
            "opc_sources" => Some(Self::OpcSources),
            "alarm_definitions" => Some(Self::AlarmDefinitions),
            "import_connections" => Some(Self::ImportConnections),
            _ => None,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Users => "users",
            Self::OpcSources => "opc_sources",
            Self::AlarmDefinitions => "alarm_definitions",
            Self::ImportConnections => "import_connections",
        }
    }

    /// CSV header row for this target type.
    fn csv_headers(&self) -> &'static str {
        match self {
            Self::Users => "id,username,full_name,email,enabled",
            Self::OpcSources => "id,name,endpoint_url,enabled",
            Self::AlarmDefinitions => "id,name,point_tag,high_high,high,low,low_low,enabled",
            Self::ImportConnections => "id,name,connector_type,enabled",
        }
    }
}

// ---------------------------------------------------------------------------
// Snapshot row types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct SnapshotRow {
    pub id: Uuid,
    pub target_type: String,
    pub label: Option<String>,
    pub row_count: i32,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SnapshotDetail {
    pub id: Uuid,
    pub target_type: String,
    pub label: Option<String>,
    pub row_count: i32,
    pub snapshot_data: JsonValue,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateSnapshotBody {
    pub target_type: String,
    pub label: Option<String>,
}

// ---------------------------------------------------------------------------
// Diff types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct DiffPreview {
    pub added: Vec<JsonValue>,
    pub modified: Vec<ModifiedRow>,
    pub removed: Vec<JsonValue>,
    pub unchanged_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ModifiedRow {
    pub id: String,
    pub before: JsonValue,
    pub after: JsonValue,
    pub changed_fields: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ApplySummary {
    pub snapshot_id: Uuid,
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
    pub unchanged: usize,
}

// ---------------------------------------------------------------------------
// CSV parsing helpers
// ---------------------------------------------------------------------------

/// Parse a simple CSV string into a Vec of header→value maps.
/// Handles quoted fields (double-quote escaping only — sufficient for admin data).
fn parse_csv(text: &str) -> Option<Vec<std::collections::HashMap<String, String>>> {
    let mut lines = text.lines().filter(|l| !l.trim().is_empty());
    let header_line = lines.next()?;
    let headers: Vec<String> = split_csv_line(header_line);

    let mut rows = Vec::new();
    for line in lines {
        let values = split_csv_line(line);
        if values.len() != headers.len() {
            // tolerate trailing empty columns
            let mut map = std::collections::HashMap::new();
            for (i, h) in headers.iter().enumerate() {
                map.insert(h.clone(), values.get(i).cloned().unwrap_or_default());
            }
            rows.push(map);
        } else {
            let map: std::collections::HashMap<String, String> =
                headers.iter().cloned().zip(values).collect();
            rows.push(map);
        }
    }
    Some(rows)
}

fn split_csv_line(line: &str) -> Vec<String> {
    let mut fields: Vec<String> = Vec::new();
    let mut cur = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' => {
                if in_quotes {
                    // Check for escaped double-quote
                    if chars.peek() == Some(&'"') {
                        chars.next();
                        cur.push('"');
                    } else {
                        in_quotes = false;
                    }
                } else {
                    in_quotes = true;
                }
            }
            ',' if !in_quotes => {
                fields.push(cur.trim().to_string());
                cur = String::new();
            }
            other => cur.push(other),
        }
    }
    fields.push(cur.trim().to_string());
    fields
}

// ---------------------------------------------------------------------------
// Database helpers — snapshot a target type into JSONB
// ---------------------------------------------------------------------------

async fn snapshot_target(
    db: &sqlx::PgPool,
    tt: &TargetType,
    label: Option<&str>,
    created_by: Option<Uuid>,
) -> Result<Uuid, IoError> {
    let rows: Vec<JsonValue> = fetch_current_rows(db, tt).await?;
    let row_count = rows.len() as i32;
    let data = serde_json::to_value(&rows)
        .map_err(|e| IoError::Internal(format!("serialize snapshot: {e}")))?;

    let id = Uuid::new_v4();
    sqlx::query(
        r#"INSERT INTO change_snapshots (id, target_type, label, row_count, snapshot_data, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(id)
    .bind(tt.as_str())
    .bind(label)
    .bind(row_count)
    .bind(&data)
    .bind(created_by)
    .execute(db)
    .await
    .map_err(IoError::Database)?;

    Ok(id)
}

async fn fetch_current_rows(db: &sqlx::PgPool, tt: &TargetType) -> Result<Vec<JsonValue>, IoError> {
    match tt {
        TargetType::Users => {
            let rows = sqlx::query(
                "SELECT id, username, full_name, email, enabled FROM users ORDER BY username",
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let username: String = r.try_get("username").unwrap_or_default();
                    let full_name: Option<String> = r.try_get("full_name").ok().flatten();
                    let email: String = r.try_get("email").unwrap_or_default();
                    let enabled: bool = r.try_get("enabled").unwrap_or(true);
                    Ok(json!({
                        "id": id.to_string(),
                        "username": username,
                        "full_name": full_name,
                        "email": email,
                        "enabled": enabled,
                    }))
                })
                .collect()
        }
        TargetType::OpcSources => {
            let rows = sqlx::query(
                "SELECT id, name, endpoint_url, enabled FROM opc_sources ORDER BY name",
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let name: String = r.try_get("name").unwrap_or_default();
                    let endpoint_url: String = r.try_get("endpoint_url").unwrap_or_default();
                    let enabled: bool = r.try_get("enabled").unwrap_or(true);
                    Ok(json!({
                        "id": id.to_string(),
                        "name": name,
                        "endpoint_url": endpoint_url,
                        "enabled": enabled,
                    }))
                })
                .collect()
        }
        TargetType::AlarmDefinitions => {
            let rows = sqlx::query(
                r#"SELECT id, name, point_tag, high_high, high, low, low_low, enabled
                   FROM alarm_definitions ORDER BY name"#,
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let name: String = r.try_get("name").unwrap_or_default();
                    let point_tag: String = r.try_get("point_tag").unwrap_or_default();
                    let high_high: Option<f64> = r.try_get("high_high").ok().flatten();
                    let high: Option<f64> = r.try_get("high").ok().flatten();
                    let low: Option<f64> = r.try_get("low").ok().flatten();
                    let low_low: Option<f64> = r.try_get("low_low").ok().flatten();
                    let enabled: bool = r.try_get("enabled").unwrap_or(true);
                    Ok(json!({
                        "id": id.to_string(),
                        "name": name,
                        "point_tag": point_tag,
                        "high_high": high_high,
                        "high": high,
                        "low": low,
                        "low_low": low_low,
                        "enabled": enabled,
                    }))
                })
                .collect()
        }
        TargetType::ImportConnections => {
            let rows = sqlx::query(
                "SELECT id, name, connector_type, enabled FROM import_connections ORDER BY name",
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let name: String = r.try_get("name").unwrap_or_default();
                    let connector_type: String = r.try_get("connector_type").unwrap_or_default();
                    let enabled: bool = r.try_get("enabled").unwrap_or(true);
                    Ok(json!({
                        "id": id.to_string(),
                        "name": name,
                        "connector_type": connector_type,
                        "enabled": enabled,
                    }))
                })
                .collect()
        }
    }
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

fn compute_diff(current: &[JsonValue], incoming: &[JsonValue], tt: &TargetType) -> DiffPreview {
    use std::collections::HashMap;

    // Build a map of id → row for current data
    let current_map: HashMap<String, &JsonValue> = current
        .iter()
        .filter_map(|r| r.get("id").and_then(|v| v.as_str()).map(|id| (id.to_string(), r)))
        .collect();

    let incoming_map: HashMap<String, &JsonValue> = incoming
        .iter()
        .filter_map(|r| r.get("id").and_then(|v| v.as_str()).map(|id| (id.to_string(), r)))
        .collect();

    let mutable_fields: &[&str] = match tt {
        TargetType::Users => &["username", "full_name", "email", "enabled"],
        TargetType::OpcSources => &["name", "endpoint_url", "enabled"],
        TargetType::AlarmDefinitions => &["name", "point_tag", "high_high", "high", "low", "low_low", "enabled"],
        TargetType::ImportConnections => &["name", "connector_type", "enabled"],
    };

    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut removed = Vec::new();
    let mut unchanged_count = 0usize;

    // Check incoming rows
    for (id, inc_row) in &incoming_map {
        if let Some(cur_row) = current_map.get(id) {
            // Compare mutable fields
            let changed_fields: Vec<String> = mutable_fields
                .iter()
                .filter(|&&f| {
                    let cur_val = cur_row.get(f);
                    let inc_val = inc_row.get(f);
                    cur_val != inc_val
                })
                .map(|f| f.to_string())
                .collect();

            if changed_fields.is_empty() {
                unchanged_count += 1;
            } else {
                modified.push(ModifiedRow {
                    id: id.clone(),
                    before: (*cur_row).clone(),
                    after: (*inc_row).clone(),
                    changed_fields,
                });
            }
        } else {
            // New row (no id match in current)
            added.push((*inc_row).clone());
        }
    }

    // Check for removed rows (in current but not in incoming)
    for (id, cur_row) in &current_map {
        if !incoming_map.contains_key(id) {
            removed.push((*cur_row).clone());
        }
    }

    DiffPreview { added, modified, removed, unchanged_count }
}

// ---------------------------------------------------------------------------
// CSV row → JsonValue conversion
// ---------------------------------------------------------------------------

fn csv_row_to_json(
    row: &std::collections::HashMap<String, String>,
    tt: &TargetType,
) -> JsonValue {
    match tt {
        TargetType::Users => json!({
            "id": row.get("id").cloned().unwrap_or_default(),
            "username": row.get("username").cloned().unwrap_or_default(),
            "full_name": row.get("full_name").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "email": row.get("email").cloned().unwrap_or_default(),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::OpcSources => json!({
            "id": row.get("id").cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "endpoint_url": row.get("endpoint_url").cloned().unwrap_or_default(),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::AlarmDefinitions => json!({
            "id": row.get("id").cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "point_tag": row.get("point_tag").cloned().unwrap_or_default(),
            "high_high": row.get("high_high").and_then(|v| v.parse::<f64>().ok()),
            "high": row.get("high").and_then(|v| v.parse::<f64>().ok()),
            "low": row.get("low").and_then(|v| v.parse::<f64>().ok()),
            "low_low": row.get("low_low").and_then(|v| v.parse::<f64>().ok()),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::ImportConnections => json!({
            "id": row.get("id").cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "connector_type": row.get("connector_type").cloned().unwrap_or_default(),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
    }
}

// ---------------------------------------------------------------------------
// Apply changes to the database
// ---------------------------------------------------------------------------

async fn apply_diff(
    db: &sqlx::PgPool,
    diff: &DiffPreview,
    tt: &TargetType,
) -> Result<(), IoError> {
    // Apply modifications
    for modrow in &diff.modified {
        apply_update(db, tt, &modrow.after).await?;
    }
    // Note: adds and removes are intentionally not applied in this implementation
    // because the bulk update workflow is designed for modifying existing records only.
    // New rows and deletions require explicit intent and are surfaced in the diff for
    // admin review but not auto-applied.
    Ok(())
}

async fn apply_update(db: &sqlx::PgPool, tt: &TargetType, row: &JsonValue) -> Result<(), IoError> {
    let id_str = row.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let id = Uuid::parse_str(id_str)
        .map_err(|_| IoError::BadRequest(format!("Invalid UUID in row: {}", id_str)))?;

    match tt {
        TargetType::Users => {
            let username = row.get("username").and_then(|v| v.as_str()).unwrap_or("");
            let full_name = row.get("full_name").and_then(|v| v.as_str());
            let email = row.get("email").and_then(|v| v.as_str()).unwrap_or("");
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            sqlx::query(
                "UPDATE users SET username=$1, full_name=$2, email=$3, enabled=$4 WHERE id=$5",
            )
            .bind(username)
            .bind(full_name)
            .bind(email)
            .bind(enabled)
            .bind(id)
            .execute(db)
            .await
            .map_err(IoError::Database)?;
        }
        TargetType::OpcSources => {
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let endpoint_url = row.get("endpoint_url").and_then(|v| v.as_str()).unwrap_or("");
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            sqlx::query(
                "UPDATE opc_sources SET name=$1, endpoint_url=$2, enabled=$3 WHERE id=$4",
            )
            .bind(name)
            .bind(endpoint_url)
            .bind(enabled)
            .bind(id)
            .execute(db)
            .await
            .map_err(IoError::Database)?;
        }
        TargetType::AlarmDefinitions => {
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let point_tag = row.get("point_tag").and_then(|v| v.as_str()).unwrap_or("");
            let high_high = row.get("high_high").and_then(|v| v.as_f64());
            let high = row.get("high").and_then(|v| v.as_f64());
            let low = row.get("low").and_then(|v| v.as_f64());
            let low_low = row.get("low_low").and_then(|v| v.as_f64());
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            sqlx::query(
                r#"UPDATE alarm_definitions
                   SET name=$1, point_tag=$2, high_high=$3, high=$4, low=$5, low_low=$6, enabled=$7
                   WHERE id=$8"#,
            )
            .bind(name)
            .bind(point_tag)
            .bind(high_high)
            .bind(high)
            .bind(low)
            .bind(low_low)
            .bind(enabled)
            .bind(id)
            .execute(db)
            .await
            .map_err(IoError::Database)?;
        }
        TargetType::ImportConnections => {
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let connector_type = row.get("connector_type").and_then(|v| v.as_str()).unwrap_or("");
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            sqlx::query(
                "UPDATE import_connections SET name=$1, connector_type=$2, enabled=$3 WHERE id=$4",
            )
            .bind(name)
            .bind(connector_type)
            .bind(enabled)
            .bind(id)
            .execute(db)
            .await
            .map_err(IoError::Database)?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Restore helpers
// ---------------------------------------------------------------------------

async fn restore_snapshot_rows(
    db: &sqlx::PgPool,
    tt: &TargetType,
    rows: &[JsonValue],
) -> Result<(), IoError> {
    for row in rows {
        apply_update(db, tt, row).await?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Extract CSV from multipart
// ---------------------------------------------------------------------------

async fn extract_csv_and_target(
    multipart: &mut Multipart,
) -> Result<(String, TargetType), Response> {
    let mut csv_text: Option<String> = None;
    let mut target_type_str: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("file") => {
                match field.bytes().await {
                    Ok(bytes) => {
                        let text = String::from_utf8(bytes.to_vec())
                            .map_err(|_| IoError::BadRequest("CSV file must be UTF-8".into()).into_response())?;
                        csv_text = Some(text);
                    }
                    Err(_) => {
                        return Err(IoError::BadRequest("Failed to read CSV file".into()).into_response());
                    }
                }
            }
            Some("target_type") => {
                if let Ok(t) = field.text().await {
                    target_type_str = Some(t);
                }
            }
            _ => {}
        }
    }

    let csv = csv_text.ok_or_else(|| IoError::BadRequest("No 'file' field in multipart".into()).into_response())?;
    let tt_str = target_type_str.ok_or_else(|| IoError::BadRequest("No 'target_type' field in multipart".into()).into_response())?;
    let tt = TargetType::from_str(&tt_str)
        .ok_or_else(|| IoError::BadRequest(format!("Unknown target_type: {}", tt_str)).into_response())?;

    Ok((csv, tt))
}

// ---------------------------------------------------------------------------
// GET /api/snapshots
// ---------------------------------------------------------------------------

pub async fn list_snapshots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") && !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    let page = params.page();
    let limit = params.limit();
    let offset = params.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM change_snapshots")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let rows = match sqlx::query(
        r#"SELECT id, target_type, label, row_count, created_by, created_at
           FROM change_snapshots
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let items: Vec<SnapshotRow> = rows
        .iter()
        .map(|r| SnapshotRow {
            id: r.try_get("id").unwrap_or_default(),
            target_type: r.try_get("target_type").unwrap_or_default(),
            label: r.try_get("label").ok().flatten(),
            row_count: r.try_get("row_count").unwrap_or(0),
            created_by: r.try_get("created_by").ok().flatten(),
            created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
        })
        .collect();

    Json(PagedResponse::new(items, page, limit, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/snapshots
// ---------------------------------------------------------------------------

pub async fn create_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSnapshotBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    let tt = match TargetType::from_str(&body.target_type) {
        Some(t) => t,
        None => {
            return IoError::BadRequest(format!("Unknown target_type: {}", body.target_type))
                .into_response()
        }
    };

    let uid = user_id(&claims);
    match snapshot_target(&state.db, &tt, body.label.as_deref(), uid).await {
        Ok(id) => Json(ApiResponse::ok(json!({ "id": id.to_string() }))).into_response(),
        Err(e) => e.into_response(),
    }
}

// ---------------------------------------------------------------------------
// GET /api/snapshots/:id
// ---------------------------------------------------------------------------

pub async fn get_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") && !check_permission(&claims, "settings:read") {
        return IoError::Forbidden("settings:read permission required".into()).into_response();
    }

    match sqlx::query(
        "SELECT id, target_type, label, row_count, snapshot_data, created_by, created_at FROM change_snapshots WHERE id=$1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => {
            let detail = SnapshotDetail {
                id: r.try_get("id").unwrap_or_default(),
                target_type: r.try_get("target_type").unwrap_or_default(),
                label: r.try_get("label").ok().flatten(),
                row_count: r.try_get("row_count").unwrap_or(0),
                snapshot_data: r.try_get("snapshot_data").unwrap_or(JsonValue::Array(vec![])),
                created_by: r.try_get("created_by").ok().flatten(),
                created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
            };
            Json(ApiResponse::ok(detail)).into_response()
        }
        Ok(None) => IoError::NotFound(format!("Snapshot {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/snapshots/:id
// ---------------------------------------------------------------------------

pub async fn delete_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    match sqlx::query("DELETE FROM change_snapshots WHERE id=$1")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Snapshot {} not found", id)).into_response()
        }
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /api/snapshots/:id/restore
// ---------------------------------------------------------------------------

pub async fn restore_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    // 1. Load the snapshot to restore
    let snap_row = match sqlx::query(
        "SELECT target_type, snapshot_data FROM change_snapshots WHERE id=$1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Snapshot {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let target_type_str: String = snap_row.try_get("target_type").unwrap_or_default();
    let snapshot_data: JsonValue = snap_row.try_get("snapshot_data").unwrap_or(JsonValue::Array(vec![]));

    let tt = match TargetType::from_str(&target_type_str) {
        Some(t) => t,
        None => {
            return IoError::BadRequest(format!("Unknown target_type in snapshot: {}", target_type_str))
                .into_response()
        }
    };

    let uid = user_id(&claims);

    // 2. Create a safety snapshot of current state before overwriting
    let safety_snapshot_id = match snapshot_target(
        &state.db,
        &tt,
        Some(&format!("pre-restore-{}", id)),
        uid,
    )
    .await
    {
        Ok(sid) => sid,
        Err(e) => return e.into_response(),
    };

    // 3. Apply the snapshot rows
    let rows = match snapshot_data.as_array() {
        Some(arr) => arr.as_slice().to_vec(),
        None => vec![],
    };

    if let Err(e) = restore_snapshot_rows(&state.db, &tt, &rows).await {
        return e.into_response();
    }

    Json(ApiResponse::ok(json!({
        "restored_snapshot_id": id.to_string(),
        "safety_snapshot_id": safety_snapshot_id.to_string(),
        "rows_restored": rows.len(),
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/bulk-update/template/:target_type
// ---------------------------------------------------------------------------

pub async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(target_type): Path<String>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    let tt = match TargetType::from_str(&target_type) {
        Some(t) => t,
        None => {
            return IoError::BadRequest(format!("Unknown target_type: {}", target_type))
                .into_response()
        }
    };

    // Fetch current rows and build CSV
    let rows = match fetch_current_rows(&state.db, &tt).await {
        Ok(r) => r,
        Err(e) => return e.into_response(),
    };

    let mut csv = String::new();
    csv.push_str(tt.csv_headers());
    csv.push('\n');

    for row in &rows {
        let line = match &tt {
            TargetType::Users => format!(
                "{},{},{},{},{}",
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("username").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("full_name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("email").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::OpcSources => format!(
                "{},{},{},{}",
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("endpoint_url").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::AlarmDefinitions => format!(
                "{},{},{},{},{},{},{},{}",
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("point_tag").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("high_high").and_then(|v| v.as_f64()).map(|f| f.to_string()).unwrap_or_default(),
                row.get("high").and_then(|v| v.as_f64()).map(|f| f.to_string()).unwrap_or_default(),
                row.get("low").and_then(|v| v.as_f64()).map(|f| f.to_string()).unwrap_or_default(),
                row.get("low_low").and_then(|v| v.as_f64()).map(|f| f.to_string()).unwrap_or_default(),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::ImportConnections => format!(
                "{},{},{},{}",
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("connector_type").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
        };
        csv.push_str(&line);
        csv.push('\n');
    }

    let filename = format!("{}-bulk-update.csv", tt.as_str());
    let content_disposition = format!("attachment; filename=\"{}\"", filename);

    let mut response = Response::new(Body::from(csv));
    *response.status_mut() = StatusCode::OK;
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, HeaderValue::from_static("text/csv; charset=utf-8"));
    if let Ok(val) = HeaderValue::from_str(&content_disposition) {
        response.headers_mut().insert(header::CONTENT_DISPOSITION, val);
    }
    response
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

// ---------------------------------------------------------------------------
// POST /api/bulk-update/preview
// ---------------------------------------------------------------------------

pub async fn preview_bulk_update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    let (csv_text, tt) = match extract_csv_and_target(&mut multipart).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let csv_rows = match parse_csv(&csv_text) {
        Some(r) => r,
        None => return IoError::BadRequest("Could not parse CSV — empty or malformed".into()).into_response(),
    };

    let incoming: Vec<JsonValue> = csv_rows.iter().map(|r| csv_row_to_json(r, &tt)).collect();

    let current = match fetch_current_rows(&state.db, &tt).await {
        Ok(r) => r,
        Err(e) => return e.into_response(),
    };

    let diff = compute_diff(&current, &incoming, &tt);
    Json(ApiResponse::ok(diff)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/bulk-update/apply
// ---------------------------------------------------------------------------

pub async fn apply_bulk_update(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    let (csv_text, tt) = match extract_csv_and_target(&mut multipart).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let csv_rows = match parse_csv(&csv_text) {
        Some(r) => r,
        None => return IoError::BadRequest("Could not parse CSV — empty or malformed".into()).into_response(),
    };

    let incoming: Vec<JsonValue> = csv_rows.iter().map(|r| csv_row_to_json(r, &tt)).collect();

    let current = match fetch_current_rows(&state.db, &tt).await {
        Ok(r) => r,
        Err(e) => return e.into_response(),
    };

    let diff = compute_diff(&current, &incoming, &tt);

    // Create safety snapshot before applying
    let uid = user_id(&claims);
    let snapshot_id = match snapshot_target(&state.db, &tt, Some("pre-bulk-update"), uid).await {
        Ok(id) => id,
        Err(e) => return e.into_response(),
    };

    let added_count = diff.added.len();
    let modified_count = diff.modified.len();
    let removed_count = diff.removed.len();
    let unchanged = diff.unchanged_count;

    if let Err(e) = apply_diff(&state.db, &diff, &tt).await {
        return e.into_response();
    }

    Json(ApiResponse::ok(ApplySummary {
        snapshot_id,
        added: added_count,
        modified: modified_count,
        removed: removed_count,
        unchanged,
    }))
    .into_response()
}
