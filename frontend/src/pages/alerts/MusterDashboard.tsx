import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type MusterStatus, type MusterMark } from '../../api/notifications'
import { wsManager } from '../../shared/hooks/useWebSocket'
import { usePermission } from '../../shared/hooks/usePermission'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<MusterStatus, { bg: string; text: string; border: string; label: string }> = {
  unaccounted: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: '#ef4444', label: 'Unaccounted' },
  accounted:   { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: '#22c55e', label: 'Accounted' },
  off_site:    { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: '#94a3b8', label: 'Off-Site' },
}

function StatusBadge({ status }: { status: MusterStatus }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.unaccounted
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: '100px',
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {c.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Mark status modal
// ---------------------------------------------------------------------------

function MarkModal({
  mark,
  onMark,
  onClose,
  isPending,
}: {
  mark: MusterMark
  onMark: (status: MusterStatus, notes?: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const [selectedStatus, setSelectedStatus] = useState<MusterStatus>(mark.status)
  const [notes, setNotes] = useState(mark.notes ?? '')

  const statuses: MusterStatus[] = ['accounted', 'off_site', 'unaccounted']

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 10,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--io-text)' }}>
          Mark Status
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--io-text-muted)' }}>
          {mark.display_name ?? mark.user_id}
          {mark.email && ` · ${mark.email}`}
        </p>

        {/* Status selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {statuses.map((s) => {
            const c = STATUS_COLORS[s]
            const selected = selectedStatus === s
            return (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  border: `1px solid ${selected ? c.border : 'var(--io-border)'}`,
                  background: selected ? c.bg : 'var(--io-surface-secondary)',
                  color: selected ? c.text : 'var(--io-text-muted)',
                  fontWeight: selected ? 700 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--io-text-muted)',
              marginBottom: 4,
            }}
          >
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Verified at assembly point A"
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface-secondary)',
              color: 'var(--io-text)',
              fontSize: 13,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: 'transparent',
              color: 'var(--io-text)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onMark(selectedStatus, notes || undefined)}
            disabled={isPending}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: STATUS_COLORS[selectedStatus].text,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Person card
// ---------------------------------------------------------------------------

function PersonCard({
  mark,
  onMarkClick,
}: {
  mark: MusterMark
  onMarkClick: (mark: MusterMark) => void
}) {
  const c = STATUS_COLORS[mark.status as MusterStatus] ?? STATUS_COLORS.unaccounted

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--io-text)' }}>
          {mark.display_name ?? mark.user_id}
        </span>
        <StatusBadge status={mark.status as MusterStatus} />
      </div>
      {mark.email && (
        <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>{mark.email}</span>
      )}
      {mark.notes && (
        <span style={{ fontSize: 12, color: 'var(--io-text-secondary)', fontStyle: 'italic' }}>
          {mark.notes}
        </span>
      )}
      {mark.marked_at && (
        <span style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>
          Marked {new Date(mark.marked_at).toLocaleString()}
        </span>
      )}
      <button
        onClick={() => onMarkClick(mark)}
        style={{
          marginTop: 4,
          padding: '4px 10px',
          borderRadius: 5,
          border: `1px solid ${c.border}`,
          background: 'transparent',
          color: c.text,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        Mark
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

function SummaryBar({
  total,
  accounted,
  off_site,
  unaccounted,
}: {
  total: number
  accounted: number
  off_site: number
  unaccounted: number
}) {
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  const items = [
    { label: 'Accounted', count: accounted, color: '#22c55e' },
    { label: 'Off-Site', count: off_site, color: '#94a3b8' },
    { label: 'Unaccounted', count: unaccounted, color: '#ef4444' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--io-surface-secondary)',
        borderRadius: 8,
        border: '1px solid var(--io-border)',
        marginBottom: 20,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--io-text)', marginRight: 8 }}>
        Muster Status — {total} personnel
      </span>
      {items.map(({ label, count, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--io-text)' }}>
            <strong>{count}</strong>{' '}
            <span style={{ color: 'var(--io-text-muted)' }}>
              {label} ({pct(count)}%)
            </span>
          </span>
        </div>
      ))}
      {/* Progress bar */}
      <div
        style={{
          flex: 1,
          minWidth: 120,
          height: 6,
          borderRadius: 3,
          background: 'var(--io-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct(accounted)}%`,
            height: '100%',
            background: '#22c55e',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MusterDashboard page
// ---------------------------------------------------------------------------

export default function MusterDashboard() {
  const { messageId } = useParams<{ messageId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canMuster = usePermission('alerts:muster')
  const [markTarget, setMarkTarget] = useState<MusterMark | null>(null)
  const [filter, setFilter] = useState<MusterStatus | 'all'>('all')

  const { data: musterResult, isLoading, error } = useQuery({
    queryKey: ['muster-status', messageId],
    queryFn: () => notificationsApi.getMusterStatus(messageId!),
    enabled: Boolean(messageId),
    // Fallback polling — WS subscriptions below handle real-time updates.
    refetchInterval: 120_000,
  })

  // Subscribe to muster status and person-accounted events via WebSocket.
  useEffect(() => {
    if (!messageId) return
    const unsubStatus = wsManager.onMusterStatus((data) => {
      if (!data.muster_event_id || data.muster_event_id === messageId) {
        void qc.invalidateQueries({ queryKey: ['muster-status', messageId] })
      }
    })
    const unsubPerson = wsManager.onMusterPersonAccounted(() => {
      void qc.invalidateQueries({ queryKey: ['muster-status', messageId] })
    })
    return () => {
      unsubStatus()
      unsubPerson()
    }
  }, [messageId, qc])

  const { data: msgResult } = useQuery({
    queryKey: ['notification-message', messageId],
    queryFn: () => notificationsApi.getMessage(messageId!),
    enabled: Boolean(messageId),
  })

  const markMutation = useMutation({
    mutationFn: ({ status, notes }: { status: MusterStatus; notes?: string }) =>
      notificationsApi.markMuster(messageId!, {
        user_id: markTarget!.user_id,
        status,
        notes,
      }),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['muster-status', messageId] })
        setMarkTarget(null)
      }
    },
  })

  if (!messageId) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#ef4444' }}>No message ID provided.</p>
      </div>
    )
  }

  const musterData = musterResult?.success ? musterResult.data : null
  const message = msgResult?.success ? msgResult.data : null

  const allMarks: MusterMark[] = musterData?.marks ?? []
  const summary = musterData?.summary ?? { total: 0, accounted: 0, off_site: 0, unaccounted: 0 }

  const filteredMarks =
    filter === 'all' ? allMarks : allMarks.filter((m) => m.status === filter)

  const filterBtnStyle = (active: boolean, color: string): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    border: `1px solid ${active ? color : 'var(--io-border)'}`,
    background: active ? `${color}22` : 'transparent',
    color: active ? color : 'var(--io-text-muted)',
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
  })

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/alerts')}
        style={{
          marginBottom: 16,
          padding: '5px 12px',
          borderRadius: 6,
          border: '1px solid var(--io-border)',
          background: 'transparent',
          color: 'var(--io-text-muted)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Back to Alerts
      </button>

      {/* Message context */}
      {message && (
        <div
          style={{
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 8px',
                borderRadius: 100,
                background:
                  message.severity === 'emergency'
                    ? 'rgba(239,68,68,0.15)'
                    : message.severity === 'critical'
                    ? 'rgba(249,115,22,0.15)'
                    : 'rgba(74,158,255,0.15)',
                color:
                  message.severity === 'emergency'
                    ? '#ef4444'
                    : message.severity === 'critical'
                    ? '#f97316'
                    : '#4a9eff',
              }}
            >
              {message.severity}
            </span>
            <span style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>
              Sent {new Date(message.sent_at).toLocaleString()} by {message.sent_by_name ?? message.sent_by}
            </span>
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, color: 'var(--io-text)' }}>{message.title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--io-text-secondary)', lineHeight: 1.6 }}>{message.body}</p>
        </div>
      )}

      {/* Summary */}
      {musterData && (
        <SummaryBar
          total={summary.total}
          accounted={summary.accounted}
          off_site={summary.off_site}
          unaccounted={summary.unaccounted}
        />
      )}

      {/* Filter controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setFilter('all')} style={filterBtnStyle(filter === 'all', 'var(--io-accent, #4a9eff)')}>
          All ({allMarks.length})
        </button>
        <button
          onClick={() => setFilter('unaccounted')}
          style={filterBtnStyle(filter === 'unaccounted', '#ef4444')}
        >
          Unaccounted ({summary.unaccounted})
        </button>
        <button
          onClick={() => setFilter('accounted')}
          style={filterBtnStyle(filter === 'accounted', '#22c55e')}
        >
          Accounted ({summary.accounted})
        </button>
        <button
          onClick={() => setFilter('off_site')}
          style={filterBtnStyle(filter === 'off_site', '#94a3b8')}
        >
          Off-Site ({summary.off_site})
        </button>
      </div>

      {/* Loading / error states */}
      {isLoading && (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>Loading muster data…</p>
      )}
      {error && (
        <p style={{ color: '#ef4444', fontSize: 14 }}>Failed to load muster data.</p>
      )}

      {/* Person cards grid */}
      {!isLoading && filteredMarks.length === 0 && (
        <p style={{ color: 'var(--io-text-muted)', fontSize: 14 }}>
          {allMarks.length === 0
            ? 'No recipients tracked for this alert.'
            : `No personnel with status "${filter}".`}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {filteredMarks.map((mark) => (
          <PersonCard key={mark.id} mark={mark} onMarkClick={setMarkTarget} />
        ))}
      </div>

      {/* Export unaccounted list — gated on alerts:muster permission */}
      {canMuster && (
        <div style={{ marginTop: 20 }}>
          <a
            href={notificationsApi.exportMusterUnaccounted(messageId)}
            download
            style={{
              display: 'inline-block',
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid var(--io-border)',
              background: 'var(--io-surface-secondary)',
              color: 'var(--io-text)',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Export Unaccounted List
          </a>
        </div>
      )}

      {/* Mark modal */}
      {markTarget && (
        <MarkModal
          mark={markTarget}
          onMark={(status, notes) => markMutation.mutate({ status, notes })}
          onClose={() => setMarkTarget(null)}
          isPending={markMutation.isPending}
        />
      )}
    </div>
  )
}
