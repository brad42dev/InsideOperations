// ---------------------------------------------------------------------------
// Chart 36 — Scorecard Table / Event Condition Statistics Table
// Mode 1 (scorecard): rows = time periods, columns = KPI points.
//   Cells colored green/yellow/red by per-column hi/lo thresholds from extras.
// Mode 2 (event_stats): rows = individual alarm/event occurrences (future).
//   Currently renders a placeholder for the event stats query.
// Aggregate functions: mean (default), last, min, max, sum, count.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type ChartConfig } from "../chart-config-types";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type AggFn = "mean" | "last" | "min" | "max" | "sum" | "count";

function aggregate(vals: number[], fn: AggFn): number | null {
  if (vals.length === 0) return null;
  switch (fn) {
    case "mean":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "last":
      return vals[vals.length - 1];
    case "min":
      return Math.min(...vals);
    case "max":
      return Math.max(...vals);
    case "sum":
      return vals.reduce((a, b) => a + b, 0);
    case "count":
      return vals.length;
  }
}

function formatValue(v: number | null, decimals = 2): string {
  if (v === null) return "—";
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + "k";
  return v.toFixed(decimals);
}

// Period bucket size in milliseconds
const PERIOD_MS: Record<string, number> = {
  hour: 60 * 60 * 1000,
  shift: 8 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

function periodLabel(startMs: number, bucketMs: number): string {
  const d = new Date(startMs);
  if (bucketMs <= 60 * 60 * 1000) {
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (bucketMs <= 8 * 60 * 60 * 1000) {
    const shift =
      d.getHours() < 8 ? "Night" : d.getHours() < 16 ? "Day" : "Eve";
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${shift}`;
  }
  if (bucketMs <= 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return `W${getISOWeek(d)} ${d.getFullYear()}`;
}

function getISOWeek(d: Date): number {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
  );
}

// Threshold coloring: returns background and text colors
function cellColors(
  value: number | null,
  loWarn: number | null,
  hiWarn: number | null,
  loAlarm: number | null,
  hiAlarm: number | null,
): { bg: string; fg: string } {
  if (value === null) return { bg: "transparent", fg: "var(--io-text-muted)" };
  if (
    (hiAlarm !== null && value >= hiAlarm) ||
    (loAlarm !== null && value <= loAlarm)
  ) {
    return { bg: "rgba(239,68,68,0.25)", fg: "#EF4444" };
  }
  if (
    (hiWarn !== null && value >= hiWarn) ||
    (loWarn !== null && value <= loWarn)
  ) {
    return { bg: "rgba(245,158,11,0.20)", fg: "#F59E0B" };
  }
  return { bg: "rgba(16,185,129,0.15)", fg: "#10B981" };
}

interface ColThreshold {
  loWarn: number | null;
  hiWarn: number | null;
  loAlarm: number | null;
  hiAlarm: number | null;
}

export default function ScorecardTableChart({ config }: RendererProps) {
  const metricSlots = config.points.filter((p) => p.role === "metric");
  const durationMinutes = config.durationMinutes ?? 60 * 24;

  const tableMode = (config.extras?.tableMode as string) ?? "scorecard";
  const aggFn = ((config.extras?.aggregateFunction as string) ??
    "mean") as AggFn;
  const refreshSeconds =
    typeof config.extras?.refreshSeconds === "number"
      ? config.extras.refreshSeconds
      : 60;
  const rowPeriod = (config.extras?.rowPeriod as string) ?? "hour";

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const windowEndMs = isHistorical
    ? new Date(timeRange.end).getTime()
    : Date.now();
  const windowStartMs = isHistorical
    ? new Date(timeRange.start).getTime()
    : windowEndMs - durationMinutes * 60 * 1000;

  const end = new Date(windowEndMs).toISOString();
  const start = new Date(windowStartMs).toISOString();

  const pointIds = metricSlots.map((s) => s.pointId);

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ["history-batch", ...pointIds, start, end, "scorecard"],
    queryFn: () =>
      pointsApi.historyBatch(pointIds, { start, end, limit: 5000 }),
    enabled: pointIds.length > 0 && tableMode === "scorecard",
    refetchInterval: isHistorical ? false : refreshSeconds * 1000,
    select: (res) => (res.success ? res.data : []),
  });

  const bucketMs = PERIOD_MS[rowPeriod] ?? PERIOD_MS.hour;

  // Per-column thresholds from extras.thresholds: Record<pointId, ColThreshold>
  const thresholds: Record<string, ColThreshold> = useMemo(() => {
    const raw = config.extras?.thresholds as
      | Record<string, Partial<ColThreshold>>
      | undefined;
    const result: Record<string, ColThreshold> = {};
    for (const slot of metricSlots) {
      const t = raw?.[slot.pointId] ?? {};
      result[slot.pointId] = {
        loWarn: t.loWarn ?? null,
        hiWarn: t.hiWarn ?? null,
        loAlarm: t.loAlarm ?? null,
        hiAlarm: t.hiAlarm ?? null,
      };
    }
    return result;
  }, [config.extras?.thresholds, metricSlots]);

  // Build table: rows = time periods, cols = metric points
  const { rows, periodStarts } = useMemo(() => {
    if (!historyBatch) return { rows: [], periodStarts: [] };

    // Collect values per (bucket_index, point_id)
    const bucketMap = new Map<number, Map<string, number[]>>();

    for (const batch of historyBatch) {
      for (const row of batch.rows) {
        if (row.value === null) continue;
        const ts = new Date(row.timestamp).getTime();
        if (ts < windowStartMs || ts > windowEndMs) continue;
        const bi = Math.floor((ts - windowStartMs) / bucketMs);
        if (!bucketMap.has(bi)) bucketMap.set(bi, new Map());
        const pointMap = bucketMap.get(bi)!;
        const existing = pointMap.get(batch.point_id) ?? [];
        existing.push(row.value);
        pointMap.set(batch.point_id, existing);
      }
    }

    const sortedBuckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);

    const periodStarts = sortedBuckets.map(
      (bi) => windowStartMs + bi * bucketMs,
    );
    const rows = sortedBuckets.map((bi) => {
      const pm = bucketMap.get(bi)!;
      return metricSlots.map((slot) => {
        const vals = pm.get(slot.pointId) ?? [];
        return aggregate(vals, aggFn);
      });
    });

    return { rows, periodStarts };
  }, [historyBatch, metricSlots, windowStartMs, windowEndMs, bucketMs, aggFn]);

  if (metricSlots.length === 0) {
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
        Assign KPI columns in the Data Points tab
      </div>
    );
  }

  if (tableMode === "event_stats") {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        <span>Event Statistics Table</span>
        <span style={{ fontSize: 11 }}>
          Requires event-condition query endpoint (Phase 3)
        </span>
      </div>
    );
  }

  // --- Scorecard mode ---

  const shortLabel = (pid: string) => (pid.length > 14 ? pid.slice(-14) : pid);

  return (
    <div
      style={{ position: "relative", flex: 1, minHeight: 0, overflow: "auto" }}
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

      {!isLoading && rows.length === 0 && (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
            padding: 24,
          }}
        >
          No data in selected range
        </div>
      )}

      {rows.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--io-surface-raised)",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <th
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  color: "var(--io-text-muted)",
                  fontWeight: 500,
                  borderBottom: "1px solid var(--io-border)",
                  width: 140,
                  fontSize: 11,
                }}
              >
                Period
              </th>
              {metricSlots.map((slot) => (
                <th
                  key={slot.slotId}
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    color: "var(--io-text-muted)",
                    fontWeight: 500,
                    borderBottom: "1px solid var(--io-border)",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={slot.pointId}
                >
                  {shortLabel(slot.pointId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                style={{ borderBottom: "1px solid var(--io-border)" }}
              >
                <td
                  style={{
                    padding: "5px 8px",
                    color: "var(--io-text-secondary)",
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {periodLabel(periodStarts[ri], bucketMs)}
                </td>
                {row.map((cellVal, ci) => {
                  const pid = metricSlots[ci].pointId;
                  const th = thresholds[pid];
                  const { bg, fg } = cellColors(
                    cellVal,
                    th.loWarn,
                    th.hiWarn,
                    th.loAlarm,
                    th.hiAlarm,
                  );
                  return (
                    <td
                      key={ci}
                      style={{
                        padding: "5px 8px",
                        textAlign: "right",
                        background: bg,
                        color: fg,
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: cellVal !== null ? 500 : 400,
                        fontSize: 12,
                      }}
                    >
                      {formatValue(cellVal)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
