/// GE iFIX / Proficy SVG parser
///
/// Input: ZIP contents collected by `parse_zip()`.
///   - Primary graphic: first `.svg` file found in the ZIP.
///   - Optional sidecar: a `.xtg` file alongside the SVG; when present its
///     `<TagGroup>` / `<Tag>` XML structure is used to enrich tag bindings.
///   - `data-*` attributes on SVG elements are the primary source of tag
///     and symbol metadata (GE iFIX extraction kit convention).
///
/// Output: `Vec<DcsElement>` using the shared intermediate representation
/// defined in `dcs_import`.
use serde_json::{json, Value};

use super::dcs_import::DcsElement;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Parse a GE iFIX ZIP kit.
///
/// `zip_contents` is a pre-collected map from lowercase base-name → raw bytes,
/// populated by the ZIP scan in `parse_zip()`.  Only two keys are consumed:
///   - the first value whose key ends with `.svg`
///   - the first value whose key ends with `.xtg`
pub fn parse(zip_contents: &ZipContents) -> Result<Vec<DcsElement>, String> {
    // --- SVG payload ---
    let (svg_name, svg_bytes) = zip_contents
        .svgs
        .first()
        .ok_or_else(|| "GE iFIX ZIP contains no SVG file".to_string())?;

    // --- Optional .xtg sidecar (tag-group XML) ---
    let xtg_tags = zip_contents
        .xtg
        .as_deref()
        .map(parse_xtg_tags)
        .unwrap_or_default();

    parse_ge_svg(svg_bytes, svg_name, &xtg_tags)
}

// ---------------------------------------------------------------------------
// .xtg tag-group parser
// ---------------------------------------------------------------------------

/// Parse a GE iFIX `.xtg` XML sidecar.
///
/// The file structure (simplified) looks like:
/// ```xml
/// <TagGroups>
///   <TagGroup Name="Reactors">
///     <Tag Name="TIC-101" />
///     <Tag Name="FIC-201" />
///   </TagGroup>
/// </TagGroups>
/// ```
/// We collect every `Name` attribute from `<Tag>` elements.
fn parse_xtg_tags(xtg_bytes: &[u8]) -> Vec<String> {
    let content = match std::str::from_utf8(xtg_bytes) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let doc = match roxmltree::Document::parse(content) {
        Ok(d) => d,
        Err(_) => return vec![],
    };
    doc.descendants()
        .filter(|n| n.is_element() && n.tag_name().name().eq_ignore_ascii_case("Tag"))
        .filter_map(|n| n.attribute("Name").map(|s| s.to_string()))
        .collect()
}

// ---------------------------------------------------------------------------
// SVG parser
// ---------------------------------------------------------------------------

fn parse_ge_svg(
    svg_bytes: &[u8],
    source_name: &str,
    _xtg_tags: &[String],
) -> Result<Vec<DcsElement>, String> {
    let content =
        std::str::from_utf8(svg_bytes).map_err(|_| "GE iFIX SVG is not valid UTF-8".to_string())?;

    let doc = roxmltree::Document::parse(content)
        .map_err(|e| format!("GE iFIX SVG parse error: {}", e))?;

    let root = doc.root_element();
    let _ = source_name; // used by caller for display_name; not needed here
    Ok(extract_ge_elements(root, 0))
}

fn extract_ge_elements(node: roxmltree::Node, depth: usize) -> Vec<DcsElement> {
    if depth > 10 {
        return vec![];
    }
    let mut result = Vec::new();

    for child in node.children() {
        if !child.is_element() {
            continue;
        }
        let svg_tag = child.tag_name().name();
        if matches!(
            svg_tag,
            "defs" | "style" | "script" | "metadata" | "title" | "desc"
        ) {
            continue;
        }

        // GE iFIX uses data-tag, data-symbol, data-type, data-class on elements.
        let data_tag = child.attribute("data-tag").map(|s| s.to_string());
        let data_symbol = child.attribute("data-symbol").map(|s| s.to_string());
        let data_type = child.attribute("data-type").map(|s| s.to_string());
        let data_class = child.attribute("data-class").map(|s| s.to_string());

        // Recurse into plain <g> groups unless they carry DCS metadata.
        if svg_tag == "g"
            && data_symbol.is_none()
            && data_type.is_none()
            && data_class.is_none()
            && data_tag.is_none()
        {
            result.extend(extract_ge_elements(child, depth + 1));
            continue;
        }

        let id = child.attribute("id").unwrap_or("").to_string();

        let element_type = derive_ge_element_type(svg_tag, &data_tag, &data_type);

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

        // Symbol class: prefer data-symbol, fall back to data-class.
        let symbol_class = data_symbol
            .as_deref()
            .or(data_class.as_deref())
            .map(|s| s.to_uppercase());

        // Label: text content for text elements.
        let label = if matches!(svg_tag, "text" | "tspan") {
            child.text().map(|t| t.trim().to_string())
        } else {
            data_tag.clone()
        };

        // display_element_hint from data-type.
        let display_element_hint = data_type.as_deref().map(ge_type_to_hint);

        let mut props = serde_json::Map::new();
        props.insert("placement_source".to_string(), json!("ge_ifx_import"));
        props.insert("svg_tag".to_string(), json!(svg_tag));
        if let Some(dt) = &data_type {
            props.insert("ge_data_type".to_string(), json!(dt));
        }

        result.push(DcsElement {
            id: if id.is_empty() {
                format!("ge-elem-{}", result.len() + 1)
            } else {
                id
            },
            element_type,
            x,
            y,
            width,
            height,
            symbol_class,
            tag: data_tag,
            label,
            display_element_hint,
            properties: Value::Object(props),
        });
    }
    result
}

fn derive_ge_element_type(
    svg_tag: &str,
    data_tag: &Option<String>,
    data_type: &Option<String>,
) -> String {
    // data-type takes precedence when it maps to a known I/O type.
    if let Some(dt) = data_type.as_deref() {
        match dt.to_lowercase().as_str() {
            "bartrend" | "bar" => return "bar_graph".to_string(),
            "trend" => return "instrument".to_string(),
            "text" | "datalink" => {
                return if data_tag.is_some() {
                    "dynamic_text".to_string()
                } else {
                    "instrument".to_string()
                }
            }
            "symbol" | "group" => return "equipment".to_string(),
            _ => {}
        }
    }
    // Fall back to SVG element type heuristics.
    match svg_tag {
        "text" | "tspan" => {
            if data_tag.is_some() {
                "dynamic_text".to_string()
            } else {
                "instrument".to_string()
            }
        }
        "g" => "equipment".to_string(),
        "circle" | "ellipse" => "equipment".to_string(),
        "rect" | "polygon" | "polyline" | "line" | "path" => "pipe".to_string(),
        _ => "instrument".to_string(),
    }
}

fn ge_type_to_hint(data_type: &str) -> String {
    match data_type.to_lowercase().as_str() {
        "bartrend" | "bar" => "bar_graph",
        "trend" => "trend_chart",
        "datalink" => "value_display",
        "symbol" | "group" => "equipment_symbol",
        "alarm" => "alarm_indicator",
        _ => "generic",
    }
    .to_string()
}

// ---------------------------------------------------------------------------
// ZIP contents helper (shared by all three platform parsers)
// ---------------------------------------------------------------------------

/// Pre-collected contents from a DCS ZIP file.
/// Populated by a single pass over the archive in `parse_zip()`.
pub struct ZipContents {
    /// All SVG files: (original name, bytes).
    pub svgs: Vec<(String, Vec<u8>)>,
    /// First `.xtg` sidecar bytes (GE iFIX only).
    pub xtg: Option<Vec<u8>>,
    /// First `.xml` file bytes whose root is `<gfx>` (Rockwell).
    pub gfx_xml: Option<Vec<u8>>,
}
