// ---------------------------------------------------------------------------
// Chart 32 — Funnel Chart
// Points as stages sorted descending. Optional conversion % labels.
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

export default function FunnelChart({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);
  const showConversion = config.extras?.showConversion === true;
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

  const { values } = useWebSocket(pointIds);

  const { data: latestData, isLoading } = useQuery({
    queryKey: ["batch-latest", ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => (res.success ? res.data : []),
  });

  const sorted = useMemo(() => {
    return seriesSlots
      .map((slot, i) => {
        const ws = values.get(slot.pointId);
        const val =
          ws !== undefined
            ? ws.value
            : (latestData?.find((r) => r.point_id === slot.pointId)?.value ??
              0);
        return {
          name: slotLabel(slot),
          value: Math.max(0, val),
          color: slot.color ?? autoColor(i),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [seriesSlots, values, latestData]);

  const option: EChartsOption = useMemo(() => {
    const funnelData = sorted.map((d) => ({
      name: d.name,
      value: d.value,
      itemStyle: {
        color: d.color,
        ...(highlighted.size > 0
          ? { opacity: highlighted.has(d.name) ? 1 : 0.15 }
          : {}),
      },
      label: {
        show: true,
        formatter: showConversion
          ? (params: unknown) => {
              const p = params as {
                name: string;
                value: number;
                dataIndex: number;
              };
              if (p.dataIndex === 0 || sorted[0].value === 0)
                return `${p.name}`;
              const pct = ((p.value / sorted[0].value) * 100).toFixed(1);
              return `${p.name}\n${pct}%`;
            }
          : "{b}: {c}",
      },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: { show: false },
      series: [
        {
          type: "funnel",
          data: funnelData,
          sort: "none",
          orient:
            config.extras?.orientation === "horizontal"
              ? "horizontal"
              : "vertical",
          left: "10%",
          right: "10%",
          top: "5%",
          bottom: "5%",
          gap: 2,
          label: {
            show: true,
            position: "inside",
            color: "#fff",
            fontSize: 11,
          },
          emphasis: { label: { fontSize: 13 } },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, showConversion, config, highlighted]);

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
