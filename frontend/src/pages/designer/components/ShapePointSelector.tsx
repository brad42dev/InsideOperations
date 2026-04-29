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
import {
  extractPoints,
  isIOClipboardPayload,
  useIOClipboardStore,
  buildIOClipboardPayload,
} from "../../../shared/clipboard";
import type { IOClipboardPayload } from "../../../shared/clipboard";
import ContextMenu from "../../../shared/components/ContextMenu";
import type { ContextMenuItem } from "../../../shared/components/ContextMenu";

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
  /** Called whenever over-capacity state changes. Parent uses this to block Apply/Place. */
  onOverCapacityChange?: (isOverCapacity: boolean) => void;
}

// ---------------------------------------------------------------------------
// ShapePointSelector
// ---------------------------------------------------------------------------

export function ShapePointSelector({
  slots,
  bindings,
  onChange,
  onOverCapacityChange,
}: ShapePointSelectorProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dragPointId, setDragPointId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    pt?: PointMeta;
  } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { current: currentPayload, previous: previousPayload } =
    useIOClipboardStore();

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

  const isOverCapacity = slots.some(
    (slot) =>
      bindings.filter((b) => b.partKey === slot.partId && b.pointId).length > 1,
  );

  useEffect(() => {
    onOverCapacityChange?.(isOverCapacity);
  }, [isOverCapacity, onOverCapacityChange]);

  function assignPoint(partId: string, pt: PointMeta) {
    // Only update the first matching entry so over-cap extras are preserved
    let done = false;
    onChange(
      bindings.map((b) => {
        if (b.partKey === partId && !done) {
          done = true;
          return {
            ...b,
            tag: pt.tagname,
            pointId: pt.id,
            displayName: pt.display_name ?? undefined,
            unit: pt.unit ?? undefined,
            rangeLo: pt.eu_range_low ?? undefined,
            rangeHi: pt.eu_range_high ?? undefined,
          };
        }
        return b;
      }),
    );
  }

  function clearPoint(partId: string, pointId: string) {
    const totalForPart = bindings.filter((b) => b.partKey === partId).length;
    if (totalForPart <= 1) {
      // Keep the placeholder entry but blank it
      onChange(
        bindings.map((b) =>
          b.partKey === partId && b.pointId === pointId
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
    } else {
      // Remove this specific over-cap entry
      const idx = bindings.findIndex(
        (b) => b.partKey === partId && b.pointId === pointId,
      );
      if (idx >= 0)
        onChange([...bindings.slice(0, idx), ...bindings.slice(idx + 1)]);
    }
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

  async function resolvePointMeta(tagname: string): Promise<PointMeta | null> {
    const found = allPoints.find((p) => p.tagname === tagname);
    if (found) return found;
    try {
      const res = await pointsApi.list({ search: tagname, limit: 5 });
      if (!res.success) return null;
      return res.data.data.find((p) => p.tagname === tagname) ?? null;
    } catch {
      return null;
    }
  }

  async function handlePasteFromClipboard(payload: IOClipboardPayload) {
    const refs = extractPoints(payload);
    if (refs.length === 0) return;

    const resolved: PointMeta[] = [];
    for (const ref of refs) {
      const pt = await resolvePointMeta(ref.tagname);
      if (pt) resolved.push(pt);
    }
    if (resolved.length === 0) return;

    let updatedBindings = [...bindings];
    let refIdx = 0;

    // Pass 1: fill each slot's primary (first empty) binding in order
    for (const slot of slots) {
      if (refIdx >= resolved.length) break;
      const idx = updatedBindings.findIndex(
        (b) => b.partKey === slot.partId && !b.pointId,
      );
      if (idx >= 0) {
        const pt = resolved[refIdx++];
        updatedBindings[idx] = {
          ...updatedBindings[idx],
          tag: pt.tagname,
          pointId: pt.id,
          displayName: pt.display_name ?? undefined,
          unit: pt.unit ?? undefined,
          rangeLo: pt.eu_range_low ?? undefined,
          rangeHi: pt.eu_range_high ?? undefined,
        };
      }
    }

    // Pass 2: remaining refs go into the first slot as over-cap entries —
    // they appear in the UI so the user can remove the excess before placing.
    const firstPartId = slots[0]?.partId;
    if (firstPartId) {
      while (refIdx < resolved.length) {
        const pt = resolved[refIdx++];
        updatedBindings.push({
          partKey: firstPartId,
          tag: pt.tagname,
          pointId: pt.id,
          displayName: pt.display_name ?? undefined,
          unit: pt.unit ?? undefined,
          rangeLo: pt.eu_range_low ?? undefined,
          rangeHi: pt.eu_range_high ?? undefined,
        });
      }
    }

    onChange(updatedBindings);
  }

  function handleContainerPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text/plain");
    try {
      const parsed: unknown = JSON.parse(text);
      if (isIOClipboardPayload(parsed)) {
        e.preventDefault();
        handlePasteFromClipboard(parsed);
      }
    } catch {
      // not IO clipboard data
    }
  }

  function handleContextMenu(e: React.MouseEvent, pt: PointMeta) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, pt });
  }

  function handleContainerContextMenu(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-point-item]")) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }

  function buildPasteItems(
    payload: IOClipboardPayload | null,
    pasteLabel: string,
  ): ContextMenuItem[] {
    if (!payload || extractPoints(payload).length === 0)
      return [{ label: pasteLabel, disabled: true }];

    const pasteAsChildren: ContextMenuItem[] = slots.map((slot) => ({
      label: slot.label,
      onClick: async () => {
        const refs = extractPoints(payload);
        if (!refs.length) return;
        const pt = await resolvePointMeta(refs[0].tagname);
        if (pt) assignPoint(slot.partId, pt);
      },
    }));

    return [
      { label: pasteLabel, onClick: () => handlePasteFromClipboard(payload) },
      { label: `${pasteLabel} As…`, children: pasteAsChildren },
    ];
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
    <>
      <div
        tabIndex={-1}
        onPaste={handleContainerPaste}
        onContextMenu={handleContainerContextMenu}
        style={{
          display: "grid",
          gridTemplateColumns: "40% 1fr",
          gridTemplateRows: "auto auto 1fr auto",
          columnGap: 12,
          rowGap: 6,
          flex: 1,
          minHeight: 0,
          outline: "none",
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
          onDragStart={(e) => e.stopPropagation()}
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
              style={{
                padding: 12,
                color: "var(--io-text-muted)",
                fontSize: 12,
              }}
            >
              {isFetching ? "Searching…" : search ? "No matches" : "Loading…"}
            </div>
          )}
          {allPoints.map((pt) => {
            const isAssigned = assignedPointIds.has(pt.id);
            return (
              <div
                key={pt.id}
                data-point-item
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
          Drag to slot · Double-click to add · Right-click for options · Ctrl+V
          to paste
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
            const slotBindings = bindings.filter(
              (b) => b.partKey === slot.partId && b.pointId,
            );
            const hasOwn = slotBindings.length > 0;
            const isOverCap = slotBindings.length > 1;
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
                    color: isOverCap
                      ? "var(--io-alarm-urgent)"
                      : slot.isDefault
                        ? "var(--io-accent)"
                        : "var(--io-text-muted)",
                  }}
                >
                  {slot.label}
                  {isOverCap ? (
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: "0.9em",
                        color: "var(--io-alarm-urgent)",
                        textTransform: "none",
                        letterSpacing: 0,
                      }}
                    >
                      — {slotBindings.length}/1 Too Many Points Selected
                    </span>
                  ) : slot.isDefault ? (
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
                  ) : null}
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

                  {/* Explicit assignments — one chip per binding (>1 = over-cap) */}
                  {slotBindings.map((b) => (
                    <div
                      key={b.pointId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.9em",
                        background: "var(--io-surface-secondary)",
                        border: `1px solid ${isOverCap ? "var(--io-alarm-urgent)" : "var(--io-border)"}`,
                        borderRadius: 3,
                        padding: "3px 6px",
                      }}
                    >
                      <span
                        style={{ flex: 1, overflow: "hidden", minWidth: 0 }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "0.95em",
                          }}
                        >
                          {b.tag}
                        </div>
                        {b.displayName && (
                          <div
                            style={{
                              fontSize: "0.8em",
                              color: "var(--io-text-muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.displayName}
                          </div>
                        )}
                      </span>
                      <button
                        onClick={() => clearPoint(slot.partId, b.pointId)}
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
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={(() => {
            const items: ContextMenuItem[] = [];
            if (ctxMenu.pt) {
              slots.forEach((slot) => {
                items.push({
                  label: `Assign to ${slot.label}`,
                  onClick: () => {
                    assignPoint(slot.partId, ctxMenu.pt!);
                    setCtxMenu(null);
                  },
                });
              });
              items.push({
                label: "Copy",
                divider: true,
                onClick: () => {
                  const payload = buildIOClipboardPayload({
                    originContext: "designer",
                    contents: {
                      points: [
                        {
                          tagname: ctxMenu.pt!.tagname,
                          displayName: ctxMenu.pt!.display_name ?? undefined,
                          unit: ctxMenu.pt!.unit ?? undefined,
                        },
                      ],
                    },
                  });
                  useIOClipboardStore.getState().writeToClipboard(payload);
                  setCtxMenu(null);
                },
              });
            }
            const pasteItems = buildPasteItems(currentPayload, "Paste");
            const prevItems = buildPasteItems(
              previousPayload,
              "Paste Previous",
            );
            const withDivider = pasteItems.map((item, i) =>
              i === 0 && items.length > 0 ? { ...item, divider: true } : item,
            );
            return [...items, ...withDivider, ...prevItems];
          })()}
          onClose={() => setCtxMenu(null)}
          zIndex={9999}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Utility: build resolved point bindings applying default-point logic.
// Call this when building PlacedShapeConfig.pointBindings.
// ---------------------------------------------------------------------------

export function resolvePointBindings(
  activePartIds: Array<{ partId: string }>,
  bindings: ShapeBindingEntry[],
): Array<{
  partKey: string;
  pointId: string;
  pointTag: string;
  displayName?: string;
  unit?: string;
}> {
  const defaultPt = bindings.find((b) => b.partKey === "body");

  return activePartIds.flatMap(({ partId }) => {
    const b = bindings.find((x) => x.partKey === partId);
    if (b?.pointId) {
      return [
        {
          partKey: partId,
          pointId: b.pointId,
          pointTag: b.tag,
          displayName: b.displayName,
          unit: b.unit,
        },
      ];
    }
    if (partId !== "body" && defaultPt?.pointId) {
      return [
        {
          partKey: partId,
          pointId: defaultPt.pointId,
          pointTag: defaultPt.tag,
          displayName: defaultPt.displayName,
          unit: defaultPt.unit,
        },
      ];
    }
    return [];
  });
}
