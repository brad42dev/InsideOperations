import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  shiftsApi,
  type MusterPoint,
  type CreateMusterPointPayload,
} from '../../api/shifts'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const surface: React.CSSProperties = {
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: 8,
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--io-text-secondary)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  background: 'var(--io-bg)',
  border: '1px solid var(--io-border)',
  borderRadius: 6,
  color: 'var(--io-text-primary)',
  fontSize: 13,
  boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 70,
  fontFamily: 'inherit',
}

// ---------------------------------------------------------------------------
// Add form
// ---------------------------------------------------------------------------

interface FormState {
  name: string
  description: string
  area: string
  capacity: string
  latitude: string
  longitude: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  area: '',
  capacity: '',
  latitude: '',
  longitude: '',
}

function AddMusterPointForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  const createMutation = useMutation({
    mutationFn: async (payload: CreateMusterPointPayload) => {
      const res = await shiftsApi.createMusterPoint(payload)
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    onSuccess: () => {
      setForm(EMPTY_FORM)
      setError(null)
      onCreated()
    },
    onError: (e: Error) => setError(e.message),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }

    const payload: CreateMusterPointPayload = {
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      area:        form.area.trim() || undefined,
      capacity:    form.capacity ? parseInt(form.capacity, 10) : undefined,
      latitude:    form.latitude ? parseFloat(form.latitude) : undefined,
      longitude:   form.longitude ? parseFloat(form.longitude) : undefined,
    }

    createMutation.mutate(payload)
  }

  return (
    <form onSubmit={handleSubmit} style={{ ...surface, padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--io-text-primary)' }}>
        Add Muster Point
      </h3>

      {error && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            color: '#ef4444',
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Name */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={fieldLabel}>Name *</label>
          <input
            style={inputStyle}
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Main Gate Assembly Area"
          />
        </div>

        {/* Description */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={fieldLabel}>Description</label>
          <textarea
            style={textareaStyle}
            value={form.description}
            onChange={set('description')}
            placeholder="Directions or additional instructions…"
          />
        </div>

        {/* Area */}
        <div>
          <label style={fieldLabel}>Area / Zone</label>
          <input
            style={inputStyle}
            value={form.area}
            onChange={set('area')}
            placeholder="e.g. North Perimeter"
          />
        </div>

        {/* Capacity */}
        <div>
          <label style={fieldLabel}>Capacity</label>
          <input
            type="number"
            min={1}
            style={inputStyle}
            value={form.capacity}
            onChange={set('capacity')}
            placeholder="Max persons"
          />
        </div>

        {/* Latitude */}
        <div>
          <label style={fieldLabel}>Latitude</label>
          <input
            type="number"
            step="any"
            style={inputStyle}
            value={form.latitude}
            onChange={set('latitude')}
            placeholder="Optional GPS lat"
          />
        </div>

        {/* Longitude */}
        <div>
          <label style={fieldLabel}>Longitude</label>
          <input
            type="number"
            step="any"
            style={inputStyle}
            value={form.longitude}
            onChange={set('longitude')}
            placeholder="Optional GPS lon"
          />
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={createMutation.isPending}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            background: createMutation.isPending ? 'var(--io-border)' : 'var(--io-accent)',
            color: '#fff',
            cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {createMutation.isPending ? 'Adding…' : 'Add Muster Point'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Muster point card
// ---------------------------------------------------------------------------

function MusterPointCard({ point }: { point: MusterPoint }) {
  return (
    <div
      style={{
        ...surface,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
      }}
    >
      {/* Enabled indicator */}
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 100,
            ...(point.enabled
              ? {
                  background: 'rgba(34,197,94,0.12)',
                  color: '#22c55e',
                  border: '1px solid #22c55e',
                }
              : {
                  background: 'rgba(107,114,128,0.12)',
                  color: '#6b7280',
                  border: '1px solid #6b7280',
                }),
          }}
        >
          {point.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--io-text-primary)', paddingRight: 80 }}>
        {point.name}
      </div>

      {/* Description */}
      {point.description && (
        <div style={{ fontSize: 13, color: 'var(--io-text-secondary)' }}>
          {point.description}
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {point.area && (
          <MetaChip icon="📍" label={point.area} />
        )}
        {point.capacity != null && (
          <MetaChip icon="👥" label={`Capacity: ${point.capacity}`} />
        )}
        {point.latitude != null && point.longitude != null && (
          <MetaChip
            icon="🌐"
            label={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
          />
        )}
        {point.door_ids.length > 0 && (
          <MetaChip icon="🚪" label={`${point.door_ids.length} door${point.door_ids.length !== 1 ? 's' : ''} linked`} />
        )}
      </div>
    </div>
  )
}

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        color: 'var(--io-text-secondary)',
        background: 'var(--io-surface-secondary)',
        border: '1px solid var(--io-border)',
        borderRadius: 6,
        padding: '3px 8px',
      }}
    >
      <span style={{ fontSize: 11 }}>{icon}</span>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function MusterPointConfig() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery<MusterPoint[]>({
    queryKey: ['shifts', 'muster-points'],
    queryFn: async () => {
      const res = await shiftsApi.listMusterPoints()
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
  })

  const points = data ?? []

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: 'var(--io-text-primary)', fontSize: 20, fontWeight: 600 }}>
            Muster Points
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--io-text-muted)', fontSize: 13 }}>
            Configure emergency assembly locations used during muster events.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '8px 16px',
            background: showForm ? 'var(--io-surface)' : 'var(--io-accent)',
            color: showForm ? 'var(--io-text-secondary)' : '#fff',
            border: showForm ? '1px solid var(--io-border)' : 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {showForm ? 'Cancel' : '+ Add Muster Point'}
        </button>
      </div>

      {/* Info banner */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(74,158,255,0.08)',
          border: '1px solid rgba(74,158,255,0.25)',
          borderRadius: 6,
          fontSize: 13,
          color: 'var(--io-text-secondary)',
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        Muster points are the designated assembly locations personnel must reach
        during an emergency. They are used by the muster command center to track
        accountability during active muster events.
      </div>

      {/* Add form */}
      {showForm && (
        <AddMusterPointForm
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['shifts', 'muster-points'] })
            setShowForm(false)
          }}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--io-text-muted)' }}>
          Loading muster points…
        </div>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
          Failed to load muster points.{' '}
          <button
            onClick={() => refetch()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-accent)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      ) : points.length === 0 ? (
        <div
          style={{
            ...surface,
            padding: 40,
            textAlign: 'center',
            color: 'var(--io-text-muted)',
            fontSize: 13,
          }}
        >
          No muster points configured. Add your first muster point above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {points.map((point: MusterPoint) => (
            <MusterPointCard key={point.id} point={point} />
          ))}
          <p style={{ fontSize: 12, color: 'var(--io-text-muted)', marginTop: 4 }}>
            {points.length} muster point{points.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
