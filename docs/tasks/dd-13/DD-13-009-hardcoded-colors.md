---
id: DD-13-009
title: Replace hardcoded hex colors with design tokens (CX-TOKENS)
unit: DD-13
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

All colors in the log module must use CSS custom properties from the design token registry. Hardcoded hex values like `#fbbf24`, `#22c55e`, `#f87171`, `#fff` break the light and hphmi themes because those colors assume a dark background.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
> All 3 themes must work: dark (default), light, hphmi (high-contrast). Switching theme at runtime must not require a page reload.
> — docs/SPEC_MANIFEST.md, §CX-TOKENS

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/LogEditor.tsx:15,21,545,552,767,781,798,799` — hardcoded `#fbbf24`, `#22c55e`, `#fff`
- `frontend/src/pages/log/index.tsx:15,21,112,199` — same colors in StatusBadge and button styles
- `frontend/src/pages/log/TemplateEditor.tsx:77,198,215` — `#f87171`, `#ef4444`, `rgba(239,68,68,0.3)`

## Verification Checklist

- [ ] `#22c55e` (success green) replaced with `var(--io-status-ok)` or equivalent token throughout all log files
- [ ] `#fbbf24` (warning amber) replaced with `var(--io-alarm-high)` or `var(--io-status-warning)` token
- [ ] `#f87171` and `#ef4444` (danger red) replaced with `var(--io-alarm-critical)` or `var(--io-status-error)` token
- [ ] `#fff` (white text on colored buttons) replaced with `var(--io-text-on-accent)` or equivalent
- [ ] Module renders correctly in all 3 themes after token substitution

## Assessment

- **Status**: ⚠️ Wrong
- `LogEditor.tsx:21`: `completed: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: 'Completed' }` — hardcoded green
- `LogEditor.tsx:545,798`: submit button background is `'#22c55e'` — hardcoded green
- `LogEditor.tsx:15`: `text: '#fbbf24'` — hardcoded amber for pending status
- `TemplateEditor.tsx:806`: delete button `color: '#f87171'` — hardcoded red
- All these values look fine in dark theme but will be invisible or wrong-contrast in the light and hphmi themes

## Fix Instructions

Check `frontend/src/shared/styles/tokens.ts` (or equivalent) for the correct token names. Common substitutions:

| Hardcoded value | Replace with token |
|---|---|
| `#22c55e` | `var(--io-status-ok)` |
| `rgba(34,197,94,0.12)` | `var(--io-status-ok-subtle)` (or `color-mix(in srgb, var(--io-status-ok) 12%, transparent)`) |
| `#fbbf24` | `var(--io-status-warning)` |
| `rgba(251,191,36,0.15)` | `var(--io-status-warning-subtle)` |
| `#f87171`, `#ef4444` | `var(--io-status-error)` |
| `rgba(239,68,68,0.3)` | `var(--io-status-error-subtle)` |
| `#fff` on colored background | `var(--io-text-on-accent)` |

If any of these tokens do not exist in the registry, add them to the token registry first rather than inventing new hardcoded values.

The `StatusBadge` component is duplicated in both `LogEditor.tsx` (lines 13-39) and `index.tsx` (lines 11-40). Consider extracting it to `frontend/src/shared/components/LogStatusBadge.tsx` so token substitutions only need to happen once.

Do NOT:
- Leave any `#hex` color values in log module files
- Use `rgba()` with hardcoded values when a token opacity variant is available
- Change ISA-101 alarm colors (`--io-alarm-critical` etc.) — those are non-customizable per spec
