# Inside/Operations - Graphics System Design

## Overview

SVG-based graphics rendering with point bindings for real-time data display.

## SVG Rendering

### Hybrid SVG/Canvas Rendering

Graphics use a hybrid rendering pipeline that combines Canvas efficiency for static content with SVG flexibility for dynamic, data-bound elements.

**Element Classification:**

On graphic load, every element is classified as either **static** or **dynamic**:

- **Static elements**: No `data-bind`, `data-point-id`, or click handler attributes. These are structural elements — pipes, labels, borders, background shapes, decorative elements, and stencils (reusable visual elements without data binding — see doc 35). They never change at runtime.
- **Dynamic elements**: Bound to points (`data-point-id`), clickable (equipment with detail popups), or animated. These change in response to real-time data or user interaction.

**Rendering Pipeline:**

1. Parse the graphic SVG and classify all elements
2. Extract static elements into a separate SVG fragment
3. Render the static SVG fragment to a **Canvas bitmap** using `canvg` (MIT license) or native `createImageBitmap()` — this produces a single DOM node for the entire background layer
4. Overlay **dynamic elements as live SVG** on top of the Canvas bitmap — small DOM footprint, preserves the existing point binding system, value mapping, CSS animations, and click handling
5. Both layers (Canvas background + SVG overlay) share the same coordinate space within a common container `div`

**Pan/Zoom:**

CSS `transform: scale() translate()` applied to the container div scales both layers uniformly. No separate transform logic needed.

**Zoom Clarity:**

The Canvas bitmap may appear soft at high zoom levels (raster scaling). Solution: debounced re-render of the Canvas bitmap at the current zoom level (~200ms after zoom stops). Dynamic SVG elements remain crisp at all zoom levels since they are vector.

**Auto-Enable Threshold:**

- Below 3,000 total elements: pure SVG rendering (simpler, no classification overhead, no Canvas layer)
- At or above 3,000 total elements: hybrid mode activates automatically
- Users cannot toggle this manually — it is a transparent optimization

**Performance Impact:**

A graphic with 10,000 total elements but 500 dynamic points becomes 1 Canvas node + ~500 SVG nodes = ~501 DOM nodes, instead of 10,000 DOM nodes in pure SVG mode. This directly addresses the browser DOM performance cliff that occurs around 5,000–8,000 SVG nodes.

**What stays the same:** Point binding system (`data-point-id`, `data-point-attr`), value mapping and color changes, CSS transitions and animations, click handling on equipment, the `.io` graphic file format, the Graphics Storage schema. Hybrid rendering is a runtime rendering optimization — not a format or data model change.

**What changes:** The rendering pipeline adds a static/dynamic classification step. LOD (Level of Detail) can be smarter — at far zoom levels, the SVG overlay can optionally be hidden entirely, showing just the Canvas bitmap for maximum performance.

### Pipe Coloring by Service Type

Pipes are static structural elements — they have no data binding and do not change at runtime. By default, pipes use a muted color palette based on the fluid service type they carry, following industry conventions (ASME A13.1 pipe marking). The colors are desaturated to avoid competing with alarm colors or equipment state colors.

#### Service Type Palette

| Service Type | Contents | Color | Hex |
|---|---|---|---|
| Process | Hydrocarbon liquid, mixed phase | Muted steel blue | `#6B8CAE` |
| Gas / Vapor | Gas, vapor, flare gas | Muted tan | `#B8926A` |
| Steam | HP / MP / LP steam | Light gray | `#9CA3AF` |
| Water | Cooling water, BFW, potable, firewater | Muted teal | `#5B9EA6` |
| Fuel Gas | Fuel gas, pilot gas | Muted gold | `#C4A95A` |
| Chemical | Caustic, acid, amine, catalyst | Muted purple | `#9B7CB8` |
| Instrument Air | IA, plant air, nitrogen | Muted sage | `#7A9B7A` |
| Drain / Sewer | CBD, process drain, oily water sewer | Muted brown | `#8B7355` |

**Design rationale:**
- All colors are desaturated (40-50% saturation). No pure red, amber, yellow, or cyan — those are reserved for alarm indication.
- Steam is a lighter gray (`#9CA3AF`) rather than white — white is too high-contrast for a background element. Distinct from equipment stroke gray (`#808080`).
- Colors are distinguishable from each other and from the `#09090B` dark background at both normal and zoomed-out scales.

#### Stroke Width

| Line Type | Width |
|---|---|
| Main process lines | 2px |
| Utility lines (steam, water, fuel gas) | 1.5px |
| Instrument / signal lines | 1px |

#### Monochrome Mode

Users can switch to monochrome pipes via Settings → Graphics → "Pipe Color: By Service / Monochrome". Monochrome renders all pipes as `#808080` regardless of service type. Default is **By Service**.

#### Implementation

- Pipe objects in the graphic store a `service_type` enum property: `process`, `gas_vapor`, `steam`, `water`, `fuel_gas`, `chemical`, `instrument_air`, `drain`
- Designer assigns service type on pipe creation (dropdown in pipe properties panel, also available via right-click)
- The color is set at design time and baked into the static Canvas bitmap at render time
- DCS import maps vendor pipe colors/line styles to these service types (best-effort heuristic, manual correction available in Designer)
- Monochrome mode is a runtime rendering flag — the stored `service_type` is preserved even in monochrome mode

### Point Binding
```svg
<rect id="tank-1"
      data-point-id="uuid-1234"
      data-point-attr="fill"
      fill="#808080"
      width="100" height="200" />
```
- `data-point-id`: references a `points_metadata(id)` UUID which includes source context from the multi-source point model
- `data-point-attr`: Which SVG attribute to update (fill, stroke, opacity, transform)
- Point metadata includes source context, criticality, and area -- useful for graphic overlays and tooltips
- React updates attribute when point value changes

### Value Mapping
```typescript
// Map point value to SVG attribute
function mapValueToAttribute(value: number, attr: string, config: MappingConfig) {
    if (attr === 'fill') {
        // Value range to color range
        return interpolateColor(value, config.min, config.max, config.colorScale);
    } else if (attr === 'transform') {
        // Value to rotation or translation
        return `rotate(${value} ${config.cx} ${config.cy})`;
    }
    // ... other attribute types
}
```

### Animation
- Use CSS transitions for smooth updates: `transition: fill 0.3s ease;`
- RequestAnimationFrame for complex animations
- Pause animations when graphic not visible (performance)

## Graphics Storage

### Database Schema
```sql
CREATE TABLE design_objects (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(50), -- 'graphic', 'template', 'symbol'
    svg_data TEXT, -- SVG XML
    bindings JSONB, -- {element_id: {point_id, attribute, mapping}}
    metadata JSONB, -- {width, height, viewBox, etc.}
    parent_id UUID REFERENCES design_objects(id), -- template/instance hierarchy (instances reference their source template)
    created_by UUID,
    created_at TIMESTAMPTZ
);
```

### Bindings JSONB Schema

The `design_objects.bindings` column stores a JSONB object keyed by SVG element ID. This is the contract between Designer (writes bindings), Parser Service (generates bindings on import), and the runtime rendering pipeline (reads bindings). All three must produce/consume this exact schema.

**Implementation:** Defined as Rust structs in `io-models` crate (`GraphicBindings`, `ElementBinding`, `BindingMapping`) and TypeScript interfaces in `src/shared/types/graphics.ts`. Validated on write by Designer and Parser Service. The rendering pipeline reads without re-validation (trusted internal data).

#### Root Structure

```typescript
// design_objects.bindings JSONB
// Key = SVG element ID (string matching the `id` attribute on an SVG element)
type GraphicBindings = Record<string, ElementBinding>;

interface ElementBinding {
  point_id: string;              // UUID — references points_metadata(id)
  attribute: BindingAttribute;   // which SVG attribute to update
  mapping: BindingMapping;       // how to transform point value → attribute value
  point_state_id?: string;       // UUID — optional second point for state class binding
  point_state_attr?: 'class';    // always 'class' when present
}

type BindingAttribute = 'fill' | 'stroke' | 'opacity' | 'transform' | 'visibility' | 'text' | 'class';
```

#### Mapping Types (discriminated on `type`)

```typescript
type BindingMapping =
  | LinearColorMapping
  | ThresholdColorMapping
  | RotationMapping
  | TranslationMapping
  | ScaleMapping
  | VisibilityMapping
  | TextMapping
  | StateClassMapping
  | AnalogBarMapping
  | FillGaugeMapping
  | SparklineMapping
  | AlarmIndicatorMapping;

// Continuous color interpolation between two or more stops
interface LinearColorMapping {
  type: 'linear';
  min: number;              // point value at low end
  max: number;              // point value at high end
  color_scale: string[];    // array of hex colors, evenly distributed across [min, max]
}

// Discrete color assignment based on value ranges
interface ThresholdColorMapping {
  type: 'threshold';
  thresholds: ThresholdStop[];
  default_color: string;    // hex — used when value is below first threshold
}

interface ThresholdStop {
  value: number;            // point value at which this color activates (>=)
  color: string;            // hex color
}

// Rotate element around a center point
interface RotationMapping {
  type: 'rotation';
  min_value: number;        // point value corresponding to min_angle
  max_value: number;        // point value corresponding to max_angle
  min_angle: number;        // degrees
  max_angle: number;        // degrees
  cx: number;               // rotation center X (SVG coordinates)
  cy: number;               // rotation center Y (SVG coordinates)
}

// Translate element along X and/or Y axis
interface TranslationMapping {
  type: 'translation';
  min_value: number;
  max_value: number;
  dx: [number, number];     // [min_dx, max_dx] in SVG units
  dy: [number, number];     // [min_dy, max_dy] in SVG units
}

// Scale element (e.g., tank fill level)
interface ScaleMapping {
  type: 'scale';
  min_value: number;
  max_value: number;
  axis: 'x' | 'y' | 'both';
  min_scale: number;        // scale factor at min_value (e.g., 0.0)
  max_scale: number;        // scale factor at max_value (e.g., 1.0)
  origin_x: number;         // transform-origin X
  origin_y: number;         // transform-origin Y
}

// Show/hide element based on value
interface VisibilityMapping {
  type: 'visibility';
  visible_when: 'nonzero' | 'zero' | 'above' | 'below' | 'between';
  threshold?: number;       // required for 'above' and 'below'
  range?: [number, number]; // required for 'between'
}

// Display point value as text (e.g., numeric readout)
interface TextMapping {
  type: 'text';
  format: string;           // printf-style: "%.1f", "%.0f", "%d"
  suffix?: string;          // e.g., " °F", " PSI"
  prefix?: string;          // e.g., "T: "
}

// Apply CSS class based on discrete states
interface StateClassMapping {
  type: 'state_class';
  states: Record<string, string>;  // point_value (as string) → CSS class name
  default_class: string;           // fallback when value matches no state
}

// Analog bar indicator — segmented zone bar with moving pointer
interface AnalogBarMapping {
  type: 'analog_bar';
  range_lo: number;               // overall instrument range low
  range_hi: number;               // overall instrument range high
  desired_lo?: number;            // normal operating band low
  desired_hi?: number;            // normal operating band high
  setpoint_point_id?: string;     // UUID — optional separate point for setpoint marker
  orientation?: 'vertical' | 'horizontal' | 'auto'; // default 'auto'
  show_value?: boolean;           // numeric readout adjacent to bar
  value_format?: string;          // printf-style format
}

// Fill gauge — 0-100% level fill for vessels/tanks or standalone bar
interface FillGaugeMapping {
  type: 'fill_gauge';
  range_lo: number;               // empty value
  range_hi: number;               // full value
  fill_direction?: 'up' | 'right'; // default 'up'
  placement?: 'vessel_overlay' | 'standalone'; // default 'standalone'
  clip_to_shape_id?: string;      // SVG element ID of vessel shape for clipping (vessel_overlay mode)
  show_value?: boolean;           // numeric overlay
  show_setpoint?: boolean;        // horizontal setpoint line
  show_threshold_markers?: boolean; // tick marks at alarm levels
  value_format?: string;
}

// Sparkline — tiny inline trend on graphics canvas
interface SparklineMapping {
  type: 'sparkline';
  time_window_minutes: number;    // lookback duration (default 60)
  scale_mode: 'auto' | 'fixed';  // auto = data range, fixed = point range
  show_desired_band?: boolean;    // faint band behind sparkline
  show_threshold_lines?: boolean; // faint H/HH/L/LL lines
  stroke_width?: number;          // default 1.5
}

// Alarm indicator — ISA-101 priority-coded shape near equipment
interface AlarmIndicatorMapping {
  type: 'alarm_indicator';
  mode: 'single' | 'aggregate';  // single point or equipment aggregate
  equipment_point_ids?: string[]; // UUIDs — for aggregate mode, all points on this equipment
}
```

#### Rust Equivalent

```rust
// In io-models crate
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ElementBinding {
    pub point_id: Uuid,
    pub attribute: BindingAttribute,
    pub mapping: BindingMapping,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_state_id: Option<Uuid>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_state_attr: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "snake_case")]
pub enum BindingAttribute {
    Fill, Stroke, Opacity, Transform, Visibility, Text, Class,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BindingMapping {
    Linear { min: f64, max: f64, color_scale: Vec<String> },
    Threshold { thresholds: Vec<ThresholdStop>, default_color: String },
    Rotation { min_value: f64, max_value: f64, min_angle: f64, max_angle: f64, cx: f64, cy: f64 },
    Translation { min_value: f64, max_value: f64, dx: [f64; 2], dy: [f64; 2] },
    Scale { min_value: f64, max_value: f64, axis: ScaleAxis, min_scale: f64, max_scale: f64, origin_x: f64, origin_y: f64 },
    Visibility { visible_when: VisibilityCondition, threshold: Option<f64>, range: Option<[f64; 2]> },
    Text { format: String, suffix: Option<String>, prefix: Option<String> },
    StateClass { states: HashMap<String, String>, default_class: String },
    AnalogBar { range_lo: f64, range_hi: f64, desired_lo: Option<f64>, desired_hi: Option<f64>, setpoint_point_id: Option<Uuid>, orientation: Option<String>, show_value: Option<bool>, value_format: Option<String> },
    FillGauge { range_lo: f64, range_hi: f64, fill_direction: Option<String>, placement: Option<String>, clip_to_shape_id: Option<String>, show_value: Option<bool>, show_setpoint: Option<bool>, show_threshold_markers: Option<bool>, value_format: Option<String> },
    Sparkline { time_window_minutes: u32, scale_mode: String, show_desired_band: Option<bool>, show_threshold_lines: Option<bool>, stroke_width: Option<f64> },
    AlarmIndicator { mode: String, equipment_point_ids: Option<Vec<Uuid>> },
}
```

#### Example (complete)

```json
{
    "tank-1-fill": {
        "point_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "attribute": "fill",
        "mapping": {
            "type": "linear",
            "min": 0,
            "max": 100,
            "color_scale": ["#0000ff", "#00ff00", "#ff0000"]
        }
    },
    "tank-1-level": {
        "point_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "attribute": "transform",
        "mapping": {
            "type": "scale",
            "min_value": 0,
            "max_value": 100,
            "axis": "y",
            "min_scale": 0.0,
            "max_scale": 1.0,
            "origin_x": 50,
            "origin_y": 200
        }
    },
    "tank-1-readout": {
        "point_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "attribute": "text",
        "mapping": {
            "type": "text",
            "format": "%.1f",
            "suffix": " %"
        }
    },
    "valve-2": {
        "point_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "attribute": "transform",
        "mapping": {
            "type": "rotation",
            "min_value": 0,
            "max_value": 100,
            "min_angle": 0,
            "max_angle": 90,
            "cx": 50,
            "cy": 50
        },
        "point_state_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "point_state_attr": "class"
    },
    "pump-3-body": {
        "point_id": "d4e5f6a7-b8c9-0123-defa-234567890123",
        "attribute": "class",
        "mapping": {
            "type": "state_class",
            "states": {
                "0": "equipment-symbol closed",
                "1": "equipment-symbol open",
                "2": "equipment-symbol transitioning"
            },
            "default_class": "equipment-symbol"
        }
    },
    "alarm-indicator-7": {
        "point_id": "e5f6a7b8-c9d0-1234-efab-345678901234",
        "attribute": "visibility",
        "mapping": {
            "type": "visibility",
            "visible_when": "nonzero"
        }
    }
}
```

## Import System

### File Upload Flow
1. User uploads graphics file via Designer module
2. Frontend sends to `/api/designer/import`
3. Parser Service detects file format
4. Parser extracts SVG or converts to SVG
5. Parser extracts point bindings (tagnames)
6. Parser looks up point_ids for tagnames
7. Parser generates bindings JSONB
8. Parser stores in design_objects table
9. API returns graphic_id

### Format Support
- **SVG:** Direct import (parse XML, extract bindings)
- **Other formats:** To be determined based on requirements
- Extensible parser architecture for adding formats

## Performance Optimization

### Viewport Culling
- Only render graphics visible in viewport
- Use Intersection Observer API
- Unsubscribe points for off-screen graphics

### Level of Detail (LOD)
- Simplify graphics when zoomed out
- Full detail when zoomed in
- Trade-off between quality and performance

### Virtualization
- For grids with many graphics (Console module)
- Only render visible panes
- Lazy load off-screen panes

### Caching
- Cache rendered graphics in memory
- Cache point value lookups
- Invalidate cache on data change

## P&ID Symbol Templates

When P&ID Recognition detects symbols in an imported drawing (see [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md)), accepted detections are mapped to SVG templates from I/O's symbol library to generate editable graphics.

### ISA-101 HMI Symbol Template Library

I/O ships a built-in library of SVG symbol templates styled to ISA-101 HMI standards. Each template is a `design_objects` record with `type = 'template'`:

- Templates use standardized dimensions, color conventions, and element IDs
- Every template includes point binding placeholders (`data-point-id`, `data-point-attr`) so generated graphics are immediately ready for live data binding
- Templates are organized by symbol category (e.g., valves, instruments, vessels, pumps, heat exchangers)
- Admins can add custom templates or override built-in templates via the Designer Module

### Class-to-Template Mapping

Each symbol class in the recognition model's `class_map.json` maps to an SVG template in the library:

```json
{
    "class_id": 5,
    "class_name": "gate_valve",
    "template_id": "uuid-of-gate-valve-template"
}
```

- The mapping table is stored as a system configuration (`settings` key: `recognition_class_template_map`)
- When a new `.iomodel` is loaded, the system compares its class list against existing mappings and flags any unmapped classes
- Admins can update the mapping via Settings > Recognition without reloading the model
- A single template can serve multiple symbol classes (e.g., a generic valve template for valve subtypes that share the same HMI representation)

### Unmapped Symbol Handling

When a recognized symbol class has no corresponding SVG template:

- The symbol is marked as **unmapped** in the recognition review UI (Designer import wizard)
- Unmapped symbols are displayed as a dashed bounding box with the class name label, not silently dropped
- The user can: assign an existing template manually, skip the symbol (exclude from generated graphic), or create a new template in Designer and assign it
- The Settings > Recognition panel shows a count of unmapped classes so admins know when new templates are needed after a model update

### Generation Pipeline

During graphic generation (step 6 of the recognition inference pipeline in [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md)):

1. Each accepted detection is looked up in the class-to-template map
2. The matching SVG template is cloned and positioned at the detection's bounding box coordinates
3. OCR-extracted tag numbers are matched to symbol locations and inserted as point binding placeholders
4. All placed templates are composed into a single SVG document and stored as a new `design_objects` record with `type = 'graphic'`
5. The user opens the generated graphic in Designer for manual refinement (connection lines, layout adjustments, binding completion)

## DCS Symbol Templates

DCS SVG templates are used by two import paths: screenshot-based recognition (see [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md)) and native DCS file import (see [34_DCS_GRAPHICS_IMPORT.md](34_DCS_GRAPHICS_IMPORT.md)). Both paths map detected/extracted equipment to templates from the Shape Library (see [35_SHAPE_LIBRARY.md](35_SHAPE_LIBRARY.md)).

### ISA-101 High Performance HMI Template Library

I/O ships a built-in library of DCS SVG symbol templates designed to ISA-101 High Performance HMI principles:

- **2D flat design**: No gradients, no 3D effects. Clean, distraction-free representations
- **Gray baseline**: Equipment renders in gray (#808080) by default. Color is reserved exclusively for state indication
- **CSS class-based state switching**: Each template supports state classes that change appearance via CSS:
  ```css
  .equipment-symbol .io-stateful { fill: transparent; stroke: #808080; }                /* Normal — gray outline, no fill */
  .equipment-symbol.io-running .io-stateful { fill: #059669; stroke: #047857; }        /* Running */
  .equipment-symbol.io-open .io-stateful { fill: #059669; stroke: #047857; }           /* Open */
  .equipment-symbol.io-stopped .io-stateful { fill: transparent; stroke: #808080; }    /* Stopped — outline only */
  .equipment-symbol.io-closed .io-stateful { fill: transparent; stroke: #808080; }     /* Closed — outline only */
  .equipment-symbol.io-transitioning .io-stateful { fill: #FFAA00; stroke: #D97706; }  /* In transition */
  .equipment-symbol.io-fault .io-stateful { fill: #D946EF; stroke: #C026D3; }          /* Fault — magenta */
  .equipment-symbol.io-manual .io-stateful { /* No fill change — "M" indicator overlay instead */ }
  .equipment-symbol.io-oos .io-stateful { fill: url(#io-hatch-pattern); }              /* Out of service — diagonal hatch */
  /* NOTE: Equipment shapes do NOT change color for alarm state.
     Alarm indication uses separate Alarm Indicator elements.
     See Point Value Display Elements section. */
  ```
- **Data attribute state binding**: State is driven by point data via `data-point-state-id` attribute:
  ```svg
  <g class="equipment-symbol"
     data-point-id="uuid-1234"
     data-point-attr="fill"
     data-point-state-id="uuid-5678"
     data-point-state-attr="class">
      <!-- Symbol body -->
  </g>
  ```
- **Composable sub-components**: Complex equipment is composed from standardized parts:
  - Body (valve body, pump casing, vessel shell)
  - Actuator (manual, pneumatic, electric, hydraulic)
  - State overlay (alarm indicator, position indicator)
  - Value display (measurement readout area)

  Example: A pneumatic control valve = valve_body + actuator_pneumatic + position_indicator

### 25 Tier 1 Equipment Types

The DCS template library covers 25 core equipment types identified through SymBA's variation tracking research:

| Category | Equipment Types |
|----------|----------------|
| Valves | Gate, Globe, Ball, Butterfly, Control, Relief |
| Pumps | Centrifugal, Positive Displacement |
| Rotating | Compressor, Fan/Blower, Motor |
| Heat Transfer | Shell & Tube Exchanger, Plate Exchanger |
| Vessels | Vertical, Horizontal, Storage Tank, Reactor |
| Separation | Distillation Column, Filter, Mixer |
| Instrumentation | Pressure Indicator, Temperature Indicator, Flow Indicator, Level Indicator |
| Control | Controller, Alarm/Annunciator, Interlock |

Each equipment type has a base template with sub-variants (e.g., gate valve has manual, pneumatic, and electric actuator variants).

### DCS Class-to-Template Mapping

Similar to P&ID mapping, DCS symbol classes map to SVG templates:

```json
{
    "model_domain": "dcs",
    "class_id": 0,
    "class_name": "valve_gate",
    "template_id": "uuid-of-dcs-gate-valve-template"
}
```

- The mapping table is stored as a system configuration (`settings` key: `recognition_dcs_class_template_map`)
- DCS and P&ID mappings are separate configurations (keyed by `model_domain`)
- SymBA's `.iogap` reports identify which equipment types need additional template variants

### Variation Coverage

SymBA's variation tracking system catalogs 250-450 visual variations across the 25 Tier 1 equipment types. I/O's template library does not need one template per variation — multiple variations map to the same template when they share the same HMI function. The `.iogap` report helps admins identify when a template gap is causing poor recognition-to-display mapping.

## Design Object Point Index

The `design_object_points` junction table maintains a reverse index from design objects to their bound points:

```sql
CREATE TABLE design_object_points (
    design_object_id UUID NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    point_id UUID NOT NULL,
    PRIMARY KEY (design_object_id, point_id)
);
```

**Purpose:** Enables the Point Detail panel (doc 32) to show "Which graphics contain this point?" without scanning all SVG bindings at query time.

**Maintenance:** Populated by a trigger on `design_objects` INSERT/UPDATE that parses the `bindings` JSONB and inserts/updates the junction rows. When a graphic's bindings change (e.g., in Designer), the trigger replaces the junction rows for that design object.

See doc 04 for the full table DDL.

## Point Value Display Elements

I/O supports 6 display element types on graphics. Each is an independent SVG element (or element group) placed on the canvas, bound to one or more data points. All modules rendering graphics (Console, Process, Designer, Dashboards, Reports, Forensics) use these elements.

### Display Element Types

| # | Element | Description | Binding | New/Existing |
|---|---|---|---|---|
| 1 | **Text Readout** | Numeric value ± label ± units ± background box | Single point | Existing (`TextMapping`) — extended |
| 2 | **Analog Bar Indicator** | Segmented zone bar with moving pointer, alarm zone highlighting | Single point | New (`AnalogBarMapping`) |
| 3 | **Fill Gauge** | 0-100% level fill inside vessel outline or standalone rectangle | Single point | New (`FillGaugeMapping`) |
| 4 | **Sparkline Trend** | Tiny inline SVG trend (~80-120px wide) showing recent value trajectory | Single point | New (`SparklineMapping`) |
| 5 | **Alarm Indicator** | ISA-101 priority-coded shape+color+text element near equipment | Single point or aggregate | New (`AlarmIndicatorMapping`) |
| 6 | **Digital Status** | Binary/discrete state text (RUN/STOP, OPEN/CLOSED, AUTO/MAN) | Single point | Existing (`StateClassMapping`) — extended |

All 6 types can be placed as **shape-attached** (positioned via sidecar anchor — see doc 35) or **free-form** (independent canvas placement).

### Alarm Priority Scheme

I/O uses a 4-level alarm priority scheme aligned with ISA-18.2 / ISA-101 / IEC 60073:

| Priority | Name | CSS Class | Color | Indicator Shape |
|---|---|---|---|---|
| 1 | **Critical** | `.io-alarm-1` | Red `#DC2626` | Rectangle |
| 2 | **High** | `.io-alarm-2` | Amber `#F59E0B` | Triangle |
| 3 | **Medium** | `.io-alarm-3` | Yellow `#EAB308` | Inverted triangle |
| 4 | **Advisory** | `.io-alarm-4` | Cyan `#06B6D4` | Ellipse |
| — | **Custom** | `.io-alarm-custom` | Purple `#7C3AED` (default, configurable) | Diamond |
| — | **Fault** | `.io-fault` | Magenta `#D946EF` | — |

Custom expression-builder alarms default to purple. Users can pick from a constrained palette — colors within a perceptual distance threshold of the 4 ISA priority colors, fault magenta, and green (operational state) are blocked.

### Alarm State Visual Treatment

Based on ISA-18.2 alarm states, each display element applies these visual treatments:

| Alarm State | Border | Background | Flash | Additional |
|---|---|---|---|---|
| **Normal** | None (default gray) | None | No | — |
| **Active + Unacknowledged** | 2px solid, priority color | Priority color @ 20% opacity | 1Hz (border: alarm color ↔ gray) | Audible alert |
| **Active + Acknowledged** | 2px solid, priority color | Priority color @ 20% opacity | No (steady) | — |
| **RTN Unacknowledged** | 1px solid, priority color @ 50% | None | Optional 0.5Hz | — |
| **Shelved** | 1px dashed, gray | None | No | "S" badge |
| **Suppressed** | None | None | No | "SUP" badge or hidden |
| **Out of Service** | None | None | No | "OOS" badge, strikethrough |
| **Latched Unacknowledged** | 2px solid, priority color | Priority color @ 20% opacity | 1Hz | "L" badge |
| **Latched Acknowledged** | 2px solid, priority color | Priority color @ 20% opacity | No | "L" badge |

**Flash rules (universal):** 1Hz (500ms on / 500ms off). Flash the border/background, NEVER the text. Alternate alarm color ↔ gray (not on/off blink). CSS `@keyframes` animation, not JS timers.

### Alarm Indicator Element (ISA-101)

Equipment shapes do NOT change color for alarm state — `io-stateful` handles operational state only (running/stopped/open/closed/transitioning). Alarm indication uses a **separate Alarm Indicator element** placed near the equipment, per ISA-101.

The Alarm Indicator uses triple redundant coding for colorblind accessibility:

| Priority | Shape | Color | Text |
|---|---|---|---|
| 1 Critical | Rectangle (24×18px, rx=2) | Red `#DC2626` | `1` |
| 2 High | Triangle (pointing up, ~20px base) | Amber `#F59E0B` | `2` |
| 3 Medium | Inverted triangle (pointing down, ~20px base) | Yellow `#EAB308` | `3` |
| 4 Advisory | Ellipse (rx=14, ry=10) | Cyan `#06B6D4` | `4` |
| Custom | Diamond (~20px diagonal) | Purple `#7C3AED` (default) | `C` |

**Visual rendering:**

- **Stroke-only shapes** — no fill. 1.5-2px stroke at alarm priority color. This keeps them lightweight and non-distracting on a dense graphic.
- **Priority text:** Centered inside the shape. JetBrains Mono 8-10px, `font-weight: 600`, same color as stroke.
- **Count badge:** When aggregating multiple alarms, the text shows total active alarm count instead of priority number.
- **Size:** Indicator shapes are approximately 20-24px across — large enough to see at normal zoom, small enough not to dominate the graphic.
- **Invisible when normal:** The entire element has `display: none` when no alarm is active. No placeholder, no empty outline — it simply doesn't exist on the canvas.

**Positioning:**

- Default: upper-right of the associated equipment shape, with a **clear gap** (minimum 4-6px) between the indicator and the equipment outline. The indicator must never overlap the equipment shape — this makes both harder to read.
- Sidecar `alarmAnchor` provides the snap position for Quick Bind placement (see doc 35). Designer can reposition freely.
- For instrument bubbles: upper-right of the circle, same clear gap rule.

**Flash behavior (unacknowledged):**

- Entire indicator group (shape + text) flashes at 1Hz via CSS animation. Flash = visible ↔ hidden alternation (opacity 1 ↔ 0, using `step-end` timing for sharp on/off, not fade).
- Acknowledged alarms: steady (no flash).
- RTN unacknowledged: optional slow flash (0.5Hz).

**Aggregation:** When an equipment shape has multiple bound points, the alarm indicator shows the highest-priority active alarm. Priority ranking: unacknowledged > acknowledged > RTN unacknowledged. Across priority levels, higher priority wins (Critical > High > Medium > Advisory). A count badge shows total active alarms when > 1.

### Text Readout

Configurations: value only, value + label, value + background box, value + label + background box. All support alarm state coloring.

**Typography:**

- **Value text:** JetBrains Mono (monospace), `font-variant-numeric: tabular-nums`. Fixed-width digits prevent layout shift as values change. Default size: 11px on canvas (scales with graphic zoom).
- **Label text:** Inter (sans-serif), 8px, `--io-text-muted`. Positioned above value text within the same box. Shows tag name, description, or custom label.
- **Engineering units:** Inline suffix after value (e.g., `145.2 PSI`), same font as value, same color. Consistent abbreviations per UOM. Decimal precision configurable per element via `value_format`.

**Normal state (no alarm):**

- **Value only (no box):** Gray text (`--io-text-secondary` / `#a1a1aa`). No border, no background. Just the value string centered below or beside the associated shape.
- **Value + box:** Background `--io-surface-elevated` (`#27272a`), 1px solid border `--io-border` (`#3f3f46`), border-radius 2px. Label above value inside the box.
- **Alignment:** Value left-aligned within box. Box sized to content with padding: 5px horizontal, 4px vertical.

**In alarm:**

- Background: priority color at 20% opacity (`color-mix(in srgb, var(--io-alarm-color) 20%, transparent)`)
- Border: 2px solid at full alarm priority color (replaces the normal 1px gray border)
- Text color: promoted to `--io-text-primary` (`#e4e4e7`) for contrast against tinted background
- Label text: unchanged (`--io-text-muted`)
- Flash (unacknowledged): border and background alternate between alarm color and gray at 1Hz via CSS `@keyframes`. Text never flashes — always readable.

**Value-only (no box) in alarm:** Text color changes to `--io-text-primary` but no border/background treatment. The alarm state is communicated through the separate Alarm Indicator element. Box variant adds the colored border/background for additional salience.

**Theme note:** All color references in this section use dark-theme hex values for illustration. The actual rendering uses CSS custom properties that resolve per theme. See doc 38 Section 2 for the complete token registry with Light/Dark/HPHMI values.

### Analog Bar Indicator

Segmented zone bar with moving pointer — the ISA-101 "moving analog indicator." NOT a fill gauge. Shows the value's position relative to operating limits, alarm thresholds, and setpoint. This is an independent display element placed anywhere on the canvas — commonly adjacent to equipment shapes or instrument bubbles.

**Visual anatomy (vertical, top to bottom):**

```
  HH zone  ─ 16-20px tall, --io-display-zone-inactive (#3f3f46), --io-alarm-critical (#DC2626 @ 50%) when value in zone
  H zone   ─ 16-20px tall, --io-display-zone-inactive, --io-alarm-high (#F59E0B @ 50%) when value in zone
  Normal   ─ 40-60px tall, --io-display-zone-normal (#404048), always this shade
  L zone   ─ 16-20px tall, --io-display-zone-inactive, --io-alarm-medium (#EAB308 @ 50%) when value in zone
  LL zone  ─ 16-20px tall, --io-display-zone-inactive, --io-alarm-critical (#DC2626 @ 50%) when value in zone
```

- Bar width: 20-24px. Each zone is a separate `<rect>` with 0.5px stroke `--io-display-zone-border`.
- Zone labels (HH, H, L, LL): 7px Inter, `--io-text-muted`, positioned left of vertical bar (right-aligned to bar edge) or above horizontal bar. Normal zone has no label.
- Range labels (max/min values): 7px JetBrains Mono, positioned right of vertical bar at top and bottom. Show engineering units or raw numbers.
- **Only the zone containing the current value lights up.** All other zones remain gray. This is the key visual distinction from a fill gauge — the bar does NOT fill up.
- Inactive zones: `--io-display-zone-inactive` fill. Normal zone: `--io-display-zone-normal` fill (slightly lighter than inactive).

**Pointer:** Left-pointing triangle (vertical bar) or down-pointing triangle (horizontal bar), `--io-text-secondary` fill. When in an alarm zone, pointer fill changes to the zone's alarm color. Size: ~6px wide × 8px tall. Positioned at the bar edge, pointing inward.

**Setpoint marker:** Diamond shape, `--io-accent` stroke, no fill. Positioned on the same edge as the pointer. The visual gap between pointer and setpoint diamond IS the deviation indicator — operators read the gap.

**Numeric readout:** Optional value below (vertical) or below-center (horizontal). JetBrains Mono 11px. When in alarm: value gets an alarm-colored border box (same treatment as Text Readout in alarm). Optional setpoint value in smaller text below: `SP: 105.0` in Inter 8px `--io-text-muted`.

**Orientation:** Vertical (default) or horizontal. Auto-detect based on element bounding box: height > width = vertical, else horizontal. Designer can override via `orientation` property.

**Horizontal variant:** Zones flow left to right: LL → L → Normal → H → HH. Pointer triangle points downward from above. Labels above zones. Same coloring rules.

**Dashed signal line:** When placed below an instrument bubble, a thin dashed line (0.75px, `#808080`, dash pattern `3,2`) connects the instrument bubble to the top of the bar. This is a visual association cue, not a required element.

**Properties:** `rangeLo`/`rangeHi` (from point config, overridable), `desiredLo`/`desiredHi`, HH/H/L/LL thresholds (always from point alarm config), setpoint (optional), `showValue` toggle, `valueFormat`.

### Fill Gauge

Level indicator showing physical capacity as a continuous fill. Used for tank levels, hopper levels, silo capacity — anything where the visual metaphor is "how full is this thing." This is an independent display element that can be:

1. **Overlaid inside a vessel shape** — fill clips to the vessel interior using SVG `<clipPath>`, visually filling the tank/sphere/column
2. **Standalone vertical bar** — independent rectangle element, placed anywhere on the canvas (e.g., beside equipment, in a group of level indicators)
3. **Standalone horizontal bar** — same as vertical but `fill_direction: 'right'`

Multiple fill gauges can be placed side by side on the same vessel (e.g., actual level, interface level, calculated volume — each bound to a different point, each with its own color/label).

**Visual rendering:**

- **Fill direction:** Bottom → top (default `'up'`), left → right (`'right'`) for horizontal vessels or standalone horizontal bars
- **Fill range:** 0% to 100% mapped from point's `range_lo` to `range_hi`. The fill rectangle height/width is proportional: a 62% value fills 62% of the gauge height. This is a direct percentage visualization — it must look physically accurate.
- **Normal fill color:** `--io-fill-normal` — muted blue-gray (`#475569` at 50% opacity). Calm, unobtrusive, clearly distinguishable from the vessel stroke.
- **In alarm:** Fill color changes to the alarm priority color at 30% opacity (e.g., amber at 30% for High alarm). Unacknowledged: fill rectangle flashes 1Hz (alarm color ↔ transparent).
- **Vessel-interior mode:** Fill `<rect>` uses a `<clipPath>` referencing the vessel's interior outline. This ensures fill stays inside curved vessels (spheres, columns, dished heads) without overflow.
- **Standalone mode:** Simple `<rect>` with the configured width (default 20-24px for vertical, configurable height for horizontal). 0.5px stroke `--io-display-zone-border` border.

**Threshold markers:** Optional tick marks on the vessel wall or bar edge at alarm threshold levels. Color-coded: red tick for HH/LL, amber for H/L. Tick length: ~6px protruding from the edge. Line weight: 1px (H/L), 1.5px (HH/LL).

**Setpoint line:** Optional horizontal dashed line at setpoint value. Cyan (`--io-accent` / `#06b6d4`), 1px, dash pattern `3,2`. Spans the full width of the vessel or bar.

**Numeric value:** Optional overlay text inside the fill area or below the gauge. JetBrains Mono 11-12px. Positioned vertically centered in the filled region (vessel mode) or below the bar (standalone mode). Shows percentage by default; configurable to show engineering units.

**Tag and secondary value:** Below the gauge: tag name in Inter 10px `--io-text-muted`, secondary value (e.g., barrels, gallons) in JetBrains Mono 11px `--io-text-secondary`.

### Sparkline Trend

Tiny inline SVG trend embedded on the graphics canvas. Shows value trajectory — no axes, no labels, no interactivity. Provides trajectory awareness: "is this value rising, falling, stable, or oscillating?" This is the most powerful early-warning element on a graphic — operators see problems developing before alarms fire.

**Visual rendering:**

- **Size:** 100-120px wide × 14-20px tall. Rendered as an SVG `<polyline>` inside a dark background `<rect>` (fill `--io-surface-elevated` / `#27272a`, border-radius 1px).
- **Stroke:** 1.5px, `stroke-linecap: round`, `stroke-linejoin: round`. Smooth curve through data points.
- **Normal color:** `--io-text-muted` (`#71717a`) — barely noticeable when stable. This is intentional: a flat gray sparkline is visual white noise that operators learn to ignore.
- **Approaching alarm:** Sparkline stroke color transitions to the alarm priority color as the value approaches a threshold (when value is within the trending band but not yet in alarm). This gives operators a preview — "this is going amber."
- **In alarm:** Sparkline stroke at full alarm priority color (e.g., amber `#F59E0B`). No flash — the sparkline shows trajectory, not current state.
- **Data resolution:** ~1 data point per pixel width (100-120 points for a 1-hour window). Sourced from TimescaleDB continuous aggregate.

**Threshold lines:** Optional faint dashed lines behind the sparkline at H/HH/L/LL alarm levels. 0.5px, alarm color at 50% opacity, dash pattern `2,2`. Labeled at right edge with zone letter (6px Inter).

**Desired range band:** Optional faint filled rectangle behind the sparkline between `desired_lo` and `desired_hi`. Muted accent color at 10% opacity.

**Time window:** Default 1 hour. Configurable: 30min, 1hr, 2hr, 4hr. Auto-scales Y to data range (default) or fixed to point's full range.

**Placement:** Typically adjacent to a text readout — value on left, sparkline on right, forming a "value + trajectory" pair. Can also be placed independently.

This is a graphics-canvas element, distinct from the `<Sparkline />` widget in doc 32 (which is used in tables, KPI cards, and list views). Same visual language, different rendering context.

### Digital Status Indicator

Binary/discrete state display: ON/OFF, OPEN/CLOSED, RUNNING/STOPPED, AUTO/MANUAL.

**Visual rendering:**

- **Shape:** Rounded rectangle (border-radius 2px) with text label inside. Sized to fit content with 6px horizontal / 3px vertical padding.
- **Typography:** JetBrains Mono 9px, centered in the rectangle.
- **Normal state:** Background `--io-display-zone-inactive` (`#3f3f46`), text `--io-text-secondary` (`#a1a1aa`). Visually quiet — just a small gray pill.
- **Abnormal state:** Background at alarm priority color, text `--io-text-primary` for contrast. Which states are "normal" vs "abnormal" is configured per point (e.g., MANUAL might be abnormal for an automatic valve, normal for a hand valve).
- Maps discrete values to display text via `StateClassMapping` (existing binding type).

### Point Binding Resolution States

Every point binding on a graphic stores a tag name string. At render time, the tag name is looked up in the point registry. The binding exists in one of three states:

| State | Condition | Visual Treatment |
|---|---|---|
| **Live** | Tag resolved in point registry, data flowing within staleness window | Normal display per element type (gray text, gray bar, etc.) |
| **Stale** | Tag resolved, but no value update received within staleness threshold (default 60s) | Existing stale behavior: `--io-text-stale` color + stale indicator icon |
| **Unresolved** | Tag name in binding does not match any configured point in this I/O instance | Value area displays `N/C`, tag name shown in `--io-text-muted` with dashed underline. No alarm indicator shown. Element otherwise renders normally (shape outline, label positions, etc.) |

**Design rules:**

- Bindings store tag name strings. Resolution happens at render time via point registry lookup.
- Unresolved is NOT an error. It is a normal state for graphics built before OPC connections are configured, for `.iographic` imports into new instances, or when points are temporarily removed.
- Unresolved bindings do not trigger alarms, do not appear in alarm summaries, and do not count toward alarm KPIs.
- Stale and Unresolved are visually distinct: stale implies "was working, stopped updating" while unresolved implies "tag not found in this system."
- On initial WebSocket subscription, unresolved tags are skipped (no subscription created). A background re-check runs periodically (every 60s) to pick up newly configured points without requiring a page reload.
- When a previously unresolved tag becomes resolved (point added to system while graphic is open), the element transitions to Live automatically on the next re-check cycle.

**CSS class:** `.io-unresolved` — applies `--io-text-muted` color + dashed underline. No new token needed; reuses existing `--io-text-muted` (#71717A dark).

### Data Quality Indicators

All display element types support data quality indication. Quality state overrides alarm state when data is bad.

| Quality | Value Text | Border | Opacity | Additional |
|---|---|---|---|---|
| **Good** | Normal | Normal | 100% | — |
| **Stale** (no update within timeout) | Last known value | Dashed outline | 60% | — |
| **Bad PV / sensor failure** | `????` | Red dashed outline | 100% | — |
| **Communication failure** | `COMM` | Gray fill | 100% | Diagonal hatching overlay |
| **Uncertain** (OPC UA uncertain) | Normal value | Dotted outline | 100% | — |
| **Manual / forced** | Normal value | Normal | 100% | Cyan "M" badge |

Priority: Bad quality > alarm state. Stale + in alarm = show stale treatment (alarm may no longer be valid). Manual + in alarm = show alarm + "M" badge.

### CSS Classes for Display Elements

```css
/* Alarm priority (applied as border/background on display elements, NOT on equipment shapes) */
.io-alarm-1 { /* Critical — Red #DC2626 */ }
.io-alarm-2 { /* High — Amber #F59E0B */ }
.io-alarm-3 { /* Medium — Yellow #EAB308 */ }
.io-alarm-4 { /* Advisory — Cyan #06B6D4 */ }
.io-alarm-custom { /* Custom — Purple #7C3AED default */ }
.io-fault { /* Fault — Magenta #D946EF */ }

/* Alarm state modifiers (combined with priority class) */
.io-unack { /* Flashing 1Hz — alarm color ↔ gray */ }
.io-ack { /* Steady alarm color */ }
.io-rtn-unack { /* Dimmed alarm color, optional slow flash */ }
.io-shelved { /* Dashed border, gray, "S" badge */ }
.io-suppressed { /* Hidden or disabled appearance */ }
.io-oos { /* Strikethrough, disabled appearance, "OOS" badge */ }

/* Data quality */
.io-quality-stale { /* Dashed outline, 60% opacity */ }
.io-quality-bad { /* ???? replacement, red dashed outline */ }
.io-quality-comm-fail { /* COMM replacement, gray fill, hatching */ }
.io-quality-uncertain { /* Dotted outline */ }
.io-quality-manual { /* Cyan "M" badge */ }

/* Operational state (applied to equipment shapes — unchanged, separate from alarm) */
.io-running { }
.io-stopped { }
.io-open { }
.io-closed { }
.io-transitioning { }
```

Equipment shapes use `io-stateful` + operational state classes. Display elements use alarm priority + alarm state + quality classes. These two systems are independent and additive.

### Visual Design Language — Display Elements

All display elements follow the ISA-101 High Performance HMI principle: **gray is normal, color means abnormal.** A well-running process graphic should be almost entirely gray with muted text. Color appears only when something needs attention. This is not a stylistic choice — it is the core visual philosophy. Every rendering decision flows from this rule.

**Color palette (display elements only — equipment shapes use separate operational state colors):**

| Context | Token | Dark Hex | Usage |
|---|---|---|---|
| Normal value text | `--io-text-secondary` | `#a1a1aa` | Value text, pointer fills |
| Label text | `--io-text-muted` | `#71717a` | Tag names, zone labels, secondary info |
| Promoted text (in alarm) | `--io-text-primary` | `#e4e4e7` | Value text when alarm border/background is present |
| Box background | `--io-surface-elevated` | `#27272a` | Text readout boxes, sparkline backgrounds |
| Box border (normal) | `--io-border` | `#3f3f46` | Box borders around readouts |
| Zone inactive | `--io-display-zone-inactive` | `#3f3f46` | Analog bar alarm zones when value is not in zone, digital status normal bg |
| Zone normal | `--io-display-zone-normal` | `#404048` | Analog bar normal operating zone (always this shade) |
| Zone border | `--io-display-zone-border` | `#52525b` | Analog bar zone stroke, standalone fill gauge border |
| Fill normal | `--io-fill-normal` | `#475569` @ 50% | Fill gauge liquid level in normal operation |
| Accent | `--io-accent` | `#06b6d4` | Setpoint markers, setpoint lines |

**Hex values shown are dark-theme defaults.** All tokens resolve per theme — see doc 38 Section 2 for Light/Dark/HPHMI values. The 4 `--io-display-*` and `--io-fill-*` tokens are graphics-specific additions to the token registry.

**Font rules:**

- All numeric values: JetBrains Mono with `font-variant-numeric: tabular-nums`. Digits must be fixed-width so values don't shift horizontally as they change.
- All labels and descriptive text: Inter.
- Default sizes on canvas: values 11px, labels 8-9px, zone labels 7px, badge text 8px. All scale with graphic zoom.

**Spacing and positioning:**

- Display elements maintain a minimum 4-6px gap from equipment shape outlines. No overlapping.
- Alarm indicators: upper-right of associated equipment by default, clear gap from shape edge.
- Analog bars: connected to instrument bubbles with optional thin dashed signal line (0.75px, dash `3,2`).
- Fill gauges inside vessels: fill rectangle clips to vessel interior — never overflows the shape boundary.

**Visual mockup reference:** `shapes-draft/point-display-mockup-v2.html` contains the definitive visual reference for all 6 display element types. Implementation must match this mockup's appearance — element proportions, color values, typography, spacing, and alarm state rendering.

### Interaction Model

All display elements support:

- **Hover:** Tooltip with tag name, description, full-precision value, units, quality, alarm state, timestamp
- **Click:** Opens faceplate/detail panel for the bound point (trend, alarm history, control actions if authorized)
- **Right-click (Designer):** Opens element configuration panel
- **Context menu:** Participates in the Shared Point Context Menu (doc 32) — Investigate Point → Forensics, View Trend, View Alarm History, Go to Equipment

### Equipment-Point Association

For alarm aggregation and faceplate drill-down, the system tracks which points belong to a piece of equipment:

1. **Explicit binding:** Points bound to display elements grouped with an equipment shape
2. **Tag pattern:** Points whose tags match a pattern (e.g., `TK-101.*`) associated with the `TK-101` shape
3. **Import carry-over:** DCS import preserves source point-to-equipment associations

Association is stored in the graphic's `bindings` JSONB (not the shape sidecar, which is a reusable template).

### Import Behavior for Display Elements

Display element positions are resolved using a 3-tier fallback hierarchy. The import pipeline uses the best available source for each element's position:

**Position resolution priority (highest to lowest):**

1. **Source-extracted positions** — DCS native import reads actual display element coordinates from the source file format. Most DCS platforms store value readout positions, bar graph positions, and alarm indicator positions as explicit coordinates in their native format. These are the most accurate positions because they reflect where the original designer placed them. See doc 34 for per-platform extraction capabilities.

2. **Recognition-inferred positions** — When importing via image recognition (doc 26), the recognition pipeline identifies not just equipment shapes but also the text readouts, bar graphs, and other display elements visible in the screenshot. The pixel coordinates where these elements appear in the source image are translated to SVG canvas coordinates and used as placement positions. Even for unrecognized or "unknown" shapes, the recognition system can infer display element locations from the spatial relationship between detected text/numbers and nearby equipment shapes.

3. **Sidecar anchor defaults** — Fallback when neither source file parsing nor image recognition can determine positions. Uses the shape's `valueAnchors` and `alarmAnchor` from the JSON sidecar (see doc 35 v0.30 for per-shape defaults). These are formula-based positions that provide reasonable initial placement.

**Resolution behavior by import source:**

| Import Source | Value Display Positions | Alarm Indicators | Confidence |
|---|---|---|---|
| **DCS native import** | Source-extracted (tier 1). Fall back to sidecar anchor if source format doesn't include display element positions for a given element. | Source-extracted if available, otherwise sidecar `alarmAnchor`. | High — positions match source graphic |
| **Recognition-generated** | Recognition-inferred (tier 2) for detected display elements. Sidecar anchor (tier 3) for elements not detected in the image. | Sidecar `alarmAnchor` (alarm indicators are I/O-specific, not present in source images). | Medium — spatial inference from image, may need adjustment |
| **New graphic (Designer)** | Designer places manually; sidecar anchors as snap suggestions on drag. | Designer places manually; sidecar `alarmAnchor` as snap suggestion. | N/A — human placement |

**Post-placement behavior:**

- All auto-placed elements (from any tier) are flagged in graphic metadata with `auto_placed: true` and `placement_source: 'native_import' | 'recognition' | 'sidecar_default'` for designer review.
- Auto-placement uses collision detection — if a position would overlap another element, the system nudges the element to the nearest non-overlapping position.
- After placement, the user can freely drag any display element to any position on the canvas. There are no constraints — the import positions are starting points, not destinations.

## Historical Rendering Mode

The graphics rendering pipeline supports two data source modes with identical output:

- **Live mode**: Point values arrive via WebSocket → RAF loop → direct DOM update (standard path)
- **Historical mode**: Point values come from a client-side history cache (REST-fetched) → RAF loop → same direct DOM update path

The rendering code is data-source-agnostic — it takes a `Map<PointId, { value, quality, timestamp }>` and applies it to the SVG. Whether that map was populated from a WebSocket message or a binary search through cached historical data is invisible to the rendering layer. Value mapping, color interpolation, CSS transitions, quality indicators, and UOM conversion all work identically in both modes.

Historical mode is activated by the Historical Playback Bar (doc 32) in Console (doc 07) and Process (doc 08). Forensics graphic snapshots (doc 12) use the same rendering path for single-timestamp renders.

## Success Criteria

✅ Graphics render smoothly with 1000+ elements
✅ Point bindings update in real-time (< 500ms)
✅ Import system converts files correctly
✅ Performance acceptable on target hardware
✅ SVG animations are smooth (60 FPS)
✅ Historical mode renders identically to live mode (same pipeline, different data source)

## Change Log

- **v1.9**: Fixed stale crate name `io-types` → `io-models` (2 locations). Fixed stale Tier 1 shape counts: 28→25 in heading, 27→25 in variation coverage text. Counts were not updated after instrument consolidation (doc 35).
- **v1.8**: Added Point Binding Resolution States section. Three states: Live (data flowing), Stale (resolved but no recent update), Unresolved (tag not found in point registry). Unresolved bindings display `N/C` with dashed-underline tag name, do not trigger alarms or create WebSocket subscriptions. Background re-check (60s) auto-resolves tags when points are added to the system. Unresolved state uses existing `--io-text-muted` token plus `.io-unresolved` CSS class (dashed underline). See doc 09 (Designer validation), doc 39 (.iographic import).
- **v1.7**: Updated element classification to include stencils as static elements. Stencils are reusable visual elements from the shape library (doc 35) that have no data binding, state handling, or connection points — purely decorative/structural. Always rendered to Canvas bitmap in hybrid mode.
- **v1.6**: Added Pipe Coloring by Service Type section. 8 service types (process, gas/vapor, steam, water, fuel gas, chemical, instrument air, drain) with desaturated color palette designed to avoid alarm color space. 3 stroke widths by line type. Monochrome mode toggle in Settings. Pipe `service_type` enum stored on pipe objects. DCS import maps vendor pipe styles to service types.
- **v1.5**: Aligned equipment state colors with doc 35 authoritative CSS values (Running=#059669, Stopped=transparent/#808080, Fault=#D946EF). Added missing states (Fault, Manual, Out of Service) and fill/stroke pairs to match doc 35's `.io-stateful` pattern. Fixed analog bar zone color references to note token names (`--io-display-zone-*` and `--io-alarm-*`).
- **v1.4**: Expanded Import Behavior for Display Elements with 3-tier position resolution hierarchy: source-extracted → recognition-inferred → sidecar anchor default. Source-extracted positions preserve original DCS designer placement. Recognition-inferred positions use spatial proximity analysis even for unrecognized shapes. All auto-placed elements tagged with `placement_source` metadata (`native_import`, `recognition`, `sidecar_default`). Collision detection nudges overlapping elements. Post-placement, user can freely drag any element anywhere. See doc 34 v0.2 (Display Element Extraction), doc 35 v0.30 (sidecar anchor defaults), doc 26 (recognition pipeline).
- **v1.3**: Expanded all 6 display element type specs with detailed visual rendering specifications: exact typography (font, size, weight), color values, sizing, spacing, anatomy diagrams, alarm state treatments, and positioning rules. Fill gauge updated to support 3 placement modes (vessel overlay, standalone vertical bar, standalone horizontal bar) — multiple fill gauges can be placed on the same vessel. FillGaugeMapping type extended with `placement` and `clip_to_shape_id` fields. Analog bar anatomy fully specified (zone sizing, pointer geometry, setpoint diamond, signal line, zone label positioning). Alarm indicator shape geometry table with exact dimensions. Added Visual Design Language section as central reference for the ISA-101 gray-is-normal design philosophy, complete color palette, font rules, and spacing guidelines. Fixed 5 incorrect token references (`--io-text-tertiary` → `--io-text-muted`, `--io-text-muted` → `--io-text-secondary`, `--io-surface-secondary` → `--io-surface-elevated`, `--io-border-subtle` → `--io-border`, `--io-surface-tertiary` → `--io-display-zone-inactive`) to match doc 38 token registry. New graphics-specific tokens: `--io-fill-normal`, `--io-display-zone-inactive`, `--io-display-zone-normal`, `--io-display-zone-border` (registered in doc 38 v0.3). Mockup reference: `shapes-draft/point-display-mockup-v2.html`.
- **v1.2**: Added Point Value Display Elements section. 6 display element types (text readout, analog bar indicator, fill gauge, sparkline trend, alarm indicator, digital status). 4-level alarm priority scheme (Critical/High/Medium/Advisory) with ISA-18.2 state visual treatments. Alarm indicators as separate ISA-101 elements (equipment shapes do NOT change color for alarms). Data quality indicators (stale, bad PV, comm fail, uncertain, manual). 4 new binding mapping types (AnalogBarMapping, FillGaugeMapping, SparklineMapping, AlarmIndicatorMapping). CSS class reference for alarm priority, alarm state, and data quality. Equipment-point association model for alarm aggregation. Import behavior for display element placement. Updated equipment state CSS classes to use `io-` prefix. Updated Tier 1 count from 27 to 28. See docs 32 (sparkline widget), 35 (sidecar anchors), 09 (Designer palette), 38 (CSS tokens).
- **v1.1**: Replaced basic Bindings Format example with full Bindings JSONB Schema. Defines `ElementBinding`, `BindingAttribute` (7 types), and `BindingMapping` discriminated union (8 mapping types: linear, threshold, rotation, translation, scale, visibility, text, state_class). Complete TypeScript and Rust type definitions. Comprehensive example covering all mapping types. This is the contract between Designer, Parser Service, and the rendering pipeline. See doc 37 Section 16 for TypeScript type parity.
- **v1.0**: Added Historical Rendering Mode section. The SVG rendering pipeline is data-source-agnostic — same DOM update path for live WebSocket data and historical cache data. Historical mode activated by Historical Playback Bar (doc 32) in Console/Process. Forensics graphic snapshots use the same path. See docs 07, 08, 12, 32.
- **v0.9**: Added Design Object Point Index section. `design_object_points` junction table for reverse lookup (point → graphics). Trigger-maintained from `design_objects.bindings` JSONB. Enables Point Detail panel (doc 32) "Which graphics reference this point?" query.
- **v0.8**: Updated DCS Symbol Templates intro to cross-reference both import paths: screenshot-based recognition (doc 26) and native DCS file import (doc 34). Added Shape Library (doc 35) cross-reference for template sourcing.
- **v0.7**: Replaced SVG-with-Canvas-fallback rendering approach with fully specified hybrid SVG/Canvas rendering pipeline. Static elements rendered to Canvas bitmap, dynamic (data-bound/clickable) elements overlaid as live SVG. Auto-enables above 3,000 elements. Debounced Canvas re-render at zoom. ~501 DOM nodes instead of 10,000 for large graphics.
- **v0.6**: Added `parent_id UUID REFERENCES design_objects(id)` to `design_objects` schema for template/instance hierarchy support. Instances reference their source template, enabling template update propagation and lineage tracking.
- **v0.5**: Added DCS Symbol Templates section. ISA-101 High Performance HMI principles (2D flat, gray baseline, color for state only). CSS class-based state switching. Composable sub-components. 27 Tier 1 equipment types. DCS class-to-template mapping. Variation coverage with .iogap integration. See SymBA 17_IO_INTEGRATION.md.
- **v0.4**: Fixed table name reference: `app_settings` → `settings` for recognition class template map configuration key.
- **v0.3**: Added P&ID symbol template section covering ISA-101 templates, class mapping, and unmapped symbol handling. See `26_PID_RECOGNITION.md`.
- **v0.2**: Point bindings now reference `points_metadata(id)` UUIDs with source context from multi-source point model. Point metadata includes criticality and area for graphic overlays and tooltips.
