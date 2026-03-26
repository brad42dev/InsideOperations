/**
 * DesignerLeftPalette.tsx
 *
 * Left sidebar palette. Content is mode-dependent:
 *  - Graphic mode: Equipment, Stencils, Display Elements, Widgets, Points
 *  - Dashboard mode: Widgets, Equipment, Stencils, Display Elements
 *  - Report mode: Widgets, Report Elements, Equipment, Stencils, Display Elements
 *
 * Layers belong in the right panel only (spec §15).
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { useLibraryStore, useSceneStore } from '../../store/designer'
import type { ShapeIndexItem } from '../../store/designer'
import type { DisplayElementType, WidgetType } from '../../shared/types/graphics'
import { graphicsApi } from '../../api/graphics'
import { pointsApi } from '../../api/points'
import type { PointMeta } from '../../api/points'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerLeftPaletteProps {
  collapsed: boolean
  width: number
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

// ---------------------------------------------------------------------------
// Shared context menu styles (matches DesignerCanvas context menu tokens)
// ---------------------------------------------------------------------------

const cmContentStyle: React.CSSProperties = {
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  minWidth: 160,
  overflow: 'hidden',
  fontSize: 12,
  zIndex: 1000,
}

const cmItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 14px',
  fontSize: 12,
  cursor: 'pointer',
  userSelect: 'none',
  outline: 'none',
  color: 'var(--io-text-primary)',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
}

const cmItemDestructiveStyle: React.CSSProperties = {
  ...cmItemStyle,
  color: 'var(--io-danger, #ef4444)',
}

const cmSepStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--io-border)',
  margin: '2px 0',
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog (Radix Dialog, no window.confirm)
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  open,
  onOpenChange,
  label,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  onConfirm: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9998,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            padding: '20px 24px',
            width: 360,
            zIndex: 9999,
            fontSize: 13,
            color: 'var(--io-text-primary)',
          }}
        >
          <Dialog.Title style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Delete &ldquo;{label}&rdquo;?
          </Dialog.Title>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--io-text-muted)', marginBottom: 20 }}>
            This action cannot be undone.
          </Dialog.Description>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: '6px 14px',
                  background: 'var(--io-surface-elevated)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={() => { onConfirm(); onOpenChange(false) }}
              style={{
                padding: '6px 14px',
                background: 'var(--io-danger, #ef4444)',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
  const shape = useLibraryStore(s => s.cache.get(item.id) ?? null)
  const loadShape = useLibraryStore(s => s.loadShape)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Determine tile type from source field
  const isLibrary = item.source === 'library' || item.source === undefined
  const isCustom = item.source === 'user'

  useEffect(() => {
    if (!shape) {
      void loadShape(item.id)
    }
  }, [item.id, shape, loadShape])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left-click drags; right-clicks go to the context menu
    if (e.button !== 0) return
    // Initiate a custom drag event the canvas can listen for
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setAttribute('data-dragging', 'true')

    const ghost = document.createElement('div')
    ghost.id = 'io-canvas-drag-ghost'
    ghost.setAttribute('data-drag-ghost', 'true')
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.7',
      'padding:4px 8px',
      'background:var(--io-accent)',
      'color:#09090b',
      'border-radius:4px',
      'font-size:11px',
      'font-weight:600',
      'white-space:nowrap',
      'transform:translate(-50%,-50%)',
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      'display:block',
      'visibility:visible',
    ].join(';')
    ghost.textContent = item.label
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

    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }, [item.id, item.label])

  function handleAddToCanvas() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]')
    const rect = canvasEl?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    document.dispatchEvent(new CustomEvent('io:shape-drop', {
      detail: { shapeId: item.id, x: cx, y: cy },
    }))
  }

  function handleExportSvg() {
    graphicsApi.exportShapeSvg(item.id).then(svgContent => {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.id}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }).catch(err => {
      console.error('[ShapeTile] SVG export failed:', err)
    })
  }

  function handleCopyToMyShapes() {
    // TODO: implement copy-to-my-shapes API call when endpoint is available
    console.warn('[ShapeTile] Copy to My Shapes: API not yet implemented for shape', item.id)
  }

  function handleEditShape() {
    // TODO: open shape editor dialog when implemented
    console.warn('[ShapeTile] Edit Shape: shape editor not yet implemented for shape', item.id)
  }

  function handleReplaceSvg() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg,image/svg+xml'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const result = await graphicsApi.reimportShapeSvg(item.id, text).catch(() => null)
      if (result?.success && result.data.data.viewBoxChanged) {
        console.warn('[ShapeTile] Shape dimensions changed significantly. Connection points and value anchors may need repositioning.')
      }
    }
    input.click()
  }

  function handleDeleteConfirmed() {
    // TODO: call delete API when endpoint is available
    console.warn('[ShapeTile] Delete shape: API not yet implemented for shape', item.id)
  }

  const tileDivCollapsed = (
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

  const tileDivExpanded = (
    <div
      onMouseDown={handleMouseDown}
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
  )

  const contextMenuContent = (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content style={cmContentStyle}>
        <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleAddToCanvas}>
          Add to Canvas
        </ContextMenuPrimitive.Item>
        <ContextMenuPrimitive.Separator style={cmSepStyle} />
        {isLibrary && (
          <>
            <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleCopyToMyShapes}>
              Copy to My Shapes
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleExportSvg}>
              Export SVG
            </ContextMenuPrimitive.Item>
          </>
        )}
        {isCustom && (
          <>
            <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleEditShape}>
              Edit Shape
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleExportSvg}>
              Export SVG
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleReplaceSvg}>
              Replace SVG…
            </ContextMenuPrimitive.Item>
            <ContextMenuPrimitive.Separator style={cmSepStyle} />
            <ContextMenuPrimitive.Item
              style={cmItemDestructiveStyle}
              onSelect={() => setDeleteOpen(true)}
            >
              Delete
            </ContextMenuPrimitive.Item>
          </>
        )}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )

  if (collapsed) {
    return (
      <>
        <ContextMenuPrimitive.Root>
          <ContextMenuPrimitive.Trigger asChild>
            {tileDivCollapsed}
          </ContextMenuPrimitive.Trigger>
          {contextMenuContent}
        </ContextMenuPrimitive.Root>
        {isCustom && (
          <DeleteConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            label={item.label}
            onConfirm={handleDeleteConfirmed}
          />
        )}
      </>
    )
  }

  return (
    <>
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger asChild>
          {tileDivExpanded}
        </ContextMenuPrimitive.Trigger>
        {contextMenuContent}
      </ContextMenuPrimitive.Root>
      {isCustom && (
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          label={item.label}
          onConfirm={handleDeleteConfirmed}
        />
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
    // Only handle left-click drags; right-clicks go to the context menu
    if (e.button !== 0) return
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.id = 'io-canvas-drag-ghost'
    ghost.setAttribute('data-drag-ghost', 'true')
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.7',
      'padding:4px 8px',
      'background:var(--io-accent)',
      'color:#09090b',
      'border-radius:4px',
      'font-size:11px',
      'font-weight:600',
      'transform:translate(-50%,-50%)',
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      'display:block',
      'visibility:visible',
    ].join(';')
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
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }, [type, label])

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]')
    const rect = canvasEl?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    document.dispatchEvent(new CustomEvent('io:display-element-drop', {
      detail: { elementType: type, x: cx, y: cy },
    }))
  }

  function handleAddToFavorites() {
    // Persist to localStorage under the display-elements favorites key
    try {
      const raw = localStorage.getItem('io:palette-favorites') ?? '{}'
      const favs = JSON.parse(raw) as Record<string, string[]>
      if (!favs['display-elements']) favs['display-elements'] = []
      if (!favs['display-elements'].includes(type)) {
        favs['display-elements'].push(type)
        localStorage.setItem('io:palette-favorites', JSON.stringify(favs))
      }
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const tileCollapsed = (
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

  const tileExpanded = (
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

  const menuContent = (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content style={cmContentStyle}>
        <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handlePlaceAtCenter}>
          Place at Center
        </ContextMenuPrimitive.Item>
        <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleAddToFavorites}>
          Add to Favorites
        </ContextMenuPrimitive.Item>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {collapsed ? tileCollapsed : tileExpanded}
      </ContextMenuPrimitive.Trigger>
      {menuContent}
    </ContextMenuPrimitive.Root>
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
// Custom (user) shapes section — palette variant
// ---------------------------------------------------------------------------

interface UserShapeItem {
  id: string
  shape_id: string
  name: string
  category: string
  source: 'user'
}

function CustomShapesPaletteTile({ item }: { item: UserShapeItem }) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left-click drags; right-clicks go to the context menu
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setAttribute('data-dragging', 'true')

    const ghost = document.createElement('div')
    ghost.id = 'io-canvas-drag-ghost'
    ghost.setAttribute('data-drag-ghost', 'true')
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.7',
      'padding:4px 8px',
      'background:var(--io-accent)',
      'color:#09090b',
      'border-radius:4px',
      'font-size:11px',
      'font-weight:600',
      'white-space:nowrap',
      'transform:translate(-50%,-50%)',
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      'display:block',
      'visibility:visible',
    ].join(';')
    ghost.textContent = item.name
    document.body.appendChild(ghost)

    const onMove = (ev: MouseEvent) => {
      ghost.style.left = `${ev.clientX}px`
      ghost.style.top = `${ev.clientY}px`
      document.dispatchEvent(new CustomEvent('io:shape-drag-move', {
        detail: { shapeId: item.shape_id, x: ev.clientX, y: ev.clientY },
      }))
    }

    const onUp = (ev: MouseEvent) => {
      ghost.remove()
      el.removeAttribute('data-dragging')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.dispatchEvent(new CustomEvent('io:shape-drop', {
        detail: { shapeId: item.shape_id, x: ev.clientX, y: ev.clientY },
      }))
    }

    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }, [item.shape_id, item.name])

  function handleAddToCanvas() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]')
    const rect = canvasEl?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    document.dispatchEvent(new CustomEvent('io:shape-drop', {
      detail: { shapeId: item.shape_id, x: cx, y: cy },
    }))
  }

  const tileDiv = (
    <div
      onMouseDown={handleMouseDown}
      title={item.name}
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
      <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: 9, lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%', color: 'var(--io-text-muted)' }}>
        {item.name.length > 12 ? item.name.slice(0, 11) + '…' : item.name}
      </div>
    </div>
  )

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {tileDiv}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content style={cmContentStyle}>
          <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleAddToCanvas}>
            Add to Canvas
          </ContextMenuPrimitive.Item>
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}

function CustomShapesPaletteSection({ collapsed }: { collapsed: boolean }) {
  const [shapes, setShapes] = useState<UserShapeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Lazy-load on first open (when not collapsed)
  useEffect(() => {
    if (collapsed || loaded || loading) return
    setLoading(true)
    graphicsApi.listUserShapes()
      .then(resp => {
        if (resp.success) setShapes(resp.data.data ?? [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
      .finally(() => setLoading(false))
  }, [collapsed, loaded, loading])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const result = await graphicsApi.uploadUserShape(file)
      setShapes(prev => [...prev, { ...result }])
    } catch {
      // silently fail in palette context — user can try Symbol Library for details
    } finally {
      setUploading(false)
    }
  }

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 4px', alignItems: 'center' }}>
        {shapes.slice(0, 4).map(item => (
          <div
            key={item.id}
            title={item.name}
            style={{
              width: 32,
              height: 32,
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" style={{ color: 'var(--io-text-muted)' }} />
            </svg>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Upload button row */}
      <div style={{ padding: '6px 8px', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            flex: 1,
            padding: '5px 0',
            background: 'var(--io-surface-elevated)',
            border: '1px dashed var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-muted)',
            fontSize: 11,
            cursor: uploading ? 'wait' : 'pointer',
            textAlign: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--io-accent)'; e.currentTarget.style.color = 'var(--io-accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--io-border)'; e.currentTarget.style.color = 'var(--io-text-muted)' }}
        >
          {uploading ? 'Uploading…' : '+ Upload SVG'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* Shape tiles */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {loading && (
          <div style={{ fontSize: 11, color: 'var(--io-text-muted)', padding: '8px 0' }}>
            Loading…
          </div>
        )}
        {loaded && shapes.length === 0 && (
          <div
            style={{
              padding: '12px 8px',
              fontSize: 11,
              color: 'var(--io-text-muted)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            No custom shapes yet.
            <br />
            Upload an SVG to get started.
          </div>
        )}
        {loaded && shapes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
            {shapes.map(item => (
              <CustomShapesPaletteTile key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stencils section
// ---------------------------------------------------------------------------

interface StencilItem {
  id: string
  name: string
}

function StencilTile({ item, collapsed }: { item: StencilItem; collapsed: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left-click drags; right-clicks go to the context menu
    if (e.button !== 0) return
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.id = 'io-canvas-drag-ghost'
    ghost.setAttribute('data-drag-ghost', 'true')
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.7',
      'padding:4px 8px',
      'background:var(--io-accent)',
      'color:#09090b',
      'border-radius:4px',
      'font-size:11px',
      'font-weight:600',
      'transform:translate(-50%,-50%)',
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      'display:block',
      'visibility:visible',
    ].join(';')
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
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }, [item.id, item.name])

  function handleExportSvg() {
    graphicsApi.exportShapeSvg(item.id).then(svgContent => {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${item.name}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }).catch(err => {
      console.error('[StencilTile] SVG export failed:', err)
    })
  }

  function handleEdit() {
    // TODO: open stencil editor when implemented
    console.warn('[StencilTile] Edit stencil: stencil editor not yet implemented for stencil', item.id)
  }

  function handleDeleteConfirmed() {
    // TODO: call delete API when endpoint is available
    console.warn('[StencilTile] Delete stencil: API not yet implemented for stencil', item.id)
  }

  const stencilContextMenuContent = (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content style={cmContentStyle}>
        <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleEdit}>
          Edit
        </ContextMenuPrimitive.Item>
        <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleExportSvg}>
          Export SVG
        </ContextMenuPrimitive.Item>
        <ContextMenuPrimitive.Separator style={cmSepStyle} />
        <ContextMenuPrimitive.Item
          style={cmItemDestructiveStyle}
          onSelect={() => setDeleteOpen(true)}
        >
          Delete
        </ContextMenuPrimitive.Item>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )

  if (collapsed) {
    return (
      <>
        <ContextMenuPrimitive.Root>
          <ContextMenuPrimitive.Trigger asChild>
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
          </ContextMenuPrimitive.Trigger>
          {stencilContextMenuContent}
        </ContextMenuPrimitive.Root>
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          label={item.name}
          onConfirm={handleDeleteConfirmed}
        />
      </>
    )
  }

  return (
    <>
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger asChild>
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
        </ContextMenuPrimitive.Trigger>
        {stencilContextMenuContent}
      </ContextMenuPrimitive.Root>
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        label={item.name}
        onConfirm={handleDeleteConfirmed}
      />
    </>
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
    // Only handle left-click drags; right-clicks go to the context menu
    if (e.button !== 0) return
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.id = 'io-canvas-drag-ghost'
    ghost.setAttribute('data-drag-ghost', 'true')
    ghost.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.7',
      'padding:4px 8px',
      'background:var(--io-accent)',
      'color:#09090b',
      'border-radius:4px',
      'font-size:11px',
      'font-weight:600',
      'transform:translate(-50%,-50%)',
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      'display:block',
      'visibility:visible',
    ].join(';')
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
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }, [type, label])

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]')
    const rect = canvasEl?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    document.dispatchEvent(new CustomEvent('io:widget-drop', {
      detail: { widgetType: type, x: cx, y: cy },
    }))
  }

  function handleAddToFavorites() {
    try {
      const raw = localStorage.getItem('io:palette-favorites') ?? '{}'
      const favs = JSON.parse(raw) as Record<string, string[]>
      if (!favs['widgets']) favs['widgets'] = []
      if (!favs['widgets'].includes(type)) {
        favs['widgets'].push(type)
        localStorage.setItem('io:palette-favorites', JSON.stringify(favs))
      }
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const size = collapsed ? 32 : 48

  const tileDiv = (
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

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {tileDiv}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content style={cmContentStyle}>
          <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handlePlaceAtCenter}>
            Place at Center
          </ContextMenuPrimitive.Item>
          <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleAddToFavorites}>
            Add to Favorites
          </ContextMenuPrimitive.Item>
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
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
    // Only handle left-click drags; right-clicks go to the context menu
    if (e.button !== 0) return
    e.preventDefault()
    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed; pointer-events: none; z-index: 9999; opacity: 0.7;
      padding: 4px 8px; background: var(--io-accent); color: #09090b;
      border-radius: 4px; font-size: 11px; font-weight: 600;
      transform: translate(-50%,-50%); left:${e.clientX}px; top:${e.clientY}px;
    `
    ghost.textContent = label
    ghost.setAttribute('data-drag-ghost', 'true')
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

  function handlePlaceAtCenter() {
    const canvasEl = document.querySelector('[data-designer-canvas="true"]')
    const rect = canvasEl?.getBoundingClientRect()
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
    const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    document.dispatchEvent(new CustomEvent('io:report-element-drop', {
      detail: { elementType, x: cx, y: cy },
    }))
  }

  function handleAddToFavorites() {
    try {
      const raw = localStorage.getItem('io:palette-favorites') ?? '{}'
      const favs = JSON.parse(raw) as Record<string, string[]>
      if (!favs['report-elements']) favs['report-elements'] = []
      if (!favs['report-elements'].includes(elementType)) {
        favs['report-elements'].push(elementType)
        localStorage.setItem('io:palette-favorites', JSON.stringify(favs))
      }
    } catch {
      // localStorage may be blocked — silently ignore
    }
  }

  const size = collapsed ? 32 : 48
  const previewSize = collapsed ? 20 : 32

  const tileDiv = (
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

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {tileDiv}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content style={cmContentStyle}>
          <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handlePlaceAtCenter}>
            Place at Center
          </ContextMenuPrimitive.Item>
          <ContextMenuPrimitive.Item style={cmItemStyle} onSelect={handleAddToFavorites}>
            Add to Favorites
          </ContextMenuPrimitive.Item>
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
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
  const [myShapesOpen,    setMyShapesOpen]    = useState(false)
  const [stencilsOpen,    setStencilsOpen]    = useState(false)
  const [elemOpen,        setElemOpen]        = useState(true)
  const [pointsOpen,      setPointsOpen]      = useState(false)
  const [widgetsOpen,     setWidgetsOpen]     = useState(true)
  const [reportElemOpen,  setReportElemOpen]  = useState(true)

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
            <CustomShapesPaletteSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <StencilsSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4 }}>
              {DISPLAY_ELEMENT_TYPES.map(t => (
                <DisplayElementTile key={t.type} {...t} collapsed />
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <WidgetsSection collapsed />
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
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <EquipmentSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <CustomShapesPaletteSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <StencilsSection collapsed />
            <div style={{ height: 1, background: 'var(--io-border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4 }}>
              {DISPLAY_ELEMENT_TYPES.map(t => (
                <DisplayElementTile key={t.type} {...t} collapsed />
              ))}
            </div>
          </>
        )}
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

          {/* My Shapes section — user-uploaded custom SVG shapes */}
          <SectionHeader label="My Shapes" open={myShapesOpen} onToggle={() => setMyShapesOpen(v => !v)} />
          {myShapesOpen && (
            <div style={{ flex: '0 1 auto', maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <CustomShapesPaletteSection collapsed={false} />
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

          {/* Widgets section — available in graphic mode (rendered in HTML overlay layer) */}
          <SectionHeader label="Widgets" open={widgetsOpen} onToggle={() => setWidgetsOpen(v => !v)} />
          {widgetsOpen && <WidgetsSection collapsed={false} />}

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

          {/* Shapes + Stencils + Display Elements — available in dashboard/report per spec §4.3/§4.4 */}
          <SectionHeader label="Equipment" open={equipOpen} onToggle={() => setEquipOpen(v => !v)} />
          {equipOpen && (
            <div style={{ flex: '0 0 auto', maxHeight: 200, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <EquipmentSection collapsed={false} />
            </div>
          )}

          {/* My Shapes section — user-uploaded custom SVG shapes */}
          <SectionHeader label="My Shapes" open={myShapesOpen} onToggle={() => setMyShapesOpen(v => !v)} />
          {myShapesOpen && (
            <div style={{ flex: '0 1 auto', maxHeight: 180, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <CustomShapesPaletteSection collapsed={false} />
            </div>
          )}

          {/* Stencils section — available in dashboard/report modes */}
          <SectionHeader label="Stencils" open={stencilsOpen} onToggle={() => setStencilsOpen(v => !v)} />
          {stencilsOpen && <StencilsSection collapsed={false} />}

          <SectionHeader label="Display Elements" open={elemOpen} onToggle={() => setElemOpen(v => !v)} />
          {elemOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, flexShrink: 0 }}>
              {DISPLAY_ELEMENT_TYPES.map(t => (
                <DisplayElementTile key={t.type} {...t} collapsed={false} />
              ))}
            </div>
          )}
        </>
      )}

    </div>
  )
}
