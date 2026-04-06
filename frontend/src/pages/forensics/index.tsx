import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { forensicsApi, type Investigation } from "../../api/forensics";
import { usePermission } from "../../shared/hooks/usePermission";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import SharedContextMenu from "../../shared/components/ContextMenu";
import ThresholdSearch from "./ThresholdSearch";
import AlarmSearch from "./AlarmSearch";
import { ExpressionBuilderModal } from "../../shared/components/expression/ExpressionBuilderModal";
import { expressionsApi } from "../../api/expressions";
import type { ExpressionAst } from "../../shared/types/expression";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Investigation["status"] }) {
  const colors: Record<Investigation["status"], { bg: string; text: string }> =
    {
      active: {
        bg: "var(--io-accent-subtle, rgba(74,158,255,0.15))",
        text: "var(--io-accent, #4A9EFF)",
      },
      closed: { bg: "rgba(34,197,94,0.12)", text: "#22c55e" },
      cancelled: {
        bg: "var(--io-surface-secondary)",
        text: "var(--io-text-muted)",
      },
    };
  const c = colors[status];
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "100px",
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// New Investigation modal
// ---------------------------------------------------------------------------

function NewInvestigationModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void;
  onCreate: (name: string, anchorPointId?: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [pointSearch, setPointSearch] = useState("");
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          padding: "24px",
          width: "480px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          New Investigation
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
            }}
          >
            Name *
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Pump P-101 vibration event 2026-03-15"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onCreate(name.trim(), selectedPointId);
              }
              if (e.key === "Escape") onClose();
            }}
            style={{
              padding: "8px 12px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-primary)",
              fontSize: "14px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
            }}
          >
            Anchor Point (optional)
          </label>
          <input
            type="text"
            placeholder="Search for a point tag or name..."
            value={pointSearch}
            onChange={(e) => {
              setPointSearch(e.target.value);
              if (!e.target.value) setSelectedPointId(undefined);
            }}
            style={{
              padding: "8px 12px",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-primary)",
              fontSize: "14px",
              outline: "none",
            }}
          />
          {pointSearch && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--io-text-muted)",
                margin: 0,
              }}
            >
              Point search requires a connected API. Enter a point ID manually
              or leave blank.
            </p>
          )}
        </div>

        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px",
              background: "none",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-text-secondary)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || loading}
            onClick={() => onCreate(name.trim(), selectedPointId)}
            style={{
              padding: "7px 16px",
              background: name.trim()
                ? "var(--io-accent)"
                : "var(--io-surface-secondary)",
              border: "none",
              borderRadius: "var(--io-radius)",
              color: name.trim() ? "#fff" : "var(--io-text-muted)",
              cursor: name.trim() ? "pointer" : "not-allowed",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {loading ? "Creating..." : "Create Investigation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investigation card
// ---------------------------------------------------------------------------

function InvestigationCard({
  inv,
  onClick,
  onClose,
  onCancel: _onCancel,
  onExport,
  onShare: _onShare,
  onDelete,
}: {
  inv: Investigation;
  onClick: () => void;
  onClose: (id: string) => void;
  onCancel: (id: string) => void;
  onExport: (id: string) => void;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<Investigation>();

  const createdDate = new Date(inv.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={(e) => handleContextMenu(e, inv)}
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "6px",
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--io-accent, #4A9EFF)";
          el.style.background = "var(--io-surface-elevated)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = "var(--io-border)";
          el.style.background = "var(--io-surface)";
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {inv.name}
          </span>
          <StatusBadge status={inv.status} />
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "12px",
            color: "var(--io-text-muted)",
          }}
        >
          {inv.anchor_point_id && (
            <span>
              Anchor:{" "}
              <span style={{ color: "var(--io-text-secondary)" }}>
                {inv.anchor_point_id}
              </span>
            </span>
          )}
          <span>Created {createdDate}</span>
          <span>by {inv.created_by}</span>
        </div>
      </div>
      {menuState && (
        <SharedContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "Open",
              onClick: () => {
                closeMenu();
                onClick();
              },
            },
            {
              label: "Duplicate",
              permission: "forensics:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Toggle Starred",
              permission: "forensics:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Export Investigation",
              onClick: () => {
                closeMenu();
                onExport(inv.id);
              },
            },
            {
              label: "Archive",
              onClick: () => {
                closeMenu();
                onClose(inv.id);
              },
            },
            {
              label: "Delete",
              danger: true,
              divider: true,
              onClick: () => {
                closeMenu();
                onDelete(inv.id);
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }) {
  const canWrite = usePermission("forensics:write");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "80px 24px",
        color: "var(--io-text-muted)",
      }}
    >
      <span style={{ fontSize: "40px", opacity: 0.25 }}>🔬</span>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--io-text-secondary)",
          }}
        >
          No investigations found
        </p>
        <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
          Create an investigation to start correlating process data and
          analyzing events.
        </p>
      </div>
      {canWrite && (
        <button
          onClick={onNew}
          style={{
            padding: "8px 18px",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          New Investigation
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculated Series
// ---------------------------------------------------------------------------

function CalculatedSeries() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [expression, setExpression] = useState<ExpressionAst | null>(null);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 3600 * 1000).toISOString().slice(0, 16),
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 16));
  const [results, setResults] = useState<(number | null)[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function collectPointIds(node: unknown): string[] {
    if (!node || typeof node !== "object") return [];
    const n = node as Record<string, unknown>;
    if (n.type === "point_ref" && typeof n.point_id === "string") {
      return [n.point_id];
    }
    return Object.values(n).flatMap((v) =>
      Array.isArray(v) ? v.flatMap(collectPointIds) : collectPointIds(v),
    );
  }

  async function handleRun() {
    if (!expression) {
      setError("Build an expression first.");
      return;
    }
    setRunning(true);
    setError(null);
    setResults(null);

    // Auto-save the expression to get an ID for the batch endpoint.
    const saveResult = await expressionsApi.create({
      name: `Forensics calculated series (${new Date().toISOString()})`,
      context: "forensics",
      ast: expression,
    });
    if (!saveResult.success) {
      setRunning(false);
      setError(`Failed to save expression: ${saveResult.error.message}`);
      return;
    }
    const expressionId = saveResult.data.id;

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const step = Math.max(1, Math.round((end - start) / 200)); // ~200 samples
    const timestamps: number[] = [];
    for (let t = start; t <= end; t += step) timestamps.push(t);

    // Build point_values — placeholder zeroes for each referenced point.
    // A full integration would fetch actual historical data per-point here.
    const point_values: Record<string, number[]> = {};
    const ids = [...new Set(collectPointIds(expression.root))];
    for (const id of ids) {
      point_values[id] = timestamps.map(() => 0);
    }

    const result = await expressionsApi.evaluateBatch(expressionId, {
      timestamps,
      point_values,
    });

    setRunning(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setResults(result.data.results);
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h3
          style={{
            margin: "0 0 4px",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Calculated Series
        </h3>
        <p
          style={{ margin: 0, fontSize: "12px", color: "var(--io-text-muted)" }}
        >
          Build an expression using OPC point values and evaluate it over a
          historical time range.
        </p>
      </div>

      {/* Expression */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          onClick={() => setBuilderOpen(true)}
          style={{
            padding: "7px 14px",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {expression ? "Edit Expression" : "Build Expression"}
        </button>
        {expression && (
          <span style={{ fontSize: "12px", color: "var(--io-text-secondary)" }}>
            Expression configured
          </span>
        )}
      </div>

      {/* Time range */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <label
          style={{
            fontSize: "12px",
            color: "var(--io-text-muted)",
            fontWeight: 500,
          }}
        >
          From
        </label>
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            padding: "6px 10px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: "13px",
          }}
        />
        <label
          style={{
            fontSize: "12px",
            color: "var(--io-text-muted)",
            fontWeight: 500,
          }}
        >
          To
        </label>
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            padding: "6px 10px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            fontSize: "13px",
          }}
        />
        <button
          disabled={!expression || running}
          onClick={() => void handleRun()}
          style={{
            padding: "7px 16px",
            background: expression
              ? "var(--io-accent)"
              : "var(--io-surface-secondary)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: expression ? "#fff" : "var(--io-text-muted)",
            cursor: expression ? "pointer" : "not-allowed",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {running ? "Running…" : "Evaluate"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "var(--io-danger-subtle)",
            border: "1px solid var(--io-danger)",
            borderRadius: "var(--io-radius)",
            padding: "10px 14px",
            color: "var(--io-danger)",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {results && (
        <div
          style={{
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            padding: "14px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-secondary)",
              marginBottom: "8px",
            }}
          >
            Results — {results.filter((v) => v !== null).length} of{" "}
            {results.length} samples evaluated successfully
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              fontFamily: "monospace",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {results.slice(0, 20).map((v, i) => (
              <div key={i}>
                [{i}] {v !== null ? v.toFixed(4) : "null"}
              </div>
            ))}
            {results.length > 20 && (
              <div style={{ color: "var(--io-text-muted)" }}>
                … {results.length - 20} more
              </div>
            )}
          </div>
        </div>
      )}

      <ExpressionBuilderModal
        open={builderOpen}
        context="forensics"
        contextLabel="Forensics"
        onApply={(ast) => {
          setExpression(ast);
          setBuilderOpen(false);
        }}
        onCancel={() => setBuilderOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ForensicsPage
// ---------------------------------------------------------------------------

type Tab = "investigations" | "threshold" | "alarm" | "calculated";
type StatusFilter = "all" | "active" | "closed" | "cancelled";

export default function ForensicsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("investigations");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showNewModal, setShowNewModal] = useState(false);

  const listQuery = useQuery({
    queryKey: ["investigations", statusFilter],
    queryFn: async () => {
      const params =
        statusFilter !== "all" ? { status: statusFilter } : undefined;
      const result = await forensicsApi.listInvestigations(params);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async ({
      name,
      anchorPointId,
    }: {
      name: string;
      anchorPointId?: string;
    }) => {
      const result = await forensicsApi.createInvestigation({
        name,
        anchor_point_id: anchorPointId,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
      setShowNewModal(false);
      navigate(`/forensics/${data.id}`);
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await forensicsApi.closeInvestigation(id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await forensicsApi.cancelInvestigation(id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await forensicsApi.deleteInvestigation(id);
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
    },
  });

  const handleExport = (id: string) => {
    void forensicsApi.exportInvestigation(id, "pdf").then((result) => {
      if (result.success && result.data.url) {
        window.open(result.data.url, "_blank");
      }
    });
  };

  const handleShare = (id: string) => {
    navigate(`/forensics/${id}?action=share`);
  };

  const investigations = listQuery.data ?? [];

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "closed", label: "Closed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            Forensics
          </span>
          {/* Top-level tabs */}
          <div style={{ display: "flex", gap: "2px" }}>
            {(
              [
                { key: "investigations", label: "Investigations" },
                { key: "threshold", label: "Threshold Search" },
                { key: "alarm", label: "Alarm Search" },
                { key: "calculated", label: "Calculated Series" },
              ] as { key: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "4px 12px",
                  background:
                    tab === t.key ? "var(--io-accent-subtle)" : "none",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color:
                    tab === t.key ? "var(--io-accent)" : "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: tab === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "investigations" && (
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              padding: "6px 14px",
              background: "var(--io-accent)",
              border: "none",
              borderRadius: "var(--io-radius)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            New Investigation
          </button>
        )}
      </div>

      {/* Content */}
      {tab === "threshold" ? (
        <ThresholdSearch />
      ) : tab === "alarm" ? (
        <AlarmSearch />
      ) : tab === "calculated" ? (
        <CalculatedSeries />
      ) : (
        <>
          {/* Status filter tabs */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "8px 20px",
              borderBottom: "1px solid var(--io-border)",
              background: "var(--io-surface-secondary)",
              flexShrink: 0,
            }}
          >
            {statusTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                style={{
                  padding: "4px 12px",
                  background:
                    statusFilter === t.key
                      ? "var(--io-surface-elevated)"
                      : "none",
                  border:
                    statusFilter === t.key
                      ? "1px solid var(--io-border)"
                      : "1px solid transparent",
                  borderRadius: "var(--io-radius)",
                  color:
                    statusFilter === t.key
                      ? "var(--io-text-primary)"
                      : "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: statusFilter === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {listQuery.isLoading && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: "72px",
                      background: "var(--io-surface-secondary)",
                      borderRadius: "6px",
                      animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            )}

            {listQuery.isError && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--io-danger, #ef4444)",
                  fontSize: "13px",
                }}
              >
                Failed to load investigations.{" "}
                {(listQuery.error as Error).message}
              </div>
            )}

            {!listQuery.isLoading &&
              !listQuery.isError &&
              investigations.length === 0 && (
                <EmptyState onNew={() => setShowNewModal(true)} />
              )}

            {!listQuery.isLoading && investigations.length > 0 && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {investigations.map((inv) => (
                  <InvestigationCard
                    key={inv.id}
                    inv={inv}
                    onClick={() => navigate(`/forensics/${inv.id}`)}
                    onClose={(id) => closeMutation.mutate(id)}
                    onCancel={(id) => cancelMutation.mutate(id)}
                    onExport={handleExport}
                    onShare={handleShare}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* New investigation modal */}
      {showNewModal && (
        <NewInvestigationModal
          onClose={() => setShowNewModal(false)}
          onCreate={(name, anchorPointId) =>
            createMutation.mutate({ name, anchorPointId })
          }
          loading={createMutation.isPending}
        />
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
