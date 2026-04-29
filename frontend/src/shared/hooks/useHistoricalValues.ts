/**
 * useHistoricalValues — fetch point values at a specific timestamp from the archive (doc 07/08/32)
 *
 * Uses useQueries so every in-flight fetch is visible to useIsFetching({ queryKey: ["historical"] }).
 * ExportRenderConsole depends on that count to gate the data-export-ready signal, so the capture
 * worker waits for real data before screenshotting each frame.
 */
import { useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { pointsApi } from "../../api/points";
import type { PointValue } from "../graphics/SceneRenderer";

export type HistoricalValues = Map<string, PointValue>;

type RawRow = { value?: number | null; quality?: string };
type RawResponse = RawRow[] | { rows?: RawRow[] };

export function useHistoricalValues(
  pointIds: string[],
  /** Target epoch ms. If undefined or 0, returns empty map */
  timestamp: number | undefined,
): HistoricalValues {
  const snappedTs = timestamp ? Math.floor(timestamp / 1000) * 1000 : undefined;

  // 2-hour lookback window — covers OPC points that update infrequently.
  const end = snappedTs ? new Date(snappedTs).toISOString() : "";
  const start = snappedTs ? new Date(snappedTs - 2 * 60 * 60 * 1000).toISOString() : "";

  // Preserve last-known values so the scene doesn't blank out while queries for a
  // new scrub position are in flight. Updated each time a query resolves.
  const lastKnownRef = useRef<Map<string, PointValue>>(new Map());
  // Stable reference cache — only issue a new Map when content actually changes so
  // downstream useMemo/React.memo comparisons don't invalidate on every render.
  const lastReturnedRef = useRef<Map<string, PointValue>>(new Map());

  const results = useQueries({
    queries: pointIds.map((id) => ({
      queryKey: ["historical", id, snappedTs] as const,
      queryFn: async (): Promise<RawRow | null> => {
        const r = await pointsApi.getHistory(id, { start, end, resolution: "raw" });
        if (!r.success) return null;
        const raw = r.data as unknown as RawResponse;
        const rows: RawRow[] = Array.isArray(raw) ? raw : (raw as { rows?: RawRow[] }).rows ?? [];
        return rows.length > 0 ? rows[rows.length - 1] : null;
      },
      enabled: !!snappedTs,
      // Historical data never changes — cache indefinitely so scrubbing back to a
      // previously-visited timestamp is instant.
      staleTime: Infinity,
    })),
  });

  const out = new Map<string, PointValue>();
  for (let i = 0; i < pointIds.length; i++) {
    const row = results[i]?.data;
    if (row) {
      const pv: PointValue = {
        pointId: pointIds[i],
        value: row.value ?? null,
        quality:
          row.quality === "good" || row.quality === "bad" || row.quality === "uncertain"
            ? row.quality
            : "uncertain",
      };
      out.set(pointIds[i], pv);
      // Only update lastKnownRef with non-null values so the fallback path
      // (returned when out is empty / queries in flight) never surfaces a
      // null-value entry that would overwrite a previously-good reading.
      if (pv.value !== null) {
        lastKnownRef.current.set(pointIds[i], pv);
      }
    }
  }

  // Always return last-known values when nothing has resolved — covers both the
  // in-flight case and the brief window where React Query has changed the query key
  // but isFetching hasn't been set yet (prevents a single-render blank flash).
  if (out.size === 0) {
    return lastKnownRef.current;
  }

  // Return a stable Map reference when content is identical to the previous call.
  // This prevents pointValues useMemo from invalidating (and SceneRenderer from
  // re-rendering) on every GraphicPane render when the snapped timestamp hasn't changed.
  const prev = lastReturnedRef.current;
  if (prev.size === out.size) {
    let same = true;
    for (const [k, v] of out) {
      const p = prev.get(k);
      if (!p || p.value !== v.value || p.quality !== v.quality) {
        same = false;
        break;
      }
    }
    if (same) return prev;
  }
  lastReturnedRef.current = out;
  return out;
}
