import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { graphicsApi } from '../../api/graphics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Graphic {
  id: string
  name: string
  type: string
  bindings_count: number
}

interface Point {
  id: string
  tagname: string
  description?: string
  unit?: string
  source_name?: string
}

// Drag data key used to communicate drops from palette to panes
export const CONSOLE_DRAG_KEY = 'application/io-console-item'

export interface ConsoleDragItem {
  itemType: 'graphic' | 'trend' | 'point_table' | 'alarm_list'
  graphicId?: string
  label?: string
  pointIds?: string[]
}

// ---------------------------------------------------------------------------
// Helper: style constants
// ---------------------------------------------------------------------------

const PANEL_W = 220

const panel: React.CSSProperties = {
  width: PANEL_W,
  minWidth: PANEL_W,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--io-surface-secondary)',
  borderRight: '1px solid var(--io-border)',
  overflow: 'hidden',
  userSelect: 'none',
}

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  height: 36,
  cursor: 'pointer',
  flexShrink: 0,
  borderBottom: '1px solid var(--io-border)',
  gap: 6,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--io-text-muted)',
  flex: 1,
}

const chevron = (open: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  color: 'var(--io-text-muted)',
  transition: 'transform 0.15s',
  transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
  flexShrink: 0,
})

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

const listItem = (dragging?: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--io-text-primary)',
  cursor: 'grab',
  borderRadius: 'var(--io-radius)',
  margin: '1px 4px',
  opacity: dragging ? 0.5 : 1,
  transition: 'background 0.1s',
})

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------

import React from 'react'

interface AccordionSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
}

function AccordionSection({ title, open, onToggle, badge, children }: AccordionSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div
        style={sectionHeader}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
      >
        <svg style={chevron(open)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 4 10 8 6 12" />
        </svg>
        <span style={sectionLabel}>{title}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            background: 'var(--io-accent-subtle)',
            color: 'var(--io-accent)',
            borderRadius: 8,
            padding: '1px 5px',
            lineHeight: 1.4,
          }}>
            {badge}
          </span>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable item wrapper — sets dataTransfer on drag start
// ---------------------------------------------------------------------------

function DraggableItem({
  item,
  children,
}: {
  item: ConsoleDragItem
  children: React.ReactNode
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      style={listItem(dragging)}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item))
        e.dataTransfer.effectAllowed = 'copy'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={(e) => {
        if (!dragging) (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graphics section
// ---------------------------------------------------------------------------

function GraphicsSection() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['console-palette-graphics'],
    queryFn: async () => {
      const r = await graphicsApi.list()
      if (!r.success) return []
      return r.data as Graphic[]
    },
    staleTime: 30_000,
  })

  const items = (data ?? []).filter((g) =>
    search ? g.name.toLowerCase().includes(search.toLowerCase()) : true,
  )

  return (
    <div style={{ padding: '6px 4px 4px' }}>
      <div style={{ padding: '0 6px 6px' }}>
        <input
          type="search"
          placeholder="Filter graphics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
      </div>
      {isLoading && (
        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          Loading…
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          {search ? 'No matches' : 'No graphics — create one in Designer'}
        </div>
      )}
      {items.map((g) => (
        <DraggableItem
          key={g.id}
          item={{ itemType: 'graphic', graphicId: g.id, label: g.name }}
        >
          {/* Graphic icon */}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5">
            <rect x="1" y="1" width="14" height="14" rx="2" />
            <circle cx="5.5" cy="5.5" r="1.5" />
            <polyline points="1 10 5 6.5 8 9.5 11 7 15 11" />
          </svg>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
              {g.name}
            </div>
            {g.bindings_count > 0 && (
              <div style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>
                {g.bindings_count} binding{g.bindings_count !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </DraggableItem>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widgets section (Trend, Point Table, Alarm List)
// ---------------------------------------------------------------------------

const WIDGET_ITEMS: { itemType: ConsoleDragItem['itemType']; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    itemType: 'trend',
    label: 'Trend',
    desc: 'Live time-series chart',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-accent)" strokeWidth="1.5">
        <polyline points="1 12 4 7 7 9 10 5 15 3" />
        <line x1="1" y1="14" x2="15" y2="14" strokeOpacity="0.4" />
      </svg>
    ),
  },
  {
    itemType: 'point_table',
    label: 'Point Table',
    desc: 'Tabular point values',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5">
        <rect x="1" y="1" width="14" height="14" rx="1" />
        <line x1="1" y1="5" x2="15" y2="5" />
        <line x1="6" y1="1" x2="6" y2="15" />
      </svg>
    ),
  },
  {
    itemType: 'alarm_list',
    label: 'Alarm List',
    desc: 'Active alarms & events',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#f59e0b" strokeWidth="1.5">
        <path d="M8 2L14 13H2L8 2Z" />
        <line x1="8" y1="7" x2="8" y2="10" />
        <circle cx="8" cy="12" r="0.5" fill="#f59e0b" />
      </svg>
    ),
  },
]

function WidgetsSection() {
  return (
    <div style={{ padding: '6px 4px 4px' }}>
      {WIDGET_ITEMS.map((w) => (
        <DraggableItem key={w.itemType} item={{ itemType: w.itemType, label: w.label }}>
          {w.icon}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>{w.label}</div>
            <div style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>{w.desc}</div>
          </div>
        </DraggableItem>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Points section
// ---------------------------------------------------------------------------

function PointsSection() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['console-palette-points', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return []
      const r = await api.get<{ data: Point[] }>(`/api/search?q=${encodeURIComponent(debouncedSearch)}&type=point&limit=30`)
      if (!r.success) return []
      return r.data.data ?? []
    },
    staleTime: 30_000,
    enabled: debouncedSearch.length >= 2,
  })

  const points = data ?? []

  return (
    <div style={{ padding: '6px 4px 4px' }}>
      <div style={{ padding: '0 6px 6px' }}>
        <input
          type="search"
          placeholder="Search points (≥2 chars)…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={searchInput}
        />
      </div>
      {search.length > 0 && search.length < 2 && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          Type at least 2 characters
        </div>
      )}
      {isLoading && (
        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          Searching…
        </div>
      )}
      {!isLoading && debouncedSearch.length >= 2 && points.length === 0 && (
        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          No points found
        </div>
      )}
      {debouncedSearch.length < 2 && !isLoading && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          Search to browse points. Drag a point onto a Trend or Table pane to add it.
        </div>
      )}
      {points.map((pt) => (
        <DraggableItem
          key={pt.id}
          item={{ itemType: 'trend', label: pt.tagname, pointIds: [pt.id] }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3" />
            <line x1="8" y1="1" x2="8" y2="4" />
            <line x1="8" y1="12" x2="8" y2="15" />
            <line x1="1" y1="8" x2="4" y2="8" />
            <line x1="12" y1="8" x2="15" y2="8" />
          </svg>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pt.tagname}
            </div>
            {pt.description && (
              <div style={{ fontSize: 10, color: 'var(--io-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pt.description}
              </div>
            )}
          </div>
        </DraggableItem>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConsolePalette — main component
// ---------------------------------------------------------------------------

interface ConsolePaletteProps {
  visible: boolean
  onToggle: () => void
}

export default function ConsolePalette({ visible, onToggle }: ConsolePaletteProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    graphics: true,
    widgets: true,
    points: false,
  })

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  if (!visible) {
    // Collapsed — show a slim toggle button
    return (
      <div
        style={{
          width: 24,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--io-surface-secondary)',
          borderRight: '1px solid var(--io-border)',
          paddingTop: 8,
        }}
      >
        <button
          onClick={onToggle}
          title="Show asset palette"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            padding: '4px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div style={panel}>
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          height: 36,
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          gap: 6,
        }}
      >
        <span style={{ ...sectionLabel, color: 'var(--io-text-secondary)', fontSize: 12, fontWeight: 700 }}>
          Assets
        </span>
        <button
          onClick={onToggle}
          title="Collapse palette"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 3,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AccordionSection
          title="Graphics"
          open={openSections.graphics}
          onToggle={() => toggleSection('graphics')}
        >
          <GraphicsSection />
        </AccordionSection>

        <AccordionSection
          title="Widgets"
          open={openSections.widgets}
          onToggle={() => toggleSection('widgets')}
        >
          <WidgetsSection />
        </AccordionSection>

        <AccordionSection
          title="Points"
          open={openSections.points}
          onToggle={() => toggleSection('points')}
        >
          <PointsSection />
        </AccordionSection>
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--io-border)',
          fontSize: 10,
          color: 'var(--io-text-muted)',
          flexShrink: 0,
          lineHeight: 1.5,
        }}
      >
        Drag items onto panes to assign them
      </div>
    </div>
  )
}
