# Shape Library SVG Extraction — Progress Tracker

**Project:** I/O Shape Library Rebuild  
**Source:** `design-docs/shape-sidecar-spec/dark-shape-library-preview.html`  
**Target base:** `frontend/public/shapes/`  
**Total shapes:** ~86 SVG files across 18 batches (1a–1r)  
**Sidecar JSON files:** Phase 2 (separate — not part of this extraction)

---

## How to Find Shapes in the Preview HTML

Each shape is a `<div class="card">` block. Inside each card:
- `<div class="shape-id">` — the canonical shape ID (use to find the card)
- `<div class="shape-name">` — human-readable label
- `<div class="shape-viewbox">` — viewBox string
- Inline `<svg>` — the geometry to extract

Use Grep to find a shape by ID first, then Read with offset/limit to get the surrounding SVG content.

---

## SVG Rules (Non-Negotiable — Every File Must Follow These)

1. **Root `<svg>` attributes required:**
   - `xmlns="http://www.w3.org/2000/svg"`
   - `data-io-shape="{shape-id}"` (e.g. `valve-gate`)
   - `data-io-version="2"`
   - `data-io-category="{category}"` (e.g. `valves`, `pumps`, `rotating`, `heat-transfer`, `vessels`, `tanks`, `reactors`, `columns`, `filters`, `mixers`, `instrumentation`, `actuators`, `indicators`, `agitators`, `supports`)
   - `viewBox` — from the source card's `shape-viewbox` div

2. **Equipment stroke:** `stroke="#808080"` on ALL path/line/circle/rect elements  
   - Primary geometry: `stroke-width="1.5"`  
   - Foot, base, and minor lines: `stroke-width="0.75"`

3. **Body group:** ALL body geometry wrapped in `<g class="io-shape-body">`

4. **Stateful elements:** Moving parts or elements that change with operational state get `class="io-stateful"` (e.g. valve disc/gate, pump impeller housing, reactor internals)

5. **No hardcoded fills:** Remove fill colors from body elements. Set `fill="none"` or `fill="transparent"`. Operational state CSS applies fills at runtime.

6. **Connection points (nozzles):** Wrap in `<g class="io-connections" display="none">`. Each nozzle: `<circle r="2" fill="none" stroke="#4A9EFF" stroke-width="1" data-io-conn-id="{name}"/>` placed at the nozzle endpoint. Derive positions from visible line endpoints in the source SVG.

7. **Composable part groups:** For shapes with attachment points for actuators/agitators/supports, add empty `<g class="io-shape-part-actuator">`, `<g class="io-shape-part-agitator">`, `<g class="io-shape-part-support">` as placeholders.

8. **Preserve geometry:** Do not simplify, approximate, or redraw paths. Copy the `d` attribute of paths exactly from the source.

---

## Known Discrepancies (Resolve Per Batch Instructions)

**D1 — Actuator naming mismatch:**  
Spec filenames say `part-actuator-diaphragm`, `part-actuator-motor`, `part-actuator-solenoid` (3 types).  
Preview HTML shows `actuator-pneumatic`, `actuator-electric`, `actuator-hydraulic`, `actuator-handwheel` (4 types).  
→ Use spec filenames. Map: pneumatic→diaphragm, electric→motor, hydraulic→solenoid. Skip handwheel for now.

**D2 — Vessel welded suffix:**  
Spec says `vessel-vertical-welded.svg` but preview HTML shape-id is `vessel-vertical` (bare).  
→ Use spec filename (`vessel-vertical-welded.svg`). Extract from the `vessel-vertical` card in the HTML.

**D3 — Column trayed-6 naming:**  
Preview HTML may show `trayed` (meaning 6 trays). Spec says `trayed-6`.  
→ Use spec filename with `-6` suffix when extracting from bare `trayed` cards.

**D4 — Heat exchanger base vs variants:**  
`heat-exchanger-shell-tube.svg` (base) exists on disk. Spec also defines `-standard`, `-kettle-reboiler`, `-u-tube` variants.  
→ Extract base as `heat-exchanger-shell-tube.svg` AND the 3 variants. Base = standard geometry. Note in file if it should eventually be deprecated in favor of the standard variant.

---

## Stale Files to Delete (Batch 1r)

Files on disk that the spec does not include — delete in final batch:

```
frontend/public/shapes/pumps/pump-centrifugal.svg
frontend/public/shapes/pumps/pump-positive-displacement.svg
frontend/public/shapes/rotating/compressor.svg
frontend/public/shapes/rotating/fan-blower.svg
frontend/public/shapes/rotating/motor.svg
frontend/public/shapes/heat-exchange/          (entire directory)
frontend/public/shapes/heat-transfer/heater-fired.svg
frontend/public/shapes/control/                (entire directory — old location for annunciators/interlocks)
frontend/public/shapes/instruments/            (directory — duplicate of instrumentation/)
frontend/public/shapes/interlocks/interlock-opt2.svg
frontend/public/shapes/separation/             (entire directory — old naming)
frontend/public/shapes/indicators/position-indicator.svg
frontend/public/shapes/actuators/actuator-hydraulic.svg  (mapped to solenoid; original kept only if geometry differs)
frontend/public/shapes/actuators/actuator-handwheel.svg  (not in spec)
frontend/public/shapes/piping/                 (entire directory — not Tier 1 shapes)
```

---

## Batch Status

### Batch 1a — Valves Part 1 (5 shapes)
- [ ] `valve-gate` → `valves/valve-gate.svg`
- [ ] `valve-globe` → `valves/valve-globe.svg`
- [ ] `valve-ball` → `valves/valve-ball.svg`
- [ ] `valve-butterfly` → `valves/valve-butterfly.svg`
- [ ] `valve-control` → `valves/valve-control.svg`

### Batch 1b — Valves Part 2 + Pumps Part 1 (5 shapes)
- [ ] `valve-relief` → `valves/valve-relief.svg`
- [ ] `valve-relief-spring-loaded` → `valves/valve-relief-spring-loaded.svg`
- [ ] `valve-relief-pilot-operated` → `valves/valve-relief-pilot-operated.svg`
- [ ] `pump-centrifugal-opt1` → `pumps/pump-centrifugal-opt1.svg`
- [ ] `pump-centrifugal-opt2` → `pumps/pump-centrifugal-opt2.svg`

### Batch 1c — Pumps Part 2 + Rotating Part 1 (6 shapes)
- [ ] `pump-positive-displacement-opt1` → `pumps/pump-positive-displacement-opt1.svg`
- [ ] `pump-positive-displacement-opt2` → `pumps/pump-positive-displacement-opt2.svg`
- [ ] `compressor-opt1` → `rotating/compressor-opt1.svg`
- [ ] `compressor-opt2` → `rotating/compressor-opt2.svg`
- [ ] `fan-blower-opt1` → `rotating/fan-blower-opt1.svg`
- [ ] `fan-blower-opt2` → `rotating/fan-blower-opt2.svg`

### Batch 1d — Rotating Part 2 + Heat Transfer Part 1 (6 shapes)
- [ ] `motor-opt1` → `rotating/motor-opt1.svg`
- [ ] `motor-opt2` → `rotating/motor-opt2.svg`
- [ ] `heat-exchanger-shell-tube` → `heat-transfer/heat-exchanger-shell-tube.svg` *(see D4)*
- [ ] `heat-exchanger-shell-tube-standard` → `heat-transfer/heat-exchanger-shell-tube-standard.svg`
- [ ] `heat-exchanger-shell-tube-kettle-reboiler` → `heat-transfer/heat-exchanger-shell-tube-kettle-reboiler.svg`
- [ ] `heat-exchanger-shell-tube-u-tube` → `heat-transfer/heat-exchanger-shell-tube-u-tube.svg`

### Batch 1e — Heat Transfer Part 2 + Vessels Part 1 (5 shapes)
- [ ] `heat-exchanger-plate` → `heat-transfer/heat-exchanger-plate.svg`
- [ ] `heater-fired-box` → `heat-transfer/heater-fired-box.svg`
- [ ] `heater-fired-cylindrical` → `heat-transfer/heater-fired-cylindrical.svg`
- [ ] `air-cooler` → `heat-transfer/air-cooler.svg`
- [ ] `vessel-vertical` → `vessels/vessel-vertical-welded.svg` *(see D2)*

### Batch 1f — Vessels Part 2 (5 shapes)
- [ ] `vessel-vertical-flanged-top` → `vessels/vessel-vertical-flanged-top.svg`
- [ ] `vessel-vertical-flanged-bottom` → `vessels/vessel-vertical-flanged-bottom.svg`
- [ ] `vessel-vertical-flanged` → `vessels/vessel-vertical-flanged-both.svg`
- [ ] `vessel-horizontal` → `vessels/vessel-horizontal-welded.svg` *(see D2)*
- [ ] `vessel-horizontal-flanged-left` → `vessels/vessel-horizontal-flanged-left.svg`

### Batch 1g — Vessels Part 3 + Tanks Part 1 (5 shapes)
- [ ] `vessel-horizontal-flanged-right` → `vessels/vessel-horizontal-flanged-right.svg`
- [ ] `vessel-horizontal-flanged` → `vessels/vessel-horizontal-flanged-both.svg`
- [ ] `tank-storage-cone-roof` → `tanks/tank-storage-cone-roof.svg`
- [ ] `tank-storage-dome-roof` → `tanks/tank-storage-dome-roof.svg`
- [ ] `tank-storage-open-top` → `tanks/tank-storage-open-top.svg`

### Batch 1h — Tanks Part 2 + Reactors (6 shapes)
- [ ] `tank-storage-floating-roof` → `tanks/tank-storage-floating-roof.svg`
- [ ] `tank-storage-sphere` → `tanks/tank-storage-sphere.svg`
- [ ] `tank-storage-capsule` → `tanks/tank-storage-capsule.svg`
- [ ] `reactor-base` → `reactors/reactor-base.svg`
- [ ] `reactor-flat-top` → `reactors/reactor-flat-top.svg`
- [ ] `reactor-closed` → `reactors/reactor-closed.svg`

### Batch 1i — Reactors Part 2 + Columns Narrow (5 shapes)
- [ ] `reactor-trayed` → `reactors/reactor-trayed.svg`
- [ ] `column-distillation-narrow-plain` → `columns/column-distillation-narrow-plain.svg`
- [ ] `column-distillation-narrow-trayed` → `columns/column-distillation-narrow-trayed-6.svg` *(see D3)*
- [ ] `column-distillation-narrow-trayed-10` → `columns/column-distillation-narrow-trayed-10.svg`
- [ ] `column-distillation-narrow-packed` → `columns/column-distillation-narrow-packed.svg`

### Batch 1j — Columns Standard (4 shapes)
- [ ] `column-distillation-standard-plain` → `columns/column-distillation-standard-plain.svg`
- [ ] `column-distillation-standard-trayed` → `columns/column-distillation-standard-trayed-6.svg` *(see D3)*
- [ ] `column-distillation-standard-trayed-10` → `columns/column-distillation-standard-trayed-10.svg`
- [ ] `column-distillation-standard-packed` → `columns/column-distillation-standard-packed.svg`

### Batch 1k — Columns Wide (4 shapes)
- [ ] `column-distillation-wide-plain` → `columns/column-distillation-wide-plain.svg`
- [ ] `column-distillation-wide-trayed` → `columns/column-distillation-wide-trayed-6.svg` *(see D3)*
- [ ] `column-distillation-wide-trayed-10` → `columns/column-distillation-wide-trayed-10.svg`
- [ ] `column-distillation-wide-packed` → `columns/column-distillation-wide-packed.svg`

### Batch 1l — Separation: Filters + Mixers (5 shapes)
- [ ] `filter-standard` → `filters/filter-standard.svg`
- [ ] `filter-vacuum` → `filters/filter-vacuum.svg`
- [ ] `mixer-agitator` → `mixers/mixer-agitator.svg`
- [ ] `mixer-agitator-motor` → `mixers/mixer-agitator-motor.svg`
- [ ] `mixer-inline-static` → `mixers/mixer-inline-static.svg`

### Batch 1m — Instrumentation Part 1 (5 shapes)
- [ ] `instrument-field` → `instrumentation/instrument-field.svg`
- [ ] `instrument-panel` → `instrumentation/instrument-panel.svg`
- [ ] `instrument-behind-panel` → `instrumentation/instrument-behind-panel.svg`
- [ ] `alarm-annunciator-opt1` → `instrumentation/alarm-annunciator-opt1.svg`
- [ ] `alarm-annunciator-opt2` → `instrumentation/alarm-annunciator-opt2.svg`

### Batch 1n — Instrumentation Part 2 + Actuator Parts (6 shapes)
- [ ] `interlock-standard` → `instrumentation/interlock-standard.svg`
- [ ] `interlock-sis` → `instrumentation/interlock-sis.svg`
- [ ] `interlock-padlock` → `instrumentation/interlock-padlock.svg`
- [ ] `actuator-pneumatic` → `actuators/part-actuator-diaphragm.svg` *(see D1)*
- [ ] `actuator-electric` → `actuators/part-actuator-motor.svg` *(see D1)*
- [ ] `actuator-hydraulic` → `actuators/part-actuator-solenoid.svg` *(see D1)*

### Batch 1o — Fail Indicators + Agitators Part 1 (6 shapes)
- [ ] `fail-open` → `indicators/part-fail-open.svg`
- [ ] `fail-close` → `indicators/part-fail-closed.svg`
- [ ] `fail-last` → `indicators/part-fail-last.svg` *(may not exist in preview — derive geometry if absent)*
- [ ] `agitator-turbine` → `agitators/agitator-turbine.svg`
- [ ] `agitator-propeller` → `agitators/agitator-propeller.svg`
- [ ] `agitator-anchor` → `agitators/agitator-anchor.svg`

### Batch 1p — Agitators Part 2 + Supports Part 1 (5 shapes)
- [ ] `agitator-paddle` → `agitators/agitator-paddle.svg`
- [ ] `agitator-helical` → `agitators/agitator-helical.svg`
- [ ] `support-skirt` → `supports/support-skirt.svg`
- [ ] `support-legs-3` → `supports/support-legs-3.svg`
- [ ] `support-legs-4` → `supports/support-legs-4.svg`

### Batch 1q — Supports Part 2 (2 shapes)
- [ ] `support-legs-splayed` → `supports/support-legs-splayed.svg`
- [ ] `support-saddles` → `supports/support-saddles.svg`

### Batch 1r — Cleanup (no new shapes — delete stale files)
- [ ] Delete stale files listed in "Stale Files to Delete" section above
- [ ] Verify `frontend/public/shapes/index.json` lists all new filenames

---

## Completion Summary

Update this section when all batches are done:

- Batches complete: 0 / 18
- Shapes extracted: 0 / ~86
- Stale files deleted: 0
