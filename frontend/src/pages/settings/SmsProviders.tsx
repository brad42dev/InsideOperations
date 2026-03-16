import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { smsProvidersApi, SmsProvider, CreateSmsProviderRequest } from '../../api/smsProviders'

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
  padding: '5px 12px',
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: 'var(--io-text-secondary)',
  verticalAlign: 'middle',
}

// ---------------------------------------------------------------------------
// Dialog overlay
// ---------------------------------------------------------------------------

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialogPanel: React.CSSProperties = {
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius-lg)',
  padding: '24px',
  width: '480px',
  maxWidth: '95vw',
}

// ---------------------------------------------------------------------------
// Add Provider dialog
// ---------------------------------------------------------------------------

interface AddProviderDialogProps {
  onClose: () => void
  onCreated: () => void
}

function AddProviderDialog({ onClose, onCreated }: AddProviderDialogProps) {
  const [providerType, setProviderType] = useState<'twilio' | 'webhook'>('twilio')
  const [name, setName] = useState('')
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [headersJson, setHeadersJson] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (body: CreateSmsProviderRequest) => smsProvidersApi.create(body),
    onSuccess: (result) => {
      if (result.success) {
        onCreated()
      } else {
        setError((result as { error: { message: string } }).error?.message ?? 'Failed to create provider')
      }
    },
  })

  const handleSubmit = () => {
    setError('')
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    let config: CreateSmsProviderRequest['config'] = {}
    if (providerType === 'twilio') {
      if (!accountSid.trim() || !authToken.trim() || !fromNumber.trim()) {
        setError('Account SID, Auth Token, and From Number are all required for Twilio')
        return
      }
      config = { account_sid: accountSid.trim(), auth_token: authToken.trim(), from_number: fromNumber.trim() }
    } else {
      if (!webhookUrl.trim()) {
        setError('Webhook URL is required')
        return
      }
      let headers: Record<string, string> | undefined
      if (headersJson.trim()) {
        try {
          headers = JSON.parse(headersJson.trim()) as Record<string, string>
        } catch {
          setError('Headers must be valid JSON (e.g. {"X-Api-Key": "value"})')
          return
        }
      }
      config = { url: webhookUrl.trim(), ...(headers ? { headers } : {}) }
    }

    createMutation.mutate({ name: name.trim(), provider_type: providerType, enabled, is_default: isDefault, config })
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialogPanel} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Add SMS Provider
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Provider type */}
          <div>
            <label style={labelStyle}>Provider Type</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as 'twilio' | 'webhook')}
              style={inputStyle}
            >
              <option value="twilio">Twilio</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Twilio Production"
            />
          </div>

          {/* Twilio fields */}
          {providerType === 'twilio' && (
            <>
              <div>
                <label style={labelStyle}>Account SID</label>
                <input
                  style={inputStyle}
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label style={labelStyle}>Auth Token</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Your Twilio Auth Token"
                />
              </div>
              <div>
                <label style={labelStyle}>From Number</label>
                <input
                  style={inputStyle}
                  value={fromNumber}
                  onChange={(e) => setFromNumber(e.target.value)}
                  placeholder="+15005550006"
                />
              </div>
            </>
          )}

          {/* Webhook fields */}
          {providerType === 'webhook' && (
            <>
              <div>
                <label style={labelStyle}>Webhook URL</label>
                <input
                  style={inputStyle}
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.example.com/sms/send"
                />
              </div>
              <div>
                <label style={labelStyle}>Custom Headers (JSON, optional)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '72px', resize: 'vertical', fontFamily: 'monospace' }}
                  value={headersJson}
                  onChange={(e) => setHeadersJson(e.target.value)}
                  placeholder={'{"X-Api-Key": "secret"}'}
                />
              </div>
            </>
          )}

          {/* Toggles */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--io-text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--io-text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default
            </label>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-danger)' }}>{error}</p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button style={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            style={btnPrimary}
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Adding…' : 'Add Provider'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

export default function SmsProvidersSection() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sms-providers'],
    queryFn: async () => {
      const result = await smsProvidersApi.list()
      return result.success ? result.data : []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => smsProvidersApi.delete(id),
    onSuccess: () => {
      setDeletingId(null)
      queryClient.invalidateQueries({ queryKey: ['sms-providers'] })
    },
  })

  const providers: SmsProvider[] = data ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            SMS Providers
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            Configure Twilio or a custom webhook for SMS-based MFA codes.
          </p>
        </div>
        <button style={btnPrimary} onClick={() => setShowAdd(true)}>
          Add Provider
        </button>
      </div>

      {isLoading ? (
        <p style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>Loading…</p>
      ) : providers.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--io-text-muted)', fontStyle: 'italic' }}>
          No SMS providers configured. Add one to enable SMS MFA.
        </p>
      ) : (
        <div
          style={{
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--io-surface-sunken)', borderBottom: '1px solid var(--io-border)' }}>
                {['Name', 'Type', 'From / URL', 'Enabled', 'Default', 'Last Test', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...cellStyle,
                      color: 'var(--io-text-muted)',
                      fontWeight: 600,
                      fontSize: '12px',
                      textAlign: 'left',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    borderTop: idx === 0 ? 'none' : '1px solid var(--io-border)',
                  }}
                >
                  <td style={{ ...cellStyle, color: 'var(--io-text-primary)', fontWeight: 500 }}>{p.name}</td>
                  <td style={cellStyle}>{p.provider_type === 'twilio' ? 'Twilio' : 'Webhook'}</td>
                  <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '12px' }}>
                    {p.provider_type === 'twilio'
                      ? (p.config.from_number ?? '—')
                      : (p.config.url ?? '—')}
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: p.enabled ? 'var(--io-success)' : 'var(--io-text-muted)',
                        marginRight: '6px',
                      }}
                    />
                    {p.enabled ? 'Yes' : 'No'}
                  </td>
                  <td style={cellStyle}>{p.is_default ? 'Yes' : '—'}</td>
                  <td style={cellStyle}>
                    {p.last_tested_at == null ? (
                      <span style={{ color: 'var(--io-text-muted)' }}>Never</span>
                    ) : (
                      <span style={{ color: p.last_test_ok ? 'var(--io-success)' : 'var(--io-danger)' }}>
                        {p.last_test_ok ? 'OK' : 'Failed'}{' '}
                        <span style={{ color: 'var(--io-text-muted)', fontSize: '11px' }}>
                          {new Date(p.last_tested_at).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    <button
                      style={btnDanger}
                      disabled={deletingId === p.id}
                      onClick={() => {
                        if (window.confirm(`Delete SMS provider "${p.name}"?`)) {
                          setDeletingId(p.id)
                          deleteMutation.mutate(p.id)
                        }
                      }}
                    >
                      {deletingId === p.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddProviderDialog
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            queryClient.invalidateQueries({ queryKey: ['sms-providers'] })
          }}
        />
      )}
    </div>
  )
}
