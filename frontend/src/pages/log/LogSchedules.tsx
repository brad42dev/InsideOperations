import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logsApi, type LogSchedule } from '../../api/logs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduleFormData {
  template_id: string
  recurrence_type: 'per_shift' | 'time_window' | 'per_team'
  interval_hours: string
  team_name: string
  is_active: boolean
}

const EMPTY_FORM: ScheduleFormData = {
  template_id: '',
  recurrence_type: 'per_shift',
  interval_hours: '6',
  team_name: '',
  is_active: true,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECURRENCE_LABELS: Record<LogSchedule['recurrence_type'], string> = {
  per_shift: 'Per Shift',
  time_window: 'Time Window',
  per_team: 'Per Team',
}

const RECURRENCE_BADGE_COLORS: Record<LogSchedule['recurrence_type'], React.CSSProperties> = {
  per_shift: { background: 'rgba(99,102,241,0.12)', color: '#818cf8' },
  time_window: { background: 'rgba(234,179,8,0.12)', color: '#ca8a04' },
  per_team: { background: 'rgba(20,184,166,0.12)', color: '#14b8a6' },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function btnStyle(variant?: 'primary' | 'danger' | 'ghost'): React.CSSProperties {
  if (variant === 'primary') {
    return { padding: '6px 14px', background: 'var(--io-accent)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#fff' }
  }
  if (variant === 'danger') {
    return { padding: '6px 14px', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#ef4444' }
  }
  return { padding: '6px 14px', background: 'none', border: '1px solid var(--io-border)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--io-text-secondary)' }
}

function fieldStyle(): React.CSSProperties {
  return { width: '100%', padding: '7px 10px', background: 'var(--io-surface-secondary)', border: '1px solid var(--io-border)', borderRadius: '6px', fontSize: '13px', color: 'var(--io-text-primary)', boxSizing: 'border-box' }
}

function labelStyle(): React.CSSProperties {
  return { fontSize: '12px', fontWeight: 600, color: 'var(--io-text-secondary)', marginBottom: '4px', display: 'block' }
}

// ---------------------------------------------------------------------------
// Schedule Form Modal
// ---------------------------------------------------------------------------

interface ScheduleFormProps {
  initial?: ScheduleFormData
  templateOptions: Array<{ id: string; name: string }>
  onSave: (data: ScheduleFormData) => void
  onCancel: () => void
  isSaving: boolean
  title: string
}

function ScheduleFormModal({ initial = EMPTY_FORM, templateOptions, onSave, onCancel, isSaving, title }: ScheduleFormProps) {
  const [form, setForm] = useState<ScheduleFormData>(initial)

  function set<K extends keyof ScheduleFormData>(key: K, val: ScheduleFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--io-bg)', border: '1px solid var(--io-border)', borderRadius: '10px', width: '440px', maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--io-border)', fontWeight: 700, fontSize: '15px', color: 'var(--io-text-primary)' }}>
          {title}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Template selector */}
          <div>
            <label style={labelStyle()}>Template *</label>
            <select
              required
              value={form.template_id}
              onChange={(e) => set('template_id', e.target.value)}
              style={fieldStyle()}
            >
              <option value="">— select a template —</option>
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Recurrence type */}
          <div>
            <label style={labelStyle()}>Recurrence Type *</label>
            <select
              value={form.recurrence_type}
              onChange={(e) => set('recurrence_type', e.target.value as ScheduleFormData['recurrence_type'])}
              style={fieldStyle()}
            >
              <option value="per_shift">Per Shift — one instance per shift</option>
              <option value="time_window">Time Window — every N hours</option>
              <option value="per_team">Per Team — by team assignment</option>
            </select>
          </div>

          {/* Interval hours (only for time_window) */}
          {form.recurrence_type === 'time_window' && (
            <div>
              <label style={labelStyle()}>Interval (hours) *</label>
              <input
                type="number"
                min={1}
                required
                value={form.interval_hours}
                onChange={(e) => set('interval_hours', e.target.value)}
                style={fieldStyle()}
              />
            </div>
          )}

          {/* Team name */}
          <div>
            <label style={labelStyle()}>Team Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. Day Shift Team A"
              value={form.team_name}
              onChange={(e) => set('team_name', e.target.value)}
              style={fieldStyle()}
            />
          </div>

          {/* Active toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="sched-active"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <label htmlFor="sched-active" style={{ fontSize: '13px', color: 'var(--io-text-secondary)', cursor: 'pointer' }}>
              Active (schedule will generate instances)
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button type="button" style={btnStyle()} onClick={onCancel} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" style={btnStyle('primary')} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LogSchedules() {
  const queryClient = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<LogSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LogSchedule | null>(null)

  // Queries
  const { data: schedData, isLoading: schedLoading } = useQuery({
    queryKey: ['log', 'schedules'],
    queryFn: () => logsApi.listSchedules(),
  })

  const { data: tmplData } = useQuery({
    queryKey: ['log', 'templates', 'active'],
    queryFn: () => logsApi.listTemplates({ is_active: true }),
  })

  const schedules = schedData?.success && Array.isArray(schedData.data) ? schedData.data : []
  const templates = tmplData?.success && Array.isArray(tmplData.data) ? tmplData.data : []
  const templateOptions = templates.map((t) => ({ id: t.id, name: t.name }))

  // Mutations
  const createMutation = useMutation({
    mutationFn: (form: ScheduleFormData) =>
      logsApi.createSchedule({
        template_id: form.template_id,
        recurrence_type: form.recurrence_type,
        interval_hours: form.recurrence_type === 'time_window' ? Number(form.interval_hours) : undefined,
        team_name: form.team_name || undefined,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log', 'schedules'] })
      setShowCreate(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: ScheduleFormData }) =>
      logsApi.updateSchedule(id, {
        template_id: form.template_id,
        recurrence_type: form.recurrence_type,
        interval_hours: form.recurrence_type === 'time_window' ? Number(form.interval_hours) : undefined,
        team_name: form.team_name || undefined,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log', 'schedules'] })
      setEditTarget(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      logsApi.updateSchedule(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['log', 'schedules'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => logsApi.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log', 'schedules'] })
      setDeleteTarget(null)
    },
  })

  // Convert a schedule row back to form data for the edit modal
  function scheduleToForm(s: LogSchedule): ScheduleFormData {
    return {
      template_id: s.template_id,
      recurrence_type: s.recurrence_type,
      interval_hours: s.interval_hours != null ? String(s.interval_hours) : '6',
      team_name: s.team_name ?? '',
      is_active: s.is_active,
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>Log Schedules</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            Automatically create recurring log entry instances on a schedule.
          </p>
        </div>
        <button style={btnStyle('primary')} onClick={() => setShowCreate(true)}>
          + New Schedule
        </button>
      </div>

      {/* List */}
      {schedLoading ? (
        <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading…</div>
      ) : schedules.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px', background: 'var(--io-surface)', borderRadius: '8px', border: '1px solid var(--io-border)' }}>
          No schedules yet. Create one to start generating log instances automatically.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--io-surface)', border: '1px solid var(--io-border)', borderRadius: '8px', opacity: s.is_active ? 1 : 0.6 }}
            >
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)' }}>
                    {s.template_name ?? s.template_id}
                  </span>
                  {/* Recurrence badge */}
                  <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', fontWeight: 600, ...RECURRENCE_BADGE_COLORS[s.recurrence_type] }}>
                    {RECURRENCE_LABELS[s.recurrence_type]}
                    {s.recurrence_type === 'time_window' && s.interval_hours != null ? ` / ${s.interval_hours}h` : ''}
                  </span>
                  {/* Active badge */}
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: s.is_active ? 'rgba(34,197,94,0.12)' : 'var(--io-surface-secondary)', color: s.is_active ? '#22c55e' : 'var(--io-text-muted)', fontWeight: 600 }}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {s.team_name && (
                  <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
                    Team: {s.team_name}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                {/* Toggle active */}
                <button
                  style={btnStyle()}
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ id: s.id, is_active: !s.is_active })}
                  title={s.is_active ? 'Deactivate' : 'Activate'}
                >
                  {s.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button style={btnStyle()} onClick={() => setEditTarget(s)}>
                  Edit
                </button>
                <button
                  style={btnStyle('danger')}
                  onClick={() => setDeleteTarget(s)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <ScheduleFormModal
          title="New Schedule"
          templateOptions={templateOptions}
          onSave={(form) => createMutation.mutate(form)}
          onCancel={() => setShowCreate(false)}
          isSaving={createMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <ScheduleFormModal
          title="Edit Schedule"
          initial={scheduleToForm(editTarget)}
          templateOptions={templateOptions}
          onSave={(form) => updateMutation.mutate({ id: editTarget.id, form })}
          onCancel={() => setEditTarget(null)}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--io-bg)', border: '1px solid var(--io-border)', borderRadius: '10px', width: '380px', maxWidth: '95vw', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--io-text-primary)', marginBottom: '12px' }}>Delete Schedule?</div>
            <p style={{ fontSize: '13px', color: 'var(--io-text-secondary)', margin: '0 0 20px' }}>
              This will permanently delete the schedule for template{' '}
              <strong>{deleteTarget.template_name ?? deleteTarget.template_id}</strong>.
              Existing log instances will not be affected.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={btnStyle()} onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
                Cancel
              </button>
              <button
                style={btnStyle('danger')}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
