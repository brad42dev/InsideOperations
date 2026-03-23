---
id: MOD-CONSOLE-013
unit: MOD-CONSOLE
title: Replace hardcoded hex colors in Console with design token CSS variables
priority: low
wave: 2
depends_on: []
audit_round: 1
---

## Problem

The Console module uses hardcoded hex color values in semantic positions, violating the CX-TOKENS cross-cutting contract. These must be replaced with CSS custom properties from the design token system.

## Evidence

From `docs/catalogs/MOD-CONSOLE.md` (CX-TOKENS row):

- `frontend/src/modules/console/index.tsx:60-103` — `#22C55E`, `#F59E0B`, `#EF4444` for connection/mode status dots in the status bar
- `frontend/src/modules/console/index.tsx:1274-1275` — `#92400E`, `#FEF3C7` in swap-mode banner background
- `frontend/src/modules/console/GraphicPane.tsx:464,472` — `#09090B`, `#71717A` in loading/error states

## Required Change

Replace each hardcoded hex color with the appropriate CSS custom property from the design token registry (`design-docs/38_FRONTEND_CONTRACTS.md` §CSS design token registry):

- Green (`#22C55E`) → `var(--io-status-ok)` or `var(--io-accent-success)`
- Amber (`#F59E0B`) → `var(--io-status-warn)` or `var(--io-accent-warning)`
- Red (`#EF4444`) → `var(--io-status-alarm)` or `var(--io-accent-danger)`
- Dark amber background (`#92400E`) → appropriate semantic token
- Light amber background (`#FEF3C7`) → appropriate semantic token
- Near-black (`#09090B`) → `var(--io-text-primary)` or `var(--io-surface-base)`
- Muted gray (`#71717A`) → `var(--io-text-muted)` or `var(--io-text-secondary)`

## Acceptance Criteria

1. No hardcoded hex values remain in `index.tsx` or `GraphicPane.tsx` in semantic color positions
2. All replaced colors use CSS custom properties defined in the token registry
3. Visual appearance is unchanged under each theme (light, dark, industrial)
4. TypeScript build passes (`npx tsc --noEmit`)
