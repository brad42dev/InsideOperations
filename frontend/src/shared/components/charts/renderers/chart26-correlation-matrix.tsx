// ---------------------------------------------------------------------------
// Chart 26 — Correlation Matrix Heatmap
// Pearson correlation for all point-pairs from historical data.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig, autoColor, makeSlotLabeler } from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";
import { useHighlight } from "../hooks/useHighlight";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

export default function CorrelationMatrixChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));
  const pointIds = seriesSlots.map((p) => p.pointId);

  const { highlighted, toggle } = useHighlight();
  const showValues = config.extras?.showValues !== false;
  const durationMinutes = config.durationMinutes ?? 60 * 24;

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const end = isHistorical
    ? new Date(timeRange.end).toISOString()
    : new Date().toISOString();
  const start = isHistorical
    ? new Date(timeRange.start).toISOString()
    : new Date(Date.now() - durationMinutes * 60 * 1000).toISOString();

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ["history-batch", ...pointIds, start, end, "corr"],
    queryFn: () =>
      pointsApi.historyBatch(pointIds, { start, end, limit: 2000 }),
    enabled: pointIds.length >= 2,
    select: (res) => (res.success ? res.data : []),
  });

  const { matrixData } = useMemo(() => {
    const seriesVals: Map<string, number[]> = new Map();
    for (const slot of seriesSlots) {
      const batch = historyBatch?.find((r) => r.point_id === slot.pointId);
      const vals = (batch?.rows ?? [])
        .map((r) => r.value)
        .filter((v): v is number => v !== null && v !== undefined);
      seriesVals.set(slot.pointId, vals);
    }

    const matrixData: [number, number, number][] = [];
    for (let i = 0; i < seriesSlots.length; i++) {
      for (let j = 0; j < seriesSlots.length; j++) {
        const xi = seriesVals.get(seriesSlots[i].pointId) ?? [];
        const xj = seriesVals.get(seriesSlots[j].pointId) ?? [];
        const r = i === j ? 1 : pearson(xi, xj);
        matrixData.push([i, j, parseFloat(r.toFixed(3))]);
      }
    }

    return { matrixData };
  }, [historyBatch, seriesSlots]);

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    const textPrimary = resolveToken("--io-text-primary");
    const labels = seriesSlots.map((s) => slotLabel(s));

    return {
      backgroundColor: "transparent",
      legend: { show: false },
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number] };
          return `${labels[p.value[0]]} × ${labels[p.value[1]]}: ${p.value[2].toFixed(3)}`;
        },
      },
      grid: { left: 80, right: 16, top: 16, bottom: 80, containLabel: false },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: textMuted, fontSize: 10, rotate: 30 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: true },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: { color: textMuted, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: true },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: ["#3B82F6", "#F8FAFC", "#EF4444"] },
        textStyle: { color: textPrimary, fontSize: 10 },
      },
      series: [
        {
          type: "heatmap",
          data: matrixData,
          label: {
            show: showValues,
            fontSize: 9,
            color: "#111",
            formatter: (params: unknown) => {
              const p = params as { value: [number, number, number] };
              return p.value[2].toFixed(2);
            },
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.4)" },
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixData, seriesSlots, showValues]);

  if (pointIds.length < 2) {
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
        Add at least 2 series points
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
        {!isLoading && matrixData.length === 0 && (
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
            No data
          </div>
        )}
        {matrixData.length > 0 && <EChart option={option} />}
      </div>
    </ChartLegendLayout>
  );
}
