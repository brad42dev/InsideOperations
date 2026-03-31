use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlertTemplate {
    pub id: Uuid,
    pub name: String,
    pub severity: String,
    pub title_template: String,
    pub message_template: String,
    pub channels: Vec<String>,
    pub default_roster_id: Option<Uuid>,
    pub escalation_policy: Option<serde_json::Value>,
    pub requires_acknowledgment: bool,
    pub auto_resolve_minutes: Option<i32>,
    pub category: String,
    pub variables: Option<Vec<String>>,
    pub enabled: bool,
    pub built_in: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub updated_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateBody {
    pub name: String,
    pub severity: String,
    pub title_template: String,
    pub message_template: String,
    pub channels: Vec<String>,
    pub default_roster_id: Option<Uuid>,
    pub escalation_policy: Option<serde_json::Value>,
    pub requires_acknowledgment: Option<bool>,
    pub auto_resolve_minutes: Option<i32>,
    pub category: Option<String>,
    pub variables: Option<Vec<String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateBody {
    pub name: Option<String>,
    pub severity: Option<String>,
    pub title_template: Option<String>,
    pub message_template: Option<String>,
    pub channels: Option<Vec<String>>,
    pub default_roster_id: Option<Uuid>,
    pub escalation_policy: Option<serde_json::Value>,
    pub requires_acknowledgment: Option<bool>,
    pub auto_resolve_minutes: Option<i32>,
    pub category: Option<String>,
    pub variables: Option<Vec<String>>,
    pub enabled: Option<bool>,
}

// ---------------------------------------------------------------------------
// Column list
// ---------------------------------------------------------------------------

pub const TEMPLATE_COLUMNS: &str = "id, name, severity::text, title_template, message_template,
    channels, default_roster_id, escalation_policy, requires_acknowledgment,
    auto_resolve_minutes, category, variables, enabled, built_in,
    created_at, updated_at, created_by, updated_by";

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /alerts/templates — list all alert templates
pub async fn list_templates(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, AlertTemplate>(&format!(
        "SELECT {TEMPLATE_COLUMNS}
         FROM alert_templates
         ORDER BY built_in DESC, name ASC"
    ))
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(data) => (StatusCode::OK, Json(ApiResponse::ok(data))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// GET /alerts/templates/:id — get a single template
pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query_as::<_, AlertTemplate>(&format!(
        "SELECT {TEMPLATE_COLUMNS}
         FROM alert_templates
         WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(t)) => (StatusCode::OK, Json(ApiResponse::ok(t))).into_response(),
        Ok(None) => IoError::NotFound(format!("Alert template {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/templates — create a new custom template
pub async fn create_template(
    State(state): State<AppState>,
    Json(body): Json<CreateTemplateBody>,
) -> impl IntoResponse {
    if body.name.trim().is_empty() {
        return IoError::field("name", "Name is required").into_response();
    }
    if body.title_template.trim().is_empty() {
        return IoError::field("title_template", "Title template is required").into_response();
    }
    if body.message_template.trim().is_empty() {
        return IoError::field("message_template", "Message template is required").into_response();
    }
    if !["emergency", "critical", "warning", "info"].contains(&body.severity.as_str()) {
        return IoError::field(
            "severity",
            "Must be one of: emergency, critical, warning, info",
        )
        .into_response();
    }
    if body.channels.is_empty() {
        return IoError::field("channels", "At least one channel is required").into_response();
    }

    let requires_acknowledgment = body.requires_acknowledgment.unwrap_or(false);
    let category = body.category.unwrap_or_else(|| "custom".to_string());
    let enabled = body.enabled.unwrap_or(true);

    let row = sqlx::query_as::<_, AlertTemplate>(&format!(
        "INSERT INTO alert_templates
             (name, severity, title_template, message_template, channels,
              default_roster_id, escalation_policy, requires_acknowledgment,
              auto_resolve_minutes, category, variables, enabled)
         VALUES ($1, $2::alert_severity, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING {TEMPLATE_COLUMNS}"
    ))
    .bind(body.name.trim())
    .bind(&body.severity)
    .bind(body.title_template.trim())
    .bind(body.message_template.trim())
    .bind(&body.channels)
    .bind(body.default_roster_id)
    .bind(&body.escalation_policy)
    .bind(requires_acknowledgment)
    .bind(body.auto_resolve_minutes)
    .bind(&category)
    .bind(&body.variables)
    .bind(enabled)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(t) => (StatusCode::CREATED, Json(ApiResponse::ok(t))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// PUT /alerts/templates/:id — update an existing template (built-in or custom)
pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateBody>,
) -> impl IntoResponse {
    // Fetch existing template
    let existing = sqlx::query_as::<_, AlertTemplate>(&format!(
        "SELECT {TEMPLATE_COLUMNS}
         FROM alert_templates
         WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let existing = match existing {
        Ok(Some(t)) => t,
        Ok(None) => {
            return IoError::NotFound(format!("Alert template {} not found", id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Validate severity if provided
    if let Some(ref sev) = body.severity {
        if !["emergency", "critical", "warning", "info"].contains(&sev.as_str()) {
            return IoError::field(
                "severity",
                "Must be one of: emergency, critical, warning, info",
            )
            .into_response();
        }
    }

    // Merge updates with existing values
    let name = body
        .name
        .map(|n| n.trim().to_string())
        .unwrap_or(existing.name);
    let severity = body.severity.unwrap_or(existing.severity);
    let title_template = body
        .title_template
        .map(|t| t.trim().to_string())
        .unwrap_or(existing.title_template);
    let message_template = body
        .message_template
        .map(|t| t.trim().to_string())
        .unwrap_or(existing.message_template);
    let channels = body.channels.unwrap_or(existing.channels);
    let default_roster_id = body.default_roster_id.or(existing.default_roster_id);
    let escalation_policy = body.escalation_policy.or(existing.escalation_policy);
    let requires_acknowledgment = body
        .requires_acknowledgment
        .unwrap_or(existing.requires_acknowledgment);
    let auto_resolve_minutes = body.auto_resolve_minutes.or(existing.auto_resolve_minutes);
    let category = body.category.unwrap_or(existing.category);
    let variables = body.variables.or(existing.variables);
    let enabled = body.enabled.unwrap_or(existing.enabled);

    let row = sqlx::query_as::<_, AlertTemplate>(&format!(
        "UPDATE alert_templates
         SET name = $1,
             severity = $2::alert_severity,
             title_template = $3,
             message_template = $4,
             channels = $5,
             default_roster_id = $6,
             escalation_policy = $7,
             requires_acknowledgment = $8,
             auto_resolve_minutes = $9,
             category = $10,
             variables = $11,
             enabled = $12,
             updated_at = now()
         WHERE id = $13
         RETURNING {TEMPLATE_COLUMNS}"
    ))
    .bind(&name)
    .bind(&severity)
    .bind(&title_template)
    .bind(&message_template)
    .bind(&channels)
    .bind(default_roster_id)
    .bind(&escalation_policy)
    .bind(requires_acknowledgment)
    .bind(auto_resolve_minutes)
    .bind(&category)
    .bind(&variables)
    .bind(enabled)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(t) => (StatusCode::OK, Json(ApiResponse::ok(t))).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// DELETE /alerts/templates/:id — delete a custom template; built-in templates return 409
pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Fetch to check built_in flag before deletion
    let existing = sqlx::query_as::<_, AlertTemplate>(&format!(
        "SELECT {TEMPLATE_COLUMNS}
         FROM alert_templates
         WHERE id = $1"
    ))
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let existing = match existing {
        Ok(Some(t)) => t,
        Ok(None) => {
            return IoError::NotFound(format!("Alert template {} not found", id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    if existing.built_in {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "success": false,
                "error": {
                    "code": "CONFLICT",
                    "message": "Built-in templates cannot be deleted"
                }
            })),
        )
            .into_response();
    }

    let result = sqlx::query("DELETE FROM alert_templates WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}
