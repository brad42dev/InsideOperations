import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi, type NotificationSeverity } from '../../api/notifications'

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

export default function MusterPage() {
  const navigate = useNavigate()

  const { data: messages, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'messages', 'muster'],
    queryFn: async () => {
      const result = await notificationsApi.listMessages({ limit: 50 })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 30_000,
  })

  const musterMessages = messages?.filter(
    m => m.severity === 'emergency' || m.severity === 'critical'
  ) ?? []

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--io-text-primary)', margin: 0, fontSize: 20, fontWeight: 600 }}>Muster Command Center</h2>
        <p style={{ color: 'var(--io-text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
          Personnel accountability and muster status overview
        </p>
      </div>

      <div style={{ border: '1px solid var(--io-border)', borderRadius: 8, background: 'var(--io-surface)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 120px 120px',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
        }}>
          {['Title', 'Sent At', 'Severity', ''].map((h, i) => (
            <div key={i} style={{ color: 'var(--io-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>Loading…</div>
        )}
        {isError && (
          <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>Failed to load muster data.</div>
        )}
        {!isLoading && !isError && musterMessages.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--io-text-muted)', fontSize: 14 }}>
            No active muster commands.
          </div>
        )}
        {musterMessages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 120px 120px',
              gap: 12,
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--io-border)',
            }}
          >
            <div style={{ color: 'var(--io-text-primary)', fontWeight: 500, fontSize: 14 }}>{msg.title}</div>
            <div style={{ color: 'var(--io-text-secondary)', fontSize: 13 }}>{formatTime(msg.sent_at)}</div>
            <SeverityBadge severity={msg.severity} />
            <div>
              <button
                onClick={() => navigate(`/alerts/muster/${msg.id}`)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--io-accent)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                View Muster
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
