import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { fetchServiceHealth, type ServiceHealth } from '../../../api/health'
import type { WidgetConfig } from '../../../api/dashboards'

interface ServiceDetail extends ServiceHealth {
  uptime?: string
  version?: string
  response_p50?: number
  response_p95?: number
  request_rate?: number
  error_rate?: number
  checked_at?: string
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  degraded: 'var(--io-alarm-medium)',
  unhealthy: 'var(--io-alarm-critical)',
  unknown: 'var(--io-text-muted)',
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown
  return (
    <span
      style={{
        display: 'inline-block',
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: color,
        boxShadow: status === 'healthy' ? '0 0 3px rgba(34,197,94,0.6)' : undefined,
        flexShrink: 0,
      }}
    />
  )
}

export default function ServiceHealthTableWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ['service-health-detail'],
    queryFn: async (): Promise<ServiceDetail[]> => {
      const base = await fetchServiceHealth()
      const result = await api.get<ServiceDetail[]>('/api/health/services/detail')
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        return result.data
      }
      return base.map((s) => ({ ...s, checked_at: new Date().toISOString() }))
    },
    refetchInterval: 15000,
  })

  if (query.isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
        }}
      >
        Loading...
      </div>
    )
  }

  const services = query.data ?? []

  if (services.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
        }}
      >
        No service data available
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '20px 1fr 70px 70px 70px 60px',
          gap: '4px',
          padding: '4px 10px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
        }}
      >
        {['', 'Service', 'Status', 'p50 ms', 'p95 ms', 'Err%'].map((h) => (
          <span
            key={h}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {services.map((svc) => (
          <div
            key={svc.name}
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr 70px 70px 70px 60px',
              gap: '4px',
              padding: '6px 10px',
              borderBottom: '1px solid var(--io-border)',
              alignItems: 'center',
            }}
          >
            <StatusDot status={svc.status} />
            <span
              style={{
                fontSize: '12px',
                color: 'var(--io-text-primary)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {svc.name}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: STATUS_COLORS[svc.status] ?? STATUS_COLORS.unknown,
                fontWeight: 600,
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {svc.status}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--io-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--io-font-mono, monospace)',
              }}
            >
              {svc.response_p50 != null ? svc.response_p50.toFixed(1) : '—'}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--io-text-secondary)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--io-font-mono, monospace)',
              }}
            >
              {svc.response_p95 != null ? svc.response_p95.toFixed(1) : '—'}
            </span>
            <span
              style={{
                fontSize: '11px',
                color:
                  svc.error_rate != null && svc.error_rate > 1
                    ? 'var(--io-alarm-high)'
                    : 'var(--io-text-muted)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--io-font-mono, monospace)',
              }}
            >
              {svc.error_rate != null ? `${svc.error_rate.toFixed(1)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
