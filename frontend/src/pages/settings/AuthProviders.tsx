import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  authProvidersApi,
  AuthProviderConfig,
  IdpRoleMapping,
  CreateProviderBody,
} from '../../api/authProviders'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--io-text-secondary)',
  marginBottom: '5px',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--io-accent)',
  color: '#09090b',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  cursor: 'pointer',
}

const btnSmall: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  borderRadius: 'var(--io-radius)',
  cursor: 'pointer',
  border: '1px solid var(--io-border)',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: 'var(--io-text-secondary)',
  verticalAlign: 'middle',
}

// ---------------------------------------------------------------------------
// Config templates
// ---------------------------------------------------------------------------

const CONFIG_TEMPLATES: Record<string, Record<string, unknown>> = {
  oidc: {
    issuer_url: '',
    client_id: '',
    client_secret: '',
    scopes: ['openid', 'profile', 'email'],
  },
  saml: {
    entity_id: '',
    idp_metadata_url: '',
    nameid_format: 'email',
  },
  ldap: {
    server_url: 'ldaps://dc.corp.example.com:636',
    bind_dn: '',
    bind_password: '',
    search_base: '',
    user_filter: '(&(sAMAccountName={username})(objectClass=user))',
  },
}

// ---------------------------------------------------------------------------
// Provider type badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    oidc: 'var(--io-accent)',
    saml: 'var(--io-info, #3b82f6)',
    ldap: 'var(--io-warning)',
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: 'var(--io-surface-sunken)',
        color: colors[type] ?? 'var(--io-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        border: `1px solid ${colors[type] ?? 'var(--io-border)'}`,
      }}
    >
      {type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Role mappings panel (expandable per provider)
// ---------------------------------------------------------------------------

function RoleMappings({ provider }: { provider: AuthProviderConfig }) {
  const qc = useQueryClient()
  const [newGroup, setNewGroup] = useState('')
  const [newRoleId, setNewRoleId] = useState('')
  const [newMatchType, setNewMatchType] = useState('exact')

  const { data: mappingsResult, isLoading } = useQuery({
    queryKey: ['auth-provider-mappings', provider.id],
    queryFn: () => authProvidersApi.listMappings(provider.id),
  })

  const createMutation = useMutation({
    mutationFn: (body: { idp_group: string; role_id: string; match_type: string }) =>
      authProvidersApi.createMapping(provider.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-provider-mappings', provider.id] })
      setNewGroup('')
      setNewRoleId('')
      setNewMatchType('exact')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (mappingId: string) =>
      authProvidersApi.deleteMapping(provider.id, mappingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-provider-mappings', provider.id] })
    },
  })

  const mappings: IdpRoleMapping[] =
    mappingsResult?.success ? mappingsResult.data : []

  function handleAdd() {
    if (!newGroup.trim() || !newRoleId.trim()) return
    createMutation.mutate({ idp_group: newGroup.trim(), role_id: newRoleId.trim(), match_type: newMatchType })
  }

  return (
    <div
      style={{
        background: 'var(--io-surface-sunken)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: '12px 16px',
        marginTop: '8px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '10px',
        }}
      >
        Role Mappings
      </div>

      {isLoading ? (
        <p style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>Loading…</p>
      ) : mappings.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--io-text-muted)', marginBottom: '10px' }}>
          No role mappings configured.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
              {['IdP Group', 'Role ID', 'Match Type', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--io-text-muted)',
                    textAlign: 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--io-border)' }}>
                <td style={cellStyle}>{m.idp_group}</td>
                <td style={cellStyle}>{m.role_id}</td>
                <td style={cellStyle}>{m.match_type}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  <button
                    style={{ ...btnSmall, color: 'var(--io-danger)', borderColor: 'var(--io-danger)' }}
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
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
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
          <label style={labelStyle}>Role ID</label>
          <input
            style={inputStyle}
            value={newRoleId}
            onChange={(e) => setNewRoleId(e.target.value)}
            placeholder="uuid or role name"
          />
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
            disabled={createMutation.isPending || !newGroup.trim() || !newRoleId.trim()}
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit provider dialog
// ---------------------------------------------------------------------------

interface ProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: AuthProviderConfig
}

function ProviderDialog({ open, onOpenChange, existing }: ProviderDialogProps) {
  const qc = useQueryClient()
  const isEdit = Boolean(existing)

  const [providerType, setProviderType] = useState<'oidc' | 'saml' | 'ldap'>(
    existing?.provider_type ?? 'oidc',
  )
  const [name, setName] = useState(existing?.name ?? '')
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '')
  const [enabled, setEnabled] = useState(existing?.enabled ?? true)
  const [jitProvisioning, setJitProvisioning] = useState(existing?.jit_provisioning ?? false)
  const [displayOrder, setDisplayOrder] = useState(existing?.display_order ?? 0)
  const [configJson, setConfigJson] = useState(
    existing ? JSON.stringify(existing.config, null, 2) : JSON.stringify(CONFIG_TEMPLATES['oidc'], null, 2),
  )
  const [configError, setConfigError] = useState<string | null>(null)

  // When type changes and not editing, update config template
  function handleTypeChange(t: 'oidc' | 'saml' | 'ldap') {
    setProviderType(t)
    if (!isEdit) {
      setConfigJson(JSON.stringify(CONFIG_TEMPLATES[t], null, 2))
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateProviderBody) => authProvidersApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-providers'] })
      onOpenChange(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: CreateProviderBody) => authProvidersApi.update(existing!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-providers'] })
      onOpenChange(false)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setConfigError(null)
    let parsedConfig: Record<string, unknown>
    try {
      parsedConfig = JSON.parse(configJson) as Record<string, unknown>
    } catch {
      setConfigError('Invalid JSON in configuration')
      return
    }

    const body: CreateProviderBody = {
      provider_type: providerType,
      name: name.trim(),
      display_name: displayName.trim(),
      enabled,
      config: parsedConfig,
      jit_provisioning: jitProvisioning,
      display_order: displayOrder,
    }

    if (isEdit) {
      updateMutation.mutate(body)
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const mutationError =
    (createMutation.error instanceof Error ? createMutation.error.message : null) ??
    (updateMutation.error instanceof Error ? updateMutation.error.message : null)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 101,
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '28px',
            width: '560px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          <Dialog.Title
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              marginBottom: '20px',
            }}
          >
            {isEdit ? 'Edit Auth Provider' : 'Add Auth Provider'}
          </Dialog.Title>

          <form onSubmit={handleSubmit}>
            {/* Provider type */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Provider Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['oidc', 'saml', 'ldap'] as const).map((t) => (
                  <label
                    key={t}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--io-text-secondary)',
                      cursor: 'pointer',
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
            <div style={{ marginBottom: '14px' }}>
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
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Display Name (shown on login page)</label>
              <input
                style={inputStyle}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Corporate SSO"
                required
              />
            </div>

            {/* Display order */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Display Order</label>
              <input
                style={{ ...inputStyle, width: '100px' }}
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                min={0}
              />
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--io-text-secondary)',
                  cursor: 'pointer',
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--io-text-secondary)',
                  cursor: 'pointer',
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

            {/* Config JSON */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Configuration (JSON)</label>
              <textarea
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  minHeight: '160px',
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                spellCheck={false}
              />
              {configError && (
                <p style={{ fontSize: '12px', color: 'var(--io-danger)', marginTop: '4px' }}>
                  {configError}
                </p>
              )}
            </div>

            {mutationError && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--io-radius)',
                  padding: '8px 12px',
                  color: 'var(--io-danger)',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {mutationError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Dialog.Close asChild>
                <button type="button" style={btnSecondary}>
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" style={btnPrimary} disabled={isPending}>
                {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Provider row with expandable mappings
// ---------------------------------------------------------------------------

interface ProviderRowProps {
  provider: AuthProviderConfig
}

function ProviderRow({ provider }: ProviderRowProps) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => authProvidersApi.delete(provider.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth-providers'] }),
  })

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
        <td style={cellStyle}>
          <span style={{ fontWeight: 500, color: 'var(--io-text-primary)' }}>
            {provider.display_name}
          </span>
          <br />
          <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>{provider.name}</span>
        </td>
        <td style={cellStyle}>
          <TypeBadge type={provider.provider_type} />
        </td>
        <td style={cellStyle}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: provider.enabled ? 'var(--io-success)' : 'var(--io-text-muted)',
            }}
          >
            {provider.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </td>
        <td style={cellStyle}>{provider.display_order}</td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              style={btnSmall}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide Mappings' : 'Mappings'}
            </button>
            <button style={btnSmall} onClick={() => setEditOpen(true)}>
              Edit
            </button>
            <button
              style={{ ...btnSmall, color: 'var(--io-danger)', borderColor: 'var(--io-danger)' }}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Delete provider "${provider.display_name}"?`)) {
                  deleteMutation.mutate()
                }
              }}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: '0 14px 14px' }}>
            <RoleMappings provider={provider} />
          </td>
        </tr>
      )}

      <ProviderDialog open={editOpen} onOpenChange={setEditOpen} existing={provider} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuthProvidersPage() {
  const [addOpen, setAddOpen] = useState(false)

  const { data: providersResult, isLoading, error } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => authProvidersApi.list(),
  })

  const providers: AuthProviderConfig[] = providersResult?.success
    ? providersResult.data
    : []

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              margin: '0 0 4px',
            }}
          >
            Auth Providers
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--io-text-muted)', margin: 0 }}>
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
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <p style={{ padding: '24px', fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Loading providers…
          </p>
        ) : error ? (
          <p style={{ padding: '24px', fontSize: '13px', color: 'var(--io-danger)' }}>
            Failed to load providers.
          </p>
        ) : providers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--io-text-muted)',
                margin: '0 0 16px',
              }}
            >
              No auth providers configured.
            </p>
            <button style={btnPrimary} onClick={() => setAddOpen(true)}>
              Add your first provider
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
                {['Provider', 'Type', 'Status', 'Order', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--io-text-muted)',
                      textAlign: h === 'Actions' ? 'right' : 'left',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
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
  )
}
