// ---------------------------------------------------------------------------
// Chart 37 — Parallel Coordinate Plot
// ECharts parallel coordinate: each variable = vertical axis, each time bucket
// = a polyline connecting all axes simultaneously.
// Supports color-by-time (oldest→blue, newest→red) or color-by-axis-value.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import {
  type ChartConfig,
  autoColor,
  makeSlotLabeler,
} from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";
import { useHighlight } from "../hooks/useHighlight";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

// Bucket size in milliseconds
const BUCKET_MS: Record<string, number> = {
  hour: 60 * 60 * 1000,
  shift: 8 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

// Interpolate between two hex colors by fraction t ∈ [0, 1]
function lerpColor(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bv})`;
}

interface BucketedRow {
  bucketStart: number;
  values: (number | null)[]; // one per axis slot, null if no data
}

function bucketData(
  historyBatch: {
    point_id: string;
    rows: { timestamp: string; value: number | null }[];
  }[],
  axisPointIds: string[],
  windowStartMs: number,
  windowEndMs: number,
  bucketMs: number,
): BucketedRow[] {
  // Collect all timestamps per point
  const byPoint = new Map<string, Map<number, number[]>>();
  for (const pid of axisPointIds) {
    byPoint.set(pid, new Map());
  }
  for (const batch of historyBatch) {
    const bucketMap = byPoint.get(batch.point_id);
    if (!bucketMap) continue;
    for (const row of batch.rows) {
      if (row.value === null) continue;
      const ts = new Date(row.timestamp).getTime();
      if (ts < windowStartMs || ts > windowEndMs) continue;
      const bucket = Math.floor((ts - windowStartMs) / bucketMs);
      const existing = bucketMap.get(bucket) ?? [];
      existing.push(row.value);
      bucketMap.set(bucket, existing);
    }
  }

  // Build sorted list of unique bucket indices
  const allBuckets = new Set<number>();
  for (const bm of byPoint.values()) {
    for (const b of bm.keys()) allBuckets.add(b);
  }
  const sorted = Array.from(allBuckets).sort((a, b) => a - b);

  return sorted.map((b) => ({
    bucketStart: windowStartMs + b * bucketMs,
    values: axisPointIds.map((pid) => {
      const vals = byPoint.get(pid)?.get(b);
      if (!vals || vals.length === 0) return null;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    }),
  }));
}

export default function ParallelCoordChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const axisSlots = config.points.filter((p) => p.role === "axis");
  const legendItems: LegendItem[] = axisSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: autoColor(i),
  }));
  const durationMinutes = config.durationMinutes ?? 60 * 24;

  const { highlighted, toggle } = useHighlight();

  const bucketSize = (config.extras?.bucketSize as string) ?? "hour";
  const colorBy = (config.extras?.colorBy as string) ?? "time";
  const lineOpacity =
    typeof config.extras?.lineOpacity === "number"
      ? config.extras.lineOpacity
      : 0.4;
  const highlightOutliers = config.extras?.highlightOutliers === true;

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const windowEndMs = isHistorical
    ? new Date(timeRange.end).getTime()
    : Date.now();
  const windowStartMs = isHistorical
    ? new Date(timeRange.start).getTime()
    : windowEndMs - durationMinutes * 60 * 1000;

  const end = new Date(windowEndMs).toISOString();
  const start = new Date(windowStartMs).toISOString();

  const pointIds = axisSlots.map((s) => s.pointId);

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ["history-batch", ...pointIds, start, end, "parallel-coord"],
    queryFn: () =>
      pointsApi.historyBatch(pointIds, { start, end, limit: 5000 }),
    enabled: pointIds.length >= 2,
    refetchInterval: isHistorical ? false : 60_000,
    select: (res) => (res.success ? res.data : []),
  });

  const bucketMs = BUCKET_MS[bucketSize] ?? BUCKET_MS.hour;

  const buckets = useMemo(() => {
    if (!historyBatch) return [];
    return bucketData(
      historyBatch,
      pointIds,
      windowStartMs,
      windowEndMs,
      bucketMs,
    );
  }, [historyBatch, pointIds, windowStartMs, windowEndMs, bucketMs]);

  // Compute per-axis min/max for the visualMap colorBy-axis case
  const axisRanges = useMemo(() => {
    return axisSlots.map((_, i) => {
      const vals = buckets
        .map((b) => b.values[i])
        .filter((v): v is number => v !== null);
      if (vals.length === 0) return { min: 0, max: 1 };
      return { min: Math.min(...vals), max: Math.max(...vals) };
    });
  }, [buckets, axisSlots]);

  // Outlier detection: IQR method per axis
  const outlierBucketIndices = useMemo(() => {
    if (!highlightOutliers || buckets.length < 4) return new Set<number>();
    const outliers = new Set<number>();
    for (let ai = 0; ai < axisSlots.length; ai++) {
      const vals = buckets
        .map((b, bi) => ({ v: b.values[ai], bi }))
        .filter((x): x is { v: number; bi: number } => x.v !== null);
      if (vals.length < 4) continue;
      const sorted = [...vals].sort((a, b) => a.v - b.v);
      const q1 = sorted[Math.floor(sorted.length * 0.25)].v;
      const q3 = sorted[Math.floor(sorted.length * 0.75)].v;
      const iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      for (const { v, bi } of vals) {
        if (v < lo || v > hi) outliers.add(bi);
      }
    }
    return outliers;
  }, [buckets, axisSlots, highlightOutliers]);

  const option: EChartsOption = useMemo(() => {
    const n = buckets.length;

    // Build series data with per-line style
    const seriesData = buckets.map((b, i) => {
      const frac = n > 1 ? i / (n - 1) : 0;
      const isOutlier = outlierBucketIndices.has(i);

      let color: string;
      if (isOutlier) {
        color = "#F59E0B"; // amber for outliers
      } else if (colorBy === "time") {
        color = lerpColor("#3B82F6", "#EF4444", frac);
      } else {
        // colorBy first axis value
        const v = b.values[0];
        const r = axisRanges[0];
        const t = r.max > r.min ? ((v ?? r.min) - r.min) / (r.max - r.min) : 0;
        color = lerpColor("#3B82F6", "#EF4444", t);
      }

      return {
        value: b.values.map((v) => v ?? "-"),
        lineStyle: {
          color,
          opacity: isOutlier ? Math.min(1, lineOpacity * 2) : lineOpacity,
          width: isOutlier ? 2 : 1,
        },
      };
    });

    const parallelAxis = axisSlots.map((slot, i) => {
      const lbl = slotLabel(slot);
      return {
        dim: i,
        name: lbl.length > 18 ? lbl.slice(-18) : lbl,
        nameTextStyle: { fontSize: 10 },
        axisLabel: { fontSize: 9 },
      };
    });

    return {
      backgroundColor: "transparent",
      legend: { show: false },
      tooltip: {
        trigger: "item" as const,
        formatter: (params: unknown) => {
          const p = params as { dataIndex: number };
          const b = buckets[p.dataIndex];
          if (!b) return "";
          const time = new Date(b.bucketStart).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const lines = axisSlots.map((slot, i) => {
            const v = b.values[i];
            const lbl = slotLabel(slot);
            const label = lbl.length > 20 ? lbl.slice(-20) : lbl;
            return `${label}: ${v !== null ? v.toFixed(2) : "—"}`;
          });
          return [time, ...lines].join("<br/>");
        },
      },
      parallel: {
        left: 60,
        right: 60,
        top: 50,
        bottom: 30,
        parallelAxisDefault: {
          type: "value",
          nameLocation: "end",
          axisLine: { lineStyle: { color: "var(--io-border)" } },
          axisTick: { lineStyle: { color: "var(--io-border)" } },
          splitLine: { show: false },
        },
      },
      parallelAxis,
      series: [
        {
          type: "parallel",
          smooth: true,
          lineStyle: { width: 1, opacity: lineOpacity },
          data: seriesData,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buckets,
    axisSlots,
    colorBy,
    lineOpacity,
    axisRanges,
    outlierBucketIndices,
  ]);

  if (axisSlots.length < 2) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        Assign at least 2 variables in the Data Points tab
      </div>
    );
  }

  return (
    <ChartLegendLayout
      legend={config.legend}
      items={legendItems}
      highlighted={highlighted}
      onHighlight={toggle}
    >
      <div
        style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}
      >
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              fontSize: 11,
              color: "var(--io-text-muted)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            Loading…
          </div>
        )}
        {!isLoading && buckets.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            No data in selected range
          </div>
        )}
        {buckets.length > 0 && <EChart option={option} />}
      </div>
    </ChartLegendLayout>
  );
}
