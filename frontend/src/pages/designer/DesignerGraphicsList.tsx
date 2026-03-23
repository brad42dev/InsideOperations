import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { graphicsApi } from '../../api/graphics'
import type { GraphicSummary } from '../../shared/types/graphics'
import { useAuthStore } from '../../store/auth'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  if (isNaN(then)) return 'unknown'
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  const diffMo = Math.floor(diffDay / 30)
  if (diffMo < 12) return `${diffMo} month${diffMo !== 1 ? 's' : ''} ago`
  const diffYr = Math.floor(diffMo / 12)
  return `${diffYr} year${diffYr !== 1 ? 's' : ''} ago`
}

const SCOPE_LABELS: Record<string, string> = {
  console: 'Console',
  process: 'Process',
}

const MODE_LABELS: Record<string, string> = {
  graphic: 'Graphic',
  dashboard: 'Dashboard',
  report: 'Report',
}

const SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  console: { bg: 'rgba(99,102,241,0.15)', text: 'var(--io-accent)' },
  process: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
}

const MODE_COLORS: Record<string, { bg: string; text: string }> = {
  graphic:   { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa' },
  dashboard: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  report:    { bg: 'rgba(156,163,175,0.12)', text: 'var(--io-text-secondary)' },
}

const PAGE_SIZE = 24

// ---------------------------------------------------------------------------
// SkeletonCard
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 140,
          background: 'var(--io-surface-elevated)',
          animation: 'io-pulse 1.5s ease-in-out infinite',
        }}
      />
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            height: 14,
            width: '70%',
            background: 'var(--io-surface-elevated)',
            borderRadius: 4,
            animation: 'io-pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            height: 11,
            width: '45%',
            background: 'var(--io-surface-elevated)',
            borderRadius: 4,
            animation: 'io-pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            height: 11,
            width: '90%',
            background: 'var(--io-surface-elevated)',
            borderRadius: 4,
            animation: 'io-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphicThumbnail
// ---------------------------------------------------------------------------

function GraphicThumbnail({ id, name, mode }: { id: string; name: string; mode: string }) {
  const [errored, setErrored] = useState(false)

  const modeIcon = (m: string) => {
    if (m === 'dashboard') {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.4}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    }
    if (m === 'report') {
      return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.4}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      )
    }
    // graphic (default)
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.4}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    )
  }

  if (errored) {
    return (
      <div
        style={{
          height: 140,
          background: 'var(--io-surface-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          color: 'var(--io-text-muted)',
        }}
      >
        {modeIcon(mode)}
        <span style={{ fontSize: 11, opacity: 0.5 }}>{MODE_LABELS[mode] ?? mode}</span>
      </div>
    )
  }

  return (
    <img
      src={graphicsApi.thumbnailUrl(id)}
      alt={name}
      onError={() => setErrored(true)}
      style={{
        width: '100%',
        height: 140,
        objectFit: 'cover',
        display: 'block',
        background: 'var(--io-surface-elevated)',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// GraphicCard
// ---------------------------------------------------------------------------

interface GraphicCardProps {
  graphic: GraphicSummary
  onDelete: (id: string, name: string) => void
  canDelete: boolean
}

function GraphicCard({ graphic, onDelete, canDelete }: GraphicCardProps) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  const scopeColor = SCOPE_COLORS[graphic.graphicScope] ?? { bg: 'rgba(156,163,175,0.12)', text: 'var(--io-text-secondary)' }
  const modeColor  = MODE_COLORS[graphic.designMode]   ?? { bg: 'rgba(156,163,175,0.12)', text: 'var(--io-text-secondary)' }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/designer/graphics/${graphic.id}/edit`)}
      style={{
        background: 'var(--io-surface)',
        border: `1px solid ${hovered ? 'var(--io-accent)' : 'var(--io-border)'}`,
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: hovered ? '0 0 0 1px var(--io-accent)' : 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <GraphicThumbnail id={graphic.id} name={graphic.name} mode={graphic.designMode} />

        {/* Hover overlay */}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/designer/graphics/${graphic.id}/edit`)
              }}
              style={{
                padding: '7px 18px',
                background: 'var(--io-accent)',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(graphic.id, graphic.name)
                }}
                style={{
                  padding: '7px 16px',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: 'var(--io-radius)',
                  color: '#f87171',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 4,
              background: scopeColor.bg,
              color: scopeColor.text,
              textTransform: 'capitalize',
            }}
          >
            {SCOPE_LABELS[graphic.graphicScope] ?? graphic.graphicScope}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 4,
              background: modeColor.bg,
              color: modeColor.text,
            }}
          >
            {MODE_LABELS[graphic.designMode] ?? graphic.designMode}
          </span>
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={graphic.name}
        >
          {graphic.name}
        </div>

        {/* Description */}
        {graphic.description && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--io-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
            }}
            title={graphic.description}
          >
            {graphic.description}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 6,
            fontSize: 11,
            color: 'var(--io-text-muted)',
          }}
        >
          {relativeTime(graphic.updatedAt)}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeleteDialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  graphicName: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function DeleteDialog({ graphicName, onConfirm, onCancel, isPending }: DeleteDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '24px 28px',
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--io-text-primary)',
          }}
        >
          Delete Graphic
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
          Delete <strong style={{ color: 'var(--io-text-primary)' }}>"{graphicName}"</strong>?
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              padding: '8px 18px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              padding: '8px 18px',
              background: isPending ? 'rgba(239,68,68,0.4)' : '#ef4444',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({ onCreate, canCreate, hasFilters }: { onCreate: () => void; canCreate: boolean; hasFilters: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 40,
        color: 'var(--io-text-muted)',
      }}
    >
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity={0.35}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
        <line x1="12" y1="5" x2="12" y2="7" strokeWidth="1.5" />
        <line x1="12" y1="12" x2="12" y2="18" strokeWidth="1.5" />
        <line x1="9" y1="15" x2="15" y2="15" strokeWidth="1.5" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--io-text-primary)' }}>
          {hasFilters ? 'No graphics match your filters' : 'No process graphics yet'}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--io-text-muted)', maxWidth: 320 }}>
          {hasFilters ? 'Try adjusting your search or filter criteria.' : 'Create your first graphic to get started.'}
        </p>
      </div>
      {canCreate && !hasFilters && (
        <button
          onClick={onCreate}
          style={{
            marginTop: 4,
            padding: '9px 20px',
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Create Graphic
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DesignerGraphicsList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const canWrite  = user?.permissions.includes('designer:write')  ?? false
  const canDelete = user?.permissions.includes('designer:delete') ?? false

  // Filter state
  const [search, setSearch]         = useState('')
  const [scopeFilter, setScopeFilter] = useState<'all' | 'console' | 'process'>('all')
  const [modeFilter, setModeFilter]   = useState<'all' | 'graphic' | 'dashboard' | 'report'>('all')
  const [page, setPage]             = useState(1)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // --------------------------------------------------------------------------
  // Data
  // --------------------------------------------------------------------------

  const { data, isLoading, isError } = useQuery({
    queryKey: ['design-objects', { scope: scopeFilter, mode: modeFilter, search }],
    queryFn: () => graphicsApi.list(),
    staleTime: 30_000,
  })

  // Guard against both paginated ({ data: [...] }) and flat (array) API shapes.
  // The client unwraps the envelope differently depending on whether the server
  // includes a `pagination` key, so data.data may be the array itself or an
  // object with a nested `data` property.
  const allGraphics: GraphicSummary[] =
    data?.success === true
      ? (Array.isArray(data.data)
          ? data.data
          : ((data.data as { data?: GraphicSummary[] })?.data ?? []))
      : []

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = allGraphics
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((g) => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q))
    }
    if (scopeFilter !== 'all') {
      list = list.filter((g) => g.graphicScope === scopeFilter)
    }
    if (modeFilter !== 'all') {
      list = list.filter((g) => g.designMode === modeFilter)
    }
    return list
  }, [allGraphics, search, scopeFilter, modeFilter])

  const paginated  = filtered.slice(0, page * PAGE_SIZE)
  const hasMore    = page * PAGE_SIZE < filtered.length

  // Reset page when filters change
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleScope  = (v: string) => { setScopeFilter(v as typeof scopeFilter); setPage(1) }
  const handleMode   = (v: string) => { setModeFilter(v as typeof modeFilter); setPage(1) }

  // --------------------------------------------------------------------------
  // Delete mutation
  // --------------------------------------------------------------------------

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await graphicsApi.remove(id)
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['design-objects'], exact: false })
      setDeleteTarget(null)
      showToast({ title: 'Graphic deleted', variant: 'success' })
    },
    onError: () => {
      showToast({ title: 'Delete failed', description: 'Could not delete the graphic. Please try again.', variant: 'error' })
    },
  })

  const handleDeleteRequest = (id: string, name: string) => {
    if (!canDelete) return
    setDeleteTarget({ id, name })
  }
  const handleDeleteConfirm = () => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }
  const handleDeleteCancel  = () => setDeleteTarget(null)

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--io-surface-primary)',
          overflow: 'hidden',
        }}
      >
        {/* ------------------------------------------------------------------ */}
        {/* Header bar                                                          */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            height: 48,
            flexShrink: 0,
            background: 'var(--io-surface)',
            borderBottom: '1px solid var(--io-border)',
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/designer')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                fontSize: 13,
                padding: '4px 0',
                lineHeight: 1,
              }}
            >
              Designer
            </button>
            <span style={{ color: 'var(--io-border)', fontSize: 13 }}>/</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--io-text-primary)' }}>
              Process Graphics
            </span>
          </div>

          {/* New Graphic button */}
          {canWrite && (
            <button
              onClick={() => navigate('/designer/graphics/new')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                background: 'var(--io-accent)',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Graphic
            </button>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Filter / search bar                                                 */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            flexShrink: 0,
            background: 'var(--io-surface)',
            borderBottom: '1px solid var(--io-border)',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 380 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--io-text-muted)',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search graphics…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 32,
                paddingRight: 10,
                paddingTop: 7,
                paddingBottom: 7,
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Scope filter */}
          <select
            value={scopeFilter}
            onChange={(e) => handleScope(e.target.value)}
            style={{
              padding: '7px 10px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All Scopes</option>
            <option value="console">Console</option>
            <option value="process">Process</option>
          </select>

          {/* Mode tags */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'graphic', 'dashboard', 'report'] as const).map((m) => {
              const active = modeFilter === m
              const label  = m === 'all' ? 'All' : MODE_LABELS[m]
              return (
                <button
                  key={m}
                  onClick={() => handleMode(m)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--io-radius)',
                    border: active ? '1px solid var(--io-accent)' : '1px solid var(--io-border)',
                    background: active ? 'rgba(99,102,241,0.15)' : 'var(--io-surface-elevated)',
                    color: active ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Result count */}
          {!isLoading && (
            <span style={{ fontSize: 12, color: 'var(--io-text-muted)', marginLeft: 'auto' }}>
              {filtered.length} {filtered.length === 1 ? 'graphic' : 'graphics'}
            </span>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Content area                                                        */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Error state */}
          {isError && (
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--io-radius)',
                color: '#f87171',
                fontSize: 13,
              }}
            >
              Failed to load graphics. Please refresh and try again.
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 16,
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState
              onCreate={() => navigate('/designer/graphics/new')}
              canCreate={canWrite}
              hasFilters={search.trim() !== '' || scopeFilter !== 'all' || modeFilter !== 'all'}
            />
          )}

          {/* Grid */}
          {!isLoading && !isError && filtered.length > 0 && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {paginated.map((graphic) => (
                  <GraphicCard
                    key={graphic.id}
                    graphic={graphic}
                    onDelete={handleDeleteRequest}
                    canDelete={canDelete}
                  />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    style={{
                      padding: '9px 28px',
                      background: 'var(--io-surface)',
                      border: '1px solid var(--io-border)',
                      borderRadius: 'var(--io-radius)',
                      color: 'var(--io-text-secondary)',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Load more ({filtered.length - page * PAGE_SIZE} remaining)
                  </button>
                </div>
              )}

              {/* Total / page info */}
              {!hasMore && filtered.length > PAGE_SIZE && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--io-text-muted)', margin: 0 }}>
                  Showing all {filtered.length} graphics
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Delete confirmation dialog                                            */}
      {/* -------------------------------------------------------------------- */}
      {deleteTarget && (
        <DeleteDialog
          graphicName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isPending={deleteMutation.isPending}
        />
      )}
    </>
  )
}
