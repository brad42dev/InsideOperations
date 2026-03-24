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
  bad_quality_count?: number
  update_rate?: number
}

export default function BadQualityBySourceWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ['bad-quality-by-source'],
    queryFn: async () => {
      const result = await api.get<OpcSourceStat[]>('/api/opc/sources/stats')
      if (!result.success) throw new Error(result.error.message)
      return result.data
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
        Failed to load source data
      </div>
    )
  }

  const sources = Array.isArray(query.data) ? query.data : []

  if (sources.length === 0) {
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
        No OPC sources configured
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 70px',
          padding: '4px 10px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
        }}
      >
        {['Source', 'Points', 'Bad'].map((h) => (
          <span
            key={h}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: h === 'Source' ? 'left' : 'center',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Source rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sources.map((src) => {
          const badCount = src.bad_quality_count ?? (src.connected ? 0 : src.subscribed_points ?? 0)
          const totalPts = src.subscribed_points ?? 0
          const hasBad = badCount > 0

          return (
            <div
              key={src.source_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 70px 70px',
                padding: '7px 10px',
                borderBottom: '1px solid var(--io-border)',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: src.connected ? '#22c55e' : '#ef4444',
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--io-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {src.name}
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--io-text-muted)',
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totalPts > 0 ? totalPts.toLocaleString() : '—'}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: hasBad ? 700 : 400,
                  color: hasBad ? 'var(--io-alarm-high)' : 'var(--io-text-muted)',
                  textAlign: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {hasBad ? badCount.toLocaleString() : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
