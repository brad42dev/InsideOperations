import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, type ReportJob } from '../../api/reports'
import DataTable from '../../shared/components/DataTable'
import type { ColumnDef } from '../../shared/components/DataTable'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, React.CSSProperties> = {
    pending: { background: 'var(--io-surface-secondary)', color: 'var(--io-text-muted)' },
    running: {
      background: 'rgba(45,212,191,0.15)',
      color: 'var(--io-accent)',
    },
    completed: { background: 'rgba(34,197,94,0.15)', color: 'var(--io-success)' },
    failed: { background: 'rgba(239,68,68,0.15)', color: 'var(--io-danger)' },
  }

  const labels: Record<JobStatus, string> = {
    pending: 'Queued',
    running: 'Generating...',
    completed: 'Ready',
    failed: 'Failed',
  }

  const isPulsing = status === 'running'

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        animation: isPulsing ? 'io-status-pulse 1.5s ease-in-out infinite' : 'none',
        ...styles[status],
      }}
    >
      {labels[status]}
    </span>
  )
}

function FormatBadge({ format }: { format: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: '100px',
        fontSize: '10px',
        fontWeight: 700,
        background: 'var(--io-surface-secondary)',
        color: 'var(--io-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {format}
    </span>
  )
}

// ---------------------------------------------------------------------------
// MyExports page
// ---------------------------------------------------------------------------

export default function MyExports() {
  const navigate = useNavigate()

  const query = useQuery({
    queryKey: ['report-exports'],
    queryFn: async () => {
      const result = await reportsApi.listMyExports({ limit: 100 })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data
    },
    // Auto-refresh every 5 seconds if any job is still active
    refetchInterval: (query) => {
      const jobs = query.state.data ?? []
      const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running')
      return hasActive ? 5000 : false
    },
  })

  const jobs: ReportJob[] = query.data ?? []

  const columns: ColumnDef<ReportJob>[] = [
    {
      id: 'name',
      header: 'Name / Template',
      cell: (_val, row) => (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
            {row.template_name ?? `Export ${row.id.slice(0, 8)}`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '1px' }}>
            ID: {row.id.slice(0, 8)}
          </div>
        </div>
      ),
      minWidth: 180,
      sortable: true,
    },
    {
      id: 'format',
      header: 'Format',
      cell: (_val, row) => <FormatBadge format={row.format} />,
      width: 80,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (_val, row) => <StatusBadge status={row.status} />,
      width: 130,
    },
    {
      id: 'file_size_bytes',
      header: 'Size',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {formatBytes(row.file_size_bytes)}
        </span>
      ),
      width: 80,
    },
    {
      id: 'created_at',
      header: 'Created',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {formatDate(row.created_at)}
        </span>
      ),
      width: 140,
      sortable: true,
    },
    {
      id: 'expires_at',
      header: 'Expires',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {formatDate(row.expires_at)}
        </span>
      ),
      width: 140,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (_val, row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {row.status === 'completed' && (
            <>
              <a
                href={reportsApi.getDownloadUrl(row.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '3px 9px',
                  background: 'var(--io-accent-subtle)',
                  border: '1px solid var(--io-accent)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Download
              </a>
              {row.format === 'html' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/reports/view/${row.id}`)
                  }}
                  style={{
                    padding: '3px 9px',
                    background: 'transparent',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    color: 'var(--io-text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  View
                </button>
              )}
            </>
          )}
          {row.status === 'failed' && (
            <span style={{ fontSize: '11px', color: 'var(--io-danger)' }}>
              {row.error_message ? row.error_message.slice(0, 36) : 'Failed'}
            </span>
          )}
        </div>
      ),
      width: 180,
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          My Exports
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2
              style={{
                margin: '0 0 4px',
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--io-text-primary)',
              }}
            >
              My Exports
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
              All report and data export jobs you have generated
            </p>
          </div>
          {query.isFetching && (
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid var(--io-border)',
                borderTopColor: 'var(--io-accent)',
                borderRadius: '50%',
                animation: 'io-spin 0.6s linear infinite',
              }}
            />
          )}
        </div>

        {query.isError && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            Failed to load exports: {query.error instanceof Error ? query.error.message : 'Unknown error'}
          </div>
        )}

        <DataTable<ReportJob>
          data={jobs}
          columns={columns}
          height={520}
          rowHeight={48}
          loading={query.isLoading}
          emptyMessage="No exports yet. Generate a report from the Reports module."
        />
      </div>

      <style>{`
        @keyframes io-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes io-status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
