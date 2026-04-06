import { useState } from "react";
import type { CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
} from "./settingsStyles";
import SettingsPageLayout from "./SettingsPageLayout";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EulaVersionAdmin {
  id: string;
  eula_type: "installer" | "end_user";
  version: string;
  title: string;
  content: string;
  is_active: boolean;
  published_at: string | null;
  acceptance_count?: number;
}

interface EulaAcceptanceRow {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  email: string;
  eula_type: "installer" | "end_user";
  eula_version: string;
  eula_version_id: string;
  accepted_at: string;
  accepted_from_ip: string;
  accepted_as_role: string;
  acceptance_context: string;
  receipt_token: string;
  content_hash: string;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--io-modal-backdrop)",
  zIndex: 50,
};

const dialogStyle: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 51,
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius-lg)",
  padding: "24px",
  width: "900px",
  maxWidth: "95vw",
  maxHeight: "90vh",
  overflowY: "auto",
};

const dialogStyleFullscreen: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 51,
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius-lg)",
  padding: "24px",
  width: "95vw",
  height: "95vh",
  maxWidth: "95vw",
  maxHeight: "95vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};

// ---------------------------------------------------------------------------
// Create Version Dialog
// ---------------------------------------------------------------------------

interface CreateVersionDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateVersionDialog({
  open,
  onClose,
  onCreated,
}: CreateVersionDialogProps) {
  const [eulaType, setEulaType] = useState<"installer" | "end_user">(
    "end_user",
  );
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState(
    "Inside/Operations — End User License Agreement",
  );
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<EulaVersionAdmin>("/api/auth/admin/eula/versions", {
        eula_type: eulaType,
        version,
        title,
        content,
      }),
    onSuccess: () => {
      onCreated();
      onClose();
      setVersion("");
      setContent("");
      setError(null);
      setFullscreen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const editorHeight = fullscreen ? "calc(95vh - 260px)" : "320px";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setFullscreen(false);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content
          aria-describedby={undefined}
          style={fullscreen ? dialogStyleFullscreen : dialogStyle}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              Create New EULA Version (Draft)
            </Dialog.Title>
            <button
              style={{
                ...btnSmall,
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              onClick={() => setFullscreen((f) => !f)}
              title={fullscreen ? "Exit full screen" : "Enter full screen"}
            >
              {fullscreen ? "⤡ Exit Full Screen" : "⤢ Full Screen"}
            </button>
          </div>

          <p
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            New versions start as drafts. They become active only when you
            explicitly publish them. Publishing will require all users to
            re-accept on their next login.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              flex: fullscreen ? 1 : undefined,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 2fr",
                gap: "12px",
              }}
            >
              <div>
                <label htmlFor="eula-type" style={labelStyle}>
                  Type *
                </label>
                <select
                  id="eula-type"
                  style={inputStyle}
                  value={eulaType}
                  onChange={(e) => {
                    const t = e.target.value as "installer" | "end_user";
                    setEulaType(t);
                    setTitle(
                      t === "installer"
                        ? "Inside/Operations — Software License Agreement"
                        : "Inside/Operations — End User License Agreement",
                    );
                  }}
                >
                  <option value="end_user">End User (EULA)</option>
                  <option value="installer">
                    Installer (Software License)
                  </option>
                </select>
              </div>
              <div>
                <label htmlFor="eula-version" style={labelStyle}>
                  Version string *
                </label>
                <input
                  id="eula-version"
                  style={inputStyle}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 1.1"
                />
              </div>
              <div>
                <label htmlFor="eula-title" style={labelStyle}>
                  Title *
                </label>
                <input
                  id="eula-title"
                  style={inputStyle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                flex: fullscreen ? 1 : undefined,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "5px",
                }}
              >
                <label
                  htmlFor="eula-content"
                  style={{ ...labelStyle, marginBottom: 0 }}
                >
                  Content (Markdown) *
                </label>
                <div style={{ display: "flex", gap: "16px" }}>
                  <span
                    style={{ fontSize: "11px", color: "var(--io-text-muted)" }}
                  >
                    Markdown
                  </span>
                  <span
                    style={{ fontSize: "11px", color: "var(--io-text-muted)" }}
                  >
                    Preview
                  </span>
                </div>
              </div>
              {/* Split-pane editor */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  flex: fullscreen ? 1 : undefined,
                }}
              >
                {/* Left: raw markdown textarea */}
                <textarea
                  id="eula-content"
                  style={{
                    ...inputStyle,
                    height: editorHeight,
                    minHeight: "200px",
                    resize: fullscreen ? "none" : "vertical",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    lineHeight: "1.5",
                  }}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    "# Inside/Operations — End User License Agreement\n\nVersion 1.x | Effective: ..."
                  }
                />
                {/* Right: preformatted preview */}
                <pre
                  style={{
                    margin: 0,
                    height: editorHeight,
                    minHeight: "200px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                    fontSize: "12px",
                    lineHeight: "1.6",
                    color: "var(--io-text-secondary)",
                    background: "var(--io-surface-sunken)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    padding: "8px 10px",
                    boxSizing: "border-box",
                  }}
                >
                  {content || (
                    <span
                      style={{
                        color: "var(--io-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      Preview will appear here…
                    </span>
                  )}
                </pre>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  marginTop: "4px",
                }}
              >
                Content is stored as-is in the database. A SHA-256 hash is
                recorded in every user acceptance row, permanently tying each
                signature to this exact text.
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: "12px",
                padding: "8px 12px",
                background: "var(--io-danger-subtle)",
                borderRadius: "var(--io-radius)",
                fontSize: "13px",
                color: "var(--io-danger)",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              marginTop: "20px",
            }}
          >
            <button
              style={btnSecondary}
              onClick={() => {
                onClose();
                setFullscreen(false);
              }}
            >
              Cancel
            </button>
            <button
              style={{
                ...btnPrimary,
                opacity: !version.trim() || !content.trim() ? 0.5 : 1,
              }}
              disabled={
                !version.trim() || !content.trim() || mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Creating…" : "Save as Draft"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// View Version Dialog (read-only content preview)
// ---------------------------------------------------------------------------

function ViewVersionDialog({
  version,
  onClose,
}: {
  version: EulaVersionAdmin | null;
  onClose: () => void;
}) {
  if (!version) return null;
  return (
    <Dialog.Root open={!!version} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content aria-describedby={undefined} style={dialogStyle}>
          <Dialog.Title
            style={{
              margin: "0 0 4px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {version.title}
          </Dialog.Title>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: "16px",
            }}
          >
            Version {version.version} ·{" "}
            {version.is_active ? "● Active" : "Draft"} ·{" "}
            {version.published_at
              ? `Published ${new Date(version.published_at).toLocaleDateString()}`
              : "Not published"}
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.6,
              background: "var(--io-surface-sunken)",
              borderRadius: "var(--io-radius)",
              padding: "16px",
              maxHeight: "50vh",
              overflowY: "auto",
              margin: "0 0 20px",
            }}
          >
            {version.content}
          </pre>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={btnSecondary} onClick={onClose}>
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Acceptances audit log panel
// ---------------------------------------------------------------------------

function AcceptancesPanel({ versionId }: { versionId?: string }) {
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [exportLoading, setExportLoading] = useState(false);

  // Page-1 query for stats: fetch all records on page 1 (stats are computed client-side)
  const { data: allPage1, isLoading: statsLoading } = useQuery({
    queryKey: ["eula-acceptances-stats"],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", per_page: "10000" });
      const result = await api.get<EulaAcceptanceRow[]>(
        `/api/auth/admin/eula/acceptances?${params}`,
      );
      if (result.success) return result.data;
      return [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["eula-acceptances", versionId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(versionId ? { version_id: versionId } : {}),
      });
      // Backend returns Vec<EulaAcceptanceRecord> (plain array wrapped in ApiResponse)
      const result = await api.get<EulaAcceptanceRow[]>(
        `/api/auth/admin/eula/acceptances?${params}`,
      );
      if (result.success) return result.data;
      return [];
    },
  });

  const rows = data ?? [];
  const allRows = allPage1 ?? [];
  const hasMore = rows.length === perPage;

  // Compute summary stats from all loaded acceptance rows
  const totalUsers = new Set(allRows.map((r) => r.user_id)).size;

  // Determine the latest version string from all rows (most recent accepted_at per version)
  const versionCounts: Record<string, number> = {};
  for (const r of allRows) {
    versionCounts[r.eula_version] = (versionCounts[r.eula_version] ?? 0) + 1;
  }
  // The "current" version is the one with the most acceptances (proxy for active)
  const sortedVersions = Object.entries(versionCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const currentVersion =
    sortedVersions.length > 0 ? sortedVersions[0][0] : null;

  // Users who accepted the current version
  const usersAcceptedCurrent = currentVersion
    ? new Set(
        allRows
          .filter((r) => r.eula_version === currentVersion)
          .map((r) => r.user_id),
      ).size
    : 0;

  // Users who have NOT accepted the current version
  const usersPendingCurrent = totalUsers - usersAcceptedCurrent;
  const acceptedPct =
    totalUsers > 0 ? Math.round((usersAcceptedCurrent / totalUsers) * 100) : 0;
  const pendingPct =
    totalUsers > 0 ? Math.round((usersPendingCurrent / totalUsers) * 100) : 0;

  async function handleExportCsv() {
    setExportLoading(true);
    try {
      // Build CSV manually from all acceptance rows to ensure content_hash is included
      const headers: (keyof EulaAcceptanceRow)[] = [
        "id",
        "user_id",
        "username",
        "full_name",
        "email",
        "eula_type",
        "eula_version",
        "eula_version_id",
        "accepted_at",
        "accepted_from_ip",
        "accepted_as_role",
        "acceptance_context",
        "receipt_token",
        "content_hash",
      ];
      const escape = (v: string | null | undefined) => {
        if (v == null) return "";
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const csvLines = [headers.join(",")];
      for (const row of allRows) {
        csvLines.push(
          headers.map((h) => escape(row[h] as string | null)).join(","),
        );
      }
      const csvContent = csvLines.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eula-acceptances-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  }

  const cardStyle: CSSProperties = {
    flex: 1,
    padding: "14px 16px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
  };

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "6px",
            }}
          >
            Total Users
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            {statsLoading ? "—" : totalUsers.toLocaleString()}
          </div>
        </div>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "6px",
            }}
          >
            Accepted Current Version
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--io-success, #22c55e)",
            }}
          >
            {statsLoading ? "—" : usersAcceptedCurrent.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-success, #22c55e)",
              marginTop: "2px",
            }}
          >
            {statsLoading ? "" : `${acceptedPct}% of users`}
          </div>
        </div>
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "6px",
            }}
          >
            Pending Acceptance
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--io-warning, #f59e0b)",
            }}
          >
            {statsLoading ? "—" : usersPendingCurrent.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-warning, #f59e0b)",
              marginTop: "2px",
            }}
          >
            {statsLoading ? "" : `${pendingPct}% of users`}
          </div>
        </div>
      </div>

      {/* Export CSV button + record count row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
          {isLoading
            ? "Loading…"
            : `${rows.length} record${rows.length === 1 ? "" : "s"} on page ${page}`}
          {versionId && " (filtered by version)"}
        </div>
        <button
          style={{
            ...btnSecondary,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
          onClick={handleExportCsv}
          disabled={exportLoading || allRows.length === 0}
        >
          {exportLoading ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {isLoading ? (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          Loading…
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
              {[
                "User",
                "Type",
                "Version",
                "Context",
                "Accepted At",
                "IP",
                "Content Hash",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 10px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom:
                    "1px solid var(--io-border-subtle, var(--io-border))",
                }}
              >
                <td
                  style={{
                    padding: "6px 10px",
                    color: "var(--io-text-primary)",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{row.username}</div>
                  <div
                    style={{ color: "var(--io-text-muted)", fontSize: "11px" }}
                  >
                    {row.email}
                  </div>
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "999px",
                      fontSize: "10px",
                      fontWeight: 600,
                      background:
                        row.eula_type === "installer"
                          ? "var(--io-accent-subtle)"
                          : "var(--io-surface-sunken)",
                      color:
                        row.eula_type === "installer"
                          ? "var(--io-accent)"
                          : "var(--io-text-muted)",
                      border: "1px solid var(--io-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.eula_type === "installer" ? "Installer" : "End User"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    color: "var(--io-text-secondary)",
                  }}
                >
                  {row.eula_version}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    color: "var(--io-text-muted)",
                    fontSize: "11px",
                  }}
                >
                  {row.acceptance_context ?? "—"}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    color: "var(--io-text-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {new Date(row.accepted_at).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    color: "var(--io-text-muted)",
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                >
                  {row.accepted_from_ip}
                </td>
                <td
                  style={{
                    padding: "6px 10px",
                    color: "var(--io-text-muted)",
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                >
                  {row.content_hash.slice(0, 12)}…
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--io-text-muted)",
                  }}
                >
                  No acceptances found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {(page > 1 || hasMore) && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
            marginTop: "12px",
          }}
        >
          <button
            style={btnSmall}
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              alignSelf: "center",
            }}
          >
            Page {page}
          </span>
          <button
            style={btnSmall}
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main EULA Admin Page
// ---------------------------------------------------------------------------

type ActiveTab = "versions" | "acceptances";

export default function EulaAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("versions");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewVersion, setViewVersion] = useState<EulaVersionAdmin | null>(null);
  const [filterVersionId, setFilterVersionId] = useState<string | undefined>();
  const [publishConfirmId, setPublishConfirmId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ["eula-versions-admin"],
    queryFn: async () => {
      const result = await api.get<EulaVersionAdmin[]>(
        "/api/auth/admin/eula/versions",
      );
      if (result.success) return result.data;
      return [];
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<EulaVersionAdmin>(
        `/api/auth/admin/eula/versions/${id}/publish`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eula-versions-admin"] });
      setPublishConfirmId(null);
      setPublishError(null);
    },
    onError: (e: Error) => setPublishError(e.message),
  });

  const tabStyle = (tab: ActiveTab): CSSProperties => ({
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "var(--io-accent)" : "var(--io-text-secondary)",
    background: "none",
    border: "none",
    borderBottom:
      activeTab === tab
        ? "2px solid var(--io-accent)"
        : "2px solid transparent",
    cursor: "pointer",
    paddingBottom: "10px",
  });

  return (
    <SettingsPageLayout
      title="License & Terms Management"
      description="Manage both the Installer EULA (organizational software license) and the End User EULA (individual use agreement). All versions are retained permanently and every acceptance is recorded with a chained SHA-256 hash for tamper-evident audit."
      variant="list"
      action={
        <button
          style={{ ...btnPrimary, whiteSpace: "nowrap" }}
          onClick={() => setCreateOpen(true)}
        >
          New Version
        </button>
      }
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--io-border)",
          margin: "20px 0 0",
          gap: "0",
        }}
      >
        <button
          style={tabStyle("versions")}
          onClick={() => setActiveTab("versions")}
        >
          Versions
        </button>
        <button
          style={tabStyle("acceptances")}
          onClick={() => setActiveTab("acceptances")}
        >
          Acceptance Log
        </button>
      </div>

      <div style={{ paddingTop: "20px" }}>
        {/* Versions tab */}
        {activeTab === "versions" && (
          <>
            {versionsLoading ? (
              <div
                style={{
                  padding: "32px",
                  textAlign: "center",
                  color: "var(--io-text-muted)",
                  fontSize: "13px",
                }}
              >
                Loading…
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {(versions ?? []).length === 0 && (
                  <div
                    style={{
                      padding: "32px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    No EULA versions found. The active version is seeded
                    automatically on startup.
                  </div>
                )}
                {(versions ?? []).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "14px 16px",
                      background: "var(--io-surface-secondary)",
                      border: `1px solid ${v.is_active ? "var(--io-accent)" : "var(--io-border)"}`,
                      borderRadius: "var(--io-radius)",
                    }}
                  >
                    {/* Status badge */}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: v.is_active
                          ? "var(--io-accent-subtle)"
                          : "var(--io-surface-sunken)",
                        color: v.is_active
                          ? "var(--io-accent)"
                          : "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.is_active ? "Active" : "Draft"}
                    </span>

                    {/* Type badge */}
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background:
                          v.eula_type === "installer"
                            ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
                            : "var(--io-surface-sunken)",
                        color:
                          v.eula_type === "installer"
                            ? "var(--io-accent)"
                            : "var(--io-text-muted)",
                        border: "1px solid var(--io-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.eula_type === "installer" ? "Installer" : "End User"}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          color: "var(--io-text-primary)",
                        }}
                      >
                        {v.title}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--io-text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        v{v.version}
                        {v.published_at &&
                          ` · Published ${new Date(v.published_at).toLocaleDateString()}`}
                        {v.acceptance_count != null &&
                          ` · ${v.acceptance_count.toLocaleString()} acceptances`}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={btnSmall}
                        onClick={() => setViewVersion(v)}
                      >
                        View
                      </button>
                      <button
                        style={btnSmall}
                        onClick={() => {
                          setFilterVersionId(v.id);
                          setActiveTab("acceptances");
                        }}
                      >
                        Signatures
                      </button>
                      {!v.is_active && (
                        <button
                          style={{
                            ...btnSmall,
                            color: "var(--io-accent)",
                            borderColor: "var(--io-accent)",
                          }}
                          onClick={() => {
                            setPublishConfirmId(v.id);
                            setPublishError(null);
                          }}
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Publish confirmation */}
            {publishConfirmId && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  background:
                    "var(--io-warning-subtle, var(--io-surface-sunken))",
                  border: "1px solid var(--io-warning, var(--io-border))",
                  borderRadius: "var(--io-radius)",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "13px",
                    color: "var(--io-text-primary)",
                    marginBottom: "8px",
                  }}
                >
                  Confirm publish
                </div>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: "13px",
                    color: "var(--io-text-secondary)",
                  }}
                >
                  Publishing this version will make it the active EULA. All
                  users will be required to re-accept on their next login. This
                  action cannot be undone.
                </p>
                {publishError && (
                  <div
                    style={{
                      marginBottom: "12px",
                      fontSize: "13px",
                      color: "var(--io-danger)",
                    }}
                  >
                    {publishError}
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    style={btnSecondary}
                    onClick={() => {
                      setPublishConfirmId(null);
                      setPublishError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    style={btnPrimary}
                    disabled={publishMutation.isPending}
                    onClick={() => publishMutation.mutate(publishConfirmId)}
                  >
                    {publishMutation.isPending
                      ? "Publishing…"
                      : "Publish this version"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Acceptances tab */}
        {activeTab === "acceptances" && (
          <>
            {filterVersionId && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--io-text-secondary)",
                  }}
                >
                  Filtered by version ID:{" "}
                  <code style={{ fontFamily: "monospace", fontSize: "11px" }}>
                    {filterVersionId.slice(0, 8)}…
                  </code>
                </span>
                <button
                  style={{ ...btnSmall, fontSize: "11px" }}
                  onClick={() => setFilterVersionId(undefined)}
                >
                  Clear filter
                </button>
              </div>
            )}
            <AcceptancesPanel versionId={filterVersionId} />
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateVersionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() =>
          queryClient.invalidateQueries({ queryKey: ["eula-versions-admin"] })
        }
      />
      <ViewVersionDialog
        version={viewVersion}
        onClose={() => setViewVersion(null)}
      />
    </SettingsPageLayout>
  );
}
