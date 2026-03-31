// ---------------------------------------------------------------------------
// Chart configuration types — shared across all 39 chart renderers and the
// configuration panel UI.
// ---------------------------------------------------------------------------

export type ChartTypeId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31
  | 32
  | 33
  | 34
  | 35 // State Timeline
  | 36 // Scorecard Table / Event Condition Statistics
  | 37 // Parallel Coordinate Plot
  | 38 // X-bar/R + X-bar/S Subgroup SPC
  | 39; // Attribute Control Chart (p/np/c/u)

export type AggregateType =
  | "avg"
  | "sum"
  | "last"
  | "first"
  | "max"
  | "min"
  | "median"
  | "range"
  | "stddev"
  | "count";

export type TimeUnit =
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years";

/** A single point assigned to a role within a chart */
export interface ChartPointSlot {
  /** Unique within this chart config, e.g. 'series-0', 'x', 'y', 'point', 'setpoint' */
  slotId: string;
  /** Which axis/role this point fills */
  role: string;
  pointId: string;
  /**
   * Human-readable display name — populated from display_name ?? tagname when the
   * point is bound. Never show pointId (UUID) directly; always use slotLabel().
   */
  label?: string;
  /** Raw instrument tagname (e.g. 24-AI-0101) — stored separately so legend can show either. */
  tagname?: string;
  /** Display color — hex string e.g. '#4A9EFF' */
  color?: string;
}

/**
 * Returns the display label for a chart point slot, respecting the given label mode.
 * Always use this — never use slot.pointId directly as a display string.
 */
export function slotLabel(
  slot: ChartPointSlot,
  labelMode?: "tagname" | "display_name" | "both",
): string {
  const display = slot.label ?? slot.pointId;
  const tag = slot.tagname ?? display;
  if (labelMode === "tagname") return tag;
  if (labelMode === "both" && tag !== display) return `${tag} — ${display}`;
  return display;
}

/**
 * Returns a label function bound to the chart config's legend.labelMode.
 * Use this in renderers instead of calling slotLabel() directly:
 *   const labelFor = makeSlotLabeler(config);
 *   series.name = labelFor(slot);
 */
export function makeSlotLabeler(
  config: Pick<ChartConfig, "legend">,
): (slot: ChartPointSlot) => string {
  const mode = config.legend?.labelMode;
  return (slot) => slotLabel(slot, mode);
}

/** Definition of a point slot for a given chart type (used by the point selector UI) */
export interface SlotDefinition {
  /** e.g. 'series' | 'x' | 'y' | 'point' | 'setpoint' | 'value' | 'z' */
  id: string;
  label: string;
  multi: boolean;
  required: boolean;
  /** If set, restricts what data types can be dropped here */
  hint?: string;
  /** Maximum number of points allowed in this slot (only relevant when multi=true). Default: 12 */
  maxPoints?: number;
}

export type AxisScaleMode = "auto" | "range" | "custom";

export interface PerSeriesScale {
  mode: AxisScaleMode;
  /** Used when mode === 'custom' */
  min?: number;
  max?: number;
}

export interface ChartScaling {
  type: "auto" | "fixed" | "multiscale";
  /** Fixed Y-axis minimum */
  yMin?: number;
  /** Fixed Y-axis maximum */
  yMax?: number;
  /** Fixed X-axis minimum (XY charts only) */
  xMin?: number;
  /** Fixed X-axis maximum (XY charts only) */
  xMax?: number;
  /** Per-series scaling — keyed by slotId, only used when type === 'multiscale' */
  perSeries?: Record<string, PerSeriesScale>;
}

export interface ChartLegend {
  show: boolean;
  /** 'fixed' = anchored strip; 'floating' = draggable overlay panel */
  mode: "fixed" | "floating";
  /** For fixed mode — which edge the strip is on. Default: 'top' */
  position: "top" | "bottom" | "left" | "right";
  /** What text to show for each series in the legend. Default: 'display_name' */
  labelMode?: "tagname" | "display_name" | "both";
}

export interface ChartConfig {
  chartType: ChartTypeId;

  /** All point assignments for this chart */
  points: ChartPointSlot[];

  // ── Time window ────────────────────────────────────────────────────────────
  /** Live lookback window in minutes (live charts only) */
  durationMinutes?: number;

  // ── Aggregation ────────────────────────────────────────────────────────────
  aggregateType?: AggregateType;
  aggregateSize?: number;
  aggregateSizeUnit?: TimeUnit;

  // ── Display ────────────────────────────────────────────────────────────────
  legend?: ChartLegend;
  scaling?: ChartScaling;
  interpolation?: "linear" | "step";
  xAxisLabels?: "full" | "simplified" | "none";
  yAxisLabels?: "full" | "simplified" | "none";

  // ── Per-chart extras (chart-specific settings) ─────────────────────────────
  extras?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Default colors shared across all charts
// ---------------------------------------------------------------------------

// Default palette (dark/hphmi themes) — bright, visible on dark backgrounds
export const CHART_COLORS = [
  "#60A5FA", // blue-400
  "#FB923C", // orange-400
  "#4ADE80", // green-400
  "#F87171", // red-400
  "#C084FC", // purple-400
  "#22D3EE", // cyan-400
  "#F472B6", // pink-400
  "#A3E635", // lime-400
  "#FBBF24", // amber-400
  "#2DD4BF", // teal-400
  "#A78BFA", // violet-400
  "#FB7185", // rose-400
];

// Light theme palette — darker/more saturated, visible on white backgrounds
export const CHART_COLORS_LIGHT = [
  "#1D4ED8", // blue-700
  "#EA580C", // orange-600
  "#16A34A", // green-600
  "#DC2626", // red-600
  "#7C3AED", // violet-600
  "#0891B2", // cyan-600
  "#DB2777", // pink-600
  "#65A30D", // lime-600
  "#D97706", // amber-600
  "#0D9488", // teal-600
  "#4F46E5", // indigo-600
  "#E11D48", // rose-600
];

export function autoColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export function autoColorForTheme(
  index: number,
  theme: "light" | "dark" | "hphmi",
): string {
  const palette = theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS;
  return palette[index % palette.length];
}

// ---------------------------------------------------------------------------
// Slot definitions for each chart type
// ---------------------------------------------------------------------------

export const CHART_SLOTS: Record<ChartTypeId, SlotDefinition[]> = {
  1: [{ id: "series", label: "Trend Lines", multi: true, required: true }],
  2: [{ id: "series", label: "Trend Lines", multi: true, required: true }],
  3: [{ id: "series", label: "Series", multi: true, required: true }],
  4: [{ id: "series", label: "Step Lines", multi: true, required: true }],
  5: [{ id: "series", label: "Bars", multi: true, required: true }],
  6: [{ id: "series", label: "Slices", multi: true, required: true }],
  7: [{ id: "point", label: "Value", multi: false, required: true }],
  8: [{ id: "point", label: "Value", multi: false, required: true }],
  9: [{ id: "point", label: "Point", multi: false, required: true }],
  10: [
    { id: "point", label: "Value", multi: false, required: true },
    { id: "setpoint", label: "Setpoint (opt.)", multi: false, required: false },
  ],
  11: [{ id: "point", label: "Level", multi: false, required: true }],
  12: [{ id: "series", label: "Alarm Points", multi: true, required: true }],
  13: [
    { id: "x", label: "X Axis", multi: false, required: true },
    { id: "y", label: "Y Axis", multi: false, required: true },
  ],
  14: [{ id: "series", label: "Event Sources", multi: true, required: false }],
  15: [{ id: "series", label: "Columns", multi: true, required: true }],
  16: [{ id: "series", label: "Trend Lines", multi: true, required: true }],
  17: [{ id: "value", label: "Value", multi: false, required: true }],
  18: [{ id: "series", label: "Categories", multi: true, required: true }],
  19: [{ id: "series", label: "Groups", multi: true, required: true }],
  20: [{ id: "point", label: "Variable", multi: false, required: true }],
  21: [{ id: "series", label: "Steps", multi: true, required: true }],
  22: [{ id: "series", label: "Series", multi: true, required: true }],
  23: [{ id: "point", label: "Actual Value", multi: false, required: true }],
  24: [
    { id: "point", label: "Process Variable", multi: false, required: true },
  ],
  25: [{ id: "series", label: "Data Series", multi: true, required: true }],
  26: [{ id: "series", label: "Variables", multi: true, required: true }],
  27: [{ id: "series", label: "Flow Sources", multi: true, required: false }],
  28: [{ id: "series", label: "Hierarchy Items", multi: true, required: true }],
  29: [
    { id: "point", label: "Process Variable", multi: false, required: true },
  ],
  30: [
    { id: "point", label: "Process Variable", multi: false, required: true },
  ],
  31: [{ id: "point", label: "Variable", multi: false, required: true }],
  32: [{ id: "series", label: "Stages", multi: true, required: true }],
  33: [{ id: "series", label: "Axes / Series", multi: true, required: true }],
  34: [
    { id: "x", label: "X Axis", multi: false, required: true },
    { id: "y", label: "Y Axis", multi: false, required: true },
    { id: "z", label: "Z Value", multi: false, required: true },
  ],
  35: [
    {
      id: "item",
      label: "Equipment Items",
      multi: true,
      required: true,
      maxPoints: 16,
    },
  ],
  36: [
    {
      id: "metric",
      label: "KPI Columns",
      multi: true,
      required: true,
      maxPoints: 12,
    },
  ],
  37: [
    {
      id: "axis",
      label: "Variables (Axes)",
      multi: true,
      required: true,
      maxPoints: 12,
    },
  ],
  38: [
    {
      id: "instrument",
      label: "Measurement Instruments",
      multi: true,
      required: true,
      maxPoints: 25,
    },
  ],
  39: [
    { id: "defects", label: "Defect Count", multi: false, required: true },
    {
      id: "sampleSize",
      label: "Sample Size (opt.)",
      multi: false,
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Scaling tab eligibility sets
// ---------------------------------------------------------------------------

/** Charts that show the Scaling tab at all */
export const SCALING_TAB_CHARTS = new Set<ChartTypeId>([
  1, 2, 3, 4, 5, 13, 16, 19, 20, 22, 24, 25, 29, 30, 37, 38, 39,
]);

/** Charts where per-series multi-scale makes sense (multi-pen time-series) */
export const MULTISCALE_CHARTS = new Set<ChartTypeId>([1, 2, 3, 4, 16, 22]);

/** Charts with a meaningful X axis that is not time (XY scatter / regression) */
export const XY_SCALE_CHARTS = new Set<ChartTypeId>([13, 25]);

/** Charts that support an orientation toggle (vertical ↔ horizontal) */
export const ORIENTABLE_CHARTS = new Set<ChartTypeId>([5, 18, 19, 20, 21, 23]);

// ---------------------------------------------------------------------------
// Helper: generate a unique slotId for a new point in a multi slot
// ---------------------------------------------------------------------------

export function makeSlotId(
  role: string,
  existingSlots: ChartPointSlot[],
): string {
  const sameRole = existingSlots.filter((s) => s.role === role);
  return `${role}-${sameRole.length}`;
}
