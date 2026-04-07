import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  scimApi,
  ScimToken,
  CreateScimTokenPayload,
  CreateScimTokenResponse,
} from "../../api/scim";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
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
// SCIM setup guide data
// ---------------------------------------------------------------------------

interface ScimStep {
  title: string;
  nav?: string;
  body: string;
  code?: string;
  note?: string;
  warning?: string;
}

interface ScimIdpGuide {
  id: string;
  label: string;
  steps: ScimStep[];
}

function buildScimGuides(scimEndpointUrl: string): ScimIdpGuide[] {
  return [
    {
      id: "azure",
      label: "Microsoft Entra ID",
      steps: [
        {
          title: "Open your enterprise application",
          nav: "portal.azure.com → Microsoft Entra ID → Enterprise applications → (your app)",
          body: "Use the app you created for SAML or OIDC SSO. If you don't have one, create a new custom enterprise application first.",
        },
        {
          title: "Open Provisioning",
          nav: "Enterprise application → Provisioning (left sidebar)",
          body: "Click Provisioning, then set Provisioning Mode to Automatic.",
        },
        {
          title: "Enter the SCIM endpoint URL",
          nav: "Admin Credentials section",
          body: "Paste this URL into the Tenant URL field:",
          code: scimEndpointUrl,
        },
        {
          title: "Enter the bearer token",
          body: "Paste the token you generated above into the Secret Token field. Click Test Connection — it must succeed before you can continue.",
          warning:
            "The token is only shown once. If you didn't copy it, revoke it and create a new one.",
        },
        {
          title: "Review attribute mappings",
          nav: "Mappings section → Provision Azure Active Directory Users",
          body: 'Verify these key mappings are present:\n• userPrincipalName → userName\n• mail → emails[type eq "work"].value\n• givenName → name.givenName\n• surname → name.familyName\n• IsSoftDeleted → active (expression: Not([IsSoftDeleted]))\n• objectId → externalId',
        },
        {
          title: "Enable group sync (optional)",
          nav: "Mappings section → Provision Azure Active Directory Groups",
          body: "Enable the Groups mapping to sync Azure groups to I/O. This allows group-based role mapping.",
          note: "Azure syncs groups assigned to the application. Go to Users and groups in the app to add groups.",
        },
        {
          title: "Set scope and enable provisioning",
          nav: "Settings section",
          body: 'Set Scope to "Sync only assigned users and groups" for initial rollout. Add a notification email. Set Provisioning Status to On. Click Save.\n\nAzure will run the initial sync within ~40 minutes.',
          note: "Azure syncs every ~40 minutes. Users deprovisioned in Azure get active=false in I/O — they are never deleted.",
        },
      ],
    },
    {
      id: "okta",
      label: "Okta",
      steps: [
        {
          title: "Open your app's Provisioning tab",
          nav: "your-org.okta.com → Applications → (your app) → Provisioning tab",
          body: "If the Provisioning tab is not visible, the app may need SCIM enabled in its settings.",
        },
        {
          title: "Configure API Integration",
          body: "Click Configure API Integration. Check Enable API Integration.",
        },
        {
          title: "Enter the SCIM base URL",
          body: "SCIM connector base URL:",
          code: scimEndpointUrl,
        },
        {
          title: "Set authentication",
          body: "Authentication Mode: HTTP Header. In the Authorization field, paste your bearer token. Click Test API Credentials.",
          warning:
            "The token is only shown once. If you didn't copy it, revoke it and create a new one.",
        },
        {
          title: "Enable provisioning actions",
          nav: "Provisioning → To App",
          body: "Enable:\n• Create Users\n• Update User Attributes\n• Deactivate Users\n\nLeave Sync Password unchecked — I/O manages its own passwords.",
        },
        {
          title: "Push groups (optional)",
          nav: "Push Groups tab",
          body: "Add the Okta groups you want synced to I/O. Okta sends real-time updates when group membership changes.",
        },
        {
          title: "Assign users",
          nav: "Assignments tab",
          body: "Assign the users and groups that should be provisioned into I/O.",
          note: "Okta provisions near real-time on assignment changes, unlike Azure's ~40-minute polling cycle.",
        },
      ],
    },
    {
      id: "google",
      label: "Google Workspace",
      steps: [
        {
          title: "Check your Google edition",
          body: "Outbound SCIM provisioning to third-party apps requires Google Cloud Identity Enterprise or Google Workspace Enterprise edition.",
          warning:
            "Standard Google Workspace editions do not support outbound SCIM push. See the note below.",
        },
        {
          title: "Enable SCIM (Enterprise editions)",
          nav: "admin.google.com → Security → Authentication → SAML apps → (your app) → Provisioning",
          body: "For Cloud Identity Enterprise, enable auto-provisioning on your SAML app. Enter the SCIM endpoint URL and bearer token.",
          code: scimEndpointUrl,
        },
        {
          title: "Alternative: Use Okta or Entra as a SCIM bridge",
          body: "For standard Google Workspace, sync Google users to Okta or Azure AD, then configure SCIM provisioning from Okta/Azure to I/O. This is the most common approach for Google Workspace customers.",
          note: "For most Google Workspace deployments, use OIDC SSO with JIT Provisioning enabled — new users are created automatically on first login. Configure a default role in the auth provider settings.",
        },
      ],
    },
    {
      id: "other",
      label: "Other IdP",
      steps: [
        {
          title: "SCIM 2.0 endpoint",
          body: "Give your IdP this SCIM 2.0 base URL:",
          code: scimEndpointUrl,
        },
        {
          title: "Authentication",
          body: "I/O uses Bearer token authentication for SCIM. Paste the generated token into your IdP's Secret Token or Authorization field.",
          warning:
            "The token is only shown once when created. Copy it immediately.",
        },
        {
          title: "Required endpoint support",
          body: 'I/O implements the full SCIM 2.0 spec including:\n• GET /ServiceProviderConfig\n• GET/POST /Users\n• GET/PUT/PATCH/DELETE /Users/{id}\n• GET/POST /Groups\n• GET/PUT/PATCH/DELETE /Groups/{id}\n• Filtering: filter=userName eq "..."\n• Pagination: count and startIndex',
        },
        {
          title: "Supported user attributes",
          body: "Core schema: userName, name.formatted, name.givenName, name.familyName, emails[primary].value, active, externalId\n\nEnterprise schema (urn:ietf:params:scim:schemas:extension:enterprise:2.0:User): organization, department",
        },
        {
          title: "Group membership",
          body: "Groups are synced via the Groups resource. Members are referenced by SCIM User ID. I/O maps synced groups to I/O roles via the Role Mappings configured in each auth provider.",
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Setup guide component
// ---------------------------------------------------------------------------

interface ScimSetupGuideProps {
  scimEndpointUrl: string;
}

function ScimSetupGuide({ scimEndpointUrl }: ScimSetupGuideProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("azure");
  const guides = useMemo(
    () => buildScimGuides(scimEndpointUrl),
    [scimEndpointUrl],
  );
  const guide = guides.find((g) => g.id === selectedId) ?? guides[0];

  return (
    <div
      style={{
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        overflow: "hidden",
        marginTop: "32px",
      }}
    >
      {/* Guide toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: "var(--io-surface-secondary)",
          border: "none",
          borderBottom: open ? "1px solid var(--io-border)" : "none",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>📋</span>
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              IdP Configuration Guide
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-text-muted)",
                marginTop: "1px",
              }}
            >
              Step-by-step instructions for configuring SCIM in your identity
              provider
            </div>
          </div>
        </div>
        <span
          style={{
            color: "var(--io-text-muted)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>

      {open && (
        <div
          style={{ padding: "16px 20px 20px", background: "var(--io-surface)" }}
        >
          {/* IdP selector */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                fontSize: "12px",
                color: "var(--io-text-secondary)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              I'm using:
            </label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {guides.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "var(--io-radius)",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    border:
                      selectedId === g.id
                        ? "1.5px solid var(--io-accent)"
                        : "1px solid var(--io-border)",
                    background:
                      selectedId === g.id
                        ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
                        : "transparent",
                    color:
                      selectedId === g.id
                        ? "var(--io-accent)"
                        : "var(--io-text-secondary)",
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "12px",
            }}
          >
            {guide.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  padding: "14px 16px",
                  display: "flex",
                  gap: "12px",
                }}
              >
                {/* Step number */}
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "var(--io-accent)",
                    color: "var(--io-text-on-accent, #fff)",
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
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                      marginBottom: "3px",
                    }}
                  >
                    {step.title}
                  </div>

                  {step.nav && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--io-accent)",
                        fontFamily: "var(--io-font-mono, monospace)",
                        marginBottom: "5px",
                        lineHeight: 1.4,
                        wordBreak: "break-word",
                      }}
                    >
                      {step.nav}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--io-text-secondary)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {step.body}
                  </div>

                  {step.code && (
                    <div
                      style={{
                        marginTop: "6px",
                        padding: "6px 9px",
                        borderRadius: "var(--io-radius)",
                        background: "var(--io-surface-sunken)",
                        border: "1px solid var(--io-border)",
                        fontFamily: "var(--io-font-mono, monospace)",
                        fontSize: "11px",
                        color: "var(--io-text-primary)",
                        wordBreak: "break-all",
                      }}
                    >
                      {step.code}
                    </div>
                  )}

                  {step.note && (
                    <div
                      style={{
                        marginTop: "6px",
                        padding: "5px 8px",
                        borderRadius: "var(--io-radius)",
                        background:
                          "color-mix(in srgb, var(--io-info, #3b82f6) 10%, transparent)",
                        borderLeft: "2px solid var(--io-info, #3b82f6)",
                        fontSize: "11px",
                        color: "var(--io-text-secondary)",
                        lineHeight: 1.4,
                      }}
                    >
                      {step.note}
                    </div>
                  )}

                  {step.warning && (
                    <div
                      style={{
                        marginTop: "6px",
                        padding: "5px 8px",
                        borderRadius: "var(--io-radius)",
                        background:
                          "color-mix(in srgb, var(--io-warning) 12%, transparent)",
                        borderLeft: "2px solid var(--io-warning)",
                        fontSize: "11px",
                        color: "var(--io-text-secondary)",
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠ {step.warning}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
              onClick={() => {
                if (!name.trim()) {
                  setError("Name is required");
                  return;
                }
                createMutation.mutate({
                  name: name.trim(),
                  description: description.trim() || undefined,
                });
              }}
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
// Reveal dialog
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
              margin: "0 0 6px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            SCIM Token Created
          </Dialog.Title>
          <Dialog.Description style={{ display: "none" }}>
            Your new SCIM bearer token. Copy it now — it will not be shown
            again.
          </Dialog.Description>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "var(--io-radius)",
              background:
                "color-mix(in srgb, var(--io-warning) 12%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--io-warning) 40%, transparent)",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "16px" }}>⚠</span>
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--io-text-secondary)",
                fontWeight: 500,
              }}
            >
              Copy this token now — it will not be shown again.
            </p>
          </div>

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
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<ScimToken>();

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

  return (
    <div>
      {/* SCIM Endpoint + description */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "20px",
          alignItems: "flex-start",
          marginBottom: "24px",
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
            SCIM 2.0 Provisioning
          </h3>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
            }}
          >
            SCIM enables your identity provider to automatically create, update,
            and disable user accounts in I/O when changes happen in your
            directory. Tokens below authenticate IdP sync requests.
          </p>

          {/* Endpoint URL */}
          <div
            style={{
              background: "var(--io-surface-sunken)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
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
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(scimEndpointUrl);
                  setCopiedEndpoint(true);
                  setTimeout(() => setCopiedEndpoint(false), 2000);
                }}
                style={{ ...btnSmall, whiteSpace: "nowrap" }}
              >
                {copiedEndpoint ? "Copied!" : "Copy"}
              </button>
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "11px",
                color: "var(--io-text-muted)",
              }}
            >
              Provide this URL to your identity provider when configuring SCIM
              provisioning.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          style={{ ...btnPrimary, whiteSpace: "nowrap", marginTop: "28px" }}
        >
          + New Token
        </button>
      </div>

      {/* Token table */}
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
            padding: "32px",
            borderRadius: "var(--io-radius)",
            border: "1px solid var(--io-border)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "10px" }}>🔑</div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              margin: "0 0 6px",
              fontWeight: 500,
            }}
          >
            No SCIM tokens yet
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              margin: 0,
            }}
          >
            Create a token to enable IdP provisioning. Each IdP connection
            should use its own token.
          </p>
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
                {["Name", "Created", "Last Used", "Status", "Actions"].map(
                  (h) => (
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
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, idx) => (
                <tr
                  key={token.id}
                  onContextMenu={(e) => handleContextMenu(e, token)}
                  style={{
                    borderTop:
                      idx > 0 ? "1px solid var(--io-border)" : undefined,
                    cursor: "context-menu",
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

      {menuState?.data && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: menuState.data.name, disabled: true },
            {
              label: "Copy Token Name",
              onClick: () => {
                closeMenu();
                navigator.clipboard.writeText(menuState.data!.name);
              },
            },
            {
              label: "Revoke Token",
              danger: true,
              divider: true,
              permission: "scim:manage",
              onClick: () => {
                closeMenu();
                setConfirmRevoke({
                  id: menuState.data!.id,
                  name: menuState.data!.name,
                });
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}

      {/* IdP setup guide */}
      <ScimSetupGuide scimEndpointUrl={scimEndpointUrl} />

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
