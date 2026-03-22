import { useState } from 'react'
import type { WidgetConfig } from '../../../api/dashboards'

const TOKEN_KEY = 'io_access_token'
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

type ExportFormat = 'csv' | 'xlsx' | 'json' | 'parquet'

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'json', label: 'JSON (.json)' },
  { value: 'parquet', label: 'Parquet (.parquet)' },
]

/** Derive a filename-friendly label from the widget config. */
function getWidgetLabel(config: WidgetConfig): string {
  const cfg = config.config as Record<string, unknown>
  if (typeof cfg.title === 'string' && cfg.title.trim()) {
    return cfg.title.trim().replace(/[^a-z0-9_-]/gi, '_')
  }
  return `widget_${config.id}`
}

interface ExportRequest {
  widget_config: WidgetConfig
  format: ExportFormat
  time_range?: string
}

interface AsyncJobResponse {
  job_id: string
  status: string
}

interface Props {
  widgetConfig: WidgetConfig
  onClose: () => void
}

export default function ExportDataDialog({ widgetConfig, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null)

  const cfg = widgetConfig.config as Record<string, unknown>
  // For line-chart widgets, derive the time range from the widget config
  const timeRange = typeof cfg.timeRange === 'string' ? cfg.timeRange : '1h'

  async function handleDownload() {
    setLoading(true)
    setError(null)
    setAsyncJobId(null)

    const token = localStorage.getItem(TOKEN_KEY)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const body: ExportRequest = {
      widget_config: widgetConfig,
      format,
      time_range: timeRange,
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/export/widget`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (res.status === 202) {
        // Async job — large dataset
        let json: unknown
        try {
          json = await res.json()
        } catch {
          setError('Export job queued but could not read job ID from server response.')
          setLoading(false)
          return
        }
        const jobResp = json as { data?: AsyncJobResponse } & AsyncJobResponse
        const jobId = jobResp.data?.job_id ?? jobResp.job_id ?? null
        if (jobId) {
          setAsyncJobId(jobId)
        } else {
          setError('Export job queued. Check the export queue for your download.')
        }
        setLoading(false)
        return
      }

      if (!res.ok) {
        let errMsg = `Export failed (${res.status})`
        try {
          const errJson = (await res.json()) as { error?: { message?: string }; message?: string }
          errMsg = errJson.error?.message ?? errJson.message ?? errMsg
        } catch {
          // ignore parse errors
        }
        setError(errMsg)
        setLoading(false)
        return
      }

      // Synchronous download — stream blob
      const blob = await res.blob()
      const label = getWidgetLabel(widgetConfig)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `${label}_${timestamp}.${format}`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      setLoading(false)
      onClose()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          width: '360px',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--io-border)',
            background: 'var(--io-surface-secondary)',
          }}
        >
          <span
            id="export-dialog-title"
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}
          >
            Export Widget Data
          </span>
          <button
            onClick={onClose}
            aria-label="Close export dialog"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
              }}
            >
              Format
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FORMAT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--io-text-secondary)',
                  }}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    style={{ accentColor: 'var(--io-accent, #4A9EFF)', cursor: 'pointer' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                background: 'var(--io-danger-bg, rgba(239,68,68,0.12))',
                border: '1px solid var(--io-danger, #ef4444)',
                color: 'var(--io-danger, #ef4444)',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}

          {asyncJobId && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                background: 'var(--io-info-bg, rgba(74,158,255,0.12))',
                border: '1px solid var(--io-accent, #4A9EFF)',
                color: 'var(--io-accent, #4A9EFF)',
                fontSize: '12px',
              }}
            >
              Export job queued (ID: {asyncJobId}). Your download will appear in the export queue
              when ready.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 16px',
            borderTop: '1px solid var(--io-border)',
            background: 'var(--io-surface-secondary)',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '6px 16px',
              background: 'none',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleDownload() }}
            disabled={loading}
            style={{
              padding: '6px 16px',
              background: 'var(--io-accent, #4A9EFF)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              minWidth: '80px',
            }}
          >
            {loading ? 'Exporting...' : 'Download'}
          </button>
        </div>
      </div>
    </>
  )
}
