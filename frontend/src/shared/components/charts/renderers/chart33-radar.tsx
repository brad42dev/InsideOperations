// ---------------------------------------------------------------------------
// Chart 33 — Radar / Spider Chart
// Points as axes. Fetch latest values. Normalize to 0–100 unless disabled.
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

const MAX_AXES = 10;

export default function RadarChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const seriesSlots = config.points
    .filter((p) => p.role === "series")
    .slice(0, MAX_AXES);
  const pointIds = seriesSlots.map((p) => p.pointId);
  const normalize = config.extras?.normalize !== false;
  const circleShape = config.extras?.shape === "circle";
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));

  const { values } = useWebSocket(pointIds);

  const { data: latestData, isLoading } = useQuery({
    queryKey: ["batch-latest", ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => (res.success ? res.data : []),
  });

  const rawValues = useMemo(() => {
    return seriesSlots.map((slot) => {
      const ws = values.get(slot.pointId);
      const val =
        ws !== undefined
          ? ws.value
          : (latestData?.find((r) => r.point_id === slot.pointId)?.value ?? 0);
      return Math.max(0, val);
    });
  }, [seriesSlots, values, latestData]);

  const { indicators, normalizedValues } = useMemo(() => {
    const maxVal = rawValues.length ? Math.max(...rawValues, 1) : 100;

    const indicators = seriesSlots.map((slot, i) => ({
      name: slotLabel(slot),
      max: normalize ? 100 : Math.max(rawValues[i] * 1.2, 1),
    }));

    const normalizedValues = normalize
      ? rawValues.map((v) => parseFloat(((v / maxVal) * 100).toFixed(2)))
      : rawValues;

    return { indicators, normalizedValues };
  }, [seriesSlots, rawValues, normalize]);

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken("--io-text-muted");
    // When axes are highlighted, dim the overall radar series opacity if no
    // highlighted axis matches the current slot labels.
    const anyHighlighted = highlighted.size > 0;
    const slotLabels = seriesSlots.map((slot) => slotLabel(slot));
    const hasMatchingHighlight =
      anyHighlighted && slotLabels.some((l) => highlighted.has(l));
    const seriesOpacity = anyHighlighted && !hasMatchingHighlight ? 0.15 : 1;

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item" },
      legend: { show: false },
      radar: {
        indicator: indicators,
        shape: circleShape ? "circle" : "polygon",
        axisName: { color: textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: "var(--io-border)", opacity: 0.5 } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: "var(--io-border)" } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: normalizedValues,
              name: "Current",
              symbol: "circle",
              symbolSize: 4,
              lineStyle: {
                color: autoColor(0),
                width: 2,
                opacity: seriesOpacity,
              },
              areaStyle: { color: autoColor(0), opacity: seriesOpacity * 0.15 },
              itemStyle: { color: autoColor(0), opacity: seriesOpacity },
            },
          ],
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, normalizedValues, circleShape, config, highlighted]);

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
        <EChart option={option} onEvents={onEvents} height={300} />
      </div>
    </ChartLegendLayout>
  );
}
