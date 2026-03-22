//! Certificates handler — list, upload, delete, inspect TLS certificates,
//! and trigger ACME renewal checks.
//!
//! Certificate files are stored in `IO_CERT_DIR` (default `/tmp/io-certs` in dev,
//! `/opt/io/certs` in production) as `{name}.crt` / `{name}.key` pairs.

use axum::{
    extract::{Multipart, Path, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PagedResponse};
use serde::Serialize;
use std::path::PathBuf;
use tokio::fs;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission check
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct CertInfo {
    pub name: String,
    pub subject: String,
    pub issuer: String,
    pub not_before: String,
    pub not_after: String,
    pub sans: Vec<String>,
    pub days_remaining: i64,
    pub is_expired: bool,
    pub file: String,
}

// ---------------------------------------------------------------------------
// Parse helper — extract info from PEM bytes
// ---------------------------------------------------------------------------

fn parse_cert_pem(pem_bytes: &[u8]) -> Result<CertInfo, String> {
    let (_, pem) = x509_parser::pem::parse_x509_pem(pem_bytes)
        .map_err(|e| format!("PEM parse error: {:?}", e))?;
    let cert = pem
        .parse_x509()
        .map_err(|e| format!("X.509 parse error: {:?}", e))?;

    let subject = cert.subject().to_string();
    let issuer = cert.issuer().to_string();

    // Validity timestamps — x509-parser uses `time::OffsetDateTime`; convert via
    // Unix seconds since chrono and time don't share a From impl.
    let not_before_ts = cert.validity().not_before.timestamp();
    let not_after_ts = cert.validity().not_after.timestamp();
    let not_before: DateTime<Utc> = DateTime::from_timestamp(not_before_ts, 0)
        .unwrap_or(DateTime::UNIX_EPOCH);
    let not_after: DateTime<Utc> = DateTime::from_timestamp(not_after_ts, 0)
        .unwrap_or(DateTime::UNIX_EPOCH);

    let now = Utc::now();
    let duration = not_after.signed_duration_since(now);
    let days_remaining = duration.num_days();
    let is_expired = days_remaining < 0;

    // Subject Alternative Names
    let mut sans: Vec<String> = Vec::new();
    if let Ok(Some(san_ext)) = cert.get_extension_unique(
        &x509_parser::oid_registry::OID_X509_EXT_SUBJECT_ALT_NAME,
    ) {
        use x509_parser::extensions::ParsedExtension;
        if let ParsedExtension::SubjectAlternativeName(san) = san_ext.parsed_extension() {
            for name in &san.general_names {
                use x509_parser::extensions::GeneralName;
                match name {
                    GeneralName::DNSName(dns) => sans.push(dns.to_string()),
                    GeneralName::IPAddress(ip) => {
                        if ip.len() == 4 {
                            sans.push(format!("{}.{}.{}.{}", ip[0], ip[1], ip[2], ip[3]));
                        } else if ip.len() == 16 {
                            let segments: Vec<String> = ip
                                .chunks(2)
                                .map(|b| format!("{:02x}{:02x}", b[0], b[1]))
                                .collect();
                            sans.push(segments.join(":"));
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(CertInfo {
        name: String::new(),  // filled by caller
        subject,
        issuer,
        not_before: not_before.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        not_after: not_after.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        sans,
        days_remaining,
        is_expired,
        file: String::new(), // filled by caller
    })
}

// ---------------------------------------------------------------------------
// GET /api/certificates
// ---------------------------------------------------------------------------

pub async fn list_certs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    let cert_dir = PathBuf::from(&state.config.cert_dir);

    // Ensure directory exists (created at startup, but be defensive)
    if let Err(e) = fs::create_dir_all(&cert_dir).await {
        tracing::error!(error = %e, path = %cert_dir.display(), "list_certs: create_dir_all failed");
        return IoError::Internal(format!("Failed to access certificate directory: {}", e))
            .into_response();
    }

    let mut entries = match fs::read_dir(&cert_dir).await {
        Ok(e) => e,
        Err(e) => {
            tracing::error!(error = %e, "list_certs: read_dir failed");
            return IoError::Internal(format!("Failed to list certificate directory: {}", e))
                .into_response();
        }
    };

    let mut certs: Vec<CertInfo> = Vec::new();

    loop {
        match entries.next_entry().await {
            Ok(Some(entry)) => {
                let path = entry.path();
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");

                if ext != "crt" && ext != "pem" {
                    continue;
                }

                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                let name = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();

                let pem_bytes = match fs::read(&path).await {
                    Ok(b) => b,
                    Err(e) => {
                        tracing::warn!(error = %e, file = %file_name, "list_certs: failed to read cert");
                        continue;
                    }
                };

                match parse_cert_pem(&pem_bytes) {
                    Ok(mut info) => {
                        info.name = name;
                        info.file = file_name;
                        certs.push(info);
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, file = %file_name, "list_certs: failed to parse cert");
                    }
                }
            }
            Ok(None) => break,
            Err(e) => {
                tracing::warn!(error = %e, "list_certs: entry read error");
                break;
            }
        }
    }

    // Sort by name for stable ordering
    certs.sort_by(|a, b| a.name.cmp(&b.name));

    let total = certs.len() as u64;
    Json(PagedResponse::new(certs, 1, total.max(1) as u32, total)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/certificates/upload
// Multipart fields: cert (PEM bytes), key (PEM bytes), name (string)
// ---------------------------------------------------------------------------

pub async fn upload_cert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    let mut cert_pem: Option<Vec<u8>> = None;
    let mut key_pem: Option<Vec<u8>> = None;
    let mut name: Option<String> = None;

    loop {
        let field = match multipart.next_field().await {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(e) => {
                tracing::warn!(error = %e, "upload_cert: multipart error");
                return IoError::BadRequest("Invalid multipart data".into()).into_response();
            }
        };

        let field_name = field.name().unwrap_or("").to_string();
        let data = match field.bytes().await {
            Ok(b) => b,
            Err(e) => {
                tracing::warn!(error = %e, field = %field_name, "upload_cert: field read error");
                continue;
            }
        };

        match field_name.as_str() {
            "cert" => cert_pem = Some(data.to_vec()),
            "key" => key_pem = Some(data.to_vec()),
            "name" => {
                name = Some(String::from_utf8_lossy(&data).trim().to_string())
            }
            _ => {}
        }
    }

    // Validate: name
    let name = match name {
        Some(n) if !n.is_empty() => n,
        _ => {
            return IoError::BadRequest("name field is required".into()).into_response();
        }
    };

    // Sanitize name — only allow alphanumeric, dash, underscore, dot
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return IoError::BadRequest(
            "name may only contain letters, digits, hyphens, underscores, and dots".into(),
        )
        .into_response();
    }

    let cert_bytes = match cert_pem {
        Some(b) if !b.is_empty() => b,
        _ => return IoError::BadRequest("cert field (PEM) is required".into()).into_response(),
    };

    let key_bytes = match key_pem {
        Some(b) if !b.is_empty() => b,
        _ => return IoError::BadRequest("key field (PEM) is required".into()).into_response(),
    };

    // Validate cert PEM before writing
    let mut cert_info = match parse_cert_pem(&cert_bytes) {
        Ok(info) => info,
        Err(e) => {
            tracing::warn!(error = %e, "upload_cert: cert PEM invalid");
            return IoError::BadRequest(format!("Invalid certificate PEM: {}", e)).into_response();
        }
    };

    let cert_dir = PathBuf::from(&state.config.cert_dir);

    if let Err(e) = fs::create_dir_all(&cert_dir).await {
        tracing::error!(error = %e, "upload_cert: create_dir_all failed");
        return IoError::Internal(format!("Failed to create certificate directory: {}", e))
            .into_response();
    }

    let crt_path = cert_dir.join(format!("{}.crt", name));
    let key_path = cert_dir.join(format!("{}.key", name));

    if let Err(e) = fs::write(&crt_path, &cert_bytes).await {
        tracing::error!(error = %e, path = %crt_path.display(), "upload_cert: write crt failed");
        return IoError::Internal(format!("Failed to save certificate file: {}", e)).into_response();
    }

    if let Err(e) = fs::write(&key_path, &key_bytes).await {
        tracing::error!(error = %e, path = %key_path.display(), "upload_cert: write key failed");
        // Clean up the cert file already written
        let _ = fs::remove_file(&crt_path).await;
        return IoError::Internal(format!("Failed to save key file: {}", e)).into_response();
    }

    cert_info.name = name.clone();
    cert_info.file = format!("{}.crt", name);

    tracing::info!(name = %name, "Certificate uploaded");

    Json(ApiResponse::ok(cert_info)).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/certificates/:name
// ---------------------------------------------------------------------------

pub async fn delete_cert(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return IoError::BadRequest("Invalid certificate name".into()).into_response();
    }

    let cert_dir = PathBuf::from(&state.config.cert_dir);
    let crt_path = cert_dir.join(format!("{}.crt", name));
    let pem_path = cert_dir.join(format!("{}.pem", name));
    let key_path = cert_dir.join(format!("{}.key", name));

    // Try .crt first, then .pem
    let found_crt = if crt_path.exists() {
        Some(crt_path)
    } else if pem_path.exists() {
        Some(pem_path)
    } else {
        None
    };

    match found_crt {
        None => {
            return IoError::NotFound(format!("Certificate '{}' not found", name)).into_response();
        }
        Some(crt) => {
            if let Err(e) = fs::remove_file(&crt).await {
                tracing::error!(error = %e, path = %crt.display(), "delete_cert: remove failed");
                return IoError::Internal(format!("Failed to delete certificate: {}", e))
                    .into_response();
            }
        }
    }

    // Remove key if present (best-effort)
    let _ = fs::remove_file(&key_path).await;

    tracing::info!(name = %name, "Certificate deleted");

    Json(ApiResponse::ok(serde_json::json!({ "deleted": name }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/certificates/:name/info
// ---------------------------------------------------------------------------

pub async fn get_cert_info(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    if !check_permission(&claims, "settings:admin") {
        return IoError::Forbidden("settings:admin permission required".into()).into_response();
    }

    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return IoError::BadRequest("Invalid certificate name".into()).into_response();
    }

    let cert_dir = PathBuf::from(&state.config.cert_dir);
    let crt_path = cert_dir.join(format!("{}.crt", name));
    let pem_path = cert_dir.join(format!("{}.pem", name));

    let file_path = if crt_path.exists() {
        crt_path
    } else if pem_path.exists() {
        pem_path
    } else {
        return IoError::NotFound(format!("Certificate '{}' not found", name)).into_response();
    };

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let pem_bytes = match fs::read(&file_path).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!(error = %e, "get_cert_info: read failed");
            return IoError::Internal(format!("Failed to read certificate: {}", e)).into_response();
        }
    };

    match parse_cert_pem(&pem_bytes) {
        Ok(mut info) => {
            info.name = name;
            info.file = file_name;
            Json(ApiResponse::ok(info)).into_response()
        }
        Err(e) => {
            tracing::warn!(error = %e, "get_cert_info: parse failed");
            IoError::BadRequest(format!("Failed to parse certificate: {}", e)).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/internal/certs/renew   (no JWT auth — called by systemd timer)
// ---------------------------------------------------------------------------

/// Response body for the renewal check endpoint.
#[derive(Debug, Serialize)]
pub struct RenewResponse {
    /// Whether a renewal was initiated in this call.
    pub renewed: bool,
    /// Days remaining until the active certificate expires.
    pub days_remaining: i64,
}

/// Check whether the active certificate needs renewal.
///
/// - Reads `IO_CERT_DIR/active.crt`.
/// - Returns `{"renewed": false, "days_remaining": N}` always (ACME renewal is
///   stubbed until the `instant-acme` integration is wired up in a later task).
/// - If the cert cannot be read or parsed, returns a 500 with an error message.
pub async fn renew_cert(State(state): State<AppState>) -> impl IntoResponse {
    let cert_dir = PathBuf::from(&state.config.cert_dir);
    let active_crt = cert_dir.join("active.crt");

    // Resolve the symlink (follow it if present) before reading.
    let file_path = match tokio::fs::canonicalize(&active_crt).await {
        Ok(p) => p,
        Err(_) => {
            // active.crt does not exist; no cert to check.
            tracing::warn!("renew_cert: active.crt not found in {}", cert_dir.display());
            return IoError::NotFound("No active certificate found".into()).into_response();
        }
    };

    let pem_bytes = match fs::read(&file_path).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!(error = %e, "renew_cert: read active.crt failed");
            return IoError::Internal(format!("Failed to read active certificate: {}", e))
                .into_response();
        }
    };

    let cert_info = match parse_cert_pem(&pem_bytes) {
        Ok(info) => info,
        Err(e) => {
            tracing::error!(error = %e, "renew_cert: parse active.crt failed");
            return IoError::Internal(format!("Failed to parse active certificate: {}", e))
                .into_response();
        }
    };

    let days_remaining = cert_info.days_remaining;
    let renew_threshold = state.config.cert_renew_days;

    tracing::info!(
        days_remaining = days_remaining,
        renew_threshold = renew_threshold,
        "renew_cert: certificate expiry check"
    );

    // Stub: ACME renewal is not yet implemented.  When days_remaining falls
    // within the threshold the system would initiate Let's Encrypt renewal here.
    // For now, always return renewed=false so the caller knows no action was taken.
    let renewed = false;

    if days_remaining <= renew_threshold {
        tracing::info!(
            days_remaining = days_remaining,
            "renew_cert: certificate within renewal window — ACME renewal stubbed"
        );
    }

    Json(ApiResponse::ok(RenewResponse {
        renewed,
        days_remaining,
    }))
    .into_response()
}
