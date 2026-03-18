import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../../api/reports'

export default function ReportTemplates() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'templates', page, search, category],
    queryFn: () =>
      reportsApi.listTemplates({
        page,
        limit: 20,
        q: search || undefined,
        category: category || undefined,
      }),
  })

  const result = data?.success ? data.data : null
  const templates = result?.data ?? []

  // Collect unique categories for filter dropdown
  const categories = Array.from(new Set(templates.map((t: typeof templates[0]) => t.category).filter(Boolean) as string[]))

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--io-surface-secondary)',
    border: '1px solid var(--io-border)',
    borderRadius: '6px',
    color: 'var(--io-text-primary)',
    fontSize: '13px',
  }

  return (
    <div style={{ padding: 'var(--io-space-6)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
            Report Templates
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
            38 canned report templates — select one to generate a report.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search templates…"
          style={{ ...inputStyle, width: '240px' }}
        />
        {categories.length > 0 && (
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} style={inputStyle}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <span style={{ fontSize: '13px', color: 'var(--io-text-muted)', lineHeight: '36px' }}>
          {isLoading ? 'Loading…' : `${result?.pagination.total ?? 0} templates`}
        </span>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading…</div>
      ) : templates.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px', background: 'var(--io-surface)', borderRadius: '8px', border: '1px solid var(--io-border)' }}>
          No templates found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/reports/generate?template=${t.id}`)}
              style={{ padding: '16px', background: 'var(--io-surface)', border: '1px solid var(--io-border)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--io-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--io-border)')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)', lineHeight: 1.3 }}>{t.name}</span>
                {t.is_system_template && (
                  <span style={{ flexShrink: 0, fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--io-surface-secondary)', color: 'var(--io-text-muted)', fontWeight: 600 }}>
                    SYSTEM
                  </span>
                )}
              </div>
              {t.category && (
                <span style={{ display: 'inline-block', fontSize: '11px', padding: '1px 7px', borderRadius: '100px', background: 'rgba(74,158,255,0.12)', color: 'var(--io-accent)', fontWeight: 600, marginBottom: '8px' }}>
                  {t.category}
                </span>
              )}
              {t.description && (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--io-text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {t.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {result && result.pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--io-border)', borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer', color: 'var(--io-text-secondary)', opacity: page === 1 ? 0.4 : 1, fontSize: '13px' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>Page {page} of {result.pagination.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(result.pagination.pages, p + 1))}
            disabled={page === result.pagination.pages}
            style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--io-border)', borderRadius: '6px', cursor: page === result.pagination.pages ? 'not-allowed' : 'pointer', color: 'var(--io-text-secondary)', opacity: page === result.pagination.pages ? 0.4 : 1, fontSize: '13px' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
