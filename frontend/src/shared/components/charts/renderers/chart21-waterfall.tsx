// ---------------------------------------------------------------------------
// Chart 21 — Waterfall Chart
// Points become ordered steps. Transparent base bar + colored value bar stacked.
// Supports horizontal orientation.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EChartsOption } from "echarts";
import EChart from "../EChart";
import { type ChartConfig, autoColor, makeSlotLabeler } from "../chart-config-types";
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

export default function WaterfallChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));
  const pointIds = seriesSlots.map((p) => p.pointId);

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
  const horizontal = config.extras?.orientation === "horizontal";

  const increaseColor =
    typeof config.extras?.increaseColor === "string"
      ? config.extras.increaseColor
      : typeof config.extras?.positiveColor === "string"
        ? config.extras.positiveColor
        : "#10B981";
  const decreaseColor =
    typeof config.extras?.decreaseColor === "string"
      ? config.extras.decreaseColor
      : typeof config.extras?.negativeColor === "string"
        ? config.extras.negativeColor
        : "#EF4444";
  const totalColor = "#4A9EFF";

  const { values } = useWebSocket(pointIds);

  const { data: latestData, isLoading } = useQuery({
    queryKey: ["batch-latest", ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => (res.success ? res.data : []),
  });

  const { names, baseData, valueData, totalValue } = useMemo(() => {
    const rawValues = seriesSlots.map((slot) => {
      const ws = values.get(slot.pointId);
      const val =
        ws !== undefined
          ? ws.value
          : (latestData?.find((r) => r.point_id === slot.pointId)?.value ?? 0);
      return val;
    });

    const names = seriesSlots.map((s) => slotLabel(s));
    const allNames = [...names, "Total"];

    let running = 0;
    const baseData: number[] = [];
    const valueData: {
      value: number;
      itemStyle: { color: string; opacity?: number };
    }[] = [];

    rawValues.forEach((v, i) => {
      const itemName = names[i];
      baseData.push(v >= 0 ? running : running + v);
      valueData.push({
        value: Math.abs(v),
        itemStyle: {
          color: v >= 0 ? increaseColor : decreaseColor,
          ...(highlighted.size > 0
            ? { opacity: highlighted.has(itemName) ? 1 : 0.15 }
            : {}),
        },
      });
      running += v;
    });

    // Final total bar — starts at 0
    baseData.push(0);
    valueData.push({
      value: running,
      itemStyle: {
        color: totalColor,
        ...(highlighted.size > 0
          ? { opacity: highlighted.has("Total") ? 1 : 0.15 }
          : {}),
      },
    });

    return { names: allNames, baseData, valueData, totalValue: running };
  }, [
    seriesSlots,
    values,
    latestData,
    increaseColor,
    decreaseColor,
    highlighted,
  ]);

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    const border = resolveToken("--io-border");

    const categoryAxis = {
      type: "category" as const,
      data: names,
      axisLabel: { color: textMuted, fontSize: 11 },
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
    };

    const valueAxis = {
      type: "value" as const,
      axisLabel: { color: textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: border, opacity: 0.4 } },
    };

    const tooltipFormatter = (params: unknown) => {
      const arr = params as {
        name: string;
        value: number;
        seriesIndex: number;
      }[];
      const valueBar = arr.find((p) => p.seriesIndex === 1);
      if (!valueBar) return "";
      return `${valueBar.name}: ${valueBar.value.toFixed(3)}`;
    };

    return {
      backgroundColor: "transparent",
      legend: { show: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: tooltipFormatter,
      },
      grid: { left: 48, right: 16, top: 12, bottom: 32, containLabel: true },
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: [
        {
          type: "bar",
          stack: "waterfall",
          silent: true,
          itemStyle: { color: "transparent", borderColor: "transparent" },
          data: baseData,
        },
        {
          type: "bar",
          stack: "waterfall",
          data: valueData,
          barMaxWidth: 48,
          label: {
            show: true,
            position: horizontal ? ("right" as const) : ("top" as const),
            fontSize: 10,
            color: textMuted,
            formatter: (params: unknown) => {
              const p = params as { value: number };
              return p.value.toFixed(2);
            },
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, baseData, valueData, totalValue, horizontal]);

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
