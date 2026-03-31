import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupFile {
  filename: string;
  size_bytes: number;
  created_at: string;
  label: string;
}

interface CreateBackupResponse {
  filename: string;
  size_bytes: number;
}

interface RestoreResponse {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "io_access_token";

// ---------------------------------------------------------------------------
// Toast / inline notification
// ---------------------------------------------------------------------------

interface ToastMessage {
  type: "success" | "error";
  text: string;
}

function Toast({
  msg,
  onDismiss,
}: {
  msg: ToastMessage;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "8px",
        background:
          msg.type === "success"
            ? "var(--io-success-subtle, #0f3d20)"
            : "var(--io-danger-subtle, #3d1a1a)",
        border: `1px solid ${msg.type === "success" ? "var(--io-success)" : "var(--io-danger)"}`,
        color:
          msg.type === "success" ? "var(--io-success)" : "var(--io-danger)",
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      <span>{msg.text}</span>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: "16px",
          lineHeight: 1,
          padding: "0 2px",
          opacity: 0.7,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  dangerous,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  dangerous?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "12px",
          padding: "28px 32px",
          maxWidth: "440px",
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            marginBottom: "10px",
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--io-text-secondary)",
            margin: "0 0 20px",
            lineHeight: 1.6,
          }}
        >
          {body}
        </p>
        <div
          style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-secondary)",
              color: "var(--io-text-secondary)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "none",
              background: dangerous
                ? "var(--io-danger, #d94040)"
                : "var(--io-accent, #3b82f6)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BackupRestorePage() {
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>("");

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
  }

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const {
    data: backups,
    isLoading,
    error: listError,
    refetch,
  } = useQuery<BackupFile[]>({
    queryKey: ["backups"],
    queryFn: async () => {
      const result = await api.get<BackupFile[]>("/api/backup/list");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  // -------------------------------------------------------------------------
  // Create backup
  // -------------------------------------------------------------------------

  const createMutation = useMutation<CreateBackupResponse, Error, string>({
    mutationFn: async (label: string) => {
      const result = await api.post<CreateBackupResponse>(
        "/api/backup/create",
        { label: label || "manual" },
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        `Backup created: ${data.filename} (${formatBytes(data.size_bytes)})`,
      );
      setLabelInput("");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => {
      showToast("error", `Backup failed: ${err.message}`);
    },
  });

  // -------------------------------------------------------------------------
  // Delete backup
  // -------------------------------------------------------------------------

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (filename: string) => {
      const result = await api.delete(
        `/api/backup/${encodeURIComponent(filename)}`,
      );
      if (!result.success) throw new Error(result.error.message);
    },
    onSuccess: (_, filename) => {
      showToast("success", `Backup deleted: ${filename}`);
      if (selectedBackup === filename) setSelectedBackup("");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => {
      showToast("error", `Delete failed: ${err.message}`);
    },
  });

  // -------------------------------------------------------------------------
  // Restore backup
  // -------------------------------------------------------------------------

  const restoreMutation = useMutation<RestoreResponse, Error, string>({
    mutationFn: async (filename: string) => {
      const result = await api.post<RestoreResponse>("/api/backup/restore", {
        filename,
      });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      showToast("success", data.message ?? "Restore initiated successfully.");
    },
    onError: (err) => {
      showToast("error", `Restore failed: ${err.message}`);
    },
  });

  // -------------------------------------------------------------------------
  // Download backup — use fetch with auth header, then blob download
  // -------------------------------------------------------------------------

  async function handleDownload(filename: string) {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE}/api/backup/download/${encodeURIComponent(filename)}`,
        {
          headers,
          credentials: "include",
        },
      );
      if (!res.ok) {
        showToast("error", `Download failed: ${res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(
        "error",
        `Download error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const btnBase: React.CSSProperties = {
    padding: "7px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid var(--io-border)",
    background: "var(--io-surface-secondary)",
    color: "var(--io-text-secondary)",
    transition: "opacity 0.1s",
  };

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: "var(--io-accent, #3b82f6)",
    color: "#fff",
    border: "none",
    fontWeight: 600,
  };

  const btnDanger: React.CSSProperties = {
    ...btnBase,
    background: "transparent",
    color: "var(--io-danger, #d94040)",
    borderColor: "var(--io-danger, #d94040)",
  };

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* Confirm dialogs */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Backup"
          body={`Delete "${confirmDelete}"? This cannot be undone.`}
          confirmLabel="Delete"
          dangerous
          onConfirm={() => {
            deleteMutation.mutate(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmRestore && selectedBackup && (
        <ConfirmDialog
          title="Restore Database"
          body={`Restore from "${selectedBackup}"? This will overwrite ALL current data and cannot be undone.`}
          confirmLabel="Restore"
          dangerous
          onConfirm={() => {
            restoreMutation.mutate(selectedBackup);
            setConfirmRestore(false);
          }}
          onCancel={() => setConfirmRestore(false)}
        />
      )}

      <h2
        style={{
          margin: "0 0 4px",
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        Backup &amp; Restore
      </h2>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: "13px",
          color: "var(--io-text-muted)",
        }}
      >
        Create and manage PostgreSQL database backups using pg_dump, and restore
        from a previous backup.
      </p>

      {/* Toast */}
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}

      {/* ------------------------------------------------------------------ */}
      {/* Create Backup section                                               */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "10px",
          padding: "20px 24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            marginBottom: "14px",
          }}
        >
          Create Backup
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Label (e.g. pre-upgrade)"
            maxLength={64}
            style={{
              flex: "1 1 200px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface)",
              color: "var(--io-text-primary)",
              fontSize: "13px",
              outline: "none",
              minWidth: "0",
            }}
          />
          <button
            style={{
              ...btnPrimary,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: createMutation.isPending ? 0.7 : 1,
            }}
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate(labelInput)}
          >
            {createMutation.isPending ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "io-spin 0.7s linear infinite",
                  }}
                />
                Creating…
              </>
            ) : (
              "Create Backup"
            )}
          </button>
        </div>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: "12px",
            color: "var(--io-text-muted)",
          }}
        >
          Runs{" "}
          <code style={{ fontFamily: "monospace" }}>
            pg_dump --format=custom
          </code>{" "}
          against the connected database. The label is appended to the filename
          for identification.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Backup list                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "10px",
          padding: "20px 24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Available Backups
          </div>
          <button
            style={{ ...btnBase, padding: "5px 12px", fontSize: "12px" }}
            onClick={() => refetch()}
          >
            Refresh
          </button>
        </div>

        {isLoading && (
          <div
            style={{
              color: "var(--io-text-muted)",
              fontSize: "13px",
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            Loading backups…
          </div>
        )}

        {listError && (
          <div
            style={{
              color: "var(--io-danger)",
              fontSize: "13px",
              padding: "10px 0",
            }}
          >
            Failed to load backups:{" "}
            {listError instanceof Error ? listError.message : "Unknown error"}
          </div>
        )}

        {!isLoading && !listError && (!backups || backups.length === 0) && (
          <div
            style={{
              color: "var(--io-text-muted)",
              fontSize: "13px",
              textAlign: "center",
              padding: "24px 0",
              borderTop: "1px solid var(--io-border-subtle)",
            }}
          >
            No backups found. Create your first backup above.
          </div>
        )}

        {!isLoading && backups && backups.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
                color: "var(--io-text-primary)",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-muted)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px 10px 0",
                      fontWeight: 600,
                    }}
                  >
                    Filename
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px 10px",
                      fontWeight: 600,
                    }}
                  >
                    Label
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 8px 10px",
                      fontWeight: 600,
                    }}
                  >
                    Size
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 8px 10px",
                      fontWeight: 600,
                    }}
                  >
                    Created
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "6px 0 10px 8px",
                      fontWeight: 600,
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.filename}
                    style={{
                      borderBottom: "1px solid var(--io-border-subtle)",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 8px 10px 0",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "var(--io-text-secondary)",
                        whiteSpace: "nowrap",
                        maxWidth: "260px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={backup.filename}
                    >
                      {backup.filename}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "var(--io-text-secondary)",
                      }}
                    >
                      {backup.label}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        textAlign: "right",
                        color: "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatBytes(backup.size_bytes)}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                      }}
                    >
                      {formatDate(backup.created_at)}
                    </td>
                    <td
                      style={{
                        padding: "10px 0 10px 8px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          style={{
                            ...btnBase,
                            padding: "5px 10px",
                            fontSize: "12px",
                          }}
                          onClick={() => handleDownload(backup.filename)}
                          title="Download this backup"
                        >
                          Download
                        </button>
                        <button
                          style={{
                            ...btnDanger,
                            padding: "5px 10px",
                            fontSize: "12px",
                            opacity: deleteMutation.isPending ? 0.6 : 1,
                          }}
                          disabled={deleteMutation.isPending}
                          onClick={() => setConfirmDelete(backup.filename)}
                          title="Delete this backup"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Restore section                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "10px",
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            marginBottom: "14px",
          }}
        >
          Restore from Backup
        </div>

        {/* Warning banner */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "flex-start",
            padding: "12px 14px",
            borderRadius: "8px",
            background: "var(--io-warning-subtle, #3d2d0a)",
            border: "1px solid var(--io-warning, #d97706)",
            color: "var(--io-warning, #d97706)",
            fontSize: "13px",
            marginBottom: "16px",
            lineHeight: 1.5,
          }}
        >
          <span style={{ flexShrink: 0, fontWeight: 700, fontSize: "15px" }}>
            !
          </span>
          <span>
            <strong>Warning:</strong> Restore will replace all current data.
            This operation is destructive and cannot be undone. Ensure you have
            a recent backup before proceeding.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedBackup}
            onChange={(e) => setSelectedBackup(e.target.value)}
            style={{
              flex: "1 1 260px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface)",
              color: selectedBackup
                ? "var(--io-text-primary)"
                : "var(--io-text-muted)",
              fontSize: "13px",
              outline: "none",
              minWidth: "0",
            }}
          >
            <option value="">— Select a backup —</option>
            {(backups ?? []).map((b) => (
              <option key={b.filename} value={b.filename}>
                {b.filename} ({formatBytes(b.size_bytes)})
              </option>
            ))}
          </select>

          <button
            style={{
              ...btnBase,
              background: "var(--io-danger, #d94040)",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              opacity: !selectedBackup || restoreMutation.isPending ? 0.5 : 1,
              cursor:
                !selectedBackup || restoreMutation.isPending
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            disabled={!selectedBackup || restoreMutation.isPending}
            onClick={() => setConfirmRestore(true)}
          >
            {restoreMutation.isPending ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "io-spin 0.7s linear infinite",
                  }}
                />
                Restoring…
              </>
            ) : (
              "Restore"
            )}
          </button>
        </div>

        <p
          style={{
            margin: "10px 0 0",
            fontSize: "12px",
            color: "var(--io-text-muted)",
          }}
        >
          Runs{" "}
          <code style={{ fontFamily: "monospace" }}>pg_restore --clean</code>{" "}
          against the connected database. The restore process runs in the
          background; monitor server logs for completion status.
        </p>
      </section>

      {/* Spinner keyframe */}
      <style>{`@keyframes io-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
