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

  useEffect(() => {
    if (!timestamp || pointIds.length === 0) {
      setValues(new Map());
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const ts = new Date(timestamp);
    // 10-second window ending at ts to capture the last recorded value
    const end = ts.toISOString();
    const start = new Date(timestamp - 10_000).toISOString();

    async function fetchAll() {
      const results = await Promise.allSettled(
        pointIds.map((id) =>
          pointsApi.getHistory(id, { start, end, resolution: "raw", limit: 1 }),
        ),
      );

      if (controller.signal.aborted) return;

      const out = new Map<string, PointValue>();
      for (let i = 0; i < pointIds.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value.success) {
          const entries = r.value.data;
          const last = Array.isArray(entries)
            ? entries[entries.length - 1]
            : null;
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
  }, [timestamp, pointIds.join(",")]);

  return values;
}
