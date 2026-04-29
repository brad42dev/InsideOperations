import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { exportsApi, type ExportJob } from "../../api/exports";
import { videoExportsApi, type VideoExportJob } from "../../api/videoExports";
import DataTable from "../../shared/components/DataTable";
import type { ColumnDef } from "../../shared/components/DataTable";
import SettingsPageLayout from "./SettingsPageLayout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type RowStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

function StatusBadge({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { bg: string; color: string; label: string }> = {
    queued: { bg: "var(--io-surface-secondary)", color: "var(--io-text-muted)", label: "Queued" },
    processing: { bg: "rgba(45,212,191,0.15)", color: "var(--io-accent)", label: "Processing" },
    completed: { bg: "rgba(34,197,94,0.15)", color: "var(--io-success)", label: "Ready" },
    failed: { bg: "rgba(239,68,68,0.15)", color: "var(--io-danger)", label: "Failed" },
    cancelled: { bg: "rgba(156,163,175,0.2)", color: "var(--io-text-muted)", label: "Cancelled" },
  };
  const { bg, color, label } = map[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: bg,
        color,
        animation: status === "processing" ? "io-status-pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Unified row type
// ---------------------------------------------------------------------------

type RowKind = "data" | "video";

interface UnifiedRow {
  id: string;
  kind: RowKind;
  status: RowStatus;
  created_at: string;
  file_size_bytes: number | null;
  // video-only
  frames_rendered?: number;
  frames_total?: number | null;
  error_message?: string | null;
  // data-only
  format?: string;
}

function toUnified(jobs: ExportJob[], videos: VideoExportJob[]): UnifiedRow[] {
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeVideos = Array.isArray(videos) ? videos : [];
  const rows: UnifiedRow[] = [
    ...safeJobs.map((j) => ({
      id: j.id,
      kind: "data" as RowKind,
      status: j.status,
      created_at: j.created_at,
      file_size_bytes: j.file_size_bytes,
      format: j.format,
      error_message: j.error_message,
    })),
    ...safeVideos.map((v) => ({
      id: v.id,
      kind: "video" as RowKind,
      status: v.status,
      created_at: v.created_at,
      file_size_bytes: v.file_size_bytes,
      frames_rendered: v.frames_rendered,
      frames_total: v.frames_total,
      error_message: v.error_message,
    })),
  ];
  return rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

// ---------------------------------------------------------------------------
// MyExports settings page
// ---------------------------------------------------------------------------

const btnBase: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: "var(--io-radius)",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
};

export default function MyExports() {
  const queryClient = useQueryClient();

  const hasActive = (rows: UnifiedRow[]) =>
    rows.some((r) => r.status === "queued" || r.status === "processing");

  const dataQuery = useQuery({
    queryKey: ["settings-my-exports-data"],
    queryFn: () => exportsApi.listMyExports({ limit: 100 }).then((r) => r.data),
    refetchInterval: (q) => (hasActive(toUnified(q.state.data ?? [], [])) ? 5000 : false),
  });

  const videoQuery = useQuery({
    queryKey: ["settings-my-exports-video"],
    queryFn: () => videoExportsApi.list(),
    refetchInterval: (q) =>
      (q.state.data ?? []).some(
        (v) => v.status === "queued" || v.status === "processing",
      )
        ? 5000
        : false,
  });

  const cancelVideoMutation = useMutation({
    mutationFn: (id: string) => videoExportsApi.cancel(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings-my-exports-video"] }),
  });

  const cancelDataMutation = useMutation({
    mutationFn: (id: string) => exportsApi.cancelExport(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings-my-exports-data"] }),
  });

  const rows = toUnified(dataQuery.data ?? [], videoQuery.data ?? []);
  const isLoading = dataQuery.isLoading && videoQuery.isLoading;
  const isFetching = dataQuery.isFetching || videoQuery.isFetching;

  const columns: ColumnDef<UnifiedRow>[] = [
    {
      id: "kind",
      header: "Type",
      cell: (_v, row) => (
        <span
          style={{
            display: "inline-block",
            padding: "2px 7px",
            borderRadius: "100px",
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            background: "var(--io-surface-secondary)",
            color: "var(--io-text-muted)",
          }}
        >
          {row.kind === "video" ? "Video" : row.format ?? "Data"}
        </span>
      ),
      width: 90,
    },
    {
      id: "created_at",
      header: "Created",
      cell: (_v, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatRelative(row.created_at)}
        </span>
      ),
      width: 110,
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      cell: (_v, row) => <StatusBadge status={row.status} />,
      width: 110,
    },
    {
      id: "progress",
      header: "Progress",
      cell: (_v, row) => {
        if (row.kind !== "video" || row.status !== "processing") return <span>—</span>;
        const total = row.frames_total ?? 0;
        if (!total) return <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>—</span>;
        return (
          <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
            {row.frames_rendered} / {total} frames
          </span>
        );
      },
      width: 140,
    },
    {
      id: "file_size_bytes",
      header: "Size",
      cell: (_v, row) => (
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          {formatBytes(row.file_size_bytes)}
        </span>
      ),
      width: 80,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (_v, row) => (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {row.status === "completed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (row.kind === "video") {
                  void videoExportsApi.download(row.id);
                } else {
                  window.open(exportsApi.getDownloadUrl(row.id), "_blank");
                }
              }}
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
            </button>
          )}
          {(row.status === "queued" || row.status === "processing") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (row.kind === "video") cancelVideoMutation.mutate(row.id);
                else cancelDataMutation.mutate(row.id);
              }}
              disabled={cancelVideoMutation.isPending || cancelDataMutation.isPending}
              style={{ ...btnBase, color: "var(--io-danger)", borderColor: "rgba(239,68,68,0.4)" }}
            >
              Cancel
            </button>
          )}
          {row.status !== "queued" && row.status !== "processing" && row.status !== "completed" && (
            <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>—</span>
          )}
          {row.status === "failed" && row.error_message && (
            <span
              style={{ fontSize: "11px", color: "var(--io-danger)", maxWidth: 200 }}
              title={row.error_message}
            >
              {row.error_message.slice(0, 40)}
            </span>
          )}
        </div>
      ),
      width: 280,
    },
  ];

  return (
    <>
      <SettingsPageLayout
        title="My Exports"
        description="All data and video export jobs you have generated"
        variant="list"
        action={
          isFetching ? (
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
          ) : undefined
        }
      >
        <DataTable<UnifiedRow>
          data={rows}
          columns={columns}
          height={520}
          rowHeight={48}
          loading={isLoading}
          emptyMessage="No exports yet."
        />
      </SettingsPageLayout>
      <style>{`
        @keyframes io-spin { to { transform: rotate(360deg); } }
        @keyframes io-status-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </>
  );
}
