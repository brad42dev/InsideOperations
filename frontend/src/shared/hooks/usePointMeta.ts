import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { pointsApi } from "../../api/points";
import type { PointDetail } from "../../api/points";

/**
 * Fetches PointDetail (including enum_labels) for one or more point IDs.
 * Returns a Map<pointId, PointDetail> for convenient lookup.
 * Caches via TanStack Query with 5-minute staleTime.
 */
export function usePointMeta(pointIds: string[]): Map<string, PointDetail> {
  const uniqueIds = useMemo(
    () => Array.from(new Set(pointIds.filter(Boolean))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pointIds.join(",")],
  );

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: ["point-meta", id],
      queryFn: async () => {
        const res = await pointsApi.getMeta(id);
        return res.success ? res.data : null;
      },
      staleTime: 5 * 60 * 1000,
      enabled: Boolean(id),
    })),
  });

  // Stable key: changes only when actual data resolves, not on every render.
  const dataKey = results.map((r) => r.dataUpdatedAt ?? 0).join(",");

  return useMemo(() => {
    const metaMap = new Map<string, PointDetail>();
    uniqueIds.forEach((id, i) => {
      const data = results[i]?.data;
      if (data) metaMap.set(id, data);
    });
    return metaMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueIds, dataKey]);
}
