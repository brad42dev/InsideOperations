---
id: GFX-DISPLAY-003
title: Replace hardcoded signal line stroke color with DE_COLORS.borderStrong token
unit: GFX-DISPLAY
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Signal lines connecting display elements to their parent shapes use a dashed SVG `<line>` with stroke color `#52525B` (`--io-border-strong`). This color is currently hardcoded as the string `"#52525B"` in 5 locations in SceneRenderer.tsx, bypassing the token system. It should use `DE_COLORS.borderStrong` so that if the design token is overridden in a custom theme, signal lines respond correctly.

## Spec Excerpt (verbatim)

> **Signal line** — dashed connector from display element back to parent SymbolInstance when `cfg.showSignalLine`. Drawn in SVG as `<line>` with `strokeDasharray="3 2"`.
> — display-elements-implementation-spec.md, §Signal Lines

> **Stroke**: `#52525B` (`--io-border-strong`)
> — display-elements-implementation-spec.md, §Signal Lines

> All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors.
> — SPEC_MANIFEST.md, CX-TOKENS Non-Negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — lines 542, 590, 726, 771, 797: five occurrences of `stroke="#52525B"` on signal line `<line>` elements (one per display element type)
- `frontend/src/shared/graphics/displayElementColors.ts` — line 26: `borderStrong: 'var(--io-border-strong, #52525B)'` — the token reference to use

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] No occurrence of `stroke="#52525B"` on a signal line `<line>` element in SceneRenderer.tsx
- [ ] All 5 signal line `<line>` elements use `stroke={DE_COLORS.borderStrong}` (JSX expression, not a string literal)
- [ ] `DE_COLORS` is imported at the top of SceneRenderer.tsx and used for signal line stroke
- [ ] The dash pattern `strokeDasharray="3 2"` and `strokeWidth={0.75}` are unchanged

## Assessment

- **Status**: ⚠️ Wrong (minor)
- **Current state**: SceneRenderer.tsx has 5 occurrences of `stroke="#52525B"` for signal lines (at lines 542, 590, 726, 771, 797). `DE_COLORS.borderStrong` resolves to `var(--io-border-strong, #52525B)` — same value in dark theme, but the token wrapper is needed for theme compliance.

## Fix Instructions

In `frontend/src/shared/graphics/SceneRenderer.tsx`, find and replace all 5 signal line `<line>` elements that have `stroke="#52525B"`.

Change each from:
```tsx
stroke="#52525B"
```
To:
```tsx
stroke={DE_COLORS.borderStrong}
```

Confirm `DE_COLORS` is already imported at the top of SceneRenderer.tsx (it is — search for `import.*DE_COLORS`). No new import needed.

The five locations are:
1. Line 542 — text_readout signal line
2. Line 590 — digital_status signal line
3. Line 726 — sparkline signal line
4. Line 771 — fill_gauge vessel_overlay signal line
5. Line 797 — fill_gauge standalone signal line

Do NOT change:
- `strokeWidth={0.75}` — correct per spec
- `strokeDasharray="3 2"` — correct per spec
- Any signal line `x1`, `y1`, `x2`, `y2` coordinates
- Any non-signal-line uses of `"#52525B"` elsewhere in the file (e.g. pipe label text uses `DE_COLORS.textMuted`)
