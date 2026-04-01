// ---------------------------------------------------------------------------
// Chart 03 — Multi-Axis Trend
// Combined view: all series in one chart.
// Stacked view: one TimeSeriesChart per series, each with flex:1 height.
// A toggle button switches between the two layouts.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
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

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type ViewMode = "combined" | "stacked";

export default function Chart03MultiAxisTrend({
  config,
  bufferKey,
}: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const durationMinutes = config.durationMinutes ?? 60;
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);

  const [viewMode, setViewMode] = useState<ViewMode>("combined");

  const { timestamps, seriesData, isFetching } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes,
    interpolation: config.interpolation ?? "linear",
    bucketSeconds: config.aggregateSize,
    aggregateType: config.aggregateType,
  });

  const xRangeRef = useRef<{ min: number; max: number }>({ min: 0, max: 0 });
  const nowSec = Date.now() / 1000;
  xRangeRef.current.min = nowSec - durationMinutes * 60;
  xRangeRef.current.max = nowSec;

  const allSeries: Series[] = seriesSlots.map((slot, i) => ({
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
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              marginRight: 4,
            }}
          >
            View:
          </span>
          <button
            onClick={() => setViewMode("combined")}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid var(--io-border)",
              background:
                viewMode === "combined"
                  ? "var(--io-accent)"
                  : "var(--io-surface-elevated)",
              color: viewMode === "combined" ? "#fff" : "var(--io-text)",
              cursor: "pointer",
            }}
          >
            Combined
          </button>
          <button
            onClick={() => setViewMode("stacked")}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid var(--io-border)",
              background:
                viewMode === "stacked"
                  ? "var(--io-accent)"
                  : "var(--io-surface-elevated)",
              color: viewMode === "stacked" ? "#fff" : "var(--io-text)",
              cursor: "pointer",
            }}
          >
            Stacked
          </button>

          {isFetching && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "var(--io-text-muted)",
              }}
            >
              Loading…
            </span>
          )}
        </div>

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

        {/* Combined view */}
        {pointIds.length > 0 && viewMode === "combined" && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <TimeSeriesChart
              timestamps={timestamps}
              series={allSeries}
              xRange={xRangeRef.current}
              highlighted={highlighted}
              onSeriesClick={toggle}
              seriesScales={seriesScales}
            />
          </div>
        )}

        {/* Stacked view — one chart per series (each series on its own scale) */}
        {pointIds.length > 0 && viewMode === "stacked" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {allSeries.map((s, i) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  minHeight: 0,
                  borderBottom: "1px solid var(--io-border)",
                  position: "relative",
                }}
              >
                {/* Series label overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    left: 8,
                    fontSize: 10,
                    color: s.color ?? "#4A9EFF",
                    zIndex: 5,
                    pointerEvents: "none",
                    fontWeight: 600,
                    background: "var(--io-surface)",
                    padding: "1px 4px",
                    borderRadius: 3,
                    border: "1px solid var(--io-border)",
                  }}
                >
                  {s.label}
                </div>
                <TimeSeriesChart
                  timestamps={timestamps}
                  series={[s]}
                  xRange={xRangeRef.current}
                  highlighted={highlighted}
                  onSeriesClick={toggle}
                  seriesScales={seriesScales[i] ? [seriesScales[i]] : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartLegendLayout>
  );
}
