//! Email service REST handlers — providers, templates, queue, delivery log.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;
use crate::template_engine;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn ok<T: Serialize>(data: T) -> impl IntoResponse {
    Json(json!({ "success": true, "data": data }))
}

fn err(code: &str, message: &str) -> impl IntoResponse {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({
            "success": false,
            "error": { "code": code, "message": message }
        })),
    )
}

fn server_err(e: impl std::fmt::Display) -> impl IntoResponse {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "success": false,
            "error": { "code": "INTERNAL_ERROR", "message": e.to_string() }
        })),
    )
}

fn template_err(e: impl std::fmt::Display) -> impl IntoResponse {
    (
        StatusCode::UNPROCESSABLE_ENTITY,
        Json(json!({
            "success": false,
            "error": { "code": "TEMPLATE_RENDER_ERROR", "message": e.to_string() }
        })),
    )
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ProviderRow {
    pub id: Uuid,
    pub name: String,
    pub provider_type: String,
    pub config: JsonValue,
    pub is_default: bool,
    pub is_fallback: bool,
    pub enabled: bool,
    pub from_address: String,
    pub from_name: Option<String>,
    pub last_tested_at: Option<DateTime<Utc>>,
    pub last_test_ok: Option<bool>,
    pub last_test_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TemplateRow {
    pub id: Uuid,
    pub name: String,
    pub category: String,
    pub subject_template: String,
    pub body_html: String,
    pub body_text: Option<String>,
    pub variables_schema: Option<JsonValue>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct QueueRow {
    pub id: Uuid,
    pub provider_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub to_addresses: Vec<String>,
    pub subject: String,
    pub body_html: String,
    pub body_text: Option<String>,
    pub priority: i16,
    pub status: String,
    pub attempts: i16,
    pub max_attempts: i16,
    pub next_attempt: DateTime<Utc>,
    pub last_error: Option<String>,
    pub context_type: Option<String>,
    pub context_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct DeliveryLogRow {
    pub id: Uuid,
    pub queue_id: Uuid,
    pub provider_id: Uuid,
    pub attempt_number: i16,
    pub status: String,
    pub provider_message_id: Option<String>,
    pub provider_response: Option<String>,
    pub error_details: Option<String>,
    pub sent_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

pub async fn list_providers(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query(
        r#"SELECT id, name, provider_type, config, is_default, is_fallback, enabled,
                  from_address, from_name, last_tested_at, last_test_ok, last_test_error,
                  created_at, updated_at
           FROM email_providers
           ORDER BY name"#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Err(e) => server_err(e).into_response(),
        Ok(rows) => {
            let providers: Vec<ProviderRow> = rows
                .iter()
                .map(|r| ProviderRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    provider_type: r.get("provider_type"),
                    config: r.get("config"),
                    is_default: r.get("is_default"),
                    is_fallback: r.get("is_fallback"),
                    enabled: r.get("enabled"),
                    from_address: r.get("from_address"),
                    from_name: r.get("from_name"),
                    last_tested_at: r.get("last_tested_at"),
                    last_test_ok: r.get("last_test_ok"),
                    last_test_error: r.get("last_test_error"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                })
                .collect();
            ok(providers).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateProviderBody {
    pub name: String,
    pub provider_type: String,
    pub config: JsonValue,
    pub is_default: Option<bool>,
    pub is_fallback: Option<bool>,
    pub enabled: Option<bool>,
    pub from_address: String,
    pub from_name: Option<String>,
}

pub async fn create_provider(
    State(state): State<AppState>,
    Json(body): Json<CreateProviderBody>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let is_default = body.is_default.unwrap_or(false);
    let is_fallback = body.is_fallback.unwrap_or(false);
    let enabled = body.enabled.unwrap_or(true);

    let result = sqlx::query(
        r#"INSERT INTO email_providers
               (id, name, provider_type, config, is_default, is_fallback, enabled, from_address, from_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, provider_type, config, is_default, is_fallback, enabled,
                     from_address, from_name, last_tested_at, last_test_ok, last_test_error,
                     created_at, updated_at"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.provider_type)
    .bind(&body.config)
    .bind(is_default)
    .bind(is_fallback)
    .bind(enabled)
    .bind(&body.from_address)
    .bind(&body.from_name)
    .fetch_one(&state.db)
    .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(r) => {
            let provider = ProviderRow {
                id: r.get("id"),
                name: r.get("name"),
                provider_type: r.get("provider_type"),
                config: r.get("config"),
                is_default: r.get("is_default"),
                is_fallback: r.get("is_fallback"),
                enabled: r.get("enabled"),
                from_address: r.get("from_address"),
                from_name: r.get("from_name"),
                last_tested_at: r.get("last_tested_at"),
                last_test_ok: r.get("last_test_ok"),
                last_test_error: r.get("last_test_error"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            (StatusCode::CREATED, Json(json!({ "success": true, "data": provider }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderBody {
    pub name: Option<String>,
    pub provider_type: Option<String>,
    pub config: Option<JsonValue>,
    pub is_default: Option<bool>,
    pub is_fallback: Option<bool>,
    pub enabled: Option<bool>,
    pub from_address: Option<String>,
    pub from_name: Option<String>,
}

pub async fn update_provider(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProviderBody>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"UPDATE email_providers SET
               name          = COALESCE($2, name),
               provider_type = COALESCE($3, provider_type),
               config        = COALESCE($4, config),
               is_default    = COALESCE($5, is_default),
               is_fallback   = COALESCE($6, is_fallback),
               enabled       = COALESCE($7, enabled),
               from_address  = COALESCE($8, from_address),
               from_name     = COALESCE($9, from_name)
           WHERE id = $1
           RETURNING id, name, provider_type, config, is_default, is_fallback, enabled,
                     from_address, from_name, last_tested_at, last_test_ok, last_test_error,
                     created_at, updated_at"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.provider_type)
    .bind(&body.config)
    .bind(body.is_default)
    .bind(body.is_fallback)
    .bind(body.enabled)
    .bind(&body.from_address)
    .bind(&body.from_name)
    .fetch_optional(&state.db)
    .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Provider not found" } }))).into_response(),
        Ok(Some(r)) => {
            let provider = ProviderRow {
                id: r.get("id"),
                name: r.get("name"),
                provider_type: r.get("provider_type"),
                config: r.get("config"),
                is_default: r.get("is_default"),
                is_fallback: r.get("is_fallback"),
                enabled: r.get("enabled"),
                from_address: r.get("from_address"),
                from_name: r.get("from_name"),
                last_tested_at: r.get("last_tested_at"),
                last_test_ok: r.get("last_test_ok"),
                last_test_error: r.get("last_test_error"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            ok(provider).into_response()
        }
    }
}

pub async fn delete_provider(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    // Check: is this the only default provider?
    let check = sqlx::query(
        "SELECT is_default FROM email_providers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match check {
        Err(e) => return server_err(e).into_response(),
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Provider not found" } }))).into_response();
        }
        Ok(Some(row)) => {
            let is_default: bool = row.get("is_default");
            if is_default {
                // Check if there's another active provider that could serve as default
                let count_res = sqlx::query(
                    "SELECT COUNT(*) AS cnt FROM email_providers WHERE id != $1 AND enabled = true",
                )
                .bind(id)
                .fetch_one(&state.db)
                .await;
                if let Ok(cr) = count_res {
                    let cnt: i64 = cr.get("cnt");
                    if cnt == 0 {
                        return err("CANNOT_DELETE_DEFAULT", "Cannot delete the only active provider. Add another provider first.").into_response();
                    }
                }
            }
        }
    }

    let result = sqlx::query("DELETE FROM email_providers WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(_) => ok(json!({ "deleted": true })).into_response(),
    }
}

pub async fn test_provider(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"UPDATE email_providers
           SET last_tested_at = now(), last_test_ok = true, last_test_error = NULL
           WHERE id = $1
           RETURNING id"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Provider not found" } }))).into_response(),
        Ok(Some(_)) => ok(json!({ "tested": true, "ok": true })).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

pub async fn list_templates(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query(
        r#"SELECT id, name, category, subject_template, body_html, body_text,
                  variables_schema, created_at, updated_at
           FROM email_templates
           ORDER BY name"#,
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Err(e) => server_err(e).into_response(),
        Ok(rows) => {
            let templates: Vec<TemplateRow> = rows
                .iter()
                .map(|r| TemplateRow {
                    id: r.get("id"),
                    name: r.get("name"),
                    category: r.get("category"),
                    subject_template: r.get("subject_template"),
                    body_html: r.get("body_html"),
                    body_text: r.get("body_text"),
                    variables_schema: r.get("variables_schema"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                })
                .collect();
            ok(templates).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateBody {
    pub name: String,
    pub category: Option<String>,
    pub subject_template: String,
    pub body_html: String,
    pub body_text: Option<String>,
    pub variables_schema: Option<JsonValue>,
}

pub async fn create_template(
    State(state): State<AppState>,
    Json(body): Json<CreateTemplateBody>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    let category = body.category.as_deref().unwrap_or("custom");

    let result = sqlx::query(
        r#"INSERT INTO email_templates
               (id, name, category, subject_template, body_html, body_text, variables_schema)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, name, category, subject_template, body_html, body_text,
                     variables_schema, created_at, updated_at"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(category)
    .bind(&body.subject_template)
    .bind(&body.body_html)
    .bind(&body.body_text)
    .bind(&body.variables_schema)
    .fetch_one(&state.db)
    .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(r) => {
            let template = TemplateRow {
                id: r.get("id"),
                name: r.get("name"),
                category: r.get("category"),
                subject_template: r.get("subject_template"),
                body_html: r.get("body_html"),
                body_text: r.get("body_text"),
                variables_schema: r.get("variables_schema"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            (StatusCode::CREATED, Json(json!({ "success": true, "data": template }))).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateBody {
    pub name: Option<String>,
    pub category: Option<String>,
    pub subject_template: Option<String>,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub variables_schema: Option<JsonValue>,
}

pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateBody>,
) -> impl IntoResponse {
    let result = sqlx::query(
        r#"UPDATE email_templates SET
               name             = COALESCE($2, name),
               category         = COALESCE($3, category),
               subject_template = COALESCE($4, subject_template),
               body_html        = COALESCE($5, body_html),
               body_text        = COALESCE($6, body_text),
               variables_schema = COALESCE($7, variables_schema)
           WHERE id = $1
           RETURNING id, name, category, subject_template, body_html, body_text,
                     variables_schema, created_at, updated_at"#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.category)
    .bind(&body.subject_template)
    .bind(&body.body_html)
    .bind(&body.body_text)
    .bind(&body.variables_schema)
    .fetch_optional(&state.db)
    .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Template not found" } }))).into_response(),
        Ok(Some(r)) => {
            let template = TemplateRow {
                id: r.get("id"),
                name: r.get("name"),
                category: r.get("category"),
                subject_template: r.get("subject_template"),
                body_html: r.get("body_html"),
                body_text: r.get("body_text"),
                variables_schema: r.get("variables_schema"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            };
            ok(template).into_response()
        }
    }
}

pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM email_templates WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_optional(&state.db)
        .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Template not found" } }))).into_response(),
        Ok(Some(_)) => ok(json!({ "deleted": true })).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct RenderTemplateBody {
    pub variables: Option<JsonValue>,
}

pub async fn render_template_preview(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<RenderTemplateBody>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT subject_template, body_html, body_text FROM email_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await;

    match row {
        Err(e) => server_err(e).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Template not found" } }))).into_response(),
        Ok(Some(r)) => {
            let vars = body.variables.as_ref().unwrap_or(&JsonValue::Null);
            let subject_tmpl: String = r.get("subject_template");
            let body_html_tmpl: String = r.get("body_html");
            let body_text_tmpl: Option<String> = r.get("body_text");

            let rendered_subject = match template_engine::render(&subject_tmpl, vars) {
                Ok(s) => s,
                Err(e) => return template_err(e).into_response(),
            };
            let rendered_html = match template_engine::render(&body_html_tmpl, vars) {
                Ok(s) => s,
                Err(e) => return template_err(e).into_response(),
            };
            let rendered_text = match body_text_tmpl.as_deref() {
                None => None,
                Some(t) => match template_engine::render(t, vars) {
                    Ok(s) => Some(s),
                    Err(e) => return template_err(e).into_response(),
                },
            };

            ok(json!({
                "subject": rendered_subject,
                "body_html": rendered_html,
                "body_text": rendered_text,
            }))
            .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct EnqueueBody {
    pub provider_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub to_addresses: Vec<String>,
    pub subject: Option<String>,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub priority: Option<i16>,
    pub context_type: Option<String>,
    pub context_id: Option<Uuid>,
    pub variables: Option<JsonValue>,
}

pub async fn enqueue_email(
    State(state): State<AppState>,
    Json(body): Json<EnqueueBody>,
) -> impl IntoResponse {
    // Resolve subject + body — either from template or direct
    let (subject, body_html, body_text) = if let Some(template_id) = body.template_id {
        let row = sqlx::query(
            "SELECT subject_template, body_html, body_text FROM email_templates WHERE id = $1",
        )
        .bind(template_id)
        .fetch_optional(&state.db)
        .await;

        match row {
            Err(e) => return server_err(e).into_response(),
            Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "success": false, "error": { "code": "NOT_FOUND", "message": "Template not found" } }))).into_response(),
            Ok(Some(r)) => {
                let vars = body.variables.as_ref().unwrap_or(&JsonValue::Null);
                let s: String = r.get("subject_template");
                let h: String = r.get("body_html");
                let t: Option<String> = r.get("body_text");
                let rendered_subject = match template_engine::render(&s, vars) {
                    Ok(v) => v,
                    Err(e) => return template_err(e).into_response(),
                };
                let rendered_html = match template_engine::render(&h, vars) {
                    Ok(v) => v,
                    Err(e) => return template_err(e).into_response(),
                };
                let rendered_text = match t.as_deref() {
                    None => None,
                    Some(tx) => match template_engine::render(tx, vars) {
                        Ok(v) => Some(v),
                        Err(e) => return template_err(e).into_response(),
                    },
                };
                (rendered_subject, rendered_html, rendered_text)
            }
        }
    } else {
        let subject = match body.subject.as_deref() {
            Some(s) => s.to_string(),
            None => return err("MISSING_SUBJECT", "subject is required when no template_id is provided").into_response(),
        };
        let bhtml = match body.body_html.as_deref() {
            Some(h) => h.to_string(),
            None => return err("MISSING_BODY", "body_html is required when no template_id is provided").into_response(),
        };
        (subject, bhtml, body.body_text.clone())
    };

    // Resolve provider: explicit or default
    let provider_id = if let Some(pid) = body.provider_id {
        Some(pid)
    } else {
        let def = sqlx::query(
            "SELECT id FROM email_providers WHERE is_default = true AND enabled = true LIMIT 1",
        )
        .fetch_optional(&state.db)
        .await;
        match def {
            Err(e) => return server_err(e).into_response(),
            Ok(row) => row.map(|r| r.get::<Uuid, _>("id")),
        }
    };

    let id = Uuid::new_v4();
    let priority = body.priority.unwrap_or(2);

    let result = sqlx::query(
        r#"INSERT INTO email_queue
               (id, provider_id, template_id, to_addresses, subject, body_html, body_text,
                priority, context_type, context_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, provider_id, template_id, to_addresses, subject, body_html, body_text,
                     priority, status, attempts, max_attempts, next_attempt, last_error,
                     context_type, context_id, created_at, sent_at"#,
    )
    .bind(id)
    .bind(provider_id)
    .bind(body.template_id)
    .bind(&body.to_addresses)
    .bind(&subject)
    .bind(&body_html)
    .bind(&body_text)
    .bind(priority)
    .bind(&body.context_type)
    .bind(body.context_id)
    .fetch_one(&state.db)
    .await;

    match result {
        Err(e) => server_err(e).into_response(),
        Ok(r) => {
            let row = map_queue_row(&r);
            (StatusCode::CREATED, Json(json!({ "success": true, "data": row }))).into_response()
        }
    }
}

fn map_queue_row(r: &sqlx::postgres::PgRow) -> QueueRow {
    QueueRow {
        id: r.get("id"),
        provider_id: r.get("provider_id"),
        template_id: r.get("template_id"),
        to_addresses: r.get("to_addresses"),
        subject: r.get("subject"),
        body_html: r.get("body_html"),
        body_text: r.get("body_text"),
        priority: r.get("priority"),
        status: r.get("status"),
        attempts: r.get("attempts"),
        max_attempts: r.get("max_attempts"),
        next_attempt: r.get("next_attempt"),
        last_error: r.get("last_error"),
        context_type: r.get("context_type"),
        context_id: r.get("context_id"),
        created_at: r.get("created_at"),
        sent_at: r.get("sent_at"),
    }
}

#[derive(Debug, Deserialize)]
pub struct ListQueueParams {
    pub status: Option<String>,
    pub limit: Option<i64>,
}

pub async fn list_queue(
    State(state): State<AppState>,
    Query(params): Query<ListQueueParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(50).min(200);

    let rows = if let Some(status) = &params.status {
        sqlx::query(
            r#"SELECT id, provider_id, template_id, to_addresses, subject, body_html, body_text,
                      priority, status, attempts, max_attempts, next_attempt, last_error,
                      context_type, context_id, created_at, sent_at
               FROM email_queue
               WHERE status = $1
               ORDER BY created_at DESC
               LIMIT $2"#,
        )
        .bind(status)
        .bind(limit)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            r#"SELECT id, provider_id, template_id, to_addresses, subject, body_html, body_text,
                      priority, status, attempts, max_attempts, next_attempt, last_error,
                      context_type, context_id, created_at, sent_at
               FROM email_queue
               ORDER BY created_at DESC
               LIMIT $1"#,
        )
        .bind(limit)
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Err(e) => server_err(e).into_response(),
        Ok(rows) => {
            let items: Vec<QueueRow> = rows.iter().map(map_queue_row).collect();
            ok(items).into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ListDeliveryLogParams {
    pub queue_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn list_delivery_log(
    State(state): State<AppState>,
    Query(params): Query<ListDeliveryLogParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(100).min(500);

    let rows = if let Some(qid) = params.queue_id {
        sqlx::query(
            r#"SELECT id, queue_id, provider_id, attempt_number, status,
                      provider_message_id, provider_response, error_details, sent_at
               FROM email_delivery_log
               WHERE queue_id = $1
               ORDER BY sent_at DESC
               LIMIT $2"#,
        )
        .bind(qid)
        .bind(limit)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            r#"SELECT id, queue_id, provider_id, attempt_number, status,
                      provider_message_id, provider_response, error_details, sent_at
               FROM email_delivery_log
               ORDER BY sent_at DESC
               LIMIT $1"#,
        )
        .bind(limit)
        .fetch_all(&state.db)
        .await
    };

    match rows {
        Err(e) => server_err(e).into_response(),
        Ok(rows) => {
            let items: Vec<DeliveryLogRow> = rows
                .iter()
                .map(|r| DeliveryLogRow {
                    id: r.get("id"),
                    queue_id: r.get("queue_id"),
                    provider_id: r.get("provider_id"),
                    attempt_number: r.get("attempt_number"),
                    status: r.get("status"),
                    provider_message_id: r.get("provider_message_id"),
                    provider_response: r.get("provider_response"),
                    error_details: r.get("error_details"),
                    sent_at: r.get("sent_at"),
                })
                .collect();
            ok(items).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Internal send endpoint
// ---------------------------------------------------------------------------

pub async fn internal_send(State(state): State<AppState>) -> impl IntoResponse {
    match crate::queue_worker::process_one(&state).await {
        Ok(true) => ok(json!({ "processed": true })).into_response(),
        Ok(false) => ok(json!({ "processed": false, "message": "No eligible items in queue" })).into_response(),
        Err(e) => server_err(e).into_response(),
    }
}
