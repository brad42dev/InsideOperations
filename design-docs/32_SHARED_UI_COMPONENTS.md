# Inside/Operations - Shared UI Components

## Overview

This document specifies the reusable frontend components shared across multiple I/O modules. These components provide consistent behavior and appearance for data visualization, data entry, and common interactions throughout the application.

**Purpose:** Single source of truth for shared components, ensuring visual and behavioral consistency across all 11 modules. Every chart, table, picker, and display widget is defined here once and consumed everywhere.

All components are built in React 18/TypeScript and follow the theme system defined in [06_FRONTEND_SHELL.md](06_FRONTEND_SHELL.md). Components use CSS custom properties for theming and support all three I/O themes (Light, Dark, High-Contrast). See [Unified Theming System](#unified-theming-system) for full specification.

### Component Categories

| Category | Components | Primary Consumers |
|----------|-----------|-------------------|
| **Data Visualization** | Charts, trends, gauges, sparklines, KPI cards, analog bar indicators, fill gauges, alarm indicators | Console, Process, Dashboards, Forensics, Reports |
| **Data Tables** | Virtual-scrolling tables with sorting, filtering, conditional formatting | All modules |
| **Interaction Components** | Point Picker, Expression Builder Modal, Time Range Picker, Color Picker, Historical Playback Bar | Designer, Dashboards, Reports, Forensics, Settings, Alerts, Console, Process |
| **Display Components** | Alarm List Widget, Muster Point Widget, quality indicators | Console, Dashboards, Alerts, Shifts |

---

## Charting Library Architecture

### Dual-Library Strategy

I/O uses two charting libraries, each selected for its specific strength:

| Library | License | Bundle Size | Role | Rendering |
|---------|---------|-------------|------|-----------|
| **uPlot** | MIT | ~35 KB | ALL time-series charts | Canvas 2D |
| **Apache ECharts** | Apache 2.0 | ~300 KB gzipped (tree-shakeable) | Everything else (bar, pie, gauge, heatmap, etc.) | Canvas + SVG + WebGL |

**Why not Recharts?** Recharts is SVG-based and caps at approximately 1,000 data points before DOM performance degrades. An 8-hour live trend at 1-second resolution produces 28,800 points per pen -- Recharts cannot handle this. Recharts also lacks step interpolation (critical for discrete/digital values) and adequate multi-axis support. It is not suitable for industrial time-series.

**Why uPlot for time-series?** uPlot renders 166,650 points in 25ms from cold start. Canvas-based, ~35 KB, purpose-built for time series. Supports streaming, step interpolation, multi-axis, and zoom/pan. Nothing else in the React ecosystem approaches this performance for time-series data.

**Why ECharts for everything else?** Most comprehensive chart type library (20+ types). Canvas + WebGL rendering handles large datasets. Tree-shakeable to control bundle size. Mature, well-documented, and actively maintained.

### TanStack Table

**TanStack Table v8+** (MIT, ~15 KB gzipped) handles all data tables. Headless architecture (no UI opinions -- styled with I/O's own components). Virtual scrolling via TanStack Virtual. Full TypeScript support. Consistent with I/O's existing use of TanStack Query.

### React Integration

- **uPlot**: Thin React wrapper component (~200 lines) with hooks for resize, data updates, and configuration. Custom-built for full control over the update lifecycle.
- **ECharts**: `echarts-for-react` wrapper (MIT). Configuration-driven API via JSON options objects.
- **TanStack Table**: Native React hooks API.

### Lazy Loading Strategy

- **uPlot** (~35 KB): Always loaded. Available on any route that displays trend data (Console, Process, Dashboards, Forensics, Reports).
- **ECharts** (~300 KB gzipped): Loaded on demand per module. Tree-shaken to include only the chart types used by each module's code-split chunk.
  - Console/Process: uPlot only (no ECharts needed)
  - Dashboards: uPlot + ECharts (bar, pie, gauge)
  - Forensics: uPlot + ECharts (heatmap, Pareto, box plot, scatter)
  - Reports: ECharts for static chart rendering in PDF/HTML output

### Mobile Rendering

ECharts uses SVG renderer on mobile devices for lower memory consumption (Canvas creates offscreen bitmaps that consume significant memory on mobile). uPlot remains Canvas-based on all platforms (its memory footprint is inherently small).

---

## Chart Types -- Must-Have (Initial Release)

Twelve chart types are required for initial release. Each is specified with its rendering library, primary use cases, configuration options, and real-time update capability.

### 1. Live Trend

- **Component**: `<LiveTrend />`
- **Library**: uPlot
- **Description**: Real-time scrolling strip chart. New values append on the right, old values scroll off the left. The primary operator monitoring tool.
- **Primary use**: Console (pane trends), Process (embedded trends), Dashboards (trend widget)
- **Key configuration**:
  - `points`: Array of point subscriptions with pen color, label, Y-axis assignment
  - `lookback`: Scrolling window duration (5m, 30m, 1h, 4h, 8h, 24h)
  - `interpolation`: `'linear'` (analog values) or `'step'` (discrete values, see Step Chart)
  - `y_axes`: Array of Y-axis definitions (min, max, auto-scale, units, position left/right)
  - `show_quality`: Boolean -- render bad/uncertain quality indicators
- **Real-time**: Yes. Streaming append via WebSocket point updates. Individual point updates, not full re-render.
- **Live/Frozen toggle**: "LIVE" badge with green dot (auto-scrolling) or "PAUSED" with timestamp of freeze point. Quick return-to-live button.

### 2. Historical Trend

- **Component**: `<HistoricalTrend />`
- **Library**: uPlot
- **Description**: Fixed time range trend for archived data. User selects start/end time and the chart renders the full range with zoom/pan.
- **Primary use**: Forensics (investigation), Reports (historical analysis), Dashboards (historical view)
- **Key configuration**:
  - `points`: Array of point subscriptions with pen color, label, Y-axis assignment
  - `time_range`: `{ start: ISO8601, end: ISO8601 }`
  - `resolution`: Auto-selected from continuous aggregates (1m, 5m, 15m, 1h, 1d) based on zoom level, or raw data when zoomed in. See [18_TIMESERIES_DATA.md](18_TIMESERIES_DATA.md).
  - `y_axes`: Same as Live Trend
  - `show_events`: Boolean -- overlay alarm/event markers on the trend
- **Real-time**: No. Static data fetch with zoom-triggered re-fetch at finer resolution.
- **Multi-resolution LOD**: Seamless transition between aggregate levels as user zooms. LTTB (Largest Triangle Three Buckets) downsampling for visual fidelity at overview zoom levels.

### 3. Multi-Axis Trend

- **Component**: `<MultiAxisTrend />`
- **Library**: uPlot
- **Description**: Multiple Y-axes for parameters with different engineering units, sharing a synchronized time axis. Supports both side-by-side axes (left/right) and vertically stacked panes.
- **Primary use**: Console (correlating temperature + pressure + flow), Forensics (multi-variable investigation)
- **Key configuration**:
  - `panes`: Array of pane definitions, each with its own points and Y-axes
  - `synchronized_crosshair`: Boolean (default true) -- crosshair syncs across all panes
  - `pane_heights`: Relative heights for stacked panes (resizable by drag)
  - Axis colors match their corresponding pen colors
- **Real-time**: Yes (live mode) or No (historical mode). Same component, mode-switched.

### 4. Step Chart

- **Component**: `<StepChart />` (or Live/Historical Trend with `interpolation: 'step'`)
- **Library**: uPlot
- **Description**: Horizontal-then-vertical step interpolation for discrete/digital values. A valve is either 50% or 75% -- never smoothly transitioning between them. Displaying discrete values as interpolated lines is a data integrity error.
- **Primary use**: Console (valve states, pump on/off, mode selections), Process (equipment status), Forensics (discrete state history)
- **Key configuration**:
  - Same as Live/Historical Trend with `interpolation: 'step'` enforced
  - `state_labels`: Optional mapping of numeric values to display labels (e.g., `{ 0: "Closed", 1: "Open" }`)
- **Real-time**: Yes.
- **Notes**: Often rendered in a separate stacked pane below analog trends via Multi-Axis Trend.

### 5. Bar / Column Chart

- **Component**: `<BarChart />`
- **Library**: ECharts
- **Description**: Vertical (column) or horizontal (bar) charts for categorical comparisons.
- **Primary use**: Dashboards (production totals, shift comparisons), Reports (batch yields, alarm counts by area)
- **Key configuration**:
  - `orientation`: `'vertical'` | `'horizontal'`
  - `stacked`: Boolean -- grouped vs. stacked bars
  - `categories`: Array of category labels or time buckets
  - `series`: Array of data series with colors
  - `aggregation`: Optional time-bucket aggregation config `{ bucket: '1h'|'1d'|..., function: 'sum'|'avg'|'max'|'min'|'count' }`
- **Real-time**: Optional. Can refresh on interval for live dashboard use.

### 6. Pie / Donut Chart

- **Component**: `<PieChart />`
- **Library**: ECharts
- **Description**: Circular proportional chart. Limited to approximately 7 slices; additional values bucketed into "Other."
- **Primary use**: Dashboards (alarm distribution by severity, equipment status breakdown), Reports (production split)
- **Key configuration**:
  - `donut`: Boolean -- ring chart with center hole vs. filled pie
  - `data_source`: Query or static data definition
  - `label_field`: Field for slice labels
  - `value_field`: Field for slice values
  - `show_legend`: Boolean
  - `show_labels`: Boolean -- labels on slices
- **Real-time**: Optional. Can refresh on interval.

### 7. KPI Card

- **Component**: `<KpiCard />`
- **Library**: Custom React component (no charting library)
- **Description**: Single large value display with label, trend indicator (up/down arrow), threshold coloring, and optional embedded sparkline.
- **Primary use**: Dashboards (current production rate, uptime, safety metrics, OEE)
- **Key configuration**:
  - `point_id`: OPC point to display
  - `label`: Display label
  - `unit`: Engineering unit string
  - `decimal_places`: Number of decimal places
  - `sparkline_hours`: Number of hours of sparkline history (0 = no sparkline)
  - `thresholds`: `{ warning: number, critical: number }` -- drives background color
  - `trend_indicator`: Boolean -- show up/down arrow based on recent direction
- **Real-time**: Yes. Value updates via WebSocket. Sparkline appends new points.

### 8. Gauge

- **Component**: `<Gauge />`
- **Library**: ECharts
- **Description**: Circular radial gauge showing a single value against a range with colored threshold zones. Maps directly to physical instrument analogy.
- **Primary use**: Dashboards (tank levels, vessel pressure, motor load), Console (embedded in graphics)
- **Key configuration**:
  - `point_id`: OPC point to display
  - `min`: Minimum scale value
  - `max`: Maximum scale value
  - `thresholds`: Array of `{ value: number, color: string }` -- colored zones on the gauge arc
  - `label`: Display label
  - `unit`: Engineering unit string
  - `show_value`: Boolean -- numeric readout below gauge
- **Real-time**: Yes. Needle/value updates via WebSocket.

### 9. Sparkline

- **Component**: `<Sparkline />`
- **Library**: uPlot (minimal configuration) or custom Canvas
- **Description**: Miniature inline trend chart with no axes, no labels, no interactive features. Embedded in table cells, KPI cards, and list views. Shows "which direction is this going?" at a glance.
- **Primary use**: Data tables (point value sparkline column), KPI cards (embedded trend context), Console/Process graphics (inline on SVG canvas via doc 19 SparklineMapping — same visual language, rendered as SVG polyline instead of Canvas)
- **Key configuration**:
  - `point_id`: OPC point
  - `hours`: Lookback duration
  - `width`: Pixel width (typically 60-120px)
  - `height`: Pixel height (typically 20-30px)
  - `color`: Pen color
  - `interpolation`: `'linear'` | `'step'`
- **Real-time**: Yes. Appends new values as they arrive.

### 10. Analog Bar Indicator

- **Component**: `<AnalogBar />`
- **Library**: Custom React/SVG component
- **Description**: ISA-101 "moving analog indicator" — segmented zone bar with moving pointer. Shows the value's position relative to operating limits, alarm thresholds, and setpoint. NOT a fill gauge — shows parametric position, not physical level. Only the zone containing the current value lights up; all other zones remain gray.
- **Primary use**: Console/Process graphics (inline on canvas via doc 19 display elements), Dashboards (as widget)
- **Key configuration**:
  - `point_id`: OPC point to display
  - `range_lo` / `range_hi`: Overall instrument range (auto from point config, overridable)
  - `desired_lo` / `desired_hi`: Normal operating band
  - `setpoint_point_id`: Optional separate point for setpoint marker
  - `orientation`: `'vertical'` | `'horizontal'` | `'auto'`
  - `show_value`: Boolean — numeric readout adjacent to bar
  - `value_format`: Printf-style format string
- **Visual anatomy (vertical orientation, top to bottom)**:
  - **HH zone**: 16-20px tall, `--io-display-zone-inactive` fill when inactive, `--io-alarm-critical` @ 50% when value is in zone
  - **H zone**: 16-20px tall, inactive fill, `--io-alarm-high` @ 50% when active
  - **Normal zone**: 40-60px tall, `--io-display-zone-normal` fill (always this shade — never lights up in color)
  - **L zone**: 16-20px tall, inactive fill, `--io-alarm-medium` @ 50% when active
  - **LL zone**: 16-20px tall, inactive fill, `--io-alarm-critical` @ 50% when active
  - Bar width: 20-24px. Each zone is a `<rect>` with 0.5px `--io-display-zone-border` stroke.
  - **Zone labels**: HH/H/L/LL in Inter 7px `--io-text-muted`, left of bar (vertical) or above (horizontal). Normal zone unlabeled.
  - **Range labels**: max/min values in JetBrains Mono 7px, right of bar at top and bottom.
- **Pointer**: Left-pointing triangle (vertical) or down-pointing triangle (horizontal). `--io-text-secondary` fill, changes to zone alarm color when in alarm zone. ~6px wide × 8px tall.
- **Setpoint marker**: Diamond shape, `--io-accent` stroke, no fill. Positioned same edge as pointer. The visual gap between pointer and setpoint IS the deviation indicator.
- **Numeric readout**: Optional JetBrains Mono 11px below bar. In alarm: alarm-colored border box (same treatment as Text Readout). Optional `SP: {value}` in Inter 8px `--io-text-muted`.
- **Horizontal variant**: Zones flow LL → L → Normal → H → HH (left to right). Pointer triangle points down from above.
- **Signal line**: When placed below an instrument bubble on a graphic, optional 0.75px dashed line connects instrument to bar top.
- **Real-time**: Yes. Pointer position and zone activation update via WebSocket. Alarm state drives zone colors and flash (1Hz, alarm color ↔ gray for unacknowledged).

### 11. Fill Gauge

- **Component**: `<FillGauge />`
- **Library**: Custom React/SVG component
- **Description**: Level indicator showing physical capacity as a continuous fill. The visual metaphor is "how full is this thing" — a 62% value fills 62% of the gauge, which must be visually proportional. Distinct from Analog Bar (parametric threshold position). Supports 3 placement modes.
- **Primary use**: Console/Process graphics (inline on canvas), Dashboards. Multiple fill gauges can be placed side-by-side on the same vessel (e.g., actual level, interface level, calculated volume — each bound to a different point).
- **Key configuration**:
  - `point_id`: OPC point to display
  - `range_lo` / `range_hi`: Empty and full values
  - `fill_direction`: `'up'` (default) | `'right'`
  - `placement`: `'vessel_overlay'` | `'standalone'` (default)
  - `clip_to_shape_id`: SVG element ID for vessel interior clipping (vessel_overlay mode)
  - `show_value`: Boolean — numeric overlay
  - `show_setpoint`: Boolean — horizontal setpoint line
  - `show_threshold_markers`: Boolean — tick marks at alarm threshold levels
  - `value_format`: Printf-style format string
- **Placement modes**:
  - **Vessel overlay**: Fill `<rect>` clips to the vessel shape interior via SVG `<clipPath>`. Visually fills the tank/sphere/column. Fill never overflows the shape boundary.
  - **Standalone vertical bar**: Independent rectangle element (20-24px wide), placed anywhere on canvas. 0.5px `--io-display-zone-border` stroke.
  - **Standalone horizontal bar**: Same as vertical but `fill_direction: 'right'`.
- **Fill rendering**:
  - **Normal**: `--io-fill-normal` (muted blue-gray). Calm, clearly distinguishable from vessel stroke.
  - **In alarm**: Fill color changes to alarm priority color @ 30% opacity.
  - **Unacknowledged**: Fill rectangle flashes 1Hz (alarm color ↔ transparent).
- **Threshold markers**: Optional tick marks on vessel wall or bar edge at alarm threshold levels. Red ticks for HH/LL (1.5px), amber for H/L (1px). Tick length: ~6px.
- **Setpoint line**: Optional horizontal dashed line at setpoint value. `--io-accent` (cyan), 1px, dash `3,2`. Spans full width.
- **Numeric value**: Optional JetBrains Mono 11-12px overlay. Inside fill area (vessel mode) or below bar (standalone). Percentage by default, configurable to engineering units.
- **Tag label**: Below gauge: tag name in Inter 10px `--io-text-muted`, optional secondary value (e.g., barrels) in JetBrains Mono 11px `--io-text-secondary`.
- **Real-time**: Yes. Fill height updates via WebSocket. Fill color follows alarm state.

### 12. Alarm Indicator

- **Component**: `<AlarmIndicator />`
- **Library**: Custom React/SVG component
- **Description**: ISA-101 priority-coded alarm indicator placed near equipment. Uses triple redundant coding (shape + color + text) for colorblind accessibility. Completely invisible when no alarm active — no placeholder, no empty outline. Per ISA-101, equipment shapes do NOT change color for alarms — this separate indicator element is the alarm visualization.
- **Primary use**: Console/Process graphics (near equipment shapes), Dashboards (equipment status widgets)
- **Key configuration**:
  - `mode`: `'single'` (one point) | `'aggregate'` (highest-priority across equipment)
  - `point_id`: Single point for single mode
  - `equipment_point_ids`: Array of point UUIDs for aggregate mode
- **Priority shape geometry** (triple redundant: shape + color + text):

  | Priority | Shape | Dimensions | Color | Text |
  |---|---|---|---|---|
  | 1 Critical | Rectangle | 24×18px, rx=2 | `--io-alarm-critical` (Red) | `1` |
  | 2 High | Triangle (up) | ~20px base | `--io-alarm-high` (Amber) | `2` |
  | 3 Medium | Triangle (inverted) | ~20px base | `--io-alarm-medium` (Yellow) | `3` |
  | 4 Advisory | Ellipse | rx=14, ry=10 | `--io-alarm-advisory` (Cyan) | `4` |
  | Custom | Diamond | ~20px diagonal | `--io-alarm-custom` (Purple) | `C` |

- **Rendering**: Stroke-only shapes (no fill), 1.5-2px stroke at priority color. Text centered inside: JetBrains Mono 8-10px, `font-weight: 600`, same color as stroke. Approximately 20-24px across — visible at normal zoom, not dominant on dense graphics.
- **Positioning**: Default upper-right of associated equipment shape, minimum 4-6px clear gap from equipment outline. Must never overlap the equipment shape. Sidecar `alarmAnchor` provides snap position for initial placement; user can reposition freely.
- **Flash behavior**: Unacknowledged — entire indicator group (shape + text) flashes 1Hz via CSS animation (opacity 1 ↔ 0, `step-end` timing for sharp on/off). Acknowledged — steady, no flash. RTN unacknowledged — optional 0.5Hz slow flash.
- **Aggregation**: Shows highest-priority active alarm. Ranking: unacknowledged > acknowledged > RTN-unacknowledged. Higher priority wins (Critical > High > Medium > Advisory). Count badge shows total active alarms when > 1.
- **Real-time**: Yes. `display: none` when normal → appears with appropriate shape/color when alarm activates. State transitions are immediate (no fade animation).

### 13. XY Plot / Scatter

- **Component**: `<XYPlot />`
- **Library**: ECharts (WebGL renderer for large datasets)
- **Description**: One process variable plotted against another (not time). Shows relationships and correlations between two parameters.
- **Primary use**: Forensics (identifying correlations -- compressor discharge pressure vs. speed, heat exchanger effectiveness)
- **Key configuration**:
  - `x_point`: Point for X-axis
  - `y_point`: Point for Y-axis
  - `time_range`: Data time range
  - `time_coloring`: Boolean -- gradient coloring from old (cool) to new (warm)
  - `reference_curve`: Optional expected operating envelope/curve overlay
  - `click_to_timestamp`: Boolean -- clicking a dot reveals its timestamp
- **Real-time**: No (historical data analysis). Could support live accumulation in future.

### 14. Event Timeline

- **Component**: `<EventTimeline />`
- **Library**: Custom component using ECharts custom series or standalone Canvas
- **Description**: Horizontal timeline showing events, alarms, and state changes as colored bars and markers. Multiple rows for different sources.
- **Primary use**: Forensics (alarm journal visualization, equipment state history, correlated with trends above/below)
- **Key configuration**:
  - `sources`: Array of event sources (alarm types, equipment IDs, areas)
  - `time_range`: Synchronized with associated trend charts
  - `severity_filter`: Filter by alarm severity levels
  - `show_duration`: Boolean -- bars for duration events vs. markers for point events
  - `color_by`: `'severity'` | `'source'` | `'state'`
- **Real-time**: Yes (for live alarm monitoring). Synchronized crosshair with adjacent trend charts.

### 15. Data Table

- **Component**: `<DataTable />`
- **Library**: TanStack Table + TanStack Virtual
- **Description**: Full-featured data table with virtual scrolling, sorting, filtering, and conditional formatting. The universal table component for all tabular data across I/O.
- **Primary use**: All modules -- alarm journals, event logs, point value lists, round checklists, aggregation summaries, alert status
- **Key features**: See [Data Table Component](#data-table-component) section below.
- **Real-time**: Yes. Individual cell updates via WebSocket, not full table re-render.

---

## Chart Types -- Mid/Late v1 (Post-Reports Build)

Eleven additional chart types for mid-to-late v1 implementation, after the Reports module is built. These extend I/O's visualization capabilities into batch analysis, statistical quality control, and deeper BI reporting.

| # | Chart Type | Library | Description | Primary Use |
|---|-----------|---------|-------------|-------------|
| 13 | **Batch Comparison Overlay** | uPlot | Multiple time-series from different time periods overlaid on a common relative time axis. Compare "this batch" to "golden batch." | Forensics -- batch deviation analysis |
| 14 | **Heatmap** | ECharts | Matrix/grid where color intensity represents value magnitude. Calendar or category-based. | Forensics -- alarm frequency patterns (time-of-day vs. day-of-week), temperature distribution |
| 15 | **Pareto Chart** | ECharts | Bar chart sorted by frequency/impact with cumulative percentage line. | Reports -- top alarm analysis (ISA-18.2), most frequent equipment failures |
| 16 | **Box Plot** | ECharts | Distribution via quartiles: median, Q1, Q3, whiskers, outliers. | Forensics -- compare variable distributions across shifts or time periods |
| 17 | **Histogram** | ECharts | Frequency distribution of a single variable across bins. | Forensics -- process variable distribution, alarm duration analysis |
| 18 | **Waterfall Chart** | ECharts | Cumulative positive/negative bars showing sequential contributions. | Dashboards -- heat/energy balance, material balance, pressure drop |
| 19 | **Stacked Area** | ECharts or uPlot | Line chart with filled area below. Stacked variant shows cumulative contributions. | Dashboards -- total flow with component breakdown, energy by source |
| 20 | **Bullet Chart** | ECharts | Compact bar showing actual vs. target with performance range backgrounds. | Dashboards -- KPI actual vs. plan, compact alternative to gauges |
| 21 | **Shewhart Control Chart** | uPlot + custom limit lines | Time-series with center line (mean), UCL/LCL at +/- 3 sigma. Western Electric / Nelson rules for pattern detection. I-MR variant for continuous process data. | Forensics, Reports -- quality control, process stability assessment |
| 22 | **Regression / Trendline** | uPlot + computed overlay | Fitted line (linear, polynomial, exponential) overlaid on scatter or time series. Displays equation, R-squared, confidence intervals. | Forensics -- equipment degradation prediction, fouling rate |
| 23 | **Correlation Matrix** | ECharts (heatmap variant) | Grid showing Pearson/Spearman correlation coefficients between multiple variables. | Forensics -- discovering variable relationships, finding leading indicators |

---

## Chart Types -- Late v1

Eight chart types for late v1 implementation. These serve advanced statistical analysis and specialized visualization needs.

| # | Chart Type | Library | Brief Description |
|---|-----------|---------|-------------------|
| 24 | **Sankey Diagram** | ECharts | Flow diagram with arrow widths proportional to flow quantity. Energy/material flow through a plant. |
| 25 | **Treemap** | ECharts | Nested rectangles sized/colored by value within a hierarchy. Alarm distribution across plant hierarchy. |
| 26 | **CUSUM Chart** | uPlot + custom | Cumulative sum of deviations from target. Detects small sustained shifts (1-sigma or less). |
| 27 | **EWMA Chart** | uPlot + custom | Exponentially weighted moving average with control limits. Robust to non-normality and autocorrelated data. |
| 28 | **Probability Plot** | Plotly.js (lazy-load) | Q-Q plot to assess normality. Validates assumptions before statistical analysis. |
| 29 | **Funnel Chart** | ECharts | Stacked trapezoids for stage-based progressive reduction. Work order approval pipeline. |
| 30 | **Radar Chart** | ECharts | Multi-axis polygon for comparing multiple attributes of a single entity. Equipment health scoring. |
| 31 | **3D Surface / Contour** | Plotly.js (lazy-load) | Three-dimensional surface or contour plot. Advanced Forensics visualization. |

**Note on Plotly.js:** Types 28 and 31 require Plotly.js (MIT, ~1-3 MB). Lazy-loaded on demand only when a user opens a view containing these chart types. Included in the v1 build.

---

## Common Chart Features

Shared interaction patterns and display conventions across all chart types.

### Interaction

| Feature | Description | Applies To |
|---------|-------------|------------|
| **Zoom (time axis)** | Mouse wheel or click-drag to select time range. Pinch-zoom on touch. | All time-series charts |
| **Zoom (value axis)** | Mouse wheel on Y-axis to zoom value range | All time-series charts |
| **Pan** | Click-drag to pan time and value axes | All time-series charts |
| **Crosshair** | Vertical line following cursor showing exact timestamp | All time-series charts |
| **Synchronized crosshair** | Crosshair position syncs across multiple charts/panes in the same view | Forensics, Console (multi-pane) |
| **Value readout** | Exact values of all pens at crosshair position, shown in legend or floating tooltip | All time-series charts |
| **Brush selection** | Drag to select a time range for detailed zoom-in | Historical Trend, Forensics |
| **Tooltip** | Hover for detail: value, timestamp, quality status, engineering unit | All chart types |
| **Legend toggle** | Click legend item to show/hide individual series | All multi-series charts |
| **Axis scaling** | Auto, manual (user-set min/max), or logarithmic | All charts with numeric axes |
| **Time range presets** | Quick buttons: 1h, 4h, 8h, 24h, 7d, 30d, custom | All time-series charts |
| **Live scroll / frozen toggle** | Switch between auto-scrolling and paused state | Live Trend |
| **Trend comparison overlay** | Overlay the same point(s) from two different time ranges on a relative axis | Historical Trend, Forensics |
| **Event/alarm markers** | Vertical lines or markers at alarm activation/clear times, operator action times | Time-series charts (opt-in) |
| **Annotations** | User-placed text markers on trends for investigation notes | Forensics, Reports |
| **Export chart image** | Save chart as PNG or SVG | All chart types |

### Display Conventions

**Alarm colors** follow IEC 60073:

| State | Color | Usage |
|-------|-------|-------|
| Critical / Emergency | `--io-alarm-critical` (`#DC2626`) | Immediate danger, safety shutdown, high-priority alarm |
| Warning | `--io-alarm-high` (`#F59E0B`) | Abnormal condition, needs attention |
| Normal | `--io-alarm-normal` (`#22C55E`) | Within normal operating range |
| Suppressed / Shelved | `--io-alarm-suppressed` (`#A78BFA`) | Alarm is suppressed or shelved by operator |
| Disabled / Out-of-Service | `--io-alarm-disabled` (`#71717A`) | Alarm source disabled or equipment out of service |

**Trend pen conventions:**

- Default color rotation for multi-pen trends: Blue, Orange, Green, Red, Purple, Brown, Pink, Gray (avoids red/green-only pairs for colorblind accessibility)
- Dashed lines for setpoints
- Dotted lines for alarm limits (HH/H/L/LL)
- Red dashed horizontal lines for high/low alarm limits
- Yellow/amber dashed horizontal lines for high/low warning limits
- Light shaded region between normal operating limits (optional)

**Quality indicators** per OPC UA quality codes:

| Quality | Display |
|---------|---------|
| Good | Normal rendering, no indicator |
| Bad | Gap in trend line. Badge icon in tables/tooltips. |
| Uncertain | Dashed or dotted line segment. Badge icon in tables/tooltips. |

**Stale data**: Value dims or grays out when point staleness exceeds threshold (60s default per [02_SYSTEM_ARCHITECTURE.md](02_SYSTEM_ARCHITECTURE.md)). Hover shows last-known timestamp.

**Number formatting**: Configurable decimal places per point. Engineering notation for large numbers (e.g., 1.23e6). Engineering unit string displayed adjacent to value.

---

## Data Table Component

Based on TanStack Table v8 + TanStack Virtual. This is the single table component used across all modules.

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Virtual scrolling** | Render only visible rows. Handles 100K+ rows without jank. | Must-have |
| **Frozen columns** | Pin columns to left or right edge while scrolling horizontally. | Must-have |
| **Sortable columns** | Click header for asc/desc. Multi-column sort (hold Shift + click). | Must-have |
| **Filterable columns** | Per-column filters: text search, numeric range, enum dropdown. | Must-have |
| **Conditional formatting** | Cell background/text color based on value. Alarm state colors. Threshold highlighting. | Must-have |
| **Inline sparklines** | Embedded `<Sparkline />` component in table cells. | Must-have |
| **Sticky headers** | Column headers remain visible during vertical scroll. | Must-have |
| **Column resizing** | Drag column borders to resize width. | Must-have |
| **Export** | Export visible/filtered data to CSV or clipboard. Integrates with export system ([25_EXPORT_SYSTEM.md](25_EXPORT_SYSTEM.md)). | Must-have |
| **Real-time cell updates** | Individual cell value updates via WebSocket. No full table re-render. | Must-have |
| **Row expansion** | Click to expand row for additional detail view. | Nice-to-have |
| **Column reordering** | Drag columns to rearrange display order. | Nice-to-have |
| **Row grouping** | Group rows by column value with collapsible sections. | Nice-to-have |
| **Pagination / infinite scroll** | Configurable: paginated (page size selector) or continuous infinite scroll. | Must-have |
| **Multi-select** | Select multiple rows for bulk actions (acknowledge, export, etc.). | Nice-to-have |

### Table Variants

The same `<DataTable />` component serves all tabular views. Variants differ only in column definitions, data sources, and enabled features:

| Variant | Module(s) | Key Features |
|---------|-----------|--------------|
| **Alarm Journal** | Console, Forensics | Severity color coding, acknowledge action button, time-since-activation, sound on new critical alarm, severity/area/state filtering |
| **Event Log** | Log, Forensics | Chronological entries, severity icons, free-text search, expandable detail rows |
| **Point Value Snapshot** | Console, Settings | Current value, quality badge, timestamp, sparkline, alarm state, engineering unit |
| **Aggregation Summary** | Reports, Dashboards | Grouped rows, subtotals, time-bucket columns (hourly/daily), conditional formatting |
| **Round Checklist** | Rounds | Checkbox/input cells, pass/fail coloring, photo attachment indicators, GPS timestamp |
| **Alert Status** | Dashboards, Alerts | Active alerts, severity badge, escalation state, acknowledgment controls |

---

## Widget Configuration Schemas

Each widget type that can be placed on Dashboards and Reports via the Designer has a configuration schema. These are the JSONB structures stored in the database `widget_config` column. The Designer reads and writes these schemas; the rendering components consume them at display time.

### Trend Widget

```json
{
  "type": "trend",
  "points": [
    {
      "point_id": "uuid",
      "label": "Reactor Temp",
      "color": "var(--io-pen-1)",
      "axis": 0,
      "interpolation": "linear"
    }
  ],
  "time_range": {
    "type": "relative",
    "value": "8h"
  },
  "auto_scale": true,
  "y_axes": [
    {
      "position": "left",
      "label": "Temperature (F)",
      "min": null,
      "max": null,
      "log_scale": false
    }
  ],
  "refresh_interval_ms": 1000,
  "show_quality": true,
  "show_events": false,
  "live": true
}
```

### Table Widget

```json
{
  "type": "table",
  "columns": [
    {
      "point_id": "uuid",
      "label": "Tag Name",
      "format": "string",
      "width": 200
    },
    {
      "point_id": "uuid",
      "label": "Value",
      "format": "number",
      "decimal_places": 2,
      "show_sparkline": true,
      "sparkline_hours": 4
    }
  ],
  "sort": {
    "column": "label",
    "direction": "asc"
  },
  "filters": [],
  "max_rows": 100,
  "pagination": true,
  "real_time": true
}
```

### Gauge Widget

```json
{
  "type": "gauge",
  "point_id": "uuid",
  "min": 0,
  "max": 100,
  "thresholds": [
    { "value": 70, "color": "var(--io-alarm-normal)" },
    { "value": 85, "color": "var(--io-alarm-high)" },
    { "value": 95, "color": "var(--io-alarm-critical)" }
  ],
  "label": "Tank Level",
  "unit": "%",
  "show_value": true
}
```

### KPI Card Widget

```json
{
  "type": "kpi_card",
  "point_id": "uuid",
  "label": "Production Rate",
  "unit": "bbl/day",
  "decimal_places": 0,
  "sparkline_hours": 24,
  "trend_indicator": true,
  "thresholds": {
    "warning": 8000,
    "critical": 6000
  }
}
```

### Bar Chart Widget

```json
{
  "type": "bar_chart",
  "points": [
    { "point_id": "uuid", "label": "Unit A", "color": "var(--io-pen-1)" },
    { "point_id": "uuid", "label": "Unit B", "color": "var(--io-pen-2)" }
  ],
  "aggregation": {
    "bucket": "1d",
    "function": "sum"
  },
  "orientation": "vertical",
  "stacked": false,
  "show_legend": true
}
```

### Pie Chart Widget

```json
{
  "type": "pie_chart",
  "data_source": {
    "query_type": "alarm_count_by_severity",
    "time_range": { "type": "relative", "value": "24h" }
  },
  "label_field": "severity",
  "value_field": "count",
  "donut": true,
  "show_legend": true,
  "show_labels": true
}
```

### Alarm List Widget

```json
{
  "type": "alarm_list",
  "filter": {
    "severities": ["CRITICAL", "WARNING"],
    "sources": [],
    "point_ids": [],
    "areas": []
  },
  "max_rows": 50,
  "show_acknowledged": false,
  "auto_refresh": true,
  "columns": ["severity", "message", "source", "timestamp", "state"]
}
```

### Muster Point Widget

```json
{
  "type": "muster_point",
  "muster_point_id": "uuid",
  "show_headcount": true,
  "show_list_on_click": true,
  "color_coding": {
    "accounted": "var(--io-success)",
    "unaccounted": "var(--io-danger)",
    "unknown": "var(--io-text-disabled)"
  }
}
```

---

## Interaction Components

### Point Picker

**Component**: `<PointPicker />`

Modal dialog for selecting one or more OPC points. Used wherever a user needs to bind a point to a widget, chart, alarm threshold, or expression.

**Features:**
- **Search**: Filter by tag name, description, area, engineering unit. Typeahead search (< 200ms).
- **Tree view**: Browse by OPC source hierarchy (Source > Area > Equipment > Point).
- **Favorites**: Star frequently used points. Persisted per user.
- **Recent**: Last 20 selected points shown in a quick-access list.
- **Multi-select mode**: Toggle for selecting multiple points at once (for trend widgets, chart series).
- **Preview**: Hovering a point shows current value, quality, timestamp, engineering unit, and sparkline.
- **Returns**: `point_id` (single-select) or `point_id[]` (multi-select) to the caller.

### Expression Builder Modal

**Component**: `<ExpressionBuilderModal />`

Embedded expression builder (see [23_EXPRESSION_BUILDER.md](23_EXPRESSION_BUILDER.md)) presented as a full-screen modal overlay. The same engine and UI is used everywhere -- the only difference is the input catalog available in each context.

**Context-dependent input catalog:**

| Context | Available Inputs |
|---------|-----------------|
| Point configuration (Settings) | OPC points as inputs |
| Rounds checkpoint | Checkpoint fields (multi-field values) + optionally OPC points |
| Dashboard / Report widget | OPC points, time-bucket aggregates, time functions |
| Alert / Alarm definition | OPC points, expressions, threshold comparisons |
| Forensics calculated field | OPC points, statistical functions |

**Returns**: Serialized expression AST (JSONB) to the caller. The caller stores it in the appropriate configuration field.

### Time Range Picker

**Component**: `<TimeRangePicker />`

Compact control for selecting time ranges. Used by all historical chart types, Forensics, and Reports.

**Features:**
- **Preset buttons**: 1h, 4h, 8h, 24h, 7d, 30d
- **Custom range**: Calendar date/time pickers for start and end
- **Relative mode**: "Last N hours/days" with configurable N
- **Live mode toggle**: Switch between fixed range and auto-advancing "now" endpoint
- **Keyboard shortcuts**: Left/right arrow to shift range, +/- to zoom range
- **Returns**: `{ start: ISO8601, end: ISO8601, live: boolean }`

### Color Picker

**Component**: `<ColorPicker />`

Color selection for trend pen colors, threshold colors, widget theming.

**Features:**
- **Preset palette**: Industrial-standard color rotation (Blue, Orange, Green, Red, Purple, Brown, Pink, Gray) plus alarm colors
- **Custom color**: Hex input and HSL sliders
- **Recent colors**: Last 10 used colors
- **Returns**: Hex color string

---

## Industrial Display Conventions

Standardized display rules derived from IEC 60073, ISA-101, and common industrial practice. All shared components follow these conventions.

### Alarm Colors (IEC 60073)

| Severity | Background | Text | Usage |
|----------|-----------|------|-------|
| Emergency / Critical-High | `--io-alarm-critical` (`#DC2626`) | White | Immediate danger, safety shutdown |
| Critical / High | `--io-alarm-critical` (`#DC2626`) | White | Requires immediate operator response |
| Warning / Medium | `--io-alarm-high` (`#F59E0B`) | Black | Abnormal condition, needs attention |
| Advisory / Low | `--io-alarm-advisory` (`#3B82F6`) | White | Informational, no action required |
| Normal / OK | `--io-alarm-normal` (`#22C55E`) | White | Within normal operating range |

### Trend Pen Conventions

- Default color rotation for multi-pen trends avoids red/green-only pairs (colorblind accessibility)
- Dashed lines for setpoints
- Dotted lines for alarm/warning limits
- Light shaded region for normal operating range (optional)
- Gap in line for Bad quality data
- Dashed/dotted line segment for Uncertain quality
- Dimmed/grayed for stale data (> staleness threshold)

### Quality Indicators

Per OPC UA quality codes. Every value display (chart, table cell, KPI card, gauge) must indicate quality when not Good:

- **Good**: No indicator. Normal rendering.
- **Bad**: Red badge icon. Gap in trend line. Cell background tint.
- **Uncertain**: Yellow badge icon. Dashed trend line. Cell background tint.

### Stale Data

Visual staleness indicator per [02_SYSTEM_ARCHITECTURE.md](02_SYSTEM_ARCHITECTURE.md) -- 60s default point-level staleness, instant source-level offline detection. Value text dims or grays. Hover shows last-known timestamp. Applies to all value displays.

### Number Formatting

- Configurable decimal places per point (stored in point metadata)
- Engineering notation for large numbers (e.g., `1.23M`, `4.56k`)
- Engineering unit string displayed adjacent to value
- Thousands separator configurable (comma vs. space vs. none)

---

## Mobile Considerations

Mobile devices have reduced rendering capability. The shared components adapt as follows:

### Canvas Auto-Switch Thresholds

Lower thresholds for hybrid SVG/Canvas rendering (see [19_GRAPHICS_SYSTEM.md](19_GRAPHICS_SYSTEM.md)):

| Device | Auto-Enable Threshold |
|--------|----------------------|
| Desktop | 3,000 elements |
| Tablet | 1,500 elements |
| Phone | 800 elements |

### Touch-Optimized Interactions

- Larger hit zones for chart elements (minimum 44x44px per WCAG, 60px for gloved operation per I/O mobile requirements)
- Momentum scrolling in tables
- Pinch-zoom for charts and graphics (must work smoothly -- per mobile UX decisions)
- ECharts uses SVG renderer on mobile for lower memory consumption

### Simplified Chart Interactions on Phone

- No brush selection (screen too small)
- Simplified tooltips (tap-and-hold instead of hover)
- Reduced legend detail (collapsible)
- Reduced WebSocket update frequency (5-10s batches vs. 1s desktop) per [20_MOBILE_ARCHITECTURE.md](20_MOBILE_ARCHITECTURE.md)

---

## Performance Requirements

| Component | Target | Notes |
|-----------|--------|-------|
| **uPlot** | 100K+ points at 60fps | Canvas 2D. 166K points in 25ms from cold start (benchmark). |
| **ECharts** | 10K+ points (Canvas), 1M+ points (WebGL) | WebGL renderer for scatter/heatmap with large datasets. |
| **TanStack Table** | Virtual scroll 100K+ rows | Render only visible rows. No jank during fast scroll. |
| **Real-time updates** | Individual point/cell update | Never re-render entire chart or table for a single value change. |
| **Sparkline render** | < 5ms per sparkline | Multiple sparklines visible in table columns simultaneously. |
| **ECharts lazy load** | On-demand chunk loading | ~300 KB gzipped loaded only when a module using ECharts is opened. |
| **Multi-resolution LOD** | Seamless aggregate switching | Zoom triggers re-fetch at finer resolution. No visible "jump" between aggregate levels. |

---

## Unified Theming System

### Overview

I/O supports 3 themes: Light (desktop default), Dark, and High-Contrast (mobile outdoor default). All UI components -- including third-party charting libraries -- must respond to theme changes instantly without page reload.

### Architecture: CSS Custom Properties as Single Source of Truth

~54 semantic design tokens defined in `tokens.css` as CSS custom properties. Theme switched via `data-theme="light|dark|high-contrast"` attribute on `<html>` element.

**Token categories:**

- **Surface**: `--io-surface-primary`, `--io-surface-secondary`, `--io-surface-elevated`
- **Text**: `--io-text-primary`, `--io-text-secondary`, `--io-text-disabled`, `--io-text-inverse`
- **Border**: `--io-border`, `--io-border-subtle`, `--io-focus-ring`
- **Accent**: `--io-accent` (primary action color), `--io-accent-hover`, `--io-accent-active`, `--io-accent-subtle` (semantic ramp)
- **Status**: `--io-success`, `--io-warning`, `--io-danger`, `--io-info`
- **Alarm**: `--io-alarm-critical`, `--io-alarm-high`, `--io-alarm-medium`, `--io-alarm-advisory`, `--io-alarm-normal`, `--io-alarm-suppressed`, `--io-alarm-disabled` (ISA-101 compliant, non-customizable)
- **Chart**: `--io-chart-bg`, `--io-chart-grid`, `--io-chart-axis`, `--io-chart-crosshair`, `--io-chart-tooltip-bg`
- **Pen defaults**: `--io-pen-1` through `--io-pen-8` (default trend line colors)
- **Interactive**: `--io-focus-ring`, `--io-accent-hover`, `--io-table-row-selected`

**Important distinctions:**
- **Status tokens** (`--io-success`, `--io-warning`, etc.) are for general UI feedback (form validation, save confirmation, connection status). These follow the active theme and may be customized.
- **Alarm tokens** (`--io-alarm-critical`, `--io-alarm-high`, etc.) are reserved exclusively for process alarm states. These follow ISA-101 principles and are **not customizable** -- alarm colors must be consistent across the entire application to prevent operator confusion. Alarm tokens map directly to ISA alarm priority levels, not generic severity labels.

### Per-Library Integration

| Library | Theming Method | Theme Change Behavior |
|---------|---------------|----------------------|
| TanStack Table | CSS variables directly | Instant via CSS cascade |
| Tiptap | CSS variables directly | Instant via CSS cascade |
| Leaflet | CSS variables for controls/popups | Instant; tile overlays via CSS filter or pre-rendered dark tiles |
| SVG.js (Designer) | CSS for grid/background; inline attrs for user elements | Grid/bg instant; user elements retain configured colors |
| uPlot | Callback functions for all color properties | `redraw(false)` on theme change -- no destroy/recreate |
| Apache ECharts | `chart.setTheme()` (ECharts 6+) | Register 3 named themes at startup, switch dynamically |

### Parallel JS Color Object

uPlot and ECharts cannot read CSS variables (they render to Canvas). A single `theme-colors.ts` file mirrors CSS token values as a JS object. This file is the ONLY place JS theme colors are defined -- all canvas library configurations reference it. On theme change, the React ThemeProvider context updates, triggering `redraw()` on uPlot instances and `setTheme()` on ECharts instances.

```typescript
// theme-colors.ts (single source for canvas libraries)
export const themeColors = {
  light: {
    chartBg: '#FFFFFF',
    chartGrid: '#E5E7EB',
    chartAxis: '#374151',
    alarmCritical: '#DC2626',
    alarmWarning: '#D97706',
    alarmNormal: '#16A34A',
    // ... all tokens
  },
  dark: { /* ... */ },
  'high-contrast': { /* ... */ }
};
```

### Alarm Color Accessibility

Alarm colors adjusted per-theme for WCAG contrast compliance:

- **Light theme**: Darker alarm colors on white/light backgrounds
- **Dark theme**: Brighter alarm colors on dark backgrounds
- **High-Contrast**: Maximum brightness alarm colors on black background (WCAG AAA 7:1 ratio)
- Amber/warning on white is the weakest combination -- ensure minimum 4.5:1 contrast (WCAG AA)
- **Never rely on color alone** (ISA-18.2, WCAG 2.1): Always pair alarm colors with icon shape + text label. Colorblind users must be able to distinguish states by shape/icon alone.

**Alarm icon shapes:**

| State | Shape | Icon |
|-------|-------|------|
| Critical | Triangle | Exclamation |
| Warning | Diamond | Alert |
| Normal | Circle | Checkmark |
| Suppressed | Square with line-through | Pause |
| Disabled | Circle with line-through | Slash |

### Designer Theme Behavior

- Grid, background, and guide lines follow the active theme
- User-placed elements: Use a `theme-default` sentinel value. If an element's color is set to `theme-default`, it follows the theme. If the user explicitly sets a color (e.g., red pipe), that color is preserved across all themes.
- Default behavior for new elements: `theme-default` (follows theme). User can override to a fixed color in the property panel.

### Leaflet Tile Theming

- For phone graphics tiles (pre-rendered via resvg): Consider generating separate tile sets for light and dark themes. CSS filter inversion can distort alarm colors in the tiles.
- Alternative: Generate tiles with transparent backgrounds, overlay on themed container. Dynamic values (markers) always use theme-aware alarm colors.

### High-Contrast Theme Specifics

- Black background (#000000), white text (#FFFFFF)
- Maximum brightness alarm colors, increased border widths
- WCAG AAA (7:1) contrast ratio target
- Default on mobile (outdoor sunlight readability)
- Increased font weight for chart axis labels

### React Integration

- `ThemeProvider` context wraps the entire app
- Provides current theme name and the JS color object
- Chart components subscribe to theme context and update on change
- Theme preference stored in user settings (database-backed, hot-reload)
- System preference detection (`prefers-color-scheme`) as initial default, user override takes precedence

---

## Icon Library

### Primary: Lucide React

**Library**: Lucide React (ISC license), ~1,500 icons, tree-shakeable imports.

Lucide is the community fork of Feather Icons with a significantly larger icon set. Tree-shaking ensures only imported icons are bundled -- typical I/O usage (50-80 icons) adds ~15-20 KB gzipped.

### Custom Industrial Icons

~50-60 custom SVG icons for domain-specific needs not covered by Lucide. Organized by category:

| Category | Icons |
|----------|-------|
| **Valves** | Gate, globe, ball, butterfly, check, relief |
| **Pumps** | Centrifugal, positive displacement |
| **Vessels** | Tank, column, reactor, drum, heat exchanger |
| **Instruments** | Transmitter, gauge, switch, controller |
| **Piping** | Reducer, tee, elbow, flange |
| **Equipment** | Compressor, blower, fan, conveyor, agitator |

Custom icons follow ISA-5.1 symbol conventions where applicable and are designed to match Lucide's visual weight (1.5px stroke, 24x24 viewBox).

### Unified Icon Component

A single `<Icon>` component handles both Lucide and custom icons:

```tsx
// Lucide icon
<Icon name="settings" />

// Custom industrial icon
<Icon name="valve-gate" />
```

**Sizing** follows density mode:

| Density Mode | Icon Size |
|-------------|-----------|
| Compact | 16px |
| Default | 20px |
| Comfortable | 24px |

**Color**: Inherits from parent text color (`currentColor`) by default. Supports explicit `color` prop for override. Alarm-state icons use alarm tokens.

---

## Typography Reference

Reference the type scale defined in [06_FRONTEND_SHELL.md](06_FRONTEND_SHELL.md). These are the concrete tokens shared components use for consistent text sizing across the application.

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `--io-text-xs` | 11px | 400 | Labels, captions, badge text |
| `--io-text-sm` | 12px | 400 | Secondary text, table cells, timestamps |
| `--io-text-base` | 14px | 400 | Body text, form inputs, default component text |
| `--io-text-lg` | 16px | 500 | Section headings, card titles |
| `--io-text-xl` | 18px | 600 | Page subheadings |
| `--io-text-2xl` | 22px | 600 | Page titles |
| `--io-text-code` | — | 400 | JetBrains Mono for data values, point IDs, tag names, code, expressions |

**Font stack**: Inter (variable) for all UI text. JetBrains Mono (variable) for monospace. Both SIL Open Font License 1.1.

**OpenType features enabled by default**: Tabular figures (`tnum`) for numeric alignment in tables and value displays. Slashed zero (`zero`) for monospace contexts where 0/O disambiguation matters.

---

## Density Mode Support

All shared components support 3 density modes. Density is set globally via the theme context -- there are no per-component density props.

| Mode | Row Height | Padding | Icon Size | Use Case |
|------|-----------|---------|-----------|----------|
| **Compact** | 28px | 4px | 16px | Data-dense views, control room operators who need maximum information on screen |
| **Default** | 36px | 8px | 20px | Standard desktop use, engineering workstations |
| **Comfortable** | 44px | 12px | 24px | Touch/tablet use, accessibility, gloved operation |

### Implementation

- Components read density from `ThemeProvider` context (same provider that handles light/dark/high-contrast)
- Density affects: row heights, cell padding, icon sizes, touch target sizes, spacing between elements
- Density does NOT affect: font sizes, color tokens, border widths, alarm colors
- User preference stored in database (same as theme preference), hot-reloads on change
- Default density is `default` on desktop, `comfortable` on mobile/tablet

### Component-Specific Density Behavior

| Component | Compact | Default | Comfortable |
|-----------|---------|---------|-------------|
| `<DataTable />` | 28px rows, 4px cell padding | 36px rows, 8px cell padding | 44px rows, 12px cell padding |
| `<KpiCard />` | Reduced margins, smaller sparkline | Standard layout | Larger touch target, increased padding |
| `<Gauge />` | Tighter label spacing | Standard | Larger labels, wider touch area |
| `<PointPicker />` | Compact list items | Standard list items | Large list items with more preview info |
| `<TimeRangePicker />` | Tight button spacing | Standard buttons | Large touch-friendly buttons |

---

## Loading States

### Module-Shaped Skeletons

Skeleton screens are tailored to each module's layout, not generic shimmering rectangles. Each module provides its own skeleton layout that matches the structure of the content being loaded.

| Module | Skeleton Shape |
|--------|---------------|
| **Dashboards** | Widget grid with placeholder rectangles matching the saved layout dimensions |
| **Console** | Pane grid with graphic placeholder areas matching the workspace configuration |
| **Reports** | Table rows with shimmering bars, column headers visible |
| **Settings** | Form field placeholders (label + input rectangle pairs) |
| **Forensics** | Split pane: trend placeholder on top, event timeline placeholder on bottom |
| **Log** | Entry list with timestamp + text block placeholders |
| **Rounds** | Checklist with checkbox + label placeholders |

### Skeleton Component

```tsx
<Skeleton variant="text" width={200} />
<Skeleton variant="rect" width={300} height={200} />
<Skeleton variant="circle" size={40} />
```

- Shimmer animation: Subtle left-to-right gradient sweep, 1.5s duration, infinite loop
- Background color: `--io-surface-secondary` with a lighter highlight sweep
- Respects theme: Shimmer colors adapt to light/dark/high-contrast
- No layout shift: Skeletons match the exact dimensions of the content they replace

### Loading Sequence

1. **Shell renders immediately** -- navigation sidebar, top bar, and status bar are visible from first paint
2. **Module skeleton fills content area** -- shaped to match the module being loaded
3. **Data replaces skeleton** -- individual sections replace their skeletons as data arrives

### Partial Loading

Individual widgets, panes, and table sections can show their own skeletons while sibling components are already loaded. A dashboard with 6 widgets may have 4 loaded and 2 still showing skeletons. Each component manages its own loading state independently.

---

## Empty States

Empty states are tailored per module. No generic "No data found" messages.

### Design Principles

- **Illustration**: Subtle, on-brand line illustration (not clip art, not photos). Uses `--io-text-disabled` color.
- **Description**: Clear explanation of what this area will contain once populated
- **Primary CTA**: Action button to create the first item or get started
- **Secondary CTA** (optional): Alternative path (e.g., browse templates, import data)
- **Permission-aware**: CTA buttons only rendered if the user has the required RBAC permission. If the user lacks permission, show the description without the action button.

### Module Empty States

| Module | Empty State | Primary CTA | Secondary CTA |
|--------|------------|-------------|---------------|
| **Dashboards** (no dashboards) | "Create your first dashboard or start from a template" | [Create Dashboard] | [Browse Templates] |
| **Console** (no workspaces) | "Set up your first workspace to monitor process data" | [Create Workspace] | — |
| **Rounds** (no routes) | "Define an inspection route to get started" | [Create Route] | [Import Route] |
| **Log** (no entries) | "No log entries for the selected time range" | [New Entry] | [Change Time Range] |
| **Reports** (no reports) | "Generate your first report from a template" | [Create Report] | [Browse Templates] |
| **Forensics** (no investigation) | "Start an investigation to analyze process events" | [New Investigation] | — |
| **Designer** (no graphics) | "Create a new graphic or import an existing one" | [New Graphic] | [Import SVG] |
| **Alerts** (no alert rules) | "Define alert rules to monitor process conditions" | [Create Alert Rule] | — |
| **Settings > Points** (no points) | "Configure OPC sources to begin importing points" | [Add OPC Source] | — |

### Empty States in Sub-Components

Tables, widget areas, and list views within modules also use tailored empty states:

- **DataTable** (no rows matching filter): "No results match your filters" + [Clear Filters] button
- **Dashboard widget area** (empty slot): "Drag a widget here" (design mode only)
- **Point Picker** (no search results): "No points match your search" + suggestion to broaden criteria

---

## Error States

### Inline Errors

Data loading failures display inline within the component that failed. The shell and navigation always remain functional -- no full-page error screens for data-level failures.

**Format**: Error icon (triangle/exclamation from Lucide, colored `--io-danger`) + short human-readable message + [Retry] button.

```
⚠ Failed to load trend data  [Retry]
```

- Error messages are user-facing, not stack traces or HTTP status codes
- [Retry] button re-triggers the failed request
- If retry fails 3 times, message changes to "Unable to load -- check connection" with a [Retry] button still available

### Toast Notifications

For transient errors that don't belong to a specific component (network timeout, save failure, WebSocket disconnect):

- **Position**: Bottom-right corner, stacked vertically (newest on top)
- **Auto-dismiss**: 5 seconds for informational/warning, persistent (manual dismiss) for errors
- **Limit**: Maximum 3 visible toasts; older ones collapse into a count badge
- **Types**: Success (green), Warning (amber), Error (red), Info (blue) -- using status tokens, not alarm tokens
- **Action button**: Optional inline action (e.g., "Save failed" + [Retry])

### Error Boundary

React error boundary wraps each module's content area independently. A crash in Dashboards does not take down Console.

- **Fallback UI**: "Something went wrong" + [Reload Module] button
- **Behavior**: Clicking [Reload Module] remounts the module component (not a full page reload)
- **Logging**: Error details (component stack, error message) are logged to the application log and sent to the backend for diagnostics
- **Nested boundaries**: Large modules (Console, Forensics) have additional error boundaries around individual panes/panels so a single pane crash doesn't take down the entire module view

---

## Point Detail Panel

### Overview

The Point Detail panel is a **floating window** that aggregates data about a single point from across all connected data sources. It provides a comprehensive, at-a-glance view of everything I/O knows about a point — process data, alarms, equipment, maintenance, inventory, tickets, graphics, and any other imported data linked to that point through Data Links (doc 24 Section 22).

Available in every module that displays point tag names or live values.

### Point Context Menu

Right-clicking any point-bound element anywhere in the application (graphic, table cell, chart data point, widget value, alarm row) opens a unified context menu. On mobile, this is triggered by long-press (500ms). The menu is a shared shell-level component — individual modules do not implement their own point context menus.

| Menu Item | Action | Permission | Notes |
|-----------|--------|------------|-------|
| **Point Detail** | Opens Point Detail floating panel for this point | `console:read` or module equivalent | See panel spec below |
| **Trend Point** | Opens a full-screen trend chart for this point (last 24h default, adjustable) | `console:read` or module equivalent | Opens in current module context; if in Console, adds trend pane |
| **Investigate Point** | Creates a new Forensics investigation anchored to this point | `forensics:write` | Pre-populates anchor point and default 24h time range. See doc 12 |
| **Report on Point** | Opens Report generation with this point pre-selected as the data source | `reports:read` | Opens report template picker filtered to point-compatible templates |

If the user also right-clicks on an **alarm** (alarm list row, alarm banner, alarm widget), an additional item appears:

| Menu Item | Action | Permission | Notes |
|-----------|--------|------------|-------|
| **Investigate Alarm** | Creates a new Forensics investigation anchored to this alarm | `forensics:write` | Pre-populates anchor alarm, associated point, and time range. See doc 12 |

Items the user lacks permission for are hidden (not grayed out).

### Keyboard & Link Shortcuts

| Trigger | Context | Behavior |
|---------|---------|----------|
| **Ctrl+I** | Hover/select a point element | Opens Point Detail panel for the hovered/selected point |
| **Click tag name link** | Tables, log entries, reports — tag names rendered as clickable links | Opens Point Detail panel for that point |

### Floating Window Behavior

- **Draggable**: Position anywhere on screen via title bar drag. Does not consume workspace real estate.
- **Resizable**: Drag edges/corners to resize. Default size: 400×600px. Min: 320×400px.
- **Pinnable**: Pin icon in title bar. When pinned, clicking a different point updates the panel in place. When unpinned, each point opens a new panel.
- **Minimizable**: Minimize to a compact bar showing just the point tag name. Click to re-expand.
- **Multiple instances**: Up to 3 concurrent panels for side-by-side comparison. Fourth open attempt prompts "Close one panel to open another."
- **Session persistence**: Panel position and size remembered per user session. Closing a panel removes it; minimized panels survive module navigation.
- **Z-index**: Sits at the "popover" layer (above module content, below modals and emergency overlay). See doc 06 z-index system.

### Panel Layout

```
┌─ Point Detail ────────────────────── [📌 _ × ]┐
│  FIC-301 — Feed Flow Controller                 │
│  Current: 247.3 GPM  Quality: Good              │
│  ▁▂▃▅▇▅▃▂▁▂▃▅▇ (24h sparkline)                 │
├─────────────────────────────────────────────────┤
│  ▼ Alarm Data                                    │
│    HH: 300  H: 280  L: 180  LL: 150             │
│    Alarms (30d): 7   Time in alarm: 2h 14m       │
│    Time shelved: 45m                              │
│    Last 5 alarms:                                 │
│    • 2026-03-08 14:22 — HIGH (283.1 GPM)        │
│    • 2026-03-05 09:15 — HIGH (281.7 GPM)        │
│    • ...                                          │
├─────────────────────────────────────────────────┤
│  ▼ Equipment — P-101A Centrifugal Pump           │
│    Type: Centrifugal Pump  Criticality: High      │
│    Manufacturer: Flowserve  Model: 3196           │
│    Part #: FSV-3196-1.5x3-6                       │
├─────────────────────────────────────────────────┤
│  ▼ Work Orders (RefineryBMaximo01)          [5]  │
│    WO-2024-1847  Replace seal  In Progress       │
│    WO-2024-1692  Vibration check  Completed      │
│    ...                                            │
├─────────────────────────────────────────────────┤
│  ▼ Inventory (Site7SAP02)                        │
│    FSV-3196-1.5x3-6  Stock: 2  Warehouse: WH-A3 │
│    Last PO: PO-44891  Qty: 3  ETA: 2026-04-15    │
├─────────────────────────────────────────────────┤
│  ▼ Tickets (CentralServiceNow)              [3]  │
│    INC0047891  Flow sensor drift  Open           │
│    ...                                            │
├─────────────────────────────────────────────────┤
│  ▼ Graphics                                      │
│    Unit 1 Overview (Console)  ←click to navigate │
│    Feed System Detail (Process)                   │
├─────────────────────────────────────────────────┤
│  [View in Forensics]  [Open Trend]               │
└─────────────────────────────────────────────────┘
```

### Section Types

**Built-in sections** (always available, data from I/O core tables):

| Section | Source | Key Fields |
|---------|--------|------------|
| **Process Data** | `points_current` + `points_metadata` + `points_history_raw` | Current value, quality, timestamp, units, 24h sparkline |
| **Alarm Data** | `alarm_definitions` + `events` + `alarm_shelving` | HH/H/L/LL thresholds, alarm count (30d), time in alarm, time shelved, last 5 alarms, last 5 shelves |
| **Graphics** | `design_object_points` reverse lookup | All graphics containing this point, clickable links to open |

**Imported data sections** (configured per dataset):

Each connected import definition can become a section. The admin picks:
1. Dataset (by name, e.g., "RefineryBMaximo01")
2. Display columns (checkboxes from available columns)
3. Sort order (which column, ascending/descending)
4. Max items (default 5)
5. Optional static filter (e.g., `status IN ('open', 'in_progress')`)

The system resolves the dataset to point data via the point column designator or Data Link chain (doc 24 Section 22.5). Sections with no data for the current point are hidden.

**Custom fields**: Individual fields pulled from any linked dataset. Admin specifies label + dataset name + column. Displayed as key-value pairs in a "Custom" section or inline within other sections.

### Data Loading

- **Parallel section loading**: Each section loads independently with its own loading spinner. Process Data and Alarm Data load first (fastest, most important).
- **Error isolation**: If one section fails (dataset offline, link broken), that section shows "Unable to load" with a retry button. Other sections render normally.
- **Caching**: Equipment/maintenance data is effectively static (changes only on import runs). Cache with 5-minute TTL, invalidated on `import_status` NOTIFY events. Process data and alarm data are always live (no cache).

### Navigation Links

| Link | Behavior |
|------|----------|
| **"View in Forensics"** | Opens Forensics with this point pre-selected for analysis |
| **"Open Trend"** | Opens a trend chart for this point (inline or in Dashboards) |
| **Graphic name** | Navigates to that graphic in Console or Process module |
| **Work order / ticket number** | If the external system has a web UI (URL template configured per import connection), opens in new tab. Otherwise, expands inline to show full record detail. |

### Configuration (Settings > Integrations > Point Detail)

Section builder UI:

```
┌─────────────────────────────────────────────────────┐
│  Settings > Integrations > Point Detail              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Equipment Class: [All (Default) ▼]                  │
│                                                      │
│  ┌─ Sections (drag to reorder) ────────────────────┐│
│  │  ☰ ☑ Process Data         (built-in)            ││
│  │  ☰ ☑ Alarm Data           (built-in)            ││
│  │  ☰ ☑ Equipment Info       [Configure ▸]         ││
│  │  ☰ ☑ RefineryBMaximo01    [Configure ▸] [Max: 5]││
│  │  ☰ ☑ Site7SAP02           [Configure ▸] [Max: 5]││
│  │  ☰ ☐ CentralServiceNow   [Configure ▸] [Max: 5]││
│  │  ☰ ☑ Graphics             (built-in)            ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ Custom Fields ─────────────────────────────────┐│
│  │  Label            Dataset              Column    ││
│  │  [Calibration Due][RefineryBMaximo01 ▼][cal_date]││
│  │  [SIL Rating     ][InternalEquipDB ▼  ][sil    ] ││
│  │  [+ Add Custom Field]                            ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  Sparkline Duration: [24 hours ▼]                    │
│                                                      │
│  [Preview]  [Save]  [Reset to Default]               │
└─────────────────────────────────────────────────────┘
```

"Configure" slide-out per section shows: field visibility checkboxes, field ordering (drag), sort column, static filter, max items.

**Per-equipment-class overrides**: Optional. The "Equipment Class" dropdown at top switches between the global default and class-specific overrides (e.g., pumps show vibration data prominently, analyzers show lab results).

### RBAC

| Permission | Description |
|-----------|-------------|
| `system:point_detail_config` | Configure Point Detail layout and custom fields (Settings access) |

The popup itself is visible to any user with view access to the relevant module. Data shown in each section respects existing RBAC data category permissions — if a user can't see maintenance data, the work orders section is hidden regardless of configuration.

### API Endpoint

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `GET` | `/api/v1/points/:id/detail` | Module-level read permission | Returns aggregated point detail (all configured sections, resolved through data links) |
| `GET` | `/api/v1/point-detail-config` | `system:point_detail_config` | Get current configuration |
| `PUT` | `/api/v1/point-detail-config` | `system:point_detail_config` | Update configuration |

The `/points/:id/detail` endpoint runs all section queries in parallel on the server side and returns a structured response with one key per section. Sections with no data are omitted from the response.

---

## Transform Pipeline Component

### Overview

The Transform Pipeline is a shared UI component for building ordered sequences of text transforms. Used in Data Link configuration (doc 24 Section 22.4) and Point Column designation.

### Chip Stack UX

Transforms are represented as removable chips in a horizontal strip. Add new transforms from a dropdown. Drag to reorder. Live preview shows before → after on sample data.

```
Transform: [Strip after dot ×] [Remove dashes ×] [Uppercase ×]  [+ Add ▼]

PREVIEW:
┌──────────────┬──────────┐
│ Original     │ Result   │
├──────────────┼──────────┤
│ fic-301.PV   │ FIC301   │
│ TI_101.SP    │ TI101    │
│ 23-PT-4501.OP│ 23PT4501 │
└──────────────┴──────────┘
```

### Available Transforms

12 built-in transforms (see doc 24 Section 22.4 for full list) plus a regex escape hatch. Transforms that require a parameter (Strip prefix, Strip suffix, Custom pattern) show an inline text input when selected.

### Implementation

Transforms are stored as a JSONB array of operation objects:
```json
[
    {"op": "strip_after_dot"},
    {"op": "remove_dashes"},
    {"op": "uppercase"},
    {"op": "strip_prefix", "value": "TAG_"},
    {"op": "regex", "pattern": "^(\\w+)-0*(\\d+)$", "replacement": "$1-$2"}
]
```

Evaluation is server-side (Rust) for data link resolution and client-side (TypeScript) for live preview. Both implementations must produce identical results — the transform operations are simple enough that parity is straightforward.

---

## Historical Playback Bar

### Overview

The Historical Playback Bar is the standard timeline interaction component across all I/O modules that work with time-ranged data. In its full form it enables Console workspaces and Process views to switch from live data to historical mode, rendering graphics with point values from any time in the system's data history. Users can scrub to a specific timestamp, play through historical sequences at variable speeds, loop regions, and step frame-by-frame.

The same component (or a subset of its controls) is used wherever a timeline appears in the application — Console/Process historical playback, Forensics investigation stages, trend chart time navigation, and report time range selection. One component, consistent behavior everywhere.

**Consumers and modes:**

| Consumer | Mode | Controls Used |
|----------|------|---------------|
| **Console** (doc 07) | Full playback | All controls — scrub, play, speed, step, loop, alarm markers |
| **Process** (doc 08) | Full playback | All controls — same as Console |
| **Forensics** (doc 12) | Stage timeline | Scrub, step, alarm markers. No play/speed/loop (single-frame snapshots). Stage time range sets the bar's bounds. |
| **Trends** (doc 32) | Time navigation | Scrub, step. Syncs with trend chart zoom/pan. No play/speed in standalone trend use. |
| **Dashboards** (doc 10) | Time navigation | Scrub, step. Controls dashboard-wide time context for historical widgets. |
| **Reports** (doc 11) | Time range selection | Simplified — start/end handles on the bar define the report time range. No playback. |

### Mode Toggle

A `LIVE | HISTORICAL` toggle in the workspace/view toolbar switches between modes:

- **Live mode** (default): Graphics receive real-time updates via WebSocket. Playback Bar is hidden.
- **Historical mode**: WebSocket subscriptions for visible points are paused (updates ignored, not unsubscribed — resuming Live mode reactivates them without re-subscribing). Graphics are driven from a client-side historical data cache. The Playback Bar appears at the bottom of the workspace/view.

### Playback Bar Layout

The bar spans the full width of the workspace (Console) or view (Process), anchored to the bottom edge.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [▍loop-in        ▲  ▲    ▲ ====▶●=======  ▲         loop-out▍]            │
│                  alarm event markers (colored ticks)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2025-03-11 20:57:03 📅  │◄◄│ ◄ │ ▶ │ ► │►►│  ×1 ▼  │ Step: 1m ▼ │ ⟳ Loop │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Top row — Scrub Timeline:**
- Full-width timeline representing the loaded time range
- Draggable playhead (●) — click anywhere on the timeline to jump, or drag to scrub
- **Loop handles**: Two draggable markers (▍) that define a loop region. Visible when loop is enabled. Drag to set loop-in and loop-out points.
- **Alarm markers**: Small colored ticks on the timeline at timestamps where alarms occurred for any visible point. Color follows ISA-101 alarm priority colors (doc 32 Alarm Colors). Hovering a marker shows a tooltip with alarm summary. Clicking a marker jumps the playhead to that timestamp. Alarm data fetched alongside point history.

**Bottom row — Controls:**
- **Timestamp display** (left): Shows the current playback timestamp in the user's locale format. Clicking opens a date/time picker for direct jump to any timestamp. Range bounded by actual data availability (oldest retained data through present).
- **Transport controls** (center): Step Back `│◄◄│`, Play Reverse `◄`, Pause/Play `▶`, Play Forward `►`, Step Forward `││►│`
- **Speed selector** (right-center): Dropdown — `×1`, `×2`, `×4`, `×8`, `×16`, `×32`. Applies to both forward and reverse playback. Default: `×1`.
- **Step interval selector** (right): Dropdown — `Next change`, `1s`, `5s`, `15s`, `30s`, `1m`, `5m`, `15m`, `1h`. Default: `1m`. Controls the jump distance for Step Back / Step Forward buttons.
- **Loop toggle** (far right): Enables/disables loop playback. When enabled, playback wraps from loop-out back to loop-in (or loop-in back to loop-out in reverse).

### Step Interval Semantics

| Interval | Step Forward Behavior |
|----------|----------------------|
| `Next change` | Jump to the next timestamp where any visible point's value changed. Scans the merged sorted timeline of all point updates. Most granular option. |
| `1s` through `1h` | Jump forward by the fixed time increment. The graphic renders with last-known-value-at-T for each point. |

Step Back mirrors the same logic in reverse.

### Data Fetching Strategy

Historical mode queries `points_history_raw` (and aggregates for long ranges) via a batch REST endpoint:

```
POST /api/points/history-batch
Body: { "point_ids": ["uuid1", "uuid2", ...], "start": "ISO8601", "end": "ISO8601" }
Response: { "points": { "<point_id>": [{ "t": epoch_ms, "v": number, "q": "good|uncertain|bad" }, ...] } }
```

**Pre-fetch strategy:**
- On entering Historical mode, fetch 1 hour of data centered on the selected start time for all visible points
- As the playhead reaches ~80% of the cached window, background-fetch the next hour in the direction of playback
- At `×32` speed, 1 hour of data covers ~2 minutes of real time — pre-fetch stays comfortably ahead
- Data cached client-side as sorted arrays per point. Binary search for last-known-value ≤ playback timestamp.

**Realistic data volume:** 2,000 points × 1 hour at 1s updates = ~7.2M values worst case, but most points update far less frequently. Typical: 500K–1M values, a few MB compressed over the wire. Single REST call with streaming JSON response.

**Alarm markers:** Fetched in a parallel request for the same time range:

```
GET /api/alarms/history?point_ids=uuid1,uuid2,...&from=ISO8601&to=ISO8601
```

Returns alarm timestamps, priorities, and summaries for timeline marker rendering.

### Rendering Pipeline

Historical mode reuses the same SVG rendering pipeline as live mode. The only difference is the data source:

| | Live Mode | Historical Mode |
|---|---|---|
| **Data source** | WebSocket messages via SharedWorker | Client-side history cache (REST-fetched) |
| **Update trigger** | WebSocket message arrives → RAF loop | Playback clock tick → RAF loop |
| **Value lookup** | Latest value from message buffer | Binary search: last value ≤ playback timestamp |
| **DOM update** | Same `element.textContent` / `element.setAttribute` path | Identical |
| **Quality indicators** | From WebSocket quality field | From cached quality field |
| **UOM conversion** | Client-side (same) | Client-side (same) |
| **Expression evaluation** | Client-side (same) | Client-side (same) |

The playback clock is a virtual timestamp that advances per the selected speed:
- At `×1`: virtual clock advances 1 data-second per 1 real-second
- At `×32`: virtual clock advances 32 data-seconds per 1 real-second
- Render frames throttled to ~10–15 fps (sufficient for data that changes at best every 100ms)
- Each frame: advance virtual timestamp → for each point, binary search cached array → update SVG elements via existing direct DOM pipeline

### Console Integration

In Console (doc 07), Historical mode applies to the entire workspace — all panes render at the same playback timestamp simultaneously. This includes:
- All graphic panes (SVG process graphics)
- Trend panes (trends switch to showing a vertical cursor line at the playback timestamp, scrolling with playback)
- Table panes (show values at the playback timestamp)

The Playback Bar sits below the workspace grid, above the status bar.

### Process Integration

In Process (doc 08), Historical mode applies to the single full-screen view. The Playback Bar sits at the bottom of the viewport. Viewport optimization still applies — only points visible in the current viewport have their history fetched. Panning to a new area triggers a history fetch for newly visible points at the current playback time range.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `←` / `→` | Step back / Step forward by selected interval |
| `Shift+←` / `Shift+→` | Step back / forward by 10× the selected interval |
| `Home` | Jump to start of loaded range (or loop-in if looping) |
| `End` | Jump to end of loaded range (or loop-out if looping) |
| `[` / `]` | Set loop-in / loop-out at current playback position |
| `L` | Toggle loop on/off |
| `+` / `-` | Increase / decrease playback speed |

### Relationship to Forensics Graphic Snapshots

Forensics (doc 12) has a `graphic_snapshot` evidence type that renders a graphic at a single specific timestamp. Historical Playback is the interactive version of the same concept — both use the same underlying data query (`POST /api/points/history-batch` for playback, `POST /api/forensics/graphic-snapshot` for single-frame). The Forensics snapshot is a frozen artifact stored with the investigation; the Playback Bar is an ephemeral interactive tool.

### Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Large point count (2,000+) | Pre-fetch in batches, streaming JSON response, binary search is O(log n) per point per frame |
| Long time ranges | Auto-select aggregate resolution for ranges > 4 hours (same logic as historical trend charts) |
| Memory usage | 1M cached values × ~20 bytes each ≈ 20 MB — well within browser limits |
| Rapid scrubbing | Debounce render to RAF (natural ~60fps cap), coalesce to latest position |
| Process viewport panning | Fetch history for newly visible points on viewport change (debounced 500ms, same as live subscription management) |

---

## Change Log

- **v1.0**: Promoted all chart types to v1 build. Phase 2 charts (11 types) → mid/late v1 post-Reports build. Phase 3 charts (8 types) → late v1. Plotly.js (MIT) confirmed for Probability Plot and 3D Surface/Contour, lazy-loaded on demand.
- **v0.9**: Fixed 7 token name mismatches to align with doc 38 registry (alarm-low→advisory, border-default→border, border-focus→focus-ring, text-mono→text-code, removed alarm-journal). Replaced hardcoded hex alarm colors with doc 38 token references. Replaced raw accent palette references with semantic tokens.
- **v0.8**: Expanded Analog Bar (#10), Fill Gauge (#11), and Alarm Indicator (#12) with full visual rendering specifications. Analog bar: zone anatomy with exact sizing (16-20px alarm zones, 40-60px normal), zone fill tokens (`--io-display-zone-inactive`, `--io-display-zone-normal`), pointer/setpoint geometry, horizontal variant, signal line. Fill gauge: 3 placement modes (vessel overlay with clipPath, standalone vertical bar, standalone horizontal bar), `--io-fill-normal` token, threshold marker rendering, multi-gauge per vessel pattern. Alarm indicator: shape geometry table with exact dimensions per priority, stroke-only rendering, positioning rules (4-6px gap), flash behavior, aggregation rules. All widgets reference doc 38 v0.3 graphics display tokens. See doc 19 v1.3 for authoritative rendering spec.
- **v0.7**: Added 3 new widget types: Analog Bar Indicator (#10, ISA-101 moving analog indicator with zone segments and pointer), Fill Gauge (#11, 0-100% level fill for vessels/tanks), Alarm Indicator (#12, ISA-101 priority-coded shape+color+text element). Renumbered XY Plot → #13, Event Timeline → #14, Data Table → #15. Updated Sparkline to cross-reference inline graphics use (doc 19 SparklineMapping). Updated Data Visualization category to include new types. See doc 19 v1.2 (Point Value Display Elements), doc 35 v0.29 (sidecar anchors).
- **v0.6**: Added Historical Playback Bar — the universal timeline interaction component for all time-ranged data in I/O. Full playback mode for Console/Process (live↔historical toggle, scrub bar with alarm markers, transport controls, ×1–×32 speed, step-by-interval, loop regions, keyboard shortcuts). Simplified modes for Forensics (stage scrub), Trends (time navigation), Dashboards (time context), Reports (range selection). Client-side history cache with pre-fetch strategy, same SVG rendering pipeline as live mode. See docs 07, 08, 12, 21.
- **v0.5**: Expanded Point Detail trigger mechanism into shared Point Context Menu — a shell-level component available on right-click (desktop) or long-press (mobile) on any point-bound element app-wide. 4 standard menu items: Point Detail, Trend Point, Investigate Point, Report on Point. Additional "Investigate Alarm" on alarm elements. All items permission-gated, hidden when user lacks access. Replaces per-module context menu definitions — Console (doc 07), Process (doc 08), Dashboards (doc 10), Forensics (doc 12), and Mobile (doc 20) now reference this shared definition.
- **v0.4**: Added Point Detail floating panel component. Aggregates point data across all connected sources via Data Links (doc 24 Section 22). Floating window with drag/resize/pin/minimize, up to 3 concurrent instances. Built-in sections (Process, Alarm, Graphics) + imported data sections (admin-configured per dataset). Parallel loading, error isolation, RBAC-filtered. Settings UI for section builder with per-equipment-class overrides. `GET /api/v1/points/:id/detail` aggregated endpoint. New permission: `system:point_detail_config`. Added Transform Pipeline shared component (chip stack builder with live preview, 12 built-in transforms + regex fallback). See doc 24 Section 22 for Data Links.
- **v0.1**: Initial document. Dual-library charting strategy (uPlot + ECharts), TanStack Table, 12 must-have chart types, 11 Phase 2, 8 Phase 3. Widget configuration schemas (8 types). Interaction components (Point Picker, Expression Builder Modal, Time Range Picker, Color Picker). Industrial display conventions (IEC 60073 alarm colors, quality indicators, stale data, number formatting). Mobile adaptations. Performance requirements.
- **v0.2**: Added Unified Theming System -- CSS custom properties as single source of truth (~54 tokens), per-library integration strategies for uPlot/ECharts/TanStack Table/Tiptap/SVG.js/Leaflet, alarm color accessibility (WCAG AA/AAA, ISA-18.2 shape coding), Designer theme-default sentinel, Leaflet tile theming, React ThemeProvider integration.
- **v0.3**: Deep dive: Design token reference (semantic tokens split into surface/text/border/accent/status/alarm, ISA-101 non-customizable alarm tokens), icon library (Lucide React + ~50-60 custom industrial SVG icons with unified `<Icon>` component), loading states (module-shaped skeletons with partial loading), empty states (tailored per module with permission-aware CTAs), error states (inline with retry, toast notifications, nested React error boundaries), typography reference (7-token type scale with Inter + JetBrains Mono), density mode support (compact/default/comfortable) for all shared components.
