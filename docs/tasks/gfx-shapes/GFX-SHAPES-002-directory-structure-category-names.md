---
id: GFX-SHAPES-002
title: Consolidate directories to spec structure and fix category naming
unit: GFX-SHAPES
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The shape library must use exactly the directory and category names defined in the spec. Currently there are nine extra directories not in the spec, the `index.json` catalog uses wrong category values, sidecars use wrong category strings, and the `vessels/` directory contains misplaced reactor and tank SVGs. This causes the shape loader to look in wrong paths and the Designer palette to show wrong groupings.

## Spec Excerpt (verbatim)

> "categories must match spec: `valves/`, `pumps/`, `rotating/`, `heat-transfer/`, `instruments/`, `vessels/`, `reactors/`, `columns/`, `tanks/`, `separation/`, `control/`, `actuators/`, `agitators/`, `supports/`, `indicators/`."
> — SPEC_MANIFEST.md §GFX-SHAPES, Architectural non-negotiables #3

## Where to Look in the Codebase

Primary files:
- `frontend/public/shapes/` — top-level directory listing
- `frontend/public/shapes/index.json` — shape catalog (60 entries, currently uses `"heat-exchange"` as category)
- `frontend/public/shapes/heat-exchange/` — WRONG: should be `heat-transfer/`
- `frontend/public/shapes/annunciators/` — WRONG: alarm-annunciator belongs in `control/`
- `frontend/public/shapes/interlocks/` — WRONG: interlock belongs in `control/`
- `frontend/public/shapes/filters/` — WRONG: filter belongs in `separation/`
- `frontend/public/shapes/mixers/` — WRONG: mixer belongs in `separation/`
- `frontend/public/shapes/piping/` — NOT in spec: pipe-elbow.svg, pipe-straight.svg, pipe-tee.svg, reducer.svg, spectacle-blind.svg
- `frontend/public/shapes/instrumentation/` — NOT in spec; `instruments/` is the correct name
- `frontend/public/shapes/vessels/` — contains `reactor-*.svg` and `tank-storage-*.svg` that belong in `reactors/` and `tanks/`

## Verification Checklist

- [ ] `index.json` entry for `hx-shell-tube` (or `heat-exchanger-shell-tube`) uses `"category": "heat-transfer"` not `"heat-exchange"`
- [ ] `index.json` entries for alarm-annunciator and interlock use `"category": "control"`
- [ ] `index.json` entries for filter, filter-vacuum, mixer, mixer-motor, mixer-inline use `"category": "separation"`
- [ ] No directories named `heat-exchange/`, `annunciators/`, `interlocks/`, `filters/`, `mixers/` exist under `frontend/public/shapes/` (or they are empty/removed)
- [ ] `frontend/public/shapes/vessels/` contains only vessel SVGs (vessel-vertical, vessel-horizontal, and their flanged variants) — no reactor or tank SVGs
- [ ] `shapeCache.ts` `fetchShapesFromPublic` correctly resolves category to directory path for a shape in the `heat-transfer` category

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Nine extraneous directories exist. `index.json` uses wrong categories. Sidecars in wrong-category directories. `vessels/` contains non-vessel SVGs.

## Fix Instructions (if needed)

**Directory consolidation** (do in this order to avoid breaking the loader):

1. Move `heat-exchange/*.json` sidecars to `heat-transfer/` with corrected IDs (see GFX-SHAPES-001)
2. Move `annunciators/*.json` to `control/` (fix `category: "control"`)
3. Move `interlocks/*.json` to `control/`
4. Move `filters/*.json` to `separation/`
5. Move `mixers/*.json` to `separation/`
6. Remove the now-empty wrong directories (`heat-exchange/`, `annunciators/`, `interlocks/`, `filters/`, `mixers/`)
7. Remove or leave `piping/` — these are not shape library items but may be needed elsewhere; do NOT add them to `index.json` as shapes
8. Remove or leave `instrumentation/` — redundant with `instruments/`; do NOT reference both in index.json
9. From `vessels/`: remove `reactor-*.svg` and `tank-storage-*.svg` (authoritative copies are in `reactors/` and `tanks/`)

**Update `index.json`:**
- Change all entries with `"category": "heat-exchange"` to `"category": "heat-transfer"`
- Add missing `control/` entries for `alarm-annunciator`, `interlock`, `interlock-sis`, `interlock-opt2`
- Add missing `separation/` entries for `filter`, `filter-vacuum`, `mixer`, `mixer-motor`, `mixer-inline`
- Add `actuators/` entries for all 4 actuator parts
- Add `indicators/` entries for `fail-open`, `fail-close`
- Remove any entries that point to the old wrong directories

**`shapeCache.ts` (`frontend/src/shared/graphics/shapeCache.ts`):**
- Line 138: `const base = '/shapes/${category}/${id}'` — this is correct. The category from `index.json` is used as the directory name. After fixing `index.json` categories, this will resolve to the right path.
- No code change needed in `shapeCache.ts` itself if `index.json` categories are fixed.

Do NOT:
- Rename the `instruments/` directory — it is correct per spec
- Add piping elements to `index.json` as shapes — they are not ISA equipment shapes
- Duplicate sidecars in both old and new directories — causes ambiguity in the loader
