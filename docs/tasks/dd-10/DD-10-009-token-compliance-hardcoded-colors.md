---
id: DD-10-009
title: Replace hardcoded hex colors with CSS design tokens across dashboards widgets
unit: DD-10
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

All colors, spacing, shadow, and typography values in the dashboards module must reference CSS custom properties from the design token registry (e.g., `var(--io-alarm-critical)` instead of `#ef4444`). This ensures the module works correctly in all three themes (dark, light, hphmi) and does not break when the theme is switched at runtime. ISA-101 alarm colors are non-customizable by theme but must still be referenced via the alarm tokens, not raw hex values.

## Spec Excerpt (verbatim)

> All colors, spacing, radius, shadow, and typography values reference CSS custom properties from the token registry. No hardcoded hex colors, no hardcoded pixel values for semantic properties.
> All 3 themes must work: dark (default), light, hphmi (high-contrast). Switching theme at runtime must not require a page reload.
> Alarm/status tokens (`--io-alarm-critical`, `--io-alarm-high`, etc.) are non-customizable — they follow ISA-101 and do not change per theme.
> — CX-TOKENS contract, docs/SPEC_MANIFEST.md §Wave 0

## Where to Look in the Codebase

Primary files (52 total occurrences of hardcoded colors):
- `frontend/src/pages/dashboards/widgets/AlertStatusWidget.tsx` — lines 22–27: `SEVERITY_COLORS` object with hardcoded hex values (`#ef4444`, `#f97316`, `#f59e0b`, `#3b82f6`, `#6b7280`)
- `frontend/src/pages/dashboards/widgets/GaugeWidget.tsx` — lines 58–59, 63–69: hardcoded `#22c55e`, `#f59e0b`, `#ef4444`, `#4A9EFF` in color logic and `axisLineData`
- `frontend/src/pages/dashboards/widgets/LineChart.tsx` — line 69: `colors` array with `#4A9EFF`, `#22c55e`, `#f59e0b`, `#ef4444`, `#a855f7`, `#06b6d4`
- `frontend/src/pages/dashboards/widgets/KpiCard.tsx` — lines 22–24: hardcoded colors in `getTrendColor`
- `frontend/src/pages/dashboards/widgets/BarChart.tsx` — line 21: default color `#4A9EFF`
- Various `rgba(...)` usages in `PlaylistPlayer.tsx`, `DashboardBuilder.tsx`, `index.tsx`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `AlertStatusWidget.tsx` SEVERITY_COLORS uses CSS tokens instead of hex values
- [ ] `GaugeWidget.tsx` color logic uses `var(--io-alarm-critical)`, `var(--io-alarm-high)`, `var(--io-status-good)` (or equivalent tokens)
- [ ] `LineChart.tsx` series colors use CSS tokens or the theme's standard chart palette (not hardcoded hex)
- [ ] `KpiCard.tsx` getTrendColor returns `var(--io-alarm-critical)` etc.
- [ ] `BarChart.tsx` default color uses a CSS token
- [ ] Module renders correctly in light theme (no dark-background assumptions)

## Assessment

- **Status**: ⚠️ Violations found
- 52 occurrences of hardcoded hex colors across 12 files. Most severe: `AlertStatusWidget.tsx` has a `SEVERITY_COLORS` constant with 5 hardcoded hex values. `GaugeWidget.tsx` has hardcoded colors in the ECharts `axisLineData` array. These will render incorrectly in the `light` and `hphmi` themes.

## Fix Instructions

1. Replace `SEVERITY_COLORS` in `AlertStatusWidget.tsx` (lines 22–27) with CSS token references. Use `getComputedStyle(document.documentElement).getPropertyValue('--io-alarm-critical')` to pass ECharts the resolved value, or use a JavaScript token map that reads from the document's CSS variables at render time.

   Suggested mapping:
   ```ts
   const SEVERITY_COLORS: Record<string, string> = {
     critical: 'var(--io-alarm-critical)',
     high: 'var(--io-alarm-high)',
     medium: 'var(--io-alarm-medium)',
     low: 'var(--io-alarm-low)',
     info: 'var(--io-text-muted)',
   }
   ```

2. In `GaugeWidget.tsx`, replace hardcoded colors in `getColor()` and `axisLineData`:
   - `#22c55e` → `var(--io-status-good)` or `var(--io-success)`
   - `#f59e0b` → `var(--io-alarm-medium)` or `var(--io-warning)`
   - `#ef4444` → `var(--io-alarm-critical)` or `var(--io-danger)`
   - `#4A9EFF` → `var(--io-accent)`

   Note: ECharts does NOT accept CSS variables directly in config objects. You must resolve them:
   ```ts
   function resolveToken(token: string) {
     return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
   }
   ```

3. In `LineChart.tsx` line 69, replace the hardcoded color array with a chart palette from the token system. Check if a `useChartColors()` hook or `--io-chart-1` through `--io-chart-6` tokens exist in the token registry.

4. In `KpiCard.tsx` `getTrendColor()` (lines 20–25): replace `#ef4444`, `#f59e0b`, `#22c55e` with the appropriate CSS tokens.

5. Remove all `rgba(0,0,0,...)` overlay colors (e.g., PlaylistPlayer.tsx kiosk strip backgrounds) — use `var(--io-overlay-bg)` or a token equivalent.

Do NOT:
- Change alarm token colors by theme — ISA-101 alarm colors are fixed regardless of theme
- Use the `--io-danger`, `--io-warning`, `--io-success` tokens for alarm severity rendering on actual alarm widgets — those are UI state tokens; alarm widgets must use the `--io-alarm-*` tokens
- Forget that ECharts requires resolved (computed) color values, not raw CSS variable strings
