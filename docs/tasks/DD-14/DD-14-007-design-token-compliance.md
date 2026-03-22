---
id: DD-14-007
title: Replace hardcoded hex colors with design tokens across the rounds module
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

All colors in the rounds module must reference CSS custom properties from the design token registry (`--io-*` variables), not hardcoded hex values. This ensures the rounds module renders correctly in all three themes (dark, light, hphmi) without a page reload. Alarm-level colors (critical, high, low, advisory) must specifically use `var(--io-alarm-critical)`, `var(--io-alarm-high)`, etc. — they are ISA-101 fixed colors that do not change by theme.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors.
> All 3 themes must work: dark (default), light, hphmi (high-contrast). Switching theme at runtime must not require a page reload.
> Alarm/status tokens (--io-alarm-critical, --io-alarm-high, etc.) are non-customizable — they follow ISA-101.
> — SPEC_MANIFEST.md, §CX-TOKENS Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundPlayer.tsx` — hardcoded colors at lines 96, 122, 208, 237, 240, 242, 387, 615, 657, 677, 710, 788, 856, 913, 928, 932
- `frontend/src/pages/rounds/index.tsx` — hardcoded colors at lines 118, 136, 312, 327, 342
- `frontend/src/pages/rounds/ActiveRounds.tsx` — hardcoded colors at lines 26, 27, 144
- `frontend/src/pages/rounds/RoundHistory.tsx` — hardcoded color at line 112
- `frontend/src/pages/rounds/TemplateDesigner.tsx` — hardcoded colors at lines 176, 271, 728, 785
- Design token reference: `frontend/src/styles/tokens.ts` (or wherever `--io-*` vars are declared)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `#ef4444` (error/alarm-critical red) replaced with `var(--io-alarm-critical)` or `var(--io-status-error)`
- [ ] `#f59e0b` / `#fbbf24` (warning/advisory amber) replaced with `var(--io-alarm-high)` or `var(--io-status-warning)`
- [ ] `#22c55e` (success/in-range green) replaced with `var(--io-status-ok)` or equivalent token
- [ ] `#92400e`, `#166534`, `#b45309` (semantic background text shades) replaced with appropriate `--io-*` tokens
- [ ] `#fff` (white text on accent backgrounds) replaced with `var(--io-text-on-accent)` or equivalent
- [ ] `#a855f7` (transferred purple) replaced with an `--io-*` token
- [ ] `background: '#000'` in video element (RoundPlayer.tsx:96) replaced with `var(--io-surface-inverse)` or a suitable token

## Assessment

- **Status**: ⚠️ Wrong — extensive hardcoded hex values throughout all 5 rounds files. Alarm colors (`#ef4444`, `#f59e0b`) are especially problematic as they violate ISA-101 token requirements. The module will not render correctly in light or hphmi themes.

## Fix Instructions (if needed)

Perform the following substitutions across all rounds files. Confirm the correct token names by reading `frontend/src/styles/tokens.ts` (or the equivalent token file) first.

**Substitution map** (verify token names against tokens.ts before applying):

| Hardcoded value | Likely token | Usage |
|----------------|--------------|-------|
| `#ef4444` | `var(--io-alarm-critical)` | Error text, alarm indicators, required asterisks |
| `#f59e0b` | `var(--io-alarm-high)` | Advisory/warning text |
| `#fbbf24` | `var(--io-alarm-high)` | Overdue badge text in ActiveRounds |
| `#22c55e` | `var(--io-status-ok)` | In-range/success indicators |
| `#92400e` | `var(--io-text-warning-on-warning-bg)` or `var(--io-alarm-high-text)` | Offline banner text |
| `#166534` | `var(--io-text-ok-on-ok-bg)` or similar | Sync banner text |
| `#b45309` | `var(--io-text-warning-on-warning-bg)` | Offline badge text |
| `#fff` | `var(--io-text-on-accent)` | White text on accent button |
| `#a855f7` | `var(--io-status-transferred)` or `var(--io-color-purple)` | Transferred status |
| `#000` | `var(--io-surface-inverse)` | Video element background |

**Files to update**:
1. `RoundPlayer.tsx` — most occurrences; focus especially on evaluateNumericColor() at lines 237–242
2. `index.tsx` — StatusBadge colorMap at lines 33–38; button text at 118, 136, 342
3. `ActiveRounds.tsx` — statusBadge colorMap at lines 6–12; DueBadge at 26–27
4. `RoundHistory.tsx` — statusBadge colorMap at lines 6–12; out_of_range highlight at 112
5. `TemplateDesigner.tsx` — error text and button colors

For `rgba(...)` values that use hardcoded hex channels (e.g. `rgba(34,197,94,0.12)`), convert to `color-mix(in srgb, var(--io-status-ok) 12%, transparent)` or use a `--io-*-subtle` token if available.

Do NOT:
- Change alarm colors to match the theme (ISA-101 requires alarm colors to be constant regardless of theme)
- Replace design-token-compliant values that are already correct (e.g. existing `var(--io-accent)` usages)
- Introduce new hardcoded colors when adding new UI elements
