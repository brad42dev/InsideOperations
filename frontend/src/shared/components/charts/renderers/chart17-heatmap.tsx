// ---------------------------------------------------------------------------
// Chart 17 — Heatmap
// Matrix mode: aggregates a single point's history by hour-of-day × day-of-week.
// Calendar mode: ECharts native calendar coordinate — rows=weeks, cols=day-of-week,
// each cell = one calendar day colored by its aggregate value.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig } from "../chart-config-types";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from(
  { length: 24 },
  (_, i) => `${i.toString().padStart(2, "0")}:00`,
);

export default function HeatmapChart({ config }: RendererProps) {
  const valueSlot = config.points.find((p) => p.role === "value");
  const durationMinutes = config.durationMinutes ?? 60 * 24 * 7; // default 7 days
  const calendarMode = config.extras?.calendarMode === true;
  const calendarYear =
    typeof config.extras?.calendarYear === "number"
      ? config.extras.calendarYear
      : new Date().getFullYear();

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const end = isHistorical
    ? new Date(timeRange.end).toISOString()
    : new Date().toISOString();
  const start = isHistorical
    ? new Date(timeRange.start).toISOString()
    : calendarMode
      ? // For calendar mode, fetch the entire configured year
        new Date(`${calendarYear}-01-01T00:00:00Z`).toISOString()
      : new Date(Date.now() - durationMinutes * 60 * 1000).toISOString();

  // Use full year end for calendar mode
  const queryEnd =
    calendarMode && !isHistorical
      ? new Date(`${calendarYear}-12-31T23:59:59Z`).toISOString()
      : end;

  const { data: rows, isLoading } = useQuery({
    queryKey: [
      "history",
      valueSlot?.pointId,
      start,
      queryEnd,
      "heatmap",
      calendarMode,
      calendarYear,
    ],
    queryFn: () =>
      pointsApi.history(valueSlot!.pointId, {
        start,
        end: queryEnd,
        limit: 50000,
      }),
    enabled: !!valueSlot,
    select: (res) => (res.success ? res.data.rows : []),
  });

  // Matrix mode: hour-of-day × day-of-week aggregation
  const heatData = useMemo(() => {
    if (calendarMode || !rows?.length) return [];
    const grid: { sum: number; count: number }[][] = Array.from(
      { length: 7 },
      () => Array.from({ length: 24 }, () => ({ sum: 0, count: 0 })),
    );
    for (const row of rows) {
      if (row.value === null || row.value === undefined) continue;
      const d = new Date(row.timestamp);
      const day = d.getDay();
      const hour = d.getHours();
      grid[day][hour].sum += row.value;
      grid[day][hour].count++;
    }
    const result: [number, number, number][] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const cell = grid[day][hour];
        const val = cell.count > 0 ? cell.sum / cell.count : 0;
        result.push([hour, day, parseFloat(val.toFixed(4))]);
      }
    }
    return result;
  }, [rows, calendarMode]);

  // Calendar mode: one cell per calendar day
  const calendarData = useMemo(() => {
    if (!calendarMode || !rows?.length) return [];
    const dayMap = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      if (row.value === null || row.value === undefined) continue;
      const d = new Date(row.timestamp);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const prev = dayMap.get(key) ?? { sum: 0, count: 0 };
      prev.sum += row.value;
      prev.count++;
      dayMap.set(key, prev);
    }
    return Array.from(dayMap.entries()).map(
      ([date, { sum, count }]) =>
        [date, parseFloat((sum / count).toFixed(4))] as [string, number],
    );
  }, [rows, calendarMode]);

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    const textPrimary = resolveToken("--io-text-primary");
    const border = resolveToken("--io-border");

    if (calendarMode) {
      const vals = calendarData.map((d) => d[1] as number);
      const minVal = vals.length ? Math.min(...vals) : 0;
      const maxVal = vals.length ? Math.max(...vals) : 1;

      return {
        backgroundColor: "transparent",
        tooltip: {
          position: "top",
          formatter: (params: unknown) => {
            const p = params as { data: [string, number] };
            return `${p.data[0]}: ${(p.data[1] as number).toFixed(3)}`;
          },
        },
        // ECharts calendar coordinate
        calendar: {
          top: 40,
          left: 60,
          right: 20,
          bottom: 20,
          cellSize: ["auto", "auto"],
          range: String(calendarYear),
          itemStyle: { borderWidth: 0.5, borderColor: border },
          yearLabel: {
            show: true,
            textStyle: { color: textMuted, fontSize: 12 },
          },
          dayLabel: {
            firstDay: 0,
            nameMap: ["S", "M", "T", "W", "T", "F", "S"],
            textStyle: { color: textMuted, fontSize: 10 },
          },
          monthLabel: { textStyle: { color: textMuted, fontSize: 10 } },
        },
        visualMap: {
          min: minVal,
          max: maxVal,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          inRange: { color: ["#1E3A5F", "#3B82F6", "#FBBF24", "#EF4444"] },
          textStyle: { color: textPrimary, fontSize: 10 },
        },
        series: [
          {
            type: "heatmap",
            coordinateSystem: "calendar",
            data: calendarData,
            label: { show: false },
            emphasis: {
              itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.4)" },
            },
          },
        ],
      } as EChartsOption;
    }

    // Matrix mode
    const vals = heatData.map((d) => d[2]);
    const minVal = vals.length ? Math.min(...vals) : 0;
    const maxVal = vals.length ? Math.max(...vals) : 1;

    return {
      backgroundColor: "transparent",
      tooltip: {
        position: "top",
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number] };
          return `${DAYS[p.value[1]]} ${HOURS[p.value[0]]}: ${p.value[2].toFixed(3)}`;
        },
      },
      grid: { left: 60, right: 16, top: 16, bottom: 60, containLabel: false },
      xAxis: {
        type: "category",
        data: HOURS,
        splitArea: { show: true },
        axisLabel: { color: textMuted, fontSize: 9, rotate: 45, interval: 1 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        data: DAYS,
        splitArea: { show: true },
        axisLabel: { color: textMuted, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: minVal,
        max: maxVal,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: ["#3B82F6", "#FBBF24", "#EF4444"] },
        textStyle: { color: textPrimary, fontSize: 10 },
      },
      series: [
        {
          type: "heatmap",
          data: heatData,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.4)" },
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatData, calendarData, calendarMode, calendarYear]);

  if (!valueSlot) {
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

  const displayData = calendarMode ? calendarData : heatData;

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
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
      {!isLoading && displayData.length === 0 && (
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
      {displayData.length > 0 && (
        <EChart option={option} height={calendarMode ? 200 : 300} />
      )}
    </div>
  );
}
