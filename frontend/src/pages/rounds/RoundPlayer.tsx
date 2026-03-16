import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { roundsApi, type Checkpoint, type ResponseItem } from '../../api/rounds'
import { useOfflineRounds, batchSyncRounds } from '../../shared/hooks/useOfflineRounds'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getThresholdHelperText(cp: Checkpoint): string | null {
  const v = cp.validation
  if (!v || cp.data_type !== 'numeric') return null
  const parts: string[] = []
  if (v.ll !== undefined) parts.push(`LL: ${v.ll}`)
  if (v.l !== undefined) parts.push(`L: ${v.l}`)
  if (v.h !== undefined) parts.push(`H: ${v.h}`)
  if (v.hh !== undefined) parts.push(`HH: ${v.hh}`)
  if (v.min !== undefined) parts.push(`min: ${v.min}`)
  if (v.max !== undefined) parts.push(`max: ${v.max}`)
  return parts.length ? parts.join('  ·  ') : null
}

function evaluateNumericColor(value: string, cp: Checkpoint): string {
  const v = cp.validation
  if (!v) return 'var(--io-text-primary)'
  const n = parseFloat(value)
  if (isNaN(n)) return 'var(--io-text-primary)'
  if ((v.hh !== undefined && n >= v.hh) || (v.ll !== undefined && n <= v.ll)) {
    return '#ef4444' // alarm
  }
  if ((v.h !== undefined && n > v.h) || (v.l !== undefined && n < v.l)) {
    return '#f59e0b' // advisory
  }
  return '#22c55e' // in range
}

// ---------------------------------------------------------------------------
// Individual checkpoint input
// ---------------------------------------------------------------------------

function CheckpointInput({
  checkpoint,
  value,
  onChange,
  comment,
  onCommentChange,
}: {
  checkpoint: Checkpoint
  value: string
  onChange: (v: string) => void
  comment: string
  onCommentChange: (v: string) => void
}) {
  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--io-surface-secondary)',
    border: '1px solid var(--io-border)',
    borderRadius: '6px',
    color: 'var(--io-text-primary)',
    fontSize: '16px',
    boxSizing: 'border-box' as const,
  }

  const numericColor = checkpoint.data_type === 'numeric' && value
    ? evaluateNumericColor(value, checkpoint)
    : 'var(--io-text-primary)'

  const helperText = getThresholdHelperText(checkpoint)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Main input */}
      {checkpoint.data_type === 'text' && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Enter response…"
          style={{ ...inputStyle, resize: 'vertical', fontSize: '14px' }}
        />
      )}

      {checkpoint.data_type === 'numeric' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0"
              style={{ ...inputStyle, color: numericColor, fontWeight: 600, width: 'auto', flex: 1 }}
            />
            {checkpoint.unit && (
              <span style={{ color: 'var(--io-text-secondary)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                {checkpoint.unit}
              </span>
            )}
          </div>
          {helperText && (
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '6px' }}>
              Thresholds: {helperText}
            </div>
          )}
        </div>
      )}

      {checkpoint.data_type === 'boolean' && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {(['true', 'false'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                flex: 1,
                height: '60px',
                border: `2px solid ${value === opt ? 'var(--io-accent, #4A9EFF)' : 'var(--io-border)'}`,
                borderRadius: '8px',
                background: value === opt ? 'var(--io-accent-subtle, rgba(74,158,255,0.15))' : 'var(--io-surface-secondary)',
                color: value === opt ? 'var(--io-accent, #4A9EFF)' : 'var(--io-text-secondary)',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt === 'true' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      )}

      {checkpoint.data_type === 'dropdown' && checkpoint.options && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select…</option>
          {checkpoint.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {checkpoint.data_type === 'multi_field' && checkpoint.fields && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checkpoint.fields.map((field) => {
            let parsed: Record<string, string> = {}
            try {
              parsed = value ? JSON.parse(value) : {}
            } catch {
              /* ignore */
            }
            return (
              <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>{field.name}</label>
                <input
                  type={field.type === 'numeric' ? 'number' : 'text'}
                  value={parsed[field.name] ?? ''}
                  onChange={(e) => {
                    let current: Record<string, string> = {}
                    try { current = value ? JSON.parse(value) : {} } catch { /* ignore */ }
                    onChange(JSON.stringify({ ...current, [field.name]: e.target.value }))
                  }}
                  style={inputStyle}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Comment field */}
      <div>
        <label style={{ fontSize: '12px', color: 'var(--io-text-secondary)', display: 'block', marginBottom: '4px' }}>
          Comments
          {checkpoint.media_requirements?.comments === 'required' && (
            <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>
          )}
        </label>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          rows={2}
          placeholder="Add a comment…"
          style={{ ...inputStyle, resize: 'vertical', fontSize: '13px' }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RoundPlayer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [checkpointIdx, setCheckpointIdx] = useState(0)
  const [values, setValues] = useState<Record<number, string>>({})
  const [comments, setComments] = useState<Record<number, string>>({})
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isOnline, pendingCount, saveOfflineResponse, getPendingResponses, clearSynced, syncPending } = useOfflineRounds()

  const { data: detailResult, isLoading } = useQuery({
    queryKey: ['rounds', 'instance', id],
    queryFn: () => roundsApi.getInstance(id!),
    enabled: !!id,
  })

  // Silently capture GPS
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* ignore errors */ },
      { timeout: 5000 },
    )
  }, [checkpointIdx])

  // Pre-populate responses from existing data
  useEffect(() => {
    if (!detailResult?.success) return
    const { responses } = detailResult.data
    const vals: Record<number, string> = {}
    responses.forEach((r) => {
      if (r.response_type === 'boolean') {
        vals[r.checkpoint_index] = String(r.response_value)
      } else if (r.response_type === 'multi_field') {
        vals[r.checkpoint_index] = JSON.stringify(r.response_value)
      } else {
        vals[r.checkpoint_index] = String(r.response_value ?? '')
      }
    })
    setValues(vals)
  }, [detailResult])

  // Auto-sync pending offline responses when connectivity is restored.
  // Prefers the batch endpoint (one request per instance) for efficiency on
  // poor mobile connections; falls back to one-at-a-time if batch partially
  // fails so no responses are silently dropped.
  useEffect(() => {
    if (!isOnline || pendingCount === 0 || !id) return

    getPendingResponses().then(async (pending) => {
      if (pending.length === 0) return

      // Group responses by instanceId so we can batch-submit per instance.
      const byInstance = pending.reduce<Record<string, typeof pending>>(
        (acc, p) => {
          ;(acc[p.instanceId] ??= []).push(p)
          return acc
        },
        {},
      )

      for (const [instId, items] of Object.entries(byInstance)) {
        const synced = await batchSyncRounds(instId, items)

        if (synced === items.length) {
          // All items synced — remove them from the queue.
          await clearSynced(items.map((i) => i.id!).filter(Boolean) as number[])
        } else {
          // Batch partially failed — fall back to one-at-a-time for this
          // instance so individual items can succeed/fail independently.
          await syncPending(async (p) => {
            if (p.instanceId !== instId) return false
            const item: ResponseItem = {
              checkpoint_index: parseInt(p.checkpointId, 10),
              response_type: 'text',
              response_value: p.value,
              gps_latitude: undefined,
              gps_longitude: undefined,
            }
            const result = await roundsApi.saveResponses(p.instanceId, [item])
            return result.success
          })
        }
      }
    })
  }, [isOnline, pendingCount, id, getPendingResponses, clearSynced, syncPending])

  const saveCurrentResponse = useCallback(async (cpIndex: number): Promise<boolean> => {
    if (!id || !detailResult?.success) return true
    const { template } = detailResult.data
    if (!template) return true

    const checkpoints = Array.isArray(template.checkpoints) ? template.checkpoints : []
    const cp = checkpoints[cpIndex]
    if (!cp) return true

    const rawValue = values[cpIndex]
    if (rawValue === undefined || rawValue === '') return true // skip empty optional

    let responseValue: unknown = rawValue
    if (cp.data_type === 'numeric') responseValue = parseFloat(rawValue)
    else if (cp.data_type === 'boolean') responseValue = rawValue === 'true'
    else if (cp.data_type === 'multi_field') {
      try { responseValue = JSON.parse(rawValue) } catch { responseValue = rawValue }
    }

    const comment = comments[cpIndex]
    const commentField = comment ? { _comment: comment } : {}
    if (cp.data_type !== 'multi_field' && comment) {
      responseValue = { value: responseValue, ...commentField }
    }

    setSaving(true)

    // When offline, save to IndexedDB and return success so the player advances
    if (!isOnline) {
      await saveOfflineResponse({
        instanceId: id,
        checkpointId: String(cpIndex),
        value: rawValue,
        notes: comments[cpIndex] ?? '',
        timestamp: new Date().toISOString(),
      })
      setSaving(false)
      return true
    }

    const item: ResponseItem = {
      checkpoint_index: cpIndex,
      response_type: cp.data_type,
      response_value: responseValue,
      gps_latitude: gps?.lat,
      gps_longitude: gps?.lng,
    }

    const result = await roundsApi.saveResponses(id, [item])
    setSaving(false)

    if (!result.success) {
      setError(result.error.message)
      return false
    }
    return true
  }, [id, detailResult, values, comments, gps, isOnline, saveOfflineResponse])

  const handleNext = async () => {
    const ok = await saveCurrentResponse(checkpointIdx)
    if (!ok) return
    setCheckpointIdx((i) => i + 1)
    setError(null)
  }

  const handlePrev = () => {
    setCheckpointIdx((i) => Math.max(0, i - 1))
    setError(null)
  }

  const handleComplete = async () => {
    if (!id) return
    const ok = await saveCurrentResponse(checkpointIdx)
    if (!ok) return

    setCompleting(true)
    const result = await roundsApi.completeInstance(id)
    setCompleting(false)

    if (!result.success) {
      setError(result.error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['rounds'] })
    navigate('/rounds')
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--io-text-muted)' }}>
        Loading round…
      </div>
    )
  }

  if (!detailResult?.success) {
    return (
      <div style={{ padding: '24px', color: '#ef4444' }}>
        {detailResult?.error?.message ?? 'Failed to load round.'}
      </div>
    )
  }

  const { template } = detailResult.data
  const checkpoints: Checkpoint[] = Array.isArray(template?.checkpoints) ? template.checkpoints : []
  const totalCheckpoints = checkpoints.length

  if (totalCheckpoints === 0) {
    return (
      <div style={{ padding: '24px', color: 'var(--io-text-muted)' }}>
        This round has no checkpoints.
      </div>
    )
  }

  const clampedIdx = Math.min(checkpointIdx, totalCheckpoints - 1)
  const cp = checkpoints[clampedIdx]
  const isLastCheckpoint = clampedIdx === totalCheckpoints - 1
  const progressPct = ((clampedIdx + 1) / totalCheckpoints) * 100

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '0 16px',
      }}
    >
      {/* Offline banner */}
      {!isOnline && (
        <div
          style={{
            background: 'rgba(251,191,36,0.15)',
            borderBottom: '1px solid rgba(251,191,36,0.4)',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700 }}>Offline</span>
          <span>— Responses will sync when connection is restored.</span>
          {pendingCount > 0 && (
            <span
              style={{
                marginLeft: 'auto',
                background: 'rgba(251,191,36,0.3)',
                padding: '2px 8px',
                borderRadius: '100px',
                fontWeight: 600,
              }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
      )}

      {/* Sync confirmation banner (online with pending items) */}
      {isOnline && pendingCount > 0 && (
        <div
          style={{
            background: 'rgba(34,197,94,0.1)',
            borderBottom: '1px solid rgba(34,197,94,0.3)',
            padding: '8px 16px',
            fontSize: '12px',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <span>Syncing {pendingCount} offline response{pendingCount !== 1 ? 's' : ''}…</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          padding: '16px 0 12px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => navigate('/rounds')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-secondary)',
              padding: '4px',
              fontSize: '18px',
            }}
          >
            ←
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--io-text-primary)' }}>
              {template?.name ?? 'Round'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
              Checkpoint {clampedIdx + 1} of {totalCheckpoints}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: '4px',
            background: 'var(--io-surface-secondary)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'var(--io-accent, #4A9EFF)',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Checkpoint content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 0' }}>
        <div
          style={{
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--io-text-primary)', flex: 1 }}>
              {cp.title}
              {cp.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
            </h2>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '100px',
                background: 'var(--io-surface-secondary)',
                color: 'var(--io-text-muted)',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginLeft: '8px',
                flexShrink: 0,
              }}
            >
              {cp.data_type}
            </span>
          </div>

          {cp.description && (
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
              {cp.description}
            </p>
          )}

          <CheckpointInput
            checkpoint={cp}
            value={values[clampedIdx] ?? ''}
            onChange={(v) => setValues((prev) => ({ ...prev, [clampedIdx]: v }))}
            comment={comments[clampedIdx] ?? ''}
            onCommentChange={(v) => setComments((prev) => ({ ...prev, [clampedIdx]: v }))}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {/* Saving indicator */}
        {saving && (
          <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', textAlign: 'center', marginBottom: '8px' }}>
            Saving…
          </div>
        )}
      </div>

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 0',
          borderTop: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={handlePrev}
          disabled={clampedIdx === 0 || saving}
          style={{
            flex: 1,
            padding: '12px',
            background: 'none',
            border: '1px solid var(--io-border)',
            borderRadius: '8px',
            cursor: clampedIdx === 0 || saving ? 'not-allowed' : 'pointer',
            color: 'var(--io-text-secondary)',
            fontSize: '14px',
            fontWeight: 600,
            opacity: clampedIdx === 0 ? 0.4 : 1,
          }}
        >
          ← Previous
        </button>

        {!isLastCheckpoint ? (
          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              flex: 2,
              padding: '12px',
              background: 'var(--io-accent, #4A9EFF)',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Next →'}
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={saving || completing}
            style={{
              flex: 2,
              padding: '12px',
              background: '#22c55e',
              border: 'none',
              borderRadius: '8px',
              cursor: saving || completing ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              opacity: saving || completing ? 0.7 : 1,
            }}
          >
            {completing ? 'Completing…' : 'Complete Round'}
          </button>
        )}
      </div>
    </div>
  )
}
