import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'

interface DatabaseHealth {
  services: Array<{
    service: string
    pool_size: number
    pool_idle: number
    pool_used: number
  }>
  migration_version?: string
  db_size_bytes?: number
  timescaledb_version?: string
  compression_ratio?: number
  replication_lag_ms?: number | null
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function DbSizeWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ['health-database'],
    queryFn: async () => {
      const result = await api.get<DatabaseHealth>('/api/health/database')
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
            width: '100px',
            height: '56px',
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    )
  }

  if (query.isError || !query.data) {
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
        Database data unavailable
      </div>
    )
  }

  const d = query.data

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        padding: '12px',
      }}
    >
      <div
        style={{
          fontSize: '36px',
          fontWeight: 700,
          color: 'var(--io-text-primary)',
          fontFamily: 'var(--io-font-mono, monospace)',
          lineHeight: 1,
        }}
      >
        {d.db_size_bytes != null ? formatBytes(d.db_size_bytes) : '—'}
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
        Database Size
      </div>
      {d.compression_ratio != null && (
        <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '4px' }}>
          Compression: {d.compression_ratio.toFixed(2)}x
        </div>
      )}
      {d.timescaledb_version && (
        <div style={{ fontSize: '10px', color: 'var(--io-text-muted)' }}>
          TimescaleDB {d.timescaledb_version}
        </div>
      )}
    </div>
  )
}
