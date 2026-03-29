import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'

interface PointStatusTableConfig {
  title?: string
  variable?: string
  filter?: string
  limit?: number
}

interface PointCurrentStatus {
  point_id: string
  tagname: string
  display_name?: string | null
  source_name?: string | null
  area?: string | null
  value?: number | null
  quality: string
  timestamp?: string | null
  unit?: string | null
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

function fmtValue(v: number): string {
  const abs = Math.abs(v)
  if (!isFinite(v)) return String(v)
  if (abs === 0) return '0'
  if (abs >= 10000) return v.toFixed(0)
  if (abs >= 1000) return v.toFixed(1)
  if (abs >= 100) return v.toFixed(2)
  if (abs >= 1) return v.toFixed(3)
  return parseFloat(v.toPrecision(3)).toString()
}

function qualityColor(quality: string): string {
  switch (quality.toLowerCase()) {
    case 'good':
      return 'var(--io-alarm-normal)'
    case 'bad':
      return 'var(--io-alarm-critical)'
    case 'uncertain':
      return 'var(--io-alarm-medium)'
    default:
      return 'var(--io-text-muted)'
  }
}

function formatAge(ts: string | null | undefined): string {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function PointStatusTableWidget({ config, variables }: Props) {
  const cfg = config.config as unknown as PointStatusTableConfig
  const areaFilterVar = cfg.variable
  const areaFilter = areaFilterVar ? (variables[areaFilterVar]?.[0] ?? null) : null
  const filter = cfg.filter
  const limit = cfg.limit ?? 50

  const query = useQuery({
    queryKey: ['point-status-table', filter, areaFilter, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filter) params.set('filter', filter)
      const isAllFilter = !areaFilter || areaFilter === '__all__' || areaFilter.startsWith('$__')
      if (!isAllFilter) params.set('area', areaFilter!)
      params.set('limit', String(limit))
      const result = await api.get<PointCurrentStatus[]>(
        `/api/opc/points/status?${params.toString()}`,
      )
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
    return <PointStatusFallback />
  }

  const points = Array.isArray(query.data) ? query.data : []

  if (points.length === 0) {
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
        No points match the current filter
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 80px 80px 60px 60px',
          padding: '4px 10px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
        }}
      >
        {['Tag / Name', 'Value', 'Quality', 'Area', 'Age'].map((h) => (
          <span
            key={h}
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: h === 'Tag / Name' ? 'left' : 'center',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {points.map((pt) => (
          <div
            key={pt.point_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 60px 60px',
              padding: '5px 10px',
              borderBottom: '1px solid var(--io-border)',
              alignItems: 'center',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--io-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {pt.display_name ?? pt.tagname}
              </div>
              {pt.display_name && (
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--io-text-muted)',
                    fontFamily: 'var(--io-font-mono, monospace)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pt.tagname}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--io-text-primary)',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--io-font-mono, monospace)',
              }}
            >
              {pt.value != null ? `${fmtValue(pt.value)}${pt.unit ? ` ${pt.unit}` : ''}` : '—'}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: qualityColor(pt.quality),
                textAlign: 'center',
              }}
            >
              {pt.quality}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--io-text-muted)',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pt.area ?? '—'}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--io-text-muted)',
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatAge(pt.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Shown when the point status endpoint is unavailable */
function PointStatusFallback() {
  const query = useQuery({
    queryKey: ['point-status-fallback'],
    queryFn: async () => {
      const result = await api.get<{ data: { id: string; tagname: string; display_name: string | null; area: string | null }[]; pagination: { total: number } }>(
        '/api/points?limit=20',
      )
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 30000,
  })

  const pts = query.data?.data ?? []
  const total = query.data?.pagination.total ?? 0

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

  if (pts.length === 0) {
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
        No points configured
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          padding: '4px 10px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {total.toLocaleString()} points configured
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {pts.map((pt) => (
          <div
            key={pt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 10px',
              borderBottom: '1px solid var(--io-border)',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: 'var(--io-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {pt.display_name ?? pt.tagname}
            </span>
            {pt.area && (
              <span style={{ fontSize: '10px', color: 'var(--io-text-muted)', flexShrink: 0 }}>
                {pt.area}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
