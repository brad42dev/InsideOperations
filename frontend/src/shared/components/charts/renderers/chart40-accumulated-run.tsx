// ---------------------------------------------------------------------------
// Chart 40 — Accumulated Run / Production vs. Target
// Cumulative actual vs cumulative target line chart over the live window,
// resetting at shift/day/week boundaries.
//
// Assumption: bind a per-sample contribution (increment), not a rate.
// If your point is a rate (per-minute), configure a bucket aggregator that
// integrates rate over the bucket size, or the cumsum will over-count.
//
// Shift boundaries are hardcoded to 06:00/18:00 local time.
// A future enhancement will read from a shift-config table.
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
  // "shift": 06:00 / 18:00 boundaries
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

function cumulativeWithReset(
  timestamps: number[],
  values: (number | null)[],
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

export default function Chart40AccumulatedRun({
  config,
  bufferKey,
}: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const actualSlot = config.points.find((p) => p.role === "actual");
  const targetSlot = config.points.find((p) => p.role === "target");
  const resetPeriod =
    (config.extras?.resetPeriod as ResetPeriod | undefined) ?? "shift";

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
    const actualVals = seriesData.get(actualSlot.pointId) ?? [];
    const targetVals = seriesData.get(targetSlot.pointId) ?? [];
    const actualCum = cumulativeWithReset(timestamps, actualVals, resetPeriod);
    const targetCum = cumulativeWithReset(timestamps, targetVals, resetPeriod);
    return { actualCum, targetCum };
  }, [actualSlot, targetSlot, timestamps, seriesData, resetPeriod]);

  if (!actualSlot || !targetSlot) {
    return (
      <div
        data-chart-ready="true"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
        }}
      >
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
        lineStyle: {
          width: 2,
          color: targetSlot.color ?? autoColor(1),
          type: "dashed",
        },
        symbol: "none",
      },
    ],
  };

  return (
    <div
      style={{ flex: 1, width: "100%", height: "100%" }}
      data-chart-ready="true"
    >
      <EChart option={option} />
    </div>
  );
}
