/**
 * DesignerLeftPalette.tsx
 *
 * Left sidebar with three sections:
 *  1. Equipment — shape library with search + category groups
 *  2. Display Elements — 6 draggable element type tiles
 *  3. Layers — layer list with visibility/lock toggles, rename, add
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useLibraryStore, useSceneStore, useHistoryStore } from '../../store/designer'
import type { ShapeIndexItem } from '../../store/designer'
import type { DisplayElementType } from '../../shared/types/graphics'
import {
  AddLayerCommand,
  ChangeLayerPropertyCommand,
  ReorderNodeCommand,
} from '../../shared/graphics/commands'
import type { LayerDefinition } from '../../shared/types/graphics'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerLeftPaletteProps {
  collapsed: boolean
  width: number
}

// ---------------------------------------------------------------------------
// Small inline icons
// ---------------------------------------------------------------------------

function IconEye({ visible }: { visible: boolean }) {
  return visible ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <ellipse cx="7" cy="7" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M4.5 4.5A5.5 4 0 0114 7c-.8 1.5-2.5 3-5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function IconLock({ locked }: { locked: boolean }) {
  return locked ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="6" width="8" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="6" width="8" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M4.5 6V4.5a2.5 2.5 0 015 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
    >
      <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '6px 10px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--io-border)',
        color: 'var(--io-text-muted)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        textAlign: 'left',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-surface-elevated)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <IconChevron open={open} />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Skeleton tile for loading state
// ---------------------------------------------------------------------------

function SkeletonTile() {
  return (
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 'var(--io-radius)',
      background: 'var(--io-surface-elevated)',
      animation: 'pulse 1.4s ease-in-out infinite',
    }} />
  )
}

// ---------------------------------------------------------------------------
// Shape tile
// ---------------------------------------------------------------------------

function ShapeTile({
  item,
  collapsed,
}: {
  item: ShapeIndexItem
  collapsed: boolean
}) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Initiate a custom drag event the canvas can listen for
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setAttribute('data-dragging', 'true')

    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      padding: 4px 8px;
      background: var(--io-accent);
      color: #09090b;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      transform: translate(-50%, -50%);
      left: ${e.clientX}px;
      top: ${e.clientY}px;
    `
    ghost.textContent = item.label
    ghost.id = 'io-drag-ghost'
    document.body.appendChild(ghost)

    const onMove = (ev: MouseEvent) => {
      ghost.style.left = `${ev.clientX}px`
      ghost.style.top  = `${ev.clientY}px`
      // Dispatch a custom event so DesignerCanvas can track the drop target
      document.dispatchEvent(new CustomEvent('io:shape-drag-move', {
        detail: { shapeId: item.id, x: ev.clientX, y: ev.clientY },
      }))
    }

    const onUp = (ev: MouseEvent) => {
      ghost.remove()
      el.removeAttribute('data-dragging')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.dispatchEvent(new CustomEvent('io:shape-drop', {
        detail: { shapeId: item.id, x: ev.clientX, y: ev.clientY },
      }))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [item.id, item.label])

  if (collapsed) {
    return (
      <div
        onMouseDown={handleMouseDown}
        title={item.label}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          cursor: 'grab',
          fontSize: 10,
          color: 'var(--io-text-muted)',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {item.label.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      title={item.label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        width: 48,
        height: 48,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        fontSize: 9,
        color: 'var(--io-text-muted)',
        overflow: 'hidden',
        userSelect: 'none',
        padding: 2,
        textAlign: 'center',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
    >
      <div style={{ fontSize: 18, lineHeight: 1 }}>⬡</div>
      <div style={{ fontSize: 9, lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%' }}>
        {item.label.length > 12 ? item.label.slice(0, 11) + '…' : item.label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Display element types
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPES: Array<{ type: DisplayElementType; label: string; icon: string }> = [
  { type: 'text_readout',    label: 'Text Readout',    icon: '123' },
  { type: 'analog_bar',      label: 'Analog Bar',      icon: '▐▌' },
  { type: 'fill_gauge',      label: 'Fill Gauge',      icon: '▓' },
  { type: 'sparkline',       label: 'Sparkline',       icon: '∿' },
  { type: 'alarm_indicator', label: 'Alarm Indicator', icon: '⚠' },
  { type: 'digital_status',  label: 'Digital Status',  icon: '●' },
]

function DisplayElementTile({
  type,
  label,
  icon,
  collapsed,
}: {
  type: DisplayElementType
  label: string
  icon: string
  collapsed: boolean
}) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9999;
      padding: 4px 8px; background: var(--io-accent); color: #09090b;
      border-radius: 4px; font-size: 11px; font-weight: 600;
      transform: translate(-50%,-50%); left:${e.clientX}px; top:${e.clientY}px;
    `
    ghost.textContent = label
    document.body.appendChild(ghost)

    const onMove = (ev: MouseEvent) => {
      ghost.style.left = `${ev.clientX}px`
      ghost.style.top  = `${ev.clientY}px`
      document.dispatchEvent(new CustomEvent('io:display-element-drag-move', {
        detail: { elementType: type, x: ev.clientX, y: ev.clientY },
      }))
    }
    const onUp = (ev: MouseEvent) => {
      ghost.remove()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.dispatchEvent(new CustomEvent('io:display-element-drop', {
        detail: { elementType: type, x: ev.clientX, y: ev.clientY },
      }))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [type, label])

  const size = collapsed ? 32 : 48

  return (
    <div
      onMouseDown={handleMouseDown}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        width: size,
        height: size,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        fontSize: collapsed ? 14 : 18,
        color: 'var(--io-text-secondary)',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
    >
      <span>{icon}</span>
      {!collapsed && (
        <span style={{ fontSize: 9, color: 'var(--io-text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
          {label.length > 10 ? label.slice(0, 9) + '…' : label}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layer row
// ---------------------------------------------------------------------------

function LayerRow({
  layer,
  onVisibilityToggle,
  onLockToggle,
  onRename,
}: {
  layer: LayerDefinition
  onVisibilityToggle: () => void
  onLockToggle: () => void
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(layer.name)

  function commitRename() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== layer.name) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        height: 28,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-surface-elevated)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Visibility */}
      <button
        onClick={onVisibilityToggle}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
          color: layer.visible ? 'var(--io-text-secondary)' : 'var(--io-text-muted)',
          padding: 0,
        }}
      >
        <IconEye visible={layer.visible} />
      </button>

      {/* Lock */}
      <button
        onClick={onLockToggle}
        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
          color: layer.locked ? 'var(--io-accent)' : 'var(--io-text-muted)',
          padding: 0,
        }}
      >
        <IconLock locked={layer.locked} />
      </button>

      {/* Name */}
      {editing ? (
        <input
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
          style={{
            flex: 1,
            background: 'var(--io-surface)',
            border: '1px solid var(--io-accent)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-primary)',
            fontSize: 12,
            padding: '1px 4px',
            outline: 'none',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => { setEditValue(layer.name); setEditing(true) }}
          style={{
            flex: 1,
            fontSize: 12,
            color: layer.visible ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            cursor: 'default',
            userSelect: 'none',
          }}
          title={layer.name}
        >
          {layer.name}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Equipment section
// ---------------------------------------------------------------------------

function EquipmentSection({ collapsed }: { collapsed: boolean }) {
  const index        = useLibraryStore(s => s.index)
  const indexLoaded  = useLibraryStore(s => s.indexLoaded)
  const indexLoading = useLibraryStore(s => s.indexLoading)
  const indexError   = useLibraryStore(s => s.indexError)
  const loadIndex    = useLibraryStore(s => s.loadIndex)
  const getCategories = useLibraryStore(s => s.getCategories)

  const [search, setSearch] = useState('')
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadIndex()
  }, [loadIndex])

  function toggleCat(cat: string) {
    setOpenCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const categories = getCategories()

  // Filter by search term
  const filtered = search.trim().length > 0
    ? index.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase())
      )
    : null

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px', alignItems: 'center' }}>
        {indexLoading && Array.from({ length: 4 }, (_, i) => <SkeletonTile key={i} />)}
        {indexLoaded && index.slice(0, 8).map(item => (
          <ShapeTile key={item.id} item={item} collapsed />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* Search */}
      <div style={{ padding: '6px 8px', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shapes…"
          style={{
            width: '100%',
            padding: '4px 8px',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-primary)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {indexLoading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8 }}>
            {Array.from({ length: 12 }, (_, i) => <SkeletonTile key={i} />)}
          </div>
        )}

        {indexError && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: '#ef4444' }}>
            Failed to load shapes. {indexError}
          </div>
        )}

        {indexLoaded && filtered !== null && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8 }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--io-text-muted)', padding: '4px 0' }}>No results</div>
            ) : (
              filtered.map(item => <ShapeTile key={item.id} item={item} collapsed={false} />)
            )}
          </div>
        )}

        {indexLoaded && filtered === null && (
          Array.from(categories.entries()).map(([cat, items]) => {
            const isOpen = openCats.has(cat)
            return (
              <div key={cat}>
                <button
                  onClick={() => toggleCat(cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '4px 8px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--io-border)',
                    color: 'var(--io-text-secondary)',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-surface-elevated)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <IconChevron open={isOpen} />
                  <span style={{ textTransform: 'capitalize' }}>{cat}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--io-text-muted)' }}>{items.length}</span>
                </button>
                {isOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8 }}>
                    {items.map(item => <ShapeTile key={item.id} item={item} collapsed={false} />)}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layers section
// ---------------------------------------------------------------------------

function LayersSection({ collapsed }: { collapsed: boolean }) {
  const doc     = useSceneStore(s => s.doc)
  const execute = useSceneStore(s => s.execute)
  const push    = useHistoryStore(s => s.push)

  function executeAndRecord<T extends { description: string; execute(d: import('../../shared/types/graphics').GraphicDocument): import('../../shared/types/graphics').GraphicDocument; undo(d: import('../../shared/types/graphics').GraphicDocument): import('../../shared/types/graphics').GraphicDocument }>(cmd: T) {
    if (!doc) return
    const before = doc
    execute(cmd)
    push(cmd, before)
  }

  function handleVisibilityToggle(layer: LayerDefinition) {
    executeAndRecord(new ChangeLayerPropertyCommand(
      layer.id,
      { visible: !layer.visible },
      { visible: layer.visible },
    ))
  }

  function handleLockToggle(layer: LayerDefinition) {
    executeAndRecord(new ChangeLayerPropertyCommand(
      layer.id,
      { locked: !layer.locked },
      { locked: layer.locked },
    ))
  }

  function handleRename(layer: LayerDefinition, name: string) {
    executeAndRecord(new ChangeLayerPropertyCommand(
      layer.id,
      { name },
      { name: layer.name },
    ))
  }

  function handleAddLayer() {
    if (!doc) return
    const newLayer: LayerDefinition = {
      id: crypto.randomUUID(),
      name: `Layer ${(doc.layers.length + 1)}`,
      visible: true,
      locked: false,
      order: doc.layers.length,
    }
    executeAndRecord(new AddLayerCommand(newLayer))
  }

  function handleDragLayer(fromIdx: number, toIdx: number) {
    if (!doc || fromIdx === toIdx) return
    executeAndRecord(new ReorderNodeCommand(toIdx, fromIdx, null))
  }

  const layers = doc?.layers ?? []

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 2px', alignItems: 'center' }}>
        {layers.map(layer => (
          <div
            key={layer.id}
            title={layer.name}
            style={{
              width: 24, height: 24,
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--io-text-muted)',
            }}
          >
            {layer.name.slice(0, 1).toUpperCase()}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            onVisibilityToggle={() => handleVisibilityToggle(layer)}
            onLockToggle={() => handleLockToggle(layer)}
            onRename={name => handleRename(layer, name)}
          />
        ))}
        {layers.length === 0 && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--io-text-muted)' }}>
            No layers
          </div>
        )}
      </div>
      <button
        onClick={handleAddLayer}
        disabled={!doc}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '6px 10px',
          background: 'transparent',
          border: 'none',
          borderTop: '1px solid var(--io-border)',
          color: 'var(--io-text-muted)',
          fontSize: 12,
          cursor: doc ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (doc) e.currentTarget.style.background = 'var(--io-surface-elevated)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <IconPlus />
        Add Layer
      </button>
    </div>
  )

  // Suppressed: handleDragLayer declared but not yet wired to actual drag UI
  void handleDragLayer
}

// ---------------------------------------------------------------------------
// Stencils section
// ---------------------------------------------------------------------------

interface StencilItem {
  id: string
  name: string
}

function StencilTile({ item, collapsed }: { item: StencilItem; collapsed: boolean }) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9999;
      padding: 4px 8px; background: var(--io-accent); color: #09090b;
      border-radius: 4px; font-size: 11px; font-weight: 600;
      transform: translate(-50%,-50%); left:${e.clientX}px; top:${e.clientY}px;
    `
    ghost.textContent = item.name
    document.body.appendChild(ghost)
    const onMove = (ev: MouseEvent) => {
      ghost.style.left = `${ev.clientX}px`
      ghost.style.top  = `${ev.clientY}px`
    }
    const onUp = (ev: MouseEvent) => {
      ghost.remove()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.dispatchEvent(new CustomEvent('io:stencil-drop', {
        detail: { stencilId: item.id, x: ev.clientX, y: ev.clientY },
      }))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [item.id, item.name])

  if (collapsed) {
    return (
      <div
        onMouseDown={handleMouseDown}
        title={item.name}
        style={{
          width: 28, height: 28,
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: 'var(--io-text-muted)', cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {item.name.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      title={item.name}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, width: 64, height: 48,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab', fontSize: 9, color: 'var(--io-text-muted)',
        userSelect: 'none', padding: 4, textAlign: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
    >
      <div style={{ fontSize: 16 }}>⬜</div>
      <div style={{ fontSize: 9, lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%' }}>
        {item.name.length > 10 ? item.name.slice(0, 9) + '…' : item.name}
      </div>
    </div>
  )
}

function StencilsSection({ collapsed }: { collapsed: boolean }) {
  // Stencils are fetched from design_objects with type='stencil'.
  // The API endpoint doesn't yet support type filtering, so we use an empty list
  // as a placeholder. When the API is ready, replace with a TanStack Query call.
  const stencils: StencilItem[] = []

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: 4 }}>
        {stencils.map(s => <StencilTile key={s.id} item={s} collapsed />)}
      </div>
    )
  }

  if (stencils.length === 0) {
    return (
      <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
        No stencils saved yet.<br />
        Select elements → right-click → "Save as Stencil…"
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, flexShrink: 0 }}>
      {stencils.map(s => <StencilTile key={s.id} item={s} collapsed={false} />)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DesignerLeftPalette({ collapsed, width }: DesignerLeftPaletteProps) {
  const [equipOpen,    setEquipOpen]    = useState(true)
  const [stencilsOpen, setStencilsOpen] = useState(false)
  const [elemOpen,     setElemOpen]     = useState(true)
  const [layersOpen,   setLayersOpen]   = useState(true)

  if (collapsed) {
    return (
      <div style={{ width, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--io-surface)', borderRight: '1px solid var(--io-border)' }}>
        <EquipmentSection collapsed />
        <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
        <StencilsSection collapsed />
        <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4 }}>
          {DISPLAY_ELEMENT_TYPES.map(t => (
            <DisplayElementTile key={t.type} {...t} collapsed />
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
        <LayersSection collapsed />
      </div>
    )
  }

  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--io-surface)', borderRight: '1px solid var(--io-border)' }}>

      {/* Equipment section */}
      <SectionHeader label="Equipment" open={equipOpen} onToggle={() => setEquipOpen(v => !v)} />
      {equipOpen && (
        <div style={{ flex: '1 1 0', minHeight: 100, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <EquipmentSection collapsed={false} />
        </div>
      )}

      {/* Stencils section */}
      <SectionHeader label="Stencils" open={stencilsOpen} onToggle={() => setStencilsOpen(v => !v)} />
      {stencilsOpen && <StencilsSection collapsed={false} />}

      {/* Display Elements section */}
      <SectionHeader label="Display Elements" open={elemOpen} onToggle={() => setElemOpen(v => !v)} />
      {elemOpen && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, flexShrink: 0 }}>
          {DISPLAY_ELEMENT_TYPES.map(t => (
            <DisplayElementTile key={t.type} {...t} collapsed={false} />
          ))}
        </div>
      )}

      {/* Layers section */}
      <SectionHeader label="Layers" open={layersOpen} onToggle={() => setLayersOpen(v => !v)} />
      {layersOpen && <LayersSection collapsed={false} />}
    </div>
  )
}
