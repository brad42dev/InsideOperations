// ---------------------------------------------------------------------------
// Chart 22 — Stacked Area
// Uses ECharts with areaStyle + optional stack mode.
// When scaling.type === 'fixed', stacks series absolutely (stack: 'total').
// Otherwise renders as overlapping filled areas.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import EChart from "../EChart";
import { useTimeSeriesBuffer } from "../hooks/useTimeSeriesBuffer";
import {
  type ChartConfig,
  autoColor,
  makeSlotLabeler,
} from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import type { EChartsOption } from "echarts";
import { useHighlight } from "../hooks/useHighlight";
import {
  applyEChartsHighlight,
  getEChartsClickKey,
  getEChartsClickMulti,
} from "../chart-highlight-utils";
import { pointsApi } from "../../../../api/points";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

// Hex or named color → rgba string with given alpha
function withAlpha(color: string, alpha: number): string {
  // ECharts accepts rgba() directly.
  // Attempt a basic hex parse; fall back to the color string with opacity.
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // For non-hex colors just return with the original value — ECharts handles named colors
  return color;
}

export default function Chart22StackedArea({
  config,
  bufferKey,
}: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const durationMinutes = config.durationMinutes ?? 60;
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const { highlighted, toggle } = useHighlight();
  const pointIds = seriesSlots.map((p) => p.pointId);

  const { data: msiMap } = useQuery({
    queryKey: ["point-msi-batch", pointIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        pointIds.map((id) => pointsApi.getMeta(id)),
      );
      const map = new Map<string, number | null>();
      results.forEach((r, i) => {
        map.set(
          pointIds[i],
          r.success ? (r.data.minimum_sampling_interval_ms ?? null) : null,
        );
      });
      return map;
    },
    enabled: pointIds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { timestamps, seriesData, isFetching } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes,
    interpolation: config.interpolation ?? "linear",
    bucketSeconds: config.aggregateSize,
    aggregateType: config.aggregateType,
    msiMap,
  });

  const useStack = (config.extras?.stacked as boolean) ?? true; // default stacked; toggle via Options
  const showGrid = config.extras?.showGrid !== false;
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));

  const option: EChartsOption = useMemo(() => {
    // Convert timestamps (Unix seconds) to ECharts format (ms)
    const xData = timestamps.map((ts) => ts * 1000);

    const echartsSeries: EChartsOption["series"] = seriesSlots.map(
      (slot, i) => {
        const color = slot.color ?? autoColor(i);
        const data = seriesData.get(slot.pointId) ?? [];
        const msi = msiMap?.get(slot.pointId) ?? null;
        const isSlowUpdate = msi !== null && msi >= 5000;
        // Slow-update tags (GC analyzers etc.) are forward-filled by the buffer
        // hook and rendered as step/hold-last-value; other series follow the
        // chart-level interpolation setting.
        const stepMode = isSlowUpdate
          ? "end"
          : config.interpolation === "step"
            ? "end"
            : false;
        return {
          name: slotLabel(slot),
          type: "line",
          data: xData.map((ts, idx) => [ts, data[idx] ?? null]),
          smooth: !isSlowUpdate && config.interpolation !== "step",
          step: stepMode,
          symbol: "none",
          lineStyle: { color, width: 1.5 },
          itemStyle: { color },
          areaStyle: {
            color: withAlpha(color, 0.3),
            opacity: 1,
          },
          ...(useStack ? { stack: "total" } : {}),
          connectNulls: false,
        };
      },
    );

    const nowMs = Date.now();
    const minMs = nowMs - durationMinutes * 60 * 1000;

    return {
      animation: false,
      grid: {
        left: 8,
        right: 12,
        top: 12,
        bottom: 28,
        containLabel: true,
      },
      legend: { show: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line" },
        formatter: (params: unknown) => {
          const items = params as Array<{
            seriesName: string;
            value: [number, number | null];
            color: string;
            marker: string;
          }>;
          if (!items?.length) return "";
          const ts = items[0].value[0];
          const d = new Date(ts);
          const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
          const rows = items
            .map((it) => {
              const v = it.value[1];
              const display = v === null ? "—" : v.toFixed(2);
              return `${it.marker}${it.seriesName}: <b>${display}</b>`;
            })
            .join("<br/>");
          return `${timeStr}<br/>${rows}`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "var(--io-text-muted)" } },
        axisTick: { lineStyle: { color: "var(--io-border)" } },
        axisLabel: {
          fontSize: 10,
          // Use ECharts built-in time-level formatter (not a function) so it
          // survives JSON serialisation in the EChart equality guard.
          formatter: {
            hour: "{HH}:{mm}",
            minute: "{HH}:{mm}",
            second: "{HH}:{mm}:{ss}",
            day: "{MM}/{dd}",
            month: "{yyyy}/{MM}",
            year: "{yyyy}",
          } as unknown as string,
        },
        splitLine: {
          show: showGrid,
          lineStyle: { type: "dashed", opacity: 0.3 },
        },
        min: minMs,
        max: nowMs,
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10 },
        splitLine: {
          show: showGrid,
          lineStyle: { type: "dashed", opacity: 0.3 },
        },
        ...(config.scaling?.type === "fixed" &&
        config.scaling.yMin !== undefined
          ? { min: config.scaling.yMin }
          : {}),
        ...(config.scaling?.type === "fixed" &&
        config.scaling.yMax !== undefined
          ? { max: config.scaling.yMax }
          : {}),
      },
      series: echartsSeries,
    };
  }, [
    timestamps,
    seriesData,
    seriesSlots,
    config,
    useStack,
    showGrid,
    durationMinutes,
    msiMap,
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

  return (
    <ChartLegendLayout
      legend={config.legend}
      items={legendItems}
      highlighted={highlighted}
      onHighlight={toggle}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {/* Loading indicator */}
        {isFetching && (
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

        {/* Empty state */}
        {pointIds.length === 0 && (
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
        )}

        {pointIds.length > 0 && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <EChart option={displayOption} onEvents={onEvents} />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  );
}
