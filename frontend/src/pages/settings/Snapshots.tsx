import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  snapshotsApi,
  TARGET_TYPE_LABELS,
  type TargetType,
  type Snapshot,
  type SnapshotDetail,
} from "../../api/bulkUpdate";
import { RestorePreviewModal } from "./BulkUpdate";
import { showToast } from "../../shared/components/Toast";

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "8px",
  padding: "var(--io-space-5)",
  marginBottom: "var(--io-space-4)",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "6px",
  border: "none",
  background: "var(--io-accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

const BTN_SECONDARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface-secondary)",
  color: "var(--io-text-primary)",
  fontWeight: 500,
  fontSize: "13px",
  cursor: "pointer",
};

const BTN_GHOST: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
  fontWeight: 500,
  fontSize: "12px",
  cursor: "pointer",
};

const INPUT: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-bg)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  width: "260px",
};

const SELECT: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-bg)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  cursor: "pointer",
  minWidth: "180px",
};

const TABLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "13px",
};

const TH: React.CSSProperties = {
  textAlign: "left" as const,
  padding: "8px 12px",
  borderBottom: "1px solid var(--io-border)",
  color: "var(--io-text-muted)",
  fontWeight: 600,
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  background: "var(--io-surface-secondary)",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--io-border)",
  color: "var(--io-text-primary)",
  verticalAlign: "middle" as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Pill({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "accent" | "muted" | "success";
}) {
  const colors = {
    accent: { bg: "var(--io-accent-subtle)", fg: "var(--io-accent)" },
    muted: { bg: "var(--io-surface-secondary)", fg: "var(--io-text-muted)" },
    success: { bg: "var(--io-success-subtle)", fg: "var(--io-success)" },
  };
  const c = colors[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Download helper — serializes snapshot_data as JSON and triggers a download
// ---------------------------------------------------------------------------

function downloadSnapshotJson(snap: SnapshotDetail) {
  const json = JSON.stringify(snap.snapshot_data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const label = snap.label
    ? snap.label.replace(/\s+/g, "-")
    : snap.id.slice(0, 8);
  a.download = `snapshot-${snap.target_type}-${label}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Create Snapshot form (inline card)
// ---------------------------------------------------------------------------

function CreateSnapshotForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [targetType, setTargetType] = useState<TargetType>("users");
  const [label, setLabel] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      snapshotsApi.create({
        target_type: targetType,
        label: label.trim() || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ["settings-snapshots"] });
        showToast({ title: "Snapshot created", variant: "success" });
        onDone();
      } else {
        showToast({
          title: "Failed to create snapshot",
          description: res.error.message,
          variant: "error",
        });
      }
    },
    onError: () => {
      showToast({
        title: "Failed to create snapshot",
        description: "Network error",
        variant: "error",
      });
    },
  });

  return (
    <div
      style={{
        ...CARD,
        borderColor: "var(--io-accent)",
        marginBottom: "var(--io-space-5)",
      }}
    >
      <h3
        style={{
          margin: "0 0 var(--io-space-4)",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--io-text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        New Snapshot
      </h3>
      <div
        style={{
          display: "flex",
          gap: "var(--io-space-3)",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: 4,
            }}
          >
            Target Type
          </label>
          <select
            style={SELECT}
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as TargetType)}
          >
            {(Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][]).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: 4,
            }}
          >
            Label{" "}
            <span style={{ color: "var(--io-text-muted)" }}>(optional)</span>
          </label>
          <input
            style={INPUT}
            placeholder="e.g. pre-maintenance-window"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") mutation.mutate();
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "var(--io-space-2)" }}>
          <button
            style={BTN_PRIMARY}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create Snapshot"}
          </button>
          <button style={BTN_SECONDARY} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
      <p
        style={{
          margin: "var(--io-space-3) 0 0",
          fontSize: "12px",
          color: "var(--io-text-muted)",
        }}
      >
        A snapshot captures the current state of all records for the selected
        target type. Use the downloaded JSON as an audit trail or import
        baseline.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row-level download: fetches detail then triggers download
// ---------------------------------------------------------------------------

function DownloadButton({ snap }: { snap: Snapshot }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await snapshotsApi.get(snap.id);
      if (res.success) {
        downloadSnapshotJson(res.data);
      } else {
        showToast({
          title: "Download failed",
          description: res.error.message,
          variant: "error",
        });
      }
    } catch {
      showToast({
        title: "Download failed",
        description: "Network error",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      style={{ ...BTN_GHOST, cursor: loading ? "wait" : "pointer" }}
      onClick={handleDownload}
      disabled={loading}
      title="Download snapshot data as JSON"
    >
      {loading ? "Fetching…" : "Download JSON"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Snapshots() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings-snapshots", page],
    queryFn: async () => {
      const res = await snapshotsApi.list({ page, limit: 20 });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => snapshotsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-snapshots"] });
      showToast({ title: "Snapshot deleted", variant: "success" });
    },
    onError: () => {
      showToast({
        title: "Failed to delete snapshot",
        description: "Network error",
        variant: "error",
      });
    },
  });

  const snapshots = data?.data ?? [];
  const pagination = data?.pagination ?? null;
  const restoreSnap = restoreId
    ? snapshots.find((s) => s.id === restoreId)
    : null;

  return (
    <div style={{ padding: "var(--io-space-6)", maxWidth: 900 }}>
      {restoreId && (
        <RestorePreviewModal
          snapshotId={restoreId}
          snapshotLabel={restoreSnap?.label}
          onClose={() => setRestoreId(null)}
          onRestored={(result) => {
            setRestoreId(null);
            qc.invalidateQueries({ queryKey: ["settings-snapshots"] });
            showToast({
              title: "Snapshot restored",
              description: `${result.rows_restored} rows restored.${result.safety_snapshot_id ? ` Safety snapshot: ${result.safety_snapshot_id.slice(0, 8)}…` : ""}`,
              variant: "success",
            });
          }}
        />
      )}
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--io-space-5)",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            Change Snapshots
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Point-in-time captures of configuration data. Download as JSON for
            auditing or use as a restore baseline via Bulk Update.
          </p>
        </div>
        {!showCreate && (
          <button style={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
            + New Snapshot
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateSnapshotForm
          onDone={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Snapshot list */}
      <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        {isLoading && (
          <p
            style={{
              padding: "var(--io-space-5)",
              margin: 0,
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading snapshots…
          </p>
        )}

        {isError && (
          <p
            style={{
              padding: "var(--io-space-5)",
              margin: 0,
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Failed to load snapshots. Check your connection and try again.
          </p>
        )}

        {!isLoading && !isError && snapshots.length === 0 && (
          <div style={{ padding: "var(--io-space-6)", textAlign: "center" }}>
            <p
              style={{
                margin: "0 0 var(--io-space-2)",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--io-text-secondary)",
              }}
            >
              No snapshots yet
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--io-text-muted)",
              }}
            >
              Create a snapshot to capture the current state of a configuration
              dataset.
            </p>
          </div>
        )}

        {!isLoading && snapshots.length > 0 && (
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={TH}>Target Type</th>
                <th style={TH}>Label</th>
                <th style={TH}>Records</th>
                <th style={TH}>Created</th>
                <th style={TH}>Created By</th>
                <th style={{ ...TH, textAlign: "right" as const }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <tr key={snap.id}>
                  <td style={TD}>
                    <Pill color="accent">
                      {TARGET_TYPE_LABELS[snap.target_type] ?? snap.target_type}
                    </Pill>
                  </td>
                  <td
                    style={{
                      ...TD,
                      color: snap.label
                        ? "var(--io-text-primary)"
                        : "var(--io-text-muted)",
                    }}
                  >
                    {snap.label ?? <em>unlabeled</em>}
                  </td>
                  <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>
                    {snap.row_count.toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...TD,
                      fontSize: "12px",
                      fontFamily: "monospace",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {fmtDate(snap.created_at)}
                  </td>
                  <td
                    style={{
                      ...TD,
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    {snap.created_by ?? "—"}
                  </td>
                  <td style={{ ...TD, textAlign: "right" as const }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--io-space-2)",
                        justifyContent: "flex-end",
                      }}
                    >
                      <DownloadButton snap={snap} />
                      <button
                        style={BTN_GHOST}
                        onClick={() => setRestoreId(snap.id)}
                        title="Restore this snapshot"
                      >
                        Restore
                      </button>
                      <button
                        style={{
                          ...BTN_GHOST,
                          color: "var(--io-danger)",
                          borderColor: "var(--io-danger)",
                        }}
                        onClick={() => deleteMutation.mutate(snap.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete this snapshot"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div
          style={{
            display: "flex",
            gap: "var(--io-space-2)",
            alignItems: "center",
            marginTop: "var(--io-space-3)",
          }}
        >
          <button
            style={BTN_SECONDARY}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            style={BTN_SECONDARY}
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Info note */}
      <div
        style={{
          marginTop: "var(--io-space-5)",
          padding: "14px 16px",
          background: "var(--io-surface-secondary)",
          borderRadius: "8px",
          border: "1px solid var(--io-border)",
          fontSize: "12px",
          color: "var(--io-text-secondary)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--io-text-primary)" }}>
          About snapshots
        </strong>{" "}
        — Snapshots are created automatically before every bulk update operation
        as a safety measure. You can also create manual snapshots before planned
        maintenance windows. Click <strong>Restore</strong> on any snapshot to
        preview field-level changes and selectively restore rows. A safety
        snapshot of the current state is created by default before any restore.
      </div>
    </div>
  );
}
