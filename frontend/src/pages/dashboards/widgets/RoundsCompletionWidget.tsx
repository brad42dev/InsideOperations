import { useQuery } from '@tanstack/react-query'
import { roundsApi } from '../../../api/rounds'
import type { WidgetConfig } from '../../../api/dashboards'

interface RoundsCompletionConfig {
  title?: string
  window_hours?: number
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function RoundsCompletionWidget({ config }: Props) {
  const cfg = config.config as unknown as RoundsCompletionConfig
  const windowHours = cfg.window_hours ?? 24

  const query = useQuery({
    queryKey: ['rounds-completion', windowHours],
    queryFn: async () => {
      const end = new Date()
      const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000)
      const result = await roundsApi.listInstances({
        from: start.toISOString(),
        to: end.toISOString(),
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 60000,
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
            width: '80px',
            height: '56px',
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  if (query.isError) {
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
        Failed to load rounds data
      </div>
    )
  }

  const instances = query.data ?? []

  if (instances.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
        }}
      >
        <span style={{ fontSize: '22px', opacity: 0.3 }}>✓</span>
        <span>No rounds in last {windowHours}h</span>
      </div>
    )
  }

  const completed = instances.filter((i) => i.status === 'completed').length
  const total = instances.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const inProgress = instances.filter((i) => i.status === 'in_progress').length
  const missed = instances.filter((i) => i.status === 'missed').length

  const color =
    pct >= 90
      ? 'var(--io-alarm-normal)'
      : pct >= 70
        ? 'var(--io-alarm-medium)'
        : 'var(--io-alarm-high)'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '10px',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          fontWeight: 700,
          lineHeight: 1,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pct}%
      </div>
      <div
        style={{
          fontSize: '11px',
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}
      >
        Completion ({windowHours}h)
      </div>
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginTop: '4px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--io-alarm-normal)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {completed}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--io-text-muted)', textTransform: 'uppercase' }}>
            Done
          </div>
        </div>
        {inProgress > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--io-info)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {inProgress}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--io-text-muted)', textTransform: 'uppercase' }}>
              Active
            </div>
          </div>
        )}
        {missed > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--io-alarm-high)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {missed}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--io-text-muted)', textTransform: 'uppercase' }}>
              Missed
            </div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--io-text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {total}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--io-text-muted)', textTransform: 'uppercase' }}>
            Total
          </div>
        </div>
      </div>
    </div>
  )
}
