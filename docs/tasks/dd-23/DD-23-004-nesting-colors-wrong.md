---
id: DD-23-004
title: Fix nesting level colors to match Okabe-Ito spec with theme variants
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each nesting depth level (1–5) has a specified border color from the Okabe-Ito colorblind-safe palette, with separate values for light theme, dark theme, and high-contrast mode. High-contrast mode additionally uses border style variations (solid, dashed, dotted, double) rather than just color.

## Spec Excerpt (verbatim)

> | Level | Light Theme Border | Dark Theme Border | High Contrast Border Style |
> |-------|-------------------|-------------------|---------------------------|
> | 1 | `#0072B2` (blue) | `#56B4E9` | Solid, 2px |
> | 2 | `#D55E00` (orange) | `#E69F00` | Dashed, 2px |
> | 3 | `#009E73` (teal) | `#40C9A2` | Dotted, 2.5px |
> | 4 | `#CC3311` (vermillion) | `#EE6677` | Double, 3px |
> | 5 | `#7B2D8E` (purple) | `#AA88CC` | Solid, 3.5px |
> — design-docs/23_EXPRESSION_BUILDER.md, §6.5

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:121–126` — NESTING_COLORS array and getNestingColor function

## Verification Checklist

- [ ] NESTING_COLORS has 5 entries matching the light-theme spec values: `['#0072B2', '#D55E00', '#009E73', '#CC3311', '#7B2D8E']`
- [ ] A theme-aware variant exists returning different colors for dark theme
- [ ] High-contrast mode uses border-style variations (solid/dashed/dotted/double) in addition to color
- [ ] Depth index is 0-based so level 1 maps to index 0, level 5 to index 4 (no wrapping — stops at 5)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: Line 122: `const NESTING_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7']` — these are not the spec's light-theme values. No theme switching, no high-contrast border styles.

## Fix Instructions (if needed)

1. Replace `NESTING_COLORS` with separate theme-aware lookups. Read the active theme from CSS (e.g., check `document.documentElement.getAttribute('data-theme')` or use the app's theme context).
2. Define three constants:
   ```typescript
   const NESTING_LIGHT  = ['#0072B2', '#D55E00', '#009E73', '#CC3311', '#7B2D8E']
   const NESTING_DARK   = ['#56B4E9', '#E69F00', '#40C9A2', '#EE6677', '#AA88CC']
   const NESTING_BORDER_STYLES = ['solid 2px', 'dashed 2px', 'dotted 2.5px', 'double 3px', 'solid 3.5px']
   ```
3. Update `getNestingColor(depth, theme)` to return the correct color per theme. Depth 0 → index 0, depth 4 → index 4, depth >= 5 → clamp to index 4 (enforced by DD-23-003).
4. For high-contrast mode, return both the color and border style; pass the border style through to the container tile CSS.
5. Background tint should be `rgba(borderColor, 0.08)` light / `rgba(borderColor, 0.10)` dark / `rgba(borderColor, 0.15)` high-contrast per spec §6.5.

Do NOT:
- Keep the `depth % length` cycling — depth is capped at 5 by DD-23-003
