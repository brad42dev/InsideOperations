import { useQuery } from "@tanstack/react-query";
import { reportsApi, type ReportJob } from "../../api/reports";
import DataTable from "../../shared/components/DataTable";
import type { ColumnDef } from "../../shared/components/DataTable";
import { useNavigate } from "react-router-dom";
import { ExportButton } from "../../shared/components/ExportDialog";
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

type JobStatus = "pending" | "running" | "completed" | "failed";

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, React.CSSProperties> = {
    pending: {
      background: "var(--io-surface-secondary)",
      color: "var(--io-text-muted)",
    },
    running: { background: "rgba(45,212,191,0.15)", color: "var(--io-accent)" },
    completed: {
      background: "rgba(34,197,94,0.15)",
      color: "var(--io-success)",
    },
    failed: { background: "rgba(239,68,68,0.15)", color: "var(--io-danger)" },
  };

  const labels: Record<JobStatus, string> = {
    pending: "Queued",
    running: "Generating...",
    completed: "Ready",
    failed: "Failed",
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
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
// ReportHistory
// ---------------------------------------------------------------------------

export default function ReportHistory() {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["report-history"],
    queryFn: async () => {
      const result = await reportsApi.listHistory({ limit: 100 });
      if (!result.success) throw new Error(result.error.message);
      return result.data.data;
    },
  });

  const jobs: ReportJob[] = query.data ?? [];
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<ReportJob>();

  const columns: ColumnDef<ReportJob>[] = [
    {
      id: "name",
      header: "Report Name",
      cell: (_val, row) => (
        <span
          style={{
            fontSize: "13px",
            color: "var(--io-text-primary)",
            fontWeight: 500,
          }}
        >
          {row.template_name ?? `Report ${row.id.slice(0, 8)}`}
        </span>
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
      width: 120,
    },
    {
      id: "completed_at",
      header: "Generated",
      cell: (_val, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatDate(row.completed_at ?? row.created_at)}
        </span>
      ),
      width: 140,
      sortable: true,
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
      id: "actions",
      header: "Actions",
      cell: (_val, row) => (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {row.status === "completed" && (
            <>
              <a
                href={reportsApi.getDownloadUrl(row.id)}
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
                  style={{
                    padding: "3px 9px",
                    background: "transparent",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    color: "var(--io-text-secondary)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  View
                </button>
              )}
            </>
          )}
          {row.status === "failed" && row.error_message && (
            <span
              style={{ fontSize: "11px", color: "var(--io-danger)" }}
              title={row.error_message}
            >
              {row.error_message.slice(0, 40)}
              {row.error_message.length > 40 ? "..." : ""}
            </span>
          )}
        </div>
      ),
      width: 180,
    },
  ];

  return (
    <div style={{ padding: "20px", height: "100%", boxSizing: "border-box" }}>
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
              margin: "0 0 2px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Report History
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--io-text-muted)",
            }}
          >
            Recent report generation jobs
          </p>
        </div>
        <ExportButton
          module="reports"
          entity="Report History"
          filteredRowCount={jobs.length}
          totalRowCount={jobs.length}
          availableColumns={[
            { id: "template_name", label: "Report Name" },
            { id: "format", label: "Format" },
            { id: "status", label: "Status" },
            { id: "completed_at", label: "Generated" },
            { id: "file_size_bytes", label: "Size (bytes)" },
          ]}
          visibleColumns={[
            "template_name",
            "format",
            "status",
            "completed_at",
            "file_size_bytes",
          ]}
        />
      </div>

      {query.isError && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-danger)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          Failed to load history:{" "}
          {query.error instanceof Error ? query.error.message : "Unknown error"}
        </div>
      )}

      <DataTable<ReportJob>
        data={jobs}
        columns={columns}
        height={480}
        rowHeight={40}
        loading={query.isLoading}
        emptyMessage="No report jobs yet. Generate a report from the Templates tab."
        onRowContextMenu={(e, row) => handleContextMenu(e, row)}
      />
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "View Report", onClick: () => { closeMenu(); navigate(`/reports/view/${menuState.data!.id}`); } },
            { label: "Download PDF", permission: "reports:read", onClick: () => { closeMenu(); window.open(reportsApi.getDownloadUrl(menuState.data!.id), "_blank"); } },
            { label: "Download CSV", permission: "reports:read", onClick: () => { closeMenu(); } },
            { label: "Re-run", permission: "reports:write", onClick: () => { closeMenu(); } },
            { label: "Delete", danger: true, divider: true, permission: "reports:write", onClick: () => { closeMenu(); } },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
