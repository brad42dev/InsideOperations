// ---------------------------------------------------------------------------
// PointsBrowserPanel — shared infinite-scroll point browser for left sidebars.
//
// Multi-select: click a checkbox or Ctrl+click a row to toggle selection.
// Dragging a selected row drags ALL selected points; dragging an unselected
// row drags just that point (and does not modify the selection).
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { pointsApi, type PointMeta } from "../../api/points";

const PAGE_SIZE = 50;

interface PointsBrowserPanelProps {
  /**
   * Called when a drag starts. `points` is an array — either all selected
   * points (when the dragged row is part of the selection) or just the one
   * row being dragged. Caller sets the dataTransfer payload.
   */
  onDragStart?: (
    e: React.DragEvent<HTMLDivElement>,
    points: PointMeta[],
  ) => void;
  /** Called when a point row is double-clicked (single point). */
  onDoubleClick?: (point: PointMeta) => void;
  /** Hint text when list is empty and no search is active. */
  emptyHint?: string;
  /** Cache key prefix — isolates query cache per module. */
  cacheKey?: string;
  /**
   * When provided, hides the internal search bar and uses this value as the
   * search term instead (driven by the parent AccordionSection toggle).
   */
  externalSearch?: string;
}

export default function PointsBrowserPanel({
  onDragStart,
  onDoubleClick,
  emptyHint = "Drag a point onto a pane to add it.",
  cacheKey = "points-browser",
  externalSearch,
}: PointsBrowserPanelProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = externalSearch !== undefined ? externalSearch : internalSearch;
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search 250 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Clear selection when search changes (selected IDs may not be visible)
  useEffect(() => {
    setSelected(new Set());
  }, [debouncedSearch]);

  const {
    data: infiniteData,
    isFetching,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: [cacheKey, debouncedSearch],
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

  const points: PointMeta[] = infiniteData
    ? infiniteData.pages.flatMap((p) => (p.success ? p.data.data : []))
    : [];

  const total: number = infiniteData?.pages[0]?.success
    ? infiniteData.pages[0].data.pagination.total
    : 0;

  // Toggle a single point in/out of the selection
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // IntersectionObserver: load next page when sentinel scrolls into view
  const handleIntersect = useCallback(
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
    const observer = new IntersectionObserver(handleIntersect, {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  // Build the set of PointMeta objects for currently selected IDs
  const selectedPoints = points.filter((p) => selected.has(p.id));
  const selectionCount = selected.size;

  function handleDragStart(
    e: React.DragEvent<HTMLDivElement>,
    point: PointMeta,
  ) {
    if (!onDragStart) return;
    // Drag all selected points if this row is part of the selection,
    // otherwise drag just this one row without touching the selection.
    const dragPoints =
      selected.has(point.id) && selectionCount > 1 ? selectedPoints : [point];
    onDragStart(e, dragPoints);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Search bar — hidden when search is driven externally by AccordionSection */}
      {externalSearch === undefined && (
        <div style={{ padding: "6px 8px", flexShrink: 0 }}>
          <input
            type="search"
            placeholder="Search points…"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "4px 7px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: 4,
              color: "var(--io-text)",
              fontSize: 11,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Count / selection bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 10px 4px",
          gap: 6,
          flexShrink: 0,
          minHeight: 18,
        }}
      >
        {selectionCount > 0 ? (
          <>
            <span
              style={{
                fontSize: 10,
                color: "var(--io-accent)",
                fontWeight: 600,
                flex: 1,
              }}
            >
              {selectionCount} selected — drag to add
            </span>
            <button
              onClick={clearSelection}
              title="Clear selection"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: 11,
                color: "var(--io-text-muted)",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </>
        ) : !isFetching && points.length > 0 ? (
          <span style={{ fontSize: 10, color: "var(--io-text-muted)" }}>
            {debouncedSearch
              ? `${points.length} of ${total} match`
              : `${total.toLocaleString()} points`}
          </span>
        ) : null}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {points.map((pt) => (
          <PointRow
            key={pt.id}
            point={pt}
            selected={selected.has(pt.id)}
            anySelected={selectionCount > 0}
            onToggle={toggleSelect}
            onDragStart={onDragStart ? handleDragStart : undefined}
            onDoubleClick={onDoubleClick}
          />
        ))}

        {/* Sentinel — triggers next page load */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {isFetching && (
          <div
            style={{
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            Loading…
          </div>
        )}

        {!isFetching && points.length === 0 && (
          <div
            style={{
              padding: "8px 10px",
              fontSize: 11,
              color: "var(--io-text-muted)",
              lineHeight: 1.5,
            }}
          >
            {debouncedSearch ? "No points match the search." : emptyHint}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PointRow
// ---------------------------------------------------------------------------

function PointRow({
  point,
  selected,
  anySelected,
  onToggle,
  onDragStart,
  onDoubleClick,
}: {
  point: PointMeta;
  selected: boolean;
  anySelected: boolean;
  onToggle: (id: string) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, point: PointMeta) => void;
  onDoubleClick?: (point: PointMeta) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const displayName =
    point.display_name && point.display_name !== point.tagname
      ? point.display_name
      : null;

  const showCheckbox = hovered || selected || anySelected;

  function handleClick(e: React.MouseEvent) {
    // Ctrl/Cmd+click anywhere on the row toggles selection
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggle(point.id);
    }
  }

  function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    onToggle(point.id);
  }

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart ? (e) => onDragStart(e, point) : undefined}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(point) : undefined}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${point.tagname}${point.unit ? ` [${point.unit}]` : ""}${displayName ? `\n${displayName}` : ""}${"\nCtrl+click or use checkbox to multi-select"}`}
      style={{
        padding: "4px 8px 4px 6px",
        cursor: onDragStart ? "grab" : "default",
        background: selected
          ? "var(--io-accent-subtle, color-mix(in srgb, var(--io-accent) 12%, transparent))"
          : hovered
            ? "var(--io-surface-elevated)"
            : "transparent",
        borderBottom: "1px solid var(--io-border-subtle, var(--io-border))",
        borderLeft: selected
          ? "2px solid var(--io-accent)"
          : "2px solid transparent",
        display: "flex",
        alignItems: "center",
        gap: 6,
        userSelect: "none",
      }}
    >
      {/* Checkbox — visible on hover, when selected, or when any row is selected */}
      <div
        style={{
          width: 14,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {showCheckbox && (
          <input
            type="checkbox"
            checked={selected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 12,
              height: 12,
              cursor: "pointer",
              accentColor: "var(--io-accent)",
            }}
          />
        )}
      </div>

      {/* Point name + display name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--io-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {point.tagname}
        </div>
        {displayName && (
          <div
            style={{
              fontSize: 10,
              color: "var(--io-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </div>
        )}
      </div>
    </div>
  );
}
