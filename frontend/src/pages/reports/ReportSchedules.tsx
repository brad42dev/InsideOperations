import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { reportsApi, type ReportSchedule } from '../../api/reports'
import { useAuthStore } from '../../store/auth'
import DataTable from '../../shared/components/DataTable'
import type { ColumnDef } from '../../shared/components/DataTable'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// Cron helpers
// ---------------------------------------------------------------------------

function humanizeCron(expr: string): string {
  const NAMED: Record<string, string> = {
    '0 6 * * *': 'Daily at 6:00 AM',
    '0 0 * * *': 'Daily at midnight',
    '0 6 * * 1': 'Weekly (Mon) at 6:00 AM',
    '0 6 1 * *': 'Monthly (1st) at 6:00 AM',
  }
  if (NAMED[expr]) return NAMED[expr]

  const parts = expr.split(' ')
  if (parts.length !== 5) return expr

  const [min, hour, dom, , dow] = parts

  if (dom === '*' && dow === '*') {
    const h = parseInt(hour)
    const m = parseInt(min)
    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? 'PM' : 'AM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      const displayM = m.toString().padStart(2, '0')
      return `Daily at ${displayH}:${displayM} ${ampm}`
    }
  }

  if (dom === '*' && dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const d = parseInt(dow)
    const h = parseInt(hour)
    const m = parseInt(min)
    if (!isNaN(d) && !isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? 'PM' : 'AM'
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
      const displayM = m.toString().padStart(2, '0')
      return `Weekly (${days[d]}) at ${displayH}:${displayM} ${ampm}`
    }
  }

  return expr
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Toggle cell
// ---------------------------------------------------------------------------

function EnabledToggle({
  schedule,
  onToggle,
}: {
  schedule: ReportSchedule
  onToggle: (id: string, enabled: boolean) => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle(schedule.id, !schedule.enabled)
      }}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '34px',
        height: '18px',
        background: schedule.enabled ? 'var(--io-accent)' : 'var(--io-surface-secondary)',
        border: '1px solid var(--io-border)',
        borderRadius: '100px',
        cursor: 'pointer',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
      aria-label={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: schedule.enabled ? '16px' : '2px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
        }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Add Schedule Modal
// ---------------------------------------------------------------------------

const CRON_PRESETS = [
  { label: 'Daily', value: '0 6 * * *' },
  { label: 'Weekly (Mon)', value: '0 6 * * 1' },
  { label: 'Monthly (1st)', value: '0 6 1 * *' },
]

type ReportFormat = 'pdf' | 'html' | 'csv' | 'xlsx' | 'json'

interface ScheduleFormState {
  template_id: string
  name: string
  cron_expression: string
  format: ReportFormat
  recipient_emails: string
  enabled: boolean
}

function AddScheduleModal({
  open,
  onOpenChange,
  templates,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  templates: Array<{ id: string; name: string }>
  onSave: (form: ScheduleFormState) => void
}) {
  const [form, setForm] = useState<ScheduleFormState>({
    template_id: '',
    name: '',
    cron_expression: '0 6 * * *',
    format: 'pdf',
    recipient_emails: '',
    enabled: true,
  })

  const handleSave = () => {
    if (!form.template_id || !form.name.trim() || !form.cron_expression.trim()) return
    onSave(form)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 10px',
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text-primary)',
    fontSize: '13px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  }

  const labelTextStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--io-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200 }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            padding: '24px',
            width: 'min(520px, 95vw)',
            zIndex: 201,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Dialog.Title
              style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}
            >
              Add Report Schedule
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--io-text-muted)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </Dialog.Close>
          </div>

          {/* Template */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Report Template</span>
            <select
              value={form.template_id}
              onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          {/* Name */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Schedule Name</span>
            <input
              type="text"
              placeholder="e.g. Daily Alarm Report"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </label>

          {/* Cron */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelTextStyle}>Schedule (Cron Expression)</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setForm((f) => ({ ...f, cron_expression: p.value }))}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '100px',
                    border: '1px solid',
                    borderColor: form.cron_expression === p.value ? 'var(--io-accent)' : 'var(--io-border)',
                    background: form.cron_expression === p.value ? 'var(--io-accent-subtle)' : 'transparent',
                    color: form.cron_expression === p.value ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="0 6 * * *"
              value={form.cron_expression}
              onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
              style={inputStyle}
            />
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
              {humanizeCron(form.cron_expression)}
            </span>
          </div>

          {/* Format */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={labelTextStyle}>Output Format</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['pdf', 'html', 'csv', 'xlsx', 'json'] as ReportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setForm((f) => ({ ...f, format: fmt }))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--io-radius)',
                    border: '1px solid',
                    borderColor: form.format === fmt ? 'var(--io-accent)' : 'var(--io-border)',
                    background: form.format === fmt ? 'var(--io-accent-subtle)' : 'transparent',
                    color: form.format === fmt ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                    fontSize: '12px',
                    fontWeight: form.format === fmt ? 600 : 400,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <label style={labelStyle}>
            <span style={labelTextStyle}>Recipients (comma-separated emails)</span>
            <input
              type="text"
              placeholder="ops@company.com, supervisor@company.com"
              value={form.recipient_emails}
              onChange={(e) => setForm((f) => ({ ...f, recipient_emails: e.target.value }))}
              style={inputStyle}
            />
          </label>

          {/* Enabled */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="modal-enabled"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="modal-enabled" style={{ fontSize: '13px', color: 'var(--io-text-secondary)', cursor: 'pointer' }}>
              Enable immediately
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: '7px 14px',
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={!form.template_id || !form.name.trim() || !form.cron_expression.trim()}
              style={{
                padding: '7px 18px',
                background: 'var(--io-accent)',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor:
                  !form.template_id || !form.name.trim() || !form.cron_expression.trim()
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  !form.template_id || !form.name.trim() || !form.cron_expression.trim()
                    ? 0.5
                    : 1,
              }}
            >
              Create Schedule
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// ReportSchedules
// ---------------------------------------------------------------------------

export default function ReportSchedules() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.permissions.includes('reports:admin') ?? false

  const [addOpen, setAddOpen] = useState(false)

  const schedulesQuery = useQuery({
    queryKey: ['report-schedules'],
    queryFn: async () => {
      const result = await reportsApi.listSchedules({ limit: 100 })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data
    },
  })

  const templatesQuery = useQuery({
    queryKey: ['report-templates-simple'],
    queryFn: async () => {
      const result = await reportsApi.listTemplates({ limit: 200 })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))
    },
    enabled: addOpen,
  })

  const createMutation = useMutation({
    mutationFn: (form: ScheduleFormState) => {
      const emails = form.recipient_emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      return reportsApi.createSchedule({
        template_id: form.template_id,
        name: form.name.trim(),
        cron_expression: form.cron_expression.trim(),
        format: form.format,
        recipient_emails: emails,
        enabled: form.enabled,
      })
    },
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed to create schedule', description: result.error.message, variant: 'error' })
        return
      }
      setAddOpen(false)
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] })
      showToast({ title: 'Schedule created', variant: 'success' })
    },
    onError: (err) => {
      showToast({
        title: 'Failed to create schedule',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      reportsApi.updateSchedule(id, { enabled }),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed to update schedule', description: result.error.message, variant: 'error' })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] })
    },
    onError: (err) => {
      showToast({
        title: 'Failed to update schedule',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.deleteSchedule(id),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: 'Failed to delete schedule', description: result.error.message, variant: 'error' })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] })
      showToast({ title: 'Schedule deleted', variant: 'success' })
    },
    onError: (err) => {
      showToast({
        title: 'Failed to delete schedule',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    },
  })

  const schedules: ReportSchedule[] = schedulesQuery.data ?? []

  const columns: ColumnDef<ReportSchedule>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (_val, row) => (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
            {row.name}
          </div>
          {row.template_name && (
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
              {row.template_name}
            </div>
          )}
        </div>
      ),
      minWidth: 160,
    },
    {
      id: 'cron',
      header: 'Schedule',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>
          {humanizeCron(row.cron_expression)}
        </span>
      ),
      minWidth: 160,
    },
    {
      id: 'format',
      header: 'Format',
      cell: (_val, row) => (
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
          {row.format}
        </span>
      ),
      width: 70,
    },
    {
      id: 'recipients',
      header: 'Recipients',
      cell: (_val, row) => {
        const emails = row.recipient_emails ?? []
        if (emails.length === 0) return <span style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>—</span>
        return (
          <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>
            {emails[0]}{emails.length > 1 ? ` +${emails.length - 1}` : ''}
          </span>
        )
      },
      minWidth: 140,
    },
    {
      id: 'next_run_at',
      header: 'Next Run',
      cell: (_val, row) => (
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {formatDate(row.next_run_at)}
        </span>
      ),
      width: 140,
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: (_val, row) =>
        canManage ? (
          <EnabledToggle
            schedule={row}
            onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
          />
        ) : (
          <span style={{ fontSize: '12px', color: row.enabled ? 'var(--io-success)' : 'var(--io-text-muted)' }}>
            {row.enabled ? 'On' : 'Off'}
          </span>
        ),
      width: 80,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (_val, row) =>
        canManage ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteMutation.mutate(row.id)
            }}
            style={{
              padding: '3px 9px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        ) : null,
      width: 90,
    },
  ]

  return (
    <div style={{ padding: '20px', height: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Report Schedules
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--io-text-muted)' }}>
            Automatically generate and deliver reports on a schedule
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setAddOpen(true)}
            style={{
              padding: '7px 16px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            + Add Schedule
          </button>
        )}
      </div>

      {!canManage && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            fontSize: '13px',
            color: 'var(--io-text-muted)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>🔒</span>
          <span>You need the <strong>reports:admin</strong> permission to manage schedules.</span>
        </div>
      )}

      {schedulesQuery.isError && (
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
          Failed to load schedules.
        </div>
      )}

      <DataTable<ReportSchedule>
        data={schedules}
        columns={columns}
        height={480}
        rowHeight={44}
        loading={schedulesQuery.isLoading}
        emptyMessage="No schedules configured yet."
      />

      <AddScheduleModal
        open={addOpen}
        onOpenChange={setAddOpen}
        templates={templatesQuery.data ?? []}
        onSave={(form) => createMutation.mutate(form)}
      />
    </div>
  )
}
