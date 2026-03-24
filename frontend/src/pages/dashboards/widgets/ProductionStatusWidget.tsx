import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

interface OpcSourceStat {
  source_id: string
  name: string
  connected: boolean
  subscribed_points?: number
  update_rate?: number
}

interface ActiveAlarm {
  id: string
  severity: string
  source: string
}

/**
 * Production Status widget — shows an overall production state indicator
 * derived from OPC source connectivity and active alarm count.
 *
 * States: NORMAL, DEGRADED, UPSET, OFFLINE
 */
function deriveStatus(
  sources: OpcSourceStat[],
  alarms: ActiveAlarm[],
): { label: string; color: string; detail: string } {
  if (sources.length === 0) {
    return {
      label: 'NO DATA',
      color: 'var(--io-text-muted)',
      detail: 'No OPC sources configured',
    }
  }

  const connectedSources = sources.filter((s) => s.connected).length
  const critical = alarms.filter((a) => a.severity === 'critical').length
  const high = alarms.filter((a) => a.severity === 'high').length

  if (connectedSources === 0) {
    return {
      label: 'OFFLINE',
      color: 'var(--io-alarm-critical)',
      detail: `All ${sources.length} sources disconnected`,
    }
  }

  if (connectedSources < sources.length || critical > 0) {
    return {
      label: 'UPSET',
      color: 'var(--io-alarm-high)',
      detail: `${critical} critical alarm${critical !== 1 ? 's' : ''}${connectedSources < sources.length ? ', partial connectivity' : ''}`,
    }
  }

  if (high > 5 || alarms.length > 20) {
    return {
      label: 'DEGRADED',
      color: 'var(--io-alarm-medium)',
      detail: `${alarms.length} active alarms`,
    }
  }

  return {
    label: 'NORMAL',
    color: 'var(--io-alarm-normal)',
    detail: `${connectedSources} source${connectedSources !== 1 ? 's' : ''} connected`,
  }
}

export default function ProductionStatusWidget({ config: _config }: Props) {
  const sourcesQuery = useQuery({
    queryKey: ['production-status-sources'],
    queryFn: async () => {
      const result = await api.get<OpcSourceStat[]>('/api/opc/sources/stats')
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 15000,
  })

  const alarmsQuery = useQuery({
    queryKey: ['production-status-alarms'],
    queryFn: async () => {
      const result = await api.get<ActiveAlarm[]>('/api/alarms/active')
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 10000,
  })

  const isLoading = sourcesQuery.isLoading || alarmsQuery.isLoading
  const isError = sourcesQuery.isError || alarmsQuery.isError

  if (isLoading) {
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
            height: '64px',
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-danger)',
          fontSize: '12px',
        }}
      >
        Failed to load status data
      </div>
    )
  }

  // Guard against non-array API responses (e.g. paginated envelopes or null)
  const sources = Array.isArray(sourcesQuery.data) ? sourcesQuery.data : []
  const alarms = Array.isArray(alarmsQuery.data) ? alarmsQuery.data : []
  const status = deriveStatus(sources, alarms)

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '12px',
      }}
    >
      {/* Status badge */}
      <div
        style={{
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '0.12em',
          color: status.color,
          padding: '4px 12px',
          border: `2px solid ${status.color}`,
          borderRadius: '4px',
          textTransform: 'uppercase',
        }}
      >
        {status.label}
      </div>

      {/* Detail */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--io-text-muted)',
          textAlign: 'center',
        }}
      >
        {status.detail}
      </div>

      {/* Quick stats */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '4px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {sources.filter((s) => s.connected).length}/{sources.length}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--io-text-muted)', textTransform: 'uppercase' }}>
            Sources
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: alarms.length > 0 ? 'var(--io-alarm-medium)' : 'var(--io-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {alarms.length}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--io-text-muted)', textTransform: 'uppercase' }}>
            Alarms
          </div>
        </div>
      </div>
    </div>
  )
}
