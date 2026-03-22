---
id: GFX-SHAPES-007
title: Fix seed_shapes.rs shape IDs to match canonical sidecar IDs
unit: GFX-SHAPES
status: pending
priority: high
depends-on: [GFX-SHAPES-001, GFX-SHAPES-002]
---

## What This Feature Should Do

The `seed_shapes.rs` file seeds the `design_objects` table with shape data so the `POST /api/v1/shapes/batch` endpoint can return shapes from the database. Currently, the seeder uses per-variant shape IDs (`"pump-centrifugal-opt1"`, `"pump-centrifugal-opt2"`, `"compressor-opt1"`, etc.) while the canonical model uses a single ID per equipment type (`"pump-centrifugal"`, `"compressor"`) with variants described in the sidecar. When the renderer requests `"pump-centrifugal"` from the batch endpoint, the DB query returns nothing because no row has `shape_id = "pump-centrifugal"`, only rows for `"pump-centrifugal-opt1"` and `"pump-centrifugal-opt2"`.

## Spec Excerpt (verbatim)

> "Both options share the same JSON sidecar — connection points, text zones, state definitions, and recognition class are identical."
> — shape-library-implementation-spec.md, §Options (Design Style)

> "Single-shape fetching per-render is wrong (causes waterfall)."
> — SPEC_MANIFEST.md §GFX-SHAPES, Architectural non-negotiables #5

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/seed_shapes.rs` — lines 221–600+ define pump, rotating, and heat-transfer shapes using per-variant IDs
- `services/api-gateway/src/handlers/graphics.rs` — `batch_shapes` handler queries `metadata->>'shape_id' = ANY($1)`. Request must use canonical ID to match seeded rows.
- `frontend/src/shared/graphics/shapeCache.ts` — `fetchShapes()` calls `batchFetch(missing)` where `missing` contains canonical shape IDs from `index.json`. These canonical IDs will not match the per-variant DB rows.
- `services/api-gateway/src/seed_shapes.rs:241` — seeds `shape_id: "pump-centrifugal-opt1"` with its own inline sidecar JSON
- `services/api-gateway/src/seed_shapes.rs:561` — seeds `shape_id: "heater-fired-opt1"` but the static file is named `heater-fired.svg` and spec shape ID is `"heater-fired"`

## Verification Checklist

- [ ] `seed_shapes.rs` seeds pumps as `shape_id: "pump-centrifugal"` (canonical) with a sidecar that contains `variants.options` pointing to `pump-centrifugal.svg` (opt1) and `pump-centrifugal-opt2.svg` (opt2)
- [ ] `seed_shapes.rs` seeds rotating equipment as `shape_id: "compressor"`, `"fan-blower"`, `"motor"` (not `"compressor-opt1"` etc.)
- [ ] `seed_shapes.rs` seeds heat-transfer shapes as `shape_id: "heat-exchanger-shell-tube"`, `"heat-exchanger-plate"` (not `"hx-shell-tube"`)
- [ ] `seed_shapes.rs` category field for heat-transfer shapes is `"heat-transfer"` (not `"heat-exchange"`)
- [ ] The `batch_shapes` handler returns a shape when called with `["pump-centrifugal"]` (canonical ID)
- [ ] `seed_shapes.rs` does NOT create separate rows for opt1 and opt2 — the single canonical row's sidecar JSON encodes both options

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `seed_shapes.rs` uses per-variant IDs throughout the pump and rotating sections. The DB shape IDs are `"pump-centrifugal-opt1"` and `"pump-centrifugal-opt2"`, not `"pump-centrifugal"`. Heat-transfer shapes are seeded as `"hx-shell-tube"` / `"hx-plate"` instead of `"heat-exchanger-shell-tube"` / `"heat-exchanger-plate"`. The batch API is effectively broken for these categories.

## Fix Instructions (if needed)

**For pump-centrifugal** — replace the two seeded rows (opt1 and opt2) with a single row:

```rust
ShapeSeed {
    shape_id: "pump-centrifugal",
    category: "pump",
    svg_data: r#"<svg ... data-io-shape="pump-centrifugal" ...>...</svg>"#,
    sidecar: r#"{
      "$schema": "io-shape-v1",
      "shape_id": "pump-centrifugal",
      "version": "1.0",
      "category": "pumps",
      "variants": {
        "options": {
          "opt1": { "file": "pump-centrifugal.svg", "label": "ISA Standard" },
          "opt2": { "file": "pump-centrifugal-opt2.svg", "label": "Graphical" }
        },
        "configurations": []
      },
      ...geometry, connections, textZones, valueAnchors, alarmAnchor, states...
    }"#,
}
```

Note: the `svg_data` field in the DB row should store the opt1 (canonical) SVG. The renderer uses the sidecar `variants.options` to resolve which SVG file to load from the static path — the DB row's `svg_data` is the fallback.

**For heat-transfer shapes:**
- Change `shape_id: "hx-shell-tube"` → `"heat-exchanger-shell-tube"`, `category: "heat-transfer"`
- Change `shape_id: "hx-plate"` → `"heat-exchanger-plate"`, `category: "heat-transfer"`
- Change `shape_id: "heater-fired-opt1"` → `"heater-fired"`, `category: "heat-transfer"`
- Update inline sidecar JSON `"id"` and `"category"` fields accordingly

**For rotating:**
Apply same single-canonical-row pattern: `"compressor"`, `"fan-blower"`, `"motor"` — one row each, with `variants.options` pointing to both opt1 and opt2 SVG files.

**After fixing** — run the migration and verify with a direct DB query:
```sql
SELECT metadata->>'shape_id' FROM design_objects WHERE metadata->>'source' = 'library' ORDER BY 1;
```
Expected: one row per equipment type (`pump-centrifugal`, `compressor`, etc.), not per variant.

Do NOT:
- Keep per-variant DB rows alongside the canonical row — they will confuse the batch query
- Change the `batch_shapes` handler query — it is correct; fix the data it queries
- Hardcode opt2 SVG data in the DB row — the DB row SVG is opt1 (canonical); opt2 is loaded from static files via the sidecar variants
