import { useMemo, useState, useRef, useEffect, useCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { graphicsApi } from "../../../api/graphics";
import { pointsApi } from "../../../api/points";
import { SceneRenderer } from "../../../shared/graphics/SceneRenderer";
import type { PointValue as ScenePointValue } from "../../../shared/graphics/SceneRenderer";
import {
  useWebSocketRaf,
  wsManager,
  detectDeviceType,
} from "../../../shared/hooks/useWebSocket";
import type { PointValue as WsPointValue } from "../../../shared/hooks/useWebSocket";
import { useGlobalSelectionStore } from "../../../store/globalSelectionStore";
import type {
  SelectionZoneId,
  SelectableEntity,
} from "../../../shared/clipboard";
import { useHistoricalValues } from "../../../shared/hooks/useHistoricalValues";
import { usePlaybackStore } from "../../../store/playback";
import TileGraphicViewer from "../../../shared/components/TileGraphicViewer";
import PointContextMenu from "../../../shared/components/PointContextMenu";
import PointDetailPanel from "../../../shared/components/PointDetailPanel";
import type {
  SceneNode,
  GraphicDocument,
} from "../../../shared/types/graphics";

// ── Tooltip state shape ──────────────────────────────────────────────────────

interface PointTooltip {
  x: number;
  y: number;
  pointId: string;
  tagLabel: string;
  value: string;
  units: string;
  quality: string;
  timestamp: string;
  opacity: number;
}

// ── Walk up the DOM tree to find the nearest ancestor with data-point-id ─────

function formatTooltipValue(v: number | string): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return String(v);
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 10000) return n.toFixed(0);
  if (abs >= 1000) return n.toFixed(1);
  if (abs >= 100) return n.toFixed(2);
  if (abs >= 10) return n.toFixed(3);
  if (abs >= 1) return n.toFixed(3);
  return parseFloat(n.toPrecision(3)).toString();
}

function findPointInfo(
  target: EventTarget | null,
): { id: string; tag: string | null } | null {
  let el = target as HTMLElement | null;
  while (el) {
    const id = el.dataset?.pointId || el.getAttribute?.("data-point-id");
    if (id) {
      const tag =
        el.dataset?.pointTag || el.getAttribute?.("data-point-tag") || null;
      return { id, tag };
    }
    el = el.parentElement;
  }
  return null;
}

function findPointId(target: EventTarget | null): string | null {
  return findPointInfo(target)?.id ?? null;
}

interface Props {
  graphicId: string;
  paneId?: string;
  onNavigate?: (targetGraphicId: string) => void;
  preserveAspectRatio?: boolean;
}

/** Walk a SceneNode tree and collect every bound pointId (UUID) or expressionId. */
function extractPointIds(nodes: SceneNode[]): string[] {
  const ids = new Set<string>();

  function walk(n: SceneNode) {
    if ("binding" in n && n.binding && typeof n.binding === "object") {
      const b = n.binding as { pointId?: string; expressionId?: string };
      if (b.pointId) ids.add(b.pointId);
      if (b.expressionId) ids.add(b.expressionId);
    }
    if (n.type === "symbol_instance" && "stateBinding" in n) {
      const sb = n.stateBinding as
        | { pointId?: string; expressionId?: string }
        | undefined;
      if (sb?.pointId) ids.add(sb.pointId);
      if (sb?.expressionId) ids.add(sb.expressionId);
    }
    if ("series" in n && Array.isArray(n.series)) {
      for (const s of n.series as {
        binding?: { pointId?: string; expressionId?: string };
      }[]) {
        if (s.binding?.pointId) ids.add(s.binding.pointId);
        if (s.binding?.expressionId) ids.add(s.binding.expressionId);
      }
    }
    if ("slices" in n && Array.isArray(n.slices)) {
      for (const s of n.slices as {
        binding?: { pointId?: string; expressionId?: string };
      }[]) {
        if (s.binding?.pointId) ids.add(s.binding.pointId);
        if (s.binding?.expressionId) ids.add(s.binding.expressionId);
      }
    }
    if ("children" in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode);
    }
  }

  for (const n of nodes) walk(n);
  return Array.from(ids);
}

/** Collect all tag-name bindings (pointTag, or legacy tag stored in pointId) across display elements and symbol instances. */
function extractTagBindings(nodes: SceneNode[]): string[] {
  const tags = new Set<string>();
  function walk(n: SceneNode) {
    if (n.type === "display_element" && "binding" in n) {
      const b = n.binding as { pointId?: string; pointTag?: string };
      if (b.pointTag) {
        tags.add(b.pointTag);
      } else if (b.pointId && !UUID_RE.test(b.pointId)) {
        tags.add(b.pointId);
      }
    }
    if (n.type === "symbol_instance" && "stateBinding" in n) {
      const sb = n.stateBinding as
        | { pointId?: string; pointTag?: string }
        | undefined;
      if (sb?.pointTag) {
        tags.add(sb.pointTag);
      } else if (sb?.pointId && !UUID_RE.test(sb.pointId)) {
        tags.add(sb.pointId);
      }
    }
    if ("children" in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode);
    }
  }
  for (const n of nodes) walk(n);
  return Array.from(tags);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Walk a SceneNode tree and collect sparkline bindings split into UUIDs and tags,
 *  plus the maximum timeWindowMinutes across all sparklines. */
function extractSparklineBindings(nodes: SceneNode[]): {
  uuids: string[];
  tags: string[];
  maxWindowMinutes: number;
} {
  const uuids = new Set<string>();
  const tags = new Set<string>();
  let maxWindowMinutes = 30;
  function walk(n: SceneNode) {
    if (
      n.type === "display_element" &&
      "displayType" in n &&
      (n as { displayType: string }).displayType === "sparkline" &&
      "binding" in n
    ) {
      const b = n.binding as { pointId?: string; pointTag?: string };
      if (b.pointTag) {
        tags.add(b.pointTag);
      } else if (b.pointId) {
        if (UUID_RE.test(b.pointId)) uuids.add(b.pointId);
        else tags.add(b.pointId);
      }
      const cfg = (n as { config?: { timeWindowMinutes?: number } }).config;
      if (cfg?.timeWindowMinutes)
        maxWindowMinutes = Math.max(maxWindowMinutes, cfg.timeWindowMinutes);
    }
    if ("children" in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode);
    }
  }
  for (const n of nodes) walk(n);
  return { uuids: Array.from(uuids), tags: Array.from(tags), maxWindowMinutes };
}

const isPhone = detectDeviceType() === "phone";

/** Extract point bindings with fractional positions for TileGraphicViewer overlays. */
function extractTileBindings(doc: GraphicDocument) {
  const { width, height } = doc.canvas ?? { width: 0, height: 0 };
  const out: Array<{ pointId: string; label?: string; x: number; y: number }> =
    [];

  function walk(n: SceneNode) {
    if ("binding" in n && n.binding && typeof n.binding === "object") {
      const pid = (n.binding as { pointId?: string }).pointId;
      if (pid) {
        out.push({
          pointId: pid,
          label: n.name,
          x: n.transform.position.x / width,
          y: n.transform.position.y / height,
        });
      }
    }
    if ("children" in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode);
    }
  }

  for (const n of doc.children) walk(n);
  return out;
}

export default function GraphicPane({
  graphicId,
  paneId,
  onNavigate,
  preserveAspectRatio = true,
}: Props) {
  const [statusView, setStatusView] = useState(false);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["graphic", graphicId],
    queryFn: async () => {
      const result = await graphicsApi.get(graphicId);
      if (!result.success) throw new Error("Failed to load graphic");
      const doc = result.data;
      // scene_data must be a valid GraphicDocument (spec §2.2) — it has canvas + children[].
      // DB rows that store raw GraphicModel or legacy bindings formats will not have these fields.
      if (!Array.isArray(doc.scene_data?.children) || !doc.scene_data?.canvas) {
        throw new Error(
          "Graphic is not yet rendered — open it in Designer to generate scene data",
        );
      }
      return doc;
    },
    staleTime: 30_000,
  });

  // Derive the list of direct UUID point IDs
  const directPointIds = useMemo(
    () => (data ? extractPointIds(data.scene_data?.children ?? []) : []),
    [data],
  );

  // Collect all tag-name bindings that need resolution for subscriptions/tooltips
  const allTagBindings = useMemo(
    () => (data ? extractTagBindings(data.scene_data?.children ?? []) : []),
    [data],
  );

  // Resolve all tag bindings to UUIDs (used for subscriptions and tooltip values)
  const { data: resolvedAllTags } = useQuery({
    queryKey: ["resolve-all-tags", allTagBindings],
    queryFn: async () => {
      if (allTagBindings.length === 0) return {} as Record<string, string>;
      const result = await graphicsApi.resolveTags(allTagBindings);
      return (result.success ? result.data : {}) as Record<string, string>;
    },
    staleTime: Infinity,
    enabled: allTagBindings.length > 0,
  });

  // Full point ID list: direct UUIDs + resolved tag UUIDs
  const pointIds = useMemo(() => {
    const ids = new Set(directPointIds);
    if (resolvedAllTags) {
      for (const uuid of Object.values(resolvedAllTags)) {
        if (uuid) ids.add(uuid);
      }
    }
    return Array.from(ids);
  }, [directPointIds, resolvedAllTags]);

  // Reverse map: UUID → tag name, for tooltip display
  const uuidToTagMap = useMemo(() => {
    const m = new Map<string, string>();
    if (resolvedAllTags) {
      for (const [tag, uuid] of Object.entries(resolvedAllTags)) {
        if (uuid) m.set(uuid, tag);
      }
    }
    return m;
  }, [resolvedAllTags]);

  // Derive sparkline bindings split by UUID vs tag
  const sparklineBindings = useMemo(
    () =>
      data
        ? extractSparklineBindings(data.scene_data?.children ?? [])
        : { uuids: [], tags: [], maxWindowMinutes: 30 },
    [data],
  );

  // Resolve sparkline tags to UUIDs (needed when tag names are stored in binding)
  const { data: resolvedSparklineTags } = useQuery({
    queryKey: ["sparkline-resolve-tags", sparklineBindings.tags],
    queryFn: async () => {
      if (sparklineBindings.tags.length === 0)
        return {} as Record<string, string>;
      const result = await graphicsApi.resolveTags(sparklineBindings.tags);
      return (result.success ? result.data : {}) as Record<string, string>;
    },
    staleTime: Infinity,
    enabled: sparklineBindings.tags.length > 0,
  });

  // Combine UUID sparklines + resolved tag UUIDs for the history fetch
  const sparklinePointIds = useMemo(() => {
    const ids = new Set(sparklineBindings.uuids);
    if (resolvedSparklineTags) {
      for (const uuid of Object.values(resolvedSparklineTags)) {
        if (uuid) ids.add(uuid);
      }
    }
    return Array.from(ids);
  }, [sparklineBindings.uuids, resolvedSparklineTags]);

  // Fetch sparkline history — window driven by max timeWindowMinutes across all sparklines
  const { data: sparklineHistories } = useQuery({
    queryKey: [
      "sparkline-history",
      sparklinePointIds,
      sparklineBindings.maxWindowMinutes,
    ],
    queryFn: async () => {
      if (sparklinePointIds.length === 0) return new Map<string, number[]>();
      const end = new Date().toISOString();
      const start = new Date(
        Date.now() - sparklineBindings.maxWindowMinutes * 60 * 1000,
      ).toISOString();
      const result = await pointsApi.historyBatch(sparklinePointIds, {
        start,
        end,
        limit: 200,
      });
      if (!result.success) return new Map<string, number[]>();
      const map = new Map<string, number[]>();
      for (const r of result.data) {
        const values = r.rows
          .map((row) => row.value ?? row.avg)
          .filter((v): v is number => typeof v === "number");
        map.set(r.point_id, values);
      }
      return map;
    },
    staleTime: 60_000,
    enabled: sparklinePointIds.length > 0,
  });

  const { mode: playbackMode, timestamp: playbackTs } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  // Phone path only: RAF-coalesced subscription feeding TileGraphicViewer (React prop)
  // Desktop live path: SceneRenderer subscribes to wsManager directly (liveSubscribe=true)
  const { values: wsValues } = useWebSocketRaf(
    isPhone && !isHistorical ? pointIds : [],
  );

  // Fetch historical values at playback timestamp (only when in historical mode)
  const historicalValues = useHistoricalValues(
    isHistorical ? pointIds : [],
    isHistorical ? playbackTs : undefined,
  );

  // Adapt wire-format PointValue → SceneRenderer PointValue (used by phone path + historical)
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

  // Tooltip value ref — updated by direct wsManager subscription (no React state → no re-renders)
  // Used by handleSvgMouseMove for desktop live mode. Historical mode reads from pointValues.
  const tooltipValuesRef = useRef<Map<string, WsPointValue>>(new Map());

  useEffect(() => {
    if (isPhone || isHistorical || pointIds.length === 0) return;
    const handler = (pv: WsPointValue) => {
      tooltipValuesRef.current.set(pv.pointId, pv);
    };
    pointIds.forEach((id) => wsManager.subscribe(id, handler));
    return () => {
      pointIds.forEach((id) => wsManager.unsubscribe(id, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone, isHistorical, pointIds.join(",")]);

  // Phone: derive tile overlay bindings from scene node positions
  const tileBindings = useMemo(
    () => (isPhone && data ? extractTileBindings(data.scene_data) : []),
    [data],
  );

  // ── Hover tooltip state ──────────────────────────────────────────────────────

  const [tooltip, setTooltip] = useState<PointTooltip | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipDismissTimers = useCallback(() => {
    if (tooltipFadeRef.current) {
      clearTimeout(tooltipFadeRef.current);
      tooltipFadeRef.current = null;
    }
    if (tooltipDismissRef.current) {
      clearTimeout(tooltipDismissRef.current);
      tooltipDismissRef.current = null;
    }
  }, []);

  const scheduleTooltipDismiss = useCallback(() => {
    clearTooltipDismissTimers();
    tooltipFadeRef.current = setTimeout(() => {
      setTooltip((t) => (t ? { ...t, opacity: 0 } : null));
      tooltipDismissRef.current = setTimeout(() => setTooltip(null), 1000);
    }, 1500);
  }, [clearTooltipDismissTimers]);

  // ── Point context menu state ─────────────────────────────────────────────────

  const [pointCtxMenu, setPointCtxMenu] = useState<{
    x: number;
    y: number;
    pointId: string;
    tagName: string;
    isAlarm: boolean;
    isAlarmElement: boolean;
  } | null>(null);

  // ── Point Detail floating panels (up to 3 concurrent per spec §7.2) ──────────

  const MAX_POINT_DETAIL_PANELS = 3;
  const [pointDetailPanels, setPointDetailPanels] = useState<
    Array<{ id: string; pointId: string; x: number; y: number }>
  >([]);

  function openPointDetail(pointId: string, x: number, y: number) {
    setPointDetailPanels((prev) => {
      // Don't open duplicate for same point
      if (prev.some((p) => p.pointId === pointId)) return prev;
      const entry = { id: crypto.randomUUID(), pointId, x, y };
      // Enforce max 3 concurrent — evict oldest
      const next =
        prev.length >= MAX_POINT_DETAIL_PANELS ? prev.slice(1) : prev;
      return [...next, entry];
    });
  }

  function closePointDetail(id: string) {
    setPointDetailPanels((prev) => prev.filter((p) => p.id !== id));
  }

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Point hover tooltip handlers ─────────────────────────────────────────────

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const info = findPointInfo(e.target);
      if (!info) {
        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = null;
        }
        // Mouse moved off a point — start dismiss timer (no-op if no tooltip is showing)
        scheduleTooltipDismiss();
        return;
      }
      const { id: pointId, tag: domTag } = info;
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      const rect = containerRef.current?.getBoundingClientRect();
      const relX = e.clientX - (rect?.left ?? 0);
      const relY = e.clientY - (rect?.top ?? 0);
      tooltipTimerRef.current = setTimeout(() => {
        const livePv = !isHistorical
          ? tooltipValuesRef.current.get(pointId)
          : undefined;
        const reactPv = isHistorical ? pointValues.get(pointId) : undefined;
        const value = livePv?.value ?? reactPv?.value;
        const quality = livePv?.quality ?? reactPv?.quality;
        // Show tag name: prefer data-point-tag from DOM, then reverse-lookup UUID→tag, then UUID
        const tagLabel = domTag ?? uuidToTagMap.get(pointId) ?? pointId;
        clearTooltipDismissTimers();
        setTooltip({
          x: relX,
          y: relY,
          pointId,
          tagLabel,
          value:
            value !== null && value !== undefined
              ? formatTooltipValue(value)
              : "---",
          units: "",
          quality: quality ?? "unknown",
          timestamp: new Date().toLocaleTimeString(),
          opacity: 1,
        });
        scheduleTooltipDismiss();
      }, 500);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHistorical, pointValues, uuidToTagMap],
  );

  // Note: Per-element mouse-leave is handled at the container level via handleContainerMouseLeave.
  // Individual element leave could be hooked here if needed in future.

  const handleContainerMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    clearTooltipDismissTimers();
    setTooltip(null);
  }, [clearTooltipDismissTimers]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      clearTooltipDismissTimers();
    };
  }, [clearTooltipDismissTimers]);

  // ── Point right-click context menu handler ───────────────────────────────────

  const handleSvgContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target);
      if (!pointId) return;
      // Point found — show point context menu instead of pane context menu
      e.preventDefault();
      e.stopPropagation();
      // Resolve alarm state from cached tooltip values; tagName falls back to pointId
      // (WsPointValue does not carry tagName — the server sends pointId as the canonical identifier)
      const pv = tooltipValuesRef.current.get(pointId);
      const tagName = pointId;
      const isAlarm = pv?.quality === "alarm";
      setPointCtxMenu({
        x: e.clientX,
        y: e.clientY,
        pointId,
        tagName,
        isAlarm,
        isAlarmElement: false,
      });
    },
    [],
  );

  // ── Double-click on point element → open Point Detail (spec §7.2) ────────────

  const handleSvgDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target);
      if (!pointId) return;
      e.preventDefault();
      e.stopPropagation();
      openPointDetail(pointId, e.clientX, e.clientY);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Ctrl+I → open Point Detail for hovered point (spec §7.2) ─────────────────

  const lastHoveredPointRef = useRef<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "i" && lastHoveredPointRef.current) {
        e.preventDefault();
        openPointDetail(
          lastHoveredPointRef.current,
          window.innerWidth / 2,
          window.innerHeight / 2,
        );
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scene-node selection zone registration ──────────────────────────────────

  useEffect(() => {
    if (!paneId) return;
    const zoneId = `console/pane/${paneId}` as SelectionZoneId;
    const store = useGlobalSelectionStore.getState();
    store.registerZone({
      zoneId,
      indicatorStyle: "soft-glow",
      supportsSelectAll: false,
    });
    return () => store.unregisterZone(zoneId);
  }, [paneId]);

  // Clear store selection when graphic changes (SVG re-renders, old DOM classes gone)
  useEffect(() => {
    if (!paneId) return;
    useGlobalSelectionStore
      .getState()
      .clearZone(`console/pane/${paneId}` as SelectionZoneId);
  }, [graphicId, paneId]);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!paneId) return;

      function walkToNodeId(
        target: Element | null,
        root: Element | null,
      ): { nodeId: string; nodeEl: Element } | null {
        let el = target as HTMLElement | null;
        while (el && el !== root) {
          const id = el.getAttribute("data-node-id");
          if (id) return { nodeId: id, nodeEl: el };
          el = el.parentElement;
        }
        return null;
      }

      // Try exact target first, then search a small radius to widen the hit area
      let found = walkToNodeId(e.target as Element, containerRef.current);

      if (!found) {
        const OFFSETS = [
          [-4, 0],
          [4, 0],
          [0, -4],
          [0, 4],
          [-3, -3],
          [3, -3],
          [-3, 3],
          [3, 3],
        ] as const;
        outer: for (const [dx, dy] of OFFSETS) {
          for (const el of document.elementsFromPoint(
            e.clientX + dx,
            e.clientY + dy,
          )) {
            found = walkToNodeId(el, containerRef.current);
            if (found) break outer;
          }
        }
      }

      const zoneId = `console/pane/${paneId}` as SelectionZoneId;
      const store = useGlobalSelectionStore.getState();

      if (!found) {
        containerRef.current
          ?.querySelectorAll(".io-console-selected")
          .forEach((n) => n.classList.remove("io-console-selected"));
        store.clearZone(zoneId);
        return;
      }

      const { nodeId, nodeEl } = found;
      const entity: SelectableEntity = {
        id: nodeId,
        zoneId,
        kind: "scene-node",
      };
      const isMulti = e.ctrlKey || e.metaKey;

      if (isMulti) {
        if (store.isSelected(zoneId, nodeId)) {
          nodeEl.classList.remove("io-console-selected");
          store.select(zoneId, entity, "remove");
        } else {
          nodeEl.classList.add("io-console-selected");
          store.select(zoneId, entity, "add");
        }
      } else {
        containerRef.current
          ?.querySelectorAll(".io-console-selected")
          .forEach((n) => n.classList.remove("io-console-selected"));
        nodeEl.classList.add("io-console-selected");
        store.select(zoneId, entity, "replace");
      }

      store.setActiveZone(zoneId);
    },
    [paneId],
  );

  if (isLoading) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--io-surface-primary)",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--io-surface-primary)",
          color: "var(--io-text-muted)",
          fontSize: 13,
          padding: 16,
          textAlign: "center",
        }}
      >
        {error instanceof Error ? error.message : "Failed to load graphic"}
      </div>
    );
  }

  // Phone: render tile-based viewer with status view toggle
  if (isPhone) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Status/Tile toggle bar */}
        <div
          style={{
            display: "flex",
            gap: 1,
            padding: "4px 8px",
            background: "var(--io-surface-secondary)",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setStatusView(false)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background: !statusView ? "var(--io-accent)" : "transparent",
              color: !statusView ? "#fff" : "var(--io-text-muted)",
            }}
          >
            Map
          </button>
          <button
            onClick={() => setStatusView(true)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background: statusView ? "var(--io-accent)" : "transparent",
              color: statusView ? "#fff" : "var(--io-text-muted)",
            }}
          >
            Status
          </button>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <TileGraphicViewer
            graphicId={graphicId}
            graphicWidth={data.scene_data?.canvas?.width ?? 0}
            graphicHeight={data.scene_data?.canvas?.height ?? 0}
            pointValues={pointValues}
            pointBindings={tileBindings}
            statusView={statusView}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
      onClick={handleNodeClick}
      onMouseMove={(e) => {
        handleSvgMouseMove(e);
        lastHoveredPointRef.current = findPointId(e.target);
      }}
      onMouseLeave={handleContainerMouseLeave}
      onContextMenu={handleSvgContextMenu}
      onDoubleClick={handleSvgDoubleClick}
    >
      <SceneRenderer
        document={data.scene_data}
        pointValues={isHistorical ? pointValues : undefined}
        liveSubscribe={!isHistorical}
        sparklineHistories={sparklineHistories ?? undefined}
        onNavigate={onNavigate}
        preserveAspectRatio={preserveAspectRatio ? "xMidYMid meet" : "none"}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Point hover tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 14,
            top: tooltip.y - 8,
            zIndex: 1500,
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: 6,
            padding: "7px 11px",
            fontSize: 12,
            color: "var(--io-text-primary)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            pointerEvents: "none",
            minWidth: 160,
            opacity: tooltip.opacity,
            transition: "opacity 1s ease-out",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: 3,
              fontSize: 11,
              color: "var(--io-text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {tooltip.tagLabel}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontSize: 16,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 600,
              }}
            >
              {tooltip.value}
            </span>
            {tooltip.units && (
              <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
                {tooltip.units}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 4,
              fontSize: 10,
              color: "var(--io-text-muted)",
            }}
          >
            <span
              style={{
                color:
                  tooltip.quality === "good"
                    ? "var(--io-success)"
                    : tooltip.quality === "bad"
                      ? "var(--io-danger)"
                      : "var(--io-warning)",
              }}
            >
              {tooltip.quality}
            </span>
            <span>{tooltip.timestamp}</span>
          </div>
        </div>
      )}

      {/* Point right-click context menu — shared PointContextMenu component (spec CX-POINT-CONTEXT) */}
      {pointCtxMenu && (
        <PointContextMenu
          pointId={pointCtxMenu.pointId}
          tagName={pointCtxMenu.tagName}
          isAlarm={pointCtxMenu.isAlarm}
          isAlarmElement={pointCtxMenu.isAlarmElement}
          onPointDetail={(pid) => {
            openPointDetail(pid, pointCtxMenu.x, pointCtxMenu.y);
            setPointCtxMenu(null);
          }}
        >
          {/* Invisible fixed-position portal anchor — PointContextMenu opens at this location */}
          <span
            style={{
              position: "fixed",
              top: pointCtxMenu.y,
              left: pointCtxMenu.x,
              width: 0,
              height: 0,
            }}
          />
        </PointContextMenu>
      )}

      {/* Point Detail floating panels (up to 3 concurrent per spec §7.2) */}
      {pointDetailPanels.map((panel) => (
        <PointDetailPanel
          key={panel.id}
          pointId={panel.pointId}
          onClose={() => closePointDetail(panel.id)}
          anchorPosition={{ x: panel.x, y: panel.y }}
        />
      ))}
    </div>
  );
}
