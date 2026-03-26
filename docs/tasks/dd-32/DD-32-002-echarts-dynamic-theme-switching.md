---
id: DD-32-002
title: Implement ECharts dynamic theme switching (register 3 named themes, react to theme changes)
unit: DD-32
status: pending
priority: high
depends-on: [DD-32-003]
---

## What This Feature Should Do

ECharts must support all three I/O themes (light, dark, high-contrast) and switch instantly when the user changes theme, without page reload. Currently the EChart wrapper hardcodes `'dark'` and never responds to theme changes. This means every module using ECharts shows dark charts regardless of the active theme.

## Spec Excerpt (verbatim)

> | Apache ECharts | `chart.setTheme()` (ECharts 6+) | Register 3 named themes at startup, switch dynamically |
>
> On theme change, the React ThemeProvider context updates, triggering `redraw()` on uPlot instances and `setTheme()` on ECharts instances.
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Per-Library Integration

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/charts/EChart.tsx` — hardcoded `echarts.init(el, 'dark')` at line 53
- `frontend/src/shared/theme/tokens.ts` — has `initTheme()` / `setTheme()` but no React context
- `frontend/src/App.tsx` — calls `initTheme()` at line 1025; theme context must be added here
- `frontend/src/shared/theme/` — `theme-colors.ts` file should be created here (see DD-32-003)

## Verification Checklist

- [ ] Three ECharts themes are registered at app startup via `echarts.registerTheme('io-light', {...})`, `echarts.registerTheme('io-dark', {...})`, `echarts.registerTheme('io-high-contrast', {...})`
- [ ] `EChart.tsx` does NOT pass `'dark'` to `echarts.init()`; instead passes the active theme name from context
- [ ] When the user changes theme in Settings, the EChart component calls `chart.dispose()` and re-initialises with the new theme name OR uses `chart.setOption()` with a theme update
- [ ] Chart background, grid, and axis colors reflect the active theme (not always dark gray)

## Assessment

- **Status**: ❌ Missing — `EChart.tsx:53` hardcodes `echarts.init(el, 'dark')` with no theme-switching logic

## Fix Instructions

1. **Register themes at startup**: In `frontend/src/App.tsx` (near the `initTheme()` call at line 1025), call `echarts.registerTheme('io-light', ioLightTheme)`, `echarts.registerTheme('io-dark', ioDarkTheme)`, and `echarts.registerTheme('io-high-contrast', ioHighContrastTheme)`. These theme objects must reference the JS color values from `theme-colors.ts` (DD-32-003).

   Theme object shape:
   ```ts
   {
     backgroundColor: themeColors.light.chartBg,
     textStyle: { color: themeColors.light.chartAxis },
     axisPointer: { lineStyle: { color: themeColors.light.chartCrosshair } },
     // ... grid, axis, etc.
   }
   ```

2. **Consume theme from context**: Once DD-32-003 adds a ThemeContext, import `useThemeContext` in `EChart.tsx` and pass `'io-${theme}'` to `echarts.init()`. The chart must be destroyed and recreated when the theme changes (ECharts does not support hot theme switching without reinit).

3. **Handle theme change**: In `EChart.tsx`, add the `theme` from context to the `useEffect` dependency array for the chart init effect so a theme change triggers a dispose + reinit.

Do NOT:
- Use `chart.setOption()` for theme switching — ECharts theme must be passed at init time
- Remove the `option` update effect (lines 63-71) — it is correct and must remain
- Register themes with the same name as built-in ECharts themes ('dark', 'light') to avoid conflicts
