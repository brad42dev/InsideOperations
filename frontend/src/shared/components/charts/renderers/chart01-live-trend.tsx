// ---------------------------------------------------------------------------
// Chart 01 — Live Trend
// Streaming auto-scroll view backed by the shared time-series ring buffer.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useTimeSeriesBuffer } from "../hooks/useTimeSeriesBuffer";
import { useHighlight } from "../hooks/useHighlight";
import TimeSeriesChart, { type Series } from "../TimeSeriesChart";
import { type ChartConfig, autoColor, makeSlotLabeler } from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

export default function Chart01LiveTrend({ config, bufferKey }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const durationMinutes = config.durationMinutes ?? 60;
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);

  const { timestamps, seriesData, isFetching } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes,
    interpolation: config.interpolation ?? "linear",
    bucketSeconds: config.aggregateSize,
    aggregateType: config.aggregateType,
  });

  // xRange is recomputed each render so the chart auto-scrolls forward in time.
  // We use a ref so the same object reference is stable across re-renders — only
  // the values inside change. TimeSeriesChart reads xRange via xRangeRef so it
  // always gets the freshest window without needing a chart rebuild.
  const xRangeRef = useRef<{ min: number; max: number }>({ min: 0, max: 0 });
  const nowSec = Date.now() / 1000;
  xRangeRef.current.min = nowSec - durationMinutes * 60;
  xRangeRef.current.max = nowSec;

  const series: Series[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    data: seriesData.get(slot.pointId) ?? [],
    color: slot.color ?? autoColor(i),
    strokeWidth: 1.5,
  }));

  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    color: slot.color ?? autoColor(i),
  }));

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
            <TimeSeriesChart
              timestamps={timestamps}
              series={series}
              xRange={xRangeRef.current}
              highlighted={highlighted}
              onSeriesClick={toggle}
            />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  );
}
