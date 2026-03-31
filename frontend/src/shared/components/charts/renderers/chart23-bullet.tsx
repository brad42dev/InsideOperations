// ---------------------------------------------------------------------------
// Chart 23 — Bullet Chart
// Single point live value shown as a horizontal bar with background ranges
// and an optional target marker line.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig } from "../chart-config-types";
import { useWebSocket } from "../../../hooks/useWebSocket";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

interface RangeZone {
  value: number;
  color: string;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

const DEFAULT_RANGES: RangeZone[] = [
  { value: 40, color: "#EF4444" },
  { value: 70, color: "#F59E0B" },
  { value: 100, color: "#10B981" },
];

export default function BulletChart({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === "point");
  const pointIds = pointSlot ? [pointSlot.pointId] : [];

  const rawRanges = config.extras?.ranges;
  const ranges: RangeZone[] = Array.isArray(rawRanges)
    ? (rawRanges as RangeZone[])
    : DEFAULT_RANGES;
  const target =
    typeof config.extras?.target === "number" ? config.extras.target : null;
  const vertical = config.extras?.orientation === "vertical";

  const { values } = useWebSocket(pointIds);
  const liveValue = pointSlot ? (values.get(pointSlot.pointId)?.value ?? 0) : 0;

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    const border = resolveToken("--io-border");

    // Sort ranges ascending
    const sorted = [...ranges].sort((a, b) => a.value - b.value);
    const maxRange = sorted[sorted.length - 1]?.value ?? 100;

    // Build stacked background bands using transparent base + colored bars
    // Each band spans from previous range to current range value
    let prev = 0;
    const bandBases: number[] = [];
    const bandWidths: number[] = [];
    const bandColors: string[] = [];
    for (const zone of sorted) {
      bandBases.push(prev);
      bandWidths.push(zone.value - prev);
      bandColors.push(zone.color);
      prev = zone.value;
    }

    // Data point format: horizontal=[value, categoryIdx], vertical=[categoryIdx, value]
    const pt = (v: number) => (vertical ? [0, v] : [v, 0]);

    const series: EChartsOption["series"] = [
      // Background range bands (stacked)
      ...bandBases.map((base) => ({
        type: "bar" as const,
        stack: "range",
        silent: true,
        barWidth: 20,
        data: [pt(base)],
        itemStyle: { color: "transparent" },
      })),
      ...bandWidths.map((width, i) => ({
        type: "bar" as const,
        stack: "range",
        silent: true,
        barWidth: 20,
        data: [pt(width)],
        itemStyle: { color: bandColors[i], opacity: 0.3 },
      })),
      // Actual value bar
      {
        type: "bar" as const,
        stack: "actual",
        barWidth: 8,
        data: [pt(liveValue)],
        itemStyle: { color: "#4A9EFF" },
        label: {
          show: true,
          position: vertical ? "top" : "right",
          fontSize: 12,
          color: textMuted,
          formatter: () => liveValue.toFixed(2),
        },
        z: 10,
      },
    ];

    if (target !== null) {
      (series as unknown[]).push({
        type: "scatter",
        data: [pt(target)],
        symbol: "line",
        symbolSize: vertical ? [20, 2] : [2, 20],
        itemStyle: { color: "#EF4444" },
        z: 20,
      });
    }

    const valueAxis = {
      type: "value" as const,
      min: 0,
      max: maxRange,
      axisLabel: { color: textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: border, opacity: 0.4 } },
    };
    const categoryAxis = {
      type: "category" as const,
      data: [pointSlot?.pointId ?? "Value"],
      axisLabel: { color: textMuted, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    };

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "none" },
        formatter: () =>
          `${pointSlot?.pointId ?? "Value"}: ${liveValue.toFixed(3)}${target !== null ? `<br/>Target: ${target}` : ""}`,
      },
      grid: vertical
        ? { left: 40, right: 16, top: 16, bottom: 60, containLabel: true }
        : { left: 16, right: 60, top: 40, bottom: 40, containLabel: true },
      xAxis: vertical ? categoryAxis : valueAxis,
      yAxis: vertical ? valueAxis : categoryAxis,
      series,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValue, ranges, target, pointSlot, vertical]);

  if (!pointSlot) {
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
        No point configured
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
      <EChart option={option} />
    </div>
  );
}
