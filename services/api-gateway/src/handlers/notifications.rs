//! Alerts Module — Notification handlers.
//!
//! Human-initiated alert notifications: templates, groups, messages, and muster tracking.
//! These operate against the `notification_*` tables (migration 37) and are separate
//! from the alarm-engine `alert_*` tables.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_models::{PageParams, PagedResponse};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

fn user_id_from_claims(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

// ---------------------------------------------------------------------------
// Variable substitution
// ---------------------------------------------------------------------------

fn substitute_variables(template: &str, variables: &JsonValue) -> String {
    let mut result = template.to_string();
    if let Some(obj) = variables.as_object() {
        for (k, v) in obj {
            let placeholder = format!("{{{{{}}}}}", k);
            let value = v.as_str().unwrap_or(&v.to_string()).to_string();
            result = result.replace(&placeholder, &value);
        }
    }
    result
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct NotificationTemplateRow {
    pub id: Uuid,
    pub name: String,
    pub category: String,
    pub severity: String,
    pub title_template: String,
    pub body_template: String,
    pub channels: Vec<String>,
    pub variables: Vec<String>,
    pub is_system: bool,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct NotificationGroupRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub group_type: String,
    pub config: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub member_count: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NotificationGroupMemberRow {
    pub id: Uuid,
    pub group_id: Uuid,
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub added_at: DateTime<Utc>,
    pub added_by: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct NotificationMessageRow {
    pub id: Uuid,
    pub template_id: Option<Uuid>,
    pub template_name: Option<String>,
    pub severity: String,
    pub title: String,
    pub body: String,
    pub channels: Vec<String>,
    pub group_id: Option<Uuid>,
    pub group_name: Option<String>,
    pub recipient_count: i32,
    pub sent_by: Uuid,
    pub sent_by_name: Option<String>,
    pub sent_at: DateTime<Utc>,
    pub variables_used: Option<JsonValue>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct MusterMarkRow {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub status: String,
    pub marked_by: Option<Uuid>,
    pub marked_at: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Query param structs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub severity: Option<String>,
    pub sent_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct TemplatesQuery {
    pub enabled: Option<bool>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

// ---------------------------------------------------------------------------
// Request body structs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SendNotificationBody {
    pub template_id: Option<Uuid>,
    pub severity: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub channels: Option<Vec<String>>,
    pub group_id: Option<Uuid>,
    pub recipient_user_ids: Option<Vec<Uuid>>,
    pub variables: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateBody {
    pub name: String,
    pub category: Option<String>,
    pub severity: Option<String>,
    pub title_template: String,
    pub body_template: String,
    pub channels: Option<Vec<String>>,
    pub variables: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateBody {
    pub name: Option<String>,
    pub category: Option<String>,
    pub severity: Option<String>,
    pub title_template: Option<String>,
    pub body_template: Option<String>,
    pub channels: Option<Vec<String>>,
    pub variables: Option<Vec<String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateGroupBody {
    pub name: String,
    pub description: Option<String>,
    pub group_type: Option<String>,
    pub config: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGroupBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub group_type: Option<String>,
    pub config: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct AddMemberBody {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct MarkMusterBody {
    pub user_id: Uuid,
    pub status: String,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn error_response(status: StatusCode, code: &str, message: &str) -> impl IntoResponse {
    (status, Json(json!({ "success": false, "error": { "code": code, "message": message } })))
}

fn ok(data: impl serde::Serialize) -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "success": true, "data": data })))
}

fn created(data: impl serde::Serialize) -> impl IntoResponse {
    (StatusCode::CREATED, Json(json!({ "success": true, "data": data })))
}

// ---------------------------------------------------------------------------
// GET /api/notifications/messages
// ---------------------------------------------------------------------------

pub async fn list_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<MessagesQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let page = q.page.unwrap_or(1).max(1) as u32;
    let limit = q.limit.unwrap_or(25).clamp(1, 200) as u32;
    let offset = ((page - 1) * limit) as i64;

    let rows = sqlx::query(
        r#"
        SELECT
            nm.id, nm.template_id,
            nt.name AS template_name,
            nm.severity, nm.title, nm.body, nm.channels,
            nm.group_id,
            ng.name AS group_name,
            nm.recipient_count, nm.sent_by,
            u.display_name AS sent_by_name,
            nm.sent_at, nm.variables_used, nm.status
        FROM notification_messages nm
        LEFT JOIN notification_templates nt ON nt.id = nm.template_id
        LEFT JOIN notification_groups ng ON ng.id = nm.group_id
        LEFT JOIN users u ON u.id = nm.sent_by
        WHERE ($1::TEXT IS NULL OR nm.severity = $1)
          AND ($2::UUID IS NULL OR nm.sent_by = $2)
        ORDER BY nm.sent_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(q.severity.as_deref())
    .bind(q.sent_by)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM notification_messages nm
        WHERE ($1::TEXT IS NULL OR nm.severity = $1)
          AND ($2::UUID IS NULL OR nm.sent_by = $2)
        "#,
    )
    .bind(q.severity.as_deref())
    .bind(q.sent_by)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    match rows {
        Ok(rows) => {
            let messages: Vec<NotificationMessageRow> = rows
                .iter()
                .map(|r| NotificationMessageRow {
                    id: r.get("id"),
                    template_id: r.get("template_id"),
                    template_name: r.get("template_name"),
                    severity: r.get("severity"),
                    title: r.get("title"),
                    body: r.get("body"),
                    channels: r.get("channels"),
                    group_id: r.get("group_id"),
                    group_name: r.get("group_name"),
                    recipient_count: r.get("recipient_count"),
                    sent_by: r.get("sent_by"),
                    sent_by_name: r.get("sent_by_name"),
                    sent_at: r.get("sent_at"),
                    variables_used: r.get("variables_used"),
                    status: r.get("status"),
                })
                .collect();

            (
                StatusCode::OK,
                Json(PagedResponse::new(messages, page, limit, total as u64)),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_messages query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch messages")
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/send
// ---------------------------------------------------------------------------

pub async fn send_notification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SendNotificationBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:send") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:send permission required")
            .into_response();
    }

    let sender_id = match user_id_from_claims(&claims) {
        Some(id) => id,
        None => {
            return error_response(StatusCode::UNAUTHORIZED, "INVALID_TOKEN", "Cannot resolve user from token")
                .into_response()
        }
    };

    let variables = body.variables.clone().unwrap_or(json!({}));

    // If template_id provided, load the template and use it as base
    let (title, msg_body, severity, channels) = if let Some(tid) = body.template_id {
        let tpl = sqlx::query(
            "SELECT title_template, body_template, severity, channels FROM notification_templates WHERE id = $1 AND enabled = true",
        )
        .bind(tid)
        .fetch_optional(&state.db)
        .await;

        match tpl {
            Ok(Some(row)) => {
                let title_tpl: String = row.get("title_template");
                let body_tpl: String = row.get("body_template");
                let tpl_severity: String = row.get("severity");
                let tpl_channels: Vec<String> = row.get("channels");
                (
                    substitute_variables(&title_tpl, &variables),
                    substitute_variables(&body_tpl, &variables),
                    body.severity.unwrap_or(tpl_severity),
                    body.channels.unwrap_or(tpl_channels),
                )
            }
            Ok(None) => {
                return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Template not found or disabled")
                    .into_response()
            }
            Err(e) => {
                tracing::error!(error = %e, "template lookup failed");
                return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to load template")
                    .into_response();
            }
        }
    } else {
        // Ad-hoc notification — all fields required
        let title = match body.title {
            Some(t) => substitute_variables(&t, &variables),
            None => {
                return error_response(StatusCode::BAD_REQUEST, "MISSING_FIELD", "title is required for ad-hoc notifications")
                    .into_response()
            }
        };
        let msg_body = match body.body {
            Some(b) => substitute_variables(&b, &variables),
            None => {
                return error_response(StatusCode::BAD_REQUEST, "MISSING_FIELD", "body is required for ad-hoc notifications")
                    .into_response()
            }
        };
        let severity = body.severity.unwrap_or_else(|| "info".to_string());
        let channels = body.channels.unwrap_or_else(|| vec!["websocket".to_string()]);
        (title, msg_body, severity, channels)
    };

    // Resolve recipients
    let recipient_ids: Vec<Uuid> = if let Some(group_id) = body.group_id {
        let group_type_row = sqlx::query(
            "SELECT group_type FROM notification_groups WHERE id = $1",
        )
        .bind(group_id)
        .fetch_optional(&state.db)
        .await;

        match group_type_row {
            Ok(Some(row)) => {
                let gtype: String = row.get("group_type");
                match gtype.as_str() {
                    "all_users" => {
                        sqlx::query_scalar::<_, Uuid>("SELECT id FROM users WHERE is_active = true")
                            .fetch_all(&state.db)
                            .await
                            .unwrap_or_default()
                    }
                    _ => {
                        // static group — use member list
                        sqlx::query_scalar::<_, Uuid>(
                            "SELECT user_id FROM notification_group_members WHERE group_id = $1",
                        )
                        .bind(group_id)
                        .fetch_all(&state.db)
                        .await
                        .unwrap_or_default()
                    }
                }
            }
            Ok(None) => {
                return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Notification group not found")
                    .into_response()
            }
            Err(e) => {
                tracing::error!(error = %e, "group lookup failed");
                return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to resolve group")
                    .into_response();
            }
        }
    } else if let Some(ref ids) = body.recipient_user_ids {
        ids.clone()
    } else {
        Vec::new()
    };

    let recipient_count = recipient_ids.len() as i32;

    // Insert notification_messages record
    let channels_ref: Vec<&str> = channels.iter().map(|s| s.as_str()).collect();
    let variables_json = if variables == json!({}) { None } else { Some(variables.clone()) };

    let msg_row = sqlx::query(
        r#"
        INSERT INTO notification_messages
            (template_id, severity, title, body, channels, group_id, recipient_count, sent_by, sent_at, variables_used, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9, 'sent')
        RETURNING id, template_id, severity, title, body, channels, group_id, recipient_count, sent_by, sent_at, variables_used, status
        "#,
    )
    .bind(body.template_id)
    .bind(&severity)
    .bind(&title)
    .bind(&msg_body)
    .bind(&channels_ref)
    .bind(body.group_id)
    .bind(recipient_count)
    .bind(sender_id)
    .bind(variables_json)
    .fetch_one(&state.db)
    .await;

    let msg_id: Uuid = match msg_row {
        Ok(ref r) => r.get("id"),
        Err(e) => {
            tracing::error!(error = %e, "insert notification_message failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to save notification")
                .into_response();
        }
    };

    // Create muster marks for all recipients
    if !recipient_ids.is_empty() {
        for uid in &recipient_ids {
            let _ = sqlx::query(
                "INSERT INTO notification_muster_marks (message_id, user_id, status) VALUES ($1, $2, 'unaccounted') ON CONFLICT (message_id, user_id) DO NOTHING",
            )
            .bind(msg_id)
            .bind(uid)
            .execute(&state.db)
            .await;
        }
    }

    // Broadcast log for emergency/critical with websocket channel
    if (severity == "emergency" || severity == "critical") && channels.contains(&"websocket".to_string()) {
        tracing::warn!(
            message_id = %msg_id,
            severity = %severity,
            title = %title,
            recipient_count = recipient_count,
            "HIGH-SEVERITY NOTIFICATION BROADCAST — real delivery handled by Alert Service"
        );
    }

    let row = msg_row.unwrap();
    let sent_at: DateTime<Utc> = row.get("sent_at");
    let result_channels: Vec<String> = row.get("channels");

    (
        StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": msg_id,
                "template_id": body.template_id,
                "severity": severity,
                "title": title,
                "body": msg_body,
                "channels": result_channels,
                "group_id": body.group_id,
                "recipient_count": recipient_count,
                "sent_by": sender_id,
                "sent_at": sent_at,
                "status": "sent"
            }
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/notifications/messages/:id
// ---------------------------------------------------------------------------

pub async fn get_message(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let row = sqlx::query(
        r#"
        SELECT
            nm.id, nm.template_id,
            nt.name AS template_name,
            nm.severity, nm.title, nm.body, nm.channels,
            nm.group_id,
            ng.name AS group_name,
            nm.recipient_count, nm.sent_by,
            u.display_name AS sent_by_name,
            nm.sent_at, nm.variables_used, nm.status
        FROM notification_messages nm
        LEFT JOIN notification_templates nt ON nt.id = nm.template_id
        LEFT JOIN notification_groups ng ON ng.id = nm.group_id
        LEFT JOIN users u ON u.id = nm.sent_by
        WHERE nm.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(NotificationMessageRow {
            id: r.get("id"),
            template_id: r.get("template_id"),
            template_name: r.get("template_name"),
            severity: r.get("severity"),
            title: r.get("title"),
            body: r.get("body"),
            channels: r.get("channels"),
            group_id: r.get("group_id"),
            group_name: r.get("group_name"),
            recipient_count: r.get("recipient_count"),
            sent_by: r.get("sent_by"),
            sent_by_name: r.get("sent_by_name"),
            sent_at: r.get("sent_at"),
            variables_used: r.get("variables_used"),
            status: r.get("status"),
        })
        .into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Message not found").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_message query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch message").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/notifications/templates
// ---------------------------------------------------------------------------

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<TemplatesQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let pg = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = match sqlx::query_scalar(
        "SELECT COUNT(*) FROM notification_templates WHERE ($1::BOOLEAN IS NULL OR enabled = $1)",
    )
    .bind(q.enabled)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_templates count query failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to count templates").into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT id, name, category, severity, title_template, body_template,
               channels, variables, is_system, enabled, created_at, updated_at, created_by
        FROM notification_templates
        WHERE ($1::BOOLEAN IS NULL OR enabled = $1)
        ORDER BY is_system DESC, severity DESC, name ASC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(q.enabled)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let templates: Vec<NotificationTemplateRow> = rows
                .iter()
                .map(|r| NotificationTemplateRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    category: r.get("category"),
                    severity: r.get("severity"),
                    title_template: r.get("title_template"),
                    body_template: r.get("body_template"),
                    channels: r.get("channels"),
                    variables: r.get("variables"),
                    is_system: r.get("is_system"),
                    enabled: r.get("enabled"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                    created_by: r.get("created_by"),
                })
                .collect();
            (StatusCode::OK, Json(PagedResponse::new(templates, pg, limit, total as u64))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_templates query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch templates").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/templates
// ---------------------------------------------------------------------------

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_templates") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_templates permission required")
            .into_response();
    }

    let creator_id = user_id_from_claims(&claims);
    let category = body.category.unwrap_or_else(|| "custom".to_string());
    let severity = body.severity.unwrap_or_else(|| "info".to_string());
    let channels = body.channels.unwrap_or_else(|| vec!["websocket".to_string()]);
    let variables: Vec<String> = body.variables.unwrap_or_default();
    let channels_ref: Vec<&str> = channels.iter().map(|s| s.as_str()).collect();
    let vars_ref: Vec<&str> = variables.iter().map(|s| s.as_str()).collect();

    let row = sqlx::query(
        r#"
        INSERT INTO notification_templates
            (name, category, severity, title_template, body_template, channels, variables, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, category, severity, title_template, body_template,
                  channels, variables, is_system, enabled, created_at, updated_at, created_by
        "#,
    )
    .bind(&body.name)
    .bind(&category)
    .bind(&severity)
    .bind(&body.title_template)
    .bind(&body.body_template)
    .bind(&channels_ref)
    .bind(&vars_ref)
    .bind(creator_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => created(NotificationTemplateRow {
            id: r.get("id"),
            name: r.get("name"),
            category: r.get("category"),
            severity: r.get("severity"),
            title_template: r.get("title_template"),
            body_template: r.get("body_template"),
            channels: r.get("channels"),
            variables: r.get("variables"),
            is_system: r.get("is_system"),
            enabled: r.get("enabled"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Err(e) if e.to_string().contains("unique") || e.to_string().contains("duplicate") => {
            error_response(StatusCode::CONFLICT, "CONFLICT", "A template with that name already exists").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "create_template insert failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to create template").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/notifications/templates/:id
// ---------------------------------------------------------------------------

pub async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let row = sqlx::query(
        r#"
        SELECT id, name, category, severity, title_template, body_template,
               channels, variables, is_system, enabled, created_at, updated_at, created_by
        FROM notification_templates WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => ok(NotificationTemplateRow {
            id: r.get("id"),
            name: r.get("name"),
            category: r.get("category"),
            severity: r.get("severity"),
            title_template: r.get("title_template"),
            body_template: r.get("body_template"),
            channels: r.get("channels"),
            variables: r.get("variables"),
            is_system: r.get("is_system"),
            enabled: r.get("enabled"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Template not found").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_template query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch template").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/notifications/templates/:id
// ---------------------------------------------------------------------------

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_templates") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_templates permission required")
            .into_response();
    }

    // Check if template exists and whether it is a system template
    let existing = sqlx::query(
        "SELECT is_system FROM notification_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let is_system: bool = match existing {
        Ok(Some(r)) => r.get("is_system"),
        Ok(None) => {
            return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Template not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_template select failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch template")
                .into_response();
        }
    };

    if is_system {
        // System templates: only enabled toggle is allowed
        if body.name.is_some()
            || body.category.is_some()
            || body.severity.is_some()
            || body.title_template.is_some()
            || body.body_template.is_some()
            || body.channels.is_some()
            || body.variables.is_some()
        {
            return error_response(
                StatusCode::FORBIDDEN,
                "SYSTEM_TEMPLATE",
                "System templates can only have their 'enabled' field changed",
            )
            .into_response();
        }

        if let Some(enabled) = body.enabled {
            let row = sqlx::query(
                r#"
                UPDATE notification_templates SET enabled = $1, updated_at = now()
                WHERE id = $2
                RETURNING id, name, category, severity, title_template, body_template,
                          channels, variables, is_system, enabled, created_at, updated_at, created_by
                "#,
            )
            .bind(enabled)
            .bind(id)
            .fetch_one(&state.db)
            .await;

            return match row {
                Ok(r) => ok(NotificationTemplateRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    category: r.get("category"),
                    severity: r.get("severity"),
                    title_template: r.get("title_template"),
                    body_template: r.get("body_template"),
                    channels: r.get("channels"),
                    variables: r.get("variables"),
                    is_system: r.get("is_system"),
                    enabled: r.get("enabled"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                    created_by: r.get("created_by"),
                })
                .into_response(),
                Err(e) => {
                    tracing::error!(error = %e, "update system template failed");
                    error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Update failed").into_response()
                }
            };
        }

        return ok(json!({})).into_response(); // no-op
    }

    // User-defined template — update any provided fields
    let channels_owned: Option<Vec<String>> = body.channels.clone();
    let vars_owned: Option<Vec<String>> = body.variables.clone();
    let channels_ref: Option<Vec<&str>> = channels_owned.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());
    let vars_ref: Option<Vec<&str>> = vars_owned.as_ref().map(|v| v.iter().map(|s| s.as_str()).collect());

    let row = sqlx::query(
        r#"
        UPDATE notification_templates SET
            name            = COALESCE($1, name),
            category        = COALESCE($2, category),
            severity        = COALESCE($3, severity),
            title_template  = COALESCE($4, title_template),
            body_template   = COALESCE($5, body_template),
            channels        = COALESCE($6, channels),
            variables       = COALESCE($7, variables),
            enabled         = COALESCE($8, enabled),
            updated_at      = now()
        WHERE id = $9
        RETURNING id, name, category, severity, title_template, body_template,
                  channels, variables, is_system, enabled, created_at, updated_at, created_by
        "#,
    )
    .bind(body.name.as_deref())
    .bind(body.category.as_deref())
    .bind(body.severity.as_deref())
    .bind(body.title_template.as_deref())
    .bind(body.body_template.as_deref())
    .bind(channels_ref)
    .bind(vars_ref)
    .bind(body.enabled)
    .bind(id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => ok(NotificationTemplateRow {
            id: r.get("id"),
            name: r.get("name"),
            category: r.get("category"),
            severity: r.get("severity"),
            title_template: r.get("title_template"),
            body_template: r.get("body_template"),
            channels: r.get("channels"),
            variables: r.get("variables"),
            is_system: r.get("is_system"),
            enabled: r.get("enabled"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
        })
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_template update failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to update template").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/notifications/templates/:id
// ---------------------------------------------------------------------------

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_templates") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_templates permission required")
            .into_response();
    }

    let existing = sqlx::query("SELECT is_system FROM notification_templates WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    match existing {
        Ok(Some(r)) => {
            let is_system: bool = r.get("is_system");
            if is_system {
                return error_response(
                    StatusCode::FORBIDDEN,
                    "SYSTEM_TEMPLATE",
                    "System templates cannot be deleted",
                )
                .into_response();
            }
        }
        Ok(None) => {
            return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Template not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "delete_template select failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch template")
                .into_response();
        }
    }

    match sqlx::query("DELETE FROM notification_templates WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_template delete failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to delete template").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/notifications/groups
// ---------------------------------------------------------------------------

pub async fn list_groups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM notification_groups")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_groups count query failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to count groups").into_response();
        }
    };

    let rows = sqlx::query(
        r#"
        SELECT
            ng.id, ng.name, ng.description, ng.group_type, ng.config,
            ng.created_at, ng.updated_at, ng.created_by,
            COUNT(ngm.id) AS member_count
        FROM notification_groups ng
        LEFT JOIN notification_group_members ngm ON ngm.group_id = ng.id
        GROUP BY ng.id
        ORDER BY ng.name ASC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let groups: Vec<NotificationGroupRow> = rows
                .iter()
                .map(|r| NotificationGroupRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    description: r.get("description"),
                    group_type: r.get("group_type"),
                    config: r.get("config"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                    created_by: r.get("created_by"),
                    member_count: r.get("member_count"),
                })
                .collect();
            (StatusCode::OK, Json(PagedResponse::new(groups, pg, limit, total as u64))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_groups query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch groups").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/groups
// ---------------------------------------------------------------------------

pub async fn create_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGroupBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_groups") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_groups permission required")
            .into_response();
    }

    let creator_id = user_id_from_claims(&claims);
    let group_type = body.group_type.unwrap_or_else(|| "static".to_string());

    let row = sqlx::query(
        r#"
        INSERT INTO notification_groups (name, description, group_type, config, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, group_type, config, created_at, updated_at, created_by
        "#,
    )
    .bind(&body.name)
    .bind(body.description.as_deref())
    .bind(&group_type)
    .bind(body.config)
    .bind(creator_id)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => created(NotificationGroupRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            group_type: r.get("group_type"),
            config: r.get("config"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
            member_count: Some(0),
        })
        .into_response(),
        Err(e) if e.to_string().contains("unique") || e.to_string().contains("duplicate") => {
            error_response(StatusCode::CONFLICT, "CONFLICT", "A group with that name already exists").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "create_group insert failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to create group").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/notifications/groups/:id
// ---------------------------------------------------------------------------

pub async fn get_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let group_row = sqlx::query(
        r#"
        SELECT id, name, description, group_type, config, created_at, updated_at, created_by
        FROM notification_groups WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    let group = match group_row {
        Ok(Some(r)) => NotificationGroupRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            group_type: r.get("group_type"),
            config: r.get("config"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
            created_by: r.get("created_by"),
            member_count: None,
        },
        Ok(None) => return error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Group not found").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_group select failed");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch group")
                .into_response();
        }
    };

    let member_rows = sqlx::query(
        r#"
        SELECT ngm.id, ngm.group_id, ngm.user_id,
               u.display_name, u.email,
               ngm.added_at, ngm.added_by
        FROM notification_group_members ngm
        LEFT JOIN users u ON u.id = ngm.user_id
        WHERE ngm.group_id = $1
        ORDER BY u.display_name ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await;

    let members: Vec<NotificationGroupMemberRow> = match member_rows {
        Ok(rows) => rows
            .iter()
            .map(|r| NotificationGroupMemberRow {
                id: r.get("id"),
                group_id: r.get("group_id"),
                user_id: r.get("user_id"),
                display_name: r.get("display_name"),
                email: r.get("email"),
                added_at: r.get("added_at"),
                added_by: r.get("added_by"),
            })
            .collect(),
        Err(e) => {
            tracing::error!(error = %e, "get_group members query failed");
            Vec::new()
        }
    };

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "data": {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "group_type": group.group_type,
                "config": group.config,
                "created_at": group.created_at,
                "updated_at": group.updated_at,
                "created_by": group.created_by,
                "member_count": members.len(),
                "members": members
            }
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/notifications/groups/:id
// ---------------------------------------------------------------------------

pub async fn update_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateGroupBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_groups") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_groups permission required")
            .into_response();
    }

    let row = sqlx::query(
        r#"
        UPDATE notification_groups SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description),
            group_type  = COALESCE($3, group_type),
            config      = COALESCE($4, config),
            updated_at  = now()
        WHERE id = $5
        RETURNING id, name, description, group_type, config, created_at, updated_at, created_by
        "#,
    )
    .bind(body.name.as_deref())
    .bind(body.description.as_deref())
    .bind(body.group_type.as_deref())
    .bind(body.config)
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            let member_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM notification_group_members WHERE group_id = $1",
            )
            .bind(id)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);

            ok(NotificationGroupRow {
                id: r.get("id"),
                name: r.get("name"),
                description: r.get("description"),
                group_type: r.get("group_type"),
                config: r.get("config"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
                created_by: r.get("created_by"),
                member_count: Some(member_count),
            })
            .into_response()
        }
        Ok(None) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Group not found").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_group update failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to update group").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/notifications/groups/:id
// ---------------------------------------------------------------------------

pub async fn delete_group(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_groups") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_groups permission required")
            .into_response();
    }

    match sqlx::query("DELETE FROM notification_groups WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(_)) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Group not found").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_group failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to delete group").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/groups/:id/members
// ---------------------------------------------------------------------------

pub async fn add_group_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(group_id): Path<Uuid>,
    Json(body): Json<AddMemberBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_groups") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_groups permission required")
            .into_response();
    }

    let adder_id = user_id_from_claims(&claims);

    match sqlx::query(
        r#"
        INSERT INTO notification_group_members (group_id, user_id, added_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (group_id, user_id) DO NOTHING
        "#,
    )
    .bind(group_id)
    .bind(body.user_id)
    .bind(adder_id)
    .execute(&state.db)
    .await
    {
        Ok(_) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Err(e) if e.to_string().contains("foreign key") => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Group or user not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "add_group_member insert failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to add member").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/notifications/groups/:id/members/:user_id
// ---------------------------------------------------------------------------

pub async fn remove_group_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((group_id, user_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:manage_groups") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:manage_groups permission required")
            .into_response();
    }

    match sqlx::query(
        "DELETE FROM notification_group_members WHERE group_id = $1 AND user_id = $2 RETURNING id",
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(_)) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Ok(None) => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Member not found in group").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "remove_group_member delete failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to remove member").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/notifications/muster/:message_id
// ---------------------------------------------------------------------------

pub async fn get_muster_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(message_id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let rows = sqlx::query(
        r#"
        SELECT
            mm.id, mm.message_id, mm.user_id,
            u.display_name, u.email,
            mm.status, mm.marked_by, mm.marked_at, mm.notes
        FROM notification_muster_marks mm
        LEFT JOIN users u ON u.id = mm.user_id
        WHERE mm.message_id = $1
        ORDER BY u.display_name ASC
        "#,
    )
    .bind(message_id)
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let marks: Vec<MusterMarkRow> = rows
                .iter()
                .map(|r| MusterMarkRow {
                    id: r.get("id"),
                    message_id: r.get("message_id"),
                    user_id: r.get("user_id"),
                    display_name: r.get("display_name"),
                    email: r.get("email"),
                    status: r.get("status"),
                    marked_by: r.get("marked_by"),
                    marked_at: r.get("marked_at"),
                    notes: r.get("notes"),
                })
                .collect();

            let total = marks.len();
            let accounted = marks.iter().filter(|m| m.status == "accounted").count();
            let off_site = marks.iter().filter(|m| m.status == "off_site").count();
            let unaccounted = marks.iter().filter(|m| m.status == "unaccounted").count();

            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "data": {
                        "marks": marks,
                        "summary": {
                            "total": total,
                            "accounted": accounted,
                            "off_site": off_site,
                            "unaccounted": unaccounted
                        }
                    }
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_muster_status query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch muster status")
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/notifications/muster/:message_id/mark
// ---------------------------------------------------------------------------

pub async fn mark_muster(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(message_id): Path<Uuid>,
    Json(body): Json<MarkMusterBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:muster") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:muster permission required")
            .into_response();
    }

    let marker_id = user_id_from_claims(&claims);

    let valid_statuses = ["unaccounted", "accounted", "off_site"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return error_response(
            StatusCode::BAD_REQUEST,
            "INVALID_STATUS",
            "status must be unaccounted, accounted, or off_site",
        )
        .into_response();
    }

    let row = sqlx::query(
        r#"
        INSERT INTO notification_muster_marks (message_id, user_id, status, marked_by, marked_at, notes)
        VALUES ($1, $2, $3, $4, now(), $5)
        ON CONFLICT (message_id, user_id) DO UPDATE SET
            status    = EXCLUDED.status,
            marked_by = EXCLUDED.marked_by,
            marked_at = now(),
            notes     = EXCLUDED.notes
        RETURNING id, message_id, user_id, status, marked_by, marked_at, notes
        "#,
    )
    .bind(message_id)
    .bind(body.user_id)
    .bind(&body.status)
    .bind(marker_id)
    .bind(body.notes.as_deref())
    .fetch_one(&state.db)
    .await;

    match row {
        Ok(r) => {
            // Fetch display name for response
            let display_name: Option<String> =
                sqlx::query_scalar("SELECT display_name FROM users WHERE id = $1")
                    .bind(body.user_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten();

            let email: Option<String> =
                sqlx::query_scalar("SELECT email FROM users WHERE id = $1")
                    .bind(body.user_id)
                    .fetch_optional(&state.db)
                    .await
                    .ok()
                    .flatten();

            ok(MusterMarkRow {
                id: r.get("id"),
                message_id: r.get("message_id"),
                user_id: r.get("user_id"),
                display_name,
                email,
                status: r.get("status"),
                marked_by: r.get("marked_by"),
                marked_at: r.get("marked_at"),
                notes: r.get("notes"),
            })
            .into_response()
        }
        Err(e) if e.to_string().contains("foreign key") => {
            error_response(StatusCode::NOT_FOUND, "NOT_FOUND", "Message or user not found").into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "mark_muster upsert failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to mark muster status").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/notifications/active
// ---------------------------------------------------------------------------

pub async fn get_active_notifications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "alerts:read") {
        return error_response(StatusCode::FORBIDDEN, "FORBIDDEN", "alerts:read permission required")
            .into_response();
    }

    let rows = sqlx::query(
        r#"
        SELECT
            nm.id, nm.template_id,
            nt.name AS template_name,
            nm.severity, nm.title, nm.body, nm.channels,
            nm.group_id,
            ng.name AS group_name,
            nm.recipient_count, nm.sent_by,
            u.display_name AS sent_by_name,
            nm.sent_at, nm.variables_used, nm.status
        FROM notification_messages nm
        LEFT JOIN notification_templates nt ON nt.id = nm.template_id
        LEFT JOIN notification_groups ng ON ng.id = nm.group_id
        LEFT JOIN users u ON u.id = nm.sent_by
        WHERE nm.severity IN ('emergency', 'critical')
          AND nm.sent_at >= now() - INTERVAL '24 hours'
        ORDER BY nm.sent_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let messages: Vec<NotificationMessageRow> = rows
                .iter()
                .map(|r| NotificationMessageRow {
                    id: r.get("id"),
                    template_id: r.get("template_id"),
                    template_name: r.get("template_name"),
                    severity: r.get("severity"),
                    title: r.get("title"),
                    body: r.get("body"),
                    channels: r.get("channels"),
                    group_id: r.get("group_id"),
                    group_name: r.get("group_name"),
                    recipient_count: r.get("recipient_count"),
                    sent_by: r.get("sent_by"),
                    sent_by_name: r.get("sent_by_name"),
                    sent_at: r.get("sent_at"),
                    variables_used: r.get("variables_used"),
                    status: r.get("status"),
                })
                .collect();
            ok(messages).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_active_notifications query failed");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "DB_ERROR", "Failed to fetch active notifications")
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Route builder (called from main.rs)
// ---------------------------------------------------------------------------

pub fn notifications_routes() -> axum::Router<AppState> {
    use axum::routing::{delete, get, post};

    axum::Router::new()
        // Static routes first
        .route("/api/notifications/active", get(get_active_notifications))
        .route(
            "/api/notifications/messages",
            get(list_messages),
        )
        .route("/api/notifications/send", post(send_notification))
        .route("/api/notifications/messages/:id", get(get_message))
        .route(
            "/api/notifications/templates",
            get(list_templates).post(create_template),
        )
        .route(
            "/api/notifications/templates/:id",
            get(get_template)
                .put(update_template)
                .delete(delete_template),
        )
        .route(
            "/api/notifications/groups",
            get(list_groups).post(create_group),
        )
        .route(
            "/api/notifications/groups/:id",
            get(get_group).put(update_group).delete(delete_group),
        )
        .route(
            "/api/notifications/groups/:id/members",
            post(add_group_member),
        )
        .route(
            "/api/notifications/groups/:id/members/:user_id",
            delete(remove_group_member),
        )
        .route("/api/notifications/muster/:message_id", get(get_muster_status))
        .route(
            "/api/notifications/muster/:message_id/mark",
            post(mark_muster),
        )
}
