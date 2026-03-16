import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  importApi,
  type ConnectorTemplate,
  type ImportConnection,
  type ImportDefinition,
  type ImportRun,
  type ImportError,
  type CreateConnectionBody,
} from '../../api/import'
import { showToast } from '../../shared/components/Toast'

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

function SetupConnectionDrawerContent({
  template,
  onClose,
}: {
  template: ConnectorTemplate
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(`${template.name} Connection`)
  const [configJson, setConfigJson] = useState('{}')
  const [authType, setAuthType] = useState('none')
  const [authConfigJson, setAuthConfigJson] = useState('{}')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (body: CreateConnectionBody) => importApi.createConnection(body),
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
    let config: Record<string, unknown> = {}
    let authConfig: Record<string, unknown> = {}
    try {
      config = JSON.parse(configJson)
      authConfig = JSON.parse(authConfigJson)
    } catch {
      setError('Invalid JSON in config fields')
      return
    }
    mutation.mutate({
      name,
      connection_type: template.slug,
      config,
      auth_type: authType,
      auth_config: authConfig,
    })
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
          rows={6}
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
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
            placeholder="{}"
          />
        </Field>
      )}

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
        <button onClick={() => setWizardOpen(true)} style={primaryBtnStyle}>
          + New Connection
        </button>
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
  const [testResult, setTestResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

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
    })
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

  return (
    <div>
      {/* Definitions quick-run panel */}
      {definitions && definitions.length > 0 && (
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
                    {(run.status === 'pending' || run.status === 'running') && (
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

type Tab = 'connectors' | 'connections' | 'runs'

export default function ImportSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('connectors')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'connectors', label: 'Connectors' },
    { id: 'connections', label: 'Connections' },
    { id: 'runs', label: 'Run History' },
  ]

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
        {tabs.map((tab) => (
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
      {activeTab === 'runs' && <RunsTab />}
    </div>
  )
}
