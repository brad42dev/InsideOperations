use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::Utc;
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use std::io::Write;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Manifest types — matches design doc 39 format
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct IographicManifest {
    pub format: String,
    /// Canonical field name per doc 39. Accept "version" as an alias for files
    /// produced by earlier builds of this service.
    #[serde(alias = "version")]
    pub format_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generator: Option<IographicGenerator>,
    /// Canonical field name per doc 39. Accept "created_at" as an alias.
    #[serde(alias = "created_at", default)]
    pub exported_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exported_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// New format: array of graphic entries (doc 39).
    #[serde(default)]
    pub graphics: Vec<IographicGraphicEntry>,
    /// Legacy compat: old builds wrote a single "graphic" object.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphic: Option<LegacyGraphicMeta>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IographicGenerator {
    // Accept both "application" (new) and "name" (some producers) for the app name field
    #[serde(alias = "name", default)]
    pub application: String,
    #[serde(default)]
    pub version: String,
}

// ---------------------------------------------------------------------------
// Graphic model types — for iographic files that store the graphic as a
// composable model (shapes + pipes) rather than pre-rendered SVG.
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct GraphicModel {
    #[serde(default)]
    metadata: GraphicModelMeta,
    #[serde(default)]
    shapes: Vec<ShapeInstance>,
    #[serde(default)]
    pipes: Vec<PipeInstance>,
    #[serde(default)]
    annotations: Vec<JsonValue>,
    /// Bindings are kept as raw JSON for storage
    #[serde(default)]
    bindings: JsonValue,
}

#[derive(Debug, Deserialize, Default)]
struct GraphicModelMeta {
    #[serde(default = "default_view_box")]
    view_box: String,
    #[serde(default = "default_width")]
    width: f64,
    #[serde(default = "default_height")]
    height: f64,
    #[serde(rename = "background_color")]
    background_color: Option<String>,
    #[serde(rename = "viewBox")]
    view_box_alt: Option<String>,
}

fn default_view_box() -> String { "0 0 1920 1080".to_string() }
fn default_width() -> f64 { 1920.0 }
fn default_height() -> f64 { 1080.0 }

#[derive(Debug, Deserialize)]
struct ShapeInstance {
    #[serde(alias = "id")]
    element_id: String,
    shape_id: String,
    #[serde(default)]
    variant: Option<String>,
    #[serde(default)]
    position: Position2D,
    #[serde(default)]
    scale: Scale2D,
    #[serde(default)]
    rotation: f64,
    #[serde(default)]
    mirror: String,
    #[serde(alias = "parts", alias = "composable_parts", default)]
    composable_parts: Vec<JsonValue>,
}

#[derive(Debug, Deserialize, Default)]
struct Position2D {
    x: f64,
    y: f64,
}

#[derive(Debug, Deserialize)]
struct Scale2D {
    x: f64,
    y: f64,
}

impl Default for Scale2D {
    fn default() -> Self { Scale2D { x: 1.0, y: 1.0 } }
}

#[derive(Debug, Deserialize)]
struct PipeInstance {
    #[serde(alias = "id", default)]
    element_id: String,
    #[serde(alias = "service", default = "default_service_type")]
    service_type: String,
    /// Override colour (some producers supply an explicit hex colour per pipe)
    #[serde(default)]
    color: Option<String>,
    #[serde(default = "default_stroke_width")]
    stroke_width: f64,
    /// Path data — accept "path" as alias for producers that use that key
    #[serde(alias = "path", default)]
    path_data: String,
    #[serde(default)]
    label: Option<String>,
}

fn default_service_type() -> String { "process".to_string() }
fn default_stroke_width() -> f64 { 2.0 }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IographicGraphicEntry {
    /// Sub-directory name inside the ZIP (slugified graphic name).
    /// Accept "id" or "path" as aliases for files produced by other tools.
    #[serde(alias = "id", default)]
    pub directory: String,
    pub name: String,
    #[serde(rename = "type", default = "default_graphic_type")]
    pub graphic_type: String,
    /// Some producers write "path" instead of "directory".
    #[serde(default)]
    pub path: Option<String>,
}

fn default_graphic_type() -> String {
    "graphic".to_string()
}

/// Used only for reading files produced by old builds; never written.
#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyGraphicMeta {
    pub id: String,
    pub name: String,
}

// ---------------------------------------------------------------------------
// Render a graphic.json model to an SVG string using shape library SVGs
// ---------------------------------------------------------------------------

/// Pipe stroke colours by service type (inspired by ISA-5.1 / typical DCS conventions)
fn pipe_stroke(service_type: &str) -> &'static str {
    match service_type {
        "process" | "liquid"    => "#71717A",   // zinc-500 — process fluid
        "gas" | "vapor"         => "#A1A1AA",   // zinc-400 — gas / vapour
        "steam"                 => "#E4E4E7",   // zinc-200 — steam
        "cooling_water" | "cw"  => "#60A5FA",   // blue-400  — cooling water
        "fuel_gas" | "fuel"     => "#FBBF24",   // amber-400 — fuel gas
        "hydrogen" | "h2"       => "#34D399",   // emerald-400 — hydrogen
        "instrument_air" | "ia" => "#C4B5FD",   // violet-300 — instrument air
        _                       => "#71717A",
    }
}

/// Try to extract the inner SVG content (everything between <svg …> and </svg>).
fn extract_svg_inner(svg: &str) -> String {
    // Strip XML declaration
    let s = if svg.trim_start().starts_with("<?xml") {
        svg.find("?>")
            .map(|i| &svg[i + 2..])
            .unwrap_or(svg)
            .trim_start()
    } else {
        svg.trim_start()
    };
    // Strip outer <svg …> tag
    if let Some(start) = s.find('>') {
        let inner = &s[start + 1..];
        // Strip trailing </svg>
        if let Some(end) = inner.rfind("</svg>") {
            return inner[..end].to_string();
        }
        return inner.to_string();
    }
    s.to_string()
}

/// Extract the viewBox attribute from an SVG string — returns e.g. "0 0 40 80".
fn extract_view_box(svg: &str) -> Option<String> {
    // Simple text search — good enough for well-formed SVG from our shape library
    let lower = svg.to_ascii_lowercase();
    let key = "viewbox=\"";
    let pos = lower.find(key)?;
    let rest = &svg[pos + key.len()..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

/// Parse a viewBox string "minX minY width height" → (width, height).
fn view_box_dims(vb: &str) -> (f64, f64) {
    let parts: Vec<f64> = vb.split_whitespace()
        .filter_map(|s| s.parse().ok())
        .collect();
    if parts.len() >= 4 {
        (parts[2], parts[3])
    } else {
        (64.0, 64.0)
    }
}

/// Base render size for shapes in a 1920×1080 canvas (pixels).
/// Shapes have small native viewBoxes (e.g. 40×80), so we scale them up.
const SHAPE_BASE_PX: f64 = 64.0;

async fn render_model_to_svg(
    db: &sqlx::PgPool,
    model: &GraphicModel,
) -> String {
    let view_box = model.metadata.view_box_alt.as_deref()
        .unwrap_or(&model.metadata.view_box);
    let bg = model.metadata.background_color.as_deref().unwrap_or("#09090B");

    // Collect unique shape_ids needed
    let needed_ids: Vec<String> = {
        let mut ids: Vec<String> = model.shapes.iter().map(|s| {
            // Try shape_id + variant (e.g. "pump-centrifugal-opt1") first
            match &s.variant {
                Some(v) if !v.is_empty() && v != "default" =>
                    format!("{}-{}", s.shape_id, v),
                _ => s.shape_id.clone(),
            }
        }).collect();
        ids.sort();
        ids.dedup();
        ids
    };

    // Fetch all shapes in one query (also try without variant suffix as fallback)
    // We store results as shape_id → svg_data
    use std::collections::HashMap;
    let mut shape_svgs: HashMap<String, String> = HashMap::new();

    if !needed_ids.is_empty() {
        // Build a query that fetches by any matching shape_id
        let rows = sqlx::query(
            "SELECT metadata->>'shape_id' as shape_id, svg_data \
             FROM design_objects \
             WHERE type = 'shape' AND metadata->>'shape_id' = ANY($1)",
        )
        .bind(&needed_ids)
        .fetch_all(db)
        .await
        .unwrap_or_default();

        for row in rows {
            let sid: String = row.try_get("shape_id").unwrap_or_default();
            let svg: String = row.try_get("svg_data").unwrap_or_default();
            if !sid.is_empty() && !svg.is_empty() {
                shape_svgs.insert(sid, svg);
            }
        }

        // Fallback: for IDs that weren't found (variant form), try base shape_id
        let base_ids: Vec<String> = model.shapes.iter()
            .filter_map(|s| {
                let lookup = match &s.variant {
                    Some(v) if !v.is_empty() && v != "default" =>
                        format!("{}-{}", s.shape_id, v),
                    _ => s.shape_id.clone(),
                };
                if !shape_svgs.contains_key(&lookup) {
                    Some(s.shape_id.clone())
                } else {
                    None
                }
            })
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        if !base_ids.is_empty() {
            let fallback_rows = sqlx::query(
                "SELECT metadata->>'shape_id' as shape_id, svg_data \
                 FROM design_objects \
                 WHERE type = 'shape' AND metadata->>'shape_id' = ANY($1)",
            )
            .bind(&base_ids)
            .fetch_all(db)
            .await
            .unwrap_or_default();

            for row in fallback_rows {
                let sid: String = row.try_get("shape_id").unwrap_or_default();
                let svg: String = row.try_get("svg_data").unwrap_or_default();
                if !sid.is_empty() && !svg.is_empty() {
                    shape_svgs.entry(sid).or_insert(svg);
                }
            }
        }
    }

    let mut svg_parts: Vec<String> = Vec::new();

    // Background rect
    svg_parts.push(format!(
        r#"<rect width="100%" height="100%" fill="{}"/>"#,
        bg
    ));

    // Pipes layer (render behind shapes)
    for pipe in &model.pipes {
        let color = pipe.color.as_deref().unwrap_or_else(|| pipe_stroke(&pipe.service_type));
        let path_el = format!(
            r#"<path id="{id}" d="{d}" stroke="{color}" stroke-width="{sw}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>"#,
            id = pipe.element_id,
            d = pipe.path_data,
            color = color,
            sw = pipe.stroke_width,
        );
        svg_parts.push(path_el);

        // Optional pipe label
        if let Some(label) = &pipe.label {
            if !label.is_empty() {
                // Place label at midpoint of path (approximate: parse first M and last L/C coords)
                svg_parts.push(format!(
                    "<text font-family=\"monospace\" font-size=\"11\" fill=\"#A1A1AA\" opacity=\"0.8\">{}</text>",
                    label
                ));
            }
        }
    }

    // Annotations layer — support both flat {text,x,y} and nested {content,position:{x,y}} formats
    for ann in &model.annotations {
        let text = ann.get("text").and_then(|v| v.as_str())
            .or_else(|| ann.get("content").and_then(|v| v.as_str()));
        if let Some(text) = text {
            let x = ann.get("x").and_then(|v| v.as_f64())
                .or_else(|| ann.get("position").and_then(|p| p.get("x")).and_then(|v| v.as_f64()))
                .unwrap_or(0.0);
            let y = ann.get("y").and_then(|v| v.as_f64())
                .or_else(|| ann.get("position").and_then(|p| p.get("y")).and_then(|v| v.as_f64()))
                .unwrap_or(0.0);
            let font_size = ann.get("font_size").and_then(|v| v.as_f64()).unwrap_or(14.0);
            // "style" may be a colour string like "#A1A1AA"
            let color = ann.get("color").and_then(|v| v.as_str())
                .or_else(|| ann.get("style").and_then(|v| v.as_str()).filter(|s| s.starts_with('#')))
                .unwrap_or("#E4E4E7");
            svg_parts.push(format!(
                "<text x=\"{}\" y=\"{}\" font-family=\"monospace\" font-size=\"{}\" fill=\"{}\">{}</text>",
                x, y, font_size, color, text
            ));
        }
    }

    // Shapes layer
    for shape in &model.shapes {
        let lookup_key = match &shape.variant {
            Some(v) if !v.is_empty() && v != "default" =>
                format!("{}-{}", shape.shape_id, v),
            _ => shape.shape_id.clone(),
        };
        let shape_svg_full = shape_svgs.get(&lookup_key)
            .or_else(|| shape_svgs.get(&shape.shape_id))
            .cloned()
            .unwrap_or_default();

        let inner = extract_svg_inner(&shape_svg_full);
        let vb = extract_view_box(&shape_svg_full)
            .unwrap_or_else(|| "0 0 64 64".to_string());
        let (vb_w, vb_h) = view_box_dims(&vb);

        // Scale: render shape at SHAPE_BASE_PX × user scale
        let render_w = SHAPE_BASE_PX * shape.scale.x;
        let render_h = SHAPE_BASE_PX * shape.scale.y * (vb_h / vb_w.max(1.0));

        // Build transform: translate to position, then scale shape to render size
        let sx = render_w / vb_w.max(1.0);
        let sy = render_h / vb_h.max(1.0);

        let mut transform = format!(
            "translate({:.1},{:.1}) scale({:.4},{:.4})",
            shape.position.x, shape.position.y, sx, sy
        );

        // Apply rotation around shape centre (in post-scale coords)
        if shape.rotation != 0.0 {
            let cx = vb_w / 2.0;
            let cy = vb_h / 2.0;
            transform = format!(
                "translate({:.1},{:.1}) rotate({:.1},{:.1},{:.1}) scale({:.4},{:.4})",
                shape.position.x, shape.position.y,
                shape.rotation, cx, cy,
                sx, sy,
            );
        }

        // Mirror
        if shape.mirror == "horizontal" {
            transform.push_str(&format!(" translate({:.1},0) scale(-1,1)", vb_w));
        } else if shape.mirror == "vertical" {
            transform.push_str(&format!(" translate(0,{:.1}) scale(1,-1)", vb_h));
        }

        let group = if inner.is_empty() {
            // Placeholder rectangle when shape SVG is unavailable
            format!(
                "<g id=\"{}\" transform=\"{}\"><rect width=\"{:.0}\" height=\"{:.0}\" fill=\"#27272A\" stroke=\"#52525B\" stroke-width=\"1\"/><text x=\"{:.0}\" y=\"{:.0}\" font-size=\"8\" fill=\"#71717A\" text-anchor=\"middle\">{}</text></g>",
                shape.element_id, transform,
                vb_w, vb_h,
                vb_w / 2.0, vb_h / 2.0 + 4.0,
                shape.shape_id,
            )
        } else {
            format!(
                r#"<g id="{}" transform="{}">{}</g>"#,
                shape.element_id, transform, inner
            )
        };

        svg_parts.push(group);
    }

    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{}">{}</svg>"#,
        view_box,
        svg_parts.join("\n")
    )
}

/// Returns true if the string looks like a placeholder (not real SVG content)
fn is_placeholder_svg(svg: &str) -> bool {
    svg.contains("Placeholder") || svg.is_empty() || svg.len() < 200
}

// ---------------------------------------------------------------------------
// Slugify a graphic name into a safe directory name
// ---------------------------------------------------------------------------

fn slugify(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    // Collapse runs of dashes, trim leading/trailing dashes
    let slug = slug
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() {
        "graphic".to_string()
    } else {
        slug
    }
}

// ---------------------------------------------------------------------------
// GET /api/graphics/:id/export
// Returns a .iographic ZIP file as a download (doc 39 format)
// ---------------------------------------------------------------------------

pub async fn export_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:export") && !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    // 1. Load the graphic
    let row = match sqlx::query(
        "SELECT id, name, type, svg_data, bindings, metadata FROM design_objects \
         WHERE id = $1 AND type = 'graphic'",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "export_graphic: failed to load graphic");
            return IoError::Database(e).into_response();
        }
    };

    let name: String = row.try_get("name").unwrap_or_default();
    let graphic_type: String = row.try_get("type").unwrap_or_else(|_| "graphic".to_string());
    let svg_data: Option<String> = row.try_get("svg_data").ok().flatten();
    let bindings: Option<JsonValue> = row.try_get("bindings").ok().flatten();

    // 2. Load associated shapes
    let shape_rows = match sqlx::query(
        "SELECT id, name, svg_data FROM design_objects \
         WHERE parent_id = $1 AND type IN ('shape', 'stencil')",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!(error = %e, "export_graphic: failed to load shapes (non-fatal)");
            vec![]
        }
    };

    let dir = slugify(&name);

    // 3. Build ZIP in memory
    let mut zip_bytes: Vec<u8> = Vec::new();
    let cursor = std::io::Cursor::new(&mut zip_bytes);
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // manifest.json
    let manifest = IographicManifest {
        format: "iographic".to_string(),
        format_version: "1.0".to_string(),
        generator: Some(IographicGenerator {
            application: "Inside/Operations".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }),
        exported_at: Utc::now().to_rfc3339(),
        exported_by: Some(claims.sub.clone()),
        description: None,
        graphics: vec![IographicGraphicEntry {
            directory: dir.clone(),
            name: name.clone(),
            graphic_type,
            path: None,
        }],
        graphic: None,
    };

    let manifest_json = match serde_json::to_string_pretty(&manifest) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "export_graphic: manifest serialization failed");
            return IoError::Internal("Failed to serialize manifest".into()).into_response();
        }
    };

    macro_rules! zip_write {
        ($path:expr, $bytes:expr) => {
            if let Err(e) = zip.start_file($path, options) {
                tracing::error!(error = %e, path = $path, "export_graphic: zip start_file failed");
                return IoError::Internal("Failed to build ZIP".into()).into_response();
            }
            if let Err(e) = zip.write_all($bytes) {
                tracing::error!(error = %e, path = $path, "export_graphic: zip write_all failed");
                return IoError::Internal("Failed to write ZIP entry".into()).into_response();
            }
        };
    }

    zip_write!("manifest.json", manifest_json.as_bytes());

    // graphics/{dir}/graphic.svg
    let svg_content = svg_data.unwrap_or_default();
    zip_write!(
        &format!("graphics/{}/graphic.svg", dir),
        svg_content.as_bytes()
    );

    // graphics/{dir}/graphic.json  (bindings + metadata)
    let graphic_json = serde_json::to_string_pretty(
        &bindings.unwrap_or(JsonValue::Object(serde_json::Map::new())),
    )
    .unwrap_or_else(|_| "{}".to_string());
    zip_write!(
        &format!("graphics/{}/graphic.json", dir),
        graphic_json.as_bytes()
    );

    // shapes/{shape_id}/shape.svg
    for shape_row in &shape_rows {
        let shape_id: Uuid = match shape_row.try_get("id") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let shape_name: String = shape_row
            .try_get::<String, _>("name")
            .unwrap_or_default();
        let shape_svg: String = shape_row
            .try_get::<Option<String>, _>("svg_data")
            .ok()
            .flatten()
            .unwrap_or_default();
        let shape_dir = format!("{}.custom.{}", slugify(&shape_name), shape_id);

        if let Err(e) = zip.start_file(format!("shapes/{}/shape.svg", shape_dir), options) {
            tracing::warn!(error = %e, shape_id = %shape_id, "export_graphic: skipping shape");
            continue;
        }
        let _ = zip.write_all(shape_svg.as_bytes());
    }

    // Finalize ZIP
    let cursor = match zip.finish() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(error = %e, "export_graphic: zip finalize failed");
            return IoError::Internal("Failed to finalize ZIP".into()).into_response();
        }
    };
    let _ = cursor;

    // 4. Build response
    let safe_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let filename = format!("{}.iographic", safe_name);
    let content_disposition = format!("attachment; filename=\"{}\"", filename);

    let mut response = Response::new(Body::from(zip_bytes));
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/zip"),
    );
    if let Ok(val) = HeaderValue::from_str(&content_disposition) {
        response.headers_mut().insert(header::CONTENT_DISPOSITION, val);
    }
    response
}

// ---------------------------------------------------------------------------
// POST /api/graphics/import
// Accepts doc 39 format and old flat format for backward compat.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ImportResult {
    /// ID of the first (or only) imported graphic. Useful for single-graphic packages.
    pub id: String,
    pub name: String,
    /// All imported graphic IDs — one per graphic entry in the package.
    pub ids: Vec<String>,
    pub count: usize,
}

pub async fn import_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    // 1. Extract file bytes from multipart
    let mut file_bytes: Option<Vec<u8>> = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name() == Some("file") {
            match field.bytes().await {
                Ok(bytes) => {
                    file_bytes = Some(bytes.to_vec());
                    break;
                }
                Err(e) => {
                    tracing::error!(error = %e, "import_graphic: failed to read file field");
                    return IoError::BadRequest("Failed to read uploaded file".into()).into_response();
                }
            }
        }
    }

    let bytes = match file_bytes {
        Some(b) => b,
        None => {
            return IoError::BadRequest("No file field in multipart request".into())
                .into_response()
        }
    };

    // 2. Parse ZIP
    let cursor = std::io::Cursor::new(bytes);
    let mut zip = match zip::ZipArchive::new(cursor) {
        Ok(z) => z,
        Err(e) => {
            tracing::error!(error = %e, "import_graphic: not a valid ZIP");
            return IoError::BadRequest(
                "Invalid .iographic file (not a valid ZIP archive)".into(),
            )
            .into_response();
        }
    };

    // 3. Read and parse manifest.json
    let manifest: IographicManifest = {
        let mut f = match zip.by_name("manifest.json") {
            Ok(f) => f,
            Err(_) => {
                return IoError::BadRequest(
                    "manifest.json not found — this does not appear to be a valid .iographic package".into(),
                )
                .into_response()
            }
        };
        let mut content = String::new();
        use std::io::Read;
        if f.read_to_string(&mut content).is_err() {
            return IoError::BadRequest("Failed to read manifest.json".into()).into_response();
        }
        match serde_json::from_str::<IographicManifest>(&content) {
            Ok(m) => m,
            Err(e) => {
                tracing::error!(
                    error = %e,
                    content = %&content[..content.len().min(500)],
                    "import_graphic: manifest parse failed"
                );
                return IoError::BadRequest(format!(
                    "Invalid manifest.json: {}. \
                     Expected fields: format, format_version, graphics (array).",
                    e
                ))
                .into_response();
            }
        }
    };

    if manifest.format != "iographic" {
        return IoError::BadRequest(format!(
            "Unrecognised format '{}' — expected 'iographic'",
            manifest.format
        ))
        .into_response();
    }

    // 4. Resolve graphic entries — support both new (graphics[]) and legacy (graphic{}) layouts
    let entries: Vec<IographicGraphicEntry> = if !manifest.graphics.is_empty() {
        manifest.graphics.clone()
    } else if let Some(ref legacy) = manifest.graphic {
        // Old flat format: files were at graphics/{id}.svg and graphics/{id}-bindings.json
        vec![IographicGraphicEntry {
            directory: legacy.id.clone(), // legacy used the UUID as the path
            name: legacy.name.clone(),
            graphic_type: "graphic".to_string(),
            path: None,
        }]
    } else {
        return IoError::BadRequest(
            "manifest.json contains no graphics entries".into(),
        )
        .into_response();
    };

    let created_by: Option<Uuid> = Uuid::parse_str(&claims.sub).ok();
    let mut imported_ids: Vec<String> = Vec::new();
    let mut last_imported_name = String::new();

    // Log all ZIP entries to help diagnose path mismatches
    {
        let all_entries: Vec<String> = (0..zip.len())
            .filter_map(|i| zip.by_index(i).ok().map(|e| e.name().to_string()))
            .collect();
        tracing::info!(entries = ?all_entries, "import_graphic: ZIP contents");
    }

    // 5. Import each graphic entry
    for entry in &entries {
        // Resolve directory: prefer explicit `directory`, fall back to deriving from `path`
        let dir_owned: String = if !entry.directory.is_empty() {
            entry.directory.clone()
        } else if let Some(ref p) = entry.path {
            // e.g. "graphics/h2plant-unit-24/graphic.json" → "h2plant-unit-24"
            p.trim_start_matches("graphics/")
                .split('/')
                .next()
                .unwrap_or(p.as_str())
                .to_string()
        } else {
            slugify(&entry.name)
        };
        let dir = &dir_owned;
        let graphic_name = &entry.name;

        // Try multiple path layouts for compatibility with different .iographic producers
        let svg_candidates = vec![
            format!("graphics/{}/graphic.svg", dir),
            format!("graphics/{}.svg", dir),
            // Without graphics/ prefix (some producers omit the top-level directory)
            format!("{}/graphic.svg", dir),
            format!("{}.svg", dir),
            // Using original name instead of slug
            format!("graphics/{}/graphic.svg", graphic_name),
            format!("graphics/{}.svg", graphic_name),
        ];
        let raw_svg = read_zip_entry_string(&mut zip, &svg_candidates);

        // Bindings / graphic model: new path is graphics/{dir}/graphic.json
        let graphic_json_str = read_zip_entry_string(
            &mut zip,
            &[
                format!("graphics/{}/graphic.json", dir),
                format!("graphics/{}-bindings.json", dir),
            ],
        );

        // Decide final SVG: if the file's SVG is a placeholder (or missing), try to
        // render it from graphic.json using the shape library.
        let svg_content: Option<String> = if raw_svg.as_deref().map(is_placeholder_svg).unwrap_or(true) {
            if let Some(ref json_str) = graphic_json_str {
                match serde_json::from_str::<GraphicModel>(json_str) {
                    Ok(model) => {
                        let rendered = render_model_to_svg(&state.db, &model).await;
                        tracing::info!(
                            name = %graphic_name,
                            svg_len = rendered.len(),
                            "import_graphic: rendered SVG from model"
                        );
                        Some(rendered)
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, name = %graphic_name, "import_graphic: graphic.json parse failed, using raw SVG");
                        raw_svg
                    }
                }
            } else {
                if raw_svg.as_deref().map(is_placeholder_svg).unwrap_or(true) {
                    tracing::warn!(
                        name = %graphic_name,
                        dir = %dir,
                        candidates = ?svg_candidates,
                        "import_graphic: SVG not found and no graphic.json — graphic will have empty content"
                    );
                }
                raw_svg
            }
        } else {
            raw_svg
        };

        // Extract bindings from graphic.json model (or parse as plain bindings JSON)
        let bindings: JsonValue = graphic_json_str
            .as_deref()
            .and_then(|s| serde_json::from_str::<JsonValue>(s).ok())
            .map(|v| {
                // If it looks like a graphic model (has "shapes" key), store the whole model
                // as bindings so the Designer can re-open it later
                v
            })
            .unwrap_or(JsonValue::Object(serde_json::Map::new()));

        let new_id = Uuid::new_v4();

        match sqlx::query(
            "INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by) \
             VALUES ($1, $2, 'graphic', $3, $4, '{}'::jsonb, $5)",
        )
        .bind(new_id)
        .bind(graphic_name)
        .bind(svg_content.as_deref().unwrap_or(""))
        .bind(&bindings)
        .bind(created_by)
        .execute(&state.db)
        .await
        {
            Ok(_) => {
                imported_ids.push(new_id.to_string());
                last_imported_name = graphic_name.clone();
                tracing::info!(
                    graphic_id = %new_id,
                    name = %graphic_name,
                    "import_graphic: imported graphic"
                );
            }
            Err(e) => {
                tracing::error!(error = %e, name = %graphic_name, "import_graphic: DB insert failed");
                return IoError::Database(e).into_response();
            }
        }

        // Import any shapes bundled under shapes/{shape_dir}/shape.svg
        let shape_dirs: Vec<String> = {
            let mut dirs = Vec::new();
            for i in 0..zip.len() {
                if let Ok(entry) = zip.by_index(i) {
                    let n = entry.name().to_string();
                    if n.starts_with("shapes/") && n.ends_with("/shape.svg") {
                        if let Some(d) = n
                            .strip_prefix("shapes/")
                            .and_then(|s| s.strip_suffix("/shape.svg"))
                        {
                            dirs.push(d.to_string());
                        }
                    }
                    // Legacy flat shapes: shapes/{uuid}.svg
                    if n.starts_with("shapes/") && n.ends_with(".svg") && !n.contains('/') {
                        dirs.push(n.trim_end_matches(".svg").trim_start_matches("shapes/").to_string());
                    }
                }
            }
            dirs
        };

        for shape_dir in &shape_dirs {
            let shape_svg = read_zip_entry_string(
                &mut zip,
                &[
                    format!("shapes/{}/shape.svg", shape_dir),
                    format!("shapes/{}.svg", shape_dir),
                ],
            )
            .unwrap_or_default();

            let shape_id = Uuid::new_v4();
            let shape_name = format!("Shape from {}", graphic_name);

            if let Err(e) = sqlx::query(
                "INSERT INTO design_objects \
                 (id, name, type, svg_data, bindings, metadata, parent_id, created_by) \
                 VALUES ($1, $2, 'shape', $3, '{}'::jsonb, '{}'::jsonb, $4, $5)",
            )
            .bind(shape_id)
            .bind(&shape_name)
            .bind(&shape_svg)
            .bind(new_id)
            .bind(created_by)
            .execute(&state.db)
            .await
            {
                tracing::warn!(error = %e, "import_graphic: shape insert failed (non-fatal)");
            }
        }
    }

    let first_id = imported_ids.first().cloned().unwrap_or_default();
    let count = imported_ids.len();
    Json(ApiResponse::ok(ImportResult {
        id: first_id,
        name: last_imported_name,
        ids: imported_ids,
        count,
    }))
    .into_response()
}

// ---------------------------------------------------------------------------
// Helper: try reading a ZIP entry from a list of candidate paths,
// returning the first one found (or None).
// ---------------------------------------------------------------------------

fn read_zip_entry_string(
    zip: &mut zip::ZipArchive<std::io::Cursor<Vec<u8>>>,
    candidates: &[String],
) -> Option<String> {
    use std::io::Read;
    for path in candidates {
        // Try forward-slash path first, then Windows backslash variant
        for variant in &[path.clone(), path.replace('/', "\\")] {
            if let Ok(mut f) = zip.by_name(variant) {
                let mut buf = String::new();
                if f.read_to_string(&mut buf).is_ok() {
                    return Some(buf);
                }
            }
        }
    }
    None
}
