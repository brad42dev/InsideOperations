import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { roundsApi, type RoundInstance, type RoundHistoryEntry } from '../../api/rounds'
import DataTable, { type ColumnDef } from '../../shared/components/DataTable'
import { useOfflineRounds } from '../../shared/hooks/useOfflineRounds'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function fmtDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt || !completedAt) return '—'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

type InstanceStatus = RoundInstance['status']

function StatusBadge({ status }: { status: InstanceStatus }) {
  const colorMap: Record<InstanceStatus, { bg: string; text: string }> = {
    pending: { bg: 'rgba(251,191,36,0.15)', text: '#f59e0b' },
    in_progress: { bg: 'var(--io-accent-subtle, rgba(74,158,255,0.15))', text: 'var(--io-accent, #4A9EFF)' },
    completed: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    missed: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
    transferred: { bg: 'var(--io-surface-secondary)', text: 'var(--io-text-muted)' },
  }
  const c = colorMap[status] ?? { bg: 'var(--io-surface-secondary)', text: 'var(--io-text-muted)' }
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
      {status.replace('_', ' ')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Instance card (Available / In Progress tabs)
// ---------------------------------------------------------------------------

function InstanceCard({
  instance,
  onStart,
  onContinue,
  starting,
}: {
  instance: RoundInstance
  onStart?: (id: string) => void
  onContinue?: (id: string) => void
  starting?: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--io-surface)',
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--io-text-primary)',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {instance.template_name ?? 'Round'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', display: 'flex', gap: '12px' }}>
          <StatusBadge status={instance.status} />
          {instance.due_by && (
            <span>Due: {fmtDate(instance.due_by)}</span>
          )}
          {instance.started_at && (
            <span>Started: {fmtDate(instance.started_at)}</span>
          )}
        </div>
      </div>
      <div>
        {instance.status === 'pending' && onStart && (
          <button
            onClick={() => onStart(instance.id)}
            disabled={starting}
            style={{
              padding: '8px 20px',
              background: 'var(--io-accent, #4A9EFF)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: starting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              opacity: starting ? 0.7 : 1,
            }}
          >
            {starting ? 'Starting…' : 'Start Round'}
          </button>
        )}
        {instance.status === 'in_progress' && onContinue && (
          <button
            onClick={() => onContinue(instance.id)}
            style={{
              padding: '8px 20px',
              background: 'var(--io-accent, #4A9EFF)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab label
// ---------------------------------------------------------------------------

function Tab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid var(--io-accent, #4A9EFF)' : '2px solid transparent',
        color: active ? 'var(--io-accent, #4A9EFF)' : 'var(--io-text-secondary)',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// History columns
// ---------------------------------------------------------------------------

const historyColumns: ColumnDef<RoundHistoryEntry>[] = [
  { id: 'template_name', header: 'Template', accessorKey: 'template_name' },
  {
    id: 'completed_at',
    header: 'Completed',
    accessorKey: 'completed_at',
    cell: (v) => fmtDate(v as string),
  },
  {
    id: 'duration',
    header: 'Duration',
    cell: (_v, row) => fmtDuration(row.started_at, row.completed_at),
  },
  {
    id: 'out_of_range_count',
    header: 'Out of Range',
    accessorKey: 'out_of_range_count',
    cell: (v) => {
      const n = v as number
      return (
        <span style={{ color: n > 0 ? '#f59e0b' : 'var(--io-text-muted)', fontWeight: n > 0 ? 600 : 400 }}>
          {n}
        </span>
      )
    },
  },
  {
    id: 'response_count',
    header: 'Responses',
    accessorKey: 'response_count',
  },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type TabId = 'available' | 'in_progress' | 'history' | 'templates' | 'schedules'

export default function RoundsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabId>('available')
  const [startingId, setStartingId] = useState<string | null>(null)
  const { isOnline, pendingCount, hasSyncFailures } = useOfflineRounds()

  const { data: availableResult, isLoading: loadingAvailable } = useQuery({
    queryKey: ['rounds', 'instances', 'pending'],
    queryFn: () => roundsApi.listInstances({ status: 'pending' }),
    enabled: tab === 'available',
  })

  const { data: inProgressResult, isLoading: loadingInProgress } = useQuery({
    queryKey: ['rounds', 'instances', 'in_progress'],
    queryFn: () => roundsApi.listInstances({ status: 'in_progress' }),
    enabled: tab === 'in_progress',
  })

  const { data: historyResult, isLoading: loadingHistory } = useQuery({
    queryKey: ['rounds', 'history'],
    queryFn: () => roundsApi.getHistory(),
    enabled: tab === 'history',
  })

  const { data: templatesResult, isLoading: loadingTemplates } = useQuery({
    queryKey: ['rounds', 'templates'],
    queryFn: () => roundsApi.listTemplates(),
    enabled: tab === 'templates',
  })

  const { data: schedulesResult, isLoading: loadingSchedules } = useQuery({
    queryKey: ['rounds', 'schedules'],
    queryFn: () => roundsApi.listSchedules(),
    enabled: tab === 'schedules',
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => roundsApi.startInstance(id),
    onMutate: (id) => setStartingId(id),
    onSettled: () => setStartingId(null),
    onSuccess: (result, id) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['rounds', 'instances'] })
        navigate(`/rounds/${id}`)
      }
    },
  })

  const pendingInstances =
    availableResult?.success ? availableResult.data : []
  const inProgressInstances =
    inProgressResult?.success ? inProgressResult.data : []
  const historyEntries =
    historyResult?.success ? historyResult.data : []
  const templates =
    templatesResult?.success ? templatesResult.data : []
  const schedules =
    schedulesResult?.success ? schedulesResult.data : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 24px 0',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
              Rounds
            </h1>
            {/* Offline / pending sync indicator */}
            {!isOnline && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'rgba(251,191,36,0.15)',
                  color: '#b45309',
                  fontWeight: 700,
                  border: '1px solid rgba(251,191,36,0.4)',
                }}
              >
                Offline
              </span>
            )}
            {isOnline && pendingCount > 0 && !hasSyncFailures && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'rgba(34,197,94,0.12)',
                  color: '#166534',
                  fontWeight: 700,
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                {pendingCount} syncing
              </span>
            )}
            {hasSyncFailures && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#b91c1c',
                  fontWeight: 700,
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                Sync failed — tap for details
              </span>
            )}
          </div>
          {tab === 'templates' && (
            <button
              onClick={() => navigate('/rounds/templates/new/edit')}
              style={{
                padding: '8px 16px',
                background: 'var(--io-accent, #4A9EFF)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              + New Template
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
          <Tab label="Available" active={tab === 'available'} onClick={() => setTab('available')} />
          <Tab label="In Progress" active={tab === 'in_progress'} onClick={() => setTab('in_progress')} />
          <Tab label="History" active={tab === 'history'} onClick={() => setTab('history')} />
          <Tab label="Templates" active={tab === 'templates'} onClick={() => setTab('templates')} />
          <Tab label="Schedules" active={tab === 'schedules'} onClick={() => setTab('schedules')} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Available */}
        {tab === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loadingAvailable && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                Loading rounds…
              </div>
            )}
            {!loadingAvailable && pendingInstances.length === 0 && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                No pending rounds.
              </div>
            )}
            {pendingInstances.map((inst) => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                onStart={(id) => startMutation.mutate(id)}
                starting={startingId === inst.id}
              />
            ))}
          </div>
        )}

        {/* In Progress */}
        {tab === 'in_progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loadingInProgress && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                Loading rounds…
              </div>
            )}
            {!loadingInProgress && inProgressInstances.length === 0 && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                No rounds in progress.
              </div>
            )}
            {inProgressInstances.map((inst) => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                onContinue={(id) => navigate(`/rounds/${id}`)}
              />
            ))}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <DataTable
            data={historyEntries}
            columns={historyColumns}
            height={600}
            loading={loadingHistory}
            emptyMessage="No completed rounds."
            onRowClick={(row) => navigate(`/rounds/${row.id}`)}
          />
        )}

        {/* Templates */}
        {tab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingTemplates && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                Loading templates…
              </div>
            )}
            {!loadingTemplates && templates.length === 0 && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                No templates yet. Create one to get started.
              </div>
            )}
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                style={{
                  background: 'var(--io-surface)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)' }}>
                    {tmpl.name}
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 400 }}>
                      v{tmpl.version} · {Array.isArray(tmpl.checkpoints) ? tmpl.checkpoints.length : 0} checkpoints
                    </span>
                  </div>
                  {tmpl.description && (
                    <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', marginTop: '2px' }}>
                      {tmpl.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!tmpl.is_active && (
                    <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', padding: '2px 8px', background: 'var(--io-surface-secondary)', borderRadius: '100px' }}>
                      Inactive
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/rounds/templates/${tmpl.id}/edit`)}
                    style={{
                      padding: '6px 14px',
                      background: 'none',
                      border: '1px solid var(--io-border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--io-text-secondary)',
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Schedules */}
        {tab === 'schedules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingSchedules && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                Loading schedules…
              </div>
            )}
            {!loadingSchedules && schedules.length === 0 && (
              <div style={{ color: 'var(--io-text-muted)', padding: '40px', textAlign: 'center' }}>
                No schedules configured.
              </div>
            )}
            {schedules.map((sched) => (
              <div
                key={sched.id}
                style={{
                  background: 'var(--io-surface)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)' }}>
                    {sched.template_name ?? sched.template_id}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', marginTop: '2px' }}>
                    {sched.recurrence_type.replace('_', ' ')}
                    {sched.recurrence_config && Object.keys(sched.recurrence_config).length > 0 && (
                      <span style={{ marginLeft: '8px', color: 'var(--io-text-muted)' }}>
                        {JSON.stringify(sched.recurrence_config)}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    background: sched.is_active ? 'rgba(34,197,94,0.12)' : 'var(--io-surface-secondary)',
                    color: sched.is_active ? '#22c55e' : 'var(--io-text-muted)',
                    fontWeight: 700,
                  }}
                >
                  {sched.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
