# Inside/Operations - Dashboards Module

## Overview

Real-time data visualization with customizable dashboards, charts, and KPIs.

## Key Features

### Dashboard Builder
- Drag-and-drop widget placement
- Grid-based layout with resizable widgets
- Widget library (charts, KPIs, tables, gauges)
- Save dashboard configuration
- Publish dashboards

### Widget Types
1. **Line Chart** - Time-series trends
2. **Bar Chart** - Comparisons
3. **Pie Chart** - Proportions
4. **KPI Card** - Single value with threshold
5. **Gauge** - Radial or linear gauge
6. **Table** - Tabular data with sorting
7. **Text** - Labels and annotations
8. **Alert Status** - Active alerts with real-time status updates via WebSocket. Shows alert severity, title, source, timestamp, and acknowledgment status. Recent alert history timeline. Configurable filters: severity level (EMERGENCY, CRITICAL, WARNING, INFO), source (point, service, rule), acknowledgment state. Click-through to full alert detail in Alert System.

### Real-Time Updates
- WebSocket integration for live data
- Configurable update frequency
- Auto-reon reconnect
- Historical data queries

### UOM Conversion
- Real-time widget values: client-side conversion using cached UOM catalog
- Historical widget data (trends, aggregates): server-side conversion by API Gateway before returning results

### Point Context Menu
- Point values displayed in dashboard widgets (trend charts, KPI gauges, value tables, alert status) support the shared **Point Context Menu** (right-click on any point value). See `32_SHARED_UI_COMPONENTS.md` for the full menu: Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm rows. All items permission-gated.

### Data Export
- Per-widget export via three-dot (kebab) menu: "Export Data" option
- Export dialog supports widget-specific data (trend data, table data, KPI values)
- Dashboard list table also has a standard `[Export v]` toolbar button
- Dashboard definition export available as JSON only (complex JSONB layout + widget configs)
- Supported formats: CSV, XLSX, JSON, Parquet (per widget); JSON (dashboard definition)
- Requires `dashboards:export` permission
- Bulk-update candidate: dashboard metadata (published, sharing via `dashboard_shares`); widget data source reassignment limited to UI due to complex JSONB
- See 25_EXPORT_SYSTEM.md for full export specifications and per-widget kebab menu mockup

### Configuration
- Widget-specific settings
- Color schemes and themes
- Data source selection (points, calculations)
- Time range selection
- Aggregate type selection per widget (avg, sum, min, max) - options filtered by point's `aggregation_types` bitmask
- Rolling average option for trend widgets (any window duration when averaging is permitted)
- Custom aggregation: custom time buckets via `bucket_interval` parameter (see doc 21), expression-based calculated values via Expression Builder (see doc 23)

### Custom Expression Data Source
- Widget data source configuration gains a **"Custom Expression"** option alongside direct point selection
- Selecting "Custom Expression" opens the Expression Builder (23_EXPRESSION_BUILDER.md) with `context="calculated_value"`
- On apply: stores expression reference in the widget configuration
- Points with `custom_expression_id` in `points_metadata` have their display values automatically converted client-side
- Enables derived calculations (e.g., efficiency ratios, unit conversions, multi-point formulas) directly within dashboard widgets

## User Stories

1. **As an engineer, I want to create a dashboard showing key performance indicators, so I can monitor process efficiency.**

2. **As a supervisor, I want to publish a team dashboard, so everyone sees the same metrics.**

3. **As an operator, I want to see real-time charts updating automatically, so I can spot trends quickly.**

## Technical Requirements

### Widget Framework
- React components for each widget type
- uPlot for time-series charts, ECharts for statistical/categorical charts (see doc 32)
- TanStack Query for data fetching
- WebSocket for real-time updates

### Aggregation Type Awareness
- When configuring a widget with a point data source, only show aggregate options permitted by the point's `aggregation_types`
- If a point does not permit averaging, do not offer avg/trend options; if it does not permit summing, do not offer sum/total options
- `min`, `max`, and `count` are always available for all points
- Rolling averages available as a trend option when averaging is permitted
- All aggregate data includes only `Good` OPC UA quality values
- Custom time bucket sizes supported via `bucket_interval` API parameter (see `21_API_DESIGN.md`). Expression-based calculated KPIs supported via Expression Builder (see `23_EXPRESSION_BUILDER.md`).

### Performance
- Dashboard load < 1 second
- Widget update < 500ms
- Smooth animations
- Efficient re-rendering (React.memo)

### Persistence
- Dashboards in dashboards table (JSONB config)
- Widget configurations in widgets JSONB column

## API Endpoints

- `GET /api/dashboards` - List dashboards
- `POST /api/dashboards` - Create dashboard
- `GET /api/dashboards/:id` - Get dashboard
- `PUT /api/dashboards/:id` - Update dashboard
- `DELETE /api/dashboards/:id` - Delete dashboard
- `GET /api/points/:id/current` - Get current value (returns the latest value snapshot; for continuous updates, subscribe via WebSocket)
- `GET /api/points/:id/history` - Get historical data

## Success Criteria

- Users can build custom dashboards
- Widgets display real-time data
- Dashboards load quickly (< 1s)
- Published dashboards accessible to team
- Charts are visually appealing and informative
- Widget configuration respects point aggregation type constraints
- Only valid aggregate options presented for each point

## Detached Window Support

Dashboards can be opened in detached browser windows via the multi-window system. A detached Dashboard window:

- Renders the full dashboard with all widgets and real-time data
- Uses the `/detached/dashboard/:dashboardId` route
- Displays a minimal shell: thin title bar with dashboard name and connection status, basic controls (fullscreen)
- Widget interactions (drill-down, time range changes) work the same as in the main window
- Auto-refresh and real-time widget updates continue via SharedWorker WebSocket connection
- Multiple dashboards can be open simultaneously in separate detached windows

See `06_FRONTEND_SHELL.md` (Multi-Window Architecture) for full specification.

### Emergency Alert Overlay

Emergency alert overlay is handled at the shell level (see `06_FRONTEND_SHELL.md`). All modules inherit this behavior automatically.

## Permissions

| Permission | Description | Default Roles |
|---|---|---|
| `dashboards:read` | View dashboards | All roles |
| `dashboards:write` | Create/edit personal dashboards | All roles |
| `dashboards:delete` | Delete personal dashboards | Operator, Analyst, Supervisor, Content Manager, Admin |
| `dashboards:publish` | Publish dashboards | Supervisor, Content Manager, Admin |
| `dashboards:export` | Export widget data from dashboards | Operator, Analyst, Supervisor, Content Manager, Admin |
| `dashboards:admin` | Dashboards module administration | Admin |

*Role-permission assignments are managed centrally in doc 03. Defaults shown for reference.*

## Template Variables

Dashboards support Grafana-style parameterized variables that allow a single dashboard definition to serve multiple contexts (different areas, units, time ranges, etc.).

### Variable Types

| Type | Description | Example |
|------|-------------|---------|
| **Query** | Populated dynamically from a database query | `SELECT DISTINCT area FROM points_metadata` |
| **Custom** | Admin-defined static list of values | Severity options: `["urgent", "high", "medium", "low"]` |
| **Text** | Free-form text input | Tagname search pattern |
| **Interval** | Time bucket selector | 1m, 5m, 15m, 1h, 1d (maps to `time_bucket`) |
| **Constant** | Hidden fixed value for dashboard config | Dashboard version, category identifier |
| **Chained** | Dependent on another variable's selection | Area → Unit → Equipment cascading filters |

### Variable Behavior

- **Default to "All"**: All variables default to "All" so dashboards display useful data immediately with no user configuration
- **Variable bar**: Displayed at the top of the dashboard below the title, collapsible to save space
- **Dashboard-wide scope**: Variables apply to all widgets on the dashboard that reference them
- **User override without editing**: Users can change variable values without entering edit mode -- the variable bar is always interactive for viewers
- **Chained cascade**: Changing a parent variable clears and reloads child variable options (e.g., changing Area reloads available Units, changing Unit reloads available Equipment)
- **URL sync**: Variable values reflected in URL query parameters (`?var-area=Unit4&var-severity=urgent,high`) for shareable views
- **Multi-select**: Variables can allow multiple selections where applicable (e.g., multiple areas, multiple severities)

### Variable Definition Schema

Variables are stored in the dashboard JSONB config:

```json
{
  "variables": [
    {
      "name": "area",
      "label": "Area / Unit",
      "type": "query",
      "query": "SELECT DISTINCT area FROM points_metadata WHERE area IS NOT NULL ORDER BY area",
      "multi": true,
      "include_all": true,
      "default": "$__all",
      "refresh": "on_load"
    },
    {
      "name": "unit",
      "label": "Unit",
      "type": "chained",
      "query": "SELECT DISTINCT unit FROM points_metadata WHERE area = ANY($area) ORDER BY unit",
      "depends_on": "area",
      "multi": true,
      "include_all": true,
      "default": "$__all"
    }
  ]
}
```

Widgets reference variables using `$variable_name` syntax in their data source configurations. The dashboard rendering engine substitutes variable values before executing widget queries.

## Canned Dashboards

I/O ships with 19 pre-built dashboard templates organized into 8 categories. Canned dashboards are seed templates that use the same Dashboard data model as user-created dashboards. They are marked `is_system = true` and cannot be deleted, but users can duplicate and customize them. All templates use template variables so they work at any site without modification.

### Phase 1 Dashboards (8)

| Category | Dashboard | Description |
|----------|-----------|-------------|
| Operations Overview | **Operations Overview** | Plant-wide health at a glance: area status cards, alarm counts by severity, OPC source status, current shift info. ISA-101 Level 1 overview display. |
| Alarm Management | **Active Alarms** | Live view of all standing alarms with severity breakdown, unacknowledged count, alarm rate, and alarm list with acknowledge actions. Real-time via WebSocket. |
| Alarm Management | **Alarm KPI Summary** | ISA-18.2/EEMUA 191 alarm health scorecard: average alarm rate vs. benchmarks, standing count, chattering count, shelved count, priority distribution vs. target pyramid, flood time percentage. |
| Process Performance | **Process Area Overview** | Parameterized unit-level view: key process variables (T, P, F, L), live trends, standing alarms for the selected area, point status table. Driven by Area/Unit variable. |
| Equipment & Maintenance | **Equipment Health** | Point health monitoring: quality distribution (Good/Bad/Uncertain), stale points list, bad quality points by OPC source, quality statistics over time. Critical for commissioning. |
| Environmental & Compliance | **Environmental Compliance** | Points near or exceeding regulatory thresholds, exceedance duration tracking, trend charts for compliance-critical measurements. |
| System Administration | **System Health** | OPC source connectivity, service health status, WebSocket throughput, database size, queue depths (email, import, export), API response times. |
| Executive/Management | **Executive Summary** | High-level KPI cards: plant alarm health (EEMUA classification), production status, rounds completion rate, open alerts, system uptime. Designed for wallboard and management review. |

### Phase 2+ Dashboards (11)

| Category | Dashboard | Description |
|----------|-----------|-------------|
| Operations Overview | **Multi-Area Operations** | Side-by-side comparison of multiple areas/units with key metrics, alarm counts, and status indicators. Variable-driven area selection. |
| Alarm Management | **Alarm Trend Analysis** | Alarm frequency over time with EEMUA 191 benchmark lines, alarm rate by shift, top bad actors (frequency-ranked), Pareto charts. |
| Alarm Management | **Alarm Shelving Status** | Currently shelved alarms with expiry countdown, shelving history, shelved count by area, compliance with ISA-18.2 shelving time limits. |
| Process Performance | **Unit Performance Comparison** | Compare key metrics across units or time periods: production rates, efficiency ratios, quality parameters. Bullet charts for actual vs. target. |
| Process Performance | **Performance Trending** | Long-term trending of key process variables with statistical overlays (rolling averages, control limits, regression lines). |
| Equipment & Maintenance | **Maintenance Planning** | Equipment with recurring alarm patterns, degradation trends from rounds data, overdue maintenance indicators. |
| Security & Access | **Contractor Activity** | Badge-in/out tracking for contractor personnel, area access patterns, time on site summaries. |
| Rounds & Inspections | **Rounds Coverage** | Today's round status (scheduled/completed/overdue), completion rate by area, exception readings, round duration tracking. |
| Operations Overview | **Shift Handover** | Outgoing shift summary: alarm count comparison vs. previous shifts, unresolved alarms, key events, pending actions, overdue items, equipment status changes. |
| Environmental & Compliance | **Energy & Utilities** | Utility consumption trending (steam, power, water, fuel gas), efficiency metrics, cost indicators where data is available. |
| Executive/Management | **Custom KPI Builder** | Empty template with pre-configured variable structure for users to build their own KPI dashboards from the widget library. |

### Implementation Notes

- Canned dashboards are inserted as seed data during installation with `is_system = true`
- All canned dashboards use template variables so they adapt to any site's point/area structure
- "Duplicate and Customize" workflow: user creates a personal copy, opens in builder, modifies freely -- the original canned dashboard is untouched
- System dashboards can be hidden per-user but not deleted
- On first install, four dashboards are auto-published: Operations Overview, Active Alarms, Equipment Health, and System Health

## Kiosk Mode

Dashboards support a kiosk mode for wallboard and control room displays.

### Kiosk Display

- **Full viewport**: Hides I/O navigation (sidebar, top bar, module switcher, dashboard toolbar) -- dashboard fills the entire viewport
- **Hover-to-reveal**: Moving the mouse to the top edge of the screen reveals a thin strip with the exit button and basic navigation
- **Activation**: Toolbar button on any dashboard, or URL parameter `?kiosk=true`
- **Exit**: Escape key or hover-to-reveal exit button
- **No idle timeout**: Kiosk mode sessions do not expire due to inactivity
- **Minimal overlay**: Connection status indicator (green dot) and optional clock in the corner

### Dashboard Playlists

For wallboard displays that cycle through multiple dashboards:

- **Ordered list**: A playlist contains an ordered list of dashboards
- **Configurable dwell time**: Each dashboard in the playlist has a configurable display duration (default 30 seconds)
- **Auto-advance**: Playlist automatically advances to the next dashboard after the dwell time elapses
- **Continuous loop**: Playlist loops back to the first dashboard after the last one
- **Per-dashboard variables**: Each playlist entry can specify variable overrides (e.g., show the same dashboard template for different areas)
- **Kiosk integration**: Playlists run in kiosk mode by default
- **Controls**: Pause/resume (Space), manual navigation (Left/Right arrows), progress indicator showing time until next dashboard
- **Playlist URL**: `/dashboards/playlist/:id?kiosk=true`
- **Management**: Playlists managed via Dashboards module UI; requires `dashboards:publish` permission

## Shared Alarm KPI Calculation Layer

Alarm KPI calculations (alarm rates, standing/stale/chattering counts, flood durations, priority distributions, time-to-acknowledge, EEMUA 191 classifications) use a **shared calculation layer** in the backend.

- The same calculation code is used by both dashboard alarm widgets and report alarm tables
- ISA-18.2/EEMUA 191 benchmark targets are built into the calculation layer (e.g., <=6 alarms/hr acceptable, <=12/hr manageable, >12/hr overloaded)
- This ensures dashboard alarm widgets and report alarm tables always show identical numbers for the same time range and filters
- See doc 11 (Reports) for the corresponding report-side usage of this shared layer

## Change Log

- **v1.3**: Converted permissions table from 3-role column format (User/Power User/Admin) to 2-column format with named Default Roles matching the 8 predefined roles (doc 03). dashboards:write remains All roles (personal dashboards). dashboards:delete narrowed from all users to exclude Viewer/Contractor/Maintenance.
- **v1.2**: Replaced custom aggregation TBD with concrete references to `bucket_interval` (doc 21) and Expression Builder (doc 23).
- **v1.1**: Added Point Context Menu section. Dashboard widgets with point values support the shared Point Context Menu (doc 32) via right-click: Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm rows.
- **v1.0**: Deep dive: Template variables (6 types, default to All), 19 canned dashboards (8 Phase 1), kiosk mode with playlists, shared alarm KPI calculation layer, replaced Recharts references.
- **v0.8**: Added Permissions section with 6 Dashboards permissions and role assignments from RBAC model (doc 03).
- **v0.7**: Added Alert Status widget type (widget #8) — active alerts with real-time updates, configurable severity/source filters. Added emergency alert overlay note for Dashboard views. See 27_ALERT_SYSTEM.md.
- **v0.6**: Added clarifying note to `GET /api/points/:id/current` endpoint — returns latest value snapshot; for continuous updates, use WebSocket.
- **v0.5**: Added Detached Window Support section — Dashboards in multi-window layouts.
- **v0.4**: Added Data Export section. Dashboard widgets gain "Export Data" option in kebab menu. Dashboard list gains standard export toolbar button. Dashboard definition exportable as JSON. Requires `dashboards:export` permission. See 25_EXPORT_SYSTEM.md.
- **v0.3**: Added Expression Builder integration for widget data sources. Widgets can use custom expressions (23_EXPRESSION_BUILDER.md) for calculated display values.
- **v0.2**: Added UOM conversion section. Real-time widget values use client-side conversion; historical widget data uses server-side conversion by API Gateway.
- **v0.1**: Added aggregation type awareness to widget configuration and framework. Widgets respect `aggregation_types` bitmask to only show valid aggregate options per point. Added rolling average as trend option. Noted custom aggregation as future/TBD.
