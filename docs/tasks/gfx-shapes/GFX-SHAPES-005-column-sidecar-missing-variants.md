---
id: GFX-SHAPES-005
title: Add 6 missing column width-x-internal-type configurations to column sidecar
unit: GFX-SHAPES
status: pending
priority: medium
depends-on: [GFX-SHAPES-002]
---

## What This Feature Should Do

The column sidecar must list all 12 valid column body configurations (3 widths × 4 internal types). The Designer uses the sidecar's `variants.configurations` array to populate the variant picker dropdown. Currently only 6 configurations are listed (the 4 standard-width internal types + narrow plain + wide plain). The 6 width-x-internal combinations (narrow-trayed, narrow-trayed-10, narrow-packed, wide-trayed, wide-trayed-10, wide-packed) are not referenced, even though their SVG files exist in `separation/`.

## Spec Excerpt (verbatim)

> "Each width × 4 internal types (plain, trayed-6, trayed-10, packed) = 12 column body SVGs."
> — shape-library-implementation-spec.md, §Variants — Column width profiles

> "3 widths × 4 internals = 12 body SVGs"
> — shape-library-implementation-spec.md, §Composition Matrix

## Where to Look in the Codebase

Primary files:
- `frontend/public/shapes/columns/column-distillation.json` — `variants.configurations` array (currently 6 entries, needs 12)
- `frontend/public/shapes/separation/` — contains the 6 missing SVGs: `column-distillation-narrow-trayed.svg`, `column-distillation-narrow-trayed-10.svg`, `column-distillation-narrow-packed.svg`, `column-distillation-wide-trayed.svg`, `column-distillation-wide-trayed-10.svg`, `column-distillation-wide-packed.svg`
- `frontend/public/shapes/columns/` — only has 6 of 12 required SVGs; the other 6 are in `separation/`

## Verification Checklist

- [ ] `column-distillation.json` `variants.configurations` has exactly 12 entries
- [ ] Each entry has a `file`, `label`, and a `name` identifying the width + internal type
- [ ] The 6 missing SVG files are present in `columns/` directory (moved from `separation/` as part of GFX-SHAPES-002)
- [ ] `index.json` has entries for `column-distillation-narrow-trayed`, `column-distillation-narrow-trayed-10`, `column-distillation-narrow-packed`, `column-distillation-wide-trayed`, `column-distillation-wide-trayed-10`, `column-distillation-wide-packed`
- [ ] Each new index entry uses `"category": "columns"`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: 6 of 12 column configurations are missing from the sidecar. SVGs exist in `separation/` but are not referenced in the column sidecar and are not in `index.json`.

## Fix Instructions (if needed)

**Step 1 — Move the 6 missing SVGs** from `frontend/public/shapes/separation/` to `frontend/public/shapes/columns/`:
- `separation/column-distillation-narrow-trayed.svg` → `columns/column-distillation-narrow-trayed.svg`
- `separation/column-distillation-narrow-trayed-10.svg` → `columns/column-distillation-narrow-trayed-10.svg`
- `separation/column-distillation-narrow-packed.svg` → `columns/column-distillation-narrow-packed.svg`
- `separation/column-distillation-wide-trayed.svg` → `columns/column-distillation-wide-trayed.svg`
- `separation/column-distillation-wide-trayed-10.svg` → `columns/column-distillation-wide-trayed-10.svg`
- `separation/column-distillation-wide-packed.svg` → `columns/column-distillation-wide-packed.svg`

Also ensure the remaining items in `separation/` (filter, mixer SVGs) are accounted for — they stay in `separation/`.

**Step 2 — Update `column-distillation.json`** `variants.configurations` to include all 12:

```json
"configurations": [
  { "name": "standard-plain",       "file": "column-distillation.svg",                  "label": "Standard Plain",       "width": "standard", "internals": "plain" },
  { "name": "standard-trayed",      "file": "column-distillation-trayed.svg",            "label": "Standard Trayed-6",    "width": "standard", "internals": "trayed-6" },
  { "name": "standard-trayed-10",   "file": "column-distillation-trayed-10.svg",         "label": "Standard Trayed-10",   "width": "standard", "internals": "trayed-10" },
  { "name": "standard-packed",      "file": "column-distillation-packed.svg",            "label": "Standard Packed",      "width": "standard", "internals": "packed" },
  { "name": "narrow-plain",         "file": "column-distillation-narrow.svg",            "label": "Narrow Plain",         "width": "narrow",   "internals": "plain" },
  { "name": "narrow-trayed",        "file": "column-distillation-narrow-trayed.svg",     "label": "Narrow Trayed-6",      "width": "narrow",   "internals": "trayed-6" },
  { "name": "narrow-trayed-10",     "file": "column-distillation-narrow-trayed-10.svg",  "label": "Narrow Trayed-10",     "width": "narrow",   "internals": "trayed-10" },
  { "name": "narrow-packed",        "file": "column-distillation-narrow-packed.svg",     "label": "Narrow Packed",        "width": "narrow",   "internals": "packed" },
  { "name": "wide-plain",           "file": "column-distillation-wide.svg",              "label": "Wide Plain",           "width": "wide",     "internals": "plain" },
  { "name": "wide-trayed",          "file": "column-distillation-wide-trayed.svg",       "label": "Wide Trayed-6",        "width": "wide",     "internals": "trayed-6" },
  { "name": "wide-trayed-10",       "file": "column-distillation-wide-trayed-10.svg",    "label": "Wide Trayed-10",       "width": "wide",     "internals": "trayed-10" },
  { "name": "wide-packed",          "file": "column-distillation-wide-packed.svg",       "label": "Wide Packed",          "width": "wide",     "internals": "packed" }
]
```

**Step 3 — Update `index.json`** to add 6 new entries with `"category": "columns"`.

Do NOT:
- Create separate sidecars for narrow-trayed, wide-packed, etc. — all column variants share one sidecar (`column-distillation.json`)
- Remove the existing 6 narrow/wide/trayed entries — they are correct, just incomplete
