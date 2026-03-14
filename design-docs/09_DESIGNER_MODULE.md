# Inside/Operations - Designer Module

## Overview

Unified visual editor for creating process graphics, dashboards, and report templates. Built on SVG.js (MIT) for SVG-native editing -- what you edit IS the display format. No canvas-to-SVG translation layer.

## Architecture

### Editor Library

**SVG.js** (MIT) provides the SVG DOM manipulation layer. The Designer is an SVG-native editor: the document you create and edit is the same SVG format used for display in Console (doc 07), Process (doc 08), and Dashboards (doc 10). This eliminates format conversion artifacts and ensures WYSIWYG fidelity.

### Three Design Modes

One unified Designer serves all visual content creation through three modes:

| Mode | Canvas Style | Available Elements | Output / Used By |
|------|-------------|-------------------|------------------|
| **Graphic** | Freeform SVG | Symbols, shapes, lines/pipes, text, point bindings, connection points | Console (doc 07), Process (doc 08) |
| **Dashboard** | Grid or freeform | Widgets (trends, tables, gauges, KPIs, alarm lists -- from doc 32) | Dashboards (doc 10) |
| **Report** | Page-oriented | Same widgets as Dashboard + text blocks, headers, footers, page breaks, sections | Reports (doc 11) |

**Shared Element Palette**: Widgets, shapes, tables, and trends can be dropped onto ANY mode. Dashboard and Report share the same widget library (doc 32). The only behavioral difference: Report mode adds expanding elements and page-oriented layout controls.

**Dashboard-Report Interchangeability**: A dashboard layout can become a report template -- run it against a time range and export. Same element palette, different runtime behavior.

### Primary Workflow

1. Drag pre-built SVG symbols from the symbol library onto the workspace
2. Position and arrange symbols on the canvas
3. Draw connecting lines/pipes between elements
4. Bind elements to OPC points via the property panel
5. Configure value displays, color mappings, and animations

This is the 80% workflow. The Designer is a symbol composition tool, not a pixel-level graphics editor.

### Custom Shape Drawing

Secondary workflow for creating custom SVG shapes:
- Pen tool (freeform paths, bezier curves)
- Rectangle, ellipse, polyline tools
- Full vector drawing capabilities
- Custom shapes can be saved to the symbol library for reuse

Available but not the primary use case. Most users drag pre-built symbols; power users create custom symbols when needed.

### Promote to Shape Wizard

The Promote to Shape wizard converts a freehand SVG drawing (or an imported stencil) into a full I/O equipment shape with connection points, state handling, and value display anchors. Access: select elements in the Designer → right-click → "Promote to Shape".

**Wizard Steps:**

1. **Name & Category** — Enter shape ID prefix (e.g., `wet-gas-scrubber`), display name, and select a category (Valves, Pumps, Rotating, Heat Transfer, Vessels, Separation, Instrumentation, Control, or Custom). The system appends `.custom.<db_id>` automatically.

2. **Boundary & Sizing** — The wizard shows the selected elements with a bounding box. User confirms or adjusts the canonical boundary. The shape is normalized to a 48×48 viewBox (matching the built-in library convention).

3. **Connection Points** — Click on the shape boundary to place connection points. For each point: assign an ID (e.g., `inlet`, `outlet`, `drain`), direction (`left`, `right`, `up`, `down`), and type (`process`, `signal`, `actuator`, `electrical`). Minimum 0 (no connections), typical 2-4.

4. **Stateful Elements** — Select SVG elements that should change appearance with operational state. Each selected element gets the `io-stateful` class. The wizard shows a preview of the shape in each state (normal/running/stopped/fault) using the standard CSS classes. If no elements are marked stateful, the shape will be purely structural (gray always).

5. **Text Zones** — Click to place text zone anchors: tag name position, value position. These define where the renderer places tag/value text when the shape is used on a graphic.

6. **Value Display Anchors** — Click to place default positions for text readouts, analog bars, alarm indicators. These provide Quick Bind snap positions (see doc 35 sidecar schema). The alarm anchor position (upper-right by default) is set here.

7. **Orientation & Mirror** — Select which orientations are valid (0°, 90°, 180°, 270°) and whether the shape can be mirrored horizontally/vertically.

8. **Preview & Save** — Review the complete shape with all metadata overlaid visually. Save creates the shape in `design_objects` with `type='shape'` and full sidecar metadata in `metadata` JSONB.

The wizard can also be launched on an existing stencil to promote it: right-click a stencil in the palette → "Promote to Shape".

### Save as Stencil

Quick path for creating reusable visual elements without metadata. Select elements in the Designer → right-click → "Save as Stencil".

Dialog: name, category (from a flat list or "New Category..."), optional tags for search. No wizard steps — the selected SVG elements are saved directly as a stencil in `design_objects` with `type='stencil'`. The stencil appears in the Designer palette under the Stencils section.

## Symbol Library

### Sources

- **Pre-built symbols**: Shipped with I/O. Common P&ID symbols (pumps, valves, vessels, instruments) and DCS equipment symbols with ISA-101 HMI styling and CSS class-based state switching (alarm, open/closed, running/stopped)
- **SymBA recognition pipeline**: Symbols produced by the recognition pipeline (doc 26) are added to the library. Grows over time as recognition produces more templates.
- **User-created symbols**: Custom symbols created in the Designer and saved to the library for reuse
- **Gap report recommendations**: `.iogap` variation gap reports identify unmatched symbol variations that need new templates (see Symbol Library Gap Analysis below)

### Palette Organization

The Designer palette has two top-level sections:

- **Equipment** — Full shapes from the shape library. Organized by category (Valves, Pumps, Rotating, Heat Transfer, Vessels, Separation, Instrumentation, Control). Shows both built-in library shapes and custom shapes (created via Promote to Shape wizard). Built-in shapes show a lock icon (immutable). Custom shapes show a pencil icon (editable).

- **Stencils** — Reusable visual elements created via Save as Stencil. Organized by user-defined categories. No metadata, no data binding. Drag and drop to place.

Both sections support search-by-name and filtering by category.

## Interaction Layer

Built on SVG.js primitives:

- **Selection**: Click to select, shift-click for multi-select, drag for marquee selection
- **Transform handles**: Move, resize, rotate selected elements
- **Snap-to-grid**: Configurable grid with alignment guides (smart guides show when elements align)
- **Connection routing**: Auto-routing pipe/line paths between equipment connection points (Graphic mode only). Orthogonal routing (horizontal/vertical segments, right-angle bends) with obstacle-aware path adjustment. Toggleable to manual routing mode where user draws the path with snap-to-horizontal/vertical assist. Dashboard/Report modes use basic static lines/dividers — no connection routing logic.
- **Layer management**: Z-order control, named layers, show/hide layers
- **Grouping/ungrouping**: Combine elements into groups, nest groups
- **Undo/redo**: 20 levels, manual save (Ctrl+S). Auto-saves local draft to IndexedDB every 60 seconds as crash protection. On reopen after crash, prompts "Recover unsaved changes?"
- **Copy/paste**: Within and across graphics
- **Zoom/pan**: Mouse wheel zoom, drag to pan, fit-to-screen
- **Ruler and guides**: Edge rulers with draggable guide lines

## Point Binding

Select element → open property panel → pick point via Point Picker (doc 32) → configure binding:

- **Display value as text**: Show the live point value as a text label on or near the element
- **Map value to color**: Define value ranges that change the element's fill/stroke color (e.g., green = normal, yellow = warning, red = alarm)
- **Map value to rotation/position**: Animate element rotation or position based on point value (e.g., valve stem position)
- **Conditional visibility**: Show/hide element based on point value or expression
- **Point search**: Tagname search scoped by source for multi-source points
- **Binding validation**: Checks `data_type` and `engineering_units` from `points_metadata`
- **Point metadata context**: Criticality and area displayed for binding context
- **Test mode**: Preview bindings with live data before publishing

### Unresolved Tag Behavior

The Designer allows saving graphics with tag names that do not resolve to existing points. Tag name fields accept any string value — validation is informational only. A yellow "not found" indicator appears next to unresolved tags in the property panel, but it does not block save or publish. This enables:

- Building graphics before OPC sources are configured
- Pre-populating tag names from engineering documents or spreadsheets
- Editing graphics portably across I/O instances with different point configurations

**Validate Bindings tool:** Available via toolbar button or right-click context menu on the canvas. Generates a non-blocking summary report showing resolved vs. unresolved tags across all bindings in the current graphic. The report lists each unresolved tag name with the element it is bound to. This is a diagnostic aid, not a gate — the graphic is fully functional with unresolved bindings (elements display `N/C` at runtime per doc 19).

### Display Element Palette (Graphic Mode)

In addition to the equipment symbol palette, Graphic mode provides a **value display palette** for placing data-bound display elements on the canvas. These are the 6 display element types defined in doc 19 (Point Value Display Elements):

| Palette Item | Description | Binding |
|---|---|---|
| **Text Readout** | Numeric value ± label ± units ± background box | Single point |
| **Analog Bar** | Segmented zone bar with moving pointer, alarm zone highlighting | Single point |
| **Fill Gauge** | 0-100% level fill inside vessel or standalone rectangle | Single point |
| **Sparkline** | Tiny inline trend showing recent value trajectory | Single point |
| **Alarm Indicator** | ISA-101 priority-coded shape+color+text near equipment | Single point or aggregate |
| **Digital Status** | Binary/discrete state text (RUN/STOP, OPEN/CLOSED) | Single point |

Each element is placed by dragging from the palette onto the canvas, then binding to a point via the property panel. Alarm thresholds (HH/H/L/LL) auto-populate from the bound point's alarm configuration.

### Quick Bind

Dragging a point from the Point Browser directly onto an equipment shape that has sidecar `valueAnchors` (doc 35):

1. Auto-creates a Text Readout at the first available anchor position
2. Binds it to the dropped point
3. Designer can change element type, reposition, or delete

This shortcut bypasses the palette → place → bind workflow for the most common case.

### Bulk Display Configuration

Select multiple display elements → property panel shows shared properties (font size, background style, alarm behavior, decimal precision). Edit once, apply to all selected. Useful when setting up a new graphic with many value displays that share formatting.

## Report-Specific Features

Available only in Report mode:

- **Expanding elements**: Tables and data-driven sections expand based on data at generation time. In the Designer, they display as a placeholder with an overflow indicator (dashed bottom border, expand icon) showing approximate size
- **Page break controls**: "Always start on new page" and "Keep together" properties on any element or group
- **Preview with sample data**: Generates 1-2 pages to check formatting without running the full report. Quick validation of layout before publishing the template.

## Key Features

### File Import

Format detection chain — user drags a file in, system auto-detects format and routes to the appropriate handler. User can override if auto-detect guesses wrong.

**Tier 1 — Native/known formats** (deterministic parsing, high fidelity):
- **SVG** — direct import, native format
- **DCS native files** — 10 platforms with built-in parsers (see [34_DCS_GRAPHICS_IMPORT.md](34_DCS_GRAPHICS_IMPORT.md))

**Tier 2 — Standard vector formats** (parser-based conversion):
- **DXF** — CAD exchange format (open spec, Rust crates available). DWG intentionally excluded (Autodesk proprietary licensing).
- **VSDX** — Visio (ZIP of XML, parseable). Common in industrial settings.
- **WMF/EMF** — Legacy Windows metafiles, still common in older systems.

**Tier 3 — Raster** (recognition pipeline):
- PNG, JPEG, TIFF, BMP, PDF (rasterized) — routed to P&ID or DCS recognition wizard based on content classification (see doc 26)

**Tier 4 — Best effort**:
- Unrecognized file → detect format by magic bytes/header → attempt most likely parser → fall back to raster recognition → if all fail, clear error: "Unrecognized format. Try exporting as SVG or PNG from your source application."

General:
- Preview before import
- Batch import multiple files
- File size limit: 10 MB per file

### Data Export
- Export button on graphics list table toolbar: `[Export v]` split button
- Exportable entities: graphics metadata list (name, type, created_by, bindings_count), per-graphic point bindings (element_id, tagname, binding_type, value_map), template catalog
- SVG source data excluded from export (too large for tabular format; use Designer UI for SVG access)
- Supported formats: CSV, XLSX, JSON
- Requires `designer:export` permission
- Bulk-update candidate: point bindings (high-value for OPC server migration), graphics metadata (bulk rename/reorganize)
- See 25_EXPORT_SYSTEM.md for full export specifications

### Shape SVG Export/Reimport

Export any shape or stencil as a standalone SVG file for editing in external tools (Illustrator, Inkscape, etc.), then reimport the edited SVG back.

**Export:**
- Right-click any shape/stencil in the palette → "Export SVG"
- Right-click a placed shape on the canvas → "Export Shape SVG"
- Exports the raw SVG content as a standalone `.svg` file
- For shapes with composable parts (e.g., valve body + actuator), exports the base shape SVG only — parts are separate shapes
- Filename: `{shape_id}.svg` (e.g., `vessel-horizontal.svg`, `wet-gas-scrubber.custom.47.svg`)
- Available for all shapes — both library (Tier 1) and user-created
- No special permissions required beyond `designer:read`

**Reimport:**
- Right-click a user-created shape/stencil in the palette → "Replace SVG..."
- Browse for an SVG file → preview shows old vs. new side-by-side
- Validation: SVG must parse cleanly, viewBox must be present, no embedded scripts
- On accept: replaces the shape's SVG content in `design_objects`. Existing sidecar metadata (connection points, text zones, value anchors, states) is preserved — only the visual geometry changes.
- **Warning if dimensions changed significantly** (>10% viewBox difference): "Shape dimensions changed. Connection points and value anchors may need repositioning." Opens the shape editor for review.
- All graphics using this shape update automatically on next render (shapes are referenced, not copied)

**Restrictions:**
- Library shapes (`metadata->>'source' = 'library'`) are **read-only** — export is allowed but reimport is blocked. To customize a library shape, copy it first (creates a user-owned version), then edit the copy.
- Reimport requires `designer:write` permission

### Graphic Export (.iographic)

- Export button in Designer: File → Export → `.iographic`
- Export from Console/Process: right-click graphic pane → "Export Graphic"
- Batch export from Settings → Graphics Management: select multiple → "Export Selected"
- Exports one or more graphics with all shapes, stencils, bindings (tag-name based), pipes, annotations, and layer definitions into a single portable `.iographic` package
- Custom shapes and stencils used by the graphic are included in the package
- Point references use tag names (not UUIDs) for cross-instance portability
- See doc 39 (.iographic Format Specification) for full format details
- Requires `designer:export` permission

### Graphic Import (.iographic)

- Import via Designer: File → Import → select `.iographic` file
- Import wizard: package overview → shape dependencies → point tag resolution → import options → confirm
- Custom shapes/stencils in the package are added to the local shape library
- Missing built-in shapes show placeholder rectangles (auto-replaced when shapes become available)
- Unresolved point tags can be mapped manually or imported as placeholders (auto-resolve when points appear)
- See doc 39 for full import workflow specification
- Requires `designer:import` permission

### P&ID Import Wizard
- Automated symbol detection for imported P&ID images using ONNX-based recognition models
- 6-step wizard flow:
  1. **Upload**: User uploads a P&ID image (PNG, JPEG, PDF, TIFF)
  2. **Detect**: Recognition service runs inference, returns detected symbols with confidence scores
  3. **Review**: Original image displayed with bounding box overlays; color-coded by confidence (green > 0.90, yellow 0.70-0.90, red < 0.70); user can accept, reject, or correct each detection via class dropdown
  4. **Map**: Accepted symbols mapped to I/O's SVG template library (ISA-101 HMI style); unmapped classes flagged for manual handling
  5. **Generate**: SVG graphic created with symbols at detected positions, point binding placeholders from OCR tag numbers, connection lines preserved
  6. **Refine**: Generated graphic opens in Designer for manual editing with standard Designer tools
- Requires `designer:import` permission (existing; no new permissions needed)
- Wizard option hidden when no recognition model is loaded (graceful degradation)
- All user corrections during Review step are logged for feedback export (see Settings > Recognition)
- See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) for full recognition specification

### DCS Import Wizard (Screenshot-Based)
- Automated equipment detection for imported DCS graphics using ONNX recognition — this is the screenshot/raster path. For native DCS file import (vendor source files), see [34_DCS_GRAPHICS_IMPORT.md](34_DCS_GRAPHICS_IMPORT.md).
- 7-step wizard flow (extends P&ID wizard with additional stages):
  1. **Upload**: User uploads a DCS graphics image (PNG, JPEG, PDF, BMP)
  2. **Classify**: Recognition service confirms the image is a DCS graphic (not P&ID or other). If misclassified, user can override.
  3. **Detect Equipment**: Equipment detector identifies DCS symbols (25 Tier 1 types: valves, pumps, vessels, indicators, etc.). Results displayed with bounding boxes and confidence scores.
  4. **Classify Lines**: Line classifier identifies connector types (process line, signal line, equipment boundary, annotation line). Color-coded overlay shows classified lines.
  5. **Detect & Classify Text**: Text detector locates text regions; text classifier categorizes each as point_name, value, status, or description. OCR extracts text content. Detected text associated with nearest equipment symbol.
  6. **Review**: User reviews combined results — equipment, lines, and text overlaid on original image. Accept, reject, or correct each detection. All corrections logged for feedback.
  7. **Generate & Refine**: Accepted detections mapped to I/O's DCS SVG template library (ISA-101 HMI style with CSS state classes). Generated graphic opens in Designer for manual refinement.
- Requires `designer:import` permission (same as P&ID wizard; no new permissions)
- Wizard option hidden when no DCS recognition model is loaded (graceful degradation per model_domain)
- The wizard auto-detects whether an uploaded image is P&ID or DCS and routes to the appropriate wizard flow
- See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) for full recognition specification

### Symbol Library Gap Analysis
- `.iogap` variation gap reports (imported via Settings > Recognition) identify symbol variations that lack matching SVG templates in the library
- Gap report data surfaces priority-ranked recommendations for new template creation, with variation thumbnails showing unmatched symbol appearances
- Designers can create new templates directly from gap report recommendations, or map existing templates to cover identified variations
- Coverage tracking across successive gap report imports shows whether template expansion is keeping pace with recognized variation diversity
- Templates are drawn from the Shape Library ([35_SHAPE_LIBRARY.md](35_SHAPE_LIBRARY.md)) — 25 DCS equipment categories with ISA-101 HMI styling, connection points, and CSS state classes
- See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) Section "Variation Gap Reports (.iogap)" for the full gap report flow

### Phone Preview Mode

When designing dashboards, authors can toggle a "Phone Preview" mode in the toolbar. This shows a phone-width canvas (~375px wide) where they can arrange and resize widgets for the phone layout.

- **Phone canvas**: Single-column layout at ~375px width. Widgets snap to full-width or half-width (two KPI cards side-by-side).
- **Drag and resize**: Author drags widgets from the left panel onto the phone canvas, positions and resizes them. Vertical ordering is explicit — author controls what's on top.
- **Storage**: The phone layout is stored as `layout_phone` in the dashboard's JSONB config, alongside the existing `layout_desktop`.
- **Optional**: Phone preview is optional — dashboards work on phone with auto-generated layouts even without manual phone configuration. The auto-generated layout uses widget priority scores to produce a reasonable single-column view (see doc 20).
- **Priority indicator**: Each widget shows its `phone_priority` score (0-10, defaulted by widget type) as a visual badge, helping authors decide which widgets to include.

### Phone Tile Generation

When a graphic is saved or published in Graphic mode, a background job automatically generates a tile pyramid for phone viewing. The tile pyramid is a set of 256x256 PNG tiles at multiple zoom levels, rendered server-side from the SVG using `resvg` (MPL-2.0).

- **Automatic**: The Designer author doesn't need to do anything special — tile generation is triggered on save/publish.
- **Background processing**: Tile generation runs asynchronously and does not block the save operation.
- **Regeneration**: Tiles are regenerated whenever the graphic's structural elements change. Dynamic value overlays are not baked into tiles — they update live on the phone client.
- See doc 20 (Mobile Architecture) for the full phone graphics specification.

### Graphic Reuse

"Templates" in the Designer context means saved graphics that can be cloned. The parameterization people would need (multi-point binding, HART multi-variable instruments, setpoint/PV/output on a single symbol) is handled by the shape binding architecture in docs 19 and 35. No separate template parameterization system is needed.

- **Clone**: "Save As" on any graphic creates an independent copy. User rebinds points to the new context.
- **Symbol library**: Reusable shapes with multiple bindable slots are managed via the Shape Library (doc 35) and Graphics System (doc 19), not the Designer's template system.
- **Revisitable**: If a template parameterization need emerges during build that isn't covered by shape bindings, this can be revisited.

## User Stories

1. **As a designer, I want to import existing graphics from our HMI system, so I don't have to recreate everything.**

2. **As an engineer, I want to bind process points to graphic elements, so the graphics display live data.**

3. **As a power user, I want to create templates for common equipment, so other users can reuse them.**

4. **As an engineer, I want to import a DCS graphics screenshot and have equipment symbols, connector lines, and text automatically detected, so I can recreate the DCS display digitally in a fraction of the time.**

## Concurrent Editing

**Pessimistic locking with fork option.** First user to open a graphic for editing acquires the lock. Second user opens in read-only mode.

- **Lock indicator**: Read-only banner: "Locked by Jane Smith since 10:45 AM"
- **Lock storage**: `locked_by UUID` and `locked_at TIMESTAMPTZ` columns on `design_objects`
- **Lock release**: On save, on close, or after idle timeout (30 minutes of no edits)
- **Crash recovery**: If the lock holder's browser crashes, the idle timeout handles cleanup
- **Fork option**: Read-only user can "Save As" to create their own copy and work independently
- **Request lock**: Read-only user can send a notification to the lock holder requesting release

## Graphic Versioning

**Draft history + permanent publish snapshots.**

- **Draft saves**: Rolling window of last 10 saves per graphic. Each Ctrl+S creates a draft version. Oldest drafts pruned automatically when the window is exceeded.
- **Publish snapshots**: Every "Publish" creates a permanent, immutable version snapshot. Published versions are never pruned.
- **Version browser**: View version history timeline. Preview any version. Roll back to a previous version (creates a new draft from the old version's content).
- **Personal copies**: Users can "Save As" at any time to fork a personal copy outside the version history of the original.

## Technical Requirements

### Import Service
- Parser service API: `POST /api/designer/import`
- File size limit: 10 MB per file
- Format auto-detection with user override (see File Import above)
- Async processing for large files

### Canvas Performance
- Render 1000+ objects smoothly on the SVG.js canvas
- Selection highlighting < 16ms
- Object manipulation smooth (60 FPS)
- Efficient rendering (viewport culling)

### Storage
- Graphics stored in design_objects table
- SVG data in TEXT column
- Bindings in JSONB column
- Metadata (name, type, created_by) in columns

## API Endpoints

- `POST /api/designer/import` - Import graphics file
- `POST /api/designer/graphics` - Create graphic
- `GET /api/designer/graphics/:id` - Get graphic
- `PUT /api/designer/graphics/:id` - Update graphic
- `DELETE /api/designer/graphics/:id` - Delete graphic
- `GET /api/designer/templates` - List templates
- `POST /api/designer/templates` - Create template

## Success Criteria

✅ Users can import graphics files  
✅ Canvas editor is responsive and intuitive  
✅ Point binding works correctly  
✅ Templates can be created and reused  
✅ Changes save and persist

## Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `designer:read` | View graphics in designer | All roles |
| `designer:write` | Create/edit graphics (personal drafts) | Operator, Analyst, Supervisor, Content Manager, Admin |
| `designer:import` | Import files and run symbol recognition (P&ID and DCS) | Operator, Analyst, Supervisor, Content Manager, Admin |
| `designer:publish` | Publish graphics for other users | Supervisor, Content Manager, Admin |
| `designer:delete` | Delete graphics | Supervisor, Admin |
| `designer:export` | Export graphics metadata and point bindings | Operator, Analyst, Supervisor, Content Manager, Admin |
| `designer:admin` | Designer module administration | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

## Change Log

- **v1.9**: Converted permissions table from 3-role column format (User/Power User/Admin) to 2-column format with named Default Roles matching the 8 predefined roles (doc 03). Clarified designer:write as personal drafts available to most roles, designer:publish restricted to senior roles.
- **v1.8**: Updated Tier 1 shape count from 27 to 25 (instrument consolidation v0.18 + air-cooler addition v0.19 in doc 35).
- **v1.7**: Added Shape SVG Export/Reimport. Export any shape/stencil as standalone SVG for external editing (Illustrator, Inkscape). Reimport edited SVG into user-created shapes (library shapes are read-only — copy first to customize). Side-by-side preview, SVG validation, dimension change warning. Sidecar metadata preserved on reimport. Removed "layout/shape export deferred" note — feature is now designed. API: `GET/PUT /api/designer/shapes/:id/svg` (doc 21).
- **v1.6**: Added Unresolved Tag Behavior section. Tag name fields accept any string — validation is informational (yellow "not found" indicator, non-blocking). Added Validate Bindings tool for resolved vs. unresolved tag summary report. Graphics are fully functional with unresolved bindings (N/C display at runtime). See doc 19 v1.8 (Point Binding Resolution States).
- **v1.5**: Added Promote to Shape wizard (8-step workflow for converting freehand SVG or stencils into full I/O shapes with connection points, state handling, and value anchors). Added Save as Stencil quick-save. Updated palette organization: Equipment section (shapes) + Stencils section. Added `.iographic` export/import capability with tag-based portable bindings, import wizard, and shape deduplication. See doc 35 (shape/stencil model), doc 39 (.iographic format).
- **v1.4**: Added Display Element Palette section (6 display element types from doc 19: text readout, analog bar, fill gauge, sparkline, alarm indicator, digital status). Added Quick Bind (drag point onto shape → auto-create readout at sidecar anchor). Added Bulk Display Configuration for multi-select property editing. See doc 19 v1.2, doc 35 v0.29.
- **v1.3**: Deep dive: Added Concurrent Editing section (pessimistic lock with fork option, lock indicator, idle timeout release, request lock notification). Added Graphic Versioning section (rolling 10-draft window + permanent publish snapshots, version browser with preview and rollback). Replaced thin "Template Creation" section with "Graphic Reuse" — templates are cloneable graphics, parameterization handled by shape binding architecture (docs 19, 35). Expanded File Import with 4-tier format detection chain: Tier 1 SVG + DCS native (doc 34), Tier 2 DXF/VSDX/WMF/EMF, Tier 3 raster via recognition (doc 26), Tier 4 best-effort auto-detect. DWG excluded (Autodesk proprietary). Connection routing specified as orthogonal obstacle-aware with manual toggle, Graphic mode only. Added manual save (Ctrl+S) with IndexedDB crash recovery auto-save. Updated import service technical requirements.
- **v1.2**: Added cross-references to doc 34 (DCS Graphics Import) on DCS Import Wizard to distinguish screenshot-based recognition from native file import. Added doc 35 (Shape Library) reference to Symbol Library Gap Analysis section.
- **v1.1**: Updated DCS Import Wizard description to remove "multi-model" reference. DCS recognition uses the same single-model architecture as P&ID. Matches SymBA's actual implementation.
- **v1.0**: Added phone preview mode for dashboard design and automatic tile generation for phone graphic viewing. See doc 20 for full phone graphics and dashboard layout specs.
- **v0.9**: Major architecture specification -- SVG.js as editor library, three design modes (Graphic/Dashboard/Report), shared widget palette from doc 32, symbol library fed by SymBA recognition pipeline, interaction layer specification, point binding detail, report-specific features (expanding elements, page breaks, sample data preview).
- **v0.8**: Added Permissions section with 7 Designer permissions and role assignments from RBAC model (doc 03).
- **v0.7**: Added Symbol Library Gap Analysis section referencing `.iogap` variation gap reports. Gap reports inform template library expansion by identifying unmatched symbol variations with priority-ranked recommendations. See doc 26.
- **v0.6**: Added DCS Import Wizard section with 7-step multi-model recognition flow (equipment → lines → text → review → generate). Added DCS symbol templates to Object Library. See `26_PID_RECOGNITION.md` and `SymBA/09b_GAME_TYPES_DCS.md`.
- **v0.5**: Fixed "Undo/undo" typo to "Undo/redo" in Canvas Editor features.
- **v0.4**: Added P&ID Import Wizard section with 6-step recognition flow. See `26_PID_RECOGNITION.md`.
- **v0.3**: Added Data Export section. Designer gains export buttons for graphics metadata list and per-graphic point bindings. SVG source excluded from tabular export. Layout/shape export deferred. Requires `designer:export` permission. See 25_EXPORT_SYSTEM.md.
- **v0.2**: Point binding tagname search now scoped by source for multi-source points. Point metadata includes criticality and area for binding context. Binding validation uses `data_type` and `engineering_units` from `points_metadata`.
