import { useState, useRef, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardsApi, type Dashboard } from "../../api/dashboards";
import { graphicsApi, type DesignObjectSummary } from "../../api/graphics";
import { convertDashboardToGraphicDocument } from "./dashboardConverter";
import PlaylistManager from "./PlaylistManager";
import { usePermission } from "../../shared/hooks/usePermission";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

// ---------------------------------------------------------------------------
// Unified dashboard item (legacy dashboards table + Designer design_objects)
// ---------------------------------------------------------------------------

interface UnifiedDashboardItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  published?: boolean;
  is_system: boolean;
  created_at?: string;
  source: "legacy" | "designer";
}

function fromLegacy(d: Dashboard): UnifiedDashboardItem {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    category: d.category,
    published: d.published,
    is_system: d.is_system,
    created_at: d.created_at,
    source: "legacy",
  };
}

function fromDesigner(d: DesignObjectSummary): UnifiedDashboardItem {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    is_system: false,
    source: "designer",
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "All",
  "Operations Overview",
  "Alarm Management",
  "Process Performance",
  "Equipment & Maintenance",
  "Environmental & Compliance",
  "System Administration",
  "Executive/Management",
];

// ---------------------------------------------------------------------------
// Thumbnail placeholder
// ---------------------------------------------------------------------------

function DashboardThumbnail({ name }: { name: string }) {
  // Generate a consistent gradient color based on name
  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  const hue2 = (hue + 40) % 360;

  return (
    <div
      style={{
        height: "120px",
        borderRadius: "4px 4px 0 0",
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 20%) 0%, hsl(${hue2}, 50%, 15%) 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Mock widget shapes */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "12px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: "6px",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: `hsla(${(hue + i * 30) % 360}, 40%, 50%, 0.15)`,
              border: `1px solid hsla(${(hue + i * 30) % 360}, 40%, 50%, 0.3)`,
              borderRadius: "3px",
            }}
          />
        ))}
      </div>
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontSize: "24px",
          opacity: 0.5,
        }}
      >
        ▦
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard card
// ---------------------------------------------------------------------------

const DashboardCard = memo(function DashboardCard({
  dashboard,
  onEdit,
  onDuplicate,
  onDelete,
  onConvert,
}: {
  dashboard: UnifiedDashboardItem;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<UnifiedDashboardItem>();

  return (
    <div
      style={{
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        position: "relative",
      }}
      onClick={() => navigate(`/dashboards/${dashboard.id}`)}
      onContextMenu={(e) => handleContextMenu(e, dashboard)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--io-accent)";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "var(--io-shadow-lg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor =
          "var(--io-border)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <DashboardThumbnail name={dashboard.name} />

      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "6px",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {dashboard.name}
          </span>

          {/* 3-dot menu */}
          <div
            style={{ position: "relative", flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "14px",
                borderRadius: 4,
              }}
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 98 }}
                />
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    minWidth: "140px",
                    background: "var(--io-surface-elevated)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    boxShadow: "var(--io-shadow-lg)",
                    zIndex: 99,
                    overflow: "hidden",
                  }}
                >
                  {[
                    {
                      label: "Edit",
                      action: () => {
                        onEdit(dashboard.id);
                        setMenuOpen(false);
                      },
                      disabled: dashboard.is_system,
                    },
                    {
                      label: "Open in New Window",
                      action: () => {
                        window.open(
                          `/detached/dashboard/${dashboard.id}`,
                          "_blank",
                          "noopener,noreferrer,width=1400,height=900",
                        );
                        setMenuOpen(false);
                      },
                      disabled: false,
                    },
                    {
                      label: "Duplicate",
                      action: () => {
                        onDuplicate(dashboard.id);
                        setMenuOpen(false);
                      },
                      disabled: false,
                    },
                    {
                      label: "Share",
                      action: () => {
                        void navigator.clipboard?.writeText(
                          `${window.location.origin}/dashboards/${dashboard.id}`,
                        );
                        setMenuOpen(false);
                      },
                      disabled: false,
                    },
                    {
                      label: "Convert to Designer",
                      action: () => {
                        onConvert(dashboard.id);
                        setMenuOpen(false);
                      },
                      disabled: false,
                      hidden:
                        dashboard.source !== "legacy" || dashboard.is_system,
                    },
                    {
                      label: "Delete",
                      action: () => {
                        onDelete(dashboard.id);
                        setMenuOpen(false);
                      },
                      disabled: dashboard.is_system,
                      danger: true,
                    },
                  ]
                    .filter((item) => !item.hidden)
                    .map((item) => (
                      <button
                        key={item.label}
                        onClick={item.disabled ? undefined : item.action}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          color: item.danger
                            ? "var(--io-danger)"
                            : "var(--io-text-secondary)",
                          fontSize: "13px",
                          cursor: item.disabled ? "not-allowed" : "pointer",
                          textAlign: "left",
                          display: "block",
                          opacity: item.disabled ? 0.4 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!item.disabled) {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "var(--io-surface-secondary)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "transparent";
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Badges */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            flexWrap: "wrap",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              padding: "1px 5px",
              borderRadius: "100px",
              background:
                dashboard.source === "designer"
                  ? "var(--io-accent-subtle)"
                  : "var(--io-surface-secondary)",
              color:
                dashboard.source === "designer"
                  ? "var(--io-accent)"
                  : "var(--io-text-muted)",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {dashboard.source === "designer" ? "Designer" : "Legacy"}
          </span>
          {dashboard.is_system && (
            <span
              style={{
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "100px",
                background: "var(--io-surface-secondary)",
                color: "var(--io-text-muted)",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              System
            </span>
          )}
          {dashboard.published && (
            <span
              style={{
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "100px",
                background: "var(--io-accent-subtle)",
                color: "var(--io-accent)",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              Published
            </span>
          )}
          {dashboard.category && (
            <span
              style={{
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "100px",
                background: "var(--io-surface-secondary)",
                color: "var(--io-text-muted)",
              }}
            >
              {dashboard.category}
            </span>
          )}
        </div>

        {dashboard.description && (
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {dashboard.description}
          </p>
        )}
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "Open", onClick: () => { closeMenu(); onEdit(dashboard.id); } },
            { label: "Edit", permission: "dashboards:write", disabled: dashboard.is_system, onClick: () => { closeMenu(); onEdit(dashboard.id); } },
            { label: "Open in New Window", onClick: () => { closeMenu(); window.open(`/detached/dashboard/${dashboard.id}`, "_blank", "noopener,noreferrer,width=1400,height=900"); } },
            { label: "Duplicate", permission: "dashboards:write", onClick: () => { closeMenu(); onDuplicate(dashboard.id); } },
            { label: "Export", onClick: () => { closeMenu(); } },
            ...(dashboard.source === "legacy" && !dashboard.is_system ? [{ label: "Convert to Designer", onClick: () => { closeMenu(); onConvert(dashboard.id); } }] : []),
            { label: "Delete", danger: true, divider: true, permission: "dashboards:write", disabled: dashboard.is_system, onClick: () => { closeMenu(); onDelete(dashboard.id); } },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "120px",
          background: "var(--io-surface-secondary)",
          animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            height: 14,
            width: "70%",
            borderRadius: 4,
            background: "var(--io-surface-secondary)",
            marginBottom: 8,
            animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 10,
            width: "40%",
            borderRadius: 4,
            background: "var(--io-surface-secondary)",
            marginBottom: 8,
            animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            height: 10,
            width: "85%",
            borderRadius: 4,
            background: "var(--io-surface-secondary)",
            animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardsPage
// ---------------------------------------------------------------------------

export default function DashboardsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const canExport = usePermission("dashboards:export");

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportMenuOpen]);

  const legacyQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: async () => {
      const result = await dashboardsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data;
    },
  });

  const designerQuery = useQuery({
    queryKey: ["designer-dashboards"],
    queryFn: async () => {
      const result = await graphicsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data.filter((d) => d.designMode === "dashboard");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await dashboardsApi.duplicate(id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      if (data) navigate(`/designer/dashboards/${data.id}/edit`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await dashboardsApi.delete(id);
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await dashboardsApi.get(id);
      if (!result.success) throw new Error(result.error.message);
      const { name, widgets } = result.data;
      const sceneData = convertDashboardToGraphicDocument(name, widgets);
      const createResult = await graphicsApi.create({
        name,
        scene_data: sceneData,
        type: "dashboard",
      });
      if (!createResult.success) throw new Error(createResult.error.message);
      return createResult.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      void queryClient.invalidateQueries({ queryKey: ["designer-dashboards"] });
      navigate(`/designer/dashboards/${data.id}/edit`);
    },
  });

  const allDashboards: UnifiedDashboardItem[] = [
    ...(legacyQuery.data ?? []).map(fromLegacy),
    ...(designerQuery.data ?? []).map(fromDesigner),
  ];

  const isLoading = legacyQuery.isLoading || designerQuery.isLoading;
  const isError = legacyQuery.isError || designerQuery.isError;

  const filtered = allDashboards.filter((d) => {
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || d.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  function handleDelete(id: string) {
    if (window.confirm("Delete this dashboard?")) {
      deleteMutation.mutate(id);
    }
  }

  function handleExport(format: "json" | "csv" | "xlsx") {
    setExportMenuOpen(false);
    const timestamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", "_")
      .replace(":", "");
    if (format === "json") {
      // Server-side full definition export
      const ids = filtered.map((d) => d.id);
      const body = JSON.stringify({ ids, format: "json" });
      fetch("/api/v1/export/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `dashboards_list_${timestamp}.json`;
          a.click();
          URL.revokeObjectURL(url);
        })
        .catch(() => {
          // Fallback: client-side JSON of metadata
          const data = filtered.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.category ?? null,
            published: d.published,
            description: d.description ?? null,
          }));
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `dashboards_list_${timestamp}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
    } else if (format === "csv") {
      const header = "name,category,published,created_at";
      const rows = filtered.map((d) => {
        const name = `"${(d.name ?? "").replace(/"/g, '""')}"`;
        const category = `"${(d.category ?? "").replace(/"/g, '""')}"`;
        const published = d.published ? "true" : "false";
        const createdAt = d.created_at ?? "";
        return [name, category, published, createdAt].join(",");
      });
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboards_list_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "xlsx") {
      // Client-side XLSX: build a minimal XLSX-compatible CSV with BOM for Excel
      const bom = "\uFEFF";
      const header = "name\tcategory\tpublished\tcreated_at";
      const rows = filtered.map((d) =>
        [
          d.name ?? "",
          d.category ?? "",
          d.published ? "true" : "false",
          d.created_at ?? "",
        ].join("\t"),
      );
      const tsv = bom + [header, ...rows].join("\n");
      const blob = new Blob([tsv], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboards_list_${timestamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: "48px",
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {canExport && (
            <div ref={exportMenuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                style={{
                  padding: "6px 12px",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Export ▾
              </button>
              {exportMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 4px)",
                    minWidth: "160px",
                    background: "var(--io-surface-elevated)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    boxShadow: "var(--io-shadow-lg)",
                    zIndex: 100,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px 4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--io-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--io-border)",
                    }}
                  >
                    Definition
                  </div>
                  {(["json"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "none",
                        border: "none",
                        color: "var(--io-text-secondary)",
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "block",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "var(--io-surface-secondary)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "transparent";
                      }}
                    >
                      JSON
                    </button>
                  ))}
                  <div
                    style={{
                      padding: "6px 12px 4px",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--io-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderTop: "1px solid var(--io-border)",
                      borderBottom: "1px solid var(--io-border)",
                    }}
                  >
                    Metadata
                  </div>
                  {(["csv", "xlsx", "json"] as const).map((fmt) => (
                    <button
                      key={`meta-${fmt}`}
                      onClick={() => handleExport(fmt)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "none",
                        border: "none",
                        color: "var(--io-text-secondary)",
                        fontSize: "13px",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "block",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "var(--io-surface-secondary)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = "transparent";
                      }}
                    >
                      {fmt === "csv"
                        ? "CSV"
                        : fmt === "xlsx"
                          ? "Excel (XLSX)"
                          : "JSON"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => navigate("/designer/dashboards/new")}
            style={{
              padding: "6px 14px",
              background: "var(--io-accent)",
              border: "none",
              borderRadius: "var(--io-radius)",
              color: "var(--io-btn-text)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            + New Dashboard
          </button>
        </div>
      </div>

      {/* Filters: search + category tabs */}
      <div
        style={{
          padding: "10px 20px 0",
          background: "var(--io-surface)",
          flexShrink: 0,
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <div style={{ marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Search dashboards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "280px",
              padding: "7px 10px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-primary)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Category tabs */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {CATEGORIES.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "0 16px",
                  height: "36px",
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? "2px solid var(--io-accent)"
                    : "2px solid transparent",
                  color: isActive
                    ? "var(--io-accent)"
                    : "var(--io-text-secondary)",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 0.1s",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "16px",
              marginBottom: "32px",
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {isError && (
          <div
            style={{
              padding: "20px",
              background:
                "color-mix(in srgb, var(--io-danger) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--io-danger) 30%, transparent)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-danger)",
              fontSize: "13px",
            }}
          >
            Failed to load dashboards.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* Dashboard grid */}
            {filtered.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "16px",
                  marginBottom: "32px",
                }}
              >
                {filtered.map((dashboard) => (
                  <DashboardCard
                    key={dashboard.id}
                    dashboard={dashboard}
                    onEdit={(id) => navigate(`/designer/dashboards/${id}/edit`)}
                    onDuplicate={(id) => duplicateMutation.mutate(id)}
                    onDelete={handleDelete}
                    onConvert={(id) => convertMutation.mutate(id)}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "80px 20px",
                  gap: "12px",
                  color: "var(--io-text-muted)",
                }}
              >
                <span style={{ fontSize: "48px", opacity: 0.3 }}>▦</span>
                <div style={{ textAlign: "center", fontSize: "14px" }}>
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontWeight: 600,
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {search || activeCategory !== "All"
                      ? "No dashboards match your filters"
                      : "No dashboards yet"}
                  </p>
                  <p style={{ margin: 0, fontSize: "13px" }}>
                    {search || activeCategory !== "All"
                      ? "Try a different search or category."
                      : "Create your first dashboard to get started."}
                  </p>
                </div>
                {!search && activeCategory === "All" && (
                  <button
                    onClick={() => navigate("/designer/dashboards/new")}
                    style={{
                      marginTop: "8px",
                      padding: "7px 16px",
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: "var(--io-radius)",
                      color: "var(--io-btn-text)",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    + New Dashboard
                  </button>
                )}
              </div>
            )}

            {/* Playlists section */}
            <div
              style={{
                borderTop: "1px solid var(--io-border)",
                paddingTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--io-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Playlists
                </span>
                <button
                  onClick={() => setShowPlaylistManager(true)}
                  style={{
                    padding: "5px 12px",
                    background: "none",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    fontSize: "12px",
                    transition: "border-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--io-accent)";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "var(--io-accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--io-border)";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "var(--io-text-muted)";
                  }}
                >
                  Manage Playlists
                </button>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--io-text-muted)",
                }}
              >
                Use playlists to auto-advance through dashboards in kiosk mode.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Playlist manager modal */}
      {showPlaylistManager && (
        <PlaylistManager onClose={() => setShowPlaylistManager(false)} />
      )}

      <style>{`
        @keyframes io-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
