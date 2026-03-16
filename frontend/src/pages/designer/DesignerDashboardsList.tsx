// Re-export DashboardsPage with designer breadcrumb context.
// This page is reached via /designer/dashboards and shows the same
// dashboard list but with a Designer breadcrumb in the header.

import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardsApi, type Dashboard } from '../../api/dashboards'

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function DashboardThumbnail({ name }: { name: string }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hue = hash % 360
  const hue2 = (hue + 40) % 360
  return (
    <div
      style={{
        height: '100px',
        borderRadius: '4px 4px 0 0',
        background: `linear-gradient(135deg, hsl(${hue},60%,20%) 0%, hsl(${hue2},50%,15%) 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '10px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '5px',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: `hsla(${(hue + i * 30) % 360},40%,50%,0.15)`,
              border: `1px solid hsla(${(hue + i * 30) % 360},40%,50%,0.3)`,
              borderRadius: 3,
            }}
          />
        ))}
      </div>
      <span style={{ position: 'relative', zIndex: 1, fontSize: '20px', opacity: 0.5 }}>▦</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardCard
// ---------------------------------------------------------------------------

const DashboardCard = memo(function DashboardCard({
  dashboard,
  onEdit,
  onDelete,
}: {
  dashboard: Dashboard
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

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
      onClick={() => navigate(`/designer/dashboards/${dashboard.id}/edit`)}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-accent)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-border)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      <DashboardThumbnail name={dashboard.name} />

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
            {dashboard.name}
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
              }}
            >
              ⋯
            </button>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
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
                      action: () => { onEdit(dashboard.id); setMenuOpen(false) },
                      danger: false,
                      disabled: false,
                    },
                    {
                      label: 'Delete',
                      action: () => { onDelete(dashboard.id); setMenuOpen(false) },
                      danger: true,
                      disabled: dashboard.is_system,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.disabled ? undefined : item.action}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'none',
                        border: 'none',
                        color: item.danger ? 'var(--io-danger, #ef4444)' : 'var(--io-text-secondary)',
                        fontSize: '13px',
                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        opacity: item.disabled ? 0.4 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!item.disabled) {
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)'
                        }
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

        {dashboard.description && (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--io-text-secondary)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {dashboard.description}
          </p>
        )}
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// DesignerDashboardsList
// ---------------------------------------------------------------------------

export default function DesignerDashboardsList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const query = useQuery({
    queryKey: ['dashboards'],
    queryFn: async () => {
      const r = await dashboardsApi.list()
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await dashboardsApi.delete(id)
      if (!r.success) throw new Error(r.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboards'] })
    },
  })

  const dashboards = query.data ?? []
  const filtered = dashboards.filter(
    (d) => !search || d.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleDelete(id: string) {
    if (window.confirm('Delete this dashboard?')) {
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
          Dashboards
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/designer/dashboards/new')}
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
          + New Dashboard
        </button>
      </div>

      {/* Search */}
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
          placeholder="Search dashboards..."
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
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {query.isLoading && (
          <div style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading dashboards...</div>
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
            Failed to load dashboards.
          </div>
        )}

        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '80px 20px',
              gap: '12px',
              color: 'var(--io-text-muted)',
            }}
          >
            <span style={{ fontSize: '48px', opacity: 0.3 }}>▦</span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
              {search ? 'No dashboards match your search' : 'No dashboards yet'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/designer/dashboards/new')}
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
                + New Dashboard
              </button>
            )}
          </div>
        )}

        {!query.isLoading && filtered.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {filtered.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                onEdit={(id) => navigate(`/designer/dashboards/${id}/edit`)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
