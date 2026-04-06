import { useState, useEffect } from "react";
import {
  snapshotsApi,
  type RestorePreview,
  type RestorePreviewRow,
  type RestoreRequest,
} from "../../api/bulkUpdate";
import { showToast } from "../../shared/components/Toast";

// ---------------------------------------------------------------------------
// Shared styles (local copies — only what this modal needs)
// ---------------------------------------------------------------------------

const BTN_PRIMARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "6px",
  border: "none",
  background: "var(--io-accent)",
  color: "var(--io-text-on-accent)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

const BTN_SECONDARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface-sunken)",
  color: "var(--io-text-primary)",
  fontWeight: 500,
  fontSize: "13px",
  cursor: "pointer",
};

const TABLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "12px",
};

const TH: React.CSSProperties = {
  textAlign: "left" as const,
  padding: "6px 10px",
  borderBottom: "1px solid var(--io-border)",
  color: "var(--io-text-muted)",
  fontWeight: 600,
  background: "var(--io-surface-sunken)",
};

const TD: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid var(--io-border)",
  color: "var(--io-text-primary)",
  verticalAlign: "top" as const,
};

// ---------------------------------------------------------------------------
// Badge — inline status pill
// ---------------------------------------------------------------------------

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "success" | "warning" | "danger" | "accent" | "muted";
}) {
  const colors = {
    success: { bg: "var(--io-success-subtle)", fg: "var(--io-success)" },
    warning: { bg: "var(--io-warning-subtle)", fg: "var(--io-warning)" },
    danger: { bg: "var(--io-danger-subtle)", fg: "var(--io-danger)" },
    accent: { bg: "var(--io-accent-subtle)", fg: "var(--io-accent)" },
    muted: { bg: "var(--io-surface-sunken)", fg: "var(--io-text-muted)" },
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
// RestorePreviewDiffTable — renders field-level diff rows
// ---------------------------------------------------------------------------

function RestorePreviewDiffTable({
  rows,
  mode,
  selectedIds,
  onToggle,
}: {
  rows: RestorePreviewRow[];
  mode: "all" | "selective";
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p
        style={{
          padding: "var(--io-space-4)",
          color: "var(--io-text-muted)",
          fontSize: "12px",
        }}
      >
        No rows in this snapshot.
      </p>
    );
  }

  // Collect all unique fields across all rows for table columns
  const allFields = Array.from(
    new Set(
      rows.flatMap((r) =>
        Object.keys(r.snapshot_values).filter((k) => k !== "id"),
      ),
    ),
  ).slice(0, 8); // limit columns for readability

  return (
    <table style={{ ...TABLE, fontSize: "11px" }}>
      <thead>
        <tr>
          {mode === "selective" && <th style={{ ...TH, width: 32 }}></th>}
          <th style={TH}>ID</th>
          <th style={{ ...TH, width: 80 }}>Status</th>
          {allFields.map((f) => (
            <th key={f} style={TH}>
              {f}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isSelected = selectedIds.has(row.id);
          const hasChanges = row.changed_fields.length > 0;
          return (
            <tr
              key={row.id}
              style={{
                background: row.conflicted
                  ? "var(--io-warning-subtle)"
                  : isSelected && mode === "selective"
                    ? "var(--io-accent-subtle)"
                    : undefined,
                cursor: mode === "selective" ? "pointer" : undefined,
              }}
              onClick={() => mode === "selective" && onToggle(row.id)}
            >
              {mode === "selective" && (
                <td style={{ ...TD, textAlign: "center" as const }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(row.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              )}
              <td
                style={{
                  ...TD,
                  fontFamily: "monospace",
                  fontSize: "10px",
                  color: "var(--io-text-muted)",
                }}
              >
                {row.id.slice(0, 8)}…
              </td>
              <td style={TD}>
                {row.conflicted ? (
                  <span
                    style={{
                      color: "var(--io-warning)",
                      fontWeight: 600,
                      fontSize: "11px",
                    }}
                  >
                    &#9888; Conflict
                  </span>
                ) : hasChanges ? (
                  <Badge color="accent">Changed</Badge>
                ) : (
                  <Badge color="muted">Same</Badge>
                )}
              </td>
              {allFields.map((field) => {
                const snapVal = row.snapshot_values[field];
                const currVal = row.current_values[field];
                const isChanged = row.changed_fields.includes(field);
                const snapStr =
                  snapVal === null || snapVal === undefined
                    ? "—"
                    : String(snapVal).replace(/^"|"$/g, "");
                const currStr =
                  currVal === null || currVal === undefined
                    ? "—"
                    : String(currVal).replace(/^"|"$/g, "");
                return (
                  <td
                    key={field}
                    style={{
                      ...TD,
                      background: isChanged
                        ? "var(--io-danger-subtle)"
                        : undefined,
                    }}
                  >
                    {isChanged ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            color: "var(--io-danger)",
                            textDecoration: "line-through",
                            fontSize: "10px",
                          }}
                        >
                          {currStr}
                        </span>
                        <span
                          style={{
                            color: "var(--io-success)",
                            fontSize: "10px",
                          }}
                        >
                          {snapStr}
                        </span>
                      </div>
                    ) : (
                      <span
                        style={{
                          color: "var(--io-text-muted)",
                          fontSize: "10px",
                        }}
                      >
                        {snapStr}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// RestorePreviewModal — multi-step restore preview with field-level diff
// ---------------------------------------------------------------------------

export function RestorePreviewModal({
  snapshotId,
  snapshotLabel,
  onClose,
  onRestored,
}: {
  snapshotId: string;
  snapshotLabel?: string | null;
  onClose: () => void;
  onRestored: (result: {
    rows_restored: number;
    safety_snapshot_id: string | null;
  }) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "selective">("all");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [createSafetySnapshot, setCreateSafetySnapshot] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);

  // Load preview on mount
  useEffect(() => {
    snapshotsApi
      .restorePreview(snapshotId)
      .then((res) => {
        if (res.success) {
          setPreview(res.data);
          setStep(2);
        } else {
          setLoadError(res.error.message);
        }
      })
      .catch(() => {
        setLoadError("Network error loading restore preview");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);

  const toggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (preview) setSelectedRowIds(new Set(preview.rows.map((r) => r.id)));
  };

  const clearAll = () => setSelectedRowIds(new Set());

  const rowCount =
    mode === "all" ? (preview?.total_rows ?? 0) : selectedRowIds.size;

  const handleRestore = async () => {
    setIsRestoring(true);
    const req: RestoreRequest = {
      mode,
      create_safety_snapshot: createSafetySnapshot,
      row_ids: mode === "selective" ? Array.from(selectedRowIds) : undefined,
    };
    try {
      const res = await snapshotsApi.restore(snapshotId, req);
      if (res.success) {
        onRestored({
          rows_restored: res.data.rows_restored,
          safety_snapshot_id: res.data.safety_snapshot_id,
        });
      } else {
        showToast({
          title: "Restore failed",
          description: res.error.message,
          variant: "error",
        });
        setIsRestoring(false);
      }
    } catch {
      showToast({
        title: "Restore failed",
        description: "Network error",
        variant: "error",
      });
      setIsRestoring(false);
    }
  };

  const MODAL_OVERLAY: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "var(--io-modal-backdrop)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  };

  const MODAL_BOX: React.CSSProperties = {
    background: "var(--io-surface-primary)",
    border: "1px solid var(--io-border)",
    borderRadius: "10px",
    padding: "var(--io-space-6)",
    maxWidth: 860,
    width: "95%",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    gap: "var(--io-space-4)",
  };

  return (
    <div style={MODAL_OVERLAY}>
      <div style={MODAL_BOX}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--io-text-primary)",
              }}
            >
              Restore Snapshot
            </h2>
            {snapshotLabel && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                }}
              >
                {snapshotLabel}
              </p>
            )}
          </div>
          <button
            style={{ ...BTN_SECONDARY, padding: "4px 10px", fontSize: "12px" }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        {/* Step 1: Loading */}
        {step === 1 && (
          <div
            style={{
              padding: "var(--io-space-6)",
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            {loadError ? (
              <p style={{ color: "var(--io-danger)" }}>
                Failed to load restore preview: {loadError}
              </p>
            ) : (
              <p>Loading restore preview…</p>
            )}
          </div>
        )}

        {/* Step 2: Preview & Mode Selection */}
        {step === 2 && preview && (
          <>
            {/* Summary bar */}
            <div
              style={{
                display: "flex",
                gap: "var(--io-space-4)",
                flexWrap: "wrap",
                fontSize: "13px",
              }}
            >
              <span>
                <strong style={{ color: "var(--io-text-primary)" }}>
                  {preview.total_rows}
                </strong>
                <span style={{ color: "var(--io-text-muted)", marginLeft: 4 }}>
                  rows in snapshot
                </span>
              </span>
              {preview.conflicted_count > 0 && (
                <span style={{ color: "var(--io-warning)", fontWeight: 600 }}>
                  &#9888; {preview.conflicted_count} conflicted (modified after
                  snapshot)
                </span>
              )}
              <span
                style={{
                  color: "var(--io-text-muted)",
                  fontFamily: "monospace",
                  fontSize: "11px",
                }}
              >
                Snapshot taken:{" "}
                {new Date(preview.snapshot_created_at).toLocaleString()}
              </span>
            </div>

            {/* Mode selector */}
            <div
              style={{
                display: "flex",
                gap: "var(--io-space-4)",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                <input
                  type="radio"
                  name="restore-mode"
                  value="all"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                />
                Restore all {preview.total_rows} rows
              </label>
              <label
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                <input
                  type="radio"
                  name="restore-mode"
                  value="selective"
                  checked={mode === "selective"}
                  onChange={() => setMode("selective")}
                />
                Select specific rows
              </label>
              {mode === "selective" && (
                <div
                  style={{
                    display: "flex",
                    gap: "var(--io-space-2)",
                    marginLeft: "auto",
                  }}
                >
                  <button
                    style={{
                      ...BTN_SECONDARY,
                      fontSize: "11px",
                      padding: "3px 8px",
                    }}
                    onClick={selectAll}
                  >
                    Select All
                  </button>
                  <button
                    style={{
                      ...BTN_SECONDARY,
                      fontSize: "11px",
                      padding: "3px 8px",
                    }}
                    onClick={clearAll}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Diff table */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "auto",
                border: "1px solid var(--io-border)",
                borderRadius: 6,
              }}
            >
              <RestorePreviewDiffTable
                rows={preview.rows}
                mode={mode}
                selectedIds={selectedRowIds}
                onToggle={toggleRow}
              />
            </div>

            {/* Safety snapshot checkbox */}
            <label
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--io-text-primary)",
              }}
            >
              <input
                type="checkbox"
                checked={createSafetySnapshot}
                onChange={(e) => setCreateSafetySnapshot(e.target.checked)}
              />
              Create a safety snapshot of the current state before restoring
            </label>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                gap: "var(--io-space-3)",
                justifyContent: "flex-end",
              }}
            >
              <button style={BTN_SECONDARY} onClick={onClose}>
                Cancel
              </button>
              <button
                style={BTN_PRIMARY}
                onClick={() => setStep(3)}
                disabled={mode === "selective" && selectedRowIds.size === 0}
              >
                Continue ({rowCount} row{rowCount !== 1 ? "s" : ""})
              </button>
            </div>
          </>
        )}

        {/* Step 3: Final Confirmation */}
        {step === 3 && preview && (
          <>
            <div
              style={{
                padding: "var(--io-space-4)",
                background: "var(--io-warning-subtle)",
                borderRadius: 6,
                border: "1px solid var(--io-warning)",
                fontSize: "13px",
                color: "var(--io-text-primary)",
                lineHeight: 1.6,
              }}
            >
              <strong>
                You are about to restore {rowCount} row
                {rowCount !== 1 ? "s" : ""}
              </strong>{" "}
              from snapshot
              {snapshotLabel
                ? ` "${snapshotLabel}"`
                : ` ${snapshotId.slice(0, 8)}…`}
              {createSafetySnapshot && (
                <span>
                  {" "}
                  A safety snapshot of the current state will be created first.
                </span>
              )}
              {preview.conflicted_count > 0 && mode === "all" && (
                <div
                  style={{
                    marginTop: 6,
                    color: "var(--io-warning)",
                    fontWeight: 600,
                  }}
                >
                  &#9888; {preview.conflicted_count} conflicted row
                  {preview.conflicted_count !== 1 ? "s" : ""} will be
                  overwritten.
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "var(--io-space-3)",
                justifyContent: "flex-end",
              }}
            >
              <button style={BTN_SECONDARY} onClick={() => setStep(2)}>
                Back
              </button>
              <button
                style={{ ...BTN_PRIMARY, background: "var(--io-danger)" }}
                onClick={handleRestore}
                disabled={isRestoring}
              >
                {isRestoring
                  ? "Restoring…"
                  : `Restore ${rowCount} Row${rowCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
