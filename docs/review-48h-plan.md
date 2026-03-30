# 48-Hour Code Review Plan
**Created:** 2026-03-30
**Scope:** All 81 files changed between commit 784a82b and HEAD (past 48 hours)
**Purpose:** Deep dive review — find bugs, logic errors, data shape mismatches, broken wiring, anything that would cause runtime failures or incorrect behavior in production.

---

## HOW TO RESUME AFTER COMPACTION

1. Read this file: `/home/io/io-dev/io/docs/review-48h-plan.md`
2. Find the first section NOT marked `[DONE]`
3. Read the "Issues Found" log at the bottom before starting — don't re-report already-known issues
4. Continue from there, appending new findings to the Issues Found log

---

## Context

**What changed:**
- 39 new chart renderers (chart01–chart39) — brand new code
- Chart infrastructure: ChartConfigPanel, ChartPointSelector, ChartOptionsForm, ChartRenderer, ChartToolbar, ChartTypePicker, ChartScalingTab, ChartLegend, useTimeSeriesBuffer, chart-config-types, chart-definitions, chart-aggregate-config
- opc-service: history recovery resilience (db.rs + driver.rs)
- archive-service: history endpoint additions/changes
- api-gateway: 3 new point endpoints + main.rs routing
- event-service: AlarmHistoryFilter u32→i64
- Frontend support files: TrendPane, PaneWrapper, dashboard widgets, api/points.ts, EChart, TimeSeriesChart

**Two review passes already done — issues already fixed:**
- chart07: setInterval dep bug
- chart31/34: Plotly async race
- list_stale_points: i32 cast
- useTimeSeriesBuffer: memory leak
- chart08: gauge threshold formula + default values
- chart24: population std dev
- StalePointsWidget: float display
- chart24/25/29/30/31/34: startISO instability
- ChartPointSelector: 2000-point cap → server-side search
- CHART_COLORS: duplicate
- Stale "34 chart types" comments
- AlarmHistoryFilter comment
- chart15: useQuery in loop → useQueries
- chart29/30: population std dev (same as chart24)
- ChartOptionsForm + chart30: L/l key mismatch
- chart05: fake error bars + combo line removed
- chart13/14/35: startISO instability
- chart22: stacking decoupled from scaling type
- chart18: pareto horizontal secondary axis
- TrendPane: showGrid not flowing to ChartRenderer
- chart12: ISA-18.2 ACK limitation documented

---

## Review Sections

### Section 1 — opc-service history recovery [DONE]
**Files:**
- `services/opc-service/src/db.rs`
- `services/opc-service/src/driver.rs`

**Focus:**
- `reset_interrupted_recovery_jobs()` — does it correctly reset only 'running' jobs, not 'pending'?
- `create_startup_recovery_job()` — does it correctly detect the gap and skip duplicates?
- The 5% buffer logic — is the math correct? Edge cases (zero gap, tiny gap)?
- The flush loop — does it correctly transition job status (pending→running→complete/failed)?
- Race conditions: what if the service restarts mid-job again?
- Error handling: if history fetch fails, does the job get marked failed or left running?

---

### Section 2 — archive-service history endpoint [DONE]
**Files:**
- `services/archive-service/src/handlers/history.rs`

**Focus:**
- New bucket/aggregate endpoints added — are query params deserialized correctly?
- The fast path (precomputed aggregates) vs compute path (time_bucket) — is the branching logic correct?
- SQL correctness: correct table names, correct column names, no injection risk
- Are NULL values handled correctly in aggregation?
- Does pagination work correctly with time-series data?
- Response shape — does it match what the frontend expects?

---

### Section 3 — api-gateway new point endpoints [DONE]
**Files:**
- `services/api-gateway/src/handlers/points.rs` (new endpoints only: batch_latest, list_current_quality, list_stale_points)
- `services/api-gateway/src/main.rs` (routing)

**Focus:**
- `batch_latest`: SQL query correctness, ANY($1) UUID array binding, response shape vs frontend expectation
- `list_current_quality`: COALESCE logic, response shape
- `list_stale_points`: make_interval math, clamped cast (already fixed), response shape
- Route ordering in main.rs — static before parameterized?
- Auth/permission guards on all three endpoints

---

### Section 4 — chart infrastructure [DONE]
**Files:**
- `chart-config-types.ts`
- `chart-definitions.ts`
- `chart-aggregate-config.ts`
- `chart-highlight-utils.ts`
- `hooks/useHighlight.ts`
- `hooks/useTimeSeriesBuffer.ts`
- `ChartRenderer.tsx`
- `ChartTypePicker.tsx`
- `ChartConfigPanel.tsx`
- `ChartPointSelector.tsx`
- `ChartOptionsForm.tsx`
- `ChartScalingTab.tsx`
- `ChartToolbar.tsx`
- `ChartLegend.tsx`
- `EChart.tsx`
- `TimeSeriesChart.tsx`

**Focus:**
- ChartTypeId union — are all 39 IDs present and correct in CHART_SLOTS?
- CHART_SLOTS slot definitions — do role names match what renderers expect?
- ChartOptionsForm — are all extras fields correctly typed and named? Any case/name mismatches with renderers beyond the L/l already fixed?
- ChartScalingTab — does it correctly read/write scaling config? Any fields ignored?
- ChartToolbar — aggregate config wiring, bucket seconds flow, does it hide controls for chart types that don't support them?
- ChartRenderer dispatch — are all 39 types registered? Any missing?
- useTimeSeriesBuffer — bucket/aggregate change detection, buffer clearing logic, correct after the cleanup fix
- EChart — resize observer, does it clean up? Any memory leaks?
- TimeSeriesChart — is the uPlot instance cleaned up on unmount?

---

### Section 5 — chart renderers group A: time-series (chart01–04, 16, 22) [DONE]
**Files:** chart01-live-trend, chart02-historical-trend, chart03-multi-axis-trend, chart04-step-chart, chart16-batch-comparison, chart22-stacked-area

**Focus:**
- useTimeSeriesBuffer usage — correct options passed?
- uPlot data format — must be [timestamps, series1, series2, ...] with all arrays same length
- Multi-axis (chart03): are separate y-axes correctly configured in uPlot?
- Step (chart04): is interpolation:'step' actually making uPlot draw steps?
- Batch comparison (chart16): relative time alignment logic correct?
- Stacked area (chart22): ECharts stack config correct after the stacked fix?

---

### Section 6 — chart renderers group B: categorical/batch-latest (chart05, 06, 17, 18, 21, 23, 27, 28, 32, 33) [DONE]
**Files:** chart05-bar-column, chart06-pie-donut, chart17-heatmap, chart18-pareto, chart21-waterfall, chart23-bullet, chart27-sankey, chart28-treemap, chart32-funnel, chart33-radar

**Focus:**
- batch_latest API call — correct endpoint, correct request shape, response unwrapping
- Data transformation from raw values to chart-specific formats
- ECharts series configs — correct types, required fields present
- chart18-pareto: secondary axis fix verified correct
- chart27-sankey: are node/link structures built correctly from point values?
- chart28-treemap: hierarchical data structure correct?

---

### Section 7 — chart renderers group C: statistical (chart13, 19, 20, 25, 26, 37) [DONE]
**Files:** chart13-xy-scatter, chart19-box-plot, chart20-histogram, chart25-regression, chart26-correlation-matrix, chart37-parallel-coord

**Focus:**
- History API calls — correct params, correct response unwrapping
- Math correctness: regression coefficients, box plot quartile calculation, histogram binning
- chart26-correlation-matrix: Pearson correlation math correct?
- chart37-parallel-coord: axis normalization correct?
- Null/NaN handling throughout — do they cause ECharts errors or silent bad data?
- startISO truncation applied (chart25 was fixed, verify chart26/37)

---

### Section 8 — chart renderers group D: SPC (chart24, 29, 30, 38, 39) [DONE]
**Files:** chart24-shewhart, chart29-cusum, chart30-ewma, chart38-subgroup-spc, chart39-attribute-control

**Focus:**
- std dev fixes verified correct in chart29/30
- chart38-subgroup: X-bar/R and X-bar/S calculation — are subgroup means and ranges computed correctly?
- chart39-attribute: p/np/c/u chart type switching — are control limits computed correctly for each type?
- Western Electric rule violations (chart24) — are all 8 rules implemented correctly?
- CUSUM (chart29): h and k parameters — are defaults sensible? Is the boundary correctly two-sided?

---

### Section 9 — chart renderers group E: industrial/display (chart07–12) [DONE]
**Files:** chart07-kpi-card, chart08-gauge, chart09-sparkline, chart10-analog-bar, chart11-fill-gauge, chart12-alarm-indicator

**Focus:**
- chart07: setInterval fix verified — ref pattern correct?
- chart08: threshold fix verified — do ECharts color pairs cover full 0–1 range?
- chart09: sparkline — does it correctly use the ring buffer? Any render issues?
- chart10: analog bar — setpoint slot wiring correct? H/V orientation logic?
- chart11: fill gauge — SVG fill math correct? Does it handle 0% and 100% edge cases?
- chart12: ISA-18.2 note in place, flash CSS not causing layout issues?

---

### Section 10 — chart renderers group F: Plotly + event (chart14, 31, 34, 35) [DONE]
**Files:** chart14-event-timeline, chart31-probability-plot, chart34-surface3d, chart35-state-timeline

**Focus:**
- chart31/34: cancelled guard + null checks verified correct
- chart14: event timeline — is alarm/event data fetched from the right endpoint? Response shape correct?
- chart35: state timeline — is the state transition logic correct? Does it handle gaps?
- startISO truncation applied and correct in chart14/35

---

### Section 11 — chart renderers group G: remaining (chart15, 36) [DONE]
**Files:** chart15-data-table, chart36-scorecard-table

**Focus:**
- chart15: useQueries fix verified — does the data table correctly update when live values change?
- chart36: scorecard table — threshold coloring logic correct? Is it fetching from the right source?
- Both: any issues with column definitions, sorting, rendering large datasets?

---

### Section 12 — TrendPane + PaneWrapper + console types [DONE]
**Files:**
- `frontend/src/pages/console/panes/TrendPane.tsx`
- `frontend/src/pages/console/PaneWrapper.tsx`
- `frontend/src/pages/console/types.ts`

**Focus:**
- Legacy path (trendPointIds) vs ChartRenderer path (chartConfig) — are both fully functional?
- showGrid threading via config.extras — does it reach renderers that use it?
- handleSaveConfig — does it correctly persist chartConfig to workspaceStore?
- PaneWrapper — does it correctly render all pane types? Any missing cases?
- Fullscreen toggle — does it work with ChartRenderer? Any portal issues?

---

### Section 13 — Dashboard widgets [DONE]
**Files:**
- `TrendChartWidget.tsx`, `AlarmCountBySeverityWidget.tsx`, `AlarmRateTrendWidget.tsx`,
  `AlarmRateWidget.tsx`, `BarChart.tsx`, `StalePointsWidget.tsx`

**Focus:**
- TrendChartWidget: refetchInterval vs live WS — correct approach?
- AlarmRateWidget: i64 fix verified — does query actually work now?
- StalePointsWidget: Math.round fix verified
- BarChart widget: correct API call, response shape handling
- All: do they handle empty/loading/error states without crashing?

---

### Section 14 — api/points.ts frontend client [DONE]
**File:** `frontend/src/api/points.ts`

**Focus:**
- batchLatest method — correct endpoint, method, request shape
- historyBatch method — correct endpoint, request shape
- Any new methods added — are types correct?
- Response type alignment with backend response shapes

---

## Issues Found (append here as review progresses)

| # | Section | File | Issue | Severity | Status |
|---|---------|------|-------|----------|--------|
| (previously fixed issues excluded — see context section above) |
| 1 | 5 | chart03-multi-axis-trend.tsx | Missing `bucketSeconds`/`aggregateType` forwarded to `useTimeSeriesBuffer`; user-configured aggregation was silently ignored | Medium | FIXED |
| 2 | 7 | chart19-box-plot.tsx | `computeBoxStats`: `mean` computed from unfiltered `values` (can include non-finite); outliers also used unfiltered. Both now use `sorted` (filtered) array | Medium | FIXED |
| 3 | 7 | chart20-histogram.tsx:218 | Histogram Cp/Cpk and normal curve used population std dev (`/n`) — should be sample (`/n-1`) | Medium | FIXED |
| 4 | 7 | chart20-histogram.tsx:51 | KDE bandwidth (Silverman's rule) used population std dev — should be sample (`/n-1`) | Medium | FIXED |
| 5 | 14 | api/points.ts | `PointLatest.value` typed `number` — backend LEFT JOIN returns null for points with no current value; should be `number \| null`. Also `timestamp: string \| null` | Medium | FIXED |

---

## Completion Checklist

- [x] Section 1: opc-service history recovery
- [x] Section 2: archive-service history endpoint
- [x] Section 3: api-gateway new point endpoints
- [x] Section 4: chart infrastructure
- [x] Section 5: renderers group A (time-series)
- [x] Section 6: renderers group B (categorical)
- [x] Section 7: renderers group C (statistical)
- [x] Section 8: renderers group D (SPC)
- [x] Section 9: renderers group E (industrial)
- [x] Section 10: renderers group F (Plotly + event)
- [x] Section 11: renderers group G (remaining)
- [x] Section 12: TrendPane + PaneWrapper
- [x] Section 13: dashboard widgets
- [x] Section 14: api/points.ts
