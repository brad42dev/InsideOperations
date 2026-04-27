/**
 * useHistoricalValues — fetch point values at a specific timestamp from the archive (doc 07/08/32)
 *
 * Queries `/api/archive/history/points/:id` with a 10-second window around the target
 * timestamp and returns the last known value. Uses parallel fetches for all points.
 */
import { useEffect, useState, useRef } from "react";
import { pointsApi } from "../../api/points";
import type { PointValue } from "../graphics/SceneRenderer";

/** Map from pointId → PointValue at the requested timestamp */
export type HistoricalValues = Map<string, PointValue>;

export function useHistoricalValues(
  pointIds: string[],
  /** Target epoch ms. If undefined or 0, returns empty map */
  timestamp: number | undefined,
): HistoricalValues {
  const [values, setValues] = useState<HistoricalValues>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Snap to 1-second resolution so the effect doesn't fire on every 100ms
  // timer tick. Without this, each tick aborts the previous in-flight request
  // and no fetch ever completes during playback.
  const snappedTs = timestamp ? Math.floor(timestamp / 1000) * 1000 : undefined;

  useEffect(() => {
    if (!snappedTs || pointIds.length === 0) {
      setValues(new Map());
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // 2-hour lookback window with no explicit limit (backend default: 10 000 rows).
    // The backend returns rows ascending by timestamp; taking entries[last] gives
    // the most-recent sample at or before the playback position.
    // A wide window is necessary because OPC sample intervals vary widely (seconds
    // to hours) and the backend has no DESC-LIMIT-1 path.
    const end = new Date(snappedTs).toISOString();
    const start = new Date(snappedTs - 2 * 60 * 60 * 1000).toISOString();

    async function fetchAll() {
      const results = await Promise.allSettled(
        pointIds.map((id) =>
          pointsApi.getHistory(id, { start, end, resolution: "raw" }),
        ),
      );

      if (controller.signal.aborted) return;

      const out = new Map<string, PointValue>();
      for (let i = 0; i < pointIds.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value.success) {
          // Archive API returns { point_id, resolution, rows: [...] }, not a bare array.
          const raw = r.value.data as unknown;
          const rows: Array<{ value?: number | null; quality?: string }> =
            Array.isArray(raw)
              ? (raw as Array<{ value?: number | null; quality?: string }>)
              : ((raw as { rows?: Array<{ value?: number | null; quality?: string }> }).rows ?? []);
          const last = rows.length > 0 ? rows[rows.length - 1] : null;
          if (last) {
            out.set(pointIds[i], {
              pointId: pointIds[i],
              value: last.value ?? null,
              quality:
                last.quality === "good" ||
                last.quality === "bad" ||
                last.quality === "uncertain"
                  ? last.quality
                  : "uncertain",
            });
          }
        }
      }
      setValues(out);
    }

    void fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snappedTs, pointIds.join(",")]);

  return values;
}
