import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'

interface WebSocketHealth {
  active_connections: number
  total_subscriptions: number
  message_rate?: number
  backpressure_events?: number
  avg_connection_duration_s?: number
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--io-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'var(--io-font-mono, monospace)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '10px',
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default function WsThroughputWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ['ws-health'],
    queryFn: async () => {
      const result = await api.get<WebSocketHealth>('/api/health/websocket')
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 10000,
  })

  if (query.isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100px',
            height: '48px',
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <span>WebSocket data unavailable</span>
      </div>
    )
  }

  const d = query.data
  const msgRate = d.message_rate != null ? d.message_rate.toFixed(1) : '—'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 12px',
        flexWrap: 'wrap',
        gap: '8px',
      }}
    >
      <StatCell label="Connections" value={d.active_connections.toLocaleString()} />
      <StatCell label="Subscriptions" value={d.total_subscriptions.toLocaleString()} />
      <StatCell label="Msg/s" value={msgRate} />
      {d.backpressure_events != null && d.backpressure_events > 0 && (
        <StatCell label="Backpressure" value={d.backpressure_events.toLocaleString()} />
      )}
    </div>
  )
}
