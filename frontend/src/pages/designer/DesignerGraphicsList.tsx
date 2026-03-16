import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { graphicsApi, type GraphicSummary } from '../../api/graphics'
import { iographicApi } from '../../api/iographic'

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function GraphicThumbnail({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue = hash % 360
  return (
    <div
      style={{
        width: '100%',
        height: '80px',
        borderRadius: '4px 4px 0 0',
        background: `linear-gradient(135deg, hsl(${hue},40%,18%) 0%, hsl(${(hue + 60) % 360},30%,12%) 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '28px',
        opacity: 0.8,
      }}
    >
      🖼
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphicCard
// ---------------------------------------------------------------------------

function GraphicCard({
  graphic,
  onEdit,
  onDelete,
}: {
  graphic: GraphicSummary
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const formattedDate = new Date(graphic.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        position: 'relative',
      }}
      onClick={() => navigate(`/designer/graphics/${graphic.id}`)}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-accent)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-border)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      <GraphicThumbnail name={graphic.name} />

      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {graphic.name}
          </span>

          <div
            style={{ position: 'relative', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '14px',
                borderRadius: 4,
              }}
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 4px)',
                    minWidth: '140px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    zIndex: 99,
                    overflow: 'hidden',
                  }}
                >
                  {[
                    {
                      label: 'Edit',
                      action: () => { onEdit(graphic.id); setMenuOpen(false) },
                      danger: false,
                    },
                    {
                      label: 'Download .iographic',
                      action: () => {
                        window.open(iographicApi.exportGraphicUrl(graphic.id), '_blank')
                        setMenuOpen(false)
                      },
                      danger: false,
                    },
                    {
                      label: 'Delete',
                      action: () => { onDelete(graphic.id); setMenuOpen(false) },
                      danger: true,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        color: item.danger ? 'var(--io-danger, #ef4444)' : 'var(--io-text-secondary)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'block',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '100px',
              background: 'var(--io-surface-secondary)',
              color: 'var(--io-text-muted)',
            }}
          >
            {graphic.bindings_count} bindings
          </span>
          <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>{formattedDate}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        overflow: 'hidden',
      }}
    >
      <div style={{ height: '80px', background: 'var(--io-surface-secondary)', animation: 'io-skeleton-pulse 1.5s ease-in-out infinite' }} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ height: 14, width: '70%', borderRadius: 4, background: 'var(--io-surface-secondary)', marginBottom: 8, animation: 'io-skeleton-pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 10, width: '40%', borderRadius: 4, background: 'var(--io-surface-secondary)', animation: 'io-skeleton-pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DesignerGraphicsList
// ---------------------------------------------------------------------------

export default function DesignerGraphicsList() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const importedCount = (location.state as { importedCount?: number } | null)?.importedCount

  const query = useQuery({
    queryKey: ['graphics'],
    queryFn: async () => {
      const r = await graphicsApi.list()
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await graphicsApi.remove(id)
      if (!r.success) throw new Error(r.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['graphics'] })
    },
  })

  const graphics = query.data ?? []
  const filtered = graphics.filter(
    (g) => !search || g.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleDelete(id: string) {
    if (window.confirm('Delete this graphic? This cannot be undone.')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 20px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <button
          onClick={() => navigate('/designer')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 0',
          }}
        >
          ← Designer
        </button>
        <span style={{ color: 'var(--io-border)' }}>/</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Process Graphics
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/designer/import')}
          style={{
            padding: '6px 14px',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Import
        </button>
        <button
          onClick={() => navigate('/designer/graphics/new')}
          style={{
            padding: '6px 14px',
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: '#09090b',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          + New Graphic
        </button>
      </div>

      {/* Import success banner */}
      {importedCount != null && importedCount > 0 && (
        <div style={{
          padding: '10px 20px',
          background: 'var(--io-accent-subtle)',
          borderBottom: '1px solid var(--io-accent)',
          color: 'var(--io-accent)',
          fontSize: '13px',
          fontWeight: 500,
          flexShrink: 0,
        }}>
          ✓ Imported {importedCount} graphic{importedCount !== 1 ? 's' : ''} successfully
        </div>
      )}

      {/* Search bar */}
      <div
        style={{
          padding: '10px 20px',
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Search graphics..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '280px',
            padding: '7px 10px',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-primary)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <span style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--io-text-muted)' }}>
          {query.isLoading ? 'Loading...' : `${filtered.length} graphic${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {query.isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {query.isError && (
          <div
            style={{
              padding: '20px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger, #ef4444)',
              fontSize: '13px',
            }}
          >
            Failed to load graphics.
          </div>
        )}

        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              gap: '12px',
              color: 'var(--io-text-muted)',
            }}
          >
            <span style={{ fontSize: '48px', opacity: 0.3 }}>🖼</span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
              {search ? 'No graphics match your search' : 'No graphics yet'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/designer/graphics/new')}
                style={{
                  marginTop: '8px',
                  padding: '7px 16px',
                  background: 'var(--io-accent)',
                  border: 'none',
                  borderRadius: 'var(--io-radius)',
                  color: '#09090b',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                + New Graphic
              </button>
            )}
          </div>
        )}

        {!query.isLoading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {filtered.map((g) => (
              <GraphicCard
                key={g.id}
                graphic={g}
                onEdit={(id) => navigate(`/designer/graphics/${id}/edit`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes io-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
