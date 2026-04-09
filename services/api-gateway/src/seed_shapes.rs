// ---------------------------------------------------------------------------
// Shape Library Seed — inserts built-in DCS equipment shapes from doc 35
// All shapes are FROZEN pixel-locked specifications. Do not modify SVG data.
// ---------------------------------------------------------------------------

use tracing::{info, warn};

struct ShapeSeed {
    shape_id: &'static str,
    display_name: &'static str,
    category: &'static str,
    variant: &'static str,
    shape_type: &'static str, // 'shape' or 'shape_part'
    svg_data: &'static str,
    view_box: &'static str,
    sidecar: &'static str, // JSON string — full sidecar for batch response
}

pub async fn seed_shape_library(db: &io_db::DbPool) {
    let shapes = shape_seeds();
    let mut inserted = 0u32;
    let mut skipped = 0u32;

    for s in &shapes {
        let sidecar_value: serde_json::Value =
            serde_json::from_str(s.sidecar).unwrap_or(serde_json::json!({}));
        let metadata = serde_json::json!({
            "shape_id": s.shape_id,
            "source": "library",
            "display_name": s.display_name,
            "category": s.category,
            "variant": s.variant,
            "view_box": s.view_box,
            "schema": "io-shape-v1",
            "sidecar": sidecar_value
        });

        let result: Result<sqlx::postgres::PgQueryResult, _> = sqlx::query(
            "INSERT INTO design_objects (id, name, type, svg_data, metadata, created_at, updated_at) \
             SELECT gen_random_uuid(), $1, $2, $3, $4::jsonb, NOW(), NOW() \
             WHERE NOT EXISTS ( \
                 SELECT 1 FROM design_objects \
                 WHERE type = $2 \
                   AND metadata->>'shape_id' = $5 \
                   AND metadata->>'source' = 'library' \
             )",
        )
        .bind(s.display_name)
        .bind(s.shape_type)
        .bind(s.svg_data)
        .bind(metadata.to_string())
        .bind(s.shape_id)
        .execute(db)
        .await;

        match result {
            Ok(r) if r.rows_affected() > 0 => inserted += 1,
            Ok(_) => skipped += 1,
            Err(e) => warn!(shape_id = %s.shape_id, error = %e, "Failed to seed shape"),
        }
    }

    info!(
        inserted,
        skipped,
        total = shapes.len(),
        "Shape library seed complete"
    );
}

fn shape_seeds() -> Vec<ShapeSeed> {
    vec![
        // ---------------------------------------------------------------
        // VALVES
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "valve-gate",
            display_name: "Gate Valve",
            category: "valve",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 24",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"
     data-io-shape="valve-gate" data-io-version="3.0">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"valve-gate","version":"1.0","display_name":"Gate Valve","category":"valves","subcategory":"gate","tags":["valve","gate","isolation"],"recognition_class":"valve_gate","variants":{"options":{"opt1":{"file":"valve-gate.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 24","width":48,"height":24},"connections":[{"id":"inlet","type":"process","x":0,"y":12,"direction":"left"},{"id":"outlet","type":"process","x":48,"y":12,"direction":"right"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.4,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"actuator-diaphragm","file":"part-actuator-diaphragm.svg","label":"Pneumatic (Diaphragm)","group":"actuator","exclusive":true},{"id":"actuator-motor","file":"part-actuator-motor.svg","label":"Motorized (Electric)","group":"actuator","exclusive":true},{"id":"actuator-solenoid","file":"part-actuator-solenoid.svg","label":"Solenoid","group":"actuator","exclusive":true},{"id":"fail-open","file":"part-fail-open.svg","label":"Fail Open (FO)","group":"fail-indicator","exclusive":true},{"id":"fail-closed","file":"part-fail-closed.svg","label":"Fail Closed (FC)","group":"fail-indicator","exclusive":true},{"id":"fail-last","file":"part-fail-last.svg","label":"Fail Last (FL)","group":"fail-indicator","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","DigitalStatus":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Valve Body","category":"equipment"},{"partId":"actuator-diaphragm","label":"Pneumatic Actuator","category":"actuator"},{"partId":"actuator-motor","label":"Motorized Actuator","category":"actuator"},{"partId":"actuator-solenoid","label":"Solenoid Actuator","category":"actuator"}]}"#,
        },
        ShapeSeed {
            shape_id: "valve-globe",
            display_name: "Globe Valve",
            category: "valve",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 24",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"
     data-io-shape="valve-globe" data-io-version="3.0">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <circle cx="24" cy="12" r="3.5" fill="#808080" stroke="none"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"valve-globe","version":"1.0","display_name":"Globe Valve","category":"valves","subcategory":"globe","tags":["valve","globe","throttling"],"recognition_class":"valve_globe","variants":{"options":{"opt1":{"file":"valve-globe.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 24","width":48,"height":24},"connections":[{"id":"inlet","type":"process","x":0,"y":12,"direction":"left"},{"id":"outlet","type":"process","x":48,"y":12,"direction":"right"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.4,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"actuator-diaphragm","file":"part-actuator-diaphragm.svg","label":"Pneumatic (Diaphragm)","group":"actuator","exclusive":true},{"id":"actuator-motor","file":"part-actuator-motor.svg","label":"Motorized (Electric)","group":"actuator","exclusive":true},{"id":"actuator-solenoid","file":"part-actuator-solenoid.svg","label":"Solenoid","group":"actuator","exclusive":true},{"id":"fail-open","file":"part-fail-open.svg","label":"Fail Open (FO)","group":"fail-indicator","exclusive":true},{"id":"fail-closed","file":"part-fail-closed.svg","label":"Fail Closed (FC)","group":"fail-indicator","exclusive":true},{"id":"fail-last","file":"part-fail-last.svg","label":"Fail Last (FL)","group":"fail-indicator","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","DigitalStatus":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Valve Body","category":"equipment"},{"partId":"actuator-diaphragm","label":"Pneumatic Actuator","category":"actuator"},{"partId":"actuator-motor","label":"Motorized Actuator","category":"actuator"},{"partId":"actuator-solenoid","label":"Solenoid Actuator","category":"actuator"}]}"#,
        },
        ShapeSeed {
            shape_id: "valve-ball",
            display_name: "Ball Valve",
            category: "valve",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 24",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"
     data-io-shape="valve-ball" data-io-version="3.0">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 18.6,9.3 L 0,0 L 0,24 L 18.6,14.7"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M 29.4,9.3 L 48,0 L 48,24 L 29.4,14.7"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <circle cx="24" cy="12" r="6"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"valve-ball","version":"1.0","display_name":"Ball Valve","category":"valves","subcategory":"ball","tags":["valve","ball","isolation","on-off"],"recognition_class":"valve_ball","variants":{"options":{"opt1":{"file":"valve-ball.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 24","width":48,"height":24},"connections":[{"id":"inlet","type":"process","x":0,"y":12,"direction":"left"},{"id":"outlet","type":"process","x":48,"y":12,"direction":"right"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.4,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"actuator-diaphragm","file":"part-actuator-diaphragm.svg","label":"Pneumatic (Diaphragm)","group":"actuator","exclusive":true},{"id":"actuator-motor","file":"part-actuator-motor.svg","label":"Motorized (Electric)","group":"actuator","exclusive":true},{"id":"actuator-solenoid","file":"part-actuator-solenoid.svg","label":"Solenoid","group":"actuator","exclusive":true},{"id":"fail-open","file":"part-fail-open.svg","label":"Fail Open (FO)","group":"fail-indicator","exclusive":true},{"id":"fail-closed","file":"part-fail-closed.svg","label":"Fail Closed (FC)","group":"fail-indicator","exclusive":true},{"id":"fail-last","file":"part-fail-last.svg","label":"Fail Last (FL)","group":"fail-indicator","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","DigitalStatus":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Valve Body","category":"equipment"},{"partId":"actuator-diaphragm","label":"Pneumatic Actuator","category":"actuator"},{"partId":"actuator-motor","label":"Motorized Actuator","category":"actuator"},{"partId":"actuator-solenoid","label":"Solenoid Actuator","category":"actuator"}]}"#,
        },
        ShapeSeed {
            shape_id: "valve-butterfly",
            display_name: "Butterfly Valve",
            category: "valve",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 60 24",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 24"
     data-io-shape="valve-butterfly" data-io-version="3.2">
  <g class="io-shape-body">
    <line x1="7" y1="0" x2="7" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="53" y1="0" x2="53" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line class="io-stateful" x1="10" y1="4" x2="50" y2="20"
          stroke="#808080" stroke-width="2"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"valve-butterfly","version":"1.0","display_name":"Butterfly Valve","category":"valves","subcategory":"butterfly","tags":["valve","butterfly","isolation","throttling"],"recognition_class":"valve_butterfly","variants":{"options":{"opt1":{"file":"valve-butterfly.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 60 24","width":60,"height":24},"connections":[{"id":"inlet","type":"process","x":0,"y":12,"direction":"left"},{"id":"outlet","type":"process","x":60,"y":12,"direction":"right"}],"textZones":[{"id":"tagname","x":30,"y":-6,"width":60,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.4,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.05,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"actuator-diaphragm","file":"part-actuator-diaphragm.svg","label":"Pneumatic (Diaphragm)","group":"actuator","exclusive":true},{"id":"actuator-motor","file":"part-actuator-motor.svg","label":"Motorized (Electric)","group":"actuator","exclusive":true},{"id":"actuator-solenoid","file":"part-actuator-solenoid.svg","label":"Solenoid","group":"actuator","exclusive":true},{"id":"fail-open","file":"part-fail-open.svg","label":"Fail Open (FO)","group":"fail-indicator","exclusive":true},{"id":"fail-closed","file":"part-fail-closed.svg","label":"Fail Closed (FC)","group":"fail-indicator","exclusive":true},{"id":"fail-last","file":"part-fail-last.svg","label":"Fail Last (FL)","group":"fail-indicator","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","DigitalStatus":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Valve Body","category":"equipment"},{"partId":"actuator-diaphragm","label":"Pneumatic Actuator","category":"actuator"},{"partId":"actuator-motor","label":"Motorized Actuator","category":"actuator"},{"partId":"actuator-solenoid","label":"Solenoid Actuator","category":"actuator"}]}"#,
        },
        ShapeSeed {
            shape_id: "valve-control",
            display_name: "Control Valve",
            category: "valve",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 44",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 44"
     data-io-shape="valve-control" data-io-version="3.0">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,20 24,32 0,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,20 24,32 48,44"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="32" x2="24" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <path d="M 14,12 A 10,10 0 0,1 34,12 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"valve-control","version":"1.0","display_name":"Control Valve","category":"valves","subcategory":"control","tags":["valve","control","modulating","throttling"],"recognition_class":"valve_control","variants":{"options":{"opt1":{"file":"valve-control.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 44","width":48,"height":44},"connections":[{"id":"inlet","type":"process","x":0,"y":32,"direction":"left"},{"id":"outlet","type":"process","x":48,"y":32,"direction":"right"},{"id":"actuator","type":"signal","x":24,"y":0,"direction":"top"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"},{"nx":0.5,"ny":1.3,"preferredElement":"sparkline"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"fail-open","file":"part-fail-open.svg","label":"Fail Open (FO)","group":"fail-indicator","exclusive":true},{"id":"fail-closed","file":"part-fail-closed.svg","label":"Fail Closed (FC)","group":"fail-indicator","exclusive":true},{"id":"fail-last","file":"part-fail-last.svg","label":"Fail Last (FL)","group":"fail-indicator","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Valve Body","category":"equipment"},{"partId":"actuator","label":"Actuator","category":"actuator"}]}"#,
        },
        ShapeSeed {
            shape_id: "valve-relief",
            display_name: "Relief / Safety Valve",
            category: "valve",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 62",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 62"
     data-io-shape="valve-relief" data-io-version="3.0">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="8,56 20,38 32,56"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="20,38 42,28 42,48"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="20" y1="38" x2="20" y2="5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="14" y1="11" x2="26" y2="7"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="8" y1="22" x2="32" y2="14"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="2" y1="33" x2="38" y2="21"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"valve-relief","version":"1.0","display_name":"Relief / Safety Valve","category":"valves","subcategory":"relief","tags":["valve","relief","safety","PSV","PRV"],"recognition_class":"valve_relief","variants":{"options":{"opt1":{"file":"valve-relief.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 62","width":48,"height":62},"connections":[{"id":"inlet","type":"process","x":20,"y":62,"direction":"bottom"},{"id":"outlet","type":"process","x":42,"y":38,"direction":"right"},{"id":"stem-top","type":"mechanical","x":20,"y":0,"direction":"top"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Valve Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // PUMPS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "pump-centrifugal",
            display_name: "Centrifugal Pump",
            category: "pump",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 48",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"
     data-io-shape="pump-centrifugal" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="24" cy="24" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="24" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="4" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="44" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"pump-centrifugal","version":"1.0","display_name":"Centrifugal Pump","category":"pumps","subcategory":"centrifugal","tags":["pump","centrifugal","rotating"],"recognition_class":"pump_centrifugal","variants":{"options":{"opt1":{"file":"pump-centrifugal-opt1.svg","label":"ISA Standard"},"opt2":{"file":"pump-centrifugal-opt2.svg","label":"Graphical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 48","width":48,"height":48},"connections":[{"id":"suction","type":"process","x":4,"y":24,"direction":"left"},{"id":"discharge","type":"process","x":44,"y":24,"direction":"right"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "pump-positive-displacement-opt1",
            display_name: "PD Pump (ISA)",
            category: "pump",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 48 48",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"
     data-io-shape="pump-positive-displacement" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="24" cy="24" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="4" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="24" y1="44" x2="44" y2="24"
          stroke="#808080" stroke-width="1.5"/>
    <rect x="19" y="19" width="10" height="10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"pump-positive-displacement","version":"1.0","display_name":"Positive Displacement Pump","category":"pumps","subcategory":"positive-displacement","tags":["pump","positive-displacement","PD","reciprocating","rotating"],"recognition_class":"pump_positive_displacement","variants":{"options":{"opt1":{"file":"pump-positive-displacement-opt1.svg","label":"ISA Standard"},"opt2":{"file":"pump-positive-displacement-opt2.svg","label":"Graphical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 48 48","width":48,"height":48},"connections":[{"id":"suction","type":"process","x":4,"y":24,"direction":"left"},{"id":"discharge","type":"process","x":44,"y":24,"direction":"right"}],"textZones":[{"id":"tagname","x":24,"y":-6,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "pump-positive-displacement-opt2",
            display_name: "PD Pump (Graphical)",
            category: "pump",
            variant: "opt2",
            shape_type: "shape",
            view_box: "0 0 50 48",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 48"
     data-io-shape="pump-positive-displacement" data-io-version="1.0"
     data-io-variant="opt2">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 14.3,37.9 L 8,43.5 L 40,43.5 L 33.7,37.9"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M 24,1.5 L 48,1.5 L 48,9 L 39.4,9"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <circle class="io-stateful" cx="24" cy="21" r="19.5"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <rect x="19" y="16" width="10" height="10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"pump-positive-displacement","version":"1.0","display_name":"Positive Displacement Pump","category":"pumps","subcategory":"positive-displacement","tags":["pump","positive-displacement","PD","reciprocating","rotating"],"recognition_class":"pump_positive_displacement","variants":{"options":{"opt1":{"file":"pump-positive-displacement-opt1.svg","label":"ISA Standard"},"opt2":{"file":"pump-positive-displacement-opt2.svg","label":"Graphical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 48","width":50,"height":48},"connections":[{"id":"suction","type":"process","x":4,"y":21,"direction":"left"},{"id":"discharge","type":"process","x":48,"y":5,"direction":"right"}],"textZones":[{"id":"tagname","x":25,"y":-6,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // COMPRESSOR
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "compressor",
            display_name: "Compressor",
            category: "rotating",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 50 50",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"
     data-io-shape="compressor" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"compressor","version":"1.0","display_name":"Compressor","category":"rotating","subcategory":"compressor","tags":["compressor","rotating","gas"],"recognition_class":"compressor","variants":{"options":{"opt1":{"file":"compressor-opt1.svg","label":"ISA Standard"},"opt2":{"file":"compressor-opt2.svg","label":"Graphical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 50","width":50,"height":50},"connections":[{"id":"suction","type":"process","x":5,"y":25,"direction":"left"},{"id":"discharge","type":"process","x":45,"y":25,"direction":"right"}],"textZones":[{"id":"tagname","x":25,"y":-6,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // FAN / BLOWER
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "fan-blower",
            display_name: "Fan / Blower",
            category: "rotating",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 50 50",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"
     data-io-shape="fan-blower" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="9.7" x2="43.1" y2="16.5"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12.1" y1="40.3" x2="43.1" y2="33.5"
          stroke="#808080" stroke-width="1.5"/>
    <ellipse cx="25" cy="20" rx="2.5" ry="5"
             fill="none" stroke="#808080" stroke-width="1.5"
             transform="rotate(315, 25, 25)"/>
    <ellipse cx="25" cy="20" rx="2.5" ry="5"
             fill="none" stroke="#808080" stroke-width="1.5"
             transform="rotate(75, 25, 25)"/>
    <ellipse cx="25" cy="20" rx="2.5" ry="5"
             fill="none" stroke="#808080" stroke-width="1.5"
             transform="rotate(195, 25, 25)"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"fan-blower","version":"1.0","display_name":"Fan / Blower","category":"rotating","subcategory":"fan-blower","tags":["fan","blower","rotating","air"],"recognition_class":"fan_blower","variants":{"options":{"opt1":{"file":"fan-blower-opt1.svg","label":"ISA Standard"},"opt2":{"file":"fan-blower-opt2.svg","label":"Graphical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 50","width":50,"height":50},"connections":[{"id":"suction","type":"process","x":5,"y":25,"direction":"left"},{"id":"discharge","type":"process","x":45,"y":25,"direction":"right"}],"textZones":[{"id":"tagname","x":25,"y":-6,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // MOTOR
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "motor",
            display_name: "Electric Motor",
            category: "rotating",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 40 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="motor" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <text x="20" y="21" text-anchor="middle" dominant-baseline="central"
          font-family="Arial,sans-serif" font-size="18" font-weight="600" fill="#808080">M</text>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"motor","version":"1.0","display_name":"Motor","category":"rotating","subcategory":"motor","tags":["motor","electric","rotating","drive"],"recognition_class":"motor","variants":{"options":{"opt1":{"file":"motor-opt1.svg","label":"Circle (Vertical Shaft)"},"opt2":{"file":"motor-opt2.svg","label":"Rectangle (Horizontal Shaft)"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 40","width":40,"height":40},"connections":[{"id":"shaft","type":"mechanical","x":20,"y":4,"direction":"top"},{"id":"electrical","type":"electrical","x":4,"y":20,"direction":"left"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.2,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.15},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // HEAT EXCHANGERS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "heat-exchanger-shell-tube",
            display_name: "Shell & Tube HX",
            category: "heat-transfer",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 50 50",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"
     data-io-shape="heat-exchanger-shell-tube" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="25" cy="25" r="20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <polyline points="5,25 12,25 19,13 31,37 38,25 45,25"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"heat-exchanger-shell-tube","version":"1.0","display_name":"Shell & Tube Heat Exchanger","category":"heat-transfer","subcategory":"heat-exchanger","tags":["heat exchanger","shell and tube","HX","heat-transfer"],"recognition_class":"heat_exchanger_shell_tube","variants":{"options":{"base":{"file":"heat-exchanger-shell-tube.svg","label":"Base"},"standard":{"file":"heat-exchanger-shell-tube-standard.svg","label":"Standard"},"kettle-reboiler":{"file":"heat-exchanger-shell-tube-kettle-reboiler.svg","label":"Kettle Reboiler"},"u-tube":{"file":"heat-exchanger-shell-tube-u-tube.svg","label":"U-Tube"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 50","width":50,"height":50},"connections":[{"id":"shell-left","type":"process","x":5,"y":25,"direction":"left"},{"id":"shell-right","type":"process","x":45,"y":25,"direction":"right"}],"textZones":[{"id":"tagname","x":25.0,"y":-6,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "heat-exchanger-plate",
            display_name: "Plate HX",
            category: "heat-transfer",
            variant: "opt1",
            shape_type: "shape",
            view_box: "-2 -2 58 20",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 58 20"
     data-io-shape="heat-exchanger-plate" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <rect class="io-stateful" x="0" y="0" width="54" height="16"
          fill="none" stroke="#808080" stroke-width="1"/>
    <line x1="13.5" y1="0" x2="13.5" y2="16"
          stroke="#808080" stroke-width="1"/>
    <line x1="27" y1="0" x2="27" y2="16"
          stroke="#808080" stroke-width="1"/>
    <line x1="40.5" y1="0" x2="40.5" y2="16"
          stroke="#808080" stroke-width="1"/>
    <line x1="10" y1="0" x2="44" y2="16"
          stroke="#808080" stroke-width="1"/>
    <line x1="10" y1="16" x2="44" y2="0"
          stroke="#808080" stroke-width="1"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"heat-exchanger-plate","version":"1.0","display_name":"Plate Heat Exchanger","category":"heat-transfer","subcategory":"heat-exchanger","tags":["heat exchanger","plate","HX","PHE"],"recognition_class":"heat_exchanger_plate","variants":{"options":{"default":{"file":"heat-exchanger-plate.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"-2 -2 58 20","width":58,"height":20},"connections":[{"id":"fluid-1-in","type":"process","x":0,"y":0,"direction":"left"},{"id":"fluid-1-out","type":"process","x":0,"y":16,"direction":"left"},{"id":"fluid-2-in","type":"process","x":54,"y":16,"direction":"right"},{"id":"fluid-2-out","type":"process","x":54,"y":0,"direction":"right"}],"textZones":[{"id":"tagname","x":27,"y":-8,"width":58,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "heater-fired",
            display_name: "Fired Heater / Furnace",
            category: "heat-transfer",
            variant: "opt1",
            shape_type: "shape",
            view_box: "-2 -2 48 64",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 48 64"
     data-io-shape="heater-fired" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 15,2 L 29,2 L 29,18 L 37,28 L 37,58 L 7,58 L 7,28 L 15,18 Z"
          fill="none" stroke="#808080" stroke-width="1.5"
          stroke-linejoin="miter"/>
    <polyline points="37,55 20,55 33,44 20,31 37,31"
             fill="none" stroke="#808080" stroke-width="1.5"
             stroke-linejoin="miter"/>
    <line x1="25.5" y1="58" x2="25.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="33.5" y1="58" x2="33.5" y2="55"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"heater-fired","version":"1.0","display_name":"Fired Heater / Furnace","category":"heat-transfer","subcategory":"heater","tags":["fired heater","furnace","heater","heat-transfer"],"recognition_class":"heater_fired","variants":{"options":{"box":{"file":"heater-fired-box.svg","label":"Box Type"},"cylindrical":{"file":"heater-fired-cylindrical.svg","label":"Cylindrical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"-2 -2 48 64","width":48,"height":64},"connections":[{"id":"tube-a","type":"process","x":40,"y":31,"direction":"right"},{"id":"tube-b","type":"process","x":40,"y":55,"direction":"right"}],"textZones":[{"id":"tagname","x":22,"y":-8,"width":48,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "air-cooler",
            display_name: "Air Cooler / Fin-Fan",
            category: "heat-transfer",
            variant: "opt1",
            shape_type: "shape",
            view_box: "-8 0 76 38",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 0 76 38"
     data-io-shape="air-cooler" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <line x1="5" y1="5" x2="55" y2="5" stroke="#808080" stroke-width="0.75"/>
    <line x1="5" y1="5" x2="5" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="55" y1="5" x2="55" y2="27" stroke="#808080" stroke-width="0.75"/>
    <polyline points="-4,11 5,11 9,14 14,8 19,14 24,8 29,14 34,8 39,14 44,8 49,14 52,11 55,11 63,11"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <polyline points="59,8 63,11 59,14"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 8,18 8,22 C8,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 52,18 52,22 C52,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <line x1="30" y1="22" x2="30" y2="30" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"air-cooler","version":"1.0","display_name":"Air Cooler / Fin-Fan","category":"heat-transfer","subcategory":"cooler","tags":["air cooler","fin-fan","aerial cooler","heat-transfer"],"recognition_class":"air_cooler","variants":{"options":{"default":{"file":"air-cooler.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"-8 0 76 38","width":76,"height":38},"connections":[{"id":"tube-out","type":"process","x":63,"y":11,"direction":"right"}],"textZones":[{"id":"tagname","x":30,"y":-6,"width":76,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // INSTRUMENTS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "instrument-field",
            display_name: "Instrument (Field Mounted)",
            category: "instrumentation",
            variant: "field",
            shape_type: "shape",
            view_box: "0 0 40 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="instrument" data-io-version="1.0"
     data-io-variant="field">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"instrument-field","version":"1.0","display_name":"Instrument (Field-Mounted)","category":"instrumentation","subcategory":"instrument","tags":["instrument","bubble","ISA"],"recognition_class":"instrument","variants":{"options":{"default":{"file":"instrument-field.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 40","width":40,"height":40},"connections":[{"id":"nozzle-top","type":"signal","x":20,"y":2,"direction":"top"},{"id":"nozzle-bottom","type":"signal","x":20,"y":38,"direction":"bottom"},{"id":"nozzle-left","type":"signal","x":2,"y":20,"direction":"left"},{"id":"nozzle-right","type":"signal","x":38,"y":20,"direction":"right"}],"textZones":[{"id":"tagname","x":20.0,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "instrument-panel",
            display_name: "Instrument (Panel Mounted)",
            category: "instrumentation",
            variant: "panel",
            shape_type: "shape",
            view_box: "0 0 40 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="instrument" data-io-version="1.0"
     data-io-variant="panel">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="20" x2="36" y2="20"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"instrument-panel","version":"1.0","display_name":"Instrument (Panel-Mounted)","category":"instrumentation","subcategory":"instrument","tags":["instrument","bubble","ISA"],"recognition_class":"instrument","variants":{"options":{"default":{"file":"instrument-panel.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 40","width":40,"height":40},"connections":[{"id":"nozzle-top","type":"signal","x":20,"y":2,"direction":"top"},{"id":"nozzle-bottom","type":"signal","x":20,"y":38,"direction":"bottom"},{"id":"nozzle-left","type":"signal","x":2,"y":20,"direction":"left"},{"id":"nozzle-right","type":"signal","x":38,"y":20,"direction":"right"}],"textZones":[{"id":"tagname","x":20.0,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "instrument-behind-panel",
            display_name: "Instrument (Behind Panel)",
            category: "instrumentation",
            variant: "behind-panel",
            shape_type: "shape",
            view_box: "0 0 40 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="instrument" data-io-version="1.0"
     data-io-variant="behind-panel">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="20" x2="36" y2="20"
          stroke="#808080" stroke-width="1.5"
          stroke-dasharray="4,3"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"instrument-behind-panel","version":"1.0","display_name":"Instrument (Behind Panel)","category":"instrumentation","subcategory":"instrument","tags":["instrument","bubble","ISA"],"recognition_class":"instrument","variants":{"options":{"default":{"file":"instrument-behind-panel.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 40","width":40,"height":40},"connections":[{"id":"nozzle-top","type":"signal","x":20,"y":2,"direction":"top"},{"id":"nozzle-bottom","type":"signal","x":20,"y":38,"direction":"bottom"},{"id":"nozzle-left","type":"signal","x":2,"y":20,"direction":"left"},{"id":"nozzle-right","type":"signal","x":38,"y":20,"direction":"right"}],"textZones":[{"id":"tagname","x":20.0,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // VERTICAL VESSELS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "vessel-vertical",
            display_name: "Vertical Vessel (Welded)",
            category: "vessel",
            variant: "welded",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="vessel-vertical" data-io-version="1.0"
     data-io-variant="welded">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-vertical","version":"1.0","display_name":"Vertical Vessel (Welded)","category":"vessels","subcategory":"vertical","tags":["vessel","vertical","separator","drum"],"recognition_class":"vessel_vertical","variants":{"options":{},"configurations":[{"file":"vessel-vertical.svg","label":"Welded"},{"file":"vessel-vertical-flanged-top.svg","label":"Flanged Top"},{"file":"vessel-vertical-flanged-bottom.svg","label":"Flanged Bottom"},{"file":"vessel-vertical-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":25,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":55,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 A10,5 0 0,1 10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "vessel-vertical-flanged-top",
            display_name: "Vertical Vessel (Flanged Top)",
            category: "vessel",
            variant: "flanged-top",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="vessel-vertical" data-io-version="1.0"
     data-io-variant="flanged-top">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="8" y1="12" x2="32" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-vertical-flanged-top","version":"1.0","display_name":"Vertical Vessel (Flanged Top)","category":"vessels","subcategory":"vertical","tags":["vessel","vertical","flanged","separator","drum"],"recognition_class":"vessel_vertical_flanged_top","variants":{"options":{},"configurations":[{"file":"vessel-vertical.svg","label":"Welded"},{"file":"vessel-vertical-flanged-top.svg","label":"Flanged Top"},{"file":"vessel-vertical-flanged-bottom.svg","label":"Flanged Bottom"},{"file":"vessel-vertical-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":25,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":55,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 A10,5 0 0,1 10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "vessel-vertical-flanged-bottom",
            display_name: "Vertical Vessel (Flanged Bottom)",
            category: "vessel",
            variant: "flanged-bottom",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="vessel-vertical" data-io-version="1.0"
     data-io-variant="flanged-bottom">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="8" y1="68" x2="32" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-vertical-flanged-bottom","version":"1.0","display_name":"Vertical Vessel (Flanged Bottom)","category":"vessels","subcategory":"vertical","tags":["vessel","vertical","flanged","separator","drum"],"recognition_class":"vessel_vertical_flanged_bottom","variants":{"options":{},"configurations":[{"file":"vessel-vertical.svg","label":"Welded"},{"file":"vessel-vertical-flanged-top.svg","label":"Flanged Top"},{"file":"vessel-vertical-flanged-bottom.svg","label":"Flanged Bottom"},{"file":"vessel-vertical-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":25,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":55,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 A10,5 0 0,1 10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "vessel-vertical-flanged",
            display_name: "Vertical Vessel (Flanged Both)",
            category: "vessel",
            variant: "flanged",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="vessel-vertical" data-io-version="1.0"
     data-io-variant="flanged">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="8" y1="12" x2="32" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="8" y1="68" x2="32" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-vertical-flanged","version":"1.0","display_name":"Vertical Vessel (Flanged Both)","category":"vessels","subcategory":"vertical","tags":["vessel","vertical","flanged","separator","drum"],"recognition_class":"vessel_vertical_flanged","variants":{"options":{},"configurations":[{"file":"vessel-vertical.svg","label":"Welded"},{"file":"vessel-vertical-flanged-top.svg","label":"Flanged Top"},{"file":"vessel-vertical-flanged-bottom.svg","label":"Flanged Bottom"},{"file":"vessel-vertical-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":25,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":55,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 A10,5 0 0,1 10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // HORIZONTAL VESSELS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "vessel-horizontal",
            display_name: "Horizontal Vessel (Welded)",
            category: "vessel",
            variant: "welded",
            shape_type: "shape",
            view_box: "0 0 80 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"
     data-io-shape="vessel-horizontal" data-io-version="1.0"
     data-io-variant="welded">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-horizontal","version":"1.0","display_name":"Horizontal Vessel (Welded)","category":"vessels","subcategory":"horizontal","tags":["vessel","horizontal","separator","drum"],"recognition_class":"vessel_horizontal","variants":{"options":{},"configurations":[{"file":"vessel-horizontal.svg","label":"Welded"},{"file":"vessel-horizontal-flanged-left.svg","label":"Flanged Left"},{"file":"vessel-horizontal-flanged-right.svg","label":"Flanged Right"},{"file":"vessel-horizontal-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 80 40","width":80,"height":40},"connections":[{"id":"inlet-left","type":"process","x":12,"y":20,"direction":"left"},{"id":"outlet-right","type":"process","x":68,"y":20,"direction":"right"},{"id":"top-nozzle","type":"process","x":40,"y":10,"direction":"top"}],"textZones":[{"id":"tagname","x":40,"y":-6,"width":80,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"},{"nx":1.1,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.05,"ny":-0.15},"vesselInteriorPath":"M12,10 L68,10 A5,10 0 0,1 68,30 L12,30 A5,10 0 0,1 12,10 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-saddles","file":"support-saddles.svg","label":"Saddle Supports"}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "vessel-horizontal-flanged-left",
            display_name: "Horizontal Vessel (Flanged Left)",
            category: "vessel",
            variant: "flanged-left",
            shape_type: "shape",
            view_box: "0 0 80 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"
     data-io-shape="vessel-horizontal" data-io-version="1.0"
     data-io-variant="flanged-left">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="8" x2="12" y2="32"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-horizontal-flanged-left","version":"1.0","display_name":"Horizontal Vessel (Flanged Left)","category":"vessels","subcategory":"horizontal","tags":["vessel","horizontal","flanged","separator","drum"],"recognition_class":"vessel_horizontal_flanged_left","variants":{"options":{},"configurations":[{"file":"vessel-horizontal.svg","label":"Welded"},{"file":"vessel-horizontal-flanged-left.svg","label":"Flanged Left"},{"file":"vessel-horizontal-flanged-right.svg","label":"Flanged Right"},{"file":"vessel-horizontal-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 80 40","width":80,"height":40},"connections":[{"id":"inlet-left","type":"process","x":12,"y":20,"direction":"left"},{"id":"outlet-right","type":"process","x":68,"y":20,"direction":"right"},{"id":"top-nozzle","type":"process","x":40,"y":10,"direction":"top"}],"textZones":[{"id":"tagname","x":40,"y":-6,"width":80,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"},{"nx":1.1,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.05,"ny":-0.15},"vesselInteriorPath":"M12,10 L68,10 A5,10 0 0,1 68,30 L12,30 A5,10 0 0,1 12,10 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-saddles","file":"support-saddles.svg","label":"Saddle Supports"}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "vessel-horizontal-flanged-right",
            display_name: "Horizontal Vessel (Flanged Right)",
            category: "vessel",
            variant: "flanged-right",
            shape_type: "shape",
            view_box: "0 0 80 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"
     data-io-shape="vessel-horizontal" data-io-version="1.0"
     data-io-variant="flanged-right">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="68" y1="8" x2="68" y2="32"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-horizontal-flanged-right","version":"1.0","display_name":"Horizontal Vessel (Flanged Right)","category":"vessels","subcategory":"horizontal","tags":["vessel","horizontal","flanged","separator","drum"],"recognition_class":"vessel_horizontal_flanged_right","variants":{"options":{},"configurations":[{"file":"vessel-horizontal.svg","label":"Welded"},{"file":"vessel-horizontal-flanged-left.svg","label":"Flanged Left"},{"file":"vessel-horizontal-flanged-right.svg","label":"Flanged Right"},{"file":"vessel-horizontal-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 80 40","width":80,"height":40},"connections":[{"id":"inlet-left","type":"process","x":12,"y":20,"direction":"left"},{"id":"outlet-right","type":"process","x":68,"y":20,"direction":"right"},{"id":"top-nozzle","type":"process","x":40,"y":10,"direction":"top"}],"textZones":[{"id":"tagname","x":40,"y":-6,"width":80,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"},{"nx":1.1,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.05,"ny":-0.15},"vesselInteriorPath":"M12,10 L68,10 A5,10 0 0,1 68,30 L12,30 A5,10 0 0,1 12,10 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-saddles","file":"support-saddles.svg","label":"Saddle Supports"}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "vessel-horizontal-flanged",
            display_name: "Horizontal Vessel (Flanged Both)",
            category: "vessel",
            variant: "flanged",
            shape_type: "shape",
            view_box: "0 0 80 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"
     data-io-shape="vessel-horizontal" data-io-version="1.0"
     data-io-variant="flanged">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A5,10 0 0,0 12,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="8" x2="12" y2="32"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="68" y2="10"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="30" x2="68" y2="30"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M68,10 A5,10 0 0,1 68,30"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="68" y1="8" x2="68" y2="32"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"vessel-horizontal-flanged","version":"1.0","display_name":"Horizontal Vessel (Flanged Both)","category":"vessels","subcategory":"horizontal","tags":["vessel","horizontal","flanged","separator","drum"],"recognition_class":"vessel_horizontal_flanged","variants":{"options":{},"configurations":[{"file":"vessel-horizontal.svg","label":"Welded"},{"file":"vessel-horizontal-flanged-left.svg","label":"Flanged Left"},{"file":"vessel-horizontal-flanged-right.svg","label":"Flanged Right"},{"file":"vessel-horizontal-flanged.svg","label":"Flanged Both"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 80 40","width":80,"height":40},"connections":[{"id":"inlet-left","type":"process","x":12,"y":20,"direction":"left"},{"id":"outlet-right","type":"process","x":68,"y":20,"direction":"right"},{"id":"top-nozzle","type":"process","x":40,"y":10,"direction":"top"}],"textZones":[{"id":"tagname","x":40,"y":-6,"width":80,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"},{"nx":1.1,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.05,"ny":-0.15},"vesselInteriorPath":"M12,10 L68,10 A5,10 0 0,1 68,30 L12,30 A5,10 0 0,1 12,10 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-saddles","file":"support-saddles.svg","label":"Saddle Supports"}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Vessel Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // REACTORS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "reactor",
            display_name: "Reactor (Base)",
            category: "vessel",
            variant: "base",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="reactor" data-io-version="1.0"
     data-io-variant="base">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"reactor","version":"1.0","display_name":"Reactor (Base)","category":"reactors","subcategory":"reactor","tags":["reactor","vessel","chemical"],"recognition_class":"reactor","variants":{"options":{},"configurations":[{"file":"reactor.svg","label":"Base"},{"file":"reactor-flat-top.svg","label":"Flat Top"},{"file":"reactor-closed.svg","label":"Closed"},{"file":"reactor-trayed.svg","label":"Trayed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":30,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":60,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 L10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"agitator-turbine","file":"agitator-turbine.svg","label":"Turbine Agitator","group":"agitator","exclusive":true},{"id":"agitator-propeller","file":"agitator-propeller.svg","label":"Propeller Agitator","group":"agitator","exclusive":true},{"id":"agitator-anchor","file":"agitator-anchor.svg","label":"Anchor Agitator","group":"agitator","exclusive":true},{"id":"agitator-paddle","file":"agitator-paddle.svg","label":"Paddle Agitator","group":"agitator","exclusive":true},{"id":"agitator-helical","file":"agitator-helical.svg","label":"Helical Ribbon Agitator","group":"agitator","exclusive":true},{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Reactor Body","category":"equipment"},{"partId":"agitator-turbine","label":"Turbine Agitator","category":"agitator"},{"partId":"agitator-propeller","label":"Propeller Agitator","category":"agitator"},{"partId":"agitator-anchor","label":"Anchor Agitator","category":"agitator"},{"partId":"agitator-paddle","label":"Paddle Agitator","category":"agitator"},{"partId":"agitator-helical","label":"Helical Ribbon Agitator","category":"agitator"}]}"#,
        },
        ShapeSeed {
            shape_id: "reactor-flat-top",
            display_name: "Reactor (Flat Top)",
            category: "vessel",
            variant: "flat-top",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="reactor" data-io-version="1.0"
     data-io-variant="flat-top">
  <g class="io-shape-body">
    <line x1="10" y1="12" x2="30" y2="12"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"reactor-flat-top","version":"1.0","display_name":"Reactor (Flat Top)","category":"reactors","subcategory":"reactor","tags":["reactor","vessel","chemical","flat-top"],"recognition_class":"reactor_flat_top","variants":{"options":{},"configurations":[{"file":"reactor.svg","label":"Base"},{"file":"reactor-flat-top.svg","label":"Flat Top"},{"file":"reactor-closed.svg","label":"Closed"},{"file":"reactor-trayed.svg","label":"Trayed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":30,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":60,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 L30,12 L30,68 A10,5 0 0,1 10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"agitator-turbine","file":"agitator-turbine.svg","label":"Turbine Agitator","group":"agitator","exclusive":true},{"id":"agitator-propeller","file":"agitator-propeller.svg","label":"Propeller Agitator","group":"agitator","exclusive":true},{"id":"agitator-anchor","file":"agitator-anchor.svg","label":"Anchor Agitator","group":"agitator","exclusive":true},{"id":"agitator-paddle","file":"agitator-paddle.svg","label":"Paddle Agitator","group":"agitator","exclusive":true},{"id":"agitator-helical","file":"agitator-helical.svg","label":"Helical Ribbon Agitator","group":"agitator","exclusive":true},{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Reactor Body","category":"equipment"},{"partId":"agitator-turbine","label":"Turbine Agitator","category":"agitator"},{"partId":"agitator-propeller","label":"Propeller Agitator","category":"agitator"},{"partId":"agitator-anchor","label":"Anchor Agitator","category":"agitator"},{"partId":"agitator-paddle","label":"Paddle Agitator","category":"agitator"},{"partId":"agitator-helical","label":"Helical Ribbon Agitator","category":"agitator"}]}"#,
        },
        ShapeSeed {
            shape_id: "reactor-closed",
            display_name: "Reactor (Closed / Pressure)",
            category: "vessel",
            variant: "closed",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="reactor" data-io-version="1.0"
     data-io-variant="closed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,68 A10,5 0 0,0 30,68"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"reactor-closed","version":"1.0","display_name":"Reactor (Closed)","category":"reactors","subcategory":"reactor","tags":["reactor","vessel","chemical","closed"],"recognition_class":"reactor_closed","variants":{"options":{},"configurations":[{"file":"reactor.svg","label":"Base"},{"file":"reactor-flat-top.svg","label":"Flat Top"},{"file":"reactor-closed.svg","label":"Closed"},{"file":"reactor-trayed.svg","label":"Trayed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":30,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":60,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 A10,5 0 0,1 10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"agitator-turbine","file":"agitator-turbine.svg","label":"Turbine Agitator","group":"agitator","exclusive":true},{"id":"agitator-propeller","file":"agitator-propeller.svg","label":"Propeller Agitator","group":"agitator","exclusive":true},{"id":"agitator-anchor","file":"agitator-anchor.svg","label":"Anchor Agitator","group":"agitator","exclusive":true},{"id":"agitator-paddle","file":"agitator-paddle.svg","label":"Paddle Agitator","group":"agitator","exclusive":true},{"id":"agitator-helical","file":"agitator-helical.svg","label":"Helical Ribbon Agitator","group":"agitator","exclusive":true},{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Reactor Body","category":"equipment"},{"partId":"agitator-turbine","label":"Turbine Agitator","category":"agitator"},{"partId":"agitator-propeller","label":"Propeller Agitator","category":"agitator"},{"partId":"agitator-anchor","label":"Anchor Agitator","category":"agitator"},{"partId":"agitator-paddle","label":"Paddle Agitator","category":"agitator"},{"partId":"agitator-helical","label":"Helical Ribbon Agitator","category":"agitator"}]}"#,
        },
        ShapeSeed {
            shape_id: "reactor-trayed",
            display_name: "Reactor (Trayed)",
            category: "vessel",
            variant: "trayed",
            shape_type: "shape",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="reactor" data-io-version="1.0"
     data-io-variant="trayed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,12 A10,5 0 0,1 30,12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="12" x2="10" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="12" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="68" x2="30" y2="68"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="17" x2="30" y2="17" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="22" x2="30" y2="22" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="27" x2="30" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="32" x2="30" y2="32" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="37" x2="30" y2="37" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="42" x2="30" y2="42" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="47" x2="30" y2="47" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="52" x2="30" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="57" x2="30" y2="57" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="63" x2="30" y2="63" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"reactor-trayed","version":"1.0","display_name":"Reactor (Trayed)","category":"reactors","subcategory":"reactor","tags":["reactor","vessel","chemical","trayed"],"recognition_class":"reactor_trayed","variants":{"options":{},"configurations":[{"file":"reactor.svg","label":"Base"},{"file":"reactor-flat-top.svg","label":"Flat Top"},{"file":"reactor-closed.svg","label":"Closed"},{"file":"reactor-trayed.svg","label":"Trayed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"inlet","type":"process","x":10,"y":30,"direction":"left"},{"id":"outlet","type":"process","x":10,"y":60,"direction":"left"},{"id":"top-nozzle","type":"process","x":20,"y":12,"direction":"top"},{"id":"bottom-drain","type":"process","x":20,"y":68,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.08,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.15,"ny":-0.05},"vesselInteriorPath":"M10,12 A10,5 0 0,1 30,12 L30,68 L10,68 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"agitator-turbine","file":"agitator-turbine.svg","label":"Turbine Agitator","group":"agitator","exclusive":true},{"id":"agitator-propeller","file":"agitator-propeller.svg","label":"Propeller Agitator","group":"agitator","exclusive":true},{"id":"agitator-anchor","file":"agitator-anchor.svg","label":"Anchor Agitator","group":"agitator","exclusive":true},{"id":"agitator-paddle","file":"agitator-paddle.svg","label":"Paddle Agitator","group":"agitator","exclusive":true},{"id":"agitator-helical","file":"agitator-helical.svg","label":"Helical Ribbon Agitator","group":"agitator","exclusive":true},{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Reactor Body","category":"equipment"},{"partId":"agitator-turbine","label":"Turbine Agitator","category":"agitator"},{"partId":"agitator-propeller","label":"Propeller Agitator","category":"agitator"},{"partId":"agitator-anchor","label":"Anchor Agitator","category":"agitator"},{"partId":"agitator-paddle","label":"Paddle Agitator","category":"agitator"},{"partId":"agitator-helical","label":"Helical Ribbon Agitator","category":"agitator"}]}"#,
        },
        // ---------------------------------------------------------------
        // DISTILLATION COLUMNS — Standard width
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "column-distillation",
            display_name: "Distillation Column (Plain)",
            category: "separation",
            variant: "standard",
            shape_type: "shape",
            view_box: "0 0 44 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="standard">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation","version":"1.0","display_name":"Column — Standard Plain","category":"columns","subcategory":"distillation","tags":["column","distillation","separation","fractionator"],"recognition_class":"column_distillation","variants":{"options":{},"configurations":[{"name":"standard-plain","file":"column-distillation.svg","label":"Standard Plain","width":"standard","internals":"plain"},{"name":"standard-trayed","file":"column-distillation-trayed.svg","label":"Standard Trayed-6","width":"standard","internals":"trayed-6"},{"name":"standard-trayed-10","file":"column-distillation-trayed-10.svg","label":"Standard Trayed-10","width":"standard","internals":"trayed-10"},{"name":"standard-packed","file":"column-distillation-packed.svg","label":"Standard Packed","width":"standard","internals":"packed"},{"name":"narrow-plain","file":"column-distillation-narrow.svg","label":"Narrow Plain","width":"narrow","internals":"plain"},{"name":"narrow-trayed","file":"column-distillation-narrow-trayed.svg","label":"Narrow Trayed-6","width":"narrow","internals":"trayed-6"},{"name":"narrow-trayed-10","file":"column-distillation-narrow-trayed-10.svg","label":"Narrow Trayed-10","width":"narrow","internals":"trayed-10"},{"name":"narrow-packed","file":"column-distillation-narrow-packed.svg","label":"Narrow Packed","width":"narrow","internals":"packed"},{"name":"wide-plain","file":"column-distillation-wide.svg","label":"Wide Plain","width":"wide","internals":"plain"},{"name":"wide-trayed","file":"column-distillation-wide-trayed.svg","label":"Wide Trayed-6","width":"wide","internals":"trayed-6"},{"name":"wide-trayed-10","file":"column-distillation-wide-trayed-10.svg","label":"Wide Trayed-10","width":"wide","internals":"trayed-10"},{"name":"wide-packed","file":"column-distillation-wide-packed.svg","label":"Wide Packed","width":"wide","internals":"packed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 44 120","width":44,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":22,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":22,"y":110,"direction":"bottom"},{"id":"reflux","type":"process","x":34,"y":30,"direction":"right"},{"id":"side-draw","type":"process","x":34,"y":80,"direction":"right"}],"textZones":[{"id":"tagname","x":22,"y":-8,"width":44,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.2,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"},{"nx":1.15,"ny":0.3,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.1,"ny":-0.03},"vesselInteriorPath":"M10,10 A12,5 0 0,1 34,10 L34,110 A12,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-trayed",
            display_name: "Distillation Column (6 Trays) [Default]",
            category: "separation",
            variant: "standard-trayed",
            shape_type: "shape",
            view_box: "0 0 44 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="standard-trayed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="24" x2="34" y2="24" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="40" x2="34" y2="40" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="56" x2="34" y2="56" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="72" x2="34" y2="72" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="88" x2="34" y2="88" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="100" x2="34" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-trayed","version":"1.0","display_name":"Column — Trayed-6 (Default)","category":"columns","subcategory":"distillation","tags":["column","distillation","separation","fractionator","trayed"],"recognition_class":"column_distillation_trayed","variants":{"options":{},"configurations":[{"file":"column-distillation.svg","label":"Standard Plain"},{"file":"column-distillation-trayed.svg","label":"Trayed-6"},{"file":"column-distillation-trayed-10.svg","label":"Trayed-10"},{"file":"column-distillation-packed.svg","label":"Packed"},{"file":"column-distillation-narrow.svg","label":"Narrow Plain"},{"file":"column-distillation-wide.svg","label":"Wide Plain"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 44 120","width":44,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":22,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":22,"y":110,"direction":"bottom"},{"id":"reflux","type":"process","x":34,"y":30,"direction":"right"},{"id":"side-draw","type":"process","x":34,"y":80,"direction":"right"}],"textZones":[{"id":"tagname","x":22,"y":-8,"width":44,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.2,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"},{"nx":1.15,"ny":0.3,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.1,"ny":-0.03},"vesselInteriorPath":"M10,10 A12,5 0 0,1 34,10 L34,110 A12,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-trayed-10",
            display_name: "Distillation Column (10 Trays)",
            category: "separation",
            variant: "standard-trayed-10",
            shape_type: "shape",
            view_box: "0 0 44 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="standard-trayed-10">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="19" x2="34" y2="19" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="28" x2="34" y2="28" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="38" x2="34" y2="38" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="48" x2="34" y2="48" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="57" x2="34" y2="57" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="66" x2="34" y2="66" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="75" x2="34" y2="75" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="84" x2="34" y2="84" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="93" x2="34" y2="93" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="102" x2="34" y2="102" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-trayed-10","version":"1.0","display_name":"Column — Trayed-10","category":"columns","subcategory":"distillation","tags":["column","distillation","separation","fractionator","trayed"],"recognition_class":"column_distillation_trayed_10","variants":{"options":{},"configurations":[{"file":"column-distillation.svg","label":"Standard Plain"},{"file":"column-distillation-trayed.svg","label":"Trayed-6"},{"file":"column-distillation-trayed-10.svg","label":"Trayed-10"},{"file":"column-distillation-packed.svg","label":"Packed"},{"file":"column-distillation-narrow.svg","label":"Narrow Plain"},{"file":"column-distillation-wide.svg","label":"Wide Plain"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 44 120","width":44,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":22,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":22,"y":110,"direction":"bottom"},{"id":"reflux","type":"process","x":34,"y":30,"direction":"right"},{"id":"side-draw","type":"process","x":34,"y":80,"direction":"right"}],"textZones":[{"id":"tagname","x":22,"y":-8,"width":44,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.2,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"},{"nx":1.15,"ny":0.3,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.1,"ny":-0.03},"vesselInteriorPath":"M10,10 A12,5 0 0,1 34,10 L34,110 A12,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-packed",
            display_name: "Distillation Column (Packed)",
            category: "separation",
            variant: "standard-packed",
            shape_type: "shape",
            view_box: "0 0 44 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="standard-packed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A12,5 0 0,1 34,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="34" y1="10" x2="34" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A12,5 0 0,0 34,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="22" x2="34" y2="22" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="52" x2="34" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="22" x2="34" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="34" y1="22" x2="10" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="62" x2="34" y2="62" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="100" x2="34" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="62" x2="34" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="34" y1="62" x2="10" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-packed","version":"1.0","display_name":"Column — Packed","category":"columns","subcategory":"distillation","tags":["column","distillation","separation","fractionator","packed"],"recognition_class":"column_distillation_packed","variants":{"options":{},"configurations":[{"file":"column-distillation.svg","label":"Standard Plain"},{"file":"column-distillation-trayed.svg","label":"Trayed-6"},{"file":"column-distillation-trayed-10.svg","label":"Trayed-10"},{"file":"column-distillation-packed.svg","label":"Packed"},{"file":"column-distillation-narrow.svg","label":"Narrow Plain"},{"file":"column-distillation-wide.svg","label":"Wide Plain"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 44 120","width":44,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":22,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":22,"y":110,"direction":"bottom"},{"id":"reflux","type":"process","x":34,"y":30,"direction":"right"},{"id":"side-draw","type":"process","x":34,"y":80,"direction":"right"}],"textZones":[{"id":"tagname","x":22,"y":-8,"width":44,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.2,"preferredElement":"text_readout"},{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"},{"nx":1.15,"ny":0.3,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.1,"ny":-0.03},"vesselInteriorPath":"M10,10 A12,5 0 0,1 34,10 L34,110 A12,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // DISTILLATION COLUMNS — Narrow width
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "column-distillation-narrow",
            display_name: "Distillation Column Narrow (Plain)",
            category: "separation",
            variant: "narrow",
            shape_type: "shape",
            view_box: "0 0 40 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="narrow">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A8,5 0 0,1 28,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="12" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="28" y1="10" x2="28" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M12,110 A8,5 0 0,0 28,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-narrow","version":"1.0","display_name":"Column — Narrow Plain","category":"columns","subcategory":"distillation","tags":["column","distillation","separation","fractionator","narrow"],"recognition_class":"column_distillation_narrow","variants":{"options":{},"configurations":[{"file":"column-distillation.svg","label":"Standard Plain"},{"file":"column-distillation-trayed.svg","label":"Trayed-6"},{"file":"column-distillation-trayed-10.svg","label":"Trayed-10"},{"file":"column-distillation-packed.svg","label":"Packed"},{"file":"column-distillation-narrow.svg","label":"Narrow Plain"},{"file":"column-distillation-wide.svg","label":"Wide Plain"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 120","width":40,"height":120},"connections":[{"id":"feed","type":"process","x":12,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":20,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":20,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-8,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M12,10 A8,5 0 0,1 28,10 L28,110 A8,5 0 0,1 12,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-narrow-trayed",
            display_name: "Distillation Column Narrow (6 Trays)",
            category: "separation",
            variant: "narrow-trayed",
            shape_type: "shape",
            view_box: "0 0 40 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="narrow-trayed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A8,5 0 0,1 28,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="12" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="28" y1="10" x2="28" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M12,110 A8,5 0 0,0 28,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="24" x2="28" y2="24" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="40" x2="28" y2="40" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="56" x2="28" y2="56" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="72" x2="28" y2="72" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="88" x2="28" y2="88" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="100" x2="28" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-narrow-trayed","version":"1.0","display_name":"Column — Narrow Trayed-6","category":"columns","subcategory":"distillation","tags":["column","distillation","narrow","trayed"],"recognition_class":"column_distillation_narrow_trayed","variants":{"options":{},"configurations":[{"file":"column-distillation-narrow-trayed.svg","label":"Narrow Trayed-6"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 120","width":40,"height":120},"connections":[{"id":"feed","type":"process","x":12,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":20,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":20,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-8,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M12,10 A8,5 0 0,1 28,10 L28,110 A8,5 0 0,1 12,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // DISTILLATION COLUMNS — Wide width
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "column-distillation-wide",
            display_name: "Distillation Column Wide (Plain)",
            category: "separation",
            variant: "wide",
            shape_type: "shape",
            view_box: "0 0 50 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="wide">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A15,5 0 0,1 40,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="40" y1="10" x2="40" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A15,5 0 0,0 40,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-wide","version":"1.0","display_name":"Column — Wide Plain","category":"columns","subcategory":"distillation","tags":["column","distillation","separation","fractionator","wide"],"recognition_class":"column_distillation_wide","variants":{"options":{},"configurations":[{"file":"column-distillation.svg","label":"Standard Plain"},{"file":"column-distillation-trayed.svg","label":"Trayed-6"},{"file":"column-distillation-trayed-10.svg","label":"Trayed-10"},{"file":"column-distillation-packed.svg","label":"Packed"},{"file":"column-distillation-narrow.svg","label":"Narrow Plain"},{"file":"column-distillation-wide.svg","label":"Wide Plain"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 120","width":50,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":25,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":25,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":25,"y":-8,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,10 A15,5 0 0,1 40,10 L40,110 A15,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-wide-trayed",
            display_name: "Distillation Column Wide (6 Trays)",
            category: "separation",
            variant: "wide-trayed",
            shape_type: "shape",
            view_box: "0 0 50 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="wide-trayed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A15,5 0 0,1 40,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="40" y1="10" x2="40" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A15,5 0 0,0 40,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="24" x2="40" y2="24" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="40" x2="40" y2="40" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="56" x2="40" y2="56" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="72" x2="40" y2="72" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="88" x2="40" y2="88" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="100" x2="40" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-wide-trayed","version":"1.0","display_name":"Column — Wide Trayed-6","category":"columns","subcategory":"distillation","tags":["column","distillation","wide","trayed"],"recognition_class":"column_distillation_wide_trayed","variants":{"options":{},"configurations":[{"file":"column-distillation-wide-trayed.svg","label":"Wide Trayed-6"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 120","width":50,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":25,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":25,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":25,"y":-8,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,10 A15,5 0 0,1 40,10 L40,110 A15,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // STORAGE TANKS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "tank-storage-cone-roof",
            display_name: "Storage Tank (Cone Roof)",
            category: "vessel",
            variant: "cone-roof",
            shape_type: "shape",
            view_box: "0 0 70 70",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <rect class="io-stateful" x="10" y="20" width="50" height="40"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <polyline class="io-stateful" points="10,20 35,6 60,20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"tank-storage-cone-roof","version":"1.0","display_name":"Tank — Cone Roof","category":"tanks","subcategory":"storage","tags":["tank","storage","cone-roof","atmospheric"],"recognition_class":"tank_storage_cone_roof","variants":{"options":{},"configurations":[{"file":"tank-storage-cone-roof.svg","label":"Cone Roof"},{"file":"tank-storage-dome-roof.svg","label":"Dome Roof"},{"file":"tank-storage-open-top.svg","label":"Open Top"},{"file":"tank-storage-floating-roof.svg","label":"Floating Roof"},{"file":"tank-storage-sphere.svg","label":"Sphere"},{"file":"tank-storage-capsule.svg","label":"Capsule"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 70","width":70,"height":70},"connections":[{"id":"inlet","type":"process","x":10,"y":40,"direction":"left"},{"id":"outlet","type":"process","x":60,"y":40,"direction":"right"},{"id":"top-vent","type":"process","x":35,"y":6,"direction":"top"}],"textZones":[{"id":"tagname","x":35,"y":-6,"width":70,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.1,"preferredElement":"text_readout"},{"nx":1.1,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.6,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,20 L60,20 L60,60 L10,60 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Tank Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "tank-storage-dome-roof",
            display_name: "Storage Tank (Dome Roof)",
            category: "vessel",
            variant: "dome-roof",
            shape_type: "shape",
            view_box: "0 0 70 70",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <rect class="io-stateful" x="10" y="20" width="50" height="40"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <path class="io-stateful" d="M10,20 A25,10 0 0,1 60,20"
        fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"tank-storage-dome-roof","version":"1.0","display_name":"Tank — Dome Roof","category":"tanks","subcategory":"storage","tags":["tank","storage","dome-roof","atmospheric"],"recognition_class":"tank_storage_dome_roof","variants":{"options":{},"configurations":[{"file":"tank-storage-cone-roof.svg","label":"Cone Roof"},{"file":"tank-storage-dome-roof.svg","label":"Dome Roof"},{"file":"tank-storage-open-top.svg","label":"Open Top"},{"file":"tank-storage-floating-roof.svg","label":"Floating Roof"},{"file":"tank-storage-sphere.svg","label":"Sphere"},{"file":"tank-storage-capsule.svg","label":"Capsule"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 70","width":70,"height":70},"connections":[{"id":"inlet","type":"process","x":10,"y":40,"direction":"left"},{"id":"outlet","type":"process","x":60,"y":40,"direction":"right"},{"id":"top-vent","type":"process","x":35,"y":10,"direction":"top"}],"textZones":[{"id":"tagname","x":35,"y":-6,"width":70,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.1,"preferredElement":"text_readout"},{"nx":1.1,"ny":0.5,"preferredElement":"analog_bar"},{"nx":0.5,"ny":0.6,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,20 L60,20 L60,60 L10,60 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Tank Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "tank-storage-open-top",
            display_name: "Storage Tank (Open Top)",
            category: "vessel",
            variant: "open-top",
            shape_type: "shape",
            view_box: "0 0 70 70",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <line class="io-stateful" x1="10" y1="15" x2="10" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="60" y1="15" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="10" y1="60" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="6" y1="15" x2="14" y2="15"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="56" y1="15" x2="64" y2="15"
        stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"tank-storage-open-top","version":"1.0","display_name":"Tank — Open Top","category":"tanks","subcategory":"storage","tags":["tank","storage","open-top","atmospheric"],"recognition_class":"tank_storage_open_top","variants":{"options":{},"configurations":[{"file":"tank-storage-cone-roof.svg","label":"Cone Roof"},{"file":"tank-storage-dome-roof.svg","label":"Dome Roof"},{"file":"tank-storage-open-top.svg","label":"Open Top"},{"file":"tank-storage-floating-roof.svg","label":"Floating Roof"},{"file":"tank-storage-sphere.svg","label":"Sphere"},{"file":"tank-storage-capsule.svg","label":"Capsule"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 70","width":70,"height":70},"connections":[{"id":"inlet","type":"process","x":10,"y":40,"direction":"left"},{"id":"outlet","type":"process","x":60,"y":40,"direction":"right"}],"textZones":[{"id":"tagname","x":35,"y":-6,"width":70,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.1,"preferredElement":"text_readout"},{"nx":0.5,"ny":0.6,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,15 L60,15 L60,60 L10,60 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Tank Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "tank-storage-floating-roof",
            display_name: "Storage Tank (Floating Roof)",
            category: "vessel",
            variant: "floating-roof",
            shape_type: "shape",
            view_box: "0 0 70 70",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <line class="io-stateful" x1="10" y1="10" x2="10" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="60" y1="10" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="10" y1="60" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="6" y1="10" x2="14" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="56" y1="10" x2="64" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <line x1="12" y1="18" x2="58" y2="18"
        stroke="#808080" stroke-width="1.5"/>
  <line x1="16" y1="18" x2="16" y2="24"
        stroke="#808080" stroke-width="0.75"/>
  <line x1="54" y1="18" x2="54" y2="24"
        stroke="#808080" stroke-width="0.75"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"tank-storage-floating-roof","version":"1.0","display_name":"Tank — Floating Roof","category":"tanks","subcategory":"storage","tags":["tank","storage","floating-roof","atmospheric"],"recognition_class":"tank_storage_floating_roof","variants":{"options":{},"configurations":[{"file":"tank-storage-cone-roof.svg","label":"Cone Roof"},{"file":"tank-storage-dome-roof.svg","label":"Dome Roof"},{"file":"tank-storage-open-top.svg","label":"Open Top"},{"file":"tank-storage-floating-roof.svg","label":"Floating Roof"},{"file":"tank-storage-sphere.svg","label":"Sphere"},{"file":"tank-storage-capsule.svg","label":"Capsule"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 70","width":70,"height":70},"connections":[{"id":"inlet","type":"process","x":10,"y":40,"direction":"left"},{"id":"outlet","type":"process","x":60,"y":40,"direction":"right"}],"textZones":[{"id":"tagname","x":35,"y":-6,"width":70,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.1,"preferredElement":"text_readout"},{"nx":0.5,"ny":0.6,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,10 L60,10 L60,60 L10,60 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Tank Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "tank-storage-sphere",
            display_name: "Storage Tank (Sphere)",
            category: "vessel",
            variant: "sphere",
            shape_type: "shape",
            view_box: "0 0 70 56",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 56"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <circle class="io-stateful" cx="35" cy="26" r="22"
          fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"tank-storage-sphere","version":"1.0","display_name":"Tank — Sphere","category":"tanks","subcategory":"storage","tags":["tank","storage","sphere","pressurized"],"recognition_class":"tank_storage_sphere","variants":{"options":{},"configurations":[{"file":"tank-storage-cone-roof.svg","label":"Cone Roof"},{"file":"tank-storage-dome-roof.svg","label":"Dome Roof"},{"file":"tank-storage-open-top.svg","label":"Open Top"},{"file":"tank-storage-floating-roof.svg","label":"Floating Roof"},{"file":"tank-storage-sphere.svg","label":"Sphere"},{"file":"tank-storage-capsule.svg","label":"Capsule"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 56","width":70,"height":56},"connections":[{"id":"inlet","type":"process","x":13,"y":26,"direction":"left"},{"id":"outlet","type":"process","x":57,"y":26,"direction":"right"},{"id":"top-vent","type":"process","x":35,"y":4,"direction":"top"}],"textZones":[{"id":"tagname","x":35,"y":-6,"width":70,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"},{"nx":1.15,"ny":0.5,"preferredElement":"analog_bar"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"vesselInteriorPath":"M13,26 A22,22 0 0,1 57,26 A22,22 0 0,1 13,26 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-legs-splayed","file":"support-legs-splayed.svg","label":"Splayed Legs","group":"support","exclusive":true},{"id":"support-saddles","file":"support-saddles.svg","label":"Saddle Supports","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Tank Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "tank-storage-capsule",
            display_name: "Storage Tank (Capsule / Bullet)",
            category: "vessel",
            variant: "capsule",
            shape_type: "shape",
            view_box: "0 0 80 52",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 52"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <line class="io-stateful" x1="20" y1="14" x2="60" y2="14"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="20" y1="38" x2="60" y2="38"
        stroke="#808080" stroke-width="1.5"/>
  <path class="io-stateful" d="M20,14 A12,12 0 0,0 20,38"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <path class="io-stateful" d="M60,14 A12,12 0 0,1 60,38"
        fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"tank-storage-capsule","version":"1.0","display_name":"Tank — Capsule","category":"tanks","subcategory":"storage","tags":["tank","storage","capsule","pressurized","horizontal"],"recognition_class":"tank_storage_capsule","variants":{"options":{},"configurations":[{"file":"tank-storage-cone-roof.svg","label":"Cone Roof"},{"file":"tank-storage-dome-roof.svg","label":"Dome Roof"},{"file":"tank-storage-open-top.svg","label":"Open Top"},{"file":"tank-storage-floating-roof.svg","label":"Floating Roof"},{"file":"tank-storage-sphere.svg","label":"Sphere"},{"file":"tank-storage-capsule.svg","label":"Capsule"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 80 52","width":80,"height":52},"connections":[{"id":"inlet-left","type":"process","x":8,"y":26,"direction":"left"},{"id":"outlet-right","type":"process","x":72,"y":26,"direction":"right"}],"textZones":[{"id":"tagname","x":40,"y":-6,"width":80,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"},{"nx":0.5,"ny":0.5,"preferredElement":"fill_gauge"}],"alarmAnchor":{"nx":1.05,"ny":-0.15},"vesselInteriorPath":"M20,14 L60,14 A12,12 0 0,1 60,38 L20,38 A12,12 0 0,1 20,14 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-legs-splayed","file":"support-legs-splayed.svg","label":"Splayed Legs","group":"support","exclusive":true},{"id":"support-saddles","file":"support-saddles.svg","label":"Saddle Supports","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","FillGauge":"vessel-interior","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Tank Body","category":"equipment"}]}"#,
        },
        // ---------------------------------------------------------------
        // FILTERS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "filter",
            display_name: "Filter (Standard)",
            category: "separation",
            variant: "standard",
            shape_type: "shape",
            view_box: "0 0 50 60",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 60"
     data-io-shape="filter" data-io-version="1.0" data-io-category="separation">
  <rect class="io-stateful" x="10" y="10" width="30" height="40"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="6" y1="10" x2="10" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="40" y1="10" x2="44" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <polyline points="18,10 18,38 32,38 32,10"
            fill="none" stroke="#808080" stroke-width="0.75" stroke-dasharray="3,2"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"filter","version":"1.0","display_name":"Filter (Standard)","category":"filters","subcategory":"standard","tags":["filter","strainer","separation"],"recognition_class":"filter","variants":{"options":{"opt1":{"file":"filter.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 60","width":50,"height":60},"connections":[{"id":"inlet","type":"process","x":6,"y":10,"direction":"left"},{"id":"outlet","type":"process","x":44,"y":10,"direction":"right"},{"id":"drain","type":"process","x":25,"y":50,"direction":"bottom"}],"textZones":[{"id":"tagname","x":25,"y":-6,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.1,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "filter-vacuum",
            display_name: "Filter (Vacuum / Rotary)",
            category: "separation",
            variant: "vacuum",
            shape_type: "shape",
            view_box: "0 0 66 55",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 55"
     data-io-shape="filter" data-io-version="1.0" data-io-category="separation">
  <polyline class="io-stateful" points="9,20 33,44 57,20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  <polyline class="io-stateful" points="17,20 33,36 49,20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="9" y1="20" x2="17" y2="20"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="49" y1="20" x2="57" y2="20"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="17" y1="20" x2="17" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <line class="io-stateful" x1="49" y1="20" x2="49" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <path class="io-stateful" d="M17,10 A16,4 0 0,1 49,10"
        fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"filter-vacuum","version":"1.0","display_name":"Filter (Vacuum)","category":"filters","subcategory":"vacuum","tags":["filter","vacuum","separation"],"recognition_class":"filter_vacuum","variants":{"options":{"opt1":{"file":"filter-vacuum.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 66 55","width":66,"height":55},"connections":[{"id":"inlet","type":"process","x":9,"y":20,"direction":"left"},{"id":"outlet","type":"process","x":57,"y":20,"direction":"right"},{"id":"vacuum-port","type":"process","x":33,"y":0,"direction":"top"}],"textZones":[{"id":"tagname","x":33,"y":-6,"width":66,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.1,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // ALARM ANNUNCIATORS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "alarm-annunciator",
            display_name: "Alarm Annunciator (ISA)",
            category: "control",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 40 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="alarm-annunciator" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"alarm-annunciator","version":"1.0","display_name":"Alarm / Annunciator","category":"instrumentation","subcategory":"annunciator","tags":["alarm","annunciator","indicator","ISA"],"recognition_class":"alarm_annunciator","variants":{"options":{"opt1":{"file":"alarm-annunciator-opt1.svg","label":"ISA Circle"},"opt2":{"file":"alarm-annunciator-opt2.svg","label":"Horn/Speaker"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 40","width":40,"height":40},"connections":[{"id":"nozzle-top","type":"signal","x":20,"y":2,"direction":"top"},{"id":"nozzle-bottom","type":"signal","x":20,"y":38,"direction":"bottom"},{"id":"nozzle-left","type":"signal","x":2,"y":20,"direction":"left"},{"id":"nozzle-right","type":"signal","x":38,"y":20,"direction":"right"}],"textZones":[{"id":"tagname","x":20.0,"y":-6,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "alarm-annunciator-opt2",
            display_name: "Alarm Annunciator (Graphical Horn)",
            category: "control",
            variant: "opt2",
            shape_type: "shape",
            view_box: "0 0 50 40",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 40"
     data-io-shape="alarm-annunciator" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <rect class="io-stateful" x="12" y="14" width="8" height="12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <polyline class="io-stateful" points="20,14 36,6 36,34 20,26"
              fill="none" stroke="#808080" stroke-width="1.5"/>
    <path d="M39,14 C43,17 43,23 39,26"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path d="M42,10 C48,15 48,25 42,30"
          fill="none" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"alarm-annunciator-opt2","version":"1.0","display_name":"Alarm Annunciator (Horn)","category":"instrumentation","subcategory":"annunciator","tags":["alarm","annunciator","horn","speaker"],"recognition_class":"alarm_annunciator","variants":{"options":{"default":{"file":"alarm-annunciator-opt2.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 40","width":50,"height":40},"connections":[{"id":"nozzle-left","type":"signal","x":10,"y":20,"direction":"left"}],"textZones":[{"id":"tagname","x":25,"y":-6,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // MIXERS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "mixer",
            display_name: "Mixer / Agitator",
            category: "separation",
            variant: "agitator",
            shape_type: "shape",
            view_box: "0 0 60 30",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"
     data-io-shape="mixer" data-io-version="1.0" data-io-category="separation">
  <g class="io-shape-body">
    <line class="io-stateful" x1="30" y1="2" x2="30" y2="14"
          stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful" d="M30,14 C30,15 8,18 8,14 C8,10 30,13 30,14 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful" d="M30,14 C30,15 52,18 52,14 C52,10 30,13 30,14 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"mixer","version":"1.0","display_name":"Mixer — Agitator","category":"mixers","subcategory":"agitator","tags":["mixer","agitator","stirrer"],"recognition_class":"mixer","variants":{"options":{"opt1":{"file":"mixer.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 60 30","width":60,"height":30},"connections":[{"id":"shaft","type":"mechanical","x":30,"y":2,"direction":"top"}],"textZones":[{"id":"tagname","x":30,"y":-6,"width":60,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.3,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "mixer-motor",
            display_name: "Mixer / Agitator with Motor",
            category: "separation",
            variant: "agitator-motor",
            shape_type: "shape",
            view_box: "0 0 60 34",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 34"
     data-io-shape="mixer" data-io-version="1.0" data-io-category="separation">
  <g class="io-shape-body">
    <circle cx="30" cy="5" r="3"
            fill="none" stroke="#808080" stroke-width="0.75"/>
    <line class="io-stateful" x1="30" y1="8" x2="30" y2="18"
          stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful" d="M30,18 C30,19 8,22 8,18 C8,14 30,17 30,18 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful" d="M30,18 C30,19 52,22 52,18 C52,14 30,17 30,18 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"mixer-motor","version":"1.0","display_name":"Mixer — Agitator + Motor","category":"mixers","subcategory":"agitator-motor","tags":["mixer","agitator","motor","stirrer"],"recognition_class":"mixer_motor","variants":{"options":{"opt1":{"file":"mixer-motor.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 60 34","width":60,"height":34},"connections":[{"id":"shaft","type":"mechanical","x":30,"y":2,"direction":"top"}],"textZones":[{"id":"tagname","x":30,"y":-6,"width":60,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.3,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "mixer-inline",
            display_name: "Inline Static Mixer",
            category: "separation",
            variant: "inline-static",
            shape_type: "shape",
            view_box: "0 0 70 30",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 30"
     data-io-shape="mixer" data-io-version="1.0" data-io-category="separation">
  <g class="io-shape-body">
    <rect class="io-stateful" x="10" y="5" width="50" height="20"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <polyline points="10,5 16,25 22,5 28,25 34,5 40,25 46,5 52,25 58,5 60,15"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <line x1="2" y1="15" x2="10" y2="15"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="60" y1="15" x2="68" y2="15"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"mixer-inline","version":"1.0","display_name":"Mixer — Inline Static","category":"mixers","subcategory":"inline-static","tags":["mixer","inline","static","mixing"],"recognition_class":"mixer_inline","variants":{"options":{"opt1":{"file":"mixer-inline.svg","label":"ISA Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 30","width":70,"height":30},"connections":[{"id":"inlet","type":"process","x":2,"y":15,"direction":"left"},{"id":"outlet","type":"process","x":68,"y":15,"direction":"right"}],"textZones":[{"id":"tagname","x":35,"y":-6,"width":70,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.25,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.05,"ny":-0.2},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // INTERLOCKS
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "interlock",
            display_name: "Interlock (BPCS)",
            category: "control",
            variant: "opt1",
            shape_type: "shape",
            view_box: "0 0 60 44",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 44"
     data-io-shape="interlock" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="30,4 56,22 30,40 4,22"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"interlock","version":"1.0","display_name":"Interlock / SIS","category":"instrumentation","subcategory":"interlock","tags":["interlock","SIS","SIF","safety","BPCS","logic"],"recognition_class":"interlock","variants":{"options":{"standard":{"file":"interlock-standard.svg","label":"BPCS Diamond"},"sis":{"file":"interlock-sis.svg","label":"SIS / SIF"},"padlock":{"file":"interlock-padlock.svg","label":"Padlock"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 60 44","width":60,"height":44},"connections":[{"id":"nozzle-top","type":"signal","x":30,"y":2,"direction":"top"},{"id":"nozzle-bottom","type":"signal","x":30,"y":42,"direction":"bottom"},{"id":"nozzle-left","type":"signal","x":2,"y":22,"direction":"left"},{"id":"nozzle-right","type":"signal","x":58,"y":22,"direction":"right"}],"textZones":[{"id":"tagname","x":30.0,"y":-6,"width":60,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "interlock-sis",
            display_name: "Interlock (SIS / Safety Logic Solver)",
            category: "control",
            variant: "sis",
            shape_type: "shape",
            view_box: "0 0 60 44",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 44"
     data-io-shape="interlock" data-io-version="1.0" data-io-category="control"
     data-io-variant="sis">
  <g class="io-shape-body">
    <rect class="io-stateful" x="4" y="2" width="52" height="40"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="30,6 52,22 30,38 8,22"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"interlock-sis","version":"1.0","display_name":"Interlock (SIS / SIF)","category":"instrumentation","subcategory":"interlock","tags":["interlock","SIS","SIF","diamond-in-square"],"recognition_class":"interlock_sis","variants":{"options":{"default":{"file":"interlock-sis.svg","label":"Standard"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 60 44","width":60,"height":44},"connections":[{"id":"nozzle-top","type":"signal","x":30,"y":0,"direction":"top"},{"id":"nozzle-bottom","type":"signal","x":30,"y":44,"direction":"bottom"},{"id":"nozzle-left","type":"signal","x":2,"y":22,"direction":"left"},{"id":"nozzle-right","type":"signal","x":58,"y":22,"direction":"right"}],"textZones":[{"id":"tagname","x":30.0,"y":-6,"width":60,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":0.5,"ny":1.15,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.1},"states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "agitator-turbine",
            display_name: "Agitator — Rushton Turbine",
            category: "agitator",
            variant: "turbine",
            shape_type: "shape_part",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="agitator-turbine" data-io-version="1.0">
  <g class="io-part-agitator">
    <line x1="20" y1="7" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
    <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="13" y1="42" x2="20" y2="42" stroke="#808080" stroke-width="1.5"/>
    <line x1="13" y1="42" x2="13" y2="48" stroke="#808080" stroke-width="1.5"/>
    <line x1="20" y1="42" x2="27" y2="42" stroke="#808080" stroke-width="1.5"/>
    <line x1="27" y1="42" x2="27" y2="48" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"agitator-turbine","version":"1.0","display_name":"Agitator — Turbine","category":"agitators","subcategory":"turbine","tags":["agitator","turbine","mixing","part"],"recognition_class":"agitator_turbine","isPart":true,"partClass":"io-part-agitator","variants":{"options":{"opt1":{"file":"agitator-turbine.svg","label":"Turbine"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"shaft-top","type":"mechanical","x":20,"y":7,"direction":"top"}],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "agitator-propeller",
            display_name: "Agitator — Marine Propeller",
            category: "agitator",
            variant: "propeller",
            shape_type: "shape_part",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="agitator-propeller" data-io-version="1.0">
  <g class="io-part-agitator">
    <line x1="20" y1="7" x2="20" y2="48" stroke="#808080" stroke-width="1.5"/>
    <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="13" y1="41" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
    <line x1="27" y1="41" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
    <line x1="13" y1="49" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
    <line x1="27" y1="49" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"agitator-propeller","version":"1.0","display_name":"Agitator — Propeller","category":"agitators","subcategory":"propeller","tags":["agitator","propeller","mixing","part"],"recognition_class":"agitator_propeller","isPart":true,"partClass":"io-part-agitator","variants":{"options":{"opt1":{"file":"agitator-propeller.svg","label":"Propeller"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"shaft-top","type":"mechanical","x":20,"y":7,"direction":"top"}],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "agitator-anchor",
            display_name: "Agitator — Anchor",
            category: "agitator",
            variant: "anchor",
            shape_type: "shape_part",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="agitator-anchor" data-io-version="1.0">
  <g class="io-part-agitator">
    <line x1="20" y1="7" x2="20" y2="30" stroke="#808080" stroke-width="1.5"/>
    <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="20" y1="30" x2="14" y2="30" stroke="#808080" stroke-width="1.5"/>
    <line x1="14" y1="30" x2="14" y2="64" stroke="#808080" stroke-width="1.5"/>
    <line x1="14" y1="64" x2="26" y2="64" stroke="#808080" stroke-width="1.5"/>
    <line x1="26" y1="64" x2="26" y2="30" stroke="#808080" stroke-width="1.5"/>
    <line x1="26" y1="30" x2="20" y2="30" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"agitator-anchor","version":"1.0","display_name":"Agitator — Anchor","category":"agitators","subcategory":"anchor","tags":["agitator","anchor","mixing","part"],"recognition_class":"agitator_anchor","isPart":true,"partClass":"io-part-agitator","variants":{"options":{"opt1":{"file":"agitator-anchor.svg","label":"Anchor"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"shaft-top","type":"mechanical","x":20,"y":7,"direction":"top"}],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "agitator-paddle",
            display_name: "Agitator — Flat Paddle",
            category: "agitator",
            variant: "paddle",
            shape_type: "shape_part",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="agitator-paddle" data-io-version="1.0">
  <g class="io-part-agitator">
    <line x1="20" y1="7" x2="20" y2="48" stroke="#808080" stroke-width="1.5"/>
    <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="13" y1="45" x2="27" y2="45" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"agitator-paddle","version":"1.0","display_name":"Agitator — Paddle","category":"agitators","subcategory":"paddle","tags":["agitator","paddle","mixing","part"],"recognition_class":"agitator_paddle","isPart":true,"partClass":"io-part-agitator","variants":{"options":{"opt1":{"file":"agitator-paddle.svg","label":"Paddle"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"shaft-top","type":"mechanical","x":20,"y":7,"direction":"top"}],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "agitator-helical",
            display_name: "Agitator — Helical Ribbon",
            category: "agitator",
            variant: "helical",
            shape_type: "shape_part",
            view_box: "0 0 40 80",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80"
     data-io-shape="agitator-helical" data-io-version="1.0">
  <g class="io-part-agitator">
    <line x1="20" y1="7" x2="20" y2="65" stroke="#808080" stroke-width="1.5"/>
    <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
    <polyline points="14,25 26,32 14,39 26,46 14,53 26,60"
              fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"agitator-helical","version":"1.0","display_name":"Agitator — Helical","category":"agitators","subcategory":"helical","tags":["agitator","helical","mixing","part"],"recognition_class":"agitator_helical","isPart":true,"partClass":"io-part-agitator","variants":{"options":{"opt1":{"file":"agitator-helical.svg","label":"Helical"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 80","width":40,"height":80},"connections":[{"id":"shaft-top","type":"mechanical","x":20,"y":7,"direction":"top"}],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // COMPOSABLE PARTS — Supports (Reactor / Column)
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "support-skirt",
            display_name: "Support — Skirted Base",
            category: "support",
            variant: "skirt",
            shape_type: "shape_part",
            view_box: "0 0 40 86",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 86"
     data-io-shape="support-skirt" data-io-version="1.0">
  <g class="io-part-support">
    <line x1="10" y1="68" x2="10" y2="74" stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="68" x2="30" y2="74" stroke="#808080" stroke-width="1.5"/>
    <line x1="5" y1="74" x2="35" y2="74" stroke="#808080" stroke-width="1.5"/>
    <line x1="5" y1="74" x2="5" y2="80" stroke="#808080" stroke-width="1.5"/>
    <line x1="35" y1="74" x2="35" y2="80" stroke="#808080" stroke-width="1.5"/>
    <line x1="3" y1="80" x2="37" y2="80" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"support-skirt","version":"1.0","display_name":"Support — Skirt","category":"supports","subcategory":"skirt","tags":["support","skirt","vessel","part"],"recognition_class":"support_skirt","isPart":true,"partClass":"io-part-support","variants":{"options":{"opt1":{"file":"support-skirt.svg","label":"Skirt"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 86","width":40,"height":86},"connections":[],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "support-legs-3",
            display_name: "Support — 3 Splayed Legs",
            category: "support",
            variant: "legs-3",
            shape_type: "shape_part",
            view_box: "0 0 40 86",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 86"
     data-io-shape="support-legs-3" data-io-version="1.0">
  <g class="io-part-support">
    <line x1="12" y1="68" x2="7" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="20" y1="68" x2="20" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="28" y1="68" x2="33" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="4" y1="82" x2="10" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="17" y1="82" x2="23" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="30" y1="82" x2="36" y2="82" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"support-legs-3","version":"1.0","display_name":"Support — 3 Splayed Legs","category":"supports","subcategory":"legs","tags":["support","legs","3-leg","vessel","part"],"recognition_class":"support_legs_3","isPart":true,"partClass":"io-part-support","variants":{"options":{"opt1":{"file":"support-legs-3.svg","label":"3 Legs"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 86","width":40,"height":86},"connections":[],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "support-legs-4",
            display_name: "Support — 4 Straight Legs",
            category: "support",
            variant: "legs-4",
            shape_type: "shape_part",
            view_box: "0 0 40 86",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 86"
     data-io-shape="support-legs-4" data-io-version="1.0">
  <g class="io-part-support">
    <line x1="12" y1="68" x2="12" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="18" y1="68" x2="18" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="22" y1="68" x2="22" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="28" y1="68" x2="28" y2="82" stroke="#808080" stroke-width="1.5"/>
    <line x1="8" y1="82" x2="32" y2="82" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"support-legs-4","version":"1.0","display_name":"Support — 4 Straight Legs","category":"supports","subcategory":"legs","tags":["support","legs","4-leg","vessel","part"],"recognition_class":"support_legs_4","isPart":true,"partClass":"io-part-support","variants":{"options":{"opt1":{"file":"support-legs-4.svg","label":"4 Legs"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 86","width":40,"height":86},"connections":[],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // COMPOSABLE PARTS — Tank Supports
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "support-legs-splayed",
            display_name: "Support — Splayed Legs (Tank)",
            category: "support",
            variant: "splayed",
            shape_type: "shape_part",
            view_box: "0 0 70 20",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 20"
     data-io-shape="support-legs-splayed" data-io-version="1.0" data-io-category="support">
  <line x1="19" y1="0" x2="14" y2="17"
        stroke="#808080" stroke-width="1.5"/>
  <line x1="51" y1="0" x2="56" y2="17"
        stroke="#808080" stroke-width="1.5"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"support-legs-splayed","version":"1.0","display_name":"Support — Splayed Legs","category":"supports","subcategory":"legs","tags":["support","legs","splayed","vessel","part"],"recognition_class":"support_legs_splayed","isPart":true,"partClass":"io-part-support","variants":{"options":{"opt1":{"file":"support-legs-splayed.svg","label":"Splayed Legs"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 70 20","width":70,"height":20},"connections":[],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        ShapeSeed {
            shape_id: "support-saddles",
            display_name: "Support — Saddle Cradles (Tank)",
            category: "support",
            variant: "saddles",
            shape_type: "shape_part",
            view_box: "0 0 80 14",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 14"
     data-io-shape="support-saddles" data-io-version="1.0" data-io-category="support">
  <line x1="20" y1="0" x2="17" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="24" y1="0" x2="24" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="17" y1="10" x2="24" y2="10" stroke="#808080" stroke-width="0.75"/>
  <line x1="56" y1="0" x2="53" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="60" y1="0" x2="60" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="53" y1="10" x2="60" y2="10" stroke="#808080" stroke-width="0.75"/>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"support-saddles","version":"1.0","display_name":"Support — Saddles","category":"supports","subcategory":"saddles","tags":["support","saddles","horizontal-vessel","part"],"recognition_class":"support_saddles","isPart":true,"partClass":"io-part-support","variants":{"options":{"opt1":{"file":"support-saddles.svg","label":"Saddles"}},"configurations":[]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 80 14","width":80,"height":14},"connections":[],"textZones":[],"valueAnchors":[],"alarmAnchor":null,"states":{},"addons":[],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left"],"FillGauge":["right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"bottom","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Equipment Body","category":"process"}]}"#,
        },
        // ---------------------------------------------------------------
        // DISTILLATION COLUMNS — New variants (narrow/wide trayed-10 and packed)
        // ---------------------------------------------------------------
        ShapeSeed {
            shape_id: "column-distillation-narrow-trayed-10",
            display_name: "Distillation Column Narrow (10 Trays)",
            category: "separation",
            variant: "narrow-trayed-10",
            shape_type: "shape",
            view_box: "0 0 40 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="narrow-trayed-10">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A8,5 0 0,1 28,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="12" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="28" y1="10" x2="28" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M12,110 A8,5 0 0,0 28,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="19" x2="28" y2="19" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="28" x2="28" y2="28" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="38" x2="28" y2="38" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="48" x2="28" y2="48" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="57" x2="28" y2="57" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="66" x2="28" y2="66" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="75" x2="28" y2="75" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="84" x2="28" y2="84" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="93" x2="28" y2="93" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="102" x2="28" y2="102" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-narrow-trayed-10","version":"1.0","display_name":"Column — Narrow Trayed-10","category":"columns","subcategory":"distillation","tags":["column","distillation","narrow","trayed"],"recognition_class":"column_distillation_narrow_trayed_10","variants":{"options":{},"configurations":[{"file":"column-distillation-narrow-trayed-10.svg","label":"Narrow Trayed-10"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 120","width":40,"height":120},"connections":[{"id":"feed","type":"process","x":12,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":20,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":20,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-8,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M12,10 A8,5 0 0,1 28,10 L28,110 A8,5 0 0,1 12,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-narrow-packed",
            display_name: "Distillation Column Narrow (Packed)",
            category: "separation",
            variant: "narrow-packed",
            shape_type: "shape",
            view_box: "0 0 40 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="narrow-packed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M12,10 A8,5 0 0,1 28,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="10" x2="12" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="28" y1="10" x2="28" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M12,110 A8,5 0 0,0 28,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="12" y1="22" x2="28" y2="22" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="52" x2="28" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="22" x2="28" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="28" y1="22" x2="12" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="62" x2="28" y2="62" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="100" x2="28" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="12" y1="62" x2="28" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="28" y1="62" x2="12" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-narrow-packed","version":"1.0","display_name":"Column — Narrow Packed","category":"columns","subcategory":"distillation","tags":["column","distillation","narrow","packed"],"recognition_class":"column_distillation_narrow_packed","variants":{"options":{},"configurations":[{"file":"column-distillation-narrow-packed.svg","label":"Narrow Packed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 40 120","width":40,"height":120},"connections":[{"id":"feed","type":"process","x":12,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":20,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":20,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":20,"y":-8,"width":40,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M12,10 A8,5 0 0,1 28,10 L28,110 A8,5 0 0,1 12,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-wide-trayed-10",
            display_name: "Distillation Column Wide (10 Trays)",
            category: "separation",
            variant: "wide-trayed-10",
            shape_type: "shape",
            view_box: "0 0 50 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="wide-trayed-10">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A15,5 0 0,1 40,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="40" y1="10" x2="40" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A15,5 0 0,0 40,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="19" x2="40" y2="19" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="28" x2="40" y2="28" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="38" x2="40" y2="38" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="48" x2="40" y2="48" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="57" x2="40" y2="57" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="66" x2="40" y2="66" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="75" x2="40" y2="75" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="84" x2="40" y2="84" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="93" x2="40" y2="93" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="102" x2="40" y2="102" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-wide-trayed-10","version":"1.0","display_name":"Column — Wide Trayed-10","category":"columns","subcategory":"distillation","tags":["column","distillation","wide","trayed"],"recognition_class":"column_distillation_wide_trayed_10","variants":{"options":{},"configurations":[{"file":"column-distillation-wide-trayed-10.svg","label":"Wide Trayed-10"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 120","width":50,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":25,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":25,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":25,"y":-8,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,10 A15,5 0 0,1 40,10 L40,110 A15,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
        ShapeSeed {
            shape_id: "column-distillation-wide-packed",
            display_name: "Distillation Column Wide (Packed)",
            category: "separation",
            variant: "wide-packed",
            shape_type: "shape",
            view_box: "0 0 50 120",
            svg_data: r##"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 120"
     data-io-shape="column-distillation" data-io-version="1.0"
     data-io-variant="wide-packed">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M10,10 A15,5 0 0,1 40,10"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="10" x2="10" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="40" y1="10" x2="40" y2="110"
          stroke="#808080" stroke-width="1.5"/>
    <path class="io-stateful"
          d="M10,110 A15,5 0 0,0 40,110"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="10" y1="22" x2="40" y2="22" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="52" x2="40" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="22" x2="40" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="40" y1="22" x2="10" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="62" x2="40" y2="62" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="100" x2="40" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="62" x2="40" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="40" y1="62" x2="10" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
"##,
            sidecar: r#"{"$schema":"io-shape-v1","shape_id":"column-distillation-wide-packed","version":"1.0","display_name":"Column — Wide Packed","category":"columns","subcategory":"distillation","tags":["column","distillation","wide","packed"],"recognition_class":"column_distillation_wide_packed","variants":{"options":{},"configurations":[{"file":"column-distillation-wide-packed.svg","label":"Wide Packed"}]},"alarmBinding":{"stateSource":"point_alarm_state","priorityMapping":{"1":"alarm_critical","2":"alarm_high","3":"alarm_medium","4":"alarm_advisory"},"unacknowledgedFlash":true,"flashRate":"1Hz"},"geometry":{"viewBox":"0 0 50 120","width":50,"height":120},"connections":[{"id":"feed","type":"process","x":10,"y":60,"direction":"left"},{"id":"overhead-vapor","type":"process","x":25,"y":10,"direction":"top"},{"id":"bottoms","type":"process","x":25,"y":110,"direction":"bottom"}],"textZones":[{"id":"tagname","x":25,"y":-8,"width":50,"anchor":"middle","fontSize":11}],"valueAnchors":[{"nx":1.2,"ny":0.5,"preferredElement":"text_readout"}],"alarmAnchor":{"nx":1.1,"ny":-0.05},"vesselInteriorPath":"M10,10 A15,5 0 0,1 40,10 L40,110 A15,5 0 0,1 10,110 Z","states":{"running":"io-running","stopped":"io-stopped","fault":"io-fault","transitioning":"io-transitioning","oos":"io-oos"},"addons":[{"id":"support-skirt","file":"support-skirt.svg","label":"Skirt Support","group":"support","exclusive":true},{"id":"support-legs-3","file":"support-legs-3.svg","label":"3-Point Legs","group":"support","exclusive":true},{"id":"support-legs-4","file":"support-legs-4.svg","label":"4-Point Legs","group":"support","exclusive":true}],"anchorSlots":{"PointNameLabel":["top","right","bottom","left"],"AlarmIndicator":["top-right","top-left","bottom-right","bottom-left"],"TextReadout":["top","right","bottom","left"],"AnalogBar":["right","left","vessel-interior"],"FillGauge":["vessel-interior","right","left"],"Sparkline":["right-top","right-bottom","left-top","left-bottom"],"DigitalStatus":["top","right","bottom","left"]},"defaultSlots":{"AlarmIndicator":"top-right","TextReadout":"right","AnalogBar":"right","Sparkline":"right-top","PointNameLabel":"top"},"bindableParts":[{"partId":"body","label":"Column Body","category":"equipment"}]}"#,
        },
    ]
}
