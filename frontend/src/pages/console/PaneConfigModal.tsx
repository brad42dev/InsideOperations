import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '../../api/points'
import type { PaneConfig, PaneType } from './types'

interface PaneConfigModalProps {
  pane: PaneConfig
  onSave: (updated: PaneConfig) => void
  onClose: () => void
}

const PANE_TYPES: { value: PaneType; label: string; description: string }[] = [
  { value: 'trend', label: 'Trend', description: 'Real-time trend chart' },
  { value: 'point_table', label: 'Point Table', description: 'Live point value table' },
  { value: 'alarm_list', label: 'Alarm List', description: 'Active alarm list' },
  { value: 'blank', label: 'Blank', description: 'Empty pane' },
]

// ---------------------------------------------------------------------------
// Point search section
// ---------------------------------------------------------------------------

function PointSearch({
  selected,
  onChange,
  maxSelect,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  maxSelect?: number
}) {
  const [query, setQuery] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['points-search', query],
    queryFn: async () => {
      const result = await pointsApi.list({ search: query || undefined, limit: 50 })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data
    },
    staleTime: 15_000,
  })

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
    } else {
      if (maxSelect && selected.length >= maxSelect) return
      onChange([...selected, id])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="text"
        placeholder="Search points by name or tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: 6,
          padding: '7px 10px',
          fontSize: 13,
          color: 'var(--io-text-primary)',
          outline: 'none',
        }}
      />

      {maxSelect && (
        <div style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>
          {selected.length} / {maxSelect} selected
        </div>
      )}

      {isFetching && (
        <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>Searching…</div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {data?.map((pt) => {
          const isSelected = selected.includes(pt.id)
          const isDisabled = !isSelected && maxSelect != null && selected.length >= maxSelect
          return (
            <label
              key={pt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                background: isSelected
                  ? 'var(--io-accent-subtle, rgba(74,158,255,0.1))'
                  : 'var(--io-surface-secondary)',
                border: `1px solid ${isSelected ? 'var(--io-accent)' : 'var(--io-border)'}`,
                borderRadius: 6,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => toggle(pt.id)}
                style={{ accentColor: 'var(--io-accent)' }}
              />
              <span style={{ flex: 1, overflow: 'hidden' }}>
                <span style={{ fontWeight: 500, color: 'var(--io-text-primary)' }}>
                  {pt.display_name ?? pt.tagname}
                </span>
                <span
                  style={{
                    color: 'var(--io-text-muted)',
                    marginLeft: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  {pt.tagname}
                </span>
              </span>
              {pt.unit && (
                <span style={{ color: 'var(--io-text-muted)', fontSize: 11 }}>{pt.unit}</span>
              )}
            </label>
          )
        })}
        {data?.length === 0 && !isFetching && (
          <div style={{ fontSize: 12, color: 'var(--io-text-muted)', textAlign: 'center', padding: 12 }}>
            No points found
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PaneConfigModal
// ---------------------------------------------------------------------------

export default function PaneConfigModal({ pane, onSave, onClose }: PaneConfigModalProps) {
  const [type, setType] = useState<PaneType>(pane.type)
  const [title, setTitle] = useState(pane.title ?? '')
  const [trendPointIds, setTrendPointIds] = useState<string[]>(pane.trendPointIds ?? [])
  const [trendDuration, setTrendDuration] = useState(pane.trendDuration ?? 60)
  const [tablePointIds, setTablePointIds] = useState<string[]>(pane.tablePointIds ?? [])
  const [alarmFilter, setAlarmFilter] = useState<'all' | 'active' | 'unacknowledged'>(
    pane.alarmFilter ?? 'all',
  )

  const handleSave = () => {
    const updated: PaneConfig = {
      id: pane.id,
      type,
      title: title.trim() || undefined,
      trendPointIds: type === 'trend' ? trendPointIds : undefined,
      trendDuration: type === 'trend' ? trendDuration : undefined,
      tablePointIds: type === 'point_table' ? tablePointIds : undefined,
      alarmFilter: type === 'alarm_list' ? alarmFilter : undefined,
    }
    onSave(updated)
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1001,
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 8,
            padding: 24,
            width: 480,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <Dialog.Title
            style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--io-text-primary)' }}
          >
            Configure Pane
          </Dialog.Title>

          {/* Type selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pane Type
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PANE_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setType(pt.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: `1px solid ${type === pt.value ? 'var(--io-accent)' : 'var(--io-border)'}`,
                    background:
                      type === pt.value
                        ? 'var(--io-accent-subtle, rgba(74,158,255,0.1))'
                        : 'var(--io-surface-secondary)',
                    color:
                      type === pt.value ? 'var(--io-accent)' : 'var(--io-text-primary)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: type === pt.value ? 600 : 400,
                  }}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g. ${PANE_TYPES.find((p) => p.value === type)?.label ?? type}`}
              style={{
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 13,
                color: 'var(--io-text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Type-specific config */}

          {type === 'trend' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Points (max 8)
                </label>
                <PointSearch selected={trendPointIds} onChange={setTrendPointIds} maxSelect={8} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Duration (minutes)
                </label>
                <select
                  value={trendDuration}
                  onChange={(e) => setTrendDuration(Number(e.target.value))}
                  style={{
                    background: 'var(--io-surface-secondary)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 6,
                    padding: '7px 10px',
                    fontSize: 13,
                    color: 'var(--io-text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>8 hours</option>
                </select>
              </div>
            </div>
          )}

          {type === 'point_table' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Points
              </label>
              <PointSearch selected={tablePointIds} onChange={setTablePointIds} />
            </div>
          )}

          {type === 'alarm_list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Filter
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['all', 'active', 'unacknowledged'] as const).map((f) => (
                  <label
                    key={f}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}
                  >
                    <input
                      type="radio"
                      name="alarm-filter"
                      value={f}
                      checked={alarmFilter === f}
                      onChange={() => setAlarmFilter(f)}
                      style={{ accentColor: 'var(--io-accent)' }}
                    />
                    <span style={{ color: 'var(--io-text-primary)', textTransform: 'capitalize' }}>
                      {f === 'unacknowledged' ? 'Unacknowledged' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 6,
                  padding: '7px 16px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--io-text-primary)',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--io-accent)',
                border: 'none',
                borderRadius: 6,
                padding: '7px 16px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
