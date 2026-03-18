import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi, type NotificationMessage, type NotificationChannel, type NotificationSeverity } from '../../api/notifications'

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

const CHANNEL_ICONS: Record<NotificationChannel, string> = {
  websocket: '🔔',
  email: '✉️',
  sms: '💬',
  pa: '📢',
  radio: '📻',
  push: '📲',
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
  const d = new Date(iso)
  return d.toLocaleString()
}

function AlertRow({ msg, onClick }: { msg: NotificationMessage; onClick?: () => void }) {
  const hasMuster = msg.severity === 'emergency' || msg.severity === 'critical'
  return (
    <div
      onClick={hasMuster && onClick ? onClick : undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr 160px 120px 80px',
        gap: 12,
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--io-border)',
        cursor: hasMuster ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (hasMuster) (e.currentTarget as HTMLDivElement).style.background = 'var(--io-surface-secondary)' }}
      onMouseLeave={e => { if (hasMuster) (e.currentTarget as HTMLDivElement).style.background = '' }}
    >
      <SeverityBadge severity={msg.severity} />
      <div>
        <div style={{ color: 'var(--io-text-primary)', fontWeight: 500, fontSize: 14 }}>{msg.title}</div>
        <div style={{ color: 'var(--io-text-muted)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {msg.body.length > 80 ? msg.body.slice(0, 80) + '…' : msg.body}
        </div>
      </div>
      <div style={{ color: 'var(--io-text-secondary)', fontSize: 12 }}>{formatTime(msg.sent_at)}</div>
      <div style={{ fontSize: 16, letterSpacing: 2 }}>
        {msg.channels.map(ch => (
          <span key={ch} title={ch}>{CHANNEL_ICONS[ch]}</span>
        ))}
      </div>
      <div style={{ color: 'var(--io-text-secondary)', fontSize: 13, textAlign: 'right' }}>
        {msg.recipient_count} rcpt
      </div>
    </div>
  )
}

export default function ActiveAlerts() {
  const navigate = useNavigate()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'active'],
    queryFn: async () => {
      const result = await notificationsApi.getActive()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const id = setInterval(() => { refetch() }, 30_000)
    return () => clearInterval(id)
  }, [refetch])

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--io-text-primary)', margin: 0, fontSize: 20, fontWeight: 600 }}>Active Alerts</h2>
          <p style={{ color: 'var(--io-text-secondary)', margin: '4px 0 0', fontSize: 14 }}>
            Currently active human-initiated alerts (last 24 hours)
          </p>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--io-border)',
            background: 'transparent',
            color: 'var(--io-text-secondary)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ border: '1px solid var(--io-border)', borderRadius: 8, background: 'var(--io-surface)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr 160px 120px 80px',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
        }}>
          {['Severity', 'Title / Preview', 'Sent At', 'Channels', 'Recipients'].map(h => (
            <div key={h} style={{ color: 'var(--io-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>Loading…</div>
        )}
        {isError && (
          <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>Failed to load active alerts.</div>
        )}
        {data && data.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>No active alerts.</div>
        )}
        {data && data.map(msg => (
          <AlertRow
            key={msg.id}
            msg={msg}
            onClick={() => navigate(`/alerts/muster/${msg.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
