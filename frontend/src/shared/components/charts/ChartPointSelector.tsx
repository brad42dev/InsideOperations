// ---------------------------------------------------------------------------
// ChartPointSelector — filterable point list + drag-to-slot assignment UI
// Used inside ChartConfigPanel.
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { PointMeta } from "../../../api/points";
import { pointsApi } from "../../../api/points";
import {
  type ChartPointSlot,
  type SlotDefinition,
  autoColorForTheme,
  makeSlotId,
} from "./chart-config-types";
import type { PointTypeCategory } from "./chart-definitions";
import { useThemeName } from "../../theme/ThemeContext";

interface ChartPointSelectorProps {
  slotDefs: SlotDefinition[];
  points: ChartPointSlot[];
  /** No longer required — component fetches its own list server-side. */
  allPoints?: PointMeta[];
  onChange: (points: ChartPointSlot[]) => void;
  /** When set, dims points whose point_category is incompatible */
  acceptedPointTypes?: PointTypeCategory[];
}

function ColorSwatch({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <span
      onClick={() => inputRef.current?.click()}
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: 2,
        background: color,
        cursor: "pointer",
        flexShrink: 0,
        border: "1px solid rgba(0,0,0,0.3)",
      }}
      title="Click to change color"
    >
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 0, height: 0, opacity: 0, position: "absolute" }}
      />
    </span>
  );
}

function isPointCompatible(
  point: PointMeta,
  acceptedPointTypes?: PointTypeCategory[],
): boolean {
  if (!acceptedPointTypes || acceptedPointTypes.length === 0) return true;
  if (acceptedPointTypes.includes("any")) return true;
  // If point_category is unknown (migration not yet run), allow all
  if (!point.point_category) return true;
  return acceptedPointTypes.includes(point.point_category as PointTypeCategory);
}

export default function ChartPointSelector({
  slotDefs,
  points,
  onChange,
  acceptedPointTypes,
}: ChartPointSelectorProps) {
  const theme = useThemeName();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dragPointId, setDragPointId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Map pointId → assigned colors (a point can appear in multiple slots)
  const assignedColors = new Map<string, string[]>();
  for (const p of points) {
    if (!p.color) continue;
    const existing = assignedColors.get(p.pointId);
    if (existing) existing.push(p.color);
    else assignedColors.set(p.pointId, [p.color]);
  }

  // On mount: fill in colors for any points that were saved without one
  // (e.g. charts created before per-point colors were added).
  const themeRef = useRef(theme);
  useEffect(() => {
    if (points.some((p) => !p.color)) {
      onChange(
        points.map((p, i) =>
          p.color ? p : { ...p, color: autoColorForTheme(i, themeRef.current) },
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search input so we don't fire a query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Infinite scroll: load pages of 100 as user scrolls down.
  const PAGE_SIZE = 100;
  const {
    data: infiniteData,
    isFetching: isSearching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["chart-point-search-inf", debouncedSearch],
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

  // Flatten all loaded pages into a single array.
  const allPoints: PointMeta[] = infiniteData
    ? infiniteData.pages.flatMap((p) => (p.success ? p.data.data : []))
    : [];
  const filtered = allPoints;

  // Trigger next page load when the sentinel scrolls into view.
  const onSentinelVisible = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isSearching) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isSearching],
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

  function assignPoint(role: string, pointId: string) {
    const slotDef = slotDefs.find((s) => s.id === role);
    if (!slotDef) return;

    // Resolve human-readable label — never show the UUID in charts
    const meta = filtered.find((p) => p.id === pointId);
    const label = meta?.display_name ?? meta?.tagname;
    const tagname = meta?.tagname;

    if (!slotDef.multi) {
      // Replace the single slot for this role
      const without = points.filter((p) => p.role !== role);
      const colorIdx = without.length;
      onChange([
        ...without,
        {
          slotId: role,
          role,
          pointId,
          label,
          tagname,
          color: autoColorForTheme(colorIdx, theme),
        },
      ]);
    } else {
      // Don't add if already present in this role
      if (points.some((p) => p.role === role && p.pointId === pointId)) return;
      // Enforce per-slot max (default 12)
      const maxPoints = slotDef.maxPoints ?? 12;
      if (points.filter((p) => p.role === role).length >= maxPoints) return;
      const slotId = makeSlotId(role, points);
      const colorIdx = points.length;
      onChange([
        ...points,
        {
          slotId,
          role,
          pointId,
          label,
          tagname,
          color: autoColorForTheme(colorIdx, theme),
        },
      ]);
    }
  }

  function removePoint(slotId: string) {
    const updated = points.filter((p) => p.slotId !== slotId);
    // Re-color remaining points, preserving any manually set colors
    onChange(
      updated.map((p, i) => ({
        ...p,
        color: p.color ?? autoColorForTheme(i, theme),
      })),
    );
  }

  function updateColor(slotId: string, color: string) {
    onChange(points.map((p) => (p.slotId === slotId ? { ...p, color } : p)));
  }

  function handleDragStart(pointId: string) {
    setDragPointId(pointId);
  }

  function handleDrop(role: string) {
    if (dragPointId) assignPoint(role, dragPointId);
    setDragPointId(null);
    setDragOverSlot(null);
  }

  function handleContextMenu(e: React.MouseEvent, pointId: string) {
    e.preventDefault();
    // Build context menu items — one per role
    const menu = document.createElement("div");
    menu.style.cssText = `
      position:fixed; left:${e.clientX}px; top:${e.clientY}px;
      background:var(--io-surface-elevated); border:1px solid var(--io-border);
      border-radius:6px; padding:4px 0; z-index:9999; min-width:160px;
      box-shadow:0 4px 16px rgba(0,0,0,0.4); font-size:12px;
    `;
    slotDefs.forEach((slot) => {
      const item = document.createElement("div");
      item.textContent = `Add to ${slot.label}`;
      item.style.cssText = `
        padding:6px 12px; cursor:pointer; color:var(--io-text-primary);
      `;
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--io-surface-hover)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "";
      });
      item.addEventListener("click", () => {
        assignPoint(slot.id, pointId);
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
      {/* ── Left row 1: label ───────────────────────────────────────────── */}
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
      {/* ── Left row 2: search ──────────────────────────────────────────── */}
      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, gridColumn: 1, gridRow: 2 }}
      />
      {/* ── Left row 3: scrollable list ─────────────────────────────────── */}
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
        {filtered.length === 0 && (
          <div
            style={{
              padding: 12,
              color: "var(--io-text-muted)",
              fontSize: 12,
            }}
          >
            {isSearching ? "Searching…" : search ? "No matches" : "Loading…"}
          </div>
        )}
        {filtered.map((pt) => {
          const compatible = isPointCompatible(pt, acceptedPointTypes);
          const colors = assignedColors.get(pt.id);
          const isAssigned = Boolean(colors?.length);
          const primaryColor = colors?.[0];
          const assignedBg = primaryColor
            ? `color-mix(in srgb, ${primaryColor} 12%, transparent)`
            : undefined;
          return (
            <div
              key={pt.id}
              draggable
              onDragStart={() => handleDragStart(pt.id)}
              onContextMenu={(e) => handleContextMenu(e, pt.id)}
              onDoubleClick={() => {
                // Double-click: fill first non-full slot in order
                const target = slotDefs.find((s) => {
                  const filled = points.filter((p) => p.role === s.id);
                  const max = s.multi ? (s.maxPoints ?? 12) : 1;
                  return (
                    filled.length < max &&
                    !filled.some((p) => p.pointId === pt.id)
                  );
                });
                if (target) assignPoint(target.id, pt.id);
              }}
              title={
                !compatible
                  ? `${pt.tagname} — incompatible with this chart type`
                  : pt.display_name
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
                opacity: compatible ? 1 : 0.35,
                background: assignedBg,
                borderLeft: isAssigned
                  ? `3px solid ${primaryColor}`
                  : "3px solid transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = assignedBg
                  ? `color-mix(in srgb, ${primaryColor} 22%, var(--io-surface-hover))`
                  : "var(--io-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = assignedBg ?? "";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {pt.tagname}
                </div>
                {acceptedPointTypes &&
                  !acceptedPointTypes.includes("any") &&
                  compatible &&
                  pt.point_category !== "analog" && (
                    <span
                      style={{
                        fontSize: "0.7em",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        padding: "1px 5px",
                        borderRadius: 3,
                        flexShrink: 0,
                        background:
                          pt.point_category === "boolean"
                            ? "color-mix(in srgb, #10B981 20%, transparent)"
                            : "color-mix(in srgb, #8B5CF6 20%, transparent)",
                        color:
                          pt.point_category === "boolean"
                            ? "#10B981"
                            : "#8B5CF6",
                      }}
                    >
                      {pt.point_category === "boolean" ? "BOOL" : "ENUM"}
                    </span>
                  )}
                {colors && colors.length > 1 &&
                  colors.map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: c,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                  ))}
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
        {/* Sentinel: triggers next-page fetch when scrolled into view */}
        <div ref={sentinelRef} style={{ height: 1, flexShrink: 0 }} />
        {isSearching && filtered.length > 0 && (
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
      {/* ── Left row 4: hint ────────────────────────────────────────────── */}
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

      {/* ── Right row 1: first slot label ───────────────────────────────── */}
      {slotDefs[0] &&
        (() => {
          const s = slotDefs[0];
          const pts = points.filter((p) => p.role === s.id);
          const max = s.maxPoints ?? 12;
          const cap = s.multi ? max : 1;
          const full = s.multi ? pts.length >= max : pts.length >= 1;
          return (
            <div
              style={{
                gridColumn: 2,
                gridRow: 1,
                display: "flex",
                alignItems: "baseline",
                gap: 6,
                fontSize: "0.85em",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {s.label}
              {s.required && (
                <span style={{ color: "var(--io-accent)" }}>*</span>
              )}
              {pts.length > 0 && (
                <span
                  style={{
                    fontWeight: 600,
                    color: full ? "var(--io-accent)" : "var(--io-text-muted)",
                  }}
                >
                  {pts.length}/{cap}
                  {full ? " — full" : ""}
                </span>
              )}
            </div>
          );
        })()}

      {/* ── Right row 3: slot boxes ───────────────────────────────────────── */}
      <div
        style={{
          gridColumn: 2,
          gridRow: 3,
          display: "flex",
          flexDirection: "column",
          gap: 26,
          minHeight: 0,
        }}
      >
        {slotDefs.map((slot, slotIdx) => {
          const slotPoints = points.filter((p) => p.role === slot.id);
          const isOver = dragOverSlot === slot.id;
          const maxPoints = slot.maxPoints ?? 12;
          const isEmpty = slotPoints.length === 0;
          const isFull = slot.multi
            ? slotPoints.length >= maxPoints
            : slotPoints.length >= 1;
          const count = slotPoints.length;
          const cap = slot.multi ? maxPoints : 1;

          return (
            <div key={slot.id}>
              {/* ── Slot header — first slot label lives in row 1 above ── */}
              {slotIdx > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    marginBottom: 26,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85em",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {slot.label}
                    {slot.required && (
                      <span
                        style={{ color: "var(--io-accent)", marginLeft: 4 }}
                      >
                        *
                      </span>
                    )}
                  </div>
                  {count > 0 && (
                    <span
                      style={{
                        fontSize: "0.75em",
                        fontWeight: 600,
                        color: isFull
                          ? "var(--io-accent)"
                          : "var(--io-text-muted)",
                      }}
                    >
                      {count}/{cap}
                      {isFull ? " — full" : ""}
                    </span>
                  )}
                </div>
              )}

              {/* ── Drop zone ── */}
              <div
                onDragOver={(e) => {
                  if (!isFull) {
                    e.preventDefault();
                    setDragOverSlot(slot.id);
                  }
                }}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={() => handleDrop(slot.id)}
                style={{
                  border: `1px dashed ${
                    isOver
                      ? "var(--io-accent)"
                      : isFull
                        ? "var(--io-border)"
                        : "color-mix(in srgb, var(--io-accent) 35%, var(--io-border))"
                  }`,
                  borderRadius: 6,
                  padding: isEmpty ? "18px 12px" : "6px 8px",
                  background: isOver
                    ? "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface))"
                    : isEmpty
                      ? "color-mix(in srgb, var(--io-accent) 4%, var(--io-surface))"
                      : "var(--io-surface)",
                  opacity: isFull ? 0.7 : 1,
                  transition:
                    "border-color 0.15s, background 0.15s, padding 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {/* Empty state — large, prominent */}
                {isEmpty && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      color: isOver
                        ? "var(--io-accent)"
                        : "var(--io-text-muted)",
                      pointerEvents: "none",
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
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
                    <span
                      style={{
                        fontSize: "0.82em",
                        textAlign: "center",
                        lineHeight: 1.4,
                      }}
                    >
                      {slot.multi
                        ? `Drag points here · up to ${maxPoints}`
                        : "Drag a point here"}
                    </span>
                  </div>
                )}

                {/* Assigned points */}
                {slotPoints.map((sp) => {
                  const meta = filtered.find((p) => p.id === sp.pointId);
                  const globalIdx = points.findIndex(
                    (p) => p.slotId === sp.slotId,
                  );
                  return (
                    <div
                      key={sp.slotId}
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
                      <ColorSwatch
                        color={
                          sp.color ??
                          autoColorForTheme(
                            globalIdx >= 0 ? globalIdx : 0,
                            theme,
                          )
                        }
                        onChange={(c) => updateColor(sp.slotId, c)}
                      />
                      <span
                        style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {meta?.tagname ?? sp.pointId}
                        </div>
                        {meta?.display_name && (
                          <div
                            style={{
                              fontSize: "0.8em",
                              color: "var(--io-text-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {meta.display_name}
                          </div>
                        )}
                      </span>
                      <button
                        onClick={() => removePoint(sp.slotId)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--io-text-muted)",
                          padding: "0 2px",
                          fontSize: "1.1em",
                          lineHeight: 1,
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Drop-more footer — shown when has points but not full */}
                {!isEmpty && !isFull && slot.multi && (
                  <div
                    style={{
                      fontSize: "0.78em",
                      color: isOver
                        ? "var(--io-accent)"
                        : "var(--io-text-muted)",
                      padding: "4px 2px 2px",
                      borderTop: "1px dashed var(--io-border)",
                      marginTop: 2,
                      pointerEvents: "none",
                    }}
                  >
                    Drop more points here…
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
