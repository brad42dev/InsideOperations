# Inside/Operations — DCS Graphics Import

## Overview

Platform-specific import system for converting existing DCS/HMI console graphics into I/O's SVG-based format. Each supported DCS vendor has a dedicated extraction path because no universal DCS graphics export format exists — every vendor stores graphics differently (HTML, XAML, SQL database, binary files, ASCII text).

This is fundamentally different from the image-based recognition pipeline (doc 26) which works from screenshots. DCS Graphics Import works from the actual source files/databases, preserving geometry, tag bindings, and element structure.

**Two complementary paths exist:**

| Path | Input | Produces | Doc |
|------|-------|----------|-----|
| **DCS Graphics Import** (this doc) | Source files/databases from DCS workstations | Structured SVG + tag bindings | 34 |
| **DCS Recognition** (doc 26) | Screenshots/raster images | Detected symbols + OCR tags | 26 |

Both paths feed into the Designer module (doc 09) for manual refinement.

---

## Architecture Pattern

All DCS imports follow a three-stage pattern (validated by BBA Universal Graphic Converter's 25+ year production use):

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Stage 1: Extract   │     │  Stage 2: Transform  │     │  Stage 3: Generate  │
│                     │     │                      │     │                     │
│  Customer runs      │──►  │  I/O import service  │──►  │  I/O graphic        │
│  extraction kit     │     │  parses intermediate  │     │  created in         │
│  on DCS workstation │     │  format, maps tags,   │     │  design_objects     │
│                     │     │  resolves symbols     │     │  table              │
│  Output: .zip       │     │                      │     │                     │
│  (SVG/XML/JSON)     │     │  Output: internal    │     │  Output: SVG +      │
│                     │     │  representation      │     │  bindings JSONB     │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

### Customer-Run Extraction Kit

For most platforms, I/O ships a lightweight extraction script that the customer (or their DCS integrator) runs on a DCS engineering workstation. This avoids I/O needing direct access to the DCS system.

**Kit contents:**
- Platform-specific extraction script (Python or VBA depending on platform)
- `README.txt` with step-by-step instructions
- Output validator (checks the extraction produced valid data)

**Kit output:** A `.zip` file containing:
- `manifest.json` — platform type, version, extraction date, display count
- Per-display files (SVG, XML, or JSON depending on platform)
- `tags.json` — consolidated tag/point reference list extracted from all displays
- `import_report.json` — extraction warnings, skipped elements, statistics

The customer uploads this `.zip` to I/O's Designer import wizard.

### Intermediate Representation

All platform-specific parsers produce a common intermediate format before generating the final I/O graphic:

```json
{
  "display": {
    "name": "UNIT-101-OVERVIEW",
    "width": 1920,
    "height": 1080,
    "background_color": "#D4D0C8"
  },
  "elements": [
    {
      "id": "elem-001",
      "type": "equipment",
      "geometry": {
        "x": 340, "y": 200,
        "width": 60, "height": 60,
        "rotation": 0
      },
      "source_type": "valve_control",
      "io_template_id": null,
      "tag_bindings": [
        { "property": "position", "tag": "FIC-101/PID1/OUT.CV" },
        { "property": "state", "tag": "FIC-101/PID1/MODE.ACTUAL" }
      ]
    },
    {
      "id": "elem-002",
      "type": "static_shape",
      "geometry": { "x": 100, "y": 100, "width": 800, "height": 2 },
      "svg_path": "M 100 101 L 900 101",
      "stroke": "#808080",
      "stroke_width": 2
    },
    {
      "id": "elem-003",
      "type": "text",
      "geometry": { "x": 340, "y": 180 },
      "content": "FIC-101",
      "font_size": 12,
      "tag_binding": null
    },
    {
      "id": "elem-004",
      "type": "dynamic_text",
      "geometry": { "x": 360, "y": 270 },
      "format": "{value} {units}",
      "tag_binding": { "property": "value", "tag": "FIC-101/PID1/PV.CV" },
      "display_element_hint": "text_readout"
    },
    {
      "id": "elem-005",
      "type": "bar_graph",
      "geometry": { "x": 420, "y": 200, "width": 20, "height": 80 },
      "orientation": "vertical",
      "range": { "lo": 0, "hi": 100 },
      "tag_binding": { "property": "value", "tag": "FIC-101/PID1/PV.CV" },
      "display_element_hint": "analog_bar"
    }
  ]
}
```

### Display Element Extraction

DCS graphics contain not just equipment shapes but also value readouts, bar graphs, trend charts, and status indicators. The import pipeline extracts these as display elements with their original positions, so the generated I/O graphic places them where the source designer intended.

**Intermediate format element types that map to I/O display elements:**

| Source Element Type | `display_element_hint` | I/O Display Element |
|---|---|---|
| `dynamic_text` (tag-bound text showing a value) | `text_readout` | Text Readout |
| `bar_graph` (vertical/horizontal range bar) | `analog_bar` | Analog Bar Indicator |
| `fill_region` (level fill inside a vessel shape) | `fill_gauge` | Fill Gauge (vessel overlay) |
| `trend_chart` (inline mini-trend) | `sparkline` | Sparkline Trend |
| `status_text` (discrete state like AUTO/MAN) | `digital_status` | Digital Status Indicator |

The `display_element_hint` field is set by the platform-specific parser based on the source element's type. The Stage 3 generator uses this hint to create the corresponding I/O display element with the correct `BindingMapping` type (doc 19).

**Position resolution during import (3-tier fallback):**

1. **Source-extracted position (preferred):** The element's `geometry.x`/`geometry.y` from the intermediate format, translated from the source coordinate system to I/O SVG canvas coordinates. This preserves the original designer's placement. Most DCS platforms store display element positions explicitly.

2. **Recognition-inferred position:** When importing via image recognition (doc 26) instead of native file parsing, the recognition pipeline detects text readouts, bar graphs, and other display elements in the screenshot. Their pixel positions are translated to canvas coordinates. Even for shapes the recognizer can't classify, it can infer display element locations from spatial proximity between detected numeric text and nearby equipment outlines.

3. **Sidecar anchor default:** When the source doesn't include a particular display element type (e.g., the DCS graphic had no bar graph, but I/O adds an analog bar during import), the shape's sidecar `valueAnchors` provide the fallback position (doc 35 v0.30).

All auto-placed elements are flagged with `placement_source` metadata (`native_import`, `recognition`, or `sidecar_default`) so the designer knows which positions are original and which are guesses. See doc 19 Import Behavior for Display Elements for the full specification.

### Import Service Integration

The DCS Graphics Import runs within the existing Parser Service (doc 02). Each platform gets a parser module:

```
Parser Service
├── svg_parser         (existing — raw SVG import)
├── dcs_honeywell      (HMIWeb .htm parser)
├── dcs_emerson        (DeltaV Live SVG/SQL parser)
├── dcs_yokogawa       (XAML parser)
├── dcs_siemens        (WinCC Unified SVG parser)
├── dcs_rockwell       (FactoryTalk XML parser)
├── dcs_ge             (iFIX SVG parser)
├── dcs_aveva          (InTouch XML parser)
├── dcs_foxboro        (ASCII .g parser)
├── dcs_abb            (800xA — future)
└── dcs_valmet         (DNA — future)
```

---

## Platform Feasibility Matrix

| # | Platform | Market Position | Primary Format | Feasibility | Best Import Path | Est. Effort |
|---|----------|----------------|----------------|-------------|------------------|-------------|
| 1 | **GE iFIX** | Power/utilities, some refinery | `.grf` binary, `.svg` export | **High** | Native SVG export via Export Picture utility | 4-6 weeks |
| 2 | **Rockwell FactoryTalk View** | Discrete/batch, refinery utilities | `.xml` export, SQL | **High** | Native XML export via Graphics Import Export Wizard | 7-10 weeks |
| 3 | **Siemens WinCC Unified** | European refineries, pharma | SVG + custom namespace | **High** | SVG files with namespace stripping | 5-8 weeks |
| 4 | **Yokogawa CENTUM VP** | Asian refineries, Middle East | `.xaml` / `.baml` (WPF) | **Medium-High** | XAML files, near 1:1 SVG mapping | 10-15 weeks |
| 5 | **Honeywell Experion PKS** | Largest refinery installed base | `.htm` (VML + ActiveX) | **Medium** | Parse HTML/VML, extract geometry + tags | 10-14 weeks |
| 6 | **Emerson DeltaV Live** | #1 Oil & Gas DCS | SQL database, HTML5/SVG runtime | **Medium-High** | Live Enterprise View browser capture | 8-12 weeks |
| 7 | **Emerson DeltaV Operate** | Legacy DeltaV | `.grf` binary (frozen iFIX v3.0) | **Low** | EMF/screenshot + tag list reference overlay | 6-8 weeks |
| 8 | **AVEVA InTouch** | Hybrid/supervisory HMI | `.win` binary, XML import/export | **Medium** | GRAccess API → XML extraction | 10-14 weeks |
| 9 | **Foxboro I/A Series** | Legacy Schneider refineries | `.g` ASCII, `.fdf` binary | **Medium** | Parse `.g` ASCII text files directly | 8-12 weeks |
| 10 | **Siemens PCS 7 / WinCC Classic** | European refineries | `.pdl` binary (OLE compound) | **Low** | VBA extraction script on WinCC workstation | 12-16 weeks |
| 11 | **ABB 800xA** | Power, mining, some refining | Aspect Object database | **TBD** | Needs hands-on access to evaluate | — |
| 12 | **Valmet DNA** | Pulp/paper, energy | Engineering database | **TBD** | Most opaque platform, needs access | — |

---

## Per-Platform Import Specifications

### 1. GE iFIX

**Extraction method:** iFIX includes an Export Picture utility that saves `.grf` files as `.svg` directly. This is the cleanest DCS graphics extraction available.

**Extraction kit:**
- PowerShell script that iterates the `PIC` directory and invokes iFIX Export Picture for each `.grf`
- Exports `.svg` + `.xtg` (tag group definitions) per display
- Requires iFIX Workspace installed (runs on the iFIX workstation)

**What's captured:**
- Full vector geometry as standard SVG
- Tag group references in `.xtg` files
- Static layout, shapes, text, colors

**What's lost:**
- OLE/ActiveX embedded controls (rendered as empty rectangles)
- VBA scripting logic
- Dynamic animation definitions (not in SVG export)

**I/O parser:** `dcs_ge` — reads standard SVG, extracts `data-*` attributes and tag references from `.xtg` sidecar files. Minimal transformation needed.

**Coordinate system note:** iFIX 5.8+ uses Enhanced Coordinates (resolution-independent). Older versions use Logical Coordinates. The extraction kit detects which mode and normalizes output.

### 2. Rockwell FactoryTalk View SE

**Extraction method:** FactoryTalk View Studio includes a Graphics Import Export Wizard that exports displays to XML format natively.

**Extraction kit:**
- PowerShell script that invokes FactoryTalk View Studio CLI export for all displays
- Outputs one `.xml` file per display (root element `<gfx>`)
- Tag references embedded in XML element properties

**What's captured:**
- Complete element hierarchy (objects, positions, properties, tag references)
- Tag binding expressions
- Color/style definitions
- Object grouping

**What's lost:**
- FactoryTalk-specific VBA macros
- Derived tag expressions (converted to static references)
- Alarm banner configurations

**I/O parser:** `dcs_rockwell` — XML parser using `quick-xml` crate. Maps FactoryTalk object types to I/O SVG primitives. Rockwell's XML schema is structured and well-defined.

### 3. Siemens WinCC Unified

**Extraction method:** WinCC Unified natively uses SVG for graphics. Displays can be exported with SVG content intact.

**Extraction kit:**
- TIA Portal scripting (Openness API) to export all screens
- SVG files with Siemens-specific XML namespace extensions (`siemens:*` attributes for tag bindings, animations, faceplate references)

**What's captured:**
- Native SVG geometry (no conversion needed)
- Tag references in custom namespace attributes
- State/animation definitions
- Faceplate structure

**What's lost:**
- Siemens-specific scripting (JavaScript in WinCC Unified)
- System function calls
- PLC-specific data type bindings

**I/O parser:** `dcs_siemens` — strips Siemens namespace, extracts tag bindings from `siemens:*` attributes, maps to I/O point references. The SVG geometry passes through with minimal transformation.

**Note:** This covers WinCC Unified only. WinCC Classic / PCS 7 uses `.pdl` binary format — see entry #10 below.

### 4. Yokogawa CENTUM VP

**Extraction method:** CENTUM VP uses WPF/XAML for graphics. XAML files can be extracted from the engineering workstation.

**Extraction kit:**
- Python script that copies `.xaml` graphic files from the Graphic Builder workspace
- Optional: BamlReader tool to decompile `.baml` runtime files back to XAML
- XAML is XML-based — directly parseable

**What's captured:**
- Full vector geometry (XAML shapes map near 1:1 to SVG equivalents)
- Layout and positioning
- Data binding expressions (WPF binding syntax)
- Style definitions

**XAML-to-SVG element mapping:**

| XAML Element | SVG Equivalent |
|-------------|----------------|
| `<Rectangle>` | `<rect>` |
| `<Ellipse>` | `<ellipse>` |
| `<Line>` | `<line>` |
| `<Polyline>` | `<polyline>` |
| `<Polygon>` | `<polygon>` |
| `<Path>` | `<path>` (XAML path syntax is SVG-compatible) |
| `<TextBlock>` | `<text>` |
| `<Canvas>` | `<g>` with transform |
| `<Grid>` | Layout calculation → absolute positions |
| `<StackPanel>` | Layout calculation → absolute positions |

**What's lost:**
- WPF layout panels (Grid, StackPanel) flattened to absolute positions
- WPF data binding triggers (re-implemented as I/O state classes)
- Yokogawa-specific UserControls

**I/O parser:** `dcs_yokogawa` — XAML/XML parser with element-by-element SVG translation. WPF binding expressions parsed to extract tag references. Most geometrically faithful conversion after iFIX SVG.

### 5. Honeywell Experion PKS

**Extraction method:** HMIWeb displays are `.htm` files containing VML (Vector Markup Language) shapes and ActiveX controls with JScript. Files are text-based HTML — parseable without Honeywell tools. Two third parties (SmartWEB, a VB.NET developer) have successfully built converters.

**Extraction kit:**
- Python script that copies `.htm` display files and their `_files/` directories from the Abstract folder
- Scans JScript blocks for `DataValue("...")` calls to extract additional tag references
- Scans `<OBJECT>/<PARAM>` tags for ActiveX control point bindings
- Scans shape custom property definitions for point references

**What's captured:**
- VML vector shapes (polylines, rectangles, ovals, arcs, text)
- Colors and basic CSS styling
- Layout/positioning (absolute coordinates)
- Tag references from three locations: `<PARAM>` tags, JScript strings, shape custom properties

**VML-to-SVG element mapping:**

| VML Element | SVG Equivalent |
|-------------|----------------|
| `<v:rect>` | `<rect>` |
| `<v:oval>` | `<ellipse>` |
| `<v:line>` | `<line>` |
| `<v:polyline>` | `<polyline>` |
| `<v:shape>` | `<path>` |
| `<v:arc>` | `<path>` with arc commands |
| `<v:textbox>` | `<text>` |
| `<v:group>` | `<g>` |

**What's lost:**
- ActiveX controls (opaque binary — rendered as placeholder rectangles)
- Shape sequences (multi-state shapes need manual recreation using I/O's state system)
- JScript dynamic logic
- 3D shading/visual effects

**I/O parser:** `dcs_honeywell` — HTML parser extracts VML namespace elements, converts VML path syntax to SVG path syntax, extracts tag bindings from all three binding locations. Post-conversion touch-up averages ~1 hour per graphic (based on third-party conversion experience with ~700 displays).

**Shape library files (`.sha`):** The extraction kit also copies shape library files from the PMD Display Object Library path. These are mapped to I/O symbol templates during import.

### 6. Emerson DeltaV Live

**Extraction method:** DeltaV Live renders displays as HTML5/SVG. The best extraction path is through **Live Enterprise View** — an Emerson Edge application that serves DeltaV Live displays to a standard web browser.

**Extraction kit (Live Enterprise View path — preferred):**
- Python script using Playwright (headless Chromium) to navigate Live Enterprise View
- Captures the rendered SVG DOM for each display
- Extracts `data-*` attributes containing GEM property bindings
- Outputs one SVG + one `tags.json` per display
- Requires DeltaV Edge 2.0+ with Live Enterprise View installed
- Read-only access — zero risk to control system

**Extraction kit (SQL path — fallback):**
- Python script connecting to DeltaV Live's SQL Server database
- Discovers schema via `INFORMATION_SCHEMA`
- Queries display, GEM class, and GEM instance tables
- Extracts geometry and module path bindings
- Requires SQL Server access credentials

**GEM-to-I/O mapping:**

| DeltaV Live Concept | I/O Equivalent |
|---------------------|----------------|
| GEM class | Symbol template (`design_objects` with `type = 'template'`) |
| GEM instance | Placed symbol on graphic |
| GEM property override | Point binding |
| Module path (`FIC-101/PID1/PV.CV`) | OPC UA point tag |
| Display | Graphic (`design_objects` with `type = 'graphic'`) |

**What's captured (Live Enterprise View):**
- Full SVG vector geometry (native format)
- Display layout and navigation structure
- GEM visual representation
- Some tag bindings (in data attributes or resolved server-side)

**What's lost:**
- Server-side data resolution details
- DeltaV-specific navigation and callup behavior
- Alarm summary integration (reimplemented in I/O's alert system)

**I/O parser:** `dcs_emerson` — SVG pass-through with DeltaV namespace stripping. Module path extraction and conversion to I/O point references. GEM class identification for symbol template mapping.

### 7. Emerson DeltaV Operate (Legacy)

**Extraction method:** DeltaV Operate stores graphics as `.grf` binary files (frozen Intellution iFIX v3.0 from 2002). The format is proprietary and undocumented. Full automated conversion is impractical.

**Approach:** Reference overlay — not full structural import.

**Extraction kit:**
- VBA script running in DeltaV Operate's configure mode that exports each display as EMF
- Python script converts EMF to SVG using `libemf2svg` or captures screenshots
- Separate OPC UA browse script enumerates all module paths (tag list)

**I/O import behavior:**
1. Upload the reference SVG/image — displayed as a locked background layer in Designer
2. Upload the tag list — populates the point picker sidebar with available tags
3. User places I/O symbols on top of the reference image, binding tags as they go
4. When done, delete the background reference layer

This is an assisted manual recreation, not an automated conversion. Still significantly faster than starting from a blank canvas.

### 8. AVEVA InTouch

**Extraction method:** InTouch stores windows as binary `.win` files but supports XML import/export for programmatic window creation. The GRAccess API (available in System Platform) provides programmatic access to ArchestrA Galaxy objects.

**Extraction kit:**
- InTouch XML Export utility exports selected windows to XML
- Alternatively, GRAccess API script extracts Industrial Graphics to HTML
- DBDump utility extracts tag database to CSV

**What's captured:**
- Window geometry and layout (from XML)
- Tag references (from XML element properties and DBDump CSV)
- Basic shapes and positioning

**What's lost:**
- QuickScript logic
- Animation triggers
- ArchestrA-specific object bindings

**I/O parser:** `dcs_aveva` — XML parser similar to Rockwell, mapping InTouch object types to SVG primitives.

### 9. Foxboro I/A Series (Legacy)

**Extraction method:** Legacy Foxboro Display Manager files are `.g` format — **structured ASCII text**. This is one of the most accessible DCS graphics formats ever created.

**Extraction kit:**
- Simple file copy from the Foxboro system (`.g` files are plain text)
- No special tools needed — the files ARE the extraction

**`.g` file structure:** ASCII text with 33 drawing commands:

| Command | Description |
|---------|-------------|
| `a` | Arc |
| `c` | Circle |
| `e` | Ellipse |
| `l` | Line |
| `p` | Polyline |
| `r` | Rectangle |
| `t` | Text |
| `g` | Group start |
| `G` | Group end |
| ... | (additional commands for fills, colors, dynamics) |

**What's captured:**
- Complete vector geometry (all 33 drawing commands → SVG equivalents)
- Text labels and tag references
- Color assignments
- Grouping structure

**What's lost:**
- FoxDraw-specific dynamic behaviors
- Connection to I/A Series data highway (tag paths need remapping)

**I/O parser:** `dcs_foxboro` — Line-by-line ASCII parser. Each drawing command maps to an SVG element. This parser is relatively simple due to the structured text format. A Sublime Text syntax highlighting package already exists for `.g` files (open-source reference for the grammar).

### 10. Siemens PCS 7 / WinCC Classic

**Extraction method:** `.pdl` files are proprietary binary (OLE compound document structure). Direct parsing is extremely difficult. WinCC ODK (Open Development Kit) provides programmatic access but requires a commercial Siemens license.

**Extraction kit:**
- VBA script running inside WinCC Graphics Designer
- Uses WinCC ODK API to enumerate objects, extract positions, properties, tag connections
- Outputs XML per display

**What's captured:**
- Object positions and geometry (via ODK enumeration)
- Tag connections
- Basic shape properties

**What's lost:**
- C script logic compiled into PDL
- Complex animation definitions
- 3D visual effects

**I/O parser:** `dcs_siemens_classic` — XML parser (same pattern as Rockwell/AVEVA). The hard work is in the extraction kit, not the I/O parser.

**Note:** This is a hard import. Recommend customers upgrade to WinCC Unified (which supports SVG) and use the WinCC Unified import path instead.

### 11. ABB 800xA — TBD

**Status:** Needs hands-on access to evaluate. Graphics are stored within ABB's Aspect Object model — deeply integrated into the plant model. `.afw` archive files exist but internal structure is not publicly documented.

**Potential path:** ABB provides a Process Graphics Migration Tool for VBPG → PG2 conversion. If the intermediate format of this tool is accessible, it could serve as an extraction point.

### 12. Valmet DNA — TBD

**Status:** Most opaque platform studied. Graphics stored in a centralized engineering database with no publicly documented export capabilities. Valmet DNA is a relatively closed ecosystem.

**Potential path:** Screen capture + SymBA DCS recognition (doc 26) is likely the only viable import method. Tag enumeration via OPC UA browse if the Valmet OPC UA server is available.

---

## DCS Import Wizard

The DCS Import Wizard in the Designer module (doc 09) is extended to handle structured DCS file imports alongside the existing image-based recognition flow:

### Wizard Entry Point

When the user selects "Import" in Designer, the wizard detects the input type:

| Input | Route |
|-------|-------|
| Image file (PNG, JPEG, PDF, BMP) | Existing DCS Recognition Wizard (doc 09, 7 steps) |
| `.zip` extraction kit output | DCS Graphics Import Wizard (this section) |
| Raw DCS files (`.htm`, `.xml`, `.xaml`, `.g`, `.svg`) | DCS Graphics Import Wizard with auto-detected platform |

### DCS Graphics Import Wizard Steps

1. **Upload**: User uploads extraction kit `.zip` or raw DCS file(s). System reads `manifest.json` to identify platform, or auto-detects format from file contents.

2. **Preview**: Parsed intermediate representation rendered as a preview. User sees the extracted geometry and a summary: element count, tag count, unmapped symbols count, warnings.

3. **Tag Mapping**: Side-by-side display of extracted DCS tags (left) and I/O's available points (right). Auto-matched tags highlighted in green. Unmatched tags shown with a search/select control. User can:
   - Accept auto-matches
   - Manually map unmatched tags to I/O points
   - Skip tags (leave binding empty for later)
   - Create new point placeholders for tags not yet in I/O

4. **Symbol Mapping**: Extracted equipment symbols mapped to I/O's shape library (doc 35). Auto-matched symbols highlighted. Unmapped symbols shown with template selector. User can:
   - Accept auto-matches
   - Select alternative templates
   - Mark as "import as static shape" (geometry preserved, no template mapping)

5. **Generate**: I/O graphic created in `design_objects` table. Import report generated showing: elements imported, tags mapped, symbols matched, warnings, skipped items.

6. **Refine**: Generated graphic opens in Designer with standard editing tools. A sidebar panel shows the import report for reference.

### Permissions

Uses existing `designer:import` permission — no new permissions needed.

---

## Tag/Point Mapping Strategy

DCS platforms use different tag path conventions. The import system normalizes these to I/O's point model:

| Platform | Native Tag Format | Example | I/O Mapping |
|----------|------------------|---------|-------------|
| Honeywell Experion | `Alias.Parameter` or CDA format | `HoursRun.PV` | Fuzzy match against `points_metadata.tagname` |
| Emerson DeltaV | `MODULE/BLOCK/PARAM.FIELD` | `FIC-101/PID1/PV.CV` | Parse module name → match tagname prefix |
| Yokogawa CENTUM VP | Station/group/tag hierarchy | `FCS0101.FIC101.PV` | Dot-delimited → match last segment |
| Rockwell FactoryTalk | `[PLC]Tag.Member` | `[PLC_Main]FIC_101.PV` | Strip PLC prefix → match tag |
| Siemens WinCC | `Tag:Connection\ItemName` | `S7:PLC\FIC101_PV` | Strip connection prefix → match |
| GE iFIX | `NODE.TAG.FIELD` | `SCADA1.FIC101.F_CV` | Match middle segment |
| AVEVA InTouch | Tag dictionary names | `FIC101_PV` | Direct match or fuzzy |
| Foxboro | I/A Series compound/block | `FIC101:PV.VALUE` | Parse compound name |

**Auto-matching algorithm:**
1. Normalize both DCS tag and I/O tagname (lowercase, strip common prefixes/suffixes)
2. Extract the "core identifier" (typically the ISA tag number like `FIC-101`)
3. Match core identifiers
4. If multiple I/O points share the same core identifier, rank by parameter type (PV > SP > OUT > MODE)
5. Present auto-matches with confidence scores; flag low-confidence matches for user review

---

## Implementation Phasing

### Phase 1 — High-Value, Low-Effort (Development Phases 12-13)

| Platform | Rationale |
|----------|-----------|
| GE iFIX | Native SVG export = minimal parser work |
| Rockwell FactoryTalk | Native XML export = clean structured data |
| Siemens WinCC Unified | Native SVG = minimal transformation |

These three platforms cover a significant portion of SCADA/HMI installations and require the least parser development because they export to parseable formats natively.

### Phase 2 — High-Value, Medium-Effort (Development Phases 14-15)

| Platform | Rationale |
|----------|-----------|
| Emerson DeltaV Live | #1 Oil & Gas DCS, Live Enterprise View is a game-changer |
| Yokogawa CENTUM VP | XAML → SVG mapping is well-defined |
| Foxboro I/A Series | ASCII text = trivial parsing, large legacy installed base |

### Phase 3 — Medium-Value, High-Effort (Post-Launch)

| Platform | Rationale |
|----------|-----------|
| Honeywell Experion | Huge installed base but VML parsing is complex |
| AVEVA InTouch | Requires GRAccess API or XML export path |
| Emerson DeltaV Operate | Reference overlay only (not full conversion) |
| Siemens PCS 7 / WinCC Classic | Recommend customer upgrade to WinCC Unified |

### Phase 4 — Pending Access (Post-Launch, Opportunistic)

| Platform | Rationale |
|----------|-----------|
| ABB 800xA | Needs hands-on evaluation |
| Valmet DNA | Needs hands-on evaluation |

---

## API Endpoints

```
POST   /api/designer/import/dcs           Upload extraction kit .zip or raw DCS files
GET    /api/designer/import/dcs/:id        Get import job status and preview
POST   /api/designer/import/dcs/:id/tags   Submit tag mapping decisions
POST   /api/designer/import/dcs/:id/symbols  Submit symbol mapping decisions
POST   /api/designer/import/dcs/:id/generate  Generate I/O graphic from mapped import
GET    /api/designer/import/dcs/:id/report Get import report
```

All endpoints require `designer:import` permission.

---

## Cross-References

- **Doc 02** (System Architecture): Parser Service handles DCS format detection and parsing
- **Doc 09** (Designer Module): DCS Import Wizard UI, file import flow, symbol library
- **Doc 19** (Graphics System): Target SVG format, point bindings, symbol templates, display element import position resolution (3-tier fallback)
- **Doc 26** (Symbol Recognition): Complementary image-based import path for screenshots
- **Doc 35** (Shape Library): Symbol templates used for DCS equipment mapping during import
- **Doc 24** (Universal Import): Separate system — Universal Import handles structured data (work orders, equipment records); DCS Graphics Import handles visual display files
- **SymBA Doc 17** (I/O Integration): .iomodel packages for recognition-based import path

---

## Change Log

- **v0.2**: Added Display Element Extraction section. Intermediate format extended with `display_element_hint` field and `bar_graph` element type. 5 source element types map to I/O display elements (text readout, analog bar, fill gauge, sparkline, digital status). 3-tier position resolution: source-extracted → recognition-inferred → sidecar anchor default. Auto-placed elements tagged with `placement_source` metadata. Cross-references to doc 19 v1.3 (import behavior, 3-tier fallback), doc 35 v0.30 (sidecar anchor defaults), doc 26 (recognition-inferred positions).
- **v0.1**: Initial specification. 12 DCS platforms assessed. Three-stage import architecture (extract → transform → generate). Customer-run extraction kit pattern. Per-platform import specs for 10 platforms (GE iFIX, Rockwell, Siemens WinCC Unified, Yokogawa, Honeywell, Emerson DeltaV Live/Operate, AVEVA, Foxboro, Siemens PCS 7). DCS Import Wizard (6 steps). Tag mapping strategy. 4-phase implementation plan.
