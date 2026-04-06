import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  smsProvidersApi,
  SmsProvider,
  CreateSmsProviderRequest,
} from "../../api/smsProviders";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

const btnSmallDanger: React.CSSProperties = {
  ...btnSmall,
  color: "var(--io-danger)",
  borderColor: "var(--io-danger)",
};

// ---------------------------------------------------------------------------
// Add Provider dialog (Radix Dialog)
// ---------------------------------------------------------------------------

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function AddProviderDialog({
  open,
  onOpenChange,
  onCreated,
}: AddProviderDialogProps) {
  const [providerType, setProviderType] = useState<"twilio" | "webhook">(
    "twilio",
  );
  const [name, setName] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [headersJson, setHeadersJson] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setProviderType("twilio");
    setName("");
    setAccountSid("");
    setAuthToken("");
    setFromNumber("");
    setWebhookUrl("");
    setHeadersJson("");
    setEnabled(true);
    setIsDefault(false);
    setError("");
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateSmsProviderRequest) =>
      smsProvidersApi.create(body),
    onSuccess: (result) => {
      if (result.success) {
        reset();
        onCreated();
      } else {
        setError(
          (result as { error: { message: string } }).error?.message ??
            "Failed to create provider",
        );
      }
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    let config: CreateSmsProviderRequest["config"] = {};
    if (providerType === "twilio") {
      if (!accountSid.trim() || !authToken.trim() || !fromNumber.trim()) {
        setError(
          "Account SID, Auth Token, and From Number are all required for Twilio",
        );
        return;
      }
      config = {
        account_sid: accountSid.trim(),
        auth_token: authToken.trim(),
        from_number: fromNumber.trim(),
      };
    } else {
      if (!webhookUrl.trim()) {
        setError("Webhook URL is required");
        return;
      }
      let headers: Record<string, string> | undefined;
      if (headersJson.trim()) {
        try {
          headers = JSON.parse(headersJson.trim()) as Record<string, string>;
        } catch {
          setError('Headers must be valid JSON (e.g. {"X-Api-Key": "value"})');
          return;
        }
      }
      config = { url: webhookUrl.trim(), ...(headers ? { headers } : {}) };
    }

    createMutation.mutate({
      name: name.trim(),
      provider_type: providerType,
      enabled,
      is_default: isDefault,
      config,
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 101,
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius-lg)",
            padding: "24px",
            width: "480px",
            maxWidth: "95vw",
            maxHeight: "calc(100vh - 64px)",
            overflowY: "auto",
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 20px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Add SMS Provider
          </Dialog.Title>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Provider type */}
            <div>
              <label style={labelStyle}>Provider Type</label>
              <select
                value={providerType}
                onChange={(e) =>
                  setProviderType(e.target.value as "twilio" | "webhook")
                }
                style={inputStyle}
              >
                <option value="twilio">Twilio</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <label style={labelStyle}>Name</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Twilio Production"
              />
            </div>

            {/* Twilio fields */}
            {providerType === "twilio" && (
              <>
                <div>
                  <label style={labelStyle}>Account SID</label>
                  <input
                    style={inputStyle}
                    value={accountSid}
                    onChange={(e) => setAccountSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Auth Token</label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="Your Twilio Auth Token"
                  />
                </div>
                <div>
                  <label style={labelStyle}>From Number</label>
                  <input
                    style={inputStyle}
                    value={fromNumber}
                    onChange={(e) => setFromNumber(e.target.value)}
                    placeholder="+15005550006"
                  />
                </div>
              </>
            )}

            {/* Webhook fields */}
            {providerType === "webhook" && (
              <>
                <div>
                  <label style={labelStyle}>Webhook URL</label>
                  <input
                    style={inputStyle}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.example.com/sms/send"
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Custom Headers (JSON, optional)
                  </label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: "72px",
                      resize: "vertical",
                      fontFamily: "monospace",
                    }}
                    value={headersJson}
                    onChange={(e) => setHeadersJson(e.target.value)}
                    placeholder={'{"X-Api-Key": "secret"}'}
                  />
                </div>
              </>
            )}

            {/* Toggles */}
            <div style={{ display: "flex", gap: "24px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "var(--io-text-primary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "var(--io-text-primary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Set as default
              </label>
            </div>

            {error && (
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--io-danger)",
                }}
              >
                {error}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "24px",
            }}
          >
            <Dialog.Close asChild>
              <button style={btnSecondary}>Cancel</button>
            </Dialog.Close>
            <button
              style={btnPrimary}
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : "Add Provider"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

export default function SmsProvidersSection() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SmsProvider | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sms-providers"],
    queryFn: async () => {
      const result = await smsProvidersApi.list();
      return result.success ? result.data : [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => smsProvidersApi.delete(id),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["sms-providers"] });
    },
  });

  const providers: SmsProvider[] = data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            SMS Providers
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Configure Twilio or a custom webhook for SMS-based MFA codes.
          </p>
        </div>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>
          Add Provider
        </button>
      </div>

      {isLoading ? (
        <p style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          Loading…
        </p>
      ) : providers.length === 0 ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--io-text-muted)",
            fontStyle: "italic",
          }}
        >
          No SMS providers configured. Add one to enable SMS MFA.
        </p>
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
                  background: "var(--io-surface-sunken)",
                  borderBottom: "1px solid var(--io-border)",
                }}
              >
                {[
                  "Name",
                  "Type",
                  "From / URL",
                  "Enabled",
                  "Default",
                  "Last Test",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...cellStyle,
                      color: "var(--io-text-muted)",
                      fontWeight: 600,
                      fontSize: "12px",
                      textAlign: "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    borderTop:
                      idx === 0 ? "none" : "1px solid var(--io-border)",
                  }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      color: "var(--io-text-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </td>
                  <td style={cellStyle}>
                    {p.provider_type === "twilio" ? "Twilio" : "Webhook"}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    {p.provider_type === "twilio"
                      ? (p.config.from_number ?? "—")
                      : (p.config.url ?? "—")}
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: p.enabled
                          ? "var(--io-success)"
                          : "var(--io-text-muted)",
                        marginRight: "6px",
                      }}
                    />
                    {p.enabled ? "Yes" : "No"}
                  </td>
                  <td style={cellStyle}>{p.is_default ? "Yes" : "—"}</td>
                  <td style={cellStyle}>
                    {p.last_tested_at == null ? (
                      <span style={{ color: "var(--io-text-muted)" }}>
                        Never
                      </span>
                    ) : (
                      <span
                        style={{
                          color: p.last_test_ok
                            ? "var(--io-success)"
                            : "var(--io-danger)",
                        }}
                      >
                        {p.last_test_ok ? "OK" : "Failed"}{" "}
                        <span
                          style={{
                            color: "var(--io-text-muted)",
                            fontSize: "11px",
                          }}
                        >
                          {new Date(p.last_tested_at).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    <button
                      style={btnSmallDanger}
                      disabled={deleteMutation.isPending}
                      onClick={() => setConfirmDelete(p)}
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

      <AddProviderDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onCreated={() => {
          setShowAdd(false);
          queryClient.invalidateQueries({ queryKey: ["sms-providers"] });
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => {
          if (!v) setConfirmDelete(null);
        }}
        title={`Delete "${confirmDelete?.name ?? ""}"?`}
        description="This SMS provider will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() =>
          confirmDelete && deleteMutation.mutate(confirmDelete.id)
        }
      />

      <style>{`
        input[type="checkbox"] { accent-color: var(--io-accent); cursor: pointer; }
        select option { background: var(--io-surface-secondary); color: var(--io-text-primary); }
      `}</style>
    </div>
  );
}
