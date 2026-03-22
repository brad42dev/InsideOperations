use axum::{
    extract::{Multipart, Path, State},
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use digest::Digest;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::io::Read as _;
use tokio::net::TcpListener;
use tower_http::catch_panic::CatchPanicLayer;
use tracing::info;
use uuid::Uuid;
use chrono::{DateTime, Utc};

mod config;
mod state;

use state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub domain: String,       // "pid" or "dcs"
    pub version: String,
    pub filename: String,
    pub class_count: i32,
    pub loaded: bool,
    pub uploaded_at: DateTime<Utc>,
    pub file_size_bytes: i64,
}

#[derive(Debug, Serialize)]
pub struct RecognitionResult {
    pub job_id: String,
    pub status: String,
    pub domain: String,
    pub detections: Vec<Detection>,
    pub processing_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct Detection {
    pub class_name: String,
    pub confidence: f32,
    pub bbox: [f32; 4],  // [x1, y1, x2, y2] normalized 0..1
    pub class_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct RunInferenceBody {
    pub graphic_id: Option<String>,
    pub domain: String,  // "pid" or "dcs"
    pub image_base64: Option<String>,  // base64-encoded PNG/JPEG
}

// ---------------------------------------------------------------------------
// Service secret middleware
// ---------------------------------------------------------------------------

async fn validate_service_secret(
    State(state): State<AppState>,
    request: axum::extract::Request,
    next: middleware::Next,
) -> impl IntoResponse {
    let secret = request
        .headers()
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !state.config.service_secret.is_empty() && secret != state.config.service_secret {
        return IoError::Unauthorized.into_response();
    }
    next.run(request).await
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// GET /recognition/models — list loaded models
async fn list_models(State(state): State<AppState>) -> impl IntoResponse {
    let models = state.models.read().await.clone();
    Json(ApiResponse::ok(models)).into_response()
}

// GET /recognition/models/:id — get model info
async fn get_model(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let models = state.models.read().await;
    match models.iter().find(|m| m.id == id) {
        Some(m) => Json(ApiResponse::ok(m.clone())).into_response(),
        None => IoError::NotFound(format!("Model {} not found", id)).into_response(),
    }
}

// Manifest structure inside the .iomodel ZIP
#[derive(Debug, Deserialize)]
struct IomodelManifest {
    #[serde(default)]
    model_domain: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    class_count: Option<i32>,
    /// Map of filename → "sha256:<hex>" expected hash. Absent in pre-1.1 packages.
    #[serde(default)]
    model_hashes: Option<HashMap<String, String>>,
}

// POST /recognition/models — upload .iomodel file
async fn upload_model(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut filename = String::from("model.iomodel");
    let mut file_bytes: Option<Vec<u8>> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "file" => {
                filename = field.file_name().unwrap_or("model.iomodel").to_string();
                match field.bytes().await {
                    Ok(data) => file_bytes = Some(data.to_vec()),
                    Err(e) => {
                        tracing::error!("Failed to read file field: {}", e);
                        return IoError::BadRequest("Failed to read uploaded file".to_string())
                            .into_response();
                    }
                }
            }
            _ => {
                let _ = field.bytes().await;
            }
        }
    }

    let data = match file_bytes {
        Some(b) => b,
        None => {
            return IoError::BadRequest("No file field in multipart upload".to_string())
                .into_response();
        }
    };

    let file_size = data.len() as i64;

    // Write to incoming directory
    let incoming_dir = format!("{}/incoming", state.config.model_dir);
    if let Err(e) = tokio::fs::create_dir_all(&incoming_dir).await {
        tracing::error!("Failed to create incoming dir {}: {}", incoming_dir, e);
        return IoError::Internal("Failed to create model directory".to_string()).into_response();
    }
    let tmp_id = Uuid::new_v4();
    let tmp_path = format!("{}/{}.iomodel", incoming_dir, tmp_id);
    if let Err(e) = tokio::fs::write(&tmp_path, &data).await {
        tracing::error!("Failed to write temp file {}: {}", tmp_path, e);
        return IoError::Internal("Failed to write model to disk".to_string()).into_response();
    }

    // Open as ZIP and parse manifest
    let zip_data = data;
    let parse_result = tokio::task::spawn_blocking(move || {
        parse_and_verify_iomodel(&zip_data)
    })
    .await;

    // Clean up temp file regardless of outcome
    let _ = tokio::fs::remove_file(&tmp_path).await;

    let manifest = match parse_result {
        Ok(Ok(m)) => m,
        Ok(Err(e)) => {
            tracing::error!("Failed to parse .iomodel package '{}': {}", filename, e);
            return IoError::BadRequest(format!("Invalid .iomodel package: {e}")).into_response();
        }
        Err(e) => {
            tracing::error!("Spawn-blocking error parsing .iomodel: {}", e);
            return IoError::Internal("Failed to process model package".to_string())
                .into_response();
        }
    };

    let domain = manifest.model_domain.unwrap_or_else(|| "pid".to_string());
    let version = manifest.version.unwrap_or_else(|| "1.0.0".to_string());
    let class_count = manifest.class_count.unwrap_or(0);

    let model = ModelInfo {
        id: Uuid::new_v4().to_string(),
        domain: domain.clone(),
        version: version.clone(),
        filename: filename.clone(),
        class_count,
        loaded: false,
        uploaded_at: Utc::now(),
        file_size_bytes: file_size,
    };

    state.models.write().await.push(model.clone());
    tracing::info!(
        domain = %domain,
        version = %version,
        filename = %filename,
        "Model uploaded and integrity verified"
    );

    Json(ApiResponse::ok(model)).into_response()
}

/// Parse a .iomodel ZIP, verify SHA-256 hashes from manifest.json, and return parsed manifest.
/// Returns Err if the ZIP is invalid, manifest.json is missing/unparseable, or any hash mismatches.
fn parse_and_verify_iomodel(zip_data: &[u8]) -> anyhow::Result<IomodelManifest> {
    use std::io::Cursor;
    let cursor = Cursor::new(zip_data);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| anyhow::anyhow!("Not a valid ZIP archive: {e}"))?;

    // Read manifest.json
    let manifest: IomodelManifest = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| anyhow::anyhow!("manifest.json not found in .iomodel package"))?;
        let mut raw = Vec::new();
        manifest_file.read_to_end(&mut raw)?;
        serde_json::from_slice(&raw)
            .map_err(|e| anyhow::anyhow!("Failed to parse manifest.json: {e}"))?
    };

    match &manifest.model_hashes {
        None => {
            tracing::warn!("model integrity not verified — pre-1.1 package");
        }
        Some(hashes) if hashes.is_empty() => {
            tracing::warn!("model integrity not verified — pre-1.1 package");
        }
        Some(hashes) => {
            // Verify each declared ONNX file
            for (onnx_filename, expected_hash) in hashes {
                let mut entry = archive.by_name(onnx_filename).map_err(|_| {
                    anyhow::anyhow!(
                        "Hash declared for '{}' but file not found in archive",
                        onnx_filename
                    )
                })?;
                let mut file_bytes = Vec::new();
                entry.read_to_end(&mut file_bytes)?;

                let mut hasher = Sha256::new();
                hasher.update(&file_bytes);
                let digest = hasher.finalize();
                let computed = format!("sha256:{}", hex::encode(digest));

                if computed != *expected_hash {
                    return Err(anyhow::anyhow!(
                        "SHA-256 mismatch for '{}': expected '{}', got '{}'",
                        onnx_filename,
                        expected_hash,
                        computed
                    ));
                }
                tracing::debug!(file = %onnx_filename, "SHA-256 integrity check passed");
            }
        }
    }

    Ok(manifest)
}

// DELETE /recognition/models/:id — remove model
async fn delete_model(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let mut models = state.models.write().await;
    let before = models.len();
    models.retain(|m| m.id != id);
    if models.len() == before {
        return IoError::NotFound(format!("Model {} not found", id)).into_response();
    }
    Json(ApiResponse::ok(serde_json::json!({"deleted": true}))).into_response()
}

// POST /recognition/infer — run inference on an image
async fn run_inference(
    State(_state): State<AppState>,
    Json(body): Json<RunInferenceBody>,
) -> impl IntoResponse {
    // Stub: return placeholder result.
    // In production: load model for domain, preprocess image, run ONNX session, NMS.
    let result = RecognitionResult {
        job_id: Uuid::new_v4().to_string(),
        status: "stub".to_string(),
        domain: body.domain,
        detections: vec![],  // real inference would populate this
        processing_ms: 0,
    };
    tracing::info!(graphic_id = ?body.graphic_id, "Inference request (stub — ONNX deferred)");
    Json(ApiResponse::ok(result)).into_response()
}

// POST /recognition/gap-reports — import .iogap file
async fn import_gap_report(
    State(_state): State<AppState>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut filename = String::from("report.iogap");
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            filename = field.file_name().unwrap_or("report.iogap").to_string();
            let _ = field.bytes().await;
        } else {
            let _ = field.bytes().await;
        }
    }
    tracing::info!(filename = %filename, "Gap report imported (stub)");
    Json(ApiResponse::ok(serde_json::json!({"imported": true, "filename": filename}))).into_response()
}

// GET /recognition/status — service status
async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    let models = state.models.read().await;
    let status = serde_json::json!({
        "models_loaded": models.iter().filter(|m| m.loaded).count(),
        "models_total": models.len(),
        "pid_model": models.iter().find(|m| m.domain == "pid" && m.loaded).map(|m| &m.version),
        "dcs_model": models.iter().find(|m| m.domain == "dcs" && m.loaded).map(|m| &m.version),
        "onnx_available": false,  // true when ort crate is integrated
    });
    Json(ApiResponse::ok(status)).into_response()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "recognition-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    let config = config::Config::from_env()?;
    let port = config.port;
    let state = AppState::new(config).await?;

    let health = io_health::HealthRegistry::new("recognition-service", env!("CARGO_PKG_VERSION"));
    health.mark_startup_complete();

    let api = Router::new()
        .route("/recognition/status", get(get_status))
        .route("/recognition/models", get(list_models).post(upload_model))
        .route("/recognition/models/:id", get(get_model).delete(delete_model))
        .route("/recognition/infer", post(run_inference))
        .route("/recognition/gap-reports", post(import_gap_report))
        .layer(middleware::from_fn_with_state(state.clone(), validate_service_secret))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .layer(CatchPanicLayer::new());

    let addr = format!("0.0.0.0:{port}");
    info!("recognition-service listening on {addr}");
    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    use tokio::signal;
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received, draining in-flight requests…");
}
