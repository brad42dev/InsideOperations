// ---------------------------------------------------------------------------
// Chart 01 — Trend
// Unified time-series line chart. Auto-scrolls in live mode; renders a fixed
// window in historical/playback mode. Supports multiple Y-axes via the
// Scaling tab and a Combined/Stacked layout toggle.
// Supersedes chart02 (Historical Trend) and chart03 (Multi-Axis Trend).
// Saved configs with chartType 2 or 3 are remapped here by ChartRenderer.
//
// Extensions (phase 05a):
//   - Band/envelope: band-high + band-low slots with translucent fill
//   - Deviation mode: renders (value − setpoint) with a zero reference line
// ---------------------------------------------------------------------------

import { useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import ContextMenu from "../../ContextMenu";
import { useTimeSeriesBuffer } from "../hooks/useTimeSeriesBuffer";
import { useHighlight } from "../hooks/useHighlight";
import TimeSeriesChart, { type Series } from "../TimeSeriesChart";
import {
  type ChartConfig,
  type ResolvedSeriesScale,
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

// Step-interpolates: returns the last known non-null value at or before index i.
// Used for setpoint deviation — setpoints change in discrete steps, not linearly.
function lookupLast(data: (number | null)[], i: number): number | null {
  for (let j = i; j >= 0; j--) {
    if (data[j] !== null) return data[j];
  }
  return null;
}

// Produce deviation series: value[i] − setpoint(i), step-interpolating setpoint.
function applyDeviation(
  values: (number | null)[],
  setpoint: (number | null)[],
): (number | null)[] {
  return values.map((v, i) => {
    if (v === null) return null;
    const sp = lookupLast(setpoint, i);
    return sp === null ? null : v - sp;
  });
}

const BAND_FILL = "rgba(96, 165, 250, 0.15)";
const BAND_LINE_COLOR = "rgba(96, 165, 250, 0.5)";
const ZERO_LINE_COLOR = "rgba(160, 160, 160, 0.7)";

export default function Chart01Trend({ config, bufferKey }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const { highlighted, toggle } = useHighlight();
  const durationMinutes = config.durationMinutes ?? 60;

  // ── Slot extraction ───────────────────────────────────────────────────────
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const bandHighSlot =
    config.points.find((p) => p.role === "band-high") ?? null;
  const bandLowSlot = config.points.find((p) => p.role === "band-low") ?? null;
  const setpointSlot = config.points.find((p) => p.role === "setpoint") ?? null;

  // ── Feature flags ─────────────────────────────────────────────────────────
  const showBands = (config.extras?.showBands as boolean | undefined) ?? false;
  const deviationMode =
    (config.extras?.deviationMode as boolean | undefined) ?? false;

  // Band mode requires both band slots bound
  const isBandMode = showBands && bandHighSlot != null && bandLowSlot != null;
  // Deviation mode requires exactly one main series + a setpoint bound
  const isDevMode =
    deviationMode && setpointSlot != null && seriesSlots.length === 1;
  // Warning: deviation requested but multiple series present
  const deviationMultiWarn =
    deviationMode && setpointSlot != null && seriesSlots.length > 1;

  // ── Point IDs for buffer ──────────────────────────────────────────────────
  const seriesPointIds = seriesSlots.map((p) => p.pointId);
  const extraPointIds: string[] = [];
  if (isBandMode) {
    extraPointIds.push(bandHighSlot!.pointId, bandLowSlot!.pointId);
  }
  if (isDevMode) {
    extraPointIds.push(setpointSlot!.pointId);
  }
  const allPointIds = [...seriesPointIds, ...extraPointIds];

  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const { mode: playbackMode } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  // MSI metadata — fetch only for main series points (determines step rendering).
  const { data: msiMap } = useQuery({
    queryKey: ["point-msi-batch", seriesPointIds.join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        seriesPointIds.map((id) => pointsApi.getMeta(id)),
      );
      const map = new Map<string, number | null>();
      results.forEach((r, i) => {
        map.set(
          seriesPointIds[i],
          r.success ? (r.data.minimum_sampling_interval_ms ?? null) : null,
        );
      });
      return map;
    },
    enabled: seriesPointIds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { timestamps, seriesData, isFetching, historicalNowMs } =
    useTimeSeriesBuffer({
      bufferKey,
      pointIds: allPointIds,
      durationMinutes,
      interpolation: config.interpolation ?? "linear",
      bucketSeconds: config.aggregateSize,
      aggregateType: config.aggregateType,
      msiMap,
    });

  // Live: auto-scrolling window; Historical: fixed window from playback range.
  const liveXRangeRef = useRef<{ min: number; max: number }>({
    min: 0,
    max: 0,
  });
  const nowSec = Date.now() / 1000;
  liveXRangeRef.current.min = nowSec - durationMinutes * 60;
  liveXRangeRef.current.max = nowSec;

  const xRange = isHistorical
    ? {
        min: historicalNowMs / 1000 - durationMinutes * 60,
        max: historicalNowMs / 1000,
      }
    : liveXRangeRef.current;

  // ── Series construction ───────────────────────────────────────────────────

  // Main series — apply deviation when active (single-series guard already done above)
  const mainSeries: Series[] = seriesSlots.map((slot, i) => {
    const msi = msiMap?.get(slot.pointId) ?? null;
    const rawData = seriesData.get(slot.pointId) ?? [];
    const data: (number | null)[] = isDevMode
      ? applyDeviation(rawData, seriesData.get(setpointSlot!.pointId) ?? [])
      : rawData;

    return {
      label: slotLabel(slot),
      data,
      color: slot.color ?? autoColor(i),
      strokeWidth: 1.5,
      ...(msi !== null && msi >= 5000 ? { step: true } : {}),
    };
  });

  // Zero reference line — shown in combined view when deviation mode is active
  const zeroLineSeries: Series | null = isDevMode
    ? {
        label: "Zero reference",
        data: timestamps.map(() => 0),
        color: ZERO_LINE_COLOR,
        strokeWidth: 1,
        dash: [4, 4],
      }
    : null;

  // Band series — thin dashed lines at the limit values
  const bandHighSeries: Series | null = isBandMode
    ? {
        label: "Band High",
        data: seriesData.get(bandHighSlot!.pointId) ?? [],
        color: BAND_LINE_COLOR,
        strokeWidth: 0.8,
        dash: [4, 2],
      }
    : null;
  const bandLowSeries: Series | null = isBandMode
    ? {
        label: "Band Low",
        data: seriesData.get(bandLowSlot!.pointId) ?? [],
        color: BAND_LINE_COLOR,
        strokeWidth: 0.8,
        dash: [4, 2],
      }
    : null;

  // Combined view: main series + optional extras (zero line, band lines)
  const combinedSeries: Series[] = [
    ...mainSeries,
    ...(zeroLineSeries ? [zeroLineSeries] : []),
    ...(bandHighSeries ? [bandHighSeries] : []),
    ...(bandLowSeries ? [bandLowSeries] : []),
  ];

  // Band fill config — 1-based uPlot indices.
  // Band series sit after main + zero-line in the combined array.
  const bandOffset = mainSeries.length + (zeroLineSeries ? 1 : 0);
  const bandsConfig =
    isBandMode && bandHighSeries && bandLowSeries
      ? [
          {
            series: [bandOffset + 1, bandOffset + 2] as [number, number],
            fill: BAND_FILL,
          },
        ]
      : undefined;

  // ── Scale resolution ──────────────────────────────────────────────────────
  const mainScales = resolveSeriesScales(
    config.scaling,
    seriesSlots.map((s) => s.slotId),
  );

  // Band series share the first main series' scale so the fill is meaningful.
  // In multiscale, a band on a different scale than its associated series is nonsensical.
  const firstScale: ResolvedSeriesScale = mainScales[0] ?? { scaleKey: "y" };

  const combinedScales: ResolvedSeriesScale[] = [
    ...mainScales,
    ...(zeroLineSeries ? [{ scaleKey: firstScale.scaleKey }] : []),
    ...(bandHighSeries ? [{ scaleKey: firstScale.scaleKey }] : []),
    ...(bandLowSeries ? [{ scaleKey: firstScale.scaleKey }] : []),
  ];

  // ── Legend ────────────────────────────────────────────────────────────────
  // Band and zero-line series are not in the legend — they're visual context, not data.
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
        {seriesPointIds.length > 0 && (
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
            {isDevMode && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--io-accent)",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-accent)",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                Δ Deviation
              </span>
            )}
            {deviationMultiWarn && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--io-text-muted)",
                  padding: "1px 6px",
                }}
              >
                Deviation mode requires a single series
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
        {seriesPointIds.length === 0 && (
          <div
            data-chart-ready="true"
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

        {/* Combined view — all series on shared time axis, with band fill and zero line */}
        {seriesPointIds.length > 0 && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: viewMode === "combined" ? undefined : "none",
            }}
          >
            <TimeSeriesChart
              timestamps={timestamps}
              series={combinedSeries}
              xRange={xRange}
              highlighted={highlighted}
              onSeriesClick={toggle}
              seriesScales={combinedScales}
              bands={bandsConfig}
            />
          </div>
        )}

        {/* Stacked view — one chart per main series; no band/zero-line extras */}
        {seriesPointIds.length > 0 && (
          <div
            style={{
              display: viewMode === "stacked" ? "flex" : "none",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {mainSeries.map((s, i) => (
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
                  seriesScales={mainScales[i] ? [mainScales[i]] : undefined}
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
