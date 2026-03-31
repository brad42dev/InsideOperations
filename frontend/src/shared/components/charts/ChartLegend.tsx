// ---------------------------------------------------------------------------
// ChartLegend — shared legend component used by all chart renderers.
//
// Two modes:
//   fixed    — a strip anchored to top, bottom, left, or right of the chart.
//   floating — a small panel that the user can drag freely within the chart pane.
//
// Highlight:
//   Pass `highlighted` (Set of series labels) and `onHighlight` to enable
//   click-to-highlight. Single click = select one; Ctrl/Meta + click = multi-select.
//   Highlighted items render bold at full opacity; others dim to 40%.
//
// Usage:
//   const legendItems = seriesSlots.map((slot, i) => ({
//     label: slotLabel(slot),
//     color: slot.color ?? autoColor(i),
//   }))
//   return (
//     <ChartLegendLayout
//       legend={config.legend}
//       items={legendItems}
//       highlighted={highlighted}
//       onHighlight={toggle}
//     >
//       {/* chart content div */}
//     </ChartLegendLayout>
//   )
// ---------------------------------------------------------------------------

import { useState, useRef } from "react";
import type { ChartLegend } from "./chart-config-types";

export interface LegendItem {
  label: string;
  color: string;
}

// ── Fixed strip ──────────────────────────────────────────────────────────────

interface StripProps {
  items: LegendItem[];
  side: "top" | "bottom" | "left" | "right";
  highlighted?: Set<string>;
  onHighlight?: (key: string, multi: boolean) => void;
}

function LegendStrip({ items, side, highlighted, onHighlight }: StripProps) {
  const isVertical = side === "left" || side === "right";
  const borderProp = {
    top: "borderBottom",
    bottom: "borderTop",
    left: "borderRight",
    right: "borderLeft",
  } as const;
  const border = { [borderProp[side]]: "1px solid var(--io-border)" };
  const hasHighlight = (highlighted?.size ?? 0) > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        flexWrap: isVertical ? "nowrap" : "wrap",
        alignItems: "flex-start",
        gap: isVertical ? 6 : "4px 14px",
        padding: isVertical ? "6px 8px" : "4px 10px",
        background: "var(--io-surface)",
        flexShrink: 0,
        overflowY: isVertical ? "auto" : "visible",
        minWidth: isVertical ? 90 : "auto",
        ...border,
      }}
    >
      {items.map((item) => {
        const isActive = !hasHighlight || highlighted!.has(item.label);
        return (
          <div
            key={item.label}
            onClick={
              onHighlight
                ? (e) => {
                    e.stopPropagation();
                    onHighlight(item.label, e.ctrlKey || e.metaKey);
                  }
                : undefined
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: isActive
                ? "var(--io-text-secondary)"
                : "var(--io-text-muted)",
              opacity: isActive ? 1 : 0.4,
              cursor: onHighlight ? "pointer" : "default",
              minWidth: 0,
              userSelect: "none",
              transition: "opacity 0.15s",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: item.color,
                flexShrink: 0,
                opacity: isActive ? 1 : 0.4,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: isVertical ? 130 : 180,
                fontWeight:
                  hasHighlight && highlighted!.has(item.label) ? 700 : 400,
              }}
              title={item.label}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Floating draggable panel ─────────────────────────────────────────────────

interface FloatingProps {
  items: LegendItem[];
  highlighted?: Set<string>;
  onHighlight?: (key: string, multi: boolean) => void;
}

function FloatingLegend({ items, highlighted, onHighlight }: FloatingProps) {
  // null = use CSS right/top defaults; once dragged, switch to left/top pixel values
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeOrigin = useRef({ mx: 0, my: 0, w: 0, h: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const hasHighlight = (highlighted?.size ?? 0) > 0;

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-legend-item]")) return;
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    const parentRect = panelRef.current?.parentElement?.getBoundingClientRect();
    if (!rect || !parentRect) return;

    isDragging.current = true;
    const px = rect.left - parentRect.left;
    const py = rect.top - parentRect.top;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px, py };
    setPosition({ x: px, y: py });

    function onMove(me: PointerEvent) {
      if (!isDragging.current) return;
      const parentRect = panelRef.current?.parentElement?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (!parentRect || !panelRect) return;
      const maxX = parentRect.width - panelRect.width;
      const maxY = parentRect.height - panelRect.height;
      setPosition({
        x: Math.max(0, Math.min(maxX, dragOrigin.current.px + me.clientX - dragOrigin.current.mx)),
        y: Math.max(0, Math.min(maxY, dragOrigin.current.py + me.clientY - dragOrigin.current.my)),
      });
    }
    function onUp() {
      isDragging.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function handleResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    isResizing.current = true;
    resizeOrigin.current = { mx: e.clientX, my: e.clientY, w: rect.width, h: rect.height };

    function onMove(me: PointerEvent) {
      if (!isResizing.current) return;
      const dw = me.clientX - resizeOrigin.current.mx;
      const dh = me.clientY - resizeOrigin.current.my;
      setSize({
        w: Math.max(100, resizeOrigin.current.w + dw),
        h: Math.max(60, resizeOrigin.current.h + dh),
      });
    }
    function onUp() {
      isResizing.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  const posStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y }
    : { right: 8, top: 8 };

  const sizeStyle: React.CSSProperties = size
    ? { width: size.w, height: size.h, overflowY: "auto" }
    : { minWidth: 80, maxWidth: 220 };

  return (
    <div
      ref={panelRef}
      onPointerDown={handlePointerDown}
      style={{
        position: "absolute",
        ...posStyle,
        ...sizeStyle,
        zIndex: 20,
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: 6,
        padding: "6px 10px 10px",
        cursor: "grab",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {items.map((item) => {
          const isActive = !hasHighlight || highlighted!.has(item.label);
          return (
            <div
              key={item.label}
              data-legend-item="1"
              onClick={
                onHighlight
                  ? (e) => {
                      e.stopPropagation();
                      onHighlight(item.label, e.ctrlKey || e.metaKey);
                    }
                  : undefined
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: isActive ? "var(--io-text-secondary)" : "var(--io-text-muted)",
                opacity: isActive ? 1 : 0.4,
                cursor: onHighlight ? "pointer" : "grab",
                transition: "opacity 0.15s",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: item.color,
                  flexShrink: 0,
                  opacity: isActive ? 1 : 0.4,
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: hasHighlight && highlighted!.has(item.label) ? 700 : 400,
                }}
                title={item.label}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      {/* Resize handle — bottom-right corner */}
      <div
        data-resize-handle="1"
        onPointerDown={handleResizeDown}
        style={{
          position: "absolute",
          bottom: 2,
          right: 2,
          width: 10,
          height: 10,
          cursor: "se-resize",
          opacity: 0.4,
          // Two-line corner indicator
          background:
            "linear-gradient(135deg, transparent 40%, var(--io-text-muted) 40%, var(--io-text-muted) 55%, transparent 55%, transparent 65%, var(--io-text-muted) 65%, var(--io-text-muted) 80%, transparent 80%)",
        }}
      />
    </div>
  );
}

// ── Layout wrapper ───────────────────────────────────────────────────────────

interface ChartLegendLayoutProps {
  legend?: ChartLegend | { show?: boolean; position?: string; mode?: string };
  items: LegendItem[];
  /** Set of series labels currently highlighted. Pass from useHighlight(). */
  highlighted?: Set<string>;
  /** Toggle handler. Pass toggle from useHighlight(). */
  onHighlight?: (key: string, multi: boolean) => void;
  children: React.ReactNode;
}

export function ChartLegendLayout({
  legend,
  items,
  highlighted,
  onHighlight,
  children,
}: ChartLegendLayoutProps) {
  const show = (legend?.show ?? true) && items.length > 0;
  if (!show) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    );
  }

  // Resolve mode — backward compat: old configs had position='floating'
  const rawPos = (legend as { position?: string })?.position ?? "top";
  const mode: "fixed" | "floating" =
    (legend as { mode?: string })?.mode === "floating" || rawPos === "floating"
      ? "floating"
      : "fixed";

  if (mode === "floating") {
    return (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {children}
        <FloatingLegend
          items={items}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
      </div>
    );
  }

  const pos = (
    ["top", "bottom", "left", "right"].includes(rawPos) ? rawPos : "top"
  ) as "top" | "bottom" | "left" | "right";
  const isRow = pos === "left" || pos === "right";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isRow ? "row" : "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {(pos === "top" || pos === "left") && (
        <LegendStrip
          items={items}
          side={pos}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
      {(pos === "bottom" || pos === "right") && (
        <LegendStrip
          items={items}
          side={pos}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
      )}
    </div>
  );
}
