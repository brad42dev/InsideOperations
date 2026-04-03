import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { GridLayout, noCompactor, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./WorkspaceGrid.css";
import PaneWrapper from "./PaneWrapper";
import { ErrorBoundary } from "../../shared/components/ErrorBoundary";
import type { ConsoleDragItem } from "./ConsolePalette";
import type { WorkspaceLayout, PaneConfig, GridItem } from "./types";
import {
  GRID_COLS,
  GRID_ROWS,
  MIN_W,
  MIN_H,
  presetToGridItems,
  resolveCollisions,
  finalizeLayout,
  type ResizeAxisHint,
} from "./layout-utils";

export { presetToGridItems };

// ---------------------------------------------------------------------------
// gridCompactor — noCompactor with allowOverlap:true
// ---------------------------------------------------------------------------
//
// RGL's noCompactor (type:null, allowOverlap:false) has a special branch in
// moveElementAwayFromCollision that fires when compactType===null and there is
// a north collision during a user action. It swaps the y positions of the two
// items, causing the pane to teleport to y=0 mid-drag and the neighbour to get
// pushed far down. This only manifests for north/NW/NE resize because those are
// the only handles that move the item's y position during the drag.
//
// Setting allowOverlap:true makes moveElement return early (cloneLayout) when
// collisions are detected, so items can overlap during the interaction. Our
// handleResizeStop / handleDragStop already call resolveCollisions to clean up
// at the end of every gesture — allowOverlap here just keeps the mid-drag
// frames clean.

const gridCompactor = { ...noCompactor, allowOverlap: true };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkspaceGridProps {
  workspace: WorkspaceLayout;
  /** When true, all drag/resize/remove/pin interactions are disabled. */
  locked?: boolean;
  /** Set of pane IDs that are pinned (protected from displacement). */
  pinnedIds?: Set<string>;
  selectedPaneIds?: Set<string>;
  preserveAspectRatio?: boolean;
  /** When true, all pane title bars are suppressed (workspace-level TT toggle). */
  hideTitles?: boolean;
  onConfigurePane: (paneId: string) => void;
  onRemovePane: (paneId: string) => void;
  onSelectPane?: (paneId: string, addToSelection: boolean) => void;
  onPaletteDrop?: (paneId: string, item: ConsoleDragItem) => void;
  onGridLayoutChange?: (items: GridItem[]) => void;
  /** Called when user right-clicks the workspace background (not on a pane) */
  onWorkspaceContextMenu?: (x: number, y: number) => void;
  /** Pane ID that initiated "Swap With..." mode */
  swapModeSourceId?: string | null;
  /** Called when user clicks "Swap With..." on a pane */
  onSwapWith?: (paneId: string) => void;
  /** Called when user clicks a swap target pane */
  onSwapComplete?: (targetId: string) => void;
  /** Called when user selects a new graphic in the Replace dialog */
  onReplace?: (paneId: string, graphicId: string, graphicName: string) => void;
  /** Called when F11 is pressed with no pane selected — triggers workspace browser fullscreen */
  onBrowserFullscreen?: () => void;
  /** Called when pin state changes on a pane */
  onPinToggle?: (paneId: string, pinned: boolean) => void;
}

// ---------------------------------------------------------------------------
// WorkspaceGrid — react-grid-layout (12-col drag-resize, doc 07)
// ---------------------------------------------------------------------------

export default function WorkspaceGrid({
  workspace,
  locked = false,
  pinnedIds = new Set<string>(),
  selectedPaneIds,
  preserveAspectRatio = true,
  hideTitles = false,
  onConfigurePane,
  onWorkspaceContextMenu,
  onRemovePane,
  onSelectPane,
  onPaletteDrop,
  onGridLayoutChange,
  swapModeSourceId,
  onSwapWith,
  onSwapComplete,
  onReplace,
  onBrowserFullscreen,
  onPinToggle,
}: WorkspaceGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);

  // ── Per-pane error boundary retry counters ───────────────────────────────
  const [paneRetryCounters, setPaneRetryCounters] = useState<
    Map<string, number>
  >(new Map());

  const retryPane = useCallback((paneId: string) => {
    setPaneRetryCounters((prev) => {
      const next = new Map(prev);
      next.set(paneId, (prev.get(paneId) ?? 0) + 1);
      return next;
    });
  }, []);

  // ── Fullscreen state (spec §5.11) ────────────────────────────────────────
  // Active fullscreen pane ID, or null when not in fullscreen.
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null);
  // When true, the exit animation is playing (portal is still mounted, fading out).
  const [fsExiting, setFsExiting] = useState(false);
  const fsExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // exitFullscreen — plays the 200ms exit animation then clears state.
  const exitFullscreen = useCallback(() => {
    setFsExiting(true);
    if (fsExitTimerRef.current) clearTimeout(fsExitTimerRef.current);
    fsExitTimerRef.current = setTimeout(() => {
      setFullscreenPaneId(null);
      setFsExiting(false);
    }, 210); // 210ms > 200ms animation so the frame completes before unmount
  }, []);

  const toggleFullscreen = useCallback(
    (paneId: string) => {
      if (
        fullscreenPaneId === paneId ||
        (fullscreenPaneId !== null && fsExiting)
      ) {
        exitFullscreen();
      } else {
        // Cancel any in-progress exit and enter the new pane immediately.
        if (fsExitTimerRef.current) {
          clearTimeout(fsExitTimerRef.current);
          fsExitTimerRef.current = null;
        }
        setFsExiting(false);
        setFullscreenPaneId(paneId);
      }
    },
    [fullscreenPaneId, fsExiting, exitFullscreen],
  );

  // Clean up exit timer on unmount.
  useEffect(
    () => () => {
      if (fsExitTimerRef.current) clearTimeout(fsExitTimerRef.current);
    },
    [],
  );

  // F11 keyboard shortcut: toggle fullscreen on single selected pane (spec §5.11)
  // Precedence: pane fullscreen > workspace browser fullscreen (decision CX-CONSOLE-WORKSPACE-FULLSCREEN)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault();
        if (fullscreenPaneId !== null) {
          // A pane is already in pane-fullscreen — exit it
          exitFullscreen();
          return;
        }
        if (selectedPaneIds && selectedPaneIds.size === 1) {
          // A pane is selected — enter pane fullscreen
          const [paneId] = selectedPaneIds;
          setFullscreenPaneId(paneId);
          return;
        }
        // No pane selected and no pane in fullscreen — fall through to workspace browser fullscreen
        onBrowserFullscreen?.();
      }
      if (e.key === "Escape" && fullscreenPaneId !== null) {
        exitFullscreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenPaneId, selectedPaneIds, exitFullscreen, onBrowserFullscreen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const safePanes: PaneConfig[] = workspace.panes ?? [];

  const gridItems: GridItem[] = workspace.gridItems?.length
    ? workspace.gridItems
    : presetToGridItems(workspace.layout, safePanes);

  // Always-current ref: callbacks (handleResizeStop, handleDragStop) capture
  // gridItems at closure creation time. If a second gesture starts before React
  // re-renders from the first gesture's onGridLayoutChange, those callbacks see
  // stale positions. Assigning the ref during render (not in useEffect) ensures
  // it's synchronously up-to-date on every render cycle.
  const gridItemsRef = useRef(gridItems);
  gridItemsRef.current = gridItems;

  const paneById = useMemo(
    () => new Map<string, PaneConfig>(safePanes.map((p) => [p.id, p])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace.panes],
  );

  // rowHeight: container divided by 288 rows — gives ~2px per row at 600px height
  const rowHeight = Math.max(1, containerHeight / GRID_ROWS);

  // Track whether a drag or resize is in progress so handleLayoutChange skips
  // the store update during intermediate frames. RGL fires onLayoutChange on
  // every mouse-move during drag/resize; we only want the final settled layout
  // (from onDragStop / onResizeStop) written to the store.
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);

  // Shift+corner aspect-ratio lock: record starting grid dimensions when resize begins.
  // On stop, if shift is held and both w and h changed, we snap h to maintain the
  // starting w/h grid-unit ratio. (Separate from the AR button, which locks to the
  // underlying graphic's pixel aspect ratio.)
  const shiftKeyRef = useRef(false);
  const resizeStartRef = useRef<{ i: string; x: number; y: number; w: number; h: number } | null>(null);

  // ── Drag/resize preview (ghost outlines for displaced panes) ─────────────
  // gestureIdRef: ID of the pane currently being dragged/resized (excluded
  //   from ghost rendering — it already has RGL's own placeholder).
  // previewLayout: resolved layout computed on every onDrag/onResize frame.
  // rawGestureLayout: unclamped layout as reported by RGL (before resolveCollisions).
  //   Used to detect when moved was capped below the user's drag position so
  //   we can render a ghost showing the actual committed size.
  const gestureIdRef = useRef<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<GridItem[] | null>(null);
  const rawGestureLayoutRef = useRef<GridItem[] | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftKeyRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftKeyRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDrag = useCallback(
    (
      _layout: readonly LayoutItem[],
      _old: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      if (!newItem) return;
      gestureIdRef.current = newItem.i;
      const withNewPos = gridItemsRef.current.map((item): GridItem =>
        item.i === newItem.i
          ? { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
          : item,
      );
      rawGestureLayoutRef.current = withNewPos;
      setPreviewLayout(
        resolveCollisions(withNewPos, newItem.i, pinnedIds, GRID_COLS, GRID_ROWS),
      );
    },
    [pinnedIds],
  );

  const handleResize = useCallback(
    (
      _layout: readonly LayoutItem[],
      _old: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      if (!newItem) return;
      gestureIdRef.current = newItem.i;
      // Mirror the axis-hint logic from handleResizeStop for accurate preview
      let axisHint: ResizeAxisHint | undefined;
      const startDims = resizeStartRef.current;
      if (startDims && startDims.i === newItem.i) {
        const yChanged = newItem.y !== startDims.y || newItem.h !== startDims.h;
        const xChanged = newItem.x !== startDims.x || newItem.w !== startDims.w;
        if (yChanged && !xChanged) axisHint = "y";
        else if (xChanged && !yChanged) axisHint = "x";
      }
      const withNewSize = gridItemsRef.current.map((item): GridItem =>
        item.i === newItem.i
          ? { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
          : item,
      );
      rawGestureLayoutRef.current = withNewSize;
      setPreviewLayout(
        resolveCollisions(withNewSize, newItem.i, pinnedIds, GRID_COLS, GRID_ROWS, axisHint),
      );
    },
    [pinnedIds],
  );

  const handleResizeStart = useCallback(
    (
      _layout: readonly LayoutItem[],
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      isResizingRef.current = true;
      if (newItem) {
        resizeStartRef.current = { i: newItem.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h };
      }
    },
    [],
  );

  const handleLayoutChange = useCallback(
    (layout: readonly LayoutItem[]) => {
      if (locked || !onGridLayoutChange) return;
      // Skip intermediate frames during active drag/resize — the stop handlers
      // apply the final resolved layout once the gesture completes.
      if (isDraggingRef.current || isResizingRef.current) return;
      onGridLayoutChange(
        layout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
      );
    },
    [locked, onGridLayoutChange],
  );

  // ── Resize stop — run collision resolver ─────────────────────────────────

  const handleResizeStop = useCallback(
    (
      _layout: readonly LayoutItem[],
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      // Keep isResizingRef true until the next animation frame — RGL calls
      // onLayoutChange(finalLayout) synchronously after this handler returns,
      // and we need handleLayoutChange to ignore that unresolved layout.
      requestAnimationFrame(() => {
        isResizingRef.current = false;
      });
      setPreviewLayout(null);
      gestureIdRef.current = null;
      rawGestureLayoutRef.current = null;
      const startDims = resizeStartRef.current;
      resizeStartRef.current = null;

      if (locked || !onGridLayoutChange || !newItem) return;

      // Detect single-axis resize direction to hint the collision resolver.
      // Without this, a north resize into a wide neighbor produces large x-overlap
      // and small y-overlap, causing the resolver to (incorrectly) push horizontally.
      let axisHint: ResizeAxisHint | undefined;
      if (startDims) {
        const yChanged = newItem.y !== startDims.y || newItem.h !== startDims.h;
        const xChanged = newItem.x !== startDims.x || newItem.w !== startDims.w;
        if (yChanged && !xChanged) axisHint = "y"; // n/s edge handle
        else if (xChanged && !yChanged) axisHint = "x"; // e/w edge handle
        // both changed = corner handle → no hint, use overlap heuristic
      }

      let finalW = newItem.w;
      let finalH = newItem.h;

      // Shift+corner: lock to starting grid-unit aspect ratio.
      // Only fires when both w and h changed (corner handle), not side handles.
      if (
        shiftKeyRef.current &&
        startDims?.i === newItem.i &&
        newItem.w !== startDims.w &&
        newItem.h !== startDims.h
      ) {
        const ar = startDims.w / startDims.h; // grid-unit ratio
        const wScale = newItem.w / startDims.w;
        const hScale = newItem.h / startDims.h;
        // Honour whichever axis changed proportionally more
        if (wScale >= hScale) {
          finalH = Math.max(MIN_H, Math.round(newItem.w / ar));
        } else {
          finalW = Math.max(MIN_W, Math.round(newItem.h * ar));
        }
      }

      // Apply final size to the resized item, then resolve collisions once.
      const withNewSize = gridItemsRef.current.map((item): GridItem =>
        item.i === newItem.i
          ? { i: item.i, x: newItem.x, y: newItem.y, w: finalW, h: finalH }
          : item,
      );
      onGridLayoutChange(
        finalizeLayout(
          resolveCollisions(withNewSize, newItem.i, pinnedIds, GRID_COLS, GRID_ROWS, axisHint),
          pinnedIds, GRID_COLS, GRID_ROWS,
        ),
      );
    },
    [locked, pinnedIds, onGridLayoutChange],
  );

  // ── Drag stop — run collision resolver ────────────────────────────────────

  const handleDragStop = useCallback(
    (
      _layout: readonly LayoutItem[],
      _oldItem: LayoutItem | null,
      newItem: LayoutItem | null,
    ) => {
      // Keep isDraggingRef true until the next animation frame — RGL calls
      // onLayoutChange(finalLayout) synchronously after this handler returns,
      // and we need handleLayoutChange to ignore that unresolved layout.
      requestAnimationFrame(() => {
        isDraggingRef.current = false;
      });
      setPreviewLayout(null);
      gestureIdRef.current = null;
      rawGestureLayoutRef.current = null;
      if (locked || !onGridLayoutChange) return;

      if (!newItem) {
        onGridLayoutChange(gridItems);
        return;
      }

      // Apply new position to the dragged pane, then resolve collisions
      // (resolveCollisions Phase 3 clamps panes to grid bounds — no out-of-bounds deletion on drag)
      const withNewPos = gridItemsRef.current.map((item): GridItem =>
        item.i === newItem.i
          ? { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
          : item,
      );
      onGridLayoutChange(
        finalizeLayout(
          resolveCollisions(withNewPos, newItem.i, pinnedIds, GRID_COLS, GRID_ROWS),
          pinnedIds, GRID_COLS, GRID_ROWS,
        ),
      );
    },
    [locked, pinnedIds, onGridLayoutChange, onRemovePane],
  );

  // Augment grid items with min size constraints
  const layoutWithConstraints: LayoutItem[] = gridItems.map((item) => ({
    ...item,
    minW: MIN_W,
    minH: MIN_H,
  }));

  // ── Box selection ──────────────────────────────────────────────────────────

  const [boxRect, setBoxRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const boxStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (locked || !onSelectPane) return;
      const target = e.target as HTMLElement;
      // Only start box-select when clicking on empty grid background (not on a pane)
      if (target.closest("[data-pane-id]")) return;
      // React portals propagate events through the React tree, not the DOM tree.
      // A click inside a portal (e.g. ChartConfigPanel) will bubble here even though
      // the DOM target is outside the grid container. Check the actual DOM containment
      // to avoid capturing pointer events meant for modals and overlays.
      if (!containerRef.current?.contains(target)) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      boxStartRef.current = { x, y };
      setBoxRect({ x1: x, y1: y, x2: x, y2: y });
    },
    [locked, onSelectPane],
  );

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!boxStartRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setBoxRect({
        x1: boxStartRef.current.x,
        y1: boxStartRef.current.y,
        x2: x,
        y2: y,
      });
    },
    [],
  );

  const handleGridPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      if (!boxStartRef.current || !boxRect || !onSelectPane) {
        boxStartRef.current = null;
        setBoxRect(null);
        return;
      }
      boxStartRef.current = null;

      // Normalize the selection rect to min/max
      const selLeft = Math.min(boxRect.x1, boxRect.x2);
      const selTop = Math.min(boxRect.y1, boxRect.y2);
      const selRight = Math.max(boxRect.x1, boxRect.x2);
      const selBottom = Math.max(boxRect.y1, boxRect.y2);

      // Only select if dragged at least 6px
      if (selRight - selLeft < 6 && selBottom - selTop < 6) {
        setBoxRect(null);
        return;
      }

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        setBoxRect(null);
        return;
      }

      // Collect all pane elements and check overlap
      const paneEls =
        containerRef.current?.querySelectorAll<HTMLElement>("[data-pane-id]");
      paneEls?.forEach((el) => {
        const paneId = el.dataset.paneId;
        if (!paneId) return;
        const r = el.getBoundingClientRect();
        const paneLeft = r.left - containerRect.left;
        const paneTop = r.top - containerRect.top;
        const paneRight = paneLeft + r.width;
        const paneBottom = paneTop + r.height;
        // AABB overlap
        const overlaps =
          paneLeft < selRight &&
          paneRight > selLeft &&
          paneTop < selBottom &&
          paneBottom > selTop;
        if (overlaps) {
          onSelectPane(paneId, true);
        }
      });

      setBoxRect(null);
    },
    [boxRect, onSelectPane],
  );

  const handleGridContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only fire for clicks on the grid background, not on pane elements
      const target = e.target as HTMLElement;
      const isPaneArea = !!target.closest("[data-pane-id]");
      if (!isPaneArea && onWorkspaceContextMenu) {
        e.preventDefault();
        onWorkspaceContextMenu(e.clientX, e.clientY);
      }
    },
    [onWorkspaceContextMenu],
  );

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        position: "relative",
        height: "100%",
      }}
      onPointerDown={handleGridPointerDown}
      onPointerMove={handleGridPointerMove}
      onPointerUp={handleGridPointerUp}
      onContextMenu={handleGridContextMenu}
    >
      <GridLayout
        layout={layoutWithConstraints}
        width={containerWidth}
        gridConfig={{
          cols: GRID_COLS,
          rowHeight,
          margin: [0, 0],
          containerPadding: [0, 0],
          maxRows: Infinity,
        }}
        dragConfig={{
          enabled: !locked,
          handle: ".io-pane-drag-handle",
          bounded: false,
          threshold: 3,
        }}
        resizeConfig={{
          enabled: !locked,
          handles: ["se", "sw", "ne", "nw", "e", "w", "n", "s"],
        }}
        compactor={gridCompactor}
        autoSize={false}
        style={{ height: "100%" }}
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeStop={handleResizeStop}
        className="io-workspace-grid"
      >
        {layoutWithConstraints.map((item) => {
          const pane = paneById.get(item.i);
          if (!pane) return null;
          // Hide ALL grid items while any pane is fullscreen — the fullscreen pane
          // is rendered via a portal outside the RGL transform ancestor (spec §5.11).
          const isHiddenForFullscreen = fullscreenPaneId !== null;
          const retryCount = paneRetryCounters.get(pane.id) ?? 0;
          return (
            <div
              key={pane.id}
              data-pane-id={pane.id}
              style={{
                overflow: "hidden",
                display: isHiddenForFullscreen ? "none" : undefined,
              }}
            >
              <ErrorBoundary
                key={`${pane.id}-${retryCount}`}
                module={`Pane ${pane.id.slice(0, 8)}`}
                fallback={
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      color: "var(--io-text-muted)",
                      fontSize: 13,
                      background: "var(--io-surface-secondary)",
                      padding: "16px",
                    }}
                  >
                    <div>Pane failed to render.</div>
                    <button
                      onClick={() => retryPane(pane.id)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "var(--io-radius)",
                        border: "1px solid var(--io-border)",
                        background: "var(--io-surface)",
                        color: "var(--io-text-primary)",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                }
              >
                <PaneWrapper
                  config={pane}
                  locked={locked}
                  isSelected={selectedPaneIds?.has(pane.id) ?? false}
                  isFullscreen={false}
                  onToggleFullscreen={() => toggleFullscreen(pane.id)}
                  onConfigure={onConfigurePane}
                  onRemove={onRemovePane}
                  onSelect={onSelectPane}
                  onPaletteDrop={onPaletteDrop}
                  preserveAspectRatio={preserveAspectRatio}
                  hideTitles={hideTitles}
                  swapModeSourceId={swapModeSourceId}
                  onSwapWith={onSwapWith}
                  onSwapComplete={onSwapComplete}
                  onReplace={onReplace}
                  onPinToggle={onPinToggle}
                  workspaceId={workspace.id}
                />
              </ErrorBoundary>
            </div>
          );
        })}
      </GridLayout>

      {/* Fullscreen portal (spec §5.11) ─────────────────────────────────────
          Rendered OUTSIDE GridLayout so `position:absolute` is relative to the
          workspace container (position:relative) rather than the RGL item's
          `transform:translate()` ancestor, which would trap a `position:fixed`
          child inside its bounding box.                                        */}
      {fullscreenPaneId !== null &&
        containerRef.current &&
        (() => {
          const fsPane = paneById.get(fullscreenPaneId);
          if (!fsPane) return null;
          const retryCount = paneRetryCounters.get(fsPane.id) ?? 0;
          return createPortal(
            <div
              className={`io-pane-fullscreen-portal${fsExiting ? " io-pane-fullscreen-exiting" : ""}`}
              style={{ position: "absolute", inset: 0, zIndex: 500 }}
            >
              <ErrorBoundary
                key={`${fsPane.id}-${retryCount}-fs`}
                module={`Pane ${fsPane.id.slice(0, 8)}`}
                fallback={
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      color: "var(--io-text-muted)",
                      fontSize: 13,
                      background: "var(--io-surface-secondary)",
                      padding: "16px",
                    }}
                  >
                    <div>Pane failed to render.</div>
                    <button
                      onClick={() => retryPane(fsPane.id)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "var(--io-radius)",
                        border: "1px solid var(--io-border)",
                        background: "var(--io-surface)",
                        color: "var(--io-text-primary)",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                }
              >
                <PaneWrapper
                  config={fsPane}
                  locked={locked}
                  isSelected={selectedPaneIds?.has(fsPane.id) ?? false}
                  isFullscreen={true}
                  onToggleFullscreen={exitFullscreen}
                  onConfigure={onConfigurePane}
                  onRemove={onRemovePane}
                  onSelect={onSelectPane}
                  onPaletteDrop={onPaletteDrop}
                  preserveAspectRatio={preserveAspectRatio}
                  hideTitles={hideTitles}
                  swapModeSourceId={swapModeSourceId}
                  onSwapWith={onSwapWith}
                  onSwapComplete={onSwapComplete}
                  onReplace={onReplace}
                  workspaceId={workspace.id}
                />
              </ErrorBoundary>
            </div>,
            containerRef.current,
          );
        })()}

      {/* Drag/resize preview — ghost outlines for displaced panes ────────────
          Rendered only when a gesture is active. Each ghost shows where a
          non-active pane will end up after collision resolution. The active
          pane itself is excluded (RGL's own placeholder covers it).          */}
      {previewLayout && !locked && (() => {
        const activeId = gestureIdRef.current;
        const colWidth = containerWidth / GRID_COLS;

        // Displaced-pane ghosts: panes (other than the active one) whose
        // resolved position differs from their current stored position.
        const ghosts = previewLayout.filter((preview) => {
          if (preview.i === activeId) return false;
          const current = gridItems.find((g) => g.i === preview.i);
          if (!current) return false;
          return (
            preview.x !== current.x ||
            preview.y !== current.y ||
            preview.w !== current.w ||
            preview.h !== current.h
          );
        });

        // Active-pane cap ghost: if resolveCollisions clamped the active pane
        // below what the user dragged to, show a ghost at the capped size so
        // the user can see the hard limit during the gesture.
        const rawActive = rawGestureLayoutRef.current?.find((g) => g.i === activeId);
        const resolvedActive = previewLayout.find((g) => g.i === activeId);
        const activeWasCapped =
          rawActive &&
          resolvedActive &&
          (resolvedActive.w !== rawActive.w || resolvedActive.h !== rawActive.h);

        if (ghosts.length === 0 && !activeWasCapped) return null;

        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 40,
            }}
          >
            {ghosts.map((preview) => (
              <div
                key={preview.i}
                style={{
                  position: "absolute",
                  left: preview.x * colWidth,
                  top: preview.y * rowHeight,
                  width: preview.w * colWidth,
                  height: preview.h * rowHeight,
                  border: "2px dashed var(--io-accent)",
                  background: "var(--io-accent-subtle)",
                  boxSizing: "border-box",
                  borderRadius: "var(--io-radius)",
                  opacity: 0.75,
                  transition:
                    "left 60ms ease, top 60ms ease, width 60ms ease, height 60ms ease",
                }}
              />
            ))}
            {activeWasCapped && resolvedActive && (
              <div
                key={`${resolvedActive.i}-cap`}
                style={{
                  position: "absolute",
                  left: resolvedActive.x * colWidth,
                  top: resolvedActive.y * rowHeight,
                  width: resolvedActive.w * colWidth,
                  height: resolvedActive.h * rowHeight,
                  border: "2px solid var(--io-accent)",
                  background: "transparent",
                  boxSizing: "border-box",
                  borderRadius: "var(--io-radius)",
                  opacity: 0.9,
                  transition:
                    "left 60ms ease, top 60ms ease, width 60ms ease, height 60ms ease",
                }}
              />
            )}
          </div>
        );
      })()}

      {/* Box selection rect */}
      {boxRect && !locked && (
        <div
          style={{
            position: "absolute",
            left: Math.min(boxRect.x1, boxRect.x2),
            top: Math.min(boxRect.y1, boxRect.y2),
            width: Math.abs(boxRect.x2 - boxRect.x1),
            height: Math.abs(boxRect.y2 - boxRect.y1),
            border: "1px solid var(--io-accent)",
            background: "var(--io-accent-subtle)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}
    </div>
  );
}
