---
id: DD-32-003
title: Create theme-colors.ts parallel JS color object and React ThemeProvider context
unit: DD-32
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

uPlot and ECharts render to Canvas and cannot read CSS custom properties. The spec requires a single `theme-colors.ts` file that mirrors the CSS token values as a JS object. A React ThemeProvider context must also be created so chart components can subscribe to theme changes and redraw/reinitialise without a page reload.

## Spec Excerpt (verbatim)

> uPlot and ECharts cannot read CSS variables (they render to Canvas). A single `theme-colors.ts` file mirrors CSS token values as a JS object. This file is the ONLY place JS theme colors are defined — all canvas library configurations reference it. On theme change, the React ThemeProvider context updates, triggering `redraw()` on uPlot instances and `setTheme()` on ECharts instances.
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Parallel JS Color Object

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/theme/tokens.ts` — all CSS token values are defined here per theme; JS mirrors must match these values
- `frontend/src/shared/theme/` — `theme-colors.ts` should be created here
- `frontend/src/App.tsx:1025` — `initTheme()` call; ThemeProvider wrapper must be added here
- `frontend/src/shared/components/charts/TimeSeriesChart.tsx` — must consume theme context for axis/grid colors
- `frontend/src/shared/components/charts/EChart.tsx` — must consume theme context for init/reinit

## Verification Checklist

- [ ] `frontend/src/shared/theme/theme-colors.ts` exists and exports `themeColors` with keys `light`, `dark`, and `high-contrast`
- [ ] Each theme object contains at minimum: `chartBg`, `chartGrid`, `chartAxis`, `chartCrosshair`, `chartTooltipBg`, `alarmCritical`, `alarmHigh`, `alarmMedium`, `alarmAdvisory`, `pen1` through `pen8`
- [ ] Color values in `themeColors` match the CSS token values in `tokens.ts` for each theme
- [ ] A `ThemeContext` (or `useThemeContext` hook) is exported from `frontend/src/shared/theme/`
- [ ] `App.tsx` wraps the app in `<ThemeProvider>` and the context value updates when `setTheme()` is called
- [ ] `TimeSeriesChart.tsx` reads the active theme from context and passes colors to uPlot axes/grid options

## Assessment

- **Status**: ❌ Missing — `theme-colors.ts` does not exist anywhere in the codebase; no ThemeProvider context found

## Fix Instructions

1. **Create `theme-colors.ts`**: At `frontend/src/shared/theme/theme-colors.ts`. Export a `themeColors` const with three keys. Mirror values from `tokens.ts`:
   - For `light`: read lightTokens values (defined in tokens.ts around line 278+)
   - For `dark`: read darkTokens values (tokens.ts line 17+)
   - For `high-contrast` / `hphmi`: read hphmiTokens values

   ```ts
   export const themeColors = {
     light: {
       chartBg: '#FFFFFF',
       chartGrid: '#E5E7EB',
       chartAxis: '#374151',
       chartCrosshair: '#9CA3AF',
       chartTooltipBg: '#FFFFFF',
       alarmCritical: '#DC2626',
       alarmHigh: '#F59E0B',
       alarmMedium: '#EAB308',
       alarmAdvisory: '#06B6D4',
       pen1: '#2563EB', pen2: '#DC2626', pen3: '#16A34A',
       pen4: '#D97706', pen5: '#7C3AED', pen6: '#0891B2',
       pen7: '#DB2777', pen8: '#65A30D',
     },
     dark: { /* mirror darkTokens */ },
     'high-contrast': { /* mirror hphmiTokens */ },
   } as const
   ```

2. **Create ThemeContext**: In `frontend/src/shared/theme/ThemeContext.tsx`:
   ```ts
   export const ThemeContext = React.createContext<{ theme: Theme; colors: typeof themeColors.dark }>({...})
   export function useThemeColors() { return useContext(ThemeContext).colors }
   export function useThemeName() { return useContext(ThemeContext).theme }
   ```

3. **Wrap App**: In `App.tsx`, track theme in state (initially from `initTheme()`). Wrap the root JSX in `<ThemeContext.Provider value={{ theme, colors: themeColors[theme] }}>`. When `setTheme()` is called anywhere, also update this state (or use Zustand's `ui.ts` store which already tracks theme).

4. **Connect TimeSeriesChart**: In `TimeSeriesChart.tsx`, import `useThemeColors` and pass `colors.chartAxis`, `colors.chartGrid` to the uPlot axis/grid config. When the theme changes (context update), the component must call `uplotRef.current.redraw(false)` (not destroy/recreate) after updating the colors.

Do NOT:
- Hardcode hex values in chart components directly — all color values must come from `themeColors`
- Destroy and recreate uPlot on theme change — use `u.redraw(false)` after updating the opts object
- Create per-component theme-color objects — `themeColors` is the single source and all components read from it
