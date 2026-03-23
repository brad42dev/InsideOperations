/// Siemens WinCC Unified SVG parser
///
/// Input: ZIP contents collected by `parse_zip()`.
///   - Primary graphic: first `.svg` file in the ZIP.
///   - Elements carry `siemens:*` namespace attributes for tag bindings and
///     object type metadata.
///
/// Relevant Siemens namespace attributes (WinCC Unified export convention):
///   - `siemens:tagName`      — primary process tag binding
///   - `siemens:objectType`   — object classification (e.g. "AnalogIndicator")
///   - `siemens:faceplateType`— faceplate variant
///
/// The parser:
///   1. Parses SVG geometry using the same heuristics as the generic SVG path.
///   2. Scans every element for `siemens:*` attributes and enriches the
///      resulting `DcsElement` with tag bindings and type hints.
///   3. Strips the `siemens:` namespace prefix from the attribute names when
///      storing them in the `properties` bag so callers see plain names.
///
/// Output: `Vec<DcsElement>` using the shared intermediate representation.

use serde_json::{json, Value};

use super::dcs_import::DcsElement;
use super::dcs_ge::ZipContents;

// Siemens namespace URI as it appears in WinCC Unified SVG exports.
const SIEMENS_NS: &str = "siemens";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub fn parse(zip_contents: &ZipContents) -> Result<Vec<DcsElement>, String> {
    let (svg_name, svg_bytes) = zip_contents
        .svgs
        .first()
        .ok_or_else(|| "Siemens WinCC ZIP contains no SVG file".to_string())?;

    parse_siemens_svg(svg_bytes, svg_name)
}

// ---------------------------------------------------------------------------
// SVG parser
// ---------------------------------------------------------------------------

fn parse_siemens_svg(svg_bytes: &[u8], _source_name: &str) -> Result<Vec<DcsElement>, String> {
    let content = std::str::from_utf8(svg_bytes)
        .map_err(|_| "Siemens WinCC SVG is not valid UTF-8".to_string())?;

    let doc = roxmltree::Document::parse(content)
        .map_err(|e| format!("Siemens WinCC SVG parse error: {}", e))?;

    let root = doc.root_element();
    Ok(extract_siemens_elements(root, 0))
}

fn extract_siemens_elements(node: roxmltree::Node, depth: usize) -> Vec<DcsElement> {
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

        // Collect all siemens:* namespace attributes.
        let siemens_attrs = collect_siemens_attrs(child);

        // Extract primary tag from siemens:tagName (or siemens:tag).
        let tag = siemens_attrs
            .get("tagName")
            .or_else(|| siemens_attrs.get("tag"))
            .cloned();

        // Siemens object type for element classification.
        let object_type = siemens_attrs.get("objectType").cloned();

        // Recurse into plain <g> groups that carry no Siemens metadata.
        if svg_tag == "g" && siemens_attrs.is_empty() {
            result.extend(extract_siemens_elements(child, depth + 1));
            continue;
        }

        let id = child.attribute("id").unwrap_or("").to_string();

        let element_type = derive_siemens_element_type(svg_tag, &tag, &object_type);

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

        let symbol_class = object_type
            .as_deref()
            .map(siemens_type_to_symbol_class);

        let label = if matches!(svg_tag, "text" | "tspan") {
            child.text().map(|t| t.trim().to_string())
        } else {
            tag.clone()
        };

        let display_element_hint = object_type.as_deref().map(siemens_type_to_hint);

        let mut props = serde_json::Map::new();
        props.insert(
            "placement_source".to_string(),
            json!("siemens_wincc_import"),
        );
        props.insert("svg_tag".to_string(), json!(svg_tag));
        // Store all siemens:* attributes with prefix stripped.
        for (k, v) in &siemens_attrs {
            props.insert(k.clone(), json!(v));
        }

        result.push(DcsElement {
            id: if id.is_empty() {
                format!("siemens-elem-{}", result.len() + 1)
            } else {
                id
            },
            element_type,
            x,
            y,
            width,
            height,
            symbol_class,
            tag,
            label,
            display_element_hint,
            properties: Value::Object(props),
        });
    }
    result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Collect all attributes in the `siemens:` namespace, returning a map of
/// local-name → value with the namespace prefix stripped.
fn collect_siemens_attrs(node: roxmltree::Node) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for attr in node.attributes() {
        // roxmltree exposes namespace via `attr.namespace()` and local name
        // via `attr.name()` (which may already include the prefix in some
        // parsers).  We check both.
        let ns_match = attr
            .namespace()
            .map(|ns| ns.contains(SIEMENS_NS))
            .unwrap_or(false);
        let name_match = attr.name().starts_with(&format!("{}:", SIEMENS_NS));

        if ns_match || name_match {
            // Strip the "siemens:" prefix if present in the local name.
            let local = if attr.name().starts_with(&format!("{}:", SIEMENS_NS)) {
                attr.name()[SIEMENS_NS.len() + 1..].to_string()
            } else {
                attr.name().to_string()
            };
            map.insert(local, attr.value().to_string());
        }
    }
    map
}

fn derive_siemens_element_type(
    svg_tag: &str,
    tag: &Option<String>,
    object_type: &Option<String>,
) -> String {
    // Object type classification takes highest priority.
    if let Some(ot) = object_type.as_deref() {
        match ot {
            "AnalogIndicator" | "AnalogDisplay" | "NumericDisplay" => {
                return "dynamic_text".to_string()
            }
            "BarGraph" | "LevelGauge" => return "bar_graph".to_string(),
            "DiscreteIndicator" | "StatusDisplay" | "MultiStateDisplay" => {
                return "status_text".to_string()
            }
            "TrendView" | "TrendChart" => return "instrument".to_string(),
            "ValveSymbol" | "ControlValve" => return "valve".to_string(),
            "MotorSymbol" | "PumpSymbol" => return "equipment".to_string(),
            "Pipe" | "ProcessLine" => return "pipe".to_string(),
            _ => {}
        }
    }
    // Fall back to SVG heuristics.
    match svg_tag {
        "text" | "tspan" => {
            if tag.is_some() {
                "dynamic_text".to_string()
            } else {
                "instrument".to_string()
            }
        }
        "g" => "equipment".to_string(),
        "circle" | "ellipse" => "equipment".to_string(),
        "line" | "path" | "rect" | "polygon" | "polyline" => "pipe".to_string(),
        _ => "instrument".to_string(),
    }
}

fn siemens_type_to_symbol_class(object_type: &str) -> String {
    match object_type {
        "ValveSymbol" | "ControlValve" | "GateValve" | "ButterflyValve" => "VALVE_GATE",
        "MotorSymbol" | "PumpSymbol" => "PUMP",
        "PIDController" | "ControllerFaceplate" => "CONTROLLER_PID",
        "AnalogIndicator" | "AnalogDisplay" | "NumericDisplay" | "DiscreteIndicator" => {
            "INSTRUMENT"
        }
        "HeatExchanger" => "HEAT_EXCHANGER",
        "Vessel" | "Tank" | "LevelGauge" => "VESSEL",
        "Compressor" => "COMPRESSOR",
        _ => "GENERIC",
    }
    .to_string()
}

fn siemens_type_to_hint(object_type: &str) -> String {
    match object_type {
        "AnalogIndicator" | "AnalogDisplay" | "NumericDisplay" => "value_display",
        "BarGraph" | "LevelGauge" => "bar_graph",
        "DiscreteIndicator" | "StatusDisplay" | "MultiStateDisplay" => "status_indicator",
        "TrendView" | "TrendChart" => "trend_chart",
        "ValveSymbol" | "ControlValve" | "GateValve" | "ButterflyValve" => "equipment_symbol",
        "MotorSymbol" | "PumpSymbol" => "equipment_symbol",
        "Pipe" | "ProcessLine" => "pipe",
        _ => "generic",
    }
    .to_string()
}
