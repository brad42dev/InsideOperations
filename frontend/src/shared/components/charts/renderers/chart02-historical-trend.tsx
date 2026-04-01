// ---------------------------------------------------------------------------
// Chart 02 — Historical Trend
// In live mode: behaves identically to chart01 (auto-scrolling live buffer).
// In historical mode: fetches via pointsApi.history over the playback timeRange
// and renders a fixed-window view.
// ---------------------------------------------------------------------------

import { useRef } from "react";
import { useTimeSeriesBuffer } from "../hooks/useTimeSeriesBuffer";
import { useHighlight } from "../hooks/useHighlight";
import TimeSeriesChart, { type Series } from "../TimeSeriesChart";
import {
  type ChartConfig,
  autoColor,
  makeSlotLabeler,
  resolveSeriesScales,
} from "../chart-config-types";
import { ChartLegendLayout, type LegendItem } from "../ChartLegend";
import { usePlaybackStore } from "../../../../store/playback";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

export default function Chart02HistoricalTrend({
  config,
  bufferKey,
}: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const durationMinutes = config.durationMinutes ?? 60;
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const { timestamps, seriesData, isFetching } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes,
    interpolation: config.interpolation ?? "linear",
    bucketSeconds: config.aggregateSize,
    aggregateType: config.aggregateType,
  });

  // For live mode: auto-scrolling window anchored to now.
  // For historical mode: fixed window from playback timeRange.
  const liveXRangeRef = useRef<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const nowSec = Date.now() / 1000;
  liveXRangeRef.current.min = nowSec - durationMinutes * 60;
  liveXRangeRef.current.max = nowSec;

  const historicalXRange = isHistorical
    ? { min: timeRange.start / 1000, max: timeRange.end / 1000 }
    : null;

  const xRange = historicalXRange ?? liveXRangeRef.current;

  const series: Series[] = seriesSlots.map((slot, i) => ({
    label: slotLabel(slot),
    data: seriesData.get(slot.pointId) ?? [],
    color: slot.color ?? autoColor(i),
    strokeWidth: 1.5,
  }));

  const seriesScales = resolveSeriesScales(
    config.scaling,
    seriesSlots.map((s) => s.slotId),
  );

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
        {/* Mode badge */}
        {isHistorical && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 8,
              fontSize: 10,
              color: "var(--io-text-muted)",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              padding: "1px 6px",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            Historical
          </div>
        )}

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
              xRange={xRange}
              highlighted={highlighted}
              onSeriesClick={toggle}
              seriesScales={seriesScales}
            />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  );
}
