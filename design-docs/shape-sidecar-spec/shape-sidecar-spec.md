# I/O Shape Sidecar Specification

This folder is the **authoritative visual and interaction reference** for equipment shapes and their attached display elements on I/O graphics canvases. It covers:

- How display elements look and behave on the canvas (colors, geometry, animation)
- What states each element can be in and how those states appear
- How the designer exposes placement and anchor positions to the user
- Per-theme color values for all three supported themes

This is a **frontend spec**. It does not describe backend data models, scene graph internals, TypeScript types, or service architecture. Those live in the numbered design docs. This spec is the pixel-level truth for anything rendered on the canvas.

## Contents of This Folder

| File | Purpose |
|---|---|
| `shape-sidecar-spec.md` | This file — visual and interaction spec |
| `shape-variants-addons.md` | Drop dialog data — all 25 shape variants, add-on checkboxes, bindable parts, dialog rules |
| `dark-shape-sidecar-preview.html` | Live rendered reference — sidecar display elements, Dark theme |
| `light-shape-sidecar-preview.html` | Live rendered reference — sidecar display elements, Light theme |
| `hphmi-shape-sidecar-preview.html` | Live rendered reference — sidecar display elements, HP HMI theme |
| `dark-shape-library-preview.html` | Live rendered reference — all shapes + composable combinations, Dark theme |
| `light-shape-library-preview.html` | Live rendered reference — all shapes + composable combinations, Light theme |
| `hphmi-shape-library-preview.html` | Live rendered reference — all shapes + composable combinations, HP HMI theme |

The HTML files are the **definitive visual reference**. Open in browser. Implementation must match them exactly. Do not guess — match what you see.

---

## Color System

### Dark Theme (canonical)

All other themes derive from dark. When in doubt, dark is the standard.

#### Surface & Text

| Token | Hex | Usage |
|---|---|---|
| `--io-surface-primary` | `#09090B` | Canvas background |
| `--io-surface-secondary` | `#18181B` | Panel, card backgrounds |
| `--io-surface-elevated` | `#27272A` | Text readout box, sparkline background, analog bar background |
| `--io-text-primary` | `#F9FAFB` | Value text promoted in alarm |
| `--io-text-secondary` | `#A1A1AA` | Value text normal, pointer fill |
| `--io-text-muted` | `#71717A` | Labels, tag names, zone labels, units |
| `--io-accent` | `#2DD4BF` | Connection points, setpoint markers (Midnight Teal) |
| `--io-border` | `#3F3F46` | Readout box border normal |
| `--io-border-strong` | `#52525B` | Signal lines, piping stubs |
| `--io-display-zone-inactive` | `#3F3F46` | Digital status normal fill |
| `--io-display-zone-normal` | `#404048` | Analog bar normal zone |
| `--io-display-zone-border` | `#52525B` | Analog bar zone strokes, fill gauge border |
| `--io-fill-normal` | `#475569` | Fill gauge normal level color (applied at 60% opacity) |
| `--equip-stroke` | `#808080` | Equipment outlines — ISA-101, **never changes**, never themed |

#### Alarm & State Colors

| Token | Hex | State | Alarm Indicator Shape |
|---|---|---|---|
| `--al-urgent` | `#EF4444` | P1 Urgent — immediate action required | Rectangle rx=2, 24×18px |
| `--al-high` | `#F97316` | P2 High — action required soon | Triangle pointing up, ~20px base |
| `--al-low` | `#EAB308` | P3 Low — action required eventually | Inverted triangle, ~20px base |
| `--al-diag` | `#F4F4F5` | P4 Diagnostic — informational, no urgency | Ellipse rx=14, ry=10 |
| `--al-shelved` | `#D946EF` | Shelved/Suppressed — alarm active but operator-deferred | Diamond, ~20px diagonal |
| `--al-disabled` | `#52525B` | Disabled — point not active, no alarm possible | Dashed rectangle rx=2, 24×18px |
| `--al-custom` | `#60A5FA` | Custom user-defined alarm on this graphic | Circle r=10 |

#### Operational State (equipment shapes only)

| State | Fill | Stroke |
|---|---|---|
| Stopped / Closed / Normal | `transparent` | `#808080` |
| Running / Open | `#059669` | `#047857` |
| Transitioning | `#FFAA00` | `#D97706` |
| Fault | `#D946EF` | `#C026D3` |

---

### Light Theme

#### Surface & Text

| Token | Hex |
|---|---|
| `--io-surface-primary` | `#ffffff` |
| `--io-surface-secondary` | `#f9fafb` |
| `--io-surface-elevated` | `#ffffff` |
| `--io-text-primary` | `#111827` |
| `--io-text-secondary` | `#6b7280` |
| `--io-text-muted` | `#9ca3af` |
| `--io-accent` | `#0d9488` |
| `--io-border` | `#e5e7eb` |
| `--io-border-strong` | `#d1d5db` |
| `--io-display-zone-inactive` | `#e5e7eb` |
| `--io-display-zone-normal` | `#d1d5db` |
| `--io-display-zone-border` | `#d1d5db` |
| `--io-fill-normal` | `#94a3b8` (at 45% opacity) |

#### Alarm Colors (light — darkened for contrast on white)

| Token | Hex | Notes |
|---|---|---|
| `--al-urgent` | `#b91c1c` | Red-700 — deeper, pulls away from orange |
| `--al-high` | `#ea580c` | Orange-600 — middle step |
| `--al-low` | `#c8a800` | Pure yellow hue ~49° — clearly yellow, not amber |
| `--al-diag` | `#52525b` | Zinc-600 dark gray — white/near-white unusable on white bg |
| `--al-shelved` | `#c026d3` | Fuchsia-600 |
| `--al-disabled` | `#9ca3af` | Gray-400 |
| `--al-custom` | `#2563eb` | Blue-600 |

#### Analog Bar Zone Colors (light)

| Zone | Fill |
|---|---|
| HH | `#fee2e2` |
| H | `#fef9c3` |
| Normal | `var(--io-display-zone-normal)` |
| L | `#dbeafe` |
| LL | `#bfdbfe` |

---

### HP HMI Theme

#### Surface & Text

| Token | Hex |
|---|---|
| `--io-surface-primary` | `#0f172a` (slate-900) |
| `--io-surface-secondary` | `#1e293b` (slate-800) |
| `--io-surface-elevated` | `#334155` (slate-700) |
| `--io-text-primary` | `#e2e8f0` |
| `--io-text-secondary` | `#94a3b8` |
| `--io-text-muted` | `#64748b` |
| `--io-accent` | `#14b8a6` |
| `--io-border` | `#475569` |
| `--io-border-strong` | `#64748b` |
| `--io-display-zone-inactive` | `#3f3f46` |
| `--io-display-zone-normal` | `#404048` |
| `--io-display-zone-border` | `#52525b` |
| `--io-fill-normal` | `#475569` (at 50% opacity) |

#### Alarm Colors (HP HMI — same as dark except where noted)

| Token | Hex | Notes |
|---|---|---|
| `--al-urgent` | `#ef4444` | Same as dark |
| `--al-high` | `#f97316` | Same as dark |
| `--al-low` | `#eab308` | Same as dark |
| `--al-diag` | `#F4F4F5` | Same as dark — slate bg makes near-white work |
| `--al-shelved` | `#d946ef` | Same as dark |
| `--al-disabled` | `#64748b` | Slate-500 (matches slate palette) |
| `--al-custom` | `#60a5fa` | Same as dark |

---

## Analog Bar Zone Colors (Dark + HP HMI)

These are the **muted warm-to-cool ramp** visible at all times. They show operating range structure. They have **zero alarm color association** — zone position does not determine alarm priority.

| Zone | Fill | Description |
|---|---|---|
| HH | `#5C3A3A` | Warm brown-red, muted |
| H | `#5C4A32` | Warm brown, muted |
| Normal | `#404048` (`--io-display-zone-normal`) | Neutral gray |
| L | `#32445C` | Cool blue-gray, muted |
| LL | `#2E3A5C` | Deep cool blue, muted |

When an alarm fires and the value enters a zone: the zone's threshold color is **replaced** by the full alarm priority color configured for that threshold. Which priority fires is per-threshold, per-point — not tied to zone position.

---

## Typography

| Context | Font | Size | Weight | Color (Dark) |
|---|---|---|---|---|
| Numeric values | JetBrains Mono | 11px | 400 | `--io-text-secondary` (normal), `--io-text-primary` (alarm) |
| Labels / tag names | Inter | 9px | 400 | `--io-text-muted` |
| Engineering units | Inter | 9px | 400 | `--io-text-muted` |
| Zone labels (HH/H/L/LL) | JetBrains Mono | 7px | 400 | `--io-text-muted` |
| Alarm indicator number | JetBrains Mono | 9px | 600 | Same as alarm stroke color |
| Digital status text | JetBrains Mono | 9px | 400 | `--io-text-secondary` (normal), `--io-text-primary` (abnormal) |

All numeric values use `font-variant-numeric: tabular-nums` — fixed-width digits, no layout shift as values update.

---

## Display Element 1: Text Readout

Shows a numeric value with optional label and engineering units, inside a background box.

### Geometry
- Box: rounded rectangle, `border-radius: 2px`
- Padding: 5px horizontal, 4px vertical
- Width: **always content-sized** — no resize handle. Width is determined by the value text, units, and font settings.

### Configuration Options

The following per-element configuration options control the content and therefore the rendered width:

| Option | Default | Values |
|---|---|---|
| Font family | JetBrains Mono | JetBrains Mono, Inter |
| Font size | 11px | 9–16px |
| Font weight | 400 | 400, 500, 600, 700 |
| Bold | Off | Toggle |
| Italic | Off | Toggle |
| Decimal places | 1 (from point format string `%.1f`) | 0–6 |
| Engineering units | On | Toggle |

Point names are not affected by alarm state — only the readout box (border + tint) and value text change.

### Normal State
- Box fill: `--io-surface-elevated`
- Box stroke: 1px solid `--io-border`
- Value: JetBrains Mono 11px weight 400, `--io-text-secondary`
- Units: 9px, `--io-text-muted`, inline after value with one space
- Label (optional, above value): 8px, `--io-text-muted`

### Alarm State
- Box stroke: 2px at full alarm priority color
- Box fill: alarm priority color at 20% mixed into `--io-surface-elevated`
- Value: promoted to `--io-text-primary`
- Units and label: unchanged

### Unacknowledged Alarm
- Border and background tint alternate between alarm color and normal at 1Hz (`step-end`)
- **Text never flashes**

### Value-Only Mode (no box)
- No background rectangle
- Normal: `--io-text-secondary` text
- Alarm communicated via a separate Alarm Indicator element

---

## Display Element 2: Analog Bar Indicator

Vertical (or horizontal) bar divided into 5 threshold zones with a pointer at the current value.

### Mode A: Standalone (external to shape)

**Geometry**
- Bar width: 18–22px vertical / height 18–22px horizontal
- Bar height: 80–150px depending on context
- Zone order top→bottom (vertical): HH, H, Normal, L, LL
- Zone strokes: 0.5px `--io-display-zone-border`
- Outer border: 0.5px `--io-display-zone-border`
- Background: `--io-surface-elevated`

**Zone Labels**
- Text: `HH`, `H`, `L`, `LL` — JetBrains Mono 7px, `--io-text-muted`
- Position: right-aligned to bar's left edge, offset ~3px left

**Pointer**
- Shape: triangle pointing inward from bar edge, ~6px wide × 8px tall
- Fill: `--io-text-secondary`
- Thin horizontal line across bar width at same Y position (stroke: `--io-text-secondary`, 1px)
- In alarm zone: pointer and line fill/stroke change to that zone's alarm priority color

**Resize:** Both height and width are draggable in the designer (floating and inside variants). No fixed dimensions.

**Optional**
- Setpoint marker: diamond shape, `--io-accent` stroke, no fill, on same edge as pointer
- Numeric readout: below bar, standard Text Readout treatment
- Signal line: 0.75px dashed `--io-border-strong`, dash `3 2`

### Threshold Configuration

Each threshold level (HH, H, L, LL) and the Setpoint marker has a three-way binding toggle in the configuration panel:

| Option | Description |
|---|---|
| **Live binding** | Bind to a point (e.g., `FIC-101.HIHI`). Threshold position updates in real time. |
| **Fixed value** | User types a static number. Does not update with live data. |
| **None** | Threshold not configured — zone not shown, marker not drawn. |

On OPC UA, many alarm trip points are not exposed as tags. Fixed values or None are the fallback. The panel shows all five rows (HH / H / L / LL / SP) with a toggle for each. Unset thresholds produce no zone band in the rendered bar.

User-defined percentage levels (% of full range) may also be entered when engineering-unit threshold values are not available from the source system.

### Mode B: Vessel-Interior

For displaying a non-level variable (temperature, pressure, concentration) inside a vessel shape. Unlike Fill Gauge, this shows zone structure — not a continuous fill from the bottom.

**When to use:** The variable has defined operating limits (HH/H/L/LL thresholds) and the engineer wants those thresholds visible inside the vessel body. Common for reactor temperature, column pressure drop.

**Geometry**
- Bar width: approximately 40–60% of vessel interior width, centered
- Bar height: spans vessel interior height from bottom head to top head
- Clips to vessel interior outline via `<clipPath>` (same mechanism as Fill Gauge Mode 1)
- The clip path must follow the actual vessel geometry including curved heads

**Zone Labels**
- Appear inside the bar zone areas (no external room)
- JetBrains Mono 7px, white/light text for legibility on zone fill colors
- Optional — may be omitted if bar is narrow

**Pointer and level line**
- Same as Mode A — triangle + horizontal line at current value position

**Distinguishing from Fill Gauge**
- Fill Gauge fills solid from the bottom (represents physical level)
- Analog Bar Mode B shows zone bands throughout the full height (represents operating range)
- These are distinct element types and serve different purposes — do not conflate

---

## Display Element 3: Fill Gauge

Represents physical capacity/level as a continuous fill that rises from the bottom.

### Mode A: Vessel-Interior (clipped)

- Fill rectangle uses SVG `<clipPath>` referencing the vessel's interior outline
- Clip path follows actual vessel geometry including curved/elliptical heads
- Fill direction: bottom → top
- Fill rect must extend below vessel's curved bottom — clipPath shapes it correctly
- Numeric value centered in filled region; JetBrains Mono 11px, `--io-text-secondary`

### Mode B: Standalone Bar

- Independent rectangle, 20–24px wide vertical
- Border: 0.5px `--io-display-zone-border`
- Numeric value below bar

### Fill Colors

| State | Fill | Opacity |
|---|---|---|
| Normal | `--io-fill-normal` | Dark: 60% · HPHMI: 50% · Light: 45% |
| In alarm | Full alarm priority color | 30% |
| Unacknowledged alarm | Alarm color ↔ transparent | 1Hz flash |

### Level Line
- Horizontal dashed line at fill top edge
- 1px, dash `5 3`
- Dark/HPHMI: `#64748B` · Light: `--io-border-strong`
- Spans full interior width

---

## Display Element 4: Sparkline Trend

Tiny inline trend showing value trajectory over recent history. **Fully resizable** — drag any edge in the designer. Default size is 110×18px.

### Geometry
- Width: 110px default (resizable)
- Height: 18px default (resizable)
- Background: `--io-surface-elevated`, `border-radius: 1px`, **no border stroke**
- ~14 data points evenly spaced (count adjusts proportionally with width)

### Stroke
- Width: 1.5px, `stroke-linejoin: round`, `stroke-linecap: round`

### Color States

| State | Dark | Light | HPHMI |
|---|---|---|---|
| Normal (no alarm) | `#71717A` (zinc-500) | `#a1a1aa` (zinc-400) | `#71717A` |
| P4 Diagnostic | `#F4F4F5` | `#52525b` | `#F4F4F5` |
| P3 Low | `--al-low` | `--al-low` | `--al-low` |
| P2 High | `--al-high` | `--al-high` | `--al-high` |
| P1 Urgent | `--al-urgent` | `--al-urgent` | `--al-urgent` |
| Custom | `--al-custom` | `--al-custom` | `--al-custom` |
| Shelved | `--al-shelved`, `stroke-dasharray: 4 3` | same | same |
| Disabled | `--al-disabled`, `stroke-dasharray: 2 4` | same | same |

Normal sparkline color is intentionally muted gray — not teal, not an alarm color. It reads as "nothing alarming." There must be a clear luminance step between normal and P4 Diagnostic.

### Data Shape
- Y-axis auto-scales to data range
- No axes, no labels, no interactivity on canvas (tooltip may appear on hover in designer/operator view)
- Flat line = stable value

---

## Display Element 5: Alarm Indicator

ISA-101 priority-coded shape placed near (or on) equipment. **Triple-redundant coding: shape + color + number.**

### Visibility
- Hidden (`display: none`) when no alarm is active — no empty placeholder on live canvas
- **In Designer**: shown as a faint ghost at its anchor position so the user can see where it will appear. 25% opacity, `--io-text-muted` stroke/text, `—` inside.

### Shapes

| State | Shape | Dimensions | Stroke pattern |
|---|---|---|---|
| P1 Urgent | Rectangle rx=2 | 24×18px | Solid |
| P2 High | Triangle up | ~20px base | Solid |
| P3 Low | Inverted triangle | ~20px base | Solid |
| P4 Diagnostic | Ellipse | rx=14, ry=10 | Solid |
| Shelved | Diamond | ~20px diagonal | Solid |
| Disabled | Rectangle rx=2 | 24×18px | Dashed `3 2` |
| Custom | Circle | r=10 | Solid |

### Rendering
- **Stroke only, no fill.** Stroke width 1.8px.
- Stroke and text number both use the alarm state color
- Text: priority number (1–4) centered inside shape. JetBrains Mono 9px, weight 600.
- Shelved shows `S`, Disabled shows `—`, Custom shows `C`

### Flash Behavior — Unacknowledged Alarm
- 1Hz: alarm color ↔ `#808080` (ISA equipment gray)
- Timing: CSS `step-end` — sharp on/off, **NOT a fade or opacity change**
- Both stroke and text number flash together simultaneously
- P1, P2, P3, and Custom flash. P4, Shelved, Disabled: steady (no flash).

### Acknowledged
- Steady alarm color, no animation

### RTN Unacknowledged (Return to Normal — not yet acknowledged)

The alarm condition has cleared (value returned to normal range) but the operator has not yet acknowledged it. ISA-18.2 requires this state to be distinguishable.

- **Alarm Indicator:** Steady (not flashing) at a **dimmed** version of the alarm priority color — 50% opacity on stroke and text number. Shape and number remain the same. No flash, since the alarm condition is no longer active.
- **Text Readout / Digital Status / Sparkline:** Return to **normal display** — no alarm tint, no alarm border, normal text color. The value is back in normal range; showing alarm coloring on the readout would be misleading.
- **Alarm Indicator visibility:** Remains visible until acknowledged, even in RTN state — it is the sole signal that operator acknowledgment is still needed.

---

## Display Element 6: Digital Status Indicator

Discrete/binary state as a labeled pill: RUN/STOP, OPEN/CLOSED, AUTO/MANUAL, etc.

### Geometry
- Rounded rectangle, `border-radius: 2px`
- Padding: 6px horizontal, 3px vertical
- Sized to content, no border stroke

### Normal State
- Fill: `--io-display-zone-inactive`
- Text: `--io-text-secondary`, JetBrains Mono 9px, centered
- Which states are "normal" is configured per point

### Abnormal State
- Fill: full alarm priority color
- Text color depends on fill (contrast requirement):

| Fill | Dark text | Light text |
|---|---|---|
| P1 Urgent (red) | — | `--io-text-primary` |
| P2 High (orange) | — | `--io-text-primary` |
| P3 Low (yellow) | `#18181B` | — |
| P4 Diagnostic | Dark: `#18181B` · Light: `#ffffff` · HPHMI: `#18181B` | — |
| Shelved (magenta) | — | `--io-text-primary` |
| Custom (blue) | — | `--io-text-primary` |

P3 yellow and P4 Diagnostic (white/dark-gray) always require dark text for contrast. All others use light text.

---

## Sidecar Anchor System

Each shape has defined anchor positions for display elements. These are named slots, not arbitrary coordinates. The designer UI exposes them as snap targets.

### Named Slots by Element Type

**Tag label** (point name shown as a text label near the shape):
- `top` — centered above shape
- `right` — right of shape, vertically centered
- `bottom` — centered below shape
- `left` — left of shape, vertically centered
- `freeform` — no snap

**Alarm indicator:**
- `top-right` — upper-right corner of shape bbox, clear gap outside
- `top-left` — upper-left corner
- `bottom-right` — lower-right corner
- `bottom-left` — lower-left corner
- `freeform`

**Text readout:**
- `top` · `right` · `bottom` · `left` · `freeform`

**Analog bar:**
- `right` — standalone bar to the right of shape
- `left` — standalone bar to the left
- `vessel-interior` — Mode B, inside vessel (only available on vessel/tank/reactor/column shapes)
- `freeform`

**Fill gauge:**
- `vessel-interior` — Mode A, clipped to vessel interior (default for vessel/tank shapes)
- `right` — Mode B standalone to the right
- `left` — Mode B standalone to the left
- `freeform`

**Sparkline:**
- `right-top` *(default)* — right side of shape, upper offset (compass ENE)
- `right-bottom` — right side of shape, lower offset (compass ESE)
- `left-bottom` — left side of shape, lower offset (compass WSW)
- `left-top` — left side of shape, upper offset (compass WNW)
- `freeform`

Sparklines use near-corner offset positions rather than center-of-edge positions because their horizontal strip geometry conflicts with Point Name and Point Value at mid-edge slots. The offset slots position sparklines clear of both. There are no `top`, `bottom`, or mid-edge slots for sparklines.

**Digital status:**
- `top` · `right` · `bottom` · `left` · `freeform`

### Default Slots by Shape Category

These are the pre-wired defaults that auto-populate when a point is dragged onto a shape.

| Shape category | Alarm indicator default | Primary value default | Secondary default |
|---|---|---|---|
| Pumps, motors, HX, compressors | `top-right` | `bottom` text readout | — |
| Tall vessels, reactors | `top-right` | `bottom` text readout | `vessel-interior` fill gauge |
| Distillation columns | `top-right` | `right` text readout | `right` analog bar |
| Storage tanks | `top-right` | `bottom` text readout | `vessel-interior` fill gauge |
| Control valves, relief valves | `top-right` | `right` text readout | — |
| Gate/globe/ball/butterfly valves | `top-right` | `bottom` digital status | — |
| Instruments | `top-right` | `right` text readout | — |

---

## Designer Placement UX

### Snap Behavior

When a user drags a display element near a shape on the canvas:

1. **Ghost targets appear** at all valid named slot positions for that element type — visible as faint circles or guides
2. **The element snaps** to the nearest named slot as the cursor approaches within ~12px
3. **A tooltip label** shows the slot name (`top-right`, `vessel-interior`, etc.) while snapping
4. **Dragging past all snap zones** releases to freeform — no snapping, element stays exactly where dropped
5. **Freeform elements** show a small `⊕` indicator to distinguish them from anchored elements

### Shape Drop Dialog

When a shape is dragged from the library palette onto the canvas, a **two-step configuration dialog** always appears. The designer does not need to fill anything in — clicking through immediately drops the shape with defaults. All options are also available in the right sidebar after placement.

**Step 1 — Shape Configuration**

- **Variant picker** (visual grid or radio buttons): select the shape variant
  - Examples: *Reactor — Plain*, *Reactor — Agitator*, *Control Valve — Pneumatic Actuator*, *Control Valve — Motorized Actuator*
  - Only variants defined in the shape library for that shape type are shown
- **Add-on checkboxes**: shape-specific options the selected variant supports
  - Examples: *Fail-open indicator*, *Fail-closed indicator*, *Support legs*, *Handwheel*, *Pressure safety valve inline*
  - Checkboxes are conditional — they show only when the current variant supports them
- **Next →** advances to Step 2.
- **Use Defaults →** places the shape immediately with the default variant and no add-ons, skipping Step 2. Shape lands on canvas with no pre-attached sidecar elements.
- **Cancel** aborts the drop entirely — the shape is not placed. User can drag from the palette again.

**Step 2 — Sidecar Pre-attachment**

Step 2 shows one binding section per bindable part. For a plain shape (no composable parts), there is one section. For a control valve with a pneumatic actuator, there are two sections — one for the valve body, one for the actuator.

Each section contains:
- **Point binding field** — enter a tag now or leave blank and bind later via sidebar
- **Sidecar element checklist** — Point Name, Text Readout, Sparkline, Analog Bar, Fill Gauge, Digital Status, Alarm Indicator (only types applicable to that part are shown)
- Checked elements land at their **default slots** for that part's geometry (body slots for body, actuator local bbox slots for actuator)

**Finish** places the shape. Unchecked element types are not created but can be added anytime via sidebar or right-click. All binding fields are optional — leave everything blank to drop a bare shape and configure entirely via sidebar.

**After placement:**
- Right-click the shape → **"Shape Configuration…"** re-opens the same two-step dialog at any time
- The right sidebar shows all the same options as fields and toggles (no visual variant picker in sidebar — just dropdowns)
- Changes made after placement update the existing shape instance in place

### Initial Placement (Quick Bind)

When a point is dragged from the Point Browser onto a shape (after the shape is already on the canvas):
- A Text Readout is created at the shape's primary value default slot
- If the shape is a vessel/tank and the point is a level tag (% or engineering units indicating level), a Fill Gauge is created at `vessel-interior` instead

### Re-anchoring

After placement, the user can:
- Drag to any freeform position
- Right-click → "Snap to anchor" → pick from the named slot list
- Right-click → "Reset to default" → returns to the shape's default slot for that element type

### Multiple Elements per Shape

No limit on how many display elements are associated with a shape. Each is independent — its own point binding, its own position, its own type. A reactor might have a fill gauge inside, three text readouts (top/middle/bottom temperature), an analog bar (pressure profile), and an alarm indicator at top-right.

### Standalone Elements

Display elements can exist with no shape association at all — dragged onto empty canvas and bound to a point directly. All named slots are unavailable; element is always freeform.

---

## ISA-101 Equipment Rules

These are non-negotiable and apply to all themes without exception.

1. **Equipment outlines are always `#808080`.** This color never changes. It does not respond to alarm state. It does not theme.
2. **Equipment shapes never communicate alarm state.** A pump in a critical alarm looks identical to a pump with no alarm. All alarm communication goes through the Alarm Indicator element.
3. **Equipment shapes do change for operational state.** Running/open = green fill. Stopped/closed = transparent. Transitioning = amber. Fault = magenta. This is a separate system from alarm indication.
4. **"Gray for normal" is the governing principle.** Color on the canvas should read as "something needs attention." Gray reads as "all is well." This applies to the canvas at large — display elements follow this too (gray value text in normal state, gray digital status pills).

---

## Sidecar Placement — Fixed Anchor Slots

Each sidecar element type has a defined set of named snap slots and a default. Fixed slots are relative to the shape's bounding box — they move with the shape when it is repositioned on the canvas.

### Point Name (tag label)

Displays the point's identifier near the shape as a text label.

| Slot | Position | Notes |
|---|---|---|
| `top` *(default)* | Centered above shape, 6px gap from bbox top | |
| `right` | Right of shape, vertically centered, 6px gap | |
| `bottom` | Centered below shape, 6px gap from bbox bottom | |
| `left` | Left of shape, vertically centered, 6px gap | |

**Display options (applies to both fixed and freeform):**
- `point-name` — shows the raw tag/point ID (e.g. `FIC-101`)
- `display-name` — shows the configured human-readable label (e.g. `Feed Flow Controller`)
- `both` — shows point-name on the first line, display-name on the second line, 2px gap between

When `both` is selected, a secondary **style** option controls the visual weight of the two lines:

| Style | PointName | DisplayName | When to use |
|---|---|---|---|
| `hierarchy` *(default)* | 9px, weight 500, `--io-text-secondary` | 8px, weight 400, `--io-text-muted` | Normal use — tag ID is the primary identifier, description is supporting context |
| `uniform` | 9px, weight 400, `--io-text-muted` | 9px, weight 400, `--io-text-muted` | Dense graphics where visual uniformity matters more than hierarchy |

The `hierarchy` default matches the app's existing pattern (sidebar items, search results) where the identifier is primary and the description is subordinate.

### Point Value (text readout)

Displays the live value of a bound point with optional engineering units.

| Slot | Position | Notes |
|---|---|---|
| `top` | Centered above shape, 6px gap | |
| `right` | Right of shape, vertically centered, 6px gap | |
| `bottom` *(default)* | Centered below shape, 6px gap | |
| `left` | Left of shape, vertically centered, 6px gap | |

**Display options:**
- `with-background` *(default)* — standard Text Readout box (see Display Element 1)
- `no-background` — value text only, no box, no border. Uses same font and color rules as the readout value text; no padding box is rendered. Minimum designer hit area: **24×16px** even with no visible box.

### Alarm Indicator

| Slot | Position | Notes |
|---|---|---|
| `top-right` *(default)* | Outside top-right corner of bbox, 4px clear gap from both edges | |
| `bottom-right` | Outside bottom-right corner, 4px gap | |
| `bottom-left` | Outside bottom-left corner, 4px gap | |
| `top-left` | Outside top-left corner, 4px gap | |

Alarm indicators have no `top`/`bottom`/`left`/`right` mid-edge slots — they are corner-only. Corners prevent them from visually colliding with Point Name and Point Value at their default mid-edge positions.

### Combination Rule — Point Name + Point Value at Same Slot

When both Point Name and Point Value are assigned to the same slot, they stack vertically as a unit and are treated as one composite element for spacing/placement purposes:

```
[ Point Name    ]   ← top of stack, smaller/muted
[ Point Value   ]   ← bottom of stack, prominent
```

- 3px vertical gap between name and value
- The composite unit is centered/positioned as a whole at the slot
- The alarm indicator, if present, positions relative to the outer bbox of this composite unit

Name is always on top of Value — fixed, not configurable (reading order: what is it? then what is the reading?). At any slot including `right`, the composite always stacks vertically — Name above Value, left-aligned within the slot position.

---

## Sidecar Placement — Free Form Mode

All sidecar elements support free form placement. In free form mode, the element is not snapped to any named slot — it stays exactly where dropped. The anchor point is the element's top-left corner.

### How Free Form is Entered

- Dragging an element past all snap zones (>12px from any slot center) releases it to free form
- Right-click element → **"Free form"** also detaches from any current slot
- Right-click element → **"Snap to slot…"** → slot picker returns it to a named position

### Visual Indicator

Free form elements display a small **`○`** indicator in their top-left corner in the designer (invisible on the live canvas). This distinguishes them from anchored elements at a glance.

### Point Name — Free Form Appearance in Designer

- Renders as a plain text label directly on the canvas with no box
- Text is selectable and shows a resize handle for width (wraps to next line if wider than handle)
- A single blue dot (accent color) shows the element's anchor point — clicking and dragging this dot moves the label
- Label text is editable in-place (double-click) in free form mode — **this only changes the designer display, not the point binding**

### Point Value — Free Form Appearance in Designer

- Renders with its live data format: a sample/placeholder value appropriate to the point type
  - Analog: `—.—` (em-dash placeholder in correct digit width)
  - Digital: shows the first configured state label (e.g. `STOP`)
  - Calculated: `—.—`
- Background toggle applies: `with-background` shows the readout box; `no-background` shows text only
- A blue anchor dot in the corner is the drag handle

### Alarm Indicator — Free Form Appearance in Designer

- Always rendered in designer regardless of live alarm state (so the user can see and position it)
- Shown as the **disabled state visual** — dashed gray rectangle 24×18px, `--io-text-muted` stroke, `—` inside
- This is independent of what priority the actual alarm is — the designer ghost is always this neutral form
- On the live canvas it is hidden when no alarm is active (see Display Element 5)
- Designer ghost is always the **dashed gray rectangle** form regardless of actual alarm priority — avoids implying a specific priority before the alarm fires

---

## Analog Bar & Fill Gauge — Floating Positions

When an Analog Bar or Fill Gauge is placed outside the vessel (floating), it can be placed at any of 8 named positions relative to the shape. Each position has a horizontal or vertical orientation.

### 8 Floating Positions

| Slot | Orientation | Bar direction | Notes |
|---|---|---|---|
| `top-vertical` | Vertical | Upward from shape top | Bar runs from shape top edge upward |
| `top-horizontal` | Horizontal | Left-to-right above shape | Bar runs horizontally above shape |
| `right-vertical` *(default)* | Vertical | Upward, right of shape | Most common; matches natural reading of level/value |
| `right-horizontal` | Horizontal | Left-to-right, right of shape | Bar runs horizontally to the right |
| `bottom-vertical` | Vertical | Upward from shape bottom | Bar runs from shape bottom downward |
| `bottom-horizontal` | Horizontal | Left-to-right below shape | Bar runs horizontally below shape |
| `left-vertical` | Vertical | Upward, left of shape | |
| `left-horizontal` | Horizontal | Left-to-right, left of shape | |

Gap between shape bbox edge and bar: 8px.

For **vertical** bars: zone order top→bottom is HH → H → Normal → L → LL. Bar pointer moves up with increasing value.

For **horizontal** bars: zone order left→right is LL → L → Normal → H → HH. Bar pointer moves right with increasing value. This direction is non-configurable.

### 2 Inside Positions (vessel shapes only)

| Slot | Description |
|---|---|
| `inside-vertical` | Bar runs vertically within the vessel interior, clipped to vessel outline |
| `inside-horizontal` | Bar runs horizontally within the vessel interior, clipped to vessel outline |

Inside placement uses the same `<clipPath>` mechanism as Fill Gauge Mode 1. The bar is centered within the interior by default.

`inside-vertical` is the natural default for tall vessels (reactor, column, vertical tank). `inside-horizontal` is the natural default for horizontal vessels (horizontal separator, horizontal tank). Both options are always available — the designer pre-selects the likely-correct default based on shape orientation but the user can override.

**Relationship to Named Slots:** In the Named Slots section, Analog Bar lists `vessel-interior` as a slot. This refers to either `inside-vertical` or `inside-horizontal` — the orientation is a sub-option configured in the element panel, not a separate named slot. `vessel-interior` in that context means "placed inside the vessel body." Fill Gauge uses the same convention.

### Fill Gauge — Mode 1 (Rounded Vessel) Specifics

For vessels with curved/elliptical heads (reactors, spheres, capsules, distillation columns):

- The fill rectangle spans the **full interior including curved heads** but is clipped by the vessel's `<clipPath>`
- At low fill levels: the fill only covers the straight cylindrical section and partially enters the bottom head — it is NOT artificially blocked at the tangent line
- At high fill levels: fill enters the top head, visually rounding off at the top
- This produces a physically accurate "liquid in a vessel" look without requiring separate geometry per fill level
- At 100% fill: the vessel outline stroke is always drawn **above** the fill layer — the top head curve remains visible. The fill reaches the very top via clipPath but the vessel outline is not obscured.

### Free Form Floating

An Analog Bar or Fill Gauge can also be placed in free form mode (same rules as other elements — drag past snap zones). In free form:

- User can choose `vertical` or `horizontal` orientation via right-click → **"Rotate"**
- No association with a shape bounding box — element is fully independent
- Useful for placing a standalone bar on empty canvas tied to a point with no associated shape

---

## Digital Status Box

The Digital Status Box (Display Element 6) shows a discrete/binary point state as a labeled pill. In the sidecar placement context:

### Fixed Slots

Same 4 positions as Point Value: `top`, `right`, `bottom` *(default)*, `left`.

### Display Options

- **Label text:** The text shown in the pill comes from the point's configured state map (e.g. `RUN` / `STOP`, `OPEN` / `CLOSED`, `AUTO` / `MAN`). This is configured on the point, not on the display element.
- **Width mode:**
  - `auto` *(default)* — pill sizes to fit the longest state label
  - `fixed` — user sets a fixed width; shorter labels are centered within it
- **Show label above:** Toggle to show the tag/display name above the pill (same as Point Name `bottom` slot, visually stacked)

Fixed-width mode is included in v1 — useful for aligning a column of status boxes (e.g., a row of pumps). All states (not just abnormal) have a configurable color; "normal" states are configured by the user per point.

---

## Designer Configuration UI

### How the Panel is Opened

Selecting any shape or sidecar element on the canvas opens a dedicated **"Display Elements" panel in the right sidebar** (Option A). Additionally, hovering a shape reveals ghost `+` circles at empty named slots — clicking one opens a small popover to add an element at that specific slot (Option C inline handles). Option B (floating modal) was rejected as it blocks the canvas.

### What the Sidebar Panel Contains

When a shape is selected, the Display Elements panel shows:

```
─ Display Elements ──────────────────────
  Point: [FIC-101 ▾]          [+ Add]

  ┌─ Point Name ──────────────────────┐
  │  Slot: [Bottom ▾]                 │
  │  Show: [Point Name ▾]             │
  └───────────────────────────────────┘

  ┌─ Point Value ─────────────────────┐
  │  Slot: [Bottom ▾]                 │
  │  Background: [On ▾]               │
  └───────────────────────────────────┘

  ┌─ Alarm Indicator ─────────────────┐
  │  Slot: [Top-Right ▾]              │
  └───────────────────────────────────┘

  ┌─ Analog Bar ──────────────────────┐
  │  Position: [Right Vertical ▾]     │
  │  [Remove]                         │
  └───────────────────────────────────┘
─────────────────────────────────────────
```

- The point dropdown is the binding — one panel section per bound point
- Multiple points can be bound to the same shape; the panel shows one section per point
- "Add" button opens a point-picker that searches available points
- Each element type section shows only the options relevant to that type
- Clicking a sidecar element (not the shape body) always shows the **full shape panel** and scrolls to that element's section — the panel never switches to a single-element view. This prevents the panel from jumping context unexpectedly.

### How Elements are Added

1. **Drag from Point Browser** → drop onto shape → creates a Point Value (text readout) at the default slot, and an Alarm Indicator at `top-right`. Point Name is not auto-created (optional, user adds manually).
2. **"Add element" button** in the sidebar panel → opens element type picker → user chooses what to add → default slot is pre-selected but user can change
3. **Slot `+` handle**: hovering a shape shows ghost `+` circles at empty named slots. Clicking one opens a small popover: "What to add here?" with element type choices.

Point Name is **not** auto-created when dragging a point onto a shape — it is optional. The tag ID is always visible in the sidebar panel. Users who want a canvas label add it explicitly.

### Hiding vs. Removing Elements

These are distinct operations:

**Hide** (recoverable):
- Press `Delete` when a sidecar element is focused (selected by direct click)
- Right-click → **"Hide"** in the context menu
- Element becomes invisible on live canvas and in the designer, but is not deleted
- In the designer, hidden elements show as **faint ghosts** at their position — visible and clickable to unhide directly on canvas
- The sidebar panel shows a grayed-out row with an eye icon toggle to unhide

**Remove** (permanent):
- Click **[Remove]** in the sidebar panel section for that element
- Right-click → **"Remove"** in the context menu (distinct from Hide — both are present)
- The element is deleted from the shape's sidecar element list
- Removing a Point Value does not automatically remove the Alarm Indicator (they are independent)
- Undo-able within the 50-action undo stack

**Remove all for a point (batch):**
- The sidebar panel's point section header includes a **"Remove all"** button — one click removes all display elements for that specific point binding
- Single undoable action — one `Ctrl+Z` restores all elements for that point
- Does not affect elements bound to other points on the same shape
- Not available in the right-click context menu (too easy to fat-finger) — sidebar only

**Shape deletion:**
- Deleting the parent shape from the canvas removes the shape and **all attached sidecar elements as a group**
- Single undoable action — one `Ctrl+Z` restores the shape and all its elements at their previous positions and bindings
- This applies to both `Delete` key on a selected shape and **"Remove"** via right-click or sidebar (shapes follow the same Hide/Remove distinction as elements — `Delete` key hides the shape, **"Remove"** is permanent)

---

## Value Formatting & Display States

These rules apply to any sidecar element that shows a live point value (Text Readout, Sparkline, Analog Bar pointer position, Fill Gauge level, Digital Status).

### Precision & Format

- Format is a printf-style format string configured **per point**, not per display element. All display elements bound to the same point use the same format string.
- Default: `%.1f` (one decimal place)
- Engineering units are shown inline after the value: `23.4 °C`. One space between value and units.
- Units are sourced from the point definition — the display element has no units override.

Per-element format override is **not supported** — all display elements bound to a point use the point's configured format string. Revisit if layout conflicts become common in practice.

### Stale Data

A point is stale when no update has been received within the staleness threshold (default 60s, per-source configurable). When stale:

- Value text color changes to `--io-text-stale` (Dark: `#636363` · Light: `#9CA3AF` · HP HMI: `#475569`)
- A small **clock icon** (⏱) appears to the right of the value, 7px gap, same `--io-text-stale` color. **Additive** — both the color change and the clock icon appear together, not in place of each other. **Icon size is relative to the configured font size** (`1em`) — if the designer sets the readout to 16px, the icon scales to 16px. Implementation must not hard-code a fixed pixel size for this icon.
- **Stale + unacknowledged alarm:** The alarm border and background tint continue flashing 1Hz until acknowledged (unchanged). The stale clock icon (⏱) stays **steady** — it does not flash with the border. Consistent with the rule that text-area content never flashes. The Bad Phase 1 warning triangle (⚠) follows the same rule: steady, even during an unacknowledged alarm flash.
- Applies to: Text Readout value text, Digital Status label text, Analog Bar pointer
- Sparkline: line color changes to `--io-text-stale`, regardless of alarm state
- Fill Gauge: fill opacity reduces to stale level — Dark: 30% · HPHMI: 20% · Light: 15%. This maintains a visible delta from normal opacity in each theme (Dark: 60%→30%, HPHMI: 50%→20%, Light: 45%→15%).
- Alarm Indicator: **not affected** — alarm state is independent of data freshness

Stale token values (resolved): Dark `#636363` · Light `#9CA3AF` · HP HMI `#475569`.

### OPC Data Quality — Bad

OPC UA returns three quality levels: Good, Uncertain, Bad. Stale (no update for 60s) and Bad (server actively reporting the value as invalid) are distinct conditions requiring different operator responses.

| Phase | Trigger | Display | Duration |
|---|---|---|---|
| **Onset debounce** | Bad quality first detected | No visual change | 0–3s of sustained Bad |
| **Phase 1 — Last good + warning** | 3s of sustained Bad | Last known value in `--io-text-stale` color + ⚠ warning triangle icon right of value (7px gap, same color, `1em` size — scales with configured font size). Same visual treatment as Stale but with a warning triangle instead of the clock icon. | Up to 30s |
| **Phase 2 — BAD** | Bad persists beyond 30s | `BAD` text in place of value, `--io-text-muted` color, no icon | Until quality recovers |
| **Recovery debounce** | Good quality returns | Maintain Bad display | 5s of sustained Good before clearing |

**Rationale for phase 1:** The last known value provides operational context — "it was reading 142.3 when the transmitter faulted" is useful information. Phase 1 preserves it briefly while making clear something is wrong.

**Rationale for phase 2:** After 30s, displaying a potentially incorrect value (even flagged) creates a process safety hazard. `BAD` makes the situation unambiguous.

**Debounce rationale:** A flaky sensor toggling Bad/Good at 1Hz would otherwise cause the display to flicker. Onset and recovery debounces smooth this. The 3s/5s values are global settings, not per-element.

**Distinct from Stale:**
- Stale = clock icon (⏱), `--io-text-stale` — communication loss
- Bad Phase 1 = warning triangle (⚠), `--io-text-stale` — transmitter fault, last value shown
- Bad Phase 2 = `BAD`, `--io-text-muted` — transmitter fault, value not displayable
- N/C = `N/C`, `--io-text-muted` — tag not found / permission denied

**Stale + Bad simultaneously:** If a point is both stale (no update for 60s) and Bad quality, Bad quality takes priority. The Bad Phase 1/Phase 2 timing runs on the Bad onset timer (3s onset, 30s Phase 1). The stale clock icon (⏱) does not appear — the ⚠ icon subsumes that role. Bad quality is an explicit server signal and is the more actionable of the two conditions.

**Uncertain quality:** Displayed as normal — no special treatment in v1. OPC UA Uncertain is a wide category; implementing distinct treatment requires point-category context that is not reliably available.

### OPC Bad Quality — Digital Status

Same onset/recovery debounce and phase timing as Text Readout (3s onset, 30s Phase 1 duration, 5s recovery).

| Phase | Display |
|---|---|
| Normal | Pill shows current state label, gray background, normal text color |
| Bad Phase 1 (3s–30s) | Last known state label in `--io-text-stale` color. ⚠ warning triangle icon to the right of the pill (7px gap, 1em, same `--io-text-stale` color). Pill background stays gray (inactive background — not promoted to active state color). |
| Bad Phase 2 (30s+) | Pill shows `BAD` in `--io-text-muted`, gray background. State label not shown. |
| Recovery | Maintain Bad display for 5s of sustained Good before clearing. |

### OPC Bad Quality — Analog Bar and Fill Gauge

Same onset/recovery debounce and phase timing as Text Readout (3s onset, 30s Phase 1 duration, 5s recovery).

**Visual degradation hierarchy (intentionally distinct at each level):**

| State | Analog Bar | Fill Gauge |
|---|---|---|
| Normal | Pointer `--io-text-secondary`, full opacity | Fill `--io-fill-normal` at theme opacity |
| Stale (60s no update) | Pointer `--io-text-stale` + ⏱ icon | Fill at stale opacity (Dark: 30% · HPHMI: 20% · Light: 15%) + ⏱ icon |
| Bad Phase 1 (3s–30s) | Pointer `--io-text-stale` + diagonal hatch pattern overlay + ⚠ icon. Setpoint marker hidden. | Fill at stale opacity (Dark: 30% · HPHMI: 20% · Light: 15%) + diagonal hatch pattern overlaid on fill area + ⚠ icon |
| Bad Phase 2 (30s+) | Pointer hidden entirely. Setpoint marker hidden. `BAD` text centered on bar in `--io-text-muted`. Zone bands remain visible. | Fill frozen at last good level, opacity ~15%. `BAD` text overlaid centered on fill area in `--io-text-muted`. Fill never drops to 0% — zero is a valid process reading. |

**Hatch pattern spec (Bad Phase 1):**
- SVG `<pattern>` element, `patternUnits="userSpaceOnUse"`, 4×4px tile
- Diagonal line: `x1="0" y1="4" x2="4" y2="0"`, stroke `--io-text-stale`, stroke-width 0.8px
- Applied as `fill="url(#bad-phase1-hatch)"` overlaid on the pointer fill or fill gauge fill area
- Pattern is additive — rendered on top of the existing stale color/opacity, not replacing it

**Why not hatch for regular stale:** Regular stale (opacity reduction + clock icon) and Bad Phase 1 (opacity + hatch + ⚠) must read as visually distinct. Reserving the hatch for Bad quality gives operators a clear three-level degradation signal: dimmed → dimmed+textured → value gone.

### Unresolved / Unbound Point (N/C)

When a display element has a point binding configured but the point ID cannot be resolved (tag doesn't exist, permission denied, point deleted):

- Value area shows `N/C` (not connected) in `--io-text-muted`
- Tag name shown with a dashed underline in `--io-text-muted`
- No alarm indicator shown
- No stale icon — N/C is a configuration problem, not a data freshness problem
- In the designer: the element renders normally with `N/C` placeholder — not treated as an error

### Offline / No Data (before first value arrives)

On initial load before the first value has been received (point resolved but no data yet):

- Text Readout shows `—.—` (em-dashes matching configured decimal places) followed by engineering units in `--io-text-muted` — e.g. `—.— %`, `—.— °F`. Units always shown in placeholder to pre-size the box and prevent layout shift when first real value arrives. Never show `0.00` — zero is a meaningful process value and must not appear before data is confirmed.
- Digital Status shows the first configured state label in the gray normal style
- Sparkline shows a flat line at the vertical midpoint, `--io-text-muted` color
- Analog Bar pointer is not drawn; zones visible
- Fill Gauge fill height is zero (empty vessel appearance)

### Out-of-Range Values

When a value falls outside the configured range (below range_lo or above range_hi):

- **Analog Bar:** Pointer clamps to the top or bottom edge of the bar. The topmost or bottommost zone fills with 50% opacity in the active alarm color. No overflow beyond bar bounds.
- **Fill Gauge:** Fill clamps at 100% (full vessel) for above-range, 0% (empty) for below-range. No visual overflow outside the vessel.
- **Text Readout:** Value displayed as-is (not clamped). The raw number is shown even if it is outside the expected range.

### Value Update Animation

When the WebSocket pushes a new value to a Text Readout or Digital Status pill, a brief visual signal indicates the update.

**Default behavior:** The readout box background flashes once to a brighter version of `--io-surface-elevated` for ~150ms, then returns to normal.

**Configurable per element:** The graphic designer can toggle this per-element in the sidebar panel. Default is **on**. Operators on busy graphics can disable it per-element to reduce visual noise at high update rates.

**Flash cooldown:** After a flash, the element will not flash again for **2 seconds** regardless of how many updates arrive. This prevents constant shimmer on 1Hz+ points while still signaling movement on slower-changing values.

**Elements affected:** Text Readout, Digital Status pill. Sparkline, Analog Bar, and Fill Gauge update visually in place with no flash (continuous/smooth update).

**Not a replacement for sparklines:** The sparkline is the primary signal for "this value is actively changing." The update flash is a secondary, momentary attention cue.

**Alarm state interaction:** The update flash is **suppressed** when the element is in any active alarm state (P1–P4, Shelved, Custom). The alarm border and tint are already a prominent attention signal; flashing on top is redundant. The flash resumes normally once the alarm clears.

**Implementation note:** The 2-second cooldown is tracked per-element instance in the frontend display layer. It does not affect the underlying data update rate — the element still receives all updates, just doesn't flash on every one.

### Value-in-Zone (Analog Bar zone activation)

When the live value is within a zone (HH, H, L, LL):

- That zone's fill color transitions to the full alarm priority color at **50% opacity** overlaid on the zone's normal muted ramp color
- This is a visual indicator that the value is in that region — it is independent of whether an alarm is actually active
- If the alarm IS active, the Alarm Indicator element also activates separately
- The two visuals (zone activation + alarm indicator) are complementary, not redundant: zone shows **where** the value is; alarm indicator shows **what action is required**

---

## Scale & Zoom Behavior

### Sidecar Elements Scale With Their Shape

Sidecar elements exist in the same coordinate space as their parent shape (SymbolInstance space). When a shape is scaled up or down in the designer, all attached sidecar elements scale proportionally with it.

This means:
- The 6px gap between bbox edge and element slot is in shape-space, not screen-space — at 2× scale, the gap appears 12px on screen
- Text sizes defined in this spec are at **1:1 canvas scale (100% zoom)**. At other scales, text will appear larger or smaller

Text in sidecar elements has a **minimum screen size of 7px** on the live canvas — text does not scale below 7px regardless of canvas zoom level. This clamping is live-canvas only; in the designer, text scales normally so the designer can work accurately at any zoom.

### Level of Detail (LOD) — Live Canvas Only

At very low zoom levels (canvas at <25% zoom), sidecar text elements (Point Name labels, Text Readout values) are hidden entirely to prevent visual noise and maintain performance. The shape and Alarm Indicator remain visible at all zoom levels.

LOD thresholds (suggested — confirm during implementation):

| Zoom level | Point Name label | Text Readout | Sparkline | Analog Bar | Fill Gauge | Alarm Indicator |
|---|---|---|---|---|---|---|
| ≥50% | Visible | Visible | Visible | Visible | Visible | Always visible |
| 25–50% | Hidden | Visible (value only, no label) | Hidden | Visible | Visible | Always visible |
| <25% | Hidden | Hidden | Hidden | Hidden | Fill only (no pointer/label) | Always visible |

> **Note — LOD thresholds:** These zoom percentages are placeholder estimates. Tune during implementation based on actual screen pixel density and user feedback.

### LOD Override — Per Element

Each sidecar element has an **"Always visible"** toggle in the sidebar panel. When on, that element ignores all LOD thresholds and remains visible at any zoom level. This is set by the graphic designer, not the operator. Use case: a critical readout on a control room wallboard that must always show regardless of zoom.

### LOD Active Indicator

When LOD is actively hiding one or more elements on the live canvas, a small **pill chip** appears in the **bottom-right corner of the canvas viewport**:

- Label: `LOD` (or a layers/zoom icon)
- Style: `--io-text-muted` text on `--io-surface-secondary` background, 1px `--io-border` border, `border-radius: 4px`, padding `3px 8px`
- **Auto-hides** when nothing is being hidden by LOD (zoom above threshold, or global LOD toggle is on)
- **Clicking the chip** shows a brief tooltip: *"Some labels are hidden at this zoom level. Use the LOD toggle in the top bar to show all."*
- Non-intrusive — positioned in the corner so it does not overlap graphic content

### Alarm Override — LOD Interaction

When a point has an active alarm:
- The **Alarm Indicator** remains visible at all zoom levels (existing rule — unchanged)
- **Text Readout, Point Name, Sparkline** remain subject to normal LOD thresholds — they are not forced visible
- Hovering the Alarm Indicator at any zoom level shows the standard hover tooltip (tag name, current value at full precision, alarm state, last update timestamp). This gives the operator value context without forcing text elements visible at low zoom.
- Clicking (or long pressing on touch) opens the Point Context Menu as normal

This keeps the canvas clean at low zoom while ensuring alarm value context is always one hover away.

### Global LOD Toggle — Console and Process Modules

Both the Console and Process module top bars include a **LOD toggle button**. When activated:
- All LOD thresholds are disabled for the current workspace
- All sidecar text elements (Point Name, Text Readout, Sparkline labels) are visible regardless of zoom level
- The toggle state **persists per workspace** — saved to the workspace layout, survives navigation and shift changes
- The LOD active indicator (above) is suppressed when the global toggle is on (nothing is being hidden)

Use case: operator zooms out to get a whole-unit view and wants to keep all labels visible. Or a control room supervisor wants to see everything on a large display without the LOD system hiding context.

### Freeform Element Position Storage

Freeform element positions are stored **relative to their parent shape's origin**, not as absolute canvas coordinates. Consequence: when a shape is moved on the canvas, all attached freeform elements move with it.

This is non-negotiable for usability — absolute coordinates would break every graphic when shapes are repositioned.

---

## Operator Interaction — Live Canvas

These behaviors apply on the live canvas (Console and Process modules), not in the designer.

### Hover Tooltip

Hovering over any point-bound sidecar element shows a tooltip containing:

- Tag name (full, untruncated)
- Display name / description
- Current value at full precision (ignoring format string — all digits shown)
- Engineering units
- Data quality (Good / Uncertain / Bad)
- Alarm state (or "No alarm")
- Last update timestamp

Tooltip appears after 400ms hover delay. Dismisses on mouse move.

### Right-Click — Point Context Menu

Right-clicking any point-bound sidecar element opens the **Point Context Menu** (see doc 32 for the full context menu spec). Relevant actions for sidecar elements:

| Action | Result |
|---|---|
| Point Detail | Opens a floating, draggable, resizable detail window for this point. Up to 3 can be open simultaneously. Keyboard shortcut: `Ctrl+I`. |
| Trend Point | Opens a trend view for this point in a new pane or the Forensics module |
| Investigate Point | Opens the Forensics module scoped to this point |
| Report on Point | Opens a pre-filtered report for this point |
| Investigate Alarm | Opens alarm history for this point (grayed out if no active/recent alarm) |

### Touch / Mobile Interaction — Live Canvas

On touch devices (tablet in control room, mobile in field), right-click is not available. The equivalent interaction model:

- **Long press (500ms)** on any point-bound sidecar element opens the Point Context Menu — same menu as desktop right-click
- Touch target: **60px minimum** per Doc 20 (gloved operation). The sidecar element's hit area is padded to meet this target even if the visible element is smaller
- All Point Context Menu actions (Point Detail, Trend Point, Investigate, etc.) are accessible from long press
- This is consistent with the long-press-as-right-click pattern established across the rest of the app (Doc 20)

Applies to: Console and Process modules on PWA touch clients.

### Click Behavior

- **Single click** on a sidecar element: selects it (designer only — no selection state on live canvas)
- **On live canvas**, single click on a sidecar element has no effect — right-click (desktop) or long press (touch) is the interaction
- **On live canvas**, clicking a Digital Status pill that is in an abnormal state does nothing by default

Clicking an Alarm Indicator on the live canvas does **not** trigger acknowledgment — ack is through the Alerts module only. Click-to-ack is too risky on touch screens (accidental taps). Revisit in v2 if operators request it.

### Alarm Indicator — Multiple Active Alarms

A point can have multiple alarm thresholds configured. When more than one is simultaneously active:

- The Alarm Indicator shows the **highest active priority** (lowest number)
- A small **count badge** in the lower-right corner of the indicator shape shows the total active alarm count (e.g., `3`) when count > 1
- Badge: 12×12px circle, same alarm color fill, white number, JetBrains Mono 8px weight 700

> **Note — count badge:** At small indicator sizes (20-24px shape), a 12px corner badge may overlap the priority number. Alternative: `1↑` style inside the indicator. Decide during visual testing.

### Multiple Points on One Shape — Alarm Indicator Collision

When multiple points are bound to the same shape and multiple alarm indicators share the same slot (e.g., two points both default to `top-right`):

- Indicators **tile** from the anchor point — they line up horizontally or vertically (designer chooses direction based on available space) so none overlap
- No automatic priority collapsing — each point's indicator remains independently visible
- User can override by snapping each indicator to a different slot, snapping to a neighboring element, or dragging to freeform

### Association Highlight — Designer

When you click any sidecar element in the designer, all elements bound to the **same point** get a subtle brightness boost. Elements bound to other points dim slightly.

- Click a Text Readout → its alarm indicator and point name label brighten; other bound points' elements recede
- Click an Alarm Indicator → its associated readout and name brighten
- This "belongs together" visual feedback is designer-only — no equivalent on live canvas
- Clicking the shape body (not a sidecar element) clears the highlight and shows all elements at equal weight

---

## Designer Behavior — Additional Detail

### Copy / Paste

Copying a shape instance copies all attached sidecar elements with it, including:
- Element type and position (slot or freeform coordinates, relative to shape)
- Point binding
- Display options (background toggle, name display mode, etc.)

The paste creates a complete duplicate. Point bindings are preserved. The user is expected to rebind pasted elements to different points if needed — there is no "paste and clear bindings" variant in v1.

A **"Paste layout only (clear bindings)"** option is deferred to v2. In v1, paste preserves bindings and the user rebinds each copy manually.

### Undo / Redo

All sidecar element actions (add, remove, move, change slot, change display option, rebind) are part of the designer's undo stack. Depth: 50 actions (matches the global designer undo depth).

### Analog Bar Zone Proportions

Zones in the analog bar are displayed **proportionally to the configured threshold values**, not as equal fifths. Example:

- Range: 0–200°C. HH=190, H=180, L=20, LL=10
- HH zone: 190–200 = 5% of bar height (very thin strip at top)
- H zone: 180–190 = 5%
- Normal zone: 20–180 = 80% (dominant)
- L zone: 10–20 = 5%
- LL zone: 0–10 = 5%

The bar visually reflects the actual operating window — a process running near the middle of a wide normal band looks different from one running near its limits. This is intentional and ISA-101 aligned.

Minimum zone height: **4px on screen** at 1:1 scale. If a zone is thinner than 4px at the rendered bar height, the zone label is suppressed for that zone (the color band remains).

> **Note — minimum zone height:** 4px is the starting value. At a standard bar height of 120px and a 1% zone (1.2px rendered), the label is suppressed and only the color band remains. Tune the floor value during implementation if needed.

### Shape Bounding Box for Slot Calculation

**Shape body:** The bounding box used for slot positioning is the **tight SVG path bounding box** of the shape's body elements only (`io-shape-body` group). This is the bbox for all sidecar elements bound to the body's point.

Example: a control valve body bound to `FIC-101`. The bbox is calculated from the valve bowtie only. The text readout `bottom` slot is 6px below the bowtie's bottom edge. The alarm indicator `top-right` is at the bowtie's top-right corner.

**Composable parts (actuators, supports, agitators):** Each composable part has its **own local bounding box** (`io-shape-part-{name}` group) for slot calculation. Sidecar elements bound to a part's point use that part's local bbox — not the body bbox.

Example: a pneumatic actuator bound to `FIC-201` (position feedback). The actuator's alarm indicator defaults to `top-right` of the actuator dome's own bbox — positioned near the actuator geometry, not near the valve body below it. The actuator's text readout `right` slot is 6px right of the actuator's own right edge.

This means:
- Body point (`FIC-101`) → sidecar elements reference body bbox
- Actuator point (`FIC-201`) → sidecar elements reference actuator local bbox
- Both indicator sets are independently movable and can be snapped to any slot or freeform

**Collision handling when multiple points share a slot:** Same tile-from-anchor rule as the multi-point collision rule above. If the body's indicator and the actuator's indicator would both land at `top-right` of their respective bboxes and those bboxes overlap, the collision rule tiles them. In practice, actuator bboxes are above the body bbox so their default slots don't collide.

**Dual-body bindings (Shell & Tube Heat Exchanger):** The Shell & Tube HX has two binding sections (shell side + tube side) but these are both body-level bindings — there is no separate composable part geometry. Both shell-side and tube-side points use the **full HX body bbox** for slot calculation. Sidecar elements for both points share the same named slots. If indicators from both points land at the same slot, the standard tile-from-anchor collision rule applies. Operators can reposition elements to freeform to place them near the physical side of the exchanger they represent.

**Composable part CSS group naming convention:**

The `io-shape-part-{name}` SVG group class used for local bbox calculation follows this convention:

| Part catalog ID | SVG file | CSS group class |
|---|---|---|
| `actuator-diaphragm` | `part-actuator-diaphragm.svg` | `io-shape-part-actuator-diaphragm` |
| `actuator-motor` | `part-actuator-motor.svg` | `io-shape-part-actuator-motor` |
| `actuator-solenoid` | `part-actuator-solenoid.svg` | `io-shape-part-actuator-solenoid` |
| `agitator-turbine` | `agitator-turbine.svg` | `io-shape-part-agitator-turbine` |
| `agitator-propeller` | `agitator-propeller.svg` | `io-shape-part-agitator-propeller` |
| `agitator-anchor` | `agitator-anchor.svg` | `io-shape-part-agitator-anchor` |
| `agitator-paddle` | `agitator-paddle.svg` | `io-shape-part-agitator-paddle` |
| `agitator-helical` | `agitator-helical.svg` | `io-shape-part-agitator-helical` |

Support parts (skirt, legs, saddles) do not have their own binding sections and therefore do not need an `io-shape-part-*` group for bbox purposes — they are geometry only.

---

## Designer Keyboard Behavior

### Selection Model

**Shape click:** Shape is selected. The sidebar panel opens showing all sections including all sidecar elements for that shape.

**Direct sidecar element click:** Same selection state — shape is still the selected entity. The sidebar panel opens (or stays open) and scrolls/jumps to that element's section.

**Rubber-band drag over shape body:** Shape is selected, sidecar elements come along.

**Rubber-band drag over sidecar elements only (not the shape body):** Those elements' panel sections are focused in the sidebar — same as clicking them directly.

### Keyboard Shortcuts

| Key | Focused selection | Action |
|---|---|---|
| `Delete` | Sidecar element | **Hide** the element (recoverable — see Hiding vs. Removing) |
| `Escape` | Sidecar element or shape | Deselect everything, clear sidebar selection state |
| `Arrow keys` | Sidecar element | Nudge 1px per press, 10px with Shift |
| `Ctrl+Z` / `Ctrl+Y` | Any | Undo/Redo last action (data/position changes; does not restore selection state) |

**Auto-freeform promotion from anchored state:** Any deliberate repositioning — arrow key nudge or mouse drag — automatically promotes an anchored element to freeform at its current position. No separate "detach from anchor" step.

### Element Rotation

Text-based sidecar elements (Point Name, Point Value) can be rotated.

- **Right-click → Rotate** offers 90° / 180° / 270° quick snaps
- A **free rotation handle** appears on selection for any angle
- Same pattern as shape rotation in the designer

### Rubber-Band Drag Select

Drag-selecting only covers whole sidecar elements, not partial element regions. Elements are selected by their bounding box centroid (point inside the selection rectangle).

---

## Sidecar Element — Right-Click Context Menu (Designer)

Right-clicking a sidecar element in the designer shows:

| # | Item | Action |
|---|---|---|
| 1 | Snap to slot… | Opens slot picker — choose a named anchor slot |
| 2 | Snap to element… | Opens element picker — choose another sidecar element on this shape as the snap target, then choose relative position (left, right, above, below) with an auto-calculated gap |
| 3 | Hide | Sets element to hidden state (ghost visible in designer, invisible on live canvas) |
| 4 | Remove | Permanently deletes the element — both Hide and Remove are present with clear visual distinction |
| 5 | Copy element | Copies this element — can be pasted onto another shape |
| 6 | Edit binding | Opens the point picker in the sidebar panel |
| 7 | Move to layer… | Opens layer picker — moves this element to a different canvas layer |

**Snap to element gap:** Automatic — calculated based on the elements involved. User adjusts by drag or arrow-nudge if needed. No configuration field.

---

## Point Binding — Rebind Behavior

When a user changes the point binding on an existing display element (via the sidebar dropdown or "Edit binding" context menu item):

- The element **stays at its current slot or freeform position** — only the data source changes
- Display options (font, decimal places, background mode, etc.) are also preserved
- The element immediately starts showing data from the new point
- If the new point has no data yet, the element shows the offline placeholder (`—.—` or first state label)

Position is not reset on rebind. If the user wants a different position, they move it separately.

---

## Point Binding — Expression Support

Any field that accepts a point binding also accepts an **expression** from the Expression Builder. This allows:

- Unit conversion: `TI-101 * 9/5 + 32` (°C to °F)
- Averaging: `(TI-101 + TI-102) / 2`
- String manipulation on discrete values
- Derived calculated values with no equivalent raw tag

When an expression is active, the binding field shows a small **`ƒ`** indicator instead of a tag name. Clicking the indicator opens the Expression Builder for that field.

---

## .iographic Export — Point Bindings

When a shape (or whole graphic) is exported to `.iographic`, point bindings on sidecar elements are handled by a user checkbox at export time: **"Include point bindings."** The same checkbox is available at import.

**Binding format:** Human-readable PointName only — **never a UUID.** Example: `24-AI-0101`, not `b3f1c2d4-...`.

**Import behavior:**
- If "Import point bindings" is checked and the receiving system has a point named `24-AI-0101`, it wires up automatically.
- If the point does not exist in the receiving system, the element shows `N/C` with the tag name visible — the user sees exactly which tag needs to be created or remapped.

---

All decisions in this table have been resolved. Items marked ~~strikethrough~~ in the Topic column are fully decided and written into the spec. Items 25 and 28 have resolutions but are tuned during implementation/visual testing.

| # | Topic | Question | Resolution |
|---|---|---|---|
| 1 | ~~Point Name "both" — typography hierarchy~~ | ~~Hierarchy vs uniform~~ | **Resolved:** `hierarchy` default (PointName 9px/500/secondary, DisplayName 8px/400/muted); user-selectable `uniform` option |
| 2 | ~~Point Name "both" — layout sizes~~ | ~~Font size split and gap~~ | **Resolved:** per decision 1 |
| 3 | ~~Name+Value same slot — composite layout direction~~ | ~~When stacked at `right`, stack vertically or horizontally?~~ | **Resolved:** Always vertical |
| 4 | ~~Name always on top in composite~~ | ~~Configurable or fixed?~~ | **Resolved:** Fixed — Name always above Value |
| 5 | ~~Point Value no-background hit area~~ | ~~Minimum hit target in designer with no visible box?~~ | **Resolved:** 24×16px minimum |
| 6 | ~~Point Value placeholder format~~ | ~~Show units alongside em-dash placeholder?~~ | **Resolved:** `—.— %` format — em-dashes matching decimal places + units always shown. Never zeros. |
| 7 | ~~Per-element format override~~ | ~~Allow display element to override point's printf format string?~~ | **Resolved:** No — point format is used everywhere |
| 8 | ~~Free form visual indicator~~ | ~~`○` vs `⊕` vs dashed border?~~ | **Resolved:** `○` in top-left corner |
| 9 | ~~Alarm indicator designer ghost shape~~ | ~~Always dashed rectangle, or muted version of actual alarm shape?~~ | **Resolved:** Always dashed rectangle |
| 10 | ~~Horizontal bar zone order~~ | ~~Left=LL to right=HH? Configurable?~~ | **Resolved:** Left=LL, right=HH, non-configurable |
| 11 | ~~Inside position availability~~ | ~~Both inside-vertical and inside-horizontal always shown, or filtered by vessel orientation?~~ | **Resolved:** Both always available |
| 12 | ~~Fill gauge top cap at 100%~~ | ~~Top head stroke visible above fill or obscured?~~ | **Resolved:** Head stroke always visible above fill |
| 13 | ~~Digital status fixed-width mode~~ | ~~Include in v1?~~ | **Resolved:** Yes |
| 14 | ~~Digital status multi-state coloring~~ | ~~All states configurable, or only abnormal=color / normal=gray?~~ | **Resolved:** All states configurable |
| 15 | ~~Configuration panel entry point~~ | ~~Option A vs B vs C~~ | **Resolved:** A + C hybrid (sidebar + inline slot `+` handles on hover) |
| 16 | ~~Panel focus on element click~~ | ~~Full shape panel or element-only view?~~ | **Resolved:** Full shape panel, scrolls to element section. Same state whether shape body or sidecar element is clicked. |
| 17 | ~~Auto-create Point Name on drag~~ | ~~Auto-add tag label when point dragged onto shape?~~ | **Resolved:** No — optional only |
| 18 | ~~"Remove all elements for point"~~ | ~~One-shot remove or per-element only?~~ | **Resolved:** Both. Per-element via sidebar/right-click. Batch "Remove all" button in point section header (sidebar only, not right-click). Single undoable action. |
| 19 | ~~Sparkline fixed slots~~ | ~~Same top/right/bottom/left as other elements, or keep right-of-readout/below/above?~~ | **Resolved:** 4 near-corner slots — `right-top` (default), `right-bottom`, `left-bottom`, `left-top` — plus `freeform`. No mid-edge slots. |
| 20 | ~~Multiple same-type elements~~ | ~~Two Text Readouts for two different points at different slots simultaneously?~~ | **Resolved:** Yes — one per bound point |
| 21 | ~~Alarm indicator for composable-part points~~ | ~~Valve body + actuator bound to different points — each gets its own indicator?~~ | **Resolved:** Each composable part has its own local bbox. Sidecar elements bound to a part's point use that part's local bbox for slot calculation. Body → body bbox; actuator → actuator bbox. Both indicator sets independent. |
| 22 | ~~Sidecar elements inside groups~~ | ~~Elements move with group?~~ | **Resolved:** Yes — children of shape's scene graph node |
| 23 | ~~Stale data token values~~ | ~~`--io-text-stale` hex for all themes~~ | **Resolved:** Dark `#636363` · Light `#9CA3AF` · HP HMI `#475569` |
| 24 | ~~Text scale clamping~~ | ~~Minimum readable screen size for sidecar text regardless of zoom?~~ | **Resolved:** 7px screen minimum, live canvas only |
| 25 | LOD zoom thresholds | Exact zoom levels where labels/readouts hide | Placeholder values in spec — tune during implementation |
| 26 | ~~LOD override~~ | ~~Should graphic designer be able to force labels always-visible?~~ | **Resolved:** Three mechanisms: (1) Per-element "Always visible" toggle in sidebar. (2) Global LOD toggle in Console + Process top bars — persists per workspace. (3) Alarm override: alarm indicators always visible; hover tooltip gives value context without forcing text elements visible. LOD active indicator shown when elements are hidden. |
| 27 | ~~Click-to-acknowledge on canvas~~ | ~~Click Alarm Indicator to acknowledge?~~ | **Resolved:** No — v1 ack through Alerts module only |
| 28 | Multiple alarm count badge design | 12px corner badge vs `1↑` style inside indicator? | Decide during visual testing |
| 29 | ~~Same-slot alarm indicator collision~~ | ~~Offset / stack / show highest+count?~~ | **Resolved:** Tile from anchor — line up horizontally or vertically so all are visible |
| 30 | ~~Paste with bindings~~ | ~~"Paste layout only, clear bindings" option needed?~~ | **Resolved:** Defer to v2 |
| 31 | ~~Minimum zone height~~ | ~~4px minimum zone strip before label suppressed?~~ | **Resolved:** 4px — tune during implementation |
| 32 | ~~Composable part bbox exclusion~~ | ~~Slots relative to body-only bbox, or include actuators/supports?~~ | **Resolved (updated from body-only):** Body point uses body-only bbox. Each composable part uses its own local bbox. Parts are NOT included in the body bbox — see Item 21. |
| 33 | ~~Analog bar resize~~ | ~~Fixed size or user-resizable?~~ | **Resolved:** Fully resizable (both height and width) for floating and inside variants |
| 34 | ~~Sparkline resize~~ | ~~Fixed 110×18px or resizable?~~ | **Resolved:** Fully resizable; 110×18px is default, not constraint |
| 35 | ~~Text Readout resize~~ | ~~Manual width or always content-sized?~~ | **Resolved:** Always content-sized; user controls width via font/decimal/EU config |
| 36 | ~~Selection model — sidecar click~~ | ~~Element-level selection or shape-level?~~ | **Resolved:** Shape-level selection always; sidebar jumps to element's section on direct click |
| 37 | ~~Keyboard Delete on sidecar element~~ | ~~Remove or hide?~~ | **Resolved:** Hide (recoverable ghost). Permanent remove is a separate panel action. |
| 38 | ~~Arrow key behavior~~ | ~~Nudge anchored elements?~~ | **Resolved:** Yes — 1px/10px with Shift; nudge auto-promotes anchored element to freeform |
| 39 | ~~Escape key~~ | ~~Step up to shape or deselect all?~~ | **Resolved:** Deselect all |
| 40 | ~~Setpoint marker binding~~ | ~~Fixed, live, or both?~~ | **Resolved:** Three-way toggle (live binding / fixed value / none) for all thresholds (HH/H/L/LL/SP) |
| 41 | ~~Expression bindings~~ | ~~Allowed in any binding field?~~ | **Resolved:** Yes — any binding field accepts an expression; `ƒ` indicator shows when active |
| 42 | ~~.iographic binding export~~ | ~~Strip, include, or user-choice?~~ | **Resolved:** User checkbox at export and import. Format: human-readable PointName (e.g. `24-AI-0101`), never UUID. |
| 43 | ~~Point Name on alarm~~ | ~~Change color when point in alarm?~~ | **Resolved:** No — Point Name color never changes on alarm. ISA-101: alarm indication is on the readout element only. |
| 44 | ~~Alarm indicator collision — tiling direction~~ | ~~Horizontal or vertical tile?~~ | **Resolved:** Tile in the direction with more available space; not configurable |
| 45 | ~~Association highlight~~ | ~~Highlight co-bound elements on click?~~ | **Resolved:** Yes — clicking any sidecar element brightens all elements bound to the same point; others dim |
| 46 | ~~Label rotation~~ | ~~Supported, and how?~~ | **Resolved:** Yes — 90°/180°/270° quick snap via right-click, plus free rotation handle on selection |
| 47 | ~~Snap to element gap~~ | ~~Fixed, user-set, or automatic?~~ | **Resolved:** Automatic (element-specific margin); user adjusts via drag or nudge |
| 48 | ~~Hidden element designer appearance~~ | ~~Invisible or ghost?~~ | **Resolved:** Ghost — visible and clickable in designer, invisible on live canvas |
| 49 | ~~Stale icon choice~~ | ~~Clock, signal-strikethrough, or dot-strikethrough?~~ | **Resolved:** Clock icon (⏱). Additive with color change — both appear together. |
| 50 | ~~Value update animation~~ | ~~Silent snap, background flash, text flash, or configurable?~~ | **Resolved:** Configurable per-element, default on. Brief background flash (~150ms) with 2-second cooldown between flashes. |
| 51 | ~~OPC Bad quality state~~ | ~~Same as Stale, show BAD, separate token, or last-good + warning?~~ | **Resolved:** Hybrid D+B with debounce. 3s onset debounce → Phase 1: last good + ⚠ icon in stale style (up to 30s) → Phase 2: `BAD` in muted color. 5s recovery debounce. |
| 52 | ~~Touch / mobile live canvas~~ | ~~Long press, single tap, floating toolbar, or defer?~~ | **Resolved:** Long press (500ms) triggers Point Context Menu. 60px minimum touch target. Consistent with Doc 20. |
| 53 | ~~Composable part alarm indicator placement~~ | ~~Body bbox tiling, part-local bbox, or v1 no independent binding?~~ | **Resolved:** See items 21 and 32 — each part gets its own local bbox. |
| 54 | ~~Shape drop dialog~~ | ~~Two-step dialog on drop, or sidebar-only config?~~ | **Resolved:** Two-step dialog always shown on drop. Step 1: variant + add-ons. Step 2: sidecar pre-attachment. Right-click → "Shape Configuration…" re-opens anytime. Sidebar has same options. |
| 55 | ~~LOD per-element override~~ | ~~Per-element, per-graphic, or no override?~~ | **Resolved:** Per-element "Always visible" toggle in sidebar. See item 26. |
| 56 | ~~LOD global toggle~~ | ~~Session-only or persisted?~~ | **Resolved:** Console + Process top bar toggle. Persists per workspace. See item 26. |
| 57 | ~~LOD alarm interaction~~ | ~~Force readout visible on alarm, or tooltip only?~~ | **Resolved:** Alarm indicator always visible (existing). Hover tooltip gives value context. Text elements stay subject to LOD. See item 26. |
| 58 | ~~Analog Bar + Fill Gauge — Bad quality display~~ | ~~What do these elements show in Bad Phase 1 and Phase 2?~~ | **Resolved:** Phase 1: stale color + diagonal hatch overlay + ⚠, setpoint hidden. Phase 2: pointer/fill hidden, `BAD` text on element, fill never drops to 0%. Same debounce timing as Text Readout. |
| 59 | ~~Composable part binding in drop dialog~~ | ~~Each part its own binding row, or one binding for whole shape?~~ | **Resolved:** One binding section per composable part in Step 2. Body gets its own row, each part gets its own row. All optional — leave blank and bind via sidebar after placement. Consistent with per-part local bbox decision. |
| 60 | ~~Shape drop dialog variant data source~~ | ~~Variant definitions and add-on lists — where do they live?~~ | **Resolved:** Defined in `shape-variants-addons.md` in this folder. Covers all 25 Tier 1 shapes — variants, add-on checkboxes, bindable parts per shape, dialog rendering rules. Doc 35 not modified. |

---

## Change Log

### v0.5

Resolved 7 remaining pre-implementation decisions (items 49–54 in table, plus composable part bbox update to item 32):

- **Stale icon:** Clock icon (⏱), additive with stale color — both appear together (item 49)
- **Sparkline slots:** Replaced right-of-readout/above/below with 4 near-corner slots — `right-top` (default), `right-bottom`, `left-bottom`, `left-top` — plus `freeform` (item 19)
- **Value update animation:** Configurable per-element, default on. Brief background flash (~150ms), 2s cooldown between flashes (item 50)
- **OPC Bad quality:** Hybrid debounced flow — 3s onset debounce → Phase 1 last good + ⚠ icon (up to 30s) → Phase 2 `BAD` in muted color. 5s recovery debounce (item 51)
- **Touch / mobile:** Long press (500ms) = right-click equivalent. 60px minimum touch target. Consistent with Doc 20 (item 52)
- **Composable part bbox:** Each composable part gets its own local bbox. Body point → body bbox; part point → part local bbox. Items 21, 32, and 53 all resolved together. Spec section "Shape Bounding Box for Slot Calculation" fully rewritten.
- **Shape drop dialog:** Two-step dialog always shown on drop. Step 1: variant picker + add-on checkboxes. Step 2: sidecar pre-attachment with optional inline bindings. Right-click → "Shape Configuration…" re-opens anytime. Sidebar has equivalent options (item 54)
- Added "OPC Data Quality — Bad" section to Value Formatting & Display States
- Added "Value Update Animation" section to Value Formatting & Display States
- Added "Touch / Mobile Interaction — Live Canvas" section to Operator Interaction
- Added "Shape Drop Dialog" section to Designer Placement UX
- **v0.5 addendum:** Resolved items #6, #18, #26 (placeholder format, remove-all, LOD override). Added items #55–60 to open decisions table. Key additions:
  - Placeholder format: `—.— %` with units, never zeros (process safety)
  - Remove all: sidebar-only batch action, single undoable
  - LOD: per-element toggle + global workspace-persisted toggle in Console/Process top bars + alarm hover-tooltip interaction. LOD active indicator when elements hidden.

### v0.6

Full pre-implementation quality review. Resolved 13 edge cases and gaps. No new open decisions added.

- **Digital Status in Bad Quality:** Phase 1 = last state in stale color + ⚠ icon. Phase 2 = `BAD` in muted color. Same debounce as all other elements.
- **Stale + Bad simultaneously:** Bad quality takes priority. Bad Phase timing runs on Bad onset timer; stale clock icon does not appear.
- **Stale/warn icons during alarm flash:** Clock (⏱) and warning (⚠) icons stay **steady** during unacknowledged alarm flash. Border and tint flash; icon content does not.
- **Value update animation in alarm:** Flash **suppressed** when element is in any active alarm state (P1–P4, Shelved, Custom). Resumes when alarm clears.
- **RTN Unacknowledged state:** Alarm Indicator stays visible at 50% dimmed opacity (steady, no flash). Text Readout / Digital Status / Sparkline return to normal display — value is good again.
- **Shape deletion:** Deletes shape + all attached sidecar elements as a group. Single undoable. `Delete` key = hide; "Remove" = permanent (same rule as elements).
- **Point binding change:** Element stays at current slot. Position is never reset on rebind.
- **Drop dialog Cancel button:** Three options clarified — "Next →" (advance), "Use Defaults →" (place with defaults, skip Step 2), "Cancel" (abort, shape not placed).
- **Light theme fill gauge opacity:** Normal = 45% (was 30%), Stale = 15% (was 30%). HPHMI stale = 20% (was 30%). Consistent 30% delta across all themes.
- **LOD active indicator:** Bottom-right corner chip (`LOD` label), auto-hides when nothing is hidden, click shows tooltip.
- **Shell & Tube HX dual binding:** Both shell-side and tube-side points share full HX body bbox. No separate sub-bbox.
- **tag-text typography:** Corrected to 9px `--io-text-muted` (was 11px `--io-text-secondary`). All 6 HTML preview files updated.
- **Mixer + motor variant:** Body-only binding. Motor is geometry, not a composable part.
- **Composable part CSS naming table** added to Shape Bounding Box section.
- **Cross-references:** Point Context Menu reference corrected from doc 38 → doc 32. Duplicate contents table removed. `shape-composition-rules.md` phantom reference removed.
- **Open decisions table:** All decided items marked ~~resolved~~. Items 25 and 28 remain genuinely pending (tune during implementation / decide during visual testing).

### v0.4

Resolved 20 open decisions from Q&A session (items 15–17, 23, 27, 29, 33–48 in table). Key additions:

- **Selection model:** Shape always selected; direct sidecar click jumps sidebar to that element's section. Rubber-band over sidecar-only area also focuses that section.
- **Keyboard behavior:** `Delete` = hide (not remove); `Escape` = deselect all; arrow keys nudge + auto-promote to freeform; rotation via right-click + free handle.
- **Hide vs. Remove:** Delete key hides (recoverable ghost in designer); Remove action in panel/menu is permanent. Ghost elements visible and clickable in designer.
- **Text Readout config options:** Font, size, weight, bold, italic, decimal places, EU on/off. Width always content-sized, no resize handle.
- **Sparkline:** Changed from "fixed size" to fully resizable; 110×18px is default not constraint.
- **Analog Bar:** Both dimensions draggable. Threshold config: three-way toggle (live binding / fixed value / none) for HH, H, L, LL, and Setpoint.
- **Alarm indicator collision:** Changed from "offset 4px" to **tile** (line up without overlap).
- **Association highlight:** Clicking any sidecar element brightens co-bound elements; others dim.
- **Right-click context menu:** 7-item menu defined (Snap to slot, Snap to element, Hide, Remove, Copy, Edit binding, Move to layer).
- **Snap to element:** Opens element picker + relative position; gap is automatic.
- **Expression bindings:** Any binding field accepts an expression; `ƒ` indicator active.
- **Export bindings:** User checkbox; format is always human-readable PointName (never UUID); unresolved tags show N/C on import.
- **Point Name on alarm:** Never changes color — alarm indication is on the readout element only (ISA-101).
- **Stale token resolved:** Dark `#636363` · Light `#9CA3AF` · HP HMI `#475569`.
- **Text Readout alarm states added** to all three theme preview HTML files (dark/light/hphmi) with Data Quality, Acknowledged, and Unacknowledged (animated) sections.

### v0.3
Added: Value Formatting & Display States (precision/format, stale data `--io-text-stale` token, N/C unresolved state, offline/no-data state, out-of-range clamping, zone activation at 50% opacity); Scale & Zoom Behavior (sidecar scales with shape in SymbolInstance space, text scale clamping, LOD thresholds table, freeform position stored relative to shape); Operator Interaction — Live Canvas (hover tooltip contents, right-click Point Context Menu actions, click-to-ack decision, multiple-alarm count badge, same-slot collision handling); Designer Behavior additions (copy/paste carries bindings, undo scope, analog bar zone proportionality with 4px minimum, shape bbox body-only rule); Open Decisions expanded to 33 items including PointName/DisplayName typography hierarchy question.

### v0.2
Added: Sidecar Placement Fixed Anchor Slots (Point Name, Point Value, Alarm Indicator with defaults and combination rule); Free Form placement mode (visual indicators, per-element designer appearance); Analog Bar & Fill Gauge floating positions (8 floating + 2 inside, orientation rules, Mode 1 fill cap behavior); Digital Status Box placement and display options; Designer Configuration UI section (panel structure, element add/remove flows); Open Design Decisions table (20 items). Updated Contents table for full folder contents.

### v0.1
Initial spec. Replaces `InOps/display-elements-implementation-spec.md`. Covers all 6 display element types with updated ISA-18.2/ISA-101 4-priority alarm scheme, per-theme color tables for Dark/Light/HP HMI, Analog Bar Mode B (vessel-interior), full sparkline state set including Shelved/Disabled/Custom, Digital Status text contrast rules, and Designer anchor placement UX with named slots.
