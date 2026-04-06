import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { mfaApi, EnrollTotpResponse } from "../../api/mfa";
import {
  apiKeysApi,
  CreateApiKeyPayload,
  CreateApiKeyResponse,
} from "../../api/apiKeys";
import { authApi } from "../../api/auth";
import { useUiStore } from "../../store/ui";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { showToast } from "../../shared/components/Toast";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnDanger,
} from "../settings/settingsStyles";

// ── Available API key scopes ──────────────────────────────────────────────────

const AVAILABLE_SCOPES = [
  "read",
  "write",
  "admin",
  "opc:read",
  "data:read",
  "reports:read",
  "reports:write",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Section wrapper ───────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--io-border)",
  borderRadius: "10px",
  overflow: "hidden",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--io-border)",
  background: "var(--io-surface-secondary)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--io-text-primary)",
};

const sectionDescStyle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: "12px",
  color: "var(--io-text-muted)",
};

// ── PIN Setup ─────────────────────────────────────────────────────────────────

function PinSetupSection({
  authProvider,
}: {
  authProvider: "local" | "oidc" | "saml" | "ldap" | null;
}) {
  const isLocalAccount = !authProvider || authProvider === "local";
  const [mode, setMode] = useState<"idle" | "set" | "remove">("idle");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setPin("");
    setPinConfirm("");
    setCurrentPassword("");
    setError(null);
    setMode("idle");
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must be exactly 6 numeric digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await authApi.setPin(pin, currentPassword);
      if (!result.success) {
        const msg = (result.error as { message?: string }).message;
        if (msg?.includes("invalid_password") || msg?.includes("incorrect")) {
          setError("Current password is incorrect.");
        } else if (msg?.includes("validation") || msg?.includes("6 numeric")) {
          setError("PIN must be exactly 6 numeric digits.");
        } else {
          setError(
            result.error.message ?? "Failed to set PIN. Please try again.",
          );
        }
        return;
      }
      showToast({ title: "PIN set successfully.", variant: "success" });
      useUiStore.getState().setLockMeta({ hasPin: true });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemovePin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await authApi.deletePin(currentPassword);
      if (!result.success) {
        const msg = (result.error as { message?: string }).message;
        if (msg?.includes("invalid_password") || msg?.includes("incorrect")) {
          setError("Current password is incorrect.");
        } else {
          setError(
            result.error.message ?? "Failed to remove PIN. Please try again.",
          );
        }
        return;
      }
      showToast({ title: "PIN removed successfully.", variant: "success" });
      useUiStore.getState().setLockMeta({ hasPin: false });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={sectionStyle}>
      <div
        style={{
          ...sectionHeaderStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: mode !== "idle" ? "1px solid var(--io-border)" : undefined,
        }}
      >
        <div>
          <div style={sectionTitleStyle}>Lock Screen PIN</div>
          <div style={sectionDescStyle}>
            Set a 6-digit PIN as an alternative to your password on the lock
            screen.
          </div>
        </div>
        {mode === "idle" && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "16px" }}>
            <button
              onClick={() => setMode("set")}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--io-radius)",
                border: "1px solid var(--io-accent)",
                background: "var(--io-accent-subtle)",
                color: "var(--io-accent)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Set PIN
            </button>
            <button
              onClick={() => setMode("remove")}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--io-radius)",
                border: "1px solid var(--io-border)",
                background: "transparent",
                color: "var(--io-text-secondary)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Remove PIN
            </button>
          </div>
        )}
      </div>

      {mode === "set" && (
        <form onSubmit={handleSetPin} style={{ padding: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={labelStyle} htmlFor="pin-new">
                New PIN (6 digits)
              </label>
              <input
                id="pin-new"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter 6-digit PIN"
                style={inputStyle}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="pin-confirm">
                Confirm PIN
              </label>
              <input
                id="pin-confirm"
                type="password"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) =>
                  setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Re-enter PIN"
                style={inputStyle}
                autoComplete="new-password"
                required
              />
            </div>
            {isLocalAccount && (
              <div>
                <label style={labelStyle} htmlFor="pin-current-password">
                  Current Password (required to set PIN)
                </label>
                <input
                  id="pin-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  style={inputStyle}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            {error && (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--io-danger)",
                  padding: "8px 10px",
                  background: "var(--io-error-subtle, rgba(220,38,38,0.08))",
                  borderRadius: "var(--io-radius)",
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Saving…" : "Save PIN"}
              </button>
            </div>
          </div>
        </form>
      )}

      {mode === "remove" && (
        <form onSubmit={handleRemovePin} style={{ padding: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
              This will remove your lock screen PIN. You will need your password
              to unlock the session.
            </div>
            {isLocalAccount && (
              <div>
                <label style={labelStyle} htmlFor="pin-remove-password">
                  Current Password (required to remove PIN)
                </label>
                <input
                  id="pin-remove-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  style={inputStyle}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            {error && (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--io-danger)",
                  padding: "8px 10px",
                  background: "var(--io-error-subtle, rgba(220,38,38,0.08))",
                  borderRadius: "var(--io-radius)",
                }}
              >
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={resetForm}
                disabled={submitting}
                style={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ ...btnDanger, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Removing…" : "Remove PIN"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ── MFA Enrollment ────────────────────────────────────────────────────────────

type EnrollStep = "idle" | "setup" | "verify" | "recovery";

function MfaSection() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<EnrollStep>("idle");
  const [enrollData, setEnrollData] = useState<EnrollTotpResponse | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  const { data: statusResult, isLoading } = useQuery({
    queryKey: ["mfa-status"],
    queryFn: () => mfaApi.getStatus(),
  });

  const status = statusResult?.success ? statusResult.data : null;

  const enrollMutation = useMutation({
    mutationFn: () => mfaApi.enrollTotp(),
    onSuccess: (result) => {
      if (result.success) {
        setEnrollData(result.data);
        setStep("setup");
        setError("");
      } else {
        setError(result.error.message);
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => mfaApi.verifyEnrollment(code),
    onSuccess: (result) => {
      if (result.success) {
        setRecoveryCodes(result.data.recovery_codes);
        setStep("recovery");
        setTotpCode("");
        queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      } else {
        setError(result.error.message);
      }
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => mfaApi.disableTotp(),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      } else {
        setError(result.error.message);
      }
    },
  });

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>Two-Factor Authentication</div>
        <div style={sectionDescStyle}>
          Protect your account with a time-based one-time password (TOTP)
          authenticator app.
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {isLoading && (
          <div style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
            Loading MFA status…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--io-radius)",
              background: "var(--io-error-subtle, #fef2f2)",
              color: "var(--io-danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Status row */}
        {step === "idle" && !isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 16px",
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface)",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: status?.enabled
                  ? "var(--io-success, #22c55e)"
                  : "var(--io-text-muted)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--io-text-primary)",
                }}
              >
                TOTP Authenticator
              </div>
              <div style={{ fontSize: "12px", color: "var(--io-text-muted)", marginTop: "2px" }}>
                {status?.enabled
                  ? `Active${status.has_recovery_codes ? " · recovery codes available" : " · no recovery codes"}`
                  : "Not configured"}
              </div>
            </div>
            {status?.enabled ? (
              <button
                onClick={() => setShowDisableConfirm(true)}
                disabled={disableMutation.isPending}
                style={{ ...btnDanger, padding: "6px 14px" }}
              >
                {disableMutation.isPending ? "Disabling…" : "Disable TOTP"}
              </button>
            ) : (
              <button
                onClick={() => enrollMutation.mutate()}
                disabled={enrollMutation.isPending}
                style={{ ...btnPrimary, padding: "6px 14px" }}
              >
                {enrollMutation.isPending ? "Starting…" : "Enable TOTP"}
              </button>
            )}
          </div>
        )}

        {/* Setup step */}
        {step === "setup" && enrollData && (
          <div
            style={{
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "20px",
              background: "var(--io-surface)",
            }}
          >
            <h4
              style={{
                margin: "0 0 12px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              Step 1 — Add to your authenticator app
            </h4>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--io-text-secondary)" }}>
              Open your authenticator app (Google Authenticator, Authy,
              1Password, etc.) and add a new account.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <a
                href={enrollData.otpauth_uri}
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: "var(--io-radius)",
                  background: "var(--io-accent)",
                  color: "var(--io-text-on-accent)",
                  fontSize: "13px",
                  textDecoration: "none",
                }}
              >
                Open in Authenticator App
              </a>
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--io-radius)",
                background: "var(--io-surface-secondary)",
                border: "1px solid var(--io-border)",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "6px",
                }}
              >
                Manual Entry Key
              </div>
              <code
                style={{
                  fontSize: "15px",
                  letterSpacing: "0.12em",
                  color: "var(--io-text-primary)",
                  fontFamily: "var(--io-font-mono, monospace)",
                  wordBreak: "break-all",
                }}
              >
                {enrollData.manual_entry_key}
              </code>
            </div>
            <h4 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 600, color: "var(--io-text-primary)" }}>
              Step 2 — Enter the 6-digit code
            </h4>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && totpCode.length === 6) {
                    verifyMutation.mutate(totpCode);
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--io-radius)",
                  border: "1px solid var(--io-border)",
                  background: "var(--io-surface)",
                  color: "var(--io-text-primary)",
                  fontSize: "18px",
                  letterSpacing: "0.25em",
                  width: "140px",
                  textAlign: "center",
                }}
              />
              <button
                onClick={() => verifyMutation.mutate(totpCode)}
                disabled={totpCode.length !== 6 || verifyMutation.isPending}
                style={{
                  ...btnPrimary,
                  opacity: totpCode.length === 6 ? 1 : 0.5,
                  cursor: totpCode.length === 6 ? "pointer" : "not-allowed",
                }}
              >
                {verifyMutation.isPending ? "Verifying…" : "Verify & Activate"}
              </button>
              <button
                onClick={() => {
                  setStep("idle");
                  setEnrollData(null);
                  setTotpCode("");
                  setError("");
                }}
                style={btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Recovery codes */}
        {step === "recovery" && recoveryCodes.length > 0 && (
          <div
            style={{
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "20px",
              background: "var(--io-surface)",
            }}
          >
            <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600, color: "var(--io-text-primary)" }}>
              TOTP Enabled — Save Your Recovery Codes
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--io-text-secondary)", lineHeight: 1.5 }}>
              These 8 single-use codes let you access your account if you lose
              your authenticator device. Save them somewhere safe — you will not
              be able to view them again.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
                padding: "16px",
                background: "var(--io-surface-secondary)",
                borderRadius: "var(--io-radius)",
                border: "1px solid var(--io-border)",
                marginBottom: "16px",
              }}
            >
              {recoveryCodes.map((code) => (
                <code
                  key={code}
                  style={{
                    fontSize: "13px",
                    fontFamily: "var(--io-font-mono, monospace)",
                    color: "var(--io-text-primary)",
                    textAlign: "center",
                    padding: "4px",
                  }}
                >
                  {code}
                </code>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleCopyRecoveryCodes} style={btnSecondary}>
                {copied ? "Copied!" : "Copy All Codes"}
              </button>
              <button
                onClick={() => {
                  setStep("idle");
                  setEnrollData(null);
                  setRecoveryCodes([]);
                }}
                style={btnPrimary}
              >
                I have saved my codes
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDisableConfirm}
        onOpenChange={setShowDisableConfirm}
        title="Disable TOTP?"
        description="You will no longer need a code to log in. Your account will be less secure."
        confirmLabel="Disable TOTP"
        variant="danger"
        onConfirm={() => disableMutation.mutate()}
      />
    </div>
  );
}

// ── API Keys ──────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--io-overlay, rgba(0,0,0,0.5))",
  zIndex: 100,
};

const modalContentStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: "10px",
  padding: "24px",
  width: "480px",
  maxWidth: "calc(100vw - 32px)",
  zIndex: 101,
};

function CreateKeyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreateApiKeyResponse) => void;
}) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: CreateApiKeyPayload) => apiKeysApi.create(payload),
    onSuccess: (result) => {
      if (result.success) {
        onCreated(result.data);
        setName("");
        setSelectedScopes([]);
        setExpiresAt("");
        setError("");
      } else {
        setError(result.error.message);
      }
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      scopes: selectedScopes.length > 0 ? selectedScopes : undefined,
      expires_at: expiresAt || undefined,
    });
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={modalContentStyle}>
          <Dialog.Title
            style={{
              margin: "0 0 20px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Create API Key
          </Dialog.Title>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--io-radius)",
                background: "var(--io-error-subtle, #fef2f2)",
                color: "var(--io-danger)",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle} htmlFor="apikey-name">
              Name *
            </label>
            <input
              id="apikey-name"
              type="text"
              placeholder="e.g. CI/CD Pipeline, Monitoring Agent"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Scopes (optional)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    padding: "4px 10px",
                    borderRadius: "var(--io-radius)",
                    border: `1px solid ${selectedScopes.includes(scope) ? "var(--io-accent)" : "var(--io-border)"}`,
                    background: selectedScopes.includes(scope)
                      ? "var(--io-accent-subtle)"
                      : "transparent",
                    fontSize: "12px",
                    color: selectedScopes.includes(scope)
                      ? "var(--io-accent)"
                      : "var(--io-text-secondary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    style={{ display: "none" }}
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle} htmlFor="apikey-expires">
              Expiry Date (optional)
            </label>
            <input
              id="apikey-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--io-radius)",
                border: "1px solid var(--io-border)",
                background: "var(--io-surface)",
                color: "var(--io-text-primary)",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              style={btnPrimary}
            >
              {createMutation.isPending ? "Creating…" : "Create Key"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RevealKeyModal({
  result,
  onClose,
}: {
  result: CreateApiKeyResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root open onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={{ ...modalContentStyle, width: "520px" }}>
          <Dialog.Title
            style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            API Key Created
          </Dialog.Title>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "13px",
              color: "var(--io-danger)",
              fontWeight: 500,
            }}
          >
            Copy this key now — you will not be able to see it again.
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--io-radius)",
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border)",
              marginBottom: "16px",
              wordBreak: "break-all",
            }}
          >
            <code
              style={{
                fontSize: "13px",
                fontFamily: "var(--io-font-mono, monospace)",
                color: "var(--io-text-primary)",
                lineHeight: 1.5,
              }}
            >
              {result.key}
            </code>
          </div>

          <div style={{ fontSize: "12px", color: "var(--io-text-muted)", marginBottom: "20px" }}>
            <strong>Name:</strong> {result.name}
            {result.scopes.length > 0 && (
              <>
                {" · "}
                <strong>Scopes:</strong> {result.scopes.join(", ")}
              </>
            )}
            {result.expires_at && (
              <>
                {" · "}
                <strong>Expires:</strong> {formatDate(result.expires_at)}
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={handleCopy} style={btnSecondary}>
              {copied ? "Copied!" : "Copy Key"}
            </button>
            <button onClick={onClose} style={btnPrimary}>
              Done
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: listResult, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiKeysApi.list(),
  });

  const keys = listResult?.success ? listResult.data : [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const handleCreated = (result: CreateApiKeyResponse) => {
    setShowCreate(false);
    setNewKeyResult(result);
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });
  };

  return (
    <div style={sectionStyle}>
      <div
        style={{
          ...sectionHeaderStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={sectionTitleStyle}>API Keys</div>
          <div style={sectionDescStyle}>
            API keys allow programmatic access to Inside Operations on your
            behalf.
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ ...btnPrimary, whiteSpace: "nowrap", flexShrink: 0 }}
        >
          + Create Key
        </button>
      </div>

      <div style={{ padding: "16px" }}>
        {isLoading ? (
          <div style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
            Loading…
          </div>
        ) : keys.length === 0 ? (
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
            No API keys yet. Create one to get started.
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
                  {["Name", "Prefix", "Scopes", "Created", "Expires", "Last Used", ""].map(
                    (h) => (
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
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} style={{ borderBottom: "1px solid var(--io-border)" }}>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: "13px",
                        color: "var(--io-text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {key.name}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <code
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--io-font-mono, monospace)",
                          color: "var(--io-text-secondary)",
                          background: "var(--io-surface-secondary)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {key.key_prefix}…
                      </code>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {key.scopes.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {key.scopes.map((s) => (
                            <span
                              key={s}
                              style={{
                                fontSize: "11px",
                                padding: "2px 7px",
                                borderRadius: "99px",
                                background: "var(--io-accent-subtle)",
                                color: "var(--io-accent)",
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
                          All scopes
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: "12px",
                        color: "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(key.created_at)}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: "12px",
                        color: key.expires_at
                          ? "var(--io-text-secondary)"
                          : "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {key.expires_at ? formatDate(key.expires_at) : "Never"}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: "12px",
                        color: "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatRelative(key.last_used_at)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button
                        onClick={() =>
                          setDeleteTarget({ id: key.id, name: key.name })
                        }
                        disabled={deleteMutation.isPending}
                        style={{
                          padding: "4px 12px",
                          borderRadius: "var(--io-radius)",
                          border: "1px solid var(--io-danger)",
                          background: "transparent",
                          color: "var(--io-danger)",
                          fontSize: "12px",
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
      </div>

      <CreateKeyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />

      {newKeyResult && (
        <RevealKeyModal
          result={newKeyResult}
          onClose={() => setNewKeyResult(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete API Key?"
        description={`Delete API key "${deleteTarget?.name ?? ""}"? This cannot be undone. Any integrations using this key will stop working.`}
        confirmLabel="Delete Key"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

// ── Change Password ───────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const authProvider =
    (sessionStorage.getItem("io_auth_provider") as
      | "local"
      | "oidc"
      | "saml"
      | "ldap"
      | null) ?? "local";

  const isLocalAccount = !authProvider || authProvider === "local";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isLocalAccount) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await fetch("/api/auth/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("io_access_token") ?? ""}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!result.ok) {
        const body = await result.json().catch(() => ({}));
        const msg =
          (body as { error?: { message?: string } }).error?.message ??
          "Failed to change password.";
        setError(msg);
        return;
      }
      showToast({ title: "Password changed successfully.", variant: "success" });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionTitleStyle}>Change Password</div>
        <div style={sectionDescStyle}>
          Update your account password. You will remain logged in on all devices.
        </div>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "360px" }}>
          <div>
            <label style={labelStyle} htmlFor="pw-current">
              Current Password
            </label>
            <input
              id="pw-current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="pw-new">
              New Password
            </label>
            <input
              id="pw-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="pw-confirm">
              Confirm New Password
            </label>
            <input
              id="pw-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
          </div>
          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-danger)",
                padding: "8px 10px",
                background: "var(--io-error-subtle, rgba(220,38,38,0.08))",
                borderRadius: "var(--io-radius)",
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-success, #16a34a)",
                padding: "8px 10px",
                background: "var(--io-success-subtle, #f0fdf4)",
                borderRadius: "var(--io-radius)",
              }}
            >
              Password changed successfully.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Saving…" : "Change Password"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SecurityTab() {
  const authProvider =
    (sessionStorage.getItem("io_auth_provider") as
      | "local"
      | "oidc"
      | "saml"
      | "ldap"
      | null) ?? "local";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <PinSetupSection authProvider={authProvider} />
      <MfaSection />
      <ApiKeysSection />
      <ChangePasswordSection />
    </div>
  );
}
