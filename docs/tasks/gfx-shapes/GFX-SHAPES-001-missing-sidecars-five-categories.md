---
id: GFX-SHAPES-001
title: Add JSON sidecars for heat-transfer, separation, control, actuators, indicators
unit: GFX-SHAPES
status: pending
priority: high
depends-on: [GFX-SHAPES-002]
---

## What This Feature Should Do

Every SVG shape file in the library must have a companion JSON sidecar that defines connection points, text zones, value anchors, alarm anchor, states, and geometry. Five spec-required categories currently have SVG files with no sidecars at all, making them non-functional for pipe snapping, state coloring, data binding, and Designer palette use.

## Spec Excerpt (verbatim)

> "Every shape is a standalone SVG file with a companion JSON sidecar. The SVG contains the visual geometry. The JSON contains metadata (connection points, text zones, value anchors, state definitions, composable parts)."
> — shape-library-implementation-spec.md, §Core Principles

> "A shape without a sidecar is incomplete."
> — SPEC_MANIFEST.md §GFX-SHAPES, Architectural non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/public/shapes/heat-transfer/` — 4 SVGs present: `heat-exchanger-shell-tube.svg`, `heat-exchanger-plate.svg`, `heater-fired.svg`, `air-cooler.svg`; 0 JSON sidecars
- `frontend/public/shapes/separation/` — 17 SVGs present: 12 column variants + `filter.svg`, `filter-vacuum.svg`, `mixer.svg`, `mixer-motor.svg`, `mixer-inline.svg`; 0 JSON sidecars
- `frontend/public/shapes/control/` — 5 SVGs: `alarm-annunciator.svg`, `alarm-annunciator-opt2.svg`, `interlock.svg`, `interlock-sis.svg`, `interlock-opt2.svg`; 0 JSON sidecars
- `frontend/public/shapes/actuators/` — 4 SVGs: `actuator-pneumatic.svg`, `actuator-electric.svg`, `actuator-hydraulic.svg`, `actuator-handwheel.svg`; 0 JSON sidecars
- `frontend/public/shapes/indicators/` — 3 SVGs: `fail-open.svg`, `fail-close.svg`, `position-indicator.svg`; 0 JSON sidecars
- `frontend/public/shapes/heat-exchange/` — this is a WRONG directory. It contains sidecars for `hx-shell-tube`, `hx-plate`, `heater-fired-opt1`, `air-cooler` with wrong shape IDs. These must be migrated to `heat-transfer/` with corrected IDs.
- `frontend/public/shapes/annunciators/`, `interlocks/`, `filters/`, `mixers/` — WRONG directories containing sidecars for control/separation shapes. Must be migrated to correct directories.

## Verification Checklist

- [ ] `frontend/public/shapes/heat-transfer/heat-exchanger-shell-tube.json` exists with `shape_id: "heat-exchanger-shell-tube"` and `category: "heat-transfer"`
- [ ] `frontend/public/shapes/heat-transfer/heat-exchanger-plate.json` exists with `shape_id: "heat-exchanger-plate"` and `category: "heat-transfer"`
- [ ] `frontend/public/shapes/heat-transfer/heater-fired.json` exists with `shape_id: "heater-fired"` and `category: "heat-transfer"`
- [ ] `frontend/public/shapes/heat-transfer/air-cooler.json` exists with `shape_id: "air-cooler"` and `category: "heat-transfer"`
- [ ] `frontend/public/shapes/control/alarm-annunciator.json` exists with `shape_id: "alarm-annunciator"` and `category: "control"`
- [ ] `frontend/public/shapes/control/interlock.json` exists with `shape_id: "interlock"` and `category: "control"`
- [ ] `frontend/public/shapes/separation/filter.json` exists with `category: "separation"`
- [ ] `frontend/public/shapes/separation/mixer.json` exists with `category: "separation"`
- [ ] `frontend/public/shapes/actuators/*.json` sidecars exist for all 4 actuator SVGs, with `isPart: true` and `partClass: "actuator"`
- [ ] `frontend/public/shapes/indicators/fail-open.json` and `fail-close.json` exist with `isPart: true` and `partClass: "indicator"`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: Five categories (heat-transfer, separation, control, actuators, indicators) have SVG files but no JSON sidecars in their correct spec directories. Partial sidecars exist in wrong directories (`heat-exchange/`, `annunciators/`, `interlocks/`, `filters/`, `mixers/`) with wrong IDs. These must be renamed, corrected, and moved.

## Fix Instructions (if needed)

**Step 1 — Migrate heat-transfer:**
- `heat-exchange/hx-shell-tube.json` → rename to `heat-transfer/heat-exchanger-shell-tube.json`, change `shape_id` to `"heat-exchanger-shell-tube"`, change `category` to `"heat-transfer"`, update `variants.options.opt1.file` to `"heat-exchanger-shell-tube.svg"` or update to `"hx-shell-tube-opt1.svg"` depending on which SVG is kept
- `heat-exchange/hx-plate.json` → `heat-transfer/heat-exchanger-plate.json` with `shape_id: "heat-exchanger-plate"`, `category: "heat-transfer"`
- `heat-exchange/heater-fired.json` → `heat-transfer/heater-fired.json` with `shape_id: "heater-fired"`, `category: "heat-transfer"` — remove `-opt1` from sidecar `shape_id`; the `heater-fired-opt1` sidecar in `heat-exchange/` has `category: "heat-exchange"` (wrong)
- `heat-exchange/air-cooler.json` → `heat-transfer/air-cooler.json` with `category: "heat-transfer"`

**Step 2 — Migrate control:**
- `annunciators/alarm-annunciator.json` → `control/alarm-annunciator.json`, fix `category: "control"`, remove opt2 as a separate sidecar (merge into `variants.options.opt2`)
- `interlocks/interlock.json` → `control/interlock.json`, fix `category: "control"`, consolidate interlock-sis and interlock-opt2 into `variants`

**Step 3 — Migrate separation:**
- `filters/filter.json` → `separation/filter.json`, fix `category: "separation"`
- `mixers/mixer.json` → `separation/mixer.json`, fix `category: "separation"`, add mixer-motor and mixer-inline as configurations

**Step 4 — Add actuator sidecars:**
Each actuator is a composable part, not a full shape. Schema fields needed: `$schema`, `shape_id`, `version`, `category: "actuators"`, `isPart: true`, `partClass: "actuator"`, `geometry.viewBox`, `attachmentPoint` (the stem/top connection), `states` with `io-running`/`io-stopped`/`io-fault`/`io-oos`.

**Step 5 — Add indicator sidecars:**
`fail-open.json`, `fail-close.json` with `isPart: true`, `partClass: "indicator"`, `category: "indicators"`, `geometry.viewBox`, `attachmentPoint`.

**Step 6 — Update index.json:**
After migration, update `frontend/public/shapes/index.json` to reflect correct categories (`heat-transfer` not `heat-exchange`, etc.) and add entries for all newly-sidecarred shapes. Also see GFX-SHAPES-002 for the full index.json consolidation.

Do NOT:
- Create new SVG files — the SVG geometry is mostly correct; only sidecars need to be fixed or moved
- Use `category: "annunciators"`, `category: "interlocks"`, `category: "filters"`, `category: "mixers"`, or `category: "heat-exchange"` — all wrong per spec
- Leave the stale wrong-directory sidecars in place alongside the correct ones — delete them once the correct sidecars are in place
