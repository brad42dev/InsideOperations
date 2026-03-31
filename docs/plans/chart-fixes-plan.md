# Chart Fixes Plan — All 39 Charts
Date: 2026-03-30

## Background

User spot-checked 9 charts and found 5 broken. Full audit of all 39 chart
renderers revealed issues across four categories. This plan fixes everything in
three phases, ordered by impact.

---

## Issues Found

### CRASHES (Kill the entire page — no ErrorBoundary exists)

- **Chart 24 — Shewhart**: `math.std()` from mathjs v15 blows up on NaN values.
  The null filter in the renderer only removes `null`, not `NaN`. One bad value
  from the history API → unhandled exception → React tree unmounts → blank page.
- **Chart 34 — 3D Surface**: Plotly `surface` trace crashes WebGL when the
  z-matrix contains `null` values (which the grid builder creates for empty
  cells). The `.catch()` on `Plotly.newPlot` doesn't catch synchronous throws or
  WebGL context crashes.

### COMPLETELY NON-FUNCTIONAL

- **Chart 22 — Stacked Area**: ECharts data format bug. Series `data` is passed
  as `[value, value, ...]` but ECharts `type: "time"` xAxis requires
  `[[timestamp_ms, value], ...]` pairs. Result: values spread evenly by index
  across the x-axis instead of by timestamp → chart looks like half a screen,
  draws nothing meaningful, tooltip spams all series at each index position.
  Fix: `data: xData.map((ts, idx) => [ts, data[idx] ?? null])`
- **Chart 16 — Batch Comparison**: `ExtrasBatchComparison` options form has
  alignment/showBand/refLabel fields but **no way to add, edit, or remove
  batches**. `extras.batches` (the `{label, start, end}[]` array the renderer
  requires) is never populated via UI. Chart always shows "Configure batches in
  options" with no path forward.

### MISLEADING / BROKEN UX

- **Chart 29 — CUSUM**: Working as coded but shows "Insufficient Data for CUSUM
  chart" when the configured point has no history in the last 120 minutes. The
  options form *does* have k/h/target fields. The message needs to distinguish
  "no data found" from "not enough data for SPC statistics". Also needs better
  inline guidance on what the k/h parameters mean.

### MISSING UI FOR CRITICAL EXTRAS (chart unusable without raw JSON editing)

| Chart | What's missing from ChartOptionsForm |
|-------|--------------------------------------|
| 20 — Histogram/Violin | Mode selector (histogram vs violin), displayMode field |
| 23 — Bullet | Range bands editor (`extras.ranges: [{value, color, label}]`) |
| 25 — Regression | Model type selector (linear/poly/exponential/logarithmic/power) |
| 27 — Sankey | Entire chart is JSON-defined (nodes + links), no editor at all |
| 35 — State Timeline | State colors map and state labels map editors |
| 36 — Scorecard Table | Mode (scorecard/event_stats), aggregate fn, row period, thresholds |
| 37 — Parallel Coord | Bucket size, color-by mode selectors |
| 38 — Subgroup SPC | Subchart type (R vs S), subgroup size picker |
| 39 — Attribute Control | Chart variant picker (p/np/c/u) |

### PARTIALLY UNIMPLEMENTED

- **Chart 05 — Bar/Column**: Error bars and combo-line are exposed in the options
  form but the renderer emits empty arrays. Configuring them does nothing.

### LAYOUT — HARDCODED HEIGHTS

Charts 05, 06, 08, 13, 18, 19, 20, 21, 23, 26, 28, 32 all have `height: 300px`
hardcoded. Charts 10, 11 (Analog Bar, Fill Gauge) have fixed SVG dimensions and
don't scale to container.

---

## Phase 1 — Stop the Bleeding
**Goal:** No chart can crash the page; the two most used broken charts (22, 16)
become functional.

### Task 1.1 — Add ErrorBoundary to ChartRenderer
**File:** `frontend/src/shared/components/charts/ChartRenderer.tsx`
- Create `ChartErrorBoundary` (class component, no external dep needed)
- Wrap `<Renderer />` inside it
- Show in-chart error state (message + chart name) instead of killing the page
- Status: TODO

### Task 1.2 — Fix Chart 22 ECharts data format
**File:** `frontend/src/shared/components/charts/renderers/chart22-stacked-area.tsx`
- Change: `data: xData.map((_, idx) => data[idx] ?? null)`
- To: `data: xData.map((ts, idx) => [ts, data[idx] ?? null])`
- Also audit tooltip formatter — add custom formatter to avoid repeating values
- Status: TODO

### Task 1.3 — Fix Chart 24 NaN guard
**File:** `frontend/src/shared/components/charts/renderers/chart24-shewhart.tsx`
- Filter is currently: `.filter((v): v is number => v !== null)`
- Change to: `.filter((v): v is number => v !== null && Number.isFinite(v))`
- Same fix needed in useMemo where vals is derived
- Status: TODO

### Task 1.4 — Fix Chart 34 null z-matrix
**File:** `frontend/src/shared/components/charts/renderers/chart34-surface3d.tsx`
- Replace nulls in zMatrix with interpolated value or grid mean before passing to Plotly
- Strategy: compute overall mean of non-null cells, fill null cells with that mean
- This prevents Plotly WebGL crash on sparse/missing grid cells
- Also wrap entire Plotly render block in try/catch (not just the promise)
- Status: TODO

### Task 1.5 — Add Batch Editor UI to Chart 16
**File:** `frontend/src/shared/components/charts/ChartOptionsForm.tsx`
- Replace `ExtrasBatchComparison` stub with real batch editor
- UI: list of batch rows, each with label (text), start (datetime-local), end (datetime-local)
- Add batch button, remove (×) per row
- Persist to `extras.batches` array
- Status: TODO

---

## Phase 2 — Missing Extras UI
**Goal:** Every chart is configurable through the UI without touching raw JSON.

### Task 2.1 — Chart 20: Add mode selector (histogram vs violin)
**File:** `ChartOptionsForm.tsx` — `ExtrasHistogram` section
- Add "Display mode" select: Histogram | Violin Plot
- Writes to `extras.displayMode`
- Status: TODO

### Task 2.2 — Chart 23: Add range bands editor (Bullet)
**File:** `ChartOptionsForm.tsx` — `ExtrasBullet` section
- Add target value input (writes `extras.target`)
- Add range bands list: each row = value (number) + color (color picker or preset) + label (text)
- Add/remove rows
- Writes to `extras.ranges`
- Status: TODO

### Task 2.3 — Chart 25: Add model type selector (Regression)
**File:** `ChartOptionsForm.tsx` — `ExtrasRegression` section (already exists)
- The section EXISTS but model selector IS already there (lines ~825–863)
- VERIFY this actually works end-to-end with the renderer
- Renderer reads `extras.model` — confirm ChartOptionsForm writes it correctly
- Status: VERIFY

### Task 2.4 — Chart 27: Add Sankey node/link editor
**File:** `ChartOptionsForm.tsx` — add `ExtrasSankey` section (only has nodeAlign currently)
- Add node editor: list of {name, color} rows
- Add link editor: list of {source, target, value} rows (source/target = node name selectors)
- This is a mini-graph definition UI; complexity is high
- Consider: textarea-based JSON editor as fallback if full UI is too large
- Status: TODO (JSON editor fallback acceptable)

### Task 2.5 — Chart 35: Add state colors/labels editors (State Timeline)
**File:** `ChartOptionsForm.tsx` — find `ExtrasStateTimeline` section
- Add state mapping editor: list of {stateValue, displayLabel, color} rows
- Writes to `extras.stateColors` (Record<string,string>) and `extras.stateLabels`
- Status: TODO

### Task 2.6 — Chart 36: Add mode/aggregate/period/threshold editors (Scorecard)
**File:** `ChartOptionsForm.tsx` — find `ExtrasScorecard` section
- Add: tableMode select (scorecard | event_stats)
- Add: aggregateFunction select (mean/last/min/max/sum/count)
- Add: rowPeriod select (hour/shift/day/week)
- Add: refreshSeconds number input
- Threshold editor is complex (per-point): defer to Phase 3
- Status: TODO

### Task 2.7 — Charts 37/38/39: Add key parameter selectors
- Chart 37: Add bucketSize select + colorBy select
- Chart 38: Add subchartType select (R/S) + subgroupSize number
- Chart 39: Add chartVariant select (p/np/c/u) + fixedSampleSize number
- Status: TODO

---

## Phase 3 — Layout & Polish
**Goal:** All charts fill their container; hardcoded heights eliminated.

### Task 3.1 — Fix hardcoded 300px heights
**Affected charts:** 05, 06, 08, 13, 18, 19, 20, 21, 23, 26, 28, 32
**Fix pattern:** Remove `height: 300px` from outer container; add `flex: 1; minHeight: 0`
to outer div and ensure EChart component itself respects `height: 100%`
- Status: TODO

### Task 3.2 — Fix SVG sizing in Charts 10/11
- Chart 10 (Analog Bar): SVG viewBox is fixed (300×60 or 60×300)
- Chart 11 (Fill Gauge): SVG viewBox is fixed (80×200)
- Fix: Make outer container `position: relative; flex: 1`, SVG `width: 100%; height: 100%`
  with `preserveAspectRatio="xMidYMid meet"` or similar
- Status: TODO

### Task 3.3 — Fix Chart 05 Bar/Column unimplemented features
- Error bars: implement actual ±error rendering in ECharts using markLine or custom series
- Combo line: implement as second ECharts series with line type overlaid on bar
- Status: TODO (lowest priority)

### Task 3.4 — Improve Chart 29 CUSUM error message
- Distinguish "no point configured" vs "point has no data in window" vs "< 4 values"
- Add tooltip/help text explaining k and h parameters in the options form
- Status: TODO

---

## Implementation Order

```
Phase 1:
  1.1  ErrorBoundary (10 min)
  1.2  Chart 22 data format fix (15 min)
  1.3  Chart 24 NaN guard (10 min)
  1.4  Chart 34 null z-matrix fix (20 min)
  1.5  Chart 16 batch editor UI (45 min)

Phase 2:
  2.3  Verify Chart 25 regression model selector (10 min)
  2.1  Chart 20 mode selector (15 min)
  2.2  Chart 23 range bands editor (30 min)
  2.7  Charts 37/38/39 key selectors (30 min)
  2.6  Chart 36 mode/aggregate/period (30 min)
  2.5  Chart 35 state colors/labels (30 min)
  2.4  Chart 27 Sankey editor (45 min — JSON editor fallback)

Phase 3:
  3.1  Hardcoded heights (30 min bulk)
  3.2  SVG sizing charts 10/11 (20 min)
  3.4  Chart 29 better messages (15 min)
  3.3  Chart 05 unimplemented features (60 min — lowest priority)
```

---

## Progress Tracking

| Task | Status | Notes |
|------|--------|-------|
| 1.1 ErrorBoundary | DONE | ChartErrorBoundary class wraps Suspense in ChartRenderer.tsx |
| 1.2 Chart 22 data format | DONE | Fixed [ts,value] pairs; added tooltip formatter |
| 1.3 Chart 24 NaN guard | DONE | Filter changed to v !== null && Number.isFinite(v); same fix in valIdx loop |
| 1.4 Chart 34 null z-matrix | DONE | Null cells filled with grid mean; Plotly.newPlot wrapped in try/catch |
| 1.5 Chart 16 batch editor | DONE | Full batch list editor (label/start/end/add/remove) added to ChartOptionsForm |
| 2.1 Chart 20 mode selector | DONE | Was already implemented; displayMode selector present in ExtrasHistogram |
| 2.2 Chart 23 range editor | DONE | Replaced poor/satisfactory stubs with ranges list editor (value/color/label + add/remove) |
| 2.3 Chart 25 verify | DONE | ExtrasRegression writes extras.model; renderer reads extras.model — end-to-end confirmed |
| 2.4 Chart 27 Sankey editor | DONE | Added JSON textarea editors for extras.nodes and extras.links with onBlur parse |
| 2.5 Chart 35 state editor | DONE | Added state mappings list editor writing stateColors + stateLabels records |
| 2.6 Chart 36 scorecard opts | DONE | Fixed key names (tableMode/aggregateFunction), added rowPeriod select |
| 2.7 Charts 37/38/39 selectors | DONE | Were already implemented in ExtrasParallelCoord/SubgroupSPC/AttributeControl |
| 3.1 Hardcoded heights | DONE | EChart height default changed to "100%"; ResizeObserver now tracks height changes; height prop removed from charts 05,06,08,13,18,19,20,21,23,26,28,32 |
| 3.2 SVG sizing 10/11 | DONE | SVG width/height changed to 100%/100% with preserveAspectRatio="xMidYMid meet"; viewBox and coordinate geometry unchanged |
| 3.3 Chart 05 unimplemented | DONE | Added shared historyBatch query (fires only when errorBars≠none or comboLine=true); per-point mean/stddev/min/max computed; error bars render via existing custom series; combo line renders as dashed orange line using rolling mean; fixed horizontal renderItem coord order bug |
| 3.4 Chart 29 better messages | DONE | Distinguishes no_data vs insufficient; Row component gained optional title prop for tooltip help text; k and h labels have descriptive title tooltips |

---

## Key Files

- `frontend/src/shared/components/charts/ChartRenderer.tsx` — dispatcher, add ErrorBoundary here
- `frontend/src/shared/components/charts/ChartOptionsForm.tsx` — all extras UI lives here
- `frontend/src/shared/components/charts/renderers/chart22-stacked-area.tsx` — ECharts data bug
- `frontend/src/shared/components/charts/renderers/chart24-shewhart.tsx` — NaN crash
- `frontend/src/shared/components/charts/renderers/chart34-surface3d.tsx` — Plotly null crash
- `frontend/src/shared/components/charts/renderers/chart16-batch-comparison.tsx` — batch renderer

## Verification After Each Phase

After Phase 1: Open each of charts 22, 24, 34 in browser. Shewhart and 3D Surface should
show in-chart error state or render correctly rather than crashing the page. Chart 22 should
draw actual stacked areas aligned to real timestamps. Chart 16 should allow adding batch
time ranges.

After Phase 2: Open each "advanced" chart and verify Options panel has appropriate controls
and that changing them updates the chart.

After Phase 3: Resize chart panels to small/large dimensions and verify all charts scale
correctly without fixed-height artifacts.
