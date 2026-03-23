import { useQuery } from '@tanstack/react-query'
import { fetchServiceHealth, type ServiceHealth } from '../../../api/health'
import type { WidgetConfig } from '../../../api/dashboards'

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

function StatusDot({ status }: { status: ServiceHealth['status'] }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: color,
        boxShadow: status === 'healthy' ? `0 0 4px rgba(34,197,94,0.6)` : undefined,
        flexShrink: 0,
      }}
      aria-label={status}
    />
  )
}

export default function ServiceHealthWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ['service-health'],
    queryFn: fetchServiceHealth,
    refetchInterval: 30000,
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
  const healthyCount = services.filter((s) => s.status === 'healthy').length
  const allHealthy = healthyCount === services.length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600 }}>
          {healthyCount}/{services.length} healthy
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: allHealthy ? '#22c55e' : 'var(--io-alarm-high)',
          }}
        >
          {allHealthy ? 'OK' : 'DEGRADED'}
        </span>
      </div>

      {/* Service list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {services.map((svc) => (
          <div
            key={svc.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderBottom: '1px solid var(--io-border)',
            }}
          >
            <StatusDot status={svc.status} />
            <span
              style={{
                flex: 1,
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
            {svc.message && (
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--io-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100px',
                  flexShrink: 0,
                }}
                title={svc.message}
              >
                {svc.message}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
