import React from "react";
import { graphicsApi } from "../../../api/graphics";
import type { GraphicDocument } from "../../../shared/types/graphics";

interface VersionEntry {
  id: string;
  version: number;
  type: "published" | "draft";
  author: string;
  author_name: string;
  timestamp: string;
  isCurrent?: boolean;
}

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  graphicId: string | null;
  onPreview: (versionId: string, doc: GraphicDocument) => void;
  onRestore: (versionId: string) => void;
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "320px",
  maxWidth: "100vw",
  zIndex: 1050,
  background: "var(--io-surface-elevated)",
  borderLeft: "1px solid var(--io-border)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderBottom: "1px solid var(--io-border)",
  fontWeight: 600,
  fontSize: "14px",
  color: "var(--io-text-primary)",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  color: "var(--io-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  padding: "12px 16px 4px",
};

const entryStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderBottom: "1px solid var(--io-border-subtle)",
  fontSize: "12px",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: "11px",
  borderRadius: "var(--io-radius)",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
  cursor: "pointer",
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

export default function VersionHistoryDialog({
  open,
  onClose,
  graphicId,
  onPreview,
  onRestore,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = React.useState<VersionEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [actionId, setActionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !graphicId) return;
    setLoading(true);
    graphicsApi
      .getVersions(graphicId)
      .then((r) => {
        if (r.success) setVersions(r.data.data);
      })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [open, graphicId]);

  if (!open) return null;

  const published = versions.filter((v) => v.type === "published");
  const drafts = versions.filter((v) => v.type === "draft");

  async function handlePreview(versionId: string) {
    if (!graphicId) return;
    setActionId(versionId);
    try {
      const r = await graphicsApi.getVersionContent(graphicId, versionId);
      if (r.success) onPreview(versionId, r.data.data.scene_data);
    } finally {
      setActionId(null);
    }
  }

  async function handleRestore(versionId: string) {
    if (!graphicId) return;
    if (
      !window.confirm(
        "Restore this version? A new draft will be created from the selected version. Unsaved changes will be lost.",
      )
    )
      return;
    setActionId(versionId);
    try {
      const r = await graphicsApi.restoreVersion(graphicId, versionId);
      if (r.success) {
        onRestore(versionId);
        onClose();
      }
    } finally {
      setActionId(null);
    }
  }

  function renderEntries(
    entries: VersionEntry[],
    section: "published" | "draft",
  ) {
    return entries.map((v) => (
      <div key={v.id} style={entryStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "6px",
          }}
        >
          {section === "published" ? (
            <span
              style={{
                fontWeight: 600,
                color: "var(--io-success)",
                fontSize: "11px",
                background: "var(--io-success-subtle, rgba(34,197,94,0.1))",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              v{v.version}
            </span>
          ) : (
            <span
              style={{
                fontWeight: v.isCurrent ? 600 : 400,
                color: "var(--io-text-primary)",
              }}
            >
              Draft {v.version}
              {v.isCurrent ? " (current)" : ""}
            </span>
          )}
          <span style={{ color: "var(--io-text-muted)", fontSize: "11px" }}>
            {v.author_name ?? v.author}
          </span>
          <span
            style={{
              color: "var(--io-text-muted)",
              marginLeft: "auto",
              fontSize: "10px",
              whiteSpace: "nowrap",
            }}
          >
            {formatTimestamp(v.timestamp)}
          </span>
        </div>
        {!v.isCurrent && (
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              style={smallBtnStyle}
              disabled={actionId === v.id}
              onClick={() => handlePreview(v.id)}
            >
              {actionId === v.id ? "…" : "Preview"}
            </button>
            <button
              style={smallBtnStyle}
              disabled={actionId === v.id}
              onClick={() => handleRestore(v.id)}
            >
              Restore
            </button>
          </div>
        )}
      </div>
    ));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1049,
          background: "rgba(0,0,0,0.2)",
        }}
        onClick={onClose}
      />
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span>Version History</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: "16px",
              lineHeight: 1,
            }}
          >
            {"\u00D7"}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                padding: "24px 16px",
                color: "var(--io-text-muted)",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              Loading versions…
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                color: "var(--io-text-muted)",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              No version history yet. Save the graphic to create drafts, or
              publish to create a permanent snapshot.
            </div>
          )}

          {published.length > 0 && (
            <>
              <div style={sectionLabel}>Published Snapshots</div>
              {renderEntries(published, "published")}
            </>
          )}

          {drafts.length > 0 && (
            <>
              <div style={sectionLabel}>Drafts (rolling 10)</div>
              {renderEntries(drafts, "draft")}
            </>
          )}
        </div>

        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--io-border)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "6px 12px",
              fontSize: "12px",
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "transparent",
              color: "var(--io-text-secondary)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
