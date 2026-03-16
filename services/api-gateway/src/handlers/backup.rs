/// Backup & Restore handlers for the API Gateway.
///
/// Provides pg_dump-based backup creation, listing, download, deletion, and
/// pg_restore-based restore.  All endpoints require the `system:backup`
/// permission.  The backup directory is configured via `IO_BACKUP_DIR` (default
/// `/tmp/io-backups`).
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::Utc;
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn require_backup_permission(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == "system:backup")
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct BackupFile {
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBackupRequest {
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RestoreBackupRequest {
    pub filename: String,
}

// ---------------------------------------------------------------------------
// GET /api/backup/list
// ---------------------------------------------------------------------------

pub async fn list_backups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !require_backup_permission(&claims) {
        return IoError::Forbidden("system:backup permission required".into()).into_response();
    }

    let backup_dir = &state.config.backup_dir;

    let entries = match std::fs::read_dir(backup_dir) {
        Ok(e) => e,
        Err(e) => {
            tracing::error!(error = %e, backup_dir = %backup_dir, "Failed to read backup directory");
            return IoError::Internal(format!("Failed to read backup directory: {e}")).into_response();
        }
    };

    let mut files: Vec<BackupFile> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        // Only include .pgdump files
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext != "pgdump" {
            continue;
        }

        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let metadata = match std::fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let size_bytes = metadata.len();

        // Extract created_at from system metadata, fallback to now
        let created_at = metadata
            .modified()
            .ok()
            .and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                    let secs = d.as_secs() as i64;
                    chrono::DateTime::<Utc>::from_timestamp(secs, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| Utc::now().to_rfc3339())
                })
            })
            .unwrap_or_else(|| Utc::now().to_rfc3339());

        // Extract label from filename: {timestamp}_{label}.pgdump
        // e.g. 20240315_143022_manual.pgdump → label = "manual"
        let label = filename
            .strip_suffix(".pgdump")
            .and_then(|s| s.splitn(3, '_').nth(2))
            .unwrap_or("manual")
            .to_string();

        files.push(BackupFile {
            filename,
            size_bytes,
            created_at,
            label,
        });
    }

    // Sort newest first (by filename, which starts with timestamp)
    files.sort_by(|a, b| b.filename.cmp(&a.filename));

    Json(ApiResponse::ok(files)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/backup/create
// ---------------------------------------------------------------------------

pub async fn create_backup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    body: Option<Json<CreateBackupRequest>>,
) -> impl IntoResponse {
    if !require_backup_permission(&claims) {
        return IoError::Forbidden("system:backup permission required".into()).into_response();
    }

    let label = body
        .and_then(|Json(req)| req.label)
        .unwrap_or_else(|| "manual".to_string());

    // Sanitise label: allow only alphanumeric, hyphens, underscores
    let label: String = label
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(64)
        .collect();

    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("{timestamp}_{label}.pgdump");
    let backup_path = format!("{}/{}", state.config.backup_dir, filename);
    let database_url = state.config.database_url.clone();

    tracing::info!(filename = %filename, "Starting pg_dump backup");

    let output = match tokio::process::Command::new("pg_dump")
        .args([
            "--format=custom",
            "--no-password",
            "-f",
            &backup_path,
            &database_url,
        ])
        .output()
        .await
    {
        Ok(o) => o,
        Err(e) => {
            tracing::error!(error = %e, "Failed to spawn pg_dump");
            return IoError::Internal(format!("Failed to run pg_dump: {e}")).into_response();
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        tracing::error!(stderr = %stderr, "pg_dump exited with non-zero status");
        return IoError::Internal(format!("pg_dump failed: {stderr}")).into_response();
    }

    let size_bytes = std::fs::metadata(&backup_path)
        .map(|m| m.len())
        .unwrap_or(0);

    tracing::info!(filename = %filename, size_bytes = size_bytes, "Backup created successfully");

    Json(ApiResponse::ok(serde_json::json!({
        "filename": filename,
        "size_bytes": size_bytes,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/backup/download/:filename
// ---------------------------------------------------------------------------

pub async fn download_backup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(filename): Path<String>,
) -> Response {
    if !require_backup_permission(&claims) {
        return IoError::Forbidden("system:backup permission required".into()).into_response();
    }

    // Reject path traversal attempts
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return IoError::BadRequest("Invalid filename".into()).into_response();
    }

    let path = format!("{}/{}", state.config.backup_dir, filename);

    let content = match std::fs::read(&path) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, path = %path, "Failed to read backup file");
            return IoError::NotFound(format!("Backup file not found: {filename}")).into_response();
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .header(header::CONTENT_LENGTH, content.len())
        .body(Body::from(content))
        .unwrap_or_else(|_| IoError::Internal("Response build failed".into()).into_response())
}

// ---------------------------------------------------------------------------
// DELETE /api/backup/:filename
// ---------------------------------------------------------------------------

pub async fn delete_backup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(filename): Path<String>,
) -> impl IntoResponse {
    if !require_backup_permission(&claims) {
        return IoError::Forbidden("system:backup permission required".into()).into_response();
    }

    // Reject path traversal attempts
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return IoError::BadRequest("Invalid filename".into()).into_response();
    }

    let path = format!("{}/{}", state.config.backup_dir, filename);

    match std::fs::remove_file(&path) {
        Ok(()) => {
            tracing::info!(filename = %filename, "Backup file deleted");
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response()
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            IoError::NotFound(format!("Backup file not found: {filename}")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, path = %path, "Failed to delete backup file");
            IoError::Internal(format!("Failed to delete backup: {e}")).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/backup/restore
// ---------------------------------------------------------------------------

pub async fn restore_backup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<RestoreBackupRequest>,
) -> impl IntoResponse {
    if !require_backup_permission(&claims) {
        return IoError::Forbidden("system:backup permission required".into()).into_response();
    }

    let filename = &req.filename;

    // Reject path traversal attempts
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return IoError::BadRequest("Invalid filename".into()).into_response();
    }

    let backup_path = format!("{}/{}", state.config.backup_dir, filename);

    // Verify file exists before spawning restore
    if !std::path::Path::new(&backup_path).exists() {
        return IoError::NotFound(format!("Backup file not found: {filename}")).into_response();
    }

    let database_url = state.config.database_url.clone();
    let filename_clone = filename.clone();

    tracing::warn!(filename = %filename, "Initiating pg_restore — this will overwrite all data");

    // Spawn in background; restore can be slow
    tokio::spawn(async move {
        let output = tokio::process::Command::new("pg_restore")
            .args(["--clean", "--no-password", "-d", &database_url, &backup_path])
            .output()
            .await;

        match output {
            Ok(o) if o.status.success() => {
                tracing::info!(filename = %filename_clone, "pg_restore completed successfully");
            }
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr);
                tracing::error!(filename = %filename_clone, stderr = %stderr, "pg_restore failed");
            }
            Err(e) => {
                tracing::error!(filename = %filename_clone, error = %e, "Failed to spawn pg_restore");
            }
        }
    });

    Json(ApiResponse::ok(serde_json::json!({
        "success": true,
        "message": "Restore initiated",
    })))
    .into_response()
}
