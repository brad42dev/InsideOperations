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

### Batch 1a — Valves Part 1 (5 shapes) ✓ DONE
- [x] `valve-gate` → `valves/valve-gate.svg`
- [x] `valve-globe` → `valves/valve-globe.svg`
- [x] `valve-ball` → `valves/valve-ball.svg`
- [x] `valve-butterfly` → `valves/valve-butterfly.svg`
- [x] `valve-control` → `valves/valve-control.svg`

### Batch 1b — Valves Part 2 + Pumps Part 1 (5 shapes) ✓ DONE
- [x] `valve-relief` → `valves/valve-relief.svg`
- [x] `valve-relief-spring-loaded` → `valves/valve-relief-spring-loaded.svg`
- [x] `valve-relief-pilot-operated` → `valves/valve-relief-pilot-operated.svg`
- [x] `pump-centrifugal-opt1` → `pumps/pump-centrifugal-opt1.svg`
- [x] `pump-centrifugal-opt2` → `pumps/pump-centrifugal-opt2.svg`

### Batch 1c — Pumps Part 2 + Rotating Part 1 (6 shapes) ✓ DONE
- [x] `pump-positive-displacement-opt1` → `pumps/pump-positive-displacement-opt1.svg`
- [x] `pump-positive-displacement-opt2` → `pumps/pump-positive-displacement-opt2.svg`
- [x] `compressor-opt1` → `rotating/compressor-opt1.svg`
- [x] `compressor-opt2` → `rotating/compressor-opt2.svg`
- [x] `fan-blower-opt1` → `rotating/fan-blower-opt1.svg`
- [x] `fan-blower-opt2` → `rotating/fan-blower-opt2.svg`

### Batch 1d — Rotating Part 2 + Heat Transfer Part 1 (6 shapes) ✓ DONE
- [x] `motor-opt1` → `rotating/motor-opt1.svg`
- [x] `motor-opt2` → `rotating/motor-opt2.svg`
- [x] `heat-exchanger-shell-tube` → `heat-transfer/heat-exchanger-shell-tube.svg` *(see D4)*
- [x] `heat-exchanger-shell-tube-standard` → `heat-transfer/heat-exchanger-shell-tube-standard.svg`
- [x] `heat-exchanger-shell-tube-kettle-reboiler` → `heat-transfer/heat-exchanger-shell-tube-kettle-reboiler.svg`
- [x] `heat-exchanger-shell-tube-u-tube` → `heat-transfer/heat-exchanger-shell-tube-u-tube.svg`

### Batch 1e — Heat Transfer Part 2 + Vessels Part 1 (5 shapes) ✓ DONE
- [x] `heat-exchanger-plate` → `heat-transfer/heat-exchanger-plate.svg`
- [x] `heater-fired-box` → `heat-transfer/heater-fired-box.svg`
- [x] `heater-fired-cylindrical` → `heat-transfer/heater-fired-cylindrical.svg` *(derived — only heater-fired-opt1 in HTML; cylindrical constructed from ISA-101)*
- [x] `air-cooler` → `heat-transfer/air-cooler.svg`
- [x] `vessel-vertical` → `vessels/vessel-vertical-welded.svg` *(see D2)*

### Batch 1f — Vessels Part 2 (5 shapes) ✓ DONE
- [x] `vessel-vertical-flanged-top` → `vessels/vessel-vertical-flanged-top.svg`
- [x] `vessel-vertical-flanged-bottom` → `vessels/vessel-vertical-flanged-bottom.svg`
- [x] `vessel-vertical-flanged` → `vessels/vessel-vertical-flanged-both.svg`
- [x] `vessel-horizontal` → `vessels/vessel-horizontal-welded.svg` *(see D2)*
- [x] `vessel-horizontal-flanged-left` → `vessels/vessel-horizontal-flanged-left.svg`

### Batch 1g — Vessels Part 3 + Tanks Part 1 (5 shapes) ✓ DONE
- [x] `vessel-horizontal-flanged-right` → `vessels/vessel-horizontal-flanged-right.svg`
- [x] `vessel-horizontal-flanged` → `vessels/vessel-horizontal-flanged-both.svg`
- [x] `tank-storage-cone-roof` → `tanks/tank-storage-cone-roof.svg`
- [x] `tank-storage-dome-roof` → `tanks/tank-storage-dome-roof.svg`
- [x] `tank-storage-open-top` → `tanks/tank-storage-open-top.svg`

### Batch 1h — Tanks Part 2 + Reactors (6 shapes) ✓ DONE
- [x] `tank-storage-floating-roof` → `tanks/tank-storage-floating-roof.svg`
- [x] `tank-storage-sphere` → `tanks/tank-storage-sphere.svg`
- [x] `tank-storage-capsule` → `tanks/tank-storage-capsule.svg`
- [x] `reactor-base` → `reactors/reactor-base.svg`
- [x] `reactor-flat-top` → `reactors/reactor-flat-top.svg`
- [x] `reactor-closed` → `reactors/reactor-closed.svg`

### Batch 1i — Reactors Part 2 + Columns Narrow (5 shapes) ✓ DONE
- [x] `reactor-trayed` → `reactors/reactor-trayed.svg`
- [x] `column-distillation-narrow-plain` → `columns/column-distillation-narrow-plain.svg`
- [x] `column-distillation-narrow-trayed` → `columns/column-distillation-narrow-trayed-6.svg` *(see D3)*
- [x] `column-distillation-narrow-trayed-10` → `columns/column-distillation-narrow-trayed-10.svg`
- [x] `column-distillation-narrow-packed` → `columns/column-distillation-narrow-packed.svg`

### Batch 1j — Columns Standard (4 shapes) ✓ DONE
- [x] `column-distillation-standard-plain` → `columns/column-distillation-standard-plain.svg`
- [x] `column-distillation-standard-trayed` → `columns/column-distillation-standard-trayed-6.svg` *(see D3)*
- [x] `column-distillation-standard-trayed-10` → `columns/column-distillation-standard-trayed-10.svg`
- [x] `column-distillation-standard-packed` → `columns/column-distillation-standard-packed.svg`

### Batch 1k — Columns Wide (4 shapes) ✓ DONE
- [x] `column-distillation-wide-plain` → `columns/column-distillation-wide-plain.svg`
- [x] `column-distillation-wide-trayed` → `columns/column-distillation-wide-trayed-6.svg` *(see D3)*
- [x] `column-distillation-wide-trayed-10` → `columns/column-distillation-wide-trayed-10.svg`
- [x] `column-distillation-wide-packed` → `columns/column-distillation-wide-packed.svg`

### Batch 1l — Separation: Filters + Mixers (5 shapes) ✓ DONE
- [x] `filter-standard` → `filters/filter-standard.svg`
- [x] `filter-vacuum` → `filters/filter-vacuum.svg`
- [x] `mixer-agitator` → `mixers/mixer-agitator.svg`
- [x] `mixer-agitator-motor` → `mixers/mixer-agitator-motor.svg`
- [x] `mixer-inline-static` → `mixers/mixer-inline-static.svg`

### Batch 1m — Instrumentation Part 1 (5 shapes) ✓ DONE
- [x] `instrument-field` → `instrumentation/instrument-field.svg`
- [x] `instrument-panel` → `instrumentation/instrument-panel.svg`
- [x] `instrument-behind-panel` → `instrumentation/instrument-behind-panel.svg`
- [x] `alarm-annunciator-opt1` → `instrumentation/alarm-annunciator-opt1.svg` *(HTML id: `alarm-annunciator` bare)*
- [x] `alarm-annunciator-opt2` → `instrumentation/alarm-annunciator-opt2.svg`

### Batch 1n — Instrumentation Part 2 + Actuator Parts (6 shapes) ✓ DONE
- [x] `interlock-standard` → `instrumentation/interlock-standard.svg` *(HTML id: `interlock` bare)*
- [x] `interlock-sis` → `instrumentation/interlock-sis.svg`
- [x] `interlock-padlock` → `instrumentation/interlock-padlock.svg` *(HTML id: `interlock-opt2`)*
- [x] `actuator-pneumatic` → `actuators/part-actuator-diaphragm.svg` *(see D1)*
- [x] `actuator-electric` → `actuators/part-actuator-motor.svg` *(see D1)*
- [x] `actuator-hydraulic` → `actuators/part-actuator-solenoid.svg` *(see D1)*

### Batch 1o — Fail Indicators + Agitators Part 1 (6 shapes) ✓ DONE
- [x] `fail-open` → `indicators/part-fail-open.svg`
- [x] `fail-close` → `indicators/part-fail-closed.svg`
- [x] `fail-last` → `indicators/part-fail-last.svg` *(not in preview — derived as double horizontal bar + "FL" label)*
- [x] `agitator-turbine` → `agitators/agitator-turbine.svg` *(upgraded from v1.0 to v2)*
- [x] `agitator-propeller` → `agitators/agitator-propeller.svg` *(upgraded from v1.0 to v2)*
- [x] `agitator-anchor` → `agitators/agitator-anchor.svg` *(upgraded from v1.0 to v2)*

### Batch 1p — Agitators Part 2 + Supports Part 1 (5 shapes) ✓ DONE
- [x] `agitator-paddle` → `agitators/agitator-paddle.svg` *(upgraded from v1.0 to v2)*
- [x] `agitator-helical` → `agitators/agitator-helical.svg` *(upgraded from v1.0 to v2)*
- [x] `support-skirt` → `supports/support-skirt.svg` *(upgraded from v1.0 to v2; nozzle-top at y=66)*
- [x] `support-legs-3` → `supports/support-legs-3.svg` *(upgraded from v1.0 to v2; nozzle-top at y=66)*
- [x] `support-legs-4` → `supports/support-legs-4.svg` *(upgraded from v1.0 to v2; nozzle-top at y=66)*

### Batch 1q — Supports Part 2 (2 shapes) ✓ DONE
- [x] `support-legs-splayed` → `supports/support-legs-splayed.svg` *(upgraded from v1.0 to v2; added foot pads, connections group; nozzle-top at (35,0))*
- [x] `support-saddles` → `supports/support-saddles.svg` *(upgraded from v1.0 to v2; added connections group; nozzle-top at (40,0))*

### Batch 1r — Cleanup (no new shapes — delete stale files) ✓ DONE
- [x] Delete stale files listed in "Stale Files to Delete" section above
- [x] Verify `frontend/public/shapes/index.json` lists all new filenames *(index.json is fully stale — all IDs and category names use old v1.0 naming; update is Phase 2)*

---

## Cleanup Notes (Batch 1r)

**Directories deleted (entire):**
- `heat-exchange/` — 11 files (old HX SVGs + v1.0 JSON sidecars)
- `control/` — 5 files (old alarm-annunciator, interlock v1.0 SVGs)
- `instruments/` — 6 files (duplicate of instrumentation/, v1.0 SVGs + JSON sidecars)
- `separation/` — 11 files (old column/filter/mixer SVGs with wrong naming)
- `piping/` — 5 files (not Tier 1 shapes)

**Individual files deleted:**
- `pumps/pump-centrifugal.svg` → replaced by `pump-centrifugal-opt1/opt2.svg`
- `pumps/pump-positive-displacement.svg` → replaced by `pump-positive-displacement-opt1/opt2.svg`
- `rotating/compressor.svg` → replaced by `compressor-opt1/opt2.svg`
- `rotating/fan-blower.svg` → replaced by `fan-blower-opt1/opt2.svg`
- `rotating/motor.svg` → replaced by `motor-opt1/opt2.svg`
- `heat-transfer/heater-fired.svg` → replaced by `heater-fired-box.svg` + `heater-fired-cylindrical.svg`
- `interlocks/interlock-opt2.svg` → replaced by `instrumentation/interlock-padlock.svg`
- `indicators/position-indicator.svg` → not in spec
- `actuators/actuator-hydraulic.svg` → replaced by `part-actuator-solenoid.svg`
- `actuators/actuator-handwheel.svg` → not in spec

**Skipped (not on delete list):**
- `actuators/actuator-electric.svg`, `actuator-pneumatic.svg` — old v1.0 files; replaced by `part-actuator-motor.svg` / `part-actuator-diaphragm.svg` but not explicitly listed
- `interlocks/interlock.svg`, `interlock-sis.svg` + all `.json` sidecars in interlocks/ — old v1.0 files; not listed (interlocks/ dir itself not on delete list)
- All other `.json` sidecar files in pumps/, rotating/, heat-transfer/, etc. — v1.0 orphaned sidecars; Phase 2 will replace with new sidecar format
- `annunciators/` directory — not on delete list

**index.json status:** Fully stale. All 28 entries reference old IDs (e.g. `pump-centrifugal`, `hx-shell-tube`) and old category names (`heat-exchange`, `instruments`). Needs complete replacement in Phase 2.

---

## Completion Summary

- Batches complete: 18 / 18
- Shapes extracted: 85 / ~86
- Stale files deleted: 38 files across 5 directories + 10 individual files
