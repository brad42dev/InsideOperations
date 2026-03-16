import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, type ReportTemplate } from '../../api/reports'

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  executive: { bg: 'var(--io-accent-subtle)', fg: 'var(--io-accent)' },
  compliance: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
  maintenance: { bg: 'rgba(251,191,36,0.12)', fg: '#f59e0b' },
  analytics: { bg: 'rgba(99,102,241,0.12)', fg: '#818cf8' },
  operations: { bg: 'rgba(34,197,94,0.12)', fg: '#22c55e' },
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  const colors = CATEGORY_COLORS[category] ?? {
    bg: 'var(--io-surface-secondary)',
    fg: 'var(--io-text-muted)',
  }
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '1px 6px',
        borderRadius: '100px',
        background: colors.bg,
        color: colors.fg,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
      }}
    >
      {category}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ReportTemplateRow
// ---------------------------------------------------------------------------

function ReportTemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: ReportTemplate
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const formattedDate = new Date(template.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        borderBottom: '1px solid var(--io-border)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      {/* Name + description */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '2px',
          }}
        >
          {template.name}
        </div>
        {template.description && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--io-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {template.description}
          </div>
        )}
      </div>

      {/* Category badge */}
      <CategoryBadge category={template.category} />

      {/* Date */}
      <span style={{ fontSize: '12px', color: 'var(--io-text-muted)', whiteSpace: 'nowrap' }}>
        {formattedDate}
      </span>

      {/* Actions menu */}
      <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            padding: '4px 8px',
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
                  action: () => { onEdit(template.id); setMenuOpen(false) },
                  danger: false,
                  disabled: template.is_system_template,
                },
                {
                  label: 'Delete',
                  action: () => { onDelete(template.id); setMenuOpen(false) },
                  danger: true,
                  disabled: template.is_system_template,
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
                    display: 'block',
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
  )
}

// ---------------------------------------------------------------------------
// DesignerReportsList
// ---------------------------------------------------------------------------

const CATEGORIES = ['All', 'executive', 'compliance', 'maintenance', 'analytics', 'operations']

export default function DesignerReportsList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const query = useQuery({
    queryKey: ['report-templates'],
    queryFn: async () => {
      const r = await reportsApi.listTemplates({ limit: 200 })
      if (!r.success) throw new Error(r.error.message)
      return r.data.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await reportsApi.deleteTemplate(id)
      if (!r.success) throw new Error(r.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['report-templates'] })
    },
  })

  const templates = query.data ?? []
  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory
    return matchesSearch && matchesCategory
  })

  // Separate system vs custom
  const systemTemplates = filtered.filter((t) => t.is_system_template)
  const customTemplates = filtered.filter((t) => !t.is_system_template)

  function handleDelete(id: string) {
    if (window.confirm('Delete this report template? This cannot be undone.')) {
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
          Report Templates
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/designer/reports/new')}
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
          + New Template
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '10px 20px 0',
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Search templates..."
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
        <div style={{ display: 'flex', gap: 0 }}>
          {CATEGORIES.map((cat) => {
            const isActive = cat === activeCategory
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '0 16px',
                  height: '36px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--io-accent)' : '2px solid transparent',
                  color: isActive ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {query.isLoading && (
          <div style={{ padding: '20px', color: 'var(--io-text-muted)', fontSize: '13px' }}>
            Loading templates...
          </div>
        )}

        {query.isError && (
          <div
            style={{
              margin: '20px',
              padding: '20px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger, #ef4444)',
              fontSize: '13px',
            }}
          >
            Failed to load report templates.
          </div>
        )}

        {!query.isLoading && !query.isError && (
          <>
            {/* Custom templates section */}
            {customTemplates.length > 0 && (
              <div style={{ borderBottom: '1px solid var(--io-border)' }}>
                <div
                  style={{
                    padding: '10px 16px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--io-text-muted)',
                  }}
                >
                  Custom Templates ({customTemplates.length})
                </div>
                {customTemplates.map((t) => (
                  <ReportTemplateRow
                    key={t.id}
                    template={t}
                    onEdit={(id) => navigate(`/designer/reports/${id}/edit`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* System templates section */}
            {systemTemplates.length > 0 && (
              <div>
                <div
                  style={{
                    padding: '10px 16px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--io-text-muted)',
                  }}
                >
                  System Templates ({systemTemplates.length}) — read-only
                </div>
                {systemTemplates.map((t) => (
                  <ReportTemplateRow
                    key={t.id}
                    template={t}
                    onEdit={(id) => navigate(`/designer/reports/${id}/edit`)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {filtered.length === 0 && (
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
                <span style={{ fontSize: '48px', opacity: 0.3 }}>📄</span>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
                  {search || activeCategory !== 'All' ? 'No templates match your filters' : 'No custom templates yet'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
