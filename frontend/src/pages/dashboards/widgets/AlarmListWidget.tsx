import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import PointContextMenu from '../../../shared/components/PointContextMenu'

interface AlarmListConfig {
  title?: string
  severities?: string[]
  maxItems?: number
  showAcknowledged?: boolean
}

interface ActiveAlarm {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  source: string
  state: string
  triggered_at: string
  acknowledged_at?: string | null
}

// ISA-101 alarm severity color tokens
const SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--io-alarm-critical)',
  high: 'var(--io-alarm-high)',
  medium: 'var(--io-alarm-medium)',
  low: 'var(--io-info)',
  info: 'var(--io-text-muted)',
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function AlarmListWidget({ config }: Props) {
  const cfg = config.config as unknown as AlarmListConfig
  const maxItems = cfg.maxItems ?? 50
  const filterSeverities = cfg.severities ?? []
  const showAcknowledged = cfg.showAcknowledged ?? true

  const query = useQuery({
    queryKey: ['active-alarms-list', filterSeverities, showAcknowledged],
    queryFn: async () => {
      const result = await api.get<ActiveAlarm[]>('/api/alarms/active')
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 5000,
  })

  const allAlarms = query.data ?? []
  let filtered = filterSeverities.length > 0
    ? allAlarms.filter((a) => filterSeverities.includes(a.severity))
    : allAlarms

  if (!showAcknowledged) {
    filtered = filtered.filter((a) => !a.acknowledged_at)
  }

  // Sort by severity rank then by triggered_at descending
  const sorted = [...filtered].sort((a, b) => {
    const rankDiff = (SEVERITY_RANK[a.severity] ?? 99) - (SEVERITY_RANK[b.severity] ?? 99)
    if (rankDiff !== 0) return rankDiff
    return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()
  })

  const alarms = sorted.slice(0, maxItems)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '12px 1fr auto auto',
          gap: '8px',
          padding: '4px 10px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <span />
        <span style={{ fontSize: '10px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Alarm
        </span>
        <span style={{ fontSize: '10px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Severity
        </span>
        <span style={{ fontSize: '10px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Age
        </span>
      </div>

      {query.isLoading && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--io-text-muted)',
            fontSize: '12px',
          }}
        >
          Loading...
        </div>
      )}

      {query.isError && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--io-danger)',
            fontSize: '12px',
          }}
        >
          Failed to load alarms
        </div>
      )}

      {!query.isLoading && !query.isError && alarms.length === 0 && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--io-alarm-normal)',
            fontSize: '12px',
            gap: '6px',
          }}
        >
          <span>No active alarms</span>
        </div>
      )}

      {!query.isLoading && alarms.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {alarms.map((alarm) => {
            const sevColor = SEVERITY_COLORS[alarm.severity] ?? 'var(--io-text-muted)'
            const isAcknowledged = !!alarm.acknowledged_at

            return (
              <PointContextMenu
                key={alarm.id}
                pointId={alarm.source}
                tagName={alarm.source}
                isAlarm={true}
                isAlarmElement={true}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '12px 1fr auto auto',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--io-border)',
                    opacity: isAcknowledged ? 0.6 : 1,
                  }}
                >
                  {/* Severity indicator dot */}
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: sevColor,
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />

                  {/* Alarm name + source */}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--io-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alarm.title}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--io-text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alarm.source}
                    </div>
                  </div>

                  {/* Severity badge */}
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '100px',
                      background: `color-mix(in srgb, ${sevColor} 13%, transparent)`,
                      color: sevColor,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {alarm.severity}
                  </span>

                  {/* Age */}
                  <span style={{ fontSize: '10px', color: 'var(--io-text-muted)', whiteSpace: 'nowrap' }}>
                    {isAcknowledged ? (
                      <span style={{ color: 'var(--io-alarm-normal)' }}>ACK</span>
                    ) : (
                      timeAgo(alarm.triggered_at)
                    )}
                  </span>
                </div>
              </PointContextMenu>
            )
          })}
        </div>
      )}

      {!query.isLoading && sorted.length > maxItems && (
        <div
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            color: 'var(--io-text-muted)',
            borderTop: '1px solid var(--io-border)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          +{sorted.length - maxItems} more alarms
        </div>
      )}
    </div>
  )
}
