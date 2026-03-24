import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, type ReportTemplate } from '../../api/reports'
import { dashboardsApi, type Dashboard } from '../../api/dashboards'
import { useDesignerPermissions } from '../../shared/hooks/usePermission'
import { RecognitionWizardTrigger } from './components/RecognitionWizard'

// ---------------------------------------------------------------------------
// Hub card
// ---------------------------------------------------------------------------

function HubCard({
  icon,
  title,
  count,
  description,
  browseHref,
  newHref,
  isLoading,
}: {
  icon: string
  title: string
  count: number
  description: string
  browseHref: string
  newHref: string
  isLoading: boolean
}) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '24px' }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            {title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', marginTop: '2px' }}>
            {description}
          </div>
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--io-accent)',
            minWidth: '40px',
            textAlign: 'right',
          }}
        >
          {isLoading ? '—' : count}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => navigate(browseHref)}
          style={{
            flex: 1,
            padding: '7px 0',
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Browse
        </button>
        <button
          onClick={() => navigate(newHref)}
          style={{
            flex: 1,
            padding: '7px 0',
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: '#09090b',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent item row
// ---------------------------------------------------------------------------

function RecentItem({
  icon,
  name,
  subtitle,
  href,
}: {
  icon: string
  name: string
  subtitle: string
  href: string
}) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(href)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: 'var(--io-radius)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
      }}
    >
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>{subtitle}</div>
      </div>
      <span style={{ fontSize: '11px', color: 'var(--io-accent)', fontWeight: 500 }}>Open</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DesignerHome
// ---------------------------------------------------------------------------

export default function DesignerHome() {
  const perms = useDesignerPermissions()
  const reportsQuery = useQuery({
    queryKey: ['report-templates', { is_system: false }],
    queryFn: async () => {
      const r = await reportsApi.listTemplates({ is_system: false, limit: 100 })
      if (!r.success) throw new Error(r.error.message)
      return r.data.data
    },
  })

  const dashboardsQuery = useQuery({
    queryKey: ['dashboards'],
    queryFn: async () => {
      const r = await dashboardsApi.list()
      if (!r.success) throw new Error(r.error.message)
      return r.data.data
    },
  })

  const reports: ReportTemplate[] = reportsQuery.data ?? []
  const dashboards: Dashboard[] = dashboardsQuery.data ?? []

  // Recent items: combine and sort by created_at desc, take top 8
  type RecentEntry = { type: 'dashboard' | 'report'; id: string; name: string; created_at: string }
  const recentItems: RecentEntry[] = [
    ...dashboards.map((d): RecentEntry => ({ type: 'dashboard', id: d.id, name: d.name, created_at: d.created_at })),
    ...reports.map((r): RecentEntry => ({ type: 'report', id: r.id, name: r.name, created_at: r.created_at })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  const typeIcon: Record<string, string> = {
    graphic: '🖼',
    dashboard: '▦',
    report: '📄',
  }

  const typeHref = (type: string, id: string) => {
    if (type === 'graphic') return `/designer/graphics/${id}`
    if (type === 'dashboard') return `/designer/dashboards/${id}/edit`
    return `/designer/reports/${id}/edit`
  }

  const typeLabel = (type: string) => {
    if (type === 'graphic') return 'Process Graphic'
    if (type === 'dashboard') return 'Dashboard'
    return 'Report Template'
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: 'var(--io-surface-primary)',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Page title */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
            }}
          >
            Designer
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            Create and manage process graphics, dashboards, and report templates.
          </p>
        </div>

        {/* Hub cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <HubCard
            icon="▦"
            title="Dashboards"
            count={dashboards.length}
            description="Widget-based dashboards with template variables"
            browseHref="/designer/dashboards"
            newHref="/designer/dashboards/new"
            isLoading={dashboardsQuery.isLoading}
          />
          <HubCard
            icon="📄"
            title="Report Templates"
            count={reports.length}
            description="Custom report layouts for scheduled and on-demand reports"
            browseHref="/designer/reports"
            newHref="/designer/reports/new"
            isLoading={reportsQuery.isLoading}
          />
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '32px',
          }}
        >
          {[
            { label: 'Symbol Library', href: '/designer/symbols', icon: '⬡' },
            { label: 'Import DCS Graphics', href: '/designer/import', icon: '⬆' },
          ].map((action) => {
            return (
              <QuickAction key={action.href} {...action} />
            )
          })}
          <RecognitionWizardTrigger canImport={perms.canImport} renderAs="button" />
        </div>

        {/* Recent items */}
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            Recently Modified
          </div>

          {recentItems.length === 0 && !dashboardsQuery.isLoading && !reportsQuery.isLoading && (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--io-text-muted)',
                fontSize: '13px',
                background: 'var(--io-surface-elevated)',
                borderRadius: 'var(--io-radius)',
                border: '1px solid var(--io-border)',
              }}
            >
              No items yet. Create your first graphic, dashboard, or report template.
            </div>
          )}

          {recentItems.length > 0 && (
            <div
              style={{
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                overflow: 'hidden',
                padding: '4px',
              }}
            >
              {recentItems.map((item) => (
                <RecentItem
                  key={`${item.type}-${item.id}`}
                  icon={typeIcon[item.type] ?? '📄'}
                  name={item.name}
                  subtitle={typeLabel(item.type)}
                  href={typeHref(item.type, item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuickAction({ label, href, icon }: { label: string; href: string; icon: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(href)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        color: 'var(--io-text-secondary)',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'border-color 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-accent)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-accent)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-border)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-text-secondary)'
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}
