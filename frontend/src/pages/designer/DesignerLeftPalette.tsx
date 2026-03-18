/**
 * DesignerLeftPalette.tsx
 *
 * Left sidebar with three sections:
 *  1. Equipment — shape library with search + category groups
 *  2. Display Elements — 6 draggable element type tiles
 *  3. Layers — layer list with visibility/lock toggles, rename, add
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useLibraryStore, useSceneStore, useHistoryStore } from '../../store/designer'
import type { ShapeIndexItem } from '../../store/designer'
import type { DisplayElementType, WidgetType } from '../../shared/types/graphics'
import { graphicsApi } from '../../api/graphics'
import { pointsApi } from '../../api/points'
import type { PointMeta } from '../../api/points'
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

// ---------------------------------------------------------------------------
// SVG Thumbnail helper
// ---------------------------------------------------------------------------

function SvgThumbnail({ svgText, size }: { svgText: string; size: number }) {
  // Extract viewBox from the SVG string (needed for proper scaling)
  const viewBox = useMemo(() => {
    const m = svgText.match(/viewBox=["']([^"']+)["']/)
    return m ? m[1] : '0 0 100 100'
  }, [svgText])

  // Extract inner SVG content (everything between <svg ...> and </svg>)
  const inner = useMemo(() => {
    const m = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
    return m ? m[1] : ''
  }, [svgText])

  if (!inner) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      style={{ pointerEvents: 'none', overflow: 'visible', flexShrink: 0 }}
      // SVG equipment shapes use #808080 stroke which is fine on dark bg
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

function ShapeTile({
  item,
  collapsed,
}: {
  item: ShapeIndexItem
  collapsed: boolean
}) {
  const shape = useLibraryStore(s => s.cache.get(item.id) ?? null)
  const loadShape = useLibraryStore(s => s.loadShape)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!shape) {
      void loadShape(item.id)
    }
  }, [item.id, shape, loadShape])

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
          overflow: 'hidden',
          userSelect: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
      >
        {shape?.svg
          ? <SvgThumbnail svgText={shape.svg} size={26} />
          : <span style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>{item.label.slice(0, 2).toUpperCase()}</span>
        }
      </div>
    )
  }

  return (
    <>
      <div
        onMouseDown={handleMouseDown}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        title={item.label}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          width: 64,
          height: 64,
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          cursor: 'grab',
          overflow: 'hidden',
          userSelect: 'none',
          padding: 4,
          textAlign: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
      >
        {shape?.svg
          ? <SvgThumbnail svgText={shape.svg} size={36} />
          : <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.25 }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="5" width="16" height="10" rx="1" stroke="#808080" strokeWidth="1.5" fill="none"/>
              </svg>
            </div>
        }
        <div style={{ fontSize: 9, lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%', color: 'var(--io-text-muted)' }}>
          {item.label.length > 12 ? item.label.slice(0, 11) + '…' : item.label}
        </div>
      </div>

      {/* Shape context menu */}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 9999,
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            minWidth: 140,
            padding: '4px 0',
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <button
            onClick={async () => {
              setCtxMenu(null)
              try {
                const svgContent = await graphicsApi.exportShapeSvg(item.id)
                const blob = new Blob([svgContent], { type: 'image/svg+xml' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${item.id}.svg`
                a.click()
                URL.revokeObjectURL(url)
              } catch (err) {
                console.error('SVG export failed:', err)
              }
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--io-text-primary)',
              fontSize: 12,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-surface)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            Export SVG
          </button>
          {item.source !== 'library' && (
            <button
              onClick={() => {
                setCtxMenu(null)
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.svg,image/svg+xml'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  const result = await graphicsApi.reimportShapeSvg(item.id, text).catch(() => null)
                  if (result?.success && result.data.data.viewBoxChanged) {
                    alert('Shape dimensions changed significantly. Connection points and value anchors may need repositioning.')
                  }
                }
                input.click()
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--io-text-primary)',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-surface)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              Replace SVG…
            </button>
          )}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Display element types
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPES: Array<{ type: DisplayElementType; label: string }> = [
  { type: 'text_readout',      label: 'Text Readout'    },
  { type: 'analog_bar',        label: 'Analog Bar'      },
  { type: 'fill_gauge',        label: 'Fill Gauge'      },
  { type: 'sparkline',         label: 'Sparkline'       },
  { type: 'alarm_indicator',   label: 'Alarm Indicator' },
  { type: 'digital_status',    label: 'Digital Status'  },
]

// Spec-accurate mini SVG previews for each display element type
function DisplayElementPreview({ type, size }: { type: DisplayElementType; size: number }) {
  const s = size
  switch (type) {
    case 'text_readout':
      // Box with "123.4" value text
      return (
        <svg width={s} height={Math.round(s * 0.5)} viewBox="0 0 60 22" style={{ pointerEvents: 'none' }}>
          <rect x="0" y="0" width="60" height="22" rx="2" fill="#27272A" stroke="#3F3F46" strokeWidth="1"/>
          <text x="30" y="14" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#A1A1AA">123.4</text>
          <text x="50" y="14" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#71717A">°F</text>
        </svg>
      )
    case 'analog_bar':
      // Vertical bar with zones and pointer
      return (
        <svg width={Math.round(s * 0.45)} height={s} viewBox="0 0 20 46" style={{ pointerEvents: 'none' }}>
          <rect x="2" y="0" width="14" height="46" fill="#27272A" stroke="#52525B" strokeWidth="0.5"/>
          <rect x="3" y="1" width="12" height="7" fill="#5C3A3A"/>
          <rect x="3" y="8" width="12" height="10" fill="#5C4A32"/>
          <rect x="3" y="18" width="12" height="14" fill="#404048"/>
          <rect x="3" y="32" width="12" height="7" fill="#32445C"/>
          <rect x="3" y="39" width="12" height="6" fill="#2E3A5C"/>
          <polygon points="16,21 22,24 16,27" fill="#A1A1AA"/>
          <line x1="3" y1="24" x2="15" y2="24" stroke="#A1A1AA" strokeWidth="0.8"/>
        </svg>
      )
    case 'fill_gauge':
      // Vertical bar with fill
      return (
        <svg width={Math.round(s * 0.45)} height={s} viewBox="0 0 20 46" style={{ pointerEvents: 'none' }}>
          <rect x="2" y="0" width="14" height="46" rx="1" fill="none" stroke="#52525B" strokeWidth="0.5"/>
          <rect x="3" y="16" width="12" height="29" rx="0.5" fill="#475569" opacity="0.6"/>
          <line x1="3" y1="16" x2="15" y2="16" stroke="#64748B" strokeWidth="0.8" strokeDasharray="3 2"/>
        </svg>
      )
    case 'sparkline':
      // Sparkline chart
      return (
        <svg width={s} height={Math.round(s * 0.4)} viewBox="0 0 60 16" style={{ pointerEvents: 'none' }}>
          <rect x="0" y="0" width="60" height="16" rx="1" fill="#27272A"/>
          <polyline points="3,12 10,9 17,11 24,6 31,8 38,4 45,9 52,7 59,10"
            fill="none" stroke="#A1A1AA" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      )
    case 'alarm_indicator':
      // ISA-101 alarm shapes
      return (
        <svg width={s} height={Math.round(s * 0.6)} viewBox="0 0 52 24" style={{ pointerEvents: 'none' }}>
          <rect x="1" y="3" width="16" height="12" rx="1.5" fill="none" stroke="#EF4444" strokeWidth="1.5"/>
          <text x="9" y="11" textAnchor="middle" fontFamily="monospace" fontSize="7" fontWeight="600" fill="#EF4444">1</text>
          <polygon points="27,2 37,18 17,18" fill="none" stroke="#F97316" strokeWidth="1.5"/>
          <text x="27" y="14" textAnchor="middle" fontFamily="monospace" fontSize="7" fontWeight="600" fill="#F97316">2</text>
          <ellipse cx="46" cy="12" rx="5" ry="4" fill="none" stroke="#06B6D4" strokeWidth="1.5"/>
          <text x="46" y="14" textAnchor="middle" fontFamily="monospace" fontSize="7" fontWeight="600" fill="#06B6D4">4</text>
        </svg>
      )
    case 'digital_status':
      // Pill with RUN / STOP
      return (
        <svg width={s} height={Math.round(s * 0.55)} viewBox="0 0 56 24" style={{ pointerEvents: 'none' }}>
          <rect x="1" y="5" width="24" height="14" rx="2" fill="#3F3F46"/>
          <text x="13" y="14" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#A1A1AA">OPEN</text>
          <rect x="29" y="5" width="26" height="14" rx="2" fill="#059669"/>
          <text x="42" y="14" textAnchor="middle" fontFamily="monospace" fontSize="8" fill="#F9FAFB">RUN</text>
        </svg>
      )
    default:
      return <span style={{ fontSize: Math.round(s * 0.4), color: 'var(--io-text-muted)' }}>⊞</span>
  }
}

function DisplayElementTile({
  type,
  label,
  collapsed,
}: {
  type: DisplayElementType
  label: string
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

  if (collapsed) {
    return (
      <div
        onMouseDown={handleMouseDown}
        title={label}
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
          overflow: 'hidden',
          userSelect: 'none',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
      >
        <DisplayElementPreview type={type} size={26} />
      </div>
    )
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: 72,
        height: 64,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        overflow: 'hidden',
        userSelect: 'none',
        padding: 4,
        textAlign: 'center',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
    >
      <DisplayElementPreview type={type} size={40} />
      <span style={{ fontSize: 9, color: 'var(--io-text-muted)', lineHeight: 1.2, textAlign: 'center' }}>
        {label.length > 12 ? label.slice(0, 11) + '…' : label}
      </span>
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
  const [stencils, setStencils] = useState<StencilItem[]>([])

  useEffect(() => {
    graphicsApi.listStencils().then(result => {
      if (result.success) {
        setStencils(result.data.data.map(s => ({ id: s.id, name: s.name })))
      }
    }).catch(() => {/* silent — stencil list is non-critical */})
  }, [])

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
// Widget types (dashboard / report modes)
// ---------------------------------------------------------------------------

const WIDGET_TYPES: Array<{ type: WidgetType; label: string; icon: string }> = [
  { type: 'trend',        label: 'Trend',        icon: '∿' },
  { type: 'table',        label: 'Table',        icon: '⊞' },
  { type: 'gauge',        label: 'Gauge',        icon: '◎' },
  { type: 'kpi_card',     label: 'KPI Card',     icon: '#' },
  { type: 'bar_chart',    label: 'Bar Chart',    icon: '▊' },
  { type: 'pie_chart',    label: 'Pie Chart',    icon: '◔' },
  { type: 'alarm_list',   label: 'Alarm List',   icon: '⚠' },
  { type: 'muster_point', label: 'Muster Point', icon: '⛺' },
]

function WidgetTile({
  type,
  label,
  icon,
  collapsed,
}: {
  type: WidgetType
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
    }
    const onUp = (ev: MouseEvent) => {
      ghost.remove()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.dispatchEvent(new CustomEvent('io:widget-drop', {
        detail: { widgetType: type, x: ev.clientX, y: ev.clientY },
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
        fontSize: collapsed ? 14 : 20,
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

function WidgetsSection({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px', alignItems: 'center' }}>
        {WIDGET_TYPES.map(w => <WidgetTile key={w.type} {...w} collapsed />)}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, flexShrink: 0 }}>
      {WIDGET_TYPES.map(w => <WidgetTile key={w.type} {...w} collapsed={false} />)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Report Elements section (report mode only)
// ---------------------------------------------------------------------------

type ReportElementDef = {
  elementType: 'text_block' | 'section_break' | 'page_break' | 'header' | 'footer'
  label: string
}

const REPORT_ELEMENTS: ReportElementDef[] = [
  { elementType: 'text_block',    label: 'Text Block' },
  { elementType: 'section_break', label: 'Section Break' },
  { elementType: 'page_break',    label: 'Page Break' },
  { elementType: 'header',        label: 'Header' },
  { elementType: 'footer',        label: 'Footer' },
]

function ReportElementPreview({ elementType, size }: { elementType: ReportElementDef['elementType']; size: number }) {
  switch (elementType) {
    case 'text_block':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={{ pointerEvents: 'none' }}>
          <rect x={2} y={2} width={36} height={36} rx={2} fill="#27272A" stroke="#3F3F46" strokeWidth={1}/>
          <line x1={6} y1={10} x2={34} y2={10} stroke="#71717A" strokeWidth={1.5} strokeLinecap="round"/>
          <line x1={6} y1={16} x2={30} y2={16} stroke="#71717A" strokeWidth={1.5} strokeLinecap="round"/>
          <line x1={6} y1={22} x2={34} y2={22} stroke="#71717A" strokeWidth={1.5} strokeLinecap="round"/>
          <line x1={6} y1={28} x2={22} y2={28} stroke="#71717A" strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
      )
    case 'section_break':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={{ pointerEvents: 'none' }}>
          <line x1={4} y1={20} x2={36} y2={20} stroke="#6366f1" strokeWidth={2} strokeLinecap="round"/>
          <line x1={4} y1={14} x2={36} y2={14} stroke="#3F3F46" strokeWidth={1} strokeLinecap="round"/>
          <line x1={4} y1={26} x2={36} y2={26} stroke="#3F3F46" strokeWidth={1} strokeLinecap="round"/>
        </svg>
      )
    case 'page_break':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={{ pointerEvents: 'none' }}>
          <line x1={4} y1={20} x2={36} y2={20} stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeDasharray="4,3"/>
          <text x={20} y={16} textAnchor="middle" fontSize={6} fill="#EF4444" fontWeight={600}>PAGE BREAK</text>
        </svg>
      )
    case 'header':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={{ pointerEvents: 'none' }}>
          <rect x={2} y={2} width={36} height={12} rx={2} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1}/>
          <line x1={6} y1={8} x2={26} y2={8} stroke="#93c5fd" strokeWidth={1.5} strokeLinecap="round"/>
          <line x1={2} y1={16} x2={38} y2={16} stroke="#3F3F46" strokeWidth={1} strokeLinecap="round" strokeDasharray="3,2"/>
          <line x1={6} y1={22} x2={34} y2={22} stroke="#52525B" strokeWidth={1} strokeLinecap="round"/>
          <line x1={6} y1={27} x2={30} y2={27} stroke="#52525B" strokeWidth={1} strokeLinecap="round"/>
        </svg>
      )
    case 'footer':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={{ pointerEvents: 'none' }}>
          <line x1={6} y1={10} x2={34} y2={10} stroke="#52525B" strokeWidth={1} strokeLinecap="round"/>
          <line x1={6} y1={16} x2={30} y2={16} stroke="#52525B" strokeWidth={1} strokeLinecap="round"/>
          <line x1={2} y1={22} x2={38} y2={22} stroke="#3F3F46" strokeWidth={1} strokeLinecap="round" strokeDasharray="3,2"/>
          <rect x={2} y={26} width={36} height={12} rx={2} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1}/>
          <line x1={6} y1={32} x2={26} y2={32} stroke="#93c5fd" strokeWidth={1.5} strokeLinecap="round"/>
        </svg>
      )
  }
}

function ReportElementTile({ elementType, label, collapsed }: ReportElementDef & { collapsed: boolean }) {
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
    }
    const onUp = (ev: MouseEvent) => {
      ghost.remove()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.dispatchEvent(new CustomEvent('io:report-element-drop', {
        detail: { elementType, x: ev.clientX, y: ev.clientY },
      }))
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [elementType, label])

  const size = collapsed ? 32 : 48
  const previewSize = collapsed ? 20 : 32

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
        color: 'var(--io-text-secondary)',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)' }}
    >
      <ReportElementPreview elementType={elementType} size={previewSize} />
      {!collapsed && (
        <span style={{ fontSize: 8, color: 'var(--io-text-muted)', textAlign: 'center', lineHeight: 1.1 }}>
          {label.length > 11 ? label.slice(0, 10) + '…' : label}
        </span>
      )}
    </div>
  )
}

function ReportElementsSection({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px', alignItems: 'center' }}>
        {REPORT_ELEMENTS.map(r => <ReportElementTile key={r.elementType} {...r} collapsed />)}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, flexShrink: 0 }}>
      {REPORT_ELEMENTS.map(r => <ReportElementTile key={r.elementType} {...r} collapsed={false} />)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Point Browser — for Quick Bind (drag point onto symbol with valueAnchors)
// ---------------------------------------------------------------------------

function PointBrowserSection({ collapsed }: { collapsed: boolean }) {
  const [search, setSearch] = useState('')
  const [points, setPoints] = useState<PointMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 30

  const fetchPoints = useCallback(async (q: string, p: number) => {
    setLoading(true)
    const result = await pointsApi.list({ search: q || undefined, page: p, limit: PAGE_SIZE }).catch(() => null)
    if (result?.success) {
      setPoints(prev => p === 1 ? result.data.data : [...prev, ...result.data.data])
      setTotal(result.data.pagination.total)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchPoints(search, 1)
    }, 250)
    return () => clearTimeout(timer)
  }, [search, fetchPoints])

  if (collapsed) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 14 }} title="Points">
        ⌗
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 6px',
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text-primary)',
    fontSize: 11,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '4px 8px' }}>
        <input
          type="search"
          placeholder="Search points…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {points.map(pt => (
          <div
            key={pt.id}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('application/io-point', JSON.stringify({
                type: 'point',
                pointId: pt.id,
                tagname: pt.tagname,
                displayName: pt.display_name ?? pt.tagname,
                unit: pt.unit ?? '',
              }))
              e.dataTransfer.effectAllowed = 'copy'
            }}
            title={`${pt.tagname}${pt.unit ? ` [${pt.unit}]` : ''}`}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'grab',
              borderBottom: '1px solid var(--io-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <span style={{ color: 'var(--io-text-primary)', fontFamily: 'var(--io-font-mono)', fontSize: 10 }}>
              {pt.tagname}
            </span>
            {pt.display_name && pt.display_name !== pt.tagname && (
              <span style={{ color: 'var(--io-text-muted)', fontSize: 10 }}>{pt.display_name}</span>
            )}
          </div>
        ))}
        {!loading && points.length === 0 && (
          <div style={{ padding: '8px', fontSize: 11, color: 'var(--io-text-muted)', textAlign: 'center' }}>
            {search ? 'No matching points' : 'No points configured'}
          </div>
        )}
        {loading && (
          <div style={{ padding: '8px', fontSize: 11, color: 'var(--io-text-muted)', textAlign: 'center' }}>Loading…</div>
        )}
        {!loading && points.length < total && (
          <button
            onClick={() => { const next = page + 1; setPage(next); fetchPoints(search, next) }}
            style={{ width: '100%', padding: '4px', fontSize: 10, background: 'transparent', border: 'none', borderTop: '1px solid var(--io-border)', color: 'var(--io-accent)', cursor: 'pointer' }}
          >
            Load more ({total - points.length} remaining)
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DesignerLeftPalette({ collapsed, width }: DesignerLeftPaletteProps) {
  const designMode = useSceneStore(s => s.designMode)
  const isGraphicMode = designMode === 'graphic'
  const isReportMode  = designMode === 'report'

  const [equipOpen,       setEquipOpen]       = useState(true)
  const [stencilsOpen,    setStencilsOpen]    = useState(false)
  const [elemOpen,        setElemOpen]        = useState(true)
  const [pointsOpen,      setPointsOpen]      = useState(false)
  const [widgetsOpen,     setWidgetsOpen]     = useState(true)
  const [reportElemOpen,  setReportElemOpen]  = useState(true)
  const [layersOpen,      setLayersOpen]      = useState(true)

  const containerStyle: React.CSSProperties = {
    width,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--io-surface)',
    borderRight: '1px solid var(--io-border)',
  }

  if (collapsed) {
    return (
      <div style={containerStyle}>
        {isGraphicMode ? (
          <>
            <EquipmentSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <StencilsSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4 }}>
              {DISPLAY_ELEMENT_TYPES.map(t => (
                <DisplayElementTile key={t.type} {...t} collapsed />
              ))}
            </div>
          </>
        ) : (
          <>
            <WidgetsSection collapsed />
            {isReportMode && (
              <>
                <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
                <ReportElementsSection collapsed />
              </>
            )}
          </>
        )}
        <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
        <LayersSection collapsed />
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {isGraphicMode ? (
        <>
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

          {/* Point Browser section — drag points onto shapes for Quick Bind */}
          <SectionHeader label="Points" open={pointsOpen} onToggle={() => setPointsOpen(v => !v)} />
          {pointsOpen && <PointBrowserSection collapsed={false} />}
        </>
      ) : (
        <>
          {/* Widgets section (dashboard / report modes) */}
          <SectionHeader label="Widgets" open={widgetsOpen} onToggle={() => setWidgetsOpen(v => !v)} />
          {widgetsOpen && <WidgetsSection collapsed={false} />}

          {/* Report Elements section — only in report mode */}
          {isReportMode && (
            <>
              <SectionHeader label="Report Elements" open={reportElemOpen} onToggle={() => setReportElemOpen(v => !v)} />
              {reportElemOpen && <ReportElementsSection collapsed={false} />}
            </>
          )}
        </>
      )}

      {/* Layers section — always shown */}
      <SectionHeader label="Layers" open={layersOpen} onToggle={() => setLayersOpen(v => !v)} />
      {layersOpen && <LayersSection collapsed={false} />}
    </div>
  )
}
