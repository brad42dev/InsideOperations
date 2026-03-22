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
use sha2::{Digest, Sha256};
use sqlx::Row;
use std::collections::{BTreeMap, HashMap, HashSet};
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

/// Inventory entry for a custom shape packaged in a .iographic file (doc 39 §3).
#[derive(Debug, Serialize, Deserialize)]
pub struct IographicShapeEntry {
    pub directory: String,
    pub name: String,
    pub shape_id: String,
}

/// Inventory entry for a stencil packaged in a .iographic file (doc 39 §3).
#[derive(Debug, Serialize, Deserialize)]
pub struct IographicStencilEntry {
    pub directory: String,
    pub name: String,
}

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
    /// Inventory of custom shapes packaged for portability (doc 39 §3).
    pub shapes: Vec<IographicShapeEntry>,
    /// Inventory of stencils packaged for portability (doc 39 §3).
    pub stencils: Vec<IographicStencilEntry>,
    /// Deduplicated list of ALL shape library IDs referenced across all graphics (doc 39 §3).
    pub shape_dependencies: Vec<String>,
    /// Deduplicated list of all point tag names referenced in bindings (doc 39 §3).
    pub point_tags: Vec<String>,
    /// SHA-256 digest of all other files in the ZIP (excluding manifest.json itself) (doc 39 §3).
    pub checksum: String,
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
    #[allow(dead_code)]
    #[serde(default)]
    bindings: JsonValue,
}

#[derive(Debug, Deserialize, Default)]
struct GraphicModelMeta {
    #[serde(default = "default_view_box")]
    view_box: String,
    #[allow(dead_code)]
    #[serde(default = "default_width")]
    width: f64,
    #[allow(dead_code)]
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
    #[allow(dead_code)]
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
// UUID → tag resolution helpers for export
// ---------------------------------------------------------------------------

/// Recursively walks a JSON value and collects all UUID strings found under the
/// keys `point_id`, `setpoint_point_id`, and `equipment_point_ids`.
fn collect_point_ids_from_bindings(val: &JsonValue, out: &mut HashSet<Uuid>) {
    match val {
        JsonValue::Object(map) => {
            for (key, child) in map {
                match key.as_str() {
                    "point_id" | "setpoint_point_id" => {
                        if let JsonValue::String(s) = child {
                            if let Ok(uuid) = Uuid::parse_str(s) {
                                out.insert(uuid);
                            }
                        }
                    }
                    "equipment_point_ids" => {
                        if let JsonValue::Array(arr) = child {
                            for item in arr {
                                if let JsonValue::String(s) = item {
                                    if let Ok(uuid) = Uuid::parse_str(s) {
                                        out.insert(uuid);
                                    }
                                }
                            }
                        }
                    }
                    _ => {
                        collect_point_ids_from_bindings(child, out);
                    }
                }
            }
        }
        JsonValue::Array(arr) => {
            for item in arr {
                collect_point_ids_from_bindings(item, out);
            }
        }
        _ => {}
    }
}

/// Recursively walks a JSON value and replaces UUID-based point reference fields
/// with tag-based fields using the provided lookup map.
///
/// Replacements performed:
/// - `"point_id": "uuid"` → `"point_tag": "FIC-101.PV"`, adds `"source_hint": "OPC-DCS-1"`
/// - `"setpoint_point_id": "uuid"` → `"setpoint_point_tag": "..."`
/// - `"equipment_point_ids": [...]` → `"equipment_point_tags": [...]`
///
/// Missing UUIDs produce `"point_tag": "<DELETED:uuid>"` and `"source_hint": null`.
fn transform_bindings_uuids_to_tags(
    val: JsonValue,
    lookup: &HashMap<Uuid, (String, String)>,
) -> JsonValue {
    match val {
        JsonValue::Object(map) => {
            let mut new_map = serde_json::Map::new();
            // Track whether we injected source_hint for the "point_id" replacement so we
            // only do it once per object level.
            let mut injected_source_hint = false;

            for (key, child) in map {
                match key.as_str() {
                    "point_id" => {
                        if let JsonValue::String(ref s) = child {
                            if let Ok(uuid) = Uuid::parse_str(s) {
                                match lookup.get(&uuid) {
                                    Some((tag, src)) => {
                                        new_map.insert(
                                            "point_tag".to_string(),
                                            JsonValue::String(tag.clone()),
                                        );
                                        new_map.insert(
                                            "source_hint".to_string(),
                                            JsonValue::String(src.clone()),
                                        );
                                    }
                                    None => {
                                        new_map.insert(
                                            "point_tag".to_string(),
                                            JsonValue::String(format!("<DELETED:{}>", s)),
                                        );
                                        new_map.insert(
                                            "source_hint".to_string(),
                                            JsonValue::Null,
                                        );
                                    }
                                }
                                injected_source_hint = true;
                                continue; // skip inserting original "point_id"
                            }
                        }
                        // Not a valid UUID string — keep as-is
                        new_map.insert(key, child);
                    }
                    "source_hint" if injected_source_hint => {
                        // We already injected source_hint — skip the stale one from the DB
                        continue;
                    }
                    "setpoint_point_id" => {
                        if let JsonValue::String(ref s) = child {
                            if let Ok(uuid) = Uuid::parse_str(s) {
                                let tag_val = match lookup.get(&uuid) {
                                    Some((tag, _)) => JsonValue::String(tag.clone()),
                                    None => JsonValue::String(format!("<DELETED:{}>", s)),
                                };
                                new_map.insert("setpoint_point_tag".to_string(), tag_val);
                                continue;
                            }
                        }
                        new_map.insert(key, child);
                    }
                    "equipment_point_ids" => {
                        if let JsonValue::Array(arr) = child {
                            let tags: Vec<JsonValue> = arr
                                .into_iter()
                                .map(|item| {
                                    if let JsonValue::String(ref s) = item {
                                        if let Ok(uuid) = Uuid::parse_str(s) {
                                            return match lookup.get(&uuid) {
                                                Some((tag, _)) => {
                                                    JsonValue::String(tag.clone())
                                                }
                                                None => JsonValue::String(
                                                    format!("<DELETED:{}>", s),
                                                ),
                                            };
                                        }
                                    }
                                    item
                                })
                                .collect();
                            new_map.insert(
                                "equipment_point_tags".to_string(),
                                JsonValue::Array(tags),
                            );
                            continue;
                        }
                        new_map.insert(key, child);
                    }
                    _ => {
                        new_map.insert(
                            key,
                            transform_bindings_uuids_to_tags(child, lookup),
                        );
                    }
                }
            }
            JsonValue::Object(new_map)
        }
        JsonValue::Array(arr) => {
            JsonValue::Array(
                arr.into_iter()
                    .map(|item| transform_bindings_uuids_to_tags(item, lookup))
                    .collect(),
            )
        }
        other => other,
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
    let metadata_val: Option<JsonValue> = row.try_get("metadata").ok().flatten();

    // 1a. Resolve point UUIDs → tag names for portable graphic.json
    //
    // Walk the raw bindings JSON, collect all UUIDs from "point_id",
    // "setpoint_point_id", and "equipment_point_ids" fields, then batch-resolve
    // them in a single SQL query.
    let uuid_to_tag: HashMap<Uuid, (String, String)> = {
        let mut uuid_set: HashSet<Uuid> = HashSet::new();
        if let Some(ref b) = bindings {
            collect_point_ids_from_bindings(b, &mut uuid_set);
        }

        if uuid_set.is_empty() {
            HashMap::new()
        } else {
            let ids: Vec<Uuid> = uuid_set.into_iter().collect();
            match sqlx::query(
                "SELECT pm.id, pm.tagname, ps.name AS source_name \
                 FROM points_metadata pm \
                 JOIN point_sources ps ON pm.source_id = ps.id \
                 WHERE pm.id = ANY($1)",
            )
            .bind(&ids)
            .fetch_all(&state.db)
            .await
            {
                Ok(rows) => {
                    let mut map = HashMap::new();
                    for r in rows {
                        let pid: Uuid = match r.try_get("id") {
                            Ok(v) => v,
                            Err(_) => continue,
                        };
                        let tagname: String = r.try_get("tagname").unwrap_or_default();
                        let source_name: String = r.try_get("source_name").unwrap_or_default();
                        map.insert(pid, (tagname, source_name));
                    }
                    map
                }
                Err(e) => {
                    tracing::warn!(
                        error = %e,
                        "export_graphic: failed to resolve point UUIDs (non-fatal, continuing with empty map)"
                    );
                    HashMap::new()
                }
            }
        }
    };

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

    // 3. Collect all non-manifest file contents into a BTreeMap (sorted by path).
    //    This lets us compute the checksum before writing the manifest.
    let mut file_map: BTreeMap<String, Vec<u8>> = BTreeMap::new();

    // graphics/{dir}/graphic.svg
    let svg_content = svg_data.unwrap_or_default();
    file_map.insert(
        format!("graphics/{}/graphic.svg", dir),
        svg_content.into_bytes(),
    );

    // graphics/{dir}/graphic.json — full spec-compliant structure with tag-based bindings.
    //
    // The raw `bindings` JSONB from the DB contains UUID `point_id` fields which are
    // instance-specific. We transform them to portable `point_tag` + `source_hint` fields
    // before writing. The graphic.json envelope follows the doc 39 §4 schema.
    let raw_bindings = bindings.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    // Extract sub-fields from the DB JSONB if it is a GraphicModel-style object
    // (top-level: shapes, pipes, annotations, bindings, metadata).
    let (model_shapes, model_pipes, model_annotations, model_layers, inner_bindings) =
        if let JsonValue::Object(ref obj) = raw_bindings {
            let shapes = obj
                .get("shapes")
                .cloned()
                .unwrap_or(JsonValue::Array(vec![]));
            let pipes = obj
                .get("pipes")
                .cloned()
                .unwrap_or(JsonValue::Array(vec![]));
            let annotations = obj
                .get("annotations")
                .cloned()
                .unwrap_or(JsonValue::Array(vec![]));
            let layers = obj
                .get("layers")
                .cloned()
                .unwrap_or(JsonValue::Array(vec![]));
            // The bindings sub-object is what actually holds per-element point references
            let inner = obj
                .get("bindings")
                .cloned()
                .unwrap_or(JsonValue::Object(serde_json::Map::new()));
            (shapes, pipes, annotations, layers, inner)
        } else {
            (
                JsonValue::Array(vec![]),
                JsonValue::Array(vec![]),
                JsonValue::Array(vec![]),
                JsonValue::Array(vec![]),
                raw_bindings.clone(),
            )
        };

    // Transform the inner bindings object: replace all UUID point references with tags
    let tag_based_bindings = transform_bindings_uuids_to_tags(inner_bindings, &uuid_to_tag);

    // Build the metadata envelope for the graphic.json
    let graphic_metadata = {
        let mut m = serde_json::Map::new();
        // Prefer the metadata JSONB from the DB row; supplement with sensible defaults
        if let Some(JsonValue::Object(ref db_meta)) = metadata_val {
            for (k, v) in db_meta {
                m.insert(k.clone(), v.clone());
            }
        }
        // Ensure at minimum viewBox, width, height are present
        if !m.contains_key("viewBox") && !m.contains_key("view_box") {
            m.insert("viewBox".to_string(), JsonValue::String("0 0 1920 1080".to_string()));
        }
        if !m.contains_key("width") {
            m.insert("width".to_string(), serde_json::json!(1920));
        }
        if !m.contains_key("height") {
            m.insert("height".to_string(), serde_json::json!(1080));
        }
        JsonValue::Object(m)
    };

    // Assemble the full graphic.json object (doc 39 §4 schema)
    let graphic_json_obj = serde_json::json!({
        "name": name,
        "type": graphic_type,
        "metadata": graphic_metadata,
        "shapes": model_shapes,
        "pipes": model_pipes,
        "bindings": tag_based_bindings,
        "expressions": {},
        "annotations": model_annotations,
        "layers": model_layers
    });

    let graphic_json = serde_json::to_string_pretty(&graphic_json_obj)
        .unwrap_or_else(|_| "{}".to_string());
    file_map.insert(
        format!("graphics/{}/graphic.json", dir),
        graphic_json.into_bytes(),
    );

    // 3a. Derive shape_dependencies and point_tags from the graphic model.
    //
    // shape_dependencies: every unique `shape_id` from the shapes array.
    // point_tags: all tag names from the already-transformed tag-based bindings.
    let mut shape_dep_set: HashSet<String> = HashSet::new();
    let mut point_tag_set: HashSet<String> = HashSet::new();

    // Collect shape_ids from model_shapes
    if let JsonValue::Array(ref shapes_arr) = model_shapes {
        for shape_entry in shapes_arr {
            if let Some(JsonValue::String(sid)) = shape_entry.get("shape_id") {
                if !sid.is_empty() {
                    shape_dep_set.insert(sid.clone());
                }
            }
        }
    }

    // Collect point tags from the already-resolved tag-based bindings.
    // Look for "point_tag" and "setpoint_point_tag" string values, and items in
    // "equipment_point_tags" arrays.
    fn collect_tag_strings(val: &JsonValue, set: &mut HashSet<String>) {
        match val {
            JsonValue::Object(m) => {
                for (key, child) in m {
                    match key.as_str() {
                        "point_tag" | "setpoint_point_tag" => {
                            if let JsonValue::String(s) = child {
                                if !s.is_empty() && !s.starts_with("<DELETED:") {
                                    set.insert(s.clone());
                                }
                            }
                        }
                        "equipment_point_tags" => {
                            if let JsonValue::Array(arr) = child {
                                for item in arr {
                                    if let JsonValue::String(s) = item {
                                        if !s.is_empty() && !s.starts_with("<DELETED:") {
                                            set.insert(s.clone());
                                        }
                                    }
                                }
                            }
                        }
                        _ => {
                            collect_tag_strings(child, set);
                        }
                    }
                }
            }
            JsonValue::Array(arr) => {
                for item in arr {
                    collect_tag_strings(item, set);
                }
            }
            _ => {}
        }
    }
    collect_tag_strings(&tag_based_bindings, &mut point_tag_set);

    let mut shape_dependencies: Vec<String> = shape_dep_set.into_iter().collect();
    shape_dependencies.sort();

    let mut point_tags: Vec<String> = point_tag_set.into_iter().collect();
    point_tags.sort();

    // 3b. Build shapes inventory and add shape SVGs to file_map.
    let mut shapes_inventory: Vec<IographicShapeEntry> = Vec::new();

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
        let shape_id_str = format!(".custom.{}", shape_id);

        shapes_inventory.push(IographicShapeEntry {
            directory: format!("shapes/{}", shape_dir),
            name: shape_name.clone(),
            shape_id: shape_id_str.clone(),
        });

        // Add to shape_dependencies if not already present (custom shapes may or may not
        // appear in the graphic's shapes array by their custom ID)
        if !shape_dependencies.contains(&shape_id_str) {
            shape_dependencies.push(shape_id_str);
        }

        file_map.insert(
            format!("shapes/{}/shape.svg", shape_dir),
            shape_svg.into_bytes(),
        );
    }

    // Re-sort shape_dependencies after possible additions from custom shapes
    shape_dependencies.sort();

    // 3c. Compute SHA-256 checksum over all non-manifest files (sorted by path = BTreeMap order).
    let mut hasher = Sha256::new();
    for (_, content) in &file_map {
        hasher.update(content);
    }
    let hash_bytes = hasher.finalize();
    let checksum = format!(
        "sha256:{}",
        hash_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>()
    );

    // 4. Build the manifest with all required fields.
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
        shapes: shapes_inventory,
        stencils: vec![],
        shape_dependencies,
        point_tags,
        checksum,
    };

    let manifest_json = match serde_json::to_string_pretty(&manifest) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!(error = %e, "export_graphic: manifest serialization failed");
            return IoError::Internal("Failed to serialize manifest".into()).into_response();
        }
    };

    // 5. Write all entries to the ZIP.
    let mut zip_bytes: Vec<u8> = Vec::new();
    let cursor = std::io::Cursor::new(&mut zip_bytes);
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

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

    // Write manifest.json first
    zip_write!("manifest.json", manifest_json.as_bytes());

    // Write all other files from the sorted map
    for (path, content) in &file_map {
        zip_write!(path.as_str(), content.as_slice());
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

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/import/iographic/analyze
// Read-only analysis step: parse ZIP, validate manifest, resolve tags & shapes.
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct TagResolution {
    tag: String,
    status: String,          // "resolved", "ambiguous", "unresolved"
    resolved_to: Option<String>,          // UUID string if resolved
    candidates: Vec<serde_json::Value>,  // populated when ambiguous
}

#[derive(Serialize)]
struct ShapeStatus {
    shape_id: String,
    status: String,  // "available", "missing", "custom_new", "custom_exists"
}

#[derive(Serialize)]
struct StencilStatus {
    stencil_id: String,
    name: String,
    status: String,  // "new", "exists"
}

#[derive(Serialize)]
struct IographicAnalysis {
    manifest: IographicManifest,
    tag_resolutions: Vec<TagResolution>,
    shape_statuses: Vec<ShapeStatus>,
    stencil_statuses: Vec<StencilStatus>,
    valid: bool,
    errors: Vec<String>,
}

pub async fn analyze_iographic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") && !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
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
                    tracing::error!(error = %e, "analyze_iographic: failed to read file field");
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
    let cursor = std::io::Cursor::new(bytes.clone());
    let mut zip = match zip::ZipArchive::new(cursor) {
        Ok(z) => z,
        Err(e) => {
            tracing::error!(error = %e, "analyze_iographic: not a valid ZIP");
            return IoError::BadRequest(
                "Invalid .iographic file (not a valid ZIP archive)".into(),
            )
            .into_response();
        }
    };

    // 3. Read and parse manifest.json
    let manifest: IographicManifest = {
        use std::io::Read as _;
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
        if f.read_to_string(&mut content).is_err() {
            return IoError::BadRequest("Failed to read manifest.json".into()).into_response();
        }
        match serde_json::from_str::<IographicManifest>(&content) {
            Ok(m) => m,
            Err(e) => {
                return IoError::BadRequest(format!("Invalid manifest.json: {}", e)).into_response();
            }
        }
    };

    let mut errors: Vec<String> = Vec::new();

    // 4. Validate format field
    if manifest.format != "iographic" {
        errors.push(format!(
            "Unrecognised format '{}' — expected 'iographic'",
            manifest.format
        ));
    }

    // 5. Verify checksum — re-read all files except manifest.json sorted by path (BTreeMap order).
    //    We re-open the ZIP from the original bytes so we have a fresh cursor.
    {
        let cursor2 = std::io::Cursor::new(bytes);
        match zip::ZipArchive::new(cursor2) {
            Ok(mut zip2) => {
                use std::io::Read as _;
                // Collect all entry names first
                let all_names: Vec<String> = (0..zip2.len())
                    .filter_map(|i| zip2.by_index(i).ok().map(|e| e.name().to_string()))
                    .filter(|n| n != "manifest.json")
                    .collect();

                // Build a sorted map of path → bytes (BTreeMap sorts by key)
                let mut file_map: BTreeMap<String, Vec<u8>> = BTreeMap::new();
                for name in &all_names {
                    if let Ok(mut entry) = zip2.by_name(name) {
                        let mut buf = Vec::new();
                        if entry.read_to_end(&mut buf).is_ok() {
                            file_map.insert(name.clone(), buf);
                        }
                    }
                }

                // Compute SHA-256 over sorted file contents
                let mut hasher = Sha256::new();
                for (_, content) in &file_map {
                    hasher.update(content);
                }
                let hash_bytes = hasher.finalize();
                let computed = format!(
                    "sha256:{}",
                    hash_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>()
                );

                if computed != manifest.checksum {
                    errors.push(format!(
                        "Checksum mismatch: expected '{}', computed '{}'",
                        manifest.checksum, computed
                    ));
                }
            }
            Err(e) => {
                errors.push(format!("Failed to re-read ZIP for checksum verification: {}", e));
            }
        }
    }

    // 6. Resolve point tags
    let mut tag_resolutions: Vec<TagResolution> = Vec::new();
    for tag in &manifest.point_tags {
        let rows_result = sqlx::query(
            "SELECT pm.id::text AS id, pm.tagname, ps.name AS source \
             FROM points_metadata pm \
             JOIN point_sources ps ON pm.source_id = ps.id \
             WHERE pm.tagname = $1",
        )
        .bind(tag)
        .fetch_all(&state.db)
        .await;

        match rows_result {
            Ok(rows) => {
                match rows.len() {
                    0 => {
                        tag_resolutions.push(TagResolution {
                            tag: tag.clone(),
                            status: "unresolved".to_string(),
                            resolved_to: None,
                            candidates: vec![],
                        });
                    }
                    1 => {
                        let id: String = rows[0].try_get("id").unwrap_or_default();
                        tag_resolutions.push(TagResolution {
                            tag: tag.clone(),
                            status: "resolved".to_string(),
                            resolved_to: Some(id),
                            candidates: vec![],
                        });
                    }
                    _ => {
                        let candidates: Vec<serde_json::Value> = rows
                            .iter()
                            .map(|r| {
                                serde_json::json!({
                                    "id": r.try_get::<String, _>("id").unwrap_or_default(),
                                    "tagname": r.try_get::<String, _>("tagname").unwrap_or_default(),
                                    "source": r.try_get::<String, _>("source").unwrap_or_default(),
                                })
                            })
                            .collect();
                        tag_resolutions.push(TagResolution {
                            tag: tag.clone(),
                            status: "ambiguous".to_string(),
                            resolved_to: None,
                            candidates,
                        });
                    }
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, tag = %tag, "analyze_iographic: tag resolution query failed");
                tag_resolutions.push(TagResolution {
                    tag: tag.clone(),
                    status: "unresolved".to_string(),
                    resolved_to: None,
                    candidates: vec![],
                });
            }
        }
    }

    // 7. Check shape availability
    let mut shape_statuses: Vec<ShapeStatus> = Vec::new();
    for shape_id in &manifest.shape_dependencies {
        let is_custom = shape_id.starts_with(".custom.");
        let status = match sqlx::query(
            "SELECT id FROM design_objects \
             WHERE type = 'shape' AND metadata->>'shape_id' = $1 \
             LIMIT 1",
        )
        .bind(shape_id)
        .fetch_optional(&state.db)
        .await
        {
            Ok(Some(_)) => {
                if is_custom { "custom_exists" } else { "available" }
            }
            Ok(None) => {
                if is_custom { "custom_new" } else { "missing" }
            }
            Err(e) => {
                tracing::warn!(error = %e, shape_id = %shape_id, "analyze_iographic: shape lookup failed");
                if is_custom { "custom_new" } else { "missing" }
            }
        };
        shape_statuses.push(ShapeStatus {
            shape_id: shape_id.clone(),
            status: status.to_string(),
        });
    }

    // 8. Check stencil availability
    let mut stencil_statuses: Vec<StencilStatus> = Vec::new();
    for stencil in &manifest.stencils {
        let status = match sqlx::query(
            "SELECT id FROM design_objects \
             WHERE type = 'stencil' AND name = $1 \
             LIMIT 1",
        )
        .bind(&stencil.name)
        .fetch_optional(&state.db)
        .await
        {
            Ok(Some(_)) => "exists",
            Ok(None) => "new",
            Err(e) => {
                tracing::warn!(error = %e, name = %stencil.name, "analyze_iographic: stencil lookup failed");
                "new"
            }
        };
        // Use directory as stencil_id (the stable identifier in the ZIP)
        stencil_statuses.push(StencilStatus {
            stencil_id: stencil.directory.clone(),
            name: stencil.name.clone(),
            status: status.to_string(),
        });
    }

    // 9. Compute valid flag
    let all_tags_ok = tag_resolutions.iter().all(|t| t.status != "unresolved");
    let valid = errors.is_empty() && all_tags_ok;

    let analysis = IographicAnalysis {
        manifest,
        tag_resolutions,
        shape_statuses,
        stencil_statuses,
        valid,
        errors,
    };

    Json(ApiResponse::ok(analysis)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/import/iographic
// Commit step: accept file + options payload, reconstruct tag-based bindings,
// write design_objects + design_object_versions rows.
// ---------------------------------------------------------------------------

/// Tag mapping from the user's wizard decisions.
#[derive(Debug, Deserialize)]
struct TagMapping {
    original_tag: String,
    mapped_tag: Option<String>,
    action: String, // "keep" | "remap" | "skip"
}

/// Shape action from the user's wizard decisions.
#[derive(Debug, Deserialize)]
struct ShapeAction {
    shape_id: String,
    action: String, // "import" | "use_existing" | "import_as_copy" | "skip"
}

/// Stencil action from the user's wizard decisions.
#[derive(Debug, Deserialize)]
struct StencilAction {
    stencil_id: String,
    action: String, // "import" | "use_existing" | "skip"
}

/// Full options payload sent by the frontend commit call.
#[derive(Debug, Deserialize)]
struct IographicImportOptions {
    #[serde(default)]
    tag_mappings: Vec<TagMapping>,
    #[serde(default)]
    shape_actions: Vec<ShapeAction>,
    #[serde(default)]
    stencil_actions: Vec<StencilAction>,
    target_name: Option<String>,
    #[serde(default = "default_import_as")]
    import_as: String, // "draft" | "published"
    #[serde(default)]
    overwrite: bool,
}

fn default_import_as() -> String {
    "draft".to_string()
}

/// Response shape — must match the TypeScript `IographicImportResult` interface.
#[derive(Debug, Serialize)]
struct IographicImportResult {
    graphics_imported: usize,
    shapes_imported: usize,
    stencils_imported: usize,
    bindings_resolved: usize,
    bindings_unresolved: usize,
    bindings_total: usize,
    unresolved_tags: Vec<String>,
    missing_shapes: Vec<String>,
    graphic_ids: Vec<String>,
}

/// Recursively walks tag-based bindings JSON (as produced by DD-39-002 export),
/// replacing `point_tag` fields with `point_id` (UUID) when resolved, or keeping
/// `point_tag` + inserting `"unresolved": true` when the tag could not be resolved.
///
/// `resolved` maps tag → UUID string (resolved tags).
/// `unresolved_kept` is the set of tags whose action is "keep" (not skip).
/// Tags with action "skip" are stripped from their parent object entirely, but
/// since we process object-by-object we handle skip at the binding level below.
fn reconstruct_binding(
    val: JsonValue,
    resolved: &HashMap<String, String>,
    unresolved_kept: &HashSet<String>,
    bindings_resolved: &mut usize,
    bindings_unresolved: &mut usize,
) -> Option<JsonValue> {
    match val {
        JsonValue::Object(map) => {
            // Check if this object has a point_tag — if so, it is a leaf binding reference
            if let Some(JsonValue::String(ref tag)) = map.get("point_tag") {
                let tag = tag.clone();
                if let Some(uuid_str) = resolved.get(&tag) {
                    // Resolved: emit point_id, drop point_tag
                    let mut new_map = serde_json::Map::new();
                    for (k, v) in &map {
                        if k != "point_tag" && k != "source_hint" && k != "unresolved" {
                            new_map.insert(k.clone(), v.clone());
                        }
                    }
                    new_map.insert("point_id".to_string(), JsonValue::String(uuid_str.clone()));
                    *bindings_resolved += 1;
                    return Some(JsonValue::Object(new_map));
                } else if unresolved_kept.contains(&tag) {
                    // Unresolved keep: preserve point_tag, add unresolved: true
                    let mut new_map = serde_json::Map::new();
                    for (k, v) in &map {
                        if k != "unresolved" {
                            new_map.insert(k.clone(), v.clone());
                        }
                    }
                    new_map.insert("unresolved".to_string(), JsonValue::Bool(true));
                    *bindings_unresolved += 1;
                    return Some(JsonValue::Object(new_map));
                } else {
                    // Action is "skip" (or not in any mapping) — auto-try resolve, else skip
                    // For tags not in any mapping: treat as auto-resolve attempt
                    if let Some(uuid_str) = resolved.get(&tag) {
                        let mut new_map = serde_json::Map::new();
                        for (k, v) in &map {
                            if k != "point_tag" && k != "source_hint" && k != "unresolved" {
                                new_map.insert(k.clone(), v.clone());
                            }
                        }
                        new_map.insert("point_id".to_string(), JsonValue::String(uuid_str.clone()));
                        *bindings_resolved += 1;
                        return Some(JsonValue::Object(new_map));
                    }
                    // Not resolvable and not kept — strip this binding
                    return None;
                }
            }

            // Not a leaf binding reference — recurse into children
            let mut new_map = serde_json::Map::new();
            for (k, v) in map {
                if let Some(reconstructed) = reconstruct_binding(
                    v,
                    resolved,
                    unresolved_kept,
                    bindings_resolved,
                    bindings_unresolved,
                ) {
                    new_map.insert(k, reconstructed);
                }
            }
            Some(JsonValue::Object(new_map))
        }
        JsonValue::Array(arr) => {
            let items: Vec<JsonValue> = arr
                .into_iter()
                .filter_map(|item| {
                    reconstruct_binding(
                        item,
                        resolved,
                        unresolved_kept,
                        bindings_resolved,
                        bindings_unresolved,
                    )
                })
                .collect();
            Some(JsonValue::Array(items))
        }
        other => Some(other),
    }
}

pub async fn commit_iographic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    // 1. Extract `file` bytes and `options` JSON string from multipart
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut options_str: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        match field.name() {
            Some("file") => {
                match field.bytes().await {
                    Ok(bytes) => { file_bytes = Some(bytes.to_vec()); }
                    Err(e) => {
                        tracing::error!(error = %e, "commit_iographic: failed to read file field");
                        return IoError::BadRequest("Failed to read uploaded file".into()).into_response();
                    }
                }
            }
            Some("options") => {
                match field.text().await {
                    Ok(text) => { options_str = Some(text); }
                    Err(e) => {
                        tracing::error!(error = %e, "commit_iographic: failed to read options field");
                        return IoError::BadRequest("Failed to read options field".into()).into_response();
                    }
                }
            }
            _ => {}
        }
        if file_bytes.is_some() && options_str.is_some() {
            // Drain remaining fields (if any) without breaking
            // — just continue the loop naturally; the while condition handles EOF
        }
    }

    let bytes = match file_bytes {
        Some(b) => b,
        None => return IoError::BadRequest("No file field in multipart request".into()).into_response(),
    };

    let options: IographicImportOptions = match options_str.as_deref() {
        Some(s) => match serde_json::from_str(s) {
            Ok(o) => o,
            Err(e) => {
                return IoError::BadRequest(format!("Invalid options JSON: {}", e)).into_response();
            }
        },
        // options field is optional — use defaults if not provided
        None => IographicImportOptions {
            tag_mappings: vec![],
            shape_actions: vec![],
            stencil_actions: vec![],
            target_name: None,
            import_as: "draft".to_string(),
            overwrite: false,
        },
    };

    // 2. Parse ZIP and read manifest.json
    let cursor = std::io::Cursor::new(bytes);
    let mut zip = match zip::ZipArchive::new(cursor) {
        Ok(z) => z,
        Err(e) => {
            return IoError::BadRequest(
                format!("Invalid .iographic file (not a valid ZIP archive): {}", e),
            ).into_response();
        }
    };

    let manifest: IographicManifest = {
        use std::io::Read as _;
        let mut f = match zip.by_name("manifest.json") {
            Ok(f) => f,
            Err(_) => {
                return IoError::BadRequest(
                    "manifest.json not found — not a valid .iographic package".into(),
                ).into_response()
            }
        };
        let mut content = String::new();
        if f.read_to_string(&mut content).is_err() {
            return IoError::BadRequest("Failed to read manifest.json".into()).into_response();
        }
        match serde_json::from_str::<IographicManifest>(&content) {
            Ok(m) => m,
            Err(e) => {
                return IoError::BadRequest(format!("Invalid manifest.json: {}", e)).into_response();
            }
        }
    };

    if manifest.format != "iographic" {
        return IoError::BadRequest(
            format!("Unrecognised format '{}' — expected 'iographic'", manifest.format)
        ).into_response();
    }

    // 3. Build tag resolution map from options.tag_mappings + auto-resolution.
    //
    // Pass 1: process explicit mappings.
    //   action "keep"  → tag stays as-is (will be stored with unresolved: true if not in DB)
    //   action "remap" → resolve mapped_tag to UUID via DB
    //   action "skip"  → tag will be omitted from stored bindings
    //
    // Pass 2: auto-resolve any remaining tags from the manifest that have no explicit mapping.

    // resolved: tag → UUID string (for both direct matches and remaps)
    let mut resolved: HashMap<String, String> = HashMap::new();
    // unresolved_kept: tags with action "keep" that cannot be auto-resolved
    let mut unresolved_kept: HashSet<String> = HashSet::new();
    // skipped: tags whose bindings should be dropped
    let mut skipped: HashSet<String> = HashSet::new();
    // explicitly_mapped: tags that have an explicit action (don't auto-resolve these differently)
    let mut explicitly_mapped: HashSet<String> = HashSet::new();

    for mapping in &options.tag_mappings {
        explicitly_mapped.insert(mapping.original_tag.clone());
        match mapping.action.as_str() {
            "remap" => {
                // Resolve mapped_tag to UUID
                if let Some(ref mt) = mapping.mapped_tag {
                    match sqlx::query(
                        "SELECT id::text FROM points_metadata WHERE tagname = $1 LIMIT 1",
                    )
                    .bind(mt)
                    .fetch_optional(&state.db)
                    .await
                    {
                        Ok(Some(row)) => {
                            let uuid_str: String = row.try_get("id").unwrap_or_default();
                            resolved.insert(mapping.original_tag.clone(), uuid_str);
                        }
                        Ok(None) => {
                            // mapped_tag doesn't exist in DB — treat as unresolved keep
                            tracing::warn!(
                                original_tag = %mapping.original_tag,
                                mapped_tag = %mt,
                                "commit_iographic: remap target not found, treating as unresolved"
                            );
                            unresolved_kept.insert(mapping.original_tag.clone());
                        }
                        Err(e) => {
                            tracing::warn!(error = %e, "commit_iographic: remap resolution query failed");
                            unresolved_kept.insert(mapping.original_tag.clone());
                        }
                    }
                } else {
                    unresolved_kept.insert(mapping.original_tag.clone());
                }
            }
            "keep" => {
                // Will attempt auto-resolve; if not found, store with unresolved: true
                // We handle this in Pass 2 below
            }
            "skip" => {
                skipped.insert(mapping.original_tag.clone());
            }
            _ => {
                // Unknown action — treat as keep
            }
        }
    }

    // Pass 2: auto-resolve all tags from the manifest that are not already handled
    // For "keep" mappings and unmapped tags, try DB resolution.
    let tags_to_auto_resolve: Vec<String> = manifest.point_tags.iter()
        .filter(|tag| !resolved.contains_key(*tag) && !skipped.contains(*tag))
        .cloned()
        .collect();

    for tag in &tags_to_auto_resolve {
        match sqlx::query(
            "SELECT id::text FROM points_metadata WHERE tagname = $1 LIMIT 1",
        )
        .bind(tag)
        .fetch_optional(&state.db)
        .await
        {
            Ok(Some(row)) => {
                let uuid_str: String = row.try_get("id").unwrap_or_default();
                resolved.insert(tag.clone(), uuid_str);
            }
            Ok(None) => {
                // Not in DB — if explicitly mapped as "keep", mark as unresolved_kept;
                // if not explicitly mapped, also mark as unresolved_kept (best-effort keep)
                unresolved_kept.insert(tag.clone());
            }
            Err(e) => {
                tracing::warn!(error = %e, tag = %tag, "commit_iographic: auto-resolve query failed");
                unresolved_kept.insert(tag.clone());
            }
        }
    }

    // 4. Resolve graphic entries
    let entries: Vec<IographicGraphicEntry> = if !manifest.graphics.is_empty() {
        manifest.graphics.clone()
    } else if let Some(ref legacy) = manifest.graphic {
        vec![IographicGraphicEntry {
            directory: legacy.id.clone(),
            name: legacy.name.clone(),
            graphic_type: "graphic".to_string(),
            path: None,
        }]
    } else {
        return IoError::BadRequest("manifest.json contains no graphics entries".into()).into_response();
    };

    let created_by: Option<Uuid> = Uuid::parse_str(&claims.sub).ok();
    let version_type = if options.import_as == "published" { "published" } else { "draft" };

    let mut graphic_ids: Vec<String> = Vec::new();
    let mut shapes_imported_total: usize = 0;
    let mut stencils_imported_total: usize = 0;
    let mut total_bindings_resolved: usize = 0;
    let mut total_bindings_unresolved: usize = 0;
    let mut total_bindings_total: usize = 0;
    let mut unresolved_tags_out: Vec<String> = unresolved_kept.iter().cloned().collect();
    unresolved_tags_out.sort();
    let mut missing_shapes_out: Vec<String> = Vec::new();

    // 5. Import each graphic entry
    for entry in &entries {
        let dir_owned: String = if !entry.directory.is_empty() {
            entry.directory.clone()
        } else if let Some(ref p) = entry.path {
            p.trim_start_matches("graphics/")
                .split('/')
                .next()
                .unwrap_or(p.as_str())
                .to_string()
        } else {
            slugify(&entry.name)
        };
        let dir = &dir_owned;
        let graphic_name = options.target_name.as_deref().unwrap_or(&entry.name);

        // Read graphic.json (tag-based bindings format)
        let graphic_json_str = read_zip_entry_string(
            &mut zip,
            &[
                format!("graphics/{}/graphic.json", dir),
                format!("graphics/{}-bindings.json", dir),
            ],
        );

        // Read SVG
        let svg_candidates = vec![
            format!("graphics/{}/graphic.svg", dir),
            format!("graphics/{}.svg", dir),
            format!("{}/graphic.svg", dir),
            format!("{}.svg", dir),
        ];
        let raw_svg = read_zip_entry_string(&mut zip, &svg_candidates);

        // Decide final SVG: render from model if SVG is placeholder/missing
        let svg_content: Option<String> = if raw_svg.as_deref().map(is_placeholder_svg).unwrap_or(true) {
            if let Some(ref json_str) = graphic_json_str {
                match serde_json::from_str::<GraphicModel>(json_str) {
                    Ok(model) => Some(render_model_to_svg(&state.db, &model).await),
                    Err(_) => raw_svg,
                }
            } else {
                raw_svg
            }
        } else {
            raw_svg
        };

        // 5a. Parse graphic.json bindings (post DD-39-002: tag-based)
        let raw_bindings: JsonValue = graphic_json_str
            .as_deref()
            .and_then(|s| serde_json::from_str::<JsonValue>(s).ok())
            .and_then(|v| {
                // Extract inner bindings array/object from graphic.json envelope
                if let JsonValue::Object(ref obj) = v {
                    obj.get("bindings").cloned()
                } else {
                    Some(v)
                }
            })
            .unwrap_or(JsonValue::Object(serde_json::Map::new()));

        // Count total bindings before reconstruction
        let mut count_bindings_total: usize = 0;
        fn count_point_tags(val: &JsonValue, count: &mut usize) {
            match val {
                JsonValue::Object(m) => {
                    if m.contains_key("point_tag") {
                        *count += 1;
                    } else {
                        for v in m.values() {
                            count_point_tags(v, count);
                        }
                    }
                }
                JsonValue::Array(arr) => {
                    for item in arr {
                        count_point_tags(item, count);
                    }
                }
                _ => {}
            }
        }
        count_point_tags(&raw_bindings, &mut count_bindings_total);
        total_bindings_total += count_bindings_total;

        // 5b. Reconstruct bindings: resolve tags → UUIDs, keep unresolved with marker
        let mut entry_resolved = 0usize;
        let mut entry_unresolved = 0usize;
        let reconstructed_bindings = reconstruct_binding(
            raw_bindings,
            &resolved,
            &unresolved_kept,
            &mut entry_resolved,
            &mut entry_unresolved,
        )
        .unwrap_or(JsonValue::Object(serde_json::Map::new()));

        total_bindings_resolved += entry_resolved;
        total_bindings_unresolved += entry_unresolved;

        // 5c. Determine graphic ID: check overwrite flag
        let new_id: Uuid;

        if options.overwrite {
            // Check if a graphic with this name already exists
            let existing = sqlx::query(
                "SELECT id FROM design_objects WHERE name = $1 AND type = 'graphic' LIMIT 1",
            )
            .bind(graphic_name)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

            if let Some(row) = existing {
                let existing_id: Uuid = row.try_get("id").unwrap_or_else(|_| Uuid::new_v4());
                new_id = existing_id;
                // UPDATE the existing row
                match sqlx::query(
                    "UPDATE design_objects SET svg_data = $1, bindings = $2, updated_at = now() \
                     WHERE id = $3",
                )
                .bind(svg_content.as_deref().unwrap_or(""))
                .bind(&reconstructed_bindings)
                .bind(existing_id)
                .execute(&state.db)
                .await
                {
                    Ok(_) => {}
                    Err(e) => {
                        tracing::error!(error = %e, name = %graphic_name, "commit_iographic: DB update failed");
                        return IoError::Database(e).into_response();
                    }
                }
            } else {
                new_id = Uuid::new_v4();
                match sqlx::query(
                    "INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by) \
                     VALUES ($1, $2, 'graphic', $3, $4, '{}'::jsonb, $5)",
                )
                .bind(new_id)
                .bind(graphic_name)
                .bind(svg_content.as_deref().unwrap_or(""))
                .bind(&reconstructed_bindings)
                .bind(created_by)
                .execute(&state.db)
                .await
                {
                    Ok(_) => {}
                    Err(e) => {
                        tracing::error!(error = %e, name = %graphic_name, "commit_iographic: DB insert failed");
                        return IoError::Database(e).into_response();
                    }
                }
            }
        } else {
            new_id = Uuid::new_v4();
            match sqlx::query(
                "INSERT INTO design_objects (id, name, type, svg_data, bindings, metadata, created_by) \
                 VALUES ($1, $2, 'graphic', $3, $4, '{}'::jsonb, $5)",
            )
            .bind(new_id)
            .bind(graphic_name)
            .bind(svg_content.as_deref().unwrap_or(""))
            .bind(&reconstructed_bindings)
            .bind(created_by)
            .execute(&state.db)
            .await
            {
                Ok(_) => {}
                Err(e) => {
                    tracing::error!(error = %e, name = %graphic_name, "commit_iographic: DB insert failed");
                    return IoError::Database(e).into_response();
                }
            }
        }

        // 5d. Insert version row
        let version_id = Uuid::new_v4();
        if let Err(e) = sqlx::query(
            "INSERT INTO design_object_versions (id, graphic_id, version, version_type, created_by) \
             VALUES ($1, $2, 1, $3, $4)",
        )
        .bind(version_id)
        .bind(new_id)
        .bind(version_type)
        .bind(created_by)
        .execute(&state.db)
        .await
        {
            tracing::warn!(
                error = %e,
                graphic_id = %new_id,
                "commit_iographic: version row insert failed (non-fatal)"
            );
        }

        graphic_ids.push(new_id.to_string());

        // 5e. Import custom shapes per shape_actions
        // Collect shape entries from the ZIP
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
                }
            }
            dirs
        };

        for shape_dir in &shape_dirs {
            // Determine action for this shape directory
            // shape_dir may contain the shape_id encoded in it (e.g. "pump.custom.{uuid}")
            let shape_action = options.shape_actions.iter()
                .find(|sa| shape_dir.contains(&sa.shape_id))
                .map(|sa| sa.action.as_str())
                .unwrap_or("import"); // default: import

            if shape_action == "skip" {
                continue;
            }
            if shape_action == "use_existing" {
                // Don't re-import; shape is already in DB
                continue;
            }

            let shape_svg = read_zip_entry_string(
                &mut zip,
                &[
                    format!("shapes/{}/shape.svg", shape_dir),
                    format!("shapes/{}.svg", shape_dir),
                ],
            )
            .unwrap_or_default();

            // Extract a clean shape name from directory (remove uuid suffix if present)
            let shape_name = shape_dir
                .split('.')
                .next()
                .map(|s| s.replace('-', " "))
                .unwrap_or_else(|| format!("Shape from {}", graphic_name));

            let shape_id_new = Uuid::new_v4();
            let parent_id = if shape_action == "import_as_copy" {
                // Import as separate shape, not linked to this graphic
                None::<Uuid>
            } else {
                Some(new_id)
            };

            match sqlx::query(
                "INSERT INTO design_objects \
                 (id, name, type, svg_data, bindings, metadata, parent_id, created_by) \
                 VALUES ($1, $2, 'shape', $3, '{}'::jsonb, '{}'::jsonb, $4, $5)",
            )
            .bind(shape_id_new)
            .bind(&shape_name)
            .bind(&shape_svg)
            .bind(parent_id)
            .bind(created_by)
            .execute(&state.db)
            .await
            {
                Ok(_) => {
                    shapes_imported_total += 1;
                }
                Err(e) => {
                    tracing::warn!(error = %e, "commit_iographic: shape insert failed (non-fatal)");
                    missing_shapes_out.push(shape_dir.clone());
                }
            }
        }

        // 5f. Import stencils per stencil_actions
        for stencil in &manifest.stencils {
            let action = options.stencil_actions.iter()
                .find(|sa| sa.stencil_id == stencil.directory)
                .map(|sa| sa.action.as_str())
                .unwrap_or("import");

            if action == "skip" || action == "use_existing" {
                continue;
            }

            let stencil_svg = read_zip_entry_string(
                &mut zip,
                &[format!("stencils/{}/stencil.svg", stencil.directory)],
            )
            .unwrap_or_default();

            let stencil_id_new = Uuid::new_v4();
            match sqlx::query(
                "INSERT INTO design_objects \
                 (id, name, type, svg_data, bindings, metadata, created_by) \
                 VALUES ($1, $2, 'stencil', $3, '{}'::jsonb, '{}'::jsonb, $4)",
            )
            .bind(stencil_id_new)
            .bind(&stencil.name)
            .bind(&stencil_svg)
            .bind(created_by)
            .execute(&state.db)
            .await
            {
                Ok(_) => {
                    stencils_imported_total += 1;
                }
                Err(e) => {
                    tracing::warn!(error = %e, "commit_iographic: stencil insert failed (non-fatal)");
                }
            }
        }
    }

    let result = IographicImportResult {
        graphics_imported: graphic_ids.len(),
        shapes_imported: shapes_imported_total,
        stencils_imported: stencils_imported_total,
        bindings_resolved: total_bindings_resolved,
        bindings_unresolved: total_bindings_unresolved,
        bindings_total: total_bindings_total,
        unresolved_tags: unresolved_tags_out,
        missing_shapes: missing_shapes_out,
        graphic_ids,
    };

    Json(ApiResponse::ok(result)).into_response()
}
