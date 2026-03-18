import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type NotificationTemplate, type NotificationSeverity, type NotificationChannel } from '../../api/notifications'

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  emergency: '#ef4444',
  critical: '#f97316',
  warning: '#fbbf24',
  info: 'var(--io-accent)',
}

const SEVERITY_BG: Record<NotificationSeverity, string> = {
  emergency: 'rgba(239,68,68,0.12)',
  critical: 'rgba(249,115,22,0.12)',
  warning: 'rgba(251,191,36,0.15)',
  info: 'rgba(74,158,255,0.15)',
}

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  websocket: 'WS',
  email: 'Email',
  sms: 'SMS',
  pa: 'PA',
  radio: 'Radio',
  push: 'Push',
}

function SeverityBadge({ severity }: { severity: NotificationSeverity }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: SEVERITY_COLOR[severity],
      background: SEVERITY_BG[severity],
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {severity}
    </span>
  )
}

function TemplateRow({ template, onToggle }: { template: NotificationTemplate; onToggle: () => void }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 120px 120px 1fr 100px 70px',
      gap: 12,
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid var(--io-border)',
    }}>
      <div>
        <div style={{ color: 'var(--io-text-primary)', fontWeight: 500, fontSize: 14 }}>{template.name}</div>
        {template.category && (
          <div style={{ color: 'var(--io-text-muted)', fontSize: 12, marginTop: 2 }}>{template.category}</div>
        )}
      </div>

      <SeverityBadge severity={template.severity} />

      <div style={{ color: 'var(--io-text-secondary)', fontSize: 12 }}>
        {template.is_system ? (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            background: 'var(--io-surface-secondary)',
            color: 'var(--io-text-muted)',
          }}>System</span>
        ) : (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 11,
            background: 'var(--io-surface-secondary)',
            color: 'var(--io-text-muted)',
          }}>Custom</span>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {template.channels.map(ch => (
          <span key={ch} style={{
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 11,
            background: 'var(--io-surface-secondary)',
            color: 'var(--io-text-secondary)',
            border: '1px solid var(--io-border)',
          }}>
            {CHANNEL_LABEL[ch]}
          </span>
        ))}
      </div>

      <div>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 500,
          color: template.enabled ? '#22c55e' : 'var(--io-text-muted)',
          background: template.enabled ? 'rgba(34,197,94,0.12)' : 'var(--io-surface-secondary)',
        }}>
          {template.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div>
        <button
          onClick={onToggle}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--io-border)',
            background: 'transparent',
            color: 'var(--io-text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {template.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  )
}

export default function AlertTemplates() {
  const queryClient = useQueryClient()

  const { data: templates, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'templates'],
    queryFn: async () => {
      const result = await notificationsApi.listTemplates()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const result = await notificationsApi.updateTemplate(id, { enabled })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'templates'] })
    },
  })

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--io-text-primary)', margin: 0, fontSize: 20, fontWeight: 600 }}>Alert Templates</h2>
        <p style={{ color: 'var(--io-text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
          Pre-configured emergency alert message templates
        </p>
      </div>

      <div style={{ border: '1px solid var(--io-border)', borderRadius: 8, background: 'var(--io-surface)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 120px 1fr 100px 70px',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
        }}>
          {['Name', 'Severity', 'Type', 'Channels', 'Status', ''].map((h, i) => (
            <div key={i} style={{ color: 'var(--io-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>Loading…</div>
        )}
        {isError && (
          <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>Failed to load templates.</div>
        )}
        {templates && templates.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>No templates found.</div>
        )}
        {templates?.map(template => (
          <TemplateRow
            key={template.id}
            template={template}
            onToggle={() => toggleMutation.mutate({ id: template.id, enabled: !template.enabled })}
          />
        ))}
      </div>
    </div>
  )
}
