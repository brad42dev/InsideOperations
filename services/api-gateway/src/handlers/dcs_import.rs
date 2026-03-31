/// Stateful DCS Graphics Import API — 6 endpoints
///
/// Implements the job-based import flow from doc 34 §API Endpoints:
///
///   POST   /api/designer/import/dcs               Upload kit → create job
///   GET    /api/designer/import/dcs/:id            Get job status & preview
///   POST   /api/designer/import/dcs/:id/tags       Submit tag mapping decisions
///   POST   /api/designer/import/dcs/:id/symbols    Submit symbol mapping decisions
///   POST   /api/designer/import/dcs/:id/generate   Generate I/O graphic from job
///   GET    /api/designer/import/dcs/:id/report     Get import statistics/report
///
/// All endpoints require the `designer:import` RBAC permission.
/// Job state is held in `AppState.dcs_import_jobs` (in-memory, Phase 12–13 scope).
use axum::{
    extract::{Multipart, Path, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Job state types
// ---------------------------------------------------------------------------

/// The parsed result from the parser-service, held inside a job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DcsImportResult {
    pub display_name: String,
    pub width: u32,
    pub height: u32,
    pub element_count: usize,
    pub elements: Vec<DcsElement>,
    pub unresolved_symbols: Vec<String>,
    pub platform: String,
    pub tags: Vec<String>,
    pub manifest_platform: Option<String>,
    pub import_warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DcsElement {
    pub id: String,
    pub element_type: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub symbol_class: Option<String>,
    pub tag: Option<String>,
    pub label: Option<String>,
    pub display_element_hint: Option<String>,
    pub properties: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagMapping {
    pub dcs_tag: String,
    pub io_point_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolMapping {
    pub element_id: String,
    pub template_id: String,
}

/// A stateful DCS import job. Stored in `AppState.dcs_import_jobs`.
#[derive(Debug, Clone, Serialize)]
pub struct DcsImportJob {
    pub id: Uuid,
    pub user_id: Uuid,
    pub platform: String,
    pub parse_result: DcsImportResult,
    pub tag_mappings: Option<Vec<TagMapping>>,
    pub symbol_mappings: Option<Vec<SymbolMapping>>,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct TagMappingsBody {
    pub mappings: Vec<TagMapping>,
}

#[derive(Debug, Deserialize)]
pub struct SymbolMappingsBody {
    pub mappings: Vec<SymbolMapping>,
}

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn require_import_permission(claims: &Claims) -> Result<(), IoError> {
    let ok = claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == "designer:import");
    if ok {
        Ok(())
    } else {
        Err(IoError::Forbidden(
            "designer:import permission required".to_string(),
        ))
    }
}

// ---------------------------------------------------------------------------
// POST /api/designer/import/dcs
// ---------------------------------------------------------------------------
//
// Receives a multipart upload (same fields as the legacy /api/dcs-import):
//   - platform: string
//   - file:     the extraction kit .zip or raw DCS file
//
// Forwards to parser-service /parse/dcs-import, deserialises the result,
// creates a job, stores it, and returns { id, status, parse_result }.

pub async fn create_import_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    // Collect multipart fields into a buffer so we can re-forward them.
    let mut platform: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or("").to_string();
        match field_name.as_str() {
            "platform" => {
                if let Ok(val) = field.text().await {
                    platform = Some(val);
                }
            }
            "file" => {
                file_name = field.file_name().map(|s| s.to_string());
                if let Ok(bytes) = field.bytes().await {
                    file_bytes = Some(bytes.to_vec());
                }
            }
            _ => {
                let _ = field.bytes().await;
            }
        }
    }

    let platform = match platform {
        Some(p) => p,
        None => {
            return IoError::BadRequest("platform field is required".to_string()).into_response();
        }
    };
    let file_bytes = match file_bytes {
        Some(b) => b,
        None => {
            return IoError::BadRequest("file field is required".to_string()).into_response();
        }
    };
    let file_name = file_name.unwrap_or_else(|| "upload.zip".to_string());

    // Forward to parser-service /parse/dcs-import using a manually assembled multipart body.
    // (reqwest::multipart is not enabled in the workspace feature set; we build the raw body.)
    let parser_url = format!("{}/parse/dcs-import", state.config.parser_service_url);
    let boundary = format!("---IOBoundary{}", Uuid::new_v4().simple());

    let mut body: Vec<u8> = Vec::new();
    // -- platform field
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"platform\"\r\n\r\n");
    body.extend_from_slice(platform.as_bytes());
    body.extend_from_slice(b"\r\n");
    // -- file field
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\n",
            file_name
        )
        .as_bytes(),
    );
    body.extend_from_slice(b"Content-Type: application/octet-stream\r\n\r\n");
    body.extend_from_slice(&file_bytes);
    body.extend_from_slice(b"\r\n");
    // -- closing boundary
    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());

    let content_type = format!("multipart/form-data; boundary={}", boundary);

    let resp = match state
        .http_client
        .post(&parser_url)
        .header("x-io-service-secret", &state.config.service_secret)
        .header("Content-Type", content_type)
        .body(body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to reach parser-service for DCS import");
            return IoError::ServiceUnavailable("parser-service is unreachable".to_string())
                .into_response();
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp
            .text()
            .await
            .unwrap_or_else(|_| "parser-service error".to_string());
        tracing::warn!(status = %status, body = %body, "parser-service returned error");
        return (
            axum::http::StatusCode::from_u16(status.as_u16())
                .unwrap_or(axum::http::StatusCode::BAD_GATEWAY),
            body,
        )
            .into_response();
    }

    // Deserialise the ApiResponse<DcsImportResult> from parser-service.
    let api_resp: Value = match resp.json().await {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "Failed to deserialise parser-service response");
            return IoError::BadRequest(
                "Unexpected response format from parser-service".to_string(),
            )
            .into_response();
        }
    };

    let parse_result: DcsImportResult = match serde_json::from_value(api_resp["data"].clone()) {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to deserialise DcsImportResult");
            return IoError::BadRequest(
                "Could not parse import result from parser-service".to_string(),
            )
            .into_response();
        }
    };

    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_else(|_| Uuid::nil());
    let job = DcsImportJob {
        id: Uuid::new_v4(),
        user_id,
        platform: platform.clone(),
        parse_result,
        tag_mappings: None,
        symbol_mappings: None,
        created_at: Utc::now(),
    };
    let job_id = job.id;

    state.dcs_import_jobs.insert(job_id, job.clone());

    Json(ApiResponse::ok(json!({
        "id": job_id,
        "status": "preview",
        "platform": job.platform,
        "created_at": job.created_at,
        "parse_result": job.parse_result,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/designer/import/dcs/:id
// ---------------------------------------------------------------------------

pub async fn get_import_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    let job = match state.dcs_import_jobs.get(&id) {
        Some(j) => j.clone(),
        None => {
            return IoError::NotFound(format!("DCS import job {} not found", id)).into_response();
        }
    };

    // Determine status based on what mappings have been submitted.
    let status = if job.tag_mappings.is_some() && job.symbol_mappings.is_some() {
        "ready"
    } else if job.tag_mappings.is_some() || job.symbol_mappings.is_some() {
        "partial"
    } else {
        "preview"
    };

    Json(ApiResponse::ok(json!({
        "id": job.id,
        "status": status,
        "platform": job.platform,
        "created_at": job.created_at,
        "parse_result": job.parse_result,
        "tag_mappings": job.tag_mappings,
        "symbol_mappings": job.symbol_mappings,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/designer/import/dcs/:id/tags
// ---------------------------------------------------------------------------

pub async fn submit_tag_mappings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<TagMappingsBody>,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    let mut job = match state.dcs_import_jobs.get_mut(&id) {
        Some(j) => j,
        None => {
            return IoError::NotFound(format!("DCS import job {} not found", id)).into_response();
        }
    };

    job.tag_mappings = Some(body.mappings.clone());

    Json(ApiResponse::ok(json!({
        "id": id,
        "tag_mappings_count": body.mappings.len(),
        "message": "Tag mappings saved",
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/designer/import/dcs/:id/symbols
// ---------------------------------------------------------------------------

pub async fn submit_symbol_mappings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SymbolMappingsBody>,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    let mut job = match state.dcs_import_jobs.get_mut(&id) {
        Some(j) => j,
        None => {
            return IoError::NotFound(format!("DCS import job {} not found", id)).into_response();
        }
    };

    job.symbol_mappings = Some(body.mappings.clone());

    Json(ApiResponse::ok(json!({
        "id": id,
        "symbol_mappings_count": body.mappings.len(),
        "message": "Symbol mappings saved",
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/designer/import/dcs/:id/generate
// ---------------------------------------------------------------------------
//
// Creates a design_objects row (type='graphic') via the internal DB write that
// the graphics handler already performs.  We reuse the same INSERT pattern
// directly to avoid an internal HTTP round-trip.

pub async fn generate_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    let job = match state.dcs_import_jobs.get(&id) {
        Some(j) => j.clone(),
        None => {
            return IoError::NotFound(format!("DCS import job {} not found", id)).into_response();
        }
    };

    let display_name = job.parse_result.display_name.clone();

    // Build a minimal scene_data / bindings JSON from the parse result.
    // Tag mappings (if provided) are embedded as point-binding hints.
    let tag_map: std::collections::HashMap<String, String> = job
        .tag_mappings
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .map(|m| (m.dcs_tag.clone(), m.io_point_id.clone()))
        .collect();

    let symbol_map: std::collections::HashMap<String, String> = job
        .symbol_mappings
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .map(|m| (m.element_id.clone(), m.template_id.clone()))
        .collect();

    // Build nodes array from parsed elements
    let nodes: Vec<Value> = job
        .parse_result
        .elements
        .iter()
        .map(|el| {
            let io_point_id = el.tag.as_ref().and_then(|t| tag_map.get(t)).cloned();
            let template_id = symbol_map.get(&el.id).cloned();

            json!({
                "id": el.id,
                "type": el.element_type,
                "x": el.x,
                "y": el.y,
                "width": el.width,
                "height": el.height,
                "symbol_class": el.symbol_class,
                "tag": el.tag,
                "label": el.label,
                "display_element_hint": el.display_element_hint,
                "io_point_id": io_point_id,
                "template_id": template_id,
                "properties": el.properties,
            })
        })
        .collect();

    let scene_data = json!({
        "version": 1,
        "width": job.parse_result.width,
        "height": job.parse_result.height,
        "platform": job.parse_result.platform,
        "nodes": nodes,
        "import_job_id": id,
    });

    let metadata = json!({
        "module": "designer",
        "import_source": "dcs",
        "platform": job.parse_result.platform,
        "import_job_id": id,
        "tags": job.parse_result.tags,
    });

    let graphic_id = Uuid::new_v4();
    let created_by: Option<Uuid> = if job.user_id == Uuid::nil() {
        None
    } else {
        Some(job.user_id)
    };

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, 'graphic', NULL, $3, $4, NULL, $5)
        RETURNING id, name, type, created_at
        "#,
    )
    .bind(graphic_id)
    .bind(&display_name)
    .bind(&scene_data)
    .bind(&metadata)
    .bind(created_by)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "generate_graphic: INSERT into design_objects failed");
            return IoError::Database(e).into_response();
        }
    };

    use sqlx::Row as _;
    let returned_id: Uuid = row.try_get("id").unwrap_or(graphic_id);

    Json(ApiResponse::ok(json!({
        "graphic_id": returned_id,
        "name": display_name,
        "import_job_id": id,
        "message": "Graphic created successfully",
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/designer/import/dcs
// ---------------------------------------------------------------------------
//
// Returns a summary list of all DCS import jobs belonging to the requesting
// user, ordered by creation time descending.  Each entry includes just enough
// information to populate the job history panel (id, platform, display_name,
// created_at, status, element_count).

pub async fn list_import_jobs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_else(|_| Uuid::nil());

    let mut jobs: Vec<Value> = state
        .dcs_import_jobs
        .iter()
        .filter(|entry| entry.value().user_id == user_id)
        .map(|entry| {
            let job = entry.value();
            let status = if job.tag_mappings.is_some() && job.symbol_mappings.is_some() {
                "ready"
            } else if job.tag_mappings.is_some() || job.symbol_mappings.is_some() {
                "partial"
            } else {
                "preview"
            };
            json!({
                "id": job.id,
                "platform": job.platform,
                "display_name": job.parse_result.display_name,
                "element_count": job.parse_result.element_count,
                "created_at": job.created_at,
                "status": status,
            })
        })
        .collect();

    // Most recent first.
    jobs.sort_by(|a, b| {
        let ta = a["created_at"].as_str().unwrap_or("");
        let tb = b["created_at"].as_str().unwrap_or("");
        tb.cmp(ta)
    });

    Json(ApiResponse::ok(json!({ "jobs": jobs }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/designer/import/dcs/:id/report
// ---------------------------------------------------------------------------

pub async fn get_import_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if let Err(e) = require_import_permission(&claims) {
        return e.into_response();
    }

    let job = match state.dcs_import_jobs.get(&id) {
        Some(j) => j.clone(),
        None => {
            return IoError::NotFound(format!("DCS import job {} not found", id)).into_response();
        }
    };

    let pr = &job.parse_result;
    let tag_count = pr.tags.len();
    let element_count = pr.element_count;
    let unresolved_count = pr.unresolved_symbols.len();
    let warning_count = pr.import_warnings.len();
    let tag_mappings_count = job.tag_mappings.as_ref().map(|m| m.len()).unwrap_or(0);
    let symbol_mappings_count = job.symbol_mappings.as_ref().map(|m| m.len()).unwrap_or(0);

    Json(ApiResponse::ok(json!({
        "id": job.id,
        "platform": job.platform,
        "display_name": pr.display_name,
        "created_at": job.created_at,
        "statistics": {
            "element_count": element_count,
            "tag_count": tag_count,
            "unresolved_symbol_count": unresolved_count,
            "warning_count": warning_count,
            "tag_mappings_submitted": tag_mappings_count,
            "symbol_mappings_submitted": symbol_mappings_count,
        },
        "unresolved_symbols": pr.unresolved_symbols,
        "warnings": pr.import_warnings,
        "tag_mappings": job.tag_mappings,
        "symbol_mappings": job.symbol_mappings,
    })))
    .into_response()
}
