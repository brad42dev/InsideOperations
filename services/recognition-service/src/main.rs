use axum::{
    extract::{Multipart, Path, State},
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
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

// POST /recognition/models — upload .iomodel file
async fn upload_model(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut domain = String::from("pid");
    let mut filename = String::from("model.iomodel");
    let mut file_size: i64 = 0;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "domain" => {
                if let Ok(data) = field.bytes().await {
                    domain = String::from_utf8_lossy(&data).to_string();
                }
            }
            "file" => {
                filename = field.file_name().unwrap_or("model.iomodel").to_string();
                if let Ok(data) = field.bytes().await {
                    file_size = data.len() as i64;
                    // In production: write to model_dir, parse .iomodel zip, load ONNX session.
                    // For stub: just record the metadata.
                }
            }
            _ => { let _ = field.bytes().await; }
        }
    }

    let model = ModelInfo {
        id: Uuid::new_v4().to_string(),
        domain: domain.clone(),
        version: "1.0.0".to_string(),
        filename,
        class_count: 0,  // would be read from .iomodel metadata
        loaded: false,   // would be true after ONNX session loaded
        uploaded_at: Utc::now(),
        file_size_bytes: file_size,
    };

    state.models.write().await.push(model.clone());
    tracing::info!(domain = %domain, "Model uploaded (stub — ONNX loading deferred)");

    Json(ApiResponse::ok(model)).into_response()
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

    let _obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "recognition-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;

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
