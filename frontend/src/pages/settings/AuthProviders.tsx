import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authProvidersApi,
  AuthProviderConfig,
  IdpRoleMapping,
  CreateProviderBody,
} from "../../api/authProviders";
import { rolesApi, Role } from "../../api/roles";
import { api } from "../../api/client";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Provider type badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    oidc: "var(--io-accent)",
    saml: "var(--io-info, #3b82f6)",
    ldap: "var(--io-warning)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: "var(--io-surface-sunken)",
        color: colors[type] ?? "var(--io-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        border: `1px solid ${colors[type] ?? "var(--io-border)"}`,
      }}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Role mappings panel (expandable per provider)
// ---------------------------------------------------------------------------

function RoleMappings({ provider }: { provider: AuthProviderConfig }) {
  const qc = useQueryClient();
  const [newGroup, setNewGroup] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newMatchType, setNewMatchType] = useState("exact");

  const { data: mappingsResult, isLoading } = useQuery({
    queryKey: ["auth-provider-mappings", provider.id],
    queryFn: () => authProvidersApi.listMappings(provider.id),
  });

  const { data: rolesResult } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });

  const roles: Role[] = rolesResult?.success
    ? (rolesResult.data.data ?? [])
    : [];

  const createMutation = useMutation({
    mutationFn: (body: {
      idp_group: string;
      role_id: string;
      match_type: string;
    }) => authProvidersApi.createMapping(provider.id, body),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["auth-provider-mappings", provider.id],
      });
      setNewGroup("");
      setNewRoleId("");
      setNewMatchType("exact");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mappingId: string) =>
      authProvidersApi.deleteMapping(provider.id, mappingId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["auth-provider-mappings", provider.id],
      });
    },
  });

  const mappings: IdpRoleMapping[] = mappingsResult?.success
    ? mappingsResult.data
    : [];

  function handleAdd() {
    if (!newGroup.trim() || !newRoleId.trim()) return;
    createMutation.mutate({
      idp_group: newGroup.trim(),
      role_id: newRoleId.trim(),
      match_type: newMatchType,
    });
  }

  function getRoleName(roleId: string): string {
    const role = roles.find((r) => r.id === roleId);
    return role?.display_name ?? roleId;
  }

  return (
    <div
      style={{
        background: "var(--io-surface-sunken)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "12px 16px",
        marginTop: "8px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "10px",
        }}
      >
        Role Mappings
      </div>

      {isLoading ? (
        <p style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          Loading…
        </p>
      ) : mappings.length === 0 ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--io-text-muted)",
            marginBottom: "10px",
          }}
        >
          No role mappings configured.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "10px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
              {["IdP Group", "Role", "Match Type", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textAlign: "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr
                key={m.id}
                style={{ borderBottom: "1px solid var(--io-border)" }}
              >
                <td style={cellStyle}>{m.idp_group}</td>
                <td style={cellStyle}>{getRoleName(m.role_id)}</td>
                <td style={cellStyle}>{m.match_type}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  <button
                    style={{
                      ...btnSmall,
                      color: "var(--io-danger)",
                      borderColor: "var(--io-danger)",
                    }}
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(m.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add mapping row */}
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>IdP Group</label>
          <input
            style={inputStyle}
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="CN=Operators,DC=corp,DC=example"
          />
        </div>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Role</label>
          {roles.length > 0 ? (
            <select
              style={inputStyle}
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
            >
              <option value="">— Select role —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={inputStyle}
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              placeholder="Role ID or name"
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Match Type</label>
          <select
            style={inputStyle}
            value={newMatchType}
            onChange={(e) => setNewMatchType(e.target.value)}
          >
            <option value="exact">Exact</option>
            <option value="contains">Contains</option>
            <option value="prefix">Prefix</option>
          </select>
        </div>
        <div>
          <button
            style={btnPrimary}
            disabled={
              createMutation.isPending || !newGroup.trim() || !newRoleId.trim()
            }
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Structured config fields per provider type
// ---------------------------------------------------------------------------

interface OidcFieldsProps {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  onChange: (field: string, value: string) => void;
}

function OidcFields({
  issuerUrl,
  clientId,
  clientSecret,
  scopes,
  onChange,
}: OidcFieldsProps) {
  return (
    <>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Issuer URL</label>
        <input
          style={inputStyle}
          value={issuerUrl}
          onChange={(e) => onChange("issuerUrl", e.target.value)}
          placeholder="https://accounts.example.com"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Client ID</label>
        <input
          style={inputStyle}
          value={clientId}
          onChange={(e) => onChange("clientId", e.target.value)}
          placeholder="your-client-id"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Client Secret</label>
        <input
          style={{ ...inputStyle }}
          type="password"
          value={clientSecret}
          onChange={(e) => onChange("clientSecret", e.target.value)}
          placeholder="your-client-secret"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Scopes (comma-separated)</label>
        <input
          style={inputStyle}
          value={scopes}
          onChange={(e) => onChange("scopes", e.target.value)}
          placeholder="openid, profile, email"
        />
      </div>
    </>
  );
}

interface SamlFieldsProps {
  entityId: string;
  idpMetadataUrl: string;
  nameidFormat: string;
  onChange: (field: string, value: string) => void;
}

function SamlFields({
  entityId,
  idpMetadataUrl,
  nameidFormat,
  onChange,
}: SamlFieldsProps) {
  return (
    <>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Entity ID</label>
        <input
          style={inputStyle}
          value={entityId}
          onChange={(e) => onChange("entityId", e.target.value)}
          placeholder="https://your-app.example.com/saml"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>IdP Metadata URL</label>
        <input
          style={inputStyle}
          value={idpMetadataUrl}
          onChange={(e) => onChange("idpMetadataUrl", e.target.value)}
          placeholder="https://idp.example.com/metadata"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>NameID Format</label>
        <select
          style={inputStyle}
          value={nameidFormat}
          onChange={(e) => onChange("nameidFormat", e.target.value)}
        >
          <option value="email">Email</option>
          <option value="persistent">Persistent</option>
          <option value="transient">Transient</option>
        </select>
      </div>
    </>
  );
}

interface LdapFieldsProps {
  serverUrl: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  userFilter: string;
  onChange: (field: string, value: string) => void;
}

function LdapFields({
  serverUrl,
  bindDn,
  bindPassword,
  searchBase,
  userFilter,
  onChange,
}: LdapFieldsProps) {
  return (
    <>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Server URL</label>
        <input
          style={inputStyle}
          value={serverUrl}
          onChange={(e) => onChange("serverUrl", e.target.value)}
          placeholder="ldaps://dc.corp.example.com:636"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Bind DN</label>
        <input
          style={inputStyle}
          value={bindDn}
          onChange={(e) => onChange("bindDn", e.target.value)}
          placeholder="CN=ServiceAccount,DC=corp,DC=example"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Bind Password</label>
        <input
          style={inputStyle}
          type="password"
          value={bindPassword}
          onChange={(e) => onChange("bindPassword", e.target.value)}
          placeholder="Service account password"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Search Base</label>
        <input
          style={inputStyle}
          value={searchBase}
          onChange={(e) => onChange("searchBase", e.target.value)}
          placeholder="OU=Users,DC=corp,DC=example"
        />
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>User Filter</label>
        <input
          style={inputStyle}
          value={userFilter}
          onChange={(e) => onChange("userFilter", e.target.value)}
          placeholder="(&(sAMAccountName={username})(objectClass=user))"
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit provider dialog
// ---------------------------------------------------------------------------

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: AuthProviderConfig;
}

function ProviderDialog({ open, onOpenChange, existing }: ProviderDialogProps) {
  const qc = useQueryClient();
  const isEdit = Boolean(existing);

  const [providerType, setProviderType] = useState<"oidc" | "saml" | "ldap">(
    "oidc",
  );
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [jitProvisioning, setJitProvisioning] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [configJson, setConfigJson] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);

  // OIDC fields
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcScopes, setOidcScopes] = useState("openid, profile, email");

  // SAML fields
  const [samlEntityId, setSamlEntityId] = useState("");
  const [samlIdpMetadataUrl, setSamlIdpMetadataUrl] = useState("");
  const [samlNameidFormat, setSamlNameidFormat] = useState("email");

  // LDAP fields
  const [ldapServerUrl, setLdapServerUrl] = useState(
    "ldaps://dc.corp.example.com:636",
  );
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapBindPassword, setLdapBindPassword] = useState("");
  const [ldapSearchBase, setLdapSearchBase] = useState("");
  const [ldapUserFilter, setLdapUserFilter] = useState(
    "(&(sAMAccountName={username})(objectClass=user))",
  );

  // Reset all fields when dialog opens
  useEffect(() => {
    if (!open) return;
    const cfg = existing?.config ?? {};
    setProviderType(existing?.provider_type ?? "oidc");
    setName(existing?.name ?? "");
    setDisplayName(existing?.display_name ?? "");
    setEnabled(existing?.enabled ?? true);
    setJitProvisioning(existing?.jit_provisioning ?? false);
    setDisplayOrder(existing?.display_order ?? 0);
    setShowRaw(false);
    setConfigError(null);
    // OIDC
    setOidcIssuerUrl((cfg.issuer_url as string) ?? "");
    setOidcClientId((cfg.client_id as string) ?? "");
    setOidcClientSecret((cfg.client_secret as string) ?? "");
    setOidcScopes(
      (cfg.scopes as string[])?.join(", ") ?? "openid, profile, email",
    );
    // SAML
    setSamlEntityId((cfg.entity_id as string) ?? "");
    setSamlIdpMetadataUrl((cfg.idp_metadata_url as string) ?? "");
    setSamlNameidFormat((cfg.nameid_format as string) ?? "email");
    // LDAP
    setLdapServerUrl(
      (cfg.server_url as string) ?? "ldaps://dc.corp.example.com:636",
    );
    setLdapBindDn((cfg.bind_dn as string) ?? "");
    setLdapBindPassword((cfg.bind_password as string) ?? "");
    setLdapSearchBase((cfg.search_base as string) ?? "");
    setLdapUserFilter(
      (cfg.user_filter as string) ??
        "(&(sAMAccountName={username})(objectClass=user))",
    );
    // Sync raw JSON from existing config
    setConfigJson(
      existing
        ? JSON.stringify(existing.config, null, 2)
        : JSON.stringify(
            {
              issuer_url: "",
              client_id: "",
              client_secret: "",
              scopes: ["openid", "profile", "email"],
            },
            null,
            2,
          ),
    );
  }, [open, existing]);

  function buildConfigFromFields(): Record<string, unknown> {
    switch (providerType) {
      case "oidc":
        return {
          issuer_url: oidcIssuerUrl.trim(),
          client_id: oidcClientId.trim(),
          client_secret: oidcClientSecret.trim(),
          scopes: oidcScopes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
      case "saml":
        return {
          entity_id: samlEntityId.trim(),
          idp_metadata_url: samlIdpMetadataUrl.trim(),
          nameid_format: samlNameidFormat,
        };
      case "ldap":
        return {
          server_url: ldapServerUrl.trim(),
          bind_dn: ldapBindDn.trim(),
          bind_password: ldapBindPassword.trim(),
          search_base: ldapSearchBase.trim(),
          user_filter: ldapUserFilter.trim(),
        };
    }
  }

  function handleOidcChange(field: string, value: string) {
    if (field === "issuerUrl") setOidcIssuerUrl(value);
    else if (field === "clientId") setOidcClientId(value);
    else if (field === "clientSecret") setOidcClientSecret(value);
    else if (field === "scopes") setOidcScopes(value);
  }

  function handleSamlChange(field: string, value: string) {
    if (field === "entityId") setSamlEntityId(value);
    else if (field === "idpMetadataUrl") setSamlIdpMetadataUrl(value);
    else if (field === "nameidFormat") setSamlNameidFormat(value);
  }

  function handleLdapChange(field: string, value: string) {
    if (field === "serverUrl") setLdapServerUrl(value);
    else if (field === "bindDn") setLdapBindDn(value);
    else if (field === "bindPassword") setLdapBindPassword(value);
    else if (field === "searchBase") setLdapSearchBase(value);
    else if (field === "userFilter") setLdapUserFilter(value);
  }

  function handleToggleRaw() {
    if (!showRaw) {
      // Sync structured → JSON before opening raw editor
      setConfigJson(JSON.stringify(buildConfigFromFields(), null, 2));
    }
    setShowRaw((v) => !v);
  }

  function handleTypeChange(t: "oidc" | "saml" | "ldap") {
    setProviderType(t);
    if (!isEdit) {
      // Reset structured fields to defaults for new type
      if (t === "oidc") {
        setOidcIssuerUrl("");
        setOidcClientId("");
        setOidcClientSecret("");
        setOidcScopes("openid, profile, email");
      } else if (t === "saml") {
        setSamlEntityId("");
        setSamlIdpMetadataUrl("");
        setSamlNameidFormat("email");
      } else {
        setLdapServerUrl("ldaps://dc.corp.example.com:636");
        setLdapBindDn("");
        setLdapBindPassword("");
        setLdapSearchBase("");
        setLdapUserFilter("(&(sAMAccountName={username})(objectClass=user))");
      }
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateProviderBody) => authProvidersApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-providers"] });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: CreateProviderBody) =>
      authProvidersApi.update(existing!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-providers"] });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfigError(null);

    let parsedConfig: Record<string, unknown>;
    if (showRaw) {
      try {
        parsedConfig = JSON.parse(configJson) as Record<string, unknown>;
      } catch {
        setConfigError("Invalid JSON in configuration");
        return;
      }
    } else {
      parsedConfig = buildConfigFromFields();
    }

    const body: CreateProviderBody = {
      provider_type: providerType,
      name: name.trim(),
      display_name: displayName.trim(),
      enabled,
      config: parsedConfig,
      jit_provisioning: jitProvisioning,
      display_order: displayOrder,
    };

    if (isEdit) {
      updateMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError =
    (createMutation.error instanceof Error
      ? createMutation.error.message
      : null) ??
    (updateMutation.error instanceof Error
      ? updateMutation.error.message
      : null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
            borderRadius: "10px",
            padding: "28px",
            width: "560px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 64px)",
            overflowY: "auto",
          }}
        >
          <Dialog.Title
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              marginBottom: "20px",
            }}
          >
            {isEdit ? "Edit Auth Provider" : "Add Auth Provider"}
          </Dialog.Title>

          <form onSubmit={handleSubmit}>
            {/* Provider type */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Provider Type</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["oidc", "saml", "ldap"] as const).map((t) => (
                  <label
                    key={t}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "var(--io-text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="providerType"
                      value={t}
                      checked={providerType === t}
                      onChange={() => handleTypeChange(t)}
                      disabled={isEdit}
                    />
                    {t.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Name (internal identifier)</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. corporate-oidc"
                required
                pattern="[a-z0-9_-]+"
                title="Lowercase letters, numbers, hyphens, underscores only"
              />
            </div>

            {/* Display name */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>
                Display Name (shown on login page)
              </label>
              <input
                style={inputStyle}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Corporate SSO"
                required
              />
            </div>

            {/* Display order */}
            <div style={{ marginBottom: "14px" }}>
              <label style={labelStyle}>Display Order</label>
              <input
                style={{ ...inputStyle, width: "100px" }}
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                min={0}
              />
            </div>

            {/* Toggles */}
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "var(--io-text-secondary)",
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
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={jitProvisioning}
                  onChange={(e) => setJitProvisioning(e.target.checked)}
                />
                JIT Provisioning
              </label>
            </div>

            {/* Structured config fields */}
            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <label style={labelStyle}>Configuration</label>
                <button
                  type="button"
                  onClick={handleToggleRaw}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--io-accent)",
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {showRaw ? "Use Structured Fields" : "Edit Raw JSON"}
                </button>
              </div>

              {!showRaw && (
                <>
                  {providerType === "oidc" && (
                    <OidcFields
                      issuerUrl={oidcIssuerUrl}
                      clientId={oidcClientId}
                      clientSecret={oidcClientSecret}
                      scopes={oidcScopes}
                      onChange={handleOidcChange}
                    />
                  )}
                  {providerType === "saml" && (
                    <SamlFields
                      entityId={samlEntityId}
                      idpMetadataUrl={samlIdpMetadataUrl}
                      nameidFormat={samlNameidFormat}
                      onChange={handleSamlChange}
                    />
                  )}
                  {providerType === "ldap" && (
                    <LdapFields
                      serverUrl={ldapServerUrl}
                      bindDn={ldapBindDn}
                      bindPassword={ldapBindPassword}
                      searchBase={ldapSearchBase}
                      userFilter={ldapUserFilter}
                      onChange={handleLdapChange}
                    />
                  )}
                </>
              )}

              {showRaw && (
                <div style={{ marginBottom: "16px" }}>
                  <textarea
                    style={{
                      ...inputStyle,
                      fontFamily: "monospace",
                      fontSize: "12px",
                      minHeight: "160px",
                      resize: "vertical",
                      lineHeight: 1.5,
                    }}
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {configError && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--io-danger)",
                  marginBottom: "12px",
                }}
              >
                {configError}
              </p>
            )}

            {mutationError && (
              <div
                style={{
                  background: "var(--io-danger-subtle)",
                  border: "1px solid var(--io-danger)",
                  borderRadius: "var(--io-radius)",
                  padding: "8px 12px",
                  color: "var(--io-danger)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {mutationError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <Dialog.Close asChild>
                <button type="button" style={btnSecondary}>
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" style={btnPrimary} disabled={isPending}>
                {isPending
                  ? "Saving…"
                  : isEdit
                    ? "Save Changes"
                    : "Add Provider"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Provider row with expandable mappings
// ---------------------------------------------------------------------------

interface ProviderRowProps {
  provider: AuthProviderConfig;
}

function ProviderRow({ provider }: ProviderRowProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => authProvidersApi.delete(provider.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-providers"] }),
  });

  const handleTest = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const result = await api.post<{ message: string }>(
        `/api/auth/admin/providers/${provider.id}/test`,
        {},
      );
      if (result.success) {
        setTestStatus({
          ok: true,
          message:
            (result.data as { message?: string }).message ??
            "Connection successful",
        });
      } else {
        const err = result as { success: false; error?: { message: string } };
        setTestStatus({
          ok: false,
          message: err.error?.message ?? "Test failed",
        });
      }
    } catch {
      setTestStatus({ ok: false, message: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
        <td style={cellStyle}>
          <span style={{ fontWeight: 500, color: "var(--io-text-primary)" }}>
            {provider.display_name}
          </span>
          <br />
          <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
            {provider.name}
          </span>
        </td>
        <td style={cellStyle}>
          <TypeBadge type={provider.provider_type} />
        </td>
        <td style={cellStyle}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: provider.enabled
                ? "var(--io-success)"
                : "var(--io-text-muted)",
            }}
          >
            {provider.enabled ? "Enabled" : "Disabled"}
          </span>
        </td>
        <td style={cellStyle}>{provider.display_order}</td>
        <td style={{ ...cellStyle, textAlign: "right" }}>
          <div
            style={{
              display: "flex",
              gap: "6px",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {testStatus && (
              <span
                style={{
                  fontSize: "12px",
                  color: testStatus.ok
                    ? "var(--io-success)"
                    : "var(--io-danger)",
                }}
              >
                {testStatus.message}
              </span>
            )}
            <button style={btnSmall} disabled={testing} onClick={handleTest}>
              {testing ? "Testing…" : "Test"}
            </button>
            <button style={btnSmall} onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide Mappings" : "Mappings"}
            </button>
            <button style={btnSmall} onClick={() => setEditOpen(true)}>
              Edit
            </button>
            <button
              style={{
                ...btnSmall,
                color: "var(--io-danger)",
                borderColor: "var(--io-danger)",
              }}
              disabled={deleteMutation.isPending}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: "0 14px 14px" }}>
            <RoleMappings provider={provider} />
          </td>
        </tr>
      )}

      <ProviderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={provider}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${provider.display_name}"?`}
        description="This auth provider will be permanently removed. Users who sign in via this provider will no longer be able to authenticate."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuthProvidersPage() {
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: providersResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => authProvidersApi.list(),
  });

  const providers: AuthProviderConfig[] = providersResult?.success
    ? providersResult.data
    : [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              margin: "0 0 4px",
            }}
          >
            Auth Providers
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--io-text-muted)",
              margin: 0,
            }}
          >
            Configure OIDC, SAML, and LDAP identity providers for SSO.
          </p>
        </div>

        <button style={btnPrimary} onClick={() => setAddOpen(true)}>
          + Add Provider
        </button>
      </div>

      {/* Provider table */}
      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <p
            style={{
              padding: "24px",
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Loading providers…
          </p>
        ) : error ? (
          <p
            style={{
              padding: "24px",
              fontSize: "13px",
              color: "var(--io-danger)",
            }}
          >
            Failed to load providers.
          </p>
        ) : providers.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p
              style={{
                fontSize: "14px",
                color: "var(--io-text-muted)",
                margin: "0 0 16px",
              }}
            >
              No auth providers configured.
            </p>
            <button style={btnPrimary} onClick={() => setAddOpen(true)}>
              Add your first provider
            </button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
                {["Provider", "Type", "Status", "Order", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      textAlign: h === "Actions" ? "right" : "left",
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
              {providers.map((p) => (
                <ProviderRow key={p.id} provider={p} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add provider dialog */}
      <ProviderDialog open={addOpen} onOpenChange={setAddOpen} />

      <style>{`
        input[type="checkbox"] { accent-color: var(--io-accent); cursor: pointer; }
        input[type="radio"] { accent-color: var(--io-accent); cursor: pointer; }
        select option { background: var(--io-surface-secondary); color: var(--io-text-primary); }
      `}</style>
    </div>
  );
}
