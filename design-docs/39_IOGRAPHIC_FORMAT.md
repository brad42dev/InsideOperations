# Inside/Operations — .iographic Format Specification

## 1. Format Overview

The `.iographic` format packages one or more I/O graphics, custom shapes, and stencils into a single portable file that can be imported into any I/O instance. It is designed to be:

- **Portable**: References points by tag name (not UUID), shapes by shape library ID (not database primary key)
- **Human-inspectable**: ZIP container with JSON + SVG text files inside — open with any ZIP tool
- **Efficient to produce/consume**: Rust backend generates it from a single DB query per graphic, parses it back with `zip` + `serde_json` crates
- **Forward-compatible**: Versioned manifest with semver; importers can reject or adapt to unknown versions
- **Multi-mode**: Handles all Designer output types — graphics, dashboards, reports, templates, and workspaces — in a single format

### Why ZIP-based (not single JSON, not binary)

| Alternative | Problem |
|---|---|
| Single JSON file with embedded SVG | SVG content must be JSON-escaped (doubles backslashes, breaks readability). Large graphics produce multi-MB JSON blobs that are painful to inspect. No streaming — must hold entire file in memory to parse. |
| Binary format (protobuf, MessagePack) | Not human-inspectable. Requires special tools. Adds a serialization dependency. |
| TAR + gzip | No random access to individual entries. Rust `tar` crate is fine but ZIP is more universally understood. |
| ZIP-based (like .docx, .iomodel, .iobackup) | **Winner.** ZIP is the established I/O packaging pattern (`.iomodel` already uses it). Deflate compression built in. Random access to entries. Every OS can open it. Rust `zip` crate (MIT) handles read/write. |

### File Extension

**`.iographic`**

Single-graphic packages and multi-graphic packages use the same extension. The manifest declares how many graphics are inside.

### MIME Type

`application/vnd.insideops.iographic+zip`

---

## 2. Internal Structure

An `.iographic` file is a ZIP archive with Deflate compression containing:

```
package.iographic (ZIP)
├── manifest.json              # Package metadata, version, graphic/shape/stencil inventory
├── graphics/
│   ├── crude-unit-overview/
│   │   ├── graphic.json       # Graphic metadata + bindings (tag-name based) + expressions
│   │   └── graphic.svg        # Raw SVG content — OPTIONAL (see §5)
│   ├── reactor-section-a/
│   │   ├── graphic.json
│   │   └── graphic.svg        # Omit to trigger server-side SVG reconstruction from graphic.json
│   └── ...                    # One subdirectory per graphic
├── shapes/                    # Custom shapes used by graphics in this package
│   ├── wet-gas-scrubber.custom.142/
│   │   ├── shape.json         # Full sidecar (connections, zones, states)
│   │   └── shape.svg          # Shape SVG
│   └── ...
├── stencils/                  # Stencils used by graphics in this package
│   ├── company-logo.custom.203/
│   │   ├── stencil.json       # Minimal metadata (name, category, tags)
│   │   └── stencil.svg        # Stencil SVG
│   └── ...
├── workspace.json             # Optional — Console workspace layout
└── thumbnails/                # Optional — preview images
    ├── crude-unit-overview.png
    └── reactor-section-a.png
```

### Directory Naming

Each graphic subdirectory name is derived from the graphic's `name` field, slugified to lowercase-alphanumeric-with-hyphens. If a collision occurs (two graphics slugify to the same name), append `-2`, `-3`, etc. The slug is for filesystem friendliness only — the canonical name is in `graphic.json`.

Each shape subdirectory uses the shape's full ID (e.g., `wet-gas-scrubber.custom.142`). Custom shapes use the `.custom.<db_id>` suffix to distinguish them from built-in library shapes.

Each stencil subdirectory uses the stencil's full ID (e.g., `company-logo.custom.203`). Same `.custom.<db_id>` naming convention.

---

## 3. `manifest.json` Schema

```json
{
  "format": "iographic",
  "format_version": "1.0",
  "generator": {
    "application": "Inside/Operations",
    "version": "1.2.0",
    "instance_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "exported_at": "2026-03-14T15:30:00.000Z",
  "exported_by": "jsmith",
  "description": "Crude unit graphics for sharing with Site B",
  "graphics": [
    {
      "directory": "crude-unit-overview",
      "name": "Crude Unit Overview",
      "type": "graphic"
    },
    {
      "directory": "reactor-section-a",
      "name": "Reactor Section A",
      "type": "graphic"
    }
  ],
  "shapes": [
    {
      "directory": "wet-gas-scrubber.custom.142",
      "name": "Wet Gas Scrubber",
      "shape_id": "wet-gas-scrubber.custom.142"
    }
  ],
  "stencils": [
    {
      "directory": "company-logo.custom.203",
      "name": "Acme Refining Logo"
    }
  ],
  "shape_dependencies": [
    "pump-centrifugal",
    "valve-control",
    "vessel-vertical",
    "heat-exchanger-shell-tube",
    "instrument-field",
    "instrument-panel",
    "wet-gas-scrubber.custom.142"
  ],
  "point_tags": [
    "FIC-101.PV",
    "FIC-101.SP",
    "TI-201A",
    "PI-301",
    "LIC-401.PV",
    "XV-501.STS"
  ],
  "checksum": "sha256:a3f5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3"
}
```

### Manifest Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `format` | string | Yes | Always `"iographic"`. Allows format detection without relying on file extension. |
| `format_version` | string | Yes | Semver. Current: `"1.0"`. Importer rejects if major version is unsupported. Minor version differences are forward-compatible (unknown fields ignored). |
| `generator.application` | string | Yes | Always `"Inside/Operations"`. |
| `generator.version` | string | Yes | I/O application version that produced this package. |
| `generator.instance_id` | string | No | UUID of the source I/O instance (from `settings` table). Informational only — never used for import logic. |
| `exported_at` | string | Yes | RFC 3339 UTC timestamp. |
| `exported_by` | string | Yes | Username of the exporter (not UUID — for human readability). |
| `description` | string | No | Free-text description provided by the user at export time. |
| `graphics` | array | Yes | Inventory of graphics in the package. May be empty if the package contains only shapes/stencils. |
| `graphics[].directory` | string | Yes | Subdirectory name under `graphics/`. |
| `graphics[].name` | string | Yes | Human-readable graphic name. |
| `graphics[].type` | string | Yes | One of `"graphic"`, `"dashboard"`, `"report"`, `"template"`, `"workspace"`. Maps to `design_objects.type`. |
| `shapes` | array | Yes | Inventory of custom shapes packaged for portability. Empty array if all shapes are built-in. |
| `shapes[].directory` | string | Yes | Subdirectory name under `shapes/`. |
| `shapes[].name` | string | Yes | Human-readable shape name. |
| `shapes[].shape_id` | string | Yes | Full shape library identifier (e.g., `"wet-gas-scrubber.custom.142"`). |
| `stencils` | array | Yes | Inventory of stencils packaged for portability. Empty array if no stencils. |
| `stencils[].directory` | string | Yes | Subdirectory name under `stencils/`. |
| `stencils[].name` | string | Yes | Human-readable stencil name. |
| `shape_dependencies` | string[] | Yes | Deduplicated list of ALL shape library IDs referenced across all graphics in the package — both built-in and custom. Built-in shapes are resolved from the local shape library on import. Custom shapes (`.custom.*` IDs) are resolved from the package's `shapes/` directory. Used by the import wizard for dependency checking without parsing every SVG. |
| `point_tags` | string[] | Yes | Deduplicated list of all point tag names referenced in bindings across all graphics. Used by the import wizard for point resolution checking without parsing every binding. |
| `checksum` | string | Yes | SHA-256 digest of all other files in the ZIP (excluding `manifest.json` itself), computed over the concatenation of each file's content sorted by ZIP entry path. Format: `"sha256:<hex>"`. |

### Checksum Computation

The checksum covers every file in the ZIP except `manifest.json`:

1. List all ZIP entries except `manifest.json`, sorted lexicographically by full path
2. For each entry, read the raw bytes
3. Feed all bytes sequentially into a SHA-256 hasher
4. Hex-encode the digest

This detects any tampering with the SVG or JSON content. It is NOT a cryptographic signature — it does not prove who created the package. If cryptographic signing is needed later (e.g., for validated graphic libraries), a `signature` field can be added in format version 1.1+ without breaking 1.0 importers.

### Graphics Type Field

The `type` field on each graphic entry supports all Designer modes:

| Type | Description |
|---|---|
| `"graphic"` | Standard process graphic (Graphic mode). SVG with equipment shapes, pipes, bindings. |
| `"dashboard"` | Dashboard layout (Dashboard mode). Widget grid with data bindings. |
| `"report"` | Report template (Report mode). Print-oriented layout with data sections. |
| `"template"` | Reusable template. Can be any mode — used as a starting point for new designs. |
| `"workspace"` | Console workspace. Multi-pane layout referencing other graphics. Always accompanied by `workspace.json`. |

Dashboard and report types use the same `graphic.json` structure. Their widget configurations, grid layouts, and data section definitions are stored in the `metadata` object alongside the standard fields. The binding model is identical — widgets that display point data use the same tag-based portable bindings as graphic elements.

---

## 4. `graphic.json` Schema

Each graphic's metadata, bindings, and expressions. This is the core of the format — it captures everything needed to reconstruct the graphic in a target database.

```json
{
  "name": "Crude Unit Overview",
  "type": "graphic",
  "metadata": {
    "viewBox": "0 0 1920 1080",
    "width": 1920,
    "height": 1080,
    "background_color": "#09090B",
    "description": "Main overview of the atmospheric crude unit",
    "tags": ["crude", "atmospheric", "unit-100"],
    "source_version": {
      "version_number": 5,
      "version_type": "publish"
    }
  },
  "shapes": [
    {
      "element_id": "pump-101-shape",
      "shape_id": "pump-centrifugal",
      "variant": "opt1",
      "composable_parts": [],
      "position": { "x": 450.0, "y": 600.0 },
      "scale": { "x": 1.0, "y": 1.0 },
      "rotation": 0.0,
      "mirror": "none"
    },
    {
      "element_id": "vessel-201-shape",
      "shape_id": "vessel-vertical",
      "variant": "opt1",
      "configuration": "flanged-top",
      "composable_parts": [
        { "part_id": "part-support-skirt", "attachment": "bottom" }
      ],
      "position": { "x": 800.0, "y": 200.0 },
      "scale": { "x": 1.2, "y": 1.5 },
      "rotation": 0.0,
      "mirror": "horizontal"
    }
  ],
  "pipes": [
    {
      "element_id": "pipe-001",
      "service_type": "process",
      "stroke_width": 2.0,
      "path_data": "M 500 620 L 780 620 L 780 400",
      "label": null
    },
    {
      "element_id": "pipe-002",
      "service_type": "steam",
      "stroke_width": 1.5,
      "path_data": "M 300 300 L 450 300 L 450 580",
      "label": "150# Steam"
    }
  ],
  "bindings": {
    "pump-101-body": {
      "point_tag": "P-101.STS",
      "source_hint": "OPC-DCS-1",
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
    "readout-TI201A": {
      "point_tag": "TI-201A",
      "source_hint": "OPC-DCS-1",
      "attribute": "text",
      "mapping": {
        "type": "text",
        "format": "%.1f",
        "suffix": " °F"
      }
    },
    "readout-delta-t": {
      "expression_key": "expr-001",
      "attribute": "text",
      "mapping": {
        "type": "text",
        "format": "%.1f",
        "suffix": " °F"
      }
    },
    "level-gauge-LIC401": {
      "point_tag": "LIC-401.PV",
      "source_hint": "OPC-DCS-1",
      "attribute": "fill",
      "mapping": {
        "type": "fill_gauge",
        "range_lo": 0.0,
        "range_hi": 100.0,
        "fill_direction": "up",
        "placement": "vessel_overlay",
        "clip_to_shape_id": "vessel-201-shape",
        "show_value": true,
        "show_setpoint": true,
        "show_threshold_markers": true,
        "value_format": "%.1f"
      }
    },
    "alarm-ind-PI301": {
      "point_tag": "PI-301",
      "source_hint": "OPC-DCS-1",
      "attribute": "visibility",
      "mapping": {
        "type": "alarm_indicator",
        "mode": "single"
      }
    },
    "sparkline-FIC101": {
      "point_tag": "FIC-101.PV",
      "source_hint": "OPC-DCS-1",
      "attribute": "text",
      "mapping": {
        "type": "sparkline",
        "time_window_minutes": 60,
        "scale_mode": "auto",
        "show_desired_band": true,
        "show_threshold_lines": false,
        "stroke_width": 1.5
      }
    }
  },
  "expressions": {
    "expr-001": {
      "ast": {
        "type": "subtract",
        "left": { "type": "tag_ref", "tag": "TI-201A" },
        "right": { "type": "tag_ref", "tag": "TI-201B" }
      },
      "description": "Calculated delta T across exchanger"
    }
  },
  "annotations": [
    {
      "element_id": "label-area-100",
      "type": "text",
      "content": "AREA 100 — ATMOSPHERIC CRUDE UNIT",
      "position": { "x": 960.0, "y": 40.0 },
      "font_size": 18,
      "font_weight": "bold",
      "fill": "#E5E5E5"
    }
  ],
  "layers": [
    { "name": "Background", "visible": true, "locked": true, "elements": ["pipe-001", "pipe-002", "pipe-003"] },
    { "name": "Equipment", "visible": true, "locked": false, "elements": ["pump-101-shape", "vessel-201-shape"] },
    { "name": "Instruments", "visible": true, "locked": false, "elements": ["readout-TI201A", "readout-delta-t", "level-gauge-LIC401", "alarm-ind-PI301", "sparkline-FIC101"] },
    { "name": "Labels", "visible": true, "locked": false, "elements": ["label-area-100"] }
  ]
}
```

### `graphic.json` Field Reference

#### Root Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Graphic display name. |
| `type` | string | Yes | `"graphic"`, `"dashboard"`, `"report"`, `"template"`, or `"workspace"`. Maps to `design_objects.type`. |
| `metadata` | object | Yes | Display properties. Maps to `design_objects.metadata` JSONB. |
| `shapes` | array | Yes | Placed equipment shapes with position/transform. |
| `pipes` | array | Yes | Pipe/connector paths. |
| `bindings` | object | Yes | Point bindings keyed by SVG element ID. **Tag-name based, not UUID.** Each binding uses either `point_tag` (direct point) or `expression_key` (calculated value) — never both. |
| `expressions` | object | No | Expression definitions keyed by local expression key. Expression ASTs follow the format defined in doc 23. |
| `annotations` | array | Yes | Static text labels and decorative elements. |
| `layers` | array | No | Layer definitions with element membership and visibility. |

#### `metadata` Object

| Field | Type | Required | Description |
|---|---|---|---|
| `viewBox` | string | Yes | SVG viewBox attribute (e.g., `"0 0 1920 1080"`). |
| `width` | number | Yes | Logical width in SVG units. |
| `height` | number | Yes | Logical height in SVG units. |
| `background_color` | string | No | Hex color for graphic background. Default: `"#09090B"` (I/O dark theme). |
| `description` | string | No | Human-readable description. |
| `tags` | string[] | No | Searchable keyword tags. |
| `source_version` | object | No | Version info from the source system (informational only — not used on import). |

#### `shapes[]` Object

| Field | Type | Required | Description |
|---|---|---|---|
| `element_id` | string | Yes | SVG element ID. Must be unique within the graphic. |
| `shape_id` | string | Yes | Shape library identifier (e.g., `"pump-centrifugal"`, `"valve-control"`, `"wet-gas-scrubber.custom.142"`). The import wizard checks this against the target's shape library and the package's `shapes/` directory. |
| `variant` | string | Yes | `"opt1"` or `"opt2"`. |
| `configuration` | string | No | Configuration variant name (e.g., `"flanged-top"`, `"panel"`, `"trayed"`). Null for shapes with no configuration variants. |
| `composable_parts` | array | Yes | Attached parts. Empty array if none. |
| `composable_parts[].part_id` | string | Yes | Part shape library ID (e.g., `"part-actuator-pneumatic"`). |
| `composable_parts[].attachment` | string | Yes | Attachment zone name from the sidecar (e.g., `"stem"`, `"bottom"`, `"shaft"`). |
| `position` | object | Yes | `{ "x": number, "y": number }` — top-left position in SVG coordinates. |
| `scale` | object | Yes | `{ "x": number, "y": number }` — scale factors. `1.0` = original size. |
| `rotation` | number | Yes | Rotation in degrees. `0.0` = no rotation. |
| `mirror` | string | Yes | Mirror transform: `"none"`, `"horizontal"`, `"vertical"`, or `"both"`. Default: `"none"`. Applied after rotation. |

#### `pipes[]` Object

| Field | Type | Required | Description |
|---|---|---|---|
| `element_id` | string | Yes | SVG element ID. |
| `service_type` | string | Yes | One of: `"process"`, `"gas_vapor"`, `"steam"`, `"water"`, `"fuel_gas"`, `"chemical"`, `"instrument_air"`, `"drain"`. |
| `stroke_width` | number | Yes | Stroke width in SVG units. |
| `path_data` | string | Yes | SVG path `d` attribute value. Full path geometry. |
| `label` | string | No | Optional pipe label (e.g., `"150# Steam"`). |

#### `bindings` Object

Keyed by SVG element ID. Same structure as the database `design_objects.bindings` JSONB, **except**:

- `point_id` (UUID) is replaced by `point_tag` (string — the tag name), OR
- `expression_key` (string) references a local expression definition — mutually exclusive with `point_tag`
- `source_hint` is added (optional string — the point source name, for disambiguation when multiple sources have the same tag name)
- All other fields (`attribute`, `mapping`) are identical to the database schema

This is the critical portability transformation. On export, UUIDs are resolved to tag names. On import, tag names are resolved back to UUIDs (or flagged as unresolved). Expression-bound elements carry their expression AST inline, so no external expression resolution is needed.

| Field | Type | Required | Description |
|---|---|---|---|
| `point_tag` | string | Conditional | Point tag name from `points_metadata.tagname`. Present for direct point bindings. Mutually exclusive with `expression_key`. |
| `expression_key` | string | Conditional | Key into the `expressions` object. Present for expression-driven bindings. Mutually exclusive with `point_tag`. |
| `source_hint` | string | No | Name of the point source (from `point_sources.name`). Helps disambiguation but is not required — tag names alone are sufficient in single-source deployments. Only relevant when `point_tag` is present. |
| `attribute` | string | Yes | Binding attribute: `"fill"`, `"stroke"`, `"opacity"`, `"transform"`, `"visibility"`, `"text"`, `"class"`. |
| `mapping` | object | Yes | Mapping configuration. Identical schema to `BindingMapping` in doc 19 / doc 37 (`io-models` crate). |

**Nested point references in mappings**: Some mapping types contain secondary point references (e.g., `AnalogBarMapping.setpoint_point_id`, `AlarmIndicatorMapping.equipment_point_ids`). In `.iographic`, these are also converted to tag names:

- `setpoint_point_id` (UUID) → `setpoint_point_tag` (string)
- `equipment_point_ids` (UUID[]) → `equipment_point_tags` (string[])

The importer resolves these the same way as the primary `point_tag`.

#### `expressions` Object

Keyed by a local expression key (arbitrary string, scoped to this graphic). Each entry contains the expression AST and an optional human-readable description.

| Field | Type | Required | Description |
|---|---|---|---|
| `ast` | object | Yes | Expression AST in the format defined by doc 23 (Expression Builder). Contains `tag_ref` nodes that reference point tags by name — these are resolved during import alongside bindings. |
| `description` | string | No | Human-readable description of what the expression calculates. |

Expression ASTs may reference point tags internally via `tag_ref` nodes. During import, these tag references are resolved to point UUIDs using the same resolution logic as binding `point_tag` fields. If any tag within an expression is unresolved, the entire expression is marked as unresolved, and all bindings referencing that expression become unresolved.

#### `annotations[]` Object

| Field | Type | Required | Description |
|---|---|---|---|
| `element_id` | string | Yes | SVG element ID. |
| `type` | string | Yes | `"text"`, `"rect"`, `"line"`, `"ellipse"`, `"path"`. |
| `content` | string | No | Text content (for `type: "text"` only). |
| `position` | object | Yes | `{ "x": number, "y": number }`. |
| Additional SVG attrs | varies | No | `font_size`, `font_weight`, `fill`, `stroke`, `width`, `height`, `rx`, `ry`, etc. — any relevant SVG styling attributes. |

#### `layers[]` Object

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Layer display name. |
| `visible` | boolean | Yes | Default visibility. |
| `locked` | boolean | Yes | Default lock state (locked layers cannot be edited). |
| `elements` | string[] | Yes | Element IDs belonging to this layer. |

---

## 5. `graphic.svg` File — OPTIONAL

`graphic.svg` is the raw SVG XML content from `design_objects.svg_data`. It is **optional** in `.iographic` packages.

### When `graphic.svg` is present (normal I/O → I/O export)

The SVG is exported verbatim from the database. It contains `data-point-id` attributes with UUIDs (the database format). These UUIDs are stale on import — the import process rewrites them with target-instance UUIDs. The JSON `shapes`, `pipes`, and `annotations` arrays serve as a structured index for the import wizard (dependency analysis, point mapping UI) without requiring SVG parsing.

### When `graphic.svg` is absent (programmatic/external authoring)

If `graphic.svg` is absent, the import server **reconstructs the SVG from `graphic.json`** during Phase 4 (see §9). This mode enables external tools, scripts, and agents to author `.iographic` packages by writing only `graphic.json` — no SVG authoring required.

The reconstructed SVG is functionally equivalent to a Designer-authored SVG: shapes are composited from the local shape library at the specified positions/scales, pipes are drawn with correct service-type colors, annotations are rendered as SVG text/shape elements, and all `data-point-id` attributes are written with resolved UUIDs in a single pass.

### Design rationale

`graphic.json` already contains the complete declarative description of a graphic — every shape, every pipe, every annotation, every binding. SVG is derived output, not source of truth. Including `graphic.svg` in exports is a convenience (avoids a re-render round-trip when importing between I/O instances) but is not structurally necessary for the format. Making it optional enables external authoring while preserving fidelity for I/O-to-I/O transfers.

---

## 6. Shape and Stencil Packaging

### Shapes (`shapes/` directory)

Custom shapes (those not in the built-in shape library) are packaged so the target system can import both the graphic and the shapes it depends on. Each shape directory contains:

- **`shape.json`**: Full shape sidecar following the schema defined in doc 35 (Shape Library). Includes connection points, attachment zones, state CSS classes, composable part declarations, and all metadata needed for the Designer palette.
- **`shape.svg`**: The shape's SVG content. Individual file, same format as the shape library's per-shape SVGs.

Built-in library shapes are NOT packaged. They are referenced by ID in `shape_dependencies` and resolved from the target system's local shape library. Only shapes with `.custom.*` IDs appear in the `shapes/` directory.

### Stencils (`stencils/` directory)

Stencils are simpler than shapes — they have no connection points, no state classes, and no composable part system. Each stencil directory contains:

- **`stencil.json`**: Minimal metadata — name, category, tags, dimensions. No sidecar connections or zones.
- **`stencil.svg`**: The stencil's SVG content.

### Why Shapes Use Full Sidecars but Stencils Use Minimal Metadata

Shapes are functional components: they connect to pipes, accept composable parts, respond to alarm states. All of that behavior metadata must travel with the shape for it to work correctly in the target system. Stencils are purely visual — they stamp static SVG content with no behavioral wiring.

---

## 7. Thumbnails (Optional)

```
thumbnails/
├── crude-unit-overview.png
└── reactor-section-a.png
```

- Max 400x300px PNG
- Named to match the graphic directory slug
- Generated server-side during export (render SVG → rasterize → resize)
- Purpose: import wizard preview. Lets the user see what they're importing without rendering live SVG
- If thumbnails are missing, the import wizard renders the SVG directly (slightly slower)
- Thumbnails are not imported — they are ephemeral preview aids

---

## 8. Export Workflow

### Trigger

User initiates export from:
- **Designer**: File → Export → `.iographic` (single graphic)
- **Console/Process**: Right-click graphic pane → Export Graphic (single graphic)
- **Settings → Graphics Management**: Select multiple graphics → Export Selected (batch)

### Process

```
1. Query: SELECT svg_data, bindings, metadata, name, type
   FROM design_objects WHERE id IN (<selected_ids>)
   JOIN design_object_versions (get latest published version, or current draft if unpublished)

2. For each graphic:
   a. Parse bindings JSONB
   b. For each binding entry:
      - Look up point_id → tagname via points_metadata
      - Look up point_id → source name via point_sources
      - Replace point_id with point_tag + source_hint
      - Handle nested point references (setpoint_point_id, equipment_point_ids)
   c. For each expression-bound element:
      - Serialize the expression AST (already JSON per doc 23)
      - Assign a local expression key
      - Replace point_id references within the AST with tag names
   d. Extract shape references from SVG (elements with shape_id metadata)
   e. Extract pipe paths and service types
   f. Build graphic.json (including expressions section)
   g. Copy svg_data verbatim as graphic.svg
   h. Generate thumbnail (optional, async)

3. Aggregate across all graphics:
   - Collect unique shape_ids → manifest.shape_dependencies
   - Collect unique point tags (from bindings AND expression ASTs) → manifest.point_tags
   - Identify custom shapes (.custom.* IDs) → package into shapes/ directory
   - Identify referenced stencils → package into stencils/ directory

4. For each custom shape:
   a. Query shape SVG and sidecar JSON from design_objects
   b. Write shape.svg and shape.json into shapes/<shape_id>/

5. For each stencil:
   a. Query stencil SVG and metadata from design_objects
   b. Write stencil.svg and stencil.json into stencils/<stencil_id>/

6. Build manifest.json (with graphics, shapes, stencils arrays)

7. Compute checksum over all files (sorted by path, excluding manifest.json)

8. Write manifest.json with checksum

9. Create ZIP archive with Deflate compression

10. Stream to client as download
```

### Rust Implementation Notes

```rust
// Crates needed (all MIT/Apache):
// - zip (MIT/Apache) — ZIP read/write
// - serde_json (MIT/Apache) — JSON serialization
// - sha2 (MIT/Apache) — SHA-256 checksum
// - uuid (MIT/Apache) — UUID handling

// Export is a synchronous DB read + ZIP build.
// No export_jobs queue needed — graphics are small enough
// to build in a single API request (~100ms for a 50-shape graphic).
// Batch exports of 50+ graphics use the existing export_jobs queue.
```

---

## 9. Import Workflow

### Phase 1: Validation

```
1. Verify file is a valid ZIP archive
2. Read manifest.json
3. Validate format == "iographic"
4. Check format_version compatibility (reject if major > supported)
5. Verify checksum against actual file contents
6. If checksum fails → reject with "Package integrity check failed"
```

### Phase 2: Dependency Analysis and Shape/Stencil Import

```
7. Custom shape import:
   For each entry in manifest.shapes:
     - Read shape.svg and shape.json from shapes/<directory>/
     - Check if shape_id already exists in local shape library:
       - If NOT found → import into local shape library (new design_objects row)
       - If found → prompt: "Use existing / Import as copy (new ID) / Skip"
     - Result: all custom shapes are available locally

8. Stencil import:
   For each entry in manifest.stencils:
     - Read stencil.svg and stencil.json from stencils/<directory>/
     - Check if stencil ID already exists:
       - If NOT found → import into local stencil library
       - If found → prompt: "Use existing / Import as copy (new ID) / Skip"
     - Result: all stencils are available locally

9. Shape dependency check (built-in shapes):
   For each shape_id in manifest.shape_dependencies:
     - If .custom.* ID → already handled in step 7 (verify available)
     - Otherwise → look up in local shape library
     - Classify as: ✅ Available | ❌ Missing

10. Point tag resolution:
    For each tag in manifest.point_tags:
      - Search points_metadata WHERE tagname = <tag>
      - If exactly 1 match → ✅ Auto-resolved (store UUID)
      - If multiple matches (different sources) → ⚠️ Ambiguous (use source_hint
        to narrow; if still ambiguous, present picker)
      - If 0 matches → ❌ Unresolved
```

### Phase 3: Import Wizard UI

The import wizard presents a multi-step review:

**Step 1 — Package Overview**
- Graphic names, types, thumbnail previews
- Summary: "3 graphics, 12 shapes needed (2 custom), 1 stencil, 47 point tags"

**Step 2 — Shapes & Stencils**
- Custom shapes: table showing shape_id | Name | Status (New / Exists locally) | Action (Import / Use existing / Import as copy / Skip)
- Stencils: same pattern
- Built-in shapes: table showing shape_id | Status
- Missing built-in shapes show "Missing — graphic will import without this shape (placeholder rectangle)"
- No blocking — missing built-in shapes are not fatal. The graphic imports with placeholder rectangles that get replaced when the shape becomes available.

**Step 3 — Point Tag Resolution**
- Table: tag_name | source_hint | Status | Resolved To | Action
- Auto-resolved tags shown as green checkmarks
- Ambiguous tags have a dropdown to pick the correct source
- Unresolved tags are imported with their original tag names by default — they render immediately with `N/C` display (see doc 19 Point Binding Resolution States) and auto-resolve when matching points appear in the system. Unresolved tags are NOT placeholders that need manual resolution before the graphic works. Options for unresolved tags:
  - **Keep as-is** (default) — binding is preserved with the original tag name. Element displays `N/C` at runtime. When a point with that tag is configured later (e.g., after OPC source setup), the binding auto-resolves without user intervention.
  - **Map to different tag** — point picker to select a different local tag
  - **Skip** — import without this binding (element becomes purely static, loses the tag name entirely)

**Step 4 — Import Options**
- **Target name**: defaults to source name, editable (detects name collisions)
- **Import as**: Published / Draft
- **Overwrite existing**: If a graphic with the same name exists, option to overwrite or create copy

**Step 5 — Confirm & Import**

### Phase 4: Database Write

```
11. For each graphic in the package:
    a. Determine SVG source mode:
       - If graphic.svg is present in ZIP → SVG_MODE = "provided"
       - If graphic.svg is absent         → SVG_MODE = "reconstruct"

    b. Read graphic.json
    c. Rebuild expression references:
       - For each expression in graphic.json.expressions:
         - Resolve tag_ref nodes in the AST (tag name → UUID)
         - Store as expression definition linked to the graphic
    d. Rebuild bindings JSONB:
       - For each binding in graphic.json.bindings:
         - If point_tag present:
           - Replace point_tag → point_id (UUID) using resolution map from Phase 2
           - Replace setpoint_point_tag → setpoint_point_id
           - Replace equipment_point_tags → equipment_point_ids
         - If expression_key present:
           - Link to the imported expression definition
         - For skipped tags: omit from bindings
         - For unresolved (kept) tags: store binding with original tag name and `unresolved: true` marker

    e. Produce SVG content:
       IF SVG_MODE = "provided":
         - Read graphic.svg verbatim
         - Rewrite data-point-id attributes to match resolved UUIDs from step (d)
       IF SVG_MODE = "reconstruct":
         - Call reconstruct_svg(graphic.json, resolved_bindings, shape_library)
           → See §5.1 Reconstruction Algorithm below
         - data-point-id attributes are written with correct UUIDs during reconstruction

    f. Rebuild metadata JSONB from graphic.json.metadata
    g. INSERT into design_objects (svg_data = SVG from step e, new UUID, new created_by, new timestamps)
    h. INSERT into design_object_versions (version 1, draft or publish per user choice)
    i. Update design_object_points index table
```

### §5.1 SVG Reconstruction Algorithm

Called when `graphic.svg` is absent. Produces a Designer-equivalent SVG from `graphic.json`.

```
reconstruct_svg(graphic_json, resolved_bindings, shape_library):

  canvas_w = graphic_json.metadata.width
  canvas_h = graphic_json.metadata.height
  bg_color = graphic_json.metadata.background_color ?? "#09090B"
  view_box = graphic_json.metadata.viewBox

  svg = open <svg> with viewBox, width, height

  // 1. Background
  append <rect width=canvas_w height=canvas_h fill=bg_color/>

  // 2. Pipes (render first — behind equipment)
  for each pipe in graphic_json.pipes:
    color = SERVICE_TYPE_COLORS[pipe.service_type]  // see §19 palette
    append <path id=pipe.element_id
                 d=pipe.path_data
                 stroke=color stroke-width=pipe.stroke_width fill="none"
                 data-service-type=pipe.service_type/>
    if pipe.label:
      append <text> near midpoint of path with label text

  // 3. Equipment shapes
  for each shape_ref in graphic_json.shapes:
    shape_svg = shape_library.get_svg(shape_ref.shape_id, shape_ref.variant,
                                      shape_ref.configuration)
    // shape_svg is the inner <g class="io-shape-body"> content (no outer <svg>)

    if shape_svg is None:
      // Shape missing from local library
      shape_svg = placeholder_rect(shape_ref)   // dashed border + shape_id label
      append data-missing-shape=shape_ref.shape_id attribute

    transform = build_transform(shape_ref.position, shape_ref.scale,
                                shape_ref.rotation, shape_ref.mirror)

    point_id = resolved_bindings[shape_ref.element_id].point_id ?? "unresolved"

    append <g id=shape_ref.element_id
              transform=transform
              data-io-shape=shape_ref.shape_id
              data-point-id=point_id>
             shape_svg content
           </g>

    // Attach composable parts
    for each part in shape_ref.composable_parts:
      part_svg = shape_library.get_svg(part.part_id, "opt1", null)
      attachment_offset = shape_library.get_attachment_point(shape_ref.shape_id,
                                                             shape_ref.variant,
                                                             part.attachment)
      append part at attachment_offset within the shape group

  // 4. Display elements (text readouts, level gauges, sparklines)
  for each (element_id, binding) in graphic_json.bindings:
    if element_id already rendered (part of a shape group above): continue
    // Standalone display element — not part of a shape
    point_id = resolved_bindings[element_id].point_id ?? "unresolved"
    // Position comes from annotations[] if present, else a default near the bound shape
    pos = find_annotation_position(element_id, graphic_json.annotations)
    if binding.attribute == "text":
      append <text id=element_id x=pos.x y=pos.y
                   font-family="Arial,sans-serif" font-size=18 fill="#E5E5E5"
                   data-point-id=point_id data-point-attr="text">—</text>
    if binding.mapping.type == "fill_gauge":
      append fill gauge overlay elements at vessel position
    if binding.mapping.type == "analog_bar":
      append analog bar SVG group at specified position
    if binding.mapping.type == "sparkline":
      append sparkline placeholder <path> at specified position

  // 5. Annotations (static labels, decorative elements)
  for each annotation in graphic_json.annotations:
    if annotation.type == "text":
      append <text id=annotation.element_id x=position.x y=position.y
                   font-size=font_size font-weight=font_weight fill=fill
                   text-anchor=text_anchor ?? "start">annotation.content</text>
    if annotation.type == "rect":
      append <rect id=annotation.element_id .../>
    if annotation.type == "line":
      append <line id=annotation.element_id .../>
    // etc. for ellipse, path

  close </svg>
  return svg_string
```

**Key properties of reconstructed SVGs:**
- Functionally identical to Designer-authored SVGs for rendering and data binding
- All `data-point-id` attributes are written with resolved UUIDs in a single pass (no post-process rewrite step needed)
- Missing shapes produce placeholder rectangles with `data-missing-shape` attributes, same as the missing-shape handling in normal import
- The reconstructed SVG is stored in `design_objects.svg_data` — once imported, the graphic behaves identically to a Designer-authored graphic including full Designer editing support

### Phase 5: Post-Import

```
12. For graphics with unresolved bindings:
    - Register a background watcher on points_metadata INSERT trigger
    - When a new point appears matching an unresolved tag name,
      auto-resolve the binding and update the graphic
    - Any open clients rendering that graphic will pick up the resolution
      on their next periodic re-check (60s cycle — see doc 19)
    - Notify admin via system notification: "3 point bindings auto-resolved
      in graphic 'Crude Unit Overview'"

13. Return import summary:
    - Graphics imported: N
    - Custom shapes imported: N (new) / N (existing used) / N (copied)
    - Stencils imported: N (new) / N (existing used) / N (copied)
    - Bindings resolved: N / total
    - Bindings unresolved: N (with list)
    - Expressions resolved: N / total
    - Shapes missing: N (with list)
```

---

## 10. Point Tag Resolution Strategy

The core portability challenge: point UUIDs are instance-specific, but tag names are (usually) standardized within an organization.

### Export: UUID → Tag Name

Straightforward lookup:

```sql
SELECT pm.tagname, ps.name AS source_name
FROM points_metadata pm
JOIN point_sources ps ON pm.source_id = ps.id
WHERE pm.id = $1;
```

If a binding references a point_id that no longer exists (deleted point), the exporter:
1. Logs a warning
2. Includes the binding with `point_tag: "<DELETED:uuid>"` and `source_hint: null`
3. The import wizard will show this as unresolved

### Import: Tag Name → UUID

Resolution priority:

1. **Exact tag match, single result**: `SELECT id FROM points_metadata WHERE tagname = $1` — if exactly one row, use it.
2. **Exact tag match, multiple results** (same tag in different sources): Use `source_hint` to narrow. `SELECT id FROM points_metadata WHERE tagname = $1 AND source_id = (SELECT id FROM point_sources WHERE name = $2)`. If source_hint doesn't match any local source name, fall back to ambiguous picker.
3. **No match**: Mark as unresolved.

### Expression Tag Resolution

Expressions contain `tag_ref` nodes within their AST that reference point tags by name. The importer walks the AST tree and resolves each `tag_ref` node's `tag` field using the same resolution logic as binding `point_tag` fields. If any `tag_ref` within an expression cannot be resolved, the entire expression is marked unresolved, and all bindings referencing that expression inherit the unresolved status.

### Cross-Site Tag Name Conventions

In practice, refineries and plants use standardized tag naming (ISA 5.1 or company conventions). A tag like `FIC-101.PV` will typically mean the same instrument across I/O instances at the same facility. However:

- **Different sites may use different tag conventions**: The same physical instrument might be `FIC-101.PV` at Site A and `1-FIC-0101.PV` at Site B.
- **The import wizard handles this**: Unresolved tags can be manually mapped to different local tags.
- **No automatic fuzzy matching**: Fuzzy matching tag names is dangerous in an industrial context (mapping to the wrong point could display incorrect safety-critical data). All mappings are either exact or manual.

---

## 11. Shape Dependency Resolution

### Export

The exporter scans each graphic's SVG and `shapes` array to collect all referenced `shape_id` values. These are deduplicated and written to `manifest.shape_dependencies`.

Built-in shapes are referenced by library ID (e.g., `"pump-centrifugal"`), not by UUID or by embedding the shape SVG. This keeps packages small and avoids version conflicts — the target system uses its own copy of the shape library.

Custom shapes (`.custom.*` IDs) are both listed in `shape_dependencies` AND packaged in the `shapes/` directory with their full SVG and sidecar JSON.

### Import — Missing Built-in Shape Handling

If the target I/O instance is missing a required built-in shape:

1. **The graphic still imports.** Missing shapes are not blocking.
2. A placeholder rectangle (dashed border, gray fill, text label showing the shape_id) is inserted at the position where the shape should be.
3. The placeholder has a `data-missing-shape="pump-centrifugal"` attribute.
4. When the shape becomes available (admin installs updated shape library, SymBA delivers new shapes), a maintenance job scans for placeholders and replaces them.
5. The import summary lists all missing shapes.

### Import — Custom Shape Collision Handling

If a custom shape ID already exists in the target system's shape library:

| User Choice | Behavior |
|---|---|
| **Use existing** | The local shape is used. The packaged shape SVG/sidecar are ignored. |
| **Import as copy** | The packaged shape is imported with a new ID (auto-generated). All graphics in the package that reference the original ID are updated to reference the new ID. |
| **Skip** | The shape is not imported. If graphics in the package reference it, they fall back to the existing local shape (same as "Use existing"). |

### Why Not Embed All Shapes in the Package?

- Built-in shapes are versioned independently of graphics. Embedding a shape freezes it at export time — the target system might have a newer, better version.
- Built-in shapes can be large (composable parts, multiple variants). Embedding them bloats the package.
- The shape library is a system-level resource, not a per-graphic resource. Graphics reference shapes; they don't own them.
- This matches how `.iomodel` works — it references class IDs that map to shapes, it doesn't embed the shapes.
- Custom shapes are the exception — they may not exist anywhere else, so they must travel with the package.

---

## 12. Workspace Export (Batch Context)

When exporting a Console workspace (which contains multiple graphic panes), the `.iographic` includes:

- Each graphic as a separate entry in `manifest.graphics`
- An additional `workspace.json` file at the root level:

```json
{
  "name": "Control Room Main",
  "layout": {
    "columns": 3,
    "rows": 2,
    "panes": [
      { "row": 0, "col": 0, "colspan": 2, "rowspan": 1, "graphic": "crude-unit-overview" },
      { "row": 0, "col": 2, "colspan": 1, "rowspan": 2, "graphic": "reactor-section-a" },
      { "row": 1, "col": 0, "colspan": 1, "rowspan": 1, "graphic": "compressor-house" },
      { "row": 1, "col": 1, "colspan": 1, "rowspan": 1, "graphic": "tank-farm" }
    ]
  }
}
```

The workspace layout is imported alongside the graphics, recreating the multi-pane arrangement. If the target system already has a workspace with the same name, the user can overwrite or create a copy.

---

## 13. Complete Example

A simple graphic with 2 equipment shapes, 3 pipes, 5 display elements, and 1 expression-driven binding.

### `manifest.json`

```json
{
  "format": "iographic",
  "format_version": "1.0",
  "generator": {
    "application": "Inside/Operations",
    "version": "1.0.0",
    "instance_id": "d4e5f6a7-b8c9-0123-defa-234567890123"
  },
  "exported_at": "2026-03-14T16:00:00.000Z",
  "exported_by": "operator1",
  "description": "Simple pump-to-vessel transfer section",
  "graphics": [
    {
      "directory": "pump-vessel-transfer",
      "name": "Pump-Vessel Transfer",
      "type": "graphic"
    }
  ],
  "shapes": [],
  "stencils": [],
  "shape_dependencies": [
    "pump-centrifugal",
    "vessel-vertical"
  ],
  "point_tags": [
    "P-101.STS",
    "P-101.AMPS",
    "FIC-101.PV",
    "TI-201A",
    "TI-201B",
    "LIC-401.PV"
  ],
  "checksum": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

### `graphics/pump-vessel-transfer/graphic.json`

```json
{
  "name": "Pump-Vessel Transfer",
  "type": "graphic",
  "metadata": {
    "viewBox": "0 0 1200 800",
    "width": 1200,
    "height": 800,
    "background_color": "#09090B",
    "description": "Transfer pump P-101 feeding vessel V-201",
    "tags": ["transfer", "pump", "vessel"]
  },
  "shapes": [
    {
      "element_id": "pump-101",
      "shape_id": "pump-centrifugal",
      "variant": "opt1",
      "composable_parts": [],
      "position": { "x": 200.0, "y": 400.0 },
      "scale": { "x": 1.0, "y": 1.0 },
      "rotation": 0.0,
      "mirror": "none"
    },
    {
      "element_id": "vessel-201",
      "shape_id": "vessel-vertical",
      "variant": "opt1",
      "configuration": "flanged-top",
      "composable_parts": [
        { "part_id": "part-support-skirt", "attachment": "bottom" }
      ],
      "position": { "x": 800.0, "y": 150.0 },
      "scale": { "x": 1.0, "y": 1.0 },
      "rotation": 0.0,
      "mirror": "none"
    }
  ],
  "pipes": [
    {
      "element_id": "pipe-suction",
      "service_type": "process",
      "stroke_width": 2.0,
      "path_data": "M 100 420 L 200 420",
      "label": null
    },
    {
      "element_id": "pipe-discharge",
      "service_type": "process",
      "stroke_width": 2.0,
      "path_data": "M 260 420 L 500 420 L 500 350 L 780 350",
      "label": null
    },
    {
      "element_id": "pipe-vent",
      "service_type": "gas_vapor",
      "stroke_width": 1.5,
      "path_data": "M 820 150 L 820 80",
      "label": "Vent"
    }
  ],
  "bindings": {
    "pump-101-body": {
      "point_tag": "P-101.STS",
      "source_hint": "OPC-DCS-1",
      "attribute": "class",
      "mapping": {
        "type": "state_class",
        "states": {
          "0": "equipment-symbol stopped",
          "1": "equipment-symbol running"
        },
        "default_class": "equipment-symbol"
      }
    },
    "readout-pump-amps": {
      "point_tag": "P-101.AMPS",
      "source_hint": "OPC-DCS-1",
      "attribute": "text",
      "mapping": {
        "type": "text",
        "format": "%.1f",
        "suffix": " A"
      }
    },
    "readout-flow": {
      "point_tag": "FIC-101.PV",
      "source_hint": "OPC-DCS-1",
      "attribute": "text",
      "mapping": {
        "type": "text",
        "format": "%.0f",
        "suffix": " GPM"
      }
    },
    "readout-temp": {
      "point_tag": "TI-201A",
      "source_hint": "OPC-DCS-1",
      "attribute": "text",
      "mapping": {
        "type": "text",
        "format": "%.1f",
        "suffix": " °F"
      }
    },
    "readout-delta-t": {
      "expression_key": "expr-delta-t",
      "attribute": "text",
      "mapping": {
        "type": "text",
        "format": "%.1f",
        "suffix": " °F"
      }
    },
    "level-gauge-201": {
      "point_tag": "LIC-401.PV",
      "source_hint": "OPC-DCS-1",
      "attribute": "fill",
      "mapping": {
        "type": "fill_gauge",
        "range_lo": 0.0,
        "range_hi": 100.0,
        "fill_direction": "up",
        "placement": "vessel_overlay",
        "clip_to_shape_id": "vessel-201",
        "show_value": true,
        "show_setpoint": false,
        "show_threshold_markers": false,
        "value_format": "%.0f"
      }
    }
  },
  "expressions": {
    "expr-delta-t": {
      "ast": {
        "type": "subtract",
        "left": { "type": "tag_ref", "tag": "TI-201A" },
        "right": { "type": "tag_ref", "tag": "TI-201B" }
      },
      "description": "Temperature differential across vessel V-201"
    }
  },
  "annotations": [
    {
      "element_id": "label-p101",
      "type": "text",
      "content": "P-101",
      "position": { "x": 215.0, "y": 470.0 },
      "font_size": 14,
      "font_weight": "normal",
      "fill": "#A3A3A3"
    },
    {
      "element_id": "label-v201",
      "type": "text",
      "content": "V-201",
      "position": { "x": 810.0, "y": 580.0 },
      "font_size": 14,
      "font_weight": "normal",
      "fill": "#A3A3A3"
    },
    {
      "element_id": "label-title",
      "type": "text",
      "content": "PUMP-VESSEL TRANSFER SECTION",
      "position": { "x": 600.0, "y": 30.0 },
      "font_size": 18,
      "font_weight": "bold",
      "fill": "#E5E5E5"
    }
  ],
  "layers": [
    { "name": "Pipes", "visible": true, "locked": false, "elements": ["pipe-suction", "pipe-discharge", "pipe-vent"] },
    { "name": "Equipment", "visible": true, "locked": false, "elements": ["pump-101", "vessel-201"] },
    { "name": "Displays", "visible": true, "locked": false, "elements": ["pump-101-body", "readout-pump-amps", "readout-flow", "readout-temp", "readout-delta-t", "level-gauge-201"] },
    { "name": "Labels", "visible": true, "locked": false, "elements": ["label-p101", "label-v201", "label-title"] }
  ]
}
```

### `graphics/pump-vessel-transfer/graphic.svg`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <!-- Background -->
  <rect width="1200" height="800" fill="#09090B"/>

  <!-- Title -->
  <text id="label-title" x="600" y="30" text-anchor="middle"
        font-size="18" font-weight="bold" fill="#E5E5E5">PUMP-VESSEL TRANSFER SECTION</text>

  <!-- Pipes -->
  <path id="pipe-suction" d="M 100 420 L 200 420"
        stroke="#6B8CAE" stroke-width="2" fill="none" data-service-type="process"/>
  <path id="pipe-discharge" d="M 260 420 L 500 420 L 500 350 L 780 350"
        stroke="#6B8CAE" stroke-width="2" fill="none" data-service-type="process"/>
  <path id="pipe-vent" d="M 820 150 L 820 80"
        stroke="#B8926A" stroke-width="1.5" fill="none" data-service-type="gas_vapor"/>
  <text x="830" y="110" font-size="10" fill="#B8926A">Vent</text>

  <!-- Pump P-101 (shape: pump-centrifugal, opt1) -->
  <g id="pump-101" transform="translate(200,400)">
    <circle id="pump-101-body" cx="30" cy="20" r="25"
            stroke="#808080" stroke-width="1.5" fill="none"
            class="equipment-symbol"
            data-point-id="a1b2c3d4-0000-0000-0000-000000000001"
            data-point-attr="class"/>
    <line x1="5" y1="20" x2="55" y2="20" stroke="#808080" stroke-width="1.5"/>
    <polygon points="55,10 55,30 65,20" fill="#808080"/>
  </g>

  <!-- Vessel V-201 (shape: vessel-vertical, flanged-top) -->
  <g id="vessel-201" transform="translate(800,150)">
    <ellipse cx="40" cy="10" rx="40" ry="10" stroke="#808080" stroke-width="1.5" fill="none"/>
    <rect x="0" y="10" width="80" height="350" stroke="#808080" stroke-width="1.5" fill="none"/>
    <ellipse cx="40" cy="360" rx="40" ry="10" stroke="#808080" stroke-width="1.5" fill="none"/>
    <!-- Flanged top indicator -->
    <line x1="-5" y1="5" x2="85" y2="5" stroke="#808080" stroke-width="2"/>
    <!-- Skirt support -->
    <path d="M 10 370 L 5 400 M 70 370 L 75 400 M 0 400 L 80 400"
          stroke="#808080" stroke-width="1.5" fill="none"/>
    <!-- Level gauge overlay -->
    <rect id="level-gauge-201" x="2" y="12" width="76" height="346"
          fill="#2563EB" opacity="0.3"
          data-point-id="a1b2c3d4-0000-0000-0000-000000000005"
          data-point-attr="fill"/>
  </g>

  <!-- Display Elements -->
  <text id="readout-pump-amps" x="230" y="460" font-size="12" fill="#D4D4D8"
        data-point-id="a1b2c3d4-0000-0000-0000-000000000002"
        data-point-attr="text">-- A</text>

  <text id="readout-flow" x="400" y="405" font-size="12" fill="#D4D4D8"
        data-point-id="a1b2c3d4-0000-0000-0000-000000000003"
        data-point-attr="text">-- GPM</text>

  <text id="readout-temp" x="850" y="280" font-size="12" fill="#D4D4D8"
        data-point-id="a1b2c3d4-0000-0000-0000-000000000004"
        data-point-attr="text">-- °F</text>

  <text id="readout-delta-t" x="900" y="310" font-size="12" fill="#D4D4D8"
        data-point-attr="text">-- °F</text>

  <!-- Equipment Labels -->
  <text id="label-p101" x="215" y="470" font-size="14" fill="#A3A3A3">P-101</text>
  <text id="label-v201" x="810" y="580" font-size="14" fill="#A3A3A3">V-201</text>
</svg>
```

---

## 14. Rust Type Definitions

These types live in the `io-models` crate alongside the existing `GraphicBindings` / `ElementBinding` types.

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Manifest ──

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IoGraphicManifest {
    pub format: String,                    // "iographic"
    pub format_version: String,            // "1.0"
    pub generator: ManifestGenerator,
    pub exported_at: String,               // RFC 3339
    pub exported_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub graphics: Vec<ManifestGraphicEntry>,
    pub shapes: Vec<ManifestShapeEntry>,
    pub stencils: Vec<ManifestStencilEntry>,
    pub shape_dependencies: Vec<String>,   // shape library IDs (built-in + custom)
    pub point_tags: Vec<String>,           // tag names (from bindings + expressions)
    pub checksum: String,                  // "sha256:<hex>"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ManifestGenerator {
    pub application: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub instance_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ManifestGraphicEntry {
    pub directory: String,
    pub name: String,
    #[serde(rename = "type")]
    pub graphic_type: String,              // "graphic", "dashboard", "report", "template", "workspace"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ManifestShapeEntry {
    pub directory: String,
    pub name: String,
    pub shape_id: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ManifestStencilEntry {
    pub directory: String,
    pub name: String,
}

// ── Graphic JSON ──

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IoGraphicData {
    pub name: String,
    #[serde(rename = "type")]
    pub graphic_type: String,
    pub metadata: GraphicMetadata,
    pub shapes: Vec<ShapeReference>,
    pub pipes: Vec<PipeReference>,
    pub bindings: HashMap<String, PortableBinding>,  // element_id → binding
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expressions: Option<HashMap<String, ExpressionDef>>,
    pub annotations: Vec<Annotation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layers: Option<Vec<LayerDefinition>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GraphicMetadata {
    #[serde(rename = "viewBox")]
    pub view_box: String,
    pub width: f64,
    pub height: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_version: Option<SourceVersion>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SourceVersion {
    pub version_number: i32,
    pub version_type: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ShapeReference {
    pub element_id: String,
    pub shape_id: String,
    pub variant: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configuration: Option<String>,
    pub composable_parts: Vec<ComposablePart>,
    pub position: Position2D,
    pub scale: Scale2D,
    pub rotation: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mirror: Option<String>,           // "none", "horizontal", "vertical", "both"
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ComposablePart {
    pub part_id: String,
    pub attachment: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Position2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Scale2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PipeReference {
    pub element_id: String,
    pub service_type: String,
    pub stroke_width: f64,
    pub path_data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

// ── Portable Binding (tag-based, not UUID-based) ──
// point_tag and expression_key are mutually exclusive.

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PortableBinding {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_tag: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expression_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_hint: Option<String>,
    pub attribute: BindingAttribute,       // reuse from existing io-models
    pub mapping: BindingMapping,           // reuse from existing io-models
    // Nested point references also use tags in portable format:
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_state_tag: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub point_state_attr: Option<String>,
}

// ── Expression Definition ──

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ExpressionDef {
    pub ast: serde_json::Value,            // Expression AST per doc 23
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Annotation {
    pub element_id: String,
    #[serde(rename = "type")]
    pub annotation_type: String,           // "text", "rect", "line", "ellipse", "path"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    pub position: Position2D,
    #[serde(flatten)]
    pub style: HashMap<String, serde_json::Value>,  // font_size, fill, stroke, etc.
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LayerDefinition {
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub elements: Vec<String>,
}

// ── Workspace (optional, only for workspace exports) ──

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct IoWorkspaceData {
    pub name: String,
    pub layout: WorkspaceLayout,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceLayout {
    pub columns: u32,
    pub rows: u32,
    pub panes: Vec<WorkspacePane>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspacePane {
    pub row: u32,
    pub col: u32,
    pub colspan: u32,
    pub rowspan: u32,
    pub graphic: String,                   // directory name reference
}
```

### Design Note: `PortableBinding` Mutual Exclusivity

`point_tag` and `expression_key` are mutually exclusive. When `expression_key` is present, `point_tag` must be `None`, and vice versa. Both being `None` is invalid. The Rust type uses `Option<String>` for both fields rather than a `#[serde(flatten)]` enum to keep the JSON representation flat and human-readable. Validation is enforced at deserialization time via a custom `Deserialize` implementation or a post-parse validation pass.

An alternative design using `#[serde(untagged)]` or `#[serde(flatten)]` with an enum was considered:

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(untagged)]
pub enum BindingSource {
    Point { point_tag: String, source_hint: Option<String> },
    Expression { expression_key: String },
}
```

This produces cleaner Rust but makes the JSON harder to hand-inspect (the discriminant is implicit). Given that human-inspectability is a stated design goal, the flat `Option<String>` approach is preferred with explicit validation.

---

## 15. Format Versioning Strategy

| Version | Rule |
|---|---|
| **Major bump** (2.0) | Breaking structural change. Old importers cannot read new packages. Expected to be rare — the format is intentionally simple. |
| **Minor bump** (1.1, 1.2) | New optional fields or sections. Old importers ignore unknown fields (serde `#[serde(deny_unknown_fields)]` is NOT used — unknown fields are silently dropped). New importers can read old packages (missing optional fields default to None/empty). |

The importer checks:
- `format_version` major == supported major → proceed
- `format_version` major > supported major → reject with "This package requires I/O version X.Y or later"
- `format_version` major < supported major → proceed with backward compatibility (if applicable)

---

## 16. Security Considerations

- **No executable content**: The format contains only JSON and SVG. No scripts, no macros, no embedded binaries (except optional PNG thumbnails). SVG `<script>` tags are stripped on import (reusing existing SVG sanitization from the Designer import pipeline).
- **Checksum verification**: Detects accidental corruption and naive tampering. Not cryptographic-grade.
- **RBAC**: Export requires `designer:export` permission. Import requires `designer:import` permission. These are existing permissions in the RBAC matrix (doc 03).
- **SVG sanitization**: The same sanitization applied to any SVG import (strip `<script>`, `on*` event handlers, `<foreignObject>`, external resource references) is applied to `.iographic` SVG content — both graphic SVGs and shape/stencil SVGs.
- **Size limits**: Import rejects packages larger than a configurable max (default 100 MB). Individual SVG files within the package are limited to 50 MB.
- **Shape sidecar validation**: Imported shape.json and stencil.json files are validated against the expected sidecar schema before being written to the database. Malformed sidecars are rejected with a clear error.

---

## 17. Comparison with Other I/O Package Formats

| Aspect | `.iomodel` | `.iobackup` | `.iographic` |
|---|---|---|---|
| **Purpose** | ML model delivery | Full system backup | Graphic interchange |
| **Producer** | SymBA | I/O (backup) | I/O (designer/export) |
| **Consumer** | I/O (recognition) | I/O (restore) | I/O (designer/import) |
| **Container** | ZIP | Encrypted ZIP | ZIP |
| **Integrity** | SHA-256 per model file | Triple-wrapped encryption | SHA-256 over all content |
| **Portability** | Cross-instance (model is universal) | Same-instance (UUIDs, config) | Cross-instance (tag-based references) |
| **Size** | 50-500 MB (ONNX models) | GB+ (full database) | 100 KB - 50 MB (SVG + JSON) |
| **Carries shapes** | No | Yes (full DB dump) | Custom only (built-in by reference) |
| **Carries expressions** | No | Yes (full DB dump) | Yes (AST inline) |

---

## Cross-References

| Document | Relationship |
|---|---|
| 01 (Technology Stack) | `zip` + `serde_json` + `sha2` crates |
| 02 (Architecture) | API Gateway export/import endpoints |
| 03 (Security/RBAC) | `designer:export` and `designer:import` permissions |
| 04 (Database) | `design_objects` table (shapes, stencils, graphics) |
| 09 (Designer) | Export/import UI, Promote to Shape wizard, Save as Stencil |
| 19 (Graphics) | Bindings JSONB schema, element classification, rendering pipeline |
| 23 (Expression Builder) | Expression AST format for expression-bound elements |
| 25 (Export System) | Native graphic interchange integration |
| 35 (Shape Library) | Shape/stencil model, sidecar schema, deduplication, ID namespacing |
| 37 (IPC Contracts) | `BindingMapping` / `BindingAttribute` type parity |

---

## Change Log

- **v0.4**: Made `graphic.svg` optional. When absent, the import server reconstructs SVG from `graphic.json` during Phase 4 using the shape library (§5.1 Reconstruction Algorithm). This enables external tools and agents to produce `.iographic` packages by authoring only `graphic.json` — no SVG authoring required. `graphic.json` was always the source of truth; SVG is now explicitly derived output. Normal I/O → I/O exports still include `graphic.svg` for import efficiency (no re-render round-trip).
- **v0.3**: Fixed stale crate name `io-types` → `io-models` (4 locations) per doc 01 v2.1 canonical crate list.
- **v0.2**: Clarified unresolved point tag behavior in import wizard. Unresolved tags are imported with original tag names by default (not rejected or treated as blocking placeholders). Default action changed from "Import as placeholder" to "Keep as-is" — graphics render immediately with N/C display. Aligned with doc 19 v1.8 (Point Binding Resolution States). Updated Phase 4 and Phase 5 language to match.
- **v0.1**: Initial specification. ZIP-based container with manifest.json, graphic.json + graphic.svg per graphic, tag-based portable bindings, shape/stencil packaging, expression references, workspace export, 5-step import wizard, SHA-256 integrity, Rust type definitions. Resolves previously-deferred "Graphics layout export" from docs 09 and 25.
