use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PageParams, PagedResponse};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct OpcServerCert {
    pub id: Uuid,
    pub source_id: Option<Uuid>,
    pub source_name: Option<String>,
    /// SHA-256 hex fingerprint
    pub fingerprint: String,
    /// Human-readable fingerprint (colon-separated pairs)
    pub fingerprint_display: String,
    pub subject: Option<String>,
    pub issuer: Option<String>,
    pub not_before: Option<DateTime<Utc>>,
    pub not_after: Option<DateTime<Utc>>,
    pub expired: bool,
    /// "pending" | "trusted" | "rejected"
    pub status: String,
    pub auto_trusted: bool,
    pub reviewed_by: Option<Uuid>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub first_seen_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
}

fn format_fingerprint(hex: &str) -> String {
    hex.chars()
        .collect::<Vec<_>>()
        .chunks(2)
        .map(|c| c.iter().collect::<String>().to_uppercase())
        .collect::<Vec<_>>()
        .join(":")
}

fn row_to_cert(row: &sqlx::postgres::PgRow) -> OpcServerCert {
    let fingerprint: String = row.try_get("fingerprint").unwrap_or_default();
    let not_after: Option<DateTime<Utc>> = row.try_get("not_after").ok().flatten();
    let expired = not_after.map(|t| t < Utc::now()).unwrap_or(false);
    OpcServerCert {
        id: row.try_get("id").unwrap_or_else(|_| Uuid::nil()),
        source_id: row.try_get("source_id").ok().flatten(),
        source_name: row.try_get("source_name").ok().flatten(),
        fingerprint_display: format_fingerprint(&fingerprint),
        fingerprint,
        subject: row.try_get("subject").ok().flatten(),
        issuer: row.try_get("issuer").ok().flatten(),
        not_before: row.try_get("not_before").ok().flatten(),
        not_after,
        expired,
        status: row.try_get("status").unwrap_or_else(|_| "pending".to_string()),
        auto_trusted: row.try_get("auto_trusted").unwrap_or(false),
        reviewed_by: row.try_get("reviewed_by").ok().flatten(),
        reviewed_at: row.try_get("reviewed_at").ok().flatten(),
        first_seen_at: row.try_get("first_seen_at").unwrap_or_else(|_| Utc::now()),
        last_seen_at: row.try_get("last_seen_at").unwrap_or_else(|_| Utc::now()),
    }
}

// ---------------------------------------------------------------------------
// GET /api/opc/server-certs
// ---------------------------------------------------------------------------

pub async fn list_server_certs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<PageParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "system:opc_config") {
        return IoError::Forbidden("system:opc_config permission required".into()).into_response();
    }

    let pg = page.page();
    let limit = page.limit();
    let offset = page.offset();

    let total: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM opc_server_certs")
        .fetch_one(&state.db)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "list_server_certs: count query failed");
            return IoError::Database(e).into_response();
        }
    };

    let rows = match sqlx::query(
        "SELECT id, source_id, source_name, fingerprint, subject, issuer, \
                not_before, not_after, status, auto_trusted, reviewed_by, \
                reviewed_at, first_seen_at, last_seen_at \
         FROM opc_server_certs \
         ORDER BY last_seen_at DESC \
         LIMIT $1 OFFSET $2",
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_server_certs: DB query failed");
            return IoError::Database(e).into_response();
        }
    };

    let certs: Vec<OpcServerCert> = rows.iter().map(row_to_cert).collect();
    Json(PagedResponse::new(certs, pg, limit, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/opc/server-certs/:id
// ---------------------------------------------------------------------------

pub async fn get_server_cert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "system:opc_config") {
        return IoError::Forbidden("system:opc_config permission required".into()).into_response();
    }

    let row = match sqlx::query(
        "SELECT id, source_id, source_name, fingerprint, subject, issuer, \
                not_before, not_after, status, auto_trusted, reviewed_by, \
                reviewed_at, first_seen_at, last_seen_at \
         FROM opc_server_certs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Certificate {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    Json(ApiResponse::ok(row_to_cert(&row))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/opc/server-certs/:id/trust   — approve (move to trusted)
// POST /api/opc/server-certs/:id/reject  — reject
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ReviewBody {
    #[allow(dead_code)]
    pub note: Option<String>,
}

pub async fn trust_server_cert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<ReviewBody>>,
) -> impl IntoResponse {
    review_cert(state, claims, id, "trusted", body).await
}

pub async fn reject_server_cert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<ReviewBody>>,
) -> impl IntoResponse {
    review_cert(state, claims, id, "rejected", body).await
}

async fn review_cert(
    state: AppState,
    claims: Claims,
    id: Uuid,
    new_status: &str,
    _body: Option<Json<ReviewBody>>,
) -> impl IntoResponse {
    if !check_permission(&claims, "system:opc_config") {
        return IoError::Forbidden("system:opc_config permission required".into()).into_response();
    }

    let reviewer: Option<Uuid> = Uuid::parse_str(&claims.sub).ok();

    // Fetch cert + PKI dir path from environment (api-gateway doesn't manage PKI files
    // directly; that lives in opc-service's OPC_PKI_DIR). We update the DB record
    // and also move the cert file in the shared PKI dir if both services share
    // the same filesystem (they do in the default single-machine deployment).
    let row = match sqlx::query(
        "UPDATE opc_server_certs \
         SET status = $1, reviewed_by = $2, reviewed_at = now(), auto_trusted = false \
         WHERE id = $3 \
         RETURNING id, source_id, source_name, fingerprint, subject, issuer, \
                   not_before, not_after, status, auto_trusted, reviewed_by, \
                   reviewed_at, first_seen_at, last_seen_at, cert_der",
    )
    .bind(new_status)
    .bind(reviewer)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Certificate {} not found", id)).into_response(),
        Err(e) => return IoError::Database(e).into_response(),
    };

    let fingerprint: String = row.try_get("fingerprint").unwrap_or_default();

    // Move cert file in PKI dir so the OPC service picks it up on reconnect
    let pki_dir = std::env::var("OPC_PKI_DIR").unwrap_or_else(|_| "/tmp/io-opc-pki".to_string());
    move_cert_file(&pki_dir, &fingerprint, new_status);

    tracing::info!(
        cert_id = %id,
        fingerprint = %&fingerprint[..fingerprint.len().min(16)],
        new_status,
        reviewer = ?reviewer,
        "OPC server cert reviewed"
    );

    Json(ApiResponse::ok(row_to_cert(&row))).into_response()
}

/// Move a cert DER file between the PKI trusted/ and rejected/ directories.
/// This is a best-effort operation; errors are logged but not fatal.
fn move_cert_file(pki_dir: &str, fingerprint: &str, new_status: &str) {
    use std::path::Path;

    let (from_subdir, to_subdir) = match new_status {
        "trusted"  => ("rejected/certs", "trusted/certs"),
        "rejected" => ("trusted/certs",  "rejected/certs"),
        _          => return,
    };

    let base = Path::new(pki_dir);
    let from_dir = base.join(from_subdir);
    let to_dir   = base.join(to_subdir);

    // Try both fingerprint and uppercase variants as filename
    for name in &[
        format!("{}.der", fingerprint),
        format!("{}.der", fingerprint.to_uppercase()),
    ] {
        let src = from_dir.join(name);
        if src.exists() {
            if let Err(e) = std::fs::create_dir_all(&to_dir) {
                tracing::warn!(error = %e, "move_cert_file: could not create target dir");
                return;
            }
            let dst = to_dir.join(name);
            match std::fs::rename(&src, &dst) {
                Ok(()) => {
                    tracing::info!(src = %src.display(), dst = %dst.display(), "move_cert_file: cert moved");
                    return;
                }
                Err(e) => {
                    tracing::warn!(error = %e, src = %src.display(), "move_cert_file: rename failed, trying copy+delete");
                    // Cross-device rename fallback
                    if std::fs::copy(&src, &dst).is_ok() {
                        let _ = std::fs::remove_file(&src);
                    }
                    return;
                }
            }
        }
    }

    tracing::warn!(
        pki_dir,
        fingerprint = %&fingerprint[..fingerprint.len().min(16)],
        from_subdir,
        "move_cert_file: cert file not found in source dir (may already be in target)"
    );
}

// ---------------------------------------------------------------------------
// DELETE /api/opc/server-certs/:id  — remove cert record
// ---------------------------------------------------------------------------

pub async fn delete_server_cert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "system:opc_config") {
        return IoError::Forbidden("system:opc_config permission required".into()).into_response();
    }

    match sqlx::query("DELETE FROM opc_server_certs WHERE id = $1 RETURNING id")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(_)) => Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response(),
        Ok(None) => IoError::NotFound(format!("Certificate {} not found", id)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}
