---
id: DD-31-011
title: Replace hardcoded hex colors with design tokens throughout Alerts module (CX-TOKENS)
unit: DD-31
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

Every color value in the Alerts module must reference a CSS custom property from the design token registry. Hardcoded hex values (`#ef4444`, `#22c55e`, `#f97316`, `rgba(239,68,68,0.12)`, etc.) must be replaced with tokens. The severity alarm colors (emergency=red, critical=orange, warning=yellow) follow ISA-101 and are non-customizable — they must reference the fixed alarm tokens (`--io-alarm-emergency`, `--io-alarm-critical`, etc.) rather than raw hex, ensuring they remain consistent across all 3 themes.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors.
> Alarm/status tokens (`--io-alarm-critical`, `--io-alarm-high`, etc.) are non-customizable — they follow ISA-101 and do not change per theme.
> — `docs/SPEC_MANIFEST.md`, §CX-TOKENS Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` lines 20–25 — `SEVERITY_COLORS` object with hardcoded hex
- `frontend/src/pages/alerts/MusterDashboard.tsx` lines 10–14 — `STATUS_COLORS` with hardcoded hex
- `frontend/src/pages/alerts/ActiveAlerts.tsx` lines 6–18 — `SEVERITY_COLOR` / `SEVERITY_BG` hardcoded
- `frontend/src/pages/alerts/AlertHistory.tsx` lines 5–23 — same pattern
- `frontend/src/pages/alerts/AlertTemplates.tsx` lines 4–16 — same pattern
- `frontend/src/shared/theme/tokens.ts` — canonical token definitions to reference

## Verification Checklist

- [ ] `SEVERITY_COLORS` constants use `var(--io-alarm-emergency)`, `var(--io-alarm-critical)`, `var(--io-alarm-warning)` instead of `#ef4444`, `#f97316`, `#eab308`
- [ ] Muster `STATUS_COLORS` accounted/unaccounted colors reference tokens (e.g., `var(--io-status-ok)`, `var(--io-status-error)`)
- [ ] Inline `color: '#ef4444'` and `color: '#22c55e'` throughout the files replaced with token references
- [ ] All 3 themes (dark, light, hphmi) render the Alerts module without broken colors

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `index.tsx:21-24` hardcodes `#ef4444`, `#f97316`, `#eab308`, `#4a9eff`. `MusterDashboard.tsx:11-13` hardcodes `#ef4444`, `#22c55e`, `#94a3b8`. These same hex values repeat across `ActiveAlerts.tsx:6-18`, `AlertHistory.tsx:5-23`, and `AlertTemplates.tsx:4-16`. While alarm colors are ISA-101 fixed, they must still reference named tokens so token-level tooling can verify compliance.

## Fix Instructions

1. Audit `frontend/src/shared/theme/tokens.ts` to find the alarm severity tokens and status indicator tokens. Expected names include `--io-alarm-emergency`, `--io-alarm-critical`, `--io-alarm-warning`, `--io-alarm-info`, `--io-status-ok`, `--io-status-error`.
2. Replace each `SEVERITY_COLOR` / `SEVERITY_BG` map entry with the corresponding token. Example:
   ```ts
   emergency: { color: 'var(--io-alarm-emergency)', bg: 'var(--io-alarm-emergency-bg)' }
   ```
3. Replace all inline `color: '#ef4444'` with `color: 'var(--io-alarm-emergency)'` (or `--io-status-error` for non-alarm red).
4. Replace `color: '#22c55e'` with `var(--io-status-ok)`.
5. If the required tokens do not exist in `tokens.ts`, add them following the existing token pattern for all 3 themes.

Do NOT:
- Change the actual color values of ISA-101 alarm tokens (they are fixed, not theme-customizable)
- Use Tailwind color class names — all colors go through CSS custom properties
