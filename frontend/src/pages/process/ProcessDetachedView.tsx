/**
 * ProcessDetachedView — minimal shell for detached Process windows.
 *
 * Spec: process-implementation-spec.md §11
 *
 * Route: /detached/process/:viewId
 *
 * Renders:
 *   - Thin title bar (32px): view name, connection status dot, live clock, basic controls
 *   - Full viewport canvas with minimap
 *   - No sidebar, no module switcher, no AppShell chrome
 *
 * Viewport state, LOD, and subscriptions are fully independent per window.
 * WebSocket sharing is handled by the SharedWorker inside useWebSocketRaf.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import RBush from "rbush";
import { graphicsApi } from "../../api/graphics";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import type { PointValue as ScenePointValue } from "../../shared/graphics/SceneRenderer";
import { useWebSocketRaf } from "../../shared/hooks/useWebSocket";
import { useHistoricalValues } from "../../shared/hooks/useHistoricalValues";
import { usePlaybackStore } from "../../store/playback";
import type {
  ViewportState,
  SceneNode,
  DisplayElement,
  SymbolInstance,
} from "../../shared/types/graphics";
import ProcessMinimap from "./ProcessMinimap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpatialBindingEntry {
  nodeId: string;
  bbox: { left: number; top: number; right: number; bottom: number };
  lodLevel: number;
  pointIds: Set<string>;
}

interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  entry: SpatialBindingEntry;
}

// ---------------------------------------------------------------------------
// LOD helpers (mirrors index.tsx)
// ---------------------------------------------------------------------------

type LodLevel = 0 | 1 | 2 | 3;

function zoomToLod(zoom: number): LodLevel {
  if (zoom < 0.15) return 0;
  if (zoom < 0.4) return 1;
  if (zoom < 0.8) return 2;
  return 3;
}

function displayElementLod(displayType: string): number {
  switch (displayType) {
    case "text_readout":
      return 1;
    case "alarm_indicator":
      return 1;
    case "analog_bar":
      return 2;
    case "fill_gauge":
      return 2;
    case "sparkline":
      return 2;
    case "digital_status":
      return 2;
    default:
      return 1;
  }
}

function displayElementSize(node: DisplayElement): [number, number] {
  const cfg = node.config as unknown as Record<string, number> | undefined;
  switch (node.displayType) {
    case "text_readout":
      return [Math.max(cfg?.minWidth ?? 60, 80), 36];
    case "analog_bar":
      return [cfg?.barWidth ?? 20, cfg?.barHeight ?? 100];
    case "fill_gauge":
      return [cfg?.barWidth ?? 22, cfg?.barHeight ?? 90];
    case "sparkline":
      return [110, 18];
    case "alarm_indicator":
      return [20, 20];
    case "digital_status":
      return [80, 22];
    default:
      return [60, 24];
  }
}

// ---------------------------------------------------------------------------
// Spatial binding index (spec §5.6)
// ---------------------------------------------------------------------------

function buildBindingIndex(doc: {
  children: SceneNode[];
}): SpatialBindingEntry[] {
  const entries: SpatialBindingEntry[] = [];

  function scanNode(node: SceneNode) {
    const { x, y } = node.transform.position;

    if (node.type === "display_element") {
      const de = node as DisplayElement;
      const [w, h] = displayElementSize(de);
      const pointIds = new Set<string>();
      if (de.binding?.pointId) pointIds.add(de.binding.pointId);
      if (de.binding?.expressionId) pointIds.add(de.binding.expressionId);
      if (pointIds.size > 0) {
        entries.push({
          nodeId: de.id,
          bbox: { left: x, top: y, right: x + w, bottom: y + h },
          lodLevel: displayElementLod(de.displayType),
          pointIds,
        });
      }
    } else if (node.type === "symbol_instance") {
      const si = node as SymbolInstance;
      const pointIds = new Set<string>();
      if (si.stateBinding?.pointId) pointIds.add(si.stateBinding.pointId);
      if (si.stateBinding?.expressionId)
        pointIds.add(si.stateBinding.expressionId);
      if (pointIds.size > 0) {
        entries.push({
          nodeId: si.id,
          bbox: { left: x, top: y, right: x + 200, bottom: y + 200 },
          lodLevel: 0,
          pointIds,
        });
      }
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode);
    }
  }

  for (const node of doc.children) scanNode(node);
  return entries.sort((a, b) => a.bbox.left - b.bbox.left);
}

function queryFlatIndex(
  index: SpatialBindingEntry[],
  left: number,
  top: number,
  right: number,
  bottom: number,
  currentLod: number,
): Set<string> {
  const visible = new Set<string>();
  for (const entry of index) {
    if (entry.bbox.left > right) break;
    if (entry.lodLevel > currentLod) continue;
    if (
      entry.bbox.right < left ||
      entry.bbox.top > bottom ||
      entry.bbox.bottom < top
    )
      continue;
    for (const id of entry.pointIds) visible.add(id);
  }
  return visible;
}

function queryRBushIndex(
  tree: RBush<RBushItem>,
  left: number,
  top: number,
  right: number,
  bottom: number,
  currentLod: number,
): Set<string> {
  const visible = new Set<string>();
  const results = tree.search({
    minX: left,
    minY: top,
    maxX: right,
    maxY: bottom,
  });
  for (const item of results) {
    if (item.entry.lodLevel > currentLod) continue;
    for (const id of item.entry.pointIds) visible.add(id);
  }
  return visible;
}

function buildRBushIndex(entries: SpatialBindingEntry[]): RBush<RBushItem> {
  const tree = new RBush<RBushItem>();
  const items: RBushItem[] = entries.map((entry) => ({
    minX: entry.bbox.left,
    minY: entry.bbox.top,
    maxX: entry.bbox.right,
    maxY: entry.bbox.bottom,
    entry,
  }));
  tree.load(items);
  return tree;
}

function getBufferFraction(zoom: number): number {
  const zoomPct = zoom * 100;
  if (zoomPct > 100) return 0.1;
  if (zoomPct > 30) return 0.08;
  return 0.05;
}

const RBUSH_THRESHOLD = 2000;

// ---------------------------------------------------------------------------
// Toolbar button style
// ---------------------------------------------------------------------------

const toolbarBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--io-border)",
  borderRadius: 4,
  padding: "2px 8px",
  cursor: "pointer",
  fontSize: 11,
  color: "var(--io-text-muted)",
  display: "flex",
  alignItems: "center",
  gap: 3,
  lineHeight: "1.5",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

// ---------------------------------------------------------------------------
// Live clock hook
// ---------------------------------------------------------------------------

function useClock(): string {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString()),
      1000,
    );
    return () => clearInterval(id);
  }, []);
  return time;
}

// ---------------------------------------------------------------------------
// ProcessDetachedView
// ---------------------------------------------------------------------------

export default function ProcessDetachedView() {
  const { viewId } = useParams<{ viewId: string }>();
  const clock = useClock();

  // ---- Graphic data ---------------------------------------------------------

  const { data: graphic, isLoading } = useQuery({
    queryKey: ["graphic", viewId],
    queryFn: async () => {
      if (!viewId) return null;
      const result = await graphicsApi.get(viewId);
      if (result.success) return result.data ?? null;
      return null;
    },
    enabled: !!viewId,
  });

  const viewName = graphic?.name ?? viewId ?? "";

  // ---- Viewport state -------------------------------------------------------

  const [viewport, setViewport] = useState<ViewportState>({
    panX: 0,
    panY: 0,
    zoom: 1,
    canvasWidth: 1920,
    canvasHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  // Viewport resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewport((vp) => ({
          ...vp,
          screenWidth: width,
          screenHeight: height,
        }));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto zoom-to-fit on graphic load (spec §Non-Negotiable #9)
  useEffect(() => {
    if (!graphic?.scene_data) return;
    const { width, height } = graphic.scene_data.canvas;
    setViewport((vp) => {
      const PADDING = 20;
      const sw = vp.screenWidth - PADDING * 2;
      const sh = vp.screenHeight - PADDING * 2;
      const fitZoom = sw > 0 && sh > 0 ? Math.min(sw / width, sh / height) : 1;
      return {
        ...vp,
        canvasWidth: width,
        canvasHeight: height,
        panX: -PADDING / fitZoom,
        panY: -PADDING / fitZoom,
        zoom: fitZoom,
      };
    });
  }, [graphic?.scene_data]);

  // ---- Zoom controls -------------------------------------------------------

  const zoomIn = useCallback(() => {
    setViewport((vp) => ({ ...vp, zoom: Math.min(8, vp.zoom * 1.25) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((vp) => ({ ...vp, zoom: Math.max(0.05, vp.zoom / 1.25) }));
  }, []);

  const zoomFit = useCallback(() => {
    if (!graphic?.scene_data) return;
    const { width, height } = graphic.scene_data.canvas;
    setViewport((vp) => {
      const fitZoom = Math.min(
        vp.screenWidth / width,
        vp.screenHeight / height,
      );
      return { ...vp, zoom: fitZoom, panX: 0, panY: 0 };
    });
  }, [graphic?.scene_data]);

  // ---- Minimap -------------------------------------------------------------

  const [minimapVisible, setMinimapVisible] = useState(true);
  const [minimapCollapsed, setMinimapCollapsed] = useState(false);

  const handleMinimapViewportChange = useCallback(
    (panX: number, panY: number) => {
      setViewport((vp) => ({ ...vp, panX, panY }));
    },
    [],
  );

  // ---- Fullscreen ----------------------------------------------------------

  const [isFullscreen, setIsFullscreen] = useState(false);

  function toggleFullscreen() {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
    setIsFullscreen((v) => !v);
  }

  // ---- Pointer / pan handlers ----------------------------------------------

  const activePointers = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchBaseZoom = useRef<number | null>(null);
  const pinchBaseDist = useRef<number>(0);
  const pinchMidCanvas = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === "touch" && activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      if (dist >= 60) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
          setViewport((vp) => {
            pinchBaseZoom.current = vp.zoom;
            pinchBaseDist.current = dist;
            pinchMidCanvas.current = {
              x: midX / vp.zoom + vp.panX,
              y: midY / vp.zoom + vp.panY,
            };
            return vp;
          });
        }
      }
      return;
    }
    const target = e.target as HTMLElement;
    const isBackground =
      target === containerRef.current || target.tagName === "DIV";
    if (
      e.button !== 1 &&
      !(e.button === 0 && e.altKey) &&
      !(e.button === 0 && isBackground)
    )
      return;
    isPanning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (
        e.pointerType === "touch" &&
        activePointers.current.size === 2 &&
        pinchBaseZoom.current !== null
      ) {
        const pts = Array.from(activePointers.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const ratio = dist / pinchBaseDist.current;
        const newZoom = Math.max(
          0.05,
          Math.min(8, pinchBaseZoom.current * ratio),
        );
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
          setViewport((vp) => ({
            ...vp,
            zoom: newZoom,
            panX: pinchMidCanvas.current.x - midX / newZoom,
            panY: pinchMidCanvas.current.y - midY / newZoom,
          }));
        }
        return;
      }
      if (!isPanning.current) return;
      const dx = (e.clientX - lastPointer.current.x) / viewport.zoom;
      const dy = (e.clientY - lastPointer.current.y) / viewport.zoom;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setViewport((vp) => ({ ...vp, panX: vp.panX - dx, panY: vp.panY - dy }));
    },
    [viewport.zoom],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchBaseZoom.current = null;
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setViewport((vp) => {
      const newZoom = Math.max(0.05, Math.min(8, vp.zoom * zoomFactor));
      const canvasX = mouseX / vp.zoom + vp.panX;
      const canvasY = mouseY / vp.zoom + vp.panY;
      return {
        ...vp,
        zoom: newZoom,
        panX: canvasX - mouseX / newZoom,
        panY: canvasY - mouseY / newZoom,
      };
    });
  }, []);

  // ---- Keyboard shortcuts (subset of index.tsx §12.1) ----------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const ctrl = e.ctrlKey || e.metaKey;
      const PAN_STEP = e.shiftKey ? 500 : 100;
      if (!ctrl) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setViewport((vp) => ({ ...vp, panX: vp.panX - PAN_STEP / vp.zoom }));
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setViewport((vp) => ({ ...vp, panX: vp.panX + PAN_STEP / vp.zoom }));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setViewport((vp) => ({ ...vp, panY: vp.panY - PAN_STEP / vp.zoom }));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setViewport((vp) => ({ ...vp, panY: vp.panY + PAN_STEP / vp.zoom }));
          return;
        }
        if (e.key === "m" || e.key === "M") {
          setMinimapVisible((v) => !v);
          return;
        }
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          zoomIn();
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          zoomOut();
          return;
        }
      }
      if (ctrl && e.key === "0") {
        e.preventDefault();
        zoomFit();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomIn, zoomOut, zoomFit]);

  // ---- Debounced viewport for subscriptions --------------------------------

  const [debouncedVp, setDebouncedVp] = useState(viewport);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedVp(viewport), 200);
    return () => clearTimeout(id);
  }, [viewport]);

  // ---- Spatial binding index -----------------------------------------------

  const bindingIndex = useMemo(() => {
    if (!graphic?.scene_data) return [];
    return buildBindingIndex(graphic.scene_data);
  }, [graphic?.scene_data]);

  const rbushIndex = useMemo(() => {
    if (bindingIndex.length <= RBUSH_THRESHOLD) return null;
    return buildRBushIndex(bindingIndex);
  }, [bindingIndex]);

  // ---- Visible point IDs ---------------------------------------------------

  const visiblePointIds = useMemo(() => {
    if (!bindingIndex.length) return [];
    const bufFrac = getBufferFraction(debouncedVp.zoom);
    const visW = debouncedVp.screenWidth / debouncedVp.zoom;
    const visH = debouncedVp.screenHeight / debouncedVp.zoom;
    const buf = Math.max(visW, visH) * bufFrac;
    const left = debouncedVp.panX - buf;
    const top = debouncedVp.panY - buf;
    const right = debouncedVp.panX + visW + buf;
    const bottom = debouncedVp.panY + visH + buf;
    const currentLod = zoomToLod(debouncedVp.zoom);

    const visible = rbushIndex
      ? queryRBushIndex(rbushIndex, left, top, right, bottom, currentLod)
      : queryFlatIndex(bindingIndex, left, top, right, bottom, currentLod);

    return Array.from(visible);
  }, [bindingIndex, rbushIndex, debouncedVp]);

  // ---- Real-time / historical values ---------------------------------------

  const { mode: playbackMode, timestamp: playbackTs } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  const { values: wsValues, connectionState } = useWebSocketRaf(
    isHistorical ? [] : visiblePointIds,
  );
  const historicalValues = useHistoricalValues(
    isHistorical ? visiblePointIds : [],
    isHistorical ? playbackTs : undefined,
  );

  const pointValues = useMemo(() => {
    const source = isHistorical ? historicalValues : wsValues;
    const out = new Map<string, ScenePointValue>();
    for (const [id, pv] of source) {
      out.set(id, {
        pointId: pv.pointId,
        value: pv.value,
        quality:
          pv.quality === "good" ||
          pv.quality === "bad" ||
          pv.quality === "uncertain"
            ? pv.quality
            : undefined,
      });
    }
    return out;
  }, [isHistorical, wsValues, historicalValues]);

  // ---- Derived values ------------------------------------------------------

  const zoomPct = Math.round(viewport.zoom * 100);

  const connectedDot =
    connectionState === "connected"
      ? { color: "#22C55E", label: "Connected" }
      : connectionState === "connecting"
        ? { color: "#EAB308", label: "Connecting" }
        : { color: "#EF4444", label: "Disconnected" };

  // ---- Render --------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--io-bg)",
        overflow: "hidden",
      }}
    >
      {/* Thin title bar — spec §11.2 */}
      <div
        style={{
          height: 32,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 10px",
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
          userSelect: "none",
        }}
      >
        {/* Connection status dot */}
        <span
          title={connectedDot.label}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: connectedDot.color,
            flexShrink: 0,
          }}
        />

        {/* View name */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--io-text-primary)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isLoading ? "Loading…" : viewName}
        </span>

        {/* Zoom level indicator */}
        <span
          style={{ fontSize: 11, color: "var(--io-text-muted)", flexShrink: 0 }}
        >
          {zoomPct}%
        </span>

        {/* Basic controls — spec §11.2 */}
        <button onClick={zoomOut} title="Zoom out" style={toolbarBtnStyle}>
          −
        </button>
        <button onClick={zoomIn} title="Zoom in" style={toolbarBtnStyle}>
          +
        </button>
        <button
          onClick={zoomFit}
          title="Zoom to fit (Ctrl+0)"
          style={toolbarBtnStyle}
        >
          Fit
        </button>
        <button
          onClick={() => setMinimapVisible((v) => !v)}
          title="Toggle minimap (M)"
          style={{
            ...toolbarBtnStyle,
            background: minimapVisible
              ? "var(--io-accent-subtle)"
              : "transparent",
            color: minimapVisible ? "var(--io-accent)" : "var(--io-text-muted)",
            borderColor: minimapVisible
              ? "var(--io-accent)"
              : "var(--io-border)",
          }}
        >
          Map
        </button>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          style={toolbarBtnStyle}
        >
          {isFullscreen ? "⤡" : "⤢"}
        </button>

        {/* Live clock */}
        <span
          style={{
            fontSize: 11,
            color: "var(--io-text-muted)",
            flexShrink: 0,
            fontFamily: "monospace",
          }}
        >
          {clock}
        </span>
      </div>

      {/* Viewport canvas — full remaining height, no sidebar */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Loading state */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            <div
              className="io-skeleton"
              style={{ width: "80%", height: "80%", borderRadius: 8 }}
            />
          </div>
        )}

        {/* Empty / not found */}
        {!isLoading && !graphic?.scene_data && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: "var(--io-text-muted)",
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity={0.4}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 500,
                color: "var(--io-text-primary)",
              }}
            >
              View not found
            </p>
            <p style={{ margin: 0, fontSize: 12 }}>ID: {viewId}</p>
          </div>
        )}

        {/* Scene renderer — independent viewport state */}
        {graphic?.scene_data && (
          <SceneRenderer
            document={graphic.scene_data}
            viewport={viewport}
            pointValues={pointValues}
            style={{ position: "absolute", inset: 0 }}
          />
        )}

        {/* Minimap overlay */}
        {graphic?.scene_data && (
          <ProcessMinimap
            canvasWidth={viewport.canvasWidth}
            canvasHeight={viewport.canvasHeight}
            panX={viewport.panX}
            panY={viewport.panY}
            zoom={viewport.zoom}
            screenWidth={viewport.screenWidth}
            screenHeight={viewport.screenHeight}
            onViewportChange={handleMinimapViewportChange}
            sceneData={graphic.scene_data}
            visible={minimapVisible}
            collapsed={minimapCollapsed}
            onCollapsedChange={setMinimapCollapsed}
          />
        )}
      </div>
    </div>
  );
}
