import React, { useState, useEffect } from 'react'
import type { DesignerMode, DesignerLayer } from '../types'

// Local binding types (graphics type system TBD in redesign)
export interface ElementBinding {
  pointId?: string; tag?: string; bindingType?: string
  point_id?: string; attribute?: string; mapping?: BindingMapping
  [key: string]: unknown
}
export type GraphicBindings = Record<string, ElementBinding>
export interface BindingMapping { type: string; value?: unknown; [key: string]: unknown }
import PointPickerModal from '../components/PointPickerModal'

interface PropertyPanelProps {
  selectedIds: string[]
  svgRef: React.RefObject<SVGSVGElement | null>
  bindings: GraphicBindings
  onBindingsChange: (bindings: GraphicBindings) => void
  mode: DesignerMode
  // Global properties
  graphicName: string
  onGraphicNameChange: (name: string) => void
  canvasWidth: number
  canvasHeight: number
  onCanvasSizeChange: (w: number, h: number) => void
  // Layers
  layers: DesignerLayer[]
  onLayersChange: (layers: DesignerLayer[]) => void
  // Element transforms
  onElementTransform?: (id: string, transform: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => void
  // Multi-select actions
  onGroup?: () => void
  onDeleteSelected?: () => void
  onAlign?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  onDistribute?: (direction: 'horizontal' | 'vertical') => void
}

// ---- Styles ----
const panelStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'var(--io-surface-secondary)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}
const scrollAreaStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', padding: '12px' }
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 500,
  color: 'var(--io-text-muted)', marginBottom: '4px',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px',
  background: 'var(--io-surface-sunken)', border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)',
  fontSize: '12px', outline: 'none', boxSizing: 'border-box',
}
const fieldGroupStyle: React.CSSProperties = { marginBottom: '12px' }
const sectionDivStyle: React.CSSProperties = {
  borderTop: '1px solid var(--io-border)', marginTop: '12px', paddingTop: '10px',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--io-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
}
const btnStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: '12px', cursor: 'pointer',
  borderRadius: 'var(--io-radius)', border: '1px solid var(--io-border)',
  background: 'transparent', color: 'var(--io-text-secondary)', width: '100%',
}
const btnDangerStyle: React.CSSProperties = {
  ...btnStyle, color: 'var(--io-danger)', borderColor: 'var(--io-danger)',
}
const btnAccentStyle: React.CSSProperties = {
  ...btnStyle, background: 'var(--io-accent)', color: '#09090b', border: 'none', fontWeight: 600,
}
const alignBtnStyle: React.CSSProperties = {
  width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)',
  background: 'transparent', color: 'var(--io-text-secondary)', cursor: 'pointer', padding: 0,
}

// ---- Layer row ----
function LayerRow({ layer, onToggleVisible, onToggleLock, onRename, onDelete, onDragStart, onDragOver, onDragLeave, onDrop, isDragOver }: {
  layer: DesignerLayer
  onToggleVisible: () => void
  onToggleLock: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  isDragOver: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(layer.name)
  const [showCtx, setShowCtx] = useState(false)

  const finishRename = () => { setEditing(false); if (name.trim()) onRename(name.trim()) }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '4px 6px', borderRadius: 'var(--io-radius)',
        fontSize: '12px', color: 'var(--io-text-primary)',
        position: 'relative',
        borderTop: isDragOver ? '2px solid var(--io-accent)' : '2px solid transparent',
        cursor: 'grab',
      }}
      onContextMenu={(e) => { e.preventDefault(); setShowCtx(true) }}
    >
      <button
        onClick={onToggleVisible}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: layer.visible ? 'var(--io-text-secondary)' : 'var(--io-text-muted)', fontSize: '12px' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          {layer.visible ? (
            <>
              <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <circle cx="7" cy="7" r="1.8" fill="currentColor"/>
            </>
          ) : (
            <>
              <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.3"/>
              <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/>
            </>
          )}
        </svg>
      </button>
      <button
        onClick={onToggleLock}
        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: layer.locked ? 'var(--io-warning)' : 'var(--io-text-muted)', fontSize: '11px' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          {layer.locked ? (
            <>
              <rect x="2.5" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M4 5V3.5C4 2.67157 4.67157 2 5.5 2H6.5C7.32843 2 8 2.67157 8 3.5V5" stroke="currentColor" strokeWidth="1.2"/>
            </>
          ) : (
            <>
              <rect x="2.5" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4"/>
              <path d="M4 5V3.5C4 2.67157 4.67157 2 5.5 2H6.5C7.32843 2 8 2.67157 8 3.5V4" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
            </>
          )}
        </svg>
      </button>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={finishRename}
          onKeyDown={(e) => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') { setName(layer.name); setEditing(false) } }}
          style={{ ...inputStyle, padding: '2px 4px', flex: 1 }}
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}
        >
          {layer.name}
        </span>
      )}
      {/* Context menu */}
      {showCtx && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setShowCtx(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 301,
            background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)', padding: '4px', minWidth: '100px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <button onClick={() => { setShowCtx(false); setEditing(true) }} style={{ ...ctxItemStyle }}>Rename</button>
            <button onClick={() => { setShowCtx(false); onDelete() }} style={{ ...ctxItemStyle, color: 'var(--io-danger)' }}>Delete</button>
          </div>
        </>
      )}
    </div>
  )
}

const ctxItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '4px 10px', fontSize: '12px',
  border: 'none', background: 'transparent', color: 'var(--io-text-primary)',
  cursor: 'pointer', textAlign: 'left', borderRadius: '2px',
}

// ---- Nothing-selected state ----
function GlobalPanel({ graphicName, onGraphicNameChange, canvasWidth, canvasHeight, onCanvasSizeChange, layers, onLayersChange }: {
  graphicName: string; onGraphicNameChange: (n: string) => void
  canvasWidth: number; canvasHeight: number; onCanvasSizeChange: (w: number, h: number) => void
  layers: DesignerLayer[]; onLayersChange: (l: DesignerLayer[]) => void
}) {
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const addLayer = () => {
    const id = `layer-${Date.now()}`
    const num = layers.length + 1
    onLayersChange([...layers, { id, name: `Layer ${num}`, visible: true, locked: false }])
  }

  return (
    <div style={scrollAreaStyle}>
      {/* Graphic properties */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Name</label>
        <input
          value={graphicName}
          onChange={(e) => onGraphicNameChange(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Type</label>
        <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', padding: '4px 0' }}>Graphic</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', ...fieldGroupStyle }}>
        <div>
          <label style={labelStyle}>Width</label>
          <input
            type="number"
            value={canvasWidth}
            onChange={(e) => onCanvasSizeChange(Number(e.target.value), canvasHeight)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Height</label>
          <input
            type="number"
            value={canvasHeight}
            onChange={(e) => onCanvasSizeChange(canvasWidth, Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Layers */}
      <div style={sectionDivStyle}>
        <div style={sectionTitleStyle}>Layers</div>
        {layers.map((layer, idx) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            onToggleVisible={() => {
              const next = [...layers]
              next[idx] = { ...next[idx], visible: !next[idx].visible }
              onLayersChange(next)
            }}
            onToggleLock={() => {
              const next = [...layers]
              next[idx] = { ...next[idx], locked: !next[idx].locked }
              onLayersChange(next)
            }}
            onRename={(name) => {
              const next = [...layers]
              next[idx] = { ...next[idx], name }
              onLayersChange(next)
            }}
            onDelete={() => {
              if (layers.length <= 1) return
              onLayersChange(layers.filter((_, i) => i !== idx))
            }}
            onDragStart={(e) => e.dataTransfer.setData('layer-id', layer.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(layer.id) }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault()
              const fromId = e.dataTransfer.getData('layer-id')
              if (fromId === layer.id) { setDragOverId(null); return }
              const newLayers = [...layers]
              const fromIdx = newLayers.findIndex(l => l.id === fromId)
              const toIdx = newLayers.findIndex(l => l.id === layer.id)
              if (fromIdx === -1 || toIdx === -1) { setDragOverId(null); return }
              const [moved] = newLayers.splice(fromIdx, 1)
              newLayers.splice(toIdx, 0, moved)
              onLayersChange(newLayers)
              setDragOverId(null)
            }}
            isDragOver={dragOverId === layer.id}
          />
        ))}
        <button
          onClick={addLayer}
          style={{ ...btnStyle, marginTop: '8px', textAlign: 'center' }}
        >
          + Add Layer
        </button>
      </div>
    </div>
  )
}

// ---- Single shape selected ----
function ShapePanel({ elementId, svgRef, bindings, onBindingsChange, onElementTransform }: {
  elementId: string
  svgRef: React.RefObject<SVGSVGElement | null>
  bindings: GraphicBindings
  onBindingsChange: (b: GraphicBindings) => void
  onElementTransform?: (id: string, t: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => void
}) {
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [w, setW] = useState(100)
  const [h, setH] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [tagSearch, setTagSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [bindingType, setBindingType] = useState<'color_map' | 'rotation' | 'visibility' | 'display_value'>('display_value')

  const existing: ElementBinding | undefined = bindings[elementId]

  // Read position from SVG
  useEffect(() => {
    if (!svgRef.current || !elementId) return
    const el = svgRef.current.querySelector(`[data-id="${elementId}"]`)
    if (!el) return
    const bbox = (el as SVGGraphicsElement).getBBox?.()
    if (bbox) {
      setX(Math.round(bbox.x))
      setY(Math.round(bbox.y))
      setW(Math.round(bbox.width))
      setH(Math.round(bbox.height))
    }
  }, [elementId, svgRef])

  const applyTransform = (field: string, value: number) => {
    if (!onElementTransform) return
    const t: Record<string, number> = {}
    t[field] = value
    onElementTransform(elementId, t)
  }

  const handlePointSelect = (tag: string, pointId: string) => {
    setTagSearch(tag)
    const mapping = buildMappingForType(bindingType)
    const updated: GraphicBindings = {
      ...bindings,
      [elementId]: {
        point_id: pointId,
        attribute: bindingType === 'color_map' ? 'fill' : bindingType === 'display_value' ? 'text' : bindingType === 'visibility' ? 'visibility' : 'transform',
        mapping,
      },
    }
    onBindingsChange(updated)
  }

  const handleUnbind = () => {
    const updated = { ...bindings }
    delete updated[elementId]
    onBindingsChange(updated)
    setTagSearch('')
  }

  return (
    <div style={scrollAreaStyle}>
      {/* Shape info */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Element ID</label>
        <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', padding: '2px 0', fontFamily: 'monospace' }}>
          {elementId}
        </div>
      </div>

      {/* Position */}
      <div style={sectionDivStyle}>
        <div style={sectionTitleStyle}>Position</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: 'X', value: x, set: setX, field: 'x' },
            { label: 'Y', value: y, set: setY, field: 'y' },
            { label: 'W', value: w, set: setW, field: 'w' },
            { label: 'H', value: h, set: setH, field: 'h' },
          ].map(({ label, value, set, field }) => (
            <div key={label}>
              <label style={labelStyle}>{label}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => { const v = Number(e.target.value); set(v); applyTransform(field, v) }}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: '8px' }}>
          <label style={labelStyle}>Rotation</label>
          <input
            type="number"
            value={rotation}
            onChange={(e) => { const v = Number(e.target.value); setRotation(v); applyTransform('rotation', v) }}
            style={{ ...inputStyle, width: '80px' }}
            min={0}
            max={360}
          />
        </div>
      </div>

      {/* Point Binding */}
      <div style={sectionDivStyle}>
        <div style={sectionTitleStyle}>Point Binding</div>

        {existing && (
          <div style={{
            padding: '8px', marginBottom: '8px',
            background: 'var(--io-accent-subtle)', border: '1px solid var(--io-accent)',
            borderRadius: 'var(--io-radius)', fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="var(--io-success)"/></svg>
              <span style={{ color: 'var(--io-text-primary)', fontWeight: 500 }}>Bound: {String(existing.point_id ?? '').slice(0, 8)}...</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
              {String(existing.attribute ?? '')} / {String((existing.mapping as { type?: string } | undefined)?.type ?? '')}
            </div>
            <button onClick={handleUnbind} style={{ ...btnDangerStyle, marginTop: '6px' }}>Unbind</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '4px', ...fieldGroupStyle }}>
          <input
            placeholder="Tag name..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => setShowPicker(true)}
            title="Open point picker"
            style={{
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)',
              background: 'var(--io-surface-sunken)', cursor: 'pointer', color: 'var(--io-text-secondary)',
              flexShrink: 0, padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" fill="none"/>
              <path d="M7 8V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M5 10H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Binding type */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Binding Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {([
              { value: 'color_map' as const, label: 'Color Map' },
              { value: 'rotation' as const, label: 'Rotation / Position' },
              { value: 'visibility' as const, label: 'Conditional Visibility' },
              { value: 'display_value' as const, label: 'Display Value' },
            ]).map(({ value, label }) => (
              <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--io-text-primary)', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="binding-type"
                  checked={bindingType === value}
                  onChange={() => setBindingType(value)}
                  style={{ margin: 0 }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div style={sectionDivStyle}>
        <div style={sectionTitleStyle}>Appearance</div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Stroke Color</label>
          <input type="text" placeholder="#808080" style={inputStyle} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Stroke Width</label>
          <input type="number" min={0} max={20} step={0.5} defaultValue={1} style={inputStyle} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Fill</label>
          <input type="text" placeholder="none" style={inputStyle} />
        </div>
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Opacity</label>
          <input type="range" min={0} max={1} step={0.01} defaultValue={1} style={{ width: '100%' }} />
        </div>
      </div>

      <PointPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handlePointSelect}
      />
    </div>
  )
}

function buildMappingForType(type: string): BindingMapping {
  switch (type) {
    case 'color_map':
      return { type: 'linear', min: 0, max: 100, color_scale: ['#22c55e', '#ef4444'] }
    case 'rotation':
      return { type: 'rotation', min_value: 0, max_value: 100, min_angle: 0, max_angle: 360, cx: 0, cy: 0 }
    case 'visibility':
      return { type: 'visibility', visible_when: 'nonzero' }
    default:
      return { type: 'text', decimal_places: 2 }
  }
}

// ---- Multiple selected ----
function MultiSelectPanel({ count, onGroup, onDelete, onAlign, onDistribute }: {
  count: number
  onGroup?: () => void
  onDelete?: () => void
  onAlign?: (a: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  onDistribute?: (d: 'horizontal' | 'vertical') => void
}) {
  return (
    <div style={scrollAreaStyle}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '12px' }}>
        {count} items selected
      </div>

      {/* Alignment */}
      <div style={sectionTitleStyle}>Align</div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {([
          { key: 'left' as const, title: 'Align left', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="2" y1="1" x2="2" y2="13" stroke="currentColor" strokeWidth="1.5"/><rect x="4" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="4" y="8" width="5" height="3" rx="0.5" fill="currentColor"/></svg> },
          { key: 'center' as const, title: 'Align center', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1"/><rect x="2" y="3" width="10" height="3" rx="0.5" fill="currentColor"/><rect x="3.5" y="8" width="7" height="3" rx="0.5" fill="currentColor"/></svg> },
          { key: 'right' as const, title: 'Align right', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="12" y1="1" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="3" width="8" height="3" rx="0.5" fill="currentColor"/><rect x="5" y="8" width="5" height="3" rx="0.5" fill="currentColor"/></svg> },
          { key: 'top' as const, title: 'Align top', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="2" x2="13" y2="2" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="4" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="4" width="3" height="5" rx="0.5" fill="currentColor"/></svg> },
          { key: 'middle' as const, title: 'Align middle', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1"/><rect x="3" y="2" width="3" height="10" rx="0.5" fill="currentColor"/><rect x="8" y="3.5" width="3" height="7" rx="0.5" fill="currentColor"/></svg> },
          { key: 'bottom' as const, title: 'Align bottom', icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="2" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="8" y="5" width="3" height="5" rx="0.5" fill="currentColor"/></svg> },
        ]).map(({ key, title, icon }) => (
          <button
            key={key}
            title={title}
            onClick={() => onAlign?.(key)}
            style={alignBtnStyle}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Distribute */}
      <div style={sectionTitleStyle}>Distribute</div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button title="Distribute horizontally" onClick={() => onDistribute?.('horizontal')} style={alignBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="3" height="6" rx="0.5" fill="currentColor"/>
            <rect x="5.5" y="4" width="3" height="6" rx="0.5" fill="currentColor"/>
            <rect x="10" y="4" width="3" height="6" rx="0.5" fill="currentColor"/>
          </svg>
        </button>
        <button title="Distribute vertically" onClick={() => onDistribute?.('vertical')} style={alignBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4" y="1" width="6" height="3" rx="0.5" fill="currentColor"/>
            <rect x="4" y="5.5" width="6" height="3" rx="0.5" fill="currentColor"/>
            <rect x="4" y="10" width="6" height="3" rx="0.5" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={onGroup} style={btnAccentStyle}>Group (Ctrl+G)</button>
        <button onClick={onDelete} style={btnDangerStyle}>Delete</button>
      </div>
    </div>
  )
}

// ---- Main component ----
export default function PropertyPanel({
  selectedIds,
  svgRef,
  bindings,
  onBindingsChange,
  mode,
  graphicName,
  onGraphicNameChange,
  canvasWidth,
  canvasHeight,
  onCanvasSizeChange,
  layers,
  onLayersChange,
  onElementTransform,
  onGroup,
  onDeleteSelected,
  onAlign,
  onDistribute,
}: PropertyPanelProps) {
  // Mode is used to conditionally show binding options in the future
  void mode
  // Nothing selected -> global + layers
  if (selectedIds.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--io-border)', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Properties
        </div>
        <GlobalPanel
          graphicName={graphicName}
          onGraphicNameChange={onGraphicNameChange}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onCanvasSizeChange={onCanvasSizeChange}
          layers={layers}
          onLayersChange={onLayersChange}
        />
      </div>
    )
  }

  // Multiple selected
  if (selectedIds.length > 1) {
    return (
      <div style={panelStyle}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--io-border)', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Selection
        </div>
        <MultiSelectPanel
          count={selectedIds.length}
          onGroup={onGroup}
          onDelete={onDeleteSelected}
          onAlign={onAlign}
          onDistribute={onDistribute}
        />
      </div>
    )
  }

  // Single selected
  const primaryId = selectedIds[0]
  return (
    <div style={panelStyle}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--io-border)', fontSize: '12px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
        Shape Properties
      </div>
      <ShapePanel
        elementId={primaryId}
        svgRef={svgRef}
        bindings={bindings}
        onBindingsChange={onBindingsChange}
        onElementTransform={onElementTransform}
      />
    </div>
  )
}
