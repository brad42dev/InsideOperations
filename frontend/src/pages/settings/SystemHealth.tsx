import { useQuery } from '@tanstack/react-query'
import { fetchServiceHealth, type ServiceStatus } from '../../api/health'

const STATUS_COLORS: Record<ServiceStatus, { bg: string; text: string; label: string }> = {
  healthy:   { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', label: 'Healthy' },
  degraded:  { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'Degraded' },
  unhealthy: { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', label: 'Unhealthy' },
  unknown:   { bg: 'var(--io-surface-secondary)', text: 'var(--io-text-muted)', label: 'Unknown' },
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '3px 10px', borderRadius: '100px', background: c.bg, color: c.text, fontWeight: 700 }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.text, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}

export default function SystemHealth() {
  const { data: services, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['health', 'services'],
    queryFn: fetchServiceHealth,
    refetchInterval: 30_000,
  })

  const all = services ?? []
  const healthyCnt = all.filter((s) => s.status === 'healthy').length
  const unhealthyCnt = all.filter((s) => s.status === 'unhealthy').length
  const degradedCnt = all.filter((s) => s.status === 'degraded').length

  const overallStatus: ServiceStatus =
    unhealthyCnt > 0 ? 'unhealthy' :
    degradedCnt > 0 ? 'degraded' :
    healthyCnt === all.length && all.length > 0 ? 'healthy' :
    'unknown'

  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>System Health</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Backend service status — refreshes every 30 seconds.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <StatusBadge status={overallStatus} />
          <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '4px' }}>
            Last checked: {lastChecked}
          </div>
          <button
            onClick={() => void refetch()}
            style={{ marginTop: '4px', padding: '3px 10px', background: 'none', border: '1px solid var(--io-border)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--io-text-secondary)' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Healthy', count: healthyCnt, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: 'Degraded', count: degradedCnt, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
          { label: 'Unhealthy', count: unhealthyCnt, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '16px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
            <div style={{ fontSize: '12px', color: s.color, fontWeight: 600, marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Services table */}
      <div style={{ border: '1px solid var(--io-border)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--io-surface-secondary)' }}>
              {['Service', 'Port', 'Status', 'Message'].map((h) => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--io-text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--io-border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--io-text-muted)' }}>Checking services…</td></tr>
            ) : all.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--io-text-muted)' }}>No services found.</td></tr>
            ) : (
              all.map((svc, i) => (
                <tr key={svc.name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--io-surface-secondary)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--io-text-primary)', fontFamily: 'var(--io-font-mono, monospace)', fontSize: '12px' }}>
                    {svc.name}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--io-text-muted)', fontFamily: 'var(--io-font-mono, monospace)', fontSize: '12px' }}>
                    :{svc.port}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <StatusBadge status={svc.status} />
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--io-text-muted)', fontSize: '12px' }}>
                    {svc.message ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
