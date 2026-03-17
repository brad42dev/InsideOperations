/**
 * PointPicker — dual-mode point selector
 *
 * Provides two tabs:
 *   - Browse: expandable Area → Unit → Equipment → Point hierarchy
 *   - Search: type-ahead search (existing behaviour used throughout the app)
 *
 * Usage:
 *   <PointPicker
 *     selected={selectedIds}
 *     onChange={setSelectedIds}
 *     maxSelect={8}          // optional — omit for unlimited multi-select
 *     singleSelect           // optional — forces single-select mode (returns 1 id)
 *   />
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '../../api/points'
import { api } from '../../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PointEntry {
  id: string
  tag: string
  name: string
  unit?: string | null
  data_type?: string | null
}

interface EquipmentEntry {
  id: string
  name: string
  points: PointEntry[]
}

interface UnitEntry {
  id: string
  name: string
  equipment: EquipmentEntry[]
}

interface AreaEntry {
  id: string
  name: string
  units: UnitEntry[]
}

interface HierarchyResponse {
  areas: AreaEntry[]
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchHierarchy(): Promise<HierarchyResponse> {
  const result = await api.get<HierarchyResponse>('/api/v1/points/hierarchy')
  if (result.success) return result.data

  // Fallback: build a flat hierarchy from /api/points
  const flat = await pointsApi.list({ limit: 500 })
  if (!flat.success) return { areas: [] }

  // Group points under a single synthetic area
  const area: AreaEntry = {
    id: 'all',
    name: 'All Points',
    units: [
      {
        id: 'all-unit',
        name: 'All Units',
        equipment: [
          {
            id: 'all-equip',
            name: 'All Equipment',
            points: flat.data.data.map((p) => ({
              id: p.id,
              tag: p.tagname,
              name: p.display_name ?? p.tagname,
              unit: p.unit,
              data_type: p.data_type,
            })),
          },
        ],
      },
    ],
  }
  return { areas: [area] }
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: 'var(--io-text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

// ---------------------------------------------------------------------------
// PointRow — single selectable point
// ---------------------------------------------------------------------------

function PointRow({
  point,
  isSelected,
  isDisabled,
  onToggle,
  singleSelect,
}: {
  point: PointEntry
  isSelected: boolean
  isDisabled: boolean
  onToggle: (id: string) => void
  singleSelect?: boolean
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 10px',
        background: isSelected
          ? 'var(--io-accent-subtle, rgba(74,158,255,0.1))'
          : 'transparent',
        border: `1px solid ${isSelected ? 'var(--io-accent)' : 'transparent'}`,
        borderRadius: 6,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        fontSize: 13,
      }}
    >
      <input
        type={singleSelect ? 'radio' : 'checkbox'}
        checked={isSelected}
        disabled={isDisabled}
        onChange={() => onToggle(point.id)}
        style={{ accentColor: 'var(--io-accent)', flexShrink: 0 }}
      />
      <span style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <span style={{ fontWeight: 500, color: 'var(--io-text-primary)' }}>
          {point.name}
        </span>
        <span
          style={{
            color: 'var(--io-text-muted)',
            marginLeft: 6,
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          {point.tag}
        </span>
      </span>
      {point.unit && (
        <span style={{ color: 'var(--io-text-muted)', fontSize: 11, flexShrink: 0 }}>
          {point.unit}
        </span>
      )}
    </label>
  )
}

// ---------------------------------------------------------------------------
// BrowseTab
// ---------------------------------------------------------------------------

function BrowseTab({
  selected,
  onToggle,
  maxSelect,
  singleSelect,
}: {
  selected: string[]
  onToggle: (id: string) => void
  maxSelect?: number
  singleSelect?: boolean
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['point-hierarchy'],
    queryFn: fetchHierarchy,
    staleTime: 60_000,
  })

  // Expanded state — track open areas, units, equipment by id
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set())
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set())
  const [openEquip, setOpenEquip] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: 'var(--io-text-muted)', fontSize: 13 }}>
        Loading hierarchy…
      </div>
    )
  }

  if (isError || !data || data.areas.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--io-text-muted)', fontSize: 13 }}>
        No hierarchy data available. Use Search tab instead.
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
        maxHeight: 340,
      }}
    >
      {data.areas.map((area) => {
        const areaOpen = openAreas.has(area.id)
        return (
          <div key={area.id}>
            {/* Area row */}
            <button
              onClick={() => setOpenAreas(toggle(openAreas, area.id))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '5px 8px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--io-text-primary)',
                borderRadius: 4,
                textAlign: 'left',
              }}
            >
              <ChevronIcon open={areaOpen} />
              <AreaIcon />
              {area.name}
            </button>

            {areaOpen &&
              area.units.map((unit) => {
                const unitOpen = openUnits.has(unit.id)
                return (
                  <div key={unit.id} style={{ paddingLeft: 16 }}>
                    {/* Unit row */}
                    <button
                      onClick={() => setOpenUnits(toggle(openUnits, unit.id))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--io-text-primary)',
                        borderRadius: 4,
                        textAlign: 'left',
                      }}
                    >
                      <ChevronIcon open={unitOpen} />
                      <UnitIcon />
                      {unit.name}
                    </button>

                    {unitOpen &&
                      unit.equipment.map((equip) => {
                        const equipOpen = openEquip.has(equip.id)
                        return (
                          <div key={equip.id} style={{ paddingLeft: 16 }}>
                            {/* Equipment row */}
                            <button
                              onClick={() => setOpenEquip(toggle(openEquip, equip.id))}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: 13,
                                color: 'var(--io-text-muted)',
                                borderRadius: 4,
                                textAlign: 'left',
                              }}
                            >
                              <ChevronIcon open={equipOpen} />
                              <EquipIcon />
                              {equip.name}
                              <span
                                style={{
                                  marginLeft: 4,
                                  fontSize: 11,
                                  color: 'var(--io-text-muted)',
                                  opacity: 0.7,
                                }}
                              >
                                ({equip.points.length})
                              </span>
                            </button>

                            {equipOpen && (
                              <div style={{ paddingLeft: 20 }}>
                                {equip.points.map((pt) => {
                                  const isSelected = selected.includes(pt.id)
                                  const isDisabled =
                                    !isSelected &&
                                    !singleSelect &&
                                    maxSelect != null &&
                                    selected.length >= maxSelect
                                  return (
                                    <PointRow
                                      key={pt.id}
                                      point={pt}
                                      isSelected={isSelected}
                                      isDisabled={isDisabled}
                                      onToggle={onToggle}
                                      singleSelect={singleSelect}
                                    />
                                  )
                                })}
                                {equip.points.length === 0 && (
                                  <div
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: 12,
                                      color: 'var(--io-text-muted)',
                                    }}
                                  >
                                    No points
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )
              })}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SearchTab
// ---------------------------------------------------------------------------

function SearchTab({
  selected,
  onToggle,
  maxSelect,
  singleSelect,
}: {
  selected: string[]
  onToggle: (id: string) => void
  maxSelect?: number
  singleSelect?: boolean
}) {
  const [query, setQuery] = useState('')

  const { data, isFetching } = useQuery({
    queryKey: ['points-picker-search', query],
    queryFn: async () => {
      const result = await pointsApi.list({ search: query || undefined, limit: 50 })
      if (!result.success) throw new Error(result.error.message)
      return result.data.data
    },
    staleTime: 15_000,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="text"
        placeholder="Search points by name or tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={inputStyle}
        autoFocus
      />

      {isFetching && (
        <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>Searching…</div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 280,
          overflowY: 'auto',
        }}
      >
        {data?.map((pt) => {
          const isSelected = selected.includes(pt.id)
          const isDisabled =
            !isSelected && !singleSelect && maxSelect != null && selected.length >= maxSelect
          return (
            <PointRow
              key={pt.id}
              point={{
                id: pt.id,
                tag: pt.tagname,
                name: pt.display_name ?? pt.tagname,
                unit: pt.unit,
                data_type: pt.data_type,
              }}
              isSelected={isSelected}
              isDisabled={isDisabled}
              onToggle={onToggle}
              singleSelect={singleSelect}
            />
          )
        })}
        {data?.length === 0 && !isFetching && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--io-text-muted)',
              textAlign: 'center',
              padding: 12,
            }}
          >
            No points found
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny icon helpers
// ---------------------------------------------------------------------------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{
        flexShrink: 0,
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 150ms',
        color: 'var(--io-text-muted)',
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function AreaIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0, color: 'var(--io-accent)' }}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

function UnitIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0, color: 'var(--io-text-muted)' }}
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}

function EquipIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0, color: 'var(--io-text-muted)' }}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// PointPicker — public API
// ---------------------------------------------------------------------------

export interface PointPickerProps {
  /** Currently selected point IDs */
  selected: string[]
  /** Called with updated selection whenever user toggles a point */
  onChange: (ids: string[]) => void
  /** Maximum number of selectable points (multi-select mode) */
  maxSelect?: number
  /** Force single-select mode — onChange always receives an array of at most 1 id */
  singleSelect?: boolean
  /** Optional className for the root container */
  className?: string
}

export default function PointPicker({
  selected,
  onChange,
  maxSelect,
  singleSelect = false,
}: PointPickerProps) {
  const [tab, setTab] = useState<'browse' | 'search'>('browse')

  const handleToggle = (id: string) => {
    if (singleSelect) {
      onChange(selected[0] === id ? [] : [id])
      return
    }
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
    } else {
      if (maxSelect != null && selected.length >= maxSelect) return
      onChange([...selected, id])
    }
  }

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 0',
    background: active ? 'var(--io-surface)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--io-accent)' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab header */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--io-border)',
          marginBottom: 8,
        }}
      >
        <button style={tabBtnStyle(tab === 'browse')} onClick={() => setTab('browse')}>
          Browse
        </button>
        <button style={tabBtnStyle(tab === 'search')} onClick={() => setTab('search')}>
          Search
        </button>
      </div>

      {/* Selection count badge */}
      {(maxSelect != null || selected.length > 0) && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--io-text-muted)',
            marginBottom: 6,
            textAlign: 'right',
          }}
        >
          {selected.length} selected
          {maxSelect != null && ` / ${maxSelect} max`}
        </div>
      )}

      {/* Tab content */}
      {tab === 'browse' ? (
        <BrowseTab
          selected={selected}
          onToggle={handleToggle}
          maxSelect={maxSelect}
          singleSelect={singleSelect}
        />
      ) : (
        <SearchTab
          selected={selected}
          onToggle={handleToggle}
          maxSelect={maxSelect}
          singleSelect={singleSelect}
        />
      )}
    </div>
  )
}
