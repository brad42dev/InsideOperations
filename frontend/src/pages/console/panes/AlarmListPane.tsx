import { useState } from 'react'
import type { PaneConfig } from '../types'

// TODO: Phase 9 — connect to event-service alarm feed

interface AlarmRow {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  tag: string
  message: string
  time: string
  state: 'active' | 'unacknowledged' | 'acknowledged'
}

const MOCK_ALARMS: AlarmRow[] = [
  {
    id: '1',
    priority: 'critical',
    tag: 'TIC-101',
    message: 'High temperature limit exceeded',
    time: '14:32:01',
    state: 'active',
  },
  {
    id: '2',
    priority: 'high',
    tag: 'PIC-204',
    message: 'Pressure deviation from setpoint',
    time: '14:28:45',
    state: 'unacknowledged',
  },
  {
    id: '3',
    priority: 'medium',
    tag: 'FIC-312',
    message: 'Flow below minimum threshold',
    time: '14:15:30',
    state: 'acknowledged',
  },
  {
    id: '4',
    priority: 'high',
    tag: 'LIC-103',
    message: 'Level transmitter fault',
    time: '13:58:12',
    state: 'active',
  },
  {
    id: '5',
    priority: 'low',
    tag: 'TE-405',
    message: 'Temperature sensor drift detected',
    time: '13:42:00',
    state: 'acknowledged',
  },
]

const PRIORITY_COLOR: Record<AlarmRow['priority'], string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#3B82F6',
}

const PRIORITY_LABEL: Record<AlarmRow['priority'], string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
}

function PriorityBadge({ priority }: { priority: AlarmRow['priority'] }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.05em',
        background: `${PRIORITY_COLOR[priority]}22`,
        color: PRIORITY_COLOR[priority],
        border: `1px solid ${PRIORITY_COLOR[priority]}44`,
      }}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  )
}

function StateBadge({ state }: { state: AlarmRow['state'] }) {
  const color =
    state === 'active'
      ? '#EF4444'
      : state === 'unacknowledged'
        ? '#F59E0B'
        : 'var(--io-text-muted)'

  return (
    <span style={{ fontSize: 12, color, fontWeight: state !== 'acknowledged' ? 600 : 400 }}>
      {state === 'active' ? 'Active' : state === 'unacknowledged' ? 'Unack' : 'Acked'}
    </span>
  )
}

type FilterOption = 'all' | 'active' | 'unacknowledged'

interface AlarmListPaneProps {
  config: PaneConfig
}

export default function AlarmListPane({ config }: AlarmListPaneProps) {
  const [filter, setFilter] = useState<FilterOption>(config.alarmFilter ?? 'all')

  const filtered = MOCK_ALARMS.filter((a) => {
    if (filter === 'all') return true
    if (filter === 'active') return a.state === 'active'
    if (filter === 'unacknowledged') return a.state === 'unacknowledged'
    return true
  })

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 10px',
          borderBottom: '1px solid var(--io-border)',
          alignItems: 'center',
        }}
      >
        {(['all', 'active', 'unacknowledged'] as FilterOption[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'var(--io-accent)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--io-text-muted)',
              border: `1px solid ${filter === f ? 'var(--io-accent)' : 'var(--io-border)'}`,
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {f === 'unacknowledged' ? 'Unacked' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--io-text-muted)',
            fontStyle: 'italic',
          }}
        >
          Mock data — Phase 9
        </span>
      </div>

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 90px 1fr 80px 90px',
          padding: '0 10px',
          height: 32,
          alignItems: 'center',
          background: 'var(--io-surface-secondary)',
          borderBottom: '1px solid var(--io-border)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}
      >
        <span>Priority</span>
        <span>Tag</span>
        <span>Message</span>
        <span>Time</span>
        <span>State</span>
      </div>

      {/* Table body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--io-text-muted)',
              fontSize: 13,
            }}
          >
            No alarms matching filter
          </div>
        )}
        {filtered.map((alarm) => (
          <div
            key={alarm.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 90px 1fr 80px 90px',
              padding: '0 10px',
              height: 38,
              alignItems: 'center',
              borderBottom: '1px solid var(--io-border)',
              fontSize: 12,
              color: 'var(--io-text-primary)',
            }}
          >
            <span>
              <PriorityBadge priority={alarm.priority} />
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{alarm.tag}</span>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: 8,
              }}
            >
              {alarm.message}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--io-text-muted)' }}>
              {alarm.time}
            </span>
            <span>
              <StateBadge state={alarm.state} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
