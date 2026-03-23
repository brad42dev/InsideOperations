/// Universal Export handler — /api/exports endpoint.
///
/// Supports 6 output formats: CSV, XLSX, PDF, JSON, Parquet, HTML.
/// Requests with an estimated row count < 50,000 are served synchronously
/// (file streamed directly to the HTTP response).  Requests at or above
/// 50,000 rows are queued as async jobs; the user receives a 202 Accepted
/// response with a job ID and a WebSocket notification when the file is ready.
///
/// RBAC: callers must hold the `<module>:export` permission (e.g. `settings:export`).
///
/// Parquet type mapping (§3.2):
///   TEXT / VARCHAR  → Utf8
///   FLOAT8          → Float64
///   TIMESTAMPTZ     → TimestampMicrosecond
///   BOOLEAN         → Boolean
///   INTEGER / INT4  → Int32
///   UUID            → Utf8
///   JSONB           → Utf8
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::Utc;
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PageParams, PagedResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::{report_generator, state::AppState};

// ---------------------------------------------------------------------------
// Row threshold
// ---------------------------------------------------------------------------

const SYNC_ROW_THRESHOLD: i64 = 50_000;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

/// POST /api/exports request body (§13.1)
#[derive(Debug, Deserialize)]
pub struct CreateExportRequest {
    /// Module that owns the data (e.g. "settings", "console", "rounds")
    pub module: String,
    /// Entity / table within the module (e.g. "points", "users", "workspaces")
    pub entity: String,
    /// Output format: csv | xlsx | pdf | json | parquet | html
    pub format: String,
    /// "all" or "filtered"
    #[serde(default = "default_scope")]
    pub scope: String,
    /// Arbitrary filter criteria — passed through to the query builder
    #[serde(default)]
    pub filters: JsonValue,
    /// Columns to include (None = all eligible)
    pub columns: Option<Vec<String>>,
    /// Sort configuration
    pub sort: Option<SortSpec>,
    /// When true, email the completed file to the requesting user (Phase 14+)
    #[serde(default)]
    pub notify_email: bool,
}

fn default_scope() -> String {
    "all".to_string()
}

#[derive(Debug, Deserialize)]
pub struct SortSpec {
    pub field: String,
    #[serde(default = "default_sort_order")]
    pub order: String,
}

fn default_sort_order() -> String {
    "asc".to_string()
}

/// Rows returned by GET /api/exports
#[derive(Debug, Serialize)]
pub struct ExportJobRow {
    pub id: Uuid,
    pub job_type: String,
    pub status: String,
    pub module: String,
    pub entity: String,
    pub format: Option<String>,
    pub rows_total: Option<i32>,
    pub rows_processed: i32,
    pub file_size_bytes: Option<i64>,
    pub original_filename: Option<String>,
    pub error_message: Option<String>,
    pub notify_email: bool,
    pub created_by: Uuid,
    pub created_at: chrono::DateTime<Utc>,
    pub started_at: Option<chrono::DateTime<Utc>>,
    pub completed_at: Option<chrono::DateTime<Utc>>,
}

fn map_export_row(r: &sqlx::postgres::PgRow) -> Result<ExportJobRow, sqlx::Error> {
    Ok(ExportJobRow {
        id: r.try_get("id")?,
        job_type: r.try_get("job_type")?,
        status: r.try_get("status")?,
        module: r.try_get("module")?,
        entity: r.try_get("entity")?,
        format: r.try_get("format")?,
        rows_total: r.try_get("rows_total")?,
        rows_processed: r.try_get("rows_processed")?,
        file_size_bytes: r.try_get("file_size_bytes")?,
        original_filename: r.try_get("original_filename")?,
        error_message: r.try_get("error_message")?,
        notify_email: r.try_get("notify_email")?,
        created_by: r.try_get("created_by")?,
        created_at: r.try_get("created_at")?,
        started_at: r.try_get("started_at")?,
        completed_at: r.try_get("completed_at")?,
    })
}

// ---------------------------------------------------------------------------
// GET /api/exports — list own export jobs
// ---------------------------------------------------------------------------

pub async fn list_exports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = match sqlx::query(
        "SELECT COUNT(*) FROM export_jobs
         WHERE created_by = $1 AND job_type = 'data_export'",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r.get::<i64, _>(0),
        Err(e) => {
            tracing::error!(error = %e, "list_exports count failed");
            return IoError::Database(e).into_response();
        }
    };

    let rows = match sqlx::query(
        "SELECT id, job_type, status, module, entity, format,
                rows_total, rows_processed, file_size_bytes, original_filename,
                error_message, notify_email, created_by, created_at, started_at, completed_at
         FROM export_jobs
         WHERE created_by = $1 AND job_type = 'data_export'
         ORDER BY created_at DESC
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
            tracing::error!(error = %e, "list_exports query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<ExportJobRow> = rows
        .iter()
        .filter_map(|r| match map_export_row(r) {
            Ok(job) => Some(job),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed export_job row");
                None
            }
        })
        .collect();

    Json(PagedResponse::new(items, pg, limit, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/exports — create export job (sync or async)
// ---------------------------------------------------------------------------

pub async fn create_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateExportRequest>,
) -> Response {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // RBAC: require <module>:export permission
    let required_perm = format!("{}:export", req.module);
    if !claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == &required_perm)
    {
        return IoError::Forbidden(format!("{required_perm} permission required")).into_response();
    }

    // Validate format
    let valid_formats = ["csv", "xlsx", "pdf", "json", "parquet", "html"];
    if !valid_formats.contains(&req.format.as_str()) {
        return IoError::BadRequest(
            "format must be one of: csv, xlsx, pdf, json, parquet, html".into(),
        )
        .into_response();
    }

    // Validate sort order if provided
    if let Some(ref sort) = req.sort {
        if sort.order != "asc" && sort.order != "desc" {
            return IoError::BadRequest("sort.order must be 'asc' or 'desc'".into())
                .into_response();
        }
    }

    // Estimate row count for the given module/entity/filters
    let estimated_rows = estimate_row_count(&state.db, &req.module, &req.entity, &req.filters)
        .await
        .unwrap_or(0);

    // Build the user-facing filename: {module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}
    let now = Utc::now();
    let timestamp = now.format("%Y-%m-%d_%H%M").to_string();
    let file_ext = format_extension(&req.format);
    let original_filename = format!(
        "{}_{}_{}.{}",
        req.module, req.entity, timestamp, file_ext
    );

    let sort_field = req.sort.as_ref().map(|s| s.field.clone());
    let sort_order = req
        .sort
        .as_ref()
        .map(|s| s.order.clone())
        .unwrap_or_else(|| "asc".to_string());

    // Insert job record
    let job_id = Uuid::new_v4();
    if let Err(e) = sqlx::query(
        "INSERT INTO export_jobs
             (id, job_type, status, module, entity, format,
              filters, columns, sort_field, sort_order,
              rows_total, notify_email, original_filename, created_by)
         VALUES ($1, 'data_export', 'queued', $2, $3, $4,
                 $5, $6, $7, $8,
                 $9, $10, $11, $12)",
    )
    .bind(job_id)
    .bind(&req.module)
    .bind(&req.entity)
    .bind(&req.format)
    .bind(&req.filters)
    .bind(&req.columns)
    .bind(&sort_field)
    .bind(&sort_order)
    .bind(estimated_rows as i32)
    .bind(req.notify_email)
    .bind(&original_filename)
    .bind(user_id)
    .execute(&state.db)
    .await
    {
        tracing::error!(error = %e, "Failed to insert export_job");
        return IoError::Database(e).into_response();
    }

    if estimated_rows < SYNC_ROW_THRESHOLD {
        // Synchronous path: generate immediately
        let db = state.db.clone();
        let export_dir = state.config.export_dir.clone();
        let module = req.module.clone();
        let entity = req.entity.clone();
        let format = req.format.clone();
        let filters = req.filters.clone();
        let columns = req.columns.clone();
        let sort_field2 = sort_field.clone();
        let sort_order2 = sort_order.clone();
        let filename = original_filename.clone();

        // Mark as processing
        sqlx::query(
            "UPDATE export_jobs SET status='processing', started_at=NOW() WHERE id=$1",
        )
        .bind(job_id)
        .execute(&state.db)
        .await
        .ok();

        match run_export_job(
            &db,
            &export_dir,
            job_id,
            &module,
            &entity,
            &format,
            &filters,
            columns.as_deref(),
            sort_field2.as_deref(),
            &sort_order2,
            &filename,
        )
        .await
        {
            Ok((file_path, file_size)) => {
                sqlx::query(
                    "UPDATE export_jobs
                     SET status='completed', file_path=$1, file_size_bytes=$2, completed_at=NOW()
                     WHERE id=$3",
                )
                .bind(&file_path)
                .bind(file_size as i64)
                .bind(job_id)
                .execute(&state.db)
                .await
                .ok();

                sqlx::query("SELECT pg_notify('export_complete', $1)")
                    .bind(
                        serde_json::json!({
                            "job_id": job_id,
                            "type": "data_export"
                        })
                        .to_string(),
                    )
                    .execute(&state.db)
                    .await
                    .ok();

                Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, format_content_type(&format))
                    .header(
                        header::CONTENT_DISPOSITION,
                        format!("attachment; filename=\"{original_filename}\""),
                    )
                    .header(header::CONTENT_LENGTH, file_size)
                    .body(Body::from(
                        std::fs::read(&file_path).unwrap_or_default(),
                    ))
                    .unwrap_or_else(|_| {
                        IoError::Internal("Response build failed".into()).into_response()
                    })
            }
            Err(e) => {
                sqlx::query(
                    "UPDATE export_jobs
                     SET status='failed', error_message=$1, completed_at=NOW()
                     WHERE id=$2",
                )
                .bind(&e)
                .bind(job_id)
                .execute(&state.db)
                .await
                .ok();
                IoError::Internal(format!("Export generation failed: {e}")).into_response()
            }
        }
    } else {
        // Asynchronous path: spawn background task, return 202
        let db = state.db.clone();
        let export_dir = state.config.export_dir.clone();
        let module = req.module.clone();
        let entity = req.entity.clone();
        let format = req.format.clone();
        let filters = req.filters.clone();
        let columns = req.columns.clone();
        let sort_field2 = sort_field.clone();
        let sort_order2 = sort_order.clone();
        let filename = original_filename.clone();

        tokio::spawn(async move {
            sqlx::query(
                "UPDATE export_jobs SET status='processing', started_at=NOW() WHERE id=$1",
            )
            .bind(job_id)
            .execute(&db)
            .await
            .ok();

            match run_export_job(
                &db,
                &export_dir,
                job_id,
                &module,
                &entity,
                &format,
                &filters,
                columns.as_deref(),
                sort_field2.as_deref(),
                &sort_order2,
                &filename,
            )
            .await
            {
                Ok((file_path, file_size)) => {
                    sqlx::query(
                        "UPDATE export_jobs
                         SET status='completed', file_path=$1, file_size_bytes=$2, completed_at=NOW()
                         WHERE id=$3",
                    )
                    .bind(&file_path)
                    .bind(file_size as i64)
                    .bind(job_id)
                    .execute(&db)
                    .await
                    .ok();

                    sqlx::query("SELECT pg_notify('export_complete', $1)")
                        .bind(
                            serde_json::json!({
                                "job_id": job_id,
                                "type": "data_export"
                            })
                            .to_string(),
                        )
                        .execute(&db)
                        .await
                        .ok();
                }
                Err(e) => {
                    tracing::error!(job_id = %job_id, error = %e, "Async export generation failed");
                    sqlx::query(
                        "UPDATE export_jobs
                         SET status='failed', error_message=$1, completed_at=NOW()
                         WHERE id=$2",
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
            Json(ApiResponse::ok(serde_json::json!({
                "id": job_id,
                "status": "queued",
                "rows_total": estimated_rows,
                "message": "Export queued. You will be notified when the file is ready."
            }))),
        )
            .into_response()
    }
}

// ---------------------------------------------------------------------------
// GET /api/exports/:id — get export job status
// ---------------------------------------------------------------------------

pub async fn get_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, job_type, status, module, entity, format,
                rows_total, rows_processed, file_size_bytes, original_filename,
                error_message, notify_email, created_by, created_at, started_at, completed_at
         FROM export_jobs
         WHERE id = $1 AND created_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Export job {id} not found")).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_export query failed");
            return IoError::Database(e).into_response();
        }
    };

    match map_export_row(&row) {
        Ok(job) => Json(ApiResponse::ok(job)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/exports/:id — cancel or delete an export job
// ---------------------------------------------------------------------------

pub async fn delete_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // Fetch the job to check ownership and get file_path for cleanup
    let row = match sqlx::query(
        "SELECT id, status, file_path, created_by FROM export_jobs
         WHERE id = $1 AND created_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Export job {id} not found")).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_export query failed");
            return IoError::Database(e).into_response();
        }
    };

    let status: String = row.try_get("status").unwrap_or_default();
    let file_path: Option<String> = row.try_get("file_path").unwrap_or_default();

    // If job is queued or processing, cancel it; otherwise mark cancelled
    let new_status = if status == "queued" || status == "processing" {
        "cancelled"
    } else {
        "cancelled"
    };

    if let Err(e) = sqlx::query(
        "UPDATE export_jobs SET status=$1, completed_at=COALESCE(completed_at, NOW())
         WHERE id=$2",
    )
    .bind(new_status)
    .bind(id)
    .execute(&state.db)
    .await
    {
        tracing::error!(error = %e, "delete_export update failed");
        return IoError::Database(e).into_response();
    }

    // Best-effort: delete the file from disk
    if let Some(path) = file_path {
        if !path.is_empty() {
            let _ = std::fs::remove_file(&path);
        }
    }

    Json(ApiResponse::ok(serde_json::json!({ "id": id, "status": "cancelled" }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/exports/:id/download — stream the generated file
// ---------------------------------------------------------------------------

pub async fn download_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, status, format, file_path, original_filename, created_by
         FROM export_jobs
         WHERE id = $1 AND created_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Export job {id} not found")).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "download_export query failed");
            return IoError::Database(e).into_response();
        }
    };

    let status: String = row.try_get("status").unwrap_or_default();
    if status != "completed" {
        return IoError::BadRequest(format!(
            "Export is not ready (status: {status}). Poll GET /api/exports/{id} first."
        ))
        .into_response();
    }

    let file_path: Option<String> = row.try_get("file_path").unwrap_or_default();
    let file_path = match file_path {
        Some(p) if !p.is_empty() => p,
        _ => return IoError::Internal("Export file has no path".into()).into_response(),
    };

    let format: String = row
        .try_get("format")
        .unwrap_or_else(|_| Some("csv".to_string()))
        .unwrap_or_else(|| "csv".to_string());

    let original_filename: Option<String> = row.try_get("original_filename").unwrap_or_default();
    let download_name = original_filename.unwrap_or_else(|| format!("export-{id}.{}", format_extension(&format)));

    let content = match std::fs::read(&file_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, path = %file_path, "Failed to read export file");
            return IoError::Internal("Export file not found on disk".into()).into_response();
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, format_content_type(&format))
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{download_name}\""),
        )
        .header(header::CONTENT_LENGTH, content.len())
        .body(Body::from(content))
        .unwrap_or_else(|_| IoError::Internal("Response build failed".into()).into_response())
}

// ---------------------------------------------------------------------------
// Export job execution
// ---------------------------------------------------------------------------

/// Generate the export file and return (file_path, file_size_bytes).
async fn run_export_job(
    db: &sqlx::PgPool,
    export_dir: &str,
    job_id: Uuid,
    module: &str,
    entity: &str,
    format: &str,
    filters: &JsonValue,
    columns: Option<&[String]>,
    sort_field: Option<&str>,
    sort_order: &str,
    original_filename: &str,
) -> Result<(String, u64), String> {
    // Query the database for the requested module/entity data
    let (headers, rows) =
        query_export_data(db, module, entity, filters, columns, sort_field, sort_order).await?;

    // Determine title for XLSX/HTML
    let title = format!("{module} — {entity}");

    // Build file path
    let file_name = format!("{job_id}.{}", format_extension(format));
    let file_path = format!("{export_dir}/{file_name}");

    std::fs::create_dir_all(export_dir)
        .map_err(|e| format!("Failed to create export_dir {export_dir}: {e}"))?;

    let content: Vec<u8> = match format {
        "csv" => report_generator::generate_csv(&headers, &rows),
        "xlsx" => report_generator::generate_xlsx(&title, &headers, &rows)
            .map_err(|e| format!("XLSX generation failed: {e}"))?,
        "json" => report_generator::generate_json(&headers, &rows),
        "parquet" => write_parquet(&headers, &rows, &file_path)
            .map_err(|e| format!("Parquet generation failed: {e}"))?,
        "pdf" => report_generator::generate_pdf_report(
            &title,
            "",
            &headers,
            &rows,
            &JsonValue::Null,
        ),
        _ => {
            // html
            report_generator::generate_html_report(
                &title,
                "",
                &headers,
                &rows,
                &JsonValue::Null,
            )
            .into_bytes()
        }
    };

    // Parquet writes directly to disk in write_parquet(); other formats go here.
    if format != "parquet" {
        let file_size = content.len() as u64;
        std::fs::write(&file_path, &content)
            .map_err(|e| format!("Failed to write export file {file_path}: {e}"))?;
        Ok((file_path, file_size))
    } else {
        // Parquet was already written; content is empty, get size from disk.
        let file_size = std::fs::metadata(&file_path)
            .map(|m| m.len())
            .unwrap_or(0);
        Ok((file_path, file_size))
    }
}

// ---------------------------------------------------------------------------
// Parquet writer
// ---------------------------------------------------------------------------

/// Write rows to a Parquet file at `path`.
/// Returns empty Vec on success (file is written to disk, not buffered in memory).
/// Type mapping per §3.2: all string columns map to Utf8 (since query_export_data
/// returns Vec<Vec<String>>); a future typed-row variant can use proper Arrow types.
fn write_parquet(
    headers: &[String],
    rows: &[Vec<String>],
    path: &str,
) -> Result<Vec<u8>, String> {
    use parquet::data_type::ByteArray;
    use parquet::file::properties::WriterProperties;
    use parquet::file::writer::SerializedFileWriter;
    use parquet::schema::parser::parse_message_type;
    use std::fs::File;
    use std::sync::Arc;

    if headers.is_empty() {
        // Write an empty Parquet file with no schema
        File::create(path).map_err(|e| format!("Failed to create parquet file: {e}"))?;
        return Ok(vec![]);
    }

    // Build schema: all columns are optional UTF8
    let schema_fields: String = headers
        .iter()
        .map(|h| {
            // Sanitise column name: replace non-alphanumeric chars with underscore
            let safe: String = h
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
                .collect();
            format!("  OPTIONAL BYTE_ARRAY {} (UTF8);", safe)
        })
        .collect::<Vec<_>>()
        .join("\n");

    let schema_str = format!("message export_data {{\n{schema_fields}\n}}");

    let schema = parse_message_type(&schema_str)
        .map_err(|e| format!("Parquet schema parse failed: {e}"))?;
    let schema = Arc::new(schema);

    let props = WriterProperties::builder()
        .set_compression(parquet::basic::Compression::SNAPPY)
        .set_write_batch_size(10_000)
        .build();
    let props = Arc::new(props);

    let file = File::create(path).map_err(|e| format!("Failed to create parquet file: {e}"))?;

    let mut writer = SerializedFileWriter::new(file, schema, props)
        .map_err(|e| format!("Failed to create parquet writer: {e}"))?;

    // Write in row groups of 10,000 rows
    for chunk in rows.chunks(10_000) {
        let mut rg = writer
            .next_row_group()
            .map_err(|e| format!("Failed to start parquet row group: {e}"))?;

        for col_idx in 0..headers.len() {
            let mut col_writer = rg
                .next_column()
                .map_err(|e| format!("Failed to get column writer: {e}"))?
                .ok_or_else(|| "No column writer available".to_string())?;

            {
                // Use .typed::<ByteArrayType>() to get the typed column writer
                let typed = col_writer.typed::<parquet::data_type::ByteArrayType>();
                let values: Vec<ByteArray> = chunk
                    .iter()
                    .map(|row| {
                        let cell = row.get(col_idx).cloned().unwrap_or_default();
                        ByteArray::from(cell.as_bytes().to_vec())
                    })
                    .collect();

                // All values are defined (no nulls in our string representation)
                let def_levels: Vec<i16> = vec![1; values.len()];

                typed
                    .write_batch(&values, Some(&def_levels), None)
                    .map_err(|e| format!("Parquet write_batch failed: {e}"))?;
            }

            col_writer
                .close()
                .map_err(|e| format!("Failed to close column writer: {e}"))?;
        }

        rg.close()
            .map_err(|e| format!("Failed to close parquet row group: {e}"))?;
    }

    writer
        .close()
        .map_err(|e| format!("Failed to finalise parquet file: {e}"))?;

    Ok(vec![])
}

// ---------------------------------------------------------------------------
// Data query builder
// ---------------------------------------------------------------------------

/// Estimate the number of rows that would be returned for a given module/entity/filters.
async fn estimate_row_count(
    db: &sqlx::PgPool,
    module: &str,
    entity: &str,
    _filters: &JsonValue,
) -> Result<i64, String> {
    let table = module_entity_to_table(module, entity);
    if table.is_empty() {
        return Ok(0);
    }
    // Use reltuples from pg_class for a fast estimate; fall back to COUNT.
    // Wrapping the table name via a safe lookup (module_entity_to_table) prevents injection.
    let sql = format!(
        "SELECT reltuples::bigint FROM pg_class WHERE relname = '{table}'"
    );
    match sqlx::query(&sql).fetch_optional(db).await {
        Ok(Some(r)) => {
            let estimate: i64 = r.try_get::<i64, _>(0).unwrap_or(0);
            // reltuples can be -1 if statistics haven't been gathered yet
            if estimate <= 0 {
                // Fall back to exact count
                let count_sql = format!("SELECT COUNT(*) FROM {table}");
                match sqlx::query(&count_sql).fetch_one(db).await {
                    Ok(row) => Ok(row.get::<i64, _>(0)),
                    Err(_) => Ok(0),
                }
            } else {
                Ok(estimate)
            }
        }
        Ok(None) => Ok(0),
        Err(_) => Ok(0),
    }
}

/// Map a module+entity pair to the canonical PostgreSQL table name.
/// Only tables known to the system are returned; anything unknown returns "".
fn module_entity_to_table(module: &str, entity: &str) -> &'static str {
    match (module, entity) {
        ("settings", "points") | ("console", "points") | ("process", "points") => "points",
        ("settings", "users") => "users",
        ("settings", "roles") => "roles",
        ("settings", "point_sources") => "point_sources",
        ("console", "workspaces") => "console_workspaces",
        ("designer", "graphics") => "graphics",
        ("dashboards", "dashboards") => "dashboards",
        ("reports", "templates") => "report_templates",
        ("rounds", "templates") => "round_templates",
        ("rounds", "instances") => "round_instances",
        ("rounds", "observations") => "round_observations",
        ("log", "entries") | ("log", "instances") => "log_instances",
        ("forensics", "investigations") => "investigations",
        ("settings", "alarm_definitions") => "alarm_definitions",
        _ => "",
    }
}

/// Query data for the requested module/entity and return (headers, rows).
async fn query_export_data(
    db: &sqlx::PgPool,
    module: &str,
    entity: &str,
    filters: &JsonValue,
    columns: Option<&[String]>,
    sort_field: Option<&str>,
    sort_order: &str,
) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let table = module_entity_to_table(module, entity);
    if table.is_empty() {
        // Unknown module/entity — return empty result rather than error
        return Ok((vec!["message".to_string()], vec![
            vec![format!("No data connector registered for {module}/{entity}")]
        ]));
    }

    // Build dynamic query using only safe, allowlisted column/table names.
    // Columns specified by the caller are validated against the allowlist returned
    // by allowed_columns_for_table(); unknown column names are silently dropped.
    let allowed = allowed_columns_for_table(table);
    if allowed.is_empty() {
        return Ok((vec!["message".to_string()], vec![
            vec!["Data export not yet implemented for this entity".to_string()]
        ]));
    }

    // Resolve requested columns — default to all allowed columns
    let resolved_cols: Vec<&str> = if let Some(requested) = columns {
        requested
            .iter()
            .filter_map(|c| {
                allowed.iter().find(|&&a| a == c.as_str()).copied()
            })
            .collect()
    } else {
        allowed.to_vec()
    };

    if resolved_cols.is_empty() {
        return Ok((
            vec!["message".to_string()],
            vec![vec!["No valid columns selected".to_string()]],
        ));
    }

    let col_list = resolved_cols.join(", ");

    // Safe sort: only allow allowlisted column names
    let safe_sort_field = sort_field
        .and_then(|f| allowed.iter().find(|&&a| a == f).copied())
        .or_else(|| resolved_cols.first().copied())
        .unwrap_or("id");

    let safe_sort_order = if sort_order == "desc" { "DESC" } else { "ASC" };

    // Build WHERE clause from filters (simple key=value equality; keys validated against allowlist)
    let (where_clause, bind_values) = build_where_clause(filters, &allowed);

    let sql = format!(
        "SELECT {col_list} FROM {table}{} ORDER BY {safe_sort_field} {safe_sort_order} LIMIT 500000",
        if where_clause.is_empty() { String::new() } else { format!(" WHERE {where_clause}") }
    );

    let mut query = sqlx::query(&sql);
    for val in &bind_values {
        query = query.bind(val);
    }

    let rows = query
        .fetch_all(db)
        .await
        .map_err(|e| format!("DB error querying {table}: {e}"))?;

    let headers: Vec<String> = resolved_cols.iter().map(|c| c.to_string()).collect();

    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|row| {
            resolved_cols
                .iter()
                .map(|col| {
                    // Try to extract as string; fall back gracefully for typed columns
                    if let Ok(v) = row.try_get::<Option<String>, _>(*col) {
                        v.unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<i64>, _>(*col) {
                        v.map(|n| n.to_string()).unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<i32>, _>(*col) {
                        v.map(|n| n.to_string()).unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<f64>, _>(*col) {
                        v.map(|n| format!("{n:.6}")).unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<bool>, _>(*col) {
                        v.map(|b| b.to_string()).unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<chrono::DateTime<Utc>>, _>(*col) {
                        v.map(|t| t.to_rfc3339()).unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<Uuid>, _>(*col) {
                        v.map(|u| u.to_string()).unwrap_or_default()
                    } else if let Ok(v) = row.try_get::<Option<JsonValue>, _>(*col) {
                        v.map(|j| j.to_string()).unwrap_or_default()
                    } else {
                        String::new()
                    }
                })
                .collect()
        })
        .collect();

    Ok((headers, data))
}

/// Return the safe, allowlisted column names for a given table.
fn allowed_columns_for_table(table: &str) -> &'static [&'static str] {
    match table {
        "points" => &[
            "id", "tag_path", "name", "description", "data_type", "unit",
            "source_id", "node_id", "scan_rate_ms", "deadband", "enabled",
            "created_at", "updated_at",
        ],
        "users" => &[
            "id", "username", "display_name", "email", "role_id",
            "is_active", "created_at", "updated_at",
        ],
        "roles" => &[
            "id", "name", "description", "is_system", "created_at",
        ],
        "point_sources" => &[
            "id", "name", "protocol", "endpoint_url", "enabled",
            "scan_rate_ms", "created_at", "updated_at",
        ],
        "console_workspaces" => &[
            "id", "name", "description", "owner_id", "is_published",
            "created_at", "updated_at",
        ],
        "graphics" => &[
            "id", "name", "description", "type", "created_by",
            "created_at", "updated_at",
        ],
        "dashboards" => &[
            "id", "name", "description", "owner_id", "is_public",
            "created_at", "updated_at",
        ],
        "report_templates" => &[
            "id", "name", "description", "category", "created_at",
        ],
        "round_templates" => &[
            "id", "name", "description", "frequency", "enabled",
            "created_at", "updated_at",
        ],
        "round_instances" => &[
            "id", "template_id", "status", "scheduled_at", "due_at",
            "started_at", "completed_at", "assigned_to",
        ],
        "round_observations" => &[
            "id", "instance_id", "checkpoint_id", "value_text",
            "is_exception", "recorded_at", "recorded_by",
        ],
        "log_instances" => &[
            "id", "template_id", "status", "submitted_at", "created_by",
            "created_at", "updated_at",
        ],
        "investigations" => &[
            "id", "title", "description", "status", "created_by",
            "created_at", "updated_at",
        ],
        "alarm_definitions" => &[
            "id", "name", "tag_path", "condition_type", "priority",
            "enabled", "created_at", "updated_at",
        ],
        _ => &[],
    }
}

/// Build a safe parameterised WHERE clause from filter JSON.
/// Only keys present in the column allowlist are accepted; values are bound
/// as query parameters to prevent SQL injection.
fn build_where_clause(
    filters: &JsonValue,
    allowed: &[&str],
) -> (String, Vec<String>) {
    let mut conditions: Vec<String> = Vec::new();
    let mut values: Vec<String> = Vec::new();

    if let Some(obj) = filters.as_object() {
        let mut param_idx = 1usize;
        for (key, val) in obj {
            // Only accept keys in the column allowlist
            if !allowed.contains(&key.as_str()) {
                continue;
            }
            if let Some(v) = val.as_str() {
                conditions.push(format!("{key} = ${param_idx}"));
                values.push(v.to_string());
                param_idx += 1;
            } else if let Some(n) = val.as_i64() {
                conditions.push(format!("{key} = ${param_idx}"));
                values.push(n.to_string());
                param_idx += 1;
            } else if let Some(b) = val.as_bool() {
                conditions.push(format!("{key} = ${param_idx}"));
                values.push(b.to_string());
                param_idx += 1;
            }
            // Ignore complex types (arrays, objects) in filters
        }
    }

    (conditions.join(" AND "), values)
}

// ---------------------------------------------------------------------------
// Cleanup task
// ---------------------------------------------------------------------------

/// Hourly background task that deletes export files older than
/// `EXPORT_RETENTION_HOURS` (default 24h) and nulls their file_path in DB.
pub async fn run_export_cleanup_task(db: sqlx::PgPool, export_dir: String) {
    let retention_hours: u64 = std::env::var("EXPORT_RETENTION_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(24);

    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;

        tracing::debug!("Running export cleanup (retention={}h)", retention_hours);

        let rows = sqlx::query(
            "UPDATE export_jobs
             SET file_path = NULL
             WHERE status = 'completed'
               AND file_path IS NOT NULL
               AND completed_at < NOW() - $1::interval
             RETURNING file_path",
        )
        .bind(format!("{retention_hours} hours"))
        .fetch_all(&db)
        .await;

        match rows {
            Ok(expired) => {
                for row in &expired {
                    if let Ok(Some(path)) = row.try_get::<Option<String>, _>("file_path") {
                        if !path.is_empty() {
                            if let Err(e) = std::fs::remove_file(&path) {
                                tracing::warn!(
                                    path = %path,
                                    error = %e,
                                    "Failed to delete expired export file"
                                );
                            }
                        }
                    }
                }
                tracing::debug!("Export cleanup: {} files expired", expired.len());
            }
            Err(e) => {
                tracing::error!(error = %e, "Export cleanup DB query failed");
            }
        }

        // Also remove orphaned files from export_dir not tracked in DB
        if let Ok(entries) = std::fs::read_dir(&export_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(age) =
                            std::time::SystemTime::now().duration_since(modified)
                        {
                            if age.as_secs() > retention_hours * 3600 {
                                let _ = std::fs::remove_file(&path);
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

fn format_extension(format: &str) -> &'static str {
    match format {
        "csv" => "csv",
        "xlsx" => "xlsx",
        "json" => "json",
        "parquet" => "parquet",
        "pdf" => "pdf",
        _ => "html",
    }
}

fn format_content_type(format: &str) -> &'static str {
    match format {
        "csv" => "text/csv; charset=utf-8",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "json" => "application/json; charset=utf-8",
        "parquet" => "application/octet-stream",
        "pdf" => "application/pdf",
        _ => "text/html; charset=utf-8",
    }
}
