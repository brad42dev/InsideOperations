---
id: DD-12-002
title: Implement threshold search trend view with threshold line and exceedance shading
unit: DD-12
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user selects "Trend View" on the Threshold Search tab, they should see the selected point trended over the full lookback period (default 30 days) with: a horizontal threshold line drawn at the configured value, and exceedance periods highlighted as shaded regions. Clicking any shaded region anchors a new investigation there.

## Spec Excerpt (verbatim)

> **Trend view**: Point trended over configurable lookback (default 30 days) with threshold drawn as a horizontal line. Exceedance periods highlighted as shaded regions. Click any region to anchor an investigation there.
> — 12_FORENSICS_MODULE.md, §Investigation Entry Points > From Forensics Module Direct > Threshold search

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/ThresholdSearch.tsx` — lines 407–429: trend view branch renders a placeholder only
- `frontend/src/shared/components/charts/TimeSeriesChart.tsx` — shared uPlot chart; check if it supports reference lines and region marking
- `frontend/src/api/forensics.ts` — check if threshold search result includes exceedance time ranges for region shading

## Verification Checklist

- [ ] Selecting "Trend View" shows a real time-series chart (not a placeholder) with point data for the lookback period
- [ ] A horizontal line is drawn at the configured threshold value
- [ ] Each exceedance period is shown as a colored shaded region on the chart
- [ ] Clicking a shaded region selects that exceedance and offers "Start Investigation"
- [ ] The chart updates when the lookback selector changes

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: ThresholdSearch.tsx lines 408–429 render an emoji and static text message instead of a chart. No data fetch, no threshold line, no region shading.

## Fix Instructions

In `frontend/src/pages/forensics/ThresholdSearch.tsx`, replace the trend view stub (lines 408–429) with:

1. When `viewMode === 'trend'` and `searchMutation.isSuccess`:
   - Fetch historical time-series data for the point over the lookback window: `GET /api/archive/history?point_id=...&start=...&end=...`
   - Render a `TimeSeriesChart` (or EChart) with the historical data
   - Add a horizontal reference line at `parseFloat(threshold)` — use uPlot's `hooks` or ECharts `markLine` for this
   - For each exceedance in `exceedances`, render a shaded region between `exceedance.start` and `exceedance.end` — use uPlot bands or ECharts `markArea`
   - Clicking a shaded region calls `setSelectedExceedance(exceedance)`

2. The existing `selectedExceedance` state and "Start Investigation" button at lines 346–403 already handle the anchor flow — reuse them.

3. If `TimeSeriesChart` does not support reference lines or shaded regions, use an ECharts-based chart (`EChart` component) instead — ECharts `markLine` + `markArea` cover both requirements cleanly.

Do NOT:
- Remove the list view — both views must work
- Fetch all raw data points for 365-day lookback without a limit — cap at 1000 samples or use aggregation
