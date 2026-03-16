import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsApi } from '../../api/reports'

// ---------------------------------------------------------------------------
// ReportViewer — renders an HTML report in a sandboxed iframe
// ---------------------------------------------------------------------------

export default function ReportViewer() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const statusQuery = useQuery({
    queryKey: ['report-job-status', jobId],
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID')
      const result = await reportsApi.getJobStatus(jobId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!jobId,
  })

  const job = statusQuery.data

  if (!jobId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--io-text-muted)',
          fontSize: '14px',
        }}
      >
        No report ID specified.
      </div>
    )
  }

  const downloadUrl = reportsApi.getDownloadUrl(jobId)
  const reportName = job?.template_name ?? `Report ${jobId.slice(0, 8)}`

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
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 16px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-secondary)',
            cursor: 'pointer',
            padding: '5px 10px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Back
        </button>

        <span
          style={{
            flex: 1,
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {statusQuery.isLoading ? 'Loading...' : reportName}
        </span>

        {job?.status === 'completed' && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '5px 14px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Download
          </a>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {statusQuery.isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--io-text-muted)',
              fontSize: '14px',
              gap: '10px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid var(--io-text-muted)',
                borderTopColor: 'var(--io-accent)',
                borderRadius: '50%',
                animation: 'io-spin 0.6s linear infinite',
              }}
            />
            Loading report...
          </div>
        )}

        {statusQuery.isError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--io-danger)',
              fontSize: '14px',
            }}
          >
            Failed to load report details.
          </div>
        )}

        {job?.status === 'pending' || job?.status === 'running' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: 'var(--io-text-muted)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: '3px solid var(--io-border)',
                borderTopColor: 'var(--io-accent)',
                borderRadius: '50%',
                animation: 'io-spin 0.6s linear infinite',
              }}
            />
            <span style={{ fontSize: '14px' }}>Report is still generating...</span>
          </div>
        ) : job?.status === 'failed' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '8px',
              color: 'var(--io-danger)',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Report generation failed</span>
            {job.error_message && (
              <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                {job.error_message}
              </span>
            )}
          </div>
        ) : job?.status === 'completed' ? (
          <iframe
            src={downloadUrl}
            sandbox="allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#fff',
            }}
            title={reportName}
          />
        ) : null}
      </div>

      <style>{`
        @keyframes io-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
