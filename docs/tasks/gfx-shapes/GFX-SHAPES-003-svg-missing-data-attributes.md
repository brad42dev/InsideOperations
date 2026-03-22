---
id: GFX-SHAPES-003
title: Add mandatory data-io-version and data-io-category attributes to SVG files
unit: GFX-SHAPES
status: pending
priority: medium
depends-on: [GFX-SHAPES-002]
---

## What This Feature Should Do

Every shape SVG file must carry three root attributes: `data-io-shape` (shape ID), `data-io-version` (version string), and `data-io-category` (equipment category). These attributes are used by the renderer and Designer to identify shapes without reading their sidecars. Currently, most SVGs have `data-io-shape` but are missing `data-io-version` and `data-io-category`.

## Spec Excerpt (verbatim)

> "| `data-io-shape` | Shape ID matching JSON sidecar filename |
> | `data-io-version` | Shape version (matches JSON) |
> | `data-io-category` | Equipment category for palette organization |"
> — shape-library-implementation-spec.md, §SVG Conventions — MANDATORY

## Where to Look in the Codebase

Primary files:
- `frontend/public/shapes/valves/valve-gate.svg` — has `data-io-shape="valve-gate"` but no `data-io-version` or `data-io-category`
- `frontend/public/shapes/instruments/instrument-field.svg` — same issue
- `frontend/public/shapes/vessels/vessel-vertical.svg` — same issue
- `frontend/public/shapes/reactors/reactor.svg` — likely same issue
- `frontend/public/shapes/tanks/tank-storage-cone-roof.svg` — likely same issue
- `frontend/public/shapes/columns/column-distillation.svg` — likely same issue
- `frontend/public/shapes/separation/column-distillation-narrow-trayed.svg` — has `data-io-version="3.0"` but no `data-io-category`
- `frontend/public/shapes/pumps/pump-centrifugal.svg` — has `data-io-shape`, `data-io-version`, `data-io-variant` but no `data-io-category`

## Verification Checklist

- [ ] All SVGs in `valves/`, `instruments/`, `vessels/`, `reactors/`, `tanks/` have `data-io-version` attribute
- [ ] All SVGs in all spec categories have `data-io-category` attribute matching their directory name (e.g., `data-io-category="valves"`)
- [ ] `data-io-version` value matches the `version` field in the corresponding JSON sidecar (e.g., `"1.0"`)
- [ ] SVG `data-io-shape` value matches the canonical `shape_id` in the JSON sidecar (not a variant ID like `"pump-centrifugal-opt1"`)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `data-io-version` and `data-io-category` are absent from most SVG files. The `separation/` column SVGs have `data-io-version="3.0"` but no `data-io-category`. Pump SVGs have `data-io-variant` (non-standard attribute) but no `data-io-category`.

## Fix Instructions (if needed)

For each SVG file in every spec category, ensure the root `<svg>` element has all three required attributes:

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 48 24"
     data-io-shape="valve-gate"
     data-io-version="1.0"
     data-io-category="valves">
```

The `data-io-category` value must exactly match the directory name that will be used after the GFX-SHAPES-002 restructuring:
- `valves` — for all valve SVGs
- `pumps` — for pump SVGs
- `rotating` — for compressor, fan-blower, motor
- `heat-transfer` — for heat exchanger, heater, air cooler SVGs
- `instruments` — for instrument-field, panel, behind-panel
- `vessels` — for vessel-vertical, vessel-horizontal and flanged variants only
- `reactors` — for reactor, reactor-flat-top, reactor-closed, reactor-trayed
- `columns` — for all column-distillation variants
- `tanks` — for all tank-storage variants
- `separation` — for filter, mixer and their variants
- `control` — for alarm-annunciator, interlock and their variants
- `actuators` — for all actuator SVGs
- `agitators` — for all agitator SVGs
- `supports` — for all support SVGs
- `indicators` — for fail-open, fail-close

Remove `data-io-variant` from pump SVGs — this is non-standard. Variant information is in the sidecar's `variants.options`, not in the SVG attribute.

Do NOT:
- Use different category values in SVG attributes vs the `index.json` category field — they must be identical
- Add `data-io-category` before completing GFX-SHAPES-002 restructuring, as the category value would be the wrong directory name
