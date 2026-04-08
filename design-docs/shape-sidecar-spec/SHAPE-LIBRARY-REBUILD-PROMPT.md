# Shape Library & Sidecar Display Element Rebuild

You are rebuilding the I/O shape library SVG files and sidecar display element React components from scratch. Two previous attempts produced incorrect geometry, wrong colors, invented behaviors, and incomplete state handling. This time you will delete all previous output and implement strictly from the spec files in this folder. You will not invent anything. You will not approximate anything. If a value is not in this prompt or the referenced spec files, you will leave a `// TODO: unspecified in spec — needs decision` comment and move on.

---

## Step 0: Read the Spec Files

Before writing any code, read these files in full. They are your source of truth.

| File | Location | Role |
|---|---|---|
| `shape-sidecar-spec.md` | This folder | Visual + behavioral spec for all display elements, anchor system, designer UX, state rules |
| `shape-variants-addons.md` | This folder | Drop dialog data — variants, add-ons, bindable parts per shape |
| `shape-composition-rules.md` | This folder | Exact SVG geometry for composable part attachment (actuators, agitators, supports) |
| `dark-shape-library-preview.html` | This folder | **Authoritative visual reference** — all 25 shapes + composable combinations, Dark theme |
| `light-shape-library-preview.html` | This folder | Same, Light theme |
| `hphmi-shape-library-preview.html` | This folder | Same, HP HMI theme |
| `dark-shape-sidecar-preview.html` | This folder | **Authoritative visual reference** — all 7 display element types in all states, Dark theme |
| `light-shape-sidecar-preview.html` | This folder | Same, Light theme |
| `hphmi-shape-sidecar-preview.html` | This folder | Same, HP HMI theme |

Cross-reference design docs (read for context but do NOT modify):
- `35_SHAPE_LIBRARY.md` — JSON sidecar format, shape IDs, SVG file naming conventions
- `19_GRAPHICS_SYSTEM.md` — Scene graph node types, display element TypeScript types, rendering engine
- `27_ALERT_SYSTEM.md` — Full ISA-18.2 alarm state machine
- `09_DESIGNER_MODULE.md` — Designer module UX

---

## Step 1: Delete Previous Implementation

Delete all of the following. Be thorough. Do not leave partial files from previous attempts.

### SVG shape files
Delete all `.svg` files in the shape library asset directory. These are equipment shape SVGs and composable part SVGs. Look for them in:
- `frontend/src/assets/shapes/` or similar
- `public/shapes/` or similar
- Any directory containing files matching patterns: `valve-*.svg`, `pump-*.svg`, `compressor-*.svg`, `fan-blower-*.svg`, `motor-*.svg`, `heat-exchanger-*.svg`, `heater-fired-*.svg`, `air-cooler-*.svg`, `vessel-*.svg`, `tank-storage-*.svg`, `reactor-*.svg`, `column-distillation-*.svg`, `filter-*.svg`, `mixer-*.svg`, `instrument-*.svg`, `alarm-annunciator-*.svg`, `interlock-*.svg`, `part-actuator-*.svg`, `part-fail-*.svg`, `agitator-*.svg`, `support-*.svg`

### Sidecar display element React components
Delete the React component files that render the 7 display element types. Look for:
- Components named `TextReadout`, `AnalogBar`, `AnalogBarIndicator`, `FillGauge`, `SparklineTrend`, `Sparkline`, `AlarmIndicator`, `DigitalStatus`, `DigitalStatusIndicator`, `PointNameLabel`, `SidecarElement`, or similar
- Any wrapper/container component that manages sidecar element layout around a shape
- Look in `frontend/src/components/graphics/`, `frontend/src/components/sidecar/`, `frontend/src/components/display-elements/`, or wherever the graphics rendering components live

### Theme/CSS files for the old shape system
Delete any CSS or theme files that were custom-built for the previous shape/sidecar implementation. Do NOT delete the application's global theme system — only files specific to shapes and display elements.

### What NOT to delete
- Doc 35's JSON sidecar data model types and schema definitions — those are correct and stay
- The scene graph node type definitions in TypeScript (from Doc 19) — those stay
- Any backend Rust code related to shape storage or retrieval — that stays
- The design doc `.md` files — never touch those

---

## Step 2: Authority Hierarchy

When implementing, follow this precedence:

1. **HTML preview files are the final visual authority.** Open them in a browser. What you see is what you implement. Extract exact path data, colors, and dimensions from these files.
2. **The MD spec files explain behavior and rules.** When the HTML shows something and the MD explains why, they are complementary. If they truly conflict on a visual detail, flag it with a `// CONFLICT: HTML shows X, spec says Y — needs resolution` comment and implement what the HTML shows.
3. **This prompt provides exact token values, color codes, and dimensions.** Use them as written. Do not round, approximate, or substitute.
4. **Do not invent anything.** If a behavior, color, dimension, or interaction is not specified in this prompt, the spec files, or the preview HTMLs, do not implement it. Leave a `// TODO: unspecified in spec — needs decision` comment.

---

## Step 3: SVG Shape Library — Geometry

### Non-negotiable rules

- **Equipment stroke color: `#808080`** — ISA-101 standard. Never themed. Never changes regardless of alarm state, theme, or any other condition. This applies to every equipment outline and composable part outline.
- **Stroke widths:** `1.5px` for primary equipment lines. `0.75px` for foot/base lines on supports.
- **Equipment shapes never communicate alarm state.** A pump in a P1 alarm looks identical to a pump with no alarm. All alarm communication goes through the Alarm Indicator display element.

### Extracting geometry

Open the `dark-shape-library-preview.html` file in a browser. The SVG path data in that file is the authoritative geometry for all 25 Tier 1 shapes and all composable combinations. Extract the `<path>`, `<line>`, `<circle>`, `<rect>`, `<polygon>`, and `<polyline>` elements from the preview HTML. Do not re-derive geometry from memory or from ISA standard descriptions.

### Composable part attachment

Use `shape-composition-rules.md` for exact coordinates when assembling composed shapes (valve + actuator, reactor + agitator, vessel + support). That file contains:
- Valve stem attachment points per valve type (gate, globe, ball, butterfly — each different)
- Actuator body geometry and positioning in combo viewBoxes
- Fail indicator placement geometry
- Reactor agitator shaft and impeller coordinates
- Reactor support attachment coordinates
- Sphere and capsule support surface attachment formulas

Use those coordinate tables exactly. Do not re-derive them.

### SVG file naming convention

File names follow Doc 35. These are authoritative:

**Valves:** `valve-gate.svg`, `valve-globe.svg`, `valve-ball.svg`, `valve-butterfly.svg`, `valve-control.svg`, `valve-relief.svg` (variants: `valve-relief-spring-loaded.svg`, `valve-relief-pilot-operated.svg`)

**Pumps:** `pump-centrifugal-opt1.svg`, `pump-centrifugal-opt2.svg`, `pump-positive-displacement-opt1.svg`, `pump-positive-displacement-opt2.svg`

**Rotating:** `compressor-opt1.svg`, `compressor-opt2.svg`, `fan-blower-opt1.svg`, `fan-blower-opt2.svg`, `motor-opt1.svg`, `motor-opt2.svg`

**Heat transfer:** `heat-exchanger-shell-tube.svg` (variants: `-standard`, `-kettle-reboiler`, `-u-tube`), `heat-exchanger-plate.svg`, `heater-fired-box.svg`, `heater-fired-cylindrical.svg`, `air-cooler.svg`

**Vessels:** `vessel-vertical.svg` (variants: `-welded`, `-flanged-top`, `-flanged-bottom`, `-flanged-both`), `vessel-horizontal.svg` (same variant pattern)

**Tanks:** `tank-storage-cone-roof.svg`, `tank-storage-dome-roof.svg`, `tank-storage-open-top.svg`, `tank-storage-floating-roof.svg`, `tank-storage-sphere.svg`, `tank-storage-capsule.svg`

**Reactors:** `reactor-base.svg`, `reactor-flat-top.svg`, `reactor-closed.svg`, `reactor-trayed.svg`

**Columns:** `column-distillation-{width}-{internals}.svg` where width = `narrow`|`standard`|`wide` and internals = `plain`|`trayed-6`|`trayed-10`|`packed` (12 combinations)

**Separation:** `filter-standard.svg`, `filter-vacuum.svg`, `mixer-agitator.svg`, `mixer-agitator-motor.svg`, `mixer-inline-static.svg`

**Instrumentation:** `instrument-field.svg`, `instrument-panel.svg`, `instrument-behind-panel.svg`, `alarm-annunciator-opt1.svg`, `alarm-annunciator-opt2.svg`, `interlock-standard.svg`, `interlock-sis.svg`, `interlock-padlock.svg`

**Composable parts:** `part-actuator-diaphragm.svg`, `part-actuator-motor.svg`, `part-actuator-solenoid.svg`, `part-fail-open.svg`, `part-fail-closed.svg`, `part-fail-last.svg`, `agitator-turbine.svg`, `agitator-propeller.svg`, `agitator-anchor.svg`, `agitator-paddle.svg`, `agitator-helical.svg`, `support-skirt.svg`, `support-legs-3.svg`, `support-legs-4.svg`, `support-legs-splayed.svg`, `support-saddles.svg`

### Operational state fill colors (equipment shape body only)

These fills apply to the equipment shape body. They are theme-independent. They have nothing to do with alarm state or sidecar display elements.

| State | Fill | Stroke |
|---|---|---|
| Stopped / Closed / Normal | `transparent` | `#808080` |
| Running / Open | `#059669` | `#047857` |
| Transitioning | `#FFAA00` | `#D97706` |
| Fault | `#D946EF` | `#C026D3` |

---

## Step 4: Three-Theme CSS Token System

Implement CSS custom properties on the root element (or theme class) for all three themes. Every value below is exact. Do not approximate.

### Dark Theme

```css
[data-theme="dark"] {
  /* Surface & Text */
  --io-surface-primary: #09090B;
  --io-surface-secondary: #18181B;
  --io-surface-elevated: #27272A;
  --io-text-primary: #F9FAFB;
  --io-text-secondary: #A1A1AA;
  --io-text-muted: #71717A;
  --io-text-stale: #636363;
  --io-accent: #2DD4BF;
  --io-border: #3F3F46;
  --io-border-strong: #52525B;
  --io-display-zone-inactive: #3F3F46;
  --io-display-zone-normal: #404048;
  --io-display-zone-border: #52525B;
  --io-fill-normal: #475569;
  --equip-stroke: #808080;

  /* Alarm & State */
  --al-urgent: #EF4444;
  --al-high: #F97316;
  --al-low: #EAB308;
  --al-diag: #F4F4F5;
  --al-shelved: #D946EF;
  --al-disabled: #52525B;
  --al-custom: #60A5FA;

  /* Analog Bar Zones (muted warm-to-cool ramp) */
  --io-zone-hh: #5C3A3A;
  --io-zone-h: #5C4A32;
  --io-zone-normal: #404048;
  --io-zone-l: #32445C;
  --io-zone-ll: #2E3A5C;

  /* Fill Gauge */
  --io-fill-normal-opacity: 0.6;
  --io-fill-stale-opacity: 0.3;
}
```

### Light Theme

```css
[data-theme="light"] {
  /* Surface & Text */
  --io-surface-primary: #ffffff;
  --io-surface-secondary: #f9fafb;
  --io-surface-elevated: #ffffff;
  --io-text-primary: #111827;
  --io-text-secondary: #6b7280;
  --io-text-muted: #9ca3af;
  --io-text-stale: #9CA3AF;
  --io-accent: #0d9488;
  --io-border: #e5e7eb;
  --io-border-strong: #d1d5db;
  --io-display-zone-inactive: #e5e7eb;
  --io-display-zone-normal: #d1d5db;
  --io-display-zone-border: #d1d5db;
  --io-fill-normal: #94a3b8;
  --equip-stroke: #808080;

  /* Alarm & State (darkened for contrast on white) */
  --al-urgent: #b91c1c;
  --al-high: #ea580c;
  --al-low: #c8a800;
  --al-diag: #52525b;
  --al-shelved: #c026d3;
  --al-disabled: #9ca3af;
  --al-custom: #2563eb;

  /* Analog Bar Zones (pastel) */
  --io-zone-hh: #fee2e2;
  --io-zone-h: #fef9c3;
  --io-zone-normal: #d1d5db;  /* same as --io-display-zone-normal */
  --io-zone-l: #dbeafe;
  --io-zone-ll: #bfdbfe;

  /* Fill Gauge */
  --io-fill-normal-opacity: 0.45;
  --io-fill-stale-opacity: 0.15;
}
```

### HP HMI Theme

```css
[data-theme="hphmi"] {
  /* Surface & Text */
  --io-surface-primary: #0f172a;
  --io-surface-secondary: #1e293b;
  --io-surface-elevated: #334155;
  --io-text-primary: #e2e8f0;
  --io-text-secondary: #94a3b8;
  --io-text-muted: #64748b;
  --io-text-stale: #475569;
  --io-accent: #14b8a6;
  --io-border: #475569;
  --io-border-strong: #64748b;
  --io-display-zone-inactive: #3f3f46;
  --io-display-zone-normal: #404048;
  --io-display-zone-border: #52525b;
  --io-fill-normal: #475569;
  --equip-stroke: #808080;

  /* Alarm & State (same as dark except where noted) */
  --al-urgent: #ef4444;
  --al-high: #f97316;
  --al-low: #eab308;
  --al-diag: #F4F4F5;
  --al-shelved: #d946ef;
  --al-disabled: #64748b;  /* slate-500, differs from dark */
  --al-custom: #60a5fa;

  /* Analog Bar Zones (same muted ramp as dark) */
  --io-zone-hh: #5C3A3A;
  --io-zone-h: #5C4A32;
  --io-zone-normal: #404048;
  --io-zone-l: #32445C;
  --io-zone-ll: #2E3A5C;

  /* Fill Gauge */
  --io-fill-normal-opacity: 0.5;
  --io-fill-stale-opacity: 0.2;
}
```

---

## Step 5: The 7 Display Element Types

### Element 1: Text Readout

**What:** Shows a numeric value with optional label and engineering units, inside a background box.

**Geometry:**
- Rounded rectangle, `border-radius: 2px`
- Padding: 5px horizontal, 4px vertical
- Width: content-sized (no resize handle)

**Configuration options:**

| Option | Default | Values |
|---|---|---|
| Font family | JetBrains Mono | JetBrains Mono, Inter |
| Font size | 11px | 9-16px |
| Font weight | 400 | 400, 500, 600, 700 |
| Bold | Off | Toggle |
| Italic | Off | Toggle |
| Decimal places | 1 | 0-6 |
| Engineering units | On | Toggle |

**Normal state:**
- Box fill: `var(--io-surface-elevated)`
- Box stroke: 1px solid `var(--io-border)`
- Value text: JetBrains Mono 11px weight 400, `var(--io-text-secondary)`
- Units: 9px, `var(--io-text-muted)`, inline after value with one space
- Label (optional, above value): 8px, `var(--io-text-muted)`

**Alarm state:**
- Box stroke: 2px at full alarm priority color
- Box fill: alarm priority color at 20% mixed into `var(--io-surface-elevated)`
- Value text: promoted to `var(--io-text-primary)`
- Units and label: unchanged

**Unacknowledged alarm:**
- Border and background tint alternate between alarm color and normal at 1Hz (`step-end`)
- Text NEVER flashes

**RTN Unacknowledged:**
- Returns to normal display (no alarm tint, no alarm border, normal text color)
- The Alarm Indicator element (not the readout) shows the RTN state

**Value-Only Mode (no box):**
- No background rectangle
- Normal: `var(--io-text-secondary)` text
- Alarm communicated via separate Alarm Indicator element
- Minimum designer hit area: 24x16px even with no visible box

**Stale:**
- Value text color: `var(--io-text-stale)`
- Clock icon (⏱) appears 7px right of value, same `var(--io-text-stale)` color, size `1em` (scales with configured font size)
- Both color change AND clock icon appear together

**Bad Quality Phase 1 (3s-30s):**
- Last known value in `var(--io-text-stale)` color
- Warning triangle (⚠) replaces clock icon, 7px right of value, same color, `1em` size
- ⚠ subsumes ⏱ (do not show both)

**Bad Quality Phase 2 (30s+):**
- `BAD` text in `var(--io-text-muted)` color, no icon
- No value shown

**N/C (not connected):**
- `N/C` in `var(--io-text-muted)`

**Before first value:**
- `—.—` (em-dashes matching configured decimal places) followed by units in `var(--io-text-muted)`
- Never show `0.00` — zero is a meaningful process value

**Update flash:**
- Background flashes to a brighter `var(--io-surface-elevated)` for ~150ms
- 2-second cooldown between flashes
- Suppressed during active alarm state
- Configurable per element (default: on)

---

### Element 2: Analog Bar Indicator

**What:** Vertical or horizontal bar divided into 5 threshold zones with a pointer at the current value.

**Mode A: Standalone (external to shape)**

Geometry:
- Bar width: 18-22px (vertical) / height 18-22px (horizontal)
- Bar height: 80-150px depending on context
- Both height and width are draggable in the designer
- Zone order top-to-bottom (vertical): HH, H, Normal, L, LL
- Zone order left-to-right (horizontal): LL, L, Normal, H, HH
- Zone strokes: 0.5px `var(--io-display-zone-border)`
- Outer border: 0.5px `var(--io-display-zone-border)`
- Background: `var(--io-surface-elevated)`

Zone fill colors (normal — no alarm):
- Dark/HPHMI: HH `#5C3A3A`, H `#5C4A32`, Normal `#404048`, L `#32445C`, LL `#2E3A5C`
- Light: HH `#fee2e2`, H `#fef9c3`, Normal `#d1d5db`, L `#dbeafe`, LL `#bfdbfe`

Zone labels: `HH`, `H`, `L`, `LL` — JetBrains Mono 7px, `var(--io-text-muted)`, right-aligned to bar's left edge, offset ~3px left.

Pointer: triangle pointing inward from bar edge, ~6px wide x 8px tall. Fill: `var(--io-text-secondary)`. Thin horizontal line across bar width at same Y position, stroke `var(--io-text-secondary)`, 1px. In alarm zone: pointer and line change to that zone's alarm priority color.

Zone proportions are **proportional to configured threshold values**, not equal fifths. Minimum zone height: 4px at 1:1 scale (zone label suppressed below this).

**Value-in-Zone activation:** When live value is within a zone, that zone's fill transitions to the full alarm priority color at 50% opacity overlaid on the zone's normal muted ramp color. Independent of whether an alarm is actually active.

Optional: setpoint marker (diamond, `var(--io-accent)` stroke, no fill), numeric readout below bar, signal line (0.75px dashed `var(--io-border-strong)`, dash `3 2`).

Threshold configuration: each level (HH, H, L, LL, SP) has a three-way toggle — Live binding, Fixed value, or None. Unset thresholds produce no zone band.

**Mode B: Vessel-Interior**
- Bar width: ~40-60% of vessel interior width, centered
- Bar height: spans vessel interior
- Clips to vessel interior via `<clipPath>` (same mechanism as Fill Gauge Mode A)
- Zone labels inside bar areas, JetBrains Mono 7px, white/light text
- Shows zone bands throughout full height (not a fill from bottom)

**Stale:** Pointer `var(--io-text-stale)` + ⏱ icon

**Bad Phase 1:** Pointer `var(--io-text-stale)` + diagonal hatch pattern overlay + ⚠ icon. Setpoint marker hidden.

**Bad Phase 2:** Pointer hidden entirely. Setpoint marker hidden. `BAD` text centered on bar in `var(--io-text-muted)`. Zone bands remain visible.

**Hatch pattern (Bad Phase 1):** SVG `<pattern>` element, `patternUnits="userSpaceOnUse"`, 4x4px tile. Diagonal line: `x1="0" y1="4" x2="4" y2="0"`, stroke `var(--io-text-stale)`, stroke-width 0.8px. Applied as `fill="url(#bad-phase1-hatch)"` overlaid on pointer fill. Pattern is additive.

**Out of range:** Pointer clamps to top or bottom edge. Topmost/bottommost zone fills with 50% opacity in active alarm color. No overflow.

---

### Element 3: Fill Gauge

**What:** Represents physical capacity/level as a continuous fill rising from the bottom.

**Mode A: Vessel-Interior (clipped)**
- Fill rectangle uses SVG `<clipPath>` referencing vessel's interior outline
- Clip path follows actual vessel geometry including curved/elliptical heads
- Fill direction: bottom to top
- Fill rect must extend below vessel's curved bottom — clipPath shapes it
- At 100%: vessel outline stroke drawn ABOVE fill layer — top head curve visible
- Numeric value centered in filled region, JetBrains Mono 11px, `var(--io-text-secondary)`

**Mode B: Standalone Bar**
- Independent rectangle, 20-24px wide vertical
- Border: 0.5px `var(--io-display-zone-border)`
- Numeric value below bar

**Fill colors:**

| State | Fill | Opacity |
|---|---|---|
| Normal | `var(--io-fill-normal)` | Dark: 60%, HPHMI: 50%, Light: 45% |
| Stale | `var(--io-fill-normal)` | Dark: 30%, HPHMI: 20%, Light: 15% |
| In alarm | Full alarm priority color | 30% |
| Unacknowledged alarm | Alarm color to transparent | 1Hz flash |

**Level line:**
- Horizontal dashed line at fill top edge
- 1px, dash `5 3`
- Dark/HPHMI: `#64748B`, Light: `var(--io-border-strong)`
- Spans full interior width

**Bad Phase 1:** Fill at stale opacity + diagonal hatch pattern (same spec as Analog Bar) + ⚠ icon

**Bad Phase 2:** Fill frozen at last good level, opacity ~15%. `BAD` text overlaid centered in `var(--io-text-muted)`. Fill never drops to 0%.

**Out of range:** Fill clamps at 100% (above-range) or 0% (below-range). No overflow.

**Before first value:** Fill height zero (empty vessel appearance).

---

### Element 4: Sparkline Trend

**What:** Tiny inline trend showing value trajectory over recent history. Fully resizable.

**Geometry:**
- Default: 110x18px (resizable by dragging any edge in designer)
- Background: `var(--io-surface-elevated)`, `border-radius: 1px`, NO border stroke
- ~14 data points evenly spaced (count adjusts proportionally with width)

**Stroke:** Width 1.5px, `stroke-linejoin: round`, `stroke-linecap: round`

**Color states:**

| State | Dark | Light | HPHMI |
|---|---|---|---|
| Normal (no alarm) | `#71717A` (zinc-500) | `#a1a1aa` (zinc-400) | `#71717A` |
| P4 Diagnostic | `#F4F4F5` | `#52525b` | `#F4F4F5` |
| P3 Low | `var(--al-low)` | `var(--al-low)` | `var(--al-low)` |
| P2 High | `var(--al-high)` | `var(--al-high)` | `var(--al-high)` |
| P1 Urgent | `var(--al-urgent)` | `var(--al-urgent)` | `var(--al-urgent)` |
| Custom | `var(--al-custom)` | `var(--al-custom)` | `var(--al-custom)` |
| Shelved | `var(--al-shelved)`, `stroke-dasharray: 4 3` | same | same |
| Disabled | `var(--al-disabled)`, `stroke-dasharray: 2 4` | same | same |

**CRITICAL:** The bare `.sl` class with teal (`#2DD4BF`) is for preview/decoration ONLY. At runtime, sparklines MUST use state-specific classes (`.sl.normal`, `.sl.high`, etc.). Teal (`#2DD4BF`) must NEVER appear on a sparkline at runtime. Normal sparkline color is muted gray — not teal. This was wrong in previous implementations.

**Stale:** Line color changes to `var(--io-text-stale)`, regardless of alarm state.

**Before first value:** Flat line at vertical midpoint, `var(--io-text-muted)` color.

**Data:** Y-axis auto-scales to data range. No axes, no labels, no interactivity on canvas.

---

### Element 5: Alarm Indicator

**What:** ISA-101 priority-coded shape. Triple-redundant coding: shape + color + number.

**Visibility:**
- Hidden (`display: none`) when no alarm is active
- In Designer: shown as faint ghost at anchor position, 25% opacity, `var(--io-text-muted)` stroke/text, `—` inside. Always the dashed gray rectangle form regardless of configured priority.

**Shapes:**

| State | Shape | Dimensions | Stroke pattern |
|---|---|---|---|
| P1 Urgent | Rectangle rx=2 | 24x18px | Solid |
| P2 High | Triangle up | ~20px base | Solid |
| P3 Low | Inverted triangle | ~20px base | Solid |
| P4 Diagnostic | Ellipse | rx=14, ry=10 | Solid |
| Shelved | Diamond | ~20px diagonal | Solid |
| Disabled | Rectangle rx=2 | 24x18px | Dashed `3 2` |
| Custom | Circle | r=10 | Solid |

**Rendering:**
- Stroke only, NO fill. Stroke width 1.8px.
- Stroke and text number both use the alarm state color
- Text: priority number (1-4) centered inside shape. JetBrains Mono 9px, weight 600.
- Shelved shows `S`, Disabled shows `—`, Custom shows `C`

**Flash behavior (unacknowledged alarm):**
- 1Hz: alarm color to `#808080` (ISA equipment gray)
- CSS `step-end` — sharp on/off, NOT a fade or opacity change
- Both stroke and text number flash together simultaneously
- P1, P2, P3, and Custom flash. P4, Shelved, Disabled: steady (no flash).

**Acknowledged:** Steady alarm color, no animation.

**RTN Unacknowledged (Return to Normal):**
- Steady (not flashing) at a **dimmed** version of the alarm priority color — 50% opacity on stroke and text number
- Shape and number remain the same
- No flash (alarm condition no longer active)
- Remains visible until acknowledged

**Multiple active alarms on same point:**
- Shows highest active priority (lowest number)
- Count badge in lower-right corner: 12x12px circle, same alarm color fill, white number, JetBrains Mono 8px weight 700 — shown when count > 1

**Multiple points on same shape at same slot:**
- Indicators tile from anchor point (no overlap)
- No automatic priority collapsing

---

### Element 6: Digital Status Indicator

**What:** Discrete/binary state as a labeled pill (RUN/STOP, OPEN/CLOSED, AUTO/MANUAL).

**Geometry:**
- Rounded rectangle, `border-radius: 2px`
- Padding: 6px horizontal, 3px vertical
- Sized to content, no border stroke

**Normal state:**
- Fill: `var(--io-display-zone-inactive)`
- Text: `var(--io-text-secondary)`, JetBrains Mono 9px, centered

**Abnormal state:**
- Fill: full alarm priority color
- Text color by fill (contrast requirement):

| Fill | Text |
|---|---|
| P1 Urgent (red) | `var(--io-text-primary)` (light text) |
| P2 High (orange) | `var(--io-text-primary)` (light text) |
| P3 Low (yellow) | `#18181B` (dark text, always) |
| P4 Diagnostic | Dark: `#18181B`, Light: `#ffffff`, HPHMI: `#18181B` |
| Shelved (magenta) | `var(--io-text-primary)` (light text) |
| Custom (blue) | `var(--io-text-primary)` (light text) |

**Stale:** same as Text Readout stale treatment — `var(--io-text-stale)` color on label text.

**Bad Phase 1:** Last known state label in `var(--io-text-stale)`. ⚠ icon 7px right of pill, 1em, same color. Pill background stays gray (inactive).

**Bad Phase 2:** Pill shows `BAD` in `var(--io-text-muted)`, gray background.

**Width modes:** `auto` (sizes to longest state label) and `fixed` (user-set width, shorter labels centered).

---

### Element 7: Point Name Label

**What:** Displays the point's identifier near the shape as a text label.

**Display options:**
- `point-name` — raw tag ID (e.g. `FIC-101`)
- `display-name` — human-readable label (e.g. `Feed Flow Controller`)
- `both` — point-name first line, display-name second line, 2px gap

When `both` is selected, secondary style option:

| Style | PointName | DisplayName |
|---|---|---|
| `hierarchy` (default) | 9px, weight 500, `var(--io-text-secondary)` | 8px, weight 400, `var(--io-text-muted)` |
| `uniform` | 9px, weight 400, `var(--io-text-muted)` | 9px, weight 400, `var(--io-text-muted)` |

Point names are NOT affected by alarm state.

**Combination rule:** When Point Name and Point Value are at the same slot, they stack vertically (name on top, value on bottom, 3px gap). Positioned as one composite unit. This stacking order is fixed and not configurable.

---

## Step 6: Alarm Priority Colors — ISA-18.2 Four-Level Scheme

These exact values must be used. They are already in the CSS tokens above, but this table is the quick reference:

### Dark / HP HMI

| Priority | Token | Hex | Tailwind |
|---|---|---|---|
| P1 Urgent | `--al-urgent` | `#EF4444` | red-500 |
| P2 High | `--al-high` | `#F97316` | orange-500 |
| P3 Low | `--al-low` | `#EAB308` | yellow-500 |
| P4 Diagnostic | `--al-diag` | `#F4F4F5` | near-white |
| Shelved | `--al-shelved` | `#D946EF` | fuchsia-500 |
| Disabled | `--al-disabled` | `#52525B` (dark) / `#64748b` (HPHMI) | zinc-600 / slate-500 |
| Custom | `--al-custom` | `#60A5FA` | blue-400 |

### Light (darkened for contrast on white)

| Priority | Token | Hex |
|---|---|---|
| P1 Urgent | `--al-urgent` | `#b91c1c` |
| P2 High | `--al-high` | `#ea580c` |
| P3 Low | `--al-low` | `#c8a800` |
| P4 Diagnostic | `--al-diag` | `#52525b` |
| Shelved | `--al-shelved` | `#c026d3` |
| Disabled | `--al-disabled` | `#9ca3af` |
| Custom | `--al-custom` | `#2563eb` |

---

## Step 7: OPC UA Alarm Priority / Severity Mapping

This was missing from previous implementations. You must implement this.

### The Problem

Every OPC UA server and DCS vendor encodes alarm priority differently:
- OPC UA standard: `Severity` field (uint16, 0-1000) with four bands
- Honeywell, Yokogawa, Emerson DeltaV: proprietary priority numbering (1=highest or 4=lowest or vice versa)
- OPC UA `AlarmConditionType` has a `ConditionClassId` that may carry priority hints
- Some servers expose priority as a custom extension node

### Required Solution

A **per-OPC-source alarm priority mapping table** in the Settings module. The admin configures this once per OPC server connection. The mapping translates the source system's priority values into I/O's ISA P1/P2/P3/P4 scheme.

### Mapping Types

**1. Severity range mapping (default):**
Map OPC UA severity ranges to ISA priorities.

| OPC Severity Range | ISA Priority |
|---|---|
| 751-1000 | P1 Urgent |
| 501-750 | P2 High |
| 251-500 | P3 Low |
| 1-250 | P4 Diagnostic |

This is the default when no custom mapping is configured.

**2. Discrete value mapping:**
For systems using specific integer codes.

Example (Emerson DeltaV): Priority 1 -> P1, Priority 2 -> P2, Priority 3 -> P3, Priority 4 -> P4.
Example (system where 0=highest): 0 -> P1, 1 -> P2, 2 -> P3, 3 -> P4.

The admin defines each source value and its ISA mapping.

**3. Custom property mapping:**
Some OPC servers expose alarm priority as a custom extension node rather than the standard severity field. The mapping must support specifying an alternative node ID or property name as the priority source.

### States NOT mapped from OPC

These are I/O-internal states:
- **P4 Diagnostic:** Fired by thresholds configured in I/O, not by OPC severity
- **Shelved:** Operator action in I/O — point shelved regardless of OPC state
- **Disabled:** Point marked inactive in I/O configuration

### Admin UI Location

Settings -> OPC Connections -> [connection name] -> Alarm Priority Mapping tab.

The UI must show:
- A mapping type selector (Range / Discrete / Custom Property)
- For Range: editable severity range boundaries
- For Discrete: a table of source value -> ISA priority rows (add/remove rows)
- For Custom Property: a field for the source node ID / property name, plus a Discrete or Range mapping for the values from that property
- A "Reset to Default" button that restores the OPC UA standard four-band mapping
- A test panel where the admin can enter a sample severity value and see which ISA priority it maps to

---

## Step 8: Shape Drop Dialog and Sidecar Pre-attachment

When a shape is dragged from the palette onto the canvas, a two-step dialog appears.

### Step 1: Shape Configuration

- **Variant picker** (visual grid or radio buttons): shows variants defined in `shape-variants-addons.md` for that shape type. First listed variant is the default.
- **Add-on checkboxes**: shape-specific, per `shape-variants-addons.md`. Conditional — show/hide based on selected variant.
- **Mutually exclusive add-ons use radio buttons**, not checkboxes. (Agitator types, support types on reactors.)
- **Valve fail indicators** are disabled (grayed) until an actuator variant is selected.
- If a shape has only one variant and no add-ons, Step 1 is auto-completed.
- Buttons: **"Next ->"** (advance to Step 2), **"Use Defaults"** (place immediately with default variant, no add-ons, skip Step 2), **"Cancel"** (abort drop entirely, shape NOT placed).

### Step 2: Sidecar Pre-attachment

One binding section per bindable part. For a plain shape: one section. For a control valve with actuator: two sections (valve body + actuator).

Each section contains:
- **Point binding field** — enter a tag now or leave blank
- **Sidecar element checklist** — Point Name, Text Readout, Sparkline, Analog Bar, Fill Gauge, Digital Status, Alarm Indicator (only applicable types shown)
- Checked elements land at their default slots

Buttons: **"Finish"** (place the shape), **"Back"** (return to Step 1).

### After Placement

- Right-click shape -> "Shape Configuration..." re-opens the dialog
- Right sidebar shows all same options as fields/dropdowns
- Changes update the existing shape instance in place

---

## Step 9: Anchor Slot System

### Named slots by element type

**Point Name:** `top` (default), `right`, `bottom`, `left`, `freeform`

**Point Value (Text Readout):** `top`, `right`, `bottom` (default), `left`, `freeform`

**Alarm Indicator:** `top-right` (default), `bottom-right`, `bottom-left`, `top-left`, `freeform`. Corner-only — no mid-edge slots.

**Analog Bar:** `right-vertical` (default), `left-vertical`, `right-horizontal`, `left-horizontal`, `top-vertical`, `top-horizontal`, `bottom-vertical`, `bottom-horizontal`, `vessel-interior` (vessel shapes only), `freeform`

**Fill Gauge:** `vessel-interior` (default for vessels), `right`, `left`, `freeform`

**Sparkline:** `right-top` (default), `right-bottom`, `left-bottom`, `left-top`, `freeform`. Near-corner offsets — no `top`, `bottom`, or mid-edge slots.

**Digital Status:** `top`, `right`, `bottom` (default), `left`, `freeform`

### Slot positions

- Mid-edge slots (`top`, `right`, `bottom`, `left`): 6px gap from shape bbox edge
- Corner slots (`top-right`, `top-left`, `bottom-right`, `bottom-left`): 4px clear gap from both edges
- Analog Bar/Fill Gauge floating: 8px gap from shape bbox edge

### Default slots by shape category

| Shape category | Alarm indicator | Primary value | Secondary |
|---|---|---|---|
| Pumps, motors, HX, compressors | `top-right` | `bottom` text readout | — |
| Tall vessels, reactors | `top-right` | `bottom` text readout | `vessel-interior` fill gauge |
| Distillation columns | `top-right` | `right` text readout | `right` analog bar |
| Storage tanks | `top-right` | `bottom` text readout | `vessel-interior` fill gauge |
| Control/relief valves | `top-right` | `right` text readout | — |
| Gate/globe/ball/butterfly valves | `top-right` | `bottom` digital status | — |
| Instruments | `top-right` | `right` text readout | — |

### Snap behavior

1. Ghost targets appear at all valid named slot positions when dragging an element near a shape
2. Element snaps to nearest slot within ~12px radius
3. Tooltip label shows slot name while snapping
4. Dragging past all snap zones releases to freeform
5. Freeform elements show a small `○` indicator (designer only)

### Freeform positioning

Freeform element positions are stored **relative to their parent shape's origin**, NOT as absolute canvas coordinates. Elements move with their shape.

---

## Step 10: Bad Quality and Stale — Complete State Machine

### Degradation hierarchy

```
Normal
  -> Stale (60s no update, configurable per source)
    -> Bad Phase 1 (3s onset debounce, sustained Bad)
      -> Bad Phase 2 (30s sustained Bad)
        -> Recovery (5s sustained Good before clearing)
```

### State precedence

- **Stale + Bad simultaneously:** Bad takes priority. ⚠ subsumes ⏱.
- **Stale + Alarm:** Both apply. Alarm border/tint still flashes; stale icon stays steady.

### Icons

| Condition | Icon | Color | Size |
|---|---|---|---|
| Stale | ⏱ (clock) | `var(--io-text-stale)` | `1em` — scales with font size |
| Bad Phase 1 | ⚠ (warning triangle) | `var(--io-text-stale)` | `1em` — scales with font size |

Both icons: 7px gap right of value. Do NOT hard-code a fixed pixel size.

### Per-element summary

| Element | Stale | Bad Phase 1 | Bad Phase 2 |
|---|---|---|---|
| Text Readout | `--io-text-stale` + ⏱ | Last value `--io-text-stale` + ⚠ | `BAD` in `--io-text-muted` |
| Digital Status | `--io-text-stale` label | Last label `--io-text-stale` + ⚠ right of pill | `BAD` in `--io-text-muted` |
| Analog Bar | Pointer `--io-text-stale` + ⏱ | Pointer `--io-text-stale` + hatch + ⚠, SP hidden | Pointer hidden, `BAD` centered, zones visible |
| Fill Gauge | Stale opacity + ⏱ | Stale opacity + hatch + ⚠ | Frozen at last good, ~15% opacity, `BAD` overlaid |
| Sparkline | Line `--io-text-stale` | Line `--io-text-stale` | Line `--io-text-stale` (no Phase 2 distinction) |
| Alarm Indicator | Not affected | Not affected | Not affected |

### Debounce timers (global, not per-element)

- Bad onset: 3 seconds sustained Bad before Phase 1
- Phase 1 duration: up to 30 seconds
- Recovery: 5 seconds sustained Good before clearing Bad Phase 2

### Hatch pattern spec (Bad Phase 1, Analog Bar and Fill Gauge)

```xml
<defs>
  <pattern id="bad-phase1-hatch" patternUnits="userSpaceOnUse" width="4" height="4">
    <line x1="0" y1="4" x2="4" y2="0"
          stroke="var(--io-text-stale)" stroke-width="0.8" />
  </pattern>
</defs>
```

Applied as `fill="url(#bad-phase1-hatch)"` overlaid on pointer fill or fill gauge fill area. Additive — on top of stale color/opacity.

---

## Step 11: What NOT to Do

These are explicit prohibitions based on errors in previous implementations:

1. **Do NOT invent geometry.** Every path, line, circle, polygon, and rect must come from the HTML preview files or `shape-composition-rules.md`. If you cannot find the geometry for a shape, leave a TODO.

2. **Do NOT use teal (`#2DD4BF`) on sparklines at runtime.** Teal is the accent color for connection points and setpoint markers. On sparklines, teal is preview decoration only. Runtime sparklines use the state-specific colors in the table above. Normal = `#71717A` (dark/HPHMI) or `#a1a1aa` (light).

3. **Do NOT theme equipment outlines.** Equipment stroke is always `#808080`. In every theme. In every state. No exceptions.

4. **Do NOT hard-code pixel sizes for ⏱ and ⚠ icons.** These are `1em` — they scale with the configured font size of the element they appear in.

5. **Do NOT skip the OPC priority mapping implementation.** It is a required feature, not optional.

6. **Do NOT create any GPL/AGPL/copyleft dependencies.** All dependencies must be MIT, Apache 2.0, BSD, ISC, PostgreSQL License, or MPL 2.0.

7. **Do NOT implement fade/opacity transitions for the unacknowledged alarm flash.** It is a sharp 1Hz `step-end` toggle. On, off, on, off. Not a pulse, not a glow, not a sine wave.

8. **Do NOT show the Alarm Indicator as an empty placeholder on the live canvas.** When no alarm is active, it is `display: none`. The ghost form only appears in the designer.

9. **Do NOT conflate Fill Gauge and Analog Bar Mode B.** Fill Gauge fills from the bottom (physical level). Analog Bar Mode B shows zone bands through the full height (operating range). They are different elements for different purposes.

10. **Do NOT apply alarm colors to equipment shapes.** Equipment shapes show operational state (running/stopped/fault). Alarm state is communicated exclusively through the Alarm Indicator display element and through sidecar element borders/tints.

---

## Step 12: Verification Checklist

Before marking this work complete, verify every item:

### SVG Shapes
- [ ] All 25 Tier 1 shapes render correctly with `#808080` stroke
- [ ] Stroke width is 1.5px primary, 0.75px foot/base lines
- [ ] Composable parts (actuators, agitators, supports) attach at the exact coordinates from `shape-composition-rules.md`
- [ ] Valve stems connect at the correct y-positions per valve type (gate/globe at y=12, ball at y=6, butterfly at y=12 cx=30)
- [ ] All operational state fills work (transparent, green, amber, magenta)
- [ ] Equipment outlines remain `#808080` in all three themes
- [ ] Equipment outlines remain `#808080` during all alarm states

### CSS Tokens
- [ ] All three theme token sets are implemented with exact hex values from Step 4
- [ ] Tokens switch correctly when theme changes
- [ ] `--io-text-stale` values: Dark `#636363`, Light `#9CA3AF`, HPHMI `#475569`
- [ ] All seven alarm colors are correct per theme (note: light theme uses darkened values)

### Display Elements
- [ ] Text Readout: normal, alarm, unacknowledged (1Hz flash), RTN, stale, Bad Phase 1, Bad Phase 2, N/C states all correct
- [ ] Analog Bar: zones proportional, pointer works, zone activation at 50% opacity, stale/bad states correct
- [ ] Fill Gauge: clips to vessel interior, level line dashed, opacity correct per theme per state
- [ ] Sparkline: normal color is muted gray (NOT teal), all alarm state colors correct, shelved dashed, disabled sparse-dashed
- [ ] Alarm Indicator: all 7 shapes correct, stroke-only no fill, 1.8px stroke, correct letters/numbers inside, flash is `step-end` 1Hz, RTN is 50% opacity steady, hidden when no alarm on live canvas
- [ ] Digital Status: correct text contrast per alarm color per theme
- [ ] Point Name: hierarchy and uniform styles both work, stacking with Point Value works

### Behavioral
- [ ] Unacknowledged flash is `step-end` (sharp), not fade
- [ ] Stale icons (⏱ ⚠) are `1em` sized, not fixed pixel
- [ ] Bad Phase 1 hatch pattern renders on Analog Bar and Fill Gauge
- [ ] Bad Phase 2 shows `BAD` text, hides pointer/value
- [ ] Debounce timers: 3s onset, 30s Phase 1, 5s recovery
- [ ] Value update flash: 150ms, 2s cooldown, suppressed during alarm

### OPC Mapping
- [ ] Settings UI exists at OPC Connections -> [connection] -> Alarm Priority Mapping
- [ ] Range mapping works with configurable boundaries
- [ ] Discrete value mapping works with add/remove rows
- [ ] Custom property source field works
- [ ] Default four-band mapping applies when unconfigured
- [ ] Reset to Default button works
- [ ] Test panel works (enter severity, see ISA priority)

### Anchor System
- [ ] All named slots position correctly per element type
- [ ] Snap behavior works within ~12px radius
- [ ] Ghost targets appear during drag
- [ ] Freeform positions stored relative to parent shape origin
- [ ] `○` indicator shows on freeform elements in designer only

### Shape Drop Dialog
- [ ] Step 1 variant picker shows correct variants per `shape-variants-addons.md`
- [ ] Conditional add-ons show/hide correctly
- [ ] Mutually exclusive add-ons use radio buttons
- [ ] "Use Defaults" skips Step 2 and places immediately
- [ ] "Cancel" aborts — shape NOT placed
- [ ] Step 2 shows one binding section per bindable part
