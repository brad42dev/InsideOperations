# Phase 05d — New Chart: Accumulated Run / Production vs. Target (chart40)

**Goal:** Implement chart40 — a cumulative actual vs. cumulative target line chart with a per-shift / per-day / per-week reset boundary.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — confirm `CHART_SLOTS[40]` is set up by Phase 00 (slots `actual` and `target`).
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts` — confirm chart40 stub entry exists with `available: false` from Phase 00.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — Phase 00 left the `40:` line commented.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/renderers/chart01-live-trend.tsx` — for reference; chart40 follows the same hook pattern (`useTimeSeriesBuffer`).
- `/home/io/io-dev/io/frontend/src/shared/components/charts/EChart.tsx` — the ECharts wrapper used by other ECharts-based renderers.

## Context

A common production-engineering view: cumulative actual production line ramps up against a cumulative target (plan) line over the current shift / day / week. The two lines are usually monotonically non-decreasing (rate × elapsed time). Operators see whether they're on track or falling behind, and how the gap is evolving.

Implementation: take `actual` (typically a rate or per-sample contribution) and `target` (rate-equivalent), and draw `cumsum(actual)` vs `cumsum(target)` against time. Reset the running sum when a new shift / day / week boundary crosses.

Reset boundary is `extras.resetPeriod`: `"shift" | "day" | "week"`. Default `"shift"`.

## Changes

### 1. Create `frontend/src/shared/components/charts/renderers/chart40-accumulated-run.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 40 — Accumulated Run / Production vs. Target
// Cumulative actual vs cumulative target line chart over the live window,
// resetting at shift/day/week boundaries.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { useTimeSeriesBuffer } from "../hooks/useTimeSeriesBuffer";
import {
  type ChartConfig,
  autoColor,
  makeSlotLabeler,
} from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type ResetPeriod = "shift" | "day" | "week";

function periodStart(ts: number, period: ResetPeriod): number {
  const d = new Date(ts);
  if (period === "day") {
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (period === "week") {
    // Start on Monday 00:00 local time
    const day = (d.getDay() + 6) % 7; // 0 = Monday
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d.getTime();
  }
  // "shift": 06:00 / 18:00 boundaries (TODO: read from a shift-config; hardcoded for phase 05d)
  d.setMinutes(0, 0, 0);
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
    d.setHours(18, 0, 0, 0);
  } else if (d.getHours() < 18) {
    d.setHours(6, 0, 0, 0);
  } else {
    d.setHours(18, 0, 0, 0);
  }
  return d.getTime();
}

/**
 * Compute cumulative sum of values within a single reset period.
 * Resets to 0 when ts crosses a period boundary.
 */
function cumulativeWithReset(
  timestamps: number[],
  values: Array<number | null>,
  period: ResetPeriod,
): number[] {
  let running = 0;
  let currentPeriodStart = -Infinity;
  return values.map((v, i) => {
    const ts = timestamps[i];
    const ps = periodStart(ts, period);
    if (ps !== currentPeriodStart) {
      running = 0;
      currentPeriodStart = ps;
    }
    if (v != null && Number.isFinite(v)) running += v;
    return running;
  });
}

export default function Chart40AccumulatedRun({ config, bufferKey }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const actualSlot = config.points.find((p) => p.role === "actual");
  const targetSlot = config.points.find((p) => p.role === "target");
  const resetPeriod = (config.extras?.resetPeriod as ResetPeriod | undefined) ?? "shift";

  const pointIds = [actualSlot, targetSlot]
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => s.pointId);

  const { timestamps, seriesData } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes: config.durationMinutes ?? 60,
    interpolation: config.interpolation ?? "linear",
    bucketSeconds: config.aggregateSize,
    aggregateType: config.aggregateType,
  });

  const cumulative = useMemo(() => {
    if (!actualSlot || !targetSlot) return null;
    const actualIdx = pointIds.indexOf(actualSlot.pointId);
    const targetIdx = pointIds.indexOf(targetSlot.pointId);
    const actualCum = cumulativeWithReset(timestamps, seriesData[actualIdx] ?? [], resetPeriod);
    const targetCum = cumulativeWithReset(timestamps, seriesData[targetIdx] ?? [], resetPeriod);
    return { actualCum, targetCum };
  }, [actualSlot?.pointId, targetSlot?.pointId, timestamps, seriesData, resetPeriod]);

  if (!actualSlot || !targetSlot) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--io-text-muted)", fontSize: 12 }}>
        Bind both Actual and Target points
      </div>
    );
  }

  const option: EChartsOption = {
    grid: { left: 50, right: 20, top: 30, bottom: 30 },
    xAxis: { type: "time" },
    yAxis: { type: "value" },
    legend: { data: [slotLabel(actualSlot), slotLabel(targetSlot)] },
    tooltip: { trigger: "axis" },
    series: [
      {
        name: slotLabel(actualSlot),
        type: "line",
        data: timestamps.map((ts, i) => [ts, cumulative?.actualCum[i] ?? null]),
        smooth: false,
        lineStyle: { width: 2, color: actualSlot.color ?? autoColor(0) },
        symbol: "none",
      },
      {
        name: slotLabel(targetSlot),
        type: "line",
        data: timestamps.map((ts, i) => [ts, cumulative?.targetCum[i] ?? null]),
        smooth: false,
        lineStyle: { width: 2, color: targetSlot.color ?? autoColor(1), type: "dashed" },
        symbol: "none",
      },
    ],
  };

  return <EChart option={option} attribute={{ "data-chart-ready": "true" }} />;
}
```

The `attribute` prop wires a ready-marker for the export pipeline; if `EChart` doesn't currently accept arbitrary attributes, set `data-chart-ready="true"` directly on the wrapper div this component returns. Phase 08 verifies the export pipeline picks this up; this phase just emits it.

### 2. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Uncomment the chart40 entry:

```ts
40: lazy(() => import("./renderers/chart40-accumulated-run")),
```

### 3. `frontend/src/shared/components/charts/chart-definitions.ts`

Update the chart40 stub (added in Phase 00) to set `available: true`. Also expand description and benefits to be production-ready text. Leave the rest of the entry as-is.

```ts
{
  id: 40,
  name: "Accumulated Run",
  category: "Production",
  tier: "mid",
  library: "ECharts",
  realTime: true,
  acceptedPointTypes: ["analog"],
  description:
    "Cumulative actual vs. target line over the live window, resetting at shift/day/week boundaries. Operators see plan-vs-actual at a glance and the gap evolution over time.",
  benefits: [
    "Real-time production tracking with target",
    "Configurable reset period (shift/day/week)",
    "Gap between lines = production deficit/surplus",
  ],
  downsides: ["Requires a target source (point or constant)"],
  available: true,
},
```

### 4. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

Add chart40 options for `resetPeriod`:

```tsx
if (config.chartType === 40) {
  return (
    <Field label="Reset Period">
      <Select
        value={(config.extras?.resetPeriod as string | undefined) ?? "shift"}
        onChange={(v) =>
          onChange({
            ...config,
            extras: { ...config.extras, resetPeriod: v as "shift" | "day" | "week" },
          })
        }
        options={[
          { value: "shift", label: "Shift (06:00/18:00)" },
          { value: "day",   label: "Day (00:00)" },
          { value: "week",  label: "Week (Mon 00:00)" },
        ]}
      />
    </Field>
  );
}
```

## Gotchas

- **Reset period boundary**: shift boundaries are hardcoded to 06:00/18:00 local time for phase 05d. A future enhancement reads from a shift-config table. Document the TODO in the renderer.
- **`actual` may be a rate** (per-second / per-minute production value) rather than a per-sample increment. The cumulative sum just sums what arrives. If the rate is per-minute and samples arrive every 5 seconds, `cumsum` over-counts by 12×. Operators are expected to bind a per-sample increment (or use the aggregator config to bucket). For phase 05d, document the assumption: "Bind a per-sample contribution; if your point is a rate, configure a bucket aggregator that integrates rate over the bucket size." A real fix needs unit-aware integration; out of scope here.
- **Historical playback mode**: when console playback is in historical mode (`usePlaybackStore().mode === "historical"`), `useTimeSeriesBuffer` returns the historical window. The cumulative reset still works because it bases off timestamps. Verify visually.
- **Chart-ready attribute**: emit `data-chart-ready="true"` on the wrapper after first paint so Phase 08's export pipeline can wait on it.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place an Accumulated Run widget. Bind two analog points (actual and target). The chart shows two lines starting from 0 at the period start, both monotonically non-decreasing.
3. Switch reset period to "Day" — at midnight (or simulate by changing the clock / shifting target), lines reset to 0.
4. Saved config round-trip works.
5. Phase 04 palette now shows the Accumulated Run tile (because `available: true`).

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical.
