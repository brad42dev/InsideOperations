import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, type ReportTemplate, type ExportPreset } from '../../api/reports'
import { showToast } from '../../shared/components/Toast'
import PointPicker from '../../shared/components/PointPicker'
import { api } from '../../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportFormat = 'pdf' | 'html' | 'csv' | 'xlsx' | 'json'

interface ReportParams {
  start_time: string
  end_time: string
  area_filter: string
  unit_filter: string
  point_ids: string[]
  format: ReportFormat
  notify_email: boolean
  email_address: string
}

// Hierarchy types (mirrors PointPicker's internal structure)
interface AreaEntry { id: string; name: string; units: UnitEntry[] }
interface UnitEntry { id: string; name: string; equipment: unknown[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoNow(): string {
  return new Date().toISOString().slice(0, 16)
}

function isoHoursAgo(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() - hours)
  return d.toISOString().slice(0, 16)
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 16)
}

// ---------------------------------------------------------------------------
// Time Range Presets
// ---------------------------------------------------------------------------

const TIME_PRESETS = [
  { label: 'Last 1 hour', start: () => isoHoursAgo(1), end: () => isoNow() },
  { label: 'Last 24 hours', start: () => isoHoursAgo(24), end: () => isoNow() },
  { label: 'Last 7 days', start: () => isoDaysAgo(7), end: () => isoNow() },
  { label: 'Last 30 days', start: () => isoDaysAgo(30), end: () => isoNow() },
]

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, React.CSSProperties> = {
    pending: {
      background: 'var(--io-surface-secondary)',
      color: 'var(--io-text-muted)',
    },
    running: {
      background: 'rgba(45,212,191,0.15)',
      color: 'var(--io-accent)',
    },
    completed: {
      background: 'rgba(34,197,94,0.15)',
      color: 'var(--io-success)',
    },
    failed: {
      background: 'rgba(239,68,68,0.15)',
      color: 'var(--io-danger)',
    },
  }

  const labels: Record<JobStatus, string> = {
    pending: 'Queued',
    running: 'Generating...',
    completed: 'Ready',
    failed: 'Failed',
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        ...styles[status],
      }}
    >
      {labels[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Save Preset dialog (inline)
// ---------------------------------------------------------------------------

function SavePresetInline({
  onSave,
  onCancel,
}: {
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="Preset name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onSave(name.trim())
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          flex: 1,
          padding: '5px 8px',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-accent)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-text-primary)',
          fontSize: '12px',
          outline: 'none',
        }}
      />
      <button
        onClick={() => { if (name.trim()) onSave(name.trim()) }}
        disabled={!name.trim()}
        style={{
          padding: '5px 10px',
          background: 'var(--io-accent)',
          border: 'none',
          borderRadius: 'var(--io-radius)',
          color: '#fff',
          fontSize: '12px',
          cursor: name.trim() ? 'pointer' : 'not-allowed',
          opacity: name.trim() ? 1 : 0.5,
        }}
      >
        Save
      </button>
      <button
        onClick={onCancel}
        style={{
          padding: '5px 8px',
          background: 'transparent',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--io-border)', paddingBottom: '16px', marginBottom: '16px' }}>
      <button
        onClick={() => collapsible && setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: collapsible ? 'pointer' : 'default',
          padding: '0 0 10px',
          color: 'var(--io-text-primary)',
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
        {collapsible && (
          <span style={{ fontSize: '10px', color: 'var(--io-text-muted)' }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function ReportConfigPanel({
  template,
  onClose,
}: {
  template: ReportTemplate
  onClose: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [params, setParams] = useState<ReportParams>({
    start_time: isoHoursAgo(24),
    end_time: isoNow(),
    area_filter: '',
    unit_filter: '',
    point_ids: [],
    format: 'pdf',
    notify_email: false,
    email_address: '',
  })

  // Hierarchy for area→unit cascading (doc 11 §Dependent Parameter Cascading)
  const hierarchyQuery = useQuery({
    queryKey: ['points', 'hierarchy'],
    queryFn: async () => {
      const result = await api.get<{ areas: AreaEntry[] }>('/api/v1/points/hierarchy')
      return result.success ? result.data.areas : []
    },
    staleTime: 300_000,
  })
  const areas = hierarchyQuery.data ?? []
  const selectedAreaEntry = areas.find((a) => a.name === params.area_filter || a.id === params.area_filter)
  const unitsForArea: UnitEntry[] = selectedAreaEntry?.units ?? []

  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [savingPreset, setSavingPreset] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')

  // Load presets
  const presetsQuery = useQuery({
    queryKey: ['report-presets', template.id],
    queryFn: async () => {
      const result = await reportsApi.listPresets(template.id)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
  })

  const presets: ExportPreset[] = presetsQuery.data ?? []

  // Poll job status
  const pollJobStatus = useCallback(
    async (jobId: string) => {
      let attempts = 0
      const maxAttempts = 150 // 5 min at 2s intervals

      const poll = async () => {
        if (attempts >= maxAttempts) return
        attempts++

        const result = await reportsApi.getJobStatus(jobId)
        if (!result.success) return

        const { status } = result.data
        setJobStatus(status)

        if (status === 'completed') {
          showToast({
            title: 'Report ready',
            description: `"${template.name}" has been generated.`,
            variant: 'success',
            action: {
              label: 'Download',
              onClick: () => {
                window.open(reportsApi.getDownloadUrl(jobId), '_blank')
              },
            },
          })
          queryClient.invalidateQueries({ queryKey: ['report-history'] })
          queryClient.invalidateQueries({ queryKey: ['report-exports'] })
          return
        }

        if (status === 'failed') {
          showToast({
            title: 'Report generation failed',
            description: 'Check the History tab for details.',
            variant: 'error',
          })
          return
        }

        // Still pending/running — keep polling
        setTimeout(poll, 2000)
      }

      setTimeout(poll, 2000)
    },
    [template.name, queryClient],
  )

  const generateMutation = useMutation({
    mutationFn: () =>
      reportsApi.generate({
        template_id: template.id,
        format: params.format,
        params: {
          start_time: new Date(params.start_time).toISOString(),
          end_time: new Date(params.end_time).toISOString(),
          area_filter: params.area_filter || undefined,
          unit_filter: params.unit_filter || undefined,
          point_ids: params.point_ids.length > 0 ? params.point_ids : undefined,
        },
        notify_email: params.notify_email && params.email_address ? true : undefined,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Generation failed', description: result.error.message, variant: 'error' })
        return
      }
      const { job_id } = result.data
      setActiveJobId(job_id)
      setJobStatus('pending')
      showToast({
        title: 'Report generating...',
        description: "You'll be notified when it's ready.",
        variant: 'info',
      })
      void pollJobStatus(job_id)
    },
    onError: (err) => {
      showToast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    },
  })

  const savePresetMutation = useMutation({
    mutationFn: (name: string) =>
      reportsApi.createPreset({
        template_id: template.id,
        name,
        params: {
          start_time: params.start_time,
          end_time: params.end_time,
          area_filter: params.area_filter,
          point_ids: params.point_ids.length > 0 ? params.point_ids : undefined,
          format: params.format,
        },
      }),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed to save preset', description: result.error.message, variant: 'error' })
        return
      }
      setSavingPreset(false)
      queryClient.invalidateQueries({ queryKey: ['report-presets', template.id] })
      showToast({ title: 'Preset saved', variant: 'success' })
    },
    onError: (err) => {
      showToast({
        title: 'Failed to save preset',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    },
  })

  // Load preset into params
  const loadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    const p = preset.params as {
      start_time?: string
      end_time?: string
      area_filter?: string
      point_ids?: string[]
      format?: ReportFormat
    }
    setParams((prev) => ({
      ...prev,
      start_time: p.start_time ?? prev.start_time,
      end_time: p.end_time ?? prev.end_time,
      area_filter: p.area_filter ?? prev.area_filter,
      point_ids: p.point_ids ?? prev.point_ids,
      format: p.format ?? prev.format,
    }))
    setSelectedPresetId(presetId)
  }

  const isGenerating = generateMutation.isPending || jobStatus === 'pending' || jobStatus === 'running'

  // Reset job state when template changes
  useEffect(() => {
    setActiveJobId(null)
    setJobStatus(null)
  }, [template.id])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface)',
        borderLeft: '1px solid var(--io-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: '0 0 4px',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {template.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {template.category && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: '100px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: 'var(--io-surface-secondary)',
                  color: 'var(--io-text-muted)',
                }}
              >
                {template.category}
              </span>
            )}
            {template.is_system_template && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: '100px',
                  fontSize: '10px',
                  fontWeight: 600,
                  background: 'var(--io-accent-subtle)',
                  color: 'var(--io-accent)',
                }}
              >
                System
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '2px 4px',
            flexShrink: 0,
          }}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Description */}
        {template.description && (
          <p
            style={{
              margin: '0 0 20px',
              fontSize: '13px',
              color: 'var(--io-text-secondary)',
              lineHeight: 1.5,
            }}
          >
            {template.description}
          </p>
        )}

        {/* Time Range */}
        <Section title="Time Range">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() =>
                  setParams((p) => ({
                    ...p,
                    start_time: preset.start(),
                    end_time: preset.end(),
                  }))
                }
                style={{
                  padding: '3px 9px',
                  borderRadius: '100px',
                  border: '1px solid var(--io-border)',
                  background: 'var(--io-surface-elevated)',
                  color: 'var(--io-text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Start
              </span>
              <input
                type="datetime-local"
                value={params.start_time}
                onChange={(e) => setParams((p) => ({ ...p, start_time: e.target.value }))}
                style={{
                  padding: '6px 8px',
                  background: 'var(--io-surface-elevated)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                End
              </span>
              <input
                type="datetime-local"
                value={params.end_time}
                onChange={(e) => setParams((p) => ({ ...p, end_time: e.target.value }))}
                style={{
                  padding: '6px 8px',
                  background: 'var(--io-surface-elevated)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </label>
          </div>
        </Section>

        {/* Area/Unit Filter — cascading (doc 11 §Dependent Parameter Cascading) */}
        <Section title="Area / Unit">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Area dropdown — populated from hierarchy API */}
            <select
              value={params.area_filter}
              onChange={(e) => setParams((p) => ({ ...p, area_filter: e.target.value, unit_filter: '' }))}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: params.area_filter ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                fontSize: '12px',
              }}
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>

            {/* Unit dropdown — auto-populates when an area is selected */}
            {params.area_filter && (
              <select
                value={params.unit_filter}
                onChange={(e) => setParams((p) => ({ ...p, unit_filter: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--io-surface-elevated)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: params.unit_filter ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                  fontSize: '12px',
                }}
              >
                <option value="">All units in {params.area_filter}</option>
                {unitsForArea.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            )}
          </div>
        </Section>

        {/* Points */}
        <Section title="Points" collapsible defaultOpen={params.point_ids.length > 0}>
          <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '8px' }}>
            Optionally limit this report to specific OPC points.
            {params.point_ids.length > 0 && (
              <button
                onClick={() => setParams((p) => ({ ...p, point_ids: [] }))}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--io-accent)',
                  fontSize: '11px',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                Clear all
              </button>
            )}
          </div>
          <PointPicker
            selected={params.point_ids}
            onChange={(ids) => setParams((p) => ({ ...p, point_ids: ids }))}
          />
        </Section>

        {/* Format */}
        <Section title="Output Format">
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['pdf', 'html', 'csv', 'xlsx', 'json'] as ReportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setParams((p) => ({ ...p, format: fmt }))}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--io-radius)',
                  border: '1px solid',
                  borderColor: params.format === fmt ? 'var(--io-accent)' : 'var(--io-border)',
                  background: params.format === fmt ? 'var(--io-accent-subtle)' : 'var(--io-surface-elevated)',
                  color: params.format === fmt ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                  fontSize: '12px',
                  fontWeight: params.format === fmt ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {fmt}
              </button>
            ))}
          </div>
        </Section>

        {/* Advanced */}
        <Section title="Advanced" collapsible defaultOpen={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <input
              type="checkbox"
              id="notify-email"
              checked={params.notify_email}
              onChange={(e) => setParams((p) => ({ ...p, notify_email: e.target.checked }))}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="notify-email" style={{ fontSize: '12px', color: 'var(--io-text-secondary)', cursor: 'pointer' }}>
              Send email when complete
            </label>
          </div>
          {params.notify_email && (
            <input
              type="email"
              placeholder="recipient@example.com"
              value={params.email_address}
              onChange={(e) => setParams((p) => ({ ...p, email_address: e.target.value }))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 8px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          )}
        </Section>

        {/* Saved Presets */}
        <Section title="Saved Presets">
          {presets.length > 0 && (
            <select
              value={selectedPresetId}
              onChange={(e) => loadPreset(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 8px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: selectedPresetId ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
                marginBottom: '10px',
              }}
            >
              <option value="">Load a saved preset...</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {savingPreset ? (
            <SavePresetInline
              onSave={(name) => savePresetMutation.mutate(name)}
              onCancel={() => setSavingPreset(false)}
            />
          ) : (
            <button
              onClick={() => setSavingPreset(true)}
              style={{
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              + Save current as preset
            </button>
          )}
        </Section>

        {/* Job status */}
        {jobStatus && activeJobId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              marginBottom: '16px',
            }}
          >
            <StatusBadge status={jobStatus} />
            {jobStatus === 'completed' && (
              <a
                href={reportsApi.getDownloadUrl(activeJobId)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  color: 'var(--io-accent)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Download
              </a>
            )}
            {jobStatus === 'completed' && params.format === 'html' && (
              <button
                onClick={() => navigate(`/reports/view/${activeJobId}`)}
                style={{
                  padding: '3px 8px',
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
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--io-border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <button
          onClick={() => navigate('/reports/schedules')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-accent)',
            fontSize: '12px',
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Schedule this report
        </button>

        <button
          onClick={() => generateMutation.mutate()}
          disabled={isGenerating}
          style={{
            padding: '8px 20px',
            background: isGenerating ? 'var(--io-surface-secondary)' : 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: isGenerating ? 'var(--io-text-muted)' : '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            transition: 'background 0.1s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isGenerating && (
            <span
              style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid currentColor',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'io-spin 0.6s linear infinite',
              }}
            />
          )}
          {isGenerating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      <style>{`
        @keyframes io-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
