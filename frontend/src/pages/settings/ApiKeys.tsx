import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiKeysApi, CreateApiKeyPayload, CreateApiKeyResponse } from '../../api/apiKeys'

// Available permission scopes for API keys
const AVAILABLE_SCOPES = [
  'read',
  'write',
  'admin',
  'opc:read',
  'data:read',
  'reports:read',
  'reports:write',
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface CreateModalProps {
  onClose: () => void
  onCreated: (result: CreateApiKeyResponse) => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: CreateApiKeyPayload) => apiKeysApi.create(payload),
    onSuccess: (result) => {
      if (result.success) {
        onCreated(result.data)
      } else {
        setError(result.error.message)
      }
    },
  })

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const payload: CreateApiKeyPayload = {
      name: name.trim(),
      scopes: selectedScopes.length > 0 ? selectedScopes : undefined,
      expires_at: expiresAt || undefined,
    }
    createMutation.mutate(payload)
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '24px',
          width: '480px',
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <h3
          style={{
            margin: '0 0 20px',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
          }}
        >
          Create API Key
        </h3>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--io-radius)',
              background: 'var(--io-error-subtle, #fef2f2)',
              color: 'var(--io-error, #ef4444)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Name *
          </label>
          <input
            type="text"
            placeholder="e.g. CI/CD Pipeline, Monitoring Agent"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface)',
              color: 'var(--io-text-primary)',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Scopes (optional)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: 'var(--io-radius)',
                  border: `1px solid ${selectedScopes.includes(scope) ? 'var(--io-accent)' : 'var(--io-border)'}`,
                  background: selectedScopes.includes(scope)
                    ? 'var(--io-accent-subtle)'
                    : 'transparent',
                  fontSize: '12px',
                  color: selectedScopes.includes(scope)
                    ? 'var(--io-accent)'
                    : 'var(--io-text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  style={{ display: 'none' }}
                />
                {scope}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Expiry Date (optional)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface)',
              color: 'var(--io-text-primary)',
              fontSize: '13px',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'transparent',
              color: 'var(--io-text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--io-radius)',
              border: 'none',
              background: 'var(--io-accent)',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Key'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RevealModalProps {
  result: CreateApiKeyResponse
  onClose: () => void
}

function RevealModal({ result, onClose }: RevealModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '24px',
          width: '520px',
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
          }}
        >
          API Key Created
        </h3>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'var(--io-error, #ef4444)',
            fontWeight: 500,
          }}
        >
          Copy this key now — you will not be able to see it again.
        </p>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--io-radius)',
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            marginBottom: '16px',
            wordBreak: 'break-all',
          }}
        >
          <code
            style={{
              fontSize: '13px',
              fontFamily: 'var(--io-font-mono, monospace)',
              color: 'var(--io-text-primary)',
              lineHeight: 1.5,
            }}
          >
            {result.key}
          </code>
        </div>

        <div
          style={{
            fontSize: '12px',
            color: 'var(--io-text-muted)',
            marginBottom: '20px',
          }}
        >
          <strong>Name:</strong> {result.name}
          {result.scopes.length > 0 && (
            <>
              {' · '}
              <strong>Scopes:</strong> {result.scopes.join(', ')}
            </>
          )}
          {result.expires_at && (
            <>
              {' · '}
              <strong>Expires:</strong> {formatDate(result.expires_at)}
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--io-radius)',
              border: '1px solid var(--io-border)',
              background: 'transparent',
              color: 'var(--io-text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy Key'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--io-radius)',
              border: 'none',
              background: 'var(--io-accent)',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyResult, setNewKeyResult] = useState<CreateApiKeyResponse | null>(null)

  const { data: listResult, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list(),
  })

  const keys = listResult?.success ? listResult.data : []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const handleCreated = (result: CreateApiKeyResponse) => {
    setShowCreate(false)
    setNewKeyResult(result)
    queryClient.invalidateQueries({ queryKey: ['api-keys'] })
  }

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete API key "${name}"? This cannot be undone.`)) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div>
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
            }}
          >
            API Keys
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            API keys allow programmatic access to Inside Operations on your behalf.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--io-radius)',
            border: 'none',
            background: 'var(--io-accent)',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + Create Key
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--io-text-muted)', fontSize: '13px', marginTop: '20px' }}>
          Loading…
        </div>
      ) : keys.length === 0 ? (
        <div
          style={{
            marginTop: '24px',
            padding: '32px',
            textAlign: 'center',
            border: '1px dashed var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-muted)',
            fontSize: '13px',
          }}
        >
          No API keys yet. Create one to get started.
        </div>
      ) : (
        <div
          style={{
            marginTop: '16px',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--io-surface-secondary)',
                  borderBottom: '1px solid var(--io-border)',
                }}
              >
                {['Name', 'Prefix', 'Scopes', 'Created', 'Expires', 'Last Used', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--io-text-muted)',
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
              {keys.map((key) => (
                <tr
                  key={key.id}
                  style={{ borderBottom: '1px solid var(--io-border)' }}
                >
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: 'var(--io-text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {key.name}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <code
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--io-font-mono, monospace)',
                        color: 'var(--io-text-secondary)',
                        background: 'var(--io-surface-secondary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {key.key_prefix}…
                    </code>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {key.scopes.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {key.scopes.map((s) => (
                          <span
                            key={s}
                            style={{
                              fontSize: '11px',
                              padding: '2px 7px',
                              borderRadius: '99px',
                              background: 'var(--io-accent-subtle)',
                              color: 'var(--io-accent)',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                        All scopes
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: 'var(--io-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(key.created_at)}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: key.expires_at ? 'var(--io-text-secondary)' : 'var(--io-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {key.expires_at ? formatDate(key.expires_at) : 'Never'}
                  </td>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontSize: '12px',
                      color: 'var(--io-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatRelative(key.last_used_at)}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(key.id, key.name)}
                      disabled={deleteMutation.isPending}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--io-radius)',
                        border: '1px solid var(--io-error, #ef4444)',
                        background: 'transparent',
                        color: 'var(--io-error, #ef4444)',
                        fontSize: '12px',
                        cursor: 'pointer',
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

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {newKeyResult && (
        <RevealModal result={newKeyResult} onClose={() => setNewKeyResult(null)} />
      )}
    </div>
  )
}
