import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueries, useIsFetching } from "@tanstack/react-query";
import { graphicsApi } from "../../api/graphics";
import { pointsApi } from "../../api/points";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import type { PointValue } from "../../shared/graphics/SceneRenderer";
import type { ViewportState, SceneNode, DisplayElement, SymbolInstance } from "../../shared/types/graphics";
import { TimestampOverlay } from "../../shared/components/TimestampOverlay";

interface Props {
  graphicId: string;
  tsParam: number;
  width: number;
  height: number;
  overlayEnabled: boolean;
}

function collectPointIds(node: SceneNode, out: Set<string>) {
  if (node.type === "display_element") {
    const de = node as DisplayElement;
    if (de.binding?.pointId) out.add(de.binding.pointId);
    if (de.binding?.expressionId) out.add(de.binding.expressionId);
  }
  if (node.type === "symbol_instance") {
    const si = node as SymbolInstance;
    if (si.stateBinding?.pointId) out.add(si.stateBinding.pointId);
    if (si.stateBinding?.expressionId) out.add(si.stateBinding.expressionId);
  }
  if ("children" in node && Array.isArray((node as { children?: SceneNode[] }).children)) {
    for (const child of (node as { children: SceneNode[] }).children) {
      collectPointIds(child, out);
    }
  }
}

export function ExportRenderProcess({ graphicId, tsParam, width, height, overlayEnabled }: Props) {
  const snappedTs = Math.floor(tsParam / 1000) * 1000;

  const { data: graphic, isSuccess: graphicLoaded } = useQuery({
    queryKey: ["graphic", graphicId],
    queryFn: async () => {
      const result = await graphicsApi.get(graphicId);
      return result.success ? result.data ?? null : null;
    },
  });

  const pointIds = useMemo(() => {
    if (!graphic?.scene_data) return [] as string[];
    const ids = new Set<string>();
    for (const node of graphic.scene_data.children) collectPointIds(node, ids);
    return Array.from(ids);
  }, [graphic?.scene_data]);

  const historicalQueries = useQueries({
    queries: pointIds.map((id) => ({
      queryKey: ["historical", id, snappedTs] as const,
      queryFn: async (): Promise<PointValue | null> => {
        const end = new Date(snappedTs).toISOString();
        const start = new Date(snappedTs - 2 * 60 * 60 * 1000).toISOString();
        const result = await pointsApi.getHistory(id, { start, end, resolution: "raw" });
        if (!result.success) return null;
        const raw = result.data as unknown;
        const rows: Array<{ value?: number | null; quality?: string }> = Array.isArray(raw)
          ? (raw as Array<{ value?: number | null; quality?: string }>)
          : ((raw as { rows?: Array<{ value?: number | null; quality?: string }> }).rows ?? []);
        const last = rows.length > 0 ? rows[rows.length - 1] : null;
        if (!last) return null;
        return {
          pointId: id,
          value: last.value ?? null,
          quality:
            last.quality === "good" || last.quality === "bad" || last.quality === "uncertain"
              ? last.quality
              : "uncertain",
        };
      },
      enabled: graphicLoaded && snappedTs > 0,
      staleTime: Infinity,
    })),
  });

  const pointValues = useMemo(() => {
    const out = new Map<string, PointValue>();
    for (let i = 0; i < pointIds.length; i++) {
      const q = historicalQueries[i];
      if (q?.data) out.set(pointIds[i], q.data);
    }
    return out;
  }, [pointIds, historicalQueries]);

  const isFetching = useIsFetching({ queryKey: ["historical"] });
  const allHistoricalSettled =
    historicalQueries.length === 0 || historicalQueries.every((q) => !q.isPending && !q.isFetching);

  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (graphicLoaded && isFetching === 0 && allHistoricalSettled && fontsReady) {
      document.body.setAttribute("data-export-ready", "true");
    } else {
      document.body.removeAttribute("data-export-ready");
    }
  }, [graphicLoaded, isFetching, allHistoricalSettled, fontsReady, snappedTs]);

  const viewport = useMemo((): ViewportState => {
    const canvasW = graphic?.scene_data?.canvas?.width ?? 1920;
    const canvasH = graphic?.scene_data?.canvas?.height ?? 1080;
    const fitZoom = Math.min(width / canvasW, height / canvasH);
    return {
      panX: (width - canvasW * fitZoom) / 2,
      panY: (height - canvasH * fitZoom) / 2,
      zoom: fitZoom,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      screenWidth: width,
      screenHeight: height,
    };
  }, [graphic?.scene_data, width, height]);

  if (!graphic?.scene_data) {
    return null;
  }

  return (
    <div style={{ position: "relative", width, height, overflow: "hidden" }}>
      <SceneRenderer
        document={graphic.scene_data}
        viewport={viewport}
        pointValues={pointValues}
        style={{ position: "absolute", inset: 0 }}
      />
      {overlayEnabled && (
        <TimestampOverlay timestamp={tsParam} />
      )}
    </div>
  );
}
