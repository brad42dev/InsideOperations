import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  emailApi,
  EmailProvider,
  EmailTemplate,
  EmailQueueItem,
  CreateProviderRequest,
  CreateTemplateRequest,
} from '../../api/email'

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

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: 'var(--io-danger)',
  borderColor: 'var(--io-danger)',
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: 'var(--io-text-secondary)',
  verticalAlign: 'middle',
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--io-warning)',
  retry: 'var(--io-warning)',
  sent: 'var(--io-success)',
  failed: 'var(--io-danger)',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'var(--io-text-muted)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: '12px',
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tab component
// ---------------------------------------------------------------------------

function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[]
  active: string
  onChange: (t: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        borderBottom: '1px solid var(--io-border)',
        marginBottom: '20px',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: active === t ? 600 : 400,
            color: active === t ? 'var(--io-accent)' : 'var(--io-text-secondary)',
            background: 'transparent',
            border: 'none',
            borderBottom: active === t ? '2px solid var(--io-accent)' : '2px solid transparent',
            cursor: 'pointer',
            marginBottom: '-1px',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Providers tab
// ---------------------------------------------------------------------------

function ProvidersTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editProvider, setEditProvider] = useState<EmailProvider | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['email-providers'],
    queryFn: async () => {
      const res = await emailApi.listProviders()
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailApi.deleteProvider(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-providers'] }),
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => emailApi.testProvider(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-providers'] }),
  })

  const providers = data ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Email Providers
        </h3>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>
          Add Provider
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</p>
      ) : providers.length === 0 ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>No providers configured.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
              {['Name', 'Type', 'From', 'Default', 'Status', 'Last Test', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cellStyle,
                    fontWeight: 600,
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    textAlign: 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--io-border)' }}>
                <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--io-text-primary)' }}>{p.name}</td>
                <td style={cellStyle}>{p.provider_type}</td>
                <td style={cellStyle}>{p.from_name ? `${p.from_name} <${p.from_address}>` : p.from_address}</td>
                <td style={cellStyle}>{p.is_default ? '✓' : '—'}</td>
                <td style={cellStyle}><StatusBadge status={p.enabled ? 'active' : 'disabled'} /></td>
                <td style={cellStyle}>
                  {p.last_tested_at
                    ? p.last_test_ok
                      ? <span style={{ color: 'var(--io-success)' }}>OK</span>
                      : <span style={{ color: 'var(--io-danger)' }}>Failed</span>
                    : '—'}
                </td>
                <td style={{ ...cellStyle, display: 'flex', gap: '8px' }}>
                  <button
                    style={btnSecondary}
                    onClick={() => testMutation.mutate(p.id)}
                    disabled={testMutation.isPending}
                  >
                    Test
                  </button>
                  <button style={btnSecondary} onClick={() => setEditProvider(p)}>
                    Edit
                  </button>
                  <button
                    style={btnDanger}
                    onClick={() => {
                      if (confirm(`Delete provider "${p.name}"?`)) deleteMutation.mutate(p.id)
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(showAdd || editProvider) && (
        <ProviderDialog
          provider={editProvider}
          onClose={() => {
            setShowAdd(false)
            setEditProvider(null)
          }}
        />
      )}
    </div>
  )
}

function ProviderDialog({
  provider,
  onClose,
}: {
  provider: EmailProvider | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!provider

  const [name, setName] = useState(provider?.name ?? '')
  const [providerType, setProviderType] = useState(provider?.provider_type ?? 'smtp')
  const [fromAddress, setFromAddress] = useState(provider?.from_address ?? '')
  const [fromName, setFromName] = useState(provider?.from_name ?? '')
  const [isDefault, setIsDefault] = useState(provider?.is_default ?? false)
  const [enabled, setEnabled] = useState(provider?.enabled ?? true)
  const [configStr, setConfigStr] = useState(
    provider?.config ? JSON.stringify(provider.config, null, 2) : '{}'
  )
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (data: CreateProviderRequest) => emailApi.createProvider(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-providers'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreateProviderRequest) =>
      emailApi.updateProvider(provider!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-providers'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSave() {
    setError('')
    let config: Record<string, unknown>
    try {
      config = JSON.parse(configStr)
    } catch {
      setError('Config must be valid JSON')
      return
    }
    const payload: CreateProviderRequest = {
      name,
      provider_type: providerType,
      config,
      from_address: fromAddress,
      from_name: fromName || undefined,
      is_default: isDefault,
      enabled,
    }
    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            width: '520px',
            maxHeight: '80vh',
            overflowY: 'auto',
            zIndex: 101,
          }}
        >
          <Dialog.Title style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            {isEdit ? 'Edit Provider' : 'Add Provider'}
          </Dialog.Title>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={providerType} onChange={(e) => setProviderType(e.target.value)}>
                <option value="smtp">SMTP</option>
                <option value="smtp_xoauth2">SMTP (XOAUTH2)</option>
                <option value="ms_graph">Microsoft Graph</option>
                <option value="gmail">Gmail (Service Account)</option>
                <option value="ses">Amazon SES</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>From Address</label>
              <input style={inputStyle} value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>From Name (optional)</label>
              <input style={inputStyle} value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>
                Config (JSON) — smtp: {'{host, port, username, password}'} · smtp_xoauth2: {'{host, port, username, client_id, client_secret, tenant_id}'} · ms_graph: {'{tenant_id, client_id, client_secret}'} · gmail: {'{service_account_key}'} · ses: {'{region, access_key_id, secret_access_key}'} · webhook: {'{url}'}
              </label>
              <textarea
                style={{ ...inputStyle, height: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                value={configStr}
                onChange={(e) => setConfigStr(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Default provider
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enabled
              </label>
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--io-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button style={btnSecondary} onClick={onClose}>Cancel</button>
            <button style={btnPrimary} onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Templates tab
// ---------------------------------------------------------------------------

function TemplatesTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)
  const [previewVars, setPreviewVars] = useState('{}')
  const [preview, setPreview] = useState<{ subject: string; body_html: string; body_text?: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await emailApi.listTemplates()
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  })

  const renderMutation = useMutation({
    mutationFn: async ({ id, vars }: { id: string; vars: string }) => {
      let variables: Record<string, unknown> = {}
      try { variables = JSON.parse(vars) } catch { /* ignore */ }
      const res = await emailApi.renderTemplate(id, variables)
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    onSuccess: (data) => setPreview(data),
  })

  const templates = data ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Email Templates
        </h3>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>
          Add Template
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</p>
      ) : templates.length === 0 ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>No templates defined.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
              {['Name', 'Category', 'Subject', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cellStyle,
                    fontWeight: 600,
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    textAlign: 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--io-border)' }}>
                <td style={{ ...cellStyle, fontWeight: 500, color: 'var(--io-text-primary)' }}>{t.name}</td>
                <td style={cellStyle}>{t.category}</td>
                <td style={{ ...cellStyle, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject_template}
                </td>
                <td style={{ ...cellStyle, display: 'flex', gap: '8px' }}>
                  <button
                    style={btnSecondary}
                    onClick={() => {
                      setPreviewTemplate(t)
                      setPreview(null)
                      setPreviewVars('{}')
                    }}
                  >
                    Preview
                  </button>
                  <button style={btnSecondary} onClick={() => setEditTemplate(t)}>Edit</button>
                  <button
                    style={btnDanger}
                    onClick={() => {
                      if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id)
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(showAdd || editTemplate) && (
        <TemplateDialog
          template={editTemplate}
          onClose={() => {
            setShowAdd(false)
            setEditTemplate(null)
          }}
        />
      )}

      {previewTemplate && (
        <Dialog.Root open onOpenChange={(open) => !open && setPreviewTemplate(null)}>
          <Dialog.Portal>
            <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />
            <Dialog.Content
              aria-describedby={undefined}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                padding: '24px',
                width: '600px',
                maxHeight: '80vh',
                overflowY: 'auto',
                zIndex: 101,
              }}
            >
              <Dialog.Title style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                Preview: {previewTemplate.name}
              </Dialog.Title>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Variables (JSON)</label>
                <textarea
                  style={{ ...inputStyle, height: '80px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                  value={previewVars}
                  onChange={(e) => setPreviewVars(e.target.value)}
                />
              </div>
              <button
                style={btnPrimary}
                onClick={() => renderMutation.mutate({ id: previewTemplate.id, vars: previewVars })}
                disabled={renderMutation.isPending}
              >
                {renderMutation.isPending ? 'Rendering…' : 'Render'}
              </button>
              {preview && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '4px' }}>SUBJECT</div>
                    <div style={{ padding: '8px 10px', background: 'var(--io-surface-sunken)', borderRadius: 'var(--io-radius)', fontSize: '13px' }}>
                      {preview.subject}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '4px' }}>HTML BODY</div>
                    <div
                      style={{
                        padding: '10px',
                        background: '#fff',
                        border: '1px solid var(--io-border)',
                        borderRadius: 'var(--io-radius)',
                        color: '#000',
                        fontSize: '13px',
                        maxHeight: '200px',
                        overflow: 'auto',
                      }}
                      dangerouslySetInnerHTML={{ __html: preview.body_html }}
                    />
                  </div>
                  {preview.body_text && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '4px' }}>TEXT BODY</div>
                      <pre
                        style={{
                          padding: '8px 10px',
                          background: 'var(--io-surface-sunken)',
                          borderRadius: 'var(--io-radius)',
                          fontSize: '12px',
                          whiteSpace: 'pre-wrap',
                          margin: 0,
                        }}
                      >
                        {preview.body_text}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button style={btnSecondary} onClick={() => setPreviewTemplate(null)}>Close</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: EmailTemplate | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!template

  const [name, setName] = useState(template?.name ?? '')
  const [category, setCategory] = useState(template?.category ?? 'custom')
  const [subjectTemplate, setSubjectTemplate] = useState(template?.subject_template ?? '')
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? '')
  const [bodyText, setBodyText] = useState(template?.body_text ?? '')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) => emailApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreateTemplateRequest) =>
      emailApi.updateTemplate(template!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSave() {
    setError('')
    const payload: CreateTemplateRequest = {
      name,
      category: category || 'custom',
      subject_template: subjectTemplate,
      body_html: bodyHtml,
      body_text: bodyText || undefined,
    }
    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            width: '680px',
            maxHeight: '85vh',
            overflowY: 'auto',
            zIndex: 101,
          }}
        >
          <Dialog.Title style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            {isEdit ? 'Edit Template' : 'Add Template'}
          </Dialog.Title>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="custom">Custom</option>
                  <option value="system">System</option>
                  <option value="alert">Alert</option>
                  <option value="report">Report</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Subject (use {'{{variable}}'} placeholders)</label>
              <input style={inputStyle} value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>HTML Body</label>
              <textarea
                style={{ ...inputStyle, height: '160px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Plain Text Body (optional)</label>
              <textarea
                style={{ ...inputStyle, height: '80px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--io-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button style={btnSecondary} onClick={onClose}>Cancel</button>
            <button style={btnPrimary} onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Queue tab
// ---------------------------------------------------------------------------

const QUEUE_STATUSES = ['', 'pending', 'retry', 'sent', 'failed']

function QueueTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null)

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['email-queue', statusFilter],
    queryFn: async () => {
      const res = await emailApi.listQueue(statusFilter ? { status: statusFilter } : {})
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    refetchInterval: 15000,
  })

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ['email-delivery-log', selectedQueueId],
    queryFn: async () => {
      const res = await emailApi.listDeliveryLog(
        selectedQueueId ? { queue_id: selectedQueueId } : {},
      )
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
  })

  const items = queueData ?? []
  const logItems = logData ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Email Queue
        </h3>
        <select
          style={{ ...inputStyle, width: 'auto' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {QUEUE_STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
      </div>

      {queueLoading ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>No queue items.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
              {['To', 'Subject', 'Status', 'Attempts', 'Created', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    ...cellStyle,
                    fontWeight: 600,
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    textAlign: 'left',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item: EmailQueueItem) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--io-border)',
                  background: selectedQueueId === item.id ? 'var(--io-accent-subtle)' : 'transparent',
                }}
              >
                <td style={cellStyle}>{item.to_addresses.join(', ')}</td>
                <td
                  style={{
                    ...cellStyle,
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.subject}
                </td>
                <td style={cellStyle}><StatusBadge status={item.status} /></td>
                <td style={cellStyle}>{item.attempts}/{item.max_attempts}</td>
                <td style={cellStyle}>{new Date(item.created_at).toLocaleString()}</td>
                <td style={cellStyle}>
                  <button
                    style={btnSecondary}
                    onClick={() =>
                      setSelectedQueueId(selectedQueueId === item.id ? null : item.id)
                    }
                  >
                    {selectedQueueId === item.id ? 'Hide Log' : 'View Log'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedQueueId && (
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-secondary)', marginBottom: '10px' }}>
            Delivery Log for selected item
          </h4>
          {logLoading ? (
            <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</p>
          ) : logItems.length === 0 ? (
            <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>No delivery attempts yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
                  {['Attempt', 'Status', 'Message ID', 'Error', 'Sent At'].map((h) => (
                    <th
                      key={h}
                      style={{
                        ...cellStyle,
                        fontWeight: 600,
                        fontSize: '12px',
                        color: 'var(--io-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        textAlign: 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logItems.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--io-border)' }}>
                    <td style={cellStyle}>{entry.attempt_number}</td>
                    <td style={cellStyle}><StatusBadge status={entry.status} /></td>
                    <td style={cellStyle}>{entry.provider_message_id ?? '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--io-danger)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.error_details ?? '—'}
                    </td>
                    <td style={cellStyle}>{new Date(entry.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

const TABS = ['Providers', 'Templates', 'Queue']

export default function EmailSettingsPage() {
  const [activeTab, setActiveTab] = useState('Providers')

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
        Email
      </h2>
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Providers' && <ProvidersTab />}
      {activeTab === 'Templates' && <TemplatesTab />}
      {activeTab === 'Queue' && <QueueTab />}
    </div>
  )
}
