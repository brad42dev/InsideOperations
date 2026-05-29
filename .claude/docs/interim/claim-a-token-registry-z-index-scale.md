---
id: claim-a-token-registry-z-index-scale
title: Claim A Token Registry Gaps & Z-Index Scale
status: interim
created: 2026-05-27
last_updated: 2026-05-27
last_synced_with_code: 2026-05-27
work_units:
- 2026-05-27_workstream-2b-token-gaps
implementation:
- frontend/src/index.css
- frontend/src/shared/theme/tokens.ts
- frontend/src/shared/components/CommandPalette.tsx
- frontend/src/pages/designer/components/PromoteToShapeWizard.tsx
related:
- claim-a-shell-convergence
- claim-c-deferral
topics:
- ui-framework
- module-designer
aliases: []
keywords: []
covers: Claim A Token Registry Gaps & Z-Index Scale
---

# Claim A Token Registry Gaps & Z-Index Scale

Workstream 2B of the Claim A shell-convergence audit: fills missing CSS custom properties in `index.css`, corrects two existing token values (`--io-sidebar-width`, z-index band), and establishes the canonical z-index scale across all three themes.

## Purpose

The UI audit identified references to CSS custom properties that were consumed by module code but never defined in `index.css`. Undefined tokens silently degrade to no-value or browser fallback. This workstream defines all missing tokens, corrects misaligned values, and locks in a realistic z-index layering scale for all current and future modules.

## Behavior

All tokens are defined in the `:root, [data-theme="dark"]`, `[data-theme="light"]`, and `[data-theme="hphmi"]` blocks unless noted otherwise. Theme-variant tokens carry per-theme values; alias tokens delegate to existing primitives.

**Tokens added (per-theme):**
- `--io-bg: var(--io-surface-primary)` — page-level background alias
- `--io-text: var(--io-text-primary)` — base text color alias
- `--io-surface-hover: var(--io-surface-elevated)` — interactive hover surface
- `--io-surface-raised: var(--io-surface-elevated)` — elevated card/panel surface
- `--io-text-on-accent: var(--io-accent-foreground)` — text color over accent backgrounds
- `--io-error: var(--io-danger)` — semantic error alias
- `--io-overlay: var(--io-modal-backdrop)` — backdrop alias for modal overlays
- `--io-alarm-inactive: #808080` — off-state color for alarm flash animation (identical across all themes)
- `--io-accent-rgb` — space-separated RGB triplet for use in `rgb(var(--io-accent-rgb) / <alpha>)` syntax; per-theme: dark=`45 212 191`, light=`13 148 136`, hphmi=`20 184 166`

**Token added (`:root` only, static across themes):**
- `--io-font-sans` — Inter-first sans-serif stack matching the `body` font-family declaration

**Tokens corrected:**
- `--io-sidebar-width`: 240px → 220px (matches all existing module hardcodes; 220px is the official convention)

**Token skipped — A12 (`--io-text-inverse`):** already defined in all three theme blocks; audit plan entry was incorrect.

**Token not defined — A8 (`--io-accent-muted`):** used in exactly one location (`PromoteToShapeWizard.tsx`). No shared pattern exists across other wizard components. Consumer updated to use `var(--io-accent-subtle)` instead; no new token registered.

**Z-index scale (all three theme blocks + `tokens.ts`):**

| Token | Value | Notes |
|---|---|---|
| `--io-z-dropdown` | 500 | Was 200 |
| `--io-z-modal` | 1000 | Was 300 |
| `--io-z-command` | 1200 | CommandPalette now wired to this token |
| `--io-z-visual-lock` | 1500 | LockOverlay — must render above modals |
| `--io-z-kiosk-auth` | 1800 | Defined; not yet consumed by any component |
| `--io-z-toast` | 2000 | Was 700 |
| `--io-z-emergency` | 3000 | Was 800; raised to ensure it tops all layers |

## Implementation Notes

All token additions are in `frontend/src/index.css`. Token values are mirrored in `frontend/src/shared/theme/tokens.ts` (JS-side token map used by theming code).

`CommandPalette.tsx` previously hardcoded `zIndex: 3000` / `3001` inline. Updated to `var(--io-z-command)` / `calc(var(--io-z-command) + 1)`.

`PromoteToShapeWizard.tsx:2168` — completed-step stepper bar color changed from `var(--io-accent-muted, #3b82f6)` to `var(--io-accent-subtle)`.

**Pending (Claim B):** `--io-z-visual-lock` and `--io-z-kiosk-auth` are defined but not consumed by any component. Full z-index reconciliation against all hardcoded `zIndex` values in the codebase is required before the scale is treated as stable. The Section 4 DoD in `ui-audit/06-claim-a-plan.md` still references `--io-accent-muted` as required — stale; to be cleaned up in the Claim A complete-review pass.

## Changelog

<!-- IGNORE UNLESS SPECIFICALLY ASKED TO REVIEW DOCUMENT HISTORY -->
### 2026-05-27
Initial creation. Documents all token registry additions from workstream 2B: 11 missing alias tokens added across all three themes, `--io-font-sans` added to `:root`, `--io-sidebar-width` corrected to 220px, full z-index scale established (dropdown:500 → emergency:3000), `CommandPalette` wired to token, `PromoteToShapeWizard` completed-step color updated. Two plan entries skipped with documented reasons (A12 already defined, A8 single-use resolved at consumer).
