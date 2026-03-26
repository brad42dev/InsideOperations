---
id: DD-10-005
title: Replace hardcoded hex and rgba colors with design tokens in DashboardBuilder and PlaylistPlayer
unit: DD-10
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

All colors in the dashboards module must reference CSS custom properties from the design token registry. Hardcoded hex values (`#09090b`, `#ef4444`) and `rgba(…)` strings break theme switching and violate CX-TOKENS. Two files have residual violations: `DashboardBuilder.tsx` (3 occurrences) and `PlaylistPlayer.tsx` (kiosk overlay strip uses `#fff` and `rgba(255,255,255,…)` throughout).

## Spec Excerpt (verbatim)

> "All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties."
> — docs/SPEC_MANIFEST.md, §CX-TOKENS Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardBuilder.tsx` — line 313: `color: '#09090b'`; line 783: `color: '#ef4444'`, `background: 'rgba(239,68,68,0.1)'`; line 811: `color: '#09090b'`
- `frontend/src/pages/dashboards/PlaylistPlayer.tsx` — lines 248, 264, 280, 291: `color: '#fff'`; lines 300, 323, 381: `rgba(255,255,255,…)`

## Verification Checklist

- [ ] `DashboardBuilder.tsx` contains no hex color literals (`#[0-9a-fA-F]{3,6}`)
- [ ] `DashboardBuilder.tsx` contains no `rgba(` literals
- [ ] `PlaylistPlayer.tsx` kiosk overlay contains no `#fff` or `rgba(255,…)` literals
- [ ] All replacement values are CSS custom property references (`var(--io-…)`)

## Assessment

- **Status**: ⚠️ Violations present — 3 occurrences in DashboardBuilder.tsx, 7+ in PlaylistPlayer.tsx kiosk overlay

## Fix Instructions

In `frontend/src/pages/dashboards/DashboardBuilder.tsx`:
- Line 313: `color: '#09090b'` → `color: 'var(--io-btn-text)'` (button on accent background)
- Line 783: `color: '#ef4444'` → `color: 'var(--io-danger)'`; `background: 'rgba(239,68,68,0.1)'` → `background: 'color-mix(in srgb, var(--io-danger) 10%, transparent)'`
- Line 811: `color: '#09090b'` → `color: 'var(--io-btn-text)'`

In `frontend/src/pages/dashboards/PlaylistPlayer.tsx` (kiosk overlay strip):
- The overlay intentionally appears on a dark semi-transparent backdrop (`var(--io-surface-overlay)`). The white text and rgba overlays are there to ensure legibility against any dashboard content behind it.
- `color: '#fff'` → `color: 'var(--io-text-on-overlay)'` (if this token exists) or add token `--io-text-on-overlay: #fff` to all themes (it is invariant — overlay always dark)
- `background: 'rgba(255,255,255,0.15)'` → `background: 'var(--io-overlay-control-bg)'`; add token `--io-overlay-control-bg: rgba(255,255,255,0.15)` (invariant across themes)
- `border: '1px solid rgba(255,255,255,0.3)'` → `border: '1px solid var(--io-overlay-control-border)'`; add token `--io-overlay-control-border: rgba(255,255,255,0.3)`
- `color: 'rgba(255,255,255,0.7)'` → `color: 'var(--io-text-on-overlay-muted)'`; add token

If the design token registry (`frontend/src/shared/styles/tokens.ts` or equivalent) does not have overlay-specific tokens, add them — they are theme-invariant (always apply to dark overlay regardless of light/dark/hphmi theme selection).

Do NOT:
- Change the kiosk overlay background away from a dark treatment — it must contrast with unknown dashboard content underneath.
- Treat `PlaylistPlayer.tsx` overlay white colors as ISA-101 alarm tokens — they are not; they are UI chrome tokens.
