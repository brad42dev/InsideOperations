// ---------------------------------------------------------------------------
// Chart 01 — Trend
// Unified time-series line chart. Auto-scrolls in live mode; renders a fixed
// window in historical/playback mode. Supports multiple Y-axes via the
// Scaling tab and a Combined/Stacked layout toggle.
// Supersedes chart02 (Historical Trend) and chart03 (Multi-Axis Trend).
// Saved configs with chartType 2 or 3 are remapped here by ChartRenderer.
// ---------------------------------------------------------------------------

import { useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import ContextMenu from "../../ContextMenu";
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
import { pointsApi } from "../../../../api/points";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type ViewMode = "combined" | "stacked";

export default function Chart01Trend({ config, bufferKey }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const durationMinutes = config.durationMinutes ?? 60;
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((p) => p.pointId);

  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  // Fetch per-point MSI metadata once (cached forever — tag hardware doesn't change).
  // Used to detect slow-update tags (GC analyzers etc.) that need step rendering.
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

  // Live mode: auto-scrolling window anchored to now.
  // Historical mode: fixed window from the playback time range.
  const liveXRangeRef = useRef<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const nowSec = Date.now() / 1000;
  liveXRangeRef.current.min = nowSec - durationMinutes * 60;
  liveXRangeRef.current.max = nowSec;

  const xRange = isHistorical
    ? { min: timeRange.start / 1000, max: timeRange.end / 1000 }
    : liveXRangeRef.current;

  const allSeries: Series[] = seriesSlots.map((slot, i) => {
    const msi = msiMap?.get(slot.pointId) ?? null;
    return {
      label: slotLabel(slot),
      data: seriesData.get(slot.pointId) ?? [],
      color: slot.color ?? autoColor(i),
      strokeWidth: 1.5,
      ...(msi !== null && msi >= 5000 ? { step: true } : {}),
    };
  });

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
        onContextMenu={handleContextMenu}
      >
        {/* Toolbar — only shown when there are series to display */}
        {pointIds.length > 0 && (
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
            {isHistorical && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--io-text-muted)",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                Historical
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                color: "var(--io-text-muted)",
                marginRight: 2,
              }}
            >
              View:
            </span>
            {(["combined", "stacked"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--io-border)",
                  background:
                    viewMode === mode
                      ? "var(--io-accent)"
                      : "var(--io-surface-elevated)",
                  color: viewMode === mode ? "#fff" : "var(--io-text)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {mode}
              </button>
            ))}
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

        {/* Combined view — all series on shared time axis */}
        {pointIds.length > 0 && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: viewMode === "combined" ? undefined : "none",
            }}
          >
            <TimeSeriesChart
              timestamps={timestamps}
              series={allSeries}
              xRange={xRange}
              highlighted={highlighted}
              onSeriesClick={toggle}
              seriesScales={seriesScales}
            />
          </div>
        )}

        {/* Stacked view — one chart per series, each on its own Y scale */}
        {pointIds.length > 0 && (
          <div
            style={{
              display: viewMode === "stacked" ? "flex" : "none",
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
                  xRange={xRange}
                  highlighted={highlighted}
                  onSeriesClick={toggle}
                  seriesScales={seriesScales[i] ? [seriesScales[i]] : undefined}
                />
              </div>
            ))}
          </div>
        )}
        {menuPos && (
          <ContextMenu
            x={menuPos.x}
            y={menuPos.y}
            items={[
              { label: "Toggle Grid Lines", onClick: () => setMenuPos(null) },
              { label: "Reset Zoom", onClick: () => setMenuPos(null) },
            ]}
            onClose={() => setMenuPos(null)}
          />
        )}
      </div>
    </ChartLegendLayout>
  );
}
