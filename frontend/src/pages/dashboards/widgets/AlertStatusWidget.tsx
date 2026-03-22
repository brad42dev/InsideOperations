import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import PointContextMenu from '../../../shared/components/PointContextMenu'

interface AlertStatusConfig {
  title: string
  severities?: string[]
  maxItems?: number
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#6b7280',
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

export default function AlertStatusWidget({ config }: Props) {
  const cfg = config.config as unknown as AlertStatusConfig
  const maxItems = cfg.maxItems ?? 20
  const filterSeverities = cfg.severities ?? []

  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['active-alarms', filterSeverities],
    queryFn: async () => {
      const result = await api.get<ActiveAlarm[]>('/api/alarms/active')
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 5000,
  })

  const acknowledgeMutation = useMutation({
    mutationFn: async (alarmId: string) => {
      const result = await api.post<void>(`/api/alarms/${alarmId}/acknowledge`, {})
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['active-alarms'] })
    },
  })

  const allAlarms = query.data ?? []
  const filtered =
    filterSeverities.length > 0
      ? allAlarms.filter((a) => filterSeverities.includes(a.severity))
      : allAlarms
  const alarms = filtered.slice(0, maxItems)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            color: 'var(--io-danger, #ef4444)',
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
            color: 'var(--io-success, #22c55e)',
            fontSize: '12px',
            gap: '6px',
          }}
        >
          <span>✓</span>
          <span>No active alarms</span>
        </div>
      )}

      {!query.isLoading && alarms.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {alarms.map((alarm) => {
            const sevColor = SEVERITY_COLORS[alarm.severity] ?? '#6b7280'
            const isAcknowledged = !!alarm.acknowledged_at

            return (
              // Right-click (desktop) or long-press (mobile — TODO) opens PointContextMenu.
              // alarm.source is the point reference for this alarm row.
              <PointContextMenu
                key={alarm.id}
                pointId={alarm.source}
                tagName={alarm.source}
                isAlarm={true}
                isAlarmElement={true}
              >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 10px',
                  borderBottom: '1px solid var(--io-border)',
                  opacity: isAcknowledged ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: '2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: sevColor,
                    display: 'inline-block',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span
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
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '100px',
                        background: `${sevColor}22`,
                        color: sevColor,
                        fontWeight: 700,
                        flexShrink: 0,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {alarm.severity}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--io-text-muted)',
                      marginTop: '2px',
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {alarm.source}
                    </span>
                    <span style={{ flexShrink: 0 }}>{timeAgo(alarm.triggered_at)}</span>
                  </div>
                </div>
                {!isAcknowledged && (
                  <button
                    onClick={() => acknowledgeMutation.mutate(alarm.id)}
                    disabled={acknowledgeMutation.isPending}
                    title="Acknowledge"
                    style={{
                      flexShrink: 0,
                      background: 'none',
                      border: '1px solid var(--io-border)',
                      borderRadius: 'var(--io-radius)',
                      color: 'var(--io-text-muted)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: '10px',
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                        'var(--io-accent)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-accent)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                        'var(--io-border)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-text-muted)'
                    }}
                  >
                    ACK
                  </button>
                )}
                {isAcknowledged && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: '10px',
                      color: 'var(--io-success, #22c55e)',
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              </PointContextMenu>
            )
          })}
        </div>
      )}

      {!query.isLoading && filtered.length > maxItems && (
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
          +{filtered.length - maxItems} more alarms
        </div>
      )}
    </div>
  )
}
