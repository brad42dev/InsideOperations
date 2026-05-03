// ---------------------------------------------------------------------------
// Chart 13 — XY Scatter Plot
// Two points: role='x' and role='y'. Fetch historical data for both and align
// by nearest timestamp. Density mode bins the X/Y space and renders a heatmap
// showing operating time density — essential for large datasets.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig, makeSlotLabeler } from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";
import { useHighlight } from "../hooks/useHighlight";
import {
  applyEChartsHighlight,
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

/** Align two time-series by nearest timestamp within tolerance (ms) */
function alignSeries(
  xRows: { timestamp: string; value: number | null }[],
  yRows: { timestamp: string; value: number | null }[],
): { x: number; y: number; t: number }[] {
  const result: { x: number; y: number; t: number }[] = [];
  const yMap = new Map(yRows.map((r) => [r.timestamp, r]));

  for (const xRow of xRows) {
    if (xRow.value === null) continue;
    let yRow = yMap.get(xRow.timestamp);
    if (!yRow) {
      const xt = new Date(xRow.timestamp).getTime();
      let best: { timestamp: string; value: number | null } | undefined =
        undefined;
      let bestDiff = Infinity;
      for (const yr of yRows) {
        if (yr.value === null) continue;
        const diff = Math.abs(new Date(yr.timestamp).getTime() - xt);
        if (diff < bestDiff && diff <= 5000) {
          bestDiff = diff;
          best = yr;
        }
      }
      yRow = best;
    }
    if (yRow?.value !== null && yRow?.value !== undefined) {
      result.push({
        x: xRow.value,
        y: yRow.value,
        t: new Date(xRow.timestamp).getTime(),
      });
    }
  }
  return result;
}

/** Align size values to xy-aligned points by nearest timestamp within 5 s tolerance */
function alignSizeToXY(
  xyPoints: { x: number; y: number; t: number }[],
  sizeRows: { timestamp: string; value: number | null }[],
): (number | null)[] {
  const valid = sizeRows
    .filter((r) => r.value !== null)
    .map((r) => ({ t: new Date(r.timestamp).getTime(), v: r.value as number }))
    .sort((a, b) => a.t - b.t);
  if (!valid.length) return xyPoints.map(() => null);
  return xyPoints.map((p) => {
    let lo = 0,
      hi = valid.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (valid[mid].t < p.t) lo = mid + 1;
      else hi = mid;
    }
    let best = valid[lo];
    if (lo > 0 && Math.abs(valid[lo - 1].t - p.t) < Math.abs(best.t - p.t)) {
      best = valid[lo - 1];
    }
    return Math.abs(best.t - p.t) <= 5000 ? best.v : null;
  });
}

/** Compute 2D density matrix: divide X/Y space into binCount×binCount cells */
function computeDensity(
  points: { x: number; y: number }[],
  binCount: number,
): { data: [number, number, number][]; xBins: number[]; yBins: number[] } {
  if (points.length < 2) return { data: [], xBins: [], yBins: [] };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  if (xMin === xMax || yMin === yMax) return { data: [], xBins: [], yBins: [] };

  const xStep = (xMax - xMin) / binCount;
  const yStep = (yMax - yMin) / binCount;

  const grid = Array.from(
    { length: binCount },
    () => new Array(binCount).fill(0) as number[],
  );

  for (const p of points) {
    const xi = Math.min(Math.floor((p.x - xMin) / xStep), binCount - 1);
    const yi = Math.min(Math.floor((p.y - yMin) / yStep), binCount - 1);
    grid[yi][xi]++;
  }

  const xBins = Array.from({ length: binCount }, (_, i) =>
    parseFloat((xMin + (i + 0.5) * xStep).toFixed(4)),
  );
  const yBins = Array.from({ length: binCount }, (_, i) =>
    parseFloat((yMin + (i + 0.5) * yStep).toFixed(4)),
  );

  const data: [number, number, number][] = [];
  for (let yi = 0; yi < binCount; yi++) {
    for (let xi = 0; xi < binCount; xi++) {
      if (grid[yi][xi] > 0) {
        data.push([xi, yi, grid[yi][xi]]);
      }
    }
  }

  return { data, xBins, yBins };
}

export default function XYScatterChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const xSlot = config.points.find((p) => p.role === "x");
  const ySlot = config.points.find((p) => p.role === "y");
  const sizeSlot = config.points.find((p) => p.role === "size") ?? null;
  const bubbleMode = sizeSlot != null;
  const [minPx, maxPx] = (config.extras?.bubbleSizeRange as
    | [number, number]
    | undefined) ?? [8, 60];
  const { highlighted, toggle } = useHighlight();
  const legendItems: LegendItem[] = [
    ...(xSlot
      ? [{ label: slotLabel(xSlot), color: xSlot.color ?? "#4A9EFF" }]
      : []),
    ...(ySlot
      ? [{ label: slotLabel(ySlot), color: ySlot.color ?? "#F59E0B" }]
      : []),
    ...(sizeSlot
      ? [
          {
            label: `Size: ${slotLabel(sizeSlot)}`,
            color: sizeSlot.color ?? "#A78BFA",
          },
        ]
      : []),
  ];
  const durationMinutes = config.durationMinutes ?? 60;
  const timeColoring =
    config.extras?.colorByTime === true || config.extras?.timeColoring === true;
  const densityMode = (config.extras?.densityMode as string) ?? "auto";
  const densityBins =
    typeof config.extras?.densityBins === "number"
      ? config.extras.densityBins
      : 50;

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const end = isHistorical
    ? new Date(timeRange.end).toISOString()
    : new Date().toISOString();
  // Truncate live start to nearest minute for a stable query key (prevents refetch on every render)
  const start = isHistorical
    ? new Date(timeRange.start).toISOString()
    : new Date(
        Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000,
      ).toISOString();

  const queryEnabled = !!(xSlot && ySlot);

  const { data: xData, isLoading: xLoading } = useQuery({
    queryKey: ["history", xSlot?.pointId, start, end],
    queryFn: () =>
      pointsApi.history(xSlot!.pointId, { start, end, limit: 5000 }),
    enabled: queryEnabled,
    select: (res) => (res.success ? res.data.rows : []),
  });

  const { data: yData, isLoading: yLoading } = useQuery({
    queryKey: ["history", ySlot?.pointId, start, end],
    queryFn: () =>
      pointsApi.history(ySlot!.pointId, { start, end, limit: 5000 }),
    enabled: queryEnabled,
    select: (res) => (res.success ? res.data.rows : []),
  });

  const { data: sizeData, isLoading: sizeLoading } = useQuery({
    queryKey: ["history", sizeSlot?.pointId, start, end],
    queryFn: () =>
      pointsApi.history(sizeSlot!.pointId, { start, end, limit: 5000 }),
    enabled: queryEnabled && bubbleMode,
    select: (res) => (res.success ? res.data.rows : []),
  });

  const aligned = useMemo(() => {
    if (!xData || !yData) return [];
    return alignSeries(xData, yData);
  }, [xData, yData]);

  const sizeValuesRaw = useMemo(() => {
    if (!bubbleMode || !sizeData || !aligned.length) return null;
    return alignSizeToXY(aligned, sizeData);
  }, [aligned, sizeData, bubbleMode]);

  // Determine whether to use density mode
  const useDensity =
    densityMode === "on" || (densityMode === "auto" && aligned.length >= 1000);

  const densityResult = useMemo(() => {
    if (!useDensity || aligned.length < 2) return null;
    return computeDensity(aligned, densityBins);
  }, [aligned, useDensity, densityBins]);

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    const border = resolveToken("--io-border");
    const textPrimary = resolveToken("--io-text-primary");

    if (useDensity && densityResult && densityResult.data.length > 0) {
      const maxCount = Math.max(...densityResult.data.map((d) => d[2]));
      return {
        backgroundColor: "transparent",
        tooltip: {
          position: "top",
          formatter: (params: unknown) => {
            const p = params as { value: [number, number, number] };
            const xVal = densityResult.xBins[p.value[0]];
            const yVal = densityResult.yBins[p.value[1]];
            return `X: ${xVal?.toFixed(3)}<br/>Y: ${yVal?.toFixed(3)}<br/>Count: ${p.value[2]}`;
          },
        },
        grid: { left: 60, right: 80, top: 16, bottom: 60, containLabel: false },
        xAxis: {
          type: "category",
          data: densityResult.xBins.map((v) => v.toFixed(2)),
          axisLabel: {
            color: textMuted,
            fontSize: 9,
            rotate: 30,
            interval: Math.ceil(densityBins / 8) - 1,
          },
          name: xSlot ? slotLabel(xSlot) : "X",
          nameTextStyle: { color: textMuted, fontSize: 10 },
          axisLine: { lineStyle: { color: border } },
          axisTick: { show: false },
        },
        yAxis: {
          type: "category",
          data: densityResult.yBins.map((v) => v.toFixed(2)),
          axisLabel: {
            color: textMuted,
            fontSize: 9,
            interval: Math.ceil(densityBins / 6) - 1,
          },
          name: ySlot ? slotLabel(ySlot) : "Y",
          nameTextStyle: { color: textMuted, fontSize: 10 },
          axisLine: { lineStyle: { color: border } },
          axisTick: { show: false },
        },
        visualMap: {
          min: 0,
          max: maxCount,
          calculable: true,
          orient: "vertical",
          right: 0,
          top: "center",
          inRange: { color: ["#1E3A5F", "#3B82F6", "#FBBF24", "#EF4444"] },
          textStyle: { color: textPrimary, fontSize: 10 },
        },
        series: [
          {
            type: "heatmap",
            data: densityResult.data,
            emphasis: {
              itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.4)" },
            },
          },
        ],
      };
    }

    // Normal scatter mode
    const tMin = aligned.length ? Math.min(...aligned.map((p) => p.t)) : 0;
    const tMax = aligned.length ? Math.max(...aligned.map((p) => p.t)) : 1;

    const rawSizeVals = bubbleMode && sizeValuesRaw ? sizeValuesRaw : [];
    const finiteVals = rawSizeVals.filter(
      (v): v is number => v !== null && Number.isFinite(v),
    );
    const sizeMinVal = finiteVals.length ? Math.min(...finiteVals) : 0;
    const sizeMaxVal = finiteVals.length ? Math.max(...finiteVals) : 1;
    const sizeRange = sizeMaxVal - sizeMinVal || 1;

    const scatterData = aligned.map((p, i) => {
      const norm = tMax > tMin ? (p.t - tMin) / (tMax - tMin) : 0;
      const itemStyle = timeColoring
        ? { color: `hsl(${(1 - norm) * 220},80%,55%)` }
        : {
            color: xSlot?.color ?? "#4A9EFF",
            opacity:
              typeof config.extras?.opacity === "number"
                ? config.extras.opacity
                : 0.7,
          };
      if (bubbleMode) {
        const rawSize = rawSizeVals[i] ?? sizeMinVal;
        const clampedSize = Math.max(rawSize, sizeMinVal);
        const symbolSz =
          minPx + ((clampedSize - sizeMinVal) / sizeRange) * (maxPx - minPx);
        return {
          value: [p.x, p.y, rawSize] as [number, number, number],
          symbolSize: symbolSz,
          itemStyle,
        };
      }
      return {
        value: [p.x, p.y] as [number, number],
        itemStyle,
      };
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { value: number[] };
          const xStr = `X: ${p.value[0].toFixed(3)}`;
          const yStr = `Y: ${p.value[1].toFixed(3)}`;
          if (bubbleMode && sizeSlot && p.value.length > 2) {
            return `${xStr}<br/>${yStr}<br/>${slotLabel(sizeSlot)}: ${p.value[2].toFixed(3)}`;
          }
          return `${xStr}<br/>${yStr}`;
        },
      },
      xAxis: {
        type: "value",
        name: xSlot ? slotLabel(xSlot) : "X",
        nameTextStyle: { color: textMuted, fontSize: 10 },
        axisLabel: { color: textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: border, opacity: 0.4 } },
      },
      yAxis: {
        type: "value",
        name: ySlot ? slotLabel(ySlot) : "Y",
        nameTextStyle: { color: textMuted, fontSize: 10 },
        axisLabel: { color: textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: border, opacity: 0.4 } },
      },
      grid: { left: 48, right: 16, top: 24, bottom: 32, containLabel: true },
      legend: { show: false },
      series: [
        {
          type: "scatter",
          data: scatterData,
          symbolSize: bubbleMode
            ? undefined
            : typeof config.extras?.symbolSize === "number"
              ? config.extras.symbolSize
              : 5,
          emphasis: { itemStyle: { opacity: 1 } },
        },
      ],
      ...(timeColoring
        ? {
            visualMap: {
              show: true,
              min: tMin,
              max: tMax,
              inRange: { color: ["#3B82F6", "#EF4444"] },
              calculable: false,
              orient: "horizontal" as const,
              bottom: 0,
              left: "center",
              textStyle: { color: textPrimary, fontSize: 10 },
              formatter: (v: unknown) =>
                new Date(v as number).toLocaleTimeString(),
            },
          }
        : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    aligned,
    config,
    xSlot,
    ySlot,
    sizeSlot,
    timeColoring,
    useDensity,
    densityResult,
    densityBins,
    sizeValuesRaw,
    bubbleMode,
    minPx,
    maxPx,
  ]);

  const displayOption = useMemo(
    () => applyEChartsHighlight(option, highlighted),
    [option, highlighted],
  );

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

  if (!xSlot || !ySlot) {
    return (
      <div
        data-chart-ready="true"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        Configure X and Y points
      </div>
    );
  }

  const isLoading = xLoading || yLoading || sizeLoading;

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
        {aligned.length === 0 && !isLoading && (
          <div
            data-chart-ready="true"
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
        {aligned.length > 0 && (
          <EChart option={displayOption} onEvents={onEvents} />
        )}
      </div>
    </ChartLegendLayout>
  );
}
