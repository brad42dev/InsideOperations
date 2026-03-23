/**
 * PointPicker — dual-mode point selector
 *
 * Provides four tabs:
 *   - Browse: expandable Area → Unit → Equipment → Point hierarchy
 *   - Search: type-ahead search (existing behaviour used throughout the app)
 *   - Favorites: star frequently used points, persisted in localStorage
 *   - Recent: last 20 selected points quick-access list
 *
 * Hover preview: hovering a point row for 300ms shows a preview panel on the
 * right side with current value, quality badge, timestamp, engineering unit,
 * and a mini sparkline.
 *
 * Usage:
 *   <PointPicker
 *     selected={selectedIds}
 *     onChange={setSelectedIds}
 *     maxSelect={8}          // optional — omit for unlimited multi-select
 *     singleSelect           // optional — forces single-select mode (returns 1 id)
 *   />
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '../../api/points'
import { api } from '../../api/client'

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LS_FAVORITES = 'io:point-picker:favorites'
const LS_RECENT = 'io:point-picker:recent'

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_FAVORITES)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveFavorites(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_FAVORITES, JSON.stringify([...ids]))
  } catch {
    // ignore quota errors
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(LS_RECENT)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function saveRecent(ids: string[]): void {
  try {
    localStorage.setItem(LS_RECENT, JSON.stringify(ids))
  } catch {
    // ignore quota errors
  }
}

function prependRecent(id: string, current: string[]): string[] {
  const next = [id, ...current.filter((x) => x !== id)]
  return next.slice(0, 20)
}

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
  isFavorite,
  onToggleFavorite,
  onHoverPoint,
}: {
  point: PointEntry
  isSelected: boolean
  isDisabled: boolean
  onToggle: (id: string) => void
  singleSelect?: boolean
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  onHoverPoint: (id: string | null) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px 4px 10px',
        background: isSelected
          ? 'var(--io-accent-subtle, rgba(74,158,255,0.1))'
          : 'transparent',
        border: `1px solid ${isSelected ? 'var(--io-accent)' : 'transparent'}`,
        borderRadius: 6,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        fontSize: 13,
      }}
      onMouseEnter={() => onHoverPoint(point.id)}
      onMouseLeave={() => onHoverPoint(null)}
    >
      {/* Checkbox / radio */}
      <input
        type={singleSelect ? 'radio' : 'checkbox'}
        checked={isSelected}
        disabled={isDisabled}
        onChange={() => onToggle(point.id)}
        style={{ accentColor: 'var(--io-accent)', flexShrink: 0, cursor: 'pointer' }}
      />

      {/* Point name + tag */}
      <span
        style={{ flex: 1, overflow: 'hidden', minWidth: 0, cursor: 'pointer' }}
        onClick={() => !isDisabled && onToggle(point.id)}
      >
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

      {/* Engineering unit */}
      {point.unit && (
        <span style={{ color: 'var(--io-text-muted)', fontSize: 11, flexShrink: 0 }}>
          {point.unit}
        </span>
      )}

      {/* Favorite star */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(point.id)
        }}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        style={{
          background: 'none',
          border: 'none',
          padding: '2px 3px',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          color: isFavorite ? 'var(--io-warning, #f59e0b)' : 'var(--io-text-muted)',
          flexShrink: 0,
          opacity: isFavorite ? 1 : 0.5,
        }}
      >
        {isFavorite ? '★' : '☆'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MiniSparkline — simple HTML/SVG sparkline for preview panel
// ---------------------------------------------------------------------------

function MiniSparkline({ values }: { values: number[] }) {
  const W = 200
  const H = 60
  const pad = 4

  let pathD = ''
  if (values.length >= 2) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const step = (W - pad * 2) / (values.length - 1)
    const points = values.map((v, i) => {
      const px = pad + i * step
      const py = pad + (1 - (v - min) / range) * (H - pad * 2)
      return `${px.toFixed(1)},${py.toFixed(1)}`
    })
    pathD = `M ${points.join(' L ')}`
  }

  return (
    <svg
      width={W}
      height={H}
      style={{
        display: 'block',
        borderRadius: 4,
        background: 'var(--io-surface-secondary)',
      }}
    >
      {pathD ? (
        <path
          d={pathD}
          fill="none"
          stroke="var(--io-accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={pad}
          y1={H / 2}
          x2={W - pad}
          y2={H / 2}
          stroke="var(--io-text-muted)"
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// PointPreview — debounced hover preview panel
// ---------------------------------------------------------------------------

function PointPreview({ hoveredId }: { hoveredId: string | null }) {
  // Debounce: only trigger queries after 300ms of stable hover
  const [debouncedId, setDebouncedId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (hoveredId === null) {
      // Clear immediately on mouse leave to avoid stale data flash
      setDebouncedId(null)
    } else {
      timerRef.current = setTimeout(() => setDebouncedId(hoveredId), 300)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [hoveredId])

  const { data: latest, isLoading: latestLoading } = useQuery({
    queryKey: ['point-preview-latest', debouncedId],
    queryFn: () => pointsApi.getLatest(debouncedId!),
    enabled: debouncedId !== null,
    staleTime: 10_000,
  })

  const { data: history } = useQuery({
    queryKey: ['point-preview-history', debouncedId],
    queryFn: async () => {
      const end = new Date().toISOString()
      const start = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      return pointsApi.getHistory(debouncedId!, { start, end, limit: 30 })
    },
    enabled: debouncedId !== null,
    staleTime: 30_000,
  })

  const { data: meta } = useQuery({
    queryKey: ['point-preview-meta', debouncedId],
    queryFn: () => pointsApi.getMeta(debouncedId!),
    enabled: debouncedId !== null,
    staleTime: 300_000,
  })

  if (!hoveredId && !debouncedId) {
    return (
      <div
        style={{
          flex: '0 0 220px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 12,
          borderLeft: '1px solid var(--io-border)',
          padding: '12px 14px',
          textAlign: 'center',
        }}
      >
        Hover a point to preview
      </div>
    )
  }

  const latestData = latest?.success ? latest.data : null
  const historyData = history?.success ? history.data : []
  const metaData = meta?.success ? meta.data : null

  const sparkValues = historyData.map((e) => e.value)

  const qualityColor =
    latestData?.quality === 'good'
      ? 'var(--io-success, #22c55e)'
      : latestData?.quality === 'bad'
        ? 'var(--io-danger, #ef4444)'
        : 'var(--io-warning, #f59e0b)'

  return (
    <div
      style={{
        flex: '0 0 220px',
        borderLeft: '1px solid var(--io-border)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 0,
        overflowY: 'auto',
      }}
    >
      {latestLoading && debouncedId ? (
        <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>Loading…</div>
      ) : (
        <>
          {/* Tag name */}
          <div
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'var(--io-text-muted)',
              wordBreak: 'break-all',
            }}
          >
            {metaData?.name ?? debouncedId}
          </div>

          {/* Current value */}
          {latestData && (
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--io-text-primary)',
                lineHeight: 1.1,
              }}
            >
              {typeof latestData.value === 'number'
                ? latestData.value.toFixed(2)
                : String(latestData.value)}
              {metaData?.engineering_unit && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--io-text-muted)',
                    marginLeft: 4,
                  }}
                >
                  {metaData.engineering_unit}
                </span>
              )}
            </div>
          )}

          {/* Quality badge + timestamp */}
          {latestData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: qualityColor,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {latestData.quality}
              </span>
              <span style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>
                {new Date(latestData.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* Sparkline */}
          <MiniSparkline values={sparkValues} />

          {!latestData && !latestLoading && (
            <div style={{ fontSize: 12, color: 'var(--io-text-muted)' }}>No data available</div>
          )}
        </>
      )}
    </div>
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
  favorites,
  onToggleFavorite,
  onHoverPoint,
}: {
  selected: string[]
  onToggle: (id: string) => void
  maxSelect?: number
  singleSelect?: boolean
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onHoverPoint: (id: string | null) => void
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
                                      isFavorite={favorites.has(pt.id)}
                                      onToggleFavorite={onToggleFavorite}
                                      onHoverPoint={onHoverPoint}
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
  favorites,
  onToggleFavorite,
  onHoverPoint,
}: {
  selected: string[]
  onToggle: (id: string) => void
  maxSelect?: number
  singleSelect?: boolean
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onHoverPoint: (id: string | null) => void
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
              isFavorite={favorites.has(pt.id)}
              onToggleFavorite={onToggleFavorite}
              onHoverPoint={onHoverPoint}
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
// FavoritesTab
// ---------------------------------------------------------------------------

function FavoritesTab({
  selected,
  onToggle,
  maxSelect,
  singleSelect,
  favorites,
  onToggleFavorite,
  onHoverPoint,
}: {
  selected: string[]
  onToggle: (id: string) => void
  maxSelect?: number
  singleSelect?: boolean
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onHoverPoint: (id: string | null) => void
}) {
  // Fetch metadata for all favorited points so we can render them
  const { data, isFetching } = useQuery({
    queryKey: ['points-picker-favorites', [...favorites].sort().join(',')],
    queryFn: async () => {
      if (favorites.size === 0) return []
      const result = await pointsApi.list({ limit: 500 })
      if (!result.success) return []
      return result.data.data.filter((p) => favorites.has(p.id))
    },
    staleTime: 30_000,
    enabled: favorites.size > 0,
  })

  if (favorites.size === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 13,
        }}
      >
        No favorites yet.
        <br />
        <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          Click the ☆ star on any point to add it here.
        </span>
      </div>
    )
  }

  if (isFetching) {
    return (
      <div style={{ padding: 16, color: 'var(--io-text-muted)', fontSize: 13 }}>
        Loading favorites…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 340,
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
            isFavorite={true}
            onToggleFavorite={onToggleFavorite}
            onHoverPoint={onHoverPoint}
          />
        )
      })}
      {data?.length === 0 && !isFetching && (
        <div style={{ padding: 16, color: 'var(--io-text-muted)', fontSize: 13 }}>
          Favorites not found in current dataset.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecentTab
// ---------------------------------------------------------------------------

function RecentTab({
  selected,
  onToggle,
  maxSelect,
  singleSelect,
  favorites,
  onToggleFavorite,
  onHoverPoint,
  recentIds,
}: {
  selected: string[]
  onToggle: (id: string) => void
  maxSelect?: number
  singleSelect?: boolean
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
  onHoverPoint: (id: string | null) => void
  recentIds: string[]
}) {
  // Fetch metadata for recent points
  const { data, isFetching } = useQuery({
    queryKey: ['points-picker-recent', recentIds.slice(0, 20).join(',')],
    queryFn: async () => {
      if (recentIds.length === 0) return []
      const result = await pointsApi.list({ limit: 500 })
      if (!result.success) return []
      const metaById = new Map(result.data.data.map((p) => [p.id, p]))
      // Preserve the recency order
      return recentIds
        .map((id) => metaById.get(id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined)
    },
    staleTime: 30_000,
    enabled: recentIds.length > 0,
  })

  if (recentIds.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 13,
        }}
      >
        No recently selected points.
        <br />
        <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          Points you select will appear here for quick re-access.
        </span>
      </div>
    )
  }

  if (isFetching) {
    return (
      <div style={{ padding: 16, color: 'var(--io-text-muted)', fontSize: 13 }}>
        Loading recent points…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        maxHeight: 340,
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
            isFavorite={favorites.has(pt.id)}
            onToggleFavorite={onToggleFavorite}
            onHoverPoint={onHoverPoint}
          />
        )
      })}
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
  const [tab, setTab] = useState<'browse' | 'search' | 'favorites' | 'recent'>('browse')
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecent())
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null)

  const handleToggle = useCallback((id: string) => {
    if (singleSelect) {
      const isCurrentlySelected = selected[0] === id
      const newSelection = isCurrentlySelected ? [] : [id]
      onChange(newSelection)
      if (!isCurrentlySelected) {
        // Adding — prepend to recent
        setRecentIds((prev) => {
          const next = prependRecent(id, prev)
          saveRecent(next)
          return next
        })
      }
      return
    }
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
    } else {
      if (maxSelect != null && selected.length >= maxSelect) return
      onChange([...selected, id])
      // Prepend to recent
      setRecentIds((prev) => {
        const next = prependRecent(id, prev)
        saveRecent(next)
        return next
      })
    }
  }, [selected, onChange, singleSelect, maxSelect])

  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveFavorites(next)
      return next
    })
  }, [])

  const handleHoverPoint = useCallback((id: string | null) => {
    setHoveredPointId(id)
  }, [])

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 0',
    background: active ? 'var(--io-surface)' : 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid var(--io-accent)' : '2px solid transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
    whiteSpace: 'nowrap',
  })

  const sharedTabProps = {
    selected,
    onToggle: handleToggle,
    maxSelect,
    singleSelect,
    favorites,
    onToggleFavorite: handleToggleFavorite,
    onHoverPoint: handleHoverPoint,
  }

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
        <button style={tabBtnStyle(tab === 'favorites')} onClick={() => setTab('favorites')}>
          Favorites{favorites.size > 0 ? ` (${favorites.size})` : ''}
        </button>
        <button style={tabBtnStyle(tab === 'recent')} onClick={() => setTab('recent')}>
          Recent{recentIds.length > 0 ? ` (${recentIds.length})` : ''}
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

      {/* Main content: tab content + preview panel side by side */}
      <div style={{ display: 'flex', gap: 0, minHeight: 0 }}>
        {/* Left: tab content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {tab === 'browse' && <BrowseTab {...sharedTabProps} />}
          {tab === 'search' && <SearchTab {...sharedTabProps} />}
          {tab === 'favorites' && <FavoritesTab {...sharedTabProps} />}
          {tab === 'recent' && (
            <RecentTab {...sharedTabProps} recentIds={recentIds} />
          )}
        </div>

        {/* Right: preview panel */}
        <PointPreview hoveredId={hoveredPointId} />
      </div>
    </div>
  )
}
