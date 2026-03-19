import { useQuery } from '@tanstack/react-query'

type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

interface ServiceHealth {
  name: string
  status: ServiceStatus
}

interface HealthResponse {
  status: ServiceStatus
  services?: Record<string, { status: ServiceStatus }>
}

// The 11 backend services
const SERVICE_NAMES: { key: string; label: string }[] = [
  { key: 'api_gateway',        label: 'API Gateway' },
  { key: 'data_broker',        label: 'Data Broker' },
  { key: 'opc_service',        label: 'OPC Service' },
  { key: 'event_service',      label: 'Event Service' },
  { key: 'parser_service',     label: 'Parser Service' },
  { key: 'archive_service',    label: 'Archive Service' },
  { key: 'import_service',     label: 'Import Service' },
  { key: 'alert_service',      label: 'Alert Service' },
  { key: 'email_service',      label: 'Email Service' },
  { key: 'auth_service',       label: 'Auth Service' },
  { key: 'recognition_service',label: 'Recognition Service' },
]

async function fetchHealth(): Promise<ServiceHealth[]> {
  try {
    const token = localStorage.getItem('io_access_token') ?? ''
    const r = await fetch('/api/health/services', {
      signal: AbortSignal.timeout(3000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) {
      // All unknown when unreachable
      return SERVICE_NAMES.map(({ key, label }) => ({ name: label, status: 'unknown', key }))
    }
    const data: HealthResponse = await r.json()

    return SERVICE_NAMES.map(({ key, label }) => {
      const svc = data.services?.[key]
      if (svc?.status) {
        return { name: label, status: svc.status }
      }
      // If no per-service breakdown, fall back to aggregate
      return { name: label, status: data.status ?? 'unknown' }
    })
  } catch {
    return SERVICE_NAMES.map(({ label }) => ({ name: label, status: 'unknown' }))
  }
}

const STATUS_COLOR: Record<ServiceStatus, string> = {
  healthy:   'var(--io-success)',
  degraded:  'var(--io-warning)',
  unhealthy: 'var(--io-danger)',
  unknown:   'var(--io-text-muted)',
}

/** Aggregate single dot — used in collapsed sidebar or as overflow indicator */
export function SystemHealthDot() {
  const { data: services } = useQuery({
    queryKey: ['system-health-dot'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  // Aggregate: worst status wins
  let aggregate: ServiceStatus = 'unknown'
  if (services) {
    if (services.some((s) => s.status === 'unhealthy'))   aggregate = 'unhealthy'
    else if (services.some((s) => s.status === 'degraded')) aggregate = 'degraded'
    else if (services.every((s) => s.status === 'healthy')) aggregate = 'healthy'
    else aggregate = 'unknown'
  }

  const label =
    aggregate === 'healthy'   ? 'All services healthy' :
    aggregate === 'degraded'  ? 'Some services degraded' :
    aggregate === 'unhealthy' ? 'One or more services unhealthy' :
                                'Health status unknown'

  return (
    <div
      title={label}
      aria-label={label}
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: STATUS_COLOR[aggregate],
        flexShrink: 0,
        boxShadow: aggregate === 'unhealthy' ? `0 0 4px ${STATUS_COLOR[aggregate]}` : undefined,
      }}
    />
  )
}

/** Expanded row of 11 per-service health dots — used in expanded sidebar footer */
export function SystemHealthDotRow() {
  const { data: services } = useQuery({
    queryKey: ['system-health-dot'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  const dots = services ?? SERVICE_NAMES.map(({ label }) => ({ name: label, status: 'unknown' as ServiceStatus }))

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
      }}
    >
      {dots.map((svc) => (
        <div
          key={svc.name}
          title={`${svc.name}: ${svc.status}`}
          aria-label={`${svc.name}: ${svc.status}`}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: STATUS_COLOR[svc.status],
            flexShrink: 0,
            boxShadow: svc.status === 'unhealthy' ? `0 0 3px ${STATUS_COLOR[svc.status]}` : undefined,
            cursor: 'default',
          }}
        />
      ))}
    </div>
  )
}
