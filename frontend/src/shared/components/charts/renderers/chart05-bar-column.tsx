// ---------------------------------------------------------------------------
// Chart 05 — Bar / Column Chart
// Supports vertical/horizontal orientation, grouped/stacked/100%-stacked variants,
// combo line overlay, and error bars (±stddev or min/max range per bar).
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
import { useWebSocket } from "../../../hooks/useWebSocket";
import { pointsApi } from "../../../../api/points";
import { useHighlight } from "../hooks/useHighlight";
import {
  getEChartsClickKey,
  getEChartsClickMulti,
} from "../chart-highlight-utils";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

export default function BarColumnChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));

  const { highlighted, toggle } = useHighlight();

  const onEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const key = getEChartsClickKey(params);
        if (!key) return;
        toggle(key, getEChartsClickMulti(params));
      },
    }),
    [toggle],
  );

  // Support both 'orientation' key (new) and legacy 'horizontal' boolean
  const horizontal =
    config.extras?.orientation === "horizontal" ||
    config.extras?.horizontal === true;

  const stacked = config.extras?.stacked === true;
  const stackMode = (config.extras?.stackMode as string) ?? "absolute";
  const errorBars = (config.extras?.errorBars as string) ?? "none";
  const showValues = config.extras?.showValues === true;
  const comboLine = config.extras?.comboLine === true;
  const comboLineLabel = (config.extras?.comboLineLabel as string) ?? "Average";

  const durationMinutes = config.durationMinutes ?? 60;
  const nowISO = new Date().toISOString();
  // Truncate to nearest minute for a stable query key within the minute
  const startISO = new Date(
    Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000,
  ).toISOString();

  const needsHistory = errorBars !== "none" || comboLine;

  // Live WebSocket values
  const { values } = useWebSocket(pointIds);

  // Fetch latest values as fallback for points not yet in WS map
  const { data: latestData, isLoading } = useQuery({
    queryKey: ["batch-latest", ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => (res.success ? res.data : []),
  });

  // Fetch historical data for error bars and/or combo line — shared query
  const { data: historyBatch } = useQuery({
    queryKey: ["chart05-history", ...pointIds, startISO],
    queryFn: () =>
      pointsApi.historyBatch(pointIds, {
        start: startISO,
        end: nowISO,
        limit: 2000,
      }),
    enabled: pointIds.length > 0 && needsHistory,
    staleTime: 60_000,
    select: (res) => (res.success ? res.data : []),
  });

  // Compute per-point statistics from history (mean, stddev, min, max)
  const pointStats = useMemo(() => {
    if (!needsHistory || !historyBatch) return null;
    return seriesSlots.map((slot) => {
      const batch = historyBatch.find((r) => r.point_id === slot.pointId);
      const vals = (batch?.rows ?? [])
        .map((r) => r.value)
        .filter(
          (v): v is number => v !== null && v !== undefined && isFinite(v),
        );
      if (vals.length < 2) return null;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const stddev = Math.sqrt(
        vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1),
      );
      return { mean, stddev, min: Math.min(...vals), max: Math.max(...vals) };
    });
  }, [historyBatch, seriesSlots, needsHistory]);

  const dataValues = seriesSlots.map((slot) => {
    const ws = values.get(slot.pointId);
    if (ws !== undefined) return ws.value;
    const latest = latestData?.find((r) => r.point_id === slot.pointId);
    return latest?.value ?? 0;
  });

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    const border = resolveToken("--io-border");

    const names = seriesSlots.map((s) => slotLabel(s));

    // Per-point [lo, hi] pairs for error bar rendering
    const errorData: [number, number][] =
      errorBars !== "none" && pointStats
        ? pointStats.map((s, i): [number, number] => {
            if (!s) return [dataValues[i], dataValues[i]];
            if (errorBars === "stddev")
              return [s.mean - s.stddev, s.mean + s.stddev];
            return [s.min, s.max]; // "range"
          })
        : [];

    const barSeries: EChartsOption["series"] = stacked
      ? seriesSlots.map((slot, i) => ({
          name: slotLabel(slot),
          type: "bar" as const,
          stack: "total",
          ...(stackMode === "percent" ? { stackStrategy: "all" as const } : {}),
          data: [dataValues[i]],
          itemStyle: {
            color: slot.color ?? autoColor(i),
            ...(highlighted.size > 0
              ? { opacity: highlighted.has(slotLabel(slot)) ? 1 : 0.15 }
              : {}),
          },
          label: {
            show: showValues,
            position: "inside" as const,
            fontSize: 10,
            color: "#fff",
          },
        }))
      : [
          {
            type: "bar" as const,
            data: seriesSlots.map((slot, i) => ({
              value: dataValues[i],
              itemStyle: {
                color: slot.color ?? autoColor(i),
                ...(highlighted.size > 0
                  ? { opacity: highlighted.has(slotLabel(slot)) ? 1 : 0.15 }
                  : {}),
              },
            })),
            label: showValues
              ? {
                  show: true,
                  position: "top" as const,
                  fontSize: 10,
                  color: textMuted,
                }
              : { show: false },
          },
        ];

    // Error bar series using ECharts custom series
    const errorBarSeries: EChartsOption["series"] =
      errorBars !== "none" && errorData.length > 0
        ? [
            {
              type: "custom" as const,
              name: "Error",
              silent: true,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              renderItem: (_params: unknown, api: any) => {
                const idx = api.value(0) as number;
                const low = api.value(1) as number;
                const high = api.value(2) as number;
                // horizontal: xAxis=value, yAxis=category → coord([value, categoryIdx])
                // vertical:   xAxis=category, yAxis=value → coord([categoryIdx, value])
                const lowCoord = horizontal
                  ? api.coord([low, idx])
                  : api.coord([idx, low]);
                const highCoord = horizontal
                  ? api.coord([high, idx])
                  : api.coord([idx, high]);
                return {
                  type: "line",
                  shape: {
                    x1: lowCoord[0],
                    y1: lowCoord[1],
                    x2: highCoord[0],
                    y2: highCoord[1],
                  },
                  style: { stroke: textMuted, lineWidth: 2 },
                };
              },
              data: errorData.map(([lo, hi], i) => [i, lo, hi]),
              z: 5,
            },
          ]
        : [];

    // Combo line — rolling mean of each series point over the history window
    const comboSeries: EChartsOption["series"] =
      comboLine && pointStats
        ? [
            {
              type: "line" as const,
              name: comboLineLabel || "Average",
              data: pointStats.map((s) =>
                s ? parseFloat(s.mean.toFixed(4)) : null,
              ),
              symbol: "diamond" as const,
              symbolSize: 7,
              lineStyle: {
                color: "#F59E0B",
                width: 2,
                type: "dashed" as const,
              },
              itemStyle: { color: "#F59E0B" },
              connectNulls: false,
            },
          ]
        : [];

    const categoryAxis = {
      type: "category" as const,
      data: names,
      axisLabel: {
        color: textMuted,
        fontSize: 11,
        show: config.xAxisLabels !== "none",
      },
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
    };

    const valueAxis = {
      type: "value" as const,
      axisLabel: {
        color: textMuted,
        fontSize: 11,
        show: config.yAxisLabels !== "none",
        ...(stackMode === "percent" ? { formatter: "{value}%" } : {}),
      },
      splitLine: { lineStyle: { color: border, opacity: 0.4 } },
      min: config.scaling?.type === "fixed" ? config.scaling.yMin : undefined,
      max: config.scaling?.type === "fixed" ? config.scaling.yMax : undefined,
    };

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      legend: { show: false },
      grid: { left: 48, right: 16, top: 12, bottom: 12, containLabel: true },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: [...barSeries, ...errorBarSeries, ...comboSeries],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values,
    latestData,
    config,
    seriesSlots,
    dataValues,
    horizontal,
    stacked,
    stackMode,
    errorBars,
    comboLine,
    comboLineLabel,
    showValues,
    highlighted,
    pointStats,
  ]);

  if (pointIds.length === 0) {
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
        No points configured
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
        <EChart option={option} onEvents={onEvents} />
      </div>
    </ChartLegendLayout>
  );
}
