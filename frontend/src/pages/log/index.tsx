import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { logsApi, type LogInstance, type LogTemplate, type SearchResult } from '../../api/logs'
import { useAuthStore } from '../../store/auth'
import { ExportButton } from '../../shared/components/ExportDialog'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: LogInstance['status'] }) {
  const colors: Record<LogInstance['status'], { bg: string; text: string }> = {
    draft: {
      bg: 'rgba(251,191,36,0.15)',
      text: '#fbbf24',
    },
    in_progress: {
      bg: 'var(--io-accent-subtle, rgba(74,158,255,0.15))',
      text: 'var(--io-accent, #4A9EFF)',
    },
    submitted: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    reviewed: { bg: 'rgba(74,158,255,0.12)', text: 'var(--io-accent)' },
  }
  const labels: Record<LogInstance['status'], string> = {
    draft: 'Draft',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    reviewed: 'Reviewed',
  }
  const c = colors[status]
  const label = labels[status] ?? status
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
      }}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Instance card
// ---------------------------------------------------------------------------

function InstanceCard({ instance, onClick }: { instance: LogInstance; onClick: () => void }) {
  const date = new Date(instance.created_at).toLocaleDateString()
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-accent)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--io-border)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '4px' }}>
            {instance.template_name ?? 'Log Entry'} — {date}
          </div>
          {instance.team_name && (
            <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
              Team: {instance.team_name}
            </div>
          )}
        </div>
        <StatusBadge status={instance.status} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates list
// ---------------------------------------------------------------------------

function TemplatesList({
  templates,
  onNewTemplate,
  onEdit,
  onDelete,
}: {
  templates: LogTemplate[]
  onNewTemplate: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={onNewTemplate}
          style={{
            background: 'var(--io-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          New Template
        </button>
      </div>
      {templates.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: 'var(--io-text-muted)',
          }}
        >
          No templates yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((t) => (
            <div
              key={t.id}
              style={{
                background: 'var(--io-surface)',
                border: '1px solid var(--io-border)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--io-text-primary)' }}>{t.name}</span>
                <span
                  style={{
                    marginLeft: '12px',
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                  }}
                >
                  {t.segment_ids.length} segment{t.segment_ids.length !== 1 ? 's' : ''}
                </span>
                {!t.is_active && (
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--io-surface-secondary)',
                      color: 'var(--io-text-muted)',
                    }}
                  >
                    Inactive
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onEdit(t.id)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--io-border)',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--io-text-secondary)',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--io-border)',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#f87171',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------

function SearchResults({ results }: { results: SearchResult[] }) {
  return (
    <div
      style={{
        marginTop: '16px',
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--io-border)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--io-text-secondary)',
        }}
      >
        {results.length} result{results.length !== 1 ? 's' : ''}
      </div>
      {results.length === 0 ? (
        <div
          style={{ padding: '24px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px' }}
        >
          No matching log entries found.
        </div>
      ) : (
        results.map((r) => (
          <div
            key={r.id}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--io-border)',
              fontSize: '13px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--io-text-primary)' }}>
                {r.template_name ?? 'Log Entry'}
              </span>
              {r.instance_status && (
                <StatusBadge status={r.instance_status as LogInstance['status']} />
              )}
              <span style={{ color: 'var(--io-text-muted)', marginLeft: 'auto' }}>
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <div
              style={{
                color: 'var(--io-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '700px',
              }}
            >
              {typeof r.content === 'object' ? JSON.stringify(r.content).slice(0, 200) : String(r.content)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completed instances table
// ---------------------------------------------------------------------------

const LOG_EXPORT_COLUMNS = [
  { id: 'template', label: 'Template' },
  { id: 'date', label: 'Date' },
  { id: 'team', label: 'Team' },
  { id: 'completed_at', label: 'Completed At' },
  { id: 'status', label: 'Status' },
]

function CompletedTable({ instances, hasExport }: { instances: LogInstance[]; hasExport: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      style={{
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Export toolbar */}
      {hasExport && instances.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '10px 16px',
            borderBottom: '1px solid var(--io-border)',
          }}
        >
          <ExportButton
            module="log"
            entity="Log Entries"
            filteredRowCount={instances.length}
            totalRowCount={instances.length}
            availableColumns={LOG_EXPORT_COLUMNS}
            visibleColumns={LOG_EXPORT_COLUMNS.map((c) => c.id)}
          />
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
            {['Template', 'Date', 'Team', 'Completed At', 'Actions'].map((h) => (
              <th
                key={h}
                style={{
                  padding: '10px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--io-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {instances.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--io-text-muted)',
                }}
              >
                No completed logs yet.
              </td>
            </tr>
          ) : (
            instances.map((inst) => (
              <tr
                key={inst.id}
                style={{ borderBottom: '1px solid var(--io-border)' }}
              >
                <td style={{ padding: '10px 16px', color: 'var(--io-text-primary)', fontWeight: 500 }}>
                  {inst.template_name ?? '—'}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--io-text-secondary)' }}>
                  {new Date(inst.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--io-text-secondary)' }}>
                  {inst.team_name ?? '—'}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--io-text-secondary)' }}>
                  {inst.completed_at ? new Date(inst.completed_at).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <button
                    onClick={() => navigate(`/log/${inst.id}`)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--io-border)',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--io-text-secondary)',
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = 'active' | 'completed' | 'templates'

export default function LogPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.permissions.includes('log:admin') || user?.permissions.includes('*')
  const hasExport = user?.permissions.includes('log:export') || user?.permissions.includes('*') || false

  const [tab, setTab] = useState<Tab>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSubmitted, setSearchSubmitted] = useState(false)

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['log-instances', 'active'],
    queryFn: async () => {
      const res = await logsApi.listInstances({ status: 'draft' })
      const res2 = await logsApi.listInstances({ status: 'in_progress' })
      if (!res.success) throw new Error(res.error.message)
      if (!res2.success) throw new Error(res2.error.message)
      return [...res.data, ...res2.data]
    },
    enabled: tab === 'active',
  })

  const { data: completedData, isLoading: completedLoading } = useQuery({
    queryKey: ['log-instances', 'completed'],
    queryFn: async () => {
      const res = await logsApi.listInstances({ status: 'submitted' })
      const res2 = await logsApi.listInstances({ status: 'reviewed' })
      if (!res.success) throw new Error(res.error.message)
      if (!res2.success) throw new Error(res2.error.message)
      return [...res.data, ...res2.data]
    },
    enabled: tab === 'completed',
  })

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['log-templates'],
    queryFn: async () => {
      const res = await logsApi.listTemplates()
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    enabled: tab === 'templates',
  })

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['log-search', searchQuery],
    queryFn: async () => {
      const res = await logsApi.search({ q: searchQuery })
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    enabled: searchSubmitted && searchQuery.trim().length > 0,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => logsApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-templates'] })
    },
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) setSearchSubmitted(true)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: 'Active Logs' },
    { key: 'completed', label: 'Completed' },
    ...(isAdmin ? [{ key: 'templates' as Tab, label: 'Templates' }] : []),
  ]

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px 0',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
            }}
          >
            Log
          </h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (!e.target.value.trim()) setSearchSubmitted(false)
                }}
                placeholder="Search log entries..."
                style={{
                  background: 'var(--io-bg)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  fontSize: '14px',
                  color: 'var(--io-text-primary)',
                  width: '240px',
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--io-surface-secondary)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--io-text-secondary)',
                }}
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--io-accent)' : '2px solid transparent',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {/* Search results overlay */}
        {searchSubmitted && searchQuery.trim() && (
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--io-text-secondary)' }}>
                Search results for "{searchQuery}"
              </span>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSearchSubmitted(false)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--io-text-muted)',
                  fontSize: '13px',
                }}
              >
                Clear
              </button>
            </div>
            {searchLoading ? (
              <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Searching...</div>
            ) : (
              <SearchResults results={searchData ?? []} />
            )}
          </div>
        )}

        {/* Active logs tab */}
        {tab === 'active' && !searchSubmitted && (
          <>
            {activeLoading ? (
              <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading...</div>
            ) : !activeData || activeData.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '64px 0',
                  color: 'var(--io-text-muted)',
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
                  No active logs
                </div>
                <div style={{ fontSize: '14px' }}>
                  Active log instances will appear here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeData.map((inst) => (
                  <InstanceCard
                    key={inst.id}
                    instance={inst}
                    onClick={() => navigate(`/log/${inst.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Completed tab */}
        {tab === 'completed' && !searchSubmitted && (
          <>
            {completedLoading ? (
              <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading...</div>
            ) : (
              <CompletedTable instances={completedData ?? []} hasExport={hasExport} />
            )}
          </>
        )}

        {/* Templates tab */}
        {tab === 'templates' && !searchSubmitted && (
          <>
            {templatesLoading ? (
              <div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading...</div>
            ) : (
              <TemplatesList
                templates={templatesData ?? []}
                onNewTemplate={() => navigate('/log/templates/new/edit')}
                onEdit={(id) => navigate(`/log/templates/${id}/edit`)}
                onDelete={(id) => {
                  if (confirm('Delete this template?')) {
                    deleteMutation.mutate(id)
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
