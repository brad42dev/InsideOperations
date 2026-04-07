/**
 * I/O Theme Colors — Parallel JS Color Object
 *
 * uPlot and ECharts render to Canvas and cannot read CSS custom properties.
 * This file mirrors the chart-relevant CSS token values from tokens.ts as a
 * plain JS object so canvas library configurations can reference them.
 *
 * THIS IS THE ONLY PLACE JS THEME COLORS ARE DEFINED.
 * All canvas library configurations (uPlot, ECharts) must reference this file.
 * Do not hardcode hex values in chart components.
 *
 * On theme change, ThemeContext updates and triggers redraw/reinit on chart instances.
 *
 * — design-docs/32_SHARED_UI_COMPONENTS.md, §Parallel JS Color Object
 */

export interface ThemeColorSet {
  // Chart & Visualization
  chartBg: string;
  chartGrid: string;
  chartAxis: string;
  chartCrosshair: string;
  chartTooltipBg: string;

  // Alarm Priority (ISA-101)
  alarmUrgent: string;
  alarmHigh: string;
  alarmLow: string;
  alarmDiagnostic: string;

  // Pen colors (static across themes)
  pen1: string;
  pen2: string;
  pen3: string;
  pen4: string;
  pen5: string;
  pen6: string;
  pen7: string;
  pen8: string;
}

export const themeColors: Record<
  "light" | "dark" | "high-contrast",
  ThemeColorSet
> = {
  light: {
    // Chart & Visualization — matches lightTokens in tokens.ts
    chartBg: "#ffffff",
    chartGrid: "#f5f6f8",
    chartAxis: "#6b7280",
    chartCrosshair: "#9ca3af",
    chartTooltipBg: "#ffffff",

    // Alarm Priority — matches lightTokens in tokens.ts
    alarmUrgent: "#dc2626",
    alarmHigh: "#d97706",
    alarmLow: "#ca8a04",
    alarmDiagnostic: "#0891b2",

    // Pen colors (static) — matches lightTokens in tokens.ts
    pen1: "#2563eb",
    pen2: "#dc2626",
    pen3: "#16a34a",
    pen4: "#d97706",
    pen5: "#7c3aed",
    pen6: "#0891b2",
    pen7: "#db2777",
    pen8: "#65a30d",
  },

  dark: {
    // Chart & Visualization — matches darkTokens in tokens.ts
    chartBg: "#18181b",
    chartGrid: "#3f3f46",
    chartAxis: "#a1a1aa",
    chartCrosshair: "#71717a",
    chartTooltipBg: "#27272a",

    // Alarm Priority — matches darkTokens in tokens.ts
    alarmUrgent: "#ef4444",
    alarmHigh: "#f97316",
    alarmLow: "#eab308",
    alarmDiagnostic: "#f4f4f5",

    // Pen colors (static) — matches darkTokens in tokens.ts
    pen1: "#2563eb",
    pen2: "#dc2626",
    pen3: "#16a34a",
    pen4: "#d97706",
    pen5: "#7c3aed",
    pen6: "#0891b2",
    pen7: "#db2777",
    pen8: "#65a30d",
  },

  "high-contrast": {
    // Chart & Visualization — matches hphmiTokens in tokens.ts
    chartBg: "#1e293b",
    chartGrid: "#3d5166",
    chartAxis: "#94a3b8",
    chartCrosshair: "#64748b",
    chartTooltipBg: "#1e293b",

    // Alarm Priority — matches hphmiTokens in tokens.ts
    alarmUrgent: "#ef4444",
    alarmHigh: "#f59e0b",
    alarmLow: "#eab308",
    alarmDiagnostic: "#06b6d4",

    // Pen colors (static) — matches hphmiTokens in tokens.ts
    pen1: "#2563eb",
    pen2: "#dc2626",
    pen3: "#16a34a",
    pen4: "#d97706",
    pen5: "#7c3aed",
    pen6: "#0891b2",
    pen7: "#db2777",
    pen8: "#65a30d",
  },
};
