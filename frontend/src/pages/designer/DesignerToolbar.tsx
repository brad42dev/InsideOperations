/**
 * DesignerToolbar.tsx
 *
 * Horizontal toolbar for the Designer canvas area.
 * Mode-aware: different tool sets for graphic / dashboard / report modes.
 */

import React from 'react'
import { useSceneStore, useUiStore, useHistoryStore } from '../../store/designer'
import type { DrawingTool } from '../../store/designer'
import type { SceneNode } from '../../shared/types/graphics'
import {
  AlignNodesCommand,
  DistributeNodesCommand,
} from '../../shared/graphics/commands'
import type { AlignmentType, DistributionAxis } from '../../shared/graphics/commands'
import { useDesignerPermissions } from '../../shared/hooks/usePermission'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerToolbarProps {
  onSave: () => void
  isSaving: boolean
  onPublish?: () => void
  isPublishing?: boolean
  onShowVersionHistory?: () => void
  onValidateBindings?: () => void
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function IconSelect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2L3 12L6.5 9.5L8 13L9.5 12.4L8 8.8L12 8L3 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function IconPen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 14L5 11L11 5L12 2L10 1L4 7L1 10L2 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
      <circle cx="11.5" cy="2.5" r="1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

function IconRect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    </svg>
  )
}

function IconEllipse() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="8" rx="6" ry="5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
    </svg>
  )
}

function IconLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="2.5" y1="13.5" x2="13.5" y2="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 3H13V5.5H10.5V13H5.5V5.5H3V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function IconPipe() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 6H7V10H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="2" cy="6" r="1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
      <circle cx="14" cy="10" r="1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="5.5" cy="6.5" r="1.2" stroke="currentColor" strokeWidth="1.1" fill="none"/>
      <path d="M2 11L5 8L7.5 10.5L10 8.5L14 11" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function IconFreehand() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13 C3 10 4 7 6 5 C8 3 10 4 10 6 C10 8 8 9 7 11 C6 13 7 14.5 9 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <circle cx="9" cy="14" r="1" fill="currentColor"/>
    </svg>
  )
}

function IconPan() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2V4M8 12V14M2 8H4M12 8H14M4.3 4.3L5.7 5.7M10.3 10.3L11.7 11.7M4.3 11.7L5.7 10.3M10.3 5.7L11.7 4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  )
}

function IconGroup() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="6" height="5" rx="0.7" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="8" y="9" width="6" height="5" rx="0.7" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2" fill="none" opacity="0.7"/>
    </svg>
  )
}

function IconUngroup() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2.5 2" fill="none" opacity="0.4"/>
      <rect x="2" y="2" width="6" height="5" rx="0.7" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="8" y="9" width="6" height="5" rx="0.7" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <line x1="4" y1="9" x2="4" y2="11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
      <line x1="12" y1="5" x2="12" y2="7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

function IconUndo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 6H10a4 4 0 010 8H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M3.5 6L6 3.5M3.5 6L6 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconRedo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12.5 6H6a4 4 0 000 8h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M12.5 6L10 3.5M12.5 6L10 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 6H14M2 10H14M6 2V14M10 2V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconMagnet() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 3V9a4 4 0 008 0V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <line x1="2.5" y1="3" x2="5.5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10.5" y1="3" x2="13.5" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconZoomOut() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconZoomIn() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none"/>
      <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <polygon points="3,1.5 13,7 3,12.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

// Align icons (16x16)
function IconAlignLeft()     { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="4" width="7" height="3" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="4" y="9" width="10" height="3" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconAlignCenterH()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="4.5" y="4" width="7" height="3" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="2" y="9" width="12" height="3" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconAlignRight()    { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="5" y="4" width="7" height="3" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="2" y="9" width="10" height="3" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconAlignTop()      { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="2" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="4" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="9" y="4" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconAlignCenterV()  { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="4.5" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="9" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconAlignBottom()   { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="4" y="5" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.7"/><rect x="9" y="2" width="3" height="10" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconDistributeH()   { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="5.5" y="5" width="5" height="6" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }
function IconDistributeV()   { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="2" x2="14" y2="2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="2" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="5" y="5.5" width="6" height="5" rx="0.5" fill="currentColor" opacity="0.7"/></svg> }

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

interface ToolDef {
  id: DrawingTool
  label: string
  shortcut: string
  icon: React.ReactNode
  modes: Array<'graphic' | 'dashboard' | 'report'>
}

// Draw tools — select is rendered separately as the Selector button
const DRAW_TOOLS: ToolDef[] = [
  { id: 'pen',       label: 'Pen',       shortcut: 'P',       icon: <IconPen />,      modes: ['graphic'] },
  { id: 'freehand',  label: 'Freehand',  shortcut: 'B',       icon: <IconFreehand />, modes: ['graphic'] },
  { id: 'rect',      label: 'Rectangle', shortcut: 'R',       icon: <IconRect />,     modes: ['graphic', 'dashboard', 'report'] },
  { id: 'ellipse',   label: 'Ellipse',   shortcut: 'E',       icon: <IconEllipse />,  modes: ['graphic', 'dashboard', 'report'] },
  { id: 'line',      label: 'Line',      shortcut: 'L',       icon: <IconLine />,     modes: ['graphic', 'dashboard', 'report'] },
  { id: 'text',      label: 'Text',      shortcut: 'T',       icon: <IconText />,     modes: ['graphic', 'dashboard', 'report'] },
  { id: 'pipe',      label: 'Pipe',      shortcut: 'Shift+P', icon: <IconPipe />,     modes: ['graphic'] },
  { id: 'image',     label: 'Image',     shortcut: 'M',       icon: <IconImage />,    modes: ['graphic', 'dashboard', 'report'] },
  { id: 'pan',       label: 'Pan',       shortcut: 'H',       icon: <IconPan />,      modes: ['graphic', 'dashboard', 'report'] },
]

// ---------------------------------------------------------------------------
// Separator
// ---------------------------------------------------------------------------

function Sep() {
  return (
    <div style={{
      width: '1px',
      height: '20px',
      background: 'var(--io-border)',
      margin: '0 4px',
      flexShrink: 0,
    }} />
  )
}

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------

interface IconBtnProps {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title: string
  children: React.ReactNode
}

function IconBtn({ onClick, disabled = false, active = false, title, children }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--io-accent)' : 'transparent',
        color: active ? '#09090b' : disabled ? 'var(--io-text-muted)' : 'var(--io-text-secondary)',
        border: 'none',
        borderRadius: 'var(--io-radius)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        transition: 'background 0.1s, color 0.1s',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--io-surface-elevated)'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DesignerToolbar({ onSave, isSaving, onPublish, isPublishing, onShowVersionHistory, onValidateBindings }: DesignerToolbarProps) {
  const perms = useDesignerPermissions()
  // Read-only mode if user lacks write permission
  const readOnly = !perms.canWrite

  const activeTool   = useUiStore(s => s.activeTool)
  const setTool      = useUiStore(s => s.setTool)
  const gridVisible  = useUiStore(s => s.gridVisible)
  const setGrid      = useUiStore(s => s.setGrid)
  const snapToGrid   = useUiStore(s => s.snapToGrid)
  const setSnap      = useUiStore(s => s.setSnap)
  const testMode          = useUiStore(s => s.testMode)
  const setTestMode       = useUiStore(s => s.setTestMode)
  const phonePreviewActive = useUiStore(s => s.phonePreviewActive)
  const setPhonePreview   = useUiStore(s => s.setPhonePreview)
  const viewport     = useUiStore(s => s.viewport)
  const zoomTo       = useUiStore(s => s.zoomTo)
  const fitToCanvas  = useUiStore(s => s.fitToCanvas)

  const designMode   = useSceneStore(s => s.designMode)
  const doc          = useSceneStore(s => s.doc)
  const isDirty      = useSceneStore(s => s.isDirty)
  const sceneExecute = useSceneStore(s => s.execute)

  const canUndo          = useHistoryStore(s => s.canUndo)
  const canRedo          = useHistoryStore(s => s.canRedo)
  const undoDescription  = useHistoryStore(s => s.undoDescription)
  const redoDescription  = useHistoryStore(s => s.redoDescription)
  const undo             = useHistoryStore(s => s.undo)
  const redo             = useHistoryStore(s => s.redo)
  const historyPush      = useHistoryStore(s => s.push)

  // Track selected IDs from uiStore — reactive Zustand subscription
  const selectedNodeIds = useUiStore(s => s.selectedNodeIds)
  const selectedIds = Array.from(selectedNodeIds)

  // Compute Group / Ungroup button enabled state from selection + scene doc
  // Group: ≥2 non-pipe nodes selected
  const nonPipeSelectedCount = doc
    ? selectedIds.filter(id => {
        function findNode(nodes: SceneNode[]): SceneNode | null {
          for (const n of nodes) {
            if (n.id === id) return n
            if ('children' in n && Array.isArray((n as { children?: unknown[] }).children)) {
              const f = findNode((n as { children: SceneNode[] }).children)
              if (f) return f
            }
          }
          return null
        }
        const node = findNode(doc.children)
        return node ? node.type !== 'pipe' : false
      }).length
    : 0
  const canGroup = nonPipeSelectedCount >= 2

  // Ungroup: exactly 1 node selected and it is a group
  const canUngroup = selectedIds.length === 1 && doc
    ? (() => {
        const node = doc.children.find(n => n.id === selectedIds[0])
        return node?.type === 'group'
      })()
    : false

  const visibleDrawTools = DRAW_TOOLS.filter(t => t.modes.includes(designMode))

  const zoomPct = Math.round(viewport.zoom * 100)

  function execAlignDistribute(cmd: AlignNodesCommand | DistributeNodesCommand) {
    const d = doc
    if (!d) return
    sceneExecute(cmd)
    historyPush(cmd, d)
  }

  function handleAlign(alignment: AlignmentType) {
    if (selectedIds.length < 2 || !doc) return
    execAlignDistribute(new AlignNodesCommand(selectedIds, alignment))
  }

  function handleDistribute(axis: DistributionAxis) {
    if (selectedIds.length < 3 || !doc) return
    execAlignDistribute(new DistributeNodesCommand(selectedIds, axis))
  }

  function handleFitToCanvas() {
    if (!doc) return
    // Use the window inner dimensions as a rough estimate for the canvas area
    fitToCanvas(doc.canvas.width, doc.canvas.height, window.innerWidth - 540, window.innerHeight - 80)
  }

  function handleZoomIn() {
    zoomTo(viewport.zoom * 1.25)
  }

  function handleZoomOut() {
    zoomTo(viewport.zoom / 1.25)
  }

  return (
    <div
      style={{
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 8px',
        background: 'var(--io-surface)',
        borderBottom: '1px solid var(--io-border)',
        overflow: 'hidden',
      }}
    >
      {/* Undo / Redo */}
      <IconBtn
        onClick={undo}
        disabled={!canUndo}
        title={canUndo && undoDescription ? `Undo: ${undoDescription}` : 'Undo (Ctrl+Z)'}
      >
        <IconUndo />
      </IconBtn>
      <IconBtn
        onClick={redo}
        disabled={!canRedo}
        title={canRedo && redoDescription ? `Redo: ${redoDescription}` : 'Redo (Ctrl+Y)'}
      >
        <IconRedo />
      </IconBtn>

      <Sep />

      {/* Selector button */}
      <IconBtn
        onClick={() => setTool('select')}
        active={activeTool === 'select'}
        title="Select (V)"
      >
        <IconSelect />
      </IconBtn>

      {/* Group button — enabled when ≥2 non-pipe nodes selected */}
      <IconBtn
        onClick={() => {
          if (canGroup) document.dispatchEvent(new CustomEvent('io:toolbar-group'))
        }}
        disabled={!canGroup || readOnly}
        title="Group Selection (Ctrl+G)"
      >
        <IconGroup />
      </IconBtn>

      {/* Ungroup button — enabled when exactly 1 group node selected */}
      <IconBtn
        onClick={() => {
          if (canUngroup) document.dispatchEvent(new CustomEvent('io:toolbar-ungroup'))
        }}
        disabled={!canUngroup || readOnly}
        title="Ungroup (Ctrl+Shift+G)"
      >
        <IconUngroup />
      </IconBtn>

      <Sep />

      {/* Draw tools — hidden in read-only mode */}
      {visibleDrawTools.map(tool => (
        <IconBtn
          key={tool.id}
          onClick={() => !readOnly && setTool(tool.id)}
          active={activeTool === tool.id}
          disabled={readOnly && tool.id !== 'pan'}
          title={readOnly && tool.id !== 'pan' ? 'Read-only — designer:write required' : `${tool.label} (${tool.shortcut})`}
        >
          {tool.icon}
        </IconBtn>
      ))}

      <Sep />

      {/* Grid toggle */}
      <IconBtn
        onClick={() => setGrid(!gridVisible)}
        active={gridVisible}
        title={gridVisible ? 'Hide grid' : 'Show grid'}
      >
        <IconGrid />
      </IconBtn>

      {/* Snap toggle */}
      <IconBtn
        onClick={() => setSnap(!snapToGrid)}
        active={snapToGrid}
        title={snapToGrid ? 'Disable snap' : 'Enable snap'}
      >
        <IconMagnet />
      </IconBtn>

      <Sep />

      {/* Align & Distribute — visible when 2+ nodes selected */}
      {selectedIds.length >= 2 && (
        <>
          <IconBtn onClick={() => handleAlign('left')}     title="Align left edges"><IconAlignLeft /></IconBtn>
          <IconBtn onClick={() => handleAlign('center-h')} title="Align centers (horizontal)"><IconAlignCenterH /></IconBtn>
          <IconBtn onClick={() => handleAlign('right')}    title="Align right edges"><IconAlignRight /></IconBtn>
          <IconBtn onClick={() => handleAlign('top')}      title="Align top edges"><IconAlignTop /></IconBtn>
          <IconBtn onClick={() => handleAlign('center-v')} title="Align centers (vertical)"><IconAlignCenterV /></IconBtn>
          <IconBtn onClick={() => handleAlign('bottom')}   title="Align bottom edges"><IconAlignBottom /></IconBtn>
          {selectedIds.length >= 3 && (
            <>
              <IconBtn onClick={() => handleDistribute('horizontal')} title="Distribute horizontally"><IconDistributeH /></IconBtn>
              <IconBtn onClick={() => handleDistribute('vertical')}   title="Distribute vertically"><IconDistributeV /></IconBtn>
            </>
          )}
          <Sep />
        </>
      )}

      {/* Zoom controls */}
      <IconBtn onClick={handleZoomOut} title="Zoom out (Ctrl+-)">
        <IconZoomOut />
      </IconBtn>

      <button
        onClick={handleFitToCanvas}
        title="Fit to canvas (click to reset)"
        style={{
          height: 28,
          minWidth: 52,
          padding: '0 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: 'var(--io-text-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'var(--io-font-mono)',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-surface-elevated)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        {zoomPct}%
      </button>

      <IconBtn onClick={handleZoomIn} title="Zoom in (Ctrl+=)">
        <IconZoomIn />
      </IconBtn>

      <Sep />

      {/* Test mode */}
      <IconBtn
        onClick={() => setTestMode(!testMode)}
        active={testMode}
        title={testMode ? 'Exit test mode' : 'Enter test mode'}
      >
        <IconPlay />
        <span style={{ fontSize: 11, marginLeft: 2 }}>Test</span>
      </IconBtn>

      {/* Phone preview — only in dashboard mode */}
      {designMode === 'dashboard' && (
        <>
          <Sep />
          <IconBtn
            onClick={() => setPhonePreview(!phonePreviewActive)}
            active={phonePreviewActive}
            title={phonePreviewActive ? 'Exit phone preview' : 'Phone preview (~375px)'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="3.5" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <circle cx="7" cy="10.5" r="0.7" fill="currentColor"/>
            </svg>
            <span style={{ fontSize: 11, marginLeft: 2 }}>Phone</span>
          </IconBtn>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* History + Validate */}
      {onShowVersionHistory && (
        <IconBtn onClick={onShowVersionHistory} title="Version history">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </IconBtn>
      )}
      {onValidateBindings && (
        <IconBtn onClick={onValidateBindings} title="Validate bindings">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 7l1.5 1.5L9.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
        </IconBtn>
      )}

      {/* Dirty indicator + Save */}
      {isDirty && (
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#f97316',
            flexShrink: 0,
            marginRight: 4,
          }}
          title="Unsaved changes"
        />
      )}
      {/* Read-only badge */}
      {readOnly && (
        <div style={{
          padding: '3px 8px',
          background: 'rgba(234,179,8,0.15)',
          border: '1px solid rgba(234,179,8,0.4)',
          borderRadius: 'var(--io-radius)',
          color: '#eab308',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}>
          READ-ONLY
        </div>
      )}

      <button
        onClick={onSave}
        disabled={!isDirty || isSaving || readOnly}
        title={readOnly ? 'designer:write permission required to save' : undefined}
        style={{
          height: 28,
          padding: '0 14px',
          background: isDirty && !isSaving && !readOnly ? 'var(--io-accent)' : 'var(--io-surface-elevated)',
          color: isDirty && !isSaving && !readOnly ? '#09090b' : 'var(--io-text-muted)',
          border: 'none',
          borderRadius: 'var(--io-radius)',
          cursor: isDirty && !isSaving && !readOnly ? 'pointer' : 'not-allowed',
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
          transition: 'background 0.15s',
          opacity: (!isDirty || readOnly) ? 0.5 : 1,
        }}
      >
        {isSaving ? 'Saving…' : 'Save'}
      </button>

      {onPublish && (
        <button
          onClick={onPublish}
          disabled={!!isPublishing || readOnly}
          title={readOnly ? 'designer:publish permission required' : 'Publish — create a permanent version snapshot'}
          style={{
            height: 28,
            padding: '0 14px',
            background: !isPublishing && !readOnly ? 'var(--io-success, #22c55e)' : 'var(--io-surface-elevated)',
            color: !isPublishing && !readOnly ? '#fff' : 'var(--io-text-muted)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            cursor: !isPublishing && !readOnly ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
            transition: 'background 0.15s',
            opacity: (isPublishing || readOnly) ? 0.5 : 1,
          }}
        >
          {isPublishing ? 'Publishing…' : 'Publish'}
        </button>
      )}
    </div>
  )
}
