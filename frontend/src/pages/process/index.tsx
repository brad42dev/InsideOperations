import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RBush from "rbush";
import { graphicsApi } from "../../api/graphics";
import { usePermission } from "../../shared/hooks/usePermission";
import { exportsApi, type ExportFormat } from "../../api/exports";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import type { PointValue as ScenePointValue } from "../../shared/graphics/SceneRenderer";
import {
  useWebSocketRaf,
  detectDeviceType,
} from "../../shared/hooks/useWebSocket";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useHistoricalValues } from "../../shared/hooks/useHistoricalValues";
import { usePlaybackStore } from "../../store/playback";
import { useUiStore } from "../../store/ui";
import { bookmarksApi } from "../../api/bookmarks";
import type {
  ViewportState,
  SceneNode,
  DisplayElement,
  SymbolInstance,
} from "../../shared/types/graphics";
import type { DesignObjectSummary } from "../../api/graphics";
import HistoricalPlaybackBar from "../../shared/components/HistoricalPlaybackBar";
import ContextMenu from "../../shared/components/ContextMenu";
import PointContextMenu from "../../shared/components/PointContextMenu";
import PointDetailPanel from "../../shared/components/PointDetailPanel";
import ProcessMinimap from "./ProcessMinimap";
import ProcessSidebar from "./ProcessSidebar";
import type { ViewportBookmark } from "./ProcessSidebar";
import { useUserPreference } from "../../shared/hooks/useUserPreference";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isTablet = detectDeviceType() === "tablet";

const DEFAULT_GRAPHIC_ID_KEY = "io-process-last-graphic";
const RECENT_VIEWS_KEY = "io-process-recent-views";
const SIDEBAR_VISIBLE_KEY = "io-process-sidebar-visible";
const MAX_RECENT = 10;

// ---------------------------------------------------------------------------
// DOM walkers — find nearest ancestor with data-point-id / data-display-type
// ---------------------------------------------------------------------------

function findPointId(target: EventTarget | null): string | null {
  let el = target as HTMLElement | null;
  while (el) {
    if (el.dataset?.pointId) return el.dataset.pointId;
    const attr = el.getAttribute?.("data-point-id");
    if (attr) return attr;
    el = el.parentElement;
  }
  return null;
}

/**
 * Walk up the DOM from `target` to find the nearest ancestor that has a
 * `data-point-id` attribute, then check whether that ancestor has
 * `data-display-type="alarm_indicator"`.
 */
function findIsAlarmElement(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  while (el) {
    const pid = el.dataset?.pointId ?? el.getAttribute?.("data-point-id");
    if (pid) {
      return el.getAttribute("data-display-type") === "alarm_indicator";
    }
    el = el.parentElement;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Navigation history entry
// ---------------------------------------------------------------------------

interface NavEntry {
  graphicId: string;
  name: string;
  panX: number;
  panY: number;
  zoom: number;
}

// ---------------------------------------------------------------------------
// Hover tooltip shape
// ---------------------------------------------------------------------------

interface PointTooltip {
  x: number;
  y: number;
  pointId: string;
  value: string;
  quality: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// LOD helpers
// ---------------------------------------------------------------------------

type LodLevel = 0 | 1 | 2 | 3;
const LOD_NAMES: Record<LodLevel, string> = {
  0: "Overview",
  1: "Area",
  2: "Unit",
  3: "Detail",
};

function zoomToLod(zoom: number): LodLevel {
  if (zoom < 0.15) return 0;
  if (zoom < 0.4) return 1;
  if (zoom < 0.8) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Recent views helpers
// ---------------------------------------------------------------------------

interface RecentView {
  id: string;
  name: string;
}

function loadRecentViews(): RecentView[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_VIEWS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecentView(id: string, name: string) {
  const views = loadRecentViews().filter((v) => v.id !== id);
  views.unshift({ id, name });
  localStorage.setItem(
    RECENT_VIEWS_KEY,
    JSON.stringify(views.slice(0, MAX_RECENT)),
  );
}

// ---------------------------------------------------------------------------
// Sidebar visibility helpers
// ---------------------------------------------------------------------------

function loadSidebarVisible(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_VISIBLE_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Viewport-visible point extraction
// ---------------------------------------------------------------------------

/** Return [width, height] estimate for a display element based on its config. */
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

/** Zoom-dependent pre-fetch buffer fraction (spec §5.3) */
function getBufferFraction(zoom: number): number {
  const zoomPct = zoom * 100;
  if (zoomPct > 100) return 0.1;
  if (zoomPct > 30) return 0.08;
  return 0.05;
}

// ---------------------------------------------------------------------------
// Spatial binding index (spec §5.6 Binding Index Pre-Computation)
// ---------------------------------------------------------------------------

/** Minimum LOD level at which this display type becomes visible (spec §4.3.2) */
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

/** One entry in the pre-built spatial binding index. */
interface SpatialBindingEntry {
  nodeId: string;
  bbox: { left: number; top: number; right: number; bottom: number };
  lodLevel: number;
  pointIds: Set<string>;
}

/** rbush item shape — minX/minY/maxX/maxY required by the library. */
interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  entry: SpatialBindingEntry;
}

/**
 * Walk the scene graph once and return a flat array of all bound-node
 * bounding boxes, sorted by bbox.left for O(n) sweep-line intersection.
 * For graphics with >2,000 entries the caller should use an RBush index
 * instead (see queryBindingIndex).
 */
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
  // Sort by left edge for sweep-line intersection (spec §5.6)
  return entries.sort((a, b) => a.bbox.left - b.bbox.left);
}

/** Query a flat sorted binding index with a sweep-line intersection. */
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
    if (entry.bbox.left > right) break; // sorted — past right edge
    if (entry.lodLevel > currentLod) continue; // hidden at this LOD
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

/** Query an RBush index (used when entry count exceeds 2,000). */
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

/** Build an RBush R-tree from a pre-built flat index (spec §5.6). */
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

const RBUSH_THRESHOLD = 2000;

// ---------------------------------------------------------------------------
// Count total bound points in a graphic
// ---------------------------------------------------------------------------

function countTotalPoints(doc: { children: SceneNode[] }): number {
  const seen = new Set<string>();

  function scanNode(node: SceneNode) {
    if (node.type === "display_element") {
      const de = node as DisplayElement;
      if (de.binding?.pointId) seen.add(de.binding.pointId);
      if (de.binding?.expressionId) seen.add(de.binding.expressionId);
    }
    if (node.type === "symbol_instance") {
      const si = node as SymbolInstance;
      if (si.stateBinding?.pointId) seen.add(si.stateBinding.pointId);
      if (si.stateBinding?.expressionId) seen.add(si.stateBinding.expressionId);
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode);
    }
  }

  for (const node of doc.children) scanNode(node);
  return seen.size;
}

// ---------------------------------------------------------------------------
// BookmarkDialog — Name (required) + Description (optional)
// ---------------------------------------------------------------------------

interface BookmarkDialogProps {
  onConfirm: (name: string, description: string) => void;
  onCancel: () => void;
}

function BookmarkDialog({ onConfirm, onCancel }: BookmarkDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    onConfirm(name.trim(), description.trim());
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: 13,
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 2000,
        }}
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save Viewport Bookmark"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2001,
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius-lg)",
          boxShadow: "var(--io-shadow-lg)",
          width: 340,
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 16,
            color: "var(--io-text-primary)",
          }}
        >
          Save Viewport Bookmark
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--io-text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Name *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
              placeholder="e.g. Reactor overview"
              style={{
                ...inputStyle,
                borderColor: nameError
                  ? "var(--io-alarm-high)"
                  : "var(--io-border)",
              }}
            />
            {nameError && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: "var(--io-alarm-high)",
                }}
              >
                Name is required
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--io-text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Zoomed to feed inlet area"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "6px 14px",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--io-text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "6px 14px",
                background: "var(--io-accent)",
                border: "none",
                borderRadius: "var(--io-radius)",
                cursor: "pointer",
                fontSize: 13,
                color: "#fff",
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ProcessPage
// ---------------------------------------------------------------------------

export default function ProcessPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const { isKiosk, setKiosk } = useUiStore();

  // ---- Kiosk mode -----------------------------------------------------------

  const kioskExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether this component instance set kiosk to true, so cleanup
  // doesn't accidentally clear kiosk state set by another module.
  const didSetKioskRef = useRef(false);

  useEffect(() => {
    const kioskParam = searchParams.get("kiosk") === "true";
    if (kioskParam) {
      didSetKioskRef.current = true;
      setKiosk(true);
    }
    return () => {
      if (didSetKioskRef.current) {
        didSetKioskRef.current = false;
        setKiosk(false);
      }
    };
  }, [searchParams, setKiosk]);

  // Cleanup corner-hover timer on unmount
  useEffect(
    () => () => {
      if (kioskExitTimerRef.current) clearTimeout(kioskExitTimerRef.current);
    },
    [],
  );

  // ---- View selection -------------------------------------------------------

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return localStorage.getItem(DEFAULT_GRAPHIC_ID_KEY);
  });
  const [recentViews, setRecentViews] = useState<RecentView[]>(loadRecentViews);

  // ---- Sidebar & UI state ---------------------------------------------------

  const [sidebarVisible, setSidebarVisible] =
    useState<boolean>(loadSidebarVisible);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const canExport = usePermission("process:export");
  const canExportGraphic = usePermission("designer:export");

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(next));
      return next;
    });
  }, []);

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
  const viewportAnimRef = useRef<number | null>(null);

  // Animate viewport smoothly to target over ~300ms (spec §4.4, §5.3)
  const animateViewportTo = useCallback(
    (target: { panX: number; panY: number; zoom: number }) => {
      if (viewportAnimRef.current !== null)
        cancelAnimationFrame(viewportAnimRef.current);
      const start = performance.now();
      const DURATION = 300;
      // Capture current viewport synchronously via functional updater trick
      setViewport((current) => {
        const from = {
          panX: current.panX,
          panY: current.panY,
          zoom: current.zoom,
        };
        function step(now: number) {
          const t = Math.min(1, (now - start) / DURATION);
          // Ease-out cubic
          const e = 1 - Math.pow(1 - t, 3);
          setViewport((vp) => ({
            ...vp,
            panX: from.panX + (target.panX - from.panX) * e,
            panY: from.panY + (target.panY - from.panY) * e,
            zoom: from.zoom + (target.zoom - from.zoom) * e,
          }));
          if (t < 1) {
            viewportAnimRef.current = requestAnimationFrame(step);
          } else {
            viewportAnimRef.current = null;
          }
        }
        viewportAnimRef.current = requestAnimationFrame(step);
        return current; // don't change state yet — the RAF loop will do it
      });
    },
    [],
  );

  // ---- Graphics data --------------------------------------------------------

  const { data: graphicsList, isLoading: graphicsLoading } = useQuery({
    queryKey: ["design-objects", "process"],
    queryFn: async () => {
      const result = await graphicsApi.list({ scope: "process" });
      if (result.success) return result.data.data;
      return [] as DesignObjectSummary[];
    },
  });

  const { data: graphic, isLoading } = useQuery({
    queryKey: ["graphic", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const result = await graphicsApi.get(selectedId);
      if (result.success) return result.data ?? null;
      return null;
    },
    enabled: !!selectedId,
  });

  // ---- Viewport bookmarks ---------------------------------------------------

  const { data: rawBookmarks = [] } = useQuery({
    queryKey: ["bookmarks", "viewport"],
    queryFn: async () => {
      const result = await bookmarksApi.list();
      if (result.success)
        return result.data.filter((b) => b.entity_type === "viewport");
      return [];
    },
  });

  // Decode viewport bookmarks from metadata stored in the name as JSON
  const viewportBookmarks = useMemo((): ViewportBookmark[] => {
    return rawBookmarks.map((b) => {
      try {
        const meta = JSON.parse(b.name) as {
          label?: string;
          panX?: number;
          panY?: number;
          zoom?: number;
        };
        return {
          id: b.id,
          name: meta.label ?? b.id,
          panX: meta.panX ?? 0,
          panY: meta.panY ?? 0,
          zoom: meta.zoom ?? 1,
        };
      } catch {
        return { id: b.id, name: b.name, panX: 0, panY: 0, zoom: 1 };
      }
    });
  }, [rawBookmarks]);

  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false);

  const addViewportBookmarkMutation = useMutation({
    mutationFn: (args: {
      label: string;
      description: string;
      panX: number;
      panY: number;
      zoom: number;
    }) => {
      const name = JSON.stringify({
        label: args.label,
        description: args.description,
        panX: args.panX,
        panY: args.panY,
        zoom: args.zoom,
      });
      return bookmarksApi.add({
        entity_type: "viewport",
        entity_id: selectedId ?? "process",
        name,
      });
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookmarks", "viewport"] }),
  });

  const MAX_BOOKMARKS = 50;

  function handleAddBookmark() {
    if (viewportBookmarks.length >= MAX_BOOKMARKS) {
      alert(
        `Maximum ${MAX_BOOKMARKS} bookmarks per graphic. Please delete some before adding more.`,
      );
      return;
    }
    setBookmarkDialogOpen(true);
  }

  function handleBookmarkConfirm(label: string, description: string) {
    setBookmarkDialogOpen(false);
    addViewportBookmarkMutation.mutate({
      label,
      description,
      panX: viewport.panX,
      panY: viewport.panY,
      zoom: viewport.zoom,
    });
  }

  function handleSelectBookmark(bm: {
    panX: number;
    panY: number;
    zoom: number;
  }) {
    animateViewportTo(bm);
  }

  const deleteViewportBookmarkMutation = useMutation({
    mutationFn: (id: string) => bookmarksApi.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookmarks", "viewport"] }),
  });

  const renameViewportBookmarkMutation = useMutation({
    mutationFn: ({
      id,
      name,
      bm,
    }: {
      id: string;
      name: string;
      bm: ViewportBookmark;
    }) => {
      const newData = JSON.stringify({
        label: name,
        panX: bm.panX,
        panY: bm.panY,
        zoom: bm.zoom,
      });
      // Bookmarks API doesn't support update — delete + re-add
      return bookmarksApi.remove(id).then(() =>
        bookmarksApi.add({
          entity_type: "viewport",
          entity_id: selectedId ?? "process",
          name: newData,
        }),
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["bookmarks", "viewport"] }),
  });

  function handleDeleteBookmark(id: string) {
    deleteViewportBookmarkMutation.mutate(id);
  }

  function handleRenameBookmark(id: string, newName: string) {
    const bm = viewportBookmarks.find((b) => b.id === id);
    if (!bm) return;
    renameViewportBookmarkMutation.mutate({ id, name: newName, bm });
  }

  // ---- View selection handler -----------------------------------------------

  const handleSelectView = useCallback((id: string, name: string) => {
    setSelectedId(id);
    localStorage.setItem(DEFAULT_GRAPHIC_ID_KEY, id);
    pushRecentView(id, name);
    setRecentViews(loadRecentViews());
  }, []);

  // ---- Viewport resize observer --------------------------------------------

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

  // Update canvas size when graphic loads and auto zoom-to-fit (spec §Non-Negotiable #9)
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

  // ---- Zoom / pan handlers -------------------------------------------------

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

  // Active touch pointers tracked for pinch-to-zoom (§4.1)
  const activePointers = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinchBaseZoom = useRef<number | null>(null);
  const pinchBaseDist = useRef<number>(0);
  const pinchMidCanvas = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mobile long-press for point context menu (500ms, cancel on move > 10px)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOrigin = useRef<{
    x: number;
    y: number;
    target: EventTarget | null;
  } | null>(null);

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  }

  useEffect(
    () => () => {
      cancelLongPress();
    },
    [],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Pinch-to-zoom: activate when 2 touch pointers are down (60px+ apart)
    if (e.pointerType === "touch" && activePointers.current.size === 2) {
      cancelLongPress();
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
    // Mobile long-press: start 500ms timer on single touch that targets a point element
    if (e.pointerType === "touch" && activePointers.current.size === 1) {
      const pointId = findPointId(e.target);
      if (pointId) {
        cancelLongPress();
        const cx = e.clientX;
        const cy = e.clientY;
        const tgt = e.target;
        longPressOrigin.current = { x: cx, y: cy, target: tgt };
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          longPressOrigin.current = null;
          const isAlarmElement = findIsAlarmElement(tgt);
          setPointCtxMenu({ x: cx, y: cy, pointId, isAlarmElement });
        }, 500);
        return;
      }
    }
    // Middle-click, Alt+left-click, or left-click on background canvas (not interactive elements)
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
      // Cancel long-press if touch moves more than 10px
      if (e.pointerType === "touch" && longPressOrigin.current) {
        const dx = e.clientX - longPressOrigin.current.x;
        const dy = e.clientY - longPressOrigin.current.y;
        if (Math.hypot(dx, dy) > 10) cancelLongPress();
      }
      // Pinch-to-zoom gesture (§4.1)
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
    // Cancel long-press if finger lifts before 500ms
    if (e.pointerType === "touch") cancelLongPress();
  }, []);

  const handleMinimapViewportChange = useCallback(
    (panX: number, panY: number) => {
      setViewport((vp) => ({ ...vp, panX, panY }));
    },
    [],
  );

  // ---- Zoom controls -------------------------------------------------------

  function zoomIn() {
    setViewport((vp) => ({ ...vp, zoom: Math.min(8, vp.zoom * 1.25) }));
  }
  function zoomOut() {
    setViewport((vp) => ({ ...vp, zoom: Math.max(0.05, vp.zoom / 1.25) }));
  }
  function zoomFit() {
    if (!graphic?.scene_data) return;
    const { width, height } = graphic.scene_data.canvas;
    const fitZoom = Math.min(
      viewport.screenWidth / width,
      viewport.screenHeight / height,
    );
    setViewport((vp) => ({ ...vp, zoom: fitZoom, panX: 0, panY: 0 }));
  }
  function zoom100() {
    setViewport((vp) => ({ ...vp, zoom: 1, panX: 0, panY: 0 }));
  }

  // ---- Export --------------------------------------------------------------

  /** Produces spec-compliant filename: process_graphic_{YYYY-MM-DD_HHmm}.{ext} */
  function exportFilename(ext: string): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(":", "");
    return `process_graphic_${datePart}_${timePart}.${ext}`;
  }

  const LARGE_EXPORT_THRESHOLD = 50_000;

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportDropdownOpen(false);
    // Collect currently subscribed/visible point values from the ref (always current)
    const currentValues = pointValuesRef.current;
    const columns =
      currentValues.size > 0
        ? Array.from(currentValues.keys())
        : ["pointId", "value", "quality"];
    const estimatedRows = currentValues.size;

    try {
      if (estimatedRows >= LARGE_EXPORT_THRESHOLD) {
        // Async path: submit job, WebSocket export_complete will notify the user
        await exportsApi.create({
          module: "process",
          entity: "graphic",
          format,
          scope: "all",
          columns,
        });
        // If 'queued', the WebSocket export_complete event will show a toast
      } else {
        const result = await exportsApi.create({
          module: "process",
          entity: "graphic",
          format,
          scope: "all",
          columns,
        });
        if (result.type === "download") {
          exportsApi.triggerDownload(result.blob, exportFilename(format));
        }
      }
    } catch (err) {
      console.error("[Process] Export failed:", err);
    }
  }, []);

  // ---- Print (§14.2, §10.2) — server-side PDF, A1/A3 large-format ----------

  const handlePrint = useCallback(async () => {
    const token = localStorage.getItem("io_access_token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = "Bearer " + token;
    try {
      const apiBase = (import.meta.env.VITE_API_URL ?? "") as string;
      const res = await fetch(apiBase + "/api/process/print", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ graphic_id: selectedId }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition") ?? "";
        const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
          contentDisposition,
        );
        const filename =
          filenameMatch?.[1]?.replace(/['"]/g, "") ?? "process-print.pdf";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[Process] Print failed:", err);
    }
  }, [selectedId]);

  // ---- Fullscreen ----------------------------------------------------------

  function toggleFullscreen() {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
    setIsFullscreen((v) => !v);
  }

  // ---- Navigation history + breadcrumbs (§6.4) ----------------------------

  const [navHistory, setNavHistory] = useState<NavEntry[]>([]);
  const [navHistoryIndex, setNavHistoryIndex] = useState(-1);

  // Navigate with history tracking (used for in-graphic navigation links)
  const handleNavigateWithHistory = useCallback(
    (targetId: string) => {
      const name =
        graphicsList?.find((g) => g.id === targetId)?.name ?? targetId;
      setNavHistory((prev) => {
        const current: NavEntry = {
          graphicId: selectedId ?? "",
          name:
            graphicsList?.find((g) => g.id === selectedId)?.name ??
            selectedId ??
            "",
          panX: viewport.panX,
          panY: viewport.panY,
          zoom: viewport.zoom,
        };
        // Truncate forward history beyond current index, then append current + move to new
        const base =
          navHistoryIndex >= 0 ? prev.slice(0, navHistoryIndex + 1) : prev;
        const next = [...base, current].slice(-20);
        setNavHistoryIndex(next.length - 1);
        return next;
      });
      handleSelectView(targetId, name);
    },
    [graphicsList, handleSelectView, selectedId, viewport, navHistoryIndex],
  );

  // Navigate from scene renderer navigation links
  const handleNavigate = handleNavigateWithHistory;

  function navBack() {
    if (navHistoryIndex < 0) return;
    const entry = navHistory[navHistoryIndex];
    if (!entry) return;
    setNavHistoryIndex((i) => i - 1);
    handleSelectView(entry.graphicId, entry.name);
    setViewport((vp) => ({
      ...vp,
      panX: entry.panX,
      panY: entry.panY,
      zoom: entry.zoom,
    }));
  }

  function navForward() {
    if (navHistoryIndex >= navHistory.length - 1) return;
    const entry = navHistory[navHistoryIndex + 1];
    if (!entry) return;
    setNavHistoryIndex((i) => i + 1);
    handleSelectView(entry.graphicId, entry.name);
    setViewport((vp) => ({
      ...vp,
      panX: entry.panX,
      panY: entry.panY,
      zoom: entry.zoom,
    }));
  }

  // ---- Hover tooltip (§7.3) -----------------------------------------------

  const [tooltip, setTooltip] = useState<PointTooltip | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so tooltip callback always reads latest point values without ordering constraint
  const pointValuesRef = useRef<Map<string, ScenePointValue>>(new Map());
  // Track the last hovered point ID for Ctrl+I shortcut
  const lastHoveredPointRef = useRef<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target);
      if (pointId)
        lastHoveredPointRef.current = {
          id: pointId,
          x: e.clientX,
          y: e.clientY,
        };
      if (!pointId) {
        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current);
          tooltipTimerRef.current = null;
        }
        // Mouse moved off a point — dismiss tooltip after short delay
        if (tooltipDismissRef.current) clearTimeout(tooltipDismissRef.current);
        tooltipDismissRef.current = setTimeout(() => {
          setTooltip(null);
          tooltipDismissRef.current = null;
        }, 800);
        return;
      }
      // Mouse moved onto a point — cancel any pending dismiss
      if (tooltipDismissRef.current) {
        clearTimeout(tooltipDismissRef.current);
        tooltipDismissRef.current = null;
      }
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      const clientX = e.clientX;
      const clientY = e.clientY;
      tooltipTimerRef.current = setTimeout(() => {
        const pv = pointValuesRef.current.get(pointId);
        setTooltip({
          x: clientX,
          y: clientY,
          pointId,
          value:
            pv?.value !== null && pv?.value !== undefined
              ? String(pv.value)
              : "---",
          quality: pv?.quality ?? "unknown",
          timestamp: new Date().toLocaleTimeString(),
        });
      }, 500);
    },
    [],
  );

  const handleContainerMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    if (tooltipDismissRef.current) {
      clearTimeout(tooltipDismissRef.current);
      tooltipDismissRef.current = null;
    }
    setTooltip(null);
  }, []);

  useEffect(
    () => () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (tooltipDismissRef.current) clearTimeout(tooltipDismissRef.current);
    },
    [],
  );

  // ---- Context menus (§13) -------------------------------------------------

  const [canvasCtxMenu, setCanvasCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pointCtxMenu, setPointCtxMenu] = useState<{
    x: number;
    y: number;
    pointId: string;
    isAlarmElement: boolean;
  } | null>(null);
  const [pointDetailPanels, setPointDetailPanels] = useState<
    { id: string; pointId: string; x: number; y: number }[]
  >([]);
  const MAX_DETAIL_PANELS = 3;

  const openPointDetail = useCallback(
    (pointId: string, x: number, y: number) => {
      setPointDetailPanels((prev) => {
        const existing = prev.find((p) => p.pointId === pointId);
        if (existing) return prev;
        const next = [...prev, { id: crypto.randomUUID(), pointId, x, y }];
        return next.length > MAX_DETAIL_PANELS
          ? next.slice(next.length - MAX_DETAIL_PANELS)
          : next;
      });
    },
    [],
  );

  const closePointDetail = useCallback((id: string) => {
    setPointDetailPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleContainerContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const pointId = findPointId(e.target);
      if (pointId) {
        const isAlarmElement = findIsAlarmElement(e.target);
        setPointCtxMenu({
          x: e.clientX,
          y: e.clientY,
          pointId,
          isAlarmElement,
        });
      } else {
        setCanvasCtxMenu({ x: e.clientX, y: e.clientY });
      }
    },
    [],
  );

  // ---- Minimap state — persisted server-side (spec §4.2) -------------------
  // minimapVisible: whether the minimap overlay is shown at all (M key / Map button).
  // minimapCollapsed: whether the minimap is in its compact "collapsed" state (internal
  //   toggle inside the minimap chrome — separate from visibility).
  // Both use useUserPreference which writes to PATCH /api/user/preferences
  // and seeds from localStorage on first mount while the server response loads.

  const [minimapVisible, setMinimapVisible] = useUserPreference<boolean>(
    "process_minimap_visible",
    true,
  );
  const [minimapCollapsed, setMinimapCollapsed] = useUserPreference<boolean>(
    "process_minimap_collapsed",
    false,
  );

  // ---- Keyboard shortcuts (§12.1) ------------------------------------------

  // Ref so keyboard handler always reads latest isHistorical without ordering constraint
  const isHistoricalRef = useRef(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const PAN_STEP = e.shiftKey ? 500 : 100;
      // Alt+Left — navigate back
      if (alt && e.key === "ArrowLeft") {
        e.preventDefault();
        navBack();
        return;
      }
      // Alt+Right — navigate forward
      if (alt && e.key === "ArrowRight") {
        e.preventDefault();
        navForward();
        return;
      }
      // Arrow key pan (no modifier)
      if (!ctrl && !alt) {
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
        // M — toggle minimap visibility (persisted via server-side user preferences, spec §4.2, §12.1)
        if (e.key === "m" || e.key === "M") {
          setMinimapVisible(!minimapVisible);
          return;
        }
        // + / = — zoom in
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          zoomIn();
          return;
        }
        // - — zoom out
        if (e.key === "-") {
          e.preventDefault();
          zoomOut();
          return;
        }
        // [ — toggle sidebar (not in historical mode per §12.2)
        if (e.key === "[" && !isHistoricalRef.current) {
          e.preventDefault();
          toggleSidebar();
          return;
        }
        // Escape — exit kiosk mode if active, otherwise close context menus and tooltip
        if (e.key === "Escape") {
          if (isKiosk) {
            setKiosk(false);
            return;
          }
          setCanvasCtxMenu(null);
          setPointCtxMenu(null);
          setTooltip(null);
          return;
        }
      }
      // Ctrl+0 — zoom to fit
      if (ctrl && e.key === "0") {
        e.preventDefault();
        zoomFit();
        return;
      }
      // Ctrl+1 — zoom to 100%
      if (ctrl && e.key === "1") {
        e.preventDefault();
        zoom100();
        return;
      }
      // Ctrl+Shift+B — add bookmark
      if (ctrl && e.shiftKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        handleAddBookmark();
        return;
      }
      // Ctrl+I — open Point Detail for hovered point
      if (ctrl && (e.key === "i" || e.key === "I") && !e.shiftKey) {
        e.preventDefault();
        if (lastHoveredPointRef.current) {
          const { id, x, y } = lastHoveredPointRef.current;
          openPointDetail(id, x, y);
        }
        return;
      }
      // Ctrl+P — server-side print (§12.1); prevent browser print dialog
      if (ctrl && (e.key === "p" || e.key === "P") && !e.shiftKey) {
        e.preventDefault();
        void handlePrint();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    zoomFit,
    zoom100,
    handleAddBookmark,
    toggleSidebar,
    navBack,
    navForward,
    openPointDetail,
    isKiosk,
    setKiosk,
    handlePrint,
    minimapVisible,
    setMinimapVisible,
  ]);

  // ---- Debounced viewport for point subscriptions ─────────────────────────

  const [debouncedVp, setDebouncedVp] = useState(viewport);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedVp(viewport), 200);
    return () => clearTimeout(id);
  }, [viewport]);

  // ---- Spatial binding index (rebuilt only when scene_data changes) ────────
  // spec §5.6: flat sorted array by default; RBush R-tree when >2,000 entries.

  const bindingIndex = useMemo(() => {
    if (!graphic?.scene_data) return [];
    return buildBindingIndex(graphic.scene_data);
  }, [graphic?.scene_data]);

  const rbushIndex = useMemo(() => {
    if (bindingIndex.length <= RBUSH_THRESHOLD) return null;
    return buildRBushIndex(bindingIndex);
  }, [bindingIndex]);

  // ---- Visible point IDs — queried from the pre-built index ────────────────

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

  const totalPoints = useMemo(() => {
    if (!graphic?.scene_data) return 0;
    return countTotalPoints(graphic.scene_data);
  }, [graphic?.scene_data]);

  // ---- Playback mode -------------------------------------------------------

  const {
    mode: playbackMode,
    timestamp: playbackTs,
    setMode: setPlaybackMode,
  } = usePlaybackStore();
  const isHistorical = playbackMode === "historical";

  // ---- Real-time / historical values ---------------------------------------

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

  // Keep refs in sync so handlers defined earlier always read current values
  isHistoricalRef.current = isHistorical;
  pointValuesRef.current = pointValues;

  // ---- Derived display values ----------------------------------------------

  const lodLevel = zoomToLod(viewport.zoom);
  const lodName = LOD_NAMES[lodLevel];
  const zoomPct = Math.round(viewport.zoom * 100);
  const viewName = selectedId
    ? (graphicsList?.find((g) => g.id === selectedId)?.name ?? "")
    : "";

  const connectedDot =
    connectionState === "connected"
      ? { color: "var(--io-success)", label: "Connected" }
      : connectionState === "connecting"
        ? { color: "var(--io-warning)", label: "Connecting" }
        : { color: "var(--io-danger)", label: "Disconnected" };

  // ---- Render --------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-bg)",
        overflow: "hidden",
      }}
    >
      {/* Main content row: sidebar + viewport */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          minHeight: 0,
        }}
      >
        {/* Left sidebar — hidden in kiosk mode */}
        {!isKiosk && (
          <ProcessSidebar
            visible={sidebarVisible}
            onToggle={toggleSidebar}
            selectedId={selectedId}
            onSelectView={handleSelectView}
            bookmarks={viewportBookmarks}
            onSelectBookmark={handleSelectBookmark}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onRenameBookmark={handleRenameBookmark}
            recentViews={recentViews}
            graphicsList={graphicsList}
            graphicsLoading={graphicsLoading}
          />
        )}

        {/* Viewport area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Breadcrumb navigation bar (§6.4) — only when history depth > 1 and not in kiosk mode */}
          {!isKiosk && navHistory.length > 0 && (
            <div
              style={{
                height: 28,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 10px",
                background: "var(--io-surface-secondary)",
                borderBottom: "1px solid var(--io-border)",
                fontSize: 11,
                color: "var(--io-text-muted)",
                userSelect: "none",
                overflowX: "auto",
              }}
            >
              <button
                onClick={navBack}
                disabled={navHistoryIndex < 0}
                title="Navigate back (Alt+Left)"
                style={{
                  background: "none",
                  border: "none",
                  cursor: navHistoryIndex >= 0 ? "pointer" : "default",
                  color:
                    navHistoryIndex >= 0
                      ? "var(--io-text-primary)"
                      : "var(--io-border)",
                  padding: "0 4px",
                  fontSize: 12,
                }}
              >
                ‹
              </button>
              {navHistory.map((entry, i) => (
                <span
                  key={`${entry.graphicId}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => {
                      setNavHistoryIndex(i - 1);
                      handleSelectView(entry.graphicId, entry.name);
                      setViewport((vp) => ({
                        ...vp,
                        panX: entry.panX,
                        panY: entry.panY,
                        zoom: entry.zoom,
                      }));
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color:
                        i === navHistoryIndex
                          ? "var(--io-text-primary)"
                          : "var(--io-text-muted)",
                      fontWeight: i === navHistoryIndex ? 600 : 400,
                      fontSize: 11,
                      padding: "0 2px",
                    }}
                  >
                    {entry.name || entry.graphicId}
                  </button>
                  {i < navHistory.length - 1 && (
                    <span style={{ color: "var(--io-border)" }}>›</span>
                  )}
                </span>
              ))}
              {viewName && <span style={{ color: "var(--io-border)" }}>›</span>}
              {viewName && (
                <span style={{ color: "var(--io-accent)", fontWeight: 600 }}>
                  {viewName}
                </span>
              )}
              <button
                onClick={navForward}
                disabled={navHistoryIndex >= navHistory.length - 1}
                title="Navigate forward (Alt+Right)"
                style={{
                  background: "none",
                  border: "none",
                  cursor:
                    navHistoryIndex < navHistory.length - 1
                      ? "pointer"
                      : "default",
                  color:
                    navHistoryIndex < navHistory.length - 1
                      ? "var(--io-text-primary)"
                      : "var(--io-border)",
                  padding: "0 4px",
                  fontSize: 12,
                  marginLeft: "auto",
                }}
              >
                ›
              </button>
            </div>
          )}

          {/* Canvas */}
          <div
            ref={containerRef}
            style={{ flex: 1, position: "relative", overflow: "hidden" }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onMouseMove={handleContainerMouseMove}
            onMouseLeave={handleContainerMouseLeave}
            onContextMenu={handleContainerContextMenu}
          >
            {/* Empty state */}
            {!selectedId && (
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
                  Process Module
                </p>
                <p style={{ margin: 0, fontSize: 12 }}>
                  Select a graphic from the sidebar
                </p>
              </div>
            )}

            {/* Loading — module-shaped skeleton */}
            {selectedId && isLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "row",
                  background: "var(--io-surface-primary)",
                  overflow: "hidden",
                }}
              >
                {/* Sidebar skeleton */}
                <div
                  style={{
                    width: 220,
                    flexShrink: 0,
                    borderRight: "1px solid var(--io-border)",
                    padding: "12px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    className="io-skeleton"
                    style={{ height: 16, width: "60%", borderRadius: 4 }}
                  />
                  <div
                    className="io-skeleton"
                    style={{ height: 12, width: "90%", borderRadius: 4 }}
                  />
                  <div
                    className="io-skeleton"
                    style={{ height: 12, width: "75%", borderRadius: 4 }}
                  />
                  <div
                    className="io-skeleton"
                    style={{ height: 12, width: "85%", borderRadius: 4 }}
                  />
                  <div
                    className="io-skeleton"
                    style={{ height: 12, width: "70%", borderRadius: 4 }}
                  />
                  <div
                    className="io-skeleton"
                    style={{ height: 12, width: "80%", borderRadius: 4 }}
                  />
                  <div
                    className="io-skeleton"
                    style={{ height: 12, width: "65%", borderRadius: 4 }}
                  />
                </div>
                {/* Viewport + toolbar skeleton */}
                <div
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                >
                  {/* Main viewport area */}
                  <div className="io-skeleton" style={{ flex: 1 }} />
                  {/* Toolbar band at bottom */}
                  <div
                    style={{
                      height: 40,
                      borderTop: "1px solid var(--io-border)",
                      padding: "0 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      className="io-skeleton"
                      style={{ height: 20, width: 60, borderRadius: 4 }}
                    />
                    <div
                      className="io-skeleton"
                      style={{ height: 20, width: 60, borderRadius: 4 }}
                    />
                    <div
                      className="io-skeleton"
                      style={{ height: 20, width: 80, borderRadius: 4 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Scene renderer */}
            {graphic?.scene_data &&
              (isTablet ? (
                <TransformWrapper
                  minScale={0.05}
                  maxScale={8}
                  velocityAnimation={{ sensitivity: 1, animationTime: 200 }}
                  panning={{ velocityDisabled: false }}
                >
                  <TransformComponent
                    wrapperStyle={{ width: "100%", height: "100%" }}
                  >
                    <SceneRenderer
                      document={graphic.scene_data}
                      viewport={viewport}
                      pointValues={pointValues}
                      onNavigate={handleNavigate}
                      style={{ position: "absolute", inset: 0 }}
                    />
                  </TransformComponent>
                </TransformWrapper>
              ) : (
                <SceneRenderer
                  document={graphic.scene_data}
                  viewport={viewport}
                  pointValues={pointValues}
                  onNavigate={handleNavigate}
                  style={{ position: "absolute", inset: 0 }}
                />
              ))}

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

            {/* Kiosk mode — corner-hover exit trigger (1.5s dwell in bottom-right corner) */}
            {isKiosk && (
              <div
                style={{
                  position: "fixed",
                  bottom: 0,
                  right: 0,
                  width: 48,
                  height: 48,
                  zIndex: 9999,
                }}
                onMouseEnter={() => {
                  kioskExitTimerRef.current = setTimeout(
                    () => setKiosk(false),
                    1500,
                  );
                }}
                onMouseLeave={() => {
                  if (kioskExitTimerRef.current) {
                    clearTimeout(kioskExitTimerRef.current);
                    kioskExitTimerRef.current = null;
                  }
                }}
              />
            )}

            {/* Hover tooltip (§7.3) */}
            {tooltip && (
              <div
                style={{
                  position: "fixed",
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
                  {tooltip.pointId}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontFamily: "var(--io-font-mono)",
                    fontWeight: 600,
                  }}
                >
                  {tooltip.value}
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
          </div>

          {/* Canvas background right-click menu (§13.1) */}
          {canvasCtxMenu && (
            <ContextMenu
              x={canvasCtxMenu.x}
              y={canvasCtxMenu.y}
              onClose={() => setCanvasCtxMenu(null)}
              items={[
                {
                  label: "Zoom to Fit",
                  onClick: () => {
                    zoomFit();
                    setCanvasCtxMenu(null);
                  },
                },
                {
                  label: "Zoom to 100%",
                  onClick: () => {
                    zoom100();
                    setCanvasCtxMenu(null);
                  },
                },
                {
                  label: "Bookmark This View…",
                  onClick: () => {
                    handleAddBookmark();
                    setCanvasCtxMenu(null);
                  },
                },
                {
                  label: "Open in Designer",
                  divider: true,
                  onClick: () => {
                    if (selectedId)
                      navigate(`/designer/graphics/${selectedId}/edit`);
                  },
                },
                ...(canExportGraphic && selectedId
                  ? [
                      {
                        label: "Export Graphic…",
                        onClick: async () => {
                          setCanvasCtxMenu(null);
                          try {
                            const blob =
                              await graphicsApi.exportIographic(selectedId);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${selectedId}.iographic`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error(
                              "[Process] Export graphic failed",
                              err,
                            );
                          }
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}

          {/* Point right-click / long-press menu (§13.3) — uses shared PointContextMenu */}
          {pointCtxMenu && (
            <PointContextMenu
              pointId={pointCtxMenu.pointId}
              tagName={pointCtxMenu.pointId}
              isAlarm={pointCtxMenu.isAlarmElement}
              isAlarmElement={pointCtxMenu.isAlarmElement}
              open={true}
              onOpenChange={(open) => {
                if (!open) setPointCtxMenu(null);
              }}
            >
              {/* Zero-size absolutely-positioned anchor at the right-click / long-press location */}
              <div
                style={{
                  position: "fixed",
                  left: pointCtxMenu.x,
                  top: pointCtxMenu.y,
                  width: 0,
                  height: 0,
                  pointerEvents: "none",
                }}
              />
            </PointContextMenu>
          )}

          {/* Point Detail floating panels (up to 3 concurrent) */}
          {pointDetailPanels.map((panel) => (
            <PointDetailPanel
              key={panel.id}
              pointId={panel.pointId}
              onClose={() => closePointDetail(panel.id)}
              anchorPosition={{ x: panel.x, y: panel.y }}
            />
          ))}

          {/* View toolbar — hidden in kiosk mode */}
          {!isKiosk && (
            <div
              style={{
                height: 40,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 10px",
                background: "var(--io-surface)",
                borderTop: "1px solid var(--io-border)",
              }}
            >
              {/* Zoom controls */}
              <span
                style={{
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                  minWidth: 40,
                  textAlign: "right",
                }}
              >
                {zoomPct}%
              </span>
              <button
                onClick={zoomOut}
                title="Zoom out"
                style={toolbarBtnStyle}
              >
                −
              </button>
              <button onClick={zoomIn} title="Zoom in" style={toolbarBtnStyle}>
                +
              </button>
              <button
                onClick={zoomFit}
                title="Fit to window"
                style={toolbarBtnStyle}
              >
                Fit
              </button>
              <button
                onClick={zoom100}
                title="100% zoom"
                style={toolbarBtnStyle}
              >
                100%
              </button>

              {/* Divider */}
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "var(--io-border)",
                  margin: "0 4px",
                }}
              />

              {/* LIVE / HISTORICAL toggle */}
              <button
                onClick={() => setPlaybackMode("live")}
                style={{
                  ...toolbarBtnStyle,
                  background: !isHistorical
                    ? "var(--io-accent-subtle)"
                    : undefined,
                  color: !isHistorical
                    ? "var(--io-accent)"
                    : "var(--io-text-muted)",
                  borderColor: !isHistorical
                    ? "var(--io-accent)"
                    : "var(--io-border)",
                }}
              >
                ● Live
              </button>
              <button
                onClick={() => setPlaybackMode("historical")}
                style={{
                  ...toolbarBtnStyle,
                  background: isHistorical
                    ? "var(--io-warning-subtle)"
                    : undefined,
                  color: isHistorical
                    ? "var(--io-warning)"
                    : "var(--io-text-muted)",
                  borderColor: isHistorical
                    ? "var(--io-warning)"
                    : "var(--io-border)",
                }}
              >
                ◷ Historical
              </button>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Bookmark button */}
              <button
                onClick={handleAddBookmark}
                title="Save viewport as bookmark"
                style={{
                  ...toolbarBtnStyle,
                  color: "var(--io-accent)",
                  fontSize: 14,
                  padding: "2px 6px",
                }}
              >
                ★
              </button>

              {/* Export split button — gated by process:export */}
              {canExport && (
                <div style={{ position: "relative", display: "inline-flex" }}>
                  {/* Left: primary Export button */}
                  <button
                    onClick={() => setExportDropdownOpen((v) => !v)}
                    title="Export visible point values"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--io-border)",
                      borderRight: "none",
                      borderRadius: "4px 0 0 4px",
                      padding: "2px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: "var(--io-text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      lineHeight: 1.5,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Export
                  </button>
                  {/* Right: chevron opens dropdown */}
                  <button
                    onClick={() => setExportDropdownOpen((v) => !v)}
                    title="Choose export format"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--io-border)",
                      borderRadius: "0 4px 4px 0",
                      padding: "2px 5px",
                      cursor: "pointer",
                      fontSize: 10,
                      color: "var(--io-text-muted)",
                      display: "flex",
                      alignItems: "center",
                      lineHeight: 1.5,
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 10 10"
                      fill="currentColor"
                    >
                      <polygon points="2,3 8,3 5,7" />
                    </svg>
                  </button>
                  {exportDropdownOpen && (
                    <>
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 999 }}
                        onClick={() => setExportDropdownOpen(false)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          right: 0,
                          zIndex: 1000,
                          background: "var(--io-surface-elevated)",
                          border: "1px solid var(--io-border)",
                          borderRadius: 6,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                          overflow: "hidden",
                          minWidth: 130,
                          marginBottom: 4,
                        }}
                      >
                        {(
                          [
                            { label: "CSV", fmt: "csv" },
                            { label: "XLSX", fmt: "xlsx" },
                            { label: "JSON", fmt: "json" },
                            { label: "PDF", fmt: "pdf" },
                            { label: "Parquet", fmt: "parquet" },
                            { label: "HTML", fmt: "html" },
                          ] as { label: string; fmt: ExportFormat }[]
                        ).map(({ label, fmt }) => (
                          <button
                            key={fmt}
                            onClick={() => {
                              void handleExport(fmt);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "7px 13px",
                              background: "none",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: 12,
                              color: "var(--io-text-primary)",
                            }}
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background =
                                "var(--io-surface-secondary)";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.background = "none";
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Print button — gated by process:export, hidden when permission absent (§16.1) */}
              {canExport && (
                <button
                  onClick={() => {
                    void handlePrint();
                  }}
                  title="Print graphic (server-side PDF, Ctrl+P)"
                  style={toolbarBtnStyle}
                >
                  Print
                </button>
              )}

              {/* Minimap toggle button — spec §4.2, §10.6 */}
              <button
                onClick={() => setMinimapVisible(!minimapVisible)}
                title="Toggle minimap (M)"
                style={{
                  ...toolbarBtnStyle,
                  background: minimapVisible
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                  color: minimapVisible
                    ? "var(--io-accent)"
                    : "var(--io-text-muted)",
                  borderColor: minimapVisible
                    ? "var(--io-accent)"
                    : "var(--io-border)",
                }}
              >
                Map
              </button>

              {/* Open in New Window button — opens detached process view, disabled when no graphic loaded */}
              <button
                onClick={() => {
                  if (selectedId)
                    window.open(
                      `/detached/process/${selectedId}`,
                      "_blank",
                      "noopener,noreferrer,width=1400,height=900",
                    );
                }}
                title={
                  selectedId ? "Open view in new window" : "No graphic loaded"
                }
                disabled={!selectedId}
                style={{
                  ...toolbarBtnStyle,
                  opacity: selectedId ? 1 : 0.4,
                  cursor: selectedId ? "pointer" : "not-allowed",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                title="Toggle fullscreen"
                style={toolbarBtnStyle}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {isFullscreen ? (
                    <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                  ) : (
                    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                  )}
                </svg>
              </button>
            </div>
          )}

          {/* Bookmark dialog — shown when user clicks ★ or presses Ctrl+Shift+B */}
          {bookmarkDialogOpen && (
            <BookmarkDialog
              onConfirm={handleBookmarkConfirm}
              onCancel={() => setBookmarkDialogOpen(false)}
            />
          )}

          {/* Historical Playback Bar (only in historical mode) */}
          {isHistorical && <HistoricalPlaybackBar />}

          {/* Status bar — hidden in kiosk mode */}
          {!isKiosk && (
            <div
              style={{
                height: 24,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0 10px",
                background: "var(--io-surface-secondary)",
                borderTop: "1px solid var(--io-border)",
                fontSize: 11,
                color: "var(--io-text-muted)",
                userSelect: "none",
              }}
            >
              {/* Connection status */}
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: connectedDot.color,
                    display: "inline-block",
                  }}
                />
                {connectedDot.label}
              </span>
              <span style={{ color: "var(--io-border)" }}>|</span>
              {/* Points subscribed */}
              <span>
                {visiblePointIds.length}/{totalPoints} points
              </span>
              <span style={{ color: "var(--io-border)" }}>|</span>
              {/* View name */}
              {viewName && (
                <>
                  <span
                    style={{
                      color: "var(--io-text-primary)",
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {viewName}
                  </span>
                  <span style={{ color: "var(--io-border)" }}>|</span>
                </>
              )}
              {/* LOD */}
              <span>
                LOD {lodLevel} – {lodName}
              </span>
              <span style={{ color: "var(--io-border)" }}>|</span>
              {/* Zoom */}
              <span>{zoomPct}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared toolbar button style
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
  lineHeight: 1.5,
  flexShrink: 0,
};
