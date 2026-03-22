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
use calamine::{open_workbook_from_rs, Data, Reader, Xlsx};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PagedResponse, PageParams};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use std::io::Cursor;
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
    PointsMetadata,
    UserRoles,
    ApplicationSettings,
    PointSources,
    DashboardMetadata,
    ImportDefinitions,
}

impl TargetType {
    fn from_str(s: &str) -> Option<Self> {
        match s {
            "users" => Some(Self::Users),
            "opc_sources" => Some(Self::OpcSources),
            "alarm_definitions" => Some(Self::AlarmDefinitions),
            "import_connections" => Some(Self::ImportConnections),
            "points_metadata" => Some(Self::PointsMetadata),
            "user_roles" => Some(Self::UserRoles),
            "application_settings" => Some(Self::ApplicationSettings),
            "point_sources" => Some(Self::PointSources),
            "dashboard_metadata" => Some(Self::DashboardMetadata),
            "import_definitions" => Some(Self::ImportDefinitions),
            _ => None,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Users => "users",
            Self::OpcSources => "opc_sources",
            Self::AlarmDefinitions => "alarm_definitions",
            Self::ImportConnections => "import_connections",
            Self::PointsMetadata => "points_metadata",
            Self::UserRoles => "user_roles",
            Self::ApplicationSettings => "application_settings",
            Self::PointSources => "point_sources",
            Self::DashboardMetadata => "dashboard_metadata",
            Self::ImportDefinitions => "import_definitions",
        }
    }

    /// CSV header row for this target type.
    /// All templates include an `_exported_at` column with the UTC timestamp of download.
    /// This column is used for conflict detection: rows where `updated_at > _exported_at`
    /// are flagged as conflicted during preview.
    fn csv_headers(&self) -> &'static str {
        match self {
            Self::Users => "_exported_at,__id,username [READ-ONLY],full_name,email,enabled",
            Self::OpcSources => "_exported_at,__id,name,endpoint_url,enabled",
            Self::AlarmDefinitions => "_exported_at,__id,name,point_tag,high_high,high,low,low_low,enabled",
            Self::ImportConnections => "_exported_at,__id,name,connector_type,enabled",
            // Points metadata: editable + read-only reference columns
            Self::PointsMetadata => {
                "_exported_at,__id,tagname [READ-ONLY],description [READ-ONLY],engineering_units [READ-ONLY],\
active,criticality,area,aggregation_types,barcode,notes,gps_latitude,gps_longitude,\
write_frequency_seconds,default_graphic_id"
            }
            // User roles: one row per user-role pair
            Self::UserRoles => "_exported_at,__id,user_id [READ-ONLY],username [READ-ONLY],role_id,role_name [READ-ONLY]",
            // Application settings
            Self::ApplicationSettings => "_exported_at,__id,key [READ-ONLY],description [READ-ONLY],value",
            // Point sources
            Self::PointSources => "_exported_at,__id,name,description,enabled",
            // Dashboard metadata
            Self::DashboardMetadata => "_exported_at,__id,name,published",
            // Import definitions
            Self::ImportDefinitions => "_exported_at,__id,name,description,enabled,batch_size,error_strategy",
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

/// Describes how one file column maps to a system field.
#[derive(Debug, Clone, Serialize)]
pub struct ColumnMapping {
    /// The column name as it appears in the uploaded file.
    pub file_column: String,
    /// The system field it maps to (if matched), or the raw column name.
    pub system_field: String,
    /// "matched" | "read_only" | "unmapped"
    pub status: String,
}

/// A row-level validation problem discovered during preview.
#[derive(Debug, Clone, Serialize)]
pub struct ValidationError {
    /// Row number in the uploaded file (1-based, excluding header).
    pub row: usize,
    /// The record ID from __id column (may be empty/invalid).
    pub id: String,
    /// Human-readable description of the error.
    pub error: String,
    /// The field that caused the error, if applicable.
    pub field: Option<String>,
}

/// Summary of row-level validation found during preview.
#[derive(Debug, Serialize)]
pub struct ValidationSummary {
    pub valid_id_count: usize,
    pub duplicate_id_count: usize,
    pub invalid_id_count: usize,
    pub type_error_count: usize,
    pub required_field_error_count: usize,
    pub errors: Vec<ValidationError>,
}

#[derive(Debug, Serialize)]
pub struct DiffPreview {
    pub added: Vec<JsonValue>,
    pub modified: Vec<ModifiedRow>,
    /// Rows where `updated_at > _exported_at` — modified in the DB since the template was downloaded.
    pub conflicted: Vec<ModifiedRow>,
    pub removed: Vec<JsonValue>,
    pub unchanged_count: usize,
    pub column_mapping: Vec<ColumnMapping>,
    pub validation: ValidationSummary,
}

#[derive(Debug, Serialize)]
pub struct ModifiedRow {
    pub id: String,
    pub before: JsonValue,
    pub after: JsonValue,
    pub changed_fields: Vec<String>,
}

/// A row that failed validation or was skipped due to a conflict.
#[derive(Debug, Clone, Serialize)]
pub struct FailedRow {
    /// Row number in the uploaded file (1-based).
    pub row: usize,
    /// The record ID.
    pub id: String,
    /// "validation_error" | "skipped_conflict" | "apply_error"
    pub reason_type: String,
    /// Human-readable reason.
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct ApplySummary {
    pub snapshot_id: Uuid,
    pub added: usize,
    pub modified: usize,
    pub removed: usize,
    pub unchanged: usize,
    pub validation_failed: usize,
    pub failed_rows: Vec<FailedRow>,
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
        TargetType::PointsMetadata => {
            let rows = sqlx::query(
                r#"SELECT id, tagname, description, engineering_units,
                          active, criticality, area, aggregation_types,
                          barcode, notes, gps_latitude, gps_longitude,
                          write_frequency_seconds, default_graphic_id
                   FROM points_metadata
                   ORDER BY tagname"#,
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let tagname: String = r.try_get("tagname").unwrap_or_default();
                    let description: Option<String> = r.try_get("description").ok().flatten();
                    let engineering_units: Option<String> = r.try_get("engineering_units").ok().flatten();
                    let active: bool = r.try_get("active").unwrap_or(true);
                    let criticality: Option<String> = r.try_get("criticality").ok().flatten();
                    let area: Option<String> = r.try_get("area").ok().flatten();
                    let aggregation_types: Option<String> = r.try_get("aggregation_types").ok().flatten();
                    let barcode: Option<String> = r.try_get("barcode").ok().flatten();
                    let notes: Option<String> = r.try_get("notes").ok().flatten();
                    let gps_latitude: Option<f64> = r.try_get("gps_latitude").ok().flatten();
                    let gps_longitude: Option<f64> = r.try_get("gps_longitude").ok().flatten();
                    let write_frequency_seconds: Option<i32> = r.try_get("write_frequency_seconds").ok().flatten();
                    let default_graphic_id: Option<Uuid> = r.try_get("default_graphic_id").ok().flatten();
                    Ok(json!({
                        "id": id.to_string(),
                        "tagname": tagname,
                        "description": description,
                        "engineering_units": engineering_units,
                        "active": active,
                        "criticality": criticality,
                        "area": area,
                        "aggregation_types": aggregation_types,
                        "barcode": barcode,
                        "notes": notes,
                        "gps_latitude": gps_latitude,
                        "gps_longitude": gps_longitude,
                        "write_frequency_seconds": write_frequency_seconds,
                        "default_graphic_id": default_graphic_id.map(|u| u.to_string()),
                    }))
                })
                .collect()
        }
        TargetType::UserRoles => {
            // One row per user-role pair; include username and role_name as read-only references
            let rows = sqlx::query(
                r#"SELECT ur.id, ur.user_id, u.username, ur.role_id, r.name AS role_name
                   FROM user_roles ur
                   JOIN users u ON u.id = ur.user_id
                   JOIN roles r ON r.id = ur.role_id
                   ORDER BY u.username, r.name"#,
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let user_id: Uuid = r.try_get("user_id").unwrap_or_default();
                    let username: String = r.try_get("username").unwrap_or_default();
                    let role_id: Uuid = r.try_get("role_id").unwrap_or_default();
                    let role_name: String = r.try_get("role_name").unwrap_or_default();
                    Ok(json!({
                        "id": id.to_string(),
                        "user_id": user_id.to_string(),
                        "username": username,
                        "role_id": role_id.to_string(),
                        "role_name": role_name,
                    }))
                })
                .collect()
        }
        TargetType::ApplicationSettings => {
            let rows = sqlx::query(
                "SELECT id, key, description, value FROM settings ORDER BY key",
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let key: String = r.try_get("key").unwrap_or_default();
                    let description: Option<String> = r.try_get("description").ok().flatten();
                    let value: Option<String> = r.try_get("value").ok().flatten();
                    Ok(json!({
                        "id": id.to_string(),
                        "key": key,
                        "description": description,
                        "value": value,
                    }))
                })
                .collect()
        }
        TargetType::PointSources => {
            let rows = sqlx::query(
                "SELECT id, name, description, enabled FROM point_sources ORDER BY name",
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let name: String = r.try_get("name").unwrap_or_default();
                    let description: Option<String> = r.try_get("description").ok().flatten();
                    let enabled: bool = r.try_get("enabled").unwrap_or(true);
                    Ok(json!({
                        "id": id.to_string(),
                        "name": name,
                        "description": description,
                        "enabled": enabled,
                    }))
                })
                .collect()
        }
        TargetType::DashboardMetadata => {
            let rows = sqlx::query(
                "SELECT id, name, published FROM dashboards ORDER BY name",
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let name: String = r.try_get("name").unwrap_or_default();
                    let published: bool = r.try_get("published").unwrap_or(false);
                    Ok(json!({
                        "id": id.to_string(),
                        "name": name,
                        "published": published,
                    }))
                })
                .collect()
        }
        TargetType::ImportDefinitions => {
            let rows = sqlx::query(
                r#"SELECT id, name, description, enabled, batch_size, error_strategy
                   FROM import_definitions ORDER BY name"#,
            )
            .fetch_all(db)
            .await
            .map_err(IoError::Database)?;
            rows.iter()
                .map(|r| {
                    let id: Uuid = r.try_get("id").unwrap_or_default();
                    let name: String = r.try_get("name").unwrap_or_default();
                    let description: Option<String> = r.try_get("description").ok().flatten();
                    let enabled: bool = r.try_get("enabled").unwrap_or(true);
                    let batch_size: Option<i32> = r.try_get("batch_size").ok().flatten();
                    let error_strategy: Option<String> = r.try_get("error_strategy").ok().flatten();
                    Ok(json!({
                        "id": id.to_string(),
                        "name": name,
                        "description": description,
                        "enabled": enabled,
                        "batch_size": batch_size,
                        "error_strategy": error_strategy,
                    }))
                })
                .collect()
        }
    }
}

// ---------------------------------------------------------------------------
// updated_at fetch helper for conflict detection
// ---------------------------------------------------------------------------

/// Fetch a map of `id → updated_at` for all rows of the given target type.
/// Returns an empty map for target types whose underlying table does not have
/// an `updated_at` column — conflict detection is silently skipped for those types.
async fn fetch_updated_at_map(
    db: &sqlx::PgPool,
    tt: &TargetType,
) -> std::collections::HashMap<String, DateTime<Utc>> {
    let query = match tt {
        TargetType::Users => Some("SELECT id::text, updated_at FROM users"),
        TargetType::OpcSources => Some("SELECT id::text, updated_at FROM opc_sources"),
        TargetType::AlarmDefinitions => Some("SELECT id::text, updated_at FROM alarm_definitions"),
        TargetType::ImportConnections => Some("SELECT id::text, updated_at FROM import_connections"),
        TargetType::PointsMetadata => Some("SELECT id::text, updated_at FROM points_metadata"),
        TargetType::UserRoles => None, // no updated_at column
        TargetType::ApplicationSettings => None, // settings table may not have updated_at
        TargetType::PointSources => Some("SELECT id::text, updated_at FROM point_sources"),
        TargetType::DashboardMetadata => Some("SELECT id::text, updated_at FROM dashboards"),
        TargetType::ImportDefinitions => Some("SELECT id::text, updated_at FROM import_definitions"),
    };

    let sql = match query {
        Some(q) => q,
        None => return std::collections::HashMap::new(),
    };

    match sqlx::query(sql).fetch_all(db).await {
        Ok(rows) => rows
            .iter()
            .filter_map(|r| {
                let id: String = r.try_get("id").ok()?;
                let updated_at: DateTime<Utc> = r.try_get("updated_at").ok()?;
                Some((id, updated_at))
            })
            .collect(),
        Err(_) => std::collections::HashMap::new(),
    }
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

/// Build column mapping info from the CSV header row vs. known fields for this target type.
fn compute_column_mapping(headers: &[String], tt: &TargetType) -> Vec<ColumnMapping> {
    // All known system fields for this target type (read-only columns use " [READ-ONLY]" suffix in CSV)
    let (all_fields, read_only_fields): (&[&str], &[&str]) = match tt {
        TargetType::Users => (
            &["__id", "username", "full_name", "email", "enabled"],
            &["username"],
        ),
        TargetType::OpcSources => (
            &["__id", "name", "endpoint_url", "enabled"],
            &[],
        ),
        TargetType::AlarmDefinitions => (
            &["__id", "name", "point_tag", "high_high", "high", "low", "low_low", "enabled"],
            &[],
        ),
        TargetType::ImportConnections => (
            &["__id", "name", "connector_type", "enabled"],
            &[],
        ),
        TargetType::PointsMetadata => (
            &["__id", "tagname", "description", "engineering_units",
              "active", "criticality", "area", "aggregation_types",
              "barcode", "notes", "gps_latitude", "gps_longitude",
              "write_frequency_seconds", "default_graphic_id"],
            &["tagname", "description", "engineering_units"],
        ),
        TargetType::UserRoles => (
            &["__id", "user_id", "username", "role_id", "role_name"],
            &["user_id", "username", "role_name"],
        ),
        TargetType::ApplicationSettings => (
            &["__id", "key", "description", "value"],
            &["key", "description"],
        ),
        TargetType::PointSources => (
            &["__id", "name", "description", "enabled"],
            &[],
        ),
        TargetType::DashboardMetadata => (
            &["__id", "name", "published"],
            &[],
        ),
        TargetType::ImportDefinitions => (
            &["__id", "name", "description", "enabled", "batch_size", "error_strategy"],
            &[],
        ),
    };

    headers.iter().map(|h| {
        // Strip " [READ-ONLY]" suffix to get the base field name
        let base = h.trim_end_matches(" [READ-ONLY]").trim_end_matches(" [read-only]");
        // _exported_at is a metadata column used for conflict detection — always read-only
        let is_known = base == "_exported_at"
            || all_fields.iter().any(|&f| f == base || f == h);
        let is_read_only = base == "_exported_at"
            || read_only_fields.iter().any(|&f| f == base)
            || h.contains("[READ-ONLY]") || h.contains("[read-only]");

        let status = if !is_known {
            "unmapped".to_string()
        } else if is_read_only {
            "read_only".to_string()
        } else {
            "matched".to_string()
        };

        ColumnMapping {
            file_column: h.clone(),
            system_field: base.to_string(),
            status,
        }
    }).collect()
}

/// Validate CSV rows and return a `ValidationSummary`.
fn validate_rows(
    csv_rows: &[std::collections::HashMap<String, String>],
    current_ids: &std::collections::HashSet<String>,
    tt: &TargetType,
) -> ValidationSummary {
    use std::collections::HashMap;

    let mut errors: Vec<ValidationError> = Vec::new();
    let mut seen_ids: HashMap<String, usize> = HashMap::new();
    let mut valid_id_count = 0usize;
    let mut invalid_id_count = 0usize;
    let mut duplicate_id_count = 0usize;
    let mut type_error_count = 0usize;
    let mut required_field_error_count = 0usize;

    // Fields that must be non-empty per target type
    let required_fields: &[&str] = match tt {
        TargetType::Users => &["email"],
        TargetType::OpcSources => &["name", "endpoint_url"],
        TargetType::AlarmDefinitions => &["name", "point_tag"],
        TargetType::ImportConnections => &["name", "connector_type"],
        TargetType::PointsMetadata => &[],
        TargetType::UserRoles => &["role_id"],
        TargetType::ApplicationSettings => &[],
        TargetType::PointSources => &["name"],
        TargetType::DashboardMetadata => &["name"],
        TargetType::ImportDefinitions => &["name"],
    };

    // Boolean fields for type checking
    let bool_fields: &[&str] = match tt {
        TargetType::Users => &["enabled"],
        TargetType::OpcSources => &["enabled"],
        TargetType::AlarmDefinitions => &["enabled"],
        TargetType::ImportConnections => &["enabled"],
        TargetType::PointsMetadata => &["active"],
        TargetType::UserRoles => &[],
        TargetType::ApplicationSettings => &[],
        TargetType::PointSources => &["enabled"],
        TargetType::DashboardMetadata => &["published"],
        TargetType::ImportDefinitions => &["enabled"],
    };

    // Numeric float fields
    let float_fields: &[&str] = match tt {
        TargetType::AlarmDefinitions => &["high_high", "high", "low", "low_low"],
        TargetType::PointsMetadata => &["gps_latitude", "gps_longitude"],
        _ => &[],
    };

    // Numeric integer fields
    let int_fields: &[&str] = match tt {
        TargetType::PointsMetadata => &["write_frequency_seconds"],
        TargetType::ImportDefinitions => &["batch_size"],
        _ => &[],
    };

    for (row_idx, row) in csv_rows.iter().enumerate() {
        let row_num = row_idx + 1; // 1-based

        // Get ID value — try __id first, then id
        let id_val = row.get("__id").or_else(|| row.get("id")).map(|s| s.as_str()).unwrap_or("");

        // Validate ID is a valid UUID
        if id_val.is_empty() {
            invalid_id_count += 1;
            errors.push(ValidationError {
                row: row_num,
                id: id_val.to_string(),
                error: "Missing record ID (__id column is empty)".to_string(),
                field: Some("__id".to_string()),
            });
        } else if Uuid::parse_str(id_val).is_err() {
            invalid_id_count += 1;
            errors.push(ValidationError {
                row: row_num,
                id: id_val.to_string(),
                error: format!("Invalid UUID format: {}", id_val),
                field: Some("__id".to_string()),
            });
        } else {
            // Check for duplicates
            if let Some(prior_row) = seen_ids.get(id_val) {
                duplicate_id_count += 1;
                errors.push(ValidationError {
                    row: row_num,
                    id: id_val.to_string(),
                    error: format!("Duplicate ID — also appears at row {}", prior_row),
                    field: Some("__id".to_string()),
                });
            } else {
                seen_ids.insert(id_val.to_string(), row_num);
                // Check if ID exists in current data
                if current_ids.contains(id_val) {
                    valid_id_count += 1;
                } else {
                    // Unknown ID — will be treated as "add", not a validation error per spec
                    valid_id_count += 1;
                }
            }
        }

        // Required field checks
        for &field in required_fields {
            // Try both the base field name and the " [READ-ONLY]" variant
            let val = row.get(field)
                .or_else(|| row.get(&format!("{} [READ-ONLY]", field)))
                .map(|s| s.as_str())
                .unwrap_or("");
            if val.is_empty() {
                required_field_error_count += 1;
                errors.push(ValidationError {
                    row: row_num,
                    id: id_val.to_string(),
                    error: format!("Required field '{}' is empty", field),
                    field: Some(field.to_string()),
                });
            }
        }

        // Boolean type checks
        for &field in bool_fields {
            if let Some(val) = row.get(field) {
                if !val.is_empty() {
                    let lower = val.to_lowercase();
                    if lower != "true" && lower != "false" && lower != "1" && lower != "0"
                        && lower != "yes" && lower != "no" {
                        type_error_count += 1;
                        errors.push(ValidationError {
                            row: row_num,
                            id: id_val.to_string(),
                            error: format!("Field '{}' must be true/false but got '{}'", field, val),
                            field: Some(field.to_string()),
                        });
                    }
                }
            }
        }

        // Float type checks
        for &field in float_fields {
            if let Some(val) = row.get(field) {
                if !val.is_empty() && val.parse::<f64>().is_err() {
                    type_error_count += 1;
                    errors.push(ValidationError {
                        row: row_num,
                        id: id_val.to_string(),
                        error: format!("Field '{}' must be a number but got '{}'", field, val),
                        field: Some(field.to_string()),
                    });
                }
            }
        }

        // Integer type checks
        for &field in int_fields {
            if let Some(val) = row.get(field) {
                if !val.is_empty() && val.parse::<i64>().is_err() {
                    type_error_count += 1;
                    errors.push(ValidationError {
                        row: row_num,
                        id: id_val.to_string(),
                        error: format!("Field '{}' must be an integer but got '{}'", field, val),
                        field: Some(field.to_string()),
                    });
                }
            }
        }

        // UUID field checks (role_id for UserRoles)
        if matches!(tt, TargetType::UserRoles) {
            if let Some(val) = row.get("role_id") {
                if !val.is_empty() && Uuid::parse_str(val).is_err() {
                    type_error_count += 1;
                    errors.push(ValidationError {
                        row: row_num,
                        id: id_val.to_string(),
                        error: format!("Field 'role_id' must be a UUID but got '{}'", val),
                        field: Some("role_id".to_string()),
                    });
                }
            }
        }
    }

    ValidationSummary {
        valid_id_count,
        duplicate_id_count,
        invalid_id_count,
        type_error_count,
        required_field_error_count,
        errors,
    }
}

fn compute_diff(
    current: &[JsonValue],
    incoming: &[JsonValue],
    tt: &TargetType,
    column_mapping: Vec<ColumnMapping>,
    validation: ValidationSummary,
    // id → updated_at from DB; used for conflict detection when file contains `_exported_at`
    db_updated_at: &std::collections::HashMap<String, DateTime<Utc>>,
    // export timestamp from the uploaded file's `_exported_at` column (if present)
    exported_at: Option<DateTime<Utc>>,
) -> DiffPreview {
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
        TargetType::Users => &["full_name", "email", "enabled"],
        TargetType::OpcSources => &["name", "endpoint_url", "enabled"],
        TargetType::AlarmDefinitions => &["name", "point_tag", "high_high", "high", "low", "low_low", "enabled"],
        TargetType::ImportConnections => &["name", "connector_type", "enabled"],
        TargetType::PointsMetadata => &[
            "active", "criticality", "area", "aggregation_types", "barcode",
            "notes", "gps_latitude", "gps_longitude", "write_frequency_seconds", "default_graphic_id",
        ],
        TargetType::UserRoles => &["role_id"],
        TargetType::ApplicationSettings => &["value"],
        TargetType::PointSources => &["name", "description", "enabled"],
        TargetType::DashboardMetadata => &["name", "published"],
        TargetType::ImportDefinitions => &["name", "description", "enabled", "batch_size", "error_strategy"],
    };

    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut conflicted = Vec::new();
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

            // Conflict detection: check if this row was updated in the DB after template export
            let is_conflicted = if let (Some(exp_at), Some(db_upd)) = (exported_at, db_updated_at.get(id)) {
                *db_upd > exp_at
            } else {
                false
            };

            if changed_fields.is_empty() && !is_conflicted {
                unchanged_count += 1;
            } else if is_conflicted {
                conflicted.push(ModifiedRow {
                    id: id.clone(),
                    before: (*cur_row).clone(),
                    after: (*inc_row).clone(),
                    changed_fields,
                });
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

    DiffPreview { added, modified, conflicted, removed, unchanged_count, column_mapping, validation }
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
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "username": row.get("username [READ-ONLY]").or_else(|| row.get("username")).cloned().unwrap_or_default(),
            "full_name": row.get("full_name").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "email": row.get("email").cloned().unwrap_or_default(),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::OpcSources => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "endpoint_url": row.get("endpoint_url").cloned().unwrap_or_default(),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::AlarmDefinitions => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "point_tag": row.get("point_tag").cloned().unwrap_or_default(),
            "high_high": row.get("high_high").and_then(|v| v.parse::<f64>().ok()),
            "high": row.get("high").and_then(|v| v.parse::<f64>().ok()),
            "low": row.get("low").and_then(|v| v.parse::<f64>().ok()),
            "low_low": row.get("low_low").and_then(|v| v.parse::<f64>().ok()),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::ImportConnections => json!({
            "id": row.get("id").or_else(|| row.get("__id")).cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "connector_type": row.get("connector_type").cloned().unwrap_or_default(),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::PointsMetadata => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            // read-only reference fields preserved for display
            "tagname": row.get("tagname [READ-ONLY]").or_else(|| row.get("tagname")).cloned().unwrap_or_default(),
            "description": row.get("description [READ-ONLY]").or_else(|| row.get("description")).and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "engineering_units": row.get("engineering_units [READ-ONLY]").or_else(|| row.get("engineering_units")).and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            // editable fields
            "active": row.get("active").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
            "criticality": row.get("criticality").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "area": row.get("area").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "aggregation_types": row.get("aggregation_types").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "barcode": row.get("barcode").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "notes": row.get("notes").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "gps_latitude": row.get("gps_latitude").and_then(|v| v.parse::<f64>().ok()),
            "gps_longitude": row.get("gps_longitude").and_then(|v| v.parse::<f64>().ok()),
            "write_frequency_seconds": row.get("write_frequency_seconds").and_then(|v| v.parse::<i32>().ok()),
            "default_graphic_id": row.get("default_graphic_id").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
        }),
        TargetType::UserRoles => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "user_id": row.get("user_id [READ-ONLY]").or_else(|| row.get("user_id")).cloned().unwrap_or_default(),
            "username": row.get("username [READ-ONLY]").or_else(|| row.get("username")).cloned().unwrap_or_default(),
            "role_id": row.get("role_id").cloned().unwrap_or_default(),
            "role_name": row.get("role_name [READ-ONLY]").or_else(|| row.get("role_name")).cloned().unwrap_or_default(),
        }),
        TargetType::ApplicationSettings => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "key": row.get("key [READ-ONLY]").or_else(|| row.get("key")).cloned().unwrap_or_default(),
            "description": row.get("description [READ-ONLY]").or_else(|| row.get("description")).and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "value": row.get("value").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
        }),
        TargetType::PointSources => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "description": row.get("description").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
        }),
        TargetType::DashboardMetadata => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "published": row.get("published").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(false),
        }),
        TargetType::ImportDefinitions => json!({
            "id": row.get("__id").or_else(|| row.get("id")).cloned().unwrap_or_default(),
            "name": row.get("name").cloned().unwrap_or_default(),
            "description": row.get("description").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
            "enabled": row.get("enabled").map(|v| v == "true" || v == "1" || v.eq_ignore_ascii_case("yes")).unwrap_or(true),
            "batch_size": row.get("batch_size").and_then(|v| v.parse::<i32>().ok()),
            "error_strategy": row.get("error_strategy").and_then(|v| if v.is_empty() { None } else { Some(v.clone()) }),
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
        TargetType::PointsMetadata => {
            // Only update editable columns — never touch tagname, description,
            // engineering_units, data_type, min_value, max_value, source_id.
            let active = row.get("active").and_then(|v| v.as_bool()).unwrap_or(true);
            let criticality = row.get("criticality").and_then(|v| v.as_str());
            let area = row.get("area").and_then(|v| v.as_str());
            let aggregation_types = row.get("aggregation_types").and_then(|v| v.as_str());
            let barcode = row.get("barcode").and_then(|v| v.as_str());
            let notes = row.get("notes").and_then(|v| v.as_str());
            let gps_latitude = row.get("gps_latitude").and_then(|v| v.as_f64());
            let gps_longitude = row.get("gps_longitude").and_then(|v| v.as_f64());
            let write_frequency_seconds = row.get("write_frequency_seconds").and_then(|v| v.as_i64()).map(|v| v as i32);
            let default_graphic_id = row
                .get("default_graphic_id")
                .and_then(|v| v.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());
            sqlx::query(
                r#"UPDATE points_metadata
                   SET active=$1, criticality=$2, area=$3, aggregation_types=$4,
                       barcode=$5, notes=$6, gps_latitude=$7, gps_longitude=$8,
                       write_frequency_seconds=$9, default_graphic_id=$10
                   WHERE id=$11"#,
            )
            .bind(active)
            .bind(criticality)
            .bind(area)
            .bind(aggregation_types)
            .bind(barcode)
            .bind(notes)
            .bind(gps_latitude)
            .bind(gps_longitude)
            .bind(write_frequency_seconds)
            .bind(default_graphic_id)
            .bind(id)
            .execute(db)
            .await
            .map_err(IoError::Database)?;
        }
        TargetType::UserRoles => {
            // Update the role_id for this user-role pair
            let role_id_str = row.get("role_id").and_then(|v| v.as_str()).unwrap_or("");
            let role_id = Uuid::parse_str(role_id_str)
                .map_err(|_| IoError::BadRequest(format!("Invalid role_id UUID: {}", role_id_str)))?;
            sqlx::query("UPDATE user_roles SET role_id=$1 WHERE id=$2")
                .bind(role_id)
                .bind(id)
                .execute(db)
                .await
                .map_err(IoError::Database)?;
        }
        TargetType::ApplicationSettings => {
            let value = row.get("value").and_then(|v| v.as_str());
            sqlx::query("UPDATE settings SET value=$1 WHERE id=$2")
                .bind(value)
                .bind(id)
                .execute(db)
                .await
                .map_err(IoError::Database)?;
        }
        TargetType::PointSources => {
            // Never include connection_config
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let description = row.get("description").and_then(|v| v.as_str());
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            sqlx::query("UPDATE point_sources SET name=$1, description=$2, enabled=$3 WHERE id=$4")
                .bind(name)
                .bind(description)
                .bind(enabled)
                .bind(id)
                .execute(db)
                .await
                .map_err(IoError::Database)?;
        }
        TargetType::DashboardMetadata => {
            // Exclude layout, widgets JSONB
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let published = row.get("published").and_then(|v| v.as_bool()).unwrap_or(false);
            sqlx::query("UPDATE dashboards SET name=$1, published=$2 WHERE id=$3")
                .bind(name)
                .bind(published)
                .bind(id)
                .execute(db)
                .await
                .map_err(IoError::Database)?;
        }
        TargetType::ImportDefinitions => {
            // Exclude source_config, field_mappings JSONB
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let description = row.get("description").and_then(|v| v.as_str());
            let enabled = row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
            let batch_size = row.get("batch_size").and_then(|v| v.as_i64()).map(|v| v as i32);
            let error_strategy = row.get("error_strategy").and_then(|v| v.as_str());
            sqlx::query(
                r#"UPDATE import_definitions
                   SET name=$1, description=$2, enabled=$3, batch_size=$4, error_strategy=$5
                   WHERE id=$6"#,
            )
            .bind(name)
            .bind(description)
            .bind(enabled)
            .bind(batch_size)
            .bind(error_strategy)
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
// Extract and parse file from multipart — supports CSV and XLSX
// ---------------------------------------------------------------------------

/// Parse an XLSX byte slice into a Vec of header→value HashMaps.
/// Uses the first sheet; converts all cell values to String.
fn parse_xlsx_bytes(
    bytes: &[u8],
) -> Result<Vec<std::collections::HashMap<String, String>>, String> {
    let cursor = Cursor::new(bytes);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| format!("Failed to open XLSX: {e}"))?;

    let sheet_name = {
        let names = workbook.sheet_names();
        names.into_iter().next().ok_or_else(|| "XLSX has no sheets".to_string())?
    };

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Failed to read sheet '{sheet_name}': {e}"))?;

    let mut rows_iter = range.rows();

    // First row is the header
    let headers: Vec<String> = match rows_iter.next() {
        Some(header_row) => header_row
            .iter()
            .map(|cell| cell.to_string().trim().to_string())
            .collect(),
        None => return Ok(vec![]),
    };

    let mut result = Vec::new();
    for row in rows_iter {
        let mut map = std::collections::HashMap::new();
        for (i, h) in headers.iter().enumerate() {
            let val = row.get(i).map(|c| match c {
                Data::Empty => String::new(),
                Data::String(s) => s.clone(),
                Data::Float(f) => f.to_string(),
                Data::Int(n) => n.to_string(),
                Data::Bool(b) => b.to_string(),
                Data::DateTime(dt) => dt.to_string(),
                Data::DateTimeIso(s) => s.clone(),
                Data::DurationIso(s) => s.clone(),
                Data::Error(e) => format!("{:?}", e),
            }).unwrap_or_default();
            map.insert(h.clone(), val);
        }
        result.push(map);
    }

    Ok(result)
}

/// Extract file, target_type, and optional extra text fields from a multipart request.
/// Detects file format (CSV vs XLSX) by content_type or filename extension.
/// Returns parsed rows as Vec<HashMap<String, String>> regardless of format,
/// plus the target type and a map of any extra text fields (e.g. "conflict_resolution").
async fn extract_file_and_target(
    multipart: &mut Multipart,
) -> Result<(Vec<std::collections::HashMap<String, String>>, TargetType, std::collections::HashMap<String, String>), Response> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_is_xlsx = false;
    let mut target_type_str: Option<String> = None;
    let mut extra_fields: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("file") => {
                // Detect format from content_type or filename
                let ct = field.content_type().unwrap_or("").to_lowercase();
                let fname = field.file_name().unwrap_or("").to_lowercase();
                if ct.contains("spreadsheetml") || ct.contains("excel") || fname.ends_with(".xlsx") {
                    file_is_xlsx = true;
                }
                match field.bytes().await {
                    Ok(bytes) => {
                        file_bytes = Some(bytes.to_vec());
                    }
                    Err(_) => {
                        return Err(IoError::BadRequest("Failed to read uploaded file".into()).into_response());
                    }
                }
            }
            Some("target_type") => {
                if let Ok(t) = field.text().await {
                    target_type_str = Some(t);
                }
            }
            Some(name) => {
                // Capture any additional text fields (e.g. conflict_resolution)
                let key = name.to_string();
                if let Ok(val) = field.text().await {
                    extra_fields.insert(key, val);
                }
            }
            None => {}
        }
    }

    let bytes = file_bytes.ok_or_else(|| IoError::BadRequest("No 'file' field in multipart".into()).into_response())?;
    let tt_str = target_type_str.ok_or_else(|| IoError::BadRequest("No 'target_type' field in multipart".into()).into_response())?;
    let tt = TargetType::from_str(&tt_str)
        .ok_or_else(|| IoError::BadRequest(format!("Unknown target_type: {}", tt_str)).into_response())?;

    let rows = if file_is_xlsx {
        parse_xlsx_bytes(&bytes)
            .map_err(|e| IoError::BadRequest(format!("XLSX parse error: {e}")).into_response())?
    } else {
        let text = String::from_utf8(bytes)
            .map_err(|_| IoError::BadRequest("CSV file must be UTF-8".into()).into_response())?;
        parse_csv(&text)
            .ok_or_else(|| IoError::BadRequest("Could not parse CSV — empty or malformed".into()).into_response())?
    };

    Ok((rows, tt, extra_fields))
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

    // Embed the export timestamp in every data row for conflict detection on re-import.
    let exported_at_str = Utc::now().to_rfc3339();

    let mut csv = String::new();
    csv.push_str(tt.csv_headers());
    csv.push('\n');

    for row in &rows {
        let line = match &tt {
            TargetType::Users => format!(
                "{},{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("username").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("full_name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("email").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::OpcSources => format!(
                "{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("endpoint_url").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::AlarmDefinitions => format!(
                "{},{},{},{},{},{},{},{},{}",
                exported_at_str,
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
                "{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("connector_type").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::PointsMetadata => format!(
                "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("tagname").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("description").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("engineering_units").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("active").and_then(|v| v.as_bool()).unwrap_or(true),
                csv_escape(row.get("criticality").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("area").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("aggregation_types").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("barcode").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("notes").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("gps_latitude").and_then(|v| v.as_f64()).map(|f| f.to_string()).unwrap_or_default(),
                row.get("gps_longitude").and_then(|v| v.as_f64()).map(|f| f.to_string()).unwrap_or_default(),
                row.get("write_frequency_seconds").and_then(|v| v.as_i64()).map(|n| n.to_string()).unwrap_or_default(),
                row.get("default_graphic_id").and_then(|v| v.as_str()).unwrap_or(""),
            ),
            TargetType::UserRoles => format!(
                "{},{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                row.get("user_id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("username").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("role_id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("role_name").and_then(|v| v.as_str()).unwrap_or("")),
            ),
            TargetType::ApplicationSettings => format!(
                "{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("key").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("description").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("value").and_then(|v| v.as_str()).unwrap_or("")),
            ),
            TargetType::PointSources => format!(
                "{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("description").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
            ),
            TargetType::DashboardMetadata => format!(
                "{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("published").and_then(|v| v.as_bool()).unwrap_or(false),
            ),
            TargetType::ImportDefinitions => format!(
                "{},{},{},{},{},{},{}",
                exported_at_str,
                row.get("id").and_then(|v| v.as_str()).unwrap_or(""),
                csv_escape(row.get("name").and_then(|v| v.as_str()).unwrap_or("")),
                csv_escape(row.get("description").and_then(|v| v.as_str()).unwrap_or("")),
                row.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
                row.get("batch_size").and_then(|v| v.as_i64()).map(|n| n.to_string()).unwrap_or_default(),
                csv_escape(row.get("error_strategy").and_then(|v| v.as_str()).unwrap_or("")),
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

    let (csv_rows, tt, _extra) = match extract_file_and_target(&mut multipart).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let current = match fetch_current_rows(&state.db, &tt).await {
        Ok(r) => r,
        Err(e) => return e.into_response(),
    };

    // Fetch updated_at timestamps for conflict detection
    let db_updated_at = fetch_updated_at_map(&state.db, &tt).await;

    // Extract _exported_at from the first row (all rows share the same timestamp from template gen)
    let exported_at: Option<DateTime<Utc>> = csv_rows
        .first()
        .and_then(|r| r.get("_exported_at"))
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|dt| dt.with_timezone(&Utc));

    // Build column mapping from actual CSV headers
    let headers: Vec<String> = if let Some(first_row) = csv_rows.first() {
        first_row.keys().cloned().collect()
    } else {
        vec![]
    };
    let column_mapping = compute_column_mapping(&headers, &tt);

    // Build set of current IDs for validation
    let current_ids: std::collections::HashSet<String> = current
        .iter()
        .filter_map(|r| r.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();

    // Validate rows
    let validation = validate_rows(&csv_rows, &current_ids, &tt);

    let incoming: Vec<JsonValue> = csv_rows.iter().map(|r| csv_row_to_json(r, &tt)).collect();

    let diff = compute_diff(&current, &incoming, &tt, column_mapping, validation, &db_updated_at, exported_at);
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

    let (csv_rows, tt, extra_fields) = match extract_file_and_target(&mut multipart).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    // Read conflict_resolution from the multipart extra fields.
    // "overwrite" means apply template values over conflicted rows; anything else means skip.
    let overwrite_conflicts = extra_fields
        .get("conflict_resolution")
        .map(|v| v.as_str() == "overwrite")
        .unwrap_or(false);

    let current = match fetch_current_rows(&state.db, &tt).await {
        Ok(r) => r,
        Err(e) => return e.into_response(),
    };

    // Fetch updated_at timestamps for conflict detection
    let db_updated_at = fetch_updated_at_map(&state.db, &tt).await;

    // Extract _exported_at from the first row
    let exported_at: Option<DateTime<Utc>> = csv_rows
        .first()
        .and_then(|r| r.get("_exported_at"))
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|dt| dt.with_timezone(&Utc));

    // Build current IDs set and validate rows
    let current_ids: std::collections::HashSet<String> = current
        .iter()
        .filter_map(|r| r.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();
    let validation = validate_rows(&csv_rows, &current_ids, &tt);

    // Collect IDs that had validation errors — they will be skipped
    let invalid_ids: std::collections::HashSet<String> = validation.errors
        .iter()
        .filter(|e| e.id != "")
        .map(|e| e.id.clone())
        .collect();

    // Build failed_rows list from validation errors
    let mut failed_rows: Vec<FailedRow> = validation.errors.iter().map(|e| FailedRow {
        row: e.row,
        id: e.id.clone(),
        reason_type: "validation_error".to_string(),
        reason: e.error.clone(),
    }).collect();

    let incoming: Vec<JsonValue> = csv_rows.iter().map(|r| csv_row_to_json(r, &tt)).collect();

    // Filter out incoming rows with validation errors before computing diff
    let valid_incoming: Vec<JsonValue> = incoming.iter()
        .filter(|row| {
            let id = row.get("id").and_then(|v| v.as_str()).unwrap_or("");
            id.is_empty() || !invalid_ids.contains(id)
        })
        .cloned()
        .collect();

    let empty_headers = vec![];
    let empty_validation = ValidationSummary {
        valid_id_count: 0, duplicate_id_count: 0, invalid_id_count: 0,
        type_error_count: 0, required_field_error_count: 0, errors: vec![],
    };
    let diff = compute_diff(&current, &valid_incoming, &tt, empty_headers, empty_validation, &db_updated_at, exported_at);

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
    let validation_failed = validation.invalid_id_count + validation.type_error_count + validation.required_field_error_count;

    // Handle conflicted rows per the user's preference
    if overwrite_conflicts {
        // User chose to overwrite conflicted rows with template values — apply them
        for modrow in &diff.conflicted {
            if let Err(e) = apply_update(&state.db, &tt, &modrow.after).await {
                failed_rows.push(FailedRow {
                    row: 0,
                    id: modrow.id.clone(),
                    reason_type: "apply_error".to_string(),
                    reason: e.to_string(),
                });
            }
        }
    } else {
        // Default: skip conflicted rows and record them as skipped
        for modrow in &diff.conflicted {
            failed_rows.push(FailedRow {
                row: 0,
                id: modrow.id.clone(),
                reason_type: "skipped_conflict".to_string(),
                reason: "Row was modified after template export — skipped to avoid overwriting newer data".to_string(),
            });
        }
    }

    // Apply diff — individual row errors get reported but don't abort the entire apply
    let mut apply_error_count = 0usize;
    for modrow in &diff.modified {
        if let Err(e) = apply_update(&state.db, &tt, &modrow.after).await {
            apply_error_count += 1;
            failed_rows.push(FailedRow {
                row: 0,
                id: modrow.id.clone(),
                reason_type: "apply_error".to_string(),
                reason: e.to_string(),
            });
        }
    }
    let _ = apply_error_count; // used implicitly via failed_rows

    Json(ApiResponse::ok(ApplySummary {
        snapshot_id,
        added: added_count,
        modified: modified_count,
        removed: removed_count,
        unchanged,
        validation_failed,
        failed_rows,
    }))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/bulk-update/:id/error-report
// ---------------------------------------------------------------------------
// Returns a CSV of validation errors / failed rows for an apply result.
// Since we don't persist apply results to the DB, this endpoint accepts the
// failed row data as a query parameter encoded in JSON (for simplicity at
// this stage). In production this would be a stored job result.
//
// For the current implementation we expose a utility that generates a
// synthetic error-report CSV from the snapshot: the snapshot_id is used
// to look up the safety snapshot's target_type, and a placeholder response
// is returned. The frontend generates error reports client-side from the
// apply result data, calling this endpoint as a download trigger.
//
// Alternatively the frontend uses a client-side CSV generation approach
// (see bulkUpdate.ts downloadErrorReport). This handler is kept as a stub
// to satisfy the route registration requirement.

pub async fn get_error_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(snapshot_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:write") {
        return IoError::Forbidden("settings:write permission required".into()).into_response();
    }

    // Look up the snapshot to get target type and label
    let snap_row = match sqlx::query(
        "SELECT target_type, label FROM change_snapshots WHERE id=$1",
    )
    .bind(snapshot_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Snapshot {} not found", snapshot_id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let target_type: String = snap_row.try_get("target_type").unwrap_or_default();
    let label: Option<String> = snap_row.try_get("label").ok().flatten();

    // Return a minimal CSV explaining this is the pre-apply safety snapshot reference
    let mut csv = String::from("snapshot_id,target_type,label,note\n");
    csv.push_str(&format!(
        "{},{},{},\"This is the pre-apply safety snapshot. Use the frontend download to get validation error details.\"\n",
        snapshot_id,
        csv_escape(&target_type),
        csv_escape(label.as_deref().unwrap_or("")),
    ));

    let filename = format!("bulk-update-{}-error-report.csv", snapshot_id);
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
