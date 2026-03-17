import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi, type ShapeObject } from '../../../api/graphics'
import type { DesignerMode } from '../types'

interface SymbolLibraryProps {
  mode: DesignerMode
  onSymbolDrop: (symbolId: string, svgData: string) => void
}

const panelStyle: React.CSSProperties = {
  width: '200px',
  flexShrink: 0,
  background: 'var(--io-surface-secondary)',
  borderRight: '1px solid var(--io-border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  padding: '8px',
  borderBottom: '1px solid var(--io-border)',
  flexShrink: 0,
}

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '12px',
  outline: 'none',
  boxSizing: 'border-box',
}

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '6px',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'var(--io-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  padding: '8px 4px 4px',
}

const categoryLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--io-text-muted)',
  padding: '6px 4px 2px',
  fontStyle: 'italic',
}

const emptyStyle: React.CSSProperties = {
  padding: '12px 4px',
  fontSize: '12px',
  color: 'var(--io-text-muted)',
  textAlign: 'center',
}

// Tile grid for shape thumbnails
const tileGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '4px',
  marginBottom: '4px',
}

// Individual shape tile — large SVG preview
function ShapeTile({ shape }: { shape: ShapeObject }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('symbol-id', shape.id)
    e.dataTransfer.setData('symbol-svg', shape.svg_data)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={shape.name}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '4px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        border: '1px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'var(--io-surface-elevated)'
        el.style.borderColor = 'var(--io-border)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.borderColor = 'transparent'
      }}
    >
      {/* SVG thumbnail */}
      <div
        style={{
          width: '44px',
          height: '44px',
          flexShrink: 0,
          background: 'var(--io-surface-sunken)',
          border: '1px solid var(--io-border)',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        dangerouslySetInnerHTML={{
          __html: shape.svg_data
            ? `<svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">${shape.svg_data}</svg>`
            : `<svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="40" height="40" rx="4" fill="rgba(45,212,191,0.12)" stroke="rgba(45,212,191,0.4)" stroke-width="1.5"/></svg>`,
        }}
      />
      {/* Label */}
      <span
        style={{
          fontSize: '9px',
          color: 'var(--io-text-muted)',
          textAlign: 'center',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          maxWidth: '52px',
        }}
      >
        {shape.name}
      </span>
    </div>
  )
}

// Row-style item for stencils
function StencilItem({ shape }: { shape: ShapeObject }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('symbol-id', shape.id)
    e.dataTransfer.setData('symbol-svg', shape.svg_data)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={shape.name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '5px 4px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        fontSize: '12px',
        color: 'var(--io-text-primary)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          flexShrink: 0,
          background: 'var(--io-surface-sunken)',
          border: '1px solid var(--io-border)',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        dangerouslySetInnerHTML={{ __html: shape.svg_data }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
        {shape.name}
      </span>
    </div>
  )
}

// Widget tile (for dashboard/report mode) — styled card
const WIDGET_TYPES = [
  { id: 'widget-trend', label: 'Trend', icon: '📈', color: 'rgba(45,212,191,0.15)' },
  { id: 'widget-table', label: 'Table', icon: '⊞', color: 'rgba(99,102,241,0.15)' },
  { id: 'widget-kpi', label: 'KPI', icon: '◉', color: 'rgba(251,191,36,0.15)' },
  { id: 'widget-gauge', label: 'Gauge', icon: '◷', color: 'rgba(239,68,68,0.15)' },
  { id: 'widget-alarms', label: 'Alarms', icon: '⚠', color: 'rgba(239,68,68,0.12)' },
  { id: 'widget-text', label: 'Text', icon: '¶', color: 'rgba(148,163,184,0.15)' },
  { id: 'widget-image', label: 'Image', icon: '🖼', color: 'rgba(45,212,191,0.1)' },
  { id: 'widget-bar', label: 'Bar Chart', icon: '▉', color: 'rgba(99,102,241,0.12)' },
  { id: 'widget-pie', label: 'Pie', icon: '◍', color: 'rgba(251,191,36,0.12)' },
]

function WidgetTile({ id, label, icon, color }: { id: string; label: string; icon: string; color: string }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('symbol-id', id)
    e.dataTransfer.setData('symbol-svg', '')
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '4px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        border: '1px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'var(--io-surface-elevated)'
        el.style.borderColor = 'var(--io-border)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.borderColor = 'transparent'
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          background: color,
          border: '1px solid var(--io-border)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: '9px',
          color: 'var(--io-text-muted)',
          textAlign: 'center',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          maxWidth: '52px',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// Display element tiles (for graphic mode value display palette)
const DISPLAY_ELEMENTS = [
  { id: 'display-text-readout', label: 'Readout', icon: '123', color: 'rgba(45,212,191,0.12)' },
  { id: 'display-analog-bar', label: 'Analog Bar', icon: '▊', color: 'rgba(251,191,36,0.12)' },
  { id: 'display-fill-gauge', label: 'Fill Gauge', icon: '⊡', color: 'rgba(99,102,241,0.12)' },
  { id: 'display-sparkline', label: 'Sparkline', icon: '∿', color: 'rgba(45,212,191,0.1)' },
  { id: 'display-alarm', label: 'Alarm', icon: '⚠', color: 'rgba(239,68,68,0.12)' },
  { id: 'display-digital', label: 'Digital', icon: 'ON', color: 'rgba(34,197,94,0.12)' },
]

function DisplayElementTile({ id, label, icon, color }: { id: string; label: string; icon: string; color: string }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('symbol-id', id)
    e.dataTransfer.setData('symbol-svg', '')
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        padding: '4px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        border: '1px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'var(--io-surface-elevated)'
        el.style.borderColor = 'var(--io-border)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.borderColor = 'transparent'
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          background: color,
          border: '1px solid var(--io-border)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--io-text-secondary)',
          letterSpacing: '0',
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: '9px',
          color: 'var(--io-text-muted)',
          textAlign: 'center',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          maxWidth: '52px',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function groupByCategory(shapes: ShapeObject[]): Record<string, ShapeObject[]> {
  const groups: Record<string, ShapeObject[]> = {}
  for (const shape of shapes) {
    const cat = shape.category ?? 'Uncategorized'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(shape)
  }
  return groups
}

export default function SymbolLibrary({ mode, onSymbolDrop: _onSymbolDrop }: SymbolLibraryProps) {
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const shapesQuery = useQuery({
    queryKey: ['design-objects', 'shape'],
    queryFn: () => graphicsApi.listShapes('shape'),
    enabled: mode === 'graphic',
    staleTime: 60_000,
  })

  const stencilsQuery = useQuery({
    queryKey: ['design-objects', 'stencil'],
    queryFn: () => graphicsApi.listShapes('stencil'),
    staleTime: 60_000,
  })

  const shapes = (
    shapesQuery.data?.success ? shapesQuery.data.data : []
  ).filter((s: ShapeObject) =>
    search ? s.name.toLowerCase().includes(search.toLowerCase()) : true,
  )

  const stencils = (
    stencilsQuery.data?.success ? stencilsQuery.data.data : []
  ).filter((s: ShapeObject) =>
    search ? s.name.toLowerCase().includes(search.toLowerCase()) : true,
  )

  const filteredWidgets = WIDGET_TYPES.filter((w) =>
    search ? w.label.toLowerCase().includes(search.toLowerCase()) : true,
  )

  const filteredDisplayEls = DISPLAY_ELEMENTS.filter((d) =>
    search ? d.label.toLowerCase().includes(search.toLowerCase()) : true,
  )

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <input
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      <div style={scrollAreaStyle}>
        {/* Equipment shapes — graphic mode only */}
        {mode === 'graphic' && (
          <>
            <div style={sectionHeaderStyle}>Equipment</div>
            {shapesQuery.isLoading ? (
              <div style={emptyStyle}>Loading…</div>
            ) : shapes.length === 0 ? (
              <div style={emptyStyle}>No shapes found</div>
            ) : (
              Object.entries(groupByCategory(shapes)).map(([cat, items]) => {
                const isExpanded = expandedCategories.has(cat) || search.length > 0
                return (
                  <React.Fragment key={cat}>
                    <button
                      onClick={() => toggleCategory(cat)}
                      style={{
                        ...categoryLabelStyle,
                        display: 'flex',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 4px 2px',
                        fontStyle: 'italic',
                        textAlign: 'left',
                        color: 'var(--io-text-secondary)',
                        fontSize: '10px',
                      }}
                    >
                      <span style={{ fontSize: '8px', marginRight: '2px' }}>
                        {isExpanded ? '▼' : '►'}
                      </span>
                      {cat} ({items.length})
                    </button>
                    {isExpanded && (
                      <div style={tileGridStyle}>
                        {items.map((s) => (
                          <ShapeTile key={s.id} shape={s} />
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </>
        )}

        {/* Display elements — graphic mode */}
        {mode === 'graphic' && (
          <>
            <div style={sectionHeaderStyle}>Value Display</div>
            <div style={tileGridStyle}>
              {filteredDisplayEls.map((d) => (
                <DisplayElementTile key={d.id} id={d.id} label={d.label} icon={d.icon} color={d.color} />
              ))}
            </div>
          </>
        )}

        {/* Stencils */}
        <div style={sectionHeaderStyle}>Stencils</div>
        {stencilsQuery.isLoading ? (
          <div style={emptyStyle}>Loading…</div>
        ) : stencils.length === 0 ? (
          <div style={emptyStyle}>No stencils found</div>
        ) : (
          stencils.map((s) => <StencilItem key={s.id} shape={s} />)
        )}

        {/* Widgets — dashboard + report modes */}
        {(mode === 'dashboard' || mode === 'report') && (
          <>
            <div style={sectionHeaderStyle}>Widgets</div>
            {filteredWidgets.length === 0 ? (
              <div style={emptyStyle}>No widgets found</div>
            ) : (
              <div style={tileGridStyle}>
                {filteredWidgets.map((w) => (
                  <WidgetTile
                    key={w.id}
                    id={w.id}
                    label={w.label}
                    icon={w.icon}
                    color={w.color}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
