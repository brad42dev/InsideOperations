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

const searchStyle: React.CSSProperties = {
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
  padding: '8px',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--io-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '8px 4px 4px',
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 4px',
  borderRadius: 'var(--io-radius)',
  cursor: 'grab',
  fontSize: '12px',
  color: 'var(--io-text-primary)',
  transition: 'background 0.1s',
}

const previewStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  flexShrink: 0,
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: '3px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}

const emptyStyle: React.CSSProperties = {
  padding: '16px 4px',
  fontSize: '12px',
  color: 'var(--io-text-muted)',
  textAlign: 'center',
}

const WIDGET_TYPES = [
  { id: 'widget-trend', label: 'Trend Chart', icon: '📈' },
  { id: 'widget-table', label: 'Data Table', icon: '⊞' },
  { id: 'widget-kpi', label: 'KPI', icon: '◉' },
  { id: 'widget-gauge', label: 'Gauge', icon: '◷' },
  { id: 'widget-alarms', label: 'Alarm List', icon: '⚠' },
  { id: 'widget-text', label: 'Text Block', icon: '¶' },
]

function groupByCategory(shapes: ShapeObject[]): Record<string, ShapeObject[]> {
  const groups: Record<string, ShapeObject[]> = {}
  for (const shape of shapes) {
    const cat = shape.category ?? 'Uncategorized'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(shape)
  }
  return groups
}

function ShapeItem({ shape }: { shape: ShapeObject }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('symbol-id', shape.id)
    e.dataTransfer.setData('symbol-svg', shape.svg_data)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={itemStyle}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <div
        style={previewStyle}
        dangerouslySetInnerHTML={{ __html: shape.svg_data }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {shape.name}
      </span>
    </div>
  )
}

function WidgetItem({ id, label, icon }: { id: string; label: string; icon: string }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('symbol-id', id)
    e.dataTransfer.setData('symbol-svg', '')
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={itemStyle}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <div style={{ ...previewStyle, fontSize: '16px' }}>{icon}</div>
      <span>{label}</span>
    </div>
  )
}

export default function SymbolLibrary({ mode, onSymbolDrop: _onSymbolDrop }: SymbolLibraryProps) {
  const [search, setSearch] = useState('')

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

  return (
    <div style={panelStyle}>
      <div style={searchStyle}>
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
              Object.entries(groupByCategory(shapes)).map(([cat, items]) => (
                <React.Fragment key={cat}>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--io-text-muted)',
                      padding: '6px 4px 2px',
                      fontStyle: 'italic',
                    }}
                  >
                    {cat}
                  </div>
                  {items.map((s) => (
                    <ShapeItem key={s.id} shape={s} />
                  ))}
                </React.Fragment>
              ))
            )}
          </>
        )}

        {/* Stencils */}
        <div style={sectionHeaderStyle}>Stencils</div>
        {stencilsQuery.isLoading ? (
          <div style={emptyStyle}>Loading…</div>
        ) : stencils.length === 0 ? (
          <div style={emptyStyle}>No stencils found</div>
        ) : (
          stencils.map((s) => <ShapeItem key={s.id} shape={s} />)
        )}

        {/* Widgets — dashboard + report modes */}
        {(mode === 'dashboard' || mode === 'report') && (
          <>
            <div style={sectionHeaderStyle}>Widgets</div>
            {filteredWidgets.length === 0 ? (
              <div style={emptyStyle}>No widgets found</div>
            ) : (
              filteredWidgets.map((w) => (
                <WidgetItem key={w.id} id={w.id} label={w.label} icon={w.icon} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
