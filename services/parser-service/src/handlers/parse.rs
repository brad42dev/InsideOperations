use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ParsedElement {
    pub id: Option<String>,
    pub element_type: String, // "group", "rect", "circle", "path", "text", "line"
    pub label: Option<String>,
    pub attributes: Value,
    pub children: Vec<ParsedElement>,
}

#[derive(Debug, Serialize)]
pub struct SvgParseResult {
    pub element_count: usize,
    pub elements: Vec<ParsedElement>,
    pub viewbox: Option<String>,
    pub width: Option<String>,
    pub height: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SvgParseRequest {
    pub content: String,
    #[allow(dead_code)]
    pub source_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct JsonParseRequest {
    pub content: String,
    pub format: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JsonParseResult {
    pub format: String,
    pub element_count: usize,
    pub elements: Vec<Value>,
    pub metadata: Value,
}

#[derive(Debug, Serialize)]
pub struct DxfEntity {
    pub entity_type: String, // "LINE", "CIRCLE", "ARC", "TEXT"
    pub layer: Option<String>,
    pub attributes: Value,
}

#[derive(Debug, Serialize)]
pub struct DxfParseResult {
    pub layers: Vec<String>,
    pub entity_count: usize,
    pub entities: Vec<DxfEntity>,
}

#[derive(Debug, Serialize)]
pub struct FormatInfo {
    pub format: String,
    pub description: String,
    pub mime_types: Vec<String>,
    pub endpoint: String,
}

// ---------------------------------------------------------------------------
// Middleware helper
// ---------------------------------------------------------------------------

fn check_service_secret(headers: &HeaderMap, expected: &str) -> bool {
    if expected.is_empty() {
        return true; // dev mode — no secret configured
    }
    headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == expected)
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// SVG parsing helpers
// ---------------------------------------------------------------------------

fn classify_element(tag: &str) -> &'static str {
    match tag {
        "g" => "group",
        "rect" => "rect",
        "circle" => "circle",
        "ellipse" => "ellipse",
        "line" => "line",
        "polyline" | "polygon" => "polyline",
        "path" => "path",
        "text" | "tspan" => "text",
        "image" => "image",
        "use" => "use",
        _ => "element",
    }
}

fn node_to_parsed_element(node: roxmltree::Node) -> Option<ParsedElement> {
    if !node.is_element() {
        return None;
    }

    let tag = node.tag_name().name();
    // Skip defs, style, script tags
    if matches!(
        tag,
        "defs" | "style" | "script" | "metadata" | "title" | "desc"
    ) {
        return None;
    }

    let element_type = classify_element(tag).to_string();
    let id = node.attribute("id").map(|s| s.to_string());

    // Collect key attributes
    let mut attrs = serde_json::Map::new();
    for attr in node.attributes() {
        attrs.insert(attr.name().to_string(), json!(attr.value()));
    }

    // Extract text content for text elements
    let label = if tag == "text" || tag == "tspan" {
        node.text()
            .map(|t| t.trim().to_string())
            .filter(|s| !s.is_empty())
    } else {
        None
    };

    // Recurse into children
    let children: Vec<ParsedElement> = node.children().filter_map(node_to_parsed_element).collect();

    Some(ParsedElement {
        id,
        element_type,
        label,
        attributes: Value::Object(attrs),
        children,
    })
}

fn count_elements(elements: &[ParsedElement]) -> usize {
    elements
        .iter()
        .fold(0, |acc, el| acc + 1 + count_elements(&el.children))
}

// ---------------------------------------------------------------------------
// POST /parse/svg
// ---------------------------------------------------------------------------

pub async fn parse_svg(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SvgParseRequest>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    if body.content.trim().is_empty() {
        return Err(IoError::BadRequest("content is required".to_string()));
    }

    let parse_start = std::time::Instant::now();

    let doc = roxmltree::Document::parse(&body.content)
        .map_err(|e| IoError::BadRequest(format!("Invalid SVG XML: {}", e)))?;

    let root = doc.root_element();

    // Extract SVG-level metadata
    let viewbox = root.attribute("viewBox").map(|s| s.to_string());
    let width = root.attribute("width").map(|s| s.to_string());
    let height = root.attribute("height").map(|s| s.to_string());

    // Parse all child elements
    let elements: Vec<ParsedElement> = root.children().filter_map(node_to_parsed_element).collect();

    let element_count = count_elements(&elements);

    let elapsed = parse_start.elapsed().as_secs_f64();
    metrics::counter!("io_imports_parsed_total", "format" => "svg").increment(1);
    metrics::histogram!("io_parse_duration_seconds", "format" => "svg").record(elapsed);

    Ok(Json(ApiResponse::ok(SvgParseResult {
        element_count,
        elements,
        viewbox,
        width,
        height,
    })))
}

// ---------------------------------------------------------------------------
// POST /parse/json
// ---------------------------------------------------------------------------

pub async fn parse_json(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<JsonParseRequest>,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    if body.content.trim().is_empty() {
        return Err(IoError::BadRequest("content is required".to_string()));
    }

    let parse_start = std::time::Instant::now();

    let parsed: Value = serde_json::from_str(&body.content)
        .map_err(|e| IoError::BadRequest(format!("Invalid JSON: {}", e)))?;

    let format = body.format.unwrap_or_else(|| "generic".to_string());

    // Normalize: if root is array, use directly; if object with "elements", extract; else wrap
    let elements: Vec<Value> = match &parsed {
        Value::Array(arr) => arr.clone(),
        Value::Object(obj) => {
            if let Some(Value::Array(els)) = obj.get("elements") {
                els.clone()
            } else if let Some(Value::Array(els)) = obj.get("items") {
                els.clone()
            } else {
                vec![parsed.clone()]
            }
        }
        _ => vec![parsed.clone()],
    };

    let element_count = elements.len();

    // Extract metadata from object wrapper if present
    let metadata = match &parsed {
        Value::Object(obj) => {
            let mut meta = serde_json::Map::new();
            for (k, v) in obj {
                if k != "elements" && k != "items" {
                    meta.insert(k.clone(), v.clone());
                }
            }
            Value::Object(meta)
        }
        _ => json!({}),
    };

    let elapsed = parse_start.elapsed().as_secs_f64();
    metrics::counter!("io_imports_parsed_total", "format" => "json").increment(1);
    metrics::histogram!("io_parse_duration_seconds", "format" => "json").record(elapsed);

    Ok(Json(ApiResponse::ok(JsonParseResult {
        format,
        element_count,
        elements,
        metadata,
    })))
}

// ---------------------------------------------------------------------------
// POST /parse/dxf
// ---------------------------------------------------------------------------

pub async fn parse_dxf(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Response {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return StatusCode::UNAUTHORIZED.into_response();
    }

    let content = match std::str::from_utf8(&body) {
        Ok(s) => s.to_string(),
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": { "code": "BAD_REQUEST", "message": "DXF content must be valid UTF-8" }
                })),
            )
                .into_response();
        }
    };

    let parse_start = std::time::Instant::now();
    let (layers, entities) = parse_dxf_content(&content);
    let entity_count = entities.len();

    let elapsed = parse_start.elapsed().as_secs_f64();
    metrics::counter!("io_imports_parsed_total", "format" => "dxf").increment(1);
    metrics::histogram!("io_parse_duration_seconds", "format" => "dxf").record(elapsed);

    let result = DxfParseResult {
        layers,
        entity_count,
        entities,
    };

    Json(ApiResponse::ok(result)).into_response()
}

/// Very basic DXF parser — reads GROUP CODE / VALUE pairs, finds ENTITIES section,
/// extracts LINE, CIRCLE, ARC, TEXT entities.
fn parse_dxf_content(content: &str) -> (Vec<String>, Vec<DxfEntity>) {
    let mut layers: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut entities: Vec<DxfEntity> = Vec::new();

    let lines: Vec<&str> = content.lines().map(|l| l.trim()).collect();
    let mut i = 0;
    let mut in_entities = false;

    // DXF group codes:
    // 0  = entity type
    // 8  = layer name
    // 10 = X coordinate (start/center)
    // 20 = Y coordinate
    // 11 = X end
    // 21 = Y end
    // 40 = radius / height / text height
    // 1  = text string (TEXT entity)

    while i < lines.len().saturating_sub(1) {
        let code = lines[i].trim();
        let value = lines.get(i + 1).map(|s| s.trim()).unwrap_or("");
        i += 2;

        // Detect section transitions
        if code == "0" && value == "SECTION" {
            // peek at next pair
            if i < lines.len().saturating_sub(1) && lines[i].trim() == "2" {
                let section_name = lines.get(i + 1).map(|s| s.trim()).unwrap_or("");
                in_entities = section_name == "ENTITIES";
                i += 2;
            }
            continue;
        }

        if code == "0" && value == "ENDSEC" {
            in_entities = false;
            continue;
        }

        if !in_entities {
            continue;
        }

        // Parse entity
        if code == "0"
            && matches!(
                value,
                "LINE" | "CIRCLE" | "ARC" | "TEXT" | "MTEXT" | "LWPOLYLINE"
            )
        {
            let entity_type = value.to_string();
            let mut attrs = serde_json::Map::new();
            let mut layer: Option<String> = None;

            // Read entity attributes until next entity start or ENDSEC
            while i < lines.len().saturating_sub(1) {
                let ec = lines[i].trim();
                let ev = lines.get(i + 1).map(|s| s.trim()).unwrap_or("");

                // Stop if next entity or end of section
                if ec == "0" {
                    break;
                }
                i += 2;

                match ec {
                    "8" => {
                        layer = Some(ev.to_string());
                        layers.insert(ev.to_string());
                    }
                    "10" => {
                        attrs.insert("x".to_string(), json!(ev));
                    }
                    "20" => {
                        attrs.insert("y".to_string(), json!(ev));
                    }
                    "11" => {
                        attrs.insert("x2".to_string(), json!(ev));
                    }
                    "21" => {
                        attrs.insert("y2".to_string(), json!(ev));
                    }
                    "40" => {
                        attrs.insert("radius".to_string(), json!(ev));
                    }
                    "50" => {
                        attrs.insert("start_angle".to_string(), json!(ev));
                    }
                    "51" => {
                        attrs.insert("end_angle".to_string(), json!(ev));
                    }
                    "1" => {
                        attrs.insert("text".to_string(), json!(ev));
                    }
                    "7" => {
                        attrs.insert("style".to_string(), json!(ev));
                    }
                    _ => {}
                }
            }

            entities.push(DxfEntity {
                entity_type,
                layer,
                attributes: Value::Object(attrs),
            });
        }
    }

    let mut layer_vec: Vec<String> = layers.into_iter().collect();
    layer_vec.sort();

    (layer_vec, entities)
}

// ---------------------------------------------------------------------------
// GET /parse/formats
// ---------------------------------------------------------------------------

pub async fn list_formats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    let formats = vec![
        FormatInfo {
            format: "svg".to_string(),
            description: "Scalable Vector Graphics — process graphics, HMI screens".to_string(),
            mime_types: vec!["image/svg+xml".to_string(), "text/xml".to_string()],
            endpoint: "/parse/svg".to_string(),
        },
        FormatInfo {
            format: "json".to_string(),
            description: "JSON graphic definitions (generic-hmi, wonderware, etc.)".to_string(),
            mime_types: vec!["application/json".to_string()],
            endpoint: "/parse/json".to_string(),
        },
        FormatInfo {
            format: "dxf".to_string(),
            description: "AutoCAD DXF — plant layout, P&ID drawings".to_string(),
            mime_types: vec![
                "application/dxf".to_string(),
                "application/acad".to_string(),
                "image/x-dxf".to_string(),
            ],
            endpoint: "/parse/dxf".to_string(),
        },
    ];

    Ok(Json(ApiResponse::ok(formats)))
}
