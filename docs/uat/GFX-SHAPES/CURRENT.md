---
unit: GFX-SHAPES
date: 2026-03-24
uat_mode: auto
verdict: pass
scenarios_tested: 10
scenarios_passed: 10
scenarios_failed: 0
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /designer loads real Designer hub page (Dashboards, Report Templates, Symbol Library, recent items) — no error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Designer Route | [GFX-SHAPES-005] Designer page renders without error | ✅ pass | Loaded /designer with full hub UI, no error boundary |
| 2 | Designer Route | [GFX-SHAPES-005] Designer page shows real content | ✅ pass | Shows Dashboards (9), Report Templates, Symbol Library, recent items |
| 3 | Column Shapes | [GFX-SHAPES-005] Column shapes in index.json with "columns" category | ✅ pass | 12 column entries found in index.json, all category="columns" |
| 4 | Column Shapes | [GFX-SHAPES-005] Column sidecar has exactly 12 configurations | ✅ pass | column-distillation.json variants.configurations has 12 entries |
| 5 | Column Shapes | [GFX-SHAPES-005] All 6 new column variants present in sidecar and index | ✅ pass | narrow-trayed, narrow-trayed-10, narrow-packed, wide-trayed, wide-trayed-10, wide-packed all confirmed |
| 6 | Tank Sidecars | [GFX-SHAPES-006] Tank sidecar has $schema, version, alarmAnchor, states | ✅ pass | All 6 tank-storage-*.json have all required fields |
| 7 | Tank Sidecars | [GFX-SHAPES-006] Tank alarmAnchor has correct {nx, ny} format | ✅ pass | alarmAnchor: {nx: 1.1, ny: -0.05} — correct normalized coordinate format |
| 8 | Tank Sidecars | [GFX-SHAPES-006] Tank states has standard state keys | ✅ pass | states has running, stopped, fault, transitioning, oos |
| 9 | Reactor Sidecars | [GFX-SHAPES-006] Reactor sidecars have alarmAnchor and states | ✅ pass | All 4 reactor-*.json have alarmAnchor (nx/ny format) and states |
| 10 | Shape Palette | [GFX-SHAPES-006] Tank shapes registered in index.json for palette | ✅ pass | 6 tank shapes in index.json: cone-roof, dome-roof, open-top, floating-roof, sphere, capsule |

## New Bug Tasks Created

None

## Screenshot Notes

Browser was intermittently crashing due to API rate limiting (many 429 responses from services not running). Scenarios 1–2 verified via browser; scenarios 3–10 verified via direct static file fetches (curl to localhost:5173/shapes/... and file system inspection). All shape data is served as static files by the Vite dev server and does not require backend API access.

Login credential: admin / changeme (not admin/admin — rate-limited during discovery).

Column sidecar (column-distillation.json) has all 12 configurations. Tank sidecars: all 6 have $schema, version, alarmAnchor (nx/ny), and states. Reactor sidecars: all 4 have alarmAnchor and states.
