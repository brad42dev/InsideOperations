/**
 * DesignerStatusBar.tsx
 *
 * 28px status bar at the very bottom of the Designer area.
 * Segments (left-to-right):
 *   1. WebSocket connection status
 *   2. Point binding summary (click to validate)
 *   3. Grid size (click to cycle)
 *   4. Zoom level (click to show presets)
 *   5. Mode indicator (Edit / Test Mode / Read-Only)
 *   6. Auto-save indicator (right-aligned)
 */

import React, { useEffect, useRef, useState } from 'react'
import { useSceneStore, useUiStore } from '../../store/designer'
import type { GraphicDocument, SymbolInstance, DisplayElement, SceneNode } from '../../shared/types/graphics'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerStatusBarProps {
  wsConnected?: boolean
  readOnly?: boolean
  lastAutoSave?: number | null
  onValidateBindings?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRID_CYCLE = [4, 8, 16, 32] as const
const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400] as const

/**
 * Walk all nodes in the document tree and count bound DisplayElement and
 * SymbolInstance bindings.
 */
function countBindings(doc: GraphicDocument): { bound: number; unresolved: number } {
  let bound = 0

  function walkNodes(nodes: SceneNode[]) {
    for (const node of nodes) {
      if (node.type === 'display_element') {
        const de = node as DisplayElement
        if (de.binding?.pointId) bound++
      } else if (node.type === 'symbol_instance') {
        const si = node as SymbolInstance
        if (si.stateBinding?.pointId) bound++
        // Also recurse into children of the symbol instance
        if (si.children && si.children.length > 0) {
          walkNodes(si.children)
        }
      }
      // Recurse for group / document children
      if ('children' in node && Array.isArray((node as { children?: SceneNode[] }).children)) {
        const children = (node as { children?: SceneNode[] }).children
        if (children && node.type !== 'symbol_instance') {
          walkNodes(children)
        }
      }
    }
  }

  walkNodes(doc.children)
  // For now, we have no OPC point list to compare against, so unresolved = 0
  return { bound, unresolved: 0 }
}

/**
 * Format epoch ms as relative time string.
 */
function formatRelativeTime(epochMs: number): string {
  const diffSec = Math.floor((Date.now() - epochMs) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

// ---------------------------------------------------------------------------
// Segment divider
// ---------------------------------------------------------------------------

function Divider() {
  return (
    <div style={{
      width: 1,
      height: 16,
      background: 'var(--io-border)',
      flexShrink: 0,
    }} />
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DesignerStatusBar({
  wsConnected = true,
  readOnly = false,
  lastAutoSave = null,
  onValidateBindings,
}: DesignerStatusBarProps) {
  const doc        = useSceneStore(s => s.doc)
  const gridSize   = useUiStore(s => s.gridSize)
  const setGrid    = useUiStore(s => s.setGrid)
  const gridVisible = useUiStore(s => s.gridVisible)
  const zoom       = useUiStore(s => s.viewport.zoom)
  const zoomTo     = useUiStore(s => s.zoomTo)
  const testMode   = useUiStore(s => s.testMode)

  // Zoom dropdown visibility
  const [zoomOpen, setZoomOpen] = useState(false)
  const zoomRef = useRef<HTMLDivElement>(null)

  // Relative time ticker for auto-save label
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Close zoom dropdown on outside click
  useEffect(() => {
    if (!zoomOpen) return
    function handleClick(e: MouseEvent) {
      if (zoomRef.current && !zoomRef.current.contains(e.target as Node)) {
        setZoomOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [zoomOpen])

  // Binding counts
  const { bound, unresolved } = doc ? countBindings(doc) : { bound: 0, unresolved: 0 }

  // Grid cycle
  function handleGridClick() {
    const idx = GRID_CYCLE.indexOf(gridSize as typeof GRID_CYCLE[number])
    const next = GRID_CYCLE[(idx + 1) % GRID_CYCLE.length]
    setGrid(gridVisible, next)
  }

  // Mode label
  let modeLabel: string
  let modeDot: string | null = null
  let modeColor = 'var(--io-text-secondary)'
  if (readOnly) {
    modeLabel = 'Read-Only'
  } else if (testMode) {
    modeLabel = 'Test Mode'
    modeDot = '●'
    modeColor = '#22c55e'
  } else {
    modeLabel = 'Edit'
  }

  const segmentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    height: 28,
    gap: 5,
    fontSize: 11,
    color: 'var(--io-text-secondary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }

  const clickableSegmentStyle: React.CSSProperties = {
    ...segmentStyle,
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div style={{
      height: 28,
      background: 'var(--io-surface)',
      borderTop: '1px solid var(--io-border)',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}>

      {/* 1. Connection status */}
      <div style={segmentStyle}>
        <span style={{ color: wsConnected ? '#22c55e' : '#ef4444', fontSize: 8, lineHeight: 1 }}>●</span>
        <span>{wsConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <Divider />

      {/* 2. Point binding summary */}
      <div
        style={clickableSegmentStyle}
        onClick={onValidateBindings}
        title="Click to validate bindings"
      >
        {unresolved > 0 ? (
          <>
            <span>Points: {bound} bound</span>
            <span style={{ color: '#f97316' }}>({unresolved} unresolved)</span>
          </>
        ) : (
          <span>Points: {bound} bound</span>
        )}
      </div>

      <Divider />

      {/* 3. Grid size */}
      <div
        style={clickableSegmentStyle}
        onClick={handleGridClick}
        title="Click to cycle grid size"
      >
        Grid: {gridSize}px
      </div>

      <Divider />

      {/* 4. Zoom level */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={zoomRef}>
        <div
          style={clickableSegmentStyle}
          onClick={() => setZoomOpen(v => !v)}
          title="Click to set zoom level"
        >
          {Math.round(zoom * 100)}%
        </div>
        {zoomOpen && (
          <div style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 200,
            minWidth: 80,
            overflow: 'hidden',
          }}>
            {ZOOM_PRESETS.map(preset => (
              <div
                key={preset}
                onClick={() => { zoomTo(preset / 100); setZoomOpen(false) }}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  color: Math.round(zoom * 100) === preset ? 'var(--io-accent)' : 'var(--io-text-primary)',
                  background: Math.round(zoom * 100) === preset ? 'var(--io-surface)' : 'transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--io-surface)' }}
                onMouseLeave={e => {
                  const isActive = Math.round(zoom * 100) === preset
                  ;(e.currentTarget as HTMLDivElement).style.background = isActive ? 'var(--io-surface)' : 'transparent'
                }}
              >
                {preset}%
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* 5. Mode indicator */}
      <div style={{ ...segmentStyle, color: modeColor }}>
        {modeDot && <span style={{ fontSize: 8, lineHeight: 1 }}>{modeDot}</span>}
        <span>{modeLabel}</span>
      </div>

      {/* Spacer pushes auto-save to the right */}
      <div style={{ flex: 1 }} />

      {/* 6. Auto-save indicator */}
      {lastAutoSave != null && (
        <>
          <Divider />
          <div style={segmentStyle}>
            Auto-saved {formatRelativeTime(lastAutoSave)}
          </div>
        </>
      )}
    </div>
  )
}
