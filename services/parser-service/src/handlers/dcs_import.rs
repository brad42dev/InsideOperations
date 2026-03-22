use axum::{
    extract::{Multipart, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::Read;

use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::AppState;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
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

// ---------------------------------------------------------------------------
// Manifest / import-report types (present in every compliant extraction kit)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct KitManifest {
    platform: Option<String>,
    version: Option<String>,
    extraction_date: Option<String>,
    display_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct TagEntry {
    tag: Option<String>,
    // kit may include extra fields — ignore them
    #[serde(flatten)]
    _extra: serde_json::Map<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum TagsJson {
    Strings(Vec<String>),
    Objects(Vec<TagEntry>),
}

#[derive(Debug, Deserialize)]
struct ImportReport {
    warnings: Option<Vec<String>>,
    // kit may include stats and other fields — ignore them
    #[serde(flatten)]
    _extra: serde_json::Map<String, Value>,
}

// ---------------------------------------------------------------------------
// Intermediate JSON format types (generic, used by generic_json platform)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct IntermediateDisplay {
    name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct IntermediateGeometry {
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct IntermediateTagBinding {
    tag: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IntermediateElement {
    id: Option<String>,
    #[serde(rename = "type")]
    element_type: Option<String>,
    geometry: Option<IntermediateGeometry>,
    source_type: Option<String>,
    tag_bindings: Option<Vec<IntermediateTagBinding>>,
    tag_binding: Option<IntermediateTagBinding>,
    content: Option<String>,
    format: Option<String>,
    display_element_hint: Option<String>,
    svg_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IntermediateFormat {
    display: Option<IntermediateDisplay>,
    elements: Option<Vec<IntermediateElement>>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn check_service_secret(headers: &HeaderMap, expected: &str) -> bool {
    if expected.is_empty() {
        return true;
    }
    headers
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == expected)
        .unwrap_or(false)
}

fn intermediate_elem_to_dcs(el: &IntermediateElement, idx: usize) -> DcsElement {
    let geo = el.geometry.as_ref();
    let x = geo.and_then(|g| g.x).unwrap_or(0.0);
    let y = geo.and_then(|g| g.y).unwrap_or(0.0);
    let width = geo.and_then(|g| g.width).unwrap_or(60.0);
    let height = geo.and_then(|g| g.height).unwrap_or(60.0);

    // Derive primary tag from bindings
    let tag = el
        .tag_bindings
        .as_ref()
        .and_then(|b| b.first())
        .and_then(|b| b.tag.clone())
        .or_else(|| el.tag_binding.as_ref().and_then(|b| b.tag.clone()));

    // Map intermediate element type to I/O element_type
    let raw_type = el.element_type.as_deref().unwrap_or("static_shape");
    let element_type = match raw_type {
        "equipment" => "equipment",
        "dynamic_text" | "text" => {
            if el.tag_binding.is_some()
                || el.tag_bindings.as_ref().map(|b| !b.is_empty()).unwrap_or(false)
            {
                "dynamic_text"
            } else {
                "instrument"
            }
        }
        "bar_graph" => "bar_graph",
        "status_text" => "status_text",
        "fill_region" => "equipment",
        "trend_chart" => "instrument",
        "valve" | "valve_control" => "valve",
        "pipe" | "static_shape" | "line" => "pipe",
        _ => "instrument",
    }
    .to_string();

    // Symbol class from source_type
    let symbol_class = el.source_type.as_ref().map(|st| {
        match st.as_str() {
            "valve_control" | "valve_gate" | "valve_butterfly" => "VALVE_GATE",
            "pump_centrifugal" | "pump" => "PUMP",
            "controller_pid" | "pid" => "CONTROLLER_PID",
            "instrument" | "indicator" => "INSTRUMENT",
            "heat_exchanger" => "HEAT_EXCHANGER",
            "vessel" | "tank" => "VESSEL",
            "compressor" => "COMPRESSOR",
            _ => "GENERIC",
        }
        .to_string()
    });

    // Label: use content (text elements) or the element's format string
    let label = el
        .content
        .clone()
        .or_else(|| el.format.clone())
        .or_else(|| tag.clone());

    // Build properties bag
    let mut props = serde_json::Map::new();
    if let Some(svg_path) = &el.svg_path {
        props.insert("svg_path".to_string(), json!(svg_path));
    }
    if let Some(bindings) = &el.tag_bindings {
        let tags_json: Vec<Value> = bindings
            .iter()
            .filter_map(|b| b.tag.as_ref().map(|t| json!(t)))
            .collect();
        props.insert("tag_bindings".to_string(), Value::Array(tags_json));
    }
    props.insert("placement_source".to_string(), json!("native_import"));

    DcsElement {
        id: el
            .id
            .clone()
            .unwrap_or_else(|| format!("elem-{:03}", idx + 1)),
        element_type,
        x,
        y,
        width,
        height,
        symbol_class,
        tag,
        label,
        display_element_hint: el.display_element_hint.clone(),
        properties: Value::Object(props),
    }
}

// ---------------------------------------------------------------------------
// Parse from intermediate JSON format (generic_json and fallback)
// ---------------------------------------------------------------------------

fn parse_intermediate_json(bytes: &[u8]) -> Result<(IntermediateFormat, Vec<String>), String> {
    let intermediate: IntermediateFormat = serde_json::from_slice(bytes)
        .map_err(|e| format!("Invalid intermediate JSON format: {}", e))?;
    let unresolved: Vec<String> = intermediate
        .elements
        .as_ref()
        .map(|els| {
            els.iter()
                .filter(|e| e.source_type.is_some() && e.symbol_class_is_unknown())
                .filter_map(|e| e.source_type.clone())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect()
        })
        .unwrap_or_default();
    Ok((intermediate, unresolved))
}

trait SymbolClassCheck {
    fn symbol_class_is_unknown(&self) -> bool;
}

impl SymbolClassCheck for IntermediateElement {
    fn symbol_class_is_unknown(&self) -> bool {
        // If source_type doesn't map to a known symbol
        if let Some(st) = &self.source_type {
            !matches!(
                st.as_str(),
                "valve_control"
                    | "valve_gate"
                    | "valve_butterfly"
                    | "pump_centrifugal"
                    | "pump"
                    | "controller_pid"
                    | "pid"
                    | "instrument"
                    | "indicator"
                    | "heat_exchanger"
                    | "vessel"
                    | "tank"
                    | "compressor"
            )
        } else {
            false
        }
    }
}

// ---------------------------------------------------------------------------
// Parse SVG from ZIP (generic_svg platform)
// ---------------------------------------------------------------------------

fn parse_svg_from_bytes(
    svg_bytes: &[u8],
    source_name: &str,
) -> Result<(String, u32, u32, Vec<DcsElement>), String> {
    let content = std::str::from_utf8(svg_bytes)
        .map_err(|_| "SVG content is not valid UTF-8".to_string())?;

    let doc = roxmltree::Document::parse(content)
        .map_err(|e| format!("Invalid SVG: {}", e))?;

    let root = doc.root_element();
    let width: u32 = root
        .attribute("width")
        .and_then(|w| w.trim_end_matches("px").parse().ok())
        .unwrap_or(1920);
    let height: u32 = root
        .attribute("height")
        .and_then(|h| h.trim_end_matches("px").parse().ok())
        .unwrap_or(1080);

    let display_name = source_name
        .trim_end_matches(".svg")
        .trim_end_matches(".SVG")
        .to_string();

    let elements = extract_svg_elements(root, 0);

    Ok((display_name, width, height, elements))
}

fn extract_svg_elements(node: roxmltree::Node, depth: usize) -> Vec<DcsElement> {
    if depth > 10 {
        return vec![];
    }
    let mut result = Vec::new();
    for child in node.children() {
        if !child.is_element() {
            continue;
        }
        let tag = child.tag_name().name();
        if matches!(tag, "defs" | "style" | "script" | "metadata" | "title" | "desc") {
            continue;
        }

        let id = child.attribute("id").unwrap_or("").to_string();
        let element_type = match tag {
            "rect" | "polygon" | "polyline" => "pipe",
            "text" | "tspan" => {
                // Check for data-tag attribute (DCS tag binding hint)
                if child.attribute("data-tag").is_some() {
                    "dynamic_text"
                } else {
                    "instrument"
                }
            }
            "g" => {
                // Groups with data-symbol or data-type hint become equipment
                if child.attribute("data-symbol").is_some()
                    || child.attribute("data-type").is_some()
                {
                    "equipment"
                } else {
                    // Recurse into group
                    result.extend(extract_svg_elements(child, depth + 1));
                    continue;
                }
            }
            "circle" | "ellipse" => "equipment",
            "line" | "path" => "pipe",
            _ => "instrument",
        };

        let x: f64 = child
            .attribute("x")
            .or_else(|| child.attribute("cx"))
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.0);
        let y: f64 = child
            .attribute("y")
            .or_else(|| child.attribute("cy"))
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.0);
        let width: f64 = child
            .attribute("width")
            .and_then(|v| v.parse().ok())
            .unwrap_or(60.0);
        let height: f64 = child
            .attribute("height")
            .and_then(|v| v.parse().ok())
            .unwrap_or(60.0);

        let tag_val = child.attribute("data-tag").map(|s| s.to_string());
        let symbol_class = child
            .attribute("data-symbol")
            .map(|s| s.to_uppercase());
        let label = if tag == "text" || tag == "tspan" {
            child.text().map(|t| t.trim().to_string())
        } else {
            None
        };

        let mut props = serde_json::Map::new();
        props.insert("placement_source".to_string(), json!("native_import"));
        props.insert("svg_tag".to_string(), json!(tag));

        result.push(DcsElement {
            id: if id.is_empty() {
                format!("svg-elem-{}", result.len() + 1)
            } else {
                id
            },
            element_type: element_type.to_string(),
            x,
            y,
            width,
            height,
            symbol_class,
            tag: tag_val,
            label,
            display_element_hint: None,
            properties: Value::Object(props),
        });
    }
    result
}

// ---------------------------------------------------------------------------
// Stub result for kit-required platforms
// ---------------------------------------------------------------------------

fn stub_result(platform: &str) -> DcsImportResult {
    let platform_name = platform_display_name(platform);
    DcsImportResult {
        display_name: format!("{} — Kit Required", platform_name),
        width: 1920,
        height: 1080,
        element_count: 0,
        elements: vec![],
        unresolved_symbols: vec![],
        platform: platform.to_string(),
        tags: vec![],
        manifest_platform: None,
        import_warnings: vec![],
    }
}

fn platform_display_name(platform: &str) -> &'static str {
    match platform {
        "honeywell_experion" => "Honeywell Experion PKS",
        "emerson_deltav" => "Emerson DeltaV Live",
        "yokogawa_centum" => "Yokogawa CENTUM VP",
        "abb_800xa" => "ABB 800xA",
        "siemens_pcs7" => "Siemens PCS 7 / WinCC Classic",
        "foxboro_ia" => "Foxboro I/A Series",
        "ge_proficy" => "GE iFIX / Proficy",
        "wonderware" => "AVEVA InTouch / Wonderware",
        "aspentech_aspen" => "AspenTech Aspen",
        "rockwell_factorytalk" => "Rockwell FactoryTalk View",
        "generic_svg" => "Generic SVG",
        "generic_json" => "Generic JSON (Intermediate Format)",
        _ => "Unknown Platform",
    }
}

fn is_valid_platform(p: &str) -> bool {
    matches!(
        p,
        "honeywell_experion"
            | "emerson_deltav"
            | "yokogawa_centum"
            | "abb_800xa"
            | "siemens_pcs7"
            | "foxboro_ia"
            | "ge_proficy"
            | "wonderware"
            | "aspentech_aspen"
            | "rockwell_factorytalk"
            | "generic_svg"
            | "generic_json"
    )
}

// ---------------------------------------------------------------------------
// POST /parse/dcs-import
// ---------------------------------------------------------------------------

pub async fn dcs_import(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> IoResult<impl IntoResponse> {
    if !check_service_secret(&headers, &state.config.service_secret) {
        return Err(IoError::Unauthorized);
    }

    let mut platform: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;

    // Consume multipart fields
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| IoError::BadRequest(format!("Multipart error: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "platform" => {
                let val = field
                    .text()
                    .await
                    .map_err(|e| IoError::BadRequest(format!("Failed to read platform field: {}", e)))?;
                platform = Some(val);
            }
            "file" => {
                file_name = field.file_name().map(|s| s.to_string());
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| IoError::BadRequest(format!("Failed to read file bytes: {}", e)))?;
                file_bytes = Some(bytes.to_vec());
            }
            _ => {
                // consume and discard unknown fields
                let _ = field.bytes().await;
            }
        }
    }

    let platform = platform.ok_or_else(|| IoError::BadRequest("platform field is required".to_string()))?;
    let file_bytes = file_bytes.ok_or_else(|| IoError::BadRequest("file field is required".to_string()))?;
    let file_name = file_name.unwrap_or_else(|| "upload.zip".to_string());

    if !is_valid_platform(&platform) {
        return Err(IoError::BadRequest(format!(
            "Unknown platform '{}'. Valid platforms: honeywell_experion, emerson_deltav, yokogawa_centum, abb_800xa, siemens_pcs7, foxboro_ia, ge_proficy, wonderware, aspentech_aspen, rockwell_factorytalk, generic_svg, generic_json",
            platform
        )));
    }

    // For kit-required platforms, if no zip is provided or zip lacks display.json,
    // return stub. For generic_svg and generic_json, process fully.
    let result = parse_zip(&file_bytes, &file_name, &platform)?;

    Ok(Json(ApiResponse::ok(result)))
}

fn parse_zip(
    bytes: &[u8],
    file_name: &str,
    platform: &str,
) -> IoResult<DcsImportResult> {
    use std::io::Cursor;

    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| IoError::BadRequest(format!("Invalid ZIP file: {}", e)))?;

    // Single pass: collect all relevant file contents
    let mut display_json_bytes: Option<Vec<u8>> = None;
    let mut manifest_bytes: Option<Vec<u8>> = None;
    let mut tags_bytes: Option<Vec<u8>> = None;
    let mut import_report_bytes: Option<Vec<u8>> = None;
    let mut svg_files: Vec<(String, Vec<u8>)> = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| IoError::BadRequest(format!("ZIP read error: {}", e)))?;
        let raw_name = entry.name().to_string();
        let lower = raw_name.to_lowercase();

        // Match by base file name (ignore directory prefix)
        let base = lower
            .rsplit('/')
            .next()
            .unwrap_or(lower.as_str());

        match base {
            "display.json" => {
                if display_json_bytes.is_none() {
                    let mut buf = Vec::new();
                    entry
                        .read_to_end(&mut buf)
                        .map_err(|e| IoError::BadRequest(format!("Failed to read display.json: {}", e)))?;
                    display_json_bytes = Some(buf);
                }
            }
            "manifest.json" => {
                if manifest_bytes.is_none() {
                    let mut buf = Vec::new();
                    entry
                        .read_to_end(&mut buf)
                        .map_err(|e| IoError::BadRequest(format!("Failed to read manifest.json: {}", e)))?;
                    manifest_bytes = Some(buf);
                }
            }
            "tags.json" => {
                if tags_bytes.is_none() {
                    let mut buf = Vec::new();
                    entry
                        .read_to_end(&mut buf)
                        .map_err(|e| IoError::BadRequest(format!("Failed to read tags.json: {}", e)))?;
                    tags_bytes = Some(buf);
                }
            }
            "import_report.json" => {
                if import_report_bytes.is_none() {
                    let mut buf = Vec::new();
                    entry
                        .read_to_end(&mut buf)
                        .map_err(|e| IoError::BadRequest(format!("Failed to read import_report.json: {}", e)))?;
                    import_report_bytes = Some(buf);
                }
            }
            _ if lower.ends_with(".svg") => {
                let mut buf = Vec::new();
                entry
                    .read_to_end(&mut buf)
                    .map_err(|e| IoError::BadRequest(format!("Failed to read SVG: {}", e)))?;
                svg_files.push((raw_name, buf));
            }
            _ => {}
        }
    }

    // Parse manifest.json — platform from manifest takes precedence
    let manifest_platform: Option<String> = manifest_bytes.as_deref().and_then(|b| {
        serde_json::from_slice::<KitManifest>(b)
            .ok()
            .and_then(|m| m.platform)
    });

    // Parse tags.json — optional; absent is not an error
    let tags: Vec<String> = tags_bytes
        .as_deref()
        .and_then(|b| serde_json::from_slice::<TagsJson>(b).ok())
        .map(|t| match t {
            TagsJson::Strings(v) => v,
            TagsJson::Objects(v) => v.into_iter().filter_map(|e| e.tag).collect(),
        })
        .unwrap_or_default();

    // Parse import_report.json — optional; absent is not an error
    let import_warnings: Vec<String> = import_report_bytes
        .as_deref()
        .and_then(|b| serde_json::from_slice::<ImportReport>(b).ok())
        .and_then(|r| r.warnings)
        .unwrap_or_default();

    // Effective platform: manifest takes precedence over multipart field
    let effective_platform = manifest_platform
        .as_deref()
        .unwrap_or(platform);

    if let Some(json_bytes) = display_json_bytes {
        // Parse intermediate JSON format
        let mut result = parse_from_intermediate_json(&json_bytes, effective_platform)?;
        result.tags = tags;
        result.manifest_platform = manifest_platform;
        result.import_warnings = import_warnings;
        return Ok(result);
    }

    if !svg_files.is_empty() {
        // Use the first SVG file found
        let (svg_name, svg_bytes) = &svg_files[0];
        let base_name = svg_name
            .rsplit('/')
            .next()
            .unwrap_or(svg_name.as_str())
            .to_string();
        match parse_svg_from_bytes(svg_bytes, &base_name) {
            Ok((display_name, width, height, elements)) => {
                let element_count = elements.len();
                return Ok(DcsImportResult {
                    display_name,
                    width,
                    height,
                    element_count,
                    elements,
                    unresolved_symbols: vec![],
                    platform: effective_platform.to_string(),
                    tags,
                    manifest_platform,
                    import_warnings,
                });
            }
            Err(e) => {
                return Err(IoError::BadRequest(format!("SVG parse error: {}", e)));
            }
        }
    }

    // For kit-required platforms with no parseable content, return stub with metadata
    let _ = file_name; // suppress unused warning
    let mut result = stub_result(effective_platform);
    result.tags = tags;
    result.manifest_platform = manifest_platform;
    result.import_warnings = import_warnings;
    Ok(result)
}

fn parse_from_intermediate_json(bytes: &[u8], platform: &str) -> IoResult<DcsImportResult> {
    let (intermediate, unresolved_symbols) =
        parse_intermediate_json(bytes).map_err(IoError::BadRequest)?;

    let display = intermediate.display.as_ref();
    let display_name = display
        .and_then(|d| d.name.as_deref())
        .unwrap_or("Imported Display")
        .to_string();
    let width = display.and_then(|d| d.width).unwrap_or(1920);
    let height = display.and_then(|d| d.height).unwrap_or(1080);

    let elements: Vec<DcsElement> = intermediate
        .elements
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, el)| intermediate_elem_to_dcs(el, i))
        .collect();

    let element_count = elements.len();

    Ok(DcsImportResult {
        display_name,
        width,
        height,
        element_count,
        elements,
        unresolved_symbols,
        platform: platform.to_string(),
        tags: vec![],
        manifest_platform: None,
        import_warnings: vec![],
    })
}
