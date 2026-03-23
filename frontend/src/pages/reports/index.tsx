import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { reportsApi, type ReportTemplate } from '../../api/reports'
import ReportConfigPanel from './ReportConfigPanel'
import ReportHistory from './ReportHistory'
import ReportSchedules from './ReportSchedules'

// ---------------------------------------------------------------------------
// Category filter options
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'All',
  'Alarm Management',
  'Process Data',
  'Operational Logs',
  'Rounds & Inspections',
  'Equipment & Maintenance',
  'Environmental & Compliance',
  'Security & Access',
  'Executive & Management',
  'Shift Operations',
]

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: ReportTemplate
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--io-accent-subtle)' : 'var(--io-surface-elevated)',
        border: `1px solid ${selected ? 'var(--io-accent)' : 'var(--io-border)'}`,
        borderRadius: 'var(--io-radius)',
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-accent)'
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-border)'
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            lineHeight: 1.3,
          }}
        >
          {template.name}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {template.is_system_template && (
            <span
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: '100px',
                fontSize: '10px',
                fontWeight: 700,
                background: 'var(--io-accent-subtle)',
                color: 'var(--io-accent)',
                letterSpacing: '0.03em',
              }}
            >
              System
            </span>
          )}
        </div>
      </div>

      {template.category && (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 7px',
            borderRadius: '100px',
            fontSize: '10px',
            fontWeight: 600,
            background: 'var(--io-surface-secondary)',
            color: 'var(--io-text-muted)',
            marginBottom: '6px',
          }}
        >
          {template.category}
        </span>
      )}

      {template.description && (
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
          {template.description}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          height: 14,
          borderRadius: 4,
          background: 'var(--io-surface-secondary)',
          width: '65%',
          marginBottom: '8px',
          animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 10,
          borderRadius: 4,
          background: 'var(--io-surface-secondary)',
          width: '40%',
          marginBottom: '8px',
          animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 10,
          borderRadius: 4,
          background: 'var(--io-surface-secondary)',
          width: '85%',
          animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Browser
// ---------------------------------------------------------------------------

function TemplateBrowser({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (template: ReportTemplate) => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const query = useQuery({
    queryKey: ['report-templates', search, category],
    queryFn: async () => {
      const result = await reportsApi.listTemplates({
        q: search || undefined,
        category: category === 'All' ? undefined : category,
        limit: 100,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data
    },
  })

  const templates = query.data ?? []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
      }}
    >
      {/* Search */}
      <div style={{ padding: '12px 12px 0', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
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

      {/* Category tabs */}
      <div
        style={{
          padding: '10px 12px',
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          flexShrink: 0,
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '4px 10px',
              borderRadius: '100px',
              border: 'none',
              fontSize: '11px',
              fontWeight: category === cat ? 600 : 400,
              cursor: 'pointer',
              background: category === cat ? 'var(--io-accent)' : 'var(--io-surface-elevated)',
              color: category === cat ? '#fff' : 'var(--io-text-secondary)',
              transition: 'background 0.1s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {query.isLoading &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {query.isError && (
          <div
            style={{
              padding: '16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-danger)',
              fontSize: '13px',
            }}
          >
            Failed to load templates.
          </div>
        )}

        {!query.isLoading && templates.length === 0 && !query.isError && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '180px',
              gap: '10px',
              color: 'var(--io-text-muted)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <svg
              width="40" height="40" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1" opacity={0.4}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
              {search || category !== 'All'
                ? 'No templates match your search'
                : 'No report templates available'}
            </div>
            <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
              {search || category !== 'All'
                ? 'Try clearing the search or selecting a different category.'
                : 'Report templates are seeded at startup. Contact your administrator if templates are missing.'}
            </div>
          </div>
        )}

        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={t.id === selectedId}
            onClick={() => onSelect(t)}
          />
        ))}
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

// ---------------------------------------------------------------------------
// Tab bar for Templates / History / Schedules
// ---------------------------------------------------------------------------

function TabBar() {
  const location = useLocation()
  const tabs = [
    { label: 'Templates', to: '/reports' },
    { label: 'History', to: '/reports/history' },
    { label: 'Schedules', to: '/reports/schedules' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid var(--io-border)',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.to === '/reports'
            ? location.pathname === '/reports' || location.pathname === '/reports/'
            : location.pathname.startsWith(tab.to)
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/reports'}
            style={{
              padding: '0 20px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--io-accent)' : 'var(--io-text-secondary)',
              borderBottom: isActive ? '2px solid var(--io-accent)' : '2px solid transparent',
              transition: 'color 0.1s',
            }}
          >
            {tab.label}
          </NavLink>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates tab — browser + config panel
// ---------------------------------------------------------------------------

function TemplatesTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      {/* Template browser — left column */}
      <div
        style={{
          width: '340px',
          minWidth: '280px',
          borderRight: '1px solid var(--io-border)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <TemplateBrowser
          selectedId={selectedTemplate?.id ?? null}
          onSelect={(t) => setSelectedTemplate(t)}
        />
      </div>

      {/* Config panel — right side */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {selectedTemplate ? (
          <ReportConfigPanel
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
              color: 'var(--io-text-muted)',
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity={0.4}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div style={{ textAlign: 'center', fontSize: '13px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
                Select a report template
              </p>
              <p style={{ margin: 0, fontSize: '12px' }}>
                Choose a template from the left to configure and generate a report.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ReportsPage
// ---------------------------------------------------------------------------

export default function ReportsPage() {
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
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
          }}
        >
          Reports
        </span>
      </div>

      {/* Tab bar */}
      <div style={{ paddingLeft: '20px', background: 'var(--io-surface)', flexShrink: 0 }}>
        <TabBar />
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route index element={<TemplatesTab />} />
          <Route path="history" element={<ReportHistory />} />
          <Route path="schedules" element={<ReportSchedules />} />
          <Route path="*" element={<Navigate to="/reports" replace />} />
        </Routes>
      </div>
    </div>
  )
}
