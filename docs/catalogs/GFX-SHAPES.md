---
unit: GFX-SHAPES
audited: 2026-03-21
relationship: OVERHAUL
spec-files:
  - /home/io/spec_docs/shape-library-implementation-spec.md
  - /home/io/io-dev/io/design-docs/35_SHAPE_LIBRARY.md
result: ⚠️ Gaps found
tasks-generated: 7
---

## Summary

The shape library has most SVG files present and state-neutral (correct gray strokes, no hardcoded operational colors). Six core categories are fully correct in their SVG geometry (valves, pumps, rotating, instruments, reactors, tanks). However, five spec-required categories lack JSON sidecars entirely (`heat-transfer/`, `separation/`, `control/`, `actuators/`, `indicators/`), nine extraneous directories exist that are not in the spec, shape ID and category naming is inconsistent between directories and seed data, SVG files are missing mandatory `data-io-version` and `data-io-category` attributes and `io-text-zones` groups, column sidecars are missing 6 of 12 required variant configurations, and `seed_shapes.rs` seeds shapes under different IDs than the static sidecars, breaking the batch API path.

## Non-Negotiables

| # | Non-Negotiable | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Every shape has both an SVG and a JSON sidecar | ⚠️ Wrong | `heat-transfer/`: 4 SVGs, 0 JSON; `separation/`: 17 SVGs, 0 JSON; `control/`: 5 SVGs, 0 JSON; `actuators/`: 4 SVGs, 0 JSON; `indicators/`: 3 SVGs, 0 JSON. Parallel sidecars exist in wrong directories (`heat-exchange/`, `annunciators/`, `interlocks/`, `filters/`, `mixers/`) |
| 2 | SVG files are state-neutral (gray strokes only, no operational state colors) | ✅ | All inspected SVGs use `stroke="#808080"` and `fill="none"` with `io-stateful` class. No `#059669`, `#D946EF`, `#FFAA00` found in any shape file |
| 3 | Shape file structure matches spec categories | ⚠️ Wrong | Nine extra directories not in spec: `heat-exchange/`, `annunciators/`, `interlocks/`, `filters/`, `mixers/`, `piping/`, `instrumentation/`, and `vessels/` contains misplaced reactor/tank SVGs. `index.json` uses `"heat-exchange"` instead of `"heat-transfer"`. Alarm-annunciator sidecar has `category: "annunciators"`; interlock sidecar has `category: "interlocks"`; filter sidecar has `category: "filters"` |
| 4 | Composable parts are separate SVG files, not baked into base shapes | ✅ | `actuators/`, `agitators/`, `supports/` contain separate composable SVGs. Base vessel/reactor/column SVGs contain no actuator/support geometry |
| 5 | `POST /api/v1/shapes/batch` endpoint exists and returns SVGs + sidecars in one request | ⚠️ Wrong | Endpoint exists (`services/api-gateway/src/main.rs` route, `handlers/graphics.rs:batch_shapes`). However `seed_shapes.rs` seeds pumps as `"pump-centrifugal-opt1"` and `"pump-centrifugal-opt2"` as separate DB rows; the static sidecar `pump-centrifugal.json` uses `shape_id: "pump-centrifugal"` with `variants.options`. Callers requesting `"pump-centrifugal"` get no DB hit and fall through to the static path, but the static path resolves to `pump-centrifugal-opt1.svg` via variants — this accidental fallback masks the broken DB path |
| 6 | `valueAnchors` defined in sidecars | ✅ | Present in all verified sidecars: `valves/valve-gate.json:31`, `pumps/pump-centrifugal.json:33`, `vessels/vessel-vertical.json`, `tanks/tank-storage-cone-roof.json`, `columns/column-distillation.json` |

## False-DONE Patterns

| Pattern | Present? | Evidence |
|---------|----------|----------|
| SVG files exist but JSON sidecars missing or wrong schema | ⚠️ Found | Five categories have 0 sidecars. Tank sidecar missing `$schema`, `version`, `alarmAnchor`, `states`. `heat-exchange/hx-shell-tube.json` uses `shape_id: "hx-shell-tube"` vs spec-required `"heat-exchanger-shell-tube"` |
| SVG files with hardcoded operational state colors | ✅ Not present | All SVGs use `#808080` only |
| Composable parts baked into base shapes | ✅ Not present | Actuators, agitators, supports are separate SVG files |
| Batch endpoint not existing (per-shape waterfall fetching) | ⚠️ Found | Batch endpoint exists but is fragmented: DB seeds use per-variant IDs; static sidecars use canonical shape ID with variants list. Clients request canonical ID, DB returns nothing, static fallback takes over silently |
| Shape count wrong vs spec | ⚠️ Found | Column sidecar `columns/column-distillation.json` lists 6 configurations; spec requires 12 (3 widths × 4 internal types). Missing: `narrow-trayed`, `narrow-trayed-10`, `narrow-packed`, `wide-trayed`, `wide-trayed-10`, `wide-packed` |
| SVG `viewBox` not matching sidecar `geometry.viewBox` | ✅ Not present | Verified: vessel-vertical (0 0 40 80 both), pump-centrifugal (0 0 48 48 both), instrument-field (0 0 40 40 both), column-distillation (0 0 44 120 both) |

## Wave 0 Contract Gaps

GFX-SHAPES is a Wave 1 asset library (static files + DB seed + cache). The Wave 0 contracts (CX-EXPORT, CX-POINT-CONTEXT, CX-RBAC, etc.) apply to interactive module UIs. No Wave 0 checks apply to this unit.

## Findings Summary

- [GFX-SHAPES-001] Five spec categories have SVG files but no JSON sidecars: `heat-transfer/`, `separation/`, `control/`, `actuators/`, `indicators/`
- [GFX-SHAPES-002] Wrong directory structure and category naming: nine extra directories; `index.json` uses `"heat-exchange"`; alarm-annunciator/interlock/filter sidecars in wrong directories with wrong category values; `vessels/` contains reactor and tank SVGs
- [GFX-SHAPES-003] SVG files missing mandatory `data-io-version` and `data-io-category` attributes: all valves, instruments, vessels, reactors, tanks, most columns SVGs
- [GFX-SHAPES-004] SVG files missing `<g class="io-text-zones">` group: absent from all valves, instruments, vessels, reactors, tanks, columns SVGs
- [GFX-SHAPES-005] Column sidecar missing 6 of 12 required variant configurations: `narrow-trayed`, `narrow-trayed-10`, `narrow-packed`, `wide-trayed`, `wide-trayed-10`, `wide-packed` not listed in `column-distillation.json`; the SVGs exist in `separation/` but are not referenced
- [GFX-SHAPES-006] Sidecar incomplete schema fields: tank sidecars missing `$schema`, `version`, `alarmAnchor`, `states`; pump opt1/opt2 sidecars in `pumps/` have `$schema` and `states` but are split as separate files rather than a single canonical sidecar with variants
- [GFX-SHAPES-007] `seed_shapes.rs` seeds pump and rotating shapes under per-variant IDs (`"pump-centrifugal-opt1"`, `"compressor-opt2"`, etc.) conflicting with the canonical shape ID model in static sidecars, causing the batch API to never return results for canonical shape ID queries
