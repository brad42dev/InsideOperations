import React, { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recognitionApi, type ModelInfo } from "../../api/recognition";
import { api } from "../../api/client";
import { showToast } from "../../shared/components/Toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: active
          ? "var(--io-success-subtle)"
          : "var(--io-surface-tertiary)",
        color: active ? "var(--io-success)" : "var(--io-text-muted)",
      }}
    >
      {label}
    </span>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--io-surface)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius-lg)",
        marginBottom: "24px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--io-border)",
          fontWeight: 600,
          fontSize: "14px",
          color: "var(--io-text-primary)",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecognitionModelContextMenu — right-click context menu for model table rows
// ---------------------------------------------------------------------------
interface ContextMenuPos {
  x: number;
  y: number;
}

function RecognitionModelContextMenu({
  model,
  pos,
  onClose,
  onViewDetails,
  onSetActive,
  onViewFeedback,
}: {
  model: ModelInfo;
  pos: ContextMenuPos;
  onClose: () => void;
  onViewDetails: (m: ModelInfo) => void;
  onSetActive: (m: ModelInfo) => void;
  onViewFeedback: (m: ModelInfo) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: pos.y,
    left: pos.x,
    zIndex: 500,
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    minWidth: "190px",
    overflow: "hidden",
    padding: "4px 0",
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "7px 14px",
    background: "transparent",
    border: "none",
    textAlign: "left",
    fontSize: "13px",
    color: "var(--io-text-secondary)",
    cursor: "pointer",
  };

  const disabledItemStyle: React.CSSProperties = {
    ...itemStyle,
    color: "var(--io-text-muted)",
    cursor: "not-allowed",
    opacity: 0.55,
  };

  function menuItem(label: string, action: () => void) {
    return (
      <button
        style={itemStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--io-surface-secondary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "transparent";
        }}
        onClick={() => {
          action();
          onClose();
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div ref={ref} style={menuStyle}>
      {menuItem("View Details", () => onViewDetails(model))}
      {model.loaded ? (
        <button
          style={disabledItemStyle}
          title="This model is already active"
          disabled
        >
          Set as Active
        </button>
      ) : (
        menuItem("Set as Active", () => onSetActive(model))
      )}
      {menuItem("View Feedback History", () => onViewFeedback(model))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service Status Card
// ---------------------------------------------------------------------------

function ServiceStatusCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recognition", "status"],
    queryFn: async () => {
      const r = await recognitionApi.getStatus();
      if (!r.success) throw new Error(r.error.message);
      return r.data;
    },
    refetchInterval: 10_000,
  });

  return (
    <SectionCard title="Service Status">
      {isLoading && (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading status…
        </p>
      )}
      {isError && (
        <p style={{ color: "var(--io-danger)", fontSize: "13px" }}>
          Could not reach recognition service.
        </p>
      )}
      {data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "16px",
          }}
        >
          <StatItem
            label="P&ID Model"
            value={data.domains.pid.model_loaded ? "Loaded" : "Not Loaded"}
            subtext={`mode: ${data.domains.pid.mode} · hw: ${data.domains.pid.hardware}`}
          />
          <StatItem
            label="DCS Model"
            value={data.domains.dcs.model_loaded ? "Loaded" : "Not Loaded"}
            subtext={`mode: ${data.domains.dcs.mode} · hw: ${data.domains.dcs.hardware}`}
          />
        </div>
      )}
    </SectionCard>
  );
}

function StatItem({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--io-text-muted)",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--io-text-primary)",
        }}
      >
        {value}
      </div>
      {subtext && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            marginTop: "2px",
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Models Table
// ---------------------------------------------------------------------------

function ModelsSection() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    model: ModelInfo;
    pos: ContextMenuPos;
  } | null>(null);
  const [detailModel, setDetailModel] = useState<ModelInfo | null>(null);

  function handleContextMenu(e: React.MouseEvent, model: ModelInfo) {
    e.preventDefault();
    setContextMenu({ model, pos: { x: e.clientX, y: e.clientY } });
  }

  const { data: models, isLoading } = useQuery({
    queryKey: ["recognition", "models"],
    queryFn: async () => {
      const r = await recognitionApi.listModels();
      if (!r.success) throw new Error(r.error.message);
      return r.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recognitionApi.deleteModel(id),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: result.error.message, variant: "error" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["recognition", "models"] });
      qc.invalidateQueries({ queryKey: ["recognition", "status"] });
      showToast({ title: "Model removed", variant: "success" });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ activated: boolean }>(
        `/api/recognition/models/${id}/activate`,
        {},
      ),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: result.error.message, variant: "error" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["recognition", "models"] });
      qc.invalidateQueries({ queryKey: ["recognition", "status"] });
      showToast({ title: "Model set as active", variant: "success" });
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await recognitionApi.uploadModel(file);
      if (result.success) {
        qc.invalidateQueries({ queryKey: ["recognition", "models"] });
        qc.invalidateQueries({ queryKey: ["recognition", "status"] });
        const uploadedDomain = result.data?.domain?.toUpperCase() ?? "model";
        showToast({
          title: `Uploaded ${uploadedDomain} model v${result.data?.version ?? "?"} (${file.name})`,
          variant: "success",
        });
      } else {
        showToast({ title: result.error.message, variant: "error" });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <SectionCard title="Loaded Models">
      {/* Upload controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--io-radius)",
            border: "1px solid var(--io-border)",
            background: "var(--io-accent)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Upload .iomodel"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".iomodel"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          Upload a .iomodel package from SymBA — domain is auto-detected from
          the manifest
        </span>
      </div>

      {/* Models table */}
      {isLoading && (
        <p style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          Loading…
        </p>
      )}
      {!isLoading && (!models || models.length === 0) && (
        <p style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          No models uploaded. Upload a .iomodel file to get started.
        </p>
      )}
      {models && models.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr>
                {[
                  "Domain",
                  "Filename",
                  "Version",
                  "Classes",
                  "Size",
                  "Loaded",
                  "Uploaded",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "6px 12px",
                      borderBottom: "1px solid var(--io-border)",
                      color: "var(--io-text-muted)",
                      fontWeight: 600,
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.map((m: ModelInfo) => (
                <tr
                  key={m.id}
                  style={{ borderBottom: "1px solid var(--io-border-subtle)" }}
                  onContextMenu={(e) => handleContextMenu(e, m)}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                    }}
                  >
                    {m.domain.toUpperCase()}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      color: "var(--io-text-secondary)",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    {m.filename}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {m.version}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {m.class_count}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      color: "var(--io-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatBytes(m.file_size_bytes)}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <StatusPill
                      active={m.loaded}
                      label={m.loaded ? "Yes" : "No"}
                    />
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      color: "var(--io-text-muted)",
                      whiteSpace: "nowrap",
                      fontSize: "12px",
                    }}
                  >
                    {new Date(m.uploaded_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <button
                      onClick={() => deleteMutation.mutate(m.id)}
                      disabled={deleteMutation.isPending}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "var(--io-radius)",
                        border: "1px solid var(--io-danger)",
                        background: "transparent",
                        color: "var(--io-danger)",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contextMenu && (
        <RecognitionModelContextMenu
          model={contextMenu.model}
          pos={contextMenu.pos}
          onClose={() => setContextMenu(null)}
          onViewDetails={(m) => {
            setDetailModel(m);
          }}
          onSetActive={(m) => {
            setActiveMutation.mutate(m.id);
          }}
          onViewFeedback={(_m) => {
            window.location.href = "/settings/recognition";
          }}
        />
      )}

      {detailModel && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setDetailModel(null)}
        >
          <div
            style={{
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "24px",
              width: "420px",
              maxWidth: "calc(100vw - 32px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                }}
              >
                Model Details
              </h3>
              <button
                onClick={() => setDetailModel(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </div>
            <dl
              style={{
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {[
                ["Domain", detailModel.domain.toUpperCase()],
                ["Version", detailModel.version],
                ["Filename", detailModel.filename],
                ["Classes", String(detailModel.class_count)],
                [
                  "Size",
                  `${(detailModel.file_size_bytes / 1024 / 1024).toFixed(1)} MB`,
                ],
                ["Status", detailModel.loaded ? "Active" : "Inactive"],
                [
                  "Uploaded",
                  new Date(detailModel.uploaded_at).toLocaleString(),
                ],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", gap: "12px" }}>
                  <dt
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      width: "100px",
                      flexShrink: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {label}
                  </dt>
                  <dd
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "var(--io-text-primary)",
                      wordBreak: "break-all",
                    }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button
                onClick={() => setDetailModel(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--io-radius)",
                  border: "1px solid var(--io-border)",
                  background: "transparent",
                  color: "var(--io-text-secondary)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Gap Reports Section
// ---------------------------------------------------------------------------

function GapReportsSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastImported, setLastImported] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await recognitionApi.uploadGapReport(file);
      if (result.success) {
        setLastImported(result.data.filename);
        showToast({
          title: `Gap report "${result.data.filename}" imported`,
          variant: "success",
        });
      } else {
        showToast({ title: result.error.message, variant: "error" });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <SectionCard title="Gap Reports">
      <p
        style={{
          fontSize: "13px",
          color: "var(--io-text-secondary)",
          marginBottom: "16px",
        }}
      >
        Import .iogap files generated by SymBA to track unrecognised symbols and
        gaps in the P&ID or DCS model coverage.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "6px 14px",
            borderRadius: "var(--io-radius)",
            border: "1px solid var(--io-border)",
            background: "var(--io-accent)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Importing…" : "Import .iogap"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".iogap"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        {lastImported && (
          <span style={{ fontSize: "12px", color: "var(--io-success)" }}>
            Last imported: {lastImported}
          </span>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecognitionPage() {
  return (
    <div>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--io-text-primary)",
          marginBottom: "4px",
        }}
      >
        Recognition
      </h1>
      <p
        style={{
          fontSize: "13px",
          color: "var(--io-text-muted)",
          marginBottom: "24px",
        }}
      >
        Manage P&ID and DCS symbol recognition models and gap reports. Full ONNX
        inference is enabled when .iomodel packages are loaded.
      </p>

      <ServiceStatusCard />
      <ModelsSection />
      <GapReportsSection />
    </div>
  );
}
