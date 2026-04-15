/**
 * ShapePointSelector.tsx
 *
 * Reusable left-list + right-slot point assignment panel for shape placement
 * and configuration wizards. Mirrors ChartPointSelector's interaction model:
 *   - Left: searchable infinite-scroll point list (tagname + display_name)
 *   - Right: one drop zone per active bindable part
 *   - Drag to slot · Double-click adds to first empty slot · Right-click context menu
 *
 * Default-point logic: the "body" slot is the primary binding. When body has
 * a point and another slot is empty, that slot shows "Using default: <tagname>"
 * and inherits the body's point at config-build time.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pointsApi } from "../../../api/points";
import type { PointMeta } from "../../../api/points";

// ---------------------------------------------------------------------------
// Types (exported so callers can type their state)
// ---------------------------------------------------------------------------

export interface ShapeSlotDef {
  partId: string;
  label: string;
  /** True for the "body" (primary / default) part. */
  isDefault: boolean;
}

export interface ShapeBindingEntry {
  partKey: string;
  tag: string;
  pointId: string;
  displayName?: string;
  /** Engineering unit from point metadata (e.g. "%" or "°C") */
  unit?: string;
  /** EU range low from point metadata */
  rangeLo?: number;
  /** EU range high from point metadata */
  rangeHi?: number;
}

interface ShapePointSelectorProps {
  slots: ShapeSlotDef[];
  bindings: ShapeBindingEntry[];
  onChange: (bindings: ShapeBindingEntry[]) => void;
}

// ---------------------------------------------------------------------------
// ShapePointSelector
// ---------------------------------------------------------------------------

export function ShapePointSelector({
  slots,
  bindings,
  onChange,
}: ShapePointSelectorProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dragPointId, setDragPointId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const PAGE_SIZE = 100;
  const {
    data: infiniteData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["shape-point-search", debouncedSearch],
    queryFn: ({ pageParam }) =>
      pointsApi.list({
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        page: pageParam as number,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.success) return undefined;
      const { page, pages } = lastPage.data.pagination;
      return page < pages ? page + 1 : undefined;
    },
    staleTime: 30_000,
  });

  const allPoints: PointMeta[] = infiniteData
    ? infiniteData.pages.flatMap((p) => (p.success ? p.data.data : []))
    : [];

  const onSentinelVisible = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetching) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetching],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(onSentinelVisible, {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onSentinelVisible]);

  const defaultBinding = bindings.find((b) => b.partKey === "body");

  function assignPoint(partId: string, pt: PointMeta) {
    onChange(
      bindings.map((b) =>
        b.partKey === partId
          ? {
              ...b,
              tag: pt.tagname,
              pointId: pt.id,
              displayName: pt.display_name ?? undefined,
              unit: pt.unit ?? undefined,
              rangeLo: pt.eu_range_low ?? undefined,
              rangeHi: pt.eu_range_high ?? undefined,
            }
          : b,
      ),
    );
  }

  function clearPoint(partId: string) {
    onChange(
      bindings.map((b) =>
        b.partKey === partId
          ? {
              ...b,
              tag: "",
              pointId: "",
              displayName: undefined,
              unit: undefined,
              rangeLo: undefined,
              rangeHi: undefined,
            }
          : b,
      ),
    );
  }

  function handleDrop(partId: string) {
    if (!dragPointId) return;
    const pt = allPoints.find((p) => p.id === dragPointId);
    if (pt) assignPoint(partId, pt);
    setDragPointId(null);
    setDragOverSlot(null);
  }

  function handleDoubleClick(pt: PointMeta) {
    const target = slots.find((s) => {
      const b = bindings.find((b) => b.partKey === s.partId);
      return !b?.pointId;
    });
    if (target) assignPoint(target.partId, pt);
  }

  function handleContextMenu(e: React.MouseEvent, pt: PointMeta) {
    e.preventDefault();
    const menu = document.createElement("div");
    menu.style.cssText = `
      position:fixed; left:${e.clientX}px; top:${e.clientY}px;
      background:var(--io-surface-elevated); border:1px solid var(--io-border);
      border-radius:6px; padding:4px 0; z-index:9999; min-width:160px;
      box-shadow:0 4px 16px rgba(0,0,0,0.4); font-size:12px;
    `;
    slots.forEach((slot) => {
      const item = document.createElement("div");
      item.textContent = `Assign to ${slot.label}`;
      item.style.cssText = `padding:6px 12px; cursor:pointer; color:var(--io-text-primary);`;
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--io-surface-hover)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "";
      });
      item.addEventListener("click", () => {
        assignPoint(slot.partId, pt);
        document.body.removeChild(menu);
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
    const dismiss = () => {
      if (document.body.contains(menu)) document.body.removeChild(menu);
      document.removeEventListener("click", dismiss);
    };
    setTimeout(() => document.addEventListener("click", dismiss), 0);
  }

  const assignedPointIds = new Set(
    bindings.filter((b) => b.pointId).map((b) => b.pointId),
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 26,
    background: "var(--io-input-bg)",
    border: "1px solid var(--io-input-border)",
    color: "var(--io-text-primary)",
    fontSize: "1em",
    padding: "0 8px",
    borderRadius: 4,
    outline: "none",
    boxSizing: "border-box",
    flexShrink: 0,
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40% 1fr",
        gridTemplateRows: "auto auto 1fr auto",
        columnGap: 12,
        rowGap: 6,
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* ── Left col label ─────────────────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 1,
          gridRow: 1,
          fontSize: "0.85em",
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Available Points
      </div>

      {/* ── Left col search ────────────────────────────────────────────────── */}
      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, gridColumn: 1, gridRow: 2 }}
      />

      {/* ── Left col list ──────────────────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 1,
          gridRow: 3,
          overflowY: "auto",
          border: "1px solid var(--io-border)",
          borderRadius: 4,
          background: "var(--io-surface)",
          minHeight: 0,
        }}
      >
        {allPoints.length === 0 && (
          <div
            style={{ padding: 12, color: "var(--io-text-muted)", fontSize: 12 }}
          >
            {isFetching ? "Searching…" : search ? "No matches" : "Loading…"}
          </div>
        )}
        {allPoints.map((pt) => {
          const isAssigned = assignedPointIds.has(pt.id);
          return (
            <div
              key={pt.id}
              draggable
              onDragStart={() => setDragPointId(pt.id)}
              onDoubleClick={() => handleDoubleClick(pt)}
              onContextMenu={(e) => handleContextMenu(e, pt)}
              title={
                pt.display_name
                  ? `${pt.tagname}\n${pt.display_name}`
                  : pt.tagname
              }
              style={{
                padding: "4px 8px",
                fontSize: "0.9em",
                cursor: "grab",
                borderBottom: "1px solid var(--io-border)",
                color: "var(--io-text-primary)",
                userSelect: "none",
                borderLeft: isAssigned
                  ? "3px solid var(--io-accent)"
                  : "3px solid transparent",
                background: isAssigned
                  ? "color-mix(in srgb, var(--io-accent) 8%, transparent)"
                  : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isAssigned
                  ? "color-mix(in srgb, var(--io-accent) 16%, var(--io-surface-hover))"
                  : "var(--io-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isAssigned
                  ? "color-mix(in srgb, var(--io-accent) 8%, transparent)"
                  : "";
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pt.tagname}
              </div>
              {pt.display_name && (
                <div
                  style={{
                    color: "var(--io-text-muted)",
                    fontSize: "0.8em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pt.display_name}
                </div>
              )}
            </div>
          );
        })}
        <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />
        {isFetching && allPoints.length > 0 && (
          <div
            style={{
              padding: "6px 8px",
              fontSize: 11,
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            Loading…
          </div>
        )}
      </div>

      {/* ── Left col hint ──────────────────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 1,
          gridRow: 4,
          fontSize: "0.75em",
          color: "var(--io-text-muted)",
        }}
      >
        Drag to slot · Double-click to add · Right-click for options
      </div>

      {/* ── Right col header ───────────────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 2,
          gridRow: 1,
          fontSize: "0.85em",
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Point Assignments
      </div>

      {/* ── Right col slots ────────────────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 2,
          gridRow: "2 / 5",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {slots.map((slot) => {
          const binding = bindings.find((b) => b.partKey === slot.partId);
          const hasOwn = Boolean(binding?.pointId);
          const usesDefault =
            !slot.isDefault && !hasOwn && Boolean(defaultBinding?.pointId);
          const isEmpty = !hasOwn && !usesDefault;
          const isOver = dragOverSlot === slot.partId;

          return (
            <div key={slot.partId}>
              {/* Slot label */}
              <div
                style={{
                  fontSize: "0.78em",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: slot.isDefault
                    ? "var(--io-accent)"
                    : "var(--io-text-muted)",
                }}
              >
                {slot.label}
                {slot.isDefault && (
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: "0.9em",
                      color: "var(--io-text-muted)",
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    — default
                  </span>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverSlot(slot.partId);
                }}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={() => handleDrop(slot.partId)}
                style={{
                  border: `1px dashed ${
                    isOver
                      ? "var(--io-accent)"
                      : isEmpty
                        ? "color-mix(in srgb, var(--io-accent) 35%, var(--io-border))"
                        : "var(--io-border)"
                  }`,
                  borderRadius: 6,
                  padding: isEmpty ? "14px 12px" : "6px 8px",
                  background: isOver
                    ? "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface))"
                    : isEmpty
                      ? "color-mix(in srgb, var(--io-accent) 4%, var(--io-surface))"
                      : "var(--io-surface)",
                  transition:
                    "border-color 0.15s, background 0.15s, padding 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {/* Empty state */}
                {isEmpty && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      color: isOver
                        ? "var(--io-accent)"
                        : "var(--io-text-muted)",
                      pointerEvents: "none",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 22 22"
                      fill="none"
                      style={{ opacity: 0.5 }}
                    >
                      <rect
                        x="1"
                        y="5"
                        width="20"
                        height="14"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                      />
                      <path
                        d="M11 9v6M8 12l3-3 3 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span style={{ fontSize: "0.8em", textAlign: "center" }}>
                      Drag a point here
                    </span>
                  </div>
                )}

                {/* Default fallback */}
                {usesDefault && !hasOwn && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.85em",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--io-text-muted)",
                        fontStyle: "italic",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Using default: {defaultBinding!.tag}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75em",
                        color: "var(--io-text-muted)",
                        flexShrink: 0,
                      }}
                    >
                      drop to override
                    </span>
                  </div>
                )}

                {/* Explicit assignment */}
                {hasOwn && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.9em",
                      background: "var(--io-surface-secondary)",
                      border: "1px solid var(--io-border)",
                      borderRadius: 3,
                      padding: "3px 6px",
                    }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "0.95em",
                        }}
                      >
                        {binding!.tag}
                      </div>
                      {binding!.displayName && (
                        <div
                          style={{
                            fontSize: "0.8em",
                            color: "var(--io-text-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {binding!.displayName}
                        </div>
                      )}
                    </span>
                    <button
                      onClick={() => clearPoint(slot.partId)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--io-text-muted)",
                        padding: "0 2px",
                        fontSize: "1.1em",
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: build resolved point bindings applying default-point logic.
// Call this when building PlacedShapeConfig.pointBindings.
// ---------------------------------------------------------------------------

export function resolvePointBindings(
  activePartIds: Array<{ partId: string }>,
  bindings: ShapeBindingEntry[],
): Array<{ partKey: string; pointId: string; pointTag: string; displayName?: string; unit?: string }> {
  const defaultPt = bindings.find((b) => b.partKey === "body");

  return activePartIds.flatMap(({ partId }) => {
    const b = bindings.find((x) => x.partKey === partId);
    if (b?.pointId) {
      return [{ partKey: partId, pointId: b.pointId, pointTag: b.tag, displayName: b.displayName, unit: b.unit }];
    }
    if (partId !== "body" && defaultPt?.pointId) {
      return [
        { partKey: partId, pointId: defaultPt.pointId, pointTag: defaultPt.tag, displayName: defaultPt.displayName, unit: defaultPt.unit },
      ];
    }
    return [];
  });
}
