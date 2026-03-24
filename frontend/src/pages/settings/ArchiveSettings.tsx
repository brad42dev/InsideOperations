import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchiveSettingsPayload {
  retention_raw_days: number
  retention_1m_days: number
  retention_5m_days: number
  retention_15m_days: number
  retention_1h_days: number
  retention_1d_days: number
  compression_after_days: number
  maintenance_interval_secs: number
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--io-text-secondary)',
  marginBottom: '5px',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--io-accent)',
  color: '#09090b',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const sectionCard: React.CSSProperties = {
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  padding: '20px 24px',
  marginBottom: '20px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--io-text-primary)',
  marginBottom: '16px',
}

const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
  marginBottom: '14px',
}

const helpText: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--io-text-muted)',
  marginTop: '4px',
}

// ---------------------------------------------------------------------------
// Helper to format days into a human-readable string
// ---------------------------------------------------------------------------

function describeDays(days: number): string {
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 365) return `${days} days (~${Math.round(days / 30)} months)`
  const years = (days / 365).toFixed(1)
  return `${days} days (~${years} years)`
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

interface ToastMessage {
  type: 'success' | 'error'
  text: string
}

function Toast({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '8px',
        background:
          msg.type === 'success'
            ? 'var(--io-success-subtle, #0f3d20)'
            : 'var(--io-danger-subtle, #3d1a1a)',
        border: `1px solid ${msg.type === 'success' ? 'var(--io-success)' : 'var(--io-danger)'}`,
        color: msg.type === 'success' ? 'var(--io-success)' : 'var(--io-danger)',
        fontSize: '13px',
        marginBottom: '16px',
      }}
    >
      <span>{msg.text}</span>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          fontSize: '16px',
          lineHeight: 1,
          padding: '0 4px',
        }}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NumberField — controlled number input with validation
// ---------------------------------------------------------------------------

function NumberField({
  id,
  label,
  help,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  id: string
  label: string
  help?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  suffix?: string
}) {
  const [raw, setRaw] = useState(String(value))

  useEffect(() => {
    setRaw(String(value))
  }, [value])

  const handleBlur = () => {
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= min && n <= max) {
      onChange(n)
    } else {
      setRaw(String(value))
    }
  }

  const displayHelp = help ?? (suffix ? undefined : describeDays(value))

  return (
    <div>
      <label style={labelStyle} htmlFor={id}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={handleBlur}
          style={{ ...inputStyle, width: suffix ? '120px' : '100%' }}
        />
        {suffix && (
          <span style={{ fontSize: '13px', color: 'var(--io-text-muted)', flexShrink: 0 }}>
            {suffix}
          </span>
        )}
      </div>
      {displayHelp && <p style={helpText}>{displayHelp}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ArchiveSettings() {
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [form, setForm] = useState<ArchiveSettingsPayload | null>(null)

  const { data, isLoading, isError } = useQuery<ArchiveSettingsPayload>({
    queryKey: ['archive-settings'],
    queryFn: async () => {
      const result = await api.get<ArchiveSettingsPayload>('/api/archive/settings')
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
  })

  // Initialise form once data is available.
  useEffect(() => {
    if (data && !form) {
      setForm(data)
    }
  }, [data, form])

  const mutation = useMutation<ArchiveSettingsPayload, Error, ArchiveSettingsPayload>({
    mutationFn: async (payload: ArchiveSettingsPayload) => {
      const result = await api.put<ArchiveSettingsPayload>('/api/archive/settings', payload)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      setToast({ type: 'success', text: 'Archive settings saved.' })
      queryClient.invalidateQueries({ queryKey: ['archive-settings'] })
    },
    onError: (err: Error) => {
      setToast({ type: 'error', text: err.message ?? 'Failed to save archive settings.' })
    },
  })

  function setField<K extends keyof ArchiveSettingsPayload>(key: K, value: number) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = () => {
    if (!form) return
    mutation.mutate(form)
  }

  if (isLoading) {
    return (
      <div style={{ color: 'var(--io-text-muted)', fontSize: '13px', padding: '16px 0' }}>
        Loading archive settings…
      </div>
    )
  }

  if (isError || !form) {
    return (
      <div style={{ color: 'var(--io-danger)', fontSize: '13px', padding: '16px 0' }}>
        Failed to load archive settings. Ensure the archive service is running.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '780px' }}>
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
          marginBottom: '4px',
        }}
      >
        Archive &amp; Timeseries Settings
      </h2>
      <p
        style={{ fontSize: '13px', color: 'var(--io-text-muted)', marginBottom: '24px' }}
      >
        Configure TimescaleDB retention periods, compression, and maintenance scheduling.
        Changes are applied on the next maintenance cycle.
      </p>

      {toast && (
        <Toast msg={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Raw data retention */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Raw Data Retention</div>
        <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', marginBottom: '16px' }}>
          How long to keep raw point history samples (full resolution data from
          OPC UA and other sources).
        </p>
        <div style={{ maxWidth: '260px' }}>
          <NumberField
            id="retention_raw_days"
            label="Retention period (days)"
            value={form.retention_raw_days}
            min={1}
            max={36500}
            onChange={(v) => setField('retention_raw_days', v)}
          />
        </div>
      </div>

      {/* Aggregate retention */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Continuous Aggregate Retention</div>
        <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', marginBottom: '16px' }}>
          Retention periods for pre-computed time-series aggregates. Longer periods
          consume more disk but enable deeper historical analysis at each resolution.
        </p>
        <div style={fieldRow}>
          <NumberField
            id="retention_1m_days"
            label="1-minute aggregate (days)"
            value={form.retention_1m_days}
            min={1}
            max={36500}
            onChange={(v) => setField('retention_1m_days', v)}
          />
          <NumberField
            id="retention_5m_days"
            label="5-minute aggregate (days)"
            value={form.retention_5m_days}
            min={1}
            max={36500}
            onChange={(v) => setField('retention_5m_days', v)}
          />
        </div>
        <div style={fieldRow}>
          <NumberField
            id="retention_15m_days"
            label="15-minute aggregate (days)"
            value={form.retention_15m_days}
            min={1}
            max={36500}
            onChange={(v) => setField('retention_15m_days', v)}
          />
          <NumberField
            id="retention_1h_days"
            label="1-hour aggregate (days)"
            value={form.retention_1h_days}
            min={1}
            max={36500}
            onChange={(v) => setField('retention_1h_days', v)}
          />
        </div>
        <div style={{ maxWidth: '260px' }}>
          <NumberField
            id="retention_1d_days"
            label="1-day aggregate (days)"
            value={form.retention_1d_days}
            min={1}
            max={36500}
            onChange={(v) => setField('retention_1d_days', v)}
          />
        </div>
      </div>

      {/* Compression */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Compression</div>
        <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', marginBottom: '16px' }}>
          TimescaleDB compresses chunks older than the specified threshold. Compressed
          data uses significantly less disk space but decompresses automatically on query.
        </p>
        <div style={{ maxWidth: '260px' }}>
          <NumberField
            id="compression_after_days"
            label="Compress chunks older than (days)"
            value={form.compression_after_days}
            min={1}
            max={36500}
            onChange={(v) => setField('compression_after_days', v)}
          />
        </div>
      </div>

      {/* Maintenance schedule */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Maintenance Schedule</div>
        <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', marginBottom: '16px' }}>
          How often the archive service runs its maintenance cycle (retention sweeps,
          compression policy registration, and aggregate refresh).
        </p>
        <div style={{ maxWidth: '260px' }}>
          <NumberField
            id="maintenance_interval_secs"
            label="Maintenance interval"
            help={`Every ${Math.round(form.maintenance_interval_secs / 60)} minutes`}
            value={form.maintenance_interval_secs}
            min={60}
            max={86400}
            onChange={(v) => setField('maintenance_interval_secs', v)}
            suffix="seconds"
          />
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          style={{
            ...btnPrimary,
            opacity: mutation.isPending ? 0.7 : 1,
            cursor: mutation.isPending ? 'not-allowed' : 'pointer',
          }}
          disabled={mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending ? 'Saving…' : 'Save Settings'}
        </button>
        {mutation.isPending && (
          <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
            Updating archive configuration…
          </span>
        )}
      </div>
    </div>
  )
}
