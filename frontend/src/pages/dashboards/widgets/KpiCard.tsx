import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import { usePointValues } from '../../../shared/hooks/usePointValues'
import PointContextMenu from '../../../shared/components/PointContextMenu'

interface KpiConfig {
  title: string
  metric: string
  unit?: string
  thresholds?: { warning: number; critical: number }
  staticValue?: number
}

interface PointCurrentResponse {
  value: number
  quality: string
  timestamp: string
}

function getTrendColor(value: number, thresholds?: { warning: number; critical: number }): string {
  if (!thresholds) return 'var(--io-text-primary)'
  if (value >= thresholds.critical) return 'var(--io-danger, #ef4444)'
  if (value >= thresholds.warning) return 'var(--io-warning, #f59e0b)'
  return 'var(--io-success, #22c55e)'
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function KpiCard({ config }: Props) {
  const cfg = config.config as unknown as KpiConfig
  const pointId = cfg.metric

  const query = useQuery({
    queryKey: ['point-current', pointId],
    queryFn: async () => {
      if (!pointId || cfg.staticValue !== undefined) return null
      const result = await api.get<PointCurrentResponse>(`/api/points/${encodeURIComponent(pointId)}/current`)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 5000,
    enabled: !!pointId && cfg.staticValue === undefined,
  })

  // Real-time WebSocket subscription — overrides the API-fetched value when available
  const liveValues = usePointValues(pointId && cfg.staticValue === undefined ? [pointId] : [])
  const livePoint = pointId ? liveValues.get(pointId) : undefined

  const value = cfg.staticValue !== undefined
    ? cfg.staticValue
    : (livePoint?.value ?? query.data?.value ?? null)

  const displayValue = value !== null ? value.toFixed(2) : '—'
  const color = value !== null ? getTrendColor(value, cfg.thresholds) : 'var(--io-text-muted)'
  // Prefer live quality; fall back to API quality
  const quality = livePoint?.quality ?? query.data?.quality ?? 'unknown'
  const isStale = livePoint?.stale === true || quality === 'uncertain' || quality === 'bad'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '12px',
        gap: '4px',
      }}
    >
      {query.isLoading && (
        <div
          style={{
            width: '80px',
            height: '40px',
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
          }}
        />
      )}

      {!query.isLoading && (
        <>
          {/* Right-click (desktop) or long-press (mobile — TODO) opens PointContextMenu */}
          <PointContextMenu pointId={pointId ?? ''} tagName={pointId ?? ''} isAlarm={false} isAlarmElement={false}>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 700,
                color,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                opacity: isStale ? 0.6 : 1,
                cursor: pointId ? 'context-menu' : undefined,
              }}
            >
              {displayValue}
              {cfg.unit && (
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 400,
                    color: 'var(--io-text-muted)',
                    marginLeft: '4px',
                  }}
                >
                  {cfg.unit}
                </span>
              )}
            </div>
          </PointContextMenu>

          {(isStale || quality === 'bad') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: quality === 'bad' ? 'var(--io-danger, #ef4444)' : 'var(--io-warning, #f59e0b)',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--io-text-muted)', letterSpacing: '0.05em' }}>
                {quality === 'bad' ? 'BAD' : 'STALE'}
              </span>
            </div>
          )}

          {query.isError && (
            <span style={{ fontSize: '11px', color: 'var(--io-danger, #ef4444)' }}>
              Error loading value
            </span>
          )}
        </>
      )}
    </div>
  )
}
