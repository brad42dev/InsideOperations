---
id: GFX-SHAPES-004
title: Add io-text-zones group to all shape SVG files
unit: GFX-SHAPES
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every shape SVG file must include an `<g class="io-text-zones">` group containing empty `<text>` placeholder elements. The renderer fills these at runtime from live point data (tag names, process values). Without this group, the renderer cannot position text relative to the shape, and falls back to floating text that is disconnected from the shape geometry.

## Spec Excerpt (verbatim)

> "<!-- Text zones (positioned by sidecar, content from live data at runtime) -->
> <g class=\"io-text-zones\">
>   <text data-zone=\"tagname\" x=\"24\" y=\"-5\" text-anchor=\"middle\" class=\"io-tag-text\"></text>
>   <text data-zone=\"value\" x=\"24\" y=\"32\" text-anchor=\"middle\" class=\"io-value-text\"></text>
> </g>"
> — shape-library-implementation-spec.md, §SVG File Format

## Where to Look in the Codebase

Primary files:
- `frontend/public/shapes/valves/valve-gate.svg` — missing `io-text-zones` group (has `io-shape-body` and `io-connections` only)
- `frontend/public/shapes/instruments/instrument-field.svg` — missing `io-text-zones` group
- `frontend/public/shapes/vessels/vessel-vertical.svg` — missing `io-text-zones` group
- `frontend/public/shapes/columns/column-distillation.svg` — missing `io-text-zones` group

Grep command to find all SVGs lacking the group:
```
grep -rL "io-text-zones" frontend/public/shapes/
```

## Verification Checklist

- [ ] All SVGs in `valves/` contain `<g class="io-text-zones">` with at least a `data-zone="tagname"` text element
- [ ] All SVGs in `instruments/` contain `<g class="io-text-zones">` with a text element for the instrument designation
- [ ] All SVGs in `vessels/`, `reactors/`, `columns/`, `tanks/` contain `<g class="io-text-zones">`
- [ ] The `data-zone` attribute values in SVG text elements match the `id` values in the corresponding sidecar `textZones` array
- [ ] Text elements in `io-text-zones` are empty (no text content) — renderer fills them at runtime

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No SVG in the library currently has an `io-text-zones` group. Zero matches found with `grep -rL "io-text-zones"` covering all shape directories.

## Fix Instructions (if needed)

For each shape SVG, add the `io-text-zones` group after `io-connections`. The text element positions must match the `x`, `y` (or `offset`) values defined in the sidecar `textZones` array.

Example for valve-gate (sidecar has `textZones[0].id = "tagname"`, `x: 24`, `y: -6`):

```xml
<g class="io-text-zones">
  <text data-zone="tagname" x="24" y="-6" text-anchor="middle" class="io-tag-text"></text>
</g>
```

Example for instrument-field (spec says text zone in upper half for designation letters):

```xml
<g class="io-text-zones">
  <text data-zone="designation" x="20" y="24" text-anchor="middle" class="io-tag-text"></text>
</g>
```

For shapes that have multiple text zones (e.g., tanks with tagname + fill level), add one `<text>` element per zone, each with the correct `data-zone` ID matching the sidecar.

The text elements must be empty at file-write time — the renderer will populate them. Do not put placeholder strings like `"TAG"` or `"PV"` inside the text elements.

Do NOT:
- Add visible text zones to composable parts (actuators, agitators, supports, indicators) — composable parts do not have text zones
- Copy text zone `x/y` positions from a different shape — use the coordinates from each shape's own sidecar `textZones` array
- Add inline `<style>` blocks to define `.io-tag-text` — styles come from external CSS
