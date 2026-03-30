# Chart Configuration System — Implementation Plan
Date: 2026-03-29

## Goal

Implement all 34 chart types from `spec_docs/chart-types-reference.md` with a
configuration panel triggered by the gear icon in `ChartToolbar`. The config
panel supports chart type selection, tag/point assignment via drag-and-drop, and
per-chart options.

---

## Architecture

### Entry Point
Gear icon in `ChartToolbar` → `onConfigure()` callback → `ChartConfigPanel`
opens as a fixed-position modal overlay (not pane-contained — panes can be tiny).

### Data Model
`PaneConfig` gains a new optional field:
```ts
chartConfig?: ChartConfig
```

`ChartConfig` (defined in `chart-config-types.ts`) stores:
- `chartType: ChartTypeId` (1–34)
- `points: ChartPointSlot[]` (role + pointId + color per slot)
- `durationMinutes?: number`
- `aggregateType?: AggregateType`
- `aggregateSize?, aggregateSizeUnit?`
- `legend?: ChartLegend`
- `scaling?: ChartScaling`
- `interpolation?: 'linear' | 'step'`
- `xAxisLabels?, yAxisLabels?: 'full' | 'simplified' | 'none'`
- `extras?: Record<string, unknown>` — per-chart extra settings

Backward compat: if `chartConfig` is absent, `TrendPane` defaults to a Live
Trend (type 1) using the legacy `trendPointIds` / `trendDuration` fields.

### Config Panel Layout
Fixed-position modal, two-section layout:

**Section 1 — Type Picker**
- Left column (200px): scrollable list of 34 chart types grouped by category
- Right area: when a type is selected: SVG thumbnail (120×80) + name + full
  description + benefits/downsides/usage notes

**Section 2 — Tag Selector + Options** (below type picker)
- Left box (40%): searchable/filterable list of all points (tag name + description,
  tooltip on hover for long descriptions). Draggable rows. Right-click context menu
  with role-specific "Add to…" items.
- Right box (60%): axis slot targets (varies by chart type — e.g., "Trend Lines",
  "X Axis"/"Y Axis", single "Value" slot). Each dropped point shows color swatch
  (click → `input[type=color]`) + tag name. Remove button per row.
- Below slots: chart-specific options (see Options section below)

### ChartRenderer
Dispatch component: reads `chartConfig.chartType`, renders the matching renderer.
Falls back to `LiveTrend` if type is undefined.

### Data Fetching Strategy
Each renderer fetches its own data internally using TanStack Query. This avoids
an overly complex shared data layer given the radically different data shapes
across chart types.

Time-series renderers (1–4, 16, 22) share a custom hook `useTimeSeriesBuffer`
that encapsulates the ring buffer + seed query + WebSocket append logic currently
in `TrendPane`. This hook replaces the inline logic in the new `LiveTrend` renderer.

---

## Files to Create

### Foundation
- `frontend/src/shared/components/charts/chart-config-types.ts`
- `frontend/src/shared/components/charts/chart-definitions.ts` (metadata + SVG thumbnails for all 34)
- `frontend/src/shared/components/charts/hooks/useTimeSeriesBuffer.ts`

### Config UI
- `frontend/src/shared/components/charts/ChartConfigPanel.tsx`
- `frontend/src/shared/components/charts/ChartTypePicker.tsx`
- `frontend/src/shared/components/charts/ChartPointSelector.tsx`
- `frontend/src/shared/components/charts/ChartOptionsForm.tsx`
- `frontend/src/shared/components/charts/ChartRenderer.tsx`

### Renderers (34 files)
Located at `frontend/src/shared/components/charts/renderers/`:
```
chart01-live-trend.tsx         uPlot — streaming ring buffer
chart02-historical-trend.tsx   uPlot — fixed range with zoom
chart03-multi-axis-trend.tsx   uPlot — multiple Y axes
chart04-step-chart.tsx         uPlot — step interpolation
chart05-bar-column.tsx         ECharts — bar/column
chart06-pie-donut.tsx          ECharts — pie/donut
chart07-kpi-card.tsx           Custom React — single value + sparkline
chart08-gauge.tsx              ECharts — radial gauge
chart09-sparkline.tsx          uPlot minimal — no axes/labels
chart10-analog-bar.tsx         Custom SVG — ISA-101 moving indicator
chart11-fill-gauge.tsx         Custom SVG — fill level
chart12-alarm-indicator.tsx    Custom SVG — ISA-101 alarm badge
chart13-xy-scatter.tsx         ECharts (WebGL) — scatter/XY
chart14-event-timeline.tsx     Custom canvas/SVG — event bars
chart15-data-table.tsx         TanStack Table — virtual scroll
chart16-batch-comparison.tsx   uPlot — multi-run overlay
chart17-heatmap.tsx            ECharts — grid heatmap
chart18-pareto.tsx             ECharts — sorted bar + cumulative line
chart19-box-plot.tsx           ECharts — box/whisker
chart20-histogram.tsx          ECharts — frequency distribution
chart21-waterfall.tsx          ECharts — sequential bars
chart22-stacked-area.tsx       uPlot — filled stacked area
chart23-bullet.tsx             ECharts — compact bar vs target
chart24-shewhart.tsx           uPlot + client-side SPC (mathjs)
chart25-regression.tsx         uPlot + regression fit (mathjs)
chart26-correlation-matrix.tsx ECharts heatmap — pairwise correlation
chart27-sankey.tsx             ECharts — flow diagram
chart28-treemap.tsx            ECharts — nested rectangles
chart29-cusum.tsx              uPlot + CUSUM computation (mathjs)
chart30-ewma.tsx               uPlot + EWMA computation (mathjs)
chart31-probability-plot.tsx   Plotly.js (dynamic import) — Q-Q plot
chart32-funnel.tsx             ECharts — funnel
chart33-radar.tsx              ECharts — radar/spider
chart34-surface3d.tsx          Plotly.js (dynamic import) — 3D surface
```

## Files to Modify
- `frontend/src/pages/console/types.ts` — add `chartConfig?: ChartConfig`
- `frontend/src/shared/components/charts/ChartToolbar.tsx` — add `onConfigure?` prop
- `frontend/src/pages/console/panes/TrendPane.tsx` — wire gear → config panel, use ChartRenderer

## Dependencies to Add
- `plotly.js-dist-min` (MIT) — for charts 31 and 34, lazy-loaded via dynamic import
- `@types/plotly.js` (MIT) — TypeScript types

---

## Chart-Specific Options (per type)

### Time-Series (1–4, 16, 22)
- Duration / lookback window
- Aggregate type + size (if resolution > raw)
- Interpolation: linear / step (chart 4 forces step)
- Legend: show/hide, position, show names/descriptions
- Scaling: auto / fixed (min,max) / multi-scale per series
- X axis labels: full / simplified / none
- Y axis labels: full / simplified / none

### Bar/Column (5)
- Orientation: vertical / horizontal
- Stacked: yes/no
- Aggregation period

### Pie/Donut (6)
- Donut: yes/no (hole size)
- Legend: show/hide, show labels

### KPI Card (7)
- Decimal places
- Sparkline hours
- Thresholds (warning/critical colors)
- Trend indicator: yes/no

### Gauge (8)
- Min / Max range
- Threshold zones (value + color)
- Show value: yes/no

### Sparkline (9)
- Lookback hours
- Color

### Analog Bar (10)
- Range lo/hi
- Desired lo/hi (normal band)
- Orientation: horizontal/vertical

### Fill Gauge (11)
- Range lo/hi
- Fill direction: up/down

### Alarm Indicator (12)
- Mode: single / aggregate
- Severity filter

### XY Scatter (13)
- Time range
- Time coloring: yes/no (gradient old→new)

### Event Timeline (14)
- Time range
- Severity filter
- Show duration bars: yes/no
- Color by: severity / source / state

### Data Table (15)
- Columns to show (point name, description, value, quality, timestamp)
- Sort default

### Batch Comparison (16)
- Reference batch (time range)
- Comparison batches (up to 5 additional time ranges)
- Time mode: elapsed / percentage

### Heatmap (17)
- X categories (hour of day / day of week / custom)
- Y categories
- Color scale

### Pareto (18)
- Max bars
- Threshold line %

### Box Plot (19)
- Orientation: horizontal / vertical
- Show outliers: yes/no
- Show mean: yes/no

### Histogram (20)
- Bin count (or auto)
- Normal curve overlay: yes/no

### Waterfall (21)
- Colors: increase / decrease / total

### Stacked Area (22)
- Same as time-series + stacking mode: absolute / percentage

### Bullet Chart (23)
- Target value
- Range zones (poor/ok/good min values)
- Orientation: horizontal / vertical

### Shewhart (24)
- Chart type: individuals / moving range / I-MR
- Limits: auto / manual (enter sigma values)
- Control rules: Western Electric / Nelson (checkboxes)

### Regression (25)
- Model: linear / polynomial / exponential / logarithmic / power
- Polynomial degree (if polynomial)
- Show equation: yes/no
- Show R²: yes/no
- Confidence interval: yes/no
- Extrapolate N periods

### Correlation Matrix (26)
- Method: Pearson / Spearman
- Show values: yes/no
- Cluster (reorder): yes/no

### Sankey (27)
- Manual node/link definition (JSON editor or structured form)
- Orientation: horizontal / vertical

### Treemap (28)
- Size field mapping
- Color field mapping
- Enable drill-down: yes/no

### CUSUM (29)
- Target (μ₀)
- Decision method: V-mask / tabular (H/K params)
- Two-sided: yes/no

### EWMA (30)
- Lambda (0.05 – 0.4)
- L parameter (control limit width)
- Show raw data overlay: yes/no
- Show Shewhart limits: yes/no

### Probability Plot (31)
- Distribution: normal / lognormal / Weibull / exponential
- Confidence band: yes/no

### Funnel (32)
- Orientation: vertical / horizontal
- Show conversion %: yes/no

### Radar (33)
- Shape: polygon / circle
- Show area fill: yes/no
- Max axes: 8–10

### 3D Surface (34)
- Mode: surface / contour / both
- Color scale
- Show wireframe: yes/no
- Show isolines: yes/no

---

## Slot Definitions (point assignment roles per chart type)

| Type | Slots |
|------|-------|
| 1–4, 16, 22 | `series` (multi) |
| 5 | `series` (multi) — each becomes a category |
| 6 | `series` (multi) — each becomes a slice |
| 7 | `point` (single) |
| 8 | `point` (single) |
| 9 | `point` (single) |
| 10 | `point` (single) + `setpoint` (optional single) |
| 11 | `point` (single) |
| 12 | `series` (multi) |
| 13 | `x` (single) + `y` (single) |
| 14 | `series` (multi) |
| 15 | `series` (multi) |
| 17 | `value` (single) |
| 18 | `series` (multi) |
| 19 | `series` (multi) — each becomes a box |
| 20 | `point` (single) |
| 21 | `series` (multi) — each becomes a step |
| 23 | `point` (single) |
| 24, 29, 30 | `point` (single) |
| 25 | `series` (multi) |
| 26 | `series` (multi, up to 20) |
| 27 | `series` (multi) |
| 28 | `series` (multi) |
| 31 | `point` (single) |
| 32 | `series` (multi) — each becomes a stage |
| 33 | `series` (multi) |
| 34 | `x` (single) + `y` (single) + `z` (single) |

---

## Open Questions (push to end / handled automatically)

- None blocking. Plotly.js (MIT) is safe to add. All math done client-side with mathjs.
- For SPC/statistical charts, backend computation not required — mathjs handles it.
- Historical mode for all charts: uses existing `usePlaybackStore` timeRange.
- Sankey/Treemap with manual data: use a JSON text editor in the options panel for node/link definitions.
