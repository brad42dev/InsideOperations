import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  scimApi,
  CreateScimTokenPayload,
  CreateScimTokenResponse,
} from "../../api/scim";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
} from "./settingsStyles";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Create token dialog
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: CreateScimTokenResponse) => void;
}

function CreateDialog({ open, onOpenChange, onCreated }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setDescription("");
    setError("");
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateScimTokenPayload) =>
      scimApi.createToken(payload),
    onSuccess: (result) => {
      if (result.success) {
        reset();
        onCreated(result.data);
      } else {
        const errResult = result as {
          success: false;
          error?: { message: string };
        };
        setError(errResult.error?.message ?? "Failed to create token");
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
      description: description.trim() || undefined,
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
            borderRadius: "var(--io-radius)",
            padding: "24px",
            width: "480px",
            maxWidth: "calc(100vw - 32px)",
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
            Create SCIM Token
          </Dialog.Title>

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
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              placeholder="e.g. Azure AD, Okta"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Description (optional)</label>
            <input
              type="text"
              placeholder="Used by Azure AD SCIM provisioning"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
          >
            <Dialog.Close asChild>
              <button style={btnSecondary}>Cancel</button>
            </Dialog.Close>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              style={btnPrimary}
            >
              {createMutation.isPending ? "Creating…" : "Create Token"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Reveal dialog — shows the plaintext token once
// ---------------------------------------------------------------------------

interface RevealDialogProps {
  result: CreateScimTokenResponse | null;
  onClose: () => void;
}

function RevealDialog({ result, onClose }: RevealDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root
      open={!!result}
      onOpenChange={(v) => {
        if (!v) onClose();
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
            borderRadius: "var(--io-radius)",
            padding: "24px",
            width: "520px",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 8px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            SCIM Token Created
          </Dialog.Title>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "13px",
              color: "var(--io-danger)",
              fontWeight: 500,
            }}
          >
            Copy this token now — you will not be able to see it again.
          </p>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--io-radius)",
              background: "var(--io-surface-sunken)",
              border: "1px solid var(--io-border)",
              marginBottom: "16px",
              wordBreak: "break-all",
            }}
          >
            <code
              style={{
                fontSize: "12px",
                fontFamily: "var(--io-font-mono, monospace)",
                color: "var(--io-text-primary)",
                lineHeight: 1.5,
              }}
            >
              {result?.token}
            </code>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: "20px",
            }}
          >
            <strong>Name:</strong> {result?.name}
          </div>

          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
          >
            <button onClick={handleCopy} style={btnSecondary}>
              {copied ? "Copied!" : "Copy Token"}
            </button>
            <Dialog.Close asChild>
              <button style={btnPrimary}>Done</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Main SCIM Tokens section
// ---------------------------------------------------------------------------

export default function ScimTokensSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTokenResult, setNewTokenResult] =
    useState<CreateScimTokenResponse | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  const { data: listResult, isLoading } = useQuery({
    queryKey: ["scim-tokens"],
    queryFn: () => scimApi.listTokens(),
  });

  const tokens = listResult?.success ? listResult.data : [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scimApi.deleteToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scim-tokens"] });
    },
  });

  const handleCreated = (result: CreateScimTokenResponse) => {
    setShowCreate(false);
    setNewTokenResult(result);
    queryClient.invalidateQueries({ queryKey: ["scim-tokens"] });
  };

  const scimEndpointUrl = `${window.location.origin}/api/scim/v2`;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(scimEndpointUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  return (
    <div>
      {/* SCIM Endpoint URL */}
      <div
        style={{
          background: "var(--io-surface-sunken)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          padding: "14px 16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--io-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "8px",
          }}
        >
          SCIM Endpoint URL
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            readOnly
            value={scimEndpointUrl}
            style={{
              ...inputStyle,
              fontFamily: "var(--io-font-mono, monospace)",
              fontSize: "12px",
              color: "var(--io-text-primary)",
              background: "var(--io-surface-secondary)",
            }}
          />
          <button
            onClick={handleCopyEndpoint}
            style={{ ...btnSmall, whiteSpace: "nowrap" }}
          >
            {copiedEndpoint ? "Copied!" : "Copy"}
          </button>
        </div>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "12px",
            color: "var(--io-text-muted)",
          }}
        >
          Provide this URL to your identity provider (Azure AD, Okta) when
          configuring SCIM provisioning.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            SCIM Provisioning Tokens
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Bearer tokens for identity providers to push user changes via SCIM
            2.0.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>
          + New Token
        </button>
      </div>

      {isLoading ? (
        <div
          style={{
            fontSize: "13px",
            color: "var(--io-text-muted)",
            padding: "12px 0",
          }}
        >
          Loading…
        </div>
      ) : tokens.length === 0 ? (
        <div
          style={{
            padding: "24px",
            borderRadius: "var(--io-radius)",
            border: "1px solid var(--io-border)",
            textAlign: "center",
            fontSize: "13px",
            color: "var(--io-text-muted)",
          }}
        >
          No SCIM tokens yet. Create one to enable IdP provisioning.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            overflow: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--io-surface-secondary)",
                  borderBottom: "1px solid var(--io-border)",
                }}
              >
                {["Name", "Created", "Last Used", "Status", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, idx) => (
                <tr
                  key={token.id}
                  style={{
                    borderTop:
                      idx > 0 ? "1px solid var(--io-border)" : undefined,
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--io-text-primary)",
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{token.name}</div>
                    {token.description && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--io-text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        {token.description}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {formatDate(token.created_at)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {formatRelative(token.last_used_at)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: token.enabled
                          ? "var(--io-success-subtle)"
                          : "var(--io-surface-secondary)",
                        color: token.enabled
                          ? "var(--io-success)"
                          : "var(--io-text-muted)",
                      }}
                    >
                      {token.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() =>
                        setConfirmRevoke({ id: token.id, name: token.name })
                      }
                      disabled={deleteMutation.isPending}
                      style={{
                        ...btnSmall,
                        color: "var(--io-danger)",
                        borderColor: "var(--io-danger)",
                      }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />

      <RevealDialog
        result={newTokenResult}
        onClose={() => setNewTokenResult(null)}
      />

      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={(v) => {
          if (!v) setConfirmRevoke(null);
        }}
        title={`Revoke "${confirmRevoke?.name ?? ""}"?`}
        description="IdPs using this token will lose access immediately."
        confirmLabel="Revoke"
        variant="danger"
        onConfirm={() =>
          confirmRevoke && deleteMutation.mutate(confirmRevoke.id)
        }
      />
    </div>
  );
}
