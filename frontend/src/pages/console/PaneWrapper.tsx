import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TrendPane from "./panes/TrendPane";
import PointTablePane from "./panes/PointTablePane";
import AlarmListPane from "./panes/AlarmListPane";
import GraphicPane from "./panes/GraphicPane";
import { PaneErrorBoundary } from "./PaneErrorBoundary";
import ContextMenu from "../../shared/components/ContextMenu";
import { CONSOLE_DRAG_KEY, type ConsoleDragItem } from "./ConsolePalette";
import { graphicsApi } from "../../api/graphics";
import type { PaneConfig } from "./types";

export interface PaneWrapperProps {
  config: PaneConfig;
  /** When true, all interactive controls (drag, resize, configure, remove) are hidden. */
  locked?: boolean;
  isSelected?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onConfigure: (paneId: string) => void;
  onRemove: (paneId: string) => void;
  onSelect?: (paneId: string, addToSelection: boolean) => void;
  onPaletteDrop?: (paneId: string, item: ConsoleDragItem) => void;
  preserveAspectRatio?: boolean;
  /** Called with a deep copy of the pane config when user selects Copy */
  onCopy?: (pane: PaneConfig) => void;
  /** Called when user selects Duplicate */
  onDuplicate?: (paneId: string) => void;
  /** Called when user selects Zoom to Fit (graphic panes only) */
  onZoomToFit?: (paneId: string) => void;
  /** Called when user selects Reset Zoom (graphic panes only) */
  onResetZoom?: (paneId: string) => void;
  /** Called when user selects "Swap With..." — initiates swap mode */
  onSwapWith?: (paneId: string) => void;
  /** ID of the pane currently in swap-source mode (null = not swapping) */
  swapModeSourceId?: string | null;
  /** Called when this pane is clicked as the swap target */
  onSwapComplete?: (targetId: string) => void;
  /** Called when user selects a new graphic in the Replace dialog */
  onReplace?: (paneId: string, graphicId: string, graphicName: string) => void;
  /** Called when user toggles the pin on a pane header */
  onPinToggle?: (paneId: string, pinned: boolean) => void;
  /** Workspace ID — used to construct the detached window URL for "Open in New Window" */
  workspaceId?: string;
  /** When true, suppresses this pane's title bar in live mode (workspace-level override).
   *  Per-pane showTitle setting is preserved — this only affects rendering. */
  hideTitles?: boolean;
}

const PANE_TYPE_LABELS: Record<string, string> = {
  trend: "Trend",
  point_table: "Point Table",
  alarm_list: "Alarm List",
  graphic: "Graphic",
  blank: "Blank",
};

function PaneTypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        padding: "1px 7px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: "var(--io-surface-secondary)",
        color: "var(--io-text-muted)",
        border: "1px solid var(--io-border)",
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {PANE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Blank pane
// ---------------------------------------------------------------------------

function BlankPane({
  locked,
  onConfigure,
  paneId,
}: {
  locked: boolean;
  onConfigure: (id: string) => void;
  paneId: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "var(--io-text-muted)",
        fontSize: 13,
        background: "var(--io-surface)",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
      </svg>
      <span>Empty pane</span>
      {!locked && (
        <button
          onClick={() => onConfigure(paneId)}
          style={{
            background: "var(--io-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "7px 14px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Configure Pane
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaneWrapper
// ---------------------------------------------------------------------------

export default function PaneWrapper({
  config,
  locked = false,
  isSelected = false,
  isFullscreen = false,
  onToggleFullscreen,
  onConfigure,
  onRemove,
  onSelect,
  onPaletteDrop,
  preserveAspectRatio = true,
  onCopy,
  onDuplicate,
  onZoomToFit,
  onResetZoom,
  onSwapWith,
  swapModeSourceId,
  onSwapComplete,
  onReplace,
  onPinToggle,
  workspaceId,
  hideTitles = false,
}: PaneWrapperProps) {
  const navigate = useNavigate();
  const title = config.title ?? PANE_TYPE_LABELS[config.type] ?? config.type;
  const containerRef = useRef<HTMLDivElement>(null);
  const [paneCtxMenu, setPaneCtxMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [replaceSearch, setReplaceSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  useEffect(() => {
    function onFSChange() {
      setIsBrowserFullscreen(
        document.fullscreenElement === containerRef.current,
      );
    }
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  function handleBrowserFullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    if (isBrowserFullscreen) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  // Fill-workspace and browser fullscreen are mutually exclusive. If browser
  // fullscreen is active when fill-workspace is toggled, exit it first so the
  // portal PaneWrapper instance starts clean (it won't inherit this state).
  function handleToggleMaximize(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (isBrowserFullscreen) document.exitFullscreen();
    onToggleFullscreen?.();
  }

  const { data: replaceGraphics = [] } = useQuery({
    queryKey: ["console-replace-graphics"],
    queryFn: async () => {
      const r = await graphicsApi.list({ scope: "console" });
      if (!r.success) return [];
      return r.data.data ?? [];
    },
    enabled: replaceDialogOpen,
    staleTime: 30_000,
  });

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(CONSOLE_DRAG_KEY)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the pane itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    setDragOver(false);
    const raw = e.dataTransfer.getData(CONSOLE_DRAG_KEY);
    if (!raw) return;
    try {
      const item = JSON.parse(raw) as ConsoleDragItem;
      onPaletteDrop?.(config.id, item);
    } catch {
      // ignore malformed
    }
  }

  const isSwapSource = swapModeSourceId === config.id;
  const isSwapTarget =
    swapModeSourceId != null && swapModeSourceId !== config.id;

  function handlePaneClick(e: React.MouseEvent) {
    // If swap mode is active and this is a valid target, complete the swap
    if (isSwapTarget) {
      onSwapComplete?.(config.id);
      return;
    }
    // Ignore clicks on buttons / context menus
    if ((e.target as HTMLElement).closest('button, [role="menu"]')) return;
    onSelect?.(config.id, e.ctrlKey || e.metaKey || e.shiftKey);
  }

  // When isFullscreen=true, this component is rendered inside a portal overlay
  // div (position:absolute;inset:0) that already escapes the RGL transform
  // ancestor — so we just fill height:100% in both modes.
  // The 200ms CSS transition is owned by the portal wrapper in WorkspaceGrid.
  const fullscreenStyle: React.CSSProperties = { height: "100%" };

  // Double-click on the pane background activates fullscreen (spec §5.11).
  // Guards: not on a point-bound element, not on a button.
  function handleDoubleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-point-id]")) return; // point-bound → Point Detail, not fullscreen
    if (target.closest('button, [role="menu"]')) return;
    handleToggleMaximize();
  }

  // Determine whether the title bar should render.
  // - locked: render only when showTitle is true AND workspace hideTitles is false
  // - unlocked + hideTitles OFF: always render (drag handle + configure/remove buttons)
  // - unlocked + hideTitles ON: suppress full header; a thin drag strip is shown instead
  const showHeader = !hideTitles && (!locked || config.showTitle !== false);
  // Thin drag affordance when TT is ON in unlocked mode — no visible header but pane
  // must still have an io-pane-drag-handle element for react-grid-layout dragging.
  const showDragStrip = hideTitles && !locked;

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handlePaneClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        // Only show pane context menu if the target is not an SVG element with a
        // data-point-id (point context menus are handled inside GraphicPane).
        const target = e.target as HTMLElement;
        if (target.closest("[data-point-id]")) return;
        e.preventDefault();
        e.stopPropagation();
        setPaneCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--io-surface)",
        contain: "layout style paint",
        border: dragOver
          ? "2px dashed var(--io-accent)"
          : isSwapSource
            ? "2px solid #F59E0B"
            : isSwapTarget
              ? "2px dashed var(--io-accent)"
              : isSelected
                ? "2px solid var(--io-accent)"
                : hovered
                  ? "1px solid var(--io-border)"
                  : "1px solid transparent",
        borderRadius: 4,
        overflow: "hidden",
        boxSizing: "border-box",
        cursor: isSwapTarget ? "crosshair" : undefined,
        outline: isSelected ? "1px solid var(--io-accent)" : undefined,
        outlineOffset: isSelected ? "-1px" : undefined,
        ...fullscreenStyle,
      }}
    >
      {/* Thin drag strip — only when TT is ON in unlocked mode. Gives react-grid-layout
          a drag handle without showing a visible title bar. */}
      {showDragStrip && (
        <div
          className="io-pane-drag-handle"
          style={{ height: 4, flexShrink: 0, cursor: "grab" }}
        />
      )}

      {/* Header — io-pane-drag-handle when titles are visible.
          When unlocked + hideTitles OFF: always renders (drag handle + configure/remove buttons).
          When locked: renders only when showTitle:true AND !hideTitles. */}
      {showHeader && (
        <div
          className="io-pane-drag-handle"
          onContextMenu={(e) => {
            // Header context menu — always show regardless of target
            e.preventDefault();
            e.stopPropagation();
            setPaneCtxMenu({ x: e.clientX, y: e.clientY });
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            height: 36,
            flexShrink: 0,
            background: "var(--io-surface-secondary)",
            borderBottom: "1px solid var(--io-border)",
            cursor: !locked ? "grab" : "context-menu",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--io-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {/* When unlocked show the raw title (no type-label fallback); locked shows display title */}
            {!locked ? (config.title ?? "") : title}
          </span>

          {!locked && <PaneTypeBadge type={config.type} />}

          {/* Fill-workspace + browser-fullscreen buttons — locked/live mode only */}
          {locked && (
            <>
              {/* Fill workspace (maximize/restore within the workspace) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleMaximize();
                }}
                title={isFullscreen ? "Restore pane" : "Fill workspace"}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--io-text-muted)",
                  padding: "3px 5px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {isFullscreen ? (
                  /* Restore: arrows pointing inward */
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="10" y1="14" x2="3" y2="21" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                  </svg>
                ) : (
                  /* Maximize: arrows pointing outward */
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
              {/* True browser fullscreen */}
              <button
                onClick={handleBrowserFullscreen}
                title={isBrowserFullscreen ? "Exit fullscreen" : "Fullscreen"}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--io-text-muted)",
                  padding: "3px 5px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {isBrowserFullscreen ? (
                  /* Compress icon */
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                ) : (
                  /* Expand icon */
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                )}
              </button>
            </>
          )}

          {!locked && (
            <>
              {/* Pin button */}
              <button
                onClick={() => onPinToggle?.(config.id, !config.pinned)}
                title={config.pinned ? "Unpin pane" : "Pin pane"}
                style={{
                  background: config.pinned
                    ? "var(--io-accent-subtle)"
                    : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: config.pinned
                    ? "var(--io-accent)"
                    : "var(--io-text-muted)",
                  padding: "3px 5px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill={config.pinned ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="17" x2="12" y2="22" />
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                </svg>
              </button>

              {/* Configure button */}
              <button
                onClick={() => onConfigure(config.id)}
                title="Configure pane"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--io-text-muted)",
                  padding: "3px 5px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {/* Settings / gear icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {/* Remove button */}
              <button
                onClick={() => onRemove(config.id)}
                title="Remove pane"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--io-text-muted)",
                  padding: "3px 5px",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Hover-overlay fullscreen button — shown when header is hidden in live mode.
            Spec §5.2 (MOD-CONSOLE-038): "the fullscreen button moves to a hover-revealed overlay
            (absolutely positioned top-right corner of the pane, appears on hovered state)". */}
        {!showHeader && hovered && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              zIndex: 50,
              display: "flex",
              gap: 2,
            }}
          >
            {/* Fill workspace */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMaximize();
              }}
              title={isFullscreen ? "Restore pane" : "Fill workspace"}
              style={{
                background: "rgba(9,9,11,0.70)",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                padding: "4px 6px",
                cursor: "pointer",
                color: "var(--io-text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {isFullscreen ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="10" y1="14" x2="3" y2="21" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
            {/* Browser fullscreen */}
            <button
              onClick={handleBrowserFullscreen}
              title={isBrowserFullscreen ? "Exit fullscreen" : "Fullscreen"}
              style={{
                background: "rgba(9,9,11,0.70)",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                padding: "4px 6px",
                cursor: "pointer",
                color: "var(--io-text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {isBrowserFullscreen ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                  <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              )}
            </button>
          </div>
        )}

        <PaneErrorBoundary paneId={config.id}>
          {config.type === "trend" && (
            <TrendPane
              config={config}
              editMode={!locked}
              onConfigurePoints={onConfigure}
            />
          )}
          {config.type === "point_table" && (
            <PointTablePane
              config={config}
              editMode={!locked}
              onConfigurePoints={onConfigure}
            />
          )}
          {config.type === "alarm_list" && <AlarmListPane config={config} />}
          {config.type === "graphic" && config.graphicId && (
            <GraphicPane
              graphicId={config.graphicId}
              preserveAspectRatio={preserveAspectRatio}
            />
          )}
          {config.type === "graphic" && !config.graphicId && (
            <BlankPane
              locked={locked}
              onConfigure={onConfigure}
              paneId={config.id}
            />
          )}
          {config.type === "blank" && (
            <BlankPane
              locked={locked}
              onConfigure={onConfigure}
              paneId={config.id}
            />
          )}
        </PaneErrorBoundary>
      </div>

      {/* Pane context menu */}
      {paneCtxMenu && (
        <ContextMenu
          x={paneCtxMenu.x}
          y={paneCtxMenu.y}
          onClose={() => setPaneCtxMenu(null)}
          items={[
            {
              label: isFullscreen ? "Exit Full Screen" : "Full Screen",
              onClick: () => handleToggleMaximize(),
            },
            ...(workspaceId
              ? [
                  {
                    label: "Open in New Window",
                    onClick: () => {
                      setPaneCtxMenu(null);
                      window.open(
                        `/detached/console/${workspaceId}`,
                        "_blank",
                        "noopener,noreferrer,width=1400,height=900",
                      );
                    },
                  },
                ]
              : []),
            {
              label: "Copy",
              onClick: () => {
                if (onCopy) {
                  onCopy({ ...config });
                } else {
                  console.log("[Console] Copy pane", config.id);
                }
              },
            },
            {
              label: "Duplicate",
              onClick: () => {
                if (onDuplicate) {
                  onDuplicate(config.id);
                } else {
                  console.log("[Console] Duplicate pane", config.id);
                }
              },
            },
            {
              label: "Replace…",
              onClick: () => {
                setPaneCtxMenu(null);
                setReplaceSearch("");
                setReplaceDialogOpen(true);
              },
            },
            {
              label: "Swap With…",
              divider: true,
              onClick: () => {
                setPaneCtxMenu(null);
                onSwapWith?.(config.id);
              },
            },
            {
              label: "Configure Pane…",
              divider: true,
              onClick: () => onConfigure(config.id),
            },
            ...(config.type === "graphic"
              ? [
                  {
                    label: "Zoom to Fit",
                    onClick: () => {
                      if (onZoomToFit) {
                        onZoomToFit(config.id);
                      } else {
                        console.log("[Console] Zoom to fit pane", config.id);
                      }
                    },
                  },
                  {
                    label: "Reset Zoom",
                    onClick: () => {
                      if (onResetZoom) {
                        onResetZoom(config.id);
                      } else {
                        console.log("[Console] Reset zoom pane", config.id);
                      }
                    },
                  },
                  ...(config.graphicId
                    ? [
                        {
                          label: "Open in Designer",
                          divider: true,
                          onClick: () => {
                            navigate(
                              `/designer/graphics/${config.graphicId}/edit`,
                            );
                          },
                        },
                      ]
                    : []),
                ]
              : []),
            {
              label: "Remove Pane",
              divider: true,
              onClick: () => onRemove(config.id),
            },
          ]}
        />
      )}

      {/* Replace Graphic Dialog — graphic browser modal */}
      {replaceDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4000,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setReplaceDialogOpen(false);
          }}
        >
          <div
            style={{
              width: 480,
              maxHeight: "80vh",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: 8,
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--io-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                }}
              >
                Replace Graphic
              </span>
              <button
                onClick={() => setReplaceDialogOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "2px 4px",
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--io-border)",
              }}
            >
              <input
                autoFocus
                value={replaceSearch}
                onChange={(e) => setReplaceSearch(e.target.value)}
                placeholder="Search graphics…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 10px",
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 4,
                  color: "var(--io-text-primary)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {replaceGraphics
                .filter(
                  (g) =>
                    !replaceSearch ||
                    g.name.toLowerCase().includes(replaceSearch.toLowerCase()),
                )
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      onReplace?.(config.id, g.id, g.name);
                      setReplaceDialogOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "8px 16px",
                      border: "none",
                      background:
                        g.id === config.graphicId
                          ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
                          : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--io-text-muted)"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {g.name}
                    </span>
                    {g.id === config.graphicId && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--io-accent)",
                          fontWeight: 600,
                        }}
                      >
                        CURRENT
                      </span>
                    )}
                  </button>
                ))}
              {replaceGraphics.filter(
                (g) =>
                  !replaceSearch ||
                  g.name.toLowerCase().includes(replaceSearch.toLowerCase()),
              ).length === 0 && (
                <div
                  style={{
                    padding: "16px",
                    fontSize: 13,
                    color: "var(--io-text-muted)",
                    textAlign: "center",
                  }}
                >
                  No graphics found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
