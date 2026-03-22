import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { forensicsApi, type AlarmEvent } from '../../api/forensics'
import DataTable, { type ColumnDef } from '../../shared/components/DataTable'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AggregationInterval = 'raw' | '1m' | '5m' | '15m' | '30m'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number | undefined): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
  return `${(seconds / 3600).toFixed(2)}h`
}

// ---------------------------------------------------------------------------
// AlarmSearch
// ---------------------------------------------------------------------------

export default function AlarmSearch() {
  const navigate = useNavigate()

  const [pointId, setPointId] = useState('')
  const [aggregationInterval, setAggregationInterval] = useState<AggregationInterval>('raw')
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmEvent | null>(null)
  const [creatingFor, setCreatingFor] = useState<AlarmEvent | null>(null)

  const searchMutation = useMutation({
    mutationFn: async () => {
      if (!pointId.trim()) {
        throw new Error('A Point ID is required.')
      }
      const result = await forensicsApi.alarmSearch({
        point_id: pointId.trim(),
        aggregation_interval: aggregationInterval,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      setSelectedAlarm(null)
    },
  })

  const createInvestigationMutation = useMutation({
    mutationFn: async (alarm: AlarmEvent) => {
      const name = `Alarm: ${alarm.message} on ${pointId} — ${new Date(alarm.occurred_at).toLocaleDateString()}`
      const result = await forensicsApi.createInvestigation({
        name,
        anchor_point_id: pointId.trim(),
        anchor_alarm_id: alarm.id,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: (data) => {
      setCreatingFor(null)
      navigate(`/forensics/${data.id}`)
    },
  })

  const alarms = searchMutation.data ?? []

  const columns: ColumnDef<AlarmEvent>[] = [
    {
      id: 'occurred_at',
      header: 'Time',
      accessorKey: 'occurred_at',
      sortable: true,
      cell: (val) => new Date(val as string).toLocaleString(),
    },
    {
      id: 'duration_seconds',
      header: 'Duration',
      accessorKey: 'duration_seconds',
      sortable: true,
      cell: (val) => formatDuration(val as number | undefined),
      width: 90,
    },
    {
      id: 'severity',
      header: 'Severity',
      accessorKey: 'severity',
      sortable: true,
      width: 100,
      cell: (val) => {
        const sev = val as string
        const color =
          sev === 'critical'
            ? '#ef4444'
            : sev === 'high'
              ? '#f97316'
              : sev === 'medium'
                ? '#eab308'
                : 'var(--io-text-muted)'
        return (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color,
            }}
          >
            {sev}
          </span>
        )
      },
    },
    {
      id: 'message',
      header: 'Message',
      accessorKey: 'message',
      sortable: false,
    },
  ]

  const intervalOptions: { value: AggregationInterval; label: string }[] = [
    { value: 'raw', label: 'Raw' },
    { value: '1m', label: '1 min' },
    { value: '5m', label: '5 min' },
    { value: '15m', label: '15 min' },
    { value: '30m', label: '30 min' },
  ]

  const inputStyle = {
    padding: '7px 10px',
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text-primary)',
    fontSize: '13px',
    outline: 'none',
  } as React.CSSProperties

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  }

  const canSearch = pointId.trim().length > 0

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search controls */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'flex-end',
        }}
      >
        {/* Point selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: '1 1 200px' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            Point
          </label>
          <input
            type="text"
            placeholder="Point ID or tag"
            value={pointId}
            onChange={(e) => setPointId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSearch) searchMutation.mutate()
            }}
            style={inputStyle}
          />
        </div>

        {/* Aggregation interval */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            Interval
          </label>
          <select
            value={aggregationInterval}
            onChange={(e) => setAggregationInterval(e.target.value as AggregationInterval)}
            style={{ ...selectStyle, minWidth: '90px' }}
          >
            {intervalOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={() => searchMutation.mutate()}
          disabled={searchMutation.isPending || !canSearch}
          style={{
            padding: '7px 18px',
            background: canSearch ? 'var(--io-accent)' : 'var(--io-surface)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: canSearch ? '#fff' : 'var(--io-text-muted)',
            cursor: canSearch ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 600,
            alignSelf: 'flex-end',
          }}
        >
          {searchMutation.isPending ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error */}
      {searchMutation.isError && (
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(239,68,68,0.08)',
            borderBottom: '1px solid var(--io-border)',
            fontSize: '13px',
            color: 'var(--io-danger, #ef4444)',
            flexShrink: 0,
          }}
        >
          {(searchMutation.error as Error).message}
        </div>
      )}

      {/* Results area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {/* Not searched yet */}
        {!searchMutation.isSuccess && !searchMutation.isPending && !searchMutation.isError && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              height: '100%',
              color: 'var(--io-text-muted)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '36px', opacity: 0.2 }}>🔔</span>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--io-text-secondary)' }}>
              Enter a point ID and click Search to see historical alarms.
            </p>
          </div>
        )}

        {/* Loading */}
        {searchMutation.isPending && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              color: 'var(--io-text-muted)',
              fontSize: '13px',
            }}
          >
            Searching...
          </div>
        )}

        {/* Results */}
        {searchMutation.isSuccess && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alarms.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                Found{' '}
                <strong style={{ color: 'var(--io-text-primary)' }}>{alarms.length}</strong>{' '}
                alarm event{alarms.length !== 1 ? 's' : ''} for point{' '}
                <strong style={{ color: 'var(--io-text-primary)' }}>{pointId}</strong>
                {aggregationInterval !== 'raw' && (
                  <> (aggregated at {aggregationInterval} intervals)</>
                )}
                . Select one to start an investigation.
              </div>
            )}

            <DataTable
              data={alarms}
              columns={columns}
              height={Math.min(400, Math.max(200, alarms.length * 36 + 40))}
              loading={searchMutation.isPending}
              emptyMessage="No alarm events found for this point"
              onRowClick={(row) => setSelectedAlarm(row)}
            />

            {/* Selected alarm action */}
            {selectedAlarm && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--io-surface)',
                  border: '1px solid var(--io-accent)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: 'var(--io-text-muted)' }}>Selected: </span>
                  <span style={{ color: 'var(--io-text-primary)', fontWeight: 600 }}>
                    {new Date(selectedAlarm.occurred_at).toLocaleString()} —{' '}
                    {selectedAlarm.severity} — {selectedAlarm.message}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedAlarm(null)}
                    style={{
                      padding: '5px 10px',
                      background: 'none',
                      border: '1px solid var(--io-border)',
                      borderRadius: 'var(--io-radius)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--io-text-muted)',
                    }}
                  >
                    Deselect
                  </button>
                  <button
                    onClick={() => {
                      setCreatingFor(selectedAlarm)
                      createInvestigationMutation.mutate(selectedAlarm)
                    }}
                    disabled={createInvestigationMutation.isPending}
                    style={{
                      padding: '5px 12px',
                      background: 'var(--io-accent)',
                      border: 'none',
                      borderRadius: 'var(--io-radius)',
                      cursor: createInvestigationMutation.isPending ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                    }}
                  >
                    {creatingFor === selectedAlarm && createInvestigationMutation.isPending
                      ? 'Creating...'
                      : 'Start Investigation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
