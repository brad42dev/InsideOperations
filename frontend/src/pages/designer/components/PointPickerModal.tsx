import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { pointsApi, type PointMeta } from "../../../api/points";

interface PointPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tag: string, pointId: string) => void;
}

const FAVORITES_KEY = "io-designer-favorites";
const RECENT_KEY = "io-designer-recent";

function loadJsonArray(key: string): PointMeta[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as PointMeta[];
  } catch {
    return [];
  }
}

function saveJsonArray(key: string, arr: PointMeta[]) {
  localStorage.setItem(key, JSON.stringify(arr));
}

// ---- styles ----
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.55)",
};

const dialogStyle: React.CSSProperties = {
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  width: "560px",
  maxWidth: "90vw",
  maxHeight: "70vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid var(--io-border)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--io-text-primary)",
};

const searchStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px 8px 32px",
  background: "var(--io-surface-sunken)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  fontSize: "12px",
  fontWeight: active ? 600 : 400,
  background: active ? "var(--io-accent-subtle)" : "transparent",
  border: active ? "1px solid var(--io-accent)" : "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: active ? "var(--io-accent)" : "var(--io-text-secondary)",
  cursor: "pointer",
});

const rowStyle = (isSelected: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 12px",
  fontSize: "12px",
  cursor: "pointer",
  color: "var(--io-text-primary)",
  background: isSelected ? "var(--io-accent-subtle)" : "transparent",
  borderBottom: "1px solid var(--io-border-subtle)",
});

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  padding: "10px 16px",
  borderTop: "1px solid var(--io-border)",
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: "12px",
  cursor: "pointer",
  borderRadius: "var(--io-radius)",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
};

const btnAccentStyle: React.CSSProperties = {
  ...btnStyle,
  background: "var(--io-accent)",
  color: "#09090b",
  border: "none",
  fontWeight: 600,
};

// Tree grouping: source > prefix
interface TreeNode {
  label: string;
  children?: TreeNode[];
  point?: PointMeta;
}

function buildTree(points: PointMeta[]): TreeNode[] {
  const bySource: Record<string, PointMeta[]> = {};
  for (const p of points) {
    const src = p.source_id || "Unknown";
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(p);
  }
  return Object.entries(bySource).map(([src, pts]) => {
    const byPrefix: Record<string, PointMeta[]> = {};
    for (const p of pts) {
      const parts = p.tagname.split(/[-_]/);
      const prefix = parts.length > 1 ? parts.slice(0, -1).join("-") : "Other";
      if (!byPrefix[prefix]) byPrefix[prefix] = [];
      byPrefix[prefix].push(p);
    }
    const children: TreeNode[] = Object.entries(byPrefix).map(([pfx, pp]) => ({
      label: pfx,
      children: pp.map((p) => ({ label: p.tagname, point: p })),
    }));
    return { label: src, children };
  });
}

// Search icon as inline SVG
function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{
        position: "absolute",
        left: "10px",
        top: "50%",
        transform: "translateY(-50%)",
        pointerEvents: "none",
      }}
    >
      <circle
        cx="6"
        cy="6"
        r="4.5"
        stroke="var(--io-text-muted)"
        strokeWidth="1.3"
      />
      <line
        x1="9.5"
        y1="9.5"
        x2="12.5"
        y2="12.5"
        stroke="var(--io-text-muted)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type ViewTab = "search" | "favorites" | "recent" | "browse";

function TreeBranch({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (p: PointMeta) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (label: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });

  return (
    <>
      {nodes.map((node) => {
        if (node.point) {
          return (
            <div
              key={node.point.id}
              style={{
                ...rowStyle(selectedId === node.point.id),
                paddingLeft: `${12 + depth * 16}px`,
              }}
              onClick={() => onSelect(node.point!)}
            >
              <span style={{ fontWeight: 500 }}>{node.point.tagname}</span>
              {node.point.display_name && (
                <span
                  style={{ color: "var(--io-text-muted)", fontSize: "11px" }}
                >
                  {node.point.display_name}
                </span>
              )}
              {node.point.unit && (
                <span
                  style={{
                    color: "var(--io-text-muted)",
                    fontSize: "11px",
                    marginLeft: "auto",
                  }}
                >
                  {node.point.unit}
                </span>
              )}
            </div>
          );
        }
        const isOpen = expanded.has(node.label);
        return (
          <React.Fragment key={node.label}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: `4px 12px 4px ${12 + depth * 16}px`,
                fontSize: "12px",
                color: "var(--io-text-secondary)",
                cursor: "pointer",
                fontWeight: 500,
              }}
              onClick={() => toggle(node.label)}
            >
              <span style={{ fontSize: "8px" }}>
                {isOpen ? "\u25BC" : "\u25B6"}
              </span>
              {node.label}
              {node.children && (
                <span
                  style={{ color: "var(--io-text-muted)", fontSize: "10px" }}
                >
                  ({node.children.length})
                </span>
              )}
            </div>
            {isOpen && node.children && (
              <TreeBranch
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

export default function PointPickerModal({
  open,
  onClose,
  onSelect,
}: PointPickerModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<PointMeta | null>(null);
  const [tab, setTab] = useState<ViewTab>("search");
  const [favorites, setFavorites] = useState<PointMeta[]>(() =>
    loadJsonArray(FAVORITES_KEY),
  );
  const [recent] = useState<PointMeta[]>(() => loadJsonArray(RECENT_KEY));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const pointsQuery = useQuery({
    queryKey: ["point-picker-search", debouncedQ],
    queryFn: () => pointsApi.list({ search: debouncedQ, limit: 50 }),
    enabled: debouncedQ.length >= 1,
    staleTime: 30_000,
  });

  const allPointsQuery = useQuery({
    queryKey: ["point-picker-all"],
    queryFn: () => pointsApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const searchResults: PointMeta[] = useMemo(() => {
    if (!pointsQuery.data?.success) return [];
    const d = pointsQuery.data.data;
    return Array.isArray(d) ? d : ((d as { data?: PointMeta[] })?.data ?? []);
  }, [pointsQuery.data]);

  const allPoints: PointMeta[] = useMemo(() => {
    if (!allPointsQuery.data?.success) return [];
    const d = allPointsQuery.data.data;
    return Array.isArray(d) ? d : ((d as { data?: PointMeta[] })?.data ?? []);
  }, [allPointsQuery.data]);

  const tree = useMemo(() => buildTree(allPoints), [allPoints]);

  const handleSelect = useCallback((p: PointMeta) => {
    setSelected(p);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    // Update recent
    const newRecent = [
      selected,
      ...recent.filter((r) => r.id !== selected.id),
    ].slice(0, 10);
    saveJsonArray(RECENT_KEY, newRecent);
    onSelect(selected.tagname, selected.id);
    onClose();
  }, [selected, recent, onSelect, onClose]);

  const toggleFavorite = useCallback((p: PointMeta) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === p.id);
      const next = exists ? prev.filter((f) => f.id !== p.id) : [...prev, p];
      saveJsonArray(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const isFav = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  // Keyboard handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && selected) handleConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, selected, handleConfirm]);

  if (!open) return null;

  const renderList = (points: PointMeta[]) =>
    points.length === 0 ? (
      <div
        style={{
          padding: "16px",
          color: "var(--io-text-muted)",
          fontSize: "12px",
          textAlign: "center",
        }}
      >
        No points found
      </div>
    ) : (
      points.map((p) => (
        <div
          key={p.id}
          style={rowStyle(selected?.id === p.id)}
          onClick={() => handleSelect(p)}
          onDoubleClick={() => {
            handleSelect(p);
            handleConfirm();
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p);
            }}
            title={isFav(p.id) ? "Remove from favorites" : "Add to favorites"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              color: isFav(p.id) ? "var(--io-warning)" : "var(--io-text-muted)",
              padding: 0,
              lineHeight: 1,
            }}
          >
            {isFav(p.id) ? "\u2605" : "\u2606"}
          </button>
          <span style={{ fontWeight: 500, minWidth: "80px" }}>{p.tagname}</span>
          <span
            style={{
              color: "var(--io-text-muted)",
              fontSize: "11px",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.display_name || ""}
          </span>
          {p.unit && (
            <span style={{ color: "var(--io-text-muted)", fontSize: "11px" }}>
              {p.unit}
            </span>
          )}
        </div>
      ))
    );

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <span>Select Point</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: "16px",
              lineHeight: 1,
            }}
          >
            \u00D7
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "8px 16px", position: "relative" }}>
          <SearchIcon />
          <input
            autoFocus
            type="text"
            placeholder="Search by tag, description, area..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setTab("search");
            }}
            style={searchStyle}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", padding: "0 16px 8px" }}>
          <button
            style={tabBtnStyle(tab === "search")}
            onClick={() => setTab("search")}
          >
            Search
          </button>
          <button
            style={tabBtnStyle(tab === "favorites")}
            onClick={() => setTab("favorites")}
          >
            Favorites ({favorites.length})
          </button>
          <button
            style={tabBtnStyle(tab === "recent")}
            onClick={() => setTab("recent")}
          >
            Recent ({recent.length})
          </button>
          <button
            style={tabBtnStyle(tab === "browse")}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: "200px" }}>
          {tab === "search" && renderList(searchResults)}
          {tab === "favorites" && renderList(favorites)}
          {tab === "recent" && renderList(recent)}
          {tab === "browse" && (
            <TreeBranch
              nodes={tree}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* Selected preview */}
        {selected && (
          <div
            style={{
              padding: "8px 16px",
              borderTop: "1px solid var(--io-border-subtle)",
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              display: "flex",
              gap: "16px",
            }}
          >
            <span>
              <strong>{selected.tagname}</strong>
            </span>
            {selected.display_name && <span>{selected.display_name}</span>}
            {selected.unit && <span>{selected.unit}</span>}
          </div>
        )}

        {/* Footer */}
        <div style={footerStyle}>
          <button style={btnStyle} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{ ...btnAccentStyle, opacity: selected ? 1 : 0.5 }}
            disabled={!selected}
            onClick={handleConfirm}
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
