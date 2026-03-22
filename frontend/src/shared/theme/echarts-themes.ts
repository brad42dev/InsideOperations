/**
 * I/O ECharts Named Themes
 *
 * Three ECharts theme objects for registration at app startup.
 * All color values reference theme-colors.ts (the single source of truth
 * for canvas-library colors) — do NOT hardcode hex values here.
 *
 * Register with:
 *   echarts.registerTheme('io-light', ioLightTheme)
 *   echarts.registerTheme('io-dark', ioDarkTheme)
 *   echarts.registerTheme('io-high-contrast', ioHighContrastTheme)
 *
 * Names intentionally prefixed with 'io-' to avoid collision with the
 * built-in ECharts 'light' and 'dark' themes.
 *
 * — design-docs/32_SHARED_UI_COMPONENTS.md, §Per-Library Integration
 */

import { themeColors } from './theme-colors'

// ---------------------------------------------------------------------------
// Helper: build a consistently shaped ECharts theme object from a color set
// ---------------------------------------------------------------------------

function buildEChartsTheme(colorKey: 'light' | 'dark' | 'high-contrast') {
  const c = themeColors[colorKey]

  return {
    backgroundColor: c.chartBg,

    textStyle: {
      color: c.chartAxis,
    },

    title: {
      textStyle: { color: c.chartAxis },
      subtextStyle: { color: c.chartAxis },
    },

    legend: {
      textStyle: { color: c.chartAxis },
    },

    tooltip: {
      backgroundColor: c.chartTooltipBg,
      textStyle: { color: c.chartAxis },
      borderColor: c.chartGrid,
    },

    axisPointer: {
      lineStyle: { color: c.chartCrosshair },
      crossStyle: { color: c.chartCrosshair },
    },

    // Shared axis styling applied to all cartesian axes
    categoryAxis: {
      axisLine: { lineStyle: { color: c.chartGrid } },
      axisTick: { lineStyle: { color: c.chartGrid } },
      axisLabel: { color: c.chartAxis },
      splitLine: { lineStyle: { color: c.chartGrid } },
    },

    valueAxis: {
      axisLine: { lineStyle: { color: c.chartGrid } },
      axisTick: { lineStyle: { color: c.chartGrid } },
      axisLabel: { color: c.chartAxis },
      splitLine: { lineStyle: { color: c.chartGrid } },
    },

    timeAxis: {
      axisLine: { lineStyle: { color: c.chartGrid } },
      axisTick: { lineStyle: { color: c.chartGrid } },
      axisLabel: { color: c.chartAxis },
      splitLine: { lineStyle: { color: c.chartGrid } },
    },

    logAxis: {
      axisLine: { lineStyle: { color: c.chartGrid } },
      axisTick: { lineStyle: { color: c.chartGrid } },
      axisLabel: { color: c.chartAxis },
      splitLine: { lineStyle: { color: c.chartGrid } },
    },

    grid: {
      borderColor: c.chartGrid,
    },

    // Pen colors as the default series color palette
    color: [c.pen1, c.pen2, c.pen3, c.pen4, c.pen5, c.pen6, c.pen7, c.pen8],

    // Alarm severity colors for series that use the alarm palette
    alarm: {
      critical: c.alarmCritical,
      high: c.alarmHigh,
      medium: c.alarmMedium,
      advisory: c.alarmAdvisory,
    },
  }
}

// ---------------------------------------------------------------------------
// Named theme objects
// ---------------------------------------------------------------------------

/** ECharts theme for the I/O Light application theme */
export const ioLightTheme = buildEChartsTheme('light')

/** ECharts theme for the I/O Dark application theme */
export const ioDarkTheme = buildEChartsTheme('dark')

/** ECharts theme for the I/O High-Contrast (HPHMI) application theme */
export const ioHighContrastTheme = buildEChartsTheme('high-contrast')
