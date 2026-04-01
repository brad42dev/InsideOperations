// ---------------------------------------------------------------------------
// Chart 35 — State Timeline
// Custom canvas renderer showing discrete equipment states as colored bands
// over a shared time axis. One row per equipment item (point slot with role='item').
// Fetches historian data for each point and paints transitions as colored rects.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ChartConfig, makeSlotLabeler } from "../chart-config-types";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";
import { usePointMeta } from "../../../../shared/hooks/usePointMeta";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

// Default state color palette (value → hex color)
const DEFAULT_STATE_COLORS: Record<string, string> = {
  "0": "#4B5563", // grey — stopped/off
  "1": "#10B981", // green — running
  "2": "#F59E0B", // yellow — standby/idle
  "3": "#EF4444", // red — fault/trip
  "4": "#8B5CF6", // purple — maintenance
};

const DEFAULT_STATE_LABELS: Record<string, string> = {
  "0": "Stopped",
  "1": "Running",
  "2": "Standby",
  "3": "Fault",
  "4": "Maintenance",
};

interface HistoryRow {
  timestamp: string;
  value: number | null;
}

interface Segment {
  startMs: number;
  endMs: number;
  value: string;
}

function buildSegments(rows: HistoryRow[], windowEndMs: number): Segment[] {
  const segments: Segment[] = [];
  const valid = rows
    .filter((r) => r.value !== null)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  for (let i = 0; i < valid.length; i++) {
    const startMs = new Date(valid[i].timestamp).getTime();
    const endMs =
      i + 1 < valid.length
        ? new Date(valid[i + 1].timestamp).getTime()
        : windowEndMs;
    const value = String(Math.round(valid[i].value!));
    segments.push({ startMs, endMs, value });
  }
  return segments;
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

export default function StateTimelineChart({ config }: RendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const slotLabel = makeSlotLabeler(config);

  const itemSlots = config.points.filter((p) => p.role === "item");
  const durationMinutes = config.durationMinutes ?? 60;
  const rowHeight =
    typeof config.extras?.rowHeight === "number" ? config.extras.rowHeight : 28;
  const showCurrentValue = config.extras?.showCurrentValue !== false;

  const stateColors = useMemo(
    () => ({
      ...DEFAULT_STATE_COLORS,
      ...((config.extras?.stateColors as Record<string, string>) ?? {}),
    }),
    [config.extras?.stateColors],
  );
  const stateLabels = useMemo(
    () => ({
      ...DEFAULT_STATE_LABELS,
      ...((config.extras?.stateLabels as Record<string, string>) ?? {}),
    }),
    [config.extras?.stateLabels],
  );

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  // Truncate live timestamps to nearest minute for stable query keys (prevents refetch on every render)
  // Round both ends to the minute so the query key is stable between renders
  const windowEndMs = isHistorical
    ? new Date(timeRange.end).getTime()
    : Math.floor(Date.now() / 60_000) * 60_000;
  const windowStartMs = isHistorical
    ? new Date(timeRange.start).getTime()
    : windowEndMs - durationMinutes * 60_000;

  const end = new Date(windowEndMs).toISOString();
  const start = new Date(windowStartMs).toISOString();

  const pointIds = itemSlots.map((s) => s.pointId);

  // Per-point enum labels from DB (each point can have different label mappings)
  const pointMetaMap = usePointMeta(pointIds);

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ["history-batch", ...pointIds, start, end, "state-timeline"],
    queryFn: () =>
      pointsApi.historyBatch(pointIds, { start, end, limit: 2000 }),
    enabled: pointIds.length > 0,
    refetchInterval: isHistorical ? false : 30_000,
    select: (res) => (res.success ? res.data : []),
  });

  // Build per-row segment lists
  const rowSegments = useMemo(() => {
    if (!historyBatch) return [];
    return itemSlots.map((slot) => {
      const batch = historyBatch.find((r) => r.point_id === slot.pointId);
      const rows: HistoryRow[] = batch?.rows ?? [];
      // Build per-point label map from DB enum_labels (idx → label)
      const meta = pointMetaMap.get(slot.pointId);
      const enumLabels = new Map<number, string>(
        (meta?.enum_labels ?? []).map((e) => [e.idx, e.label]),
      );
      return {
        slotId: slot.slotId,
        pointId: slot.pointId,
        label: slotLabel(slot),
        segments: buildSegments(rows, windowEndMs),
        enumLabels,
        currentValue:
          rows.length > 0
            ? String(Math.round(rows[rows.length - 1].value ?? 0))
            : null,
      };
    });
  }, [historyBatch, itemSlots, windowEndMs, pointMetaMap]);

  const LABEL_WIDTH = 120;
  const AXIS_HEIGHT = 24;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const W = container.clientWidth;
    const H = rowSegments.length * rowHeight + AXIS_HEIGHT;
    canvas.width = W;
    canvas.height = H;
    // Keep CSS height in sync with canvas pixel height to prevent stretching
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const textMuted = resolveToken("--io-text-muted");
    const border = resolveToken("--io-border");
    const textPrimary = resolveToken("--io-text-primary");

    ctx.clearRect(0, 0, W, H);

    const chartLeft = LABEL_WIDTH;
    const chartRight = showCurrentValue ? W - 90 : W - 8;
    const chartWidth = chartRight - chartLeft;
    const windowSpan = windowEndMs - windowStartMs;

    // Draw time axis at bottom
    ctx.fillStyle = textMuted;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    const tickCount = Math.min(8, Math.floor(chartWidth / 70));
    for (let i = 0; i <= tickCount; i++) {
      const frac = i / tickCount;
      const x = chartLeft + frac * chartWidth;
      const ts = windowStartMs + frac * windowSpan;
      const label = new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      ctx.fillStyle = textMuted;
      ctx.fillText(label, x, H - 4);
      ctx.strokeStyle = border;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H - AXIS_HEIGHT);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw rows
    rowSegments.forEach((row, rowIdx) => {
      const y = rowIdx * rowHeight;
      const rowMidY = y + rowHeight / 2;

      // Row label — use slot label (tagname), truncate to fit LABEL_WIDTH
      ctx.fillStyle = textPrimary;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const rowLabel = row.label || row.pointId.slice(-12);
      ctx.fillText(rowLabel, LABEL_WIDTH - 6, rowMidY);

      // Row separator
      ctx.strokeStyle = border;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(LABEL_WIDTH, y + rowHeight);
      ctx.lineTo(chartRight, y + rowHeight);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Segments
      for (const seg of row.segments) {
        const segStartX =
          chartLeft + ((seg.startMs - windowStartMs) / windowSpan) * chartWidth;
        const segEndX =
          chartLeft + ((seg.endMs - windowStartMs) / windowSpan) * chartWidth;
        const clampedStart = Math.max(chartLeft, segStartX);
        const clampedEnd = Math.min(chartRight, segEndX);
        if (clampedEnd <= clampedStart) continue;

        const color = stateColors[seg.value] ?? "#6B7280";
        ctx.fillStyle = color;
        ctx.fillRect(
          clampedStart,
          y + 2,
          clampedEnd - clampedStart,
          rowHeight - 4,
        );

        // Label inside segment if wide enough
        const segWidth = clampedEnd - clampedStart;
        if (segWidth > 40) {
          const segNum = parseInt(seg.value);
          const label =
            row.enumLabels.get(segNum) ?? stateLabels[seg.value] ?? seg.value;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, (clampedStart + clampedEnd) / 2, rowMidY);
        }
      }

      // Current value label on right edge
      if (showCurrentValue && row.currentValue !== null) {
        const curNum = parseInt(row.currentValue);
        const label =
          row.enumLabels.get(curNum) ??
          stateLabels[row.currentValue] ??
          row.currentValue;
        const color = stateColors[row.currentValue] ?? "#6B7280";
        ctx.fillStyle = color;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, chartRight + 6, rowMidY);
      }
    });
    // rowSegments already contains enumLabels per row; no extra dep needed
  }, [
    rowSegments,
    rowHeight,
    stateColors,
    stateLabels,
    showCurrentValue,
    windowStartMs,
    windowEndMs,
  ]);

  if (itemSlots.length === 0) {
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
        Assign equipment items in the Data Points tab
      </div>
    );
  }

  const canvasHeight = itemSlots.length * rowHeight + AXIS_HEIGHT;

  return (
    <div
      ref={containerRef}
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
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: canvasHeight }}
      />
    </div>
  );
}
