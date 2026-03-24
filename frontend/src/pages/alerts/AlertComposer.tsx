import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  notificationsApi,
  type NotificationTemplate,
  type NotificationSeverity,
  type NotificationChannel,
  type SendNotificationPayload,
} from '../../api/notifications'
import { usePermission } from '../../shared/hooks/usePermission'

const ALL_SEVERITIES: NotificationSeverity[] = ['emergency', 'critical', 'warning', 'info']
// CHANNELS is loaded from Alert Service config at runtime.
// If the endpoint fails or is slow, show all six standard channels so the
// composer remains functional. The backend will reject unrecognised channels
// gracefully, and the DB seeds all six as enabled.
const FALLBACK_CHANNELS: NotificationChannel[] = ['websocket', 'email', 'sms', 'pa', 'radio', 'push']

// Default channels shown when no template is selected (ad-hoc notification)
const DEFAULT_CHANNELS: Set<NotificationChannel> = new Set(['websocket'])

const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  emergency: 'Emergency',
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--io-border)',
  background: 'var(--io-bg)',
  color: 'var(--io-text-primary)',
  fontSize: 14,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'var(--io-text-secondary)',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
}

export default function AlertComposer() {
  const navigate = useNavigate()
  const canSendEmergency = usePermission('alerts:send_emergency')

  const SEVERITIES = ALL_SEVERITIES.filter((s) => s !== 'emergency' || canSendEmergency)

  const [severity, setSeverity] = useState<NotificationSeverity>('info')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [channels, setChannels] = useState<Set<NotificationChannel>>(new Set(['websocket']))
  const [confirmed, setConfirmed] = useState(false)

  const { data: templatesRaw } = useQuery({
    queryKey: ['notifications', 'templates'],
    queryFn: async () => {
      const result = await notificationsApi.listTemplates({ enabled: true })
      if (!result.success) throw new Error(result.error.message)
      // Normalize: API may return a paged envelope object instead of a plain array
      const d = result.data as unknown
      if (Array.isArray(d)) return d as NotificationTemplate[]
      const paged = d as { data?: unknown }
      return (Array.isArray(paged?.data) ? paged.data : []) as NotificationTemplate[]
    },
  })
  const templates: NotificationTemplate[] = templatesRaw ?? []

  const { data: groupsData } = useQuery({
    queryKey: ['notifications', 'groups'],
    queryFn: async () => {
      const result = await notificationsApi.listGroups()
      if (!result.success) throw new Error(result.error.message)
      // list_groups returns a PagedResponse envelope — unwrap the inner array
      const d = result.data as unknown
      if (Array.isArray(d)) return d as import('../../api/notifications').NotificationGroup[]
      const paged = d as { data?: unknown }
      return (Array.isArray(paged?.data) ? paged.data : []) as import('../../api/notifications').NotificationGroup[]
    },
  })
  const groups = groupsData ?? []

  const { data: enabledChannelsResult } = useQuery({
    queryKey: ['notification-channels-enabled'],
    queryFn: () => notificationsApi.getEnabledChannels(),
    staleTime: 5 * 60 * 1000,
  })

  // Channels enabled in Alert Service config — fall back to all standard channels
  // if the API is unavailable (prevents the composer from appearing broken)
  const enabledChannels: NotificationChannel[] =
    (enabledChannelsResult?.success && enabledChannelsResult.data && enabledChannelsResult.data.length > 0)
      ? enabledChannelsResult.data
      : FALLBACK_CHANNELS

  const sendMutation = useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      const result = await notificationsApi.sendNotification(payload)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      setConfirmed(true)
      setTimeout(() => navigate('/alerts/active'), 1800)
    },
  })

  const sendEmergencyMutation = useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      const result = await notificationsApi.sendEmergency(payload)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      setConfirmed(true)
      setTimeout(() => navigate('/alerts/active'), 1800)
    },
  })

  function handleTemplateChange(id: string) {
    setSelectedTemplateId(id)
    if (!id) {
      // Ad-hoc notification selected — reset channels to the default set
      setChannels(new Set(DEFAULT_CHANNELS))
      return
    }
    const tpl = templates.find(t => t.id === id)
    if (tpl) {
      setSeverity(tpl.severity)
      // Apply the template's channel list to the composer checkboxes so the
      // user sees which channels the template is configured to send through.
      // Read channel list directly from the template object (not hardcoded).
      // Only include channels that are actually enabled in the system config.
      if (tpl.channels && tpl.channels.length > 0) {
        const tplSet = new Set(
          tpl.channels.filter((ch) => enabledChannels.includes(ch))
        )
        // Always keep websocket — it is the baseline delivery channel.
        tplSet.add('websocket')
        setChannels(tplSet)
      }
      // Do not overwrite title/body with raw template strings — the preview
      // will show the substituted result via the template selection.
    }
  }

  function toggleChannel(ch: NotificationChannel) {
    setChannels(prev => {
      const next = new Set(prev)
      if (next.has(ch)) next.delete(ch)
      else next.add(ch)
      return next
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    const payload: SendNotificationPayload = {
      severity,
      title: title.trim(),
      body: body.trim(),
      channels: Array.from(channels),
      ...(selectedTemplateId ? { template_id: selectedTemplateId } : {}),
      ...(selectedGroupId ? { group_id: selectedGroupId } : {}),
    }
    if (severity === 'emergency') {
      sendEmergencyMutation.mutate(payload)
    } else {
      sendMutation.mutate(payload)
    }
  }

  if (confirmed) {
    return (
      <div style={{ padding: 'var(--io-space-6)' }}>
        <div style={{
          maxWidth: 480,
          margin: '60px auto',
          textAlign: 'center',
          padding: 40,
          border: '1px solid var(--io-border)',
          borderRadius: 8,
          background: 'var(--io-surface)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ color: 'var(--io-text-primary)', fontSize: 18, fontWeight: 600 }}>Alert Sent</div>
          <div style={{ color: 'var(--io-text-secondary)', fontSize: 14, marginTop: 8 }}>Redirecting to active alerts…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <h2 style={{ color: 'var(--io-text-primary)', margin: '0 0 4px', fontSize: 20, fontWeight: 600 }}>Send Alert</h2>
      <p style={{ color: 'var(--io-text-secondary)', margin: '0 0 24px', fontSize: 14 }}>
        Compose and send a human-initiated emergency alert
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ display: 'grid', gap: 20 }}>

          {/* Emergency Quick-Send: prominent emergency/critical templates */}
          {templates.filter(t => (t.severity === 'critical') || (t.severity === 'emergency' && canSendEmergency)).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Emergency Quick-Send
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates
                  .filter(t => (t.severity === 'critical') || (t.severity === 'emergency' && canSendEmergency))
                  .map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateChange(t.id)}
                      style={{
                        padding: '10px 16px',
                        background: selectedTemplateId === t.id
                          ? (t.severity === 'emergency' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)')
                          : 'var(--io-surface)',
                        border: `2px solid ${t.severity === 'emergency' ? '#ef4444' : '#fbbf24'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 700,
                        color: t.severity === 'emergency' ? '#ef4444' : '#f59e0b',
                        transition: 'background 0.15s',
                      }}
                    >
                      {t.severity === 'emergency' ? '🚨 ' : '⚠️ '}{t.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <div>
              <label style={labelStyle}>Template (optional)</label>
              <select
                value={selectedTemplateId}
                onChange={e => handleTemplateChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select a template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Severity</label>
            <select value={severity} onChange={e => setSeverity(e.target.value as NotificationSeverity)} style={inputStyle}>
              {SEVERITIES.map(s => (
                <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Alert title"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Alert message body…"
              required
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {groups && groups.length > 0 && (
            <div>
              <label style={labelStyle}>Recipient Group (optional)</label>
              <select
                value={selectedGroupId}
                onChange={e => setSelectedGroupId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— All recipients —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Channels</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {enabledChannels.map(ch => (
                <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--io-text-primary)', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={channels.has(ch)}
                    onChange={() => toggleChannel(ch)}
                    style={{ accentColor: 'var(--io-accent)', width: 15, height: 15 }}
                  />
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Preview panel — reflects current template and channel selections */}
          <div style={{
            border: '1px solid var(--io-border)',
            borderRadius: 8,
            padding: '14px 16px',
            background: 'var(--io-surface)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Preview
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--io-text-secondary)', minWidth: 70 }}>Template:</span>
                <span style={{ fontSize: 13, color: 'var(--io-text-primary)' }}>
                  {selectedTemplateId
                    ? (templates.find(t => t.id === selectedTemplateId)?.name ?? '—')
                    : '— Ad-hoc notification —'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--io-text-secondary)', minWidth: 70 }}>Severity:</span>
                <span style={{ fontSize: 13, color: 'var(--io-text-primary)', textTransform: 'capitalize' }}>{severity}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: 'var(--io-text-secondary)', minWidth: 70 }}>Channels:</span>
                <span style={{ fontSize: 13, color: 'var(--io-text-primary)' }}>
                  {channels.size > 0
                    ? Array.from(channels).map(ch => ch.charAt(0).toUpperCase() + ch.slice(1)).join(', ')
                    : '—'}
                </span>
              </div>
              {title && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--io-text-secondary)', minWidth: 70 }}>Title:</span>
                  <span style={{ fontSize: 13, color: 'var(--io-text-primary)' }}>{title}</span>
                </div>
              )}
              {body && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, color: 'var(--io-text-secondary)', minWidth: 70, paddingTop: 1 }}>Message:</span>
                  <span style={{ fontSize: 13, color: 'var(--io-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</span>
                </div>
              )}
            </div>
          </div>

          {(sendMutation.isError || sendEmergencyMutation.isError) && (
            <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
              {(sendMutation.error ?? sendEmergencyMutation.error) instanceof Error
                ? (sendMutation.error ?? sendEmergencyMutation.error as Error).message
                : 'Failed to send alert'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            {(() => {
              const activeMutation = severity === 'emergency' ? sendEmergencyMutation : sendMutation
              return (
                <button
                  type="submit"
                  disabled={activeMutation.isPending || !title.trim() || !body.trim()}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--io-accent)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: activeMutation.isPending ? 'not-allowed' : 'pointer',
                    opacity: activeMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {activeMutation.isPending ? 'Sending…' : 'Send Alert'}
                </button>
              )
            })()}
            <button
              type="button"
              onClick={() => navigate('/alerts/active')}
              style={{
                padding: '8px 24px',
                borderRadius: 6,
                border: '1px solid var(--io-border)',
                background: 'transparent',
                color: 'var(--io-text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
