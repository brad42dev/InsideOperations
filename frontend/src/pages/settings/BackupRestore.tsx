import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getStoredToken } from "../../api/client";
import { btnPrimary, btnDanger, btnSmall } from "./settingsStyles";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import SettingsPageLayout from "./SettingsPageLayout";

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

interface BackupSchedule {
  enabled: boolean;
  cron: string;
  keep_last: number;
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

// ---------------------------------------------------------------------------
// Local danger-small button style
// ---------------------------------------------------------------------------

const btnSmallDanger = {
  ...btnSmall,
  border: "1px solid var(--io-danger)",
  color: "var(--io-danger)",
};

// ---------------------------------------------------------------------------
// Backup tab content (embeddable)
// ---------------------------------------------------------------------------

export function BackupTab() {
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>("");

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState<BackupSchedule>({
    enabled: false,
    cron: "0 2 * * *",
    keep_last: 7,
  });

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

  const { data: schedule } = useQuery<BackupSchedule | null>({
    queryKey: ["backup-schedule"],
    queryFn: async () => {
      try {
        const result = await api.get<BackupSchedule>("/api/backups/schedule");
        if (!result.success) return null;
        return result.data;
      } catch {
        return null;
      }
    },
    retry: false,
  });

  useEffect(() => {
    if (schedule) setScheduleForm(schedule);
  }, [schedule]);

  // -------------------------------------------------------------------------
  // Mutations
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

  const scheduleMutation = useMutation<BackupSchedule, Error, BackupSchedule>({
    mutationFn: async (payload: BackupSchedule) => {
      const result = await api.put<BackupSchedule>(
        "/api/backups/schedule",
        payload,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      showToast("success", "Backup schedule saved.");
      queryClient.invalidateQueries({ queryKey: ["backup-schedule"] });
    },
    onError: (err) => {
      showToast(
        "error",
        err instanceof Error ? err.message : "Failed to save schedule",
      );
    },
  });

  // -------------------------------------------------------------------------
  // Download backup — use fetch with auth token from shared client
  // -------------------------------------------------------------------------

  async function handleDownload(filename: string) {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE}/api/backup/download/${encodeURIComponent(filename)}`,
        { headers, credentials: "include" },
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

  return (
    <div>
      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Delete Backup"
        description={
          confirmDelete
            ? `Delete "${confirmDelete}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) deleteMutation.mutate(confirmDelete);
        }}
      />
      <ConfirmDialog
        open={confirmRestore && !!selectedBackup}
        onOpenChange={(open) => {
          if (!open) setConfirmRestore(false);
        }}
        title="Restore Database"
        description={
          selectedBackup
            ? `Restore from "${selectedBackup}"? This will overwrite ALL current data and cannot be undone.`
            : ""
        }
        confirmLabel="Restore"
        variant="danger"
        onConfirm={() => {
          restoreMutation.mutate(selectedBackup);
          setConfirmRestore(false);
        }}
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 16px",
            borderRadius: "8px",
            background:
              toast.type === "success"
                ? "var(--io-success-subtle)"
                : "var(--io-danger-subtle)",
            border: `1px solid ${toast.type === "success" ? "var(--io-success)" : "var(--io-danger)"}`,
            color:
              toast.type === "success" ? "var(--io-success)" : "var(--io-danger)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          <span>{toast.text}</span>
          <button
            onClick={() => setToast(null)}
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
      )}

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
              borderRadius: "var(--io-radius)",
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
                    border: `2px solid color-mix(in srgb, var(--io-text-on-accent) 40%, transparent)`,
                    borderTopColor: "var(--io-text-on-accent)",
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
          <button style={btnSmall} onClick={() => refetch()}>
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
                          style={btnSmall}
                          onClick={() => handleDownload(backup.filename)}
                          title="Download this backup"
                        >
                          Download
                        </button>
                        <button
                          style={{
                            ...btnSmallDanger,
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
            background: "var(--io-warning-subtle)",
            border: "1px solid var(--io-warning)",
            color: "var(--io-warning)",
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
              borderRadius: "var(--io-radius)",
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
              ...btnDanger,
              background: "var(--io-danger)",
              color: "var(--io-text-on-accent)",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: !selectedBackup || restoreMutation.isPending ? 0.5 : 1,
              cursor:
                !selectedBackup || restoreMutation.isPending
                  ? "not-allowed"
                  : "pointer",
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
                    border: `2px solid color-mix(in srgb, var(--io-text-on-accent) 40%, transparent)`,
                    borderTopColor: "var(--io-text-on-accent)",
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

      {/* ------------------------------------------------------------------ */}
      {/* Schedule section                                                    */}
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
          Scheduled Backups
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            maxWidth: "480px",
          }}
        >
          {/* Enable toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--io-text-primary)",
            }}
          >
            <input
              type="checkbox"
              checked={scheduleForm.enabled}
              onChange={(e) =>
                setScheduleForm((f) => ({ ...f, enabled: e.target.checked }))
              }
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            Enable scheduled backups
          </label>

          {/* Cron expression */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--io-text-secondary)",
                marginBottom: "5px",
              }}
            >
              Schedule (cron expression)
            </label>
            <input
              type="text"
              value={scheduleForm.cron}
              onChange={(e) =>
                setScheduleForm((f) => ({ ...f, cron: e.target.value }))
              }
              placeholder="0 2 * * *"
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--io-surface-sunken)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-primary)",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
              }}
            >
              Standard 5-field cron. Example: <code>0 2 * * *</code> = daily at
              2 AM.
            </p>
          </div>

          {/* Retention count */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--io-text-secondary)",
                marginBottom: "5px",
              }}
            >
              Keep last N backups
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={scheduleForm.keep_last}
              onChange={(e) =>
                setScheduleForm((f) => ({
                  ...f,
                  keep_last: parseInt(e.target.value, 10) || 1,
                }))
              }
              style={{
                width: "120px",
                padding: "8px 10px",
                background: "var(--io-surface-sunken)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-primary)",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <button
              style={{
                ...btnPrimary,
                opacity: scheduleMutation.isPending ? 0.7 : 1,
                cursor: scheduleMutation.isPending ? "not-allowed" : "pointer",
              }}
              disabled={scheduleMutation.isPending}
              onClick={() => scheduleMutation.mutate(scheduleForm)}
            >
              {scheduleMutation.isPending ? "Saving…" : "Save Schedule"}
            </button>
          </div>
        </div>
      </section>

      {/* Spinner keyframe */}
      <style>{`@keyframes io-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper (standalone route)
// ---------------------------------------------------------------------------

export default function BackupRestorePage() {
  return (
    <SettingsPageLayout
      title="Backup & Restore"
      description="Create and manage PostgreSQL database backups using pg_dump, and restore from a previous backup."
      maxWidth={720}
    >
      <BackupTab />
    </SettingsPageLayout>
  );
}
