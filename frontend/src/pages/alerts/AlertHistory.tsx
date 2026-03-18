import { useState } from 'react'
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

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  sent: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  partial: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
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

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOR[status] ?? { color: 'var(--io-text-muted)', bg: 'transparent' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 600,
      color: s.color,
      background: s.bg,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

const PAGE_LIMIT = 20

export default function AlertHistory() {
  const [page, setPage] = useState(1)
  const [severity, setSeverity] = useState<NotificationSeverity | ''>('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications', 'messages', page, severity],
    queryFn: async () => {
      const result = await notificationsApi.listMessages({
        page,
        limit: PAGE_LIMIT,
        severity: severity || undefined,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    placeholderData: prev => prev,
  })

  const messages = Array.isArray(data) ? data : []
  const hasMore = messages.length === PAGE_LIMIT

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--io-text-primary)', margin: 0, fontSize: 20, fontWeight: 600 }}>Alert History</h2>
          <p style={{ color: 'var(--io-text-secondary)', margin: '4px 0 0', fontSize: 14 }}>Historical record of all sent alerts</p>
        </div>
        <select
          value={severity}
          onChange={e => { setSeverity(e.target.value as NotificationSeverity | ''); setPage(1) }}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--io-border)',
            background: 'var(--io-surface)',
            color: 'var(--io-text-primary)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="">All severities</option>
          <option value="emergency">Emergency</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div style={{ border: '1px solid var(--io-border)', borderRadius: 8, background: 'var(--io-surface)', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr 150px 160px 80px 90px',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
        }}>
          {['Severity', 'Title', 'Sent By', 'Sent At', 'Recipients', 'Status'].map(h => (
            <div key={h} style={{ color: 'var(--io-text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>Loading…</div>
        )}
        {isError && (
          <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>Failed to load alert history.</div>
        )}
        {!isLoading && !isError && messages.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--io-text-muted)' }}>No alerts found.</div>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 150px 160px 80px 90px',
              gap: 12,
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid var(--io-border)',
            }}
          >
            <SeverityBadge severity={msg.severity} />
            <div style={{ color: 'var(--io-text-primary)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {msg.title}
            </div>
            <div style={{ color: 'var(--io-text-secondary)', fontSize: 13 }}>{msg.sent_by_name ?? msg.sent_by}</div>
            <div style={{ color: 'var(--io-text-secondary)', fontSize: 13 }}>{formatTime(msg.sent_at)}</div>
            <div style={{ color: 'var(--io-text-secondary)', fontSize: 13 }}>{msg.recipient_count}</div>
            <StatusBadge status={msg.status} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--io-border)',
            background: 'transparent',
            color: page === 1 ? 'var(--io-text-muted)' : 'var(--io-text-primary)',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          Previous
        </button>
        <span style={{ color: 'var(--io-text-secondary)', fontSize: 13 }}>Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasMore}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--io-border)',
            background: 'transparent',
            color: !hasMore ? 'var(--io-text-muted)' : 'var(--io-text-primary)',
            cursor: !hasMore ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
