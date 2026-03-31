// ---------------------------------------------------------------------------
// Chart 14 — Event Timeline
// Shows time bands for state-change events derived from historical data.
// Each series point = one row (24px high). Time axis at bottom.
// Active (value > 0) = colored band; inactive = gray.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../../../../api/points";
import { type ChartConfig, autoColor } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

interface Segment {
  startMs: number;
  endMs: number;
  active: boolean;
}

const ROW_H = 24;
const TIME_AXIS_H = 28;
const LEFT_PAD = 80;

function deriveSegments(
  rows: { timestamp: string; value: number | null }[],
): Segment[] {
  if (rows.length === 0) return [];
  const segments: Segment[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const val = rows[i].value;
    segments.push({
      startMs: new Date(rows[i].timestamp).getTime(),
      endMs: new Date(rows[i + 1].timestamp).getTime(),
      active: val !== null && val > 0,
    });
  }
  // Last row — extend 1 minute forward
  const last = rows[rows.length - 1];
  segments.push({
    startMs: new Date(last.timestamp).getTime(),
    endMs: new Date(last.timestamp).getTime() + 60_000,
    active: last.value !== null && last.value > 0,
  });
  return segments;
}

function formatAxisTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Chart14EventTimeline({ config }: RendererProps) {
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((s) => s.pointId);
  const durationMinutes = config.durationMinutes ?? 60;

  const nowMs = Date.now();
  const startMs =
    Math.floor((nowMs - durationMinutes * 60_000) / 60_000) * 60_000; // truncated to minute for stable query key
  const startISO = new Date(startMs).toISOString();
  const endISO = new Date(nowMs).toISOString();

  const { data: histData, isFetching } = useQuery({
    queryKey: ["chart14-timeline", pointIds.join(","), startISO],
    queryFn: async () => {
      if (pointIds.length === 0) return [];
      const results = await Promise.all(
        pointIds.map((id) =>
          pointsApi.history(id, {
            start: startISO,
            end: endISO,
            resolution: "auto",
            limit: 2000,
          }),
        ),
      );
      return results.map((r, i) => ({
        pointId: pointIds[i],
        rows:
          r.success && r.data?.rows
            ? r.data.rows.map((row) => ({
                timestamp: row.timestamp,
                value: row.value ?? row.avg ?? null,
              }))
            : [],
      }));
    },
    enabled: pointIds.length > 0,
    staleTime: 30_000,
  });

  const rowData = useMemo(() => {
    if (!histData) return [];
    return histData.map((d, i) => ({
      pointId: d.pointId,
      color: seriesSlots[i]?.color ?? autoColor(i),
      label: seriesSlots[i]?.pointId ?? d.pointId,
      segments: deriveSegments(d.rows),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histData]);

  if (seriesSlots.length === 0) {
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

  const svgH = seriesSlots.length * ROW_H + TIME_AXIS_H;
  const timeSpanMs = nowMs - startMs;

  function msToX(ms: number, totalW: number): number {
    return LEFT_PAD + ((ms - startMs) / timeSpanMs) * (totalW - LEFT_PAD);
  }

  // Build 5 time axis ticks
  const ticks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    ticks.push(startMs + (i / 4) * timeSpanMs);
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        position: "relative",
      }}
    >
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
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 600 ${svgH}`}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        {/* Rows */}
        {rowData.map((row, ri) => {
          const rowY = ri * ROW_H;
          return (
            <g key={row.pointId}>
              {/* Row label */}
              <text
                x={LEFT_PAD - 4}
                y={rowY + ROW_H / 2 + 4}
                textAnchor="end"
                fontSize={9}
                fill="var(--io-text-muted)"
              >
                {row.label.length > 10
                  ? row.label.slice(0, 10) + "…"
                  : row.label}
              </text>

              {/* Row segments */}
              {row.segments.map((seg, si) => {
                const x1 = msToX(seg.startMs, 600);
                const x2 = msToX(seg.endMs, 600);
                const segW = Math.max(0, x2 - x1);
                return (
                  <rect
                    key={si}
                    x={x1}
                    y={rowY + 3}
                    width={segW}
                    height={ROW_H - 6}
                    fill={seg.active ? row.color : "var(--io-border)"}
                    rx={1}
                    opacity={seg.active ? 0.85 : 0.4}
                  />
                );
              })}

              {/* Row separator */}
              <line
                x1={LEFT_PAD}
                y1={rowY + ROW_H}
                x2={600}
                y2={rowY + ROW_H}
                stroke="var(--io-border)"
                strokeWidth={0.5}
              />
            </g>
          );
        })}

        {/* Time axis */}
        <g transform={`translate(0, ${seriesSlots.length * ROW_H})`}>
          <line
            x1={LEFT_PAD}
            y1={0}
            x2={600}
            y2={0}
            stroke="var(--io-border)"
            strokeWidth={1}
          />
          {ticks.map((ts) => {
            const x = msToX(ts, 600);
            return (
              <g key={ts}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={6}
                  stroke="var(--io-border)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={18}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--io-text-muted)"
                >
                  {formatAxisTime(ts)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
