/// Report generation, status, download, and history handlers for the API Gateway.
///
/// Generation is async: small CSV/JSON reports (< 50 000 estimated rows) are
/// produced synchronously; all others are enqueued and a 202 is returned with
/// a job_id.  The client polls GET /api/reports/:id/status until completed,
/// then downloads via GET /api/reports/:id/download.
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
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

use crate::{report_generator, state::AppState};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct GenerateReportRequest {
    pub template_id: Uuid,
    /// Output format: csv | xlsx | html | json | pdf
    /// "pdf" is served as an HTML document in Phase 1.
    pub format: String,
    #[serde(default)]
    pub params: JsonValue,
    /// When true, email the completed report to the requesting user.
    /// Wired to the Email Service in a future phase.
    #[allow(dead_code)]
    pub notify_email: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ReportHistoryFilter {
    #[serde(flatten)]
    pub page: PageParams,
    pub status: Option<String>,
    pub format: Option<String>,
    pub template_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ReportJobRow {
    pub id: Uuid,
    pub template_id: Option<Uuid>,
    pub requested_by: Uuid,
    pub status: String,
    pub format: String,
    pub params: JsonValue,
    pub file_path: Option<String>,
    pub file_size_bytes: Option<i64>,
    pub error_message: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

fn map_job_row(r: &sqlx::postgres::PgRow) -> Result<ReportJobRow, sqlx::Error> {
    Ok(ReportJobRow {
        id: r.try_get("id")?,
        template_id: r.try_get("template_id")?,
        requested_by: r.try_get("requested_by")?,
        status: r.try_get("status")?,
        format: r.try_get("format")?,
        params: r.try_get("params")?,
        file_path: r.try_get("file_path")?,
        file_size_bytes: r.try_get("file_size_bytes")?,
        error_message: r.try_get("error_message")?,
        started_at: r.try_get("started_at")?,
        completed_at: r.try_get("completed_at")?,
        expires_at: r.try_get("expires_at")?,
        created_at: r.try_get("created_at")?,
    })
}

// ---------------------------------------------------------------------------
// POST /api/reports/generate
// ---------------------------------------------------------------------------

pub async fn generate_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<GenerateReportRequest>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    if !claims.permissions.iter().any(|p| p == "*" || p == "reports:export") {
        return IoError::Forbidden("reports:export permission required".into()).into_response();
    }

    let valid_formats = ["csv", "xlsx", "html", "json", "pdf"];
    if !valid_formats.contains(&req.format.as_str()) {
        return IoError::BadRequest(
            "format must be one of: csv, xlsx, html, json, pdf".into(),
        )
        .into_response();
    }

    // Verify template exists
    let template_exists: bool = match sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM report_templates WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(req.template_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r.get::<bool, _>(0),
        Err(e) => {
            tracing::error!(error = %e, "DB error checking template");
            return IoError::Database(e).into_response();
        }
    };

    if !template_exists {
        return IoError::NotFound(format!("Report template {} not found", req.template_id))
            .into_response();
    }

    // For lightweight formats (CSV / JSON), run synchronously if we can't
    // easily estimate row count.  All others are async.
    let sync_formats = ["csv", "json"];
    let run_sync = sync_formats.contains(&req.format.as_str());

    // Insert job record
    let job_id = Uuid::new_v4();
    if let Err(e) = sqlx::query(
        "INSERT INTO report_jobs
             (id, template_id, requested_by, status, format, params, expires_at)
         VALUES ($1, $2, $3, 'pending', $4, $5, NOW() + INTERVAL '24 hours')",
    )
    .bind(job_id)
    .bind(req.template_id)
    .bind(user_id)
    .bind(&req.format)
    .bind(&req.params)
    .execute(&state.db)
    .await
    {
        tracing::error!(error = %e, "Failed to insert report_job");
        return IoError::Database(e).into_response();
    }

    if run_sync {
        // Run in the current task (still async, but we await it)
        let db_clone = state.db.clone();
        let export_dir = state.config.export_dir.clone();
        let format = req.format.clone();
        let params = req.params.clone();
        let template_id = req.template_id;

        // Update status to running
        sqlx::query("UPDATE report_jobs SET status='running', started_at=NOW() WHERE id=$1")
            .bind(job_id)
            .execute(&state.db)
            .await
            .ok();

        match report_generator::generate_report_job(
            &db_clone,
            job_id,
            template_id,
            &format,
            params,
            &export_dir,
        )
        .await
        {
            Ok((path, size)) => {
                sqlx::query(
                    "UPDATE report_jobs SET status='completed', file_path=$1, file_size_bytes=$2, completed_at=NOW() WHERE id=$3",
                )
                .bind(&path)
                .bind(size as i64)
                .bind(job_id)
                .execute(&state.db)
                .await
                .ok();

                // Notify via pg_notify for WebSocket subscribers
                sqlx::query("SELECT pg_notify('export_complete', $1)")
                    .bind(serde_json::json!({"job_id": job_id}).to_string())
                    .execute(&state.db)
                    .await
                    .ok();

                Json(ApiResponse::ok(serde_json::json!({
                    "job_id": job_id,
                    "status": "completed",
                    "file_path": path,
                    "file_size_bytes": size
                })))
                .into_response()
            }
            Err(e) => {
                sqlx::query(
                    "UPDATE report_jobs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2",
                )
                .bind(&e)
                .bind(job_id)
                .execute(&state.db)
                .await
                .ok();
                IoError::Internal(format!("Report generation failed: {e}")).into_response()
            }
        }
    } else {
        // Async path: spawn background task, return 202
        let db = state.db.clone();
        let export_dir = state.config.export_dir.clone();
        let format = req.format.clone();
        let params = req.params.clone();
        let template_id = req.template_id;

        tokio::spawn(async move {
            // Update status to running
            sqlx::query("UPDATE report_jobs SET status='running', started_at=NOW() WHERE id=$1")
                .bind(job_id)
                .execute(&db)
                .await
                .ok();

            match report_generator::generate_report_job(
                &db,
                job_id,
                template_id,
                &format,
                params,
                &export_dir,
            )
            .await
            {
                Ok((path, size)) => {
                    sqlx::query(
                        "UPDATE report_jobs SET status='completed', file_path=$1, file_size_bytes=$2, completed_at=NOW() WHERE id=$3",
                    )
                    .bind(&path)
                    .bind(size as i64)
                    .bind(job_id)
                    .execute(&db)
                    .await
                    .ok();

                    // Notify via pg_notify for WebSocket subscribers
                    sqlx::query("SELECT pg_notify('export_complete', $1)")
                        .bind(serde_json::json!({"job_id": job_id}).to_string())
                        .execute(&db)
                        .await
                        .ok();
                }
                Err(e) => {
                    tracing::error!(job_id = %job_id, error = %e, "Async report generation failed");
                    sqlx::query(
                        "UPDATE report_jobs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2",
                    )
                    .bind(&e)
                    .bind(job_id)
                    .execute(&db)
                    .await
                    .ok();
                }
            }
        });

        (
            StatusCode::ACCEPTED,
            Json(ApiResponse::ok(serde_json::json!({ "job_id": job_id }))),
        )
            .into_response()
    }
}

// ---------------------------------------------------------------------------
// GET /api/reports/:id/status
// ---------------------------------------------------------------------------

pub async fn get_report_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, template_id, requested_by, status, format, params,
                file_path, file_size_bytes, error_message,
                started_at, completed_at, expires_at, created_at
         FROM report_jobs
         WHERE id = $1 AND requested_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Report job {id} not found")).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_report_status query failed");
            return IoError::Database(e).into_response();
        }
    };

    match map_job_row(&row) {
        Ok(job) => Json(ApiResponse::ok(job)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// GET /api/reports/:id/download
// ---------------------------------------------------------------------------

pub async fn download_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, status, format, file_path, requested_by
         FROM report_jobs
         WHERE id = $1 AND requested_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Report job {id} not found")).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "download_report query failed");
            return IoError::Database(e).into_response();
        }
    };

    let status: String = row.try_get("status").unwrap_or_default();
    if status != "completed" {
        return IoError::BadRequest(format!(
            "Report is not ready (status: {status}). Poll /api/reports/{id}/status first."
        ))
        .into_response();
    }

    let file_path: Option<String> = row.try_get("file_path").unwrap_or_default();
    let file_path = match file_path {
        Some(p) => p,
        None => return IoError::Internal("Report has no file path".into()).into_response(),
    };

    let format: String = row.try_get("format").unwrap_or_else(|_| "html".to_string());

    let content = match std::fs::read(&file_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, path = %file_path, "Failed to read report file");
            return IoError::Internal("Report file not found on disk".into()).into_response();
        }
    };

    let (content_type, file_ext) = format_to_content_type(&format);
    let file_name = format!("report-{id}.{file_ext}");

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{file_name}\""),
        )
        .header(header::CONTENT_LENGTH, content.len())
        .body(Body::from(content))
        .unwrap_or_else(|_| IoError::Internal("Response build failed".into()).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/reports/history
// ---------------------------------------------------------------------------

pub async fn list_report_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<ReportHistoryFilter>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // Admins can see all jobs; regular users see only their own
    let is_admin = claims.permissions.iter().any(|p| p == "*" || p == "system:admin");

    let page = filter.page.page();
    let limit = filter.page.limit();
    let offset = filter.page.offset();

    let total_row = sqlx::query(
        "SELECT COUNT(*) FROM report_jobs
         WHERE ($1::boolean = true OR requested_by = $2)
           AND ($3::text IS NULL OR status = $3)
           AND ($4::text IS NULL OR format = $4)
           AND ($5::uuid IS NULL OR template_id = $5)",
    )
    .bind(is_admin)
    .bind(user_id)
    .bind(filter.status.as_deref())
    .bind(filter.format.as_deref())
    .bind(filter.template_id)
    .fetch_one(&state.db)
    .await;

    let total: i64 = match total_row {
        Ok(r) => r.get::<i64, _>(0),
        Err(e) => {
            tracing::error!(error = %e, "list_report_history count query failed");
            return IoError::Database(e).into_response();
        }
    };

    let rows = match sqlx::query(
        "SELECT id, template_id, requested_by, status, format, params,
                file_path, file_size_bytes, error_message,
                started_at, completed_at, expires_at, created_at
         FROM report_jobs
         WHERE ($1::boolean = true OR requested_by = $2)
           AND ($3::text IS NULL OR status = $3)
           AND ($4::text IS NULL OR format = $4)
           AND ($5::uuid IS NULL OR template_id = $5)
         ORDER BY created_at DESC
         LIMIT $6 OFFSET $7",
    )
    .bind(is_admin)
    .bind(user_id)
    .bind(filter.status.as_deref())
    .bind(filter.format.as_deref())
    .bind(filter.template_id)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_report_history query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<ReportJobRow> = rows
        .iter()
        .filter_map(|r| match map_job_row(r) {
            Ok(job) => Some(job),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed report_job row");
                None
            }
        })
        .collect();

    Json(PagedResponse::new(items, page, limit, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/reports/exports  (My Exports — own completed jobs)
// ---------------------------------------------------------------------------

pub async fn list_my_exports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let pg = page.page();
    let limit = page.limit();
    let offset = page.offset();

    let total: i64 = match sqlx::query(
        "SELECT COUNT(*) FROM report_jobs
         WHERE requested_by = $1 AND status = 'completed' AND (expires_at IS NULL OR expires_at > NOW())",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r.get::<i64, _>(0),
        Err(e) => {
            tracing::error!(error = %e, "list_my_exports count query failed");
            return IoError::Database(e).into_response();
        }
    };

    let rows = match sqlx::query(
        "SELECT id, template_id, requested_by, status, format, params,
                file_path, file_size_bytes, error_message,
                started_at, completed_at, expires_at, created_at
         FROM report_jobs
         WHERE requested_by = $1 AND status = 'completed'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY completed_at DESC
         LIMIT $2 OFFSET $3",
    )
    .bind(user_id)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_my_exports query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<ReportJobRow> = rows
        .iter()
        .filter_map(|r| match map_job_row(r) {
            Ok(job) => Some(job),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed report_job row");
                None
            }
        })
        .collect();

    Json(PagedResponse::new(items, pg, limit, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn format_to_content_type(format: &str) -> (&'static str, &'static str) {
    match format {
        "csv" => ("text/csv; charset=utf-8", "csv"),
        "xlsx" => (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsx",
        ),
        "json" => ("application/json; charset=utf-8", "json"),
        _ => ("text/html; charset=utf-8", "html"),
    }
}
