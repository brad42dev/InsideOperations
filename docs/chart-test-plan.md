# Chart Testing Plan — All 39 Chart Types

**Created:** 2026-03-30
**Purpose:** Systematically test every chart type in the I/O app via Playwright, verify no console errors, correct rendering, and proper data updates. Fix any issues found.
**App URL:** http://localhost:5173
**Login:** admin / changeme
**Primary test path:** Console workspace → TrendPane → Configure (opens ChartConfigPanel)

---

## HOW TO RESUME (read this after context compaction)

1. Read this file: `/home/io/io-dev/io/docs/chart-test-plan.md`
2. Find last `STATUS: DONE` or `STATUS: FAIL/IN_PROGRESS` in the status table below
3. Continue from the next untested chart
4. Read the "Issues Found & Fixes Applied" section for context on what changed
5. Test path: Console workspace already exists (see §Setup Notes), navigate to it

---

## Setup Notes

- **Test workspace:** Use an existing console workspace or create one at `/console`
- **Workspace ID:** Will be filled in during testing (update this when known): `__WORKSPACE_ID__`
- **Test points (UUIDs from API):**
  - `69e80cbe-ba6c-4953-812d-185d8db04f22` — Desulfurizer Outlet H2S Concentration (ppm, Double)
  - `4d29b1e2-25fa-4573-9a2d-6c84b94ed14c` — NG Feed Moisture Content (ppm, Double)
  - `5ddf2256-c33f-4caf-89a0-3ff520c478be` — Reformer Flue Gas O2 Analyzer (%, Double)
  - `9d1e5c73-a606-4022-97f7-cb9cf8507fea` — Reformer Flue Gas CO Analyzer (ppm, Double)
  - More points available via GET /api/points?limit=100

- **How to open ChartConfigPanel:**
  1. Navigate to a console workspace
  2. Right-click a TrendPane OR click the gear/config button in the pane toolbar
  3. The config panel opens as a full-screen modal
  4. Tab 1: Chart Type (pick from list)
  5. Tab 2: Data Points (assign points to slots)
  6. Save

- **How to check console errors:** Use Playwright `browser_console_messages` after each chart loads

---

## Test Protocol Per Chart

For each chart:
1. Open ChartConfigPanel
2. Select the chart type
3. Assign minimum required points
4. Save and observe render
5. Check console for errors
6. Wait 30-60s for data updates (longer for live charts)
7. Try key option variations (noted per chart)
8. Note PASS/FAIL/ISSUE in status table
9. If FAIL: fix the code, rebuild, retest

---

## Status Table

| # | Chart Name | Category | Points Needed | Variations to Test | Status | Notes |
|---|-----------|----------|---------------|-------------------|--------|-------|
| 1 | Live Trend | Time-Series | 3 series | duration 5m/1h/8h, interpolation linear/step | PASS | Renders correctly, uPlot time-series, no errors |
| 2 | Historical Trend | Time-Series | 3 series | zoom in/out, different time ranges | PASS | Renders correctly, no errors |
| 3 | Multi-Axis Trend | Time-Series | 3 series (diff units) | stacked/side-by-side layout | PASS | Renders correctly, no errors |
| 4 | Step Chart | Time-Series | 2 series | digital/discrete points | PASS | Renders correctly, no errors |
| 5 | Bar / Column Chart | Categorical | 3 series | grouped/stacked, horizontal/vertical | PASS | Fixed: required batch-latest endpoint. Renders with ECharts. |
| 6 | Pie / Donut Chart | Categorical | 3 series | pie vs donut, center label on/off | PASS | Fixed: required batch-latest endpoint. Renders correctly. |
| 7 | KPI Card | Industrial | 1 point | threshold coloring, trend arrow | PASS | Dashboard-only context. Seen in "Reactor Unit 1 KPIs" dashboard. |
| 8 | Gauge | Industrial | 1 point | threshold zones, different ranges | PASS | Renders correctly, no errors |
| 9 | Sparkline | Industrial | 1 point | various durations | PASS | Dashboard-only context. Renders correctly in dashboard. |
| 10 | Analog Bar Indicator | Industrial | 1 point + setpoint | horizontal/vertical orientation | PASS | Dashboard-only context. Renders correctly. |
| 11 | Fill Gauge | Industrial | 1 point | different fill levels | PASS | Dashboard-only context. Renders correctly. |
| 12 | Alarm Indicator | Industrial | 3 points | priority levels | PASS | Dashboard-only context. Renders correctly. |
| 13 | XY Scatter | Statistical | 2 points (x+y) | density mode, color-by-time | PASS | Renders correctly, no errors |
| 14 | Event Timeline | Event | 3 series | priority filtering | PASS | Renders correctly, no errors |
| 15 | Data Table | Tabular | 4 series | sorting, filtering, conditional formatting | PASS | Renders correctly, no errors |
| 16 | Batch Comparison | Time-Series | 3 series | relative time alignment | PASS | Renders correctly, no errors |
| 17 | Heatmap | Heatmap | 1 point | matrix mode vs calendar mode | PASS | Renders correctly, no errors |
| 18 | Pareto Chart | Categorical | 4 series | sorted bars + cumulative line | PASS | Fixed: required batch-latest endpoint. Renders correctly. |
| 19 | Box Plot | Statistical | 4 series | with/without outliers, notched | PASS | Renders correctly, no errors |
| 20 | Histogram / Violin | Statistical | 1 point | histogram vs violin, normal curve | PASS | Renders correctly, no errors |
| 21 | Waterfall Chart | Categorical | 4 series | running total display | PASS | Fixed: required batch-latest endpoint. Renders correctly. |
| 22 | Stacked Area | Time-Series | 3 series | different durations | PASS | Renders correctly, no errors |
| 23 | Bullet Chart | Categorical | 1 point | target marker, qualitative zones | PASS | Renders correctly, no errors |
| 24 | Shewhart Control | SPC | 1 point | control limits, rule violations | PASS | Renders correctly, no errors |
| 25 | Regression / Trendline | Statistical | 3 series | equation display, R² | PASS | Renders correctly, no errors |
| 26 | Correlation Matrix | Statistical | 5 series | clustering on/off | PASS | Renders correctly, no errors |
| 27 | Sankey Diagram | Flow/Hierarchy | 4 series | link widths | PASS | Renders correctly, no errors |
| 28 | Treemap | Flow/Hierarchy | 4 series | hierarchical drill-down | PASS | Fixed: required batch-latest endpoint. Renders correctly. |
| 29 | CUSUM Chart | SPC | 1 point | target drift detection | PASS | Uses mathjs. Renders correctly, no errors |
| 30 | EWMA Chart | SPC | 1 point | lambda settings | PASS | Uses mathjs. Renders correctly, no errors |
| 31 | Probability Plot | Statistical | 1 point | Q-Q normality | PASS | Uses Plotly.js. Requires role='point' (not 'series'). Correct blank state when wrong role used. |
| 32 | Funnel Chart | Flow/Hierarchy | 4 series | stage attrition | PASS | Fixed: required batch-latest endpoint. Renders correctly. |
| 33 | Radar Chart | Flow/Hierarchy | 5 series | health profile | PASS | Fixed: required batch-latest endpoint. Renders correctly. |
| 34 | 3D Surface / Contour | 3D | 3 points (x+y+z) | surface vs contour | PASS | Uses Plotly.js. Requires roles x/y/z (not 'series'). Correct blank state when wrong roles used. |
| 35 | State Timeline | Industrial | 4 items | equipment states | PASS | Renders correctly, no errors |
| 36 | Scorecard Table | Tabular | 5 metrics | threshold coloring | PASS | Dashboard-only context. Renders correctly in dashboard. |
| 37 | Parallel Coord Plot | Statistical | 5 series | axis reordering | PASS | Renders correctly, no errors |
| 38 | X-bar/R & X-bar/S | SPC | 5 instruments | R chart vs S chart | PASS | Renders correctly, no errors |
| 39 | Attribute Control | SPC | 2 (defects + sample) | p/np/c/u chart types | PASS | Renders correctly, no errors |

**Dashboard Widgets (additional tests after charts):**
| Widget | Status | Notes |
|--------|--------|-------|
| TrendChartWidget | PASS | Renders live trend in dashboard context |
| GaugeWidget | PASS | Renders correctly with live data |
| KpiCard (widget) | PASS | Multiple instances in "Reactor Unit 1 KPIs" dashboard |
| BarChart (widget) | PASS | Renders correctly |
| PieChart (widget) | PASS | Renders correctly |
| LineChart (widget) | PASS | Renders correctly |
| AlarmCountBySeverityWidget | PASS | Renders correctly |
| AlarmRateWidget | PASS | Fixed: alarm history endpoint rejected `u32` query params — changed to `i64` |
| ServiceHealthTableWidget | PASS | "System Health" dashboard renders live service data |
| PointStatusTableWidget | PASS | Renders correctly |
| QualityDistributionWidget | PASS | Fixed: added GET /api/opc/points/current-quality endpoint |
| StalePointsWidget | PASS | Fixed: added GET /api/opc/points/stale endpoint |

---

## Issues Found & Fixes Applied

| Date | Chart/Widget | Issue | Fix Applied | File(s) Changed |
|------|--------|-------|-------------|-----------------|
| 2026-03-30 | Charts 5,6,18,21,28,32,33 | `POST /api/points/batch-latest` → 405 Method Not Allowed — route missing | Added `batch_latest` POST handler using `ANY($1)` UUID array query against `points_metadata JOIN points_current`; registered route in main.rs | `services/api-gateway/src/handlers/points.rs`, `services/api-gateway/src/main.rs` |
| 2026-03-30 | AlarmRateWidget | `GET /api/alarms/history?per_page=5000` → 400 Bad Request — serde_urlencoded cannot coerce string "5000" to `u32` | Changed `page` and `per_page` fields in `AlarmHistoryFilter` from `Option<u32>` to `Option<i64>`; updated arithmetic accordingly | `services/event-service/src/handlers/alarms.rs` |
| 2026-03-30 | QualityDistributionWidget | `GET /api/opc/points/current-quality` → 404 Not Found — route missing | Added `list_current_quality` GET handler returning `[{point_id, quality}]` from `points_metadata LEFT JOIN points_current`; registered route | `services/api-gateway/src/handlers/points.rs`, `services/api-gateway/src/main.rs` |
| 2026-03-30 | StalePointsWidget | `GET /api/opc/points/stale?threshold_minutes=N` → 404 Not Found — route missing | Added `list_stale_points` GET handler with `make_interval(mins => $1)` and `::float8` cast on EXTRACT result; registered route | `services/api-gateway/src/handlers/points.rs`, `services/api-gateway/src/main.rs` |

---

## Testing Progress Log

**2026-03-30** — Full test pass completed.

- Charts 1–4: Time-series charts (Live Trend, Historical Trend, Multi-Axis, Step) — all PASS, uPlot rendering, no errors.
- Charts 5, 6: Bar and Pie charts — FAIL initially (batch-latest 405). Fixed batch-latest endpoint. PASS after fix.
- Charts 7, 9–12, 36: Dashboard-only context charts — not visible in console ChartConfigPanel (by design, `contexts` field restricts them). Verified via Dashboard module — all PASS.
- Chart 8 (Gauge): PASS, no errors.
- Charts 13–17: Scatter, Timeline, DataTable, BatchComparison, Heatmap — all PASS.
- Chart 18 (Pareto): FAIL initially (batch-latest 405). PASS after fix.
- Charts 19–27: BoxPlot, Histogram, Waterfall, StackedArea, Bullet, Shewhart, Regression, Correlation, Sankey — all PASS.
- Chart 28 (Treemap): FAIL initially (batch-latest 405). PASS after fix.
- Charts 29–30: CUSUM, EWMA — PASS, mathjs confirmed installed.
- Chart 31 (Probability Plot): PASS — Plotly.js dynamic import, correct blank state when wrong role used.
- Charts 32–33 (Funnel, Radar): FAIL initially (batch-latest 405). PASS after fix.
- Chart 34 (3D Surface): PASS — Plotly.js, correct blank state with wrong roles.
- Charts 35, 37–39: StateTimeline, ParallelCoord, XbarR, AttributeControl — all PASS.
- Dashboard widgets: System Health (PASS), Active Alarms (PASS after AlarmRateWidget u32→i64 fix), Equipment Health (PASS after quality+stale endpoints added), Reactor Unit 1 KPIs (PASS).

**Overall result: 39/39 charts PASS, 12/12 dashboard widgets PASS. 4 bugs found and fixed.**

---

## Console Workspace Details

- URL tested: http://localhost:5173/console
- Workspace ID: (existing default workspace used)
- Pane IDs used: (TrendPane from default workspace)

---

## Key Renderer File Locations

All renderers: `/home/io/io-dev/io/frontend/src/shared/components/charts/renderers/chart{NN}-*.tsx`
ChartRenderer dispatcher: `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx`
ChartConfigPanel: `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartConfigPanel.tsx`
TrendPane: `/home/io/io-dev/io/frontend/src/pages/console/panes/TrendPane.tsx`
Chart types def: `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts`
Chart definitions: `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts`
Dashboard widgets: `/home/io/io-dev/io/frontend/src/pages/dashboards/widgets/`

---

## Backend API Endpoints Used by Charts

- `POST /api/auth/login` — get JWT token
- `GET /api/points?limit=N` — list points
- `GET /api/points/{id}` — point metadata
- `GET /api/points/{id}/history?start=&end=&resolution=auto&limit=2000` — historical data
- `POST /api/points/batch/history` — batch historical data
- `GET /api/points/{id}/current` — current value (for KPI/gauge widgets)
- `POST /api/points/batch-latest` — bulk latest values (added 2026-03-30)
- `GET /api/opc/points/current-quality` — all points with quality (added 2026-03-30)
- `GET /api/opc/points/stale?threshold_minutes=N` — stale points (added 2026-03-30)
- WebSocket: `ws://localhost:3001` — real-time data broker

---

## Build Commands

```bash
# After fixing frontend code:
cd /home/io/io-dev/io/frontend && pnpm build
# Dev server already running on :5173 with HMR, so just save files

# Check for TypeScript errors:
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit

# After fixing backend code:
cargo build -p api-gateway
cargo build -p event-service
```
