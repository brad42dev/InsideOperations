# Inside/Operations — Shape Library

## Overview

I/O ships a built-in library of DCS equipment shapes as individual SVG files with JSON metadata sidecars. Each shape is a standalone file that can be opened and edited in any SVG editor (Inkscape, Illustrator, Figma). The shapes follow ISA-101 High Performance HMI design principles: flat 2D, gray baseline, color reserved for abnormal states only.

Shapes serve three purposes:
1. **Designer palette** — drag-and-drop equipment placement in graphic/dashboard editing (doc 09)
2. **Recognition template mapping** — recognized DCS symbols map to these shapes (docs 19, 26)
3. **DCS import symbol mapping** — imported DCS graphics map vendor equipment to these shapes (doc 34)

No existing open-source shape library meets I/O's requirements (licensing, ISA-101 style, connection points, state system). The library is built from scratch.

### Shape Variation System

Shapes have two independent axes of variation: **Options** (design style) and **Variants** (physical/installation configuration).

#### Options (Design Style)

Each equipment type has a mandatory **Option 1** shape and an optional **Option 2** shape:

- **Option 1 (ISA)** — Standard ISA/ISO schematic symbol. Abstract, geometric, industry-standard. Always present for every shape. This is the default.
- **Option 2 (Graphical)** — More representational rendering of the same equipment. Still flat 2D, still ISA-101 compliant (gray baseline, no gradients, no 3D), but with visual elements that make the equipment more physically recognizable (e.g., a pump with a visible casing, pedestal, and discharge nozzle instead of just a circle with a triangle). Optional — not every shape needs one.

The user selects their preferred option globally (Settings → Graphics → "Shape Style") or per-instance in the Designer. Default is Option 1. Option 2 files use an `-opt2` suffix: `pump-centrifugal.svg` (Option 1) and `pump-centrifugal-opt2.svg` (Option 2).

#### Variants (Physical/Installation Configuration)

Some equipment types have multiple variants that reflect real-world physical or installation differences — not a different design philosophy, but a different configuration of the same equipment type. Variants use descriptive naming:

- **Instrument location variants** (ISA 5.1): `instrument-field.svg` (plain circle, field-mounted), `instrument-panel.svg` (horizontal line, panel-mounted), `instrument-behind-panel.svg` (dashed line, behind panel). Text zone in upper half filled by renderer with designation (P, PI, PIC, TT, FIC, etc.). One generic shape handles all instrument types — the letter(s) are data, not shape identity.
- **Vessel flanged head variants**: `vessel-vertical.svg` (welded, base), `vessel-vertical-flanged-top.svg`, `vessel-vertical-flanged-bottom.svg`, `vessel-vertical-flanged.svg` (both). Same for horizontal: `vessel-horizontal.svg` (welded), `-flanged-left`, `-flanged-right`, `-flanged` (both). A line across the arc indicates a bolted/removable flange connection.
- **Vessel/tank structural variants**: `tank-storage-cone-roof.svg`, `tank-storage-dome-roof.svg`, `tank-storage-open-top.svg`, `tank-storage-floating-roof.svg`, `tank-storage-sphere.svg`

Variants are context-dependent — they reflect what's actually installed, not a style preference. The Designer shows a variant picker dropdown when multiple variants exist for a shape.

#### Composable Parts (Add-ons)

Some modifiers attach independently to many base shapes in a category rather than being baked into a specific shape. These are composable parts with defined attachment zones:

- **Actuators**: Diaphragm, motor, solenoid — attach to any valve body via the stem connection point
- **Fail-position indicators**: Fail-open arrow, fail-closed arrow, fail-last — attach to any valve+actuator assembly
- **Agitators**: Turbine, propeller, anchor, paddle, helical ribbon — attach to any reactor body via the shaft connection point (includes shaft line + motor circle)
- **Supports (reactor/column)**: Skirt base, 3 splayed legs, 4 straight legs — attach to any reactor or column body via the bottom connection point
- **Supports (tank)**: 2 splayed legs, 2 saddle cradles — attach to sphere or capsule tank bodies via the bottom connection point

Composable parts are separate SVG files that the renderer assembles at display time, positioned via connection points defined in the JSON sidecar.

#### Naming Convention Summary

| Variation Type | Suffix Pattern | Example | Selection |
|---|---|---|---|
| Option (design style) | `-opt2` | `pump-centrifugal-opt2.svg` | Global default or per-instance |
| Variant (configuration) | `-descriptive-name` | `instrument-panel.svg` | Per-instance (matches real equipment) |
| Option + Variant | `-descriptive-name-opt2` | `tank-storage-cone-roof-opt2.svg` | Both apply independently |
| Composable part | `part-category-type` | `part-actuator-diaphragm.svg` | Per-instance attachment |

#### Sidecar `variants` Field

Both options and variants share the **same JSON sidecar** (connection points, text zones, state definitions, recognition class). The sidecar's `variants` field lists all available SVG files with their type:

```json
{
  "variants": {
    "options": {
      "opt1": "instrument-field.svg",
      "opt2": null
    },
    "configurations": [
      { "name": "field", "file": "instrument-field.svg", "label": "Field Mounted" },
      { "name": "panel", "file": "instrument-panel.svg", "label": "Panel Mounted" },
      { "name": "behind-panel", "file": "instrument-behind-panel.svg", "label": "Behind Panel" }
    ]
  }
}
```

### Shapes vs Stencils

I/O has two tiers of reusable visual elements:

- **Shape** — Full equipment shape with rich metadata: connection points (where pipes snap), text zones (where tag/value text renders), value display anchors (where text readouts, alarm indicators auto-place), `io-stateful` state handling, alarm anchor position, orientations and mirror rules. Shapes participate in data binding, pipe snapping, state color changes, and alarm indication. Created either as built-in library shapes (shipped with I/O) or through the Designer's "Promote to Shape" workflow.

- **Stencil** — Reusable SVG graphic with no metadata. Purely visual — no connection points, no state handling, no data binding. Drag from palette, place, resize/rotate, done. Always rendered as a static element (Canvas bitmap in hybrid mode). Created via "Save as Stencil" in the Designer — select elements, name it, pick a category, done. No wizard needed.

| | Shape | Stencil |
|---|---|---|
| Connection points | Yes | No |
| `io-stateful` state handling | Yes | No |
| Value/alarm anchors | Yes | No |
| Data binding capable | Yes | No |
| Pipe snapping | Yes | No |
| Reusable from palette | Yes | Yes |
| Creation (custom) | Draw + Promote to Shape wizard | Select + "Save as Stencil" |
| Recognition mapping | Optional | No |
| Rendering classification | Dynamic (SVG overlay) | Static (Canvas bitmap) |
| Storage | `design_objects` type=`shape` | `design_objects` type=`stencil` |

Use cases for stencils: company logos, building/structure outlines, section divider boxes, decorative equipment illustrations, background annotations (north arrows, plot plan overlays), imported images/clipart — anything where you want to put a reusable graphic on the page without data binding.

A stencil can be promoted to a full shape at any time through the Promote to Shape wizard (see doc 09).

---

## Directory Structure

Shapes live in a dedicated directory within the I/O installation, organized by equipment category:

```
shapes/
├── _schema/
│   └── io-shape-v1.schema.json       # JSON Schema for shape metadata validation
│
├── valves/
│   ├── valve-gate.svg                 # Option 1 (ISA)
│   ├── valve-gate.json
│   ├── valve-globe.svg
│   ├── valve-globe.json
│   ├── valve-ball.svg
│   ├── valve-ball.json
│   ├── valve-butterfly.svg
│   ├── valve-butterfly.json
│   ├── valve-control.svg
│   ├── valve-control.json
│   └── valve-relief.svg
│   └── valve-relief.json
│
├── pumps/
│   ├── pump-centrifugal.svg           # Option 1 (ISA)
│   ├── pump-centrifugal-opt2.svg      # Option 2 (Graphical)
│   ├── pump-centrifugal.json          # Shared sidecar (covers both variants)
│   ├── pump-positive-displacement.svg
│   ├── pump-positive-displacement-opt2.svg
│   └── pump-positive-displacement.json
│
├── rotating/
│   ├── compressor.svg
│   ├── compressor.json
│   ├── fan-blower.svg           # Option 1 (ISA)
│   ├── fan-blower-opt2.svg      # Option 2 (Graphical)
│   ├── fan-blower.json          # Shared sidecar (covers both variants)
│   ├── motor.svg
│   └── motor.json
│
├── heat-transfer/
│   ├── heat-exchanger-shell-tube.svg
│   ├── heat-exchanger-shell-tube.json
│   ├── heat-exchanger-plate.svg
│   ├── heat-exchanger-plate.json
│   ├── heater-fired.svg
│   ├── heater-fired.json
│   ├── air-cooler.svg
│   └── air-cooler.json
│
├── vessels/
│   ├── vessel-vertical.svg               # Welded heads (base)
│   ├── vessel-vertical-flanged-top.svg   # Flanged top head only
│   ├── vessel-vertical-flanged-bottom.svg # Flanged bottom head only
│   ├── vessel-vertical-flanged.svg       # Both heads flanged
│   ├── vessel-vertical.json              # Shared sidecar (all 4 variants)
│   ├── vessel-horizontal.svg             # Welded heads (base)
│   ├── vessel-horizontal-flanged-left.svg  # Flanged left head only
│   ├── vessel-horizontal-flanged-right.svg # Flanged right head only
│   ├── vessel-horizontal-flanged.svg     # Both heads flanged
│   ├── vessel-horizontal.json            # Shared sidecar (all 4 variants)
│   ├── tank-storage-cone-roof.svg          # Rectangle body + triangle cone roof
│   ├── tank-storage-dome-roof.svg          # Rectangle body + elliptical dome roof
│   ├── tank-storage-open-top.svg           # Walls + bottom + flange lips, no roof
│   ├── tank-storage-floating-roof.svg      # Open top + internal floating roof line
│   ├── tank-storage-sphere.svg             # Circle, no supports
│   ├── tank-storage-capsule.svg            # Horizontal pill shape, no supports
│   ├── tank-storage.json                   # Shared sidecar (all 6 variants)
│   ├── reactor.svg                       # Rounded top, flat bottom (base)
│   ├── reactor-flat-top.svg              # Flat top, rounded bottom
│   ├── reactor-closed.svg                # Both ends rounded
│   ├── reactor-trayed.svg                # Flat bottom + 10 internal trays
│   └── reactor.json                      # Shared sidecar (all 3 body variants + trayed)
│
├── separation/
│   ├── column-distillation.svg              # Standard width, plain (base)
│   ├── column-distillation-trayed.svg       # Standard + 6 trays (IMPORT DEFAULT)
│   ├── column-distillation-trayed-10.svg    # Standard + 10 trays
│   ├── column-distillation-packed.svg       # Standard + 2 packed bed sections
│   ├── column-distillation-narrow.svg       # Narrow width, plain
│   ├── column-distillation-narrow-trayed.svg
│   ├── column-distillation-narrow-trayed-10.svg
│   ├── column-distillation-narrow-packed.svg
│   ├── column-distillation-wide.svg         # Wide width, plain
│   ├── column-distillation-wide-trayed.svg
│   ├── column-distillation-wide-trayed-10.svg
│   ├── column-distillation-wide-packed.svg
│   ├── column-distillation.json             # Shared sidecar (all 12 variants)
│   ├── filter.svg                          # Standard filter (rectangle + dashed U)
│   ├── filter-vacuum.svg                   # Vacuum filter (90° V + parallel inner V + drum arc)
│   ├── filter.json                         # Shared sidecar (both variants)
│   ├── mixer.svg                            # Default: agitator without motor (shaft + blades)
│   ├── mixer-motor.svg                      # Agitator with motor circle
│   ├── mixer-inline.svg                     # Inline static mixer (rectangle + zigzag)
│   └── mixer.json                           # Shared sidecar (all 3 variants)
│
├── instrumentation/
│   ├── instrument-field.svg          # Plain circle (field mounted)
│   ├── instrument-panel.svg          # Circle + solid line (panel/console)
│   ├── instrument-behind-panel.svg   # Circle + dashed line (inaccessible)
│   └── instrument.json               # Shared sidecar with text zone definition
│
├── control/
│   ├── alarm-annunciator.svg             # Option 1 (ISA): circle with text zone
│   ├── alarm-annunciator-opt2.svg        # Option 2 (Graphical): horn with sound waves
│   ├── alarm-annunciator.json
│   ├── interlock.svg                       # Option 1 (ISA): wide diamond with text zone
│   ├── interlock-sis.svg                   # Variant: diamond-in-square (SIS)
│   ├── interlock-opt2.svg                  # Option 2 (Graphical): padlock
│   └── interlock.json                      # Shared sidecar (all 3)
│
├── actuators/
│   ├── actuator-pneumatic.svg
│   ├── actuator-pneumatic.json
│   ├── actuator-electric.svg
│   ├── actuator-electric.json
│   ├── actuator-hydraulic.svg
│   ├── actuator-hydraulic.json
│   └── actuator-handwheel.svg
│   └── actuator-handwheel.json
│
├── agitators/
│   ├── agitator-turbine.svg              # Rushton turbine (shaft + flat vertical blades)
│   ├── agitator-propeller.svg            # Marine-type propeller (angled blades)
│   ├── agitator-anchor.svg               # U-shaped frame (high viscosity)
│   ├── agitator-paddle.svg               # Simple flat horizontal blade
│   ├── agitator-helical.svg              # Helical ribbon (zigzag)
│   └── agitator.json                     # Shared sidecar (shaft + motor circle included)
│
├── supports/
│   ├── support-skirt.svg                 # Stepped wider base/foundation (reactors, columns)
│   ├── support-legs-3.svg               # 3 splayed legs with feet (reactors, columns)
│   ├── support-legs-4.svg               # 4 straight vertical legs with floor line (reactors, columns)
│   ├── support-legs-splayed.svg         # 2 angled legs (spheres, capsules)
│   ├── support-saddles.svg              # 2 trapezoidal saddle cradles (spheres, capsules)
│   └── support.json                      # Shared sidecar
│
├── indicators/
│   ├── fail-open.svg
│   ├── fail-close.svg
│   └── position-indicator.svg
│
└── piping/
    ├── pipe-straight.svg
    ├── pipe-elbow.svg
    ├── pipe-tee.svg
    ├── reducer.svg
    └── spectacle-blind.svg
```

**Key principle:** One SVG file per variant, one JSON sidecar per shape (shared across variants). No bundling, no sprite sheets, no embedded definitions. Any shape can be opened independently in Inkscape or Illustrator for editing.

### Database Storage

All shapes and stencils are stored in the `design_objects` table alongside graphics:

- `type = 'shape'` — full shape with sidecar metadata in `metadata` JSONB
- `type = 'stencil'` — visual-only, minimal metadata in `metadata` JSONB
- `svg_data` — the SVG content (same column used by graphics)
- `metadata` JSONB — for shapes, contains the full sidecar schema (connection points, text zones, value anchors, states, etc.); for stencils, contains only `name`, `category`, and `tags`

Built-in library shapes are **seed data** — loaded on first install, flagged with `metadata->>'source' = 'library'`. They are immutable (cannot be edited or deleted). Users can copy a library shape to create an editable custom version.

Custom shapes and stencils are flagged with `metadata->>'source' = 'user'` and are fully editable.

The shape library SVG files on disk (the directory structure described above) are the **distribution format** — what ships with the installer. On install, each SVG + JSON sidecar pair is inserted into `design_objects` as seed data. After installation, the database is the source of truth.

### Custom Shape ID Namespacing

Built-in library shapes have clean IDs: `pump-centrifugal`, `valve-gate`, `reactor`.

Custom shapes (both shapes and stencils) use a `.custom.<db_id>` suffix:
- `wet-gas-scrubber.custom.142`
- `company-logo.custom.203`
- `special-valve.custom.47`

The user provides the descriptive prefix (e.g., `wet-gas-scrubber`) when creating the shape/stencil. The system appends `.custom.<db_id>` automatically using the `design_objects.id` (or a sequential integer from a `custom_shape_seq` sequence). This guarantees uniqueness within the `.custom` namespace without collision logic.

On `.iographic` import, if a custom shape ID collides with an existing local custom shape, the importer assigns a new database ID (the descriptive prefix is preserved, only the numeric suffix changes).

### Import Shape Deduplication

When importing graphics (DCS import, `.iographic`, or recognition pipeline), the import pipeline deduplicates visually identical element groups into a single shape or stencil:

1. **Extract** all unrecognized element groups from the import
2. **Normalize** each to a canonical 48×48 bounding box (matching the shape library's viewBox convention), preserving aspect ratio. Scale factor = `min(48/width, 48/height)`. Round all coordinates to 1 decimal place (absorbs floating-point noise from DCS export tools).
3. **Mirror check** — also generate a horizontally-flipped normalized version. If it matches an existing fingerprint, the shape is a mirrored instance.
4. **Fingerprint** — SHA-256 hash of the normalized SVG. This is the shape's structural fingerprint.
5. **Group** by fingerprint — all elements with the same hash are instances of one shape.
6. **Promote or stencilize** — if the pipeline can infer connection points (pipe endpoints touching the element boundary), value anchors (nearby text readouts with tag associations), and state elements → create a Shape. Otherwise → create a Stencil.
7. **Pick representative size** — use the instance closest in size to existing library shapes (if a match exists), or the median size if no library match.
8. **Create one definition** in the shape library at the representative size.
9. **Create N placements** in the graphic, each with position + scale factor + rotation + mirror flag + individual point bindings.

The normalization catches resized copies — the same pump at 80% and 120% produces identical normalized geometry and thus the same fingerprint. Each placement stores its own scale factor to reproduce the original sizing.

The 1-decimal rounding tolerance catches sub-pixel coordinate differences from different DCS export tools. This is well within "same shape" territory — differences smaller than a single pixel at any reasonable zoom.

### Database Registration (Legacy Reference)

Both option variants share the same JSON sidecar (connection points, text zones, state definitions). The `variant` field in metadata distinguishes them. The Designer palette groups variants under a single equipment entry — the user picks their preferred variant via a toggle or right-click menu.

### Variant Selection

| Context | Behavior |
|---------|----------|
| **Global default** | Settings → Graphics → "Shape Style" dropdown: `ISA Standard` (opt1) or `Graphical` (opt2). Default on install: `ISA Standard`. Stored in `settings` table (key: `shape_variant_default`). |
| **Per-instance override** | In Designer, right-click any placed shape → "Switch Variant" to override the global default for that specific instance. Stored in the shape instance's metadata. |
| **Import / recognition** | DCS Graphics Import (doc 34), Symbol Recognition (doc 26), and any other automated shape placement **follows the global setting**. If the admin has set the global to Graphical, imports use Option 2 where available. |
| **Fallback** | Whenever the selected variant (global or per-instance) is Option 2 but a shape has no Option 2 file, Option 1 is used silently (no error, no warning). This applies everywhere: Designer, import, recognition. |

The JSON sidecar's connection points, text zones, and state definitions are stored in the `bindings` JSONB column. The SVG file contents go into `svg_data`.

---

## Shape Taxonomy

25 Tier 1 equipment types aligned with SymBA's DCS recognition model class map. Every shape has an Option 1 (ISA standard symbol). Shapes where a more graphical representation adds recognizability have an optional Option 2 (graphical — still flat 2D, ISA-101 compliant, just easier to understand at a glance).

| # | Shape ID | Category | Display Name | Priority | Opt 1 (ISA) | Opt 2 (Graphical) |
|---|----------|----------|-------------|----------|-------------|-------------------|
| 0 | `valve-gate` | Valves | Gate Valve | HIGH | Bowtie (two triangles) | — |
| 1 | `valve-globe` | Valves | Globe Valve | HIGH | Bowtie + filled circle | — |
| 2 | `valve-ball` | Valves | Ball Valve | MEDIUM | Bowtie clipped by circle | — |
| 3 | `valve-butterfly` | Valves | Butterfly Valve | MEDIUM | Pipe walls + disc line | — |
| 4 | `valve-control` | Valves | Control Valve | HIGH | Bowtie + stem + dome | — |
| 5 | `valve-relief` | Valves | Relief/Safety Valve | MEDIUM | Angle body + spring | — |
| 6 | `pump-centrifugal` | Pumps | Centrifugal Pump | HIGH | Circle + diameter line + discharge arrow | Circle + pedestal + discharge nozzle |
| 7 | `pump-positive-displacement` | Pumps | PD Pump | MEDIUM | Circle + discharge arrow + interior square | Circle + pedestal + nozzle + interior box |
| 8 | `compressor` | Rotating | Compressor | HIGH | Circle + converging lines (wide left → narrow right) | Circle + pedestal (no nozzle) |
| 9 | `heat-exchanger-shell-tube` | Heat Transfer | Shell & Tube HX | HIGH | Circle with internal lines | TBD |
| 10 | `heat-exchanger-plate` | Heat Transfer | Plate HX | LOW | Parallel plates | TBD |
| 11 | `heater-fired` | Heat Transfer | Fired Heater/Furnace | HIGH | Rectangle with flame/zigzag | TBD |
| 12 | `air-cooler` | Heat Transfer | Air Cooler / Fin-Fan | HIGH | Open-bottom housing, 9-pass zigzag coil with flow arrow, teardrop fan blades + shaft | — |
| 13 | `vessel-vertical` | Vessels | Vertical Vessel | HIGH | Elliptical heads + straight walls (4 flange variants) | TBD |
| 14 | `vessel-horizontal` | Vessels | Horizontal Vessel | HIGH | Elliptical ends + straight walls (4 flange variants) | TBD |
| 15 | `tank-storage` | Vessels | Storage Tank | HIGH | 6 variants: cone-roof, dome-roof, open-top, floating-roof, sphere, capsule; splayed legs & saddles as composable parts | TBD |
| 16 | `reactor` | Vessels | Reactor | MEDIUM | 3 body variants (base/flat-top/closed) + trayed; agitators & supports as composable parts | — |
| 17 | `column-distillation` | Separation | Distillation Column | HIGH | 3 widths (narrow/standard/wide) × 4 internals (plain/trayed-6/trayed-10/packed); supports reuse reactor parts | — |
| 18 | `filter` | Separation | Filter | LOW | 2 variants: standard (rectangle + top overhang + dashed U polyline) and vacuum (90° V + parallel inner V + drum arc) | — |
| 19 | `mixer` | Separation | Mixer | LOW | 3 variants: agitator (default, shaft + teardrop blades), agitator-motor (+ motor circle), inline static (rectangle + zigzag + stubs) | — |
| 20 | `fan-blower` | Rotating | Fan/Blower | MEDIUM | Compressor body + 3 oval fan blades | Square housing + circle + 3 teardrop blades + hub dot |
| 21 | `motor` | Rotating | Electric Motor | HIGH | Circle with "M" | — |
| 22 | `instrument` | Instrumentation | Instrument Bubble | HIGH | Circle with text zone (3 location variants: field, panel, behind-panel) | — |
| 23 | `alarm-annunciator` | Control | Alarm/Annunciator | MEDIUM | Circle with text zone (same pattern as instrument bubble; designation letters e.g. AAH, AAL, AAHH) | Horn with sound waves |
| 24 | `interlock` | Control | Interlock | LOW | Wide diamond with text zone (I, IS, ESD, SIF, etc.); SIS variant = diamond-in-square | Padlock icon (DCS convention) |

**"—"** = Option 2 not needed (ISA symbol is already intuitive enough). **"TBD"** = Option 2 likely useful, design pending.

**Minimum viable set for demo:** 18 HIGH-priority shapes (Option 1 only).
**Full Tier 1:** All 25 shapes (Option 1) + Option 2 where applicable + instrument location variants.
**With actuator + graphical variants:** ~55-70 SVG files total.

---

## Locked Valve Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> These 6 valve shapes are pixel-locked. Every coordinate, dimension, stroke width, and SVG element below is the canonical specification. No deviations, "improvements", or reinterpretations are permitted until the shapes have been compared against real-world DCS examples by both SymBA and a human reviewer. If you are an AI agent reading this: reproduce these shapes exactly as written. Do not round coordinates. Do not substitute elements. Do not "clean up" or optimize the SVG.

### Shared Valve Conventions

| Property | Value |
|----------|-------|
| Stroke color (all elements) | `#808080` |
| Stroke width (lines, polygons) | `1.5` |
| Fill (outlines) | `none` |
| SVG class on shape group | `io-shape-body` |
| SVG class on stateful elements | `io-stateful` |
| `data-io-version` | `3.0` (except butterfly `3.2`) |
| Triangle proportions (bowtie shapes) | 24 wide × 24 tall (1:1 ratio) |

### #0 — Gate Valve (`valve-gate`)

**viewBox:** `0 0 48 24` — two back-to-back triangles forming a bowtie, tips touching at center.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"
     data-io-shape="valve-gate" data-io-version="3.0">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 24,12 0,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
    <polygon class="io-stateful" points="48,0 24,12 48,24"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Left triangle | vertices (0,0) → (24,12) → (0,24) |
| Right triangle | vertices (48,0) → (24,12) → (48,24) |
| Center point | (24, 12) — tips touch here |

### #1 — Globe Valve (`valve-globe`)

**viewBox:** `0 0 48 24` — identical bowtie to gate valve + small filled circle at center.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Left triangle | vertices (0,0) → (24,12) → (0,24) |
| Right triangle | vertices (48,0) → (24,12) → (48,24) |
| Center circle | center (24,12), radius 3.5, **filled** `#808080`, no stroke |

### #2 — Ball Valve (`valve-ball`)

**viewBox:** `0 0 48 24` — bowtie triangles drawn as open paths that terminate at the circle boundary. The circle visually clips/crops the triangle tips. Intersection points were calculated geometrically (parametric line–circle intersection, circle r=6 at center 24,12).

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Left triangle (path) | (18.6, 9.3) → (0, 0) → (0, 24) → (18.6, 14.7) — open path, no closing segment |
| Right triangle (path) | (29.4, 9.3) → (48, 0) → (48, 24) → (29.4, 14.7) — open path, no closing segment |
| Center circle | center (24, 12), radius 6, **empty** (stroke only) |
| Intersection math | Line from (0,0)→(24,12) intersects circle r=6 at (18.6, 9.3); line from (0,24)→(24,12) intersects at (18.6, 14.7); mirrored for right side |

### #3 — Butterfly Valve (`valve-butterfly`)

**viewBox:** `0 0 60 24` — two vertical pipe walls with a diagonal disc line between them. No triangles, no circle. The disc line has clear gaps from both walls.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Left pipe wall | (7, 0) → (7, 24), stroke-width 1.5 |
| Right pipe wall | (53, 0) → (53, 24), stroke-width 1.5 |
| Diagonal disc | (10, 4) → (50, 20), stroke-width **2** (thicker than walls) |
| Gap left | 3px between wall (x=7) and disc start (x=10) |
| Gap right | 3px between disc end (x=50) and wall (x=53) |
| Pipe walls are NOT `io-stateful` | Only the disc line changes with state |

### #4 — Control Valve (`valve-control`)

**viewBox:** `0 0 48 44` — standard 24×24 bowtie at the bottom half, vertical stem rising to a dome (semicircle) actuator at top. Stem touches dome bottom only — does not pass through.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Left triangle | vertices (0, 20) → (24, 32) → (0, 44) |
| Right triangle | vertices (48, 20) → (24, 32) → (48, 44) |
| Bowtie center | (24, 32) |
| Stem | (24, 32) → (24, 12) — 20px tall, ends at dome baseline |
| Dome (semicircle) | Arc from (14, 12) to (34, 12), radius 10, **sweep=1** (bulges upward), closed with `Z` |
| Dome center | (24, 12), radius 10, top of dome at y≈2 |

### #5 — Relief / Safety Valve (`valve-relief`)

**viewBox:** `0 0 48 62` — two triangles meeting at 90° (one pointing up for inlet, one pointing left for outlet), vertical stem rising from the junction, three parallel spring lines with progressive widths. All spring lines share slope −1/3.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Up triangle (inlet) | vertices (8, 56) → (20, 38) → (32, 56) |
| Left triangle (outlet) | vertices (20, 38) → (42, 28) → (42, 48) |
| Junction point | (20, 38) — both triangle tips meet here |
| Stem | (20, 38) → (20, 5) — 33px tall |
| Spring line 1 (top, shortest) | (14, 11) → (26, 7), width 12px, slope −1/3 |
| Spring line 2 (middle) | (8, 22) → (32, 14), width 24px, slope −1/3 |
| Spring line 3 (bottom, widest) | (2, 33) → (38, 21), width 36px, slope −1/3 |
| All spring lines | Parallel (identical slope −1/3), centered on stem x=20 |

---

## Locked Pump Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> Same rules as the locked valve geometry above. Every coordinate is canonical. No deviations until compared against real-world DCS examples by both SymBA and a human reviewer. AI agents: reproduce exactly as written.

### #6 — Centrifugal Pump, Option 2 (`pump-centrifugal-opt2`)

**viewBox:** `0 0 50 48` — Circle body with triangle pedestal below and rectangular discharge nozzle at top-right. Circle visually crops both the pedestal and nozzle — interior is empty.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 48"
     data-io-shape="pump-centrifugal" data-io-version="1.0"
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
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Circle (pump casing) | center (24, 21), radius 19.5, stroke only |
| Circle top | y = 1.5 |
| Circle bottom | y = 40.5 |
| Pedestal (trapezoid) | Emerges from circle at ±30° from bottom: left (14.3, 37.9), right (33.7, 37.9). Base corners (8, 43.5) and (40, 43.5). Base width = 32 units. |
| Pedestal base line | y = 43.5 |
| Discharge nozzle (3-sided rect) | Top edge at y = 1.5 (aligned with circle top). Right cap at x = 48. Bottom edge at y = 9. Bottom-left at (39.4, 9) — circle intersection at y=9: x = 24 + √(380.25 − 144) = 39.4. |
| Nozzle height | 7.5 units (y = 1.5 to y = 9) |
| Circle crops both | Pedestal and nozzle drawn as open paths; circle drawn last. Interior of circle is empty. |

### #6 — Centrifugal Pump, Option 1 (`pump-centrifugal-opt1`)

**viewBox:** `0 0 48 48` — Circle with horizontal diameter line and two diagonal lines forming a right-pointing discharge arrow on the right half. The diagonals run from the top and bottom of the vertical axis to the right end of the horizontal axis.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle (pump casing) | center (24, 24), radius 20, stroke only |
| Circle extents | left x=4, right x=44, top y=4, bottom y=44 |
| Horizontal line (diameter) | (4, 24) → (44, 24) — full horizontal diameter |
| Top diagonal | (24, 4) → (44, 24) — top of vertical axis to right of horizontal axis |
| Bottom diagonal | (24, 44) → (44, 24) — bottom of vertical axis to right of horizontal axis |
| Discharge arrow | Both diagonals converge at (44, 24) — the 3 o'clock position — indicating discharge direction |
| Left half | Empty (no internal lines), just the horizontal diameter passes through |

### #7 — Positive Displacement Pump, Option 2 (`pump-positive-displacement-opt2`)

**viewBox:** `0 0 50 48` — Identical to centrifugal pump Option 2 body (circle, pedestal, nozzle) plus a small interior square centered in the circle as the PD identifier.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle, pedestal, nozzle | Identical to centrifugal pump Option 2 (see #6 above) |
| Interior square (PD identifier) | 10×10, top-left at (19, 16), centered on circle center (24, 21) |
| Gap to circle edge | ~9.5 units on each side — square is clearly inside, not touching |
| Square distinguishes PD from centrifugal | Only difference between the two pump Option 2 shapes |

### #7 — Positive Displacement Pump, Option 1 (`pump-positive-displacement-opt1`)

**viewBox:** `0 0 48 48` — Same circle and discharge diagonals as centrifugal pump Option 1, but with the horizontal diameter line removed and a 10×10 interior square added as the PD identifier.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle (pump casing) | center (24, 24), radius 20, stroke only — identical to centrifugal opt1 |
| Top diagonal | (24, 4) → (44, 24) — identical to centrifugal opt1 |
| Bottom diagonal | (24, 44) → (44, 24) — identical to centrifugal opt1 |
| No horizontal line | Removed vs centrifugal opt1 — the square replaces it as the distinguishing feature |
| Interior square (PD identifier) | 10×10, top-left at (19, 19), centered on circle center (24, 24) |
| Gap to circle edge | ~10 units on each side — square is clearly inside, not touching |
| Differences from centrifugal opt1 | No horizontal diameter line; has interior square |

---

## Locked Compressor Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> Same rules as the locked valve and pump geometry above. Every coordinate is canonical. No deviations until compared against real-world DCS examples by both SymBA and a human reviewer. AI agents: reproduce exactly as written.

### #8 — Compressor, Option 1 (`compressor-opt1`)

**viewBox:** `0 0 50 50` — Circle with two angled lines representing suction (wide, left) converging toward discharge (narrow, right). No vertical edges. Lines are symmetric about the horizontal center (y=25). Endpoints calculated at 130°/25° and 230°/335° on the circle.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle (compressor casing) | center (25, 25), radius 20, stroke only |
| Top line | (12.1, 9.7) → (43.1, 16.5) — slopes down-right, on circle at 130° and 25° |
| Bottom line | (12.1, 40.3) → (43.1, 33.5) — slopes up-right, on circle at 230° and 335° |
| Lines symmetric about | y = 25 (horizontal center) |
| Left spread (suction) | ~30.6 units (40.3 − 9.7) |
| Right spread (discharge) | ~17 units (33.5 − 16.5) |
| Convergence direction | Left-to-right: wider suction converges toward narrower discharge |

### #8 — Compressor, Option 2 (`compressor-opt2`)

**viewBox:** `0 0 50 48` — Centrifugal pump Option 2 body (circle + triangle pedestal) with the discharge nozzle removed. The circle and pedestal geometry are identical to centrifugal pump opt2.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 48"
     data-io-shape="compressor" data-io-version="1.0"
     data-io-variant="opt2">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 14.3,37.9 L 8,43.5 L 40,43.5 L 33.7,37.9"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <circle class="io-stateful" cx="24" cy="21" r="19.5"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Circle (compressor casing) | center (24, 21), radius 19.5, stroke only — identical to centrifugal opt2 |
| Pedestal (trapezoid) | Identical to centrifugal opt2: emerges ±30° from bottom, base at y=43.5, base width=32 |
| No discharge nozzle | Removed vs centrifugal opt2 — distinguishes compressor from pump |
| Differences from centrifugal opt2 | No discharge nozzle; otherwise identical body |

---

## Locked Fan/Blower Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> Same rules as all other locked geometry above. Every coordinate is canonical. No deviations until compared against real-world DCS examples by both SymBA and a human reviewer. AI agents: reproduce exactly as written.

### #19 — Fan/Blower, Option 1 (`fan-blower-opt1`)

**viewBox:** `0 0 50 50` — Compressor Option 1 body (circle + two converging lines) plus three oval fan blades inside, connected at the hub center (25,25). Blades are rotated 45° from the default orientation so the right blade points down (south), and the other two point NW and NE. Blades do not touch the converging lines or the circle.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle, top line, bottom line | Identical to compressor opt1 — cx=25, cy=25, r=20; lines at 130°/25° and 230°/335° |
| Blade base ellipse | cx=25, cy=20, rx=2.5, ry=5 — extends from y=15 to y=25 before rotation |
| Blade 1 (NW) | Base ellipse rotated 315° around hub (25, 25) |
| Blade 2 (NE) | Base ellipse rotated 75° around hub (25, 25) |
| Blade 3 (S / down) | Base ellipse rotated 195° around hub (25, 25) |
| Hub point | (25, 25) — all blades connect here at their near end |
| Clearance | Blades do not touch converging lines or circle edge |
| Distinguishes from compressor | Fan blades inside; compressor opt1 has no internal elements |

---

### #19b — Fan/Blower, Option 2 (`fan-blower-opt2`)

**viewBox:** `0 0 50 50` — Square housing with slightly rounded corners, inner circle, three teardrop fan blades at 30° offset (30°/150°/270°), and a filled hub dot at center. Blades use the same teardrop profile as the air cooler (#12) — sharp point at hub, round bulge at outer end — adapted radially. Blades fit inside circle, circle fits inside square.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"
     data-io-shape="fan-blower" data-io-version="1.0"
     data-io-variant="opt2">
  <g class="io-shape-body">
    <!-- Square housing -->
    <rect class="io-stateful" x="5" y="5" width="40" height="40" rx="3"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Inner circle -->
    <circle cx="25" cy="25" r="16"
            fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Blade 1 at 30° -->
    <path d="M 25,25 C 25.8,25 29.5,11 25,11 C 20.5,11 24.2,25 25,25 Z"
          fill="none" stroke="#808080" stroke-width="0.75"
          transform="rotate(30, 25, 25)"/>
    <!-- Blade 2 at 150° -->
    <path d="M 25,25 C 25.8,25 29.5,11 25,11 C 20.5,11 24.2,25 25,25 Z"
          fill="none" stroke="#808080" stroke-width="0.75"
          transform="rotate(150, 25, 25)"/>
    <!-- Blade 3 at 270° -->
    <path d="M 25,25 C 25.8,25 29.5,11 25,11 C 20.5,11 24.2,25 25,25 Z"
          fill="none" stroke="#808080" stroke-width="0.75"
          transform="rotate(270, 25, 25)"/>
    <!-- Hub dot -->
    <circle cx="25" cy="25" r="1.5" fill="#808080" stroke="none"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Square housing | x=5, y=5, width=40, height=40, rx=3 — 1.5 stroke |
| Inner circle | cx=25, cy=25, r=16 — 4px clearance to housing on all sides, 0.75 stroke |
| Blade path (pre-rotation) | `M 25,25 C 25.8,25 29.5,11 25,11 C 20.5,11 24.2,25 25,25 Z` — teardrop pointing up |
| Blade sharp end (hub) | (25, 25) — control points ±0.8 from center (1.6px wide at hub) |
| Blade round end (outer) | (25, 11) — control points at x=20.5 and x=29.5 (9px wide bulge), r=14 from center |
| Blade 1 | Base path rotated 30° around (25, 25) |
| Blade 2 | Base path rotated 150° around (25, 25) |
| Blade 3 | Base path rotated 270° around (25, 25) |
| Hub dot | cx=25, cy=25, r=1.5 — filled, no stroke |
| Blade clearance | Outer bulge at r=14, circle at r=16 — 2px gap between blade tips and circle |
| Blade profile | Same teardrop as air cooler (#12), scaled from 22-unit horizontal to 14-unit radial. Sharp-to-wide ratio ~1:5.6 |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #20 — Motor, Option 1 (`motor-opt1`)

**viewBox:** `0 0 40 40` — Circle with centered "M" letter. Standard ISA representation of an electric motor.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle | cx=20, cy=20, r=16 — centered in 40×40 viewBox with 4px margin |
| "M" text | x=20, y=21 (1px visual offset), text-anchor=middle, dominant-baseline=central |
| Font | Arial, 18px, weight 600 — fills circle interior without touching edges |
| viewBox | 40×40 — smaller than pump/compressor shapes, appropriate for motor scale |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #20 — Motor, Option 2 (`motor-opt2`)

**viewBox:** `0 0 50 30` — Horizontal capsule (rounded rectangle) representing a cylindrical motor housing, with vertical end bell lines at each end. Based on ISA 5.1 motor representation.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30"
     data-io-shape="motor" data-io-version="1.0"
     data-io-variant="opt2">
  <g class="io-shape-body">
    <path class="io-stateful"
          d="M 13,5 L 37,5 A 5,10 0 0,1 37,25 L 13,25 A 5,10 0 0,1 13,5 Z"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <line x1="13" y1="5" x2="13" y2="25"
          stroke="#808080" stroke-width="1.5"/>
    <line x1="37" y1="5" x2="37" y2="25"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Capsule path | Horizontal rounded rect from (13,5) to (37,25) — 24px wide, 20px tall |
| End arcs | rx=5, ry=10 — semicircular end caps matching the 20px height |
| Left end bell | Vertical line x=13, y=5 to y=25 — marks drive-end bearing housing |
| Right end bell | Vertical line x=37, y=5 to y=25 — marks non-drive-end bearing housing |
| viewBox | 50×30 — horizontal aspect ratio, wider than tall |
| Distinguishes from opt1 | Physical cylinder representation vs abstract circle-with-M |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #21 — Heat Exchanger (Shell & Tube), Option 1 (`hx-shell-tube-opt1`)

**viewBox:** `0 0 50 50` — Circle (shell) with internal zigzag polyline representing tube passes. Standard ISA representation.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle (shell) | cx=25, cy=25, r=20 — centered in 50×50 viewBox |
| Left horizontal | (5,25) → (12,25) — 7px, starts at left edge of circle |
| Up-right leg | (12,25) → (19,13) — ~56° from horizontal, rises to 20% from top |
| Down-right leg | (19,13) → (31,37) — 90° turn, descends to 20% from bottom |
| Up-right leg | (31,37) → (38,25) — 90° turn, rises back to center height |
| Right horizontal | (38,25) → (45,25) — 7px, ends at right edge of circle |
| Zigzag symmetry | Top peak y=13 (8px from circle top), bottom peak y=37 (8px from circle bottom) |
| Distinguishes from plate HX | Zigzag tube passes inside circle vs parallel plates |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #22 — Heat Exchanger (Plate), Option 1 (`hx-plate-opt1`)

**viewBox:** `-2 -2 58 20` — Horizontal rectangle (54×16, ~3.4:1 aspect) with 3 vertical divider lines creating 4 equal plate sections, and an X across the middle extending slightly past the outer dividers. All strokes uniform at 1px.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Rectangle | 54×16 at origin — ~3.4:1 horizontal aspect ratio |
| Divider 1 | x=13.5, full height — creates 4 equal 13.5×16 sections |
| Divider 2 | x=27, full height — center divider |
| Divider 3 | x=40.5, full height |
| X line 1 | (10,0) → (44,16) — extends 3.5px left of first divider, 3.5px right of last |
| X line 2 | (10,16) → (44,0) — same extents, opposite diagonal |
| Stroke | All elements uniform stroke-width="1" |
| viewBox padding | 2px on all sides to prevent border clipping |
| Distinguishes from shell & tube HX | Rectangular plates with X vs circular shell with zigzag |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #11 — Fired Heater/Furnace, Option 1 (`heater-fired-opt1`)

**viewBox:** `-2 -2 48 64` — Continuous outline: small top box (convection section) connected by diagonal lines to larger bottom box (firebox/radiant section), with sideways M burner symbol on right wall and two vertical tube lines below the M's bottom leg.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Outline path | Continuous: top box (15,2)→(29,2)→(29,18), diagonals to (37,28) and (7,28), bottom box to (7,58)→(37,58), back up |
| Top section (convection) | 14px wide (x=15→29), 16px tall (y=2→18) |
| Bottom section (firebox) | 30px wide (x=7→37), 30px tall (y=28→58) |
| Connecting diagonals | (29,18)→(37,28) right side, (15,18)→(7,28) left side — 10px gap between sections |
| Sideways M (burner) | On right wall, y=31→55 (24px tall), horizontal legs extend to x=20, middle peak at x=33 |
| M bottom leg | (37,55)→(20,55) horizontal |
| M middle | (20,55)→(33,44)→(20,31) — peak 4px from right wall |
| M top leg | (20,31)→(37,31) horizontal |
| Tube line 1 | x=25.5, y=58→55 — below M bottom leg |
| Tube line 2 | x=33.5, y=58→55 — below M bottom leg |
| viewBox padding | 2px on all sides to prevent border clipping |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #12 — Air Cooler / Fin-Fan (`air-cooler`)

**viewBox:** `-8 0 76 38` — Open-bottom housing (top line + two side walls, no bottom), 9-pass zigzag coil with inlet/outlet lines and flow arrow, two teardrop fan blades (sharp at hub, round at outer end), short drive shaft. All strokes uniform 0.75.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 0 76 38"
     data-io-shape="air-cooler" data-io-version="1.0"
     data-io-variant="opt1">
  <g class="io-shape-body">
    <!-- Housing: top + sides, open bottom -->
    <line x1="5" y1="5" x2="55" y2="5" stroke="#808080" stroke-width="0.75"/>
    <line x1="5" y1="5" x2="5" y2="27" stroke="#808080" stroke-width="0.75"/>
    <line x1="55" y1="5" x2="55" y2="27" stroke="#808080" stroke-width="0.75"/>
    <!-- Coil: 9 zigzag passes, 6px swing -->
    <polyline points="-4,11 5,11 9,14 14,8 19,14 24,8 29,14 34,8 39,14 44,8 49,14 52,11 55,11 63,11"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Flow arrow -->
    <polyline points="59,8 63,11 59,14"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Fan blades: teardrop, sharp at hub (30), round at outer end -->
    <path class="io-stateful"
          d="M30,22 C30,21 8,18 8,22 C8,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <path class="io-stateful"
          d="M30,22 C30,21 52,18 52,22 C52,26 30,23 30,22 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Drive shaft -->
    <line x1="30" y1="22" x2="30" y2="30" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Housing top | (5,5) → (55,5) — 50px wide |
| Housing left side | (5,5) → (5,27) — 22px tall |
| Housing right side | (55,5) → (55,27) — 22px tall |
| Housing bottom | Open — no bottom line |
| Coil inlet | (-4,11) → (5,11) — enters from left |
| Coil zigzag | 9 passes, peaks at y=8, valleys at y=14 (6px swing), x=9→49 |
| Coil outlet | (52,11) → (55,11) → (63,11) — exits right |
| Flow arrow | (59,8) → (63,11) → (59,14) — arrowhead pointing right |
| Left fan blade | Teardrop: sharp point at hub (30,22), round end at (8,22). Control points: top curve (30,21)→(8,18), bottom curve (8,26)→(30,23) |
| Right fan blade | Teardrop: sharp point at hub (30,22), round end at (52,22). Control points mirrored |
| Fan hub | (30, 22) — both blades meet here |
| Drive shaft | (30,22) → (30,30) — 8px |
| Stroke | All elements uniform 0.75 |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #21 — Instrument Bubble, Field Mounted (`instrument-field`)

**viewBox:** `0 0 40 40` — Plain circle with text zone in the upper half. No interior lines. Text zone is filled by the renderer with the instrument designation (P, PI, PIC, PICA, TT, FIC, etc.) using auto-fit sizing.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="instrument" data-io-version="1.0"
     data-io-variant="field">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Circle | cx=20, cy=20, r=16 — centered in 40×40 viewBox |
| Text zone | x=12, y=6, width=16, height=12 — upper half of circle, defined in JSON sidecar |
| Text rendering | Renderer auto-fits designation text using `textLength` + `lengthAdjust="spacingAndGlyphs"`. Base font-size=12, Arial 600 weight. |
| Location meaning | Field-mounted — accessible to operator in the field |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #21 — Instrument Bubble, Panel Mounted (`instrument-panel`)

**viewBox:** `0 0 40 40` — Circle with solid horizontal line across the middle. Text zone in upper half, above the line.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle | cx=20, cy=20, r=16 — identical to field variant |
| Horizontal line | (4,20) → (36,20) — solid, full diameter, at vertical center |
| Text zone | x=12, y=6, width=16, height=12 — same as field variant, above the line |
| Location meaning | Panel or console mounted — in the control room |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

### #21 — Instrument Bubble, Behind Panel (`instrument-behind-panel`)

**viewBox:** `0 0 40 40` — Circle with dashed horizontal line across the middle. Text zone in upper half, above the line.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Circle | cx=20, cy=20, r=16 — identical to field variant |
| Dashed horizontal line | (4,20) → (36,20) — dash pattern 4on/3off, at vertical center |
| Text zone | x=12, y=6, width=16, height=12 — same as field variant, above the line |
| Location meaning | Inaccessible or behind panel — not readily accessible to operator |

> **FROZEN** — Pixel-exact coordinates above are the specification. Do not modify until compared against real-world DCS examples by SymBA and human review.

---

## Locked Vessel Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> Same rules as all other locked geometry above. Every coordinate is canonical. No deviations until compared against real-world DCS examples by both SymBA and a human reviewer. AI agents: reproduce exactly as written.

### Shared Vessel Conventions

| Property | Value |
|----------|-------|
| Stroke color (all elements) | `#808080` |
| Stroke width | `1.5` |
| Fill | `none` |
| Head style | Flat elliptical arcs (rx=10, ry=5 for vertical; rx=5, ry=10 for horizontal) |
| Flanged head indicator | Straight line across arc endpoints, extending 2px beyond vessel walls on each side |
| SVG class on stateful elements | `io-stateful` (on arc paths only — flange lines are structural, not stateful) |

### #13 — Vertical Vessel, Welded Heads (`vessel-vertical`)

**viewBox:** `0 0 40 80` — Tall vessel with flat elliptical heads top and bottom, straight side walls. All heads welded (smooth arcs, no flange lines).

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Top head (arc) | Elliptical arc from (10,12) to (30,12), rx=10, ry=5, sweep=1 (bulges upward) |
| Left wall | (10,12) → (10,68) — 56px tall |
| Right wall | (30,12) → (30,68) — 56px tall |
| Bottom head (arc) | Elliptical arc from (10,68) to (30,68), rx=10, ry=5, sweep=0 (bulges downward) |
| Shell width | 20px (x=10 to x=30) |
| Overall height | ~71px (top of arc ~y=7 to bottom of arc ~y=73) |
| Aspect ratio | ~1:2 (tall, narrow) |

> **FROZEN**

### #13 — Vertical Vessel, Flanged Top (`vessel-vertical-flanged-top`)

**viewBox:** `0 0 40 80` — Same as welded base + horizontal line across top arc.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| All elements | Identical to welded base |
| Top flange line | (8,12) → (32,12) — extends 2px beyond walls on each side |
| Bottom head | Welded (no flange line) |

> **FROZEN**

### #13 — Vertical Vessel, Flanged Bottom (`vessel-vertical-flanged-bottom`)

**viewBox:** `0 0 40 80` — Same as welded base + horizontal line across bottom arc.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| All elements | Identical to welded base |
| Top head | Welded (no flange line) |
| Bottom flange line | (8,68) → (32,68) — extends 2px beyond walls on each side |

> **FROZEN**

### #13 — Vertical Vessel, Flanged Both (`vessel-vertical-flanged`)

**viewBox:** `0 0 40 80` — Same as welded base + horizontal lines across both arcs.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| All elements | Identical to welded base |
| Top flange line | (8,12) → (32,12) — extends 2px beyond walls on each side |
| Bottom flange line | (8,68) → (32,68) — extends 2px beyond walls on each side |

> **FROZEN**

---

### #14 — Horizontal Vessel, Welded Heads (`vessel-horizontal`)

**viewBox:** `0 0 80 40` — Wide vessel with flat elliptical heads left and right, straight top/bottom walls. All heads welded (smooth arcs, no flange lines).

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Left head (arc) | Elliptical arc from (12,10) to (12,30), rx=5, ry=10, sweep=0 (bulges leftward) |
| Top wall | (12,10) → (68,10) — 56px wide |
| Bottom wall | (12,30) → (68,30) — 56px wide |
| Right head (arc) | Elliptical arc from (68,10) to (68,30), rx=5, ry=10, sweep=1 (bulges rightward) |
| Shell height | 20px (y=10 to y=30) |
| Overall width | ~71px (left of arc ~x=7 to right of arc ~x=73) |
| Aspect ratio | ~2:1 (wide, short) |

> **FROZEN**

### #14 — Horizontal Vessel, Flanged Left (`vessel-horizontal-flanged-left`)

**viewBox:** `0 0 80 40` — Same as welded base + vertical line across left arc.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| All elements | Identical to welded base |
| Left flange line | (12,8) → (12,32) — extends 2px beyond walls on each side |
| Right head | Welded (no flange line) |

> **FROZEN**

### #14 — Horizontal Vessel, Flanged Right (`vessel-horizontal-flanged-right`)

**viewBox:** `0 0 80 40` — Same as welded base + vertical line across right arc.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| All elements | Identical to welded base |
| Left head | Welded (no flange line) |
| Right flange line | (68,8) → (68,32) — extends 2px beyond walls on each side |

> **FROZEN**

### #14 — Horizontal Vessel, Flanged Both (`vessel-horizontal-flanged`)

**viewBox:** `0 0 80 40` — Same as welded base + vertical lines across both arcs.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| All elements | Identical to welded base |
| Left flange line | (12,8) → (12,32) — extends 2px beyond walls on each side |
| Right flange line | (68,8) → (68,32) — extends 2px beyond walls on each side |

> **FROZEN**

---

## Locked Reactor Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> Same rules as all other locked geometry above. Every coordinate is canonical. No deviations until compared against real-world DCS examples by both SymBA and a human reviewer. AI agents: reproduce exactly as written.

### Shared Reactor Conventions

| Property | Value |
|----------|-------|
| Stroke color (all elements) | `#808080` |
| Stroke width (body, walls) | `1.5` |
| Stroke width (tray lines) | `0.75` |
| Fill | `none` |
| Elliptical head arcs | rx=10, ry=5 (same as vertical vessel) |
| Flat edges | Horizontal lines at y=12 (top) or y=68 (bottom) |
| Shell dimensions | x=10→30 (20px wide), y=12→68 (56px walls) |
| viewBox (base bodies) | `0 0 40 80` |

### #16 — Reactor, Base (`reactor`)

**viewBox:** `0 0 40 80` — Rounded top (elliptical head), flat bottom. Default reactor body.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Top head (arc) | Elliptical arc from (10,12) to (30,12), rx=10, ry=5, sweep=1 (bulges upward) |
| Left wall | (10,12) → (10,68) — 56px tall |
| Right wall | (30,12) → (30,68) — 56px tall |
| Flat bottom | (10,68) → (30,68) — horizontal line |
| Difference from vertical vessel | Flat bottom line replaces bottom elliptical arc |

> **FROZEN**

### #16 — Reactor, Flat Top (`reactor-flat-top`)

**viewBox:** `0 0 40 80` — Flat top, rounded bottom (elliptical head). Inverted version of base reactor.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Flat top | (10,12) → (30,12) — horizontal line |
| Left wall | (10,12) → (10,68) — 56px tall |
| Right wall | (30,12) → (30,68) — 56px tall |
| Bottom head (arc) | Elliptical arc from (10,68) to (30,68), rx=10, ry=5, sweep=0 (bulges downward) |
| Difference from base reactor | Flat top, rounded bottom instead of rounded top, flat bottom |

> **FROZEN**

### #16 — Reactor, Closed (`reactor-closed`)

**viewBox:** `0 0 40 80` — Both ends rounded (elliptical heads top and bottom). Identical geometry to vertical vessel welded — distinguished by composable parts (agitators/supports) at runtime.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Top head (arc) | Elliptical arc from (10,12) to (30,12), rx=10, ry=5, sweep=1 |
| Left wall | (10,12) → (10,68) — 56px tall |
| Right wall | (30,12) → (30,68) — 56px tall |
| Bottom head (arc) | Elliptical arc from (10,68) to (30,68), rx=10, ry=5, sweep=0 |
| Geometry | Identical to `vessel-vertical` welded variant |
| Distinction | Shape identity is `reactor`, not `vessel-vertical`. Composable parts (agitators, supports) define its reactor role. |

> **FROZEN**

### #16 — Reactor, Trayed (`reactor-trayed`)

**viewBox:** `0 0 40 80` — Base reactor body (rounded top, flat bottom) + 10 internal tray lines at thinner stroke weight.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
    <!-- 10 tray lines, y=17 to y=63, ~5px spacing -->
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
```

| Element | Geometry |
|---------|----------|
| Body | Identical to base reactor (rounded top, flat bottom) |
| Tray lines | 10 horizontal lines, wall-to-wall (x=10→30) |
| Tray positions | y = 17, 22, 27, 32, 37, 42, 47, 52, 57, 63 (~5px spacing) |
| Tray stroke | `0.75` — thinner than body (1.5) to read as internal structure |
| Use case | Fixed-bed catalytic reactor, packed column reactor |

> **FROZEN**

---

### Reactor Composable Parts — Agitators

> **STATUS: FROZEN**

Each agitator includes a vertical shaft line and a motor circle on top. They attach to any reactor body via the `shaft_mount` connection point (top center of vessel). The shaft enters through the top head (or flat top lid). All agitators share viewBox `0 0 40 80` when shown in context of a reactor body.

#### `agitator-turbine` (Rushton Turbine)

Shaft + two flat vertical blades. Standard for gas dispersion and general mixing.

```xml
<!-- Composable part — attaches to reactor body -->
<g class="io-part-agitator">
  <line x1="20" y1="7" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
  <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
  <line x1="13" y1="42" x2="20" y2="42" stroke="#808080" stroke-width="1.5"/>
  <line x1="13" y1="42" x2="13" y2="48" stroke="#808080" stroke-width="1.5"/>
  <line x1="20" y1="42" x2="27" y2="42" stroke="#808080" stroke-width="1.5"/>
  <line x1="27" y1="42" x2="27" y2="48" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Motor circle | cx=20, cy=5, r=3 — sits above vessel top |
| Shaft | (20,7) → (20,45) — enters through top head |
| Left blade arm | (13,42) → (20,42) horizontal, then (13,42) → (13,48) vertical |
| Right blade arm | (20,42) → (27,42) horizontal, then (27,42) → (27,48) vertical |
| Blade span | 14px (x=13→27), 7px clearance from walls |

#### `agitator-propeller` (Marine Propeller)

Shaft + four angled blades converging at hub. Low-viscosity axial flow mixing.

```xml
<g class="io-part-agitator">
  <line x1="20" y1="7" x2="20" y2="48" stroke="#808080" stroke-width="1.5"/>
  <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
  <line x1="13" y1="41" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
  <line x1="27" y1="41" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
  <line x1="13" y1="49" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
  <line x1="27" y1="49" x2="20" y2="45" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Motor circle | cx=20, cy=5, r=3 |
| Shaft | (20,7) → (20,48) |
| 4 blades | All converge at (20,45): upper-left (13,41), upper-right (27,41), lower-left (13,49), lower-right (27,49) |
| X-pattern | 14px span, 8px height |

#### `agitator-anchor` (Anchor)

Shaft + U-shaped frame close to walls and bottom. High-viscosity scraping.

```xml
<g class="io-part-agitator">
  <line x1="20" y1="7" x2="20" y2="30" stroke="#808080" stroke-width="1.5"/>
  <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
  <line x1="20" y1="30" x2="14" y2="30" stroke="#808080" stroke-width="1.5"/>
  <line x1="14" y1="30" x2="14" y2="64" stroke="#808080" stroke-width="1.5"/>
  <line x1="14" y1="64" x2="26" y2="64" stroke="#808080" stroke-width="1.5"/>
  <line x1="26" y1="64" x2="26" y2="30" stroke="#808080" stroke-width="1.5"/>
  <line x1="26" y1="30" x2="20" y2="30" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Motor circle | cx=20, cy=5, r=3 |
| Shaft | (20,7) → (20,30) — shorter, connects to anchor top |
| Anchor frame | U-shape: top crossbar at y=30 (x=14→26), verticals down to y=64, bottom crossbar at y=64 |
| Wall clearance | 4px from walls (x=14 vs x=10), 4px from bottom (y=64 vs y=68) |

#### `agitator-paddle` (Flat Paddle)

Shaft + single horizontal blade. Simplest agitator.

```xml
<g class="io-part-agitator">
  <line x1="20" y1="7" x2="20" y2="48" stroke="#808080" stroke-width="1.5"/>
  <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
  <line x1="13" y1="45" x2="27" y2="45" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Motor circle | cx=20, cy=5, r=3 |
| Shaft | (20,7) → (20,48) |
| Paddle blade | (13,45) → (27,45) — 14px horizontal line through shaft |

#### `agitator-helical` (Helical Ribbon)

Shaft + zigzag polyline suggesting wrapped helix. Very high viscosity (polymers, pastes).

```xml
<g class="io-part-agitator">
  <line x1="20" y1="7" x2="20" y2="65" stroke="#808080" stroke-width="1.5"/>
  <circle cx="20" cy="5" r="3" fill="none" stroke="#808080" stroke-width="1.5"/>
  <polyline points="14,25 26,32 14,39 26,46 14,53 26,60"
            fill="none" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Motor circle | cx=20, cy=5, r=3 |
| Shaft | (20,7) → (20,65) — full length for ribbon support |
| Helical ribbon | Zigzag: (14,25)→(26,32)→(14,39)→(26,46)→(14,53)→(26,60) |
| Ribbon span | 12px (x=14→26), 6px clearance from walls |
| Ribbon height | 35px (y=25→60), 5 segments |

---

### Reactor Composable Parts — Supports

> **STATUS: FROZEN**

Supports attach to any reactor body via the `bottom_mount` connection point. They extend the viewBox height from 80 to 86.

#### `support-skirt` (Skirted Base)

Stepped wider base/foundation below vessel bottom.

```xml
<g class="io-part-support">
  <line x1="10" y1="68" x2="10" y2="74" stroke="#808080" stroke-width="1.5"/>
  <line x1="30" y1="68" x2="30" y2="74" stroke="#808080" stroke-width="1.5"/>
  <line x1="5" y1="74" x2="35" y2="74" stroke="#808080" stroke-width="1.5"/>
  <line x1="5" y1="74" x2="5" y2="80" stroke="#808080" stroke-width="1.5"/>
  <line x1="35" y1="74" x2="35" y2="80" stroke="#808080" stroke-width="1.5"/>
  <line x1="3" y1="80" x2="37" y2="80" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Skirt walls | (10,68)→(10,74) and (30,68)→(74) — 6px drop from vessel bottom |
| First step | (5,74)→(35,74) — 30px wide, extends 5px beyond vessel walls each side |
| Step walls | (5,74)→(5,80) and (35,74)→(35,80) — 6px second drop |
| Foundation line | (3,80)→(37,80) — 34px wide, extends 2px beyond step each side |
| Total support height | 12px (y=68→80) |

#### `support-legs-3` (Three Splayed Legs)

Three legs splaying outward with individual feet. Outer legs angled, center leg vertical.

```xml
<g class="io-part-support">
  <line x1="12" y1="68" x2="7" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="20" y1="68" x2="20" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="28" y1="68" x2="33" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="4" y1="82" x2="10" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="17" y1="82" x2="23" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="30" y1="82" x2="36" y2="82" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Left leg | (12,68) → (7,82) — splays 5px outward over 14px drop |
| Center leg | (20,68) → (20,82) — vertical |
| Right leg | (28,68) → (33,82) — splays 5px outward |
| Left foot | (4,82) → (10,82) — 6px wide |
| Center foot | (17,82) → (23,82) — 6px wide |
| Right foot | (30,82) → (36,82) — 6px wide |
| Total support height | 14px (y=68→82) |

Note: For `reactor-flat-top` (rounded bottom), legs attach at y=66/73 instead of y=68 to follow the arc. For `reactor-closed`, same adjustment applies.

#### `support-legs-4` (Four Straight Legs)

Four vertical legs with continuous floor line.

```xml
<g class="io-part-support">
  <line x1="12" y1="68" x2="12" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="18" y1="68" x2="18" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="22" y1="68" x2="22" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="28" y1="68" x2="28" y2="82" stroke="#808080" stroke-width="1.5"/>
  <line x1="8" y1="82" x2="32" y2="82" stroke="#808080" stroke-width="1.5"/>
</g>
```

| Element | Geometry |
|---------|----------|
| Outer legs | x=12 and x=28, y=68→82 — 2px inset from walls |
| Inner legs | x=18 and x=22, y=68→82 — evenly spaced |
| Floor line | (8,82) → (32,82) — 24px, extends 4px beyond outer legs each side |
| Total support height | 14px (y=68→82) |

### Reactor Composition Matrix

3 bodies × 4 support options × 7 internal options = 84 possible compositions from 12 source SVG files:

| Body | × Support | × Internal | Notes |
|------|-----------|------------|-------|
| `reactor` (base) | none / skirt / 3-legs / 4-legs | none / turbine / propeller / anchor / paddle / helical / trayed | Standard CSTR, batch reactor |
| `reactor-flat-top` | none / skirt / 3-legs / 4-legs | none / turbine / propeller / anchor / paddle / helical / trayed | Top-entry agitator through flat lid |
| `reactor-closed` | none / skirt / 3-legs / 4-legs | none / turbine / propeller / anchor / paddle / helical / trayed | Pressure vessel reactor |

Not all combinations are physically meaningful. The Designer offers all parts; the user picks what matches their real equipment.

---

## Locked Distillation Column Geometry — DO NOT MODIFY

> **STATUS: FROZEN**
> Same rules as all other locked geometry above. Every coordinate is canonical. No deviations until compared against real-world DCS examples by both SymBA and a human reviewer. AI agents: reproduce exactly as written.

### Column Design System

Distillation columns use a parametric approach: **3 width profiles** × **4 internal types** = 12 body SVG files. All share the same 120px height with elliptical heads top and bottom (vertical vessel convention). Supports (skirt, legs) reuse the reactor composable parts, scaled to column width. Flanged variants follow the vessel flanging convention (line across arc, 2px overhang).

**Import default:** `column-distillation-trayed.svg` (standard width + 6 trays). The import process picks this unless the user overrides. Stored in `settings` table key `column_default_variant`.

### Width Profiles

| Profile | Shell Width | Wall X | viewBox | Arc rx | Arc ry |
|---------|------------|--------|---------|--------|--------|
| Narrow | 16px | x=12, x=28 | `0 0 40 120` | 8 | 5 |
| Standard | 24px | x=10, x=34 | `0 0 44 120` | 12 | 5 |
| Wide | 30px | x=10, x=40 | `0 0 50 120` | 15 | 5 |

All profiles: walls from y=10 to y=110 (100px tall). Top arc at y=10, bottom arc at y=110. Arc ry=5 for all widths.

### Internal Types

| Type | Stroke | Description |
|------|--------|-------------|
| Plain | — | No internal lines. Just the vessel shell. |
| Trayed (6) | 0.75 | 6 horizontal tray lines, evenly spaced y=24→100 |
| Trayed (10) | 0.75 | 10 horizontal tray lines, evenly spaced y=19→102 |
| Packed | 0.75 | 2 packed bed sections: horizontal support lines + X pattern between them |

### #17 — Column, Standard Plain (`column-distillation`)

**viewBox:** `0 0 44 120` — Standard width base column, no internals.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Top head | Arc (10,10)→(34,10), rx=12, ry=5, sweep=1 |
| Left wall | (10,10)→(10,110) — 100px |
| Right wall | (34,10)→(34,110) — 100px |
| Bottom head | Arc (10,110)→(34,110), rx=12, ry=5, sweep=0 |
| Shell width | 24px (x=10→34) |

> **FROZEN**

### #17 — Column, Standard Trayed-6 (`column-distillation-trayed`) — IMPORT DEFAULT

**viewBox:** `0 0 44 120` — Standard width + 6 tray lines. **This is the default variant selected by the import process.**

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Shell | Identical to standard plain |
| Tray lines (6) | y = 24, 40, 56, 72, 88, 100 — wall-to-wall (x=10→34) |
| Tray stroke | 0.75 — thinner than body (1.5) |
| Tray spacing | ~16px between trays |

> **FROZEN**

### #17 — Column, Standard Trayed-10 (`column-distillation-trayed-10`)

**viewBox:** `0 0 44 120` — Standard width + 10 tray lines.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Shell | Identical to standard plain |
| Tray lines (10) | y = 19, 28, 38, 48, 57, 66, 75, 84, 93, 102 — wall-to-wall |
| Tray spacing | ~9px between trays |

> **FROZEN**

### #17 — Column, Standard Packed (`column-distillation-packed`)

**viewBox:** `0 0 44 120` — Standard width + 2 packed bed sections (X pattern between support lines).

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
    <!-- Packed section 1 -->
    <line x1="10" y1="22" x2="34" y2="22" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="52" x2="34" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="22" x2="34" y2="52" stroke="#808080" stroke-width="0.75"/>
    <line x1="34" y1="22" x2="10" y2="52" stroke="#808080" stroke-width="0.75"/>
    <!-- Packed section 2 -->
    <line x1="10" y1="62" x2="34" y2="62" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="100" x2="34" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="10" y1="62" x2="34" y2="100" stroke="#808080" stroke-width="0.75"/>
    <line x1="34" y1="62" x2="10" y2="100" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Shell | Identical to standard plain |
| Section 1 support lines | y=22 and y=52 — wall-to-wall |
| Section 1 X | (10,22)→(34,52) and (34,22)→(10,52) |
| Section 2 support lines | y=62 and y=100 — wall-to-wall |
| Section 2 X | (10,62)→(34,100) and (34,62)→(10,100) |
| Gap between sections | 10px (y=52→62) — represents feed/redistribution zone |

> **FROZEN**

### #17 — Column, Narrow Plain (`column-distillation-narrow`)

**viewBox:** `0 0 40 120` — Narrow width base column.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Top head | Arc (12,10)→(28,10), rx=8, ry=5, sweep=1 |
| Walls | x=12 and x=28 — 16px shell width |
| Bottom head | Arc (12,110)→(28,110), rx=8, ry=5, sweep=0 |

> **FROZEN**

Narrow internal variants follow the same tray/packing patterns as standard, with x coordinates shifted to 12→28. Files: `column-distillation-narrow-trayed.svg` (6 trays), `column-distillation-narrow-trayed-10.svg` (10 trays), `column-distillation-narrow-packed.svg` (2 packed sections). Tray and packing y-coordinates are identical to standard.

### #17 — Column, Wide Plain (`column-distillation-wide`)

**viewBox:** `0 0 50 120` — Wide width base column.

```xml
<?xml version="1.0" encoding="UTF-8"?>
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
```

| Element | Geometry |
|---------|----------|
| Top head | Arc (10,10)→(40,10), rx=15, ry=5, sweep=1 |
| Walls | x=10 and x=40 — 30px shell width |
| Bottom head | Arc (10,110)→(40,110), rx=15, ry=5, sweep=0 |

> **FROZEN**

Wide internal variants follow the same tray/packing patterns as standard, with x coordinates shifted to 10→40. Files: `column-distillation-wide-trayed.svg` (6 trays), `column-distillation-wide-trayed-10.svg` (10 trays), `column-distillation-wide-packed.svg` (2 packed sections). Tray and packing y-coordinates are identical to standard.

### Column Variant Matrix

3 widths × 4 internals = 12 body SVG files. Supports and flanging are composable/additive:

| Width | × Internals | File Pattern |
|-------|------------|--------------|
| Narrow (16px) | plain / trayed / trayed-10 / packed | `column-distillation-narrow[-type].svg` |
| Standard (24px) | plain / trayed / trayed-10 / packed | `column-distillation[-type].svg` |
| Wide (30px) | plain / trayed / trayed-10 / packed | `column-distillation-wide[-type].svg` |

**Supports:** Reuse reactor composable parts (`support-skirt`, `support-legs-3`, `support-legs-4`), scaled to column width at composition time.

**Flanging:** Follows vessel convention — line across arc endpoints, 2px overhang. Can be applied to any column variant. Not pre-generated as separate files; the renderer applies flange lines at display time based on the equipment configuration.

**Import default:** `column-distillation-trayed` (standard + 6 trays). Configurable via `settings` table key `column_default_variant`.

### Locked Storage Tank Geometry (#15)

> **STATUS: FROZEN**

6 body variants. Supports (splayed legs, saddles) are composable parts that attach to sphere and capsule bodies via `bottom_mount`.

#### Cone Roof — `tank-storage-cone-roof.svg`

viewBox `0 0 70 70`. Rectangle body 50×40, cone roof triangle.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <!-- Tank body -->
  <rect class="io-stateful" x="10" y="20" width="50" height="40"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <!-- Cone roof -->
  <polyline class="io-stateful" points="10,20 35,6 60,20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

#### Dome Roof — `tank-storage-dome-roof.svg`

viewBox `0 0 70 70`. Rectangle body 50×40, elliptical arc dome.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <!-- Tank body -->
  <rect class="io-stateful" x="10" y="20" width="50" height="40"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <!-- Dome roof -->
  <path class="io-stateful" d="M10,20 A25,10 0 0,1 60,20"
        fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

#### Open Top — `tank-storage-open-top.svg`

viewBox `0 0 70 70`. Walls + bottom, no roof. Flange lips at top (6→14 and 56→64).

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <!-- Left wall -->
  <line class="io-stateful" x1="10" y1="15" x2="10" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right wall -->
  <line class="io-stateful" x1="60" y1="15" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Bottom -->
  <line class="io-stateful" x1="10" y1="60" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Left flange lip -->
  <line class="io-stateful" x1="6" y1="15" x2="14" y2="15"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right flange lip -->
  <line class="io-stateful" x1="56" y1="15" x2="64" y2="15"
        stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

#### Floating Roof — `tank-storage-floating-roof.svg`

viewBox `0 0 70 70`. Open top with flange lips. Internal floating roof line at y=18, 2px gap from walls (x=12→58). Pontoon legs at x=16 and x=54.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <!-- Left wall -->
  <line class="io-stateful" x1="10" y1="10" x2="10" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right wall -->
  <line class="io-stateful" x1="60" y1="10" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Bottom -->
  <line class="io-stateful" x1="10" y1="60" x2="60" y2="60"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Left flange lip -->
  <line class="io-stateful" x1="6" y1="10" x2="14" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right flange lip -->
  <line class="io-stateful" x1="56" y1="10" x2="64" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Floating roof (2px gap from walls) -->
  <line x1="12" y1="18" x2="58" y2="18"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Pontoon legs -->
  <line x1="16" y1="18" x2="16" y2="24"
        stroke="#808080" stroke-width="0.75"/>
  <line x1="54" y1="18" x2="54" y2="24"
        stroke="#808080" stroke-width="0.75"/>
</svg>
```

> **FROZEN**

#### Sphere — `tank-storage-sphere.svg`

viewBox `0 0 70 56`. Circle r=22 centered at (35,26). No supports (composable).

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 56"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <circle class="io-stateful" cx="35" cy="26" r="22"
          fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

#### Capsule — `tank-storage-capsule.svg`

viewBox `0 0 80 52`. Horizontal pill: straight walls x=20→60, y=14/38. Semicircular end caps r=12.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 52"
     data-io-shape="tank-storage" data-io-version="1.0" data-io-category="vessel">
  <!-- Top wall -->
  <line class="io-stateful" x1="20" y1="14" x2="60" y2="14"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Bottom wall -->
  <line class="io-stateful" x1="20" y1="38" x2="60" y2="38"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Left end cap -->
  <path class="io-stateful" d="M20,14 A12,12 0 0,0 20,38"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <!-- Right end cap -->
  <path class="io-stateful" d="M60,14 A12,12 0 0,1 60,38"
        fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

#### Tank Support Parts

Two composable support parts for sphere and capsule tanks. Attach via `bottom_mount` connection point.

**Splayed Legs** — `support-legs-splayed.svg`: Two angled legs diverging outward from body bottom.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 20"
     data-io-shape="support-legs-splayed" data-io-version="1.0" data-io-category="support">
  <!-- Left leg (angled outward) -->
  <line x1="19" y1="0" x2="14" y2="17"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right leg (angled outward) -->
  <line x1="51" y1="0" x2="56" y2="17"
        stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

**Saddles** — `support-saddles.svg`: Two trapezoidal saddle cradles. Each saddle: one angled leg + one vertical leg + horizontal base.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 14"
     data-io-shape="support-saddles" data-io-version="1.0" data-io-category="support">
  <!-- Left saddle -->
  <line x1="20" y1="0" x2="17" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="24" y1="0" x2="24" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="17" y1="10" x2="24" y2="10" stroke="#808080" stroke-width="0.75"/>
  <!-- Right saddle -->
  <line x1="56" y1="0" x2="53" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="60" y1="0" x2="60" y2="10" stroke="#808080" stroke-width="1.5"/>
  <line x1="53" y1="10" x2="60" y2="10" stroke="#808080" stroke-width="0.75"/>
</svg>
```

> **FROZEN**

### Tank Variant Matrix

6 body variants. Rectangular tanks (cone-roof, dome-roof, open-top, floating-roof) sit flat on grade — no supports needed. Sphere and capsule accept composable supports:

| Body | × Support | = Composition |
|------|-----------|---------------|
| Cone roof | — | `tank-storage-cone-roof` |
| Dome roof | — | `tank-storage-dome-roof` |
| Open top | — | `tank-storage-open-top` |
| Floating roof | — | `tank-storage-floating-roof` |
| Sphere | none / splayed legs / saddles | 3 compositions |
| Capsule | none / splayed legs / saddles | 3 compositions |

**Total:** 4 standalone + 2 bodies × 3 support options = **10 possible presentations** from 8 source SVG files (6 bodies + 2 support parts).

### Locked Filter Geometry (#18)

> **STATUS: FROZEN**

2 variants: standard filter and vacuum filter. Shared JSON sidecar.

#### Standard Filter — `filter.svg`

viewBox `0 0 50 60`. Rectangle 30×40, top line extends 4px past each side. Internal dashed U polyline (open top, connects to top line).

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 60"
     data-io-shape="filter" data-io-version="1.0" data-io-category="separation">
  <!-- Outer rectangle -->
  <rect class="io-stateful" x="10" y="10" width="30" height="40"
        fill="none" stroke="#808080" stroke-width="1.5"/>
  <!-- Top line left extension -->
  <line class="io-stateful" x1="6" y1="10" x2="10" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Top line right extension -->
  <line class="io-stateful" x1="40" y1="10" x2="44" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Internal dashed U polyline (filter element) -->
  <polyline points="18,10 18,38 32,38 32,10"
            fill="none" stroke="#808080" stroke-width="0.75" stroke-dasharray="3,2"/>
</svg>
```

> **FROZEN**

#### Vacuum Filter — `filter-vacuum.svg`

viewBox `0 0 66 55`. Outer 90° V (apex at 33,44, span 48px). Inner parallel V (8px inset, apex at 33,36). Horizontal connectors at y=20. Vertical lines 10px up from inner V tops. Flat arc (ry=4) across top.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 66 55"
     data-io-shape="filter" data-io-version="1.0" data-io-category="separation">
  <!-- Outer angle: 90° at apex -->
  <polyline class="io-stateful" points="9,20 33,44 57,20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  <!-- Inner angle: parallel lines, 8px inset -->
  <polyline class="io-stateful" points="17,20 33,36 49,20"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  <!-- Left horizontal connector -->
  <line class="io-stateful" x1="9" y1="20" x2="17" y2="20"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right horizontal connector -->
  <line class="io-stateful" x1="49" y1="20" x2="57" y2="20"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Left vertical (up from inner top) -->
  <line class="io-stateful" x1="17" y1="20" x2="17" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Right vertical (up from inner top) -->
  <line class="io-stateful" x1="49" y1="20" x2="49" y2="10"
        stroke="#808080" stroke-width="1.5"/>
  <!-- Drum arc (flat) -->
  <path class="io-stateful" d="M17,10 A16,4 0 0,1 49,10"
        fill="none" stroke="#808080" stroke-width="1.5"/>
</svg>
```

> **FROZEN**

### Locked Alarm Annunciator Geometry (#23)

> **STATUS: FROZEN**

2 options: ISA (circle + text zone, same pattern as instrument bubble) and graphical (horn with sound waves).

#### Option 1 (ISA) — `alarm-annunciator.svg`

viewBox `0 0 40 40`. Circle r=16 centered at (20,20). Text zone in upper half for designation letters (AAH, AAL, AAHH, etc.). Same geometry as `instrument-field.svg` — differentiated by `data-io-shape` attribute and sidecar metadata.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"
     data-io-shape="alarm-annunciator" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <circle class="io-stateful" cx="20" cy="20" r="16"
            fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Circle | cx=20, cy=20, r=16 — identical geometry to instrument bubble |
| Text zone | x=12, y=6, width=16, height=12 — upper half, defined in JSON sidecar |
| Text rendering | Same as instrument: auto-fit via `textLength` + `lengthAdjust="spacingAndGlyphs"`. Base font-size=12, Arial 600 weight. |
| Distinction from instrument | `data-io-shape="alarm-annunciator"` and sidecar `recognition_class` differentiate from instrument bubbles. Typical designations: AAH, AAL, AAHH, AALL, ASH, ASL. |

> **FROZEN**

#### Option 2 (Graphical) — `alarm-annunciator-opt2.svg`

viewBox `0 0 50 40`. Horn shape: small rectangle base (8×12), flared trapezoid expanding right, two curved sound wave arcs.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 40"
     data-io-shape="alarm-annunciator" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <!-- Horn base -->
    <rect class="io-stateful" x="12" y="14" width="8" height="12"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Horn flare -->
    <polyline class="io-stateful" points="20,14 36,6 36,34 20,26"
              fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Sound wave 1 (inner) -->
    <path d="M39,14 C43,17 43,23 39,26"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Sound wave 2 (outer) -->
    <path d="M42,10 C48,15 48,25 42,30"
          fill="none" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Horn base | rect at (12,14), 8×12 |
| Horn flare | Trapezoid: left edge at x=20 (12px tall), right edge at x=36 (28px tall) |
| Sound wave 1 | Arc from (39,14) to (39,26), peak at x≈43 |
| Sound wave 2 | Arc from (42,10) to (42,30), peak at x≈48 |
| Sound waves stroke | 0.75 (thinner than body to read as emanation, not structure) |

> **FROZEN**

### Locked Mixer Geometry (#19)

> **STATUS: FROZEN**

3 variants: agitator without motor (default), agitator with motor, inline static mixer. Agitator variants use the same teardrop blade geometry as the air cooler, flipped vertically (sharp point at hub/top, round end outward/down). All agitator strokes uniform 0.75.

#### Agitator (Default) — `mixer.svg`

viewBox `0 0 60 30`. Shaft from top + two teardrop fan blades. No motor circle.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30"
     data-io-shape="mixer" data-io-version="1.0" data-io-category="separation">
  <g class="io-shape-body">
    <!-- Drive shaft -->
    <line class="io-stateful" x1="30" y1="2" x2="30" y2="14"
          stroke="#808080" stroke-width="0.75"/>
    <!-- Left blade (teardrop: sharp at hub, round outside) -->
    <path class="io-stateful" d="M30,14 C30,15 8,18 8,14 C8,10 30,13 30,14 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Right blade -->
    <path class="io-stateful" d="M30,14 C30,15 52,18 52,14 C52,10 30,13 30,14 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Shaft | (30,2) → (30,14), 12px long |
| Left blade | Teardrop: hub at (30,14), outer end at x=8. Sharp point at hub (control points 1px apart), round at outside (control points 8px apart) |
| Right blade | Mirror of left, outer end at x=52 |
| All strokes | 0.75 uniform |

> **FROZEN**

#### Agitator with Motor — `mixer-motor.svg`

viewBox `0 0 60 34`. Motor circle at top + shaft + two teardrop fan blades.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 34"
     data-io-shape="mixer" data-io-version="1.0" data-io-category="separation">
  <g class="io-shape-body">
    <!-- Motor circle -->
    <circle cx="30" cy="5" r="3"
            fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Drive shaft -->
    <line class="io-stateful" x1="30" y1="8" x2="30" y2="18"
          stroke="#808080" stroke-width="0.75"/>
    <!-- Left blade -->
    <path class="io-stateful" d="M30,18 C30,19 8,22 8,18 C8,14 30,17 30,18 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Right blade -->
    <path class="io-stateful" d="M30,18 C30,19 52,22 52,18 C52,14 30,17 30,18 Z"
          fill="none" stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Motor circle | cx=30, cy=5, r=3 |
| Shaft | (30,8) → (30,18), 10px long (starts at bottom of motor circle) |
| Blades | Same teardrop geometry as default, hub shifted to y=18 |
| All strokes | 0.75 uniform |

> **FROZEN**

#### Inline Static Mixer — `mixer-inline.svg`

viewBox `0 0 70 30`. Horizontal rectangle with full-length zigzag touching top and bottom walls. Inlet/outlet stubs at midheight.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 30"
     data-io-shape="mixer" data-io-version="1.0" data-io-category="separation">
  <g class="io-shape-body">
    <!-- Rectangle body -->
    <rect class="io-stateful" x="10" y="5" width="50" height="20"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Zigzag mixing elements (touching top y=5 and bottom y=25) -->
    <polyline points="10,5 16,25 22,5 28,25 34,5 40,25 46,5 52,25 58,5 60,15"
              fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Inlet stub -->
    <line x1="2" y1="15" x2="10" y2="15"
          stroke="#808080" stroke-width="1.5"/>
    <!-- Outlet stub -->
    <line x1="60" y1="15" x2="68" y2="15"
          stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Body | rect at (10,5), 50×20 |
| Zigzag | 9 passes, peaks at y=5 (top wall), valleys at y=25 (bottom wall), 6px horizontal spacing. Last segment exits to midheight (60,15) |
| Inlet stub | (2,15) → (10,15), 8px |
| Outlet stub | (60,15) → (68,15), 8px |
| Body/stubs stroke | 1.5. Zigzag stroke | 0.75 |

> **FROZEN**

### Locked Interlock Geometry (#24)

> **STATUS: FROZEN**

Option 1 (ISA): wide diamond with text zone. SIS variant: diamond-in-square. Option 2 (graphical): padlock. Text zone is free-form — renderer fills with whatever designation the data provides (I, IS, ESD, SIF, P, IL, + numbers).

#### Option 1 (ISA) — BPCS Interlock — `interlock.svg`

viewBox `0 0 60 44`. Wide diamond (wider horizontally than tall). Text zone centered for designation text.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 44"
     data-io-shape="interlock" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <polygon class="io-stateful" points="30,4 56,22 30,40 4,22"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Diamond | Points: top (30,4), right (56,22), bottom (30,40), left (4,22). Width=52, height=36. |
| Text zone | Centered in diamond, defined in JSON sidecar. Auto-fit via `textLength` + `lengthAdjust="spacingAndGlyphs"`. Base font-size=12, Arial 600 weight. |
| Text rendering | Same mechanism as instrument bubble — renderer fills from data. Common designations: I, IS, IL, P, ESD, SIF + sequential numbers. |
| Meaning | Single diamond = BPCS interlock or hardwired interlock |

> **FROZEN**

#### SIS Variant — `interlock-sis.svg`

viewBox `0 0 60 44`. Diamond-in-square per ISA 5.1/5.3. Square outline surrounds the diamond to distinguish SIS from BPCS.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 44"
     data-io-shape="interlock" data-io-version="1.0" data-io-category="control"
     data-io-variant="sis">
  <g class="io-shape-body">
    <!-- Outer square -->
    <rect class="io-stateful" x="4" y="2" width="52" height="40"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Inner diamond -->
    <polygon class="io-stateful" points="30,6 52,22 30,38 8,22"
             fill="none" stroke="#808080" stroke-width="1.5"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Square | rect at (4,2), 52×40 — 2px inset from viewBox edges |
| Diamond | Points: top (30,6), right (52,22), bottom (30,38), left (8,22). 2px inset from square edges. |
| Text zone | Same as BPCS variant, centered in diamond |
| Meaning | Diamond-in-square = SIS/SIF interlock (safety logic solver) |

> **FROZEN**

#### Option 2 (Graphical) — Padlock — `interlock-opt2.svg`

viewBox `0 0 40 50`. Padlock icon — DCS operator display convention. Body is rounded rectangle, shackle is U-shaped arc, keyhole is circle + line.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 50"
     data-io-shape="interlock" data-io-version="1.0" data-io-category="control">
  <g class="io-shape-body">
    <!-- Lock body -->
    <rect class="io-stateful" x="8" y="22" width="24" height="20" rx="2"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Shackle -->
    <path class="io-stateful" d="M13,22 L13,14 A7,7 0 0,1 27,14 L27,22"
          fill="none" stroke="#808080" stroke-width="1.5"/>
    <!-- Keyhole circle -->
    <circle cx="20" cy="31" r="3"
            fill="none" stroke="#808080" stroke-width="0.75"/>
    <!-- Keyhole slot -->
    <line x1="20" y1="34" x2="20" y2="38"
          stroke="#808080" stroke-width="0.75"/>
  </g>
</svg>
```

| Element | Geometry |
|---------|----------|
| Lock body | rect at (8,22), 24×20, rx=2 (slight rounding) |
| Shackle | U-arc from (13,22) up to y=14, arc r=7 across to (27,14), down to (27,22) |
| Keyhole circle | cx=20, cy=31, r=3 |
| Keyhole slot | (20,34) → (20,38), 4px |
| State colors | Gray=healthy/normal, red/amber=tripped, purple/magenta=bypassed |

> **FROZEN**

---

## ISA-101 Design Standards

Every shape in the library follows these specifications:

### Grid and Dimensions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Grid unit | 10px | All coordinates snap to 10px grid. Connection points on grid. |
| Base stroke width | 1.5px | Visible at 100%, scales cleanly. Consistent across all shapes. |
| Equipment outline | `#808080` (Gray 50%) | Dark enough to see, not black (reserved for selected state) |
| Equipment fill (normal) | `transparent` or `#D4D0C8` | Matches background or transparent |
| Selected outline | `#000000`, 2px | Thicker + darker = selected |
| ViewBox | Always starts at `0 0` | Predictable positioning |
| Corner radii | 0px for equipment shapes | ISA-101: equipment is geometric, sharp edges |

### Base Shape Sizes

| Category | Typical Size | Aspect Ratio |
|----------|-------------|--------------|
| Valves | varies (see §Locked Geometry) | varies |
| Pumps | 60×60 | 1:1 |
| Vessels (vertical) | 40×80 | 1:2 |
| Vessels (horizontal) | 80×40 | 2:1 |
| Tanks | 60×80 | 3:4 |
| Columns | 40×120 | 1:3 |
| Heat exchangers | 60×60 | 1:1 |
| Instrument bubbles | 40×40 | 1:1 |
| Motors | 40×40 | 1:1 |
| Actuators (addon) | 20×15 | varies |

Sizes are defaults. All shapes scale proportionally when placed on the Designer canvas.

### Color Rules

**"Gray for normal, color for abnormal"** — the core ISA-101 principle:

- Normal operation: Equipment renders in gray. No green for "running" by default. Gray IS normal.
- Color appears ONLY when something requires operator attention
- Alarm colors follow ISA-18.2 severity mapping (defined in doc 27)
- No gradients. No 3D shading. No drop shadows. Flat 2D always.

### Animation Rules

- **No gratuitous animation.** No spinning pumps, moving conveyors, flowing liquid.
- Flash ONLY for unacknowledged alarms: 1 Hz (500ms on / 500ms off)
- Acknowledged alarms: solid color, no flash
- All animation via CSS — no JavaScript animation in shape files

---

## SVG File Format

Every SVG file follows this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 40 40"
     data-io-shape="valve-gate"
     data-io-version="1.0"
     data-io-category="valve">

  <!-- Connection points (invisible at runtime, visible in Designer) -->
  <g class="io-connections" display="none">
    <circle data-conn="inlet" cx="0" cy="20" r="2"/>
    <circle data-conn="outlet" cx="40" cy="20" r="2"/>
  </g>

  <!-- Shape body — elements that change with state -->
  <g class="io-shape-body">
    <polygon class="io-stateful" points="0,0 20,20 40,0"/>
    <polygon class="io-stateful" points="0,40 20,20 40,40"/>
  </g>

  <!-- Text zones (positioned by runtime, content from live data) -->
  <g class="io-text-zones">
    <text data-zone="tagname" x="20" y="-5" text-anchor="middle" class="io-tag-text"></text>
    <text data-zone="value" x="20" y="48" text-anchor="middle" class="io-value-text"></text>
  </g>
</svg>
```

### SVG Conventions

| Convention | Rule |
|-----------|------|
| `data-io-shape` | Shape ID matching JSON sidecar and filename |
| `data-io-version` | Shape version (matches JSON) |
| `data-io-category` | Equipment category for library organization |
| `.io-connections` group | Hidden at runtime, shown in Designer edit mode |
| `data-conn` attribute | Connection point ID matching JSON definition |
| `.io-stateful` class | Marks elements whose appearance changes with state |
| `.io-shape-body` group | The main equipment geometry |
| `.io-text-zones` group | Placeholder `<text>` elements populated at runtime |
| `data-zone` attribute | Text zone ID matching JSON definition |
| No embedded `<style>` | All styling via external CSS or inline attributes |
| No embedded scripts | Zero JavaScript in shape files |
| No `<image>` elements | Pure vector only |
| Coordinates on 10px grid | Exception: curves and arcs use intermediate values |

---

## JSON Sidecar Specification

Each shape has a companion `.json` file defining metadata, connection points, state bindings, text zones, and composable parts.

### Schema Version

```json
{
  "$schema": "io-shape-v1",
  "shape_id": "pump-centrifugal",
  "version": "1.0",
  "display_name": "Centrifugal Pump",
  "category": "pump",
  "subcategory": "centrifugal",
  "tags": ["pump", "centrifugal", "rotating"],
  "recognition_class": "pump_centrifugal",
  "variants": {
    "opt1": { "file": "pump-centrifugal.svg", "label": "ISA Standard" },
    "opt2": { "file": "pump-centrifugal-opt2.svg", "label": "Graphical" }
  },
  ...
}
```

For shapes with only Option 1, the `variants` field contains a single entry:

```json
{
  "variants": {
    "opt1": { "file": "valve-gate.svg", "label": "ISA Standard" }
  }
}
```

The `recognition_class` field links this shape to SymBA's DCS model class map. This is how the recognition pipeline (doc 26) knows which shape template to use for a detected equipment class. Both variants map to the same recognition class — the variant choice is purely a display preference.

### Geometry

```json
{
  "geometry": {
    "viewBox": [0, 0, 40, 40],
    "baseSize": [40, 40],
    "gridSnap": 10,
    "orientations": [0, 90, 180, 270],
    "mirrorable": true
  }
}
```

- `orientations`: Which rotation angles are valid for this shape
- `mirrorable`: Whether horizontal flip produces a meaningful variant
- Connection points are recalculated per orientation at runtime

### Connection Points

```json
{
  "connections": [
    {
      "id": "inlet",
      "position": [0, 20],
      "direction": "left",
      "type": "process",
      "rotatesWithShape": true
    },
    {
      "id": "outlet",
      "position": [40, 20],
      "direction": "right",
      "type": "process",
      "rotatesWithShape": true
    },
    {
      "id": "actuator_mount",
      "position": [20, 0],
      "direction": "up",
      "type": "actuator",
      "rotatesWithShape": true
    }
  ]
}
```

**Connection types:**
- `process` — pipe/line connections carrying process fluid
- `signal` — signal/instrument connections
- `actuator` — actuator attachment point
- `electrical` — power connections

**Direction:** Indicates which direction a connecting line should approach from (`left`, `right`, `up`, `down`). Used by the Designer's auto-routing algorithm.

### Text Zones

```json
{
  "textZones": [
    {
      "id": "tagname",
      "position": "above",
      "offset": [20, -5],
      "anchor": "middle",
      "fontSize": 10,
      "binding": "tagName",
      "visible": true
    },
    {
      "id": "value",
      "position": "below",
      "offset": [20, 48],
      "anchor": "middle",
      "fontSize": 11,
      "binding": "processValue",
      "format": "{value} {units}",
      "visible": true
    },
    {
      "id": "description",
      "position": "right",
      "offset": [45, 20],
      "anchor": "start",
      "fontSize": 9,
      "binding": "description",
      "visible": false
    }
  ]
}
```

**Display options per text zone:**
- `visible`: Whether the zone is shown by default (user can toggle per-instance)
- `binding`: What data drives the text — `tagName`, `processValue`, `description`, `units`, `status`
- `format`: Template string with `{value}`, `{units}`, `{tagName}` placeholders
- User can configure per-instance: show tag name only, value only, name + value, custom format

These text zones implement the "point display options" the user described — showing just the value, or the name and value, or custom formatting per attached point.

### Value Display Anchors

Shapes can define preferred positions for auto-placed value displays and alarm indicators. These are used during import (DCS native, recognition-generated) and as snap suggestions in the Designer.

```json
{
  "valueAnchors": [
    {
      "id": "primary_value",
      "position": [0.5, 1.1],
      "type": "text_readout",
      "label": "PV"
    },
    {
      "id": "level_bar",
      "position": [1.15, 0.5],
      "type": "analog_bar",
      "label": "Level"
    }
  ],
  "alarmAnchor": {
    "position": [1.0, 0.0]
  }
}
```

- `valueAnchors`: Suggested positions for auto-placed display elements (see doc 19 Point Value Display Elements)
- `alarmAnchor`: Suggested position for the Alarm Indicator element (ISA-101 priority-coded shape+color+text placed near equipment)
- All positions are relative to the shape's bounding box: `[0,0]` = top-left, `[1,1]` = bottom-right, values > 1 = outside the shape
- `type`: Suggested display element type (`text_readout`, `analog_bar`, `fill_gauge`, `sparkline`, `alarm_indicator`, `digital_status`)
- These are **defaults for initial placement only** — the user can freely drag any display element anywhere on the canvas after placement. The Designer does not constrain elements to anchor positions.
- Not all shapes need anchors (e.g., composable parts like actuators, supports, and legs do not have value anchors).

#### Default Anchor Positions Per Shape

The following table defines the default `valueAnchors` and `alarmAnchor` for each frozen Tier 1 shape. Positions are in normalized coordinates relative to the shape's bounding box (`[0,0]` = top-left, `[1,1]` = bottom-right). Values > 1.0 place the element outside the shape boundary with a clear gap.

**Valves** (viewBox ~48×24 to 48×62):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `valve-gate` | `[0.5, 1.3]` text_readout | `[1.1, -0.2]` | Value below center, alarm upper-right |
| `valve-globe` | `[0.5, 1.3]` text_readout | `[1.1, -0.2]` | Same pattern |
| `valve-ball` | `[0.5, 1.3]` text_readout | `[1.1, -0.2]` | Same pattern |
| `valve-butterfly` | `[0.5, 1.3]` text_readout | `[1.1, -0.2]` | Same pattern |
| `valve-control` | `[1.2, 0.5]` text_readout | `[1.1, -0.1]` | Value to right (actuator extends up), alarm upper-right of actuator |
| `valve-relief` | `[1.2, 0.5]` text_readout | `[1.1, -0.1]` | Value to right, alarm upper-right |

**Pumps** (viewBox ~48×48 to 50×48):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `pump-centrifugal-opt1` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Value below, alarm upper-right |
| `pump-centrifugal-opt2` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same |
| `pump-positive-displacement-opt1` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same |
| `pump-positive-displacement-opt2` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same |

**Compressors & Fans** (viewBox ~50×48 to 50×50):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `compressor-opt1` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same as pumps |
| `compressor-opt2` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same |
| `fan-blower-opt1` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same |
| `fan-blower-opt2` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Same |

**Motors** (viewBox 40×40 to 50×30):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `motor-opt1` | `[0.5, 1.2]` text_readout | `[1.15, -0.15]` | Value below circle |
| `motor-opt2` | `[0.5, 1.3]` text_readout | `[1.1, -0.2]` | Value below capsule |

**Heat Exchangers**:

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `hx-shell-tube-opt1` | `[0.5, 1.15]` text_readout | `[1.1, -0.1]` | Circle shape, same as pumps |
| `hx-plate-opt1` | `[0.5, 1.4]` text_readout | `[1.05, -0.3]` | Wide/short aspect — value further below, alarm above right end |

**Fired Heater** (viewBox 48×64):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `heater-fired-opt1` | `[1.2, 0.5]` text_readout | `[1.1, -0.05]` | Value to right (shape is tall), alarm upper-right |

**Air Cooler** (viewBox 76×38):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `air-cooler` | `[0.5, 1.3]` text_readout | `[1.05, -0.2]` | Wide shape, value below center |

**Instruments** (viewBox 40×40):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `instrument-field` | `[1.3, 0.5]` text_readout | `[1.15, -0.15]` | Value to right of bubble, alarm upper-right |
| `instrument-panel` | `[1.3, 0.5]` text_readout | `[1.15, -0.15]` | Same |
| `instrument-behind-panel` | `[1.3, 0.5]` text_readout | `[1.15, -0.15]` | Same |

**Vertical Vessels & Reactors** (viewBox 40×80):

| Shape | Primary Value | Secondary | Alarm Anchor | Notes |
|---|---|---|---|---|
| `vessel-vertical` (all variants) | `[0.5, 1.08]` text_readout | `[1.2, 0.5]` fill_gauge (standalone) | `[1.15, -0.05]` | Value below, optional level bar to right |
| `reactor` (all variants) | `[0.5, 1.08]` text_readout | `[1.2, 0.5]` fill_gauge (standalone) | `[1.15, -0.05]` | Same pattern as vessels |

**Horizontal Vessels** (viewBox 80×40):

| Shape | Primary Value | Secondary | Alarm Anchor | Notes |
|---|---|---|---|---|
| `vessel-horizontal` (all variants) | `[0.5, 1.2]` text_readout | `[1.1, 0.5]` fill_gauge (standalone) | `[1.05, -0.2]` | Value below, optional level bar to right |

**Columns** (viewBox ~44×120):

| Shape | Primary Value | Secondary | Alarm Anchor | Notes |
|---|---|---|---|---|
| `column-distillation` (all variants) | `[1.2, 0.5]` text_readout | `[1.15, 0.3]` analog_bar | `[1.1, -0.03]` | Value/bar to right (tall shape), alarm upper-right |

**Storage Tanks** (viewBox 70×70):

| Shape | Primary Value | Secondary | Alarm Anchor | Notes |
|---|---|---|---|---|
| `tank-storage-cone-roof` | `[0.5, 1.1]` text_readout | `[0.5, 0.5]` fill_gauge (vessel_overlay) | `[1.1, -0.05]` | Value below, fill inside tank |
| `tank-storage-dome-roof` | `[0.5, 1.1]` text_readout | `[0.5, 0.5]` fill_gauge (vessel_overlay) | `[1.1, -0.05]` | Same |
| `tank-storage-open-top` | `[0.5, 1.1]` text_readout | `[0.5, 0.5]` fill_gauge (vessel_overlay) | `[1.1, -0.05]` | Same |
| `tank-storage-floating-roof` | `[0.5, 1.1]` text_readout | `[0.5, 0.5]` fill_gauge (vessel_overlay) | `[1.1, -0.05]` | Same |
| `tank-storage-sphere` | `[0.5, 1.15]` text_readout | `[0.5, 0.5]` fill_gauge (vessel_overlay) | `[1.1, -0.1]` | Same pattern |
| `tank-storage-bullet` | `[0.5, 1.2]` text_readout | `[0.5, 0.5]` fill_gauge (vessel_overlay) | `[1.05, -0.2]` | Wide/short, alarm above right end |

**Filters** (viewBox 50×60 / 66×55):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `filter-standard` | `[0.5, 1.1]` text_readout | `[1.1, -0.1]` | Value below |
| `filter-vacuum` | `[0.5, 1.1]` text_readout | `[1.05, -0.1]` | Wide shape |

**Alarm Annunciators** (viewBox 40×40 / 50×40):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `alarm-annunciator-opt1` | `[1.3, 0.5]` text_readout | `[1.15, -0.15]` | Same as instrument bubble |
| `alarm-annunciator-opt2` | `[1.2, 0.5]` text_readout | `[1.1, -0.15]` | Horn shape, value to right |

**Mixers** (viewBox 60×30 to 70×30):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `mixer-agitator` | `[0.5, 1.2]` text_readout | `[1.1, -0.2]` | Value below blades |
| `mixer-agitator-motor` | `[0.5, 1.2]` text_readout | `[1.1, -0.15]` | Value below blades |
| `mixer-inline-static` | `[0.5, 1.3]` text_readout | `[1.05, -0.2]` | Wide shape |

**SIS Logic Solver** (viewBox 60×44):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `sis-logic-solver` | `[1.2, 0.5]` text_readout | `[1.1, -0.1]` | Value to right of diamond |
| `sis-logic-solver-bpcs` | `[1.2, 0.5]` text_readout | `[1.1, -0.1]` | Same |

**DCS Interlock** (viewBox 40×50):

| Shape | Primary Value | Alarm Anchor | Notes |
|---|---|---|---|
| `dcs-interlock` | `[1.2, 0.5]` text_readout | `[1.15, -0.1]` | Value to right of padlock |

#### Anchor Position Patterns

Most shapes follow one of three placement patterns:

1. **Compact shape (circle/square, ~1:1 aspect)**: Value below center `[0.5, 1.15]`, alarm upper-right `[1.1, -0.1]`. Used by pumps, compressors, motors, instruments, heat exchangers.
2. **Tall shape (vessels, columns, heaters)**: Value to right `[1.2, 0.5]` or below `[0.5, 1.08]`, optional level bar to right, alarm upper-right corner. Fill gauge overlay at `[0.5, 0.5]` for tanks.
3. **Wide/short shape (horizontal vessels, plate HX, air cooler)**: Value below center `[0.5, 1.3]`, alarm above right end.

**Composable parts** (actuators, supports, legs, agitator shafts) do NOT have value anchors or alarm anchors — they are sub-components that attach to parent equipment shapes.

### Multi-Point Support

For equipment with multiple measurement points (e.g., HART-enabled instruments with primary measurement plus diagnostics):

```json
{
  "multiPoint": {
    "primary": {
      "binding": "processValue",
      "displayZone": "value",
      "required": true
    },
    "secondary": [
      {
        "id": "diagnostic_temp",
        "label": "Sensor Temperature",
        "binding": "diagnosticValue",
        "displayZone": null,
        "tooltip": true,
        "required": false
      },
      {
        "id": "diagnostic_current",
        "label": "Loop Current",
        "binding": "diagnosticValue2",
        "displayZone": null,
        "tooltip": true,
        "required": false
      }
    ],
    "maxPoints": 5
  }
}
```

**How multi-point works at runtime:**
- Primary point drives the main value display and state/alarm behavior
- Secondary points are available in the tooltip popup and the property panel
- Each secondary point can optionally be assigned its own text zone if the user wants it visible on the graphic
- `maxPoints` limits how many points can be bound (prevents unbounded configuration)
- HART devices, fieldbus instruments, and multi-variable transmitters use this for their additional signals

### State Definitions

```json
{
  "states": {
    "normal": {
      "classes": ["io-normal"],
      "description": "Normal operation"
    },
    "running": {
      "classes": ["io-running"],
      "description": "Running / open"
    },
    "stopped": {
      "classes": ["io-stopped"],
      "description": "Stopped / closed"
    },
    "alarm_critical": {
      "classes": ["io-alarm-1"],
      "description": "Critical alarm active"
    },
    "alarm_high": {
      "classes": ["io-alarm-2"],
      "description": "High priority alarm"
    },
    "alarm_medium": {
      "classes": ["io-alarm-3"],
      "description": "Medium priority alarm"
    },
    "alarm_advisory": {
      "classes": ["io-alarm-4"],
      "description": "Advisory alarm"
    },
    "fault": {
      "classes": ["io-fault"],
      "description": "Equipment fault"
    },
    "manual": {
      "classes": ["io-manual"],
      "description": "Manual mode"
    },
    "out_of_service": {
      "classes": ["io-oos"],
      "description": "Out of service"
    },
    "stale": {
      "classes": ["io-stale"],
      "description": "Stale data / communication loss"
    },
    "unacknowledged": {
      "classes": ["io-unack"],
      "description": "Unacknowledged alarm (flashing)"
    }
  }
}
```

### Alarm Binding

```json
{
  "alarmBinding": {
    "stateSource": "point_alarm_state",
    "priorityMapping": {
      "1": "alarm_critical",
      "2": "alarm_high",
      "3": "alarm_medium",
      "4": "alarm_advisory"
    },
    "unacknowledgedFlash": true,
    "flashRate": "1Hz"
  }
}
```

**Important: Equipment shapes do NOT change color for alarm state.** Per ISA-101, alarm indication uses a separate **Alarm Indicator element** placed near the equipment (see doc 19 Point Value Display Elements). The alarm binding in the sidecar defines the priority mapping for the alarm indicator element, not for the equipment shape itself.

The `io-stateful` CSS classes on equipment shapes handle **operational state only** (running/stopped/open/closed/transitioning). The alarm priority classes (`.io-alarm-1` through `.io-alarm-4`) are applied to Alarm Indicator elements and value display elements (text readouts, bars, gauges), never to the equipment shape body.

The `alarmAnchor` position (see Value Display Anchors above) defines where the Alarm Indicator element is auto-placed relative to the equipment shape.

---

## State CSS Classes

The shape library ships with a global CSS file defining two independent state systems:

1. **Operational state** — applied to equipment shapes via `io-stateful` (running/stopped/open/closed)
2. **Alarm/quality state** — applied to display elements (text readouts, bars, gauges, alarm indicators) via `io-alarm-*` and `io-quality-*` classes

Equipment shapes do NOT change color for alarm state. Alarm indication uses separate Alarm Indicator elements (see doc 19 Point Value Display Elements).

```css
/* ═══ OPERATIONAL STATE (equipment shapes) ═══ */

/* Normal baseline — gray for normal */
.io-stateful {
  fill: transparent;
  stroke: #808080;
  stroke-width: 1.5;
  transition: fill 0.3s ease, stroke 0.3s ease;
}

.io-normal .io-stateful    { fill: transparent; stroke: #808080; }
.io-running .io-stateful   { fill: #059669; stroke: #047857; }
.io-stopped .io-stateful   { fill: transparent; stroke: #808080; }
.io-open .io-stateful      { fill: #059669; stroke: #047857; }
.io-closed .io-stateful    { fill: transparent; stroke: #808080; }
.io-transitioning .io-stateful { fill: #FFAA00; stroke: #D97706; }

/* Fault indicator on equipment */
.io-fault .io-stateful     { fill: #D946EF; stroke: #C026D3; }  /* Magenta */
.io-manual .io-stateful    { /* No fill change — "M" indicator overlay instead */ }
.io-oos .io-stateful       { fill: url(#io-hatch-pattern); }    /* Diagonal hatch */

/* ═══ ALARM STATE (display elements — text readouts, bars, gauges, alarm indicators) ═══ */

/* Alarm priority colors (border/background on display elements, NOT on equipment shapes) */
.io-alarm-1 { --io-alarm-color: #DC2626; --io-alarm-stroke: #B91C1C; }  /* Critical: Red */
.io-alarm-2 { --io-alarm-color: #F59E0B; --io-alarm-stroke: #D97706; }  /* High: Amber */
.io-alarm-3 { --io-alarm-color: #EAB308; --io-alarm-stroke: #CA8A04; }  /* Medium: Yellow */
.io-alarm-4 { --io-alarm-color: #06B6D4; --io-alarm-stroke: #0891B2; }  /* Advisory: Cyan */
.io-alarm-custom { --io-alarm-color: #7C3AED; --io-alarm-stroke: #6D28D9; } /* Custom: Purple */

/* Alarm state modifiers */
.io-unack {
  animation: io-alarm-flash 1s step-end infinite;
}
.io-ack {
  border-color: var(--io-alarm-color);
  background-color: color-mix(in srgb, var(--io-alarm-color) 20%, transparent);
}
.io-rtn-unack {
  border-color: color-mix(in srgb, var(--io-alarm-color) 50%, transparent);
}
.io-shelved {
  border-style: dashed;
  border-color: #808080;
}
.io-suppressed { opacity: 0.4; }
.io-oos-display { text-decoration: line-through; opacity: 0.5; }

/* Alarm flash: alternate alarm color ↔ gray (NOT on/off blink) */
@keyframes io-alarm-flash {
  0%, 49.99% { border-color: var(--io-alarm-color); background-color: color-mix(in srgb, var(--io-alarm-color) 20%, transparent); }
  50%, 100% { border-color: #808080; background-color: transparent; }
}

/* ═══ DATA QUALITY (display elements) ═══ */

.io-quality-stale    { stroke-dasharray: 4 2; opacity: 0.6; }
.io-quality-bad      { stroke: #DC2626; stroke-dasharray: 4 2; }
.io-quality-comm-fail { fill: #E5E7EB; }  /* + diagonal hatching overlay */
.io-quality-uncertain { stroke-dasharray: 2 2; }
.io-quality-manual   { /* Cyan "M" badge added by renderer */ }

/* ═══ TEXT ZONES ═══ */

.io-tag-text   { font-family: 'Inter', sans-serif; font-size: 10px; fill: #374151; }
.io-value-text { font-family: 'JetBrains Mono', monospace; font-size: 11px; fill: #111827; }

/* ═══ SELECTION (Designer only) ═══ */

.io-selected .io-stateful  { stroke: #000000; stroke-width: 2; }
```

Alarm colors are NOT customizable per-site. They follow ISA-18.2 / ISA-101 / IEC 60073 and must be consistent for operator safety. The gray baseline and alarm colors are hardcoded design decisions. Custom expression-builder alarms use purple by default; users can pick from a constrained palette that blocks colors within perceptual distance of the 4 ISA priority colors.

---

## Composable Parts System

Complex equipment is assembled from reusable sub-components rather than being drawn as monolithic shapes. This keeps the parts library small while supporting many equipment variants.

### How Composition Works

A control valve is not one shape — it is three composed parts:

```
valve-control = valve-gate (body) + actuator-pneumatic + fail-indicator
```

The JSON sidecar defines which parts compose the shape:

```json
{
  "composableParts": {
    "body": "valve-gate",
    "actuator": "actuator-pneumatic",
    "failIndicator": "fail-close"
  }
}
```

### Parts Catalog

**Actuators** (attach to any valve body via `actuator_mount` connection point):

| Part | File | Description |
|------|------|-------------|
| `actuator-pneumatic` | `actuators/actuator-pneumatic.svg` | Dome-shaped pneumatic actuator |
| `actuator-electric` | `actuators/actuator-electric.svg` | Square with "E" indicator |
| `actuator-hydraulic` | `actuators/actuator-hydraulic.svg` | Rectangle with "H" indicator |
| `actuator-handwheel` | `actuators/actuator-handwheel.svg` | Circular handwheel |

**Fail indicators** (small arrows showing fail-safe position):

| Part | File | Description |
|------|------|-------------|
| `fail-open` | `indicators/fail-open.svg` | Arrow pointing to open position |
| `fail-close` | `indicators/fail-close.svg` | Arrow pointing to closed position |

**Position indicator:**

| Part | File | Description |
|------|------|-------------|
| `position-indicator` | `indicators/position-indicator.svg` | Numeric position readout area |

**Agitators** (attach to any reactor body via `shaft_mount` connection point — includes shaft + motor circle):

| Part | File | Description |
|------|------|-------------|
| `agitator-turbine` | `agitators/agitator-turbine.svg` | Rushton turbine — shaft + flat vertical blades |
| `agitator-propeller` | `agitators/agitator-propeller.svg` | Marine propeller — 4 angled blades at hub |
| `agitator-anchor` | `agitators/agitator-anchor.svg` | U-shaped frame close to walls (high viscosity) |
| `agitator-paddle` | `agitators/agitator-paddle.svg` | Simple flat horizontal blade |
| `agitator-helical` | `agitators/agitator-helical.svg` | Helical ribbon zigzag (very high viscosity) |

**Supports** (attach to reactor/column bodies via `bottom_mount` connection point):

| Part | File | Description | Compatible Bodies |
|------|------|-------------|-------------------|
| `support-skirt` | `supports/support-skirt.svg` | Stepped wider base/foundation | Reactors, columns |
| `support-legs-3` | `supports/support-legs-3.svg` | 3 splayed legs with individual feet | Reactors, columns |
| `support-legs-4` | `supports/support-legs-4.svg` | 4 straight vertical legs with floor line | Reactors, columns |
| `support-legs-splayed` | `supports/support-legs-splayed.svg` | 2 angled legs | Spheres, capsules |
| `support-saddles` | `supports/support-saddles.svg` | 2 trapezoidal saddle cradles | Spheres, capsules |

### Composition at Build Time

The Rust shape generator (part of I/O's build toolchain) reads the `composableParts` definition and produces a composed SVG:

1. Load body SVG
2. Load actuator SVG
3. Position actuator at the body's `actuator_mount` connection point
4. Merge connection points from both parts
5. Adjust viewBox to encompass both parts
6. Output a single combined SVG file

The individual part SVGs remain as source files. The composed SVGs are generated artifacts.

### Variant Matrix

For valves, the composition produces:

| Body | × Actuator | × Fail | = Variant |
|------|-----------|--------|-----------|
| gate | none | — | `valve-gate` |
| gate | pneumatic | open | `valve-gate-pneumatic-fo` |
| gate | pneumatic | close | `valve-gate-pneumatic-fc` |
| gate | electric | — | `valve-gate-electric` |
| globe | none | — | `valve-globe` |
| globe | pneumatic | open | `valve-globe-pneumatic-fo` |
| ... | ... | ... | ... |

6 valve bodies × 5 actuator options × 3 fail options = up to 90 variants from 14 source parts. Not all combinations are valid — the JSON schema defines which combinations are allowed.

---

## Creation Workflow

### Tooling

| Stage | Tool | Purpose |
|-------|------|---------|
| Design | Figma (free tier) or Inkscape | Visual SVG creation on 10px grid |
| Metadata | Hand-authored JSON | Connection points, bindings, states, text zones |
| Validation | `io-shape-validate` (Rust CLI) | Grid compliance, stroke consistency, required elements, JSON schema |
| Variant generation | `io-shape-gen` (Rust CLI, `svg` crate) | Orientations, mirrors, actuator composition |
| Smoke test | SymBA ONNX model (optional) | Run shape through DCS recognition model — classification sanity check |
| Runtime | SVG.js (I/O frontend) | Load, manipulate, animate shapes based on live data |

### Per-Shape Creation Process

1. Research reference images for the equipment type (ISA standards, DCS vendor screenshots, SymBA variation thumbnails when available)
2. Design the base shape in Figma/Inkscape on the 10px grid, following the ISA-101 design standards in this document
3. Export clean SVG — ensure no embedded styles, no scripts, no raster images
4. Write the JSON sidecar — connection points, text zones, state definitions
5. Run `io-shape-validate` — fix any violations
6. If the shape has actuator variants, define `composableParts` in JSON and run `io-shape-gen`
7. Register in `design_objects` table (automatic on I/O startup)

### Time Estimates

| Complexity | Examples | Time per Shape |
|-----------|----------|---------------|
| Simple | Gate valve, indicator circle, motor | 15-30 min |
| Medium | Heat exchanger, vessel with heads | 30-60 min |
| Complex | Distillation column, compressor package | 1-2 hours |

**Total for 25 Tier 1 shapes:** ~20-40 hours including QC and iteration.
**With composable part variants (~50 files):** ~30-50 hours.

### Priority Order

1. **Valves** — most common, most variants, establish the pattern
2. **Vessels** — structurally simple, few variants
3. **Rotating equipment** — moderate complexity
4. **Heat transfer** — medium complexity
5. **Instruments/indicators** — very simple (circles with letters), many instances
6. **Piping elements** — simple geometric
7. **Control elements** — lower priority, add as needed

---

## Variant Generation

The `io-shape-gen` Rust CLI tool reads shape definitions and generates all valid variants:

### Orientation Variants

For shapes with `orientations: [0, 90, 180, 270]`:
- `valve-gate.svg` (0°, default)
- `valve-gate-90.svg`
- `valve-gate-180.svg`
- `valve-gate-270.svg`

Each variant has recalculated connection points and text zone positions.

### Mirror Variants

For shapes with `mirrorable: true`:
- `pump-centrifugal.svg` (default, discharge right)
- `pump-centrifugal-mirror.svg` (discharge left)

### Composition Variants

For shapes with `composableParts`:
- Generated by combining body + actuator + indicator SVGs
- Output to a `_composed/` subdirectory

---

## P&ID-to-DCS Cross-Domain Mapping

When the P&ID Recognition pipeline (doc 26) detects symbols, the user can optionally generate a DCS-style graphic instead of a P&ID-style graphic. This uses a simple lookup table:

| P&ID Class | DCS Shape | Notes |
|-----------|-----------|-------|
| `valve_gate` | `valve-gate` | Direct match |
| `valve_globe` | `valve-globe` | Direct match |
| `valve_check` | `valve-check` | Direct match |
| `valve_control` | `valve-control` | Direct match |
| `valve_relief` | `valve-relief` | Direct match |
| `pump_centrifugal` | `pump-centrifugal` | Direct match |
| `pump_positive_displacement` | `pump-positive-displacement` | Direct match |
| `compressor` | `compressor` | Direct match |
| `heat_exchanger` | `heat-exchanger-shell-tube` | Default to shell & tube |
| `vessel_vertical` | `vessel-vertical` | Direct match |
| `vessel_horizontal` | `vessel-horizontal` | Direct match |
| `tank` | `tank-storage` | Direct match |
| `column` | `column-distillation` | Direct match |
| `reactor` | `reactor` | Direct match |
| `instrument_indicator` | *Disambiguated by tag prefix* | See below |
| `reducer` | — | No DCS equivalent, dropped |
| `tee` | — | No DCS equivalent, dropped |
| `elbow` | — | No DCS equivalent, dropped |
| `flange` | — | No DCS equivalent, dropped |

**Instrument disambiguation:** P&ID uses generic instrument classes. When OCR reads the tag prefix, the system maps to specific DCS indicators:
- `F*` (FIC, FI, FT) → `indicator-flow`
- `T*` (TIC, TI, TT) → `indicator-temperature`
- `P*` (PIC, PI, PT) → `indicator-pressure`
- `L*` (LIC, LI, LT) → `indicator-level`
- Unresolvable → generic `controller` shape

This mapping is stored in the `settings` table (key: `pid_to_dcs_class_map`) and is admin-editable.

---

## Cross-References

- **Doc 09** (Designer Module): Symbol library panel, drag-and-drop placement, template creation
- **Doc 19** (Graphics System): SVG rendering, point bindings, class-to-template mapping, state CSS classes
- **Doc 26** (Symbol Recognition): Recognition model class map aligned with shape taxonomy, .iogap gap reports drive shape library expansion
- **Doc 27** (Alert System): Alarm states and ISA-18.2 severity levels drive state CSS classes
- **Doc 32** (Shared UI Components): Charting and display conventions
- **Doc 34** (DCS Graphics Import): Imported DCS equipment maps to shapes during import
- **SymBA Doc 12** (Data Pipeline): Shapes feed SymBA's synthetic data generation
- **SymBA Doc 13** (Model Management): DCS model class map matches shape taxonomy
- **SymBA Doc 17** (I/O Integration): .iomodel class_map.json alignment, .iogap gap reports

---

## Change Log

- **v0.32**: Added Shape/Stencil two-tier model — shapes have full metadata (connection points, states, anchors), stencils are purely visual reusable graphics. Database-first storage: all shapes and stencils stored in `design_objects` table, built-in library shapes as immutable seed data. Custom shape ID namespacing: `.custom.<db_id>` suffix. Import deduplication: normalize-to-48×48 + SHA-256 fingerprint + mirror detection for identifying identical shapes across scale/orientation. See doc 09 (Designer workflows), doc 19 (rendering classification), doc 39 (.iographic format).
- **v0.1**: Initial specification. 27 Tier 1 equipment types. Individual SVG + JSON sidecar per shape. ISA-101 design standards. Connection points, text zones, multi-point support. Composable parts system (actuators, fail indicators). 12 state CSS classes. P&ID-to-DCS cross-domain mapping. Creation workflow with Figma/Inkscape + Rust validation/generation tooling.
- **v0.2**: Added "Locked Valve Geometry" section with pixel-exact SVG specifications for all 6 valve shapes (gate, globe, ball, butterfly, control, relief). Shapes are FROZEN — no modifications until compared against real-world DCS examples by SymBA and human review. Updated base shape sizes table to reference locked geometry for valves.
- **v0.3**: Added Shape Variants system (Option 1 / Option 2). Option 1 = ISA standard symbol (mandatory for all 27 shapes). Option 2 = more graphical/representational rendering (optional, for shapes where it aids recognizability). Same JSON sidecar shared across variants. `variants` field added to sidecar schema. `-opt2` file naming convention. Designer supports per-instance and global variant preference. Updated taxonomy table with Opt 1/Opt 2 columns. Updated directory structure, database registration, and file count estimates.
- **v0.4**: Added Variant Selection rules. Global default configurable in Settings → Graphics → "Shape Style" (`shape_variant_default` in settings table). Default on install is Option 1 (ISA). All operations (Designer, import, recognition) follow the global setting. Per-instance override via Designer right-click. Silent fallback to Option 1 when Option 2 doesn't exist for a shape.
- **v0.5**: Added "Locked Pump Geometry" section. Centrifugal pump Option 2 (graphical) FROZEN — circle with triangle pedestal and rectangular discharge nozzle. PD pump Option 2 FROZEN — same body as centrifugal + 10×10 interior square. Pixel-exact SVG specs locked until real-world comparison.
- **v0.6**: Added `heater-fired` (Fired Heater/Furnace) as shape #11 in Heat Transfer category, HIGH priority. Tier 1 count now 28 (was 27). Identified via SimBLAH coverage analysis — charge heater H-2501 and steam methane reformer appear on 2 of 10 process graphics screens and in 5+ fault scenarios. Renumbered shapes 12-27 (previously 11-26).
- **v0.7**: Centrifugal pump Option 1 (ISA) FROZEN — circle (r=20) with horizontal diameter line + two diagonals forming right-pointing discharge arrow. Diagonals from top/bottom of vertical axis converge at 3 o'clock position. viewBox 48×48. Pixel-exact SVG spec locked.
- **v0.8**: PD pump Option 1 (ISA) FROZEN — same circle and diagonals as centrifugal opt1, horizontal line removed, 10×10 interior square at (19,19) centered on (24,24). All 4 pump shapes (2 types × 2 variants) now locked.
- **v0.9**: Compressor Option 1 (ISA) FROZEN — circle (r=20) with two converging lines: wide suction spread (~31) on left narrowing to discharge spread (~17) on right. Lines symmetric about y=25, endpoints on circle at 130°/25° and 230°/335°. viewBox 50×50.
- **v0.10**: Compressor Option 2 (graphical) FROZEN — centrifugal pump opt2 body (circle + pedestal) with discharge nozzle removed. viewBox 50×48. Both compressor variants now locked.
- **v0.11**: Fan/Blower Option 1 (ISA) FROZEN — compressor opt1 body (circle + converging lines) plus 3 oval fan blades (ellipse rx=2.5, ry=5) at 315°/75°/195° around hub (25,25). Blades don't touch lines or circle.
- **v0.12**: Motor Option 1 (ISA) FROZEN — circle (r=16) with centered "M" text (Arial 18px, weight 600). viewBox 40×40.
- **v0.13**: Motor Option 2 (graphical) FROZEN — horizontal capsule (24×20) with semicircular end caps (rx=5, ry=10) and vertical end bell lines at x=13 and x=37. viewBox 50×30. Both motor variants now locked.
- **v0.14**: Heat Exchanger (Shell & Tube) Option 1 (ISA) FROZEN — circle (r=20) with internal zigzag polyline (6 points). Horizontal entry/exit segments 7px each, three diagonal legs at ~56° with top peak y=13 and bottom peak y=37. viewBox 50×50.
- **v0.15**: Heat Exchanger (Plate) Option 1 (ISA) FROZEN — horizontal rectangle (54×16) with 3 vertical dividers at 13.5px intervals and X across middle (x=10 to x=44). All strokes uniform 1px. viewBox with 2px padding.
- **v0.16**: Fired Heater/Furnace Option 1 FROZEN — continuous outline: small top box (14×16) connected by diagonals to larger bottom box (30×30). Sideways M burner symbol (24px tall) on right wall with horizontal legs extending to x=20 and middle peak at x=33. Two vertical tube lines (x=25.5, x=33.5) below M bottom leg.
- **v0.17**: Expanded shape variation system. Three-tier hierarchy: Options (design style: opt1/opt2, global preference), Variants (physical/installation configuration: descriptive naming, per-instance), Composable Parts (cross-cutting add-ons: actuators, fail indicators). Naming conventions defined. JSON sidecar `variants` field restructured to list both options and configuration variants. Tank structural variants (cone-roof, dome-roof, open-top, floating-roof, sphere) documented as examples.
- **v0.18**: Consolidated 5 instrument shapes (#21-25: pressure, temperature, flow, level, controller indicators) into 1 generic `instrument` shape with 3 location variants (field, panel, behind-panel) and a text zone. Designation letters (P, PI, PIC, TT, FIC, etc.) are renderer-filled data, not shape identity. Text zone: x=12, y=6, 16×12, auto-fit via `textLength`+`lengthAdjust`. All 3 variants FROZEN. Tier 1 count now 24 (was 28). Directory structure and taxonomy table updated.
- **v0.19**: Added `air-cooler` (Air Cooler / Fin-Fan) as shape #12 in Heat Transfer category, HIGH priority. Identified via SimBLAH coverage analysis — A-2501 air cooler and fractionator overhead condenser appear on 2 process graphics screens. Tier 1 count now 25. Renumbered shapes 13-24.
- **v0.20**: Vertical vessel (#13) and horizontal vessel (#14) FROZEN — all 8 variants (4 each). Base design: flat elliptical heads (ry=5 vertical, rx=5 horizontal), 56px walls, ~2:1 aspect ratio. Four flange variants per vessel: welded (base, smooth arcs), flanged-top/left only, flanged-bottom/right only, flanged both. Flange = straight line across arc endpoints extending 2px beyond vessel walls. Directory structure updated with all 8 SVG files + shared JSON sidecars. Vessel flanged variants added to variation system documentation.
- **v0.21**: Reactor (#16) FROZEN — 4 body variants + 5 agitator composable parts + 3 support composable parts. Bodies: `reactor` (rounded top, flat bottom), `reactor-flat-top` (flat top, rounded bottom), `reactor-closed` (both rounded, same geometry as vertical vessel), `reactor-trayed` (base + 10 internal tray lines at 0.75 stroke). Agitators: turbine (Rushton), propeller, anchor, paddle, helical ribbon — all include shaft + motor circle, attach via `shaft_mount`. Supports: skirt, 3 splayed legs, 4 straight legs — attach via `bottom_mount`. 3×4×7 = 84 possible compositions from 12 source SVG files. New `agitators/` and `supports/` directories added. Parts Catalog updated. Composable parts description expanded.
- **v0.22**: Distillation column (#17) FROZEN — 12 body SVG files: 3 width profiles (narrow 16px, standard 24px, wide 30px) × 4 internal types (plain, trayed-6, trayed-10, packed). All share 120px height with elliptical heads. Trays at 0.75 stroke, packed beds use X pattern between support lines. Import default = `column-distillation-trayed` (standard + 6 trays), configurable via settings key `column_default_variant`. Supports reuse reactor composable parts (skirt, legs). Flanging follows vessel convention (renderer-applied, not pre-generated). Full SVG specs for all 6 standard variants + narrow/wide plain shells; narrow/wide internals use same y-coordinates with shifted x walls.
- **v0.23**: Air cooler (#12) FROZEN — open-bottom housing (top line + two side walls), 9-pass zigzag coil (6px swing, 0.75 stroke) with inlet/outlet lines and flow arrow, two teardrop fan blades (cubic bezier, sharp point at hub, round end outside), short drive shaft (8px). All strokes uniform 0.75. viewBox `-8 0 76 38`. Directory structure updated.
- **v0.24**: Storage tank (#15) FROZEN — 6 body variants: cone-roof (viewBox 70×70, rect 50×40 + triangle), dome-roof (rect + elliptical arc), open-top (walls + bottom + flange lips, no roof), floating-roof (open top + internal roof line at y=18, 2px gap from walls, pontoon legs), sphere (circle r=22, viewBox 70×56), capsule (horizontal pill, straight walls 40px + semicircular end caps r=12, viewBox 80×52). Rectangular tanks sit on grade (no supports). Sphere and capsule accept 2 new composable support parts: splayed legs (2 angled legs) and saddles (2 trapezoidal cradles), both FROZEN. Supports attach via `bottom_mount`. 10 possible presentations from 8 source SVG files. Directory structure, taxonomy, Parts Catalog, and composable parts description updated.
- **v0.25**: Filter (#18) FROZEN — 2 variants. Standard: rectangle 30×40 (viewBox 50×60) with top line extending 4px past each side, internal dashed U polyline (0.75 stroke, dasharray 3,2) representing filter element. Vacuum: 90° V apex at (33,44) with parallel inner V (8px inset, apex at 33,36), horizontal connectors, 10px vertical lines up from inner V tops, flat drum arc (ry=4) across top (viewBox 66×55). Directory structure and taxonomy updated.
- **v0.26**: Alarm annunciator (#23) FROZEN — 2 options. Option 1 (ISA): circle r=16 centered at (20,20) in 40×40 viewBox, same geometry as instrument bubble, text zone for alarm designations (AAH, AAL, AAHH, etc.), differentiated by `data-io-shape` attribute. Option 2 (graphical): horn shape (rect base 8×12 + flared trapezoid + two curved sound wave arcs at 0.75 stroke) in 50×40 viewBox. Directory structure and taxonomy updated.
- **v0.27**: Mixer (#19) FROZEN — 3 variants. Default agitator: shaft (12px) + two teardrop blades (same geometry as air cooler, flipped vertically), all strokes 0.75, viewBox 60×30. Agitator-motor: adds motor circle (r=3) at top of shaft, viewBox 60×34. Inline static: rectangle 50×20 with full-length zigzag (9 passes, touching top/bottom walls, 0.75 stroke) + inlet/outlet stubs (1.5 stroke), viewBox 70×30. Directory structure and taxonomy updated.
- **v0.31**: Fan/Blower Option 2 (graphical) FROZEN — square housing (40×40, rx=3) + inner circle (r=16) + 3 teardrop fan blades at 30°/150°/270° + filled hub dot (r=1.5). Blade profile reuses air cooler (#12) teardrop geometry adapted radially: sharp point at hub (±0.8), round bulge at outer end (±4.5, 9px wide). Blades inside circle (2px clearance), circle inside square (4px clearance). viewBox 50×50. Both fan-blower variants now locked. Directory structure and anchor table updated.
- **v0.30**: Populated default `valueAnchors` and `alarmAnchor` positions for all frozen Tier 1 shapes. Complete reference table with normalized coordinates per shape. Three placement patterns identified: compact (1:1 aspect, value below), tall (value/bar to right), wide (value below, alarm above right). Vessels/tanks get secondary fill_gauge anchor at `[0.5, 0.5]` for vessel overlay mode. Columns get secondary analog_bar anchor. Composable parts (actuators, supports, legs) explicitly excluded — no anchors. Clarified that anchors are initial placement defaults only — user can freely drag elements anywhere after placement.
- **v0.29**: Added Value Display Anchors to JSON Sidecar Specification (`valueAnchors` for auto-placed display elements, `alarmAnchor` for alarm indicator placement). Updated Alarm Binding section to clarify equipment shapes do NOT change color for alarm state (ISA-101) — alarm priority classes apply to Alarm Indicator elements and display elements only. Renamed `alarm_low` → `alarm_medium` in state definitions. Restructured State CSS Classes into two independent systems: operational state (equipment shapes via `io-stateful`) and alarm/quality state (display elements via `io-alarm-*`/`io-quality-*`). Added `.io-alarm-custom` (purple) for expression-builder alarms. Updated flash animation to alternate alarm color ↔ gray (not opacity on/off). Added data quality CSS classes. See doc 19 v1.2 (Point Value Display Elements).
- **v0.28**: Interlock (#24) FROZEN — 3 shapes. Option 1 (ISA): wide diamond (52×36) in 60×44 viewBox with free-form text zone (same auto-fit mechanism as instrument bubble). SIS variant: diamond-in-square per ISA 5.1/5.3 (square 52×40 surrounding inset diamond). Option 2 (graphical): padlock icon (lock body 24×20 rx=2 + U-arc shackle r=7 + keyhole circle r=3 + slot) in 40×50 viewBox — DCS operator display convention (gray=healthy, red=tripped, purple=bypassed). Text zone accepts any designation: I, IS, IL, P, ESD, SIF + numbers. Directory structure and taxonomy updated. **All 25 Tier 1 shapes now FROZEN.**
