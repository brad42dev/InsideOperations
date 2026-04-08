# Shape Extraction Batch Prompts

**Usage:** Paste batch 1a. When it finishes it will display batch 1b. Paste that. Repeat through 1r.
After 1r, a final prompt picks up Phase 0 of the implementation plan.

Progress tracker: `design-docs/shape-sidecar-spec/extraction-progress.md`
Implementation plan: `design-docs/shape-sidecar-spec/implementation-plan.md`

---

## BATCH 1a — Valves Part 1 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
It contains SVG rules (stroke #808080, io-shape-body group, data attributes, etc.) and discrepancy notes.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `valve-gate`       → `valves/valve-gate.svg`       (category: valves)
2. shape-id `valve-globe`      → `valves/valve-globe.svg`      (category: valves)
3. shape-id `valve-ball`       → `valves/valve-ball.svg`       (category: valves)
4. shape-id `valve-butterfly`  → `valves/valve-butterfly.svg`  (category: valves)
5. shape-id `valve-control`    → `valves/valve-control.svg`    (category: valves)

HOW TO EXTRACT EACH SHAPE:
1. Grep for `shape-id">valve-gate` in the source HTML to get the line number
2. Read ~80 lines from that offset to capture the full card + inline <svg>
3. Extract the <svg> element, apply SVG rules from the progress tracker
4. Write to the target file

Repeat for all 5 shapes. After writing all files, update the progress tracker marking these
5 shapes as [x] DONE and incrementing the completion summary counts.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1b" section, and output its complete code block contents verbatim so the user can
copy-paste it as the next prompt.
```

---

## BATCH 1b — Valves Part 2 + Pumps Part 1 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
It contains SVG rules and discrepancy notes.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `valve-relief`                → `valves/valve-relief.svg`                (category: valves)
2. shape-id `valve-relief-spring-loaded`  → `valves/valve-relief-spring-loaded.svg`  (category: valves)
3. shape-id `valve-relief-pilot-operated` → `valves/valve-relief-pilot-operated.svg` (category: valves)
4. shape-id `pump-centrifugal-opt1`       → `pumps/pump-centrifugal-opt1.svg`        (category: pumps)
5. shape-id `pump-centrifugal-opt2`       → `pumps/pump-centrifugal-opt2.svg`        (category: pumps)

NOTE: If `valve-relief-spring-loaded` or `valve-relief-pilot-operated` don't exist as separate
cards in the HTML, derive both variants from the base `valve-relief` card geometry (they differ
only in the bonnet/top detail). Create both files regardless.

HOW TO EXTRACT: Grep for each shape-id, read ~80 lines from offset, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1c" section, and output its complete code block contents verbatim.
```

---

## BATCH 1c — Pumps Part 2 + Rotating Part 1 (6 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `pump-positive-displacement-opt1` → `pumps/pump-positive-displacement-opt1.svg` (category: pumps)
2. shape-id `pump-positive-displacement-opt2` → `pumps/pump-positive-displacement-opt2.svg` (category: pumps)
3. shape-id `compressor-opt1`                 → `rotating/compressor-opt1.svg`              (category: rotating)
4. shape-id `compressor-opt2`                 → `rotating/compressor-opt2.svg`              (category: rotating)
5. shape-id `fan-blower-opt1`                 → `rotating/fan-blower-opt1.svg`              (category: rotating)
6. shape-id `fan-blower-opt2`                 → `rotating/fan-blower-opt2.svg`              (category: rotating)

HOW TO EXTRACT: Grep for each shape-id, read ~80 lines from offset, apply SVG rules, write file.

After all files written, update the progress tracker marking these 6 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1d" section, and output its complete code block contents verbatim.
```

---

## BATCH 1d — Rotating Part 2 + Heat Transfer Part 1 (6 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D4 (heat exchanger base vs variants).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `motor-opt1`                            → `rotating/motor-opt1.svg`                                (category: rotating)
2. shape-id `motor-opt2`                            → `rotating/motor-opt2.svg`                               (category: rotating)
3. shape-id `heat-exchanger-shell-tube`             → `heat-transfer/heat-exchanger-shell-tube.svg`           (category: heat-transfer)
4. shape-id `heat-exchanger-shell-tube-standard`    → `heat-transfer/heat-exchanger-shell-tube-standard.svg`  (category: heat-transfer)
5. shape-id `heat-exchanger-shell-tube-kettle-reboiler` → `heat-transfer/heat-exchanger-shell-tube-kettle-reboiler.svg` (category: heat-transfer)
6. shape-id `heat-exchanger-shell-tube-u-tube`      → `heat-transfer/heat-exchanger-shell-tube-u-tube.svg`   (category: heat-transfer)

NOTE (D4): If the base `heat-exchanger-shell-tube` card has the same geometry as `standard`, write
both files using that geometry. Add comment `<!-- base shape; see also -standard variant -->` in base.
Heat exchangers have more geometry — read ~100 lines from offset.

HOW TO EXTRACT: Grep for each shape-id, read ~80-100 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 6 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1e" section, and output its complete code block contents verbatim.
```

---

## BATCH 1e — Heat Transfer Part 2 + Vessels Part 1 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D2 (vessel welded suffix).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `heat-exchanger-plate`    → `heat-transfer/heat-exchanger-plate.svg`    (category: heat-transfer)
2. shape-id `heater-fired-box`        → `heat-transfer/heater-fired-box.svg`        (category: heat-transfer)
3. shape-id `heater-fired-cylindrical`→ `heat-transfer/heater-fired-cylindrical.svg`(category: heat-transfer)
4. shape-id `air-cooler`              → `heat-transfer/air-cooler.svg`              (category: heat-transfer)
5. shape-id `vessel-vertical`         → `vessels/vessel-vertical-welded.svg`        (category: vessels)

NOTE (D2): HTML shape-id is `vessel-vertical` but spec filename is `vessel-vertical-welded.svg`.
Use the spec filename. Set data-io-shape="vessel-vertical-welded".
Heaters are tall — read ~120 lines from offset. Add `<g class="io-shape-part-support">` to vessels.

HOW TO EXTRACT: Grep for each shape-id, read sufficient lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1f" section, and output its complete code block contents verbatim.
```

---

## BATCH 1f — Vessels Part 2 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D2 (vessel welded suffix — bare HTML id maps to -welded filename).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `vessel-vertical-flanged-top`    → `vessels/vessel-vertical-flanged-top.svg`    (category: vessels)
2. shape-id `vessel-vertical-flanged-bottom` → `vessels/vessel-vertical-flanged-bottom.svg` (category: vessels)
3. shape-id `vessel-vertical-flanged`        → `vessels/vessel-vertical-flanged-both.svg`   (category: vessels)
4. shape-id `vessel-horizontal`              → `vessels/vessel-horizontal-welded.svg`       (category: vessels)
5. shape-id `vessel-horizontal-flanged-left` → `vessels/vessel-horizontal-flanged-left.svg` (category: vessels)

NOTE: For shapes 3 and 4, the HTML id is shorter than the spec filename (bare `flanged` → `-both`;
bare `vessel-horizontal` → `-welded`). Use spec filenames and set data-io-shape to spec name.
Add `<g class="io-shape-part-support">` to all vessel shapes.

HOW TO EXTRACT: Grep for each shape-id, read ~80-100 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1g" section, and output its complete code block contents verbatim.
```

---

## BATCH 1g — Vessels Part 3 + Tanks Part 1 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `vessel-horizontal-flanged-right` → `vessels/vessel-horizontal-flanged-right.svg` (category: vessels)
2. shape-id `vessel-horizontal-flanged`       → `vessels/vessel-horizontal-flanged-both.svg`  (category: vessels)
3. shape-id `tank-storage-cone-roof`          → `tanks/tank-storage-cone-roof.svg`            (category: tanks)
4. shape-id `tank-storage-dome-roof`          → `tanks/tank-storage-dome-roof.svg`            (category: tanks)
5. shape-id `tank-storage-open-top`           → `tanks/tank-storage-open-top.svg`             (category: tanks)

NOTE: Shape 2 HTML id is bare `vessel-horizontal-flanged` → spec filename adds `-both`.
Tank shapes are large — read ~120 lines from offset. Tank body must be a closed path with
class `io-shape-body` (used as clip path by FillGauge). Add `<g class="io-shape-part-support">`.

HOW TO EXTRACT: Grep for each shape-id, read sufficient lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1h" section, and output its complete code block contents verbatim.
```

---

## BATCH 1h — Tanks Part 2 + Reactors Part 1 (6 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `tank-storage-floating-roof` → `tanks/tank-storage-floating-roof.svg` (category: tanks)
2. shape-id `tank-storage-sphere`        → `tanks/tank-storage-sphere.svg`        (category: tanks)
3. shape-id `tank-storage-capsule`       → `tanks/tank-storage-capsule.svg`       (category: tanks)
4. shape-id `reactor-base`               → `reactors/reactor-base.svg`            (category: reactors)
5. shape-id `reactor-flat-top`           → `reactors/reactor-flat-top.svg`        (category: reactors)
6. shape-id `reactor-closed`             → `reactors/reactor-closed.svg`          (category: reactors)

NOTE: Sphere and capsule have curved geometry — copy path `d` attributes exactly, never simplify.
Reactor shapes accept agitators and supports — add placeholder groups:
`<g class="io-shape-part-agitator">` and `<g class="io-shape-part-support">`.

HOW TO EXTRACT: Grep for each shape-id, read ~80-120 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 6 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1i" section, and output its complete code block contents verbatim.
```

---

## BATCH 1i — Reactors Part 2 + Columns Narrow (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D3 (column trayed-6 naming: HTML may omit the `-6` suffix).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `reactor-trayed`                       → `reactors/reactor-trayed.svg`                       (category: reactors)
2. shape-id `column-distillation-narrow-plain`     → `columns/column-distillation-narrow-plain.svg`      (category: columns)
3. shape-id `column-distillation-narrow-trayed`    → `columns/column-distillation-narrow-trayed-6.svg`   (category: columns)
4. shape-id `column-distillation-narrow-trayed-10` → `columns/column-distillation-narrow-trayed-10.svg`  (category: columns)
5. shape-id `column-distillation-narrow-packed`    → `columns/column-distillation-narrow-packed.svg`     (category: columns)

NOTE (D3): Shape 3 — HTML id may be `column-distillation-narrow-trayed` (no `-6`). Spec filename
requires `-trayed-6`. Use spec filename; set data-io-shape="column-distillation-narrow-trayed-6".
Columns are tall — read ~150 lines from offset. Preserve internal tray lines and packing symbols exactly.

HOW TO EXTRACT: Grep for each shape-id, read ~100-150 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1j" section, and output its complete code block contents verbatim.
```

---

## BATCH 1j — Columns Standard (4 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D3 (column trayed-6 naming).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `column-distillation-standard-plain`      → `columns/column-distillation-standard-plain.svg`     (category: columns)
2. shape-id `column-distillation-standard-trayed`     → `columns/column-distillation-standard-trayed-6.svg`  (category: columns)
3. shape-id `column-distillation-standard-trayed-10`  → `columns/column-distillation-standard-trayed-10.svg` (category: columns)
4. shape-id `column-distillation-standard-packed`     → `columns/column-distillation-standard-packed.svg`    (category: columns)

NOTE (D3): Shape 2 HTML id may omit `-6`. Use spec filename with `-trayed-6`.
Standard columns are medium-width. Preserve exact tray spacing and packing geometry.

HOW TO EXTRACT: Grep for each shape-id, read ~100-150 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 4 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1k" section, and output its complete code block contents verbatim.
```

---

## BATCH 1k — Columns Wide (4 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D3 (column trayed-6 naming).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `column-distillation-wide-plain`     → `columns/column-distillation-wide-plain.svg`     (category: columns)
2. shape-id `column-distillation-wide-trayed`    → `columns/column-distillation-wide-trayed-6.svg`  (category: columns)
3. shape-id `column-distillation-wide-trayed-10` → `columns/column-distillation-wide-trayed-10.svg` (category: columns)
4. shape-id `column-distillation-wide-packed`    → `columns/column-distillation-wide-packed.svg`    (category: columns)

NOTE (D3): Shape 2 HTML id may omit `-6`. Use spec filename with `-trayed-6`.
Wide columns have the largest viewBox of the three sizes. Copy packing geometry exactly.

HOW TO EXTRACT: Grep for each shape-id, read ~100-150 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 4 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1l" section, and output its complete code block contents verbatim.
```

---

## BATCH 1l — Filters + Mixers (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `filter-standard`      → `filters/filter-standard.svg`    (category: filters)
2. shape-id `filter-vacuum`        → `filters/filter-vacuum.svg`       (category: filters)
3. shape-id `mixer-agitator`       → `mixers/mixer-agitator.svg`       (category: mixers)
4. shape-id `mixer-agitator-motor` → `mixers/mixer-agitator-motor.svg` (category: mixers)
5. shape-id `mixer-inline-static`  → `mixers/mixer-inline-static.svg`  (category: mixers)

NOTE: The `filters/` and `mixers/` directories may not exist — create them.
Mixer shapes that have agitator geometry built in should still include
`<g class="io-shape-part-agitator">` for runtime composable overlay.

HOW TO EXTRACT: Grep for each shape-id, read ~80 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1m" section, and output its complete code block contents verbatim.
```

---

## BATCH 1m — Instrumentation Part 1 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `instrument-field`        → `instrumentation/instrument-field.svg`        (category: instrumentation)
2. shape-id `instrument-panel`        → `instrumentation/instrument-panel.svg`        (category: instrumentation)
3. shape-id `instrument-behind-panel` → `instrumentation/instrument-behind-panel.svg` (category: instrumentation)
4. shape-id `alarm-annunciator-opt1`  → `instrumentation/alarm-annunciator-opt1.svg`  (category: instrumentation)
5. shape-id `alarm-annunciator-opt2`  → `instrumentation/alarm-annunciator-opt2.svg`  (category: instrumentation)

NOTE: Instrument symbols (ISA bubbles) may contain internal text (F, P, T etc.) — preserve it
but remove hardcoded fill colors. Annunciator shapes may have grid/cell patterns — preserve exactly.

HOW TO EXTRACT: Grep for each shape-id, read ~80 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1n" section, and output its complete code block contents verbatim.
```

---

## BATCH 1n — Instrumentation Part 2 + Actuator Parts (6 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
Pay attention to discrepancy D1 (actuator naming: HTML uses pneumatic/electric/hydraulic;
spec filenames use diaphragm/motor/solenoid).

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `interlock-standard`  → `instrumentation/interlock-standard.svg`  (category: instrumentation)
2. shape-id `interlock-sis`       → `instrumentation/interlock-sis.svg`        (category: instrumentation)
3. shape-id `interlock-padlock`   → `instrumentation/interlock-padlock.svg`    (category: instrumentation)
4. shape-id `actuator-pneumatic`  → `actuators/part-actuator-diaphragm.svg`    (category: actuators)
5. shape-id `actuator-electric`   → `actuators/part-actuator-motor.svg`        (category: actuators)
6. shape-id `actuator-hydraulic`  → `actuators/part-actuator-solenoid.svg`     (category: actuators)

NOTE (D1): Shapes 4-6 use HTML ids (pneumatic/electric/hydraulic) but spec filenames
(diaphragm/motor/solenoid). Set data-io-shape to the SPEC name (e.g. "part-actuator-diaphragm").
Actuators are small narrow shapes — read ~60 lines from offset.

HOW TO EXTRACT: Grep for each shape-id, read ~60-80 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 6 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1o" section, and output its complete code block contents verbatim.
```

---

## BATCH 1o — Fail Indicators + Agitators Part 1 (6 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `fail-open`          → `indicators/part-fail-open.svg`    (category: indicators)
2. shape-id `fail-close`         → `indicators/part-fail-closed.svg`  (category: indicators)
3. shape-id `fail-last`          → `indicators/part-fail-last.svg`    (category: indicators)
4. shape-id `agitator-turbine`   → `agitators/agitator-turbine.svg`   (category: agitators)
5. shape-id `agitator-propeller` → `agitators/agitator-propeller.svg` (category: agitators)
6. shape-id `agitator-anchor`    → `agitators/agitator-anchor.svg`    (category: agitators)

NOTE: Shape 2 HTML id is `fail-close`; spec filename is `part-fail-closed` (different suffix).
Shape 3 `fail-last` may not exist in HTML — if absent, derive a minimal horizontal-bar (—)
symbol ~16x12px viewBox using the same style as fail-open/closed. Create the file regardless.
Create `indicators/` directory if needed.

HOW TO EXTRACT: Grep for each shape-id, read ~60 lines (indicators are tiny), apply SVG rules, write file.

After all files written, update the progress tracker marking these 6 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1p" section, and output its complete code block contents verbatim.
```

---

## BATCH 1p — Agitators Part 2 + Supports Part 1 (5 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `agitator-paddle`   → `agitators/agitator-paddle.svg`   (category: agitators)
2. shape-id `agitator-helical`  → `agitators/agitator-helical.svg`  (category: agitators)
3. shape-id `support-skirt`     → `supports/support-skirt.svg`      (category: supports)
4. shape-id `support-legs-3`    → `supports/support-legs-3.svg`     (category: supports)
5. shape-id `support-legs-4`    → `supports/support-legs-4.svg`     (category: supports)

NOTE: Support shapes attach to vessel/tank/reactor bottoms — stroke-only, no fills.
Skirt is a full-width cylinder; legs-3 and legs-4 are individual leg configurations.

HOW TO EXTRACT: Grep for each shape-id, read ~80 lines, apply SVG rules, write file.

After all files written, update the progress tracker marking these 5 shapes as [x] DONE.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1q" section, and output its complete code block contents verbatim.
```

---

## BATCH 1q — Supports Part 2 (2 shapes)

```
You are extracting SVG shapes for the I/O industrial process monitoring app shape library rebuild.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.

SOURCE HTML: `/home/io/io-dev/io/design-docs/shape-sidecar-spec/dark-shape-library-preview.html`
TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

SHAPES FOR THIS BATCH:
1. shape-id `support-legs-splayed` → `supports/support-legs-splayed.svg` (category: supports)
2. shape-id `support-saddles`      → `supports/support-saddles.svg`      (category: supports)

NOTE: Splayed legs have angled geometry. Saddle supports are two curved bracket shapes
for horizontal vessels. Stroke-only, no fills.

HOW TO EXTRACT: Grep for each shape-id, read ~80 lines, apply SVG rules, write file.

After both files written, update the progress tracker marking these 2 shapes as [x] DONE
and updating the "Shapes extracted" count in the completion summary.

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/batch-prompts.md`, find the
"## BATCH 1r" section, and output its complete code block contents verbatim.
```

---

## BATCH 1r — Cleanup (delete stale files)

```
You are performing the final cleanup step of the I/O shape library SVG extraction.

CONTEXT: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/extraction-progress.md` first.
The full list of stale files to delete is under "Stale Files to Delete" in that file.

TARGET BASE: `/home/io/io-dev/io/frontend/public/shapes/`

TASK: Delete all stale/legacy files and directories listed in the progress tracker.
Before deleting any directory, list its contents to confirm it contains only stale files
and no newly-extracted files from batches 1a-1q. Do not delete any file written during extraction.

After deletion:
1. List all directories under `frontend/public/shapes/` to verify the new structure
2. Confirm new directories exist (filters/, mixers/, instrumentation/, actuators/, indicators/, etc.)
3. Check `frontend/public/shapes/index.json` and note which entries need updating
   (do NOT update it yet — index.json update is Phase 2)

Update the progress tracker:
- Mark Batch 1r DONE
- Set "Batches complete: 18 / 18" in the completion summary
- Add a "Cleanup Notes" section listing what was deleted vs. skipped

FINAL STEP: Read `/home/io/io-dev/io/design-docs/shape-sidecar-spec/implementation-plan.md`
and output the complete contents of the "### Phase 0 Kickoff Prompt" code block verbatim
so the user can copy-paste it to begin the next phase of the implementation.
```

---

## Quick Reference

| Batch | Category | Shapes |
|-------|----------|--------|
| 1a | Valves Part 1 | 5 |
| 1b | Valves Part 2 + Pumps Part 1 | 5 |
| 1c | Pumps Part 2 + Rotating Part 1 | 6 |
| 1d | Rotating Part 2 + Heat Transfer Part 1 | 6 |
| 1e | Heat Transfer Part 2 + Vessels Part 1 | 5 |
| 1f | Vessels Part 2 | 5 |
| 1g | Vessels Part 3 + Tanks Part 1 | 5 |
| 1h | Tanks Part 2 + Reactors Part 1 | 6 |
| 1i | Reactors Part 2 + Columns Narrow | 5 |
| 1j | Columns Standard | 4 |
| 1k | Columns Wide | 4 |
| 1l | Filters + Mixers | 5 |
| 1m | Instrumentation Part 1 | 5 |
| 1n | Instrumentation Part 2 + Actuators | 6 |
| 1o | Fail Indicators + Agitators Part 1 | 6 |
| 1p | Agitators Part 2 + Supports Part 1 | 5 |
| 1q | Supports Part 2 | 2 |
| 1r | Cleanup (stale file deletion) | — |
| **Total** | | **~85 shapes** |
