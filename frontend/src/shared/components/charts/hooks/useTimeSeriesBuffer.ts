// ---------------------------------------------------------------------------
// useTimeSeriesBuffer — shared hook for live time-series ring buffer logic.
// Extracted from TrendPane so all time-series renderers can share it.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { usePlaybackStore } from "../../../../store/playback";
import { pointsApi } from "../../../../api/points";
import { defaultBucketSeconds } from "../chart-aggregate-config";
import type { AggregateType } from "../chart-config-types";

export interface RingEntry {
  ts: number; // Unix seconds
  v: number;
}

export interface TimeSeriesPoint {
  pointId: string;
  color: string;
  label: string;
}

// Per-pane buffers live at module scope so they survive remounts.
const _globalBuffers = new Map<string, Map<string, RingEntry[]>>();
const _globalLastTs = new Map<string, Map<string, number>>();

function getBuffers(key: string): Map<string, RingEntry[]> {
  let m = _globalBuffers.get(key);
  if (!m) {
    m = new Map();
    _globalBuffers.set(key, m);
  }
  return m;
}
function getLastTs(key: string): Map<string, number> {
  let m = _globalLastTs.get(key);
  if (!m) {
    m = new Map();
    _globalLastTs.set(key, m);
  }
  return m;
}

function seedLimit(minutes: number): number {
  if (minutes <= 120) return 7_500;
  if (minutes <= 10080) return 2_500;
  return 2_000;
}
function maxBuffer(minutes: number): number {
  return Math.max(3_600, minutes * 60);
}

export interface UseTimeSeriesBufferOptions {
  /** Unique key to scope module-level buffers (e.g. pane id) */
  bufferKey: string;
  pointIds: string[];
  durationMinutes: number;
  /** step interpolation buckets everything to the resolution boundary */
  interpolation?: "linear" | "step";
  /** Explicit bucket width in seconds. Undefined = auto (defaultBucketSeconds). */
  bucketSeconds?: number;
  /** Aggregate function sent to the archive API. Defaults to 'avg'. */
  aggregateType?: AggregateType;
  /**
   * OPC UA MinimumSamplingInterval (ms) per point. Points with MSI ≥ 5000 ms
   * are treated as slow-update (step/hold-last-value) series:
   *   - Window boundaries are injected into the timestamps array so the line
   *     always extends to both edges of the chart.
   *   - Nulls are forward-filled within 2× MSI; gaps beyond that stay null
   *     (shown as stale in the tooltip).
   */
  msiMap?: Map<string, number | null>;
}

export interface UseTimeSeriesBufferResult {
  timestamps: number[];
  seriesData: Map<string, (number | null)[]>;
  isFetching: boolean;
  isHistorical: boolean;
}

export function useTimeSeriesBuffer({
  bufferKey,
  pointIds,
  durationMinutes,
  interpolation = "linear",
  bucketSeconds,
  aggregateType,
  msiMap,
}: UseTimeSeriesBufferOptions): UseTimeSeriesBufferResult {
  const buffers = useRef(getBuffers(bufferKey));
  const lastTs = useRef(getLastTs(bufferKey));

  // Clean up module-scope maps when this pane unmounts (prevents unbounded growth
  // when operators add/remove panes over a long session).
  useEffect(() => {
    return () => {
      _globalBuffers.delete(bufferKey);
      _globalLastTs.delete(bufferKey);
    };
    // bufferKey is stable (pane ID) — intentionally empty-ish dep array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferKey]);
  const [tick, setTick] = useState(0);

  const { mode: playbackMode, timeRange } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const { values } = useWebSocket(isHistorical ? [] : pointIds);

  // Trim buffer when duration changes
  useEffect(() => {
    const cutoff = Date.now() / 1000 - durationMinutes * 60;
    let changed = false;
    buffers.current.forEach((buf, id) => {
      const trimmed = buf.filter((e) => e.ts >= cutoff);
      if (trimmed.length < buf.length) {
        buffers.current.set(id, trimmed);
        changed = true;
      }
    });
    if (changed) setTick((t) => t + 1);
  }, [durationMinutes]);

  // Historical fetch
  const { data: historicalData } = useQuery({
    queryKey: [
      "ts-historical",
      pointIds.join(","),
      timeRange.start,
      timeRange.end,
    ],
    queryFn: async () => {
      const results = await Promise.all(
        pointIds.map((id) =>
          pointsApi.history(id, {
            start: new Date(timeRange.start).toISOString(),
            end: new Date(timeRange.end).toISOString(),
            resolution: "auto",
            limit: 2000,
          }),
        ),
      );
      const map = new Map<string, RingEntry[]>();
      results.forEach((r, i) => {
        if (r.success && r.data?.rows) {
          map.set(
            pointIds[i],
            r.data.rows.map((row) => ({
              ts: new Date(row.timestamp).getTime() / 1000,
              v:
                typeof row.value === "number"
                  ? row.value
                  : typeof row.avg === "number"
                    ? row.avg
                    : NaN,
            })),
          );
        }
      });
      return map;
    },
    enabled: isHistorical && pointIds.length > 0,
  });

  // Clear the buffer synchronously during render when bucket or aggregate changes.
  // Must be synchronous (not useEffect) so the buffer is empty before the new
  // queryFn reads it. Using useRef skips the initial mount (refs are initialized
  // to the current values, so the first comparison is always equal).
  const prevBucketRef = useRef(bucketSeconds);
  const prevAggRef = useRef(aggregateType);
  if (
    prevBucketRef.current !== bucketSeconds ||
    prevAggRef.current !== aggregateType
  ) {
    prevBucketRef.current = bucketSeconds;
    prevAggRef.current = aggregateType;
    buffers.current.forEach((_, id) => buffers.current.set(id, []));
    lastTs.current.clear();
  }

  // Live seed query
  const seedQuery = useQuery({
    queryKey: [
      "ts-seed",
      bufferKey,
      pointIds.join(","),
      durationMinutes,
      bucketSeconds,
      aggregateType,
    ],
    queryFn: async () => {
      const now = new Date();
      const nowSec = now.getTime() / 1000;
      const windowStart = new Date(now.getTime() - durationMinutes * 60 * 1000);
      const cutoff = nowSec - durationMinutes * 60;

      const results = await Promise.all(
        pointIds.map((id) => {
          const existing = buffers.current.get(id) ?? [];
          const inWindow = existing.filter((e) => e.ts >= cutoff);
          const effectiveBucket =
            bucketSeconds ?? defaultBucketSeconds(durationMinutes);
          const effectiveAgg = aggregateType ?? "avg";
          if (inWindow.length === 0) {
            return pointsApi.history(id, {
              start: windowStart.toISOString(),
              end: now.toISOString(),
              bucket_seconds: effectiveBucket,
              aggregate_function: effectiveAgg,
              limit: seedLimit(durationMinutes),
            });
          }
          const earliestTs = inWindow[0].ts;
          const latestTs = inWindow[inWindow.length - 1].ts;
          if (earliestTs > cutoff + 60) {
            return pointsApi.history(id, {
              start: windowStart.toISOString(),
              end: new Date(earliestTs * 1000).toISOString(),
              bucket_seconds: effectiveBucket,
              aggregate_function: effectiveAgg,
              limit: seedLimit(durationMinutes),
            });
          }
          return pointsApi.history(id, {
            start: new Date(latestTs * 1000).toISOString(),
            end: now.toISOString(),
            bucket_seconds: effectiveBucket,
            aggregate_function: effectiveAgg,
            limit: seedLimit(durationMinutes),
          });
        }),
      );

      results.forEach((r, i) => {
        if (!r.success || !r.data?.rows) return;
        const id = pointIds[i];
        const existing = buffers.current.get(id) ?? [];
        const existingTs = new Set(existing.map((e) => e.ts));
        const newEntries: RingEntry[] = r.data.rows
          .map((row) => ({
            ts: Math.round(new Date(row.timestamp).getTime() / 1000),
            v:
              typeof row.value === "number"
                ? row.value
                : typeof row.avg === "number"
                  ? row.avg
                  : typeof row.min === "number" && typeof row.max === "number"
                    ? (row.min + row.max) / 2
                    : NaN,
          }))
          .filter((e) => !isNaN(e.ts) && !isNaN(e.v) && !existingTs.has(e.ts));
        if (newEntries.length > 0) {
          buffers.current.set(
            id,
            [...existing, ...newEntries].sort((a, b) => a.ts - b.ts),
          );
        }
      });
      setTick((t) => t + 1);
      return null;
    },
    enabled: !isHistorical && pointIds.length > 0,
    staleTime: Infinity,
    gcTime: 0,
  });

  // Accumulate live WS ticks into buffers
  useEffect(() => {
    if (values.size === 0) return;
    const bucketSec = bucketSeconds ?? defaultBucketSeconds(durationMinutes);
    const cutoff = Date.now() / 1000 - durationMinutes * 60;
    let changed = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values.forEach((pv: any) => {
      const rawTs = new Date(pv.timestamp).getTime() / 1000;
      if (isNaN(rawTs)) return;
      const ts =
        bucketSec > 1 && interpolation !== "step"
          ? Math.floor(rawTs / bucketSec) * bucketSec
          : Math.round(rawTs);

      if (lastTs.current.get(pv.pointId) === ts) return;
      lastTs.current.set(pv.pointId, ts);

      const buf = buffers.current.get(pv.pointId) ?? [];
      const last = buf[buf.length - 1];
      let next: RingEntry[];
      if (last && last.ts === ts) {
        next = [...buf.slice(0, -1), { ts, v: pv.value }];
      } else {
        next = [...buf, { ts, v: pv.value }];
      }
      next = next.filter((e) => e.ts >= cutoff);
      const cap = maxBuffer(durationMinutes);
      if (next.length > cap) next = next.slice(next.length - cap);
      buffers.current.set(pv.pointId, next);
      changed = true;
    });

    if (changed) setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  // Build output
  const sourceMap: Map<string, RingEntry[]> =
    isHistorical && historicalData ? historicalData : buffers.current;

  // Inject window boundary timestamps for step (slow-update) series so the
  // forward-fill can reach both the left and right edges of the chart.
  const hasStepPoints = msiMap
    ? pointIds.some((id) => (msiMap.get(id) ?? 0)! >= 5000)
    : false;
  const windowStartTs = isHistorical
    ? Math.round(timeRange.start / 1000)
    : Math.floor(Date.now() / 1000 - durationMinutes * 60);
  const windowEndTs = isHistorical
    ? Math.round(timeRange.end / 1000)
    : Math.floor(Date.now() / 1000);

  const allTs = new Set<number>();
  if (hasStepPoints) {
    allTs.add(windowStartTs);
    allTs.add(windowEndTs);
  }
  pointIds.forEach((id) => {
    const buf = sourceMap.get(id) ?? [];
    buf.forEach((e) => allTs.add(e.ts));
  });
  const timestamps = Array.from(allTs).sort((a, b) => a - b);

  const seriesData = new Map<string, (number | null)[]>();
  pointIds.forEach((id) => {
    const buf = sourceMap.get(id) ?? [];
    const bufMap = new Map(buf.map((e) => [e.ts, e.v]));
    const msi = msiMap?.get(id) ?? null;
    const isStep = msi !== null && msi >= 5000;

    let data: (number | null)[] = timestamps.map(
      (ts) => bufMap.get(ts) ?? null,
    );

    if (isStep && buf.length > 0) {
      // Forward-fill within 2× MSI. Seed carry with buf[0].v so the line
      // extends backward to the window start. Positions beyond 2× MSI of the
      // last real reading return null (tooltip shows stale/grey).
      const staleWindowSec = (msi * 2) / 1000;
      let carry: number | null = !isNaN(buf[0].v) ? buf[0].v : null;
      let carryTs: number = buf[0].ts;

      data = data.map((v, i) => {
        if (v !== null && !isNaN(v)) {
          carry = v;
          carryTs = timestamps[i];
        }
        if (carry === null) return null;
        const dt = timestamps[i] - carryTs;
        // dt < 0: before first reading → backward-extend to window start
        // dt >= 0: forward-fill within 2× MSI
        if (dt <= staleWindowSec) return carry;
        return null;
      });
    }

    seriesData.set(id, data);
  });

  // tick is read here to ensure callers re-render when buffers change
  void tick;

  return {
    timestamps,
    seriesData,
    isFetching: seedQuery.isFetching,
    isHistorical,
  };
}
