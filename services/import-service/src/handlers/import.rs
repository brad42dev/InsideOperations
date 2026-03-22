//! Universal Import handlers: connector templates, connections, definitions, schedules, runs.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json, Router,
    routing::{get, post, put},
};
use chrono::{DateTime, Utc};
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::crypto;
use crate::pipeline;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// Helper: extract user_id from x-io-user-id header
// ---------------------------------------------------------------------------

fn user_id_from_headers(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ConnectorTemplateRow {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub domain: String,
    pub vendor: String,
    pub description: Option<String>,
    pub template_config: JsonValue,
    pub required_fields: JsonValue,
    pub target_tables: Vec<String>,
    pub version: String,
}

#[derive(Debug, Serialize)]
pub struct ImportConnectionRow {
    pub id: Uuid,
    pub name: String,
    pub connection_type: String,
    pub config: JsonValue,
    pub auth_type: String,
    pub enabled: bool,
    pub last_tested_at: Option<DateTime<Utc>>,
    pub last_test_status: Option<String>,
    pub last_test_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub point_source_id: Option<Uuid>,
    pub is_supplemental_connector: bool,
}

#[derive(Debug, Serialize)]
pub struct ImportDefinitionRow {
    pub id: Uuid,
    pub connection_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub source_config: JsonValue,
    pub field_mappings: JsonValue,
    pub transforms: JsonValue,
    pub target_table: String,
    pub enabled: bool,
    pub error_strategy: String,
    pub batch_size: i32,
    pub template_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ImportScheduleRow {
    pub id: Uuid,
    pub import_definition_id: Uuid,
    pub schedule_type: String,
    pub schedule_config: JsonValue,
    pub enabled: bool,
    pub next_run_at: Option<DateTime<Utc>>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ImportRunRow {
    pub id: Uuid,
    pub import_definition_id: Uuid,
    pub definition_name: Option<String>,
    pub status: String,
    pub triggered_by: String,
    pub dry_run: bool,
    pub rows_extracted: Option<i32>,
    pub rows_loaded: Option<i32>,
    pub rows_errored: Option<i32>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ImportErrorRow {
    pub id: Uuid,
    pub import_run_id: Uuid,
    pub row_number: Option<i32>,
    pub field_name: Option<String>,
    pub error_type: String,
    pub error_message: String,
    pub raw_value: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListTemplatesParams {
    pub domain: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ListConnectionsParams {
    pub enabled: Option<bool>,
    pub point_source_id: Option<Uuid>,
    pub supplemental: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConnectionRequest {
    pub name: String,
    pub connection_type: String,
    pub config: Option<JsonValue>,
    pub auth_type: Option<String>,
    pub auth_config: Option<JsonValue>,
    pub point_source_id: Option<Uuid>,
    pub is_supplemental_connector: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConnectionRequest {
    pub name: Option<String>,
    pub connection_type: Option<String>,
    pub config: Option<JsonValue>,
    pub auth_type: Option<String>,
    pub auth_config: Option<JsonValue>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListDefinitionsParams {
    pub connection_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDefinitionRequest {
    pub connection_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub source_config: Option<JsonValue>,
    pub field_mappings: Option<JsonValue>,
    pub transforms: Option<JsonValue>,
    pub target_table: String,
    pub error_strategy: Option<String>,
    pub batch_size: Option<i32>,
    pub template_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDefinitionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub source_config: Option<JsonValue>,
    pub field_mappings: Option<JsonValue>,
    pub transforms: Option<JsonValue>,
    pub target_table: Option<String>,
    pub error_strategy: Option<String>,
    pub batch_size: Option<i32>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub schedule_type: String,
    pub schedule_config: Option<JsonValue>,
    pub enabled: Option<bool>,
    pub next_run_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub schedule_type: Option<String>,
    pub schedule_config: Option<JsonValue>,
    pub enabled: Option<bool>,
    pub next_run_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ListRunsParams {
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct TriggerRunRequest {
    pub dry_run: Option<bool>,
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

fn row_to_connector_template(row: &sqlx::postgres::PgRow) -> Result<ConnectorTemplateRow, sqlx::Error> {
    Ok(ConnectorTemplateRow {
        id: row.try_get("id")?,
        slug: row.try_get("slug")?,
        name: row.try_get("name")?,
        domain: row.try_get("domain")?,
        vendor: row.try_get("vendor")?,
        description: row.try_get("description").ok().flatten(),
        template_config: row.try_get("template_config").unwrap_or(JsonValue::Object(Default::default())),
        required_fields: row.try_get("required_fields").unwrap_or(JsonValue::Array(vec![])),
        target_tables: row.try_get("target_tables").unwrap_or_default(),
        version: row.try_get("version").unwrap_or_else(|_| "1.0".to_string()),
    })
}

fn row_to_connection(row: &sqlx::postgres::PgRow) -> Result<ImportConnectionRow, sqlx::Error> {
    let raw_config: JsonValue = row.try_get("config").unwrap_or(JsonValue::Object(Default::default()));
    // Mask any sensitive fields (password, api_key, etc.) that may have been
    // placed in config. auth_config is stored separately and is never returned
    // to callers via this struct.
    let config = crypto::mask_sensitive_fields(&raw_config);
    Ok(ImportConnectionRow {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        connection_type: row.try_get("connection_type")?,
        config,
        auth_type: row.try_get("auth_type").unwrap_or_else(|_| "none".to_string()),
        enabled: row.try_get("enabled").unwrap_or(true),
        last_tested_at: row.try_get("last_tested_at").ok().flatten(),
        last_test_status: row.try_get("last_test_status").ok().flatten(),
        last_test_message: row.try_get("last_test_message").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
        point_source_id: row.try_get("point_source_id").ok().flatten(),
        is_supplemental_connector: row.try_get("is_supplemental_connector").unwrap_or(false),
    })
}

fn row_to_definition(row: &sqlx::postgres::PgRow) -> Result<ImportDefinitionRow, sqlx::Error> {
    Ok(ImportDefinitionRow {
        id: row.try_get("id")?,
        connection_id: row.try_get("connection_id")?,
        name: row.try_get("name")?,
        description: row.try_get("description").ok().flatten(),
        source_config: row.try_get("source_config").unwrap_or(JsonValue::Object(Default::default())),
        field_mappings: row.try_get("field_mappings").unwrap_or(JsonValue::Array(vec![])),
        transforms: row.try_get("transforms").unwrap_or(JsonValue::Array(vec![])),
        target_table: row.try_get("target_table")?,
        enabled: row.try_get("enabled").unwrap_or(true),
        error_strategy: row.try_get("error_strategy").unwrap_or_else(|_| "quarantine".to_string()),
        batch_size: row.try_get("batch_size").unwrap_or(1000),
        template_id: row.try_get("template_id").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_schedule(row: &sqlx::postgres::PgRow) -> Result<ImportScheduleRow, sqlx::Error> {
    Ok(ImportScheduleRow {
        id: row.try_get("id")?,
        import_definition_id: row.try_get("import_definition_id")?,
        schedule_type: row.try_get("schedule_type")?,
        schedule_config: row.try_get("schedule_config").unwrap_or(JsonValue::Object(Default::default())),
        enabled: row.try_get("enabled").unwrap_or(true),
        next_run_at: row.try_get("next_run_at").ok().flatten(),
        last_run_at: row.try_get("last_run_at").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_run(row: &sqlx::postgres::PgRow) -> Result<ImportRunRow, sqlx::Error> {
    Ok(ImportRunRow {
        id: row.try_get("id")?,
        import_definition_id: row.try_get("import_definition_id")?,
        definition_name: row.try_get("definition_name").ok().flatten(),
        status: row.try_get("status")?,
        triggered_by: row.try_get("triggered_by").unwrap_or_else(|_| "manual".to_string()),
        dry_run: row.try_get("dry_run").unwrap_or(false),
        rows_extracted: row.try_get("rows_extracted").ok().flatten(),
        rows_loaded: row.try_get("rows_loaded").ok().flatten(),
        rows_errored: row.try_get("rows_errored").ok().flatten(),
        started_at: row.try_get("started_at").ok().flatten(),
        completed_at: row.try_get("completed_at").ok().flatten(),
        error_message: row.try_get("error_message").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_error(row: &sqlx::postgres::PgRow) -> Result<ImportErrorRow, sqlx::Error> {
    Ok(ImportErrorRow {
        id: row.try_get("id")?,
        import_run_id: row.try_get("import_run_id")?,
        row_number: row.try_get("row_number").ok().flatten(),
        field_name: row.try_get("field_name").ok().flatten(),
        error_type: row.try_get("error_type")?,
        error_message: row.try_get("error_message")?,
        raw_value: row.try_get("raw_value").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    })
}

// ---------------------------------------------------------------------------
// Connector Template handlers
// ---------------------------------------------------------------------------

pub async fn list_connector_templates(
    State(state): State<AppState>,
    Query(params): Query<ListTemplatesParams>,
) -> impl IntoResponse {
    let rows = if let Some(domain) = &params.domain {
        sqlx::query(
            "SELECT id, slug, name, domain, vendor, description, \
                    template_config, required_fields, target_tables, version \
             FROM connector_templates \
             WHERE domain = $1 \
             ORDER BY name",
        )
        .bind(domain)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            "SELECT id, slug, name, domain, vendor, description, \
                    template_config, required_fields, target_tables, version \
             FROM connector_templates \
             ORDER BY name",
        )
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Ok(rows) => {
            let templates: Vec<ConnectorTemplateRow> = rows
                .iter()
                .filter_map(|r| row_to_connector_template(r).ok())
                .collect();
            Json(ApiResponse::ok(templates)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn get_connector_template(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT id, slug, name, domain, vendor, description, \
                template_config, required_fields, target_tables, version \
         FROM connector_templates \
         WHERE slug = $1",
    )
    .bind(&slug)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_connector_template(&row) {
            Ok(t) => Json(ApiResponse::ok(t)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Connector template '{slug}' not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Connection handlers
// ---------------------------------------------------------------------------

pub async fn list_connections(
    State(state): State<AppState>,
    Query(params): Query<ListConnectionsParams>,
) -> impl IntoResponse {
    let rows = if let Some(src_id) = params.point_source_id {
        // Supplemental connector lookup for a specific OPC point source
        sqlx::query(
            "SELECT id, name, connection_type, config, auth_type, enabled, \
                    last_tested_at, last_test_status, last_test_message, created_at, \
                    point_source_id, is_supplemental_connector \
             FROM import_connections \
             WHERE is_supplemental_connector = true \
               AND point_source_id = $1 \
             ORDER BY name",
        )
        .bind(src_id)
        .fetch_all(&state.db)
        .await
    } else if let Some(enabled) = params.enabled {
        sqlx::query(
            "SELECT id, name, connection_type, config, auth_type, enabled, \
                    last_tested_at, last_test_status, last_test_message, created_at, \
                    point_source_id, is_supplemental_connector \
             FROM import_connections \
             WHERE enabled = $1 \
             ORDER BY name",
        )
        .bind(enabled)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            "SELECT id, name, connection_type, config, auth_type, enabled, \
                    last_tested_at, last_test_status, last_test_message, created_at, \
                    point_source_id, is_supplemental_connector \
             FROM import_connections \
             ORDER BY name",
        )
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Ok(rows) => {
            let connections: Vec<ImportConnectionRow> = rows
                .iter()
                .filter_map(|r| row_to_connection(r).ok())
                .collect();
            Json(ApiResponse::ok(connections)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn create_connection(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateConnectionRequest>,
) -> impl IntoResponse {
    let Some(user_id) = user_id_from_headers(&headers) else {
        return IoError::Unauthorized.into_response();
    };

    let config = body.config.unwrap_or(JsonValue::Object(Default::default()));
    let auth_type = body.auth_type.unwrap_or_else(|| "none".to_string());
    let raw_auth_config = body.auth_config.unwrap_or(JsonValue::Object(Default::default()));
    // Encrypt sensitive credential fields before persisting to the database.
    let auth_config = crypto::encrypt_sensitive_fields(&raw_auth_config, &state.config.master_key);
    let is_supplemental = body.is_supplemental_connector.unwrap_or(false);

    let row = sqlx::query(
        "INSERT INTO import_connections \
         (name, connection_type, config, auth_type, auth_config, point_source_id, is_supplemental_connector, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, name, connection_type, config, auth_type, enabled, \
                   last_tested_at, last_test_status, last_test_message, created_at, \
                   point_source_id, is_supplemental_connector",
    )
    .bind(&body.name)
    .bind(&body.connection_type)
    .bind(&config)
    .bind(&auth_type)
    .bind(&auth_config)
    .bind(body.point_source_id)
    .bind(is_supplemental)
    .bind(user_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(row) => match row_to_connection(&row) {
            Ok(c) => (StatusCode::CREATED, Json(ApiResponse::ok(c))).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn get_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT id, name, connection_type, config, auth_type, enabled, \
                last_tested_at, last_test_status, last_test_message, created_at, \
                point_source_id, is_supplemental_connector \
         FROM import_connections \
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_connection(&row) {
            Ok(c) => Json(ApiResponse::ok(c)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Connection {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn update_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateConnectionRequest>,
) -> impl IntoResponse {
    // Fetch current
    let current = sqlx::query(
        "SELECT name, connection_type, config, auth_type, auth_config, enabled \
         FROM import_connections WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let current_row = match current {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Connection {id} not found")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let name: String = body.name.unwrap_or_else(|| current_row.try_get("name").unwrap_or_default());
    let connection_type: String = body.connection_type.unwrap_or_else(|| current_row.try_get("connection_type").unwrap_or_default());
    let config: JsonValue = body.config.unwrap_or_else(|| current_row.try_get("config").unwrap_or(JsonValue::Object(Default::default())));
    let auth_type: String = body.auth_type.unwrap_or_else(|| current_row.try_get("auth_type").unwrap_or_else(|_| "none".to_string()));
    let raw_auth_config: JsonValue = body.auth_config.unwrap_or_else(|| current_row.try_get("auth_config").unwrap_or(JsonValue::Object(Default::default())));
    // Re-encrypt sensitive credential fields before persisting to the database.
    let auth_config = crypto::encrypt_sensitive_fields(&raw_auth_config, &state.config.master_key);
    let enabled: bool = body.enabled.unwrap_or_else(|| current_row.try_get("enabled").unwrap_or(true));

    let row = sqlx::query(
        "UPDATE import_connections \
         SET name = $1, connection_type = $2, config = $3, auth_type = $4, \
             auth_config = $5, enabled = $6, updated_at = NOW() \
         WHERE id = $7 \
         RETURNING id, name, connection_type, config, auth_type, enabled, \
                   last_tested_at, last_test_status, last_test_message, created_at, \
                   point_source_id, is_supplemental_connector",
    )
    .bind(&name)
    .bind(&connection_type)
    .bind(&config)
    .bind(&auth_type)
    .bind(&auth_config)
    .bind(enabled)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_connection(&row) {
            Ok(c) => Json(ApiResponse::ok(c)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Connection {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn delete_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Check for dependent import definitions
    let count_row = sqlx::query(
        "SELECT COUNT(*) as cnt FROM import_definitions WHERE connection_id = $1",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match count_row {
        Ok(row) => {
            let count: i64 = row.try_get("cnt").unwrap_or(0);
            if count > 0 {
                return IoError::Conflict(format!(
                    "Cannot delete connection: {count} import definition(s) depend on it"
                ))
                .into_response();
            }
        }
        Err(e) => return IoError::Database(e).into_response(),
    }

    let result = sqlx::query("DELETE FROM import_connections WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Connection {id} not found")).into_response()
        }
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn test_connection(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    use crate::connectors;

    // Fetch the full connection row so we can dispatch to the correct connector.
    let row = sqlx::query(
        "SELECT id, connection_type, config, auth_type, auth_config \
         FROM import_connections \
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Connection {id} not found")).into_response();
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    let connection_type: String = row.try_get("connection_type").unwrap_or_default();
    let config: serde_json::Value = row
        .try_get::<serde_json::Value, _>("config")
        .unwrap_or(serde_json::Value::Null);
    let auth_type: String = row.try_get("auth_type").unwrap_or_default();
    let auth_config_raw: serde_json::Value = row
        .try_get::<serde_json::Value, _>("auth_config")
        .unwrap_or(serde_json::Value::Null);
    // Decrypt credential fields so the connector receives plain-text values.
    let auth_config = crypto::decrypt_sensitive_fields(&auth_config_raw, &state.config.master_key);

    let cfg = connectors::extract_connector_config(id, &config, &auth_type, &auth_config);

    // Dispatch to the appropriate connector, or return an honest "not supported" message.
    let (test_status, test_message) = if let Some(connector) = connectors::get_connector(&connection_type) {
        match connector.test_connection(&cfg).await {
            Ok(()) => (
                "connected".to_string(),
                "Connection successful".to_string(),
            ),
            Err(e) => ("error".to_string(), e.to_string()),
        }
    } else {
        (
            "error".to_string(),
            format!(
                "Connection test not supported for connector type '{}' yet",
                connection_type
            ),
        )
    };

    // Persist the result back to the DB.
    let update_result = sqlx::query(
        "UPDATE import_connections \
         SET last_tested_at = NOW(), last_test_status = $1, \
             last_test_message = $2, updated_at = NOW() \
         WHERE id = $3",
    )
    .bind(&test_status)
    .bind(&test_message)
    .bind(id)
    .execute(&state.db)
    .await;

    match update_result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Connection {id} not found")).into_response()
        }
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({
            "status": test_status,
            "message": test_message
        })))
        .into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Import Definition handlers
// ---------------------------------------------------------------------------

pub async fn list_definitions(
    State(state): State<AppState>,
    Query(params): Query<ListDefinitionsParams>,
) -> impl IntoResponse {
    let rows = if let Some(conn_id) = params.connection_id {
        sqlx::query(
            "SELECT id, connection_id, name, description, source_config, field_mappings, \
                    transforms, target_table, enabled, error_strategy, batch_size, \
                    template_id, created_at \
             FROM import_definitions \
             WHERE connection_id = $1 \
             ORDER BY name",
        )
        .bind(conn_id)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            "SELECT id, connection_id, name, description, source_config, field_mappings, \
                    transforms, target_table, enabled, error_strategy, batch_size, \
                    template_id, created_at \
             FROM import_definitions \
             ORDER BY name",
        )
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Ok(rows) => {
            let defs: Vec<ImportDefinitionRow> = rows
                .iter()
                .filter_map(|r| row_to_definition(r).ok())
                .collect();
            Json(ApiResponse::ok(defs)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn create_definition(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateDefinitionRequest>,
) -> impl IntoResponse {
    let Some(user_id) = user_id_from_headers(&headers) else {
        return IoError::Unauthorized.into_response();
    };

    let source_config = body.source_config.unwrap_or(JsonValue::Object(Default::default()));
    let field_mappings = body.field_mappings.unwrap_or(JsonValue::Array(vec![]));
    let transforms = body.transforms.unwrap_or(JsonValue::Array(vec![]));
    let error_strategy = body.error_strategy.unwrap_or_else(|| "quarantine".to_string());
    let batch_size = body.batch_size.unwrap_or(1000);

    let row = sqlx::query(
        "INSERT INTO import_definitions \
         (connection_id, name, description, source_config, field_mappings, transforms, \
          target_table, error_strategy, batch_size, template_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
         RETURNING id, connection_id, name, description, source_config, field_mappings, \
                   transforms, target_table, enabled, error_strategy, batch_size, \
                   template_id, created_at",
    )
    .bind(body.connection_id)
    .bind(&body.name)
    .bind(&body.description)
    .bind(&source_config)
    .bind(&field_mappings)
    .bind(&transforms)
    .bind(&body.target_table)
    .bind(&error_strategy)
    .bind(batch_size)
    .bind(body.template_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(row) => match row_to_definition(&row) {
            Ok(d) => (StatusCode::CREATED, Json(ApiResponse::ok(d))).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn get_definition(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT id, connection_id, name, description, source_config, field_mappings, \
                transforms, target_table, enabled, error_strategy, batch_size, \
                template_id, created_at \
         FROM import_definitions \
         WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_definition(&row) {
            Ok(d) => Json(ApiResponse::ok(d)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Definition {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn update_definition(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDefinitionRequest>,
) -> impl IntoResponse {
    let current = sqlx::query(
        "SELECT name, description, source_config, field_mappings, transforms, \
                target_table, error_strategy, batch_size, enabled \
         FROM import_definitions WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let current_row = match current {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Definition {id} not found")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let name: String = body.name.unwrap_or_else(|| current_row.try_get("name").unwrap_or_default());
    let description: Option<String> = body.description.or_else(|| current_row.try_get("description").ok().flatten());
    let source_config: JsonValue = body.source_config.unwrap_or_else(|| current_row.try_get("source_config").unwrap_or(JsonValue::Object(Default::default())));
    let field_mappings: JsonValue = body.field_mappings.unwrap_or_else(|| current_row.try_get("field_mappings").unwrap_or(JsonValue::Array(vec![])));
    let transforms: JsonValue = body.transforms.unwrap_or_else(|| current_row.try_get("transforms").unwrap_or(JsonValue::Array(vec![])));
    let target_table: String = body.target_table.unwrap_or_else(|| current_row.try_get("target_table").unwrap_or_default());
    let error_strategy: String = body.error_strategy.unwrap_or_else(|| current_row.try_get("error_strategy").unwrap_or_else(|_| "quarantine".to_string()));
    let batch_size: i32 = body.batch_size.unwrap_or_else(|| current_row.try_get("batch_size").unwrap_or(1000));
    let enabled: bool = body.enabled.unwrap_or_else(|| current_row.try_get("enabled").unwrap_or(true));

    let row = sqlx::query(
        "UPDATE import_definitions \
         SET name = $1, description = $2, source_config = $3, field_mappings = $4, \
             transforms = $5, target_table = $6, error_strategy = $7, batch_size = $8, \
             enabled = $9, updated_at = NOW() \
         WHERE id = $10 \
         RETURNING id, connection_id, name, description, source_config, field_mappings, \
                   transforms, target_table, enabled, error_strategy, batch_size, \
                   template_id, created_at",
    )
    .bind(&name)
    .bind(&description)
    .bind(&source_config)
    .bind(&field_mappings)
    .bind(&transforms)
    .bind(&target_table)
    .bind(&error_strategy)
    .bind(batch_size)
    .bind(enabled)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_definition(&row) {
            Ok(d) => Json(ApiResponse::ok(d)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Definition {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn delete_definition(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM import_definitions WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Definition {id} not found")).into_response()
        }
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Schedule handlers
// ---------------------------------------------------------------------------

pub async fn list_schedules(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
) -> impl IntoResponse {
    let rows = sqlx::query(
        "SELECT id, import_definition_id, schedule_type, schedule_config, \
                enabled, next_run_at, last_run_at, created_at \
         FROM import_schedules \
         WHERE import_definition_id = $1 \
         ORDER BY created_at",
    )
    .bind(def_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let schedules: Vec<ImportScheduleRow> = rows
                .iter()
                .filter_map(|r| row_to_schedule(r).ok())
                .collect();
            Json(ApiResponse::ok(schedules)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn create_schedule(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
    Json(body): Json<CreateScheduleRequest>,
) -> impl IntoResponse {
    let schedule_config = body.schedule_config.unwrap_or(JsonValue::Object(Default::default()));
    let enabled = body.enabled.unwrap_or(true);

    let row = sqlx::query(
        "INSERT INTO import_schedules \
         (import_definition_id, schedule_type, schedule_config, enabled, next_run_at) \
         VALUES ($1, $2, $3, $4, $5) \
         RETURNING id, import_definition_id, schedule_type, schedule_config, \
                   enabled, next_run_at, last_run_at, created_at",
    )
    .bind(def_id)
    .bind(&body.schedule_type)
    .bind(&schedule_config)
    .bind(enabled)
    .bind(body.next_run_at)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(row) => match row_to_schedule(&row) {
            Ok(s) => (StatusCode::CREATED, Json(ApiResponse::ok(s))).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn update_schedule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScheduleRequest>,
) -> impl IntoResponse {
    let current = sqlx::query(
        "SELECT schedule_type, schedule_config, enabled, next_run_at \
         FROM import_schedules WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let current_row = match current {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Schedule {id} not found")).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let schedule_type: String = body.schedule_type.unwrap_or_else(|| current_row.try_get("schedule_type").unwrap_or_default());
    let schedule_config: JsonValue = body.schedule_config.unwrap_or_else(|| current_row.try_get("schedule_config").unwrap_or(JsonValue::Object(Default::default())));
    let enabled: bool = body.enabled.unwrap_or_else(|| current_row.try_get("enabled").unwrap_or(true));
    let next_run_at: Option<DateTime<Utc>> = body.next_run_at.or_else(|| current_row.try_get("next_run_at").ok().flatten());

    let row = sqlx::query(
        "UPDATE import_schedules \
         SET schedule_type = $1, schedule_config = $2, enabled = $3, \
             next_run_at = $4, updated_at = NOW() \
         WHERE id = $5 \
         RETURNING id, import_definition_id, schedule_type, schedule_config, \
                   enabled, next_run_at, last_run_at, created_at",
    )
    .bind(&schedule_type)
    .bind(&schedule_config)
    .bind(enabled)
    .bind(next_run_at)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_schedule(&row) {
            Ok(s) => Json(ApiResponse::ok(s)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Schedule {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn delete_schedule(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM import_schedules WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Schedule {id} not found")).into_response()
        }
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Run handlers
// ---------------------------------------------------------------------------

pub async fn list_runs(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
    Query(params): Query<ListRunsParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(20).min(100);

    let rows = sqlx::query(
        "SELECT ir.id, ir.import_definition_id, id2.name as definition_name, \
                ir.status, ir.triggered_by, ir.dry_run, ir.rows_extracted, ir.rows_loaded, \
                ir.rows_errored, ir.started_at, ir.completed_at, ir.error_message, ir.created_at \
         FROM import_runs ir \
         LEFT JOIN import_definitions id2 ON id2.id = ir.import_definition_id \
         WHERE ir.import_definition_id = $1 \
         ORDER BY ir.created_at DESC \
         LIMIT $2",
    )
    .bind(def_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let runs: Vec<ImportRunRow> = rows
                .iter()
                .filter_map(|r| row_to_run(r).ok())
                .collect();
            Json(ApiResponse::ok(runs)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn trigger_run(
    State(state): State<AppState>,
    Path(def_id): Path<Uuid>,
    Json(body): Json<TriggerRunRequest>,
) -> impl IntoResponse {
    let dry_run = body.dry_run.unwrap_or(false);

    // Create the run record
    let row = sqlx::query(
        "INSERT INTO import_runs (import_definition_id, status, triggered_by, dry_run, started_at) \
         VALUES ($1, 'pending', 'manual', $2, NOW()) \
         RETURNING id, import_definition_id, status, triggered_by, dry_run, rows_extracted, \
                   rows_loaded, rows_errored, started_at, completed_at, error_message, created_at",
    )
    .bind(def_id)
    .bind(dry_run)
    .fetch_one(&state.db)
    .await;

    let run_id = match row {
        Ok(ref r) => r.try_get::<Uuid, _>("id").unwrap_or_default(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let run_row = match row {
        Ok(r) => r,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let run = match row_to_run(&run_row) {
        Ok(r) => r,
        Err(e) => return IoError::Internal(format!("Row mapping error: {e}")).into_response(),
    };

    // Spawn background ETL pipeline task
    let db_clone = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = pipeline::execute(&db_clone, run_id, def_id, dry_run).await {
            tracing::warn!(run_id = %run_id, error = %e, "import pipeline error");
        }
    });

    (StatusCode::CREATED, Json(ApiResponse::ok(run))).into_response()
}

pub async fn get_run(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT ir.id, ir.import_definition_id, id2.name as definition_name, \
                ir.status, ir.triggered_by, ir.dry_run, ir.rows_extracted, ir.rows_loaded, \
                ir.rows_errored, ir.started_at, ir.completed_at, ir.error_message, ir.created_at \
         FROM import_runs ir \
         LEFT JOIN import_definitions id2 ON id2.id = ir.import_definition_id \
         WHERE ir.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(row)) => match row_to_run(&row) {
            Ok(r) => Json(ApiResponse::ok(r)).into_response(),
            Err(e) => IoError::Internal(format!("Row mapping error: {e}")).into_response(),
        },
        Ok(None) => IoError::NotFound(format!("Run {id} not found")).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn get_run_errors(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let rows = sqlx::query(
        "SELECT id, import_run_id, row_number, field_name, error_type, \
                error_message, raw_value, created_at \
         FROM import_errors \
         WHERE import_run_id = $1 \
         ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let errors: Vec<ImportErrorRow> = rows
                .iter()
                .filter_map(|r| row_to_error(r).ok())
                .collect();
            Json(ApiResponse::ok(errors)).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

pub async fn cancel_run(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "UPDATE import_runs \
         SET status = 'cancelled', completed_at = NOW() \
         WHERE id = $1 AND status IN ('pending', 'running') \
         RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(_)) => Json(ApiResponse::ok(serde_json::json!({ "cancelled": true }))).into_response(),
        Ok(None) => IoError::Conflict(
            "Run not found or cannot be cancelled (not pending/running)".into(),
        )
        .into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn import_routes() -> Router<AppState> {
    Router::new()
        // Connector templates
        .route("/connector-templates", get(list_connector_templates))
        .route("/connector-templates/:slug", get(get_connector_template))
        // Connections
        .route(
            "/connections",
            get(list_connections).post(create_connection),
        )
        .route(
            "/connections/:id",
            get(get_connection).put(update_connection).delete(delete_connection),
        )
        .route("/connections/:id/test", post(test_connection))
        // Definitions
        .route(
            "/definitions",
            get(list_definitions).post(create_definition),
        )
        .route(
            "/definitions/:id",
            get(get_definition).put(update_definition).delete(delete_definition),
        )
        // Schedules
        .route(
            "/definitions/:id/schedules",
            get(list_schedules).post(create_schedule),
        )
        .route(
            "/schedules/:id",
            put(update_schedule).delete(delete_schedule),
        )
        // Runs
        .route(
            "/definitions/:id/runs",
            get(list_runs).post(trigger_run),
        )
        .route("/runs/:id", get(get_run))
        .route("/runs/:id/errors", get(get_run_errors))
        .route("/runs/:id/cancel", post(cancel_run))
}
