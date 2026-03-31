import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  scimApi,
  CreateScimTokenPayload,
  CreateScimTokenResponse,
} from "../../api/scim";

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
// Create modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  onClose: () => void;
  onCreated: (result: CreateScimTokenResponse) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (payload: CreateScimTokenPayload) =>
      scimApi.createToken(payload),
    onSuccess: (result) => {
      if (result.success) {
        onCreated(result.data);
      } else {
        setError((result as any).error?.message ?? "Failed to create token");
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
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
          width: "480px",
          maxWidth: "calc(100vw - 32px)",
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
          Create SCIM Token
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
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Name *
          </label>
          <input
            type="text"
            placeholder="e.g. Azure AD, Okta"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface)",
              color: "var(--io-text-primary)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--io-text-muted)",
              marginBottom: "6px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Description (optional)
          </label>
          <input
            type="text"
            placeholder="Used by Azure AD SCIM provisioning"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "var(--io-radius)",
              border: "1px solid var(--io-border)",
              background: "var(--io-surface)",
              color: "var(--io-text-primary)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
        >
          <button
            onClick={onClose}
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
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--io-radius)",
              border: "none",
              background: "var(--io-accent)",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {createMutation.isPending ? "Creating…" : "Create Token"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reveal modal — shows the plaintext token once
// ---------------------------------------------------------------------------

interface RevealModalProps {
  result: CreateScimTokenResponse;
  onClose: () => void;
}

function RevealModal({ result, onClose }: RevealModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          padding: "24px",
          width: "520px",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          SCIM Token Created
        </h3>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "13px",
            color: "var(--io-error, #ef4444)",
            fontWeight: 500,
          }}
        >
          Copy this token now — you will not be able to see it again.
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
              fontSize: "12px",
              fontFamily: "var(--io-font-mono, monospace)",
              color: "var(--io-text-primary)",
              lineHeight: 1.5,
            }}
          >
            {result.token}
          </code>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "var(--io-text-muted)",
            marginBottom: "20px",
          }}
        >
          <strong>Name:</strong> {result.name}
        </div>

        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
        >
          <button
            onClick={handleCopy}
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
            {copied ? "Copied!" : "Copy Token"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--io-radius)",
              border: "none",
              background: "var(--io-accent)",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
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

  const handleDelete = (id: string, name: string) => {
    if (
      window.confirm(
        `Revoke SCIM token "${name}"? IdPs using this token will lose access.`,
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div>
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
            SCIM Provisioning
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            Bearer tokens for identity providers (Azure AD, Okta) to push user
            changes via SCIM 2.0. SCIM endpoint:{" "}
            <code style={{ fontSize: "12px" }}>/scim/v2</code>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "7px 14px",
            borderRadius: "var(--io-radius)",
            border: "1px solid var(--io-border)",
            background: "var(--io-accent)",
            color: "#fff",
            fontSize: "13px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
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
                <th
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
                  Name
                </th>
                <th
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
                  Created
                </th>
                <th
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
                  Last Used
                </th>
                <th
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
                  Status
                </th>
                <th style={{ padding: "10px 16px", width: "60px" }} />
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
                          ? "var(--io-success-subtle, #f0fdf4)"
                          : "var(--io-surface-secondary)",
                        color: token.enabled
                          ? "var(--io-success, #16a34a)"
                          : "var(--io-text-muted)",
                      }}
                    >
                      {token.enabled ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDelete(token.id, token.name)}
                      disabled={deleteMutation.isPending}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "var(--io-radius)",
                        border: "1px solid var(--io-border)",
                        background: "transparent",
                        color: "var(--io-error, #ef4444)",
                        fontSize: "12px",
                        cursor: "pointer",
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

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {newTokenResult && (
        <RevealModal
          result={newTokenResult}
          onClose={() => setNewTokenResult(null)}
        />
      )}
    </div>
  );
}
