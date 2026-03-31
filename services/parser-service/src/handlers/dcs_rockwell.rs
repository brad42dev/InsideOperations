/// Rockwell FactoryTalk View XML parser
///
/// Input: ZIP contents collected by `parse_zip()`.
///   - Primary graphic: first XML file in the ZIP whose root element is `<gfx>`.
///
/// FactoryTalk View XML structure (simplified):
/// ```xml
/// <gfx width="1920" height="1080" name="Main_Display">
///   <AnalogDisplay id="elem1" x="100" y="200" width="80" height="40"
///                  tagname="PIC-101.PV" />
///   <DiscreteDisplay id="elem2" x="300" y="400" width="60" height="60"
///                    tagname="HS-201.Status" />
///   <Line id="elem3" x="0" y="0" x2="200" y2="0" />
/// </gfx>
/// ```
///
/// Output: `Vec<DcsElement>` using the shared intermediate representation.
use serde_json::{json, Value};

use super::dcs_ge::ZipContents;
use super::dcs_import::DcsElement;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub fn parse(zip_contents: &ZipContents) -> Result<Vec<DcsElement>, String> {
    let xml_bytes = zip_contents
        .gfx_xml
        .as_deref()
        .ok_or_else(|| "Rockwell ZIP contains no FactoryTalk XML (<gfx>) file".to_string())?;
    parse_factorytalk_xml(xml_bytes)
}

// ---------------------------------------------------------------------------
// XML parser
// ---------------------------------------------------------------------------

fn parse_factorytalk_xml(xml_bytes: &[u8]) -> Result<Vec<DcsElement>, String> {
    let content = std::str::from_utf8(xml_bytes)
        .map_err(|_| "FactoryTalk XML is not valid UTF-8".to_string())?;

    let doc = roxmltree::Document::parse(content)
        .map_err(|e| format!("FactoryTalk XML parse error: {}", e))?;

    let root = doc.root_element();
    if root.tag_name().name() != "gfx" {
        return Err(format!(
            "Expected root element <gfx>, found <{}>",
            root.tag_name().name()
        ));
    }

    let mut elements = Vec::new();
    for (idx, child) in root.children().filter(|n| n.is_element()).enumerate() {
        if let Some(elem) = map_ft_element(child, idx) {
            elements.push(elem);
        }
    }
    Ok(elements)
}

// ---------------------------------------------------------------------------
// FactoryTalk element → DcsElement mapping
// ---------------------------------------------------------------------------

fn map_ft_element(node: roxmltree::Node, idx: usize) -> Option<DcsElement> {
    let ft_type = node.tag_name().name();

    // Skip container / non-visual elements.
    if matches!(ft_type, "Animations" | "Events" | "Script" | "Style") {
        return None;
    }

    let id = node
        .attribute("id")
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("ft-elem-{:03}", idx + 1));

    let x: f64 = node
        .attribute("x")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);
    let y: f64 = node
        .attribute("y")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);
    let width: f64 = node
        .attribute("width")
        .and_then(|v| v.parse().ok())
        .unwrap_or(60.0);
    let height: f64 = node
        .attribute("height")
        .and_then(|v| v.parse().ok())
        .unwrap_or(60.0);

    // Tag binding: `tagname` attribute (FactoryTalk convention).
    let tag = node
        .attribute("tagname")
        .or_else(|| node.attribute("TagName"))
        .map(|s| s.to_string());

    // source_type used for symbol_class derivation.
    let (element_type, source_type, display_element_hint) = classify_ft_type(ft_type, &tag);

    let symbol_class = source_type.as_deref().map(ft_source_to_symbol_class);

    let label = node
        .attribute("caption")
        .or_else(|| node.attribute("text"))
        .or_else(|| node.attribute("label"))
        .map(|s| s.to_string())
        .or_else(|| tag.clone());

    let mut props = serde_json::Map::new();
    props.insert("placement_source".to_string(), json!("rockwell_ft_import"));
    props.insert("ft_type".to_string(), json!(ft_type));
    if let Some(st) = &source_type {
        props.insert("source_type".to_string(), json!(st));
    }

    Some(DcsElement {
        id,
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
    })
}

/// Map a FactoryTalk element type to (element_type, source_type, display_element_hint).
fn classify_ft_type(
    ft_type: &str,
    tag: &Option<String>,
) -> (String, Option<String>, Option<String>) {
    match ft_type {
        // Numeric / analog displays
        "AnalogDisplay" | "NumericDisplay" | "NumericInput" => (
            "dynamic_text".to_string(),
            Some("instrument".to_string()),
            Some("value_display".to_string()),
        ),
        // Bar / level indicators
        "BarGraph" | "LevelIndicator" | "TankLevel" => (
            "bar_graph".to_string(),
            Some("instrument".to_string()),
            Some("bar_graph".to_string()),
        ),
        // Discrete / status displays
        "DiscreteDisplay" | "MultiStateDisplay" | "MultiStateIndicator" => (
            "status_text".to_string(),
            Some("indicator".to_string()),
            Some("status_indicator".to_string()),
        ),
        // Trend charts
        "TrendChart" | "PenDisplay" => (
            "instrument".to_string(),
            Some("instrument".to_string()),
            Some("trend_chart".to_string()),
        ),
        // Valve symbols
        "ValveSymbol" | "GateValve" | "ButterflyValve" | "ControlValve" => (
            "valve".to_string(),
            Some("valve_control".to_string()),
            Some("equipment_symbol".to_string()),
        ),
        // Motor / pump symbols
        "MotorSymbol" | "PumpSymbol" => (
            "equipment".to_string(),
            Some("pump".to_string()),
            Some("equipment_symbol".to_string()),
        ),
        // PID / controller faceplate
        "Faceplate" | "PIDFaceplate" => (
            "equipment".to_string(),
            Some("controller_pid".to_string()),
            Some("faceplate".to_string()),
        ),
        // Static shapes
        "Line" | "Polyline" | "Pipe" | "PipeLine" => {
            ("pipe".to_string(), None, Some("pipe".to_string()))
        }
        "Rectangle" | "Ellipse" | "Polygon" | "FilledShape" => ("pipe".to_string(), None, None),
        // Text
        "Text" | "Label" | "Caption" => {
            let et = if tag.is_some() {
                "dynamic_text"
            } else {
                "instrument"
            };
            (et.to_string(), None, None)
        }
        // Button / pushbutton
        "PushButton" | "MomentaryPushButton" => (
            "instrument".to_string(),
            Some("indicator".to_string()),
            Some("button".to_string()),
        ),
        // Generic / unknown
        _ => ("instrument".to_string(), None, None),
    }
}

fn ft_source_to_symbol_class(source_type: &str) -> String {
    match source_type {
        "valve_control" | "valve_gate" | "valve_butterfly" => "VALVE_GATE",
        "pump" => "PUMP",
        "controller_pid" | "pid" => "CONTROLLER_PID",
        "instrument" | "indicator" => "INSTRUMENT",
        "heat_exchanger" => "HEAT_EXCHANGER",
        "vessel" | "tank" => "VESSEL",
        "compressor" => "COMPRESSOR",
        _ => "GENERIC",
    }
    .to_string()
}
