import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  importApi,
  type ConnectorTemplate,
  type TemplateFieldDef,
  type ImportConnection,
  type ImportDefinition,
  type ImportRun,
  type ImportError,
  type CreateConnectionBody,
  type CreateDefinitionBody,
  type InstantiateTemplateBody,
} from '../../api/import'
import { showToast } from '../../shared/components/Toast'
import { usePermission } from '../../shared/hooks/usePermission'

// ---------------------------------------------------------------------------
// Data categories (shared with OPC Sources)
// ---------------------------------------------------------------------------

const PREDEFINED_CATEGORIES = [
  { id: 'process',        label: 'Process' },
  { id: 'event',          label: 'Event' },
  { id: 'access_control', label: 'Access Control' },
  { id: 'personnel',      label: 'Personnel' },
  { id: 'financial',      label: 'Financial' },
  { id: 'maintenance',    label: 'Maintenance' },
  { id: 'ticketing',      label: 'Ticketing' },
  { id: 'environmental',  label: 'Environmental' },
  { id: 'general',        label: 'General' },
]

interface DataCategory {
  id: string
  label: string
  predefined: boolean
}

function useDataCategories() {
  return useQuery<DataCategory[]>({
    queryKey: ['data-categories'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/data-categories')
        if (!res.ok) throw new Error('API unavailable')
        const json = await res.json()
        return json.data ?? json
      } catch {
        return PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true }))
      }
    },
    staleTime: 60_000,
    initialData: PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true })),
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'var(--io-success-subtle)', color: 'var(--io-success)' },
    running:   { bg: 'var(--io-accent-subtle)', color: 'var(--io-accent)' },
    pending:   { bg: 'var(--io-warning-subtle)', color: 'var(--io-warning)' },
    failed:    { bg: 'var(--io-danger-subtle)', color: 'var(--io-danger)' },
    cancelled: { bg: 'var(--io-surface-tertiary)', color: 'var(--io-text-muted)' },
    partial:   { bg: 'var(--io-warning-subtle)', color: 'var(--io-warning)' },
    ok:        { bg: 'var(--io-success-subtle)', color: 'var(--io-success)' },
    error:     { bg: 'var(--io-danger-subtle)', color: 'var(--io-danger)' },
  }
  const style = colors[status] ?? { bg: 'var(--io-surface-tertiary)', color: 'var(--io-text-muted)' }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  )
}

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        background: 'var(--io-accent-subtle)',
        color: 'var(--io-accent)',
        textTransform: 'capitalize',
      }}
    >
      {domain.replace(/_/g, ' ')}
    </span>
  )
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const diffMs = end - start
  if (diffMs < 1000) return `${diffMs}ms`
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`
  return `${Math.round(diffMs / 60000)}m`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

// ---------------------------------------------------------------------------
// Drawer component
// ---------------------------------------------------------------------------

function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: '480px',
          maxWidth: '95vw',
          height: '100%',
          background: 'var(--io-surface)',
          borderLeft: '1px solid var(--io-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: '20px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
      />
      <div
        style={{
          position: 'relative',
          width: '560px',
          maxWidth: '95vw',
          maxHeight: '85vh',
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: '20px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connectors Tab
// ---------------------------------------------------------------------------

function ConnectorsTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<ConnectorTemplate | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['connector-templates'],
    queryFn: async () => {
      const res = await importApi.listTemplates()
      return res.success ? res.data : []
    },
  })

  const templates = data ?? []

  // Group by domain
  const grouped = templates.reduce<Record<string, ConnectorTemplate[]>>((acc, t) => {
    const key = t.domain
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  if (isLoading) {
    return (
      <div style={{ color: 'var(--io-text-muted)', textAlign: 'center', padding: '40px' }}>
        Loading connector templates...
      </div>
    )
  }

  return (
    <div>
      {Object.entries(grouped).map(([domain, items]) => (
        <div key={domain} style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            {domain.replace(/_/g, ' ')}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {items.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(t)
                  setSetupOpen(true)
                }}
                style={{
                  background: 'var(--io-surface-secondary)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  padding: '16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                  {t.name}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <DomainBadge domain={t.domain} />
                  <span
                    style={{
                      marginLeft: '6px',
                      fontSize: '11px',
                      color: 'var(--io-text-muted)',
                    }}
                  >
                    {t.vendor}
                  </span>
                </div>
                {t.description && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--io-text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {t.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <div style={{ color: 'var(--io-text-muted)', textAlign: 'center', padding: '40px' }}>
          No connector templates found.
        </div>
      )}

      <Drawer
        title={selectedTemplate ? `Set up: ${selectedTemplate.name}` : 'Set up connection'}
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
      >
        {selectedTemplate && (
          <SetupConnectionDrawerContent
            template={selectedTemplate}
            onClose={() => setSetupOpen(false)}
          />
        )}
      </Drawer>
    </div>
  )
}

function TemplateField({
  field,
  value,
  onChange,
}: {
  field: TemplateFieldDef
  value: string
  onChange: (val: string) => void
}) {
  if (field.type === 'secret') {
    return (
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ''}
        autoComplete="new-password"
        style={inputStyle}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? ''}
        style={inputStyle}
      />
    )
  }
  if (field.type === 'select' && field.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select...</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }
  // Default: text
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? ''}
      style={inputStyle}
    />
  )
}

function SetupConnectionDrawerContent({
  template,
  onClose,
}: {
  template: ConnectorTemplate
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(`${template.name} Connection`)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((template.required_fields ?? []).map((f) => [f.key, '']))
  )
  const [error, setError] = useState<string | null>(null)

  const hasRequiredFields = Array.isArray(template.required_fields) && template.required_fields.length > 0

  const mutation = useMutation({
    mutationFn: (body: InstantiateTemplateBody) =>
      importApi.instantiateTemplate(template.slug, body),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['import-connections'] })
        onClose()
      } else {
        setError(res.error.message)
      }
    },
  })

  const handleSave = () => {
    setError(null)
    mutation.mutate({
      field_values: fieldValues,
      connection_name: name,
    })
  }

  const setField = (key: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <DomainBadge domain={template.domain} />
        <span style={{ marginLeft: '8px', color: 'var(--io-text-muted)', fontSize: '13px' }}>
          {template.vendor}
        </span>
      </div>
      {template.description && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--io-text-secondary)',
            marginBottom: '24px',
            lineHeight: 1.5,
          }}
        >
          {template.description}
        </p>
      )}

      <Field label="Connection Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </Field>

      {hasRequiredFields
        ? template.required_fields.map((field) => (
            <Field key={field.key} label={field.label}>
              <TemplateField
                field={field}
                value={fieldValues[field.key] ?? ''}
                onChange={(val) => setField(field.key, val)}
              />
            </Field>
          ))
        : null}

      {error && (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--io-danger-subtle)',
            color: 'var(--io-danger)',
            borderRadius: 'var(--io-radius)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={mutation.isPending || !name.trim()}
          style={primaryBtnStyle}
        >
          {mutation.isPending ? 'Saving...' : 'Save Connection'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connections Tab
// ---------------------------------------------------------------------------

function ConnectionsTab() {
  const queryClient = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editConn, setEditConn] = useState<ImportConnection | null>(null)
  const canManageConnections = usePermission('system:import_connections')

  const { data, isLoading } = useQuery({
    queryKey: ['import-connections'],
    queryFn: async () => {
      const res = await importApi.listConnections()
      return res.success ? res.data : []
    },
  })

  const connections = data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => importApi.deleteConnection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-connections'] }),
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => importApi.testConnection(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['import-connections'] })
      if (!res.success) {
        showToast({ title: 'Connection test failed', description: res.error.message, variant: 'error' })
      }
    },
    onError: () => showToast({ title: 'Connection test failed', description: 'Network error', variant: 'error' }),
  })

  if (isLoading) {
    return (
      <div style={{ color: 'var(--io-text-muted)', textAlign: 'center', padding: '40px' }}>
        Loading connections...
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        {canManageConnections && (
          <button onClick={() => setWizardOpen(true)} style={primaryBtnStyle}>
            + New Connection
          </button>
        )}
      </div>

      {connections.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            color: 'var(--io-text-muted)',
            background: 'var(--io-surface-secondary)',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
          }}
        >
          No connections configured yet. Click "New Connection" to add one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                  {conn.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span>{conn.connection_type}</span>
                  <span>Auth: {conn.auth_type}</span>
                  {conn.last_tested_at && (
                    <span>Tested: {formatDate(conn.last_tested_at)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {conn.last_test_status ? (
                  <StatusBadge status={conn.last_test_status} />
                ) : (
                  <StatusBadge status="untested" />
                )}
                {canManageConnections && (
                  <>
                    <button
                      onClick={() => testMutation.mutate(conn.id)}
                      disabled={testMutation.isPending}
                      style={secondaryBtnStyle}
                      title="Test connection"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => setEditConn(conn)}
                      style={secondaryBtnStyle}
                      title="Edit connection"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete connection "${conn.name}"?`)) {
                          deleteMutation.mutate(conn.id)
                        }
                      }}
                      style={dangerBtnStyle}
                      title="Delete connection"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title="New Connection"
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      >
        <NewConnectionWizard onClose={() => setWizardOpen(false)} />
      </Modal>

      <Modal
        title={editConn ? `Edit: ${editConn.name}` : 'Edit Connection'}
        open={!!editConn}
        onClose={() => setEditConn(null)}
      >
        {editConn && (
          <EditConnectionForm conn={editConn} onClose={() => setEditConn(null)} />
        )}
      </Modal>
    </div>
  )
}

function NewConnectionWizard({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<ConnectorTemplate | null>(null)
  const [name, setName] = useState('')
  const [authType, setAuthType] = useState('none')
  const [configJson, setConfigJson] = useState('{}')
  const [authConfigJson, setAuthConfigJson] = useState('{}')
  const [dataCategoryId, setDataCategoryId] = useState<string>('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const catQuery = useDataCategories()
  const categories = catQuery.data ?? []

  const { data } = useQuery({
    queryKey: ['connector-templates'],
    queryFn: async () => {
      const res = await importApi.listTemplates()
      return res.success ? res.data : []
    },
  })

  const templates = data ?? []

  const saveMutation = useMutation({
    mutationFn: (body: CreateConnectionBody) => importApi.createConnection(body),
    onSuccess: (res) => {
      if (res.success) {
        setSavedId(res.data.id)
        queryClient.invalidateQueries({ queryKey: ['import-connections'] })
        setStep(3)
      } else {
        setError(res.error.message)
      }
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => importApi.testConnection(id),
    onSuccess: (res) => {
      if (res.success) {
        setTestResult('Connection test passed.')
        queryClient.invalidateQueries({ queryKey: ['import-connections'] })
      } else {
        setTestResult(`Test failed: ${res.error.message}`)
      }
    },
  })

  const handleSave = () => {
    setError(null)
    if (!selectedTemplate) return
    let config: Record<string, unknown> = {}
    let authConfig: Record<string, unknown> = {}
    try {
      config = JSON.parse(configJson)
      authConfig = JSON.parse(authConfigJson)
    } catch {
      setError('Invalid JSON in config fields')
      return
    }
    saveMutation.mutate({
      name: name || `${selectedTemplate.name} Connection`,
      connection_type: selectedTemplate.slug,
      config,
      auth_type: authType,
      auth_config: authConfig,
      data_category_id: dataCategoryId || undefined,
    } as CreateConnectionBody)
  }

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: s <= step ? 'var(--io-accent)' : 'var(--io-border)',
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--io-text-muted)',
          marginBottom: '20px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Step {step} of 3 —{' '}
        {step === 1 ? 'Select type' : step === 2 ? 'Configure' : 'Test & Save'}
      </div>

      {step === 1 && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              maxHeight: '360px',
              overflowY: 'auto',
            }}
          >
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(t)
                  setName(`${t.name} Connection`)
                }}
                style={{
                  background:
                    selectedTemplate?.id === t.id
                      ? 'var(--io-accent-subtle)'
                      : 'var(--io-surface-secondary)',
                  border: `1px solid ${selectedTemplate?.id === t.id ? 'var(--io-accent)' : 'var(--io-border)'}`,
                  borderRadius: 'var(--io-radius)',
                  padding: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
                  {t.vendor} · {t.domain.replace(/_/g, ' ')}
                </div>
              </button>
            ))}
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '8px' }}
          >
            <button onClick={onClose} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedTemplate}
              style={primaryBtnStyle}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && selectedTemplate && (
        <div>
          <Field label="Connection Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Data Category">
            <select
              value={dataCategoryId}
              onChange={(e) => setDataCategoryId(e.target.value)}
              style={inputStyle}
            >
              <option value="">(none)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Auth Type">
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value)}
              style={inputStyle}
            >
              <option value="none">None</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key</option>
              <option value="oauth2">OAuth 2.0</option>
            </select>
          </Field>

          <Field label="Connection Config (JSON)">
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={5}
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
              placeholder="{}"
            />
          </Field>

          {authType !== 'none' && (
            <Field label="Auth Config (JSON)">
              <textarea
                value={authConfigJson}
                onChange={(e) => setAuthConfigJson(e.target.value)}
                rows={4}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
                placeholder="{}"
              />
            </Field>
          )}

          {error && (
            <div
              style={{
                padding: '10px',
                background: 'var(--io-danger-subtle)',
                color: 'var(--io-danger)',
                borderRadius: 'var(--io-radius)',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}
          >
            <button onClick={() => setStep(1)} style={secondaryBtnStyle}>
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending || !name.trim()}
              style={primaryBtnStyle}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '48px',
              marginBottom: '12px',
              color: 'var(--io-success)',
            }}
          >
            ✓
          </div>
          <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
            Connection saved!
          </div>
          <p style={{ color: 'var(--io-text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
            You can test the connection to verify it works.
          </p>

          {testResult && (
            <div
              style={{
                padding: '10px 12px',
                background: testResult.includes('failed')
                  ? 'var(--io-danger-subtle)'
                  : 'var(--io-success-subtle)',
                color: testResult.includes('failed') ? 'var(--io-danger)' : 'var(--io-success)',
                borderRadius: 'var(--io-radius)',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {testResult}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {savedId && (
              <button
                onClick={() => testMutation.mutate(savedId)}
                disabled={testMutation.isPending}
                style={secondaryBtnStyle}
              >
                {testMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
            )}
            <button onClick={onClose} style={primaryBtnStyle}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EditConnectionForm({
  conn,
  onClose,
}: {
  conn: ImportConnection
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(conn.name)
  const [authType, setAuthType] = useState(conn.auth_type)
  const [configJson, setConfigJson] = useState(JSON.stringify(conn.config, null, 2))
  const [enabled, setEnabled] = useState(conn.enabled)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const config = JSON.parse(configJson)
      return importApi.updateConnection(conn.id, { name, auth_type: authType, config, enabled })
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['import-connections'] })
        onClose()
      } else {
        setError(res.error.message)
      }
    },
  })

  return (
    <div>
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Auth Type">
        <select
          value={authType}
          onChange={(e) => setAuthType(e.target.value)}
          style={inputStyle}
        >
          <option value="none">None</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="api_key">API Key</option>
          <option value="oauth2">OAuth 2.0</option>
        </select>
      </Field>

      <Field label="Config (JSON)">
        <textarea
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          rows={6}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
        />
      </Field>

      <Field label="Enabled">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span style={{ fontSize: '13px' }}>Connection enabled</span>
        </label>
      </Field>

      {error && (
        <div
          style={{
            padding: '10px',
            background: 'var(--io-danger-subtle)',
            color: 'var(--io-danger)',
            borderRadius: 'var(--io-radius)',
            fontSize: '13px',
            marginBottom: '12px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
        <button onClick={onClose} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} style={primaryBtnStyle}>
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Runs Tab
// ---------------------------------------------------------------------------

function RunsTab() {
  const [selectedRun, setSelectedRun] = useState<ImportRun | null>(null)
  const [runErrors, setRunErrors] = useState<ImportError[]>([])
  const [errorsOpen, setErrorsOpen] = useState(false)
  const canViewHistory = usePermission('system:import_history')
  const canExecute = usePermission('system:import_execute')

  // Fetch all definitions to show run buttons
  const { data: definitions } = useQuery({
    queryKey: ['import-definitions'],
    queryFn: async () => {
      const res = await importApi.listDefinitions()
      return res.success ? res.data : []
    },
  })

  // Fetch runs for each definition — concatenated list
  const [allRuns, setAllRuns] = useState<ImportRun[]>([])

  const fetchAllRuns = useCallback(async (defs: ImportDefinition[]) => {
    const runArrays = await Promise.all(
      defs.map(async (d) => {
        const res = await importApi.listRuns(d.id, { limit: 10 })
        return res.success ? res.data : []
      }),
    )
    const merged = runArrays
      .flat()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setAllRuns(merged)
  }, [])

  useEffect(() => {
    if (definitions && definitions.length > 0) {
      fetchAllRuns(definitions)
    }
  }, [definitions, fetchAllRuns])

  // Auto-refresh when any run is pending or running
  const hasActiveRuns = allRuns.some((r) => r.status === 'pending' || r.status === 'running')

  useEffect(() => {
    if (!hasActiveRuns) return
    const interval = setInterval(() => {
      if (definitions && definitions.length > 0) {
        fetchAllRuns(definitions)
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [hasActiveRuns, definitions, fetchAllRuns])

  const triggerMutation = useMutation({
    mutationFn: (defId: string) => importApi.triggerRun(defId, { dry_run: false }),
    onSuccess: () => {
      if (definitions && definitions.length > 0) {
        fetchAllRuns(definitions)
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (runId: string) => importApi.cancelRun(runId),
    onSuccess: () => {
      if (definitions && definitions.length > 0) {
        fetchAllRuns(definitions)
      }
    },
  })

  const openErrors = async (run: ImportRun) => {
    setSelectedRun(run)
    const res = await importApi.getRunErrors(run.id)
    setRunErrors(res.success ? res.data : [])
    setErrorsOpen(true)
  }

  if (!canViewHistory) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--io-text-muted)',
          background: 'var(--io-surface-secondary)',
          borderRadius: 'var(--io-radius)',
          border: '1px solid var(--io-border)',
        }}
      >
        You do not have permission to view import run history.
      </div>
    )
  }

  return (
    <div>
      {/* Definitions quick-run panel */}
      {canExecute && definitions && definitions.length > 0 && (
        <div
          style={{
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px',
            }}
          >
            Import Definitions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {definitions.map((d) => (
              <button
                key={d.id}
                onClick={() => triggerMutation.mutate(d.id)}
                disabled={triggerMutation.isPending}
                style={secondaryBtnStyle}
                title={`Run: ${d.name}`}
              >
                Run: {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {definitions && definitions.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            color: 'var(--io-text-muted)',
            background: 'var(--io-surface-secondary)',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
            marginBottom: '24px',
          }}
        >
          No import definitions configured yet. Set up a connection and create a definition first.
        </div>
      )}

      {/* Runs table */}
      {allRuns.length > 0 && (
        <div
          style={{
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--io-surface-secondary)' }}>
                {['Definition', 'Status', 'Extracted', 'Loaded', 'Errors', 'Started', 'Duration', ''].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--io-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '1px solid var(--io-border)',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {allRuns.map((run, i) => (
                <tr
                  key={run.id}
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'var(--io-surface-secondary)',
                    cursor: 'pointer',
                  }}
                  onClick={() => openErrors(run)}
                >
                  <td style={tdStyle}>{run.definition_name ?? run.import_definition_id}</td>
                  <td style={tdStyle}>
                    <StatusBadge status={run.status} />
                  </td>
                  <td style={tdStyle}>{run.rows_extracted ?? '—'}</td>
                  <td style={tdStyle}>{run.rows_loaded ?? '—'}</td>
                  <td style={tdStyle}>
                    {(run.rows_errored ?? 0) > 0 ? (
                      <span style={{ color: 'var(--io-danger)' }}>{run.rows_errored}</span>
                    ) : (
                      run.rows_errored ?? '—'
                    )}
                  </td>
                  <td style={tdStyle}>{formatDate(run.started_at)}</td>
                  <td style={tdStyle}>{formatDuration(run.started_at, run.completed_at)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {canExecute && (run.status === 'pending' || run.status === 'running') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          cancelMutation.mutate(run.id)
                        }}
                        style={dangerBtnStyle}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasActiveRuns && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--io-text-muted)',
            textAlign: 'right',
          }}
        >
          Auto-refreshing every 15s while runs are active...
        </div>
      )}

      {/* Run errors drawer */}
      <Drawer
        title={selectedRun ? `Errors for Run ${selectedRun.id.slice(0, 8)}...` : 'Run Errors'}
        open={errorsOpen}
        onClose={() => setErrorsOpen(false)}
      >
        {selectedRun && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <StatusBadge status={selectedRun.status} />
              <span
                style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--io-text-secondary)' }}
              >
                {selectedRun.definition_name}
              </span>
            </div>
            {runErrors.length === 0 ? (
              <div style={{ color: 'var(--io-text-muted)', textAlign: 'center', padding: '32px' }}>
                No errors recorded for this run.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {runErrors.map((err) => (
                  <div
                    key={err.id}
                    style={{
                      background: 'var(--io-danger-subtle)',
                      border: '1px solid var(--io-danger)',
                      borderRadius: 'var(--io-radius)',
                      padding: '10px 12px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--io-danger)', marginBottom: '4px' }}>
                      {err.error_type}
                      {err.row_number != null && ` (row ${err.row_number})`}
                      {err.field_name && ` — field: ${err.field_name}`}
                    </div>
                    <div style={{ color: 'var(--io-text-secondary)' }}>{err.error_message}</div>
                    {err.raw_value && (
                      <div
                        style={{
                          marginTop: '4px',
                          fontFamily: 'monospace',
                          color: 'var(--io-text-muted)',
                        }}
                      >
                        Value: {err.raw_value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared form helpers / styles
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--io-text-muted)',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text)',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--io-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--io-surface-secondary)',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  cursor: 'pointer',
}

const dangerBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: 'var(--io-danger)',
  border: '1px solid var(--io-danger)',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  cursor: 'pointer',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--io-border)',
  color: 'var(--io-text)',
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Definitions Tab
// ---------------------------------------------------------------------------

const TARGET_TABLES = [
  'points_metadata', 'alarm_thresholds', 'equipment', 'crews', 'shifts',
  'locations', 'documents', 'materials', 'work_orders', 'custom_data',
]

const ERROR_STRATEGIES = [
  { value: 'skip', label: 'Skip errored rows' },
  { value: 'abort', label: 'Abort on first error' },
  { value: 'log', label: 'Log and continue' },
]

type WizardState = {
  connection_id: string
  name: string
  description: string
  target_table: string
  source_config: string  // JSON
  field_mappings: string // JSON array
  transforms: string     // JSON array
  error_strategy: string
  batch_size: number
  schedule_type: string
  schedule_cron: string
  template_id: string
}

function DefinitionWizard({
  connections,
  onClose,
  onCreated,
}: {
  connections: ImportConnection[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<WizardState>({
    connection_id: '',
    name: '',
    description: '',
    target_table: 'points_metadata',
    source_config: '{}',
    field_mappings: '[]',
    transforms: '[]',
    error_strategy: 'skip',
    batch_size: 500,
    schedule_type: 'manual',
    schedule_cron: '0 2 * * *',
    template_id: '',
  })

  const mutation = useMutation({
    mutationFn: async () => {
      let source_config: Record<string, unknown> = {}
      let field_mappings: unknown[] = []
      let transforms: unknown[] = []
      try {
        source_config = JSON.parse(state.source_config)
        field_mappings = JSON.parse(state.field_mappings)
        transforms = JSON.parse(state.transforms)
      } catch {
        throw new Error('Invalid JSON in one of the config fields')
      }
      const body: CreateDefinitionBody = {
        connection_id: state.connection_id,
        name: state.name,
        description: state.description || undefined,
        target_table: state.target_table,
        source_config,
        field_mappings,
        transforms,
        error_strategy: state.error_strategy,
        batch_size: state.batch_size,
        template_id: state.template_id || undefined,
      }
      const res = await importApi.createDefinition(body)
      if (!res.success) throw new Error(res.error.message)
      // Create schedule if not manual
      if (state.schedule_type !== 'manual') {
        await importApi.createSchedule(res.data.id, {
          schedule_type: state.schedule_type,
          schedule_config: state.schedule_type === 'cron' ? { cron: state.schedule_cron } : {},
          enabled: true,
        })
      }
      return res.data
    },
    onSuccess: () => {
      onCreated()
      onClose()
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create definition'),
  })

  const set = (k: keyof WizardState, v: string | number) =>
    setState((s) => ({ ...s, [k]: v }))

  const STEPS = [
    'Select Connection',
    'Configure Source',
    'Map Fields',
    'Transformations',
    'Validation & Options',
    'Schedule',
    'Review',
  ]

  function canAdvance() {
    if (step === 0) return !!state.connection_id
    if (step === 1) return !!state.name && !!state.target_table
    return true
  }

  const connName = connections.find((c) => c.id === state.connection_id)?.name ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', minHeight: '480px' }}>
      {/* Step progress */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '0', marginBottom: '8px' }}>
          {STEPS.map((_label, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: '3px',
                background: i <= step ? 'var(--io-accent)' : 'var(--io-border)',
                transition: 'background 0.2s',
                marginRight: i < STEPS.length - 1 ? '3px' : '0',
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          Step {step + 1} of {STEPS.length} — <span style={{ color: 'var(--io-text-secondary)', fontWeight: 600 }}>{STEPS[step]}</span>
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1 }}>
        {/* Step 0: Select Connection */}
        {step === 0 && (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', marginBottom: '16px' }}>
              Choose which connection this definition will read data from.
            </p>
            {connections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--io-text-muted)', fontSize: '13px' }}>
                No connections configured. Go to the Connections tab first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {connections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => set('connection_id', c.id)}
                    style={{
                      padding: '12px 16px',
                      background: state.connection_id === c.id ? 'var(--io-accent-subtle)' : 'var(--io-surface-secondary)',
                      border: `1px solid ${state.connection_id === c.id ? 'var(--io-accent)' : 'var(--io-border)'}`,
                      borderRadius: 'var(--io-radius)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--io-text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
                      {c.connection_type} · Auth: {c.auth_type}
                      {c.last_test_status === 'ok' && <span style={{ color: 'var(--io-success)', marginLeft: '6px' }}>✓ tested OK</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Configure Source */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Definition Name">
              <input
                type="text"
                value={state.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. PI Tag Metadata Import"
                style={inputStyle}
              />
            </Field>
            <Field label="Description (optional)">
              <input
                type="text"
                value={state.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What this import does"
                style={inputStyle}
              />
            </Field>
            <Field label="Target Table">
              <select value={state.target_table} onChange={(e) => set('target_table', e.target.value)} style={inputStyle}>
                {TARGET_TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Source Configuration (JSON)">
              <textarea
                value={state.source_config}
                onChange={(e) => set('source_config', e.target.value)}
                rows={5}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                placeholder={'{\n  "query": "SELECT * FROM tags",\n  "page_size": 1000\n}'}
              />
            </Field>
          </div>
        )}

        {/* Step 2: Map Fields */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', margin: '0 0 4px' }}>
              Define how source fields map to columns in <code style={{ fontFamily: 'monospace', background: 'var(--io-surface-secondary)', padding: '1px 5px', borderRadius: '3px' }}>{state.target_table}</code>.
            </p>
            <Field label="Field Mappings (JSON array)">
              <textarea
                value={state.field_mappings}
                onChange={(e) => set('field_mappings', e.target.value)}
                rows={10}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                placeholder={`[
  { "source_field": "TagName", "target_column": "tag_path", "transform": null },
  { "source_field": "Description", "target_column": "description", "transform": null },
  { "source_field": "EngineeringUnits", "target_column": "engineering_units", "transform": null },
  { "source_field": "Zero", "target_column": "range_low", "transform": { "type": "cast", "target_type": "float8" } },
  { "source_field": "Span", "target_column": "range_high", "transform": { "type": "cast", "target_type": "float8" } }
]`}
              />
            </Field>
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
              Each mapping: <code style={{ fontFamily: 'monospace' }}>{'{ source_field, target_column, transform }'}</code>. Leave <code style={{ fontFamily: 'monospace' }}>transform</code> null for direct copy, or specify a built-in transform (cast, trim, parse_datetime, lookup).
            </div>
          </div>
        )}

        {/* Step 3: Transformations */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', margin: '0 0 4px' }}>
              Optional row-level transforms applied after field mapping (Rhai scripts or built-in).
            </p>
            <Field label="Transform Pipeline (JSON array)">
              <textarea
                value={state.transforms}
                onChange={(e) => set('transforms', e.target.value)}
                rows={10}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                placeholder={`[
  {
    "type": "rhai",
    "name": "Normalize tag path",
    "script": "row.tag_path = row.tag_path.to_lower();"
  }
]`}
              />
            </Field>
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
              Leave <code style={{ fontFamily: 'monospace' }}>[]</code> for no custom transforms. Built-in types: <code style={{ fontFamily: 'monospace' }}>cast</code>, <code style={{ fontFamily: 'monospace' }}>trim</code>, <code style={{ fontFamily: 'monospace' }}>parse_datetime</code>, <code style={{ fontFamily: 'monospace' }}>lookup</code>. Rhai scripts have access to the full row as a map.
            </div>
          </div>
        )}

        {/* Step 4: Validation & Options */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Error Strategy">
              <select value={state.error_strategy} onChange={(e) => set('error_strategy', e.target.value)} style={inputStyle}>
                {ERROR_STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Batch Size">
              <input
                type="number"
                value={state.batch_size}
                onChange={(e) => set('batch_size', parseInt(e.target.value, 10) || 500)}
                min={1}
                max={10000}
                style={inputStyle}
              />
            </Field>
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
              Rows are processed in batches. Smaller batches use less memory but are slower. Recommended: 100–1000.
              <br />Import validation runs after transformations. Rows that fail validation are handled according to the error strategy.
            </div>
          </div>
        )}

        {/* Step 5: Schedule */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Schedule Type">
              <select value={state.schedule_type} onChange={(e) => set('schedule_type', e.target.value)} style={inputStyle}>
                <option value="manual">Manual only (trigger from UI)</option>
                <option value="cron">Cron schedule</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="per_shift">Per shift</option>
              </select>
            </Field>
            {state.schedule_type === 'cron' && (
              <Field label="Cron Expression">
                <input
                  type="text"
                  value={state.schedule_cron}
                  onChange={(e) => set('schedule_cron', e.target.value)}
                  placeholder="0 2 * * * (daily at 02:00)"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </Field>
            )}
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
              Scheduled imports run in the Import Service (Port 3006) at the lowest QoS tier — they will not affect real-time data or event processing. You can also trigger runs manually from the Run History tab.
            </div>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ background: 'var(--io-surface-secondary)', borderRadius: 'var(--io-radius)', padding: '16px', border: '1px solid var(--io-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                ['Connection', connName],
                ['Name', state.name],
                ['Description', state.description || '(none)'],
                ['Target Table', state.target_table],
                ['Error Strategy', state.error_strategy],
                ['Batch Size', String(state.batch_size)],
                ['Schedule', state.schedule_type === 'cron' ? `Cron: ${state.schedule_cron}` : state.schedule_type],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: 'var(--io-text-muted)', width: '120px', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'var(--io-text-primary)', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              <div style={{ flex: 1, background: 'var(--io-surface-secondary)', borderRadius: 'var(--io-radius)', padding: '12px', border: '1px solid var(--io-border)' }}>
                <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--io-text-secondary)' }}>Field Mappings</div>
                <pre style={{ margin: 0, fontSize: '11px', color: 'var(--io-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {state.field_mappings}
                </pre>
              </div>
              <div style={{ flex: 1, background: 'var(--io-surface-secondary)', borderRadius: 'var(--io-radius)', padding: '12px', border: '1px solid var(--io-border)' }}>
                <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--io-text-secondary)' }}>Transforms</div>
                <pre style={{ margin: 0, fontSize: '11px', color: 'var(--io-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {state.transforms}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 12px', background: 'var(--io-danger-subtle)', color: 'var(--io-danger)', borderRadius: 'var(--io-radius)', fontSize: '13px', marginTop: '16px' }}>
          {error}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--io-border)' }}>
        <button
          onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
          style={secondaryBtnStyle}
        >
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            style={{ ...primaryBtnStyle, opacity: canAdvance() ? 1 : 0.5, cursor: canAdvance() ? 'pointer' : 'not-allowed' }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={() => { setError(null); mutation.mutate() }}
            disabled={mutation.isPending}
            style={primaryBtnStyle}
          >
            {mutation.isPending ? 'Creating…' : 'Create Definition'}
          </button>
        )}
      </div>
    </div>
  )
}

function DefinitionsTab() {
  const queryClient = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const canManageDefinitions = usePermission('system:import_definitions')
  const canExecute = usePermission('system:import_execute')

  const { data: defsResult, isLoading } = useQuery({
    queryKey: ['import-definitions'],
    queryFn: () => importApi.listDefinitions(),
  })
  const definitions = defsResult?.success ? defsResult.data : []

  const { data: connsResult } = useQuery({
    queryKey: ['import-connections'],
    queryFn: () => importApi.listConnections(),
  })
  const connections = connsResult?.success ? connsResult.data : []

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      importApi.updateDefinition(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-definitions'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => importApi.deleteDefinition(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['import-definitions'] }),
  })

  const runMutation = useMutation({
    mutationFn: ({ id, dry_run }: { id: string; dry_run: boolean }) =>
      importApi.triggerRun(id, { dry_run }),
    onSuccess: (res, { dry_run }) => {
      if (res.success) {
        showToast({ title: dry_run ? 'Dry run started' : 'Import run started', description: `Run ID: ${res.data.id.slice(0, 8)}…`, variant: 'success' })
        queryClient.invalidateQueries({ queryKey: ['import-runs'] })
      }
    },
  })

  if (isLoading) {
    return <div style={{ color: 'var(--io-text-muted)', textAlign: 'center', padding: '40px' }}>Loading definitions...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        {canManageDefinitions && (
          <button onClick={() => setWizardOpen(true)} style={primaryBtnStyle}>
            + New Definition
          </button>
        )}
      </div>

      {definitions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--io-text-muted)', background: 'var(--io-surface-secondary)', borderRadius: 'var(--io-radius)', border: '1px solid var(--io-border)', fontSize: '13px' }}>
          No import definitions configured. Click "New Definition" to create one using the setup wizard.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {definitions.map((def) => {
            const conn = connections.find((c) => c.id === def.connection_id)
            return (
              <div
                key={def.id}
                style={{ background: 'var(--io-surface-secondary)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{def.name}</span>
                    <StatusBadge status={def.enabled ? 'ok' : 'cancelled'} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {conn && <span>Connection: {conn.name}</span>}
                    <span>Target: {def.target_table}</span>
                    <span>Batch: {def.batch_size}</span>
                    <span>On error: {def.error_strategy}</span>
                  </div>
                  {def.description && (
                    <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', marginTop: '4px' }}>{def.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {canExecute && (
                    <>
                      <button
                        onClick={() => runMutation.mutate({ id: def.id, dry_run: true })}
                        disabled={runMutation.isPending}
                        style={secondaryBtnStyle}
                        title="Dry run (preview without writing)"
                      >
                        Dry Run
                      </button>
                      <button
                        onClick={() => runMutation.mutate({ id: def.id, dry_run: false })}
                        disabled={runMutation.isPending}
                        style={secondaryBtnStyle}
                        title="Trigger import now"
                      >
                        Run Now
                      </button>
                    </>
                  )}
                  {canManageDefinitions && (
                    <>
                      <button
                        onClick={() => toggleMutation.mutate({ id: def.id, enabled: !def.enabled })}
                        style={secondaryBtnStyle}
                      >
                        {def.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete definition "${def.name}"?`)) deleteMutation.mutate(def.id)
                        }}
                        style={dangerBtnStyle}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        title="New Import Definition"
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      >
        <DefinitionWizard
          connections={connections}
          onClose={() => setWizardOpen(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ['import-definitions'] })}
        />
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Point Detail Configuration Tab
// ---------------------------------------------------------------------------

interface PointDetailSection {
  id: string
  name: string
  enabled: boolean
  source_dataset_id: string | null
  source_dataset_label: string | null
  display_columns: string[]
  sort_column: string | null
  sort_direction: 'asc' | 'desc'
  row_limit: number
  sort_order: number
  equipment_class_overrides: PointDetailOverride[]
}

interface PointDetailOverride {
  equipment_class_id: string
  equipment_class_label: string
  enabled: boolean
  display_columns: string[]
  sort_column: string | null
  sort_direction: 'asc' | 'desc'
  row_limit: number
}

interface PointDetailConfig {
  sections: PointDetailSection[]
}

const DEFAULT_SECTIONS: PointDetailSection[] = [
  { id: 'alarms',     name: 'Active Alarms',        enabled: true,  source_dataset_id: null, source_dataset_label: null, display_columns: [], sort_column: null, sort_direction: 'desc', row_limit: 10, sort_order: 0, equipment_class_overrides: [] },
  { id: 'trend',      name: 'Trend',                enabled: true,  source_dataset_id: null, source_dataset_label: null, display_columns: [], sort_column: null, sort_direction: 'desc', row_limit: 100, sort_order: 1, equipment_class_overrides: [] },
  { id: 'work_orders',name: 'Work Orders (CMMS)',    enabled: false, source_dataset_id: null, source_dataset_label: null, display_columns: [], sort_column: null, sort_direction: 'desc', row_limit: 10, sort_order: 2, equipment_class_overrides: [] },
  { id: 'inventory',  name: 'Inventory (ERP)',       enabled: false, source_dataset_id: null, source_dataset_label: null, display_columns: [], sort_column: null, sort_direction: 'asc',  row_limit: 20, sort_order: 3, equipment_class_overrides: [] },
  { id: 'tickets',    name: 'Tickets',              enabled: false, source_dataset_id: null, source_dataset_label: null, display_columns: [], sort_column: null, sort_direction: 'desc', row_limit: 10, sort_order: 4, equipment_class_overrides: [] },
]

function usePointDetailConfig() {
  const qc = useQueryClient()
  const query = useQuery<PointDetailConfig>({
    queryKey: ['point-detail-config'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/settings/point-detail-config')
        if (!res.ok) throw new Error('API unavailable')
        const json = await res.json()
        return json.data ?? json
      } catch {
        return { sections: DEFAULT_SECTIONS }
      }
    },
    staleTime: 30_000,
    initialData: { sections: DEFAULT_SECTIONS },
  })

  const saveMutation = useMutation({
    mutationFn: async (config: PointDetailConfig) => {
      const res = await fetch('/api/settings/point-detail-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['point-detail-config'] })
    },
  })

  return { query, saveMutation }
}

function SectionEditModal({
  section,
  definitions,
  onSave,
  onClose,
}: {
  section: PointDetailSection
  definitions: ImportDefinition[]
  onSave: (updated: PointDetailSection) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<PointDetailSection>({ ...section })

  const set = <K extends keyof PointDetailSection>(key: K, value: PointDetailSection[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
  }

  const inputSt: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    background: 'var(--io-surface-secondary)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text)',
    fontSize: '13px',
    boxSizing: 'border-box',
  }

  const selectedDataset = definitions.find((d) => d.id === form.source_dataset_id)

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '520px',
          maxWidth: '95vw',
          maxHeight: '85vh',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Edit Section: {section.name}</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: '18px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Enabled toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              style={{ accentColor: 'var(--io-accent)' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
              Enabled in Point Detail panel
            </span>
          </label>

          {/* Source dataset */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Source Dataset
            </label>
            <select
              style={inputSt}
              value={form.source_dataset_id ?? ''}
              onChange={(e) => set('source_dataset_id', e.target.value || null)}
            >
              <option value="">(none — use system data)</option>
              {definitions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {selectedDataset && (
              <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '3px' }}>
                Target table: {selectedDataset.target_table}
              </div>
            )}
          </div>

          {/* Display columns */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Display Columns (comma-separated)
            </label>
            <input
              type="text"
              style={inputSt}
              value={form.display_columns.join(', ')}
              onChange={(e) =>
                set(
                  'display_columns',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
              placeholder="column1, column2, ..."
            />
          </div>

          {/* Sort column + direction */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sort Column
              </label>
              <input
                type="text"
                style={inputSt}
                value={form.sort_column ?? ''}
                onChange={(e) => set('sort_column', e.target.value || null)}
                placeholder="column name"
              />
            </div>
            <div style={{ width: '120px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Direction
              </label>
              <select
                style={inputSt}
                value={form.sort_direction}
                onChange={(e) => set('sort_direction', e.target.value as 'asc' | 'desc')}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Row limit */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Row Limit
            </label>
            <input
              type="number"
              style={inputSt}
              value={form.row_limit}
              min={1}
              max={500}
              onChange={(e) => set('row_limit', Math.max(1, parseInt(e.target.value, 10) || 10))}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--io-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              background: 'transparent',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(form); onClose() }}
            style={{
              padding: '7px 14px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Save Section
          </button>
        </div>
      </div>
    </div>
  )
}

function PointDetailTab() {
  const canManage = usePermission('system:point_detail_config')
  const { query, saveMutation } = usePointDetailConfig()
  const [sections, setSections] = useState<PointDetailSection[]>([])
  const [editingSection, setEditingSection] = useState<PointDetailSection | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Sync from query
  useEffect(() => {
    if (query.data) {
      setSections([...query.data.sections].sort((a, b) => a.sort_order - b.sort_order))
    }
  }, [query.data])

  const { data: defsResult } = useQuery({
    queryKey: ['import-definitions'],
    queryFn: () => importApi.listDefinitions(),
  })
  const definitions = defsResult?.success ? defsResult.data : []

  async function handleSave(updated: PointDetailSection[]) {
    const config: PointDetailConfig = {
      sections: updated.map((s, i) => ({ ...s, sort_order: i })),
    }
    try {
      await saveMutation.mutateAsync(config)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...sections]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setSections(next)
    handleSave(next)
  }

  function moveDown(index: number) {
    if (index === sections.length - 1) return
    const next = [...sections]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setSections(next)
    handleSave(next)
  }

  function toggleEnabled(index: number) {
    const next = sections.map((s, i) => i === index ? { ...s, enabled: !s.enabled } : s)
    setSections(next)
    handleSave(next)
  }

  function handleSectionSave(updated: PointDetailSection) {
    const next = sections.map((s) => s.id === updated.id ? updated : s)
    setSections(next)
    handleSave(next)
  }

  if (!canManage) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--io-text-muted)',
          background: 'var(--io-surface-secondary)',
          borderRadius: 'var(--io-radius)',
          border: '1px solid var(--io-border)',
        }}
      >
        You do not have permission to configure Point Detail sections.
        <br />
        <span style={{ fontSize: '12px', opacity: 0.7 }}>
          Required permission: <code>system:point_detail_config</code>
        </span>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)', marginBottom: '2px' }}>
            Point Detail Panel Sections
          </div>
          <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
            Configure which data sections appear in the floating Point Detail panel and in what order.
          </div>
        </div>
        {saveStatus === 'saved' && (
          <span style={{ fontSize: '12px', color: 'var(--io-success)' }}>Saved</span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: '12px', color: 'var(--io-danger)' }}>Save failed</span>
        )}
      </div>

      {/* Section list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sections.map((section, index) => (
          <div
            key={section.id}
            style={{
              background: 'var(--io-surface-secondary)',
              border: `1px solid ${section.enabled ? 'var(--io-border)' : 'var(--io-border-subtle)'}`,
              borderRadius: 'var(--io-radius)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              opacity: section.enabled ? 1 : 0.6,
            }}
          >
            {/* Order controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                style={{
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: '3px',
                  width: '20px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  color: index === 0 ? 'var(--io-text-muted)' : 'var(--io-text-secondary)',
                  fontSize: '10px',
                  opacity: index === 0 ? 0.3 : 1,
                }}
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === sections.length - 1}
                style={{
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: '3px',
                  width: '20px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: index === sections.length - 1 ? 'not-allowed' : 'pointer',
                  color: index === sections.length - 1 ? 'var(--io-text-muted)' : 'var(--io-text-secondary)',
                  fontSize: '10px',
                  opacity: index === sections.length - 1 ? 0.3 : 1,
                }}
                title="Move down"
              >
                ▼
              </button>
            </div>

            {/* Enabled toggle */}
            <input
              type="checkbox"
              checked={section.enabled}
              onChange={() => toggleEnabled(index)}
              style={{ accentColor: 'var(--io-accent)', flexShrink: 0 }}
              title={section.enabled ? 'Disable section' : 'Enable section'}
            />

            {/* Section info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--io-text-primary)', marginBottom: '2px' }}>
                {section.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {section.source_dataset_label ? (
                  <span>Dataset: {section.source_dataset_label}</span>
                ) : section.source_dataset_id ? (
                  <span>Dataset: {section.source_dataset_id}</span>
                ) : (
                  <span>Dataset: system</span>
                )}
                <span>Limit: {section.row_limit} rows</span>
                {section.display_columns.length > 0 && (
                  <span>Columns: {section.display_columns.join(', ')}</span>
                )}
              </div>
            </div>

            {/* Edit button */}
            <button
              onClick={() => setEditingSection(section)}
              style={{
                padding: '5px 12px',
                background: 'transparent',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {sections.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            color: 'var(--io-text-muted)',
            background: 'var(--io-surface-secondary)',
            borderRadius: 'var(--io-radius)',
            border: '1px solid var(--io-border)',
          }}
        >
          No Point Detail sections configured. Loading default sections...
        </div>
      )}

      {/* Edit modal */}
      {editingSection && (
        <SectionEditModal
          section={editingSection}
          definitions={definitions}
          onSave={handleSectionSave}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Tab = 'connectors' | 'connections' | 'definitions' | 'runs' | 'point_detail'

export default function ImportSettingsPage({ defaultTab }: { defaultTab?: Tab }) {
  const canManageConnections = usePermission('system:import_connections')
  const canManageDefinitions = usePermission('system:import_definitions')
  const canViewHistory = usePermission('system:import_history')
  const canManagePointDetail = usePermission('system:point_detail_config')

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab ?? 'connectors')

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'connectors',   label: 'Connectors',    visible: canManageConnections },
    { id: 'connections',  label: 'Connections',   visible: canManageConnections },
    { id: 'definitions',  label: 'Definitions',   visible: canManageDefinitions },
    { id: 'runs',         label: 'Run History',   visible: canViewHistory },
    { id: 'point_detail', label: 'Point Detail',  visible: canManagePointDetail },
  ]

  const visibleTabs = tabs.filter((t) => t.visible)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            margin: '0 0 4px',
          }}
        >
          Universal Import
        </h2>
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px', margin: 0 }}>
          Configure data imports from external systems, databases, and files.
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--io-border)',
          marginBottom: '24px',
        }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--io-accent)' : 'transparent'}`,
              color:
                activeTab === tab.id ? 'var(--io-accent)' : 'var(--io-text-secondary)',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'connectors' && <ConnectorsTab />}
      {activeTab === 'connections' && <ConnectionsTab />}
      {activeTab === 'definitions' && <DefinitionsTab />}
      {activeTab === 'runs' && <RunsTab />}
      {activeTab === 'point_detail' && <PointDetailTab />}
    </div>
  )
}
