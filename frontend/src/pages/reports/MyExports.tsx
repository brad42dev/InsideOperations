import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  exportsApi,
  type ExportJob,
  type ExportJobStatus,
} from "../../api/exports";
import DataTable from "../../shared/components/DataTable";
import type { ColumnDef } from "../../shared/components/DataTable";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: ExportJobStatus }) {
  const styles: Record<ExportJobStatus, React.CSSProperties> = {
    queued: {
      background: "var(--io-surface-secondary)",
      color: "var(--io-text-muted)",
    },
    processing: {
      background: "rgba(45,212,191,0.15)",
      color: "var(--io-accent)",
    },
    completed: {
      background: "rgba(34,197,94,0.15)",
      color: "var(--io-success)",
    },
    failed: { background: "rgba(239,68,68,0.15)", color: "var(--io-danger)" },
    cancelled: {
      background: "rgba(156,163,175,0.2)",
      color: "var(--io-text-muted)",
    },
  };

  const labels: Record<ExportJobStatus, string> = {
    queued: "Queued",
    processing: "Generating...",
    completed: "Ready",
    failed: "Failed",
    cancelled: "Cancelled",
  };

  const isPulsing = status === "processing";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        animation: isPulsing
          ? "io-status-pulse 1.5s ease-in-out infinite"
          : "none",
        ...styles[status],
      }}
    >
      {labels[status]}
    </span>
  );
}

function FormatBadge({ format }: { format: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "100px",
        fontSize: "10px",
        fontWeight: 700,
        background: "var(--io-surface-secondary)",
        color: "var(--io-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {format}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action button styles
// ---------------------------------------------------------------------------

const actionBtnBase: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: "var(--io-radius)",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
};

// ---------------------------------------------------------------------------
// MyExports page
// ---------------------------------------------------------------------------

export default function MyExports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["my-exports"],
    queryFn: async () => {
      const result = await exportsApi.listMyExports({ limit: 100 });
      return result.data;
    },
    // Auto-refresh every 5 seconds if any job is still active
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      const hasActive = jobs.some(
        (j) => j.status === "queued" || j.status === "processing",
      );
      return hasActive ? 5000 : false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => exportsApi.retryExport(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-exports"] });
    },
    onError: (e) =>
      setActionError(e instanceof Error ? e.message : "Failed to retry export"),
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => exportsApi.cancelExport(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-exports"] });
    },
    onError: (e) =>
      setActionError(
        e instanceof Error ? e.message : "Failed to cancel export",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => exportsApi.deleteExport(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-exports"] });
    },
    onError: (e) =>
      setActionError(
        e instanceof Error ? e.message : "Failed to delete export",
      ),
  });

  const jobs: ExportJob[] = query.data ?? [];
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<ExportJob>();

  async function handleClearCompleted() {
    const toDelete = jobs.filter(
      (j) =>
        j.status === "completed" ||
        j.status === "failed" ||
        j.status === "cancelled",
    );
    for (const job of toDelete) {
      await exportsApi.deleteExport(job.id).catch(() => undefined);
    }
    await queryClient.invalidateQueries({ queryKey: ["my-exports"] });
  }

  const columns: ColumnDef<ExportJob>[] = [
    {
      id: "name",
      header: "Export",
      cell: (_val, row) => (
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--io-text-primary)",
            }}
          >
            {row.entity
              ? `${row.module} — ${row.entity}`
              : `Export ${row.id.slice(0, 8)}`}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              marginTop: "1px",
            }}
          >
            ID: {row.id.slice(0, 8)}
          </div>
        </div>
      ),
      minWidth: 180,
      sortable: true,
    },
    {
      id: "format",
      header: "Format",
      cell: (_val, row) => <FormatBadge format={row.format} />,
      width: 80,
    },
    {
      id: "status",
      header: "Status",
      cell: (_val, row) => <StatusBadge status={row.status} />,
      width: 130,
    },
    {
      id: "file_size_bytes",
      header: "Size",
      cell: (_val, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatBytes(row.file_size_bytes)}
        </span>
      ),
      width: 80,
    },
    {
      id: "created_at",
      header: "Created",
      cell: (_val, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatDate(row.created_at)}
        </span>
      ),
      width: 140,
      sortable: true,
    },
    {
      id: "expires_at",
      header: "Expires",
      cell: (_val, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatDate(row.expires_at)}
        </span>
      ),
      width: 140,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (_val, row) => (
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Download — completed only */}
          {row.status === "completed" && (
            <>
              <a
                href={exportsApi.getDownloadUrl(row.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "3px 9px",
                  background: "var(--io-accent-subtle)",
                  border: "1px solid var(--io-accent)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-accent)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Download
              </a>
              {row.format === "html" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/reports/view/${row.id}`);
                  }}
                  style={actionBtnBase}
                >
                  View
                </button>
              )}
            </>
          )}

          {/* Retry — failed only */}
          {row.status === "failed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                retryMutation.mutate(row.id);
              }}
              disabled={retryMutation.isPending}
              style={{
                ...actionBtnBase,
                color: "var(--io-accent)",
                borderColor: "var(--io-accent)",
              }}
            >
              Retry
            </button>
          )}

          {/* Error message — failed only */}
          {row.status === "failed" && row.error_message && (
            <span style={{ fontSize: "11px", color: "var(--io-danger)" }}>
              {row.error_message.slice(0, 36)}
            </span>
          )}

          {/* Cancel — queued or processing */}
          {(row.status === "queued" || row.status === "processing") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                cancelMutation.mutate(row.id);
              }}
              disabled={cancelMutation.isPending}
              style={{
                ...actionBtnBase,
                color: "var(--io-danger)",
                borderColor: "rgba(239,68,68,0.4)",
              }}
            >
              Cancel
            </button>
          )}

          {/* Delete — all statuses */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(row.id);
            }}
            disabled={deleteMutation.isPending}
            style={{ ...actionBtnBase }}
          >
            Delete
          </button>
        </div>
      ),
      width: 220,
    },
  ];

  const hasCompleted = jobs.some(
    (j) =>
      j.status === "completed" ||
      j.status === "failed" ||
      j.status === "cancelled",
  );

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
          padding: "0 20px",
          height: "48px",
          flexShrink: 0,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          My Exports
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 4px",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              My Exports
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--io-text-muted)",
              }}
            >
              All data export jobs you have generated
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {hasCompleted && (
              <button
                onClick={() => {
                  void handleClearCompleted();
                }}
                style={{
                  padding: "6px 14px",
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Clear Completed
              </button>
            )}
            {query.isFetching && (
              <span
                style={{
                  display: "inline-block",
                  width: "14px",
                  height: "14px",
                  border: "2px solid var(--io-border)",
                  borderTopColor: "var(--io-accent)",
                  borderRadius: "50%",
                  animation: "io-spin 0.6s linear infinite",
                }}
              />
            )}
          </div>
        </div>

        {(query.isError || actionError) && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "var(--io-radius)",
              color: "var(--io-danger)",
              fontSize: "13px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              {actionError ??
                (query.error instanceof Error
                  ? query.error.message
                  : "Failed to load exports")}
            </span>
            {actionError && (
              <button
                onClick={() => setActionError(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        <DataTable<ExportJob>
          data={jobs}
          columns={columns}
          height={520}
          rowHeight={48}
          loading={query.isLoading}
          emptyMessage="No exports yet. Use the Export button on any data table to generate an export."
          onRowContextMenu={(e, row) => handleContextMenu(e, row)}
        />
        {menuState && (
          <ContextMenu
            x={menuState.x}
            y={menuState.y}
            items={[
              { label: "Download", onClick: () => { closeMenu(); if (menuState.data!.status === "completed") window.open(exportsApi.getDownloadUrl(menuState.data!.id), "_blank"); } },
              { label: "Delete", danger: true, divider: true, onClick: () => { closeMenu(); deleteMutation.mutate(menuState.data!.id); } },
            ]}
            onClose={closeMenu}
          />
        )}
      </div>

      <style>{`
        @keyframes io-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes io-status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
