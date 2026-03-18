import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { shiftsApi, type Shift } from '../../api/shifts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, [string, string]> = {
  scheduled: ['#4a9eff', 'rgba(74,158,255,0.12)'],
  active:    ['#22c55e', 'rgba(34,197,94,0.12)'],
  completed: ['#6b7280', 'rgba(107,114,128,0.12)'],
  cancelled: ['#ef4444', 'rgba(239,68,68,0.12)'],
}

function StatusBadge({ status }: { status: Shift['status'] }) {
  const [color, bg] = STATUS_COLORS[status] ?? ['#6b7280', 'rgba(107,114,128,0.12)']
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 100,
        background: bg,
        color,
        border: `1px solid ${color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ShiftRow({ shift }: { shift: Shift }) {
  const navigate = useNavigate()

  return (
    <tr
      onClick={() => navigate(`/shifts/schedule/${shift.id}`)}
      style={{ cursor: 'pointer', borderBottom: '1px solid var(--io-border)' }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLTableRowElement).style.background =
          'var(--io-surface-secondary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
      }}
    >
      <td style={{ padding: '12px 16px', color: 'var(--io-text-primary)', fontWeight: 500 }}>
        {shift.name}
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--io-text-secondary)', fontSize: 13 }}>
        {shift.crew_name ?? <span style={{ color: 'var(--io-text-muted)' }}>—</span>}
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--io-text-secondary)', fontSize: 13 }}>
        {formatDateTime(shift.start_time)}
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--io-text-secondary)', fontSize: 13 }}>
        {formatDateTime(shift.end_time)}
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--io-text-muted)', fontSize: 13 }}>
        {formatDuration(shift.start_time, shift.end_time)}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <StatusBadge status={shift.status} />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | Shift['status']

const STATUSES: StatusFilter[] = ['all', 'scheduled', 'active', 'completed', 'cancelled']

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ShiftSchedule() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Default: next 30 days
  const from = new Date().toISOString()
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + 30)
  const to = toDate.toISOString()

  const { data, isLoading, isError, refetch } = useQuery<Shift[]>({
    queryKey: ['shifts', 'list', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = { from, to }
      if (statusFilter !== 'all') params.status = statusFilter
      const res = await shiftsApi.listShifts(params)
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
  })

  const shifts = data ?? []

  return (
    <div style={{ padding: 'var(--io-space-6)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: 'var(--io-text-primary)', fontSize: 20, fontWeight: 600 }}>
            Shift Schedule
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--io-text-muted)', fontSize: 13 }}>
            Upcoming shifts — next 30 days
          </p>
        </div>
        <button
          onClick={() => navigate('/shifts/schedule/new')}
          style={{
            padding: '8px 16px',
            background: 'var(--io-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          + New Shift
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: statusFilter === s ? 'var(--io-accent)' : 'var(--io-surface)',
              color: statusFilter === s ? '#fff' : 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          style={{
            marginLeft: 'auto',
            padding: '5px 12px',
            borderRadius: 6,
            border: '1px solid var(--io-border)',
            background: 'var(--io-surface)',
            color: 'var(--io-text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--io-text-muted)' }}>
            Loading shifts…
          </div>
        ) : isError ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
            Failed to load shifts.{' '}
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
        ) : shifts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--io-text-muted)' }}>
            No shifts found for this period.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--io-border)', background: 'var(--io-bg)' }}>
                {['Name', 'Crew', 'Start', 'End', 'Duration', 'Status'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--io-text-muted)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift: Shift) => (
                <ShiftRow key={shift.id} shift={shift} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count footer */}
      {!isLoading && !isError && shifts.length > 0 && (
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--io-text-muted)' }}>
          {shifts.length} shift{shifts.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
