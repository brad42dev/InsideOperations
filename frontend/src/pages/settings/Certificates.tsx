import React, { useState } from "react";
import ContextMenu from "../../shared/components/ContextMenu";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getStoredToken } from "../../api/client";
import type { PaginatedResult } from "../../api/client";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
} from "./settingsStyles";
import { opcCertsApi, OpcServerCert } from "../../api/opcCerts";
import SettingsPageLayout from "./SettingsPageLayout";
import { SettingsTabs } from "../../shared/components/SettingsTabs";

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

interface HSTSConfig {
  enabled: boolean;
  max_age: number;
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
  if (cert.is_expired) return "var(--io-danger)";
  if (cert.days_remaining < 30) return "var(--io-warning)";
  return "var(--io-success)";
}

function statusLabel(cert: CertInfo): string {
  if (cert.is_expired) return "Expired";
  if (cert.days_remaining < 30) return "Expires soon";
  return "Valid";
}

// ---------------------------------------------------------------------------
// Shared inline style fragments
// ---------------------------------------------------------------------------

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

const KEY_TYPES = [
  { value: "rsa4096", label: "RSA 4096-bit (recommended)" },
  { value: "rsa2048", label: "RSA 2048-bit" },
  { value: "ecdsa_p256", label: "ECDSA P-256" },
  { value: "ecdsa_p384", label: "ECDSA P-384" },
];

// ---------------------------------------------------------------------------
// Guide panel component
// ---------------------------------------------------------------------------

interface GuideStep {
  title: string;
  detail?: string;
}

interface GuidePanelProps {
  title: string;
  steps: GuideStep[];
  note?: string;
}

function GuidePanel({ title, steps, note }: GuidePanelProps) {
  return (
    <div
      style={{
        background: "var(--io-surface-secondary)",
        border: "1px solid var(--io-border)",
        borderLeft: "3px solid var(--io-accent)",
        borderRadius: "var(--io-radius)",
        padding: "18px 16px",
        overflowY: "auto",
        maxHeight: "calc(90vh - 280px)",
        minHeight: "200px",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--io-accent)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: "6px",
        }}
      >
        Setup Guide
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
          marginBottom: "16px",
          lineHeight: 1.35,
        }}
      >
        {title}
      </div>
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {steps.map((step, i) => (
          <li
            key={i}
            style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: "var(--io-accent)",
                color: "white",
                fontSize: "11px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              {i + 1}
            </span>
            <div>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-primary)",
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {step.title}
              </span>
              {step.detail && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                    marginTop: "3px",
                    lineHeight: 1.45,
                  }}
                >
                  {step.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {note && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 12px",
            background:
              "color-mix(in srgb, var(--io-warning) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--io-warning) 30%, transparent)",
            borderRadius: "var(--io-radius)",
            fontSize: "11px",
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guide panel toggle button (shared pattern with SMS/Auth providers)
// ---------------------------------------------------------------------------

function GuidePanelToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      style={{
        background: show
          ? "var(--io-accent)"
          : "color-mix(in srgb, var(--io-accent) 15%, transparent)",
        border: "1px solid var(--io-accent)",
        borderRadius: "var(--io-radius)",
        padding: "5px 14px",
        cursor: "pointer",
        color: show ? "white" : "var(--io-accent)",
        fontSize: "13px",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        whiteSpace: "nowrap",
      }}
      onClick={onToggle}
    >
      <span style={{ fontSize: "15px", lineHeight: 1, fontWeight: 800 }}>
        ?
      </span>
      {show ? "Hide Guide" : "Setup Guide"}
    </button>
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
      const token = getStoredToken();
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
        background: "var(--io-modal-backdrop)",
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-cert-title"
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
          id="upload-cert-title"
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
              background: "var(--io-danger-subtle)",
              color: "var(--io-danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label htmlFor="upload-cert-name" style={labelStyle}>
            Name *
          </label>
          <input
            id="upload-cert-name"
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
          <label htmlFor="upload-cert-pem" style={labelStyle}>
            Certificate PEM *
          </label>
          <textarea
            id="upload-cert-pem"
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
          <label htmlFor="upload-cert-key" style={labelStyle}>
            Private Key PEM *
          </label>
          <textarea
            id="upload-cert-key"
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
          <button onClick={onClose} style={btnSecondary}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploadMutation.isPending}
            style={btnPrimary}
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload Certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Installed Certificates tab
// ---------------------------------------------------------------------------

function InstalledTab() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const {
    menuState: certMenu,
    handleContextMenu: openCertMenu,
    closeMenu: closeCertMenu,
  } = useContextMenu<CertInfo>();
  const [certDetail, setCertDetail] = useState<CertInfo | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => api.get<PaginatedResult<CertInfo>>("/api/certificates"),
  });

  const rawData = data?.success ? data.data : null;
  const certs: CertInfo[] = Array.isArray(rawData?.data) ? rawData.data : [];

  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      api.delete(`/api/certificates/${encodeURIComponent(name)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  const handleUploaded = () => {
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ["certificates"] });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button onClick={() => setShowUpload(true)} style={btnPrimary}>
          + Upload Certificate
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading…
        </div>
      ) : isError ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "var(--io-radius)",
            background: "var(--io-danger-subtle)",
            color: "var(--io-danger)",
            fontSize: "13px",
          }}
        >
          Failed to load certificates. Check that the api-gateway is reachable.
        </div>
      ) : certs.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            border: "1px dashed var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          No certificates installed. Upload a certificate or use the Provision
          tab to generate one.
        </div>
      ) : (
        <div
          style={{
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
                  onContextMenu={(e) => openCertMenu(e, cert)}
                >
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
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: "12px",
                      color: statusColor(cert),
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cert.is_expired ? "Expired" : `${cert.days_remaining}d`}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "99px",
                        background: `color-mix(in srgb, ${statusColor(cert)} 12%, transparent)`,
                        color: statusColor(cert),
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {statusLabel(cert)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => setCertDetail(cert)}
                      style={{
                        ...btnSecondary,
                        padding: "4px 10px",
                        fontSize: "12px",
                        marginRight: "6px",
                      }}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(cert.name)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        borderRadius: "var(--io-radius)",
                        border: "1px solid var(--io-danger)",
                        background: "transparent",
                        color: "var(--io-danger)",
                        cursor: "pointer",
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
                  border:
                    "1px solid var(--io-border-subtle, var(--io-border))",
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

      <OpcServerCertsSection />

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {certMenu && (
        <ContextMenu
          x={certMenu.x}
          y={certMenu.y}
          items={[
            {
              label: "View Details",
              onClick: () => setCertDetail(certMenu.data!),
            },
            {
              label: "Download Certificate",
              onClick: () => {
                const base = import.meta.env.VITE_API_URL ?? "";
                window.location.href = `${base}/api/certificates/${encodeURIComponent(certMenu.data!.name)}/download`;
              },
            },
            {
              label: "Copy Fingerprint",
              onClick: () => {
                navigator.clipboard
                  .writeText(certMenu.data!.subject)
                  .catch(() => {});
              },
            },
          ]}
          onClose={closeCertMenu}
        />
      )}

      {certDetail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-modal-backdrop)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setCertDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cert-detail-title"
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
                id="cert-detail-title"
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
                aria-label="Close"
                onClick={() => setCertDetail(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                }}
              >
                ×
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
                ["Name", certDetail.name],
                ["Subject", certDetail.subject],
                ["Issuer", certDetail.issuer],
                ["Valid From", formatDate(certDetail.not_before)],
                ["Valid Until", formatDate(certDetail.not_after)],
                ["Status", statusLabel(certDetail)],
                [
                  "Days Remaining",
                  certDetail.is_expired
                    ? "Expired"
                    : `${certDetail.days_remaining} days`,
                ],
                ...(certDetail.sans.length > 0
                  ? [["SANs", certDetail.sans.join(", ")]]
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
              <button onClick={() => setCertDetail(null)} style={btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        title="Delete Certificate"
        description={
          deleteConfirm
            ? `Delete certificate "${deleteConfirm}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provision tab — Let's Encrypt / ACME
// ---------------------------------------------------------------------------

const ACME_HTTP01_GUIDE: GuidePanelProps = {
  title: "Issue a Let's Encrypt certificate using HTTP-01 challenge",
  steps: [
    {
      title: "Ensure port 80 is reachable from the internet",
      detail:
        "Let's Encrypt must be able to make an HTTP request to your server on port 80. Check that your firewall and router allow inbound connections on port 80 to this machine.",
    },
    {
      title: "Enter the hostname exactly as it appears in DNS",
      detail:
        "The hostname must resolve to this server's public IP address. Wildcards (*.example.com) require DNS-01 challenge instead.",
    },
    {
      title: "Enter your email address",
      detail:
        "Let's Encrypt sends renewal reminders and expiry warnings to this address. It is not shown publicly.",
    },
    {
      title: "Click Issue Certificate",
      detail:
        "I/O places a temporary validation token at /.well-known/acme-challenge/… on port 80, Let's Encrypt verifies it, and the certificate is issued and installed automatically.",
    },
    {
      title: "Auto-renewal is enabled automatically",
      detail:
        "I/O checks on the schedule you configure in Renewal Settings below and renews when the certificate is within the configured threshold (default: 30 days). Let's Encrypt plans to shorten certificate lifetimes — see Renewal Settings to tune the threshold and check frequency accordingly. Renewal reloads nginx with zero downtime.",
    },
  ],
};

const ACME_DNS01_MANUAL_GUIDE: GuidePanelProps = {
  title: "Issue a Let's Encrypt certificate using DNS-01 challenge (manual)",
  steps: [
    {
      title: "Enter your hostname and email",
      detail:
        "The hostname can be a wildcard (*.example.com) or a specific hostname. DNS-01 works even when port 80 is not accessible from the internet.",
    },
    {
      title: "Click Generate Challenge",
      detail:
        "I/O will display the exact TXT record name and value you need to add to your DNS zone.",
    },
    {
      title: "Add the TXT record to your DNS provider",
      detail:
        'Log in to your DNS provider and create a TXT record named _acme-challenge.<yourdomain> with the displayed value. Allow a few minutes for DNS propagation.',
    },
    {
      title: "Click Verify & Issue",
      detail:
        "I/O asks Let's Encrypt to check the TXT record. If found, the certificate is issued and installed. The TXT record can be removed after issuance.",
    },
    {
      title: "Auto-renewal will prompt you for a new DNS record",
      detail:
        "Because DNS-01 manual requires your action, renewal requires repeating steps 2–4. Consider switching to DNS-01 automatic if your DNS provider has an API.",
    },
  ],
};

const ACME_DNS01_AUTO_GUIDE: GuidePanelProps = {
  title: "Issue a Let's Encrypt certificate using DNS-01 challenge (automatic)",
  steps: [
    {
      title: "Obtain API credentials from your DNS provider",
      detail:
        "Supported providers: Cloudflare (API Token), AWS Route 53 (Access Key + Secret), Azure DNS (Service Principal), Namecheap, GoDaddy, and others. Create a credential scoped to DNS record management only.",
    },
    {
      title: "Select your DNS provider and enter credentials",
      detail:
        "Credentials are encrypted at rest and used only for the _acme-challenge TXT record lifecycle. They are never exposed via the API.",
    },
    {
      title: "Enter your hostname and email, then click Issue Certificate",
      detail:
        "I/O creates the TXT record automatically, waits for propagation, asks Let's Encrypt to verify, and issues the certificate.",
    },
    {
      title: "Auto-renewal runs unattended",
      detail:
        "When the certificate is within the renewal threshold (configured in Renewal Settings below), I/O creates a new challenge record, renews, then removes the old record. No action required. Adjust the threshold and check frequency in Renewal Settings to handle shorter-lived certificates as Let's Encrypt shortens lifetimes.",
    },
  ],
};

type AcmeChallengeType = "http01" | "dns01_manual" | "dns01_auto";

interface AcmeRenewalConfig {
  renewal_days_before_expiry: number;
  check_interval_hours: number;
  notify_email: string;
}

interface PendingAcmeChallenge {
  hostname: string;
  record_name: string;
  record_value: string;
  created_at: string;
}

function AcmeSection() {
  const queryClient = useQueryClient();
  const [showGuide, setShowGuide] = useState(false);
  const [challengeType, setChallengeType] =
    useState<AcmeChallengeType>("http01");
  const [hostname, setHostname] = useState("");
  const [email, setEmail] = useState("");
  const [dnsProvider, setDnsProvider] = useState("cloudflare");
  const [dnsApiToken, setDnsApiToken] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Load any persisted pending DNS-01 challenge from the server.
  // This survives navigation — the user can leave, wait for DNS propagation,
  // return, and the challenge record is still displayed.
  const { data: pendingChallengeData } = useQuery({
    queryKey: ["acme-pending-challenge"],
    queryFn: async () => {
      const res = await api.get<PendingAcmeChallenge | null>(
        "/api/certificates/acme/pending-challenge",
      );
      return res.success ? res.data : null;
    },
    staleTime: 30_000,
  });
  const pendingChallenge = pendingChallengeData ?? null;

  const guide =
    challengeType === "http01"
      ? ACME_HTTP01_GUIDE
      : challengeType === "dns01_manual"
        ? ACME_DNS01_MANUAL_GUIDE
        : ACME_DNS01_AUTO_GUIDE;

  const issueMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ challenge?: PendingAcmeChallenge; issued?: boolean; message?: string }>(
        "/api/certificates/acme/issue",
        {
          hostname: hostname.trim(),
          email: email.trim(),
          challenge_type: challengeType,
          ...(challengeType === "dns01_auto" && {
            dns_provider: dnsProvider,
            dns_api_token: dnsApiToken,
          }),
        },
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      if (challengeType === "dns01_manual" && data.challenge) {
        // Challenge is persisted server-side; invalidate query to display it.
        queryClient.invalidateQueries({ queryKey: ["acme-pending-challenge"] });
        setResult(null);
        // Pre-fill hostname from the challenge so Verify knows which domain
        setHostname(data.challenge.hostname);
      } else {
        setResult({ ok: true, message: "Certificate issued and installed successfully." });
        queryClient.invalidateQueries({ queryKey: ["acme-pending-challenge"] });
        queryClient.invalidateQueries({ queryKey: ["certificates"] });
      }
    },
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });

  const verifyMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ message?: string }>(
        "/api/certificates/acme/verify",
        // Use hostname from the persisted challenge if available, otherwise
        // fall back to the form field.
        { hostname: pendingChallenge?.hostname ?? hostname.trim() },
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      setResult({ ok: true, message: "Certificate issued and installed successfully." });
      queryClient.invalidateQueries({ queryKey: ["acme-pending-challenge"] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });

  const cancelChallengeMut = useMutation({
    mutationFn: async () => {
      const res = await api.delete("/api/certificates/acme/pending-challenge");
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["acme-pending-challenge"] });
      setResult(null);
    },
  });

  return (
    <div
      style={{
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "var(--io-surface-secondary)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Let's Encrypt (ACME)
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginTop: "2px",
            }}
          >
            Free, trusted TLS certificates from Let's Encrypt with automatic
            renewal. Best for internet-facing servers.
          </div>
        </div>
        <GuidePanelToggle
          show={showGuide}
          onToggle={() => setShowGuide((v) => !v)}
        />
      </div>

      {/* Form + optional guide */}
      <div
        style={{
          padding: "20px",
          display: "grid",
          gridTemplateColumns: showGuide ? "1fr 360px" : "1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* LEFT: form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {result && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--io-radius)",
                background: result.ok
                  ? "color-mix(in srgb, var(--io-success) 12%, transparent)"
                  : "var(--io-danger-subtle)",
                color: result.ok ? "var(--io-success)" : "var(--io-danger)",
                fontSize: "13px",
              }}
            >
              {result.message}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label style={labelStyle}>Hostname *</label>
              <input
                style={inputStyle}
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="io.example.com"
              />
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                }}
              >
                Must resolve to this server's public IP. For DNS-01, wildcards
                (*.example.com) are supported.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Contact Email *</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                }}
              >
                Let's Encrypt sends renewal reminders here.
              </p>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Challenge Type</label>
            <select
              style={inputStyle}
              value={challengeType}
              onChange={(e) => {
                setChallengeType(e.target.value as AcmeChallengeType);
                setShowGuide(true);
                setResult(null);
              }}
            >
              <option value="http01">
                HTTP-01 — Port 80 validation (simplest, internet-facing)
              </option>
              <option value="dns01_manual">
                DNS-01 Manual — Add a TXT record yourself (works behind
                firewalls)
              </option>
              <option value="dns01_auto">
                DNS-01 Automatic — Provide DNS API credentials for hands-free
                renewal
              </option>
            </select>
          </div>

          {challengeType === "dns01_auto" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "14px",
              }}
            >
              <div>
                <label style={labelStyle}>DNS Provider</label>
                <select
                  style={inputStyle}
                  value={dnsProvider}
                  onChange={(e) => setDnsProvider(e.target.value)}
                >
                  <option value="cloudflare">Cloudflare</option>
                  <option value="route53">AWS Route 53</option>
                  <option value="azure">Azure DNS</option>
                  <option value="namecheap">Namecheap</option>
                  <option value="godaddy">GoDaddy</option>
                  <option value="digitalocean">DigitalOcean</option>
                  <option value="other">Other / Generic</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>API Token / Credentials</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={dnsApiToken}
                  onChange={(e) => setDnsApiToken(e.target.value)}
                  placeholder="API token or access key"
                  autoComplete="off"
                />
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                  }}
                >
                  Stored encrypted. Used only for{" "}
                  <code style={{ fontFamily: "monospace" }}>
                    _acme-challenge
                  </code>{" "}
                  TXT record management.
                </p>
              </div>
            </div>
          )}

          {/* DNS-01 manual: persisted pending challenge display.
              This is loaded from the server so it survives navigation —
              the user can leave, wait for DNS propagation, return, and
              still see the challenge record and Verify button. */}
          {pendingChallenge && (
            <div
              style={{
                padding: "16px",
                background: "var(--io-surface-secondary)",
                border:
                  "1px solid color-mix(in srgb, var(--io-warning) 40%, transparent)",
                borderRadius: "var(--io-radius)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                  gap: "12px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                    }}
                  >
                    Pending DNS-01 challenge for{" "}
                    <code style={{ fontFamily: "monospace" }}>
                      {pendingChallenge.hostname}
                    </code>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--io-text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    Challenge created{" "}
                    {new Date(pendingChallenge.created_at).toLocaleString()}.
                    Add the TXT record below to your DNS provider, allow a few
                    minutes for propagation, then click Verify &amp; Issue.
                    This page can be safely closed and revisited — the challenge
                    is preserved.
                  </div>
                </div>
                <button
                  onClick={() => cancelChallengeMut.mutate()}
                  disabled={cancelChallengeMut.isPending}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    padding: "4px 10px",
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Cancel
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "8px 12px",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "var(--io-text-muted)", fontWeight: 600 }}>
                  Record Name
                </span>
                <code
                  style={{
                    fontFamily: "monospace",
                    color: "var(--io-text-primary)",
                    wordBreak: "break-all",
                  }}
                >
                  {pendingChallenge.record_name}
                </code>
                <span style={{ color: "var(--io-text-muted)", fontWeight: 600 }}>
                  Record Type
                </span>
                <code style={{ fontFamily: "monospace" }}>TXT</code>
                <span style={{ color: "var(--io-text-muted)", fontWeight: 600 }}>
                  Record Value
                </span>
                <code
                  style={{
                    fontFamily: "monospace",
                    color: "var(--io-text-primary)",
                    wordBreak: "break-all",
                  }}
                >
                  {pendingChallenge.record_value}
                </code>
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "10px" }}>
                <button
                  onClick={() =>
                    navigator.clipboard
                      .writeText(pendingChallenge.record_value)
                      .catch(() => {})
                  }
                  style={{
                    ...btnSecondary,
                    fontSize: "12px",
                    padding: "5px 12px",
                  }}
                >
                  Copy Value
                </button>
                <button
                  onClick={() => verifyMut.mutate()}
                  disabled={verifyMut.isPending}
                  style={{
                    ...btnPrimary,
                    fontSize: "12px",
                    padding: "5px 14px",
                  }}
                >
                  {verifyMut.isPending
                    ? "Verifying…"
                    : "Verify & Issue Certificate"}
                </button>
              </div>
            </div>
          )}

          {(!pendingChallenge || challengeType !== "dns01_manual") && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => issueMut.mutate()}
                disabled={issueMut.isPending || !hostname.trim() || !email.trim()}
                style={btnPrimary}
              >
                {issueMut.isPending
                  ? "Issuing…"
                  : challengeType === "dns01_manual"
                    ? "Generate Challenge"
                    : "Issue Certificate"}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: guide panel */}
        {showGuide && (
          <GuidePanel
            title={guide.title}
            steps={guide.steps}
            note={guide.note}
          />
        )}
      </div>

      {/* Renewal Configuration — always visible, independent of challenge type */}
      <AcmeRenewalSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACME Renewal Configuration
// ---------------------------------------------------------------------------

function AcmeRenewalSection() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AcmeRenewalConfig>({
    renewal_days_before_expiry: 30,
    check_interval_hours: 12,
    notify_email: "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useQuery({
    queryKey: ["acme-renewal-config"],
    queryFn: async () => {
      const res = await api.get<AcmeRenewalConfig>(
        "/api/certificates/acme/renewal-config",
      );
      if (res.success && res.data) {
        setConfig(res.data);
      }
      return res;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await api.put<AcmeRenewalConfig>(
        "/api/certificates/acme/renewal-config",
        config,
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      setSaved(true);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["acme-renewal-config"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div
      style={{
        borderTop: "1px solid var(--io-border)",
        padding: "20px",
        background: "var(--io-surface-secondary)",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
          marginBottom: "4px",
        }}
      >
        Automatic Renewal Settings
      </div>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: "12px",
          color: "var(--io-text-muted)",
          lineHeight: 1.5,
        }}
      >
        Controls when I/O attempts to renew Let's Encrypt certificates before
        they expire. Let's Encrypt currently issues 90-day certificates, but has
        announced a transition toward shorter lifetimes (potentially 6 days).
        Set the renewal threshold to suit your certificate lifetime — a value of
        roughly one-third the lifetime is a safe starting point.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "14px",
          alignItems: "start",
        }}
      >
        <div>
          <label style={labelStyle}>Renew when expiry is within (days)</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={89}
            value={config.renewal_days_before_expiry}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                renewal_days_before_expiry: parseInt(e.target.value, 10) || 30,
              }))
            }
          />
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "11px",
              color: "var(--io-text-muted)",
            }}
          >
            Default: 30 days. For 6-day certificates, use 2–3 days.
          </p>
        </div>
        <div>
          <label style={labelStyle}>Check frequency (hours)</label>
          <select
            style={inputStyle}
            value={config.check_interval_hours}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                check_interval_hours: parseInt(e.target.value, 10),
              }))
            }
          >
            <option value={1}>Every hour</option>
            <option value={2}>Every 2 hours</option>
            <option value={6}>Every 6 hours</option>
            <option value={12}>Twice daily (default)</option>
            <option value={24}>Once daily</option>
          </select>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "11px",
              color: "var(--io-text-muted)",
            }}
          >
            For short-lived certs (&lt;30 days), use hourly checks.
          </p>
        </div>
        <div>
          <label style={labelStyle}>Renewal failure notification email</label>
          <input
            style={inputStyle}
            type="email"
            value={config.notify_email}
            onChange={(e) =>
              setConfig((c) => ({ ...c, notify_email: e.target.value }))
            }
            placeholder="admin@example.com (optional)"
          />
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "11px",
              color: "var(--io-text-muted)",
            }}
          >
            Notified if automatic renewal fails. Leave blank to use the contact
            email from the ACME configuration above.
          </p>
        </div>
      </div>

      <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          style={{ ...btnPrimary, fontSize: "13px", padding: "7px 16px" }}
        >
          {saveMut.isPending ? "Saving…" : "Save Renewal Settings"}
        </button>
        {(saved || error) && (
          <span
            style={{
              fontSize: "13px",
              color: error ? "var(--io-danger)" : "var(--io-success)",
            }}
          >
            {error || "Saved."}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provision tab — Self-Signed generation
// ---------------------------------------------------------------------------

const SELF_SIGNED_GUIDE: GuidePanelProps = {
  title: "Generate a self-signed certificate",
  steps: [
    {
      title: "Enter a hostname as the Common Name (CN)",
      detail:
        "This should match the hostname you use to access I/O. Multiple hostnames and IP addresses can be added as Subject Alternative Names (SANs).",
    },
    {
      title: "Add Subject Alternative Names (SANs)",
      detail:
        "Browsers require at least one SAN. Add all hostnames and IP addresses this server is reachable at — for example: io.local, 192.168.1.100. One per line.",
    },
    {
      title: "Choose a key type",
      detail:
        "RSA 4096 is the most compatible. ECDSA P-256 is smaller and faster, supported by all modern browsers and OPC UA clients.",
    },
    {
      title: "Click Generate",
      detail:
        "The private key is generated server-side and never leaves the server. The certificate is immediately installed and active.",
    },
  ],
  note: "Self-signed certificates will show a browser security warning because they are not issued by a trusted CA. Use for internal networks, testing, or as a temporary certificate until you configure Let's Encrypt or import a CA-signed certificate.",
};

function SelfSignedSection() {
  const queryClient = useQueryClient();
  const [showGuide, setShowGuide] = useState(false);
  const [cn, setCn] = useState("");
  const [sans, setSans] = useState("");
  const [org, setOrg] = useState("");
  const [keyType, setKeyType] = useState("rsa4096");
  const [validDays, setValidDays] = useState("825");
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const genMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ name: string }>("/api/certificates/self-signed/generate", {
        common_name: cn.trim(),
        sans: sans
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        organization: org.trim() || undefined,
        key_type: keyType,
        valid_days: parseInt(validDays, 10) || 825,
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      setResult({
        ok: true,
        message: `Self-signed certificate "${data.name}" generated and installed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });

  return (
    <div
      style={{
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "var(--io-surface-secondary)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Generate Self-Signed Certificate
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginTop: "2px",
            }}
          >
            Instant certificate generation for testing and internal use. No CA
            required. Browsers will show a security warning.
          </div>
        </div>
        <GuidePanelToggle
          show={showGuide}
          onToggle={() => setShowGuide((v) => !v)}
        />
      </div>

      <div
        style={{
          padding: "20px",
          display: "grid",
          gridTemplateColumns: showGuide ? "1fr 360px" : "1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {result && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--io-radius)",
                background: result.ok
                  ? "color-mix(in srgb, var(--io-success) 12%, transparent)"
                  : "var(--io-danger-subtle)",
                color: result.ok ? "var(--io-success)" : "var(--io-danger)",
                fontSize: "13px",
              }}
            >
              {result.message}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label style={labelStyle}>Common Name (CN) *</label>
              <input
                style={inputStyle}
                value={cn}
                onChange={(e) => setCn(e.target.value)}
                placeholder="io.example.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Organization (O)</label>
              <input
                style={inputStyle}
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Acme Corp (optional)"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subject Alternative Names (SANs)</label>
            <textarea
              style={{ ...textareaStyle, fontFamily: "var(--io-font-mono, monospace)" }}
              value={sans}
              onChange={(e) => setSans(e.target.value)}
              rows={4}
              placeholder={"io.example.com\n192.168.1.100\nlocalhost"}
            />
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
              }}
            >
              One hostname or IP address per line. Browsers require at least one
              SAN matching the CN.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label style={labelStyle}>Key Type</label>
              <select
                style={inputStyle}
                value={keyType}
                onChange={(e) => setKeyType(e.target.value)}
              >
                {KEY_TYPES.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Valid For (days)</label>
              <input
                style={inputStyle}
                type="number"
                min={1}
                max={3650}
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
              />
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                }}
              >
                Max 825 days (browser limit).
              </p>
            </div>
          </div>

          <div>
            <button
              onClick={() => genMut.mutate()}
              disabled={genMut.isPending || !cn.trim()}
              style={btnPrimary}
            >
              {genMut.isPending ? "Generating…" : "Generate Certificate"}
            </button>
          </div>
        </div>

        {showGuide && (
          <GuidePanel
            title={SELF_SIGNED_GUIDE.title}
            steps={SELF_SIGNED_GUIDE.steps}
            note={SELF_SIGNED_GUIDE.note}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provision tab — CSR generation
// ---------------------------------------------------------------------------

const CSR_GUIDE: GuidePanelProps = {
  title: "Generate a Certificate Signing Request (CSR) for a corporate CA",
  steps: [
    {
      title: "Enter the Common Name (CN) — the primary hostname",
      detail:
        "This must match the hostname users use to access I/O. Example: io.corp.example.com",
    },
    {
      title: "Add Subject Alternative Names (SANs) if needed",
      detail:
        "If I/O is reachable at multiple hostnames, add them here. Most corporate CAs require all SANs to be listed in the CSR.",
    },
    {
      title: "Fill in the organization fields",
      detail:
        "Your corporate CA may require Organization (O) and Organizational Unit (OU). Check with your CA administrator.",
    },
    {
      title: "Click Generate CSR",
      detail:
        "I/O generates a private key (stored server-side, never shown) and a CSR. Copy or download the CSR PEM.",
    },
    {
      title: "Submit the CSR to your corporate CA",
      detail:
        "Your CA will sign the CSR and return a certificate (usually as a .crt or .pem file). This may take minutes or days depending on your CA's process.",
    },
    {
      title: "Import the signed certificate",
      detail:
        'Use the Upload Certificate button in the Installed tab. I/O automatically detects that the certificate matches the private key generated in step 4 — you do not need to provide the key again.',
    },
  ],
};

function CsrSection() {
  const [showGuide, setShowGuide] = useState(false);
  const [cn, setCn] = useState("");
  const [sans, setSans] = useState("");
  const [org, setOrg] = useState("");
  const [ou, setOu] = useState("");
  const [country, setCountry] = useState("");
  const [keyType, setKeyType] = useState("rsa4096");
  const [csrPem, setCsrPem] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const genMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ csr_pem: string }>(
        "/api/certificates/csr/generate",
        {
          common_name: cn.trim(),
          sans: sans
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          organization: org.trim() || undefined,
          organizational_unit: ou.trim() || undefined,
          country: country.trim() || undefined,
          key_type: keyType,
        },
      );
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      setCsrPem(data.csr_pem);
      setResult(null);
    },
    onError: (e: Error) => {
      setResult({ ok: false, message: e.message });
      setCsrPem("");
    },
  });

  const handleDownload = () => {
    const blob = new Blob([csrPem], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cn.trim() || "server"}.csr`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "var(--io-surface-secondary)",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Generate CSR for Corporate CA
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginTop: "2px",
            }}
          >
            Generate a Certificate Signing Request for submission to your
            organization's internal certificate authority.
          </div>
        </div>
        <GuidePanelToggle
          show={showGuide}
          onToggle={() => setShowGuide((v) => !v)}
        />
      </div>

      <div
        style={{
          padding: "20px",
          display: "grid",
          gridTemplateColumns: showGuide ? "1fr 360px" : "1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {result && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--io-radius)",
                background: "var(--io-danger-subtle)",
                color: "var(--io-danger)",
                fontSize: "13px",
              }}
            >
              {result.message}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "14px",
            }}
          >
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Common Name (CN) *</label>
              <input
                style={inputStyle}
                value={cn}
                onChange={(e) => setCn(e.target.value)}
                placeholder="io.corp.example.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Country (C)</label>
              <input
                style={inputStyle}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="US"
                maxLength={2}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
            }}
          >
            <div>
              <label style={labelStyle}>Organization (O)</label>
              <input
                style={inputStyle}
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label style={labelStyle}>Organizational Unit (OU)</label>
              <input
                style={inputStyle}
                value={ou}
                onChange={(e) => setOu(e.target.value)}
                placeholder="IT Operations"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Subject Alternative Names (SANs)</label>
            <textarea
              style={{ ...textareaStyle, fontFamily: "var(--io-font-mono, monospace)" }}
              value={sans}
              onChange={(e) => setSans(e.target.value)}
              rows={3}
              placeholder={"io.corp.example.com\nio-backup.corp.example.com"}
            />
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
              }}
            >
              One hostname per line. Include all hostnames this server is
              reachable at.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Key Type</label>
            <select
              style={inputStyle}
              value={keyType}
              onChange={(e) => setKeyType(e.target.value)}
            >
              {KEY_TYPES.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={() => genMut.mutate()}
              disabled={genMut.isPending || !cn.trim()}
              style={btnPrimary}
            >
              {genMut.isPending ? "Generating…" : "Generate CSR"}
            </button>
          </div>

          {csrPem && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <label style={labelStyle}>Generated CSR</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(csrPem).catch(() => {})
                    }
                    style={{
                      ...btnSecondary,
                      fontSize: "12px",
                      padding: "4px 10px",
                    }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleDownload}
                    style={{
                      ...btnSecondary,
                      fontSize: "12px",
                      padding: "4px 10px",
                    }}
                  >
                    Download CSR
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={csrPem}
                rows={8}
                style={{
                  ...textareaStyle,
                  background: "var(--io-surface-secondary)",
                  cursor: "text",
                }}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <p
                style={{
                  margin: "6px 0 0",
                  padding: "8px 12px",
                  borderRadius: "var(--io-radius)",
                  background:
                    "color-mix(in srgb, var(--io-success) 10%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--io-success) 25%, transparent)",
                  fontSize: "11px",
                  color: "var(--io-text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                The private key has been generated and stored securely on the
                server. Submit the CSR above to your CA. When you receive the
                signed certificate, use{" "}
                <strong>Installed → Upload Certificate</strong> — I/O will
                automatically match it to this private key.
              </p>
            </div>
          )}
        </div>

        {showGuide && (
          <GuidePanel
            title={CSR_GUIDE.title}
            steps={CSR_GUIDE.steps}
            note={CSR_GUIDE.note}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provision tab wrapper
// ---------------------------------------------------------------------------

function ProvisionTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: "13px",
          color: "var(--io-text-muted)",
          lineHeight: 1.6,
        }}
      >
        Choose how to provision or generate your TLS certificate. Let's Encrypt
        provides free, publicly-trusted certificates for internet-facing servers.
        Generate a self-signed certificate for internal use. Use the CSR workflow
        to obtain a certificate from your corporate certificate authority.
      </p>
      <AcmeSection />
      <SelfSignedSection />
      <CsrSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HSTS tab
// ---------------------------------------------------------------------------

function HSTSTab() {
  const [enabled, setEnabled] = useState(false);
  const [maxAge, setMaxAge] = useState(63072000);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { isError: hstsError } = useQuery({
    queryKey: ["hsts-config"],
    queryFn: async () => {
      const res = await api.get<HSTSConfig>("/api/certificates/hsts");
      if (res.success) {
        setEnabled(res.data.enabled);
        setMaxAge(res.data.max_age);
      }
      // Mark as loaded regardless of success so the form is usable even when
      // the endpoint returns 404 (e.g. fresh install before HSTS is configured).
      setLoaded(true);
      return res;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await api.put<HSTSConfig>("/api/certificates/hsts", {
        enabled,
        max_age: maxAge,
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () =>
      setResult({ ok: true, message: "HSTS configuration saved." }),
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });

  const maxAgeOptions = [
    { value: 86400, label: "1 day (testing only)" },
    { value: 2592000, label: "30 days" },
    { value: 15768000, label: "6 months" },
    { value: 31536000, label: "1 year" },
    { value: 63072000, label: "2 years (recommended)" },
  ];

  return (
    <div style={{ maxWidth: "640px" }}>
      {hstsError && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: "16px",
            borderRadius: "var(--io-radius)",
            background: "var(--io-danger-subtle)",
            color: "var(--io-danger)",
            fontSize: "13px",
          }}
        >
          Could not load HSTS configuration. The form is showing defaults —
          saving will overwrite any existing server-side settings.
        </div>
      )}
      <div
        style={{
          padding: "16px 20px",
          marginBottom: "24px",
          background:
            "color-mix(in srgb, var(--io-warning) 10%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--io-warning) 35%, transparent)",
          borderRadius: "var(--io-radius)",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--io-text-primary)" }}>
          Before enabling HSTS:
        </strong>{" "}
        confirm that your TLS certificate is valid, trusted by browsers, and
        covers all hostnames for this server. Enabling HSTS with a broken or
        self-signed certificate will lock users out until the max-age expires —
        this cannot be easily undone.
      </div>

      {result && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--io-radius)",
            background: result.ok
              ? "color-mix(in srgb, var(--io-success) 12%, transparent)"
              : "var(--io-danger-subtle)",
            color: result.ok ? "var(--io-success)" : "var(--io-danger)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {result.message}
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: enabled ? "1px solid var(--io-border)" : "none",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              HTTP Strict Transport Security (HSTS)
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-text-muted)",
                marginTop: "2px",
              }}
            >
              Instructs browsers to only connect to this server over HTTPS,
              preventing protocol downgrade attacks.
            </div>
            <div
              style={{
                marginTop: "6px",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "var(--io-text-muted)",
              }}
            >
              {enabled
                ? `Strict-Transport-Security: max-age=${maxAge}; includeSubDomains`
                : "HSTS disabled — header not sent"}
            </div>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setResult(null);
              }}
              disabled={!loaded}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: enabled ? "var(--io-accent)" : "var(--io-text-muted)",
              }}
            >
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </label>
        </div>

        {enabled && (
          <div style={{ padding: "16px 20px" }}>
            <label style={labelStyle}>max-age</label>
            <select
              style={{ ...inputStyle, maxWidth: "280px" }}
              value={maxAge}
              onChange={(e) => setMaxAge(parseInt(e.target.value, 10))}
            >
              {maxAgeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
                lineHeight: 1.5,
              }}
            >
              How long browsers remember to use HTTPS only. Start with a short
              value (30 days) and increase once you're confident the certificate
              is stable. HSTS preload is not enabled — this affects only direct
              visitors, not preload-list browsers.
            </p>
          </div>
        )}
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !loaded}
          style={btnPrimary}
        >
          {saveMut.isPending ? "Saving…" : "Save HSTS Settings"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const CERT_TABS = [
  { id: "installed", label: "Installed Certificates" },
  { id: "provision", label: "Provision" },
  { id: "hsts", label: "HSTS" },
];

export default function CertificatesPage() {
  const [activeTab, setActiveTab] = useState("installed");

  return (
    <SettingsPageLayout
      title="Certificates"
      description="Manage TLS certificates for HTTPS termination, service authentication, and OPC UA connections."
    >
      <SettingsTabs
        tabs={CERT_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === "installed" && <InstalledTab />}
        {activeTab === "provision" && <ProvisionTab />}
        {activeTab === "hsts" && <HSTSTab />}
      </SettingsTabs>
    </SettingsPageLayout>
  );
}

// ---------------------------------------------------------------------------
// OPC UA Server Certificates section
// ---------------------------------------------------------------------------

const OPC_STATUS: Record<string, { bg: string; color: string; label: string }> =
  {
    trusted: {
      bg: "color-mix(in srgb, var(--io-success) 12%, transparent)",
      color: "var(--io-success)",
      label: "Trusted",
    },
    pending: {
      bg: "color-mix(in srgb, var(--io-warning) 12%, transparent)",
      color: "var(--io-warning)",
      label: "Pending",
    },
    rejected: {
      bg: "color-mix(in srgb, var(--io-danger) 12%, transparent)",
      color: "var(--io-danger)",
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
                          ? "var(--io-danger)"
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
                              color: "var(--io-text-on-accent)",
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
                              background: "var(--io-danger)",
                              color: "var(--io-text-on-accent)",
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
