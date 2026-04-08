# Shape Variants and Add-ons

This file is the **authoritative source** for the Shape Drop Dialog (Step 1 and Step 2) defined in `shape-sidecar-spec.md`. It defines, per shape type, what variants and composable part add-ons are available to the user when dropping a shape onto the canvas.

**Relationship to Doc 35:** Doc 35 defines the SVG geometry and JSON sidecar format for each shape. This file defines the *designer UX layer* — what the drop dialog presents, how variants map to SVG file names, and which composable parts are available per shape. Do not add this content to Doc 35.

**Relationship to the Drop Dialog:**
- **Step 1** — Variant picker + add-on checkboxes
- **Step 2** — Sidecar pre-attachment (one binding section per body + per composable part)

---

## Part Catalog

These are the reusable composable parts referenced throughout this file. File names are authoritative from the shape library.

### Actuators (attach to valve stems)

| Part ID | File | Display Name | Mechanism |
|---|---|---|---|
| `actuator-diaphragm` | `part-actuator-diaphragm.svg` | Pneumatic (Diaphragm) | Spring-opposed diaphragm, air-to-open or air-to-close |
| `actuator-motor` | `part-actuator-motor.svg` | Motorized (Electric) | Electric motor drive, quarter-turn or multi-turn |
| `actuator-solenoid` | `part-actuator-solenoid.svg` | Solenoid | Two-position solenoid, typically on/off |

### Fail-Position Indicators (attach to valve + actuator assembly)

| Part ID | File | Display Name | Notes |
|---|---|---|---|
| `fail-open` | `part-fail-open.svg` | Fail Open (FO) | Arrow pointing open direction |
| `fail-closed` | `part-fail-closed.svg` | Fail Closed (FC) | Arrow pointing closed direction |
| `fail-last` | `part-fail-last.svg` | Fail Last (FL) | Bracket indicating hold-last-position |

### Agitators (attach to reactor shaft connection point)

| Part ID | File | Display Name | Use Case |
|---|---|---|---|
| `agitator-turbine` | `agitator-turbine.svg` | Turbine (Rushton) | General mixing, gas dispersion |
| `agitator-propeller` | `agitator-propeller.svg` | Propeller (Marine) | Low-viscosity bulk mixing |
| `agitator-anchor` | `agitator-anchor.svg` | Anchor | High-viscosity, wall-scraping |
| `agitator-paddle` | `agitator-paddle.svg` | Paddle | Simple flat-blade, slow speed |
| `agitator-helical` | `agitator-helical.svg` | Helical Ribbon | Very high viscosity, full-vessel sweep |

### Supports — Vertical (attach to reactor/column/vessel base)

| Part ID | File | Display Name | Notes |
|---|---|---|---|
| `support-skirt` | `support-skirt.svg` | Skirt | Stepped foundation base — reactors, columns |
| `support-legs-3` | `support-legs-3.svg` | Legs (3-point) | 3 splayed legs with feet |
| `support-legs-4` | `support-legs-4.svg` | Legs (4-point) | 4 straight vertical legs with floor line |

### Supports — Horizontal (attach to tank/vessel base)

| Part ID | File | Display Name | Notes |
|---|---|---|---|
| `support-legs-splayed` | `support-legs-splayed.svg` | Splayed Legs | 2 angled legs — spheres, capsule tanks |
| `support-saddles` | `support-saddles.svg` | Saddle Supports | 2 trapezoidal saddle cradles — horizontal vessels |

---

## Per-Shape Variant and Add-on Definitions

Each entry defines:
- **Variants** — shown in the Step 1 variant picker. First listed is the default.
- **Add-ons** — checkboxes in Step 1. Each add-on is a composable part from the catalog above.
- **Bindable parts** — what appears as binding sections in Step 2. Body is always first; composable parts follow.
- **SVG file name pattern** — how to construct the file name from the selected variant + add-ons.

---

### Valves

#### `valve-gate` — Gate Valve

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `plain` *(default)* | Gate Valve (plain) | `valve-gate.svg` |
| `with-actuator-diaphragm` | Gate Valve + Pneumatic Actuator | `valve-gate.svg` + `part-actuator-diaphragm.svg` |
| `with-actuator-motor` | Gate Valve + Motorized Actuator | `valve-gate.svg` + `part-actuator-motor.svg` |
| `with-actuator-solenoid` | Gate Valve + Solenoid Actuator | `valve-gate.svg` + `part-actuator-solenoid.svg` |

**Add-on checkboxes (Step 1, enabled only when an actuator variant is selected):**
- [ ] Fail Open (FO) — `part-fail-open.svg`
- [ ] Fail Closed (FC) — `part-fail-closed.svg`
- [ ] Fail Last (FL) — `part-fail-last.svg`

**Bindable parts (Step 2):**
- Valve body (always)
- Actuator (if actuator variant selected)

---

#### `valve-globe` — Globe Valve

Same variants, add-ons, and bindable parts as `valve-gate`. SVG base: `valve-globe.svg`.

---

#### `valve-ball` — Ball Valve

Same variants, add-ons, and bindable parts as `valve-gate`. SVG base: `valve-ball.svg`.

---

#### `valve-butterfly` — Butterfly Valve

Same variants, add-ons, and bindable parts as `valve-gate`. SVG base: `valve-butterfly.svg`.

---

#### `valve-control` — Control Valve

Control valves ship with an actuator as part of the base ISA symbol (bowtie + stem + dome). Variants differentiate actuator type and fail position.

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `diaphragm` *(default)* | Control Valve — Pneumatic | `valve-control.svg` + `part-actuator-diaphragm.svg` |
| `motor` | Control Valve — Motorized | `valve-control.svg` + `part-actuator-motor.svg` |
| `solenoid` | Control Valve — Solenoid | `valve-control.svg` + `part-actuator-solenoid.svg` |

**Add-on checkboxes (Step 1, always available):**
- [ ] Fail Open (FO)
- [ ] Fail Closed (FC)
- [ ] Fail Last (FL)

**Bindable parts (Step 2):**
- Valve body (flow measurement point, e.g. `FIC-101`)
- Actuator (position/command point, e.g. `FIC-101.OP`)

---

#### `valve-relief` — Relief/Safety Valve

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `spring-loaded` *(default)* | Relief Valve — Spring Loaded |
| `pilot-operated` | Safety Valve — Pilot Operated |

**Add-ons:** None.

**Bindable parts (Step 2):** Valve body only.

---

### Pumps

#### `pump-centrifugal` — Centrifugal Pump

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `opt1` *(default)* | Centrifugal Pump (ISA) | `pump-centrifugal-opt1.svg` |
| `opt2` | Centrifugal Pump (Graphical) | `pump-centrifugal-opt2.svg` |

**Add-ons:** None.

**Bindable parts (Step 2):** Pump body only.

---

#### `pump-positive-displacement` — PD Pump

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `opt1` *(default)* | PD Pump (ISA) | `pump-positive-displacement-opt1.svg` |
| `opt2` | PD Pump (Graphical) | `pump-positive-displacement-opt2.svg` |

**Add-ons:** None.

**Bindable parts (Step 2):** Pump body only.

---

### Rotating Equipment

#### `compressor` — Compressor

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `opt1` *(default)* | Compressor (ISA) | `compressor-opt1.svg` |
| `opt2` | Compressor (Graphical) | `compressor-opt2.svg` |

**Add-ons:** None.

**Bindable parts (Step 2):** Compressor body only.

---

#### `fan-blower` — Fan / Blower

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `opt1` *(default)* | Fan/Blower (ISA) | `fan-blower-opt1.svg` |
| `opt2` | Fan/Blower (Graphical) | `fan-blower-opt2.svg` |

**Add-ons:** None.

**Bindable parts (Step 2):** Fan body only.

---

#### `motor` — Electric Motor

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `opt1` *(default)* | Motor (ISA circle) | `motor-opt1.svg` |
| `opt2` | Motor (Capsule housing) | `motor-opt2.svg` |

**Add-ons:** None.

**Bindable parts (Step 2):** Motor body only.

---

### Heat Transfer

#### `heat-exchanger-shell-tube` — Shell & Tube Heat Exchanger

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `standard` *(default)* | Shell & Tube HX |
| `kettle-reboiler` | Kettle Reboiler |
| `u-tube` | U-Tube HX |

**Add-ons:** None.

**Bindable parts (Step 2):** Shell side + tube side (two binding sections — shell-side fluid and tube-side fluid are often different process points).

---

#### `heat-exchanger-plate` — Plate Heat Exchanger

**Variants:** Standard only.

**Add-ons:** None.

**Bindable parts (Step 2):** Body only (typically bound to a differential temperature or duty point).

---

#### `heater-fired` — Fired Heater / Furnace

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `box` *(default)* | Fired Heater (Box Type) |
| `cylindrical` | Fired Heater (Cylindrical) |

**Add-ons:** None.

**Bindable parts (Step 2):** Body only (typically outlet temperature or duty).

---

#### `air-cooler` — Air Cooler / Fin-Fan

**Variants:** Standard only. Fan blade count is fixed geometry.

**Add-ons:** None.

**Bindable parts (Step 2):** Body only.

---

### Vessels

#### `vessel-vertical` — Vertical Vessel

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `welded` *(default)* | Vertical Vessel (Welded) |
| `flanged-top` | Vertical Vessel (Flanged Top) |
| `flanged-bottom` | Vertical Vessel (Flanged Bottom) |
| `flanged-both` | Vertical Vessel (Flanged Both) |

**Add-on checkboxes (Step 1):**
- [ ] Skirt support — `support-skirt.svg`
- [ ] 3-point legs — `support-legs-3.svg`
- [ ] 4-point legs — `support-legs-4.svg`

**Bindable parts (Step 2):** Body only (level, pressure, temperature points bound via sidecar elements).

---

#### `vessel-horizontal` — Horizontal Vessel

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `welded` *(default)* | Horizontal Vessel (Welded) |
| `flanged-left` | Horizontal Vessel (Flanged Left) |
| `flanged-right` | Horizontal Vessel (Flanged Right) |
| `flanged-both` | Horizontal Vessel (Flanged Both) |

**Add-on checkboxes (Step 1):**
- [ ] Saddle supports — `support-saddles.svg`

**Bindable parts (Step 2):** Body only.

---

#### `tank-storage` — Storage Tank

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `cone-roof` *(default)* | Storage Tank (Cone Roof) | `tank-storage-cone-roof.svg` |
| `dome-roof` | Storage Tank (Dome Roof) | `tank-storage-dome-roof.svg` |
| `open-top` | Storage Tank (Open Top) | `tank-storage-open-top.svg` |
| `floating-roof` | Storage Tank (Floating Roof) | `tank-storage-floating-roof.svg` |
| `sphere` | Spherical Tank | `tank-storage-sphere.svg` |
| `capsule` | Capsule Tank (Horton Sphere) | `tank-storage-capsule.svg` |

**Add-on checkboxes (Step 1):**

*Available for cone-roof / dome-roof / open-top / floating-roof:*
- [ ] 3-point legs — `support-legs-3.svg`
- [ ] 4-point legs — `support-legs-4.svg`

*Available for sphere / capsule only:*
- [ ] Splayed legs — `support-legs-splayed.svg`
- [ ] Saddle supports — `support-saddles.svg`

**Bindable parts (Step 2):** Body only.

---

#### `reactor` — Reactor

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `base` *(default)* | Reactor (Open Top) | `reactor-base.svg` |
| `flat-top` | Reactor (Flat Top) | `reactor-flat-top.svg` |
| `closed` | Reactor (Closed / Pressure) | `reactor-closed.svg` |
| `trayed` | Reactor (Trayed) | `reactor-trayed.svg` |

**Add-on checkboxes (Step 1):**

*Agitator (pick one):*
- [ ] Turbine agitator — `agitator-turbine.svg`
- [ ] Propeller agitator — `agitator-propeller.svg`
- [ ] Anchor agitator — `agitator-anchor.svg`
- [ ] Paddle agitator — `agitator-paddle.svg`
- [ ] Helical ribbon agitator — `agitator-helical.svg`

*Supports (pick one):*
- [ ] Skirt — `support-skirt.svg`
- [ ] 3-point legs — `support-legs-3.svg`
- [ ] 4-point legs — `support-legs-4.svg`

> Agitators are mutually exclusive (one per reactor). Supports are mutually exclusive. Dialog should enforce single-select within each group.

**Bindable parts (Step 2):**
- Reactor body (primary process point, e.g. `TIC-301` temperature)
- Agitator (if selected — agitator motor speed/current, e.g. `SIC-301`)

---

#### `column-distillation` — Distillation Column

**Variants (Step 1 picker):**

Width × Internals = 12 combinations. Present as two dropdowns in Step 1:

*Width:*
- `narrow` *(default)* — narrow column
- `standard` — standard width
- `wide` — wide column (absorbers, large fractionators)

*Internals:*
- `plain` *(default)* — smooth interior
- `trayed-6` — 6 trays shown
- `trayed-10` — 10 trays shown
- `packed` — packing notation

SVG file: `column-distillation-{width}-{internals}.svg`

**Add-on checkboxes (Step 1):**
- [ ] Skirt — `support-skirt.svg`
- [ ] 3-point legs — `support-legs-3.svg`
- [ ] 4-point legs — `support-legs-4.svg`

**Bindable parts (Step 2):** Body only (multiple sidecar elements cover multiple process points — top temperature, bottom temperature, pressure differential, etc.).

---

### Separation

#### `filter` — Filter / Strainer

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `standard` *(default)* | Filter/Strainer (Standard) |
| `vacuum` | Vacuum Filter (Rotary Drum) |

**Add-ons:** None.

**Bindable parts (Step 2):** Body only.

---

#### `mixer` — Mixer (Inline / Standalone)

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `agitator` *(default)* | Agitator Mixer | `mixer-agitator.svg` |
| `agitator-motor` | Agitator Mixer (with Motor) | `mixer-agitator-motor.svg` |
| `inline-static` | Inline Static Mixer | `mixer-inline-static.svg` |

**Add-ons:** None (agitator type is baked into variant, not a composable add-on for `mixer`).

**Bindable parts (Step 2):** Body only. For `mixer-agitator-motor`, the motor is part of the variant geometry — not a separate composable part. Motor data points (speed, current, run/stop) are bound as additional points on the body, not as a separate binding section. All sidecar elements use the full mixer body bbox.

---

### Instrumentation

#### `instrument` — Instrument Bubble

**Variants (Step 1 picker):**
| Variant | Display Name | SVG File |
|---|---|---|
| `field` *(default)* | Field-Mounted | `instrument-field.svg` |
| `panel` | Panel-Mounted | `instrument-panel.svg` |
| `behind-panel` | Behind Panel | `instrument-behind-panel.svg` |

**Add-ons:** None. Designation letters (PI, TIC, FIC, etc.) are data entered via the point binding, not shape variants.

**Bindable parts (Step 2):** Body only.

---

#### `alarm-annunciator` — Alarm / Annunciator

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `opt1` *(default)* | Annunciator (ISA circle) |
| `opt2` | Annunciator (Horn/Speaker) |

**Add-ons:** None.

**Bindable parts (Step 2):** Body only.

---

#### `interlock` — Interlock / SIS

**Variants (Step 1 picker):**
| Variant | Display Name |
|---|---|
| `standard` *(default)* | Interlock (Diamond) |
| `sis` | SIS / SIF (Diamond-in-Square) |
| `padlock` | Interlock (Padlock — DCS convention) |

**Add-ons:** None.

**Bindable parts (Step 2):** Body only.

---

## Dialog Rendering Rules

These rules govern how the Step 1 dialog is constructed from the data above:

1. **Single variant → no picker shown.** If a shape has only one variant, skip the visual grid/radio and go straight to add-ons (if any). If no add-ons either, Step 1 is auto-completed and the dialog opens at Step 2.

2. **Mutually exclusive add-ons use radio buttons**, not checkboxes. Agitator type and support type on reactors are radio groups. All others are independent checkboxes.

3. **Conditional add-ons** are shown/hidden based on selected variant. Tank sphere/capsule add-ons are hidden when a flat-roof tank variant is selected, and vice versa.

4. **Valve fail indicators** are disabled (grayed) until an actuator variant is selected. A plain (no actuator) valve cannot have a fail indicator.

5. **Step 1 "Next →"** is always available — user can skip variant selection and get the default.

6. **Step 2 binding sections** appear in order: body first, then composable parts in the order they were checked in Step 1. Unchecked parts do not appear in Step 2.

7. **Variant/add-on data** is stored in the shape instance's scene graph node (`variant` field and `parts[]` array) and determines which SVG files the renderer assembles at display time.

---

## Change Log

### v0.1

Initial document. Covers all 25 Tier 1 shapes from Doc 35. Part catalog, per-shape variant tables, add-on checkboxes, bindable part lists, and dialog rendering rules. Actuator names derived from GitHub-authoritative file names (`part-actuator-diaphragm`, `part-actuator-motor`, `part-actuator-solenoid`). Resolves open decision #60 from `shape-sidecar-spec.md`.
