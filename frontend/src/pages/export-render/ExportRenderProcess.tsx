import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { graphicsApi } from "../../api/graphics";
import { pointsApi } from "../../api/points";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import type { PointValue } from "../../shared/graphics/SceneRenderer";
import type {
  ViewportState,
  SceneNode,
  GraphicDocument,
} from "../../shared/types/graphics";
import { extractPointIds } from "../../shared/graphics/pointExtractor";
import { TimestampOverlay } from "../../shared/components/TimestampOverlay";

interface Props {
  graphicId: string;
  tsParam: number;
  width: number;
  height: number;
  overlayEnabled: boolean;
}

function countWidgetNodes(nodes: SceneNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === "widget") count++;
    const children = (n as { children?: SceneNode[] }).children;
    if (Array.isArray(children)) count += countWidgetNodes(children);
  }
  return count;
}

export function ExportRenderProcess({
  graphicId,
  tsParam,
  width,
  height,
  overlayEnabled,
}: Props) {
  const snappedTs = Math.floor(tsParam / 1000) * 1000;

  const { data: graphic, isSuccess: graphicLoaded } = useQuery({
    queryKey: ["graphic", graphicId],
    queryFn: async () => {
      const result = await graphicsApi.get(graphicId);
      return result.success ? (result.data ?? null) : null;
    },
  });

  const pointIds = useMemo(() => {
    if (!graphic?.scene_data) return [] as string[];
    return Array.from(extractPointIds(graphic.scene_data as GraphicDocument));
  }, [graphic?.scene_data]);

  const historicalQueries = useQueries({
    queries: pointIds.map((id) => ({
      queryKey: ["historical", id, snappedTs] as const,
      queryFn: async (): Promise<PointValue | null> => {
        const end = new Date(snappedTs).toISOString();
        const start = new Date(snappedTs - 2 * 60 * 60 * 1000).toISOString();
        const result = await pointsApi.getHistory(id, {
          start,
          end,
          resolution: "raw",
        });
        if (!result.success) return null;
        const raw = result.data as unknown;
        const rows: Array<{ value?: number | null; quality?: string }> =
          Array.isArray(raw)
            ? (raw as Array<{ value?: number | null; quality?: string }>)
            : ((
                raw as {
                  rows?: Array<{ value?: number | null; quality?: string }>;
                }
              ).rows ?? []);
        const last = rows.length > 0 ? rows[rows.length - 1] : null;
        if (!last) return null;
        return {
          pointId: id,
          value: last.value ?? null,
          quality:
            last.quality === "good" ||
            last.quality === "bad" ||
            last.quality === "uncertain"
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

  const allHistoricalSettled =
    historicalQueries.length === 0 ||
    historicalQueries.every((q) => !q.isPending && !q.isFetching);

  const [fontsReady, setFontsReady] = useState(false);
  const [widgetsReady, setWidgetsReady] = useState(false);

  const widgetCount = useMemo(
    () =>
      graphic?.scene_data ? countWidgetNodes(graphic.scene_data.children) : 0,
    [graphic?.scene_data],
  );

  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  // Wait for all widget chart overlays to signal data-chart-ready.
  useEffect(() => {
    if (!graphicLoaded || widgetCount === 0) {
      setWidgetsReady(true);
      return;
    }
    function check() {
      const ready = document.querySelectorAll("[data-chart-ready]").length;
      if (ready >= widgetCount) {
        setWidgetsReady(true);
        return true;
      }
      return false;
    }
    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-chart-ready"],
      childList: true,
    });
    return () => observer.disconnect();
  }, [graphicLoaded, widgetCount]);

  useEffect(() => {
    if (graphicLoaded && allHistoricalSettled && fontsReady && widgetsReady) {
      document.body.setAttribute("data-export-ready", "true");
    } else {
      document.body.removeAttribute("data-export-ready");
    }
  }, [
    graphicLoaded,
    allHistoricalSettled,
    fontsReady,
    widgetsReady,
    snappedTs,
  ]);

  const viewport = useMemo((): ViewportState => {
    const canvasW = graphic?.scene_data?.canvas?.width ?? 1920;
    const canvasH = graphic?.scene_data?.canvas?.height ?? 1080;
    const fitZoom = Math.min(width / canvasW, height / canvasH);
    // Letterbox margins in screen pixels.
    const marginX = (width - canvasW * fitZoom) / 2;
    const marginY = (height - canvasH * fitZoom) / 2;
    // Convert margins to canvas units so canvasToScreen() returns the correct
    // screen pixel offset (panX negative → canvas origin pushed rightward).
    return {
      panX: fitZoom > 0 ? -marginX / fitZoom : 0,
      panY: fitZoom > 0 ? -marginY / fitZoom : 0,
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
        graphicId={graphicId}
        style={{ position: "absolute", inset: 0 }}
      />
      {overlayEnabled && <TimestampOverlay timestamp={tsParam} />}
    </div>
  );
}
