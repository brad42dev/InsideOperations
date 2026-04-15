import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { usePointMeta } from "../hooks/usePointMeta";
import type { PointDetail } from "../../api/points";
import { resolvePointLabel } from "../utils/resolvePointLabel";
import type {
  GraphicDocument,
  SceneNode,
  SymbolInstance,
  DisplayElement,
  Primitive,
  Pipe,
  TextBlock,
  Group,
  Annotation,
  ImageNode,
  EmbeddedSvgNode,
  WidgetNode,
  ViewportState,
  LayerDefinition,
  TextReadoutConfig,
  AnalogBarConfig,
  FillGaugeConfig,
  SparklineConfig,
  DigitalStatusConfig,
  Stencil,
} from "../types/graphics";
import { canvasToScreen } from "../types/graphics";
import { ALARM_COLORS, ZONE_FILLS, DE_COLORS } from "./displayElementColors";
import { fetchShapes, type ShapeData } from "./shapeCache";
import { graphicsApi } from "../../api/graphics";
import "./alarmFlash.css";
import "./operationalState.css";
import "./lod.css";
import { wsManager } from "../hooks/useWebSocket";
import type { PointValue as WsPointValue } from "../hooks/useWebSocket";
import { wsWorkerConnector } from "../hooks/useWsWorker";
import type { AlarmStateUpdate } from "../hooks/useWsWorker";
import { SharedSvgDefs } from "./svgDefs";
import { buildNodeTransform } from "./nodeTransforms";
import {
  renderPrimitiveSvg,
  renderTextBlockSvg,
  renderAnnotationSvg,
  renderImageSvg,
  renderEmbeddedSvgSvg,
  renderStencilSvg,
  renderPipeSvg,
  renderDisplayElementSvg,
  renderGroupSvg,
  renderSymbolInstanceSvg,
  formatValue,
  ALARM_PRIORITY_NAMES,
  type RenderContext,
  type StencilRenderContext,
  type PipeRenderContext,
  type DisplayElementRenderContext,
  type SymbolInstanceRenderContext,
  type GroupRenderContext,
} from "./renderNodeSvg";

// ---- Point value types received from WebSocket ----

export interface PointValue {
  pointId: string;
  value: string | number | null;
  units?: string;
  tag?: string;
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  unacknowledged?: boolean;
  /** OPC UA quality: 'good' | 'bad' | 'uncertain' | 'comm_fail' | string */
  quality?: string;
  /** True when no update received within stale timeout */
  stale?: boolean;
  /** True when point is in manual/forced override */
  manual?: boolean;
  description?: string;
  /** Client-side receipt timestamp (ms) — set to Date.now() when WS message arrives */
  lastUpdateMs?: number;
}

// ---- Props ----

export interface SceneRendererProps {
  /** The graphic document to render */
  document: GraphicDocument;
  /** Viewport state for pan/zoom */
  viewport?: ViewportState;
  /** Live point values keyed by pointId */
  pointValues?: Map<string, PointValue>;
  /** Sparkline history data keyed by pointId — array of numeric values, oldest first */
  sparklineHistories?: Map<string, number[]>;
  /** Called when a node with a navigationLink is clicked */
  onNavigate?: (targetGraphicId: string, targetUrl?: string) => void;
  /** Designer mode — show selection handles, grid, locked indicators */
  designerMode?: boolean;
  /** Selected node IDs (designer mode only) */
  selectedNodeIds?: Set<string>;
  /** Callback when a node is clicked (designer mode) */
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  /** SVG preserveAspectRatio attribute — 'xMidYMid meet' (default) or 'none' to stretch */
  preserveAspectRatio?: string;
  /**
   * When true, SceneRenderer subscribes to wsManager directly and applies point-value
   * updates via direct SVG DOM mutation (bypassing React re-renders on the hot path).
   * Set false for designer mode and historical/playback mode (those pass pointValues prop).
   */
  liveSubscribe?: boolean;
  /**
   * Override the zoom-derived LOD level. When set, this level is forced for all shapes
   * regardless of the current zoom. Useful for the global LOD toggle in Console/Process.
   */
  forceLod?: 1 | 2 | 3;
  /**
   * When true, renders display elements in placeholder/no-data state.
   * Use for wizard and drop-dialog previews where no live point data exists.
   * Currently affects: alarm_indicator (shown as ghost placeholder instead of hidden).
   */
  previewMode?: boolean;
  /**
   * Per-node overlay hook. Called after rendering each node. DesignerCanvas uses this
   * to inject selection highlights, resize handles, and rotation handles without
   * coupling SceneRenderer to designer concepts.
   * Return null to render no overlay for a given node.
   */
  renderNodeOverlay?: (node: SceneNode) => React.ReactElement | null;
  className?: string;
  style?: React.CSSProperties;
}

// ---- Main renderer ----

export function SceneRenderer({
  document,
  viewport,
  pointValues = new Map(),
  sparklineHistories = new Map(),
  onNavigate,
  designerMode = false,
  selectedNodeIds = new Set(),
  onNodeClick,
  preserveAspectRatio = "xMidYMid meet",
  liveSubscribe = false,
  forceLod,
  previewMode = false,
  renderNodeOverlay,
  className,
  style,
}: SceneRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [shapeMap, setShapeMap] = useState<Map<string, ShapeData>>(new Map());
  const [stencilMap, setStencilMap] = useState<Map<string, string>>(new Map());
  // Tag-to-UUID resolution for PortablePointBinding (pointTag) bindings
  const [resolvedTagMap, setResolvedTagMap] = useState<Map<string, string>>(
    new Map(),
  );

  const { canvas, layers, children } = document;
  const vp = viewport ?? {
    panX: 0,
    panY: 0,
    zoom: 1,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    screenWidth: canvas.width,
    screenHeight: canvas.height,
  };

  // LOD level from zoom (process-implementation-spec §4.3)
  const lodLevel =
    vp.zoom < 0.15 ? 0 : vp.zoom < 0.4 ? 1 : vp.zoom < 0.8 ? 2 : 3;
  // forceLod overrides zoom-derived level (global LOD toggle from Console/Process toolbar)
  const effectiveLod: number = forceLod ?? lodLevel;

  // Apply LOD class to container div (process-implementation-spec §4.3.3)
  const containerDivRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerDivRef.current;
    if (!el) return;
    el.classList.remove("lod-0", "lod-1", "lod-2", "lod-3");
    el.classList.add(`lod-${effectiveLod}`);
  }, [effectiveLod]);

  // ---- Live DOM mutation path (spec §5.1 Real-Time Update Pipeline) ----
  // nodeId → {displayType, config, binding} for applyPointValue lookups
  type NodeConfig = {
    displayType: string;
    config: unknown;
    binding: { pointId?: string; expressionId?: string };
  };
  const nodeConfigMapRef = useRef<Map<string, NodeConfig>>(new Map());
  // pointId → SVGGElement[] for O(1) element lookup
  const pointToElementsRef = useRef<Map<string, SVGGElement[]>>(new Map());
  // Mutable update buffer — incoming WS messages accumulate here, drained each rAF
  const pendingDomRef = useRef<Map<string, WsPointValue>>(new Map());
  const domRafPendingRef = useRef(false);
  // Last-known PV per point — used to re-apply when alarm state changes independently
  const lastPvRef = useRef<Map<string, WsPointValue>>(new Map());
  // Current alarm state per point — merged into PV on each DOM apply
  const alarmStateRef = useRef<Map<string, AlarmStateUpdate>>(new Map());
  // pointId → last client-side receipt timestamp (ms) for staleness detection
  const lastUpdateTimestampsRef = useRef<Map<string, number>>(new Map());

  // Collect all point IDs from the scene graph for metadata fetching.
  // UUID regex to skip tag-name bindings (those are resolved via resolvedTagMap).
  const UUID_RE_OUTER =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const allPointIds = useMemo(() => {
    const ids: string[] = [];
    function walkForPointIds(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === "display_element") {
          const de = n as DisplayElement;
          if (de.binding.pointId && UUID_RE_OUTER.test(de.binding.pointId))
            ids.push(de.binding.pointId);
        }
        if (n.type === "symbol_instance") {
          const si = n as SymbolInstance;
          if (
            si.stateBinding?.pointId &&
            UUID_RE_OUTER.test(si.stateBinding.pointId)
          )
            ids.push(si.stateBinding.pointId);
          for (const child of si.children) {
            const de = child as DisplayElement;
            if (de.binding?.pointId && UUID_RE_OUTER.test(de.binding.pointId))
              ids.push(de.binding.pointId);
          }
        }
        if (
          "children" in n &&
          n.type !== "symbol_instance" &&
          Array.isArray(n.children)
        ) {
          walkForPointIds(n.children as SceneNode[]);
        }
      }
    }
    walkForPointIds(children);
    return [...new Set(ids)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id, children]);

  // Fetch and cache PointDetail (including enum_labels) for all bound points.
  const pointMetaMap = usePointMeta(allPointIds);
  // Store in a ref so the rAF DOM-mutation callback can access the latest map
  // without capturing a stale closure.
  const pointMetaMapRef = useRef<Map<string, PointDetail>>(new Map());
  useEffect(() => {
    pointMetaMapRef.current = pointMetaMap;
  }, [pointMetaMap]);

  // Build node config map whenever the scene graph changes
  useEffect(() => {
    if (!liveSubscribe) return;
    const map = new Map<string, NodeConfig>();
    function walkForConfigs(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === "display_element") {
          const de = n as DisplayElement;
          map.set(de.id, {
            displayType: de.displayType,
            config: de.config,
            binding: de.binding,
          });
        }
        if (n.type === "symbol_instance") {
          const si = n as SymbolInstance;
          if (
            si.stateBinding?.pointId ||
            si.stateBinding?.expressionId ||
            si.stateBinding?.pointTag
          ) {
            map.set(si.id, {
              displayType: "symbol_state",
              config: {},
              binding: {
                pointId: si.stateBinding.pointId,
                expressionId: si.stateBinding.expressionId,
              },
            });
          }
          for (const child of si.children) {
            const de = child as DisplayElement;
            map.set(de.id, {
              displayType: de.displayType,
              config: de.config,
              binding: de.binding,
            });
          }
        }
        if (
          "children" in n &&
          n.type !== "symbol_instance" &&
          Array.isArray(n.children)
        ) {
          walkForConfigs(n.children as SceneNode[]);
        }
      }
    }
    walkForConfigs(children);
    nodeConfigMapRef.current = map;
  }, [document.id, children, liveSubscribe]);

  // After each render: rebuild pointToElements map from DOM and subscribe to wsManager
  useEffect(() => {
    if (!liveSubscribe || !svgRef.current) return;

    if (wsManager.getState() === "disconnected") {
      void wsManager.connect();
    }

    // Query all point-bound elements and build the lookup map
    const map = new Map<string, SVGGElement[]>();
    const elements =
      svgRef.current.querySelectorAll<SVGGElement>("[data-point-id]");
    for (const el of elements) {
      const pointId = el.getAttribute("data-point-id");
      if (!pointId) continue;
      if (!map.has(pointId)) map.set(pointId, []);
      map.get(pointId)!.push(el);
    }
    pointToElementsRef.current = map;

    const pointIds = Array.from(map.keys());
    if (pointIds.length === 0) return;

    // Staleness check — run on each rAF tick and periodically via interval.
    // Adds/removes 'io-stale' class on SVG elements for CSS-driven stale styling.
    const STALE_THRESHOLD_MS = 60_000;
    function checkStaleness() {
      const now = Date.now();
      for (const [pid, lastMs] of lastUpdateTimestampsRef.current) {
        const els = pointToElementsRef.current.get(pid);
        if (!els) continue;
        const isStale = now - lastMs > STALE_THRESHOLD_MS;
        for (const el of els) {
          if (isStale) el.classList.add("io-stale");
          else el.classList.remove("io-stale");
        }
      }
    }

    const handler = (pv: WsPointValue) => {
      // Record receipt timestamp and merge current alarm state before buffering
      const now = Date.now();
      lastUpdateTimestampsRef.current.set(pv.pointId, now);
      const alarm = alarmStateRef.current.get(pv.pointId);
      const pvWithAlarm: WsPointValue = {
        ...(alarm
          ? {
              ...pv,
              alarmPriority: (alarm.active || alarm.unacknowledged
                ? alarm.priority
                : null) as 1 | 2 | 3 | 4 | 5 | null,
            }
          : pv),
        lastUpdateMs: now,
      };
      lastPvRef.current.set(pv.pointId, pvWithAlarm);
      pendingDomRef.current.set(pv.pointId, pvWithAlarm);
      if (!domRafPendingRef.current) {
        domRafPendingRef.current = true;
        requestAnimationFrame(() => {
          domRafPendingRef.current = false;
          const pending = pendingDomRef.current;
          if (pending.size === 0) return;
          const updates = new Map(pending);
          pending.clear();
          for (const [pid, update] of updates) {
            const els = pointToElementsRef.current.get(pid);
            if (!els) continue;
            for (const el of els) {
              const nodeId = el.getAttribute("data-node-id");
              if (!nodeId) continue;
              const conf = nodeConfigMapRef.current.get(nodeId);
              if (!conf) continue;
              applyPointValue(
                el,
                conf.displayType,
                conf.config,
                update,
                pid,
                pointMetaMapRef.current,
              );
            }
          }
          checkStaleness();
        });
      }
    };

    // Alarm state changes arrive independently of point value updates.
    // Re-apply the last-known PV merged with the new alarm state so visual
    // alarm indicators update immediately without waiting for the next data tick.
    const alarmHandler = (alarm: AlarmStateUpdate) => {
      alarmStateRef.current.set(alarm.point_id, alarm);
      const lastPv = lastPvRef.current.get(alarm.point_id);
      const els = pointToElementsRef.current.get(alarm.point_id);
      if (!els || !lastPv) return;
      const pvWithAlarm: WsPointValue = {
        ...lastPv,
        alarmPriority: (alarm.active || alarm.unacknowledged
          ? alarm.priority
          : null) as 1 | 2 | 3 | 4 | 5 | null,
      };
      lastPvRef.current.set(alarm.point_id, pvWithAlarm);
      for (const el of els) {
        const nodeId = el.getAttribute("data-node-id");
        if (!nodeId) continue;
        const conf = nodeConfigMapRef.current.get(nodeId);
        if (!conf) continue;
        applyPointValue(
          el,
          conf.displayType,
          conf.config,
          pvWithAlarm,
          alarm.point_id,
          pointMetaMapRef.current,
        );
      }
    };

    pointIds.forEach((id) => wsManager.subscribe(id, handler));
    const unsubAlarm = wsWorkerConnector.onAlarmStateChange(alarmHandler);

    // Periodic staleness sweep — catches points that stop receiving updates.
    // Runs every 5s; 60s threshold applied inside checkStaleness().
    const staleInterval = setInterval(checkStaleness, 5_000);

    return () => {
      pointIds.forEach((id) => wsManager.unsubscribe(id, handler));
      unsubAlarm();
      clearInterval(staleInterval);
      pendingDomRef.current.clear();
      lastPvRef.current.clear();
      lastUpdateTimestampsRef.current.clear();
    };
  }, [document.id, children, liveSubscribe, resolvedTagMap]);

  // Build layer lookup
  const layerMap = new Map<string, LayerDefinition>();
  for (const l of layers) layerMap.set(l.id, l);

  // Check if node is visible (respects layer visibility)
  function isNodeVisible(node: SceneNode): boolean {
    if (!node.visible) return false;
    if (node.layerId) {
      const layer = layerMap.get(node.layerId);
      if (layer && !layer.visible) return false;
    }
    return true;
  }

  // Collect base shape IDs only (symbol_instance.shapeRef.shapeId).
  // Part shape IDs are derived in a second pass once base sidecars are loaded,
  // because the part file name lives in the base shape's sidecar addons list.
  const collectBaseShapeIds = useCallback((nodes: SceneNode[]): string[] => {
    const ids: string[] = [];
    function walk(n: SceneNode) {
      if (n.type === "symbol_instance") {
        ids.push((n as SymbolInstance).shapeRef.shapeId);
      }
      if ("children" in n && Array.isArray(n.children)) {
        for (const c of n.children) walk(c as SceneNode);
      }
    }
    for (const n of nodes) walk(n);
    return [...new Set(ids)];
  }, []);

  // Fetch shapes on mount / document change — two phases:
  // 1. Fetch base shapes; 2. derive part shape IDs from base sidecars and fetch those.
  useEffect(() => {
    const baseIds = collectBaseShapeIds(children);
    if (baseIds.length === 0) return;
    let cancelled = false;

    // Always load from public static files (canonical source, always current).
    // The DB-backed batchShapes API can return stale sidecars that lack `addons`/
    // `compositeAttachments`, which breaks composable part resolution in Phase 2.
    fetchShapes(baseIds)
      .then(async (baseMap) => {
        if (cancelled) return;
        // Phase 2: walk symbol_instance nodes, look up each composable part's addon
        // in the base shape sidecar, and derive the part shape ID from addon.file.
        const partIds: string[] = [];
        function walkForParts(nodes: SceneNode[]) {
          for (const n of nodes) {
            if (n.type === "symbol_instance") {
              const si = n as SymbolInstance;
              const baseSidecar = baseMap.get(si.shapeRef.shapeId)?.sidecar;
              for (const cp of si.composableParts ?? []) {
                const pid =
                  cp.partId ??
                  (cp as unknown as Record<string, string>)["part_id"];
                if (!pid) continue;
                const addon = baseSidecar?.addons?.find((a) => a.id === pid);
                if (addon) partIds.push(addon.file.replace(/\.svg$/, ""));
              }
            }
            if ("children" in n && Array.isArray(n.children)) {
              walkForParts(n.children as SceneNode[]);
            }
          }
        }
        walkForParts(children);

        const uniquePartIds = [...new Set(partIds)];
        if (uniquePartIds.length === 0) {
          if (!cancelled) setShapeMap(baseMap);
          return;
        }
        const partMap = await fetchShapes(uniquePartIds);
        if (!cancelled) setShapeMap(new Map([...baseMap, ...partMap]));
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [document.id, children, collectBaseShapeIds]);

  // Collect stencil IDs and fetch their SVG on mount / document change
  useEffect(() => {
    const stencilIds: string[] = [];
    function walkForStencils(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === "stencil")
          stencilIds.push((n as Stencil).stencilRef.stencilId);
        if ("children" in n && Array.isArray(n.children))
          walkForStencils(n.children as SceneNode[]);
      }
    }
    walkForStencils(children);
    const unique = [...new Set(stencilIds)];
    if (unique.length === 0) return;

    Promise.all(
      unique.map(async (id) => {
        try {
          const resp = await fetch(`/api/v1/design-objects/${id}`);
          if (!resp.ok) return null;
          const data = (await resp.json()) as { data?: { svg_data?: string } };
          return data.data?.svg_data ? { id, svg: data.data.svg_data } : null;
        } catch {
          return null;
        }
      }),
    )
      .then((results) => {
        const m = new Map<string, string>();
        for (const r of results) {
          if (r) m.set(r.id, r.svg);
        }
        if (m.size > 0) setStencilMap((prev) => new Map([...prev, ...m]));
      })
      .catch(console.error);
  }, [document.id, children]);

  // Resolve tag-based (PortablePointBinding) bindings to UUIDs.
  // Runs once per document load; populates resolvedTagMap so renderDisplayElement
  // can set correct data-point-id values for the live DOM-mutation subscription.
  useEffect(() => {
    const tags: string[] = [];
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function collectTags(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === "display_element") {
          const de = n as DisplayElement;
          if (de.binding.pointTag) tags.push(de.binding.pointTag);
          // Also handle legacy graphics where a tag name was saved into pointId by mistake
          else if (de.binding.pointId && !UUID_RE.test(de.binding.pointId))
            tags.push(de.binding.pointId);
        }
        if (n.type === "symbol_instance") {
          const si = n as SymbolInstance;
          if (si.stateBinding?.pointTag) tags.push(si.stateBinding.pointTag);
          else if (
            si.stateBinding?.pointId &&
            !UUID_RE.test(si.stateBinding.pointId)
          )
            tags.push(si.stateBinding.pointId);
        }
        if ("children" in n && Array.isArray(n.children))
          collectTags(n.children as SceneNode[]);
      }
    }
    collectTags(children);
    const unique = [...new Set(tags)];
    if (unique.length === 0) return;
    graphicsApi
      .resolveTags(unique)
      .then((result) => {
        if (result.success && result.data) {
          const resolved = result.data as unknown as Record<string, string>;
          setResolvedTagMap(new Map(Object.entries(resolved)));
        }
      })
      .catch(console.error);
  }, [document.id, children]);

  // SVG transform for viewport pan/zoom
  const svgTransform = `translate(${-vp.panX * vp.zoom}, ${-vp.panY * vp.zoom}) scale(${vp.zoom})`;

  // ---- Render functions ----

  function handleNodeClick(node: SceneNode, e: React.MouseEvent) {
    if (node.navigationLink) {
      if (node.navigationLink.targetGraphicId) {
        onNavigate?.(
          node.navigationLink.targetGraphicId,
          node.navigationLink.targetUrl,
        );
      } else if (node.navigationLink.targetUrl) {
        window.open(node.navigationLink.targetUrl, "_blank", "noopener");
      }
    }
    onNodeClick?.(node.id, e);
  }

  // Shape size lookup for rotation pivot computation — derives dimensions from
  // the fetched sidecar geometry (same source DesignerCanvas uses via libraryStore).
  function shapeSizeLookup(shapeId: string): { w: number; h: number } | null {
    const entry = shapeMap.get(shapeId);
    if (!entry?.sidecar) return null;
    const geo = entry.sidecar.geometry;
    if (!geo) return null;
    const w = geo.baseSize?.[0] ?? geo.width ?? 64;
    const h = geo.baseSize?.[1] ?? geo.height ?? 64;
    return { w, h };
  }

  function getTransformAttr(node: SceneNode): string {
    return buildNodeTransform(node, shapeSizeLookup);
  }

  // Build a RenderContext for the shared render functions
  function makeRenderCtx(node: SceneNode): RenderContext {
    return {
      transform: getTransformAttr(node),
      onClick: (node.navigationLink || onNodeClick) ? (e: React.MouseEvent) => handleNodeClick(node, e) : undefined,
      cursor: (node.navigationLink || onNodeClick) ? "pointer" : undefined,
    };
  }

  function renderPrimitive(node: Primitive): React.ReactElement | null {
    return renderPrimitiveSvg(node, makeRenderCtx(node));
  }

  function renderPipe(node: Pipe): React.ReactElement {
    const ctx: PipeRenderContext = {
      ...makeRenderCtx(node),
      canvasBgColor: canvas.backgroundColor ?? "var(--io-surface-secondary)",
    };
    return renderPipeSvg(node, ctx);
  }

  function renderTextBlock(node: TextBlock): React.ReactElement {
    const textLod = node.fontSize >= 24 ? 0 : node.fontSize >= 14 ? 1 : 2;
    const ctx = makeRenderCtx(node);
    ctx.dataLod = String(textLod);
    return renderTextBlockSvg(node, ctx);
  }

  function renderImage(node: ImageNode): React.ReactElement {
    return renderImageSvg(node, makeRenderCtx(node));
  }

  function renderEmbeddedSvg(node: EmbeddedSvgNode): React.ReactElement {
    return renderEmbeddedSvgSvg(node, makeRenderCtx(node));
  }

  function renderStencil(node: Stencil): React.ReactElement {
    const ctx: StencilRenderContext = {
      ...makeRenderCtx(node),
      svgContent: stencilMap.get(node.stencilRef.stencilId) ?? null,
      size: { width: node.size?.width ?? 48, height: node.size?.height ?? 48 },
      displayName: node.name,
    };
    return renderStencilSvg(node, ctx);
  }

  // parentOffset: parent-relative offset of this element (used for signal lines).
  // vesselInteriorPath: SVG path string from parent SymbolInstance's sidecar, used for vessel_overlay fill_gauge clip.
  // overrideTransform: when set, use this pre-computed SVG transform string instead of deriving one from the node.
  //   Passed for exterior sidecars with counter-rotation applied in renderSymbolInstanceSvg.
  function renderDisplayElement(
    node: DisplayElement,
    parentOffset?: { x: number; y: number },
    vesselInteriorPath?: string,
    overrideTransform?: string,
  ): React.ReactElement | null {
    // Resolve binding: UUID pointId wins; fall back to resolved tag (pointTag or legacy
    // pointId-stored-as-tag); then expressionId.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawPointId = node.binding.pointId;
    const isTagInPointId = rawPointId && !UUID_RE.test(rawPointId);
    const pvKey =
      (rawPointId && !isTagInPointId ? rawPointId : undefined) ??
      (node.binding.pointTag
        ? resolvedTagMap.get(node.binding.pointTag)
        : undefined) ??
      (isTagInPointId ? resolvedTagMap.get(rawPointId!) : undefined) ??
      node.binding.expressionId;
    const pv = pvKey ? pointValues.get(pvKey) : undefined;
    // Human-readable tag for tooltip — prefer explicit pointTag, fall back to legacy tag-in-pointId
    const pointTag =
      node.binding.pointTag ?? (isTagInPointId ? rawPointId : undefined);

    // Resolve discrete label from point metadata (for digital_status)
    const meta = pvKey ? pointMetaMapRef.current.get(pvKey) : undefined;
    const discreteLabel =
      meta &&
      meta.point_category !== "analog" &&
      typeof pv?.value === "number"
        ? resolvePointLabel(pv.value, meta.point_category, meta.enum_labels)
        : null;

    // Resolve engineering unit from metadata (for text_readout EU display)
    const metaUnit = pvKey ? (pointMetaMap.get(pvKey)?.engineering_unit ?? undefined) : undefined;

    // Resolve setpoint value (for analog_bar)
    let setpointValue: number | null = null;
    if (node.displayType === "analog_bar") {
      const abCfg = node.config as AnalogBarConfig;
      if (abCfg.showSetpoint) {
        const spKey = abCfg.setpointBinding?.pointId ?? abCfg.setpointBinding?.expressionId;
        const spPv = spKey ? pointValues.get(spKey) : undefined;
        setpointValue = typeof spPv?.value === "number" ? spPv.value : null;
      }
    }

    // Resolve sparkline history
    const sparklineHistory = pvKey ? sparklineHistories.get(pvKey) : undefined;

    // Build context and delegate to shared pure function.
    // overrideTransform is pre-computed by renderSymbolInstanceSvg for exterior sidecars —
    // it embeds counter-rotation so the element keeps its canvas position/orientation.
    const transform = overrideTransform ?? getTransformAttr(node);
    const deCtx: DisplayElementRenderContext = {
      transform,
      pvKey,
      pointValue: pv ? {
        value: pv.value,
        quality: pv.quality,
        stale: pv.stale,
        manual: pv.manual,
        // Include metaUnit fallback in units so shared function gets the resolved value
        units: pv.units ?? metaUnit ?? undefined,
        alarmPriority: pv.alarmPriority,
        unacknowledged: pv.unacknowledged,
      } : undefined,
      pointTag,
      discreteLabel,
      parentOffset,
      vesselInteriorPath,
      sparklineHistory,
      setpointValue,
      designerMode,
      previewMode,
    };

    return renderDisplayElementSvg(node, deCtx);
  }

  function renderSymbolInstance(node: SymbolInstance): React.ReactElement {
    const shapeData = shapeMap.get(node.shapeRef.shapeId);
    const sidecar = shapeData?.sidecar;

    // Derive operational state CSS class from stateBinding point value
    let stateClass = "";
    const rawStateId = node.stateBinding?.pointId;
    const UUID_RE_SI =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isTagInStateId = rawStateId && !UUID_RE_SI.test(rawStateId);
    const statePvKey =
      (rawStateId && !isTagInStateId ? rawStateId : undefined) ??
      (node.stateBinding?.pointTag
        ? resolvedTagMap.get(node.stateBinding.pointTag)
        : undefined) ??
      (isTagInStateId ? resolvedTagMap.get(rawStateId!) : undefined) ??
      node.stateBinding?.expressionId;
    const statePv = statePvKey ? pointValues.get(statePvKey) : undefined;
    if (statePv) {
      const stateVal =
        statePv.value !== undefined ? String(statePv.value).toLowerCase() : "";
      if (
        stateVal === "running" ||
        stateVal === "1" ||
        stateVal === "true" ||
        stateVal === "on"
      ) {
        stateClass = "io-running";
      } else if (
        stateVal === "fault" ||
        stateVal === "error" ||
        stateVal === "fail"
      ) {
        stateClass = "io-fault";
      } else if (
        stateVal === "transitioning" ||
        stateVal === "starting" ||
        stateVal === "stopping"
      ) {
        stateClass = "io-transitioning";
      } else if (stateVal === "oos" || stateVal === "maintenance") {
        stateClass = "io-oos";
      }
    }

    // Build partShapes map from shapeMap using the sidecar's addon files
    const partShapes = new Map<string, { svg: string; sidecar: import("../types/shapes").ShapeSidecar | null }>();
    if (sidecar?.addons) {
      for (const addon of sidecar.addons) {
        const partId = addon.file.replace(/\.svg$/, "");
        const partData = shapeMap.get(partId);
        if (partData) partShapes.set(partId, partData);
      }
    }

    const isSelected = designerMode && selectedNodeIds.has(node.id);
    const ctx: SymbolInstanceRenderContext = {
      ...makeRenderCtx(node),
      shapeSvg: shapeData?.svg ?? null,
      shapeSidecar: sidecar ?? null,
      partShapes,
      stateClass,
      statePointId: statePvKey,
      isSelected,
      designerMode,
      stateTag: statePv?.tag,
      renderChild: (child, parentOffset, vesselInteriorPath, overrideTransform) =>
        renderDisplayElement(child, parentOffset, vesselInteriorPath, overrideTransform),
    };
    return renderSymbolInstanceSvg(node, ctx);
  }

  function renderAnnotation(node: Annotation): React.ReactElement | null {
    return renderAnnotationSvg(node, makeRenderCtx(node));
  }

  function renderGroup(node: Group): React.ReactElement {
    const ctx: GroupRenderContext = {
      ...makeRenderCtx(node),
      renderChild: (child) => renderNode(child as SceneNode),
    };
    return renderGroupSvg(node, ctx);
  }

  function renderNode(node: SceneNode): React.ReactElement | null {
    if (!isNodeVisible(node)) return null;
    let el: React.ReactElement | null;
    switch (node.type) {
      case "symbol_instance":
        el = renderSymbolInstance(node as SymbolInstance);
        break;
      case "display_element":
        el = renderDisplayElement(node as DisplayElement);
        break;
      case "primitive":
        el = renderPrimitive(node as Primitive);
        break;
      case "pipe":
        el = renderPipe(node as Pipe);
        break;
      case "text_block":
        el = renderTextBlock(node as TextBlock);
        break;
      case "image":
        el = renderImage(node as ImageNode);
        break;
      case "embedded_svg":
        el = renderEmbeddedSvg(node as EmbeddedSvgNode);
        break;
      case "annotation":
        el = renderAnnotation(node as Annotation);
        break;
      case "group":
        el = renderGroup(node as Group);
        break;
      case "stencil":
        el = renderStencil(node as Stencil);
        break;
      case "widget":
        return null; // Widgets render in HTML overlay
      case "graphic_document":
        return null;
      default:
        return null;
    }
    // Wrap with LOD attribute if specified so CSS can hide low-detail elements
    if (el && node.lodLevel && node.lodLevel > 1) {
      el = (
        <g key={`lod-${node.id}`} data-lod={node.lodLevel}>
          {el}
        </g>
      );
    }
    // Call per-node overlay hook (designer uses this for selection rects, resize handles, rotation handle)
    const overlay = renderNodeOverlay?.(node) ?? null;
    if (overlay && el) {
      return (
        <g key={`no-${node.id}`}>
          {el}
          {overlay}
        </g>
      );
    }
    return el;
  }

  // Collect widget nodes for HTML overlay
  const widgetNodes: WidgetNode[] = [];
  function collectWidgets(nodes: SceneNode[]) {
    for (const n of nodes) {
      if (n.type === "widget") widgetNodes.push(n as WidgetNode);
      if ("children" in n && Array.isArray(n.children))
        collectWidgets(n.children as SceneNode[]);
    }
  }
  collectWidgets(children);

  return (
    <div
      ref={containerDivRef}
      className={["io-canvas-container", `lod-${effectiveLod}`, className]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: canvas.backgroundColor,
        ...style,
      }}
    >
      {/* SVG Layer */}
      <svg
        ref={svgRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        preserveAspectRatio={preserveAspectRatio}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bad-phase1 hatch pattern + any future shared defs */}
        <SharedSvgDefs />
        {/* Shared pattern definitions — OOS hatch (spec §Shape Library: Operational State CSS) */}
        <defs>
          <pattern
            id="io-hatch-pattern"
            x="0"
            y="0"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="#52525B"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <g transform={svgTransform}>
          {/* Grid (designer mode only) */}
          {designerMode && document.metadata.gridVisible && (
            <g opacity={0.15}>
              {Array.from(
                {
                  length: Math.ceil(canvas.width / document.metadata.gridSize),
                },
                (_, i) => (
                  <line
                    key={`gv${i}`}
                    x1={i * document.metadata.gridSize}
                    y1={0}
                    x2={i * document.metadata.gridSize}
                    y2={canvas.height}
                    stroke="#71717A"
                    strokeWidth={0.5}
                  />
                ),
              )}
              {Array.from(
                {
                  length: Math.ceil(canvas.height / document.metadata.gridSize),
                },
                (_, i) => (
                  <line
                    key={`gh${i}`}
                    x1={0}
                    y1={i * document.metadata.gridSize}
                    x2={canvas.width}
                    y2={i * document.metadata.gridSize}
                    stroke="#71717A"
                    strokeWidth={0.5}
                  />
                ),
              )}
            </g>
          )}

          {/* Scene nodes */}
          {children.map((node) => renderNode(node))}

          {/* Selection highlights (designer mode) */}
          {designerMode && selectedNodeIds.size > 0 && (
            <g className="io-selection-overlay" pointerEvents="none">
              {/* Selection rings are rendered by the designer, not here */}
            </g>
          )}
        </g>
      </svg>

      {/* HTML Overlay Layer (widgets) */}
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {widgetNodes.map((node) => {
          const screenPos = canvasToScreen(node.transform.position, vp);
          const w = node.width * vp.zoom;
          const h = node.height * vp.zoom;
          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: screenPos.x,
                top: screenPos.y,
                width: w,
                height: h,
                pointerEvents: "auto",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--io-text-muted)",
                fontSize: 12,
              }}
            >
              {node.widgetType}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Helpers ----

// ---- Direct DOM mutation (spec §5.1 Real-Time Update Pipeline) ----
// Called from the rAF drain loop — no React involved.
// Updates SVG child elements in-place using data-role attributes as anchors.

function applyPointValue(
  el: SVGGElement,
  displayType: string,
  config: unknown,
  pv: WsPointValue,
  pointId?: string,
  metaMap?: Map<string, PointDetail>,
): void {
  const value = pv.value;
  const quality = pv.quality;
  const isStale = pv.stale ?? false;
  const isCommFail = quality === "comm_fail";
  const isBad = quality === "bad" && !isCommFail;

  // Resolve discrete label for boolean/discrete_enum points.
  // Returns null for analog points — caller should format numerically.
  const pointMeta = pointId ? metaMap?.get(pointId) : undefined;
  const discreteLabel =
    pointMeta &&
    pointMeta.point_category !== "analog" &&
    typeof value === "number" &&
    !isCommFail &&
    !isBad
      ? resolvePointLabel(
          value,
          pointMeta.point_category,
          pointMeta.enum_labels,
        )
      : null;

  switch (displayType) {
    case "text_readout": {
      const cfg = config as TextReadoutConfig;
      const isUncertain = quality === "uncertain";
      const isManual = pv.manual ?? false;

      // Value text — use discrete label when available, else numeric format
      const rawValueStr = isCommFail
        ? "COMM"
        : isBad
          ? "????"
          : discreteLabel !== null
            ? discreteLabel
            : formatValue(value, cfg.valueFormat);
      const valueColor = isCommFail
        ? DE_COLORS.textMuted
        : isBad
          ? ALARM_COLORS[1]
          : DE_COLORS.textSecondary;

      // Recalculate box width so the combined "value EU" string stays centered.
      // The React render sizes the box from the placeholder value; when the live
      // value arrives with a different character count the box must resize too.
      const minW = parseInt(el.dataset.minWidth ?? "40", 10);

      const textEl = el.querySelector<SVGTextElement>('[data-role="value"]');
      if (textEl) {
        // 1. Update value text content
        const vSpan = textEl.querySelector<SVGTSpanElement>('[data-role="v"]');
        if (vSpan) {
          vSpan.textContent = rawValueStr;
        } else {
          textEl.textContent = rawValueStr;
        }
        textEl.setAttribute("fill", valueColor);

        // 2. Show/hide EU tspan based on comm/bad state
        const euSpan = textEl.querySelector<SVGTSpanElement>('[data-role="eu"]');
        if (euSpan) {
          euSpan.style.display = (!isCommFail && !isBad) ? "" : "none";
        }

        // 3. Measure actual rendered width — exact, no font estimation needed
        const measured = textEl.getComputedTextLength();
        const newW = Math.max(minW, Math.ceil(measured) + 12); // 6px padding each side
        textEl.setAttribute("x", String(Math.round(newW / 2)));

        // 4. Resize the box rect
        const boxFill = isCommFail
          ? DE_COLORS.displayZoneInactive
          : DE_COLORS.surfaceElevated;
        const boxStroke = isBad
          ? ALARM_COLORS[1]
          : isCommFail
            ? DE_COLORS.borderStrong
            : DE_COLORS.border;
        const strokeDash = isBad || isStale ? "4 2" : isUncertain ? "2 2" : "";
        const strokeWidth = isBad || isCommFail ? "2" : "1";
        const rectEl = el.querySelector<SVGRectElement>('[data-role="box"]');
        if (rectEl) {
          rectEl.setAttribute("width", String(newW));
          rectEl.setAttribute("fill", boxFill);
          rectEl.setAttribute("stroke", boxStroke);
          rectEl.setAttribute("stroke-width", strokeWidth);
          if (strokeDash) {
            rectEl.setAttribute("stroke-dasharray", strokeDash);
          } else {
            rectEl.removeAttribute("stroke-dasharray");
          }
        }

        // 5. Re-center label rows (PointName / DisplayName) on the new box width
        const pnEl = el.querySelector<SVGTextElement>('[data-role="pn"]');
        if (pnEl) pnEl.setAttribute("x", String(Math.round(newW / 2)));
        const pnBgEl = el.querySelector<SVGRectElement>('[data-role="pn-bg"]');
        if (pnBgEl) pnBgEl.setAttribute("width", String(newW));
        const dnEl = el.querySelector<SVGTextElement>('[data-role="dn"]');
        if (dnEl) dnEl.setAttribute("x", String(Math.round(newW / 2)));
        const dnBgEl = el.querySelector<SVGRectElement>('[data-role="dn-bg"]');
        if (dnBgEl) dnBgEl.setAttribute("width", String(newW));

        // 6. Re-center the box on the shape slot
        const baseTransform = el.dataset.baseTransform;
        if (baseTransform) {
          el.setAttribute(
            "transform",
            `${baseTransform} translate(${Math.round(20 - newW / 2)},0)`,
          );
        }
      }

      // Opacity (stale = 60%)
      el.style.opacity = isStale ? "0.6" : "";

      // Manual badge — find or create; y offset from value box top (data-value-box-y)
      let badge = el.querySelector<SVGTextElement>(
        '[data-role="manual-badge"]',
      );
      if (isManual) {
        if (!badge) {
          badge = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text",
          );
          badge.setAttribute("data-role", "manual-badge");
          badge.setAttribute("text-anchor", "end");
          badge.setAttribute("dominant-baseline", "hanging");
          badge.setAttribute("font-family", "Inter");
          badge.setAttribute("font-size", "7");
          badge.setAttribute("font-weight", "700");
          badge.setAttribute("fill", DE_COLORS.manualBadge);
          el.appendChild(badge);
        }
        const boxRectEl = el.querySelector<SVGRectElement>('[data-role="box"]');
        const w = boxRectEl ? Number(boxRectEl.getAttribute("width") ?? 60) : 60;
        const boxY = Number(el.getAttribute("data-value-box-y") ?? 0);
        badge.setAttribute("x", String(w - 2));
        badge.setAttribute("y", String(boxY + 2));
        badge.textContent = "M";
        badge.style.display = "";
      } else if (badge) {
        badge.style.display = "none";
      }
      break;
    }

    case "analog_bar": {
      const cfg = config as AnalogBarConfig;
      const numValue = typeof value === "number" ? value : null;
      const alarmPri = pv.alarmPriority as
        | (1 | 2 | 3 | 4 | 5)
        | null
        | undefined;
      const { barWidth: bw, barHeight: bh } = cfg;
      const range = cfg.rangeHi - cfg.rangeLo || 1;
      const pct =
        numValue !== null
          ? Math.max(0, Math.min(1, (numValue - cfg.rangeLo) / range))
          : 0;
      const pointerY = (1 - pct) * bh;
      const pointer = el.querySelector<SVGPolygonElement>(
        '[data-role="pointer"]',
      );
      if (pointer) {
        if (numValue !== null) {
          pointer.setAttribute(
            "points",
            `${bw},${pointerY - 3} ${bw + 6},${pointerY} ${bw},${pointerY + 3}`,
          );
          pointer.style.display = "";
        } else {
          pointer.style.display = "none";
        }
      }
      const pointerLine = el.querySelector<SVGLineElement>(
        '[data-role="pointer-line"]',
      );
      if (pointerLine) {
        if (numValue !== null) {
          pointerLine.setAttribute("y1", String(pointerY));
          pointerLine.setAttribute("y2", String(pointerY));
          pointerLine.style.display = "";
        } else {
          pointerLine.style.display = "none";
        }
      }
      const numericText = el.querySelector<SVGTextElement>(
        '[data-role="numeric"]',
      );
      if (numericText) {
        if (numValue !== null) {
          numericText.textContent = numValue.toFixed(1);
          numericText.style.display = "";
        } else {
          numericText.style.display = "none";
        }
      }

      // Determine which zone the current value falls in
      const { hh, h, l, ll } = cfg.thresholds ?? {};
      const valueZone = (() => {
        if (numValue === null) return null;
        if (hh !== undefined && numValue >= hh) return "hh";
        if (h !== undefined && numValue >= h) return "h";
        if (ll !== undefined && numValue < ll) return "ll";
        if (l !== undefined && numValue < l) return "l";
        return "normal";
      })();

      // Update zone fill colors via DOM mutation
      const zoneRoles: Array<{
        role: string;
        key: keyof typeof ZONE_FILLS;
        priKey:
          | "hhAlarmPriority"
          | "hAlarmPriority"
          | "lAlarmPriority"
          | "llAlarmPriority"
          | null;
      }> = [
        { role: "zone-hh", key: "hh", priKey: "hhAlarmPriority" },
        { role: "zone-h", key: "h", priKey: "hAlarmPriority" },
        { role: "zone-normal", key: "normal", priKey: null },
        { role: "zone-l", key: "l", priKey: "lAlarmPriority" },
        { role: "zone-ll", key: "ll", priKey: "llAlarmPriority" },
      ];
      for (const { role, key, priKey } of zoneRoles) {
        const zoneEl = el.querySelector<SVGRectElement>(
          `[data-role="${role}"]`,
        );
        if (!zoneEl) continue;
        let fill = ZONE_FILLS[key];
        if (
          priKey &&
          valueZone === key &&
          alarmPri &&
          cfg.thresholds?.[priKey]
        ) {
          fill = ALARM_COLORS[cfg.thresholds[priKey]!] ?? fill;
        }
        zoneEl.setAttribute("fill", fill);
      }
      break;
    }

    case "digital_status": {
      const cfg = config as DigitalStatusConfig;
      const rawVal = value !== null ? String(value) : null;
      // Prefer enum label from point metadata (resolvePointLabel), then static
      // stateLabels config, then raw value string as last resort.
      const label =
        rawVal !== null
          ? (cfg.stateLabels[rawVal] ?? discreteLabel ?? rawVal)
          : "---";
      const isNormal = rawVal === null || cfg.normalStates.includes(rawVal);
      const fill = isNormal
        ? DE_COLORS.displayZoneInactive
        : (ALARM_COLORS[cfg.abnormalPriority] ?? ALARM_COLORS[1]);
      const textColor = isNormal
        ? DE_COLORS.textSecondary
        : DE_COLORS.textPrimary;
      const bgRect = el.querySelector<SVGRectElement>('[data-role="bg"]');
      if (bgRect) bgRect.setAttribute("fill", fill);
      const textEl = el.querySelector<SVGTextElement>('[data-role="value"]');
      if (textEl) {
        textEl.textContent = label;
        textEl.setAttribute("fill", textColor);
      }
      break;
    }

    case "fill_gauge": {
      const cfg = config as FillGaugeConfig;
      const numValue = typeof value === "number" ? value : null;
      const range = cfg.rangeHi - cfg.rangeLo || 1;
      const pct =
        numValue !== null
          ? Math.max(0, Math.min(1, (numValue - cfg.rangeLo) / range))
          : 0;
      const bh = cfg.barHeight ?? 90;
      if (cfg.mode === "vessel_overlay") {
        const fillRect = el.querySelector<SVGRectElement>('[data-role="fill"]');
        if (fillRect) {
          // localH and localBottom are baked in as data attrs during initial React render
          const localH = parseFloat(fillRect.getAttribute("data-vessel-h") ?? String(bh));
          const localBottom = parseFloat(fillRect.getAttribute("data-vessel-base-y") ?? String(bh));
          const fillH = pct * localH;
          const fillY = localBottom - fillH;
          fillRect.setAttribute("y", String(fillY));
          fillRect.setAttribute("height", String(Math.max(0, fillH) + 1));
          const levelLine = el.querySelector<SVGLineElement>('[data-role="level-line"]');
          if (levelLine) {
            levelLine.setAttribute("y1", String(fillY));
            levelLine.setAttribute("y2", String(fillY));
          }
          const textEl = el.querySelector<SVGTextElement>('[data-role="value"]');
          if (textEl) {
            const midY = parseFloat(textEl.getAttribute("data-vessel-mid-y") ?? String(localBottom - localH / 2));
            const vpos = textEl.getAttribute("data-value-position") ?? "in-fill";
            const textY = vpos === "center" ? midY : fillH > 4 ? fillY + fillH / 2 : midY;
            textEl.setAttribute("y", String(textY));
            textEl.textContent = `${(pct * 100).toFixed(0)}%`;
          }
        }
      } else {
        const fillH = pct * (bh - 2);
        const fillY = bh - 1 - fillH;
        const fillRect = el.querySelector<SVGRectElement>('[data-role="fill"]');
        if (fillRect) {
          fillRect.setAttribute("y", String(fillY));
          fillRect.setAttribute("height", String(fillH));
        }
        const levelLine = el.querySelector<SVGLineElement>('[data-role="level-line"]');
        if (levelLine) {
          levelLine.setAttribute("y1", String(fillY));
          levelLine.setAttribute("y2", String(fillY));
        }
        const textEl = el.querySelector<SVGTextElement>('[data-role="value"]');
        if (textEl) {
          const vpos = textEl.getAttribute("data-value-position") ?? "in-fill";
          const textY = vpos === "center" ? bh / 2 : fillH > 4 ? fillY + fillH / 2 : bh / 2;
          textEl.setAttribute("y", String(textY));
          textEl.textContent = `${(pct * 100).toFixed(0)}%`;
        }
      }
      break;
    }

    case "sparkline": {
      const cfg = config as SparklineConfig;
      const numVal =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? parseFloat(value)
            : NaN;
      if (!isFinite(numVal)) break;

      // Rolling history stored on the DOM element as [timestamp_ms, value] pairs.
      // Time-windowed: entries older than timeWindowMinutes are evicted on each update.
      type SparkEntry = [number, number];
      const elAny = el as unknown as {
        _sparkHistory?: SparkEntry[];
        _sparkLastDraw?: number;
      };
      if (!elAny._sparkHistory) elAny._sparkHistory = [];
      const history = elAny._sparkHistory;
      const now = pv.timestamp ? new Date(pv.timestamp).getTime() : Date.now();
      history.push([now, numVal]);

      // Evict entries outside the configured time window
      const windowMs = (cfg.timeWindowMinutes ?? 30) * 60 * 1000;
      const cutoff = now - windowMs;
      let evictTo = 0;
      while (evictTo < history.length && history[evictTo][0] < cutoff)
        evictTo++;
      if (evictTo > 0) history.splice(0, evictTo);

      // Throttle redraws to one per slot — only update the polyline when enough
      // time has passed that a new slot boundary has been crossed.
      const slotMs = windowMs / (cfg.dataPoints ?? 60);
      const lastDraw = elAny._sparkLastDraw ?? 0;
      if (now - lastDraw < slotMs) break;
      elAny._sparkLastDraw = now;

      const W = cfg.sparkWidth ?? 110;
      const H = cfg.sparkHeight ?? 18;
      const targetPoints = cfg.dataPoints ?? 60;
      const pad = 2;

      // Downsample to targetPoints using uniform time-based index selection
      const nums = history.map(([, v]) => v).filter((v) => isFinite(v));
      const sampled =
        nums.length <= targetPoints
          ? nums
          : (() => {
              const out: number[] = [];
              for (let i = 0; i < targetPoints; i++) {
                out.push(
                  nums[
                    Math.round((i * (nums.length - 1)) / (targetPoints - 1))
                  ],
                );
              }
              return out;
            })();

      const polyline = el.querySelector<SVGPolylineElement>("polyline");
      const flatLine = el.querySelector<SVGLineElement>("line");

      if (sampled.length >= 2) {
        let lo: number, hi: number;
        if (
          cfg.scaleMode === "fixed" &&
          cfg.fixedRangeLo !== undefined &&
          cfg.fixedRangeHi !== undefined
        ) {
          lo = cfg.fixedRangeLo;
          hi = cfg.fixedRangeHi;
        } else {
          lo = Math.min(...sampled);
          hi = Math.max(...sampled);
        }
        const range = hi - lo || 1;
        const pts = sampled
          .map((v, i) => {
            const px = pad + (i / (sampled.length - 1)) * (W - pad * 2);
            const py = pad + (1 - (v - lo) / range) * (H - pad * 2);
            return `${px.toFixed(1)},${py.toFixed(1)}`;
          })
          .join(" ");

        const alarmPri = pv.alarmPriority as
          | (1 | 2 | 3 | 4 | 5)
          | null
          | undefined;
        const strokeColor = alarmPri
          ? (ALARM_COLORS[alarmPri] ?? DE_COLORS.textSecondary)
          : DE_COLORS.textSecondary;

        if (polyline) {
          polyline.setAttribute("points", pts);
          polyline.setAttribute("stroke", strokeColor);
          polyline.style.display = "";
        }
        if (flatLine) flatLine.style.display = "none";
      }
      break;
    }

    case "alarm_indicator": {
      const active = !!pv.alarmPriority;
      // Show or hide the element based on alarm activity
      el.style.display = active ? "" : "none";
      const flashClasses = Array.from(el.classList).filter((c: string) =>
        c.startsWith("io-alarm-flash-"),
      );
      flashClasses.forEach((c: string) => el.classList.remove(c));
      if (!active) break;
      const priority = (pv.alarmPriority ?? 1) as 1 | 2 | 3 | 4 | 5;
      const unacked = pv.unacknowledged ?? false;
      const color = ALARM_COLORS[priority] ?? ALARM_COLORS[1];
      if (unacked) {
        el.classList.add(`io-alarm-flash-${ALARM_PRIORITY_NAMES[priority]}`);
      }
      // Update priority label and color
      const textEl = el.querySelector<SVGTextElement>("text");
      if (textEl) {
        textEl.textContent = String(priority);
        textEl.setAttribute("fill", color);
      }
      break;
    }

    case "point_name_label":
      // Tag name label — driven by point metadata, not live values; no DOM mutation needed.
      break;

    case "symbol_state": {
      // Update operational state CSS class on the symbol instance g element
      const stateVal = String(value).toLowerCase();
      let newClass = "";
      if (["running", "1", "true", "on"].includes(stateVal))
        newClass = "io-running";
      else if (["fault", "error", "fail"].includes(stateVal))
        newClass = "io-fault";
      else if (["transitioning", "starting", "stopping"].includes(stateVal))
        newClass = "io-transitioning";
      else if (["oos", "maintenance"].includes(stateVal)) newClass = "io-oos";
      el.classList.remove(
        "io-running",
        "io-fault",
        "io-transitioning",
        "io-oos",
      );
      if (newClass) el.classList.add(newClass);
      break;
    }
  }
}
