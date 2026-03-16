import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { forensicsApi, type Investigation } from '../../api/forensics'
import ThresholdSearch from './ThresholdSearch'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Investigation['status'] }) {
  const colors: Record<Investigation['status'], { bg: string; text: string }> = {
    active: { bg: 'var(--io-accent-subtle, rgba(74,158,255,0.15))', text: 'var(--io-accent, #4A9EFF)' },
    closed: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    cancelled: { bg: 'var(--io-surface-secondary)', text: 'var(--io-text-muted)' },
  }
  const c = colors[status]
  return (
    <span
      style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '100px',
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// New Investigation modal
// ---------------------------------------------------------------------------

function NewInvestigationModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void
  onCreate: (name: string, anchorPointId?: string) => void
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [pointSearch, setPointSearch] = useState('')
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: '8px',
          padding: '24px',
          width: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
          New Investigation
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)' }}>
            Name *
          </label>
          <input
            autoFocus
            type="text"
            placeholder="e.g. Pump P-101 vibration event 2026-03-15"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                onCreate(name.trim(), selectedPointId)
              }
              if (e.key === 'Escape') onClose()
            }}
            style={{
              padding: '8px 12px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)' }}>
            Anchor Point (optional)
          </label>
          <input
            type="text"
            placeholder="Search for a point tag or name..."
            value={pointSearch}
            onChange={(e) => {
              setPointSearch(e.target.value)
              if (!e.target.value) setSelectedPointId(undefined)
            }}
            style={{
              padding: '8px 12px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          {pointSearch && (
            <p style={{ fontSize: '12px', color: 'var(--io-text-muted)', margin: 0 }}>
              Point search requires a connected API. Enter a point ID manually or leave blank.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              background: 'none',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || loading}
            onClick={() => onCreate(name.trim(), selectedPointId)}
            style={{
              padding: '7px 16px',
              background: name.trim() ? 'var(--io-accent)' : 'var(--io-surface-secondary)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: name.trim() ? '#fff' : 'var(--io-text-muted)',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {loading ? 'Creating...' : 'Create Investigation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Investigation card
// ---------------------------------------------------------------------------

function InvestigationCard({
  inv,
  onClick,
}: {
  inv: Investigation
  onClick: () => void
}) {
  const createdDate = new Date(inv.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: '6px',
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--io-accent, #4A9EFF)'
        el.style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--io-border)'
        el.style.background = 'var(--io-surface)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inv.name}
        </span>
        <StatusBadge status={inv.status} />
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--io-text-muted)' }}>
        {inv.anchor_point_id && (
          <span>Anchor: <span style={{ color: 'var(--io-text-secondary)' }}>{inv.anchor_point_id}</span></span>
        )}
        <span>Created {createdDate}</span>
        <span>by {inv.created_by}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '80px 24px',
        color: 'var(--io-text-muted)',
      }}
    >
      <span style={{ fontSize: '40px', opacity: 0.25 }}>🔬</span>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
          No investigations found
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '13px' }}>
          Create an investigation to start correlating process data and analyzing events.
        </p>
      </div>
      <button
        onClick={onNew}
        style={{
          padding: '8px 18px',
          background: 'var(--io-accent)',
          border: 'none',
          borderRadius: 'var(--io-radius)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        New Investigation
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ForensicsPage
// ---------------------------------------------------------------------------

type Tab = 'investigations' | 'threshold'
type StatusFilter = 'all' | 'active' | 'closed' | 'cancelled'

export default function ForensicsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('investigations')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showNewModal, setShowNewModal] = useState(false)

  const listQuery = useQuery({
    queryKey: ['investigations', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined
      const result = await forensicsApi.listInvestigations(params)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: async ({
      name,
      anchorPointId,
    }: {
      name: string
      anchorPointId?: string
    }) => {
      const result = await forensicsApi.createInvestigation({
        name,
        anchor_point_id: anchorPointId,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['investigations'] })
      setShowNewModal(false)
      navigate(`/forensics/${data.id}`)
    },
  })

  const investigations = listQuery.data ?? []

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'closed', label: 'Closed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-surface-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
            Forensics
          </span>
          {/* Top-level tabs */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {([
              { key: 'investigations', label: 'Investigations' },
              { key: 'threshold', label: 'Threshold Search' },
            ] as { key: Tab; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '4px 12px',
                  background: tab === t.key ? 'var(--io-accent-subtle)' : 'none',
                  border: 'none',
                  borderRadius: 'var(--io-radius)',
                  color: tab === t.key ? 'var(--io-accent)' : 'var(--io-text-muted)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: tab === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'investigations' && (
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              padding: '6px 14px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            New Investigation
          </button>
        )}
      </div>

      {/* Content */}
      {tab === 'threshold' ? (
        <ThresholdSearch />
      ) : (
        <>
          {/* Status filter tabs */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '8px 20px',
              borderBottom: '1px solid var(--io-border)',
              background: 'var(--io-surface-secondary)',
              flexShrink: 0,
            }}
          >
            {statusTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                style={{
                  padding: '4px 12px',
                  background: statusFilter === t.key ? 'var(--io-surface-elevated)' : 'none',
                  border: statusFilter === t.key ? '1px solid var(--io-border)' : '1px solid transparent',
                  borderRadius: 'var(--io-radius)',
                  color: statusFilter === t.key ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: statusFilter === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {listQuery.isLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: '72px',
                      background: 'var(--io-surface-secondary)',
                      borderRadius: '6px',
                      animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
              </div>
            )}

            {listQuery.isError && (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--io-danger, #ef4444)',
                  fontSize: '13px',
                }}
              >
                Failed to load investigations. {(listQuery.error as Error).message}
              </div>
            )}

            {!listQuery.isLoading && !listQuery.isError && investigations.length === 0 && (
              <EmptyState onNew={() => setShowNewModal(true)} />
            )}

            {!listQuery.isLoading && investigations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {investigations.map((inv) => (
                  <InvestigationCard
                    key={inv.id}
                    inv={inv}
                    onClick={() => navigate(`/forensics/${inv.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* New investigation modal */}
      {showNewModal && (
        <NewInvestigationModal
          onClose={() => setShowNewModal(false)}
          onCreate={(name, anchorPointId) =>
            createMutation.mutate({ name, anchorPointId })
          }
          loading={createMutation.isPending}
        />
      )}

      <style>{`
        @keyframes io-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
