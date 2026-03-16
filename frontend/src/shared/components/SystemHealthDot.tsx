import { useQuery } from '@tanstack/react-query'

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

async function fetchHealth(): Promise<HealthStatus> {
  try {
    const r = await fetch('/healthz', { signal: AbortSignal.timeout(3000) })
    if (!r.ok) return 'unhealthy'
    const data = await r.json()
    // io-health returns { status: "healthy"|"degraded"|"unhealthy" }
    return (data.status as HealthStatus) ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

const COLOR: Record<HealthStatus, string> = {
  healthy:   'var(--io-success)',
  degraded:  'var(--io-warning)',
  unhealthy: 'var(--io-danger)',
  unknown:   'var(--io-text-muted)',
}

const LABEL: Record<HealthStatus, string> = {
  healthy:   'All services healthy',
  degraded:  'Some services degraded',
  unhealthy: 'Service unhealthy',
  unknown:   'Health status unknown',
}

export function SystemHealthDot() {
  const { data: status = 'unknown' } = useQuery({
    queryKey: ['system-health-dot'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  return (
    <div
      title={LABEL[status]}
      aria-label={LABEL[status]}
      style={{
        width: '8px', height: '8px',
        borderRadius: '50%',
        background: COLOR[status],
        flexShrink: 0,
        boxShadow: status === 'unhealthy' ? `0 0 4px ${COLOR[status]}` : undefined,
      }}
    />
  )
}
