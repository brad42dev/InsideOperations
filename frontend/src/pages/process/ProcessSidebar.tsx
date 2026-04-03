import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DesignObjectSummary,
  GraphicHierarchyNode,
} from "../../api/graphics";
import { graphicsApi } from "../../api/graphics";
import ContextMenu from "../../shared/components/ContextMenu";
import PointsBrowserPanel from "../../shared/components/PointsBrowserPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewportBookmark {
  id: string;
  name: string;
  panX: number;
  panY: number;
  zoom: number;
}

export interface ProcessSidebarProps {
  visible: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelectView: (id: string, name: string) => void;
  bookmarks: ViewportBookmark[];
  onSelectBookmark: (bookmark: {
    panX: number;
    panY: number;
    zoom: number;
  }) => void;
  onAddBookmark: () => void;
  onDeleteBookmark?: (id: string) => void;
  onRenameBookmark?: (id: string, name: string) => void;
  recentViews: Array<{ id: string; name: string }>;
  graphicsList: DesignObjectSummary[] | undefined;
  graphicsLoading: boolean;
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const SIDEBAR_W = 260;

const sidebarStyle: React.CSSProperties = {
  width: SIDEBAR_W,
  minWidth: SIDEBAR_W,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  background: "var(--io-surface-secondary)",
  borderRight: "1px solid var(--io-border)",
  overflow: "hidden",
  userSelect: "none",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  height: 34,
  cursor: "pointer",
  flexShrink: 0,
  borderBottom: "1px solid var(--io-border)",
  gap: 6,
  background: "var(--io-surface)",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--io-text-muted)",
  flex: 1,
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      style={{
        color: "var(--io-text-muted)",
        transition: "transform 0.15s",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// TreeNode — recursive hierarchy node for the Navigation section
// ---------------------------------------------------------------------------

function TreeNode({
  node,
  depth,
  selectedId,
  onSelectView,
}: {
  node: GraphicHierarchyNode;
  depth: number;
  selectedId: string | null;
  onSelectView: (id: string, name: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = !!node.graphicId && !hasChildren;
  const isSelected = node.graphicId != null && node.graphicId === selectedId;
  const [expanded, setExpanded] = useState(depth < 2);

  const handleClick = () => {
    if (node.graphicId) {
      onSelectView(node.graphicId, node.name);
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        title={node.name}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          paddingLeft: depth * 12 + 10,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          border: "none",
          borderLeft: isSelected
            ? "2px solid var(--io-accent)"
            : "2px solid transparent",
          background: isSelected ? "var(--io-accent-subtle)" : "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 12,
          color: "var(--io-text-primary)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            color: "var(--io-text-muted)",
            width: 10,
          }}
        >
          {hasChildren ? (expanded ? "▼" : "▶") : isLeaf ? "•" : ""}
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {node.name}
        </span>
      </button>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelectView={onSelectView}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavigationTree — fetches hierarchy and renders the tree
// ---------------------------------------------------------------------------

function NavigationTree({
  selectedId,
  onSelectView,
}: {
  selectedId: string | null;
  onSelectView: (id: string, name: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["graphics", "hierarchy"],
    queryFn: () => graphicsApi.getHierarchy(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const nodes: GraphicHierarchyNode[] =
    data && data.success && data.data.tree ? data.data.tree : [];

  if (isLoading) {
    return (
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          color: "var(--io-text-muted)",
        }}
      >
        Loading…
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11,
          color: "var(--io-text-muted)",
        }}
      >
        No views available
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0" }}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelectView={onSelectView}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccordionSection
// ---------------------------------------------------------------------------

function AccordionSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={sectionHeaderStyle} onClick={() => setOpen((v) => !v)}>
        <ChevronIcon open={open} />
        <span style={sectionLabelStyle}>{title}</span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphicThumb — small thumbnail for the views list
// ---------------------------------------------------------------------------

function GraphicThumb({
  id,
  name,
  selected,
  onClick,
}: {
  id: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [errored, setErrored] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: "Open",
              onClick: () => {
                onClick();
                setCtxMenu(null);
              },
            },
            {
              label: "Open in New Window",
              onClick: () => {
                window.open(
                  `/detached/process/${id}`,
                  "_blank",
                  "noopener,noreferrer,width=1400,height=900",
                );
                setCtxMenu(null);
              },
            },
          ]}
        />
      )}
      <button
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        title={name}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          border: "none",
          background: selected ? "var(--io-accent-subtle)" : "transparent",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          borderLeft: selected
            ? "2px solid var(--io-accent)"
            : "2px solid transparent",
        }}
      >
        <div
          style={{
            width: 36,
            height: 24,
            flexShrink: 0,
            background: "var(--io-bg)",
            borderRadius: 2,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {errored ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--io-text-muted)"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          ) : (
            <img
              src={graphicsApi.thumbnailUrl(id)}
              alt={name}
              onError={() => setErrored(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--io-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {name}
        </span>
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// ProcessSidebar
// ---------------------------------------------------------------------------

export default function ProcessSidebar({
  visible,
  onToggle,
  selectedId,
  onSelectView,
  bookmarks,
  onSelectBookmark,
  onAddBookmark,
  onDeleteBookmark,
  onRenameBookmark,
  recentViews,
  graphicsList,
  graphicsLoading,
}: ProcessSidebarProps) {
  const [viewSearch, setViewSearch] = useState("");
  const [bmCtxMenu, setBmCtxMenu] = useState<{
    x: number;
    y: number;
    id: string;
    name: string;
  } | null>(null);

  const filteredGraphics = (graphicsList ?? []).filter(
    (g) =>
      !viewSearch || g.name.toLowerCase().includes(viewSearch.toLowerCase()),
  );

  if (!visible) {
    return (
      <button
        onClick={onToggle}
        title="Show sidebar"
        style={{
          width: 20,
          flexShrink: 0,
          background: "var(--io-surface-secondary)",
          border: "none",
          borderRight: "1px solid var(--io-border)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          padding: 0,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      </button>
    );
  }

  return (
    <div style={sidebarStyle}>
      {/* Sidebar header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          height: 40,
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--io-text-primary)",
            flex: 1,
          }}
        >
          Process
        </span>
        <button
          onClick={onToggle}
          title="Hide sidebar"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--io-text-muted)",
            padding: 2,
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M10 3l-7 0M10 7H3M10 11H3" />
            <rect x="1" y="1" width="12" height="12" rx="2" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Section 1: Views */}
        <AccordionSection title="Views" defaultOpen>
          <div style={{ padding: "6px 10px 4px" }}>
            <input
              placeholder="Search graphics…"
              value={viewSearch}
              onChange={(e) => setViewSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 8px",
                fontSize: 11,
                background: "var(--io-surface-sunken, var(--io-bg))",
                color: "var(--io-text-primary)",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {graphicsLoading && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                }}
              >
                Loading…
              </div>
            )}
            {!graphicsLoading && filteredGraphics.length === 0 && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                }}
              >
                No graphics found
              </div>
            )}
            {filteredGraphics.map((g) => (
              <GraphicThumb
                key={g.id}
                id={g.id}
                name={g.name}
                selected={g.id === selectedId}
                onClick={() => onSelectView(g.id, g.name)}
              />
            ))}
          </div>
        </AccordionSection>

        {/* Section 2: Bookmarks */}
        <AccordionSection title="Bookmarks" defaultOpen>
          <div style={{ padding: "4px 0" }}>
            <button
              onClick={onAddBookmark}
              title="Save current viewport as bookmark"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "5px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 11,
                color: "var(--io-accent)",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 13 }}>+</span>
              Save current viewport
            </button>
            {bookmarks.length === 0 && (
              <div
                style={{
                  padding: "4px 12px 8px",
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                }}
              >
                No viewport bookmarks
              </div>
            )}
            {bookmarks.map((bm) => (
              <button
                key={bm.id}
                onClick={() => onSelectBookmark(bm)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setBmCtxMenu({
                    x: e.clientX,
                    y: e.clientY,
                    id: bm.id,
                    name: bm.name,
                  });
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    color: "var(--io-accent)",
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  ★
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--io-text-primary)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bm.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--io-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {Math.round(bm.zoom * 100)}%
                </span>
              </button>
            ))}
            {bmCtxMenu && (
              <ContextMenu
                x={bmCtxMenu.x}
                y={bmCtxMenu.y}
                onClose={() => setBmCtxMenu(null)}
                items={[
                  {
                    label: "Rename…",
                    onClick: () => {
                      const newName = prompt("Bookmark name:", bmCtxMenu.name);
                      if (newName?.trim())
                        onRenameBookmark?.(bmCtxMenu.id, newName.trim());
                      setBmCtxMenu(null);
                    },
                  },
                  {
                    label: "Delete",
                    onClick: () => {
                      onDeleteBookmark?.(bmCtxMenu.id);
                      setBmCtxMenu(null);
                    },
                  },
                ]}
              />
            )}
          </div>
        </AccordionSection>

        {/* Section 3: Navigation */}
        <AccordionSection title="Navigation" defaultOpen={false}>
          <NavigationTree selectedId={selectedId} onSelectView={onSelectView} />
        </AccordionSection>

        {/* Section 4: Points */}
        <AccordionSection title="Points" defaultOpen={false}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: 260,
              overflow: "hidden",
            }}
          >
            <PointsBrowserPanel
              cacheKey="process-points-browser"
              emptyHint="Browse points bound to this graphic."
            />
          </div>
        </AccordionSection>

        {/* Section 5: Recent Views */}
        <AccordionSection title="Recent Views" defaultOpen>
          {recentViews.length === 0 ? (
            <div
              style={{
                padding: "8px 12px",
                fontSize: 11,
                color: "var(--io-text-muted)",
              }}
            >
              No recent views
            </div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {recentViews.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelectView(v.id, v.name)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "5px 12px",
                    background:
                      v.id === selectedId
                        ? "var(--io-surface-secondary)"
                        : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--io-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </AccordionSection>
      </div>
    </div>
  );
}
