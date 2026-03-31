import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { PaginatedResult } from "../../api/client";
import { opcCertsApi, OpcServerCert } from "../../api/opcCerts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CertInfo {
  name: string;
  subject: string;
  issuer: string;
  not_before: string;
  not_after: string;
  sans: string[];
  days_remaining: number;
  is_expired: boolean;
  file: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusColor(cert: CertInfo): string {
  if (cert.is_expired) return "var(--io-error, #ef4444)";
  if (cert.days_remaining < 30) return "var(--io-warning, #f59e0b)";
  return "var(--io-success, #22c55e)";
}

function statusLabel(cert: CertInfo): string {
  if (cert.is_expired) return "Expired";
  if (cert.days_remaining < 30) return "Expires soon";
  return "Valid";
}

// ---------------------------------------------------------------------------
// Shared inline style fragments
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--io-text-muted)",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "var(--io-radius)",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "var(--io-radius)",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface)",
  color: "var(--io-text-primary)",
  fontSize: "12px",
  fontFamily: "var(--io-font-mono, monospace)",
  resize: "vertical",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  borderRadius: "var(--io-radius)",
  border: "none",
  background: "var(--io-accent)",
  color: "#fff",
  fontSize: "13px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--io-radius)",
  border: "1px solid var(--io-border)",
  background: "transparent",
  color: "var(--io-text-secondary)",
  fontSize: "13px",
  cursor: "pointer",
};

// ---------------------------------------------------------------------------
// CertificateContextMenu — right-click context menu for certificate table rows
// ---------------------------------------------------------------------------
interface ContextMenuPos {
  x: number;
  y: number;
}

function CertificateContextMenu({
  cert,
  pos,
  onClose,
}: {
  cert: CertInfo;
  pos: ContextMenuPos;
  onClose: () => void;
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
    minWidth: "200px",
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

  const [detailOpen, setDetailOpen] = useState(false);

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

  const API_BASE = import.meta.env.VITE_API_URL ?? "";

  return (
    <>
      <div ref={ref} style={menuStyle}>
        {menuItem("View Details", () => setDetailOpen(true))}
        {menuItem("Download Certificate", () => {
          window.location.href = `${API_BASE}/api/certificates/${encodeURIComponent(cert.name)}/download`;
        })}
        {menuItem("Copy Fingerprint", () => {
          // Fingerprint: use subject as identifier since CertInfo doesn't expose fingerprint directly
          navigator.clipboard.writeText(cert.subject).catch(() => {});
        })}
      </div>
      {detailOpen && (
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
          onClick={() => setDetailOpen(false)}
        >
          <div
            style={{
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "24px",
              width: "480px",
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "80vh",
              overflowY: "auto",
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
                Certificate Details
              </h3>
              <button
                onClick={() => setDetailOpen(false)}
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
                ["Name", cert.name],
                ["Subject", cert.subject],
                ["Issuer", cert.issuer],
                ["Valid From", formatDate(cert.not_before)],
                ["Valid Until", formatDate(cert.not_after)],
                ["Status", statusLabel(cert)],
                [
                  "Days Remaining",
                  cert.is_expired ? "Expired" : `${cert.days_remaining} days`,
                ],
                ...(cert.sans.length > 0
                  ? [["SANs", cert.sans.join(", ")]]
                  : []),
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", gap: "12px" }}>
                  <dt
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      width: "120px",
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
                onClick={() => setDetailOpen(false)}
                style={cancelBtnStyle}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Upload modal
// ---------------------------------------------------------------------------

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [name, setName] = useState("");
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [error, setError] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("io_access_token");
      const API_BASE = import.meta.env.VITE_API_URL ?? "";

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append(
        "cert",
        new Blob([certPem], { type: "text/plain" }),
        "cert.pem",
      );
      formData.append(
        "key",
        new Blob([keyPem], { type: "text/plain" }),
        "key.pem",
      );

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/certificates/upload`, {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          (json as { error?: { message?: string }; message?: string })?.error
            ?.message ??
            (json as { message?: string })?.message ??
            `Upload failed (${res.status})`,
        );
      }
      return json;
    },
    onSuccess: () => {
      onUploaded();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!certPem.trim()) {
      setError("Certificate PEM is required");
      return;
    }
    if (!keyPem.trim()) {
      setError("Private Key PEM is required");
      return;
    }
    uploadMutation.mutate();
  };

  return (
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          padding: "24px",
          width: "560px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3
          style={{
            margin: "0 0 20px",
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Upload Certificate
        </h3>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--io-radius)",
              background: "var(--io-error-subtle, #fef2f2)",
              color: "var(--io-error, #ef4444)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Name *</label>
          <input
            type="text"
            placeholder="e.g. io-tls"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            style={inputStyle}
          />
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "11px",
              color: "var(--io-text-muted)",
            }}
          >
            Letters, digits, hyphens, underscores, and dots only.
          </p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Certificate PEM *</label>
          <textarea
            placeholder={
              "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            }
            value={certPem}
            onChange={(e) => {
              setCertPem(e.target.value);
              setError("");
            }}
            rows={6}
            style={textareaStyle}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={labelStyle}>Private Key PEM *</label>
          <textarea
            placeholder={
              "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
            }
            value={keyPem}
            onChange={(e) => {
              setKeyPem(e.target.value);
              setError("");
            }}
            rows={6}
            style={textareaStyle}
          />
        </div>

        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
        >
          <button onClick={onClose} style={cancelBtnStyle}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploadMutation.isPending}
            style={primaryBtnStyle}
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload Certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CertificatesPage() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    cert: CertInfo;
    pos: ContextMenuPos;
  } | null>(null);

  function handleContextMenu(e: React.MouseEvent, cert: CertInfo) {
    e.preventDefault();
    setContextMenu({ cert, pos: { x: e.clientX, y: e.clientY } });
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => api.get<PaginatedResult<CertInfo>>("/api/certificates"),
  });

  // The /api/certificates endpoint returns a PagedResponse, which client.ts unwraps
  // into { data: CertInfo[], pagination: {...} }. Guard against any non-array
  // value so .map() never throws.
  const rawData = data?.success ? data.data : null;
  const certs: CertInfo[] = Array.isArray(rawData?.data) ? rawData.data : [];

  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      api.delete(`/api/certificates/${encodeURIComponent(name)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  const handleDelete = (name: string) => {
    if (
      window.confirm(`Delete certificate "${name}"? This cannot be undone.`)
    ) {
      deleteMutation.mutate(name);
    }
  };

  const handleUploaded = () => {
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ["certificates"] });
  };

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
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
            Certificates
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Manage TLS certificates for HTTPS termination and service
            authentication.
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} style={primaryBtnStyle}>
          + Upload Certificate
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div
          style={{
            color: "var(--io-text-muted)",
            fontSize: "13px",
            marginTop: "24px",
          }}
        >
          Loading…
        </div>
      ) : isError ? (
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            borderRadius: "var(--io-radius)",
            background: "var(--io-error-subtle, #fef2f2)",
            color: "var(--io-error, #ef4444)",
            fontSize: "13px",
          }}
        >
          Failed to load certificates. Check that the api-gateway is reachable.
        </div>
      ) : certs.length === 0 ? (
        <div
          style={{
            marginTop: "24px",
            padding: "32px",
            textAlign: "center",
            border: "1px dashed var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          No certificates installed. Upload a certificate to get started.
        </div>
      ) : (
        <div
          style={{
            marginTop: "16px",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--io-surface-secondary)",
                  borderBottom: "1px solid var(--io-border)",
                }}
              >
                {[
                  "Name",
                  "Subject",
                  "Issuer",
                  "Expiry",
                  "Days Remaining",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => (
                <tr
                  key={cert.name}
                  style={{
                    borderBottom:
                      "1px solid var(--io-border-subtle, var(--io-border))",
                  }}
                  onContextMenu={(e) => handleContextMenu(e, cert)}
                >
                  {/* Name */}
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: "13px",
                      color: "var(--io-text-primary)",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cert.name}
                  </td>
                  {/* Subject */}
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: "12px",
                      color: "var(--io-text-secondary)",
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={cert.subject}
                  >
                    {cert.subject}
                  </td>
                  {/* Issuer */}
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                      maxWidth: "180px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={cert.issuer}
                  >
                    {cert.issuer}
                  </td>
                  {/* Expiry date */}
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: "12px",
                      color: "var(--io-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(cert.not_after)}
                  </td>
                  {/* Days remaining */}
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: "12px",
                      color: statusColor(cert),
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cert.is_expired ? "—" : `${cert.days_remaining}d`}
                  </td>
                  {/* Status badge */}
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "99px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: cert.is_expired
                          ? "var(--io-error-subtle, #fef2f2)"
                          : cert.days_remaining < 30
                            ? "var(--io-warning-subtle, #fffbeb)"
                            : "var(--io-success-subtle, #f0fdf4)",
                        color: statusColor(cert),
                      }}
                    >
                      {statusLabel(cert)}
                    </span>
                  </td>
                  {/* Actions */}
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDelete(cert.name)}
                      disabled={deleteMutation.isPending}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "var(--io-radius)",
                        border: "1px solid var(--io-error, #ef4444)",
                        background: "transparent",
                        color: "var(--io-error, #ef4444)",
                        fontSize: "12px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SANs detail strip */}
      {certs.some((c) => c.sans.length > 0) && (
        <div style={{ marginTop: "16px" }}>
          {certs
            .filter((c) => c.sans.length > 0)
            .map((cert) => (
              <div
                key={`${cert.name}-sans`}
                style={{
                  marginBottom: "8px",
                  padding: "10px 14px",
                  background: "var(--io-surface-secondary)",
                  borderRadius: "var(--io-radius)",
                  border: "1px solid var(--io-border-subtle, var(--io-border))",
                  fontSize: "12px",
                  color: "var(--io-text-secondary)",
                }}
              >
                <strong style={{ color: "var(--io-text-primary)" }}>
                  {cert.name}
                </strong>
                {" — SANs: "}
                {cert.sans.join(", ")}
              </div>
            ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {contextMenu && (
        <CertificateContextMenu
          cert={contextMenu.cert}
          pos={contextMenu.pos}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* OPC UA Server Certificates section */}
      <OpcServerCertsSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OPC UA Server Certificates section
// ---------------------------------------------------------------------------

const OPC_STATUS: Record<string, { bg: string; color: string; label: string }> =
  {
    trusted: { bg: "rgba(34,197,94,0.12)", color: "#22C55E", label: "Trusted" },
    pending: { bg: "rgba(234,179,8,0.12)", color: "#EAB308", label: "Pending" },
    rejected: {
      bg: "rgba(239,68,68,0.12)",
      color: "#EF4444",
      label: "Rejected",
    },
  };

function OpcServerCertsSection() {
  const queryClient = useQueryClient();

  const { data: certs, isLoading } = useQuery({
    queryKey: ["opc-server-certs"],
    queryFn: async () => {
      const result = await opcCertsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 15_000,
  });

  const mutOpts = {
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["opc-server-certs"] }),
  };
  const trustMut = useMutation({
    mutationFn: (id: string) => opcCertsApi.trust(id),
    ...mutOpts,
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => opcCertsApi.reject(id),
    ...mutOpts,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => opcCertsApi.delete(id),
    ...mutOpts,
  });
  const busy = trustMut.isPending || rejectMut.isPending || deleteMut.isPending;

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            OPC UA Server Certificates
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--io-text-muted)",
            }}
          >
            Certificates presented by OPC UA servers during connection. Trust to
            allow; reject to block. Go to <strong>OPC Sources</strong> to manage
            per-source.
          </p>
        </div>
      </div>

      {isLoading && (
        <div style={{ fontSize: 13, color: "var(--io-text-muted)" }}>
          Loading…
        </div>
      )}

      {!isLoading && (!certs || certs.length === 0) && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
            border: "1px dashed var(--io-border)",
            borderRadius: 8,
          }}
        >
          No OPC server certificates on record. They will appear here once an
          OPC source connects.
        </div>
      )}

      {certs && certs.length > 0 && (
        <div
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr style={{ background: "var(--io-surface-secondary)" }}>
                {["Source", "Subject", "Expires", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--io-text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid var(--io-border)",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {certs.map((cert: OpcServerCert) => {
                const s = OPC_STATUS[cert.status] ?? OPC_STATUS.pending;
                return (
                  <tr
                    key={cert.id}
                    style={{
                      borderBottom:
                        "1px solid var(--io-border-subtle, var(--io-border))",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "var(--io-text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {cert.source_name ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: "var(--io-text-secondary)",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cert.subject ??
                        cert.fingerprint_display.slice(0, 24) + "…"}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: cert.expired
                          ? "#EF4444"
                          : "var(--io-text-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(cert.not_after)}
                      {cert.expired ? " ⚠" : ""}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 99,
                          background: s.bg,
                          color: s.color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {cert.status !== "trusted" && (
                          <button
                            disabled={busy}
                            onClick={() => trustMut.mutate(cert.id)}
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              borderRadius: 5,
                              border: "none",
                              background: "var(--io-accent)",
                              color: "#fff",
                              cursor: "pointer",
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            Trust
                          </button>
                        )}
                        {cert.status !== "rejected" && (
                          <button
                            disabled={busy}
                            onClick={() => rejectMut.mutate(cert.id)}
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              borderRadius: 5,
                              border: "none",
                              background: "#EF4444",
                              color: "#fff",
                              cursor: "pointer",
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            Reject
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => deleteMut.mutate(cert.id)}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            borderRadius: 5,
                            border: "1px solid var(--io-border)",
                            background: "transparent",
                            color: "var(--io-text-secondary)",
                            cursor: "pointer",
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
