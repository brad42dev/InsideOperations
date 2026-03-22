/**
 * DesignerCanvas.tsx
 *
 * The main SVG canvas for the Designer module.
 * Renders the scene graph as React SVG elements.
 * Handles mouse interaction for select, draw, pan, and pipe tools.
 * Writes selection to uiStore so DesignerRightPanel can reactively subscribe.
 *
 * IMPORTANT: This replaces the older SVG.js-based implementation.
 * All mutations go through SceneCommands + historyStore.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  useContext,
  createContext,
} from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import {
  useSceneStore,
  useUiStore,
  useHistoryStore,
  useLibraryStore,
  useTabStore,
  snapToGridValue,
} from '../../store/designer'
import type { NodeId } from '../../shared/types/graphics'
import type {
  SceneNode,
  GraphicDocument,
  Primitive,
  Pipe,
  TextBlock,
  SymbolInstance,
  DisplayElement,
  ImageNode,
  Group,
  EmbeddedSvgNode,
  Stencil,
  Annotation,
  Transform,
  WidgetNode,
  WidgetType,
  WidgetConfig,
  PointBinding,
  DisplayElementType,
  DisplayElementConfig,
} from '../../shared/types/graphics'
import {
  AddNodeCommand,
  DeleteNodesCommand,
  DuplicateNodesCommand,
  GroupNodesCommand,
  UngroupCommand,
  MoveNodesCommand,
  PasteNodesCommand,
  ReorderNodeCommand,
  RotateNodesCommand,
  FlipNodesCommand,
  ResizePrimitiveCommand,
  ResizeNodeCommand,
  ResizeNodeWithDimsCommand,
  ChangeShapeVariantCommand,
  ChangeShapeConfigurationCommand,
  AddDisplayElementCommand,
  ChangeBindingCommand,
  ChangeDisplayElementTypeCommand,
  DetachDisplayElementCommand,
  ChangePropertyCommand,
  CompoundCommand,
} from '../../shared/graphics/commands'
import type { SceneCommand } from '../../shared/graphics/commands'
import { PIPE_SERVICE_COLORS } from '../../shared/types/graphics'
import { routePipe } from '../../shared/graphics/pipeRouter'
import { usePointValues } from '../../shared/hooks/usePointValues'
import type { PointValue } from '../../shared/hooks/usePointValues'
import { SaveAsStencilDialog } from './components/SaveAsStencilDialog'
import { PromoteToShapeWizard } from './components/PromoteToShapeWizard'
import PointPickerModal from './components/PointPickerModal'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerCanvasProps {
  className?: string
  style?: React.CSSProperties
  onPropertiesOpen?: () => void
  /** Called when the user selects "Open in Tab" on a group node. */
  onOpenGroupInTab?: (groupNodeId: NodeId, groupName: string) => void
  /**
   * When non-null, the canvas is in "group sub-tab" mode.
   * Only the children of this group node are rendered.
   */
  groupSubTabNodeId?: NodeId | null
}

// ---------------------------------------------------------------------------
// Resize handle positions (8-point: 4 corners + 4 edge midpoints)
// ---------------------------------------------------------------------------

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const RESIZE_HANDLES: Array<{ id: ResizeHandle; cx: number; cy: number; cursor: string }> = [
  { id: 'nw', cx: 0,   cy: 0,   cursor: 'nw-resize' },
  { id: 'n',  cx: 0.5, cy: 0,   cursor: 'n-resize'  },
  { id: 'ne', cx: 1,   cy: 0,   cursor: 'ne-resize' },
  { id: 'e',  cx: 1,   cy: 0.5, cursor: 'e-resize'  },
  { id: 'se', cx: 1,   cy: 1,   cursor: 'se-resize' },
  { id: 's',  cx: 0.5, cy: 1,   cursor: 's-resize'  },
  { id: 'sw', cx: 0,   cy: 1,   cursor: 'sw-resize' },
  { id: 'w',  cx: 0,   cy: 0.5, cursor: 'w-resize'  },
]

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RULER_SIZE = 16 // px — thickness of ruler strips (also used by RulersOverlay)

// ---------------------------------------------------------------------------
// Module-level clipboard (survives across renders)
// ---------------------------------------------------------------------------

let _clipboard: SceneNode[] = []

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker path simplification for freehand draw
// ---------------------------------------------------------------------------

function ptLineDist(p: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}): number {
  const dx = b.x - a.x, dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function rdpSimplify(pts: Array<{x:number;y:number}>, eps: number): Array<{x:number;y:number}> {
  if (pts.length <= 2) return pts
  let maxD = 0, maxI = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > maxD) { maxD = d; maxI = i }
  }
  if (maxD > eps) {
    const l = rdpSimplify(pts.slice(0, maxI + 1), eps)
    const r = rdpSimplify(pts.slice(maxI), eps)
    return [...l.slice(0, -1), ...r]
  }
  return [pts[0], pts[pts.length - 1]]
}

// ---------------------------------------------------------------------------
// Selection state — written to uiStore; selectedIdsRef is a synchronous cache
// kept in sync with the store so callbacks can read without triggering renders.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Group naming helpers
// ---------------------------------------------------------------------------

/** Returns "Group N" where N is one higher than the max existing "Group N" name */
function nextGroupName(doc: GraphicDocument): string {
  let max = 0
  function scan(nodes: SceneNode[]) {
    for (const n of nodes) {
      const m = n.name?.match(/^Group (\d+)$/)
      if (m) max = Math.max(max, parseInt(m[1]))
      if ('children' in n && Array.isArray(n.children)) {
        scan(n.children as SceneNode[])
      }
    }
  }
  scan(doc.children)
  return `Group ${max + 1}`
}

// ---------------------------------------------------------------------------
// NameGroupPrompt — small native <dialog> for naming/renaming groups
// ---------------------------------------------------------------------------

interface NameGroupPromptProps {
  defaultName: string
  title?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

function NameGroupPrompt({ defaultName, title = 'Name Group', onConfirm, onCancel }: NameGroupPromptProps) {
  const [value, setValue] = React.useState(defaultName)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.select()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  function handleConfirm() {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const dialogStyle: React.CSSProperties = {
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    padding: '20px',
    minWidth: 280,
    display: 'flex', flexDirection: 'column', gap: 12,
  }
  const titleStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: 'var(--io-text-primary)',
    margin: 0,
  }
  const inputStyleLocal: React.CSSProperties = {
    width: '100%', padding: '6px 8px',
    background: 'var(--io-surface-sunken)', border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  }
  const btnBase: React.CSSProperties = {
    padding: '5px 14px', fontSize: 12, cursor: 'pointer',
    borderRadius: 'var(--io-radius)', border: '1px solid var(--io-border)',
    background: 'transparent', color: 'var(--io-text-secondary)',
  }
  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: 'var(--io-accent)', color: '#09090b', border: 'none', fontWeight: 600,
  }

  return (
    <div style={overlayStyle} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={dialogStyle} onMouseDown={e => e.stopPropagation()}>
        <p style={titleStyle}>{title}</p>
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyleLocal}
          placeholder="Group name"
        />
        <div style={rowStyle}>
          <button style={btnBase} onClick={onCancel}>Cancel</button>
          <button style={btnPrimary} onClick={handleConfirm} disabled={!value.trim()}>OK</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Node bounding box (canvas coordinates)
// ---------------------------------------------------------------------------

export function getNodeBounds(node: SceneNode): { x: number; y: number; w: number; h: number } {
  const { x, y } = node.transform.position
  if (node.type === 'primitive') {
    const p = node as Primitive
    if (p.geometry.type === 'rect')   return { x, y, w: p.geometry.width,       h: p.geometry.height }
    if (p.geometry.type === 'ellipse') return { x: x - p.geometry.rx, y: y - p.geometry.ry, w: p.geometry.rx * 2, h: p.geometry.ry * 2 }
    if (p.geometry.type === 'line') {
      const minX = Math.min(p.geometry.x1, p.geometry.x2)
      const minY = Math.min(p.geometry.y1, p.geometry.y2)
      return { x: minX, y: minY, w: Math.abs(p.geometry.x2 - p.geometry.x1) || 4, h: Math.abs(p.geometry.y2 - p.geometry.y1) || 4 }
    }
  }
  if (node.type === 'text_block') {
    const tb = node as TextBlock
    return { x, y, w: tb.maxWidth ?? 120, h: tb.fontSize ? tb.fontSize * 2 : 20 }
  }
  if (node.type === 'image') {
    const img = node as ImageNode
    return { x, y, w: img.displayWidth, h: img.displayHeight }
  }
  if (node.type === 'pipe') {
    const pipe = node as Pipe
    if (pipe.waypoints && pipe.waypoints.length >= 2) {
      const xs = pipe.waypoints.map(p => p.x)
      const ys = pipe.waypoints.map(p => p.y)
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) || 4, h: Math.max(...ys) - Math.min(...ys) || 4 }
    }
  }
  if (node.type === 'widget') {
    const wn = node as WidgetNode
    return { x, y, w: wn.width, h: wn.height }
  }
  if (node.type === 'embedded_svg') {
    const esn = node as EmbeddedSvgNode
    return { x, y, w: esn.width || 64, h: esn.height || 64 }
  }
  if (node.type === 'symbol_instance') {
    const si = node as SymbolInstance
    const shapeData = useLibraryStore.getState().getShape(si.shapeRef.shapeId)
    const geo = shapeData?.sidecar.geometry
    const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? 64
    const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? 64
    return { x, y, w: naturalW * (si.transform.scale.x ?? 1), h: naturalH * (si.transform.scale.y ?? 1) }
  }
  if (node.type === 'stencil') {
    const st = node as Stencil
    return { x, y, w: st.size?.width ?? 48, h: st.size?.height ?? 24 }
  }
  if (node.type === 'display_element') {
    const de = node as DisplayElement
    const cfg = de.config
    switch (cfg.displayType) {
      case 'text_readout':    return { x, y, w: cfg.width ?? 92, h: cfg.height ?? 22 }
      case 'analog_bar':      return { x, y, w: cfg.barWidth ?? 25, h: cfg.barHeight ?? 100 }
      case 'fill_gauge':      return { x, y, w: cfg.barWidth ?? 24, h: cfg.barHeight ?? 80 }
      case 'sparkline':       return { x, y, w: cfg.sparkWidth ?? 110, h: cfg.sparkHeight ?? 18 }
      case 'alarm_indicator': return { x, y, w: cfg.width ?? 24, h: cfg.height ?? 20 }
      case 'digital_status':  return { x, y, w: cfg.width ?? 30, h: cfg.height ?? 20 }
      default:                return { x, y, w: 80, h: 24 }
    }
  }
  if (node.type === 'annotation') {
    const an = node as import('../../shared/types/graphics').Annotation
    return { x, y, w: an.width, h: an.height }
  }
  if (node.type === 'group') {
    const grp = node as Group
    if (!grp.children || grp.children.length === 0) {
      return { x, y, w: 64, h: 64 }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const child of grp.children) {
      const cb = getNodeBounds(child)
      if (cb.x < minX) minX = cb.x
      if (cb.y < minY) minY = cb.y
      if (cb.x + cb.w > maxX) maxX = cb.x + cb.w
      if (cb.y + cb.h > maxY) maxY = cb.y + cb.h
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }
  // Default generous bbox for stencils, etc.
  return { x, y, w: 64, h: 64 }
}

function boundsOverlap(
  b: { x: number; y: number; w: number; h: number },
  rx: number, ry: number, rw: number, rh: number
): boolean {
  return b.x < rx + rw && b.x + b.w > rx && b.y < ry + rh && b.y + b.h > ry
}

// ---------------------------------------------------------------------------
// Find the parent node of a given node ID in the scene tree
// ---------------------------------------------------------------------------

function getNodeParent(nodeId: NodeId, nodes: SceneNode[]): SceneNode | null {
  for (const n of nodes) {
    if ('children' in n && Array.isArray(n.children)) {
      const children = n.children as SceneNode[]
      if (children.some(c => c.id === nodeId)) return n
      const found = getNodeParent(nodeId, children)
      if (found) return found
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Test mode: live point value context
// ---------------------------------------------------------------------------

const TestModeContext = createContext<Map<string, PointValue>>(new Map())

// Extract all unique point IDs from a doc for WebSocket subscription
function extractPointIds(doc: GraphicDocument): string[] {
  const ids = new Set<string>()

  function scanNode(node: SceneNode) {
    if (node.type === 'display_element') {
      const de = node as DisplayElement
      if (de.binding.pointId) ids.add(de.binding.pointId)
    }
    if (node.type === 'symbol_instance') {
      const si = node as SymbolInstance
      if (si.stateBinding?.pointId) ids.add(si.stateBinding.pointId)
      si.children?.forEach(scanNode)
    }
    if ('children' in node && Array.isArray((node as Group).children)) {
      ;(node as Group).children.forEach(c => scanNode(c as SceneNode))
    }
  }

  doc.children.forEach(scanNode)
  return Array.from(ids)
}

// Simple printf-style value formatter (%.1f, %.0f, %d, %s)
function formatValue(value: number, format: string): string {
  const m = format.match(/%\.?(\d*)([fds])/)
  if (!m) return String(value)
  if (m[2] === 'd') return Math.round(value).toString()
  if (m[2] === 's') return String(value)
  const dec = m[1] ? parseInt(m[1]) : 2
  return value.toFixed(dec)
}

// ---------------------------------------------------------------------------
// SVG transform string builder
// ---------------------------------------------------------------------------

function buildTransform(
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  mirror: string,
  pivotX = 0,
  pivotY = 0
): string {
  let sx = scaleX
  let sy = scaleY
  if (mirror === 'horizontal') sx = -sx
  if (mirror === 'vertical') sy = -sy
  if (mirror === 'both') { sx = -sx; sy = -sy }

  const parts: string[] = [`translate(${x},${y})`]
  if (rotation !== 0) parts.push(`rotate(${rotation},${pivotX},${pivotY})`)
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx},${sy})`)
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Primitive geometry → SVG element
// ---------------------------------------------------------------------------

function renderPrimitiveGeometry(node: Primitive): React.ReactNode {
  const { geometry, style, transform, opacity, id, visible } = node
  if (!visible) return null

  const svgStyle: React.SVGProps<SVGElement>['style'] = {
    fill: style.fill,
    fillOpacity: style.fillOpacity,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDasharray: style.strokeDasharray,
    strokeLinecap: style.strokeLinecap,
    strokeLinejoin: style.strokeLinejoin,
    opacity,
  }

  const t = buildTransform(
    transform.position.x,
    transform.position.y,
    transform.rotation,
    transform.scale.x,
    transform.scale.y,
    transform.mirror,
  )

  const gProps = { key: id, transform: t, 'data-node-id': id }

  switch (geometry.type) {
    case 'rect':
      return <g {...gProps}><rect x={0} y={0} width={geometry.width} height={geometry.height} rx={geometry.rx} ry={geometry.ry} style={svgStyle as React.CSSProperties} /></g>
    case 'circle':
      return <g {...gProps}><circle cx={0} cy={0} r={geometry.r} style={svgStyle as React.CSSProperties} /></g>
    case 'ellipse':
      return <g {...gProps}><ellipse cx={0} cy={0} rx={geometry.rx} ry={geometry.ry} style={svgStyle as React.CSSProperties} /></g>
    case 'line':
      return <g {...gProps}><line x1={geometry.x1} y1={geometry.y1} x2={geometry.x2} y2={geometry.y2} style={svgStyle as React.CSSProperties} /></g>
    case 'polyline': {
      const pts = geometry.points.map(p => `${p.x},${p.y}`).join(' ')
      return <g {...gProps}><polyline points={pts} style={svgStyle as React.CSSProperties} /></g>
    }
    case 'polygon': {
      const pts = geometry.points.map(p => `${p.x},${p.y}`).join(' ')
      return <g {...gProps}><polygon points={pts} style={svgStyle as React.CSSProperties} /></g>
    }
    case 'path':
      return <g {...gProps}><path d={geometry.d} style={svgStyle as React.CSSProperties} /></g>
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// DisplayElement renderer — static (design) and live (test mode)
// ---------------------------------------------------------------------------

function DisplayElementRenderer({ node, tx }: { node: DisplayElement; tx: string }) {
  const liveValues = useContext(TestModeContext)
  const live = node.binding.pointId ? liveValues.get(node.binding.pointId) : undefined
  const cfg = node.config
  const de = node

  // ── Live rendering (test mode has a value) ────────────────────────────────
  if (live !== undefined) {
    const v = live.value
    const stale = live.stale
    const textColor = stale ? '#6b7280' : 'var(--io-text-primary)'

    switch (cfg.displayType) {
      case 'text_readout': {
        const formatted = formatValue(v, cfg.valueFormat ?? '%.2f')
        return (
          <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
            <rect x={0} y={0} width={Math.max(cfg.minWidth ?? 60, formatted.length * 8 + 8)} height={22}
              fill="rgba(0,0,0,0.6)" stroke={stale ? '#6b7280' : 'var(--io-accent)'} strokeWidth={0.5} rx={2} />
            <text x={4} y={14} fontSize={11} fill={textColor} fontFamily="var(--io-font-mono)">{formatted}</text>
          </g>
        )
      }
      case 'analog_bar': {
        const barW = cfg.orientation === 'vertical' ? cfg.barWidth : cfg.barHeight
        const barH = cfg.orientation === 'vertical' ? cfg.barHeight : cfg.barWidth
        const range = (cfg.rangeHi - cfg.rangeLo) || 1
        const pct = Math.max(0, Math.min(1, (v - cfg.rangeLo) / range))
        const fillW = cfg.orientation === 'horizontal' ? barW * pct : barW
        const fillH = cfg.orientation === 'vertical' ? barH * pct : barH
        const fillY = cfg.orientation === 'vertical' ? barH - fillH : 0
        return (
          <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
            <rect x={0} y={0} width={barW} height={barH} fill="rgba(0,0,0,0.4)" stroke="var(--io-border)" strokeWidth={0.5} rx={1} />
            <rect x={0} y={fillY} width={fillW} height={fillH}
              fill={stale ? '#6b7280' : 'var(--io-accent)'} rx={1} style={{ transition: 'height 0.3s, width 0.3s, y 0.3s' }} />
            {cfg.showNumericReadout && (
              <text x={barW / 2} y={barH + 11} fontSize={9} fill={textColor} textAnchor="middle" fontFamily="var(--io-font-mono)">
                {formatValue(v, '%.1f')}
              </text>
            )}
          </g>
        )
      }
      case 'alarm_indicator': {
        const alarming = v !== 0
        return (
          <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
            <circle cx={8} cy={8} r={7}
              fill={alarming ? '#ef4444' : '#22c55e'}
              stroke={alarming ? '#dc2626' : '#16a34a'}
              strokeWidth={1}
            />
          </g>
        )
      }
      case 'digital_status': {
        const label = cfg.stateLabels[String(Math.round(v))] ?? String(Math.round(v))
        const isNormal = cfg.normalStates.includes(String(Math.round(v)))
        return (
          <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
            <rect x={0} y={0} width={60} height={20} fill={isNormal ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'} stroke={isNormal ? '#22c55e' : '#ef4444'} strokeWidth={0.5} rx={2} />
            <text x={4} y={13} fontSize={9} fill={isNormal ? '#22c55e' : '#ef4444'}>{label}</text>
          </g>
        )
      }
      case 'fill_gauge': {
        const range = (cfg.rangeHi - cfg.rangeLo) || 1
        const pct = Math.max(0, Math.min(1, (v - cfg.rangeLo) / range))
        const w = (cfg.barWidth ?? 40), h = (cfg.barHeight ?? 80)
        const fillH = h * pct
        return (
          <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
            <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.4)" stroke="var(--io-border)" strokeWidth={0.5} rx={2} />
            <rect x={0} y={h - fillH} width={w} height={fillH} fill={stale ? '#6b7280' : '#3b82f6'} rx={1} />
            {cfg.showValue && (
              <text x={w / 2} y={h / 2 + 4} fontSize={9} fill={textColor} textAnchor="middle" fontFamily="var(--io-font-mono)">
                {formatValue(v, cfg.valueFormat ?? '%.0f')}
              </text>
            )}
          </g>
        )
      }
      default:
        break
    }
  }

  // ── Design mode (static) spec-accurate preview ──────────────────────────
  const tagLabel = de.binding.pointId ? '⬤' : ''
  switch (cfg.displayType) {
    case 'text_readout': {
      const label = 'showLabel' in cfg && cfg.showLabel && 'label' in cfg && cfg.label
        ? (cfg.label as string) : null
      const unit = 'showUnit' in cfg && cfg.showUnit && 'unit' in cfg && cfg.unit
        ? ` ${cfg.unit as string}` : ''
      const boxW = 92, boxH = label ? 32 : 22
      return (
        <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
          <rect x={0} y={0} width={boxW} height={boxH} rx={2} fill="#27272A" stroke="#3F3F46" strokeWidth={1}/>
          {label && <text x={4} y={10} fontSize={8} fill="#71717A" fontFamily="Inter, sans-serif">{label}</text>}
          <text x={46} y={label ? 24 : 14} textAnchor="middle" dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace" fontSize={11} fill="#A1A1AA"
            fontVariant="tabular-nums">
            — <tspan fontFamily="Inter, sans-serif" fontSize={9} fill="#71717A">{unit}</tspan>
          </text>
          {de.binding.pointId && (
            <text x={boxW - 3} y={8} textAnchor="end" fontSize={7} fill="#2DD4BF" opacity={0.7}>{tagLabel}</text>
          )}
        </g>
      )
    }
    case 'analog_bar': {
      const bW = 18, bH = 'barHeight' in cfg ? (cfg.barHeight as number) : 100
      return (
        <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
          <rect x={0} y={0} width={bW} height={bH} fill="#27272A" stroke="#52525B" strokeWidth={0.5}/>
          <rect x={1} y={1}              width={bW-2} height={Math.round(bH*0.1)} fill="#5C3A3A" stroke="#52525B" strokeWidth={0.5}/>
          <rect x={1} y={Math.round(bH*0.1)+1} width={bW-2} height={Math.round(bH*0.17)} fill="#5C4A32" stroke="#52525B" strokeWidth={0.5}/>
          <rect x={1} y={Math.round(bH*0.27)+1} width={bW-2} height={Math.round(bH*0.46)} fill="#404048" stroke="#52525B" strokeWidth={0.5}/>
          <rect x={1} y={Math.round(bH*0.73)+1} width={bW-2} height={Math.round(bH*0.17)} fill="#32445C" stroke="#52525B" strokeWidth={0.5}/>
          <rect x={1} y={Math.round(bH*0.9)+1}  width={bW-2} height={Math.round(bH*0.09)} fill="#2E3A5C" stroke="#52525B" strokeWidth={0.5}/>
          {/* Zone labels */}
          <text x={-3} y={Math.round(bH*0.08)} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={7} fill="#71717A">HH</text>
          <text x={-3} y={Math.round(bH*0.2)}  textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={7} fill="#71717A">H</text>
          <text x={-3} y={Math.round(bH*0.78)} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={7} fill="#71717A">L</text>
          <text x={-3} y={Math.round(bH*0.95)} textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize={7} fill="#71717A">LL</text>
          {/* Pointer at mid-range */}
          <polygon points={`${bW},${bH/2-3} ${bW+7},${bH/2} ${bW},${bH/2+3}`} fill="#A1A1AA"/>
          <line x1={1} y1={bH/2} x2={bW-1} y2={bH/2} stroke="#A1A1AA" strokeWidth={0.8}/>
        </g>
      )
    }
    case 'fill_gauge': {
      const gW = 'barWidth' in cfg ? (cfg.barWidth as number) : 24
      const gH = 'barHeight' in cfg ? (cfg.barHeight as number) : 80
      return (
        <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
          <rect x={0} y={0} width={gW} height={gH} rx={2} fill="none" stroke="#52525B" strokeWidth={0.5}/>
          <rect x={1} y={Math.round(gH*0.38)} width={gW-2} height={Math.round(gH*0.61)} rx={1} fill="#475569" opacity={0.6}/>
          <line x1={1} y1={Math.round(gH*0.38)} x2={gW-1} y2={Math.round(gH*0.38)} stroke="#64748B" strokeWidth={0.8} strokeDasharray="5 3"/>
        </g>
      )
    }
    case 'sparkline': {
      const sW = 'sparkWidth' in cfg ? (cfg.sparkWidth as number) : 110
      const sH = 18
      return (
        <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
          <rect x={0} y={0} width={sW} height={sH} rx={1} fill="#27272A"/>
          <polyline
            points={`3,14 ${sW*0.09|0},11 ${sW*0.17|0},13 ${sW*0.26|0},8 ${sW*0.35|0},10 ${sW*0.43|0},6 ${sW*0.51|0},11 ${sW*0.59|0},9 ${sW*0.68|0},5 ${sW*0.76|0},10 ${sW*0.84|0},8 ${sW*0.92|0},13 ${sW-3},10`}
            fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
          />
        </g>
      )
    }
    case 'alarm_indicator': {
      // Ghost indicator in design mode — 25% opacity, gray, dash inside
      return (
        <g transform={tx} data-node-id={de.id} opacity={0.3 * de.opacity}>
          <rect x={-12} y={-9} width={24} height={18} rx={2} fill="none" stroke="#808080" strokeWidth={1.8}/>
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace" fontSize={9} fontWeight={600} fill="#808080">—</text>
        </g>
      )
    }
    case 'digital_status': {
      const stateText = de.binding.pointId ? 'AUTO' : '—'
      const dW = stateText.length * 6 + 12
      return (
        <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
          <rect x={0} y={0} width={dW} height={20} rx={2} fill="#3F3F46"/>
          <text x={dW/2} y={10} textAnchor="middle" dominantBaseline="central"
            fontFamily="'JetBrains Mono', monospace" fontSize={9} fill="#A1A1AA">{stateText}</text>
        </g>
      )
    }
    default: {
      return (
        <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
          <rect x={0} y={0} width={80} height={22} fill="#27272A" stroke="#3F3F46" rx={2}/>
          <text x={4} y={14} fontSize={9} fill="#71717A">{de.displayType.replace(/_/g, ' ')}</text>
        </g>
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Widget renderer — design-time placeholder for dashboard/report widgets
// ---------------------------------------------------------------------------

const WIDGET_ICONS: Record<string, string> = {
  trend:      '📈',
  table:      '▦',
  gauge:      '⏱',
  kpi_card:   '◈',
  bar_chart:  '📊',
  pie_chart:  '◕',
  alarm_list: '🔔',
  muster_point: '📍',
}

function WidgetRenderer({ node, tx }: { node: WidgetNode; tx: string }) {
  const { widgetType, width, height, config } = node
  const title = ('title' in config ? (config as { title?: string }).title : undefined) ?? widgetType.replace(/_/g, ' ')
  const icon = WIDGET_ICONS[widgetType] ?? '▭'
  const isSmall = width < 80 || height < 50

  return (
    <g transform={tx} data-node-id={node.id} opacity={node.opacity}>
      {/* Background */}
      <rect
        x={0} y={0}
        width={Math.max(width, 40)}
        height={Math.max(height, 28)}
        fill="var(--io-surface-elevated)"
        stroke="var(--io-border)"
        strokeWidth={1}
        rx={3}
      />
      {/* Title bar */}
      <rect
        x={0} y={0}
        width={Math.max(width, 40)}
        height={18}
        fill="rgba(99,102,241,0.12)"
        rx={3}
      />
      <rect x={0} y={14} width={Math.max(width, 40)} height={4} fill="rgba(99,102,241,0.12)" />
      <text x={6} y={12} fontSize={9} fill="var(--io-accent)" fontWeight={500}>{title}</text>
      {/* Center icon */}
      {!isSmall && (
        <>
          <text
            x={Math.max(width, 40) / 2}
            y={Math.max(height, 28) / 2 + 10}
            textAnchor="middle"
            fontSize={22}
            fill="rgba(99,102,241,0.25)"
            fontFamily="serif"
          >{icon}</text>
          <text
            x={Math.max(width, 40) / 2}
            y={Math.max(height, 28) - 6}
            textAnchor="middle"
            fontSize={8}
            fill="var(--io-text-muted)"
          >{widgetType.replace(/_/g, ' ')}</text>
        </>
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Render a single SceneNode
// ---------------------------------------------------------------------------

function RenderNode({
  node,
  getShapeSvg,
  selectedIds,
}: {
  node: SceneNode
  getShapeSvg: (id: string) => string | null
  selectedIds: Set<NodeId>
}): React.ReactElement | null {
  if (!node.visible) return null

  const { transform } = node
  const tx = buildTransform(
    transform.position.x,
    transform.position.y,
    transform.rotation,
    transform.scale.x,
    transform.scale.y,
    transform.mirror,
  )

  switch (node.type) {
    case 'primitive':
      return renderPrimitiveGeometry(node as Primitive) as React.ReactElement | null

    case 'pipe': {
      const pipe = node as Pipe
      const color = PIPE_SERVICE_COLORS[pipe.serviceType] ?? '#6B8CAE'
      const commonStrokeProps = {
        fill: 'none' as const,
        stroke: color,
        strokeWidth: pipe.strokeWidth,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        strokeDasharray: pipe.dashPattern,
      }
      // Insulation: parallel offset lines on each side
      const insulationOffset = pipe.strokeWidth + 2
      const renderPipePath = (d: string | null, pts: string | null) => (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          {pipe.insulated && d && (
            <>
              <path d={d} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5}
                strokeDasharray="4 2"
                style={{ transform: `translate(0, ${-insulationOffset}px)`, pointerEvents: 'none' as const }} />
              <path d={d} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5}
                strokeDasharray="4 2"
                style={{ transform: `translate(0, ${insulationOffset}px)`, pointerEvents: 'none' as const }} />
            </>
          )}
          {pipe.insulated && pts && (
            <>
              <polyline points={pts} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5}
                strokeDasharray="4 2"
                style={{ transform: `translate(0, ${-insulationOffset}px)`, pointerEvents: 'none' as const }} />
              <polyline points={pts} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.5}
                strokeDasharray="4 2"
                style={{ transform: `translate(0, ${insulationOffset}px)`, pointerEvents: 'none' as const }} />
            </>
          )}
          {d && <path d={d} {...commonStrokeProps} />}
          {pts && <polyline points={pts} {...commonStrokeProps} />}
        </g>
      )
      if (pipe.routingMode === 'auto' && pipe.waypoints.length >= 2) {
        const [start, ...rest] = pipe.waypoints
        const end = rest[rest.length - 1]
        const midWaypoints = rest.slice(0, -1)
        const pathD = routePipe(start, end, new Set(), midWaypoints)
        return renderPipePath(pathD, null)
      }
      const pts = pipe.waypoints.map(p => `${p.x},${p.y}`).join(' ')
      return renderPipePath(null, pts)
    }

    case 'text_block': {
      const tb = node as TextBlock
      const bgPad = tb.background?.padding ?? 0
      const tbW = (tb.maxWidth ?? 120) + bgPad * 2
      const tbH = (tb.fontSize ? tb.fontSize * 1.4 : 20) + bgPad * 2
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          {tb.background && (
            <rect
              x={0} y={0}
              width={tbW} height={tbH}
              rx={tb.background.borderRadius ?? 2}
              fill={tb.background.fill}
              stroke={tb.background.stroke}
              strokeWidth={tb.background.strokeWidth}
            />
          )}
          <text
            x={bgPad}
            y={bgPad}
            fontFamily={tb.fontFamily}
            fontSize={tb.fontSize}
            fontWeight={tb.fontWeight}
            fontStyle={tb.fontStyle}
            textAnchor={tb.textAnchor}
            fill={tb.fill}
            dominantBaseline="hanging"
          >
            {tb.content}
          </text>
        </g>
      )
    }

    case 'symbol_instance': {
      const si = node as SymbolInstance
      const shapeEntry = useLibraryStore.getState().getShape(si.shapeRef.shapeId)
      const svgStr = shapeEntry?.svg ?? null
      const geo = shapeEntry?.sidecar.geometry
      const bw = geo?.baseSize?.[0] ?? geo?.width ?? 64
      const bh = geo?.baseSize?.[1] ?? geo?.height ?? 64
      const viewBox = svgStr?.match(/viewBox=["']([^"']+)["']/)?.[1] ?? `0 0 ${bw} ${bh}`
      if (!svgStr) {
        // Placeholder box while shape loads
        return (
          <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
            <rect x={0} y={0} width={bw} height={bh} fill="none" stroke="var(--io-border)" strokeDasharray="4 2" rx={2}/>
            <text x={bw/2} y={bh/2+4} textAnchor="middle" fontSize={9} fill="var(--io-text-muted)">
              {si.shapeRef.shapeId.replace(/_/g, ' ')}
            </text>
          </g>
        )
      }
      // Extract inner SVG content (strip outer <svg> wrapper tag)
      const innerMatch = svgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
      const inner = innerMatch ? innerMatch[1] : svgStr
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          <svg x={0} y={0} width={bw} height={bh} viewBox={viewBox} overflow="visible"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: inner }}
          />
        </g>
      )
    }

    case 'display_element': {
      const de = node as DisplayElement
      return <DisplayElementRenderer key={node.id} node={de} tx={tx} />
    }

    case 'image': {
      const img = node as ImageNode
      // Support both server-side hashes and embedded data URLs
      const url = img.assetRef.hash.startsWith('data:')
        ? img.assetRef.hash
        : `/api/v1/image-assets/${img.assetRef.hash}`
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          <image href={url} x={0} y={0} width={img.displayWidth} height={img.displayHeight}
            preserveAspectRatio={img.preserveAspectRatio ? 'xMidYMid meet' : 'none'}
            imageRendering={img.imageRendering === 'auto' ? undefined : img.imageRendering}
          />
        </g>
      )
    }

    case 'group': {
      const grp = node as Group
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          {grp.children.map(child => (
            <RenderNode key={child.id} node={child} getShapeSvg={getShapeSvg} selectedIds={selectedIds} />
          ))}
        </g>
      )
    }

    case 'embedded_svg': {
      const esn = node as EmbeddedSvgNode
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}
          dangerouslySetInnerHTML={{ __html: esn.svgContent }}
        />
      )
    }

    case 'widget': {
      const wn = node as WidgetNode
      return <WidgetRenderer key={node.id} node={wn} tx={tx} />
    }

    case 'annotation': {
      const an = node as import('../../shared/types/graphics').Annotation
      const cfg = an.config as unknown as Record<string, unknown>
      const aw = (cfg.width as number) ?? 200
      const ah = (cfg.height as number) ?? 20
      switch (an.annotationType) {
        case 'section_break': {
          const sbCfg = an.config as import('../../shared/types/graphics').SectionBreakConfig
          const thickness = sbCfg.thickness ?? 1.5
          const color = sbCfg.color ?? 'var(--io-accent)'
          const dasharray = sbCfg.style === 'dotted' ? '2 4' : sbCfg.style === 'space' ? undefined : undefined
          const isSpace = sbCfg.style === 'space'
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              {isSpace
                ? <rect x={0} y={0} width={aw} height={thickness} fill="none"/>
                : <line x1={0} y1={thickness / 2} x2={aw} y2={thickness / 2} stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={dasharray}/>
              }
            </g>
          )
        }
        case 'page_break':
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              <line x1={0} y1={10} x2={aw} y2={10} stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeDasharray="6 4"/>
              <rect x={aw / 2 - 28} y={2} width={56} height={14} rx={2} fill="rgba(239,68,68,0.15)"/>
              <text x={aw / 2} y={12} textAnchor="middle" fontSize={8} fill="#EF4444" fontWeight={600} fontFamily="Inter">PAGE BREAK</text>
            </g>
          )
        case 'header': {
          const hCfg = an.config as import('../../shared/types/graphics').HeaderConfig
          const hH = hCfg.height ?? 40
          const hFs = hCfg.fontSize ?? 11
          const hContent = hCfg.content ?? 'Header'
          const hAnchor = hCfg.textAlign === 'center' ? 'middle' : hCfg.textAlign === 'right' ? 'end' : 'start'
          const hTx = hCfg.textAlign === 'center' ? aw / 2 : hCfg.textAlign === 'right' ? aw - 8 : 8
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              <rect x={0} y={0} width={aw} height={hH} rx={2} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={1}/>
              <text x={hTx} y={hH / 2 + hFs * 0.35} textAnchor={hAnchor} fontSize={hFs} fill="#93c5fd" fontWeight={500} fontFamily="Inter">{hContent}</text>
              <line x1={0} y1={hH} x2={aw} y2={hH} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3"/>
            </g>
          )
        }
        case 'footer': {
          const fCfg = an.config as import('../../shared/types/graphics').FooterConfig
          const fH = fCfg.height ?? 40
          const fFs = fCfg.fontSize ?? 11
          const fContent = fCfg.content ?? 'Footer'
          const fAnchor = fCfg.textAlign === 'center' ? 'middle' : fCfg.textAlign === 'right' ? 'end' : 'start'
          const fTx = fCfg.textAlign === 'center' ? aw / 2 : fCfg.textAlign === 'right' ? aw - 8 : 8
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              <line x1={0} y1={0} x2={aw} y2={0} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3"/>
              <rect x={0} y={0} width={aw} height={fH} rx={2} fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth={1}/>
              <text x={fTx} y={fH / 2 + fFs * 0.35} textAnchor={fAnchor} fontSize={fFs} fill="#93c5fd" fontWeight={500} fontFamily="Inter">{fContent}</text>
            </g>
          )
        }
        case 'callout': {
          const cCfg = an.config as import('../../shared/types/graphics').CalloutConfig
          const cFs = cCfg.fontSize ?? 11
          const cPad = cCfg.padding ?? 6
          const cBg = cCfg.backgroundColor ?? '#27272A'
          const cBorder = cCfg.borderColor ?? '#3F3F46'
          const cFill = cCfg.fill ?? '#F4F4F5'
          const cRx = cCfg.borderRadius ?? 4
          const cText = cCfg.text ?? ''
          const cW = Math.max(60, cText.length * cFs * 0.6 + cPad * 2)
          const cH = cFs + cPad * 2
          const tp = cCfg.targetPoint ?? { x: cW / 2, y: cH + 20 }
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              {/* Leader line */}
              <line x1={cW / 2} y1={cH} x2={tp.x} y2={tp.y} stroke={cBorder} strokeWidth={1.5} strokeLinecap="round"/>
              <circle cx={tp.x} cy={tp.y} r={3} fill={cBorder}/>
              {/* Callout box */}
              <rect x={0} y={0} width={cW} height={cH} rx={cRx} fill={cBg} stroke={cBorder} strokeWidth={1}/>
              <text x={cPad} y={cPad + cFs * 0.8} fontSize={cFs} fill={cFill} fontFamily="Inter">{cText}</text>
            </g>
          )
        }
        case 'dimension_line': {
          const dCfg = an.config as import('../../shared/types/graphics').DimensionLineConfig
          const dColor = dCfg.color ?? '#A1A1AA'
          const dFs = dCfg.fontSize ?? 9
          const sp = dCfg.startPoint ?? { x: 0, y: 0 }
          const ep = dCfg.endPoint ?? { x: 100, y: 0 }
          const offset = dCfg.offset ?? 16
          const dist = Math.round(Math.hypot(ep.x - sp.x, ep.y - sp.y))
          const label = dCfg.label ?? `${dist}`
          const mx = (sp.x + ep.x) / 2
          const my = (sp.y + ep.y) / 2 - offset - 4
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              {/* Extension lines */}
              <line x1={sp.x} y1={sp.y} x2={sp.x} y2={sp.y - offset} stroke={dColor} strokeWidth={1} strokeDasharray="3 2"/>
              <line x1={ep.x} y1={ep.y} x2={ep.x} y2={ep.y - offset} stroke={dColor} strokeWidth={1} strokeDasharray="3 2"/>
              {/* Dimension line with arrows */}
              <line x1={sp.x} y1={sp.y - offset} x2={ep.x} y2={ep.y - offset} stroke={dColor} strokeWidth={1} markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)"/>
              {/* Label */}
              <rect x={mx - label.length * dFs * 0.3 - 2} y={my - dFs} width={label.length * dFs * 0.6 + 4} height={dFs + 2} fill="var(--io-surface)" rx={2}/>
              <text x={mx} y={my} textAnchor="middle" fontSize={dFs} fill={dColor} fontFamily="Inter">{label}</text>
            </g>
          )
        }
        case 'north_arrow': {
          const nCfg = an.config as import('../../shared/types/graphics').NorthArrowConfig
          const nSize = nCfg.size ?? 40
          const nColor = nCfg.color ?? '#A1A1AA'
          const r = nSize / 2
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              {nCfg.style === 'compass' ? (
                <>
                  <circle cx={r} cy={r} r={r - 1} fill="none" stroke={nColor} strokeWidth={1}/>
                  <polygon points={`${r},2 ${r - 5},${r} ${r},${r - 4} ${r + 5},${r}`} fill={nColor}/>
                  <polygon points={`${r},${nSize - 2} ${r - 5},${r} ${r},${r + 4} ${r + 5},${r}`} fill="none" stroke={nColor} strokeWidth={1}/>
                  <text x={r} y={nSize + 10} textAnchor="middle" fontSize={9} fill={nColor} fontFamily="Inter" fontWeight={600}>N</text>
                </>
              ) : (
                <>
                  <polygon points={`${r},0 ${r - 5},${nSize - 8} ${r},${nSize - 4} ${r + 5},${nSize - 8}`} fill={nColor}/>
                  <text x={r} y={nSize + 10} textAnchor="middle" fontSize={9} fill={nColor} fontFamily="Inter" fontWeight={600}>N</text>
                </>
              )}
            </g>
          )
        }
        case 'legend': {
          const lCfg = an.config as import('../../shared/types/graphics').LegendConfig
          const lFs = lCfg.fontSize ?? 10
          const lBg = lCfg.backgroundColor ?? '#27272A'
          const lBorder = lCfg.borderColor ?? '#3F3F46'
          const entries = lCfg.entries ?? []
          const rowH = lFs + 8
          const lW = 140
          const lH = entries.length * rowH + 16
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              <rect x={0} y={0} width={lW} height={Math.max(lH, 24)} rx={3} fill={lBg} stroke={lBorder} strokeWidth={1}/>
              {entries.map((entry, i) => {
                const y = 8 + i * rowH
                return (
                  <g key={i}>
                    {entry.symbol === 'line'
                      ? <line x1={8} y1={y + rowH / 2} x2={24} y2={y + rowH / 2} stroke={entry.color} strokeWidth={2}/>
                      : entry.symbol === 'circle'
                        ? <circle cx={16} cy={y + rowH / 2} r={5} fill={entry.color}/>
                        : <rect x={8} y={y + 2} width={16} height={rowH - 4} fill={entry.color} rx={1}/>
                    }
                    <text x={30} y={y + lFs} fontSize={lFs} fill="#D4D4D8" fontFamily="Inter">{entry.label}</text>
                  </g>
                )
              })}
            </g>
          )
        }
        case 'border': {
          const bCfg = an.config as import('../../shared/types/graphics').BorderConfig
          const bW = bCfg.width ?? 200
          const bH = bCfg.height ?? 150
          const bStroke = bCfg.strokeColor ?? '#3F3F46'
          const bSW = bCfg.strokeWidth ?? 1
          const bRx = bCfg.cornerStyle === 'rounded' ? (bCfg.cornerRadius ?? 4) : 0
          const bDash = bCfg.strokeDasharray
          const tb = bCfg.titleBlock
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              <rect x={0} y={0} width={bW} height={bH} rx={bRx} fill="none" stroke={bStroke} strokeWidth={bSW} strokeDasharray={bDash}/>
              {tb && (
                <>
                  <line x1={0} y1={bH - 24} x2={bW} y2={bH - 24} stroke={bStroke} strokeWidth={bSW}/>
                  <text x={8} y={bH - 14} fontSize={9} fill="#A1A1AA" fontFamily="Inter" fontWeight={600}>{tb.title}</text>
                  <text x={bW - 8} y={bH - 14} textAnchor="end" fontSize={8} fill="#71717A" fontFamily="Inter">{tb.drawingNumber} Rev {tb.revision}</text>
                  <text x={8} y={bH - 4} fontSize={7} fill="#71717A" fontFamily="Inter">By: {tb.drawnBy}  {tb.date}</text>
                </>
              )}
            </g>
          )
        }
        default:
          return (
            <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
              <rect x={0} y={0} width={Math.max(aw, 60)} height={Math.max(ah, 20)} fill="none" stroke="var(--io-border)" strokeDasharray="3 2" rx={2}/>
              <text x={6} y={14} fontSize={8} fill="var(--io-text-muted)">{an.annotationType}</text>
            </g>
          )
      }
    }

    case 'stencil':
    default:
      // Placeholder for unimplemented types
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          <rect x={0} y={0} width={48} height={24} fill="none" stroke="var(--io-border)" strokeDasharray="3 2"/>
          <text x={4} y={16} fontSize={8} fill="var(--io-text-muted)">{node.type}</text>
        </g>
      )
  }
}

// ---------------------------------------------------------------------------
// Selection overlay — drawn on top of selected nodes
// ---------------------------------------------------------------------------

function SelectionOverlay({
  nodeIds,
  doc,
  zoom,
  onRotateStart,
  onResizeStart,
  previewRotation,
}: {
  nodeIds: Set<NodeId>
  doc: GraphicDocument
  zoom: number
  onRotateStart?: (nodeId: NodeId, center: { x: number; y: number }, initialTransform: Transform) => void
  onResizeStart?: (nodeId: NodeId, handle: ResizeHandle, bounds: { x: number; y: number; w: number; h: number }, transform: Transform, startX: number, startY: number, allNodeIds?: NodeId[], selectionBBox?: { x: number; y: number; w: number; h: number }) => void
  previewRotation?: { nodeId: NodeId; angle: number } | null
}) {
  if (nodeIds.size === 0) return null

  const isSingle = nodeIds.size === 1
  const showRotateHandle = isSingle && !!onRotateStart
  const showResizeHandles = !!onResizeStart

  // Compute union bounding box for multi-selection resize handles
  const allNodeIdsArr = Array.from(nodeIds)
  let selMinX = Infinity, selMinY = Infinity, selMaxX = -Infinity, selMaxY = -Infinity
  const nodeMap = new Map<NodeId, SceneNode>()
  for (const id of allNodeIdsArr) {
    function findNodeForSel(nodes: SceneNode[]): SceneNode | null {
      for (const n of nodes) {
        if (n.id === id) return n
        if ('children' in n && Array.isArray(n.children)) {
          const found = findNodeForSel(n.children as SceneNode[])
          if (found) return found
        }
      }
      return null
    }
    const node = findNodeForSel(doc.children)
    if (node) {
      nodeMap.set(id, node)
      const b = getNodeBounds(node)
      if (b.x < selMinX) selMinX = b.x
      if (b.y < selMinY) selMinY = b.y
      if (b.x + b.w > selMaxX) selMaxX = b.x + b.w
      if (b.y + b.h > selMaxY) selMaxY = b.y + b.h
    }
  }
  const selectionBBox = {
    x: selMinX === Infinity ? 0 : selMinX,
    y: selMinY === Infinity ? 0 : selMinY,
    w: selMaxX === -Infinity ? 0 : selMaxX - selMinX,
    h: selMaxY === -Infinity ? 0 : selMaxY - selMinY,
  }

  return (
    <g className="io-selection-overlay" style={{ pointerEvents: 'none' }}>
      {allNodeIdsArr.map(id => {
        const node = nodeMap.get(id)
        if (!node) return null

        const bounds = getNodeBounds(node)
        const { x, y, w, h } = bounds
        const cx = x + w / 2
        const cy = y + h / 2
        const pad = 3 / zoom
        const rot = (previewRotation?.nodeId === id ? previewRotation.angle : node.transform.rotation)
        const rotAttr = rot !== 0 ? `rotate(${rot},${cx},${cy})` : undefined

        // Stem top and handle cy (above the selection rect, in node-local frame)
        const stemTop = y - pad - 20 / zoom
        const handleCy = stemTop - 5 / zoom

        return (
          <g key={id}>
            {/* Selection rect */}
            <rect
              x={x - pad}
              y={y - pad}
              width={w + pad * 2}
              height={h + pad * 2}
              fill="none"
              stroke="var(--io-accent)"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${2 / zoom}`}
              transform={rotAttr}
            />

            {/* Rotation handle (single selection only) */}
            {showRotateHandle && (
              <>
                {/* Stem */}
                <line
                  x1={cx} y1={y - pad}
                  x2={cx} y2={stemTop}
                  stroke="var(--io-accent)"
                  strokeWidth={1 / zoom}
                  transform={rotAttr}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Handle circle */}
                <circle
                  cx={cx}
                  cy={handleCy}
                  r={5 / zoom}
                  fill="white"
                  stroke="var(--io-accent)"
                  strokeWidth={1 / zoom}
                  transform={rotAttr}
                  style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onRotateStart!(id, { x: cx, y: cy }, node.transform)
                  }}
                />
              </>
            )}
          </g>
        )
      })}

      {/* Resize handles — drawn once on the union bounding box (single or multi-selection) */}
      {showResizeHandles && (() => {
        // For single selection: check per-node restrictions
        if (isSingle) {
          const id = allNodeIdsArr[0]
          const node = nodeMap.get(id)
          if (!node) return null
          const isDimensionLine = node.type === 'annotation' && (node as Annotation).annotationType === 'dimension_line'
          const isSymbolChildDisplayElement = node.type === 'display_element' &&
            getNodeParent(node.id, doc.children)?.type === 'symbol_instance'
          if (isDimensionLine || isSymbolChildDisplayElement) return null
          const bounds = getNodeBounds(node)
          const { x, y, w, h } = bounds
          const pad = 3 / zoom
          return RESIZE_HANDLES.map(rh => {
            const rhx = (x - pad) + (w + pad * 2) * rh.cx
            const rhy = (y - pad) + (h + pad * 2) * rh.cy
            const sz = 6 / zoom
            return (
              <rect
                key={rh.id}
                x={rhx - sz / 2}
                y={rhy - sz / 2}
                width={sz}
                height={sz}
                fill="white"
                stroke="var(--io-accent)"
                strokeWidth={1 / zoom}
                style={{ pointerEvents: 'all', cursor: rh.cursor }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onResizeStart!(id, rh.id, bounds, node.transform, rhx, rhy)
                }}
              />
            )
          })
        }

        // Multi-selection: draw handles on union bounding box
        // Skip if selection has zero area (all pipes)
        if (selectionBBox.w <= 0 || selectionBBox.h <= 0) return null
        const { x: sx, y: sy, w: sw, h: sh } = selectionBBox
        const pad = 3 / zoom
        // Use first non-pipe node's transform as a representative (for compatibility)
        const firstId = allNodeIdsArr.find(id => nodeMap.get(id)?.type !== 'pipe') ?? allNodeIdsArr[0]
        const firstNode = nodeMap.get(firstId)
        if (!firstNode) return null
        return RESIZE_HANDLES.map(rh => {
          const rhx = (sx - pad) + (sw + pad * 2) * rh.cx
          const rhy = (sy - pad) + (sh + pad * 2) * rh.cy
          const sz = 6 / zoom
          return (
            <rect
              key={rh.id}
              x={rhx - sz / 2}
              y={rhy - sz / 2}
              width={sz}
              height={sz}
              fill="white"
              stroke="var(--io-accent)"
              strokeWidth={1 / zoom}
              style={{ pointerEvents: 'all', cursor: rh.cursor }}
              onMouseDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onResizeStart!(firstId, rh.id, selectionBBox, firstNode.transform, rhx, rhy, allNodeIdsArr, selectionBBox)
              }}
            />
          )
        })
      })()}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Lock overlay — padlock badge on visible locked nodes
// ---------------------------------------------------------------------------

function LockOverlay({
  doc,
  zoom,
}: {
  doc: GraphicDocument
  zoom: number
}) {
  const locked = doc.children.filter(n => n.visible && n.locked)
  if (locked.length === 0) return null

  const sz = 14 / zoom

  return (
    <g className="io-lock-overlay" style={{ pointerEvents: 'none' }}>
      {locked.map(node => {
        const bounds = getNodeBounds(node)
        const px = bounds.x + bounds.w / 2
        const py = bounds.y
        return (
          <g key={node.id} transform={`translate(${px},${py})`}>
            <rect
              x={-sz / 2} y={-sz}
              width={sz} height={sz}
              rx={2 / zoom}
              fill="rgba(0,0,0,0.65)"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={0.75 / zoom}
            />
            {/* Padlock shackle */}
            <path
              d={`M ${-sz * 0.28} ${-sz * 0.55} a ${sz * 0.28} ${sz * 0.28} 0 0 1 ${sz * 0.56} 0`}
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={1.5 / zoom}
              strokeLinecap="round"
            />
            {/* Padlock body keyhole */}
            <circle cx={0} cy={-sz * 0.35} r={sz * 0.12} fill="rgba(255,255,255,0.7)" />
          </g>
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Group tab indicator overlay — small "tab open" badge on group nodes that
// have an open sub-tab. Rendered in the top-right of the group's bounding box.
// ---------------------------------------------------------------------------

function GroupTabIndicatorOverlay({
  doc,
  zoom,
  openGroupTabNodeIds,
}: {
  doc: GraphicDocument
  zoom: number
  openGroupTabNodeIds: Set<string>
}) {
  const groups = doc.children.filter(
    n => n.type === 'group' && n.visible && openGroupTabNodeIds.has(n.id)
  )
  if (groups.length === 0) return null

  const sz = 10 / zoom

  return (
    <g className="io-group-tab-indicator" style={{ pointerEvents: 'none' }}>
      {groups.map(node => {
        const bounds = getNodeBounds(node)
        // Position in the top-right corner of the bounding box
        const px = bounds.x + bounds.w
        const py = bounds.y
        return (
          <g key={node.id} transform={`translate(${px},${py})`}>
            {/* Small tab shape: rectangle with a notched top-left corner */}
            <path
              d={`M ${-sz * 1.4} ${-sz * 1.6} L ${-sz * 0.2} ${-sz * 1.6} L ${-sz * 0.2} ${-sz * 0.4} L ${-sz * 1.4} ${-sz * 0.4} Z`}
              fill="var(--io-accent)"
              opacity={0.85}
            />
            {/* Tiny horizontal lines suggesting tab content */}
            <line
              x1={-sz * 1.2} y1={-sz * 1.3}
              x2={-sz * 0.4} y2={-sz * 1.3}
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={0.8 / zoom}
              strokeLinecap="round"
            />
            <line
              x1={-sz * 1.2} y1={-sz * 0.9}
              x2={-sz * 0.4} y2={-sz * 0.9}
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={0.8 / zoom}
              strokeLinecap="round"
            />
          </g>
        )
      })}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Smart alignment guides overlay
// ---------------------------------------------------------------------------

function AlignmentGuidesOverlay({
  guides,
  canvasW,
  canvasH,
  zoom,
}: {
  guides: Array<{ axis: 'h' | 'v'; pos: number }>
  canvasW: number
  canvasH: number
  zoom: number
}) {
  if (guides.length === 0) return null
  return (
    <g className="io-align-guides" style={{ pointerEvents: 'none' }}>
      {guides.map((g, i) => (
        g.axis === 'v'
          ? <line key={i} x1={g.pos} y1={0} x2={g.pos} y2={canvasH}
              stroke="var(--io-accent)" strokeWidth={0.5 / zoom} strokeDasharray={`${4 / zoom},${2 / zoom}`} opacity={0.75} />
          : <line key={i} x1={0} y1={g.pos} x2={canvasW} y2={g.pos}
              stroke="var(--io-accent)" strokeWidth={0.5 / zoom} strokeDasharray={`${4 / zoom},${2 / zoom}`} opacity={0.75} />
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Draw preview overlay
// ---------------------------------------------------------------------------

function DrawPreviewOverlay({ zoom }: { zoom: number }) {
  const preview = useUiStore(s => s.drawPreview)
  if (!preview) return null

  const x = Math.min(preview.startX, preview.endX)
  const y = Math.min(preview.startY, preview.endY)
  const w = Math.abs(preview.endX - preview.startX)
  const h = Math.abs(preview.endY - preview.startY)

  const commonProps = {
    fill: 'rgba(99,102,241,0.08)',
    stroke: 'var(--io-accent)',
    strokeWidth: 1 / zoom,
    strokeDasharray: `${4 / zoom},${2 / zoom}`,
    style: { pointerEvents: 'none' as const },
  }

  if (preview.type === 'rect') {
    return <rect x={x} y={y} width={w} height={h} {...commonProps} />
  }
  if (preview.type === 'ellipse') {
    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...commonProps} />
  }
  if (preview.type === 'line') {
    return (
      <line
        x1={preview.startX} y1={preview.startY}
        x2={preview.endX} y2={preview.endY}
        stroke="var(--io-accent)"
        strokeWidth={1 / zoom}
        strokeDasharray={`${4 / zoom},${2 / zoom}`}
        style={{ pointerEvents: 'none' }}
      />
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Marquee overlay
// ---------------------------------------------------------------------------

function MarqueeOverlay({ zoom }: { zoom: number }) {
  const marquee = useUiStore(s => s.marquee)
  if (!marquee) return null

  const x = Math.min(marquee.startX, marquee.endX)
  const y = Math.min(marquee.startY, marquee.endY)
  const w = Math.abs(marquee.endX - marquee.startX)
  const h = Math.abs(marquee.endY - marquee.startY)

  return (
    <rect
      x={x} y={y} width={w} height={h}
      fill="rgba(99,102,241,0.06)"
      stroke="var(--io-accent)"
      strokeWidth={1 / zoom}
      strokeDasharray={`${4 / zoom},${2 / zoom}`}
      style={{ pointerEvents: 'none' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Pipe draw preview
// ---------------------------------------------------------------------------

function PipeDrawOverlay({ zoom }: { zoom: number }) {
  const pipeState = useUiStore(s => s.pipeDrawState)
  if (!pipeState || pipeState.waypoints.length === 0) return null

  const allPts = [...pipeState.waypoints, { x: pipeState.cursorX, y: pipeState.cursorY }]
  const pts = allPts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <polyline
      points={pts}
      fill="none"
      stroke="var(--io-accent)"
      strokeWidth={2 / zoom}
      strokeDasharray={`${4 / zoom},${2 / zoom}`}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pointerEvents: 'none' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Pen draw preview overlay
// ---------------------------------------------------------------------------

function PenDrawOverlay({
  waypoints,
  cursorX,
  cursorY,
  zoom,
}: {
  waypoints: Array<{ x: number; y: number }> | null
  cursorX: number
  cursorY: number
  zoom: number
}) {
  if (!waypoints || waypoints.length === 0) return null
  const allPts = [...waypoints, { x: cursorX, y: cursorY }]
  const pts = allPts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <g style={{ pointerEvents: 'none' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--io-accent)"
        strokeWidth={1.5 / zoom}
        strokeDasharray={`${4 / zoom},${2 / zoom}`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {waypoints.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={3 / zoom}
          fill="white"
          stroke="var(--io-accent)"
          strokeWidth={1 / zoom}
        />
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Freehand draw preview overlay
// ---------------------------------------------------------------------------

function FreehandPreviewOverlay({
  points,
  zoom,
}: {
  points: Array<{ x: number; y: number }> | null
  zoom: number
}) {
  if (!points || points.length < 2) return null
  const pts = points.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <g style={{ pointerEvents: 'none' }}>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--io-accent)"
        strokeWidth={1.5 / zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Connection points overlay — teal dots shown when pipe tool is active
// ---------------------------------------------------------------------------

function ConnectionPointsOverlay({
  doc,
  zoom,
  activeTool,
}: {
  doc: import('../../shared/types/graphics').GraphicDocument
  zoom: number
  activeTool: string
}) {
  const cache = useLibraryStore(s => s.cache)

  if (activeTool !== 'pipe') return null

  const dots: Array<{ key: string; wx: number; wy: number }> = []

  for (const node of doc.children) {
    if (node.type !== 'symbol_instance') continue
    const si = node as SymbolInstance
    const entry = cache.get(si.shapeRef.shapeId)
    if (!entry) continue

    const geo = entry.sidecar.geometry
    const bw = geo.baseSize?.[0] ?? geo.width ?? 64
    const bh = geo.baseSize?.[1] ?? geo.height ?? 64

    // Parse viewBox to get natural dimensions
    const vbParts = geo.viewBox.split(/[\s,]+/).map(Number)
    const vbW = vbParts.length >= 4 ? vbParts[2] : bw
    const vbH = vbParts.length >= 4 ? vbParts[3] : bh

    const scaleX = bw / (vbW || 1)
    const scaleY = bh / (vbH || 1)

    const { x: ix, y: iy } = si.transform.position
    const rotDeg = si.transform.rotation ?? 0
    const rotRad = (rotDeg * Math.PI) / 180

    for (const cp of entry.sidecar.connections ?? []) {
      // Local position within the shape (scaled to canvas units)
      const lx = (cp.x ?? 0) * scaleX
      const ly = (cp.y ?? 0) * scaleY
      // Apply rotation around shape origin (0,0), then translate to world space
      // (Matches SVG transform: translate(ix,iy) rotate(rotDeg))
      const wx = ix + lx * Math.cos(rotRad) - ly * Math.sin(rotRad)
      const wy = iy + lx * Math.sin(rotRad) + ly * Math.cos(rotRad)
      dots.push({ key: `${si.id}-${cp.id}`, wx, wy })
    }
  }

  if (dots.length === 0) return null

  const r = Math.max(4 / zoom, 2)

  return (
    <g style={{ pointerEvents: 'none' }}>
      {dots.map(d => (
        <circle
          key={d.key}
          cx={d.wx}
          cy={d.wy}
          r={r}
          fill="var(--io-accent)"
          stroke="white"
          strokeWidth={1 / zoom}
          opacity={0.85}
        />
      ))}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main canvas component
// ---------------------------------------------------------------------------

export default function DesignerCanvas({ className, style, onPropertiesOpen, onOpenGroupInTab, groupSubTabNodeId }: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Store subscriptions
  const doc         = useSceneStore(s => s.doc)
  const version     = useSceneStore(s => s.version)
  const sceneExecute = useSceneStore(s => s.execute)
  const designMode  = useSceneStore(s => s.designMode)

  const activeTool      = useUiStore(s => s.activeTool)
  const viewport        = useUiStore(s => s.viewport)
  const gridVisible     = useUiStore(s => s.gridVisible)
  const gridSize        = useUiStore(s => s.gridSize)
  const snapToGrid      = useUiStore(s => s.snapToGrid)
  const setViewport     = useUiStore(s => s.setViewport)
  const zoomTo          = useUiStore(s => s.zoomTo)
  const fitToCanvas     = useUiStore(s => s.fitToCanvas)
  const setTool         = useUiStore(s => s.setTool)
  const setDrawPreview  = useUiStore(s => s.setDrawPreview)
  const setMarquee      = useUiStore(s => s.setMarquee)
  const setPipeDrawState = useUiStore(s => s.setPipeDrawState)
  const addPipeWaypoint  = useUiStore(s => s.addPipeWaypoint)
  const pipeDrawState    = useUiStore(s => s.pipeDrawState)
  const drawPreview      = useUiStore(s => s.drawPreview)
  const testMode         = useUiStore(s => s.testMode)
  const startDrag        = useUiStore(s => s.startDrag)
  const endDrag          = useUiStore(s => s.endDrag)
  const setGrid          = useUiStore(s => s.setGrid)
  const setSnap          = useUiStore(s => s.setSnap)
  const guides           = useUiStore(s => s.guides)
  const guidesVisible    = useUiStore(s => s.guidesVisible)
  const activeGroupId    = useUiStore(s => s.activeGroupId)
  const setActiveGroup      = useUiStore(s => s.setActiveGroup)
  const phonePreviewActive  = useUiStore(s => s.phonePreviewActive)

  // Compute which group node IDs have open sub-tabs (for the tab indicator overlay)
  const openGroupTabNodeIds = useTabStore(s => {
    const ids = new Set<string>()
    for (const t of s.tabs) {
      if (t.type === 'group' && t.groupNodeId) ids.add(t.groupNodeId)
    }
    return ids
  })

  const historyPush = useHistoryStore(s => s.push)
  const historyUndo = useHistoryStore(s => s.undo)
  const historyRedo = useHistoryStore(s => s.redo)

  const getShapeSvg = useLibraryStore(s => s.getShapeSvg)

  // Test mode: subscribe to all bound point IDs via WebSocket
  const pointIdsForTest = useMemo(
    () => (testMode && doc ? extractPointIds(doc) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [testMode, doc, version],
  )
  const testModeValues = usePointValues(pointIdsForTest)

  // Local selection state
  const selectedIdsRef = useRef<Set<NodeId>>(new Set())

  // Pen tool draw state (waypoints for polyline being drawn)
  const [penWaypoints, setPenWaypoints] = useState<Array<{ x: number; y: number }> | null>(null)
  const [penCursor, setPenCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Freehand draw tool
  const freehandPointsRef = useRef<Array<{ x: number; y: number }>>([])
  const [freehandPreview, setFreehandPreview] = useState<Array<{ x: number; y: number }> | null>(null)

  // Image tool: stores click position for after file picker returns
  const imagePendingPosRef = useRef<{ x: number; y: number } | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const spacebarPrevToolRef = useRef<string | null>(null)

  // Smart alignment guides — cleared on drag end
  const [alignGuides, setAlignGuides] = useState<Array<{ axis: 'h' | 'v'; pos: number }>>([])
  // Live rotation preview while dragging rotation handle
  const [rotationPreview, setRotationPreview] = useState<{ nodeId: NodeId; angle: number } | null>(null)

  // Context menu state
  // nodeId of the node right-clicked — stored in a ref so Radix ContextMenu
  // content can read it synchronously when the menu opens.
  const ctxNodeIdRef = useRef<NodeId | null>(null)

  // Bind Point dialog — holds the nodeId to bind when PointPickerModal confirms
  const [bindingNodeId, setBindingNodeId] = useState<NodeId | null>(null)

  // Save-as-stencil dialog — holds the selected nodes to save
  const [stencilNodes, setStencilNodes] = useState<SceneNode[] | null>(null)

  // Promote-to-shape wizard — holds selected nodes to promote
  // Also carries sourceType/sourceNodeId when triggered from a group node
  const [promoteNodes, setPromoteNodes] = useState<SceneNode[] | null>(null)
  const [promoteSourceType, setPromoteSourceType] = useState<'group' | undefined>(undefined)
  const [promoteSourceNodeId, setPromoteSourceNodeId] = useState<string | undefined>(undefined)

  // Name Group prompt state
  const [groupPrompt, setGroupPrompt] = useState<{
    defaultName: string
    pendingIds: NodeId[]
    title?: string
    /** When set, this is a rename operation on an existing group node */
    renameNodeId?: NodeId
    currentName?: string
  } | null>(null)

  // Group edit breadcrumb stack: each entry is { id, name } of a group in the path
  // e.g. [{ id: 'g1', name: 'Outer' }, { id: 'g2', name: 'Inner' }]
  const [groupBreadcrumb, setGroupBreadcrumb] = useState<Array<{ id: NodeId; name: string }>>([])

  // Track currently selected IDs in a ref for use inside event handlers
  // (avoids stale closures in mouse handlers)
  const docRef = useRef(doc)
  docRef.current = doc
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const toolRef = useRef(activeTool)
  toolRef.current = activeTool

  // -------------------------------------------------------------------------
  // Helper: execute + push to history
  // -------------------------------------------------------------------------

  function executeCmd(cmd: SceneCommand) {
    const d = docRef.current
    if (!d) return
    const before = d
    sceneExecute(cmd)
    historyPush(cmd, before)
  }

  // -------------------------------------------------------------------------
  // Helper: start resize interaction (called from SelectionOverlay resize handles)
  // -------------------------------------------------------------------------

  const startResize = useCallback((
    nodeId: NodeId,
    handle: ResizeHandle,
    bounds: { x: number; y: number; w: number; h: number },
    initialTransform: Transform,
    startX: number,
    startY: number,
    allNodeIds?: NodeId[],
    selectionBBox?: { x: number; y: number; w: number; h: number },
  ) => {
    const inter = interactionRef.current
    const d = docRef.current
    inter.type = 'resize'
    inter.resizeNodeId = nodeId
    inter.resizeHandle = handle
    inter.resizeOrigBounds = { ...bounds }
    inter.resizeOrigTransform = { ...initialTransform }
    inter.startCanvasX = startX
    inter.startCanvasY = startY

    // Populate multi-node resize state
    if (allNodeIds && allNodeIds.length > 0 && selectionBBox && d) {
      // Exclude pipe nodes
      const participatingIds = allNodeIds.filter(id => {
        function findN(nodes: SceneNode[]): SceneNode | null {
          for (const n of nodes) {
            if (n.id === id) return n
            if ('children' in n && Array.isArray((n as Group).children)) {
              const f = findN((n as Group).children as SceneNode[])
              if (f) return f
            }
          }
          return null
        }
        const n = findN(d.children)
        return n ? n.type !== 'pipe' : false
      })
      inter.resizeNodeIds = participatingIds
      inter.resizeOrigSelectionBBox = { ...selectionBBox }
      const origTransforms = new Map<NodeId, Transform>()
      const origDims = new Map<NodeId, { w: number; h: number }>()
      for (const id of participatingIds) {
        function findN2(nodes: SceneNode[]): SceneNode | null {
          for (const n of nodes) {
            if (n.id === id) return n
            if ('children' in n && Array.isArray((n as Group).children)) {
              const f = findN2((n as Group).children as SceneNode[])
              if (f) return f
            }
          }
          return null
        }
        const n = findN2(d.children)
        if (n) {
          origTransforms.set(id, { ...n.transform })
          const nb = getNodeBounds(n)
          origDims.set(id, { w: nb.w, h: nb.h })
        }
      }
      inter.resizeNodeOrigTransforms = origTransforms
      inter.resizeNodeOrigDims = origDims
    } else {
      // Single-node: populate arrays with single entry
      inter.resizeNodeIds = [nodeId]
      inter.resizeOrigSelectionBBox = { ...bounds }
      inter.resizeNodeOrigTransforms = new Map([[nodeId, { ...initialTransform }]])
      inter.resizeNodeOrigDims = new Map([[nodeId, { w: bounds.w, h: bounds.h }]])
    }
  }, [])

  // -------------------------------------------------------------------------
  // Helper: start rotate interaction (called from SelectionOverlay rotation handle)
  // -------------------------------------------------------------------------

  const startRotate = useCallback((
    nodeId: NodeId,
    center: { x: number; y: number },
    initialTransform: Transform,
  ) => {
    const inter = interactionRef.current
    inter.type = 'rotate'
    inter.rotateCenter = center
    // Handle is always directly above center — angle is -90° plus initial rotation
    inter.rotateStartAngle = -90 + initialTransform.rotation
    inter.rotateInitialTransforms = new Map([[nodeId, { ...initialTransform }]])
  }, [])

  // -------------------------------------------------------------------------
  // Helper: snap
  // -------------------------------------------------------------------------

  function snap(v: number, axis?: 'h' | 'v'): number {
    // Guide snap takes priority over grid snap (threshold: 6 canvas units)
    const GUIDE_SNAP = 6
    if (guidesVisible && guides.length > 0 && axis) {
      for (const g of guides) {
        if (g.axis === axis && Math.abs(v - g.position) < GUIDE_SNAP) {
          return g.position
        }
      }
    }
    return snapToGridValue(v, gridSize, snapToGrid)
  }

  // -------------------------------------------------------------------------
  // Helper: snap to nearest connection point (for pipe tool)
  // Returns world-space coords snapped to a connection point if within threshold,
  // otherwise returns the input unchanged.
  // -------------------------------------------------------------------------

  function snapToConnectionPoint(cx: number, cy: number, thresholdPx = 12): { x: number; y: number } {
    const d = docRef.current
    if (!d) return { x: cx, y: cy }
    const vp = viewportRef.current
    // threshold in world space
    const threshold = thresholdPx / vp.zoom
    let bestDist = threshold
    let best = { x: cx, y: cy }

    for (const node of d.children) {
      if (node.type !== 'symbol_instance') continue
      const si = node as SymbolInstance
      const entry = useLibraryStore.getState().cache.get(si.shapeRef.shapeId)
      if (!entry) continue

      const geo = entry.sidecar.geometry
      const bw = geo.baseSize?.[0] ?? geo.width ?? 64
      const bh = geo.baseSize?.[1] ?? geo.height ?? 64
      const vbParts = geo.viewBox.split(/[\s,]+/).map(Number)
      const vbW = vbParts.length >= 4 ? vbParts[2] : bw
      const vbH = vbParts.length >= 4 ? vbParts[3] : bh
      const scaleX = bw / (vbW || 1)
      const scaleY = bh / (vbH || 1)
      const { x: ix, y: iy } = si.transform.position
      const rotDeg = si.transform.rotation ?? 0
      const rotRad = (rotDeg * Math.PI) / 180

      for (const cp of entry.sidecar.connections ?? []) {
        const lx = (cp.x ?? 0) * scaleX
        const ly = (cp.y ?? 0) * scaleY
        const wx = ix + lx * Math.cos(rotRad) - ly * Math.sin(rotRad)
        const wy = iy + lx * Math.sin(rotRad) + ly * Math.cos(rotRad)
        const dist = Math.hypot(wx - cx, wy - cy)
        if (dist < bestDist) {
          bestDist = dist
          best = { x: wx, y: wy }
        }
      }
    }
    return best
  }

  // -------------------------------------------------------------------------
  // Helper: get container rect
  // -------------------------------------------------------------------------

  function getRect(): DOMRect | null {
    return containerRef.current?.getBoundingClientRect() ?? null
  }

  // -------------------------------------------------------------------------
  // Hit test: find top-most node at canvas coordinates
  // -------------------------------------------------------------------------

  function hitTest(canvasX: number, canvasY: number): NodeId | null {
    const d = docRef.current
    if (!d) return null

    // Walk children in reverse (top of stack first)
    function search(nodes: SceneNode[]): NodeId | null {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (!n.visible || n.locked) continue
        const b = getNodeBounds(n)
        if (canvasX >= b.x && canvasX <= b.x + b.w && canvasY >= b.y && canvasY <= b.y + b.h) {
          return n.id
        }
        if ('children' in n && Array.isArray(n.children)) {
          const found = search(n.children as SceneNode[])
          if (found) return found
        }
      }
      return null
    }

    // When inside a group scope, only test against that group's children
    const groupId = useUiStore.getState().activeGroupId
    if (groupId) {
      const groupNode = d.children.find(n => n.id === groupId)
      if (groupNode && 'children' in groupNode && Array.isArray(groupNode.children)) {
        return search(groupNode.children as SceneNode[])
      }
    }

    return search(d.children)
  }

  // -------------------------------------------------------------------------
  // Mouse events
  // -------------------------------------------------------------------------

  // Track interaction state in refs to avoid stale closures
  const interactionRef = useRef<{
    type: 'none' | 'drag' | 'draw' | 'pan' | 'pipe' | 'marquee' | 'rotate' | 'resize' | 'freehand'
    startCanvasX: number
    startCanvasY: number
    startScreenX: number
    startScreenY: number
    startPanX: number
    startPanY: number
    originalPositions: Map<NodeId, { x: number; y: number }>
    // rotate-specific
    rotateCenter: { x: number; y: number }
    rotateStartAngle: number
    rotateInitialTransforms: Map<NodeId, Transform>
    // resize-specific
    resizeNodeId: NodeId
    resizeHandle: ResizeHandle
    resizeOrigBounds: { x: number; y: number; w: number; h: number }
    resizeOrigTransform: Transform
    // multi-node resize
    resizeNodeIds: NodeId[]
    resizeNodeOrigTransforms: Map<NodeId, Transform>
    resizeNodeOrigDims: Map<NodeId, { w: number; h: number }>
    resizeOrigSelectionBBox: { x: number; y: number; w: number; h: number }
  }>({
    type: 'none',
    startCanvasX: 0,
    startCanvasY: 0,
    startScreenX: 0,
    startScreenY: 0,
    startPanX: 0,
    startPanY: 0,
    originalPositions: new Map(),
    rotateCenter: { x: 0, y: 0 },
    rotateStartAngle: 0,
    rotateInitialTransforms: new Map(),
    resizeNodeId: '' as NodeId,
    resizeHandle: 'se',
    resizeOrigBounds: { x: 0, y: 0, w: 0, h: 0 },
    resizeOrigTransform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
    resizeNodeIds: [],
    resizeNodeOrigTransforms: new Map(),
    resizeNodeOrigDims: new Map(),
    resizeOrigSelectionBBox: { x: 0, y: 0, w: 0, h: 0 },
  })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button → pan
    if (e.button === 1) {
      e.preventDefault()
      const vp = viewportRef.current
      const inter = interactionRef.current
      inter.type = 'pan'
      inter.startScreenX = e.clientX
      inter.startScreenY = e.clientY
      inter.startPanX = vp.panX
      inter.startPanY = vp.panY
      return
    }
    if (e.button !== 0) return
    const rect = getRect()
    if (!rect) return

    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const tool = toolRef.current
    const inter = interactionRef.current

    inter.startCanvasX = cx
    inter.startCanvasY = cy
    inter.startScreenX = e.clientX
    inter.startScreenY = e.clientY
    inter.startPanX = vp.panX
    inter.startPanY = vp.panY

    if (tool === 'pan' || (e.ctrlKey && e.altKey)) {
      inter.type = 'pan'
      return
    }

    if (tool === 'select') {
      // If inside group edit mode, check if click is outside the group bounding box → exit
      const currentGroupId = useUiStore.getState().activeGroupId
      if (currentGroupId) {
        const groupNode = docRef.current?.children.find(n => n.id === currentGroupId)
        if (groupNode) {
          const b = getNodeBounds(groupNode)
          if (cx < b.x || cx > b.x + b.w || cy < b.y || cy > b.y + b.h) {
            setActiveGroup(null)
            setGroupBreadcrumb([])
            selectedIdsRef.current = new Set()
            useUiStore.getState().setSelectedNodes([])
            return
          }
        }
      }

      const hitId = hitTest(cx, cy)
      if (hitId) {
        // Select node (Shift or Ctrl adds to selection)
        const newSelection = (e.shiftKey || e.ctrlKey)
          ? new Set([...selectedIdsRef.current, hitId])
          : new Set([hitId])
        selectedIdsRef.current = newSelection
        useUiStore.getState().setSelectedNodes(Array.from(newSelection))

        // Prepare drag
        const d = docRef.current
        if (!d) return
        const positions = new Map<NodeId, { x: number; y: number }>()
        for (const id of newSelection) {
          function findP(nodes: SceneNode[]): { x: number; y: number } | null {
            for (const n of nodes) {
              if (n.id === id) return { x: n.transform.position.x, y: n.transform.position.y }
              if ('children' in n && Array.isArray(n.children)) {
                const f = findP(n.children as SceneNode[])
                if (f) return f
              }
            }
            return null
          }
          const pos = findP(d.children)
          if (pos) positions.set(id, pos)
        }
        inter.type = 'drag'
        inter.originalPositions = positions
        startDrag(cx, cy, positions)
      } else {
        // Start marquee selection
        if (!e.shiftKey) {
          selectedIdsRef.current = new Set()
          useUiStore.getState().setSelectedNodes([])
        }
        inter.type = 'marquee'
        setMarquee({ startX: cx, startY: cy, endX: cx, endY: cy })
      }
      return
    }

    if (tool === 'pipe') {
      // Prefer connection point snap over grid snap
      const cpSnapped = snapToConnectionPoint(cx, cy)
      const px = cpSnapped.x !== cx ? cpSnapped.x : snap(cx)
      const py = cpSnapped.y !== cy ? cpSnapped.y : snap(cy)
      if (!pipeDrawState) {
        setPipeDrawState({ waypoints: [{ x: px, y: py }], cursorX: px, cursorY: py })
      } else {
        addPipeWaypoint(px, py)
      }
      inter.type = 'pipe'
      return
    }

    if (tool === 'text') {
      const d = docRef.current
      if (!d) return
      const newNode: TextBlock = {
        id: crypto.randomUUID(),
        type: 'text_block',
        name: 'Text',
        transform: {
          position: { x: snap(cx), y: snap(cy) },
          rotation: 0,
          scale: { x: 1, y: 1 },
          mirror: 'none',
        },
        visible: true,
        locked: false,
        opacity: 1,
        content: 'Text',
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: 400,
        fontStyle: 'normal',
        textAnchor: 'start',
        fill: '#ffffff',
      }
      executeCmd(new AddNodeCommand(newNode, null))
      selectedIdsRef.current = new Set([newNode.id])
      useUiStore.getState().setSelectedNodes([newNode.id])
      return
    }

    if (tool === 'pen') {
      const pt = { x: snap(cx), y: snap(cy) }
      setPenWaypoints(prev => prev ? [...prev, pt] : [pt])
      setPenCursor(pt)
      return
    }

    if (tool === 'image') {
      imagePendingPosRef.current = { x: snap(cx), y: snap(cy) }
      imageInputRef.current?.click()
      return
    }

    // Freehand draw tool — start capturing on mousedown
    if (tool === 'freehand') {
      inter.type = 'freehand'
      freehandPointsRef.current = [{ x: cx, y: cy }]
      setFreehandPreview([{ x: cx, y: cy }])
      return
    }

    // Shape drawing tools
    if (tool === 'rect' || tool === 'ellipse' || tool === 'line') {
      inter.type = 'draw'
      setDrawPreview({
        type: tool as 'rect' | 'ellipse' | 'line',
        startX: snap(cx),
        startY: snap(cy),
        endX: snap(cx),
        endY: snap(cy),
      })
    }
  }, [snap, pipeDrawState, setPipeDrawState, addPipeWaypoint, setMarquee, startDrag, setDrawPreview, setPenWaypoints, setPenCursor, setFreehandPreview])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = getRect()
    if (!rect) return
    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const inter = interactionRef.current

    if (inter.type === 'pan') {
      const dx = e.clientX - inter.startScreenX
      const dy = e.clientY - inter.startScreenY
      setViewport({ panX: inter.startPanX + dx, panY: inter.startPanY + dy })
      return
    }

    if (inter.type === 'drag') {
      const dx = cx - inter.startCanvasX
      const dy = cy - inter.startCanvasY
      const d = docRef.current
      if (!d) return

      // DRAG PREVIEW EXCEPTION — direct DOM manipulation for 60fps ghost position.
      // The scene graph (sceneStore) is NOT updated here. Only on mouseup is a
      // MoveNodesCommand committed. This matches the spec's "Drag Preview Exception".
      const svgEl = containerRef.current?.querySelector('svg')
      if (svgEl) {
        for (const id of selectedIdsRef.current) {
          const orig = inter.originalPositions.get(id)
          if (!orig) continue
          const ghostX = orig.x + dx
          const ghostY = orig.y + dy
          const gEl = svgEl.querySelector(`[data-node-id="${id}"]`)
          if (gEl) {
            gEl.setAttribute('transform', `translate(${ghostX},${ghostY})`)
          }
        }
      }

      // Smart alignment guides — compare dragged node bounds vs all other node bounds
      const SNAP_THRESHOLD = 6 // canvas units
      const selIds = selectedIdsRef.current
      const guides: Array<{ axis: 'h' | 'v'; pos: number }> = []

      // Compute candidate bounds for the first selected node (primary drag node)
      const firstId = Array.from(selIds)[0]
      if (firstId) {
        const orig = inter.originalPositions.get(firstId)
        const srcNode = d.children.find(n => n.id === firstId)
        if (orig && srcNode) {
          const bb = getNodeBounds(srcNode)
          const draggedX = orig.x + dx
          const draggedY = orig.y + dy
          const draggedBounds = { x: draggedX, y: draggedY, w: bb.w, h: bb.h }
          const dragEdges = {
            left: draggedBounds.x,
            right: draggedBounds.x + draggedBounds.w,
            centerX: draggedBounds.x + draggedBounds.w / 2,
            top: draggedBounds.y,
            bottom: draggedBounds.y + draggedBounds.h,
            centerY: draggedBounds.y + draggedBounds.h / 2,
          }
          for (const node of d.children) {
            if (selIds.has(node.id) || !node.visible) continue
            const nb = getNodeBounds(node)
            const nodeEdges = {
              left: nb.x, right: nb.x + nb.w, centerX: nb.x + nb.w / 2,
              top: nb.y, bottom: nb.y + nb.h, centerY: nb.y + nb.h / 2,
            }
            // Vertical guides (x-axis alignment)
            for (const de of [dragEdges.left, dragEdges.right, dragEdges.centerX]) {
              for (const ne of [nodeEdges.left, nodeEdges.right, nodeEdges.centerX]) {
                if (Math.abs(de - ne) < SNAP_THRESHOLD && !guides.find(g => g.axis === 'v' && g.pos === ne)) {
                  guides.push({ axis: 'v', pos: ne })
                }
              }
            }
            // Horizontal guides (y-axis alignment)
            for (const de of [dragEdges.top, dragEdges.bottom, dragEdges.centerY]) {
              for (const ne of [nodeEdges.top, nodeEdges.bottom, nodeEdges.centerY]) {
                if (Math.abs(de - ne) < SNAP_THRESHOLD && !guides.find(g => g.axis === 'h' && g.pos === ne)) {
                  guides.push({ axis: 'h', pos: ne })
                }
              }
            }
          }
        }
      }
      setAlignGuides(guides)
      return
    }

    // Rotate drag — live preview via rotationPreview state
    if (inter.type === 'rotate') {
      const center = inter.rotateCenter
      const currentAngle = Math.atan2(cy - center.y, cx - center.x) * 180 / Math.PI
      // newRotation: when handle is straight up (-90°), rotation = 0; +90° offset normalizes atan2 quadrant
      const newAngle = currentAngle + 90
      const nodeId = Array.from(inter.rotateInitialTransforms.keys())[0]
      if (nodeId) setRotationPreview({ nodeId, angle: newAngle })
      return
    }

    // Resize drag — live preview (no commit yet)
    if (inter.type === 'resize') {
      // No visual preview for now — commit happens on mouseup
      return
    }

    if (inter.type === 'draw' && drawPreview) {
      setDrawPreview({ ...drawPreview, endX: snap(cx), endY: snap(cy) })
      return
    }

    if (inter.type === 'marquee') {
      setMarquee({ startX: inter.startCanvasX, startY: inter.startCanvasY, endX: snap(cx), endY: snap(cy) })
      return
    }

    // Update pipe cursor
    if (pipeDrawState) {
      setPipeDrawState({ ...pipeDrawState, cursorX: snap(cx), cursorY: snap(cy) })
    }

    // Update pen cursor
    if (penWaypoints) {
      setPenCursor({ x: snap(cx), y: snap(cy) })
    }

    // Freehand: collect points on each mousemove while button held
    if (inter.type === 'freehand') {
      freehandPointsRef.current.push({ x: cx, y: cy })
      // Update preview every 4 points to keep rendering smooth
      if (freehandPointsRef.current.length % 4 === 0) {
        setFreehandPreview([...freehandPointsRef.current])
      }
    }
  }, [drawPreview, penWaypoints, pipeDrawState, snap, setAlignGuides, setRotationPreview, setDrawPreview, setMarquee, setPenCursor, setPipeDrawState, setViewport, setFreehandPreview])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const inter = interactionRef.current
    const rect = getRect()
    if (!rect) return
    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const d = docRef.current

    if (inter.type === 'drag' && d) {
      let dx = cx - inter.startCanvasX
      let dy = cy - inter.startCanvasY

      // Apply alignment snap: adjust delta so a dragged edge snaps to the nearest guide
      const SNAP_THRESHOLD = 6
      const selIds = selectedIdsRef.current
      const firstId = Array.from(selIds)[0]
      if (firstId) {
        const orig = inter.originalPositions.get(firstId)
        const srcNode = d.children.find(n => n.id === firstId)
        if (orig && srcNode) {
          const bb = getNodeBounds(srcNode)
          const draggedX = orig.x + dx
          const draggedY = orig.y + dy
          const dragEdges = {
            left: draggedX, right: draggedX + bb.w, centerX: draggedX + bb.w / 2,
            top: draggedY, bottom: draggedY + bb.h, centerY: draggedY + bb.h / 2,
          }
          let bestXSnap: number | null = null
          let bestYSnap: number | null = null
          let bestXDist = SNAP_THRESHOLD
          let bestYDist = SNAP_THRESHOLD
          for (const node of d.children) {
            if (selIds.has(node.id) || !node.visible) continue
            const nb = getNodeBounds(node)
            const nodeEdges = [nb.x, nb.x + nb.w, nb.x + nb.w / 2]
            const nodeHEdges = [nb.y, nb.y + nb.h, nb.y + nb.h / 2]
            for (const de of [dragEdges.left, dragEdges.right, dragEdges.centerX]) {
              for (const ne of nodeEdges) {
                const dist = Math.abs(de - ne)
                if (dist < bestXDist) { bestXDist = dist; bestXSnap = ne - (de - dx) }
              }
            }
            for (const de of [dragEdges.top, dragEdges.bottom, dragEdges.centerY]) {
              for (const ne of nodeHEdges) {
                const dist = Math.abs(de - ne)
                if (dist < bestYDist) { bestYDist = dist; bestYSnap = ne - (de - dy) }
              }
            }
          }
          if (bestXSnap !== null) dx = bestXSnap
          if (bestYSnap !== null) dy = bestYSnap
        }
      }

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const ids = Array.from(selectedIdsRef.current)
        if (ids.length > 0) {
          // Build a Map<NodeId, Transform> from the position snapshots
          // by looking up the original node transforms in the document.
          function findNodeForTransform(nodes: SceneNode[], id: NodeId): import('../../shared/types/graphics').Transform | null {
            for (const n of nodes) {
              if (n.id === id) return n.transform
              if ('children' in n && Array.isArray(n.children)) {
                const f = findNodeForTransform(n.children as SceneNode[], id)
                if (f) return f
              }
            }
            return null
          }
          const prevTransforms = new Map<NodeId, import('../../shared/types/graphics').Transform>()
          for (const [id] of inter.originalPositions) {
            const t = findNodeForTransform(d.children, id)
            if (t) prevTransforms.set(id, t)
          }
          executeCmd(new MoveNodesCommand(
            ids,
            { x: snap(dx), y: snap(dy) },
            prevTransforms,
          ))
        }
      }
      endDrag()
      setAlignGuides([])
    }

    // Rotate commit
    if (inter.type === 'rotate' && d) {
      const center = inter.rotateCenter
      const currentAngle = Math.atan2(cy - center.y, cx - center.x) * 180 / Math.PI
      const newAngle = currentAngle + 90
      const newTransforms = new Map<NodeId, Transform>()
      for (const [id, initialT] of inter.rotateInitialTransforms) {
        const initialAngle = initialT.rotation
        const angleDelta = newAngle - (inter.rotateStartAngle + 90)
        newTransforms.set(id, { ...initialT, rotation: initialAngle + angleDelta })
      }
      if (newTransforms.size > 0) {
        executeCmd(new RotateNodesCommand(
          Array.from(newTransforms.keys()),
          newTransforms,
          inter.rotateInitialTransforms,
        ))
      }
      setRotationPreview(null)
      inter.type = 'none'
    }

    // Resize commit
    if (inter.type === 'resize' && d) {
      const dx = cx - inter.startCanvasX
      const dy = cy - inter.startCanvasY
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        const ob = inter.resizeOrigBounds
        const handle = inter.resizeHandle
        let nx = ob.x, ny = ob.y, nw = ob.w, nh = ob.h
        // Compute new bounds based on which handle was dragged
        if (handle.includes('w')) { nx = ob.x + dx; nw = Math.max(4, ob.w - dx) }
        if (handle.includes('e')) { nw = Math.max(4, ob.w + dx) }
        if (handle.includes('n')) { ny = ob.y + dy; nh = Math.max(4, ob.h - dy) }
        if (handle.includes('s')) { nh = Math.max(4, ob.h + dy) }
        // Apply grid snap
        nx = snap(nx); ny = snap(ny); nw = snap(nw); nh = snap(nh)

        // ---------------------------------------------------------------------------
        // Helper: build a single-node resize command given node, its original transform,
        // and the new top-left position plus new raw width/height (pre-minimum clamping).
        // Returns null for pipe nodes or nodes that should not be resized.
        // ---------------------------------------------------------------------------
        function buildResizeCommand(
          node: SceneNode,
          origT: Transform,
          newPos: { x: number; y: number },
          rawW: number,
          rawH: number,
          origBoundsRef?: { x: number; y: number; w: number; h: number },
        ): SceneCommand | null {
          if (node.type === 'pipe') return null
          const newPosX = newPos.x
          const newPosY = newPos.y
          if (node.type === 'primitive') {
            const prim = node as Primitive
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            let newGeom: Primitive['geometry']
            if (prim.geometry.type === 'rect') {
              newGeom = { ...prim.geometry, width: rawW, height: rawH }
            } else if (prim.geometry.type === 'ellipse') {
              newGeom = { ...prim.geometry, rx: rawW / 2, ry: rawH / 2 }
            } else if (prim.geometry.type === 'circle') {
              newGeom = { ...prim.geometry, r: Math.min(rawW, rawH) / 2 }
            } else {
              newGeom = prim.geometry
            }
            return new ResizePrimitiveCommand(node.id, newT, newGeom, origT, prim.geometry)
          }
          if (node.type === 'image') {
            const img = node as ImageNode
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            return new ResizeNodeWithDimsCommand(
              node.id, newT, { width: rawW, height: rawH },
              origT, { width: img.displayWidth, height: img.displayHeight },
              ['displayWidth', 'displayHeight'],
            )
          }
          if (node.type === 'widget') {
            const wn = node as WidgetNode
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            return new ResizeNodeWithDimsCommand(
              node.id, newT, { width: rawW, height: rawH },
              origT, { width: wn.width, height: wn.height },
            )
          }
          if (node.type === 'embedded_svg') {
            const esn = node as EmbeddedSvgNode
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            return new ResizeNodeWithDimsCommand(
              node.id, newT, { width: rawW, height: rawH },
              origT, { width: esn.width, height: esn.height },
            )
          }
          if (node.type === 'annotation') {
            const ann = node as Annotation
            if (ann.annotationType === 'dimension_line') return null
            let finalW = rawW
            let finalH = rawH
            let finalY = newPosY
            if (ann.annotationType === 'north_arrow') {
              const side = Math.max(20, Math.min(rawW, rawH))
              finalW = side
              finalH = side
            } else if (ann.annotationType === 'header' || ann.annotationType === 'footer') {
              finalW = Math.max(40, rawW)
              finalH = ann.height
              finalY = origT.position.y
            } else if (ann.annotationType === 'section_break' || ann.annotationType === 'page_break') {
              finalW = Math.max(20, rawW)
              finalH = 4
              finalY = origT.position.y
            } else {
              const MINS: Record<string, [number, number]> = {
                callout: [40, 20],
                legend: [60, 30],
                border: [100, 40],
                title_block: [100, 40],
              }
              const [mw, mh] = MINS[ann.annotationType] ?? [20, 20]
              finalW = Math.max(mw, rawW)
              finalH = Math.max(mh, rawH)
            }
            const newT: Transform = { ...origT, position: { x: newPosX, y: finalY } }
            return new ResizeNodeWithDimsCommand(
              node.id, newT, { width: finalW, height: finalH },
              origT, { width: ann.width, height: ann.height },
            )
          }
          if (node.type === 'symbol_instance') {
            const si = node as SymbolInstance
            const shapeData = useLibraryStore.getState().getShape(si.shapeRef.shapeId)
            const geo = shapeData?.sidecar.geometry
            const origBoundsW = origBoundsRef?.w ?? rawW
            const origBoundsH = origBoundsRef?.h ?? rawH
            const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? origBoundsW
            const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? origBoundsH
            const clampedW = Math.max(10, rawW)
            const clampedH = Math.max(10, rawH)
            const newScaleX = clampedW / naturalW
            const newScaleY = clampedH / naturalH
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY }, scale: { x: newScaleX, y: newScaleY } }
            return new ResizeNodeCommand(node.id, newT, origT)
          }
          if (node.type === 'text_block') {
            const tb = node as TextBlock
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            const newW = Math.max(20, rawW)
            return new CompoundCommand('Resize', [
              new ResizeNodeCommand(node.id, newT, origT),
              new ChangePropertyCommand(node.id, 'maxWidth', newW, tb.maxWidth ?? 120),
            ])
          }
          if (node.type === 'stencil') {
            const st = node as Stencil
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            const newW = Math.max(16, rawW)
            const newH = Math.max(16, rawH)
            const prevSize = st.size ?? { width: 48, height: 24 }
            return new CompoundCommand('Resize', [
              new ResizeNodeCommand(node.id, newT, origT),
              new ChangePropertyCommand(node.id, 'size', { width: newW, height: newH }, prevSize),
            ])
          }
          if (node.type === 'display_element') {
            const de = node as DisplayElement
            const cfg = de.config
            const MINS: Record<string, [number, number]> = {
              text_readout:    [40, 16],
              analog_bar:      [10, 30],
              fill_gauge:      [10, 30],
              sparkline:       [40, 10],
              alarm_indicator: [20, 16],
              digital_status:  [30, 16],
            }
            const [minW, minH] = MINS[de.displayType] ?? [20, 16]
            const finalW = Math.max(minW, rawW)
            const finalH = Math.max(minH, rawH)
            const newT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            let newCfg: DisplayElementConfig
            switch (cfg.displayType) {
              case 'text_readout':    newCfg = { ...cfg, width: finalW, height: finalH }; break
              case 'analog_bar':      newCfg = { ...cfg, barWidth: finalW, barHeight: finalH }; break
              case 'fill_gauge':      newCfg = { ...cfg, barWidth: finalW, barHeight: finalH }; break
              case 'sparkline':       newCfg = { ...cfg, sparkWidth: finalW, sparkHeight: finalH }; break
              case 'alarm_indicator': newCfg = { ...cfg, width: finalW, height: finalH }; break
              case 'digital_status':  newCfg = { ...cfg, width: finalW, height: finalH }; break
              default: newCfg = cfg
            }
            return new CompoundCommand('Resize', [
              new ResizeNodeCommand(node.id, newT, origT),
              new ChangePropertyCommand(node.id, 'config', newCfg, cfg),
            ])
          }
          if (node.type === 'group') {
            const grp = node as Group
            const origBBox = origBoundsRef ?? getNodeBounds(node)
            const finalW = Math.max(20, rawW)
            const finalH = Math.max(20, rawH)
            const scaleX = origBBox.w > 0 ? finalW / origBBox.w : 1
            const scaleY = origBBox.h > 0 ? finalH / origBBox.h : 1

            function getScaledDimsLocal(child: SceneNode, sX: number, sY: number): { width: number; height: number } {
              if (child.type === 'widget') { const wn = child as WidgetNode; return { width: wn.width * sX, height: wn.height * sY } }
              if (child.type === 'text_block') { const tb = child as TextBlock; return { width: (tb.maxWidth ?? 120) * sX, height: (tb.fontSize ? tb.fontSize * 2 : 20) * sY } }
              if (child.type === 'stencil') { const st = child as Stencil; return { width: (st.size?.width ?? 48) * sX, height: (st.size?.height ?? 24) * sY } }
              if (child.type === 'embedded_svg') { const esn = child as EmbeddedSvgNode; return { width: esn.width * sX, height: esn.height * sY } }
              return { width: 0, height: 0 }
            }
            function getOrigDimsLocal(child: SceneNode): { width: number; height: number } {
              if (child.type === 'widget') { const wn = child as WidgetNode; return { width: wn.width, height: wn.height } }
              if (child.type === 'text_block') { const tb = child as TextBlock; return { width: tb.maxWidth ?? 120, height: tb.fontSize ? tb.fontSize * 2 : 20 } }
              if (child.type === 'stencil') { const st = child as Stencil; return { width: st.size?.width ?? 48, height: st.size?.height ?? 24 } }
              if (child.type === 'embedded_svg') { const esn = child as EmbeddedSvgNode; return { width: esn.width, height: esn.height } }
              return { width: 0, height: 0 }
            }

            const childCommands: SceneCommand[] = grp.children
              .filter(child => child.type !== 'pipe')
              .map(child => {
                const relX = child.transform.position.x - origBBox.x
                const relY = child.transform.position.y - origBBox.y
                const newChildX = origBBox.x + relX * scaleX
                const newChildY = origBBox.y + relY * scaleY
                const newChildTransform: Transform = {
                  ...child.transform,
                  position: { x: newChildX, y: newChildY },
                  scale: { x: child.transform.scale.x * scaleX, y: child.transform.scale.y * scaleY },
                }
                const scaledD = getScaledDimsLocal(child, scaleX, scaleY)
                const origD = getOrigDimsLocal(child)
                if (child.type === 'image') {
                  const img = child as ImageNode
                  return new ResizeNodeWithDimsCommand(child.id, newChildTransform, { width: img.displayWidth * scaleX, height: img.displayHeight * scaleY }, child.transform, { width: img.displayWidth, height: img.displayHeight }, ['displayWidth', 'displayHeight'])
                }
                if (scaledD.width > 0 || scaledD.height > 0) {
                  return new ResizeNodeWithDimsCommand(child.id, newChildTransform, scaledD, child.transform, origD)
                }
                return new ResizeNodeCommand(child.id, newChildTransform, child.transform)
              })
            const newGrpT: Transform = { ...origT, position: { x: newPosX, y: newPosY } }
            return new CompoundCommand('Resize Group', [new ResizeNodeCommand(node.id, newGrpT, origT), ...childCommands])
          }
          return null
        }

        // ---------------------------------------------------------------------------
        // Multi-node resize path: resizeNodeIds.length > 1
        // ---------------------------------------------------------------------------
        if (inter.resizeNodeIds.length > 1) {
          const origSel = inter.resizeOrigSelectionBBox
          const finalSelW = Math.max(20, nw)
          const finalSelH = Math.max(20, nh)
          const scaleX = origSel.w > 0 ? finalSelW / origSel.w : 1
          const scaleY = origSel.h > 0 ? finalSelH / origSel.h : 1
          const newSelOriginX = nx
          const newSelOriginY = ny

          function findNodeById(nodes: SceneNode[], id: NodeId): SceneNode | null {
            for (const n of nodes) {
              if (n.id === id) return n
              if ('children' in n && Array.isArray((n as Group).children)) {
                const f = findNodeById((n as Group).children as SceneNode[], id)
                if (f) return f
              }
            }
            return null
          }

          const perNodeCommands: SceneCommand[] = []
          for (const nodeId of inter.resizeNodeIds) {
            const node = findNodeById(d.children, nodeId)
            if (!node || node.type === 'pipe') continue
            const origT = inter.resizeNodeOrigTransforms.get(nodeId)
            const origDims = inter.resizeNodeOrigDims.get(nodeId)
            if (!origT || !origDims) continue

            const relX = origT.position.x - origSel.x
            const relY = origT.position.y - origSel.y
            const newX = newSelOriginX + relX * scaleX
            const newY = newSelOriginY + relY * scaleY
            const rawW = origDims.w * scaleX
            const rawH = origDims.h * scaleY
            const origBoundsForNode = { x: origT.position.x, y: origT.position.y, w: origDims.w, h: origDims.h }
            const cmd = buildResizeCommand(node, origT, { x: newX, y: newY }, rawW, rawH, origBoundsForNode)
            if (cmd) perNodeCommands.push(cmd)
          }

          if (perNodeCommands.length === 1) {
            executeCmd(perNodeCommands[0])
          } else if (perNodeCommands.length > 1) {
            executeCmd(new CompoundCommand('Resize', perNodeCommands))
          }
        } else {
          // ---------------------------------------------------------------------------
          // Single-node resize path (original logic, refactored via buildResizeCommand)
          // ---------------------------------------------------------------------------
          function findResizeNode(nodes: SceneNode[]): SceneNode | null {
            for (const n of nodes) {
              if (n.id === inter.resizeNodeId) return n
              if ('children' in n && Array.isArray((n as Group).children)) {
                const f = findResizeNode((n as Group).children as SceneNode[])
                if (f) return f
              }
            }
            return null
          }
          const target = findResizeNode(d.children)
          if (target) {
            const prevT = inter.resizeOrigTransform
            const cmd = buildResizeCommand(target, prevT, { x: nx, y: ny }, nw, nh, inter.resizeOrigBounds)
            if (cmd) executeCmd(cmd)
          }
        }
      }
      inter.type = 'none'
    }

    if (inter.type === 'draw' && drawPreview && d) {
      const x1 = Math.min(drawPreview.startX, drawPreview.endX)
      const y1 = Math.min(drawPreview.startY, drawPreview.endY)
      const x2 = Math.max(drawPreview.startX, drawPreview.endX)
      const y2 = Math.max(drawPreview.startY, drawPreview.endY)
      const w = x2 - x1
      const h = y2 - y1

      if (w > 2 && h > 2) {
        let geom: Primitive['geometry']
        if (drawPreview.type === 'rect')   geom = { type: 'rect', width: w, height: h }
        else if (drawPreview.type === 'ellipse') geom = { type: 'ellipse', rx: w / 2, ry: h / 2 }
        else geom = { type: 'line', x1: drawPreview.startX, y1: drawPreview.startY, x2: drawPreview.endX, y2: drawPreview.endY }

        const prim: Primitive = {
          id: crypto.randomUUID(),
          type: 'primitive',
          primitiveType: drawPreview.type === 'rect' ? 'rect' : drawPreview.type === 'ellipse' ? 'ellipse' : 'line',
          name: drawPreview.type,
          transform: {
            position: { x: x1, y: y1 },
            rotation: 0,
            scale: { x: 1, y: 1 },
            mirror: 'none',
          },
          visible: true,
          locked: false,
          opacity: 1,
          geometry: geom,
          style: {
            fill: 'none',
            fillOpacity: 1,
            stroke: '#6366f1',
            strokeWidth: 1,
          },
        }
        executeCmd(new AddNodeCommand(prim, null))
        selectedIdsRef.current = new Set([prim.id])
        useUiStore.getState().setSelectedNodes([prim.id])
      }

      setDrawPreview(null)
      // Switch back to select after drawing
      setTool('select')
    }

    if (inter.type === 'marquee') {
      const d = docRef.current
      if (d) {
        const rx = Math.min(inter.startCanvasX, cx)
        const ry = Math.min(inter.startCanvasY, cy)
        const rw = Math.abs(cx - inter.startCanvasX)
        const rh = Math.abs(cy - inter.startCanvasY)
        if (rw > 2 && rh > 2) {
          // When inside a group scope, select only from that group's children
          const scopeGroupId = useUiStore.getState().activeGroupId
          const scopeNodes = scopeGroupId
            ? (() => {
                const gn = d.children.find(n => n.id === scopeGroupId)
                return gn && 'children' in gn && Array.isArray(gn.children) ? gn.children as SceneNode[] : d.children
              })()
            : d.children
          const hit: NodeId[] = []
          for (const node of scopeNodes) {
            if (!node.visible || node.locked) continue
            if (boundsOverlap(getNodeBounds(node), rx, ry, rw, rh)) hit.push(node.id)
          }
          if (hit.length > 0) {
            const newSel = e.shiftKey
              ? new Set([...selectedIdsRef.current, ...hit])
              : new Set(hit)
            selectedIdsRef.current = newSel
            useUiStore.getState().setSelectedNodes(Array.from(newSel))
          }
        }
      }
      setMarquee(null)
    }

    if (inter.type === 'rotate') {
      const angle = Math.atan2(cy - inter.rotateCenter.y, cx - inter.rotateCenter.x) * 180 / Math.PI
      let delta = angle - inter.rotateStartAngle
      if (e.shiftKey) delta = Math.round(delta / 15) * 15

      const newTransforms = new Map<NodeId, Transform>()
      const prevTransforms = new Map<NodeId, Transform>()
      for (const [id, prevT] of inter.rotateInitialTransforms) {
        prevTransforms.set(id, { ...prevT })
        newTransforms.set(id, {
          ...prevT,
          rotation: ((prevT.rotation + delta) % 360 + 360) % 360,
        })
      }
      if (newTransforms.size > 0) {
        executeCmd(new RotateNodesCommand(Array.from(newTransforms.keys()), newTransforms, prevTransforms))
      }
      inter.type = 'none'
      return
    }

    // Freehand: commit path on mouseup
    if (inter.type === 'freehand') {
      const raw = freehandPointsRef.current
      if (raw.length >= 2) {
        const simplified = rdpSimplify(raw, 2)
        // Convert to SVG path d string
        const d = simplified.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        const prim: Primitive = {
          id: crypto.randomUUID(),
          type: 'primitive',
          primitiveType: 'path',
          name: 'Freehand',
          transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
          visible: true,
          locked: false,
          opacity: 1,
          geometry: { type: 'path', d },
          style: { fill: 'none', fillOpacity: 1, stroke: '#6366f1', strokeWidth: 1.5 },
        }
        executeCmd(new AddNodeCommand(prim, null))
        selectedIdsRef.current = new Set([prim.id])
        useUiStore.getState().setSelectedNodes([prim.id])
      }
      freehandPointsRef.current = []
      setFreehandPreview(null)
      inter.type = 'none'
      setTool('select')
      return
    }

    inter.type = 'none'
  }, [drawPreview, snap, endDrag, setAlignGuides, setRotationPreview, setDrawPreview, setMarquee, setTool, setFreehandPreview])

  // -------------------------------------------------------------------------
  // Double-click — commit pipe draw
  // -------------------------------------------------------------------------

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const d = docRef.current
    if (!d) return

    // Double-click on a group node → enter group editing scope
    if (!pipeDrawState && !penWaypoints) {
      const rect = getRect()
      if (rect) {
        const vp = viewportRef.current
        const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
        const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
        const hitId = hitTest(cx, cy)
        if (hitId) {
          // Find the node — could be inside the current active group (nested group case)
          const currentGroupId = useUiStore.getState().activeGroupId
          let node: SceneNode | undefined
          if (currentGroupId) {
            // Search within the currently active group's children
            const parentGroup = d.children.find(n => n.id === currentGroupId)
            if (parentGroup && 'children' in parentGroup && Array.isArray(parentGroup.children)) {
              node = (parentGroup.children as SceneNode[]).find(n => n.id === hitId)
            }
          } else {
            node = d.children.find(n => n.id === hitId)
          }
          if (node && node.type === 'group') {
            setActiveGroup(hitId)
            setTool('select')
            selectedIdsRef.current = new Set()
            useUiStore.getState().setSelectedNodes([])
            // Extend breadcrumb: append this group
            setGroupBreadcrumb(prev => {
              // If already in breadcrumb, truncate to that level (shouldn't happen but be safe)
              const existingIdx = prev.findIndex(b => b.id === hitId)
              if (existingIdx >= 0) return prev.slice(0, existingIdx + 1)
              return [...prev, { id: hitId, name: node.name ?? 'Group' }]
            })
            return
          }
        }
      }
    }

    if (pipeDrawState && pipeDrawState.waypoints.length >= 2) {
      const pipe: Pipe = {
        id: crypto.randomUUID(),
        type: 'pipe',
        name: 'Pipe',
        transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
        visible: true,
        locked: false,
        opacity: 1,
        serviceType: 'process',
        pathData: '',
        strokeWidth: 2,
        routingMode: 'manual',
        waypoints: [...pipeDrawState.waypoints],
      }
      executeCmd(new AddNodeCommand(pipe, null))
      selectedIdsRef.current = new Set([pipe.id])
      useUiStore.getState().setSelectedNodes([pipe.id])
      setPipeDrawState(null)
      setTool('select')
      return
    }

    // Pen tool — commit polyline on double-click
    if (penWaypoints && penWaypoints.length >= 2) {
      const prim: Primitive = {
        id: crypto.randomUUID(),
        type: 'primitive',
        primitiveType: 'polyline',
        name: 'Path',
        transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
        visible: true,
        locked: false,
        opacity: 1,
        geometry: { type: 'polyline', points: penWaypoints },
        style: { fill: 'none', fillOpacity: 1, stroke: '#6366f1', strokeWidth: 1 },
      }
      executeCmd(new AddNodeCommand(prim, null))
      selectedIdsRef.current = new Set([prim.id])
      useUiStore.getState().setSelectedNodes([prim.id])
      setPenWaypoints(null)
      setTool('select')
    }
  }, [penWaypoints, pipeDrawState, setPenWaypoints, setPipeDrawState, setTool, setActiveGroup])

  // -------------------------------------------------------------------------
  // Wheel — zoom centered on cursor
  // -------------------------------------------------------------------------

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = getRect()
    if (!rect) return
    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    zoomTo(vp.zoom * factor, cx, cy)
  }, [zoomTo])

  // Register wheel handler with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isInput = (e.target as HTMLElement).tagName === 'INPUT' ||
                    (e.target as HTMLElement).tagName === 'TEXTAREA' ||
                    (e.target as HTMLElement).isContentEditable
    const ctrl = e.ctrlKey || e.metaKey

    // Undo/Redo — always capture
    if (ctrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault(); historyUndo(); return
    }
    if (ctrl && ((e.key === 'Z' && e.shiftKey) || e.key === 'y' || e.key === 'Y')) {
      e.preventDefault(); historyRedo(); return
    }

    // Ctrl+A — select all (non-locked, visible root nodes)
    if (ctrl && e.key === 'a') {
      e.preventDefault()
      const d = docRef.current
      if (d) {
        const allIds = d.children.filter(n => n.visible && !n.locked).map(n => n.id)
        selectedIdsRef.current = new Set(allIds)
        useUiStore.getState().setSelectedNodes(allIds)
      }
      return
    }

    // Ctrl+C — copy
    if (ctrl && e.key === 'c' && !isInput) {
      e.preventDefault()
      const d = docRef.current
      if (!d) return
      const ids = Array.from(selectedIdsRef.current)
      _clipboard = ids
        .map(id => d.children.find(n => n.id === id))
        .filter((n): n is SceneNode => n !== undefined)
      return
    }

    // Ctrl+X — cut
    if (ctrl && e.key === 'x' && !isInput) {
      e.preventDefault()
      const d = docRef.current
      if (!d) return
      const ids = Array.from(selectedIdsRef.current)
      _clipboard = ids
        .map(id => d.children.find(n => n.id === id))
        .filter((n): n is SceneNode => n !== undefined)
      if (ids.length > 0) {
        executeCmd(new DeleteNodesCommand(ids))
        selectedIdsRef.current = new Set()
        useUiStore.getState().setSelectedNodes([])
      }
      return
    }

    // Ctrl+V — paste
    if (ctrl && e.key === 'v' && !isInput) {
      e.preventDefault()
      if (_clipboard.length > 0 && docRef.current) {
        const cmd = new PasteNodesCommand(_clipboard)
        const newDoc = cmd.execute(docRef.current)
        // Derive new IDs from the doc diff
        const oldIds = new Set(docRef.current.children.map(n => n.id))
        executeCmd(cmd)
        const d2 = docRef.current
        if (d2) {
          const pastedIds = d2.children.filter(n => !oldIds.has(n.id)).map(n => n.id)
          selectedIdsRef.current = new Set(pastedIds)
          useUiStore.getState().setSelectedNodes(pastedIds)
        }
        void newDoc
      }
      return
    }

    // Ctrl+D — duplicate
    if (ctrl && e.key === 'd') {
      e.preventDefault()
      const ids = Array.from(selectedIdsRef.current)
      if (ids.length > 0 && docRef.current) executeCmd(new DuplicateNodesCommand(ids))
      return
    }

    // Ctrl++ / Ctrl+= — zoom in; Ctrl+- — zoom out; Ctrl+0 — fit to canvas
    if (ctrl && (e.key === '+' || e.key === '=')) {
      e.preventDefault()
      zoomTo(viewportRef.current.zoom * 1.25)
      return
    }
    if (ctrl && e.key === '-') {
      e.preventDefault()
      zoomTo(viewportRef.current.zoom / 1.25)
      return
    }
    if (ctrl && e.key === '0') {
      e.preventDefault()
      const d = docRef.current
      const el = containerRef.current
      if (d && el) {
        const { width, height } = el.getBoundingClientRect()
        fitToCanvas(d.canvas.width, d.canvas.height, width, height)
      }
      return
    }

    // Ctrl+G — group; Ctrl+Shift+G — ungroup
    if (ctrl && e.key === 'g' && !e.shiftKey) {
      e.preventDefault()
      const ids = Array.from(selectedIdsRef.current)
      if (ids.length > 1 && docRef.current) {
        const d = docRef.current
        // Filter out pipe nodes per task spec — only group non-pipe nodes
        const eligible = ids.filter(id => d.children.find(n => n.id === id)?.type !== 'pipe')
        if (eligible.length > 1) {
          setGroupPrompt({ defaultName: nextGroupName(d), pendingIds: eligible })
        }
      }
      return
    }
    if (ctrl && e.key === 'G' && e.shiftKey) {
      e.preventDefault()
      // Ungroup all selected group nodes
      const ungroupedChildIds: NodeId[] = []
      for (const id of Array.from(selectedIdsRef.current)) {
        const d = docRef.current
        if (!d) break
        const node = d.children.find(n => n.id === id)
        if (node?.type === 'group') {
          ungroupedChildIds.push(...((node as Group).children ?? []).map(c => c.id))
          executeCmd(new UngroupCommand(id))
        }
      }
      selectedIdsRef.current = new Set(ungroupedChildIds)
      useUiStore.getState().setSelectedNodes(ungroupedChildIds)
      return
    }

    if (isInput) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ids = Array.from(selectedIdsRef.current)
      if (ids.length > 0 && docRef.current) {
        executeCmd(new DeleteNodesCommand(ids))
        selectedIdsRef.current = new Set()
        useUiStore.getState().setSelectedNodes([])
      }
      return
    }

    if (e.key === 'Escape') {
      // Cancel active drag — reset DOM ghost transforms to original positions
      const inter = interactionRef.current
      if (inter.type === 'drag') {
        const svgEl = containerRef.current?.querySelector('svg')
        if (svgEl) {
          for (const [id, orig] of inter.originalPositions) {
            const gEl = svgEl.querySelector(`[data-node-id="${id}"]`)
            if (gEl) {
              gEl.setAttribute('transform', `translate(${orig.x},${orig.y})`)
            }
          }
        }
        inter.type = 'none'
        endDrag()
        setAlignGuides([])
        return
      }
      // If inside a group scope, exit it first; second Escape clears selection
      if (useUiStore.getState().activeGroupId !== null) {
        setActiveGroup(null)
        setGroupBreadcrumb([])
        selectedIdsRef.current = new Set()
        useUiStore.getState().setSelectedNodes([])
        return
      }
      selectedIdsRef.current = new Set()
      useUiStore.getState().setSelectedNodes([])
      setPipeDrawState(null)
      setPenWaypoints(null)
      setDrawPreview(null)
      setMarquee(null)
      setTool('select')
      return
    }

    // Arrow key nudge — 1px normal, 10px with Shift
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const ids = Array.from(selectedIdsRef.current)
      const d = docRef.current
      if (ids.length > 0 && d) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0
        const prevTransforms = new Map<NodeId, Transform>()
        function findT(nodes: SceneNode[], id: NodeId): Transform | null {
          for (const n of nodes) {
            if (n.id === id) return n.transform
            if ('children' in n && Array.isArray((n as Group).children)) {
              const f = findT((n as Group).children as SceneNode[], id)
              if (f) return f
            }
          }
          return null
        }
        for (const id of ids) {
          const t = findT(d.children, id)
          if (t) prevTransforms.set(id, t)
        }
        executeCmd(new MoveNodesCommand(ids, { x: dx, y: dy }, prevTransforms))
      }
      return
    }

    // Ctrl+Shift+0 — zoom to selection (key is '0' on US keyboards; ')' when Shift is held but some browsers report '0')
    if (ctrl && e.shiftKey && (e.key === '0' || e.key === ')')) {
      e.preventDefault()
      const ids = Array.from(selectedIdsRef.current)
      const d = docRef.current
      const el = containerRef.current
      if (ids.length > 0 && d && el) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const id of ids) {
          const n = d.children.find(c => c.id === id)
          if (!n) continue
          const b = getNodeBounds(n)
          minX = Math.min(minX, b.x); minY = Math.min(minY, b.y)
          maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h)
        }
        if (isFinite(minX)) {
          const { width: sw, height: sh } = el.getBoundingClientRect()
          const pad = 40
          const zoom = Math.min((sw - pad*2) / (maxX - minX), (sh - pad*2) / (maxY - minY), 4)
          const panX = (sw - (maxX - minX) * zoom) / 2 - minX * zoom
          const panY = (sh - (maxY - minY) * zoom) / 2 - minY * zoom
          setViewport({ zoom, panX, panY })
        }
      }
      return
    }

    // Ctrl+' — toggle grid visibility; Ctrl+Shift+' — toggle snap to grid
    if (ctrl && (e.key === "'" || e.key === '"')) {
      e.preventDefault()
      if (e.shiftKey) {
        setSnap(!snapToGrid)
      } else {
        setGrid(!gridVisible)
      }
      return
    }

    // Enter — finish active pipe or pen path
    if (e.key === 'Enter') {
      if (pipeDrawState && pipeDrawState.waypoints.length >= 2) {
        e.preventDefault()
        const pipe: import('../../shared/types/graphics').Pipe = {
          id: crypto.randomUUID(),
          type: 'pipe',
          name: 'Pipe',
          transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
          visible: true,
          locked: false,
          opacity: 1,
          serviceType: 'process',
          pathData: '',
          strokeWidth: 2,
          routingMode: 'manual',
          waypoints: [...pipeDrawState.waypoints],
        }
        executeCmd(new AddNodeCommand(pipe, null))
        selectedIdsRef.current = new Set([pipe.id])
        useUiStore.getState().setSelectedNodes([pipe.id])
        setPipeDrawState(null)
        setTool('select')
        return
      }
      if (penWaypoints && penWaypoints.length >= 2) {
        e.preventDefault()
        const prim: import('../../shared/types/graphics').Primitive = {
          id: crypto.randomUUID(),
          type: 'primitive',
          primitiveType: 'polyline',
          name: 'Path',
          transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
          visible: true,
          locked: false,
          opacity: 1,
          geometry: { type: 'polyline', points: penWaypoints },
          style: { fill: 'none', fillOpacity: 1, stroke: '#6366f1', strokeWidth: 1 },
        }
        executeCmd(new AddNodeCommand(prim, null))
        selectedIdsRef.current = new Set([prim.id])
        useUiStore.getState().setSelectedNodes([prim.id])
        setPenWaypoints(null)
        setTool('select')
        return
      }
    }

    // Spacebar — temporary pan mode (handled in keydown; restored in keyup)
    if (e.key === ' ' && !isInput) {
      e.preventDefault()
      if (activeTool !== 'pan') {
        spacebarPrevToolRef.current = activeTool
        setTool('pan')
      }
      return
    }

    // Shift+P — pipe tool
    if (e.shiftKey && e.key === 'P' && !ctrl) {
      e.preventDefault()
      setTool('pipe')
      return
    }

    if (!ctrl && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break
        case 'r': setTool('rect'); break
        case 'e': setTool('ellipse'); break
        case 't': setTool('text'); break
        case 'h': setTool('pan'); break
        case 'p': setTool('pen'); break
        case 'b': setTool('freehand'); break
        case 'l': setTool('line'); break
        case 'i': setTool('pipe'); break
        case 'a': setTool('annotation'); break
      }
    }
  }, [historyUndo, historyRedo, setPenWaypoints, setTool, setPipeDrawState, setDrawPreview, setMarquee, zoomTo, fitToCanvas, setGrid, setSnap, gridVisible, snapToGrid, activeTool, pipeDrawState, penWaypoints, setViewport, setActiveGroup, endDrag, setAlignGuides])

  // Spacebar keyup — restore previous tool
  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' && spacebarPrevToolRef.current !== null) {
      setTool(spacebarPrevToolRef.current as Parameters<typeof setTool>[0])
      spacebarPrevToolRef.current = null
    }
  }, [setTool])

  // -------------------------------------------------------------------------
  // Toolbar group / ungroup events (fired by DesignerToolbar buttons)
  // -------------------------------------------------------------------------

  useEffect(() => {
    function onToolbarGroup() {
      const d = docRef.current
      if (!d) return
      const ids = Array.from(selectedIdsRef.current)
      if (ids.length < 2) return
      const eligible = ids.filter(id => d.children.find(n => n.id === id)?.type !== 'pipe')
      if (eligible.length >= 2) {
        setGroupPrompt({ defaultName: nextGroupName(d), pendingIds: eligible })
      }
    }

    function onToolbarUngroup() {
      const d = docRef.current
      if (!d) return
      const ids = Array.from(selectedIdsRef.current)
      const ungroupedChildIds: NodeId[] = []
      for (const id of ids) {
        const node = d.children.find(n => n.id === id)
        if (node?.type === 'group') {
          ungroupedChildIds.push(...((node as Group).children ?? []).map(c => c.id))
          executeCmd(new UngroupCommand(id))
        }
      }
      selectedIdsRef.current = new Set(ungroupedChildIds)
      useUiStore.getState().setSelectedNodes(ungroupedChildIds)
    }

    document.addEventListener('io:toolbar-group', onToolbarGroup)
    document.addEventListener('io:toolbar-ungroup', onToolbarUngroup)
    return () => {
      document.removeEventListener('io:toolbar-group', onToolbarGroup)
      document.removeEventListener('io:toolbar-ungroup', onToolbarUngroup)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Right-click context menu
  // -------------------------------------------------------------------------

  // Called on the Radix Trigger's onContextMenu — updates the ref so menu
  // content can read the hit-tested nodeId when it renders.
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const rect = getRect()
    if (!rect) { ctxNodeIdRef.current = null; return }
    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const hitId = hitTest(cx, cy)
    if (hitId && !selectedIdsRef.current.has(hitId)) {
      selectedIdsRef.current = new Set([hitId])
      useUiStore.getState().setSelectedNodes([hitId])
    }
    ctxNodeIdRef.current = hitId
  }, [])

  // -------------------------------------------------------------------------
  // Handle drop from left palette
  // -------------------------------------------------------------------------

  useEffect(() => {
    function onShapeDrop(e: Event) {
      const ce = e as CustomEvent<{ shapeId: string; x: number; y: number }>
      const rect = getRect()
      if (!rect || !docRef.current) return
      const vp = viewportRef.current
      const cx = snap((ce.detail.x - rect.left - vp.panX) / vp.zoom)
      const cy = snap((ce.detail.y - rect.top  - vp.panY) / vp.zoom)

      const si: SymbolInstance = {
        id: crypto.randomUUID(),
        type: 'symbol_instance',
        name: ce.detail.shapeId,
        transform: { position: { x: cx, y: cy }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
        visible: true,
        locked: false,
        opacity: 1,
        shapeRef: { shapeId: ce.detail.shapeId, variant: 'default' },
        composableParts: [],
        textZoneOverrides: {},
        children: [],
        propertyOverrides: {},
      }
      const dropParentId = useUiStore.getState().activeGroupId
      executeCmd(new AddNodeCommand(si, dropParentId))
      selectedIdsRef.current = new Set([si.id])
      useUiStore.getState().setSelectedNodes([si.id])

      // Load the shape SVG in the background
      useLibraryStore.getState().loadShape(ce.detail.shapeId)
    }

    document.addEventListener('io:shape-drop', onShapeDrop)
    return () => document.removeEventListener('io:shape-drop', onShapeDrop)
  }, [snap])

  // Handle stencil drops from left palette
  useEffect(() => {
    function onStencilDrop(e: Event) {
      const ce = e as CustomEvent<{ stencilId: string; x: number; y: number }>
      const rect = getRect()
      if (!rect || !docRef.current) return
      const vp = viewportRef.current
      const cx = snap((ce.detail.x - rect.left - vp.panX) / vp.zoom)
      const cy = snap((ce.detail.y - rect.top  - vp.panY) / vp.zoom)

      const node: Stencil = {
        id: crypto.randomUUID(),
        type: 'stencil',
        name: 'Stencil',
        transform: { position: { x: cx, y: cy }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
        visible: true,
        locked: false,
        opacity: 1,
        stencilRef: { stencilId: ce.detail.stencilId },
      }
      const stencilParentId = useUiStore.getState().activeGroupId
      executeCmd(new AddNodeCommand(node, stencilParentId))
      selectedIdsRef.current = new Set([node.id])
      useUiStore.getState().setSelectedNodes([node.id])
    }

    document.addEventListener('io:stencil-drop', onStencilDrop)
    return () => document.removeEventListener('io:stencil-drop', onStencilDrop)
  }, [snap])

  // Handle widget drops from left palette (dashboard / report modes)
  useEffect(() => {
    function onWidgetDrop(e: Event) {
      const ce = e as CustomEvent<{ widgetType: WidgetType; x: number; y: number }>
      const rect = getRect()
      if (!rect || !docRef.current) return
      const vp = viewportRef.current
      const rawX = (ce.detail.x - rect.left - vp.panX) / vp.zoom
      const rawY = (ce.detail.y - rect.top  - vp.panY) / vp.zoom

      // In dashboard mode, snap to 12-column grid (spec §11.2)
      const currentDoc = docRef.current
      const mode = useSceneStore.getState().designMode
      let cx: number
      let cy: number
      let defaultW = 320
      let defaultH = 200
      let gridSpan: { cols: number; rows: number } | undefined
      if (mode === 'dashboard') {
        const COLS = 12
        const ROW_H = (currentDoc.metadata as Record<string, unknown> & { rowHeight?: number }).rowHeight ?? 80
        const colW = currentDoc.canvas.width / COLS
        const col = Math.max(0, Math.min(COLS - 1, Math.round(rawX / colW)))
        const row = Math.max(0, Math.round(rawY / ROW_H))
        const spanCols = Math.max(1, Math.round(defaultW / colW))
        const spanRows = Math.max(1, Math.round(defaultH / ROW_H))
        cx = col * colW
        cy = row * ROW_H
        defaultW = spanCols * colW
        defaultH = spanRows * ROW_H
        gridSpan = { cols: spanCols, rows: spanRows }
      } else {
        cx = snap(rawX)
        cy = snap(rawY)
      }

      const wt = ce.detail.widgetType
      const defaultLabel = wt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      const nullBinding: PointBinding = {}
      const defaultConfig: WidgetConfig = (() => {
        switch (wt) {
          case 'trend':        return { widgetType: 'trend', title: defaultLabel, series: [], timeRange: { mode: 'relative', relativeSeconds: 3600 }, liveMode: true, refreshMs: 5000, yAxis: { autoScale: true, logScale: false }, showQuality: false, showEvents: false } satisfies WidgetConfig
          case 'table':        return { widgetType: 'table', title: defaultLabel, columns: [], pageSize: 20 } satisfies WidgetConfig
          case 'gauge':        return { widgetType: 'gauge', title: defaultLabel, binding: nullBinding, gaugeStyle: 'radial', rangeLo: 0, rangeHi: 100, showValue: true, valueFormat: '#.##' } satisfies WidgetConfig
          case 'kpi_card':     return { widgetType: 'kpi_card', title: defaultLabel, binding: nullBinding, valueFormat: '#.##', showSparkline: true, showTrendArrow: true } satisfies WidgetConfig
          case 'bar_chart':    return { widgetType: 'bar_chart', title: defaultLabel, series: [], orientation: 'vertical', showLegend: true } satisfies WidgetConfig
          case 'pie_chart':    return { widgetType: 'pie_chart', title: defaultLabel, slices: [], donut: false, showLegend: true } satisfies WidgetConfig
          case 'alarm_list':   return { widgetType: 'alarm_list', title: defaultLabel, maxRows: 50, showAcknowledged: false } satisfies WidgetConfig
          case 'muster_point': return { widgetType: 'muster_point', title: defaultLabel, musterPointId: '', showHeadcount: true, showMissing: true } satisfies WidgetConfig
        }
      })()

      const node: WidgetNode = {
        id: crypto.randomUUID(),
        type: 'widget',
        widgetType: wt,
        name: defaultLabel,
        transform: { position: { x: cx, y: cy }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
        visible: true,
        locked: false,
        opacity: 1,
        width: defaultW,
        height: defaultH,
        ...(gridSpan ? { gridSpan } : {}),
        config: defaultConfig,
      }
      executeCmd(new AddNodeCommand(node, null))
      selectedIdsRef.current = new Set([node.id])
      useUiStore.getState().setSelectedNodes([node.id])
    }

    document.addEventListener('io:widget-drop', onWidgetDrop)
    return () => document.removeEventListener('io:widget-drop', onWidgetDrop)
  }, [snap])

  // Handle display-element drops from left palette (graphic mode)
  useEffect(() => {
    function onDisplayElementDrop(e: Event) {
      const ce = e as CustomEvent<{ elementType: DisplayElementType; x: number; y: number }>
      const rect = getRect()
      if (!rect || !docRef.current) return
      const vp = viewportRef.current
      const cx = snap((ce.detail.x - rect.left - vp.panX) / vp.zoom)
      const cy = snap((ce.detail.y - rect.top  - vp.panY) / vp.zoom)

      const et = ce.detail.elementType
      const config: DisplayElementConfig = (() => {
        switch (et) {
          case 'text_readout':      return { displayType: 'text_readout', showBox: false, showLabel: false, showUnits: true, valueFormat: '%.2f', minWidth: 60 }
          case 'analog_bar':        return { displayType: 'analog_bar', orientation: 'vertical', barWidth: 20, barHeight: 80, rangeLo: 0, rangeHi: 100, showZoneLabels: true, showPointer: true, showSetpoint: false, showNumericReadout: true, showSignalLine: false }
          case 'fill_gauge':        return { displayType: 'fill_gauge', mode: 'standalone', fillDirection: 'up', rangeLo: 0, rangeHi: 100, showLevelLine: true, showValue: true, valueFormat: '%.0f' }
          case 'sparkline':         return { displayType: 'sparkline', timeWindowMinutes: 60, scaleMode: 'auto', dataPoints: 60 }
          case 'alarm_indicator':   return { displayType: 'alarm_indicator', mode: 'single' }
          case 'digital_status':    return { displayType: 'digital_status', stateLabels: {}, normalStates: [], abnormalPriority: 3 }
        }
      })()

      const node: DisplayElement = {
        id: crypto.randomUUID(),
        type: 'display_element',
        displayType: et,
        name: et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        binding: {},
        config,
        transform: { position: { x: cx, y: cy }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
        visible: true,
        locked: false,
        opacity: 1,
      }
      const deParentId = useUiStore.getState().activeGroupId
      executeCmd(new AddNodeCommand(node, deParentId))
      selectedIdsRef.current = new Set([node.id])
      useUiStore.getState().setSelectedNodes([node.id])
    }

    document.addEventListener('io:display-element-drop', onDisplayElementDrop)
    return () => document.removeEventListener('io:display-element-drop', onDisplayElementDrop)
  }, [snap])

  // -------------------------------------------------------------------------
  // Handle report element drops from left palette
  // -------------------------------------------------------------------------

  useEffect(() => {
    function onReportElementDrop(e: Event) {
      const ce = e as CustomEvent<{ elementType: string; x: number; y: number }>
      const rect = getRect()
      if (!rect || !docRef.current) return
      const vp = viewportRef.current
      const cx = snap((ce.detail.x - rect.left - vp.panX) / vp.zoom)
      const cy = snap((ce.detail.y - rect.top  - vp.panY) / vp.zoom)
      const et = ce.detail.elementType as 'text_block' | 'section_break' | 'page_break' | 'header' | 'footer'

      // Report elements map to either TextBlock or Annotation nodes
      if (et === 'text_block') {
        const node: TextBlock = {
          id: crypto.randomUUID(),
          type: 'text_block',
          name: 'Text Block',
          transform: { position: { x: cx, y: cy }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
          visible: true,
          locked: false,
          opacity: 1,
          content: 'Enter text here...',
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: 400,
          fontStyle: 'normal',
          textAnchor: 'start',
          fill: '#A1A1AA',
          background: { fill: '#27272A', stroke: '#3F3F46', strokeWidth: 1, padding: 8, borderRadius: 2 },
          maxWidth: 300,
        }
        executeCmd(new AddNodeCommand(node, null))
        selectedIdsRef.current = new Set([node.id])
        useUiStore.getState().setSelectedNodes([node.id])
      } else {
        type ReportAnnotationType = 'section_break' | 'page_break' | 'header' | 'footer'
        const rat = et as ReportAnnotationType
        const cfgWidth = 600
        const config = rat === 'section_break' ? { annotationType: rat, width: cfgWidth } as const
                      : rat === 'page_break'    ? { annotationType: rat, width: cfgWidth } as const
                      : rat === 'header'        ? { annotationType: rat, width: cfgWidth, height: 40 } as const
                      :                           { annotationType: rat, width: cfgWidth, height: 40 } as const

        const annNodeW = cfgWidth
        const annNodeH = (rat === 'section_break' || rat === 'page_break') ? 4 : 40
        const annotationNode = {
          id: crypto.randomUUID(),
          type: 'annotation' as const,
          name: et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          annotationType: rat,
          width: annNodeW,
          height: annNodeH,
          transform: { position: { x: cx, y: cy }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
          visible: true,
          locked: false,
          opacity: 1,
          config,
        }
        executeCmd(new AddNodeCommand(annotationNode as SceneNode, null))
        selectedIdsRef.current = new Set([annotationNode.id])
        useUiStore.getState().setSelectedNodes([annotationNode.id])
      }
    }

    document.addEventListener('io:report-element-drop', onReportElementDrop)
    return () => document.removeEventListener('io:report-element-drop', onReportElementDrop)
  }, [snap])

  // -------------------------------------------------------------------------
  // Cursor style based on active tool
  // -------------------------------------------------------------------------

  const cursorMap: Record<string, string> = {
    select: 'default',
    pan: 'grab',
    rect: 'crosshair',
    ellipse: 'crosshair',
    line: 'crosshair',
    pen: 'crosshair',
    freehand: 'crosshair',
    text: 'text',
    pipe: 'crosshair',
    image: 'copy',
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const { panX, panY, zoom } = viewport
  const canvasW    = doc?.canvas.width  ?? 1920
  const declaredH  = doc?.canvas.height ?? 1080
  const autoHeightEnabled = doc?.canvas.autoHeight ?? false

  // Compute the bottom of all visible content — memoized on scene graph changes
  const contentBoundingBoxBottom = useMemo(() => {
    if (!doc || !autoHeightEnabled) return declaredH
    let maxY = 0
    for (const node of doc.children) {
      if (!node.visible) continue
      const b = getNodeBounds(node)
      if (b) maxY = Math.max(maxY, b.y + b.h)
    }
    return maxY
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.children, autoHeightEnabled, declaredH])

  // When autoHeight is on, canvas grows to fit content (min = declaredH, 80px bottom padding)
  const canvasH = autoHeightEnabled
    ? Math.max(declaredH, contentBoundingBoxBottom + 80)
    : declaredH
  const bgColor = doc?.canvas.backgroundColor ?? '#09090b'

  // Stable shape SVG getter that re-evaluates when the library cache changes (version triggers re-render)
  const getShapeSvgMemo = useCallback((id: string) => getShapeSvg(id), [getShapeSvg])
  void version // consumed to trigger re-render when doc changes

  // -------------------------------------------------------------------------
  // Quick Bind: drop a point from Point Browser onto a symbol with valueAnchors
  // -------------------------------------------------------------------------

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('application/io-point')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  function handleDrop(e: React.DragEvent) {
    const raw = e.dataTransfer.getData('application/io-point')
    if (!raw) return
    e.preventDefault()

    let pointData: { type: string; pointId: string; tagname: string; displayName: string; unit: string }
    try { pointData = JSON.parse(raw) } catch { return }
    if (pointData.type !== 'point') return

    const d = docRef.current
    const r = containerRef.current?.getBoundingClientRect()
    if (!d || !r) return

    const { panX, panY, zoom } = useUiStore.getState().viewport
    const cx = (e.clientX - r.left - panX) / zoom
    const cy = (e.clientY - r.top  - panY) / zoom

    // Find what's under the drop point
    const hitId = hitTest(cx, cy)
    if (!hitId) return

    const hitNode = d.children.find(n => n.id === hitId)
    if (!hitNode || hitNode.type !== 'symbol_instance') return

    const sym = hitNode as SymbolInstance

    // Determine anchor position from sidecar valueAnchors first, else fall back below-shape
    const bounds = getNodeBounds(sym)
    let anchorX = bounds.x
    let anchorY = bounds.y + bounds.h + 4
    const libEntry = useLibraryStore.getState().cache.get(sym.shapeRef.shapeId)
    const valueAnchors = libEntry?.sidecar?.valueAnchors as Array<{ nx: number; ny: number; preferredElement?: string }> | undefined
    const anchor = valueAnchors?.[0]
    if (anchor) {
      // Normalized anchor coordinates → absolute position using shape bounds
      anchorX = sym.transform.position.x + anchor.nx * bounds.w
      anchorY = sym.transform.position.y + anchor.ny * bounds.h
    }

    // Create a DisplayElement (text_readout) at the anchor position
    const de: DisplayElement = {
      id: crypto.randomUUID(),
      type: 'display_element',
      name: `${pointData.displayName} readout`,
      transform: { position: { x: anchorX, y: anchorY }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
      visible: true,
      locked: false,
      opacity: 1,
      displayType: 'text_readout',
      config: {
        displayType: 'text_readout',
        showBox: true,
        showLabel: true,
        labelText: pointData.displayName,
        showUnits: !!pointData.unit,
        valueFormat: '%.2f',
        minWidth: 60,
      },
      binding: { pointId: pointData.pointId },
    }

    executeCmd(new AddNodeCommand(de, null))
    selectedIdsRef.current = new Set([de.id])
    useUiStore.getState().setSelectedNodes([de.id])
  }

  return (
    <ContextMenuPrimitive.Root>
    <ContextMenuPrimitive.Trigger asChild onContextMenu={handleContextMenu}>
    <div
      ref={containerRef}
      className={className}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        background: '#0a0a0b',
        outline: 'none',
        cursor: cursorMap[activeTool] ?? 'default',
        ...style,
      }}
    >
      {/* Canvas SVG */}
      <svg
        width="100%"
        height="100%"
        style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}
      >
        {/* Grid (screen-space pattern behind canvas rect) */}
        {gridVisible && doc && (
          <>
            <defs>
              <pattern
                id={`grid-${doc.id}`}
                x={panX % (gridSize * zoom)}
                y={panY % (gridSize * zoom)}
                width={gridSize * zoom}
                height={gridSize * zoom}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridSize * zoom} 0 L 0 0 0 ${gridSize * zoom}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={0.5}
                />
              </pattern>
            </defs>
            <rect
              x={panX}
              y={panY}
              width={canvasW * zoom}
              height={canvasH * zoom}
              fill={`url(#grid-${doc.id})`}
              style={{ pointerEvents: 'none' }}
            />
          </>
        )}

        {/* Canvas background rect */}
        <rect
          x={panX}
          y={panY}
          width={canvasW * zoom}
          height={canvasH * zoom}
          fill={bgColor}
          style={{ pointerEvents: 'none' }}
        />

        {/* Dashboard 12-column grid overlay (spec §11.2) */}
        {gridVisible && designMode === 'dashboard' && doc && (() => {
          const COLS = 12
          const ROW_H = (doc.metadata as Record<string, unknown> & { rowHeight?: number }).rowHeight ?? 80
          const colW = canvasW / COLS
          return (
            <g transform={`translate(${panX},${panY}) scale(${zoom})`} style={{ pointerEvents: 'none' }}>
              {/* Column lines */}
              {Array.from({ length: COLS - 1 }, (_, i) => (
                <line
                  key={`col-${i}`}
                  x1={(i + 1) * colW} y1={0}
                  x2={(i + 1) * colW} y2={canvasH}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}
              {/* Row lines */}
              {Array.from({ length: Math.ceil(canvasH / ROW_H) - 1 }, (_, i) => (
                <line
                  key={`row-${i}`}
                  x1={0} y1={(i + 1) * ROW_H}
                  x2={canvasW} y2={(i + 1) * ROW_H}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}
            </g>
          )
        })()}

        {/* Canvas border */}
        <rect
          x={panX}
          y={panY}
          width={canvasW * zoom}
          height={canvasH * zoom}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
          style={{ pointerEvents: 'none' }}
        />

        {/* Scene graph — transformed by viewport */}
        <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
          {/* Canvas boundary visual — dashed 1px border, designer mode only (not view-only/kiosk/test) */}
          {!testMode && doc && (() => {
            const containerRect = containerRef.current?.getBoundingClientRect()
            const viewportW = containerRect?.width ?? 0
            const viewportH = containerRect?.height ?? 0
            const boundaryVisible =
              panX < 0 || panY < 0 ||
              (panX + viewportW / zoom) > canvasW ||
              (panY + viewportH / zoom) > canvasH
            if (!boundaryVisible) return null
            if (autoHeightEnabled) {
              // autoHeight: top, left, right edges only (no bottom edge)
              // The page guide line is drawn at the declared minimum height (declaredH), not the auto-computed canvasH
              const edgeD = `M0,${declaredH} L0,0 L${canvasW},0 L${canvasW},${declaredH}`
              return (
                <>
                  <path
                    d={edgeD}
                    fill="none"
                    stroke="var(--io-border-subtle)"
                    strokeOpacity={0.5}
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                    pointerEvents="none"
                  />
                  <line
                    x1={0} y1={declaredH} x2={canvasW} y2={declaredH}
                    stroke="var(--io-border-subtle)"
                    strokeOpacity={0.4}
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                    pointerEvents="none"
                  />
                </>
              )
            }
            return (
              <rect
                x={0} y={0}
                width={canvasW} height={canvasH}
                fill="none"
                stroke="var(--io-border-subtle)"
                strokeOpacity={0.5}
                strokeWidth={1 / zoom}
                strokeDasharray={`${8 / zoom} ${4 / zoom}`}
                pointerEvents="none"
                style={{ zIndex: -1 } as React.CSSProperties}
              />
            )
          })()}
          <TestModeContext.Provider value={testModeValues}>
            {groupSubTabNodeId
              ? (() => {
                  // Group sub-tab mode: only render children of the target group node
                  const groupNode = doc?.children.find(n => n.id === groupSubTabNodeId)
                  const children = (groupNode && 'children' in groupNode)
                    ? (groupNode as import('../../shared/types/graphics').Group).children
                    : []
                  return children.map(node => (
                    <g key={node.id}>
                      <RenderNode
                        node={node}
                        getShapeSvg={getShapeSvgMemo}
                        selectedIds={selectedIdsRef.current}
                      />
                    </g>
                  ))
                })()
              : doc?.children.map(node => {
                  // In group edit mode: dim nodes that are NOT the active group
                  const isDimmed = activeGroupId !== null && node.id !== activeGroupId
                  return (
                    <g
                      key={node.id}
                      opacity={isDimmed ? 0.3 : 1}
                      style={isDimmed ? { pointerEvents: 'none' } : undefined}
                    >
                      <RenderNode
                        node={node}
                        getShapeSvg={getShapeSvgMemo}
                        selectedIds={selectedIdsRef.current}
                      />
                    </g>
                  )
                })
            }
          </TestModeContext.Provider>

          {/* Group edit mode: teal dashed border around active group bounding box */}
          {activeGroupId && doc && (() => {
            const groupNode = doc.children.find(n => n.id === activeGroupId)
            if (!groupNode) return null
            const b = getNodeBounds(groupNode)
            const pad = 4 / zoom
            return (
              <rect
                x={b.x - pad}
                y={b.y - pad}
                width={b.w + pad * 2}
                height={b.h + pad * 2}
                fill="none"
                stroke="var(--io-accent)"
                strokeWidth={2 / zoom}
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}

          {/* Selection overlay */}
          {doc && (
            <SelectionOverlay
              nodeIds={selectedIdsRef.current}
              doc={doc}
              zoom={zoom}
              onRotateStart={startRotate}
              onResizeStart={startResize}
              previewRotation={rotationPreview}
            />
          )}

          {/* Lock indicators */}
          {doc && <LockOverlay doc={doc} zoom={zoom} />}

          {/* Group sub-tab open indicator — small badge on groups that have an open sub-tab */}
          {doc && !groupSubTabNodeId && openGroupTabNodeIds.size > 0 && (
            <GroupTabIndicatorOverlay doc={doc} zoom={zoom} openGroupTabNodeIds={openGroupTabNodeIds} />
          )}

          {/* Smart alignment guides */}
          <AlignmentGuidesOverlay guides={alignGuides} canvasW={canvasW} canvasH={canvasH} zoom={zoom} />

          {/* Draw preview */}
          <DrawPreviewOverlay zoom={zoom} />

          {/* Marquee */}
          <MarqueeOverlay zoom={zoom} />

          {/* Pipe draw preview */}
          <PipeDrawOverlay zoom={zoom} />

          {/* Pen draw preview */}
          <PenDrawOverlay waypoints={penWaypoints} cursorX={penCursor.x} cursorY={penCursor.y} zoom={zoom} />

          {/* Freehand draw preview */}
          <FreehandPreviewOverlay points={freehandPreview} zoom={zoom} />

          {/* Connection point dots (pipe tool) */}
          {doc && (
            <ConnectionPointsOverlay doc={doc} zoom={zoom} activeTool={activeTool} />
          )}
        </g>
      </svg>

      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file || !imagePendingPosRef.current || !docRef.current) return
          const pos = imagePendingPosRef.current
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            if (!dataUrl) return
            const img = new window.Image()
            img.onload = () => {
              const node: ImageNode = {
                id: crypto.randomUUID(),
                type: 'image',
                name: file.name,
                transform: { position: { x: pos.x, y: pos.y }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
                visible: true,
                locked: false,
                opacity: 1,
                assetRef: {
                  hash: dataUrl,
                  mimeType: file.type,
                  originalFilename: file.name,
                  originalWidth: img.naturalWidth,
                  originalHeight: img.naturalHeight,
                  fileSize: file.size,
                },
                displayWidth: Math.min(img.naturalWidth, 400),
                displayHeight: Math.min(img.naturalHeight, 400) * (Math.min(img.naturalWidth, 400) / img.naturalWidth),
                preserveAspectRatio: true,
                imageRendering: 'auto',
              }
              executeCmd(new AddNodeCommand(node, null))
              selectedIdsRef.current = new Set([node.id])
              useUiStore.getState().setSelectedNodes([node.id])
              setTool('select')
            }
            img.src = dataUrl
          }
          reader.readAsDataURL(file)
          // Reset so same file can be re-imported
          e.target.value = ''
        }}
      />

      {/* No document placeholder */}
      {!doc && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 14,
          pointerEvents: 'none',
        }}>
          Open or create a graphic to begin
        </div>
      )}

      {/* Phone preview frame — dashboard mode only */}
      {phonePreviewActive && designMode === 'dashboard' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 375 * viewport.zoom,
            height: '100%',
            border: `2px solid var(--io-accent)`,
            borderRadius: 16 * viewport.zoom,
            boxSizing: 'border-box',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'var(--io-accent)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}>
              Phone preview — 375px
            </div>
          </div>
        </div>
      )}

      {/* Test mode banner */}
      {testMode && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(99,102,241,0.9)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 12px',
          borderRadius: 12,
          pointerEvents: 'none',
          letterSpacing: '0.05em',
        }}>
          TEST MODE
        </div>
      )}

      {/* Group edit mode breadcrumb */}
      {activeGroupId && groupBreadcrumb.length > 0 && (
        <div style={{
          position: 'absolute',
          top: RULER_SIZE + 6,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '3px 10px',
          fontSize: 11,
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {/* Root graphic name — clicking exits group edit mode entirely */}
          <button
            onClick={() => {
              setActiveGroup(null)
              setGroupBreadcrumb([])
              selectedIdsRef.current = new Set()
              useUiStore.getState().setSelectedNodes([])
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--io-text-secondary)',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            {doc?.name ?? 'Graphic'}
          </button>

          {/* Intermediate groups (all but last) — clicking goes back to that level */}
          {groupBreadcrumb.slice(0, -1).map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span style={{ color: 'var(--io-text-muted)' }}>›</span>
              <button
                onClick={() => {
                  // Go back to this breadcrumb level
                  setActiveGroup(crumb.id)
                  setGroupBreadcrumb(prev => prev.slice(0, idx + 1))
                  selectedIdsRef.current = new Set()
                  useUiStore.getState().setSelectedNodes([])
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--io-text-secondary)',
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}

          {/* Current (innermost) group — static, not clickable */}
          <span style={{ color: 'var(--io-text-muted)' }}>›</span>
          <span style={{ color: 'var(--io-text-primary)', fontWeight: 500 }}>
            {groupBreadcrumb[groupBreadcrumb.length - 1]?.name ?? 'Group'}
          </span>
        </div>
      )}

      {/* Rulers + user guides */}
      <RulersOverlay panX={panX} panY={panY} zoom={zoom} canvasW={canvasW} canvasH={canvasH} containerRef={containerRef} />

      {/* Save as Stencil dialog */}
      {stencilNodes && (
        <SaveAsStencilDialog
          nodes={stencilNodes}
          onClose={() => setStencilNodes(null)}
          onSaved={() => setStencilNodes(null)}
        />
      )}

      {/* Promote to Shape wizard */}
      {promoteNodes && (
        <PromoteToShapeWizard
          selectedNodes={promoteNodes}
          onClose={() => { setPromoteNodes(null); setPromoteSourceType(undefined); setPromoteSourceNodeId(undefined) }}
          onSaved={() => { setPromoteNodes(null); setPromoteSourceType(undefined); setPromoteSourceNodeId(undefined) }}
          sourceType={promoteSourceType}
          sourceNodeId={promoteSourceNodeId}
          onReplaceGroup={(groupNodeId, newShapeId) => {
            if (!docRef.current) return
            const groupNode = docRef.current.children.find(n => n.id === groupNodeId)
            if (!groupNode || groupNode.type !== 'group') return
            const newInstance: SymbolInstance = {
              id: crypto.randomUUID(),
              type: 'symbol_instance',
              name: groupNode.name,
              transform: { ...groupNode.transform },
              visible: groupNode.visible,
              locked: groupNode.locked,
              opacity: groupNode.opacity,
              layerId: groupNode.layerId,
              shapeRef: { shapeId: newShapeId, variant: 'default' },
              composableParts: [],
              textZoneOverrides: {},
              children: [],
              propertyOverrides: {},
            }
            executeCmd(new CompoundCommand('Promote Group to Shape', [
              new DeleteNodesCommand([groupNodeId]),
              new AddNodeCommand(newInstance, null),
            ]))
          }}
        />
      )}

      {/* Name Group / Rename Group prompt */}
      {groupPrompt && (
        <NameGroupPrompt
          defaultName={groupPrompt.renameNodeId ? (groupPrompt.currentName ?? groupPrompt.defaultName) : groupPrompt.defaultName}
          title={groupPrompt.renameNodeId ? 'Rename Group' : 'Name Group'}
          onCancel={() => setGroupPrompt(null)}
          onConfirm={(name) => {
            if (groupPrompt.renameNodeId) {
              // Rename existing group
              executeCmd(new ChangePropertyCommand(groupPrompt.renameNodeId, 'name', name, groupPrompt.currentName ?? ''))
            } else {
              // Create new group with name
              executeCmd(new GroupNodesCommand(groupPrompt.pendingIds, name))
              // Select the new group (it will be created by the command; find it after execute)
              // The historyStore already applied the command via executeCmd, so doc is updated
              const newDoc = docRef.current
              if (newDoc) {
                // The group was inserted at minIndex of the pending nodes; find it by type='group' + name
                const newGroup = newDoc.children.find(n => n.type === 'group' && n.name === name)
                if (newGroup) {
                  selectedIdsRef.current = new Set([newGroup.id])
                  useUiStore.getState().setSelectedNodes([newGroup.id])
                }
              }
            }
            setGroupPrompt(null)
          }}
        />
      )}

      {/* Bind Point modal */}
      <PointPickerModal
        open={bindingNodeId !== null}
        onClose={() => setBindingNodeId(null)}
        onSelect={(tag, _pointId) => {
          if (!bindingNodeId || !docRef.current) { setBindingNodeId(null); return }
          const node = docRef.current.children.find(n => n.id === bindingNodeId) as
            | import('../../shared/types/graphics').SymbolInstance
            | import('../../shared/types/graphics').DisplayElement
            | null
          if (node) {
            const prevBinding = (node as { stateBinding?: object; binding?: object }).stateBinding
              ?? (node as { stateBinding?: object; binding?: object }).binding
              ?? {}
            const newBinding = { ...prevBinding, pointId: tag }
            executeCmd(new ChangeBindingCommand(bindingNodeId, newBinding, prevBinding))
          }
          setBindingNodeId(null)
        }}
      />
    </div>
    </ContextMenuPrimitive.Trigger>

    {/* Radix portal-rendered context menu */}
    <DesignerContextMenuContent
      ctxNodeIdRef={ctxNodeIdRef}
      selectedIdsRef={selectedIdsRef}
      doc={doc}
      docRef={docRef}
      gridVisible={gridVisible}
      gridSize={gridSize}
      snapToGrid={snapToGrid}
      zoom={viewport.zoom}
      executeCmd={executeCmd}
      setGrid={setGrid}
      setSnap={setSnap}
      zoomTo={zoomTo}
      setStencilNodes={setStencilNodes}
      setPromoteNodes={setPromoteNodes}
      setPromoteSourceType={setPromoteSourceType}
      setPromoteSourceNodeId={setPromoteSourceNodeId}
      setBindingNodeId={setBindingNodeId}
      setActiveGroup={setActiveGroup}
      containerRef={containerRef}
      fitToCanvas={fitToCanvas}
      setGroupPrompt={setGroupPrompt}
      onPropertiesOpen={onPropertiesOpen}
      onOpenGroupInTab={onOpenGroupInTab}
    />
    </ContextMenuPrimitive.Root>
  )
}

// ---------------------------------------------------------------------------
// Rulers + User Guides overlay
// ---------------------------------------------------------------------------

interface RulersOverlayProps {
  panX: number
  panY: number
  zoom: number
  canvasW: number
  canvasH: number
  containerRef: React.RefObject<HTMLDivElement>
}

function RulersOverlay({ panX, panY, zoom, canvasW, canvasH, containerRef }: RulersOverlayProps) {
  const guides         = useUiStore(s => s.guides)
  const guidesVisible  = useUiStore(s => s.guidesVisible)
  const addGuide       = useUiStore(s => s.addGuide)
  const removeGuide    = useUiStore(s => s.removeGuide)

  function screenToCanvas(screenX: number, screenY: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (screenX - rect.left - panX) / zoom,
      y: (screenY - rect.top  - panY) / zoom,
    }
  }

  function startGuideCreate(e: React.MouseEvent, axis: 'h' | 'v') {
    e.preventDefault()
    e.stopPropagation()
    let liveId: string | null = null

    const moveFn = (me: MouseEvent) => {
      const canvasPos = screenToCanvas(me.clientX, me.clientY)
      const pos = axis === 'v' ? canvasPos.x : canvasPos.y
      if (liveId !== null) removeGuide(liveId)
      addGuide(axis, pos)
      liveId = useUiStore.getState().guides.at(-1)?.id ?? null
    }

    const upFn = () => {
      document.removeEventListener('mousemove', moveFn)
      document.removeEventListener('mouseup', upFn)
    }

    document.addEventListener('mousemove', moveFn)
    document.addEventListener('mouseup', upFn)
  }

  // Render ruler tick marks
  function renderTicks(axis: 'h' | 'v', length: number): React.ReactNode {
    const ticks: React.ReactNode[] = []
    const step = zoom >= 2 ? 10 : zoom >= 0.5 ? 50 : 100
    const offset = axis === 'h' ? panX : panY
    const start = Math.ceil(-offset / zoom / step) * step
    const end = start + length / zoom + step

    for (let pos = start; pos <= end; pos += step) {
      const screenPos = pos * zoom + offset
      if (screenPos < 0 || screenPos > length) continue
      const major = pos % (step * 5) === 0
      if (axis === 'h') {
        ticks.push(
          <g key={pos}>
            <line x1={screenPos} y1={major ? 4 : 8} x2={screenPos} y2={RULER_SIZE} stroke="var(--io-text-muted)" strokeWidth={0.5} />
            {major && <text x={screenPos + 2} y={RULER_SIZE - 3} fontSize={7} fill="var(--io-text-muted)">{pos}</text>}
          </g>
        )
      } else {
        ticks.push(
          <g key={pos}>
            <line x1={major ? 4 : 8} y1={screenPos} x2={RULER_SIZE} y2={screenPos} stroke="var(--io-text-muted)" strokeWidth={0.5} />
            {major && (
              <text x={RULER_SIZE - 3} y={screenPos - 1} fontSize={7} fill="var(--io-text-muted)"
                transform={`rotate(-90,${RULER_SIZE - 3},${screenPos - 1})`}
              >{pos}</text>
            )}
          </g>
        )
      }
    }
    return ticks
  }

  const rect = containerRef.current?.getBoundingClientRect()
  const W = rect?.width  ?? 800
  const H = rect?.height ?? 600

  return (
    <>
      {/* Horizontal ruler (top) */}
      <svg
        style={{ position: 'absolute', top: 0, left: RULER_SIZE, width: `calc(100% - ${RULER_SIZE}px)`, height: RULER_SIZE, zIndex: 10, cursor: 's-resize', pointerEvents: 'all' }}
        onMouseDown={e => startGuideCreate(e, 'h')}
      >
        <rect width="100%" height={RULER_SIZE} fill="var(--io-surface-elevated)" />
        {renderTicks('h', W)}
      </svg>

      {/* Vertical ruler (left) */}
      <svg
        style={{ position: 'absolute', top: RULER_SIZE, left: 0, width: RULER_SIZE, height: `calc(100% - ${RULER_SIZE}px)`, zIndex: 10, cursor: 'e-resize', pointerEvents: 'all' }}
        onMouseDown={e => startGuideCreate(e, 'v')}
      >
        <rect width={RULER_SIZE} height="100%" fill="var(--io-surface-elevated)" />
        {renderTicks('v', H)}
      </svg>

      {/* Corner square */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: RULER_SIZE, height: RULER_SIZE, background: 'var(--io-surface-elevated)', zIndex: 11, borderRight: '1px solid var(--io-border)', borderBottom: '1px solid var(--io-border)' }} />

      {/* User guides rendered over the canvas (screen-space) */}
      {guidesVisible && guides.map(g => {
        const screenPos = g.axis === 'v'
          ? g.position * zoom + panX + RULER_SIZE
          : g.position * zoom + panY + RULER_SIZE

        return g.axis === 'v' ? (
          <div
            key={g.id}
            title="Drag to move, drag off canvas to delete"
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
              const origId = g.id
              removeGuide(origId)
              let liveId: string | null = null
              const moveFn = (me: MouseEvent) => {
                const cp = screenToCanvas(me.clientX, me.clientY)
                if (liveId !== null) removeGuide(liveId)
                if (cp.x >= 0 && cp.x <= canvasW) {
                  addGuide('v', cp.x)
                  // The latest guide is in store — find its id
                  liveId = useUiStore.getState().guides.at(-1)?.id ?? null
                } else {
                  liveId = null
                }
              }
              const upFn = () => {
                document.removeEventListener('mousemove', moveFn)
                document.removeEventListener('mouseup', upFn)
              }
              document.addEventListener('mousemove', moveFn)
              document.addEventListener('mouseup', upFn)
            }}
            style={{
              position: 'absolute',
              top: RULER_SIZE,
              left: screenPos,
              width: 1,
              height: `calc(100% - ${RULER_SIZE}px)`,
              background: 'rgba(0,200,255,0.5)',
              cursor: 'ew-resize',
              zIndex: 9,
              pointerEvents: 'all',
            }}
          />
        ) : (
          <div
            key={g.id}
            title="Drag to move, drag off canvas to delete"
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
              const origId = g.id
              removeGuide(origId)
              let liveId: string | null = null
              const moveFn = (me: MouseEvent) => {
                const cp = screenToCanvas(me.clientX, me.clientY)
                if (liveId !== null) removeGuide(liveId)
                if (cp.y >= 0 && cp.y <= canvasH) {
                  addGuide('h', cp.y)
                  liveId = useUiStore.getState().guides.at(-1)?.id ?? null
                } else {
                  liveId = null
                }
              }
              const upFn = () => {
                document.removeEventListener('mousemove', moveFn)
                document.removeEventListener('mouseup', upFn)
              }
              document.addEventListener('mousemove', moveFn)
              document.addEventListener('mouseup', upFn)
            }}
            style={{
              position: 'absolute',
              top: screenPos,
              left: RULER_SIZE,
              height: 1,
              width: `calc(100% - ${RULER_SIZE}px)`,
              background: 'rgba(0,200,255,0.5)',
              cursor: 'ns-resize',
              zIndex: 9,
              pointerEvents: 'all',
            }}
          />
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Helper: default config for each display element type
// ---------------------------------------------------------------------------

function makeDefaultDisplayConfig(dtype: DisplayElementType): import('../../shared/types/graphics').DisplayElementConfig {
  switch (dtype) {
    case 'text_readout':
      return { displayType: 'text_readout', valueFormat: '%.2f', showBox: true, showLabel: false, labelText: '', showUnits: true, minWidth: 60 }
    case 'analog_bar':
      return { displayType: 'analog_bar', orientation: 'vertical', rangeLo: 0, rangeHi: 100, barWidth: 20, barHeight: 80, showPointer: true, showZoneLabels: true, showSetpoint: false, showNumericReadout: false, showSignalLine: false }
    case 'fill_gauge':
      return { displayType: 'fill_gauge', mode: 'standalone', fillDirection: 'up', rangeLo: 0, rangeHi: 100, showLevelLine: true, showValue: true, valueFormat: '%.0f', barWidth: 22, barHeight: 90 }
    case 'sparkline':
      return { displayType: 'sparkline', timeWindowMinutes: 30, scaleMode: 'auto', dataPoints: 14 }
    case 'alarm_indicator':
      return { displayType: 'alarm_indicator', mode: 'single' }
    case 'digital_status':
      return { displayType: 'digital_status', normalStates: [], stateLabels: {}, abnormalPriority: 3 }
  }
}

// ---------------------------------------------------------------------------
// Context menu component (Radix UI ContextMenu)
// ---------------------------------------------------------------------------

interface DesignerContextMenuContentProps {
  ctxNodeIdRef: React.MutableRefObject<NodeId | null>
  selectedIdsRef: React.MutableRefObject<Set<NodeId>>
  doc: GraphicDocument | null
  docRef: React.MutableRefObject<GraphicDocument | null>
  gridVisible: boolean
  gridSize: number
  snapToGrid: boolean
  zoom: number
  executeCmd: (cmd: SceneCommand) => void
  setGrid: (v: boolean, size?: number) => void
  setSnap: (enabled: boolean) => void
  zoomTo: (zoom: number, cx?: number, cy?: number) => void
  setStencilNodes: (nodes: SceneNode[] | null) => void
  setPromoteNodes: (nodes: SceneNode[] | null) => void
  setPromoteSourceType: (t: 'group' | undefined) => void
  setPromoteSourceNodeId: (id: string | undefined) => void
  setBindingNodeId: (id: NodeId | null) => void
  setActiveGroup: (id: NodeId | null) => void
  containerRef: React.RefObject<HTMLDivElement>
  fitToCanvas: (w: number, h: number, vw: number, vh: number) => void
  setGroupPrompt: React.Dispatch<React.SetStateAction<{
    defaultName: string
    pendingIds: NodeId[]
    title?: string
    renameNodeId?: NodeId
    currentName?: string
  } | null>>
  onPropertiesOpen?: () => void
  onOpenGroupInTab?: (groupNodeId: NodeId, groupName: string) => void
}

function DesignerContextMenuContent({
  ctxNodeIdRef,
  selectedIdsRef,
  doc,
  docRef,
  gridVisible,
  gridSize,
  snapToGrid,
  zoom,
  executeCmd,
  setGrid,
  setSnap,
  zoomTo,
  setStencilNodes,
  setPromoteNodes,
  setPromoteSourceType,
  setPromoteSourceNodeId,
  setBindingNodeId,
  setActiveGroup,
  containerRef,
  fitToCanvas,
  setGroupPrompt,
  onPropertiesOpen,
  onOpenGroupInTab,
}: DesignerContextMenuContentProps) {
  const getShape = useLibraryStore(s => s.getShape)

  // Read nodeId and selectedIds at render time (Radix calls this when menu opens)
  const nodeId = ctxNodeIdRef.current
  const selectedIds = selectedIdsRef.current
  const hasSelection = selectedIds.size > 0
  const hasDoc = !!doc

  // Recursive node finder
  function findNodeInDoc(id: NodeId): { node: SceneNode; parentNode: SceneNode | null } | null {
    if (!doc) return null
    function search(nodes: SceneNode[], parent: SceneNode | null): { node: SceneNode; parentNode: SceneNode | null } | null {
      for (const n of nodes) {
        if (n.id === id) return { node: n, parentNode: parent }
        if ('children' in n && Array.isArray(n.children)) {
          const found = search(n.children as SceneNode[], n)
          if (found) return found
        }
      }
      return null
    }
    return search(doc.children, null)
  }

  const targetNodeResult = nodeId ? findNodeInDoc(nodeId) : null
  const targetNode = targetNodeResult?.node ?? null
  const targetParentNode = targetNodeResult?.parentNode ?? null
  const symbolInstance = targetNode?.type === 'symbol_instance' ? (targetNode as SymbolInstance) : null
  const displayElementNode = targetNode?.type === 'display_element' ? (targetNode as DisplayElement) : null
  const displayElementParent = displayElementNode && targetParentNode?.type === 'symbol_instance'
    ? (targetParentNode as SymbolInstance)
    : null
  const pipeNode = targetNode?.type === 'pipe' ? (targetNode as Pipe) : null
  const groupNode = targetNode?.type === 'group' ? (targetNode as Group) : null
  const textBlockNode = targetNode?.type === 'text_block' ? (targetNode as TextBlock) : null
  const widgetNode = targetNode?.type === 'widget' ? (targetNode as WidgetNode) : null
  const imageNode = targetNode?.type === 'image' ? (targetNode as ImageNode) : null
  const stencilNode = targetNode?.type === 'stencil' ? (targetNode as Stencil) : null
  const embeddedSvgNode = targetNode?.type === 'embedded_svg' ? (targetNode as EmbeddedSvgNode) : null
  const annotationNode = targetNode?.type === 'annotation' ? (targetNode as Annotation) : null
  const shapeEntry = symbolInstance ? getShape(symbolInstance.shapeRef.shapeId) : null
  const shapeOptions = shapeEntry?.sidecar.options ?? []
  const shapeConfigurations = shapeEntry?.sidecar.configurations ?? []

  const fromIdx = nodeId ? doc?.children.findIndex(n => n.id === nodeId) ?? -1 : -1

  function buildRotateCmd(degrees: number): RotateNodesCommand | null {
    if (!doc || selectedIds.size === 0) return null
    const ids = Array.from(selectedIds)
    const prevTransforms = new Map<NodeId, Transform>()
    const newTransforms = new Map<NodeId, Transform>()
    for (const id of ids) {
      const node = doc.children.find(n => n.id === id)
      if (!node) continue
      const t = node.transform
      prevTransforms.set(id, { ...t })
      newTransforms.set(id, { ...t, rotation: ((t.rotation + degrees) % 360 + 360) % 360 })
    }
    return new RotateNodesCommand(ids, newTransforms, prevTransforms)
  }

  function buildFlipCmd(axis: 'horizontal' | 'vertical'): FlipNodesCommand | null {
    if (!doc || selectedIds.size === 0) return null
    const ids = Array.from(selectedIds)
    const prevTransforms = new Map<NodeId, Transform>()
    for (const id of ids) {
      const node = doc.children.find(n => n.id === id)
      if (node) prevTransforms.set(id, { ...node.transform })
    }
    return new FlipNodesCommand(ids, axis, prevTransforms)
  }

  const itemStyle: React.CSSProperties = {
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

  const contentStyle: React.CSSProperties = {
    background: 'var(--io-surface)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    minWidth: 180,
    overflow: 'hidden',
    fontSize: 12,
    zIndex: 1000,
  }

  const subContentStyle: React.CSSProperties = {
    ...contentStyle,
    minWidth: 160,
  }

  const sepStyle: React.CSSProperties = {
    height: 1,
    background: 'var(--io-border)',
    margin: '2px 0',
  }

  // RC-DES-1 grid size presets
  const GRID_SIZE_PRESETS = [4, 8, 10, 16, 32] as const

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content style={contentStyle}>

        {nodeId === null ? (
          // ----------------------------------------------------------------
          // RC-DES-1: Empty-canvas context menu
          // ----------------------------------------------------------------
          <>
            {/* Paste — disabled (not hidden) when clipboard is empty */}
            <ContextMenuPrimitive.Item
              style={itemStyle}
              disabled={_clipboard.length === 0}
              onSelect={() => {
                if (!docRef.current || _clipboard.length === 0) return
                const cmd = new PasteNodesCommand(_clipboard)
                const oldIds = new Set(docRef.current.children.map(n => n.id))
                executeCmd(cmd)
                const d2 = docRef.current
                if (d2) {
                  const pastedIds = d2.children.filter(n => !oldIds.has(n.id)).map(n => n.id)
                  selectedIdsRef.current = new Set(pastedIds)
                  useUiStore.getState().setSelectedNodes(pastedIds)
                }
              }}
            >Paste</ContextMenuPrimitive.Item>

            {/* Select All — disabled when doc has no children */}
            <ContextMenuPrimitive.Item
              style={itemStyle}
              disabled={!hasDoc || (doc?.children.length ?? 0) === 0}
              onSelect={() => {
                if (!doc) return
                const allIds = doc.children.filter(n => n.visible && !n.locked).map(n => n.id)
                selectedIdsRef.current = new Set(allIds)
                useUiStore.getState().setSelectedNodes(allIds)
              }}
            >Select All</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Grid submenu */}
            <ContextMenuPrimitive.Sub>
              <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                Grid
              </ContextMenuPrimitive.SubTrigger>
              <ContextMenuPrimitive.Portal>
                <ContextMenuPrimitive.SubContent style={subContentStyle}>
                  {/* Show Grid toggle */}
                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    onSelect={() => setGrid(!gridVisible, gridSize)}
                  >
                    {gridVisible ? 'Hide Grid' : 'Show Grid'}
                  </ContextMenuPrimitive.Item>

                  {/* Snap to Grid toggle */}
                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    onSelect={() => setSnap(!snapToGrid)}
                  >
                    {snapToGrid ? 'Disable Snap to Grid' : 'Enable Snap to Grid'}
                  </ContextMenuPrimitive.Item>

                  <ContextMenuPrimitive.Separator style={sepStyle} />

                  {/* Grid Size sub-submenu */}
                  <ContextMenuPrimitive.Sub>
                    <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                      Grid Size ({gridSize}px)
                    </ContextMenuPrimitive.SubTrigger>
                    <ContextMenuPrimitive.Portal>
                      <ContextMenuPrimitive.SubContent style={subContentStyle}>
                        {GRID_SIZE_PRESETS.map(size => (
                          <ContextMenuPrimitive.Item
                            key={size}
                            style={itemStyle}
                            disabled={gridSize === size}
                            onSelect={() => setGrid(gridVisible, size)}
                          >
                            {gridSize === size ? `✓ ${size}px` : `${size}px`}
                          </ContextMenuPrimitive.Item>
                        ))}
                      </ContextMenuPrimitive.SubContent>
                    </ContextMenuPrimitive.Portal>
                  </ContextMenuPrimitive.Sub>
                </ContextMenuPrimitive.SubContent>
              </ContextMenuPrimitive.Portal>
            </ContextMenuPrimitive.Sub>

            {/* Zoom submenu */}
            <ContextMenuPrimitive.Sub>
              <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                Zoom
              </ContextMenuPrimitive.SubTrigger>
              <ContextMenuPrimitive.Portal>
                <ContextMenuPrimitive.SubContent style={subContentStyle}>
                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    onSelect={() => zoomTo(zoom * 1.25)}
                  >Zoom In</ContextMenuPrimitive.Item>

                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    onSelect={() => zoomTo(zoom * 0.8)}
                  >Zoom Out</ContextMenuPrimitive.Item>

                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    onSelect={() => {
                      const d = docRef.current; const el = containerRef.current
                      if (d && el) { const r = el.getBoundingClientRect(); fitToCanvas(d.canvas.width, d.canvas.height, r.width, r.height) }
                    }}
                  >Zoom to Fit</ContextMenuPrimitive.Item>

                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    onSelect={() => zoomTo(1.0)}
                  >Zoom to 100%</ContextMenuPrimitive.Item>
                </ContextMenuPrimitive.SubContent>
              </ContextMenuPrimitive.Portal>
            </ContextMenuPrimitive.Sub>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Canvas Properties */}
            <ContextMenuPrimitive.Item
              style={itemStyle}
              onSelect={() => onPropertiesOpen?.()}
            >Properties…</ContextMenuPrimitive.Item>
          </>
        ) : (
          // ----------------------------------------------------------------
          // RC-DES-2+: Node context menu (existing content)
          // ----------------------------------------------------------------
          <>
            {/* Select All */}
            <ContextMenuPrimitive.Item
              style={itemStyle}
              disabled={!hasDoc}
              onSelect={() => {
                if (!doc) return
                const allIds = doc.children.filter(n => n.visible && !n.locked).map(n => n.id)
                selectedIdsRef.current = new Set(allIds)
                useUiStore.getState().setSelectedNodes(allIds)
              }}
            >Select All</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Edit operations */}
            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection} onSelect={() => {
              if (!doc) return
              const ids = Array.from(selectedIdsRef.current)
              _clipboard = ids.map(id => doc.children.find(n => n.id === id)).filter((n): n is SceneNode => n !== undefined)
              if (ids.length > 0) { executeCmd(new DeleteNodesCommand(ids)); selectedIdsRef.current = new Set(); useUiStore.getState().setSelectedNodes([]) }
            }}>Cut</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection} onSelect={() => {
              if (!doc) return
              _clipboard = Array.from(selectedIdsRef.current).map(id => doc.children.find(n => n.id === id)).filter((n): n is SceneNode => n !== undefined)
            }}>Copy</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={_clipboard.length === 0} onSelect={() => {
              if (!docRef.current || _clipboard.length === 0) return
              const cmd = new PasteNodesCommand(_clipboard)
              const oldIds = new Set(docRef.current.children.map(n => n.id))
              executeCmd(cmd)
              const d2 = docRef.current
              if (d2) {
                const pastedIds = d2.children.filter(n => !oldIds.has(n.id)).map(n => n.id)
                selectedIdsRef.current = new Set(pastedIds)
                useUiStore.getState().setSelectedNodes(pastedIds)
              }
            }}>Paste</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc}
              onSelect={() => executeCmd(new DuplicateNodesCommand(Array.from(selectedIds)))}>
              Duplicate
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc}
              onSelect={() => executeCmd(new DeleteNodesCommand(Array.from(selectedIds)))}>
              Delete
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Group Selection — shown for multi-selection with no locked nodes */}
            {selectedIds.size >= 2 && (() => {
              const hasLocked = doc ? Array.from(selectedIds).some(id => doc.children.find(n => n.id === id)?.locked) : false
              return !hasLocked ? (
                <>
                  <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasDoc}
                    onSelect={() => {
                      if (!doc) return
                      const ids = Array.from(selectedIds).filter(id => doc.children.find(n => n.id === id)?.type !== 'pipe')
                      if (ids.length > 1) setGroupPrompt({ defaultName: nextGroupName(doc), pendingIds: ids })
                    }}>
                    Group Selection… (Ctrl+G)
                  </ContextMenuPrimitive.Item>
                  <ContextMenuPrimitive.Separator style={sepStyle} />
                </>
              ) : null
            })()}

            {/* Group / Ungroup */}
            <ContextMenuPrimitive.Item style={itemStyle} disabled={selectedIds.size < 2 || !hasDoc}
              onSelect={() => {
                if (!doc) return
                const ids = Array.from(selectedIds).filter(id => doc.children.find(n => n.id === id)?.type !== 'pipe')
                if (ids.length > 1) setGroupPrompt({ defaultName: nextGroupName(doc), pendingIds: ids })
              }}>
              Group
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle}
              disabled={!nodeId || !doc?.children.find(n => n.id === nodeId && n.type === 'group')}
              onSelect={() => { if (nodeId) executeCmd(new UngroupCommand(nodeId)) }}>
              Ungroup
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Transform */}
            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc}
              onSelect={() => { const cmd = buildRotateCmd(90); if (cmd) executeCmd(cmd) }}>
              Rotate 90° CW
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc}
              onSelect={() => { const cmd = buildRotateCmd(-90); if (cmd) executeCmd(cmd) }}>
              Rotate 90° CCW
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc}
              onSelect={() => { const cmd = buildFlipCmd('horizontal'); if (cmd) executeCmd(cmd) }}>
              Flip Horizontal
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc}
              onSelect={() => { const cmd = buildFlipCmd('vertical'); if (cmd) executeCmd(cmd) }}>
              Flip Vertical
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Z-order */}
            <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId || !hasDoc || fromIdx < 0}
              onSelect={() => { if (nodeId && doc && fromIdx >= 0) executeCmd(new ReorderNodeCommand(doc.children.length - 1, fromIdx, null)) }}>
              Bring to Front
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle}
              disabled={!nodeId || !hasDoc || fromIdx < 0 || fromIdx >= (doc?.children.length ?? 0) - 1}
              onSelect={() => { if (nodeId && doc && fromIdx >= 0) executeCmd(new ReorderNodeCommand(Math.min(fromIdx + 1, doc.children.length - 1), fromIdx, null)) }}>
              Bring Forward
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId || !hasDoc || fromIdx <= 0}
              onSelect={() => { if (nodeId && doc && fromIdx > 0) executeCmd(new ReorderNodeCommand(Math.max(fromIdx - 1, 0), fromIdx, null)) }}>
              Send Backward
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId || !hasDoc || fromIdx < 0}
              onSelect={() => { if (nodeId && doc && fromIdx >= 0) executeCmd(new ReorderNodeCommand(0, fromIdx, null)) }}>
              Send to Back
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Lock/Unlock — RC-DES-2 base item */}
            <ContextMenuPrimitive.Item
              style={itemStyle}
              disabled={!nodeId || !targetNode}
              onSelect={() => {
                if (!nodeId || !targetNode) return
                executeCmd(new ChangePropertyCommand(nodeId, 'locked', !targetNode.locked, targetNode.locked))
              }}
            >
              {targetNode?.locked ? 'Unlock' : 'Lock'}
            </ContextMenuPrimitive.Item>

            {/* Navigation Link submenu — RC-DES-2 base item */}
            <ContextMenuPrimitive.Sub>
              <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                Navigation Link
              </ContextMenuPrimitive.SubTrigger>
              <ContextMenuPrimitive.Portal>
                <ContextMenuPrimitive.SubContent style={subContentStyle}>
                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    disabled={!nodeId}
                    onSelect={() => {
                      /* TODO: open Navigation Link dialog — set targetGraphicId or targetUrl */
                    }}
                  >
                    Set Link…
                  </ContextMenuPrimitive.Item>
                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    disabled={!targetNode?.navigationLink}
                    onSelect={() => {
                      if (!nodeId || !targetNode?.navigationLink) return
                      executeCmd(new ChangePropertyCommand(nodeId, 'navigationLink', undefined, targetNode.navigationLink))
                    }}
                  >
                    Remove Link
                  </ContextMenuPrimitive.Item>
                  <ContextMenuPrimitive.Item
                    style={itemStyle}
                    disabled={!targetNode?.navigationLink}
                    onSelect={() => {
                      /* TODO: preview navigation to linked graphic */
                    }}
                  >
                    Navigate
                  </ContextMenuPrimitive.Item>
                </ContextMenuPrimitive.SubContent>
              </ContextMenuPrimitive.Portal>
            </ContextMenuPrimitive.Sub>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* View */}
            <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
              const d = docRef.current; const el = containerRef.current
              if (d && el) { const r = el.getBoundingClientRect(); fitToCanvas(d.canvas.width, d.canvas.height, r.width, r.height) }
            }}>Zoom to Fit</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle}
              onSelect={() => setGrid(!gridVisible, gridSize)}>
              {gridVisible ? 'Hide Grid' : 'Show Grid'}
            </ContextMenuPrimitive.Item>

            {/* Properties — RC-DES-2 base item: selects node and focuses right panel */}
            <ContextMenuPrimitive.Item
              style={itemStyle}
              disabled={!nodeId}
              onSelect={() => {
                if (!nodeId) return
                selectedIdsRef.current = new Set([nodeId])
                useUiStore.getState().setSelectedNodes([nodeId])
              }}
            >
              Properties…
            </ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Separator style={sepStyle} />

            {/* Stencil / Shape promotion */}
            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc} onSelect={() => {
              if (!docRef.current) return
              const nodes = Array.from(selectedIdsRef.current).map(id => docRef.current!.children.find(n => n.id === id)).filter((n): n is SceneNode => n !== undefined)
              setStencilNodes(nodes)
            }}>Save as Stencil…</ContextMenuPrimitive.Item>

            <ContextMenuPrimitive.Item style={itemStyle} disabled={!hasSelection || !hasDoc} onSelect={() => {
              if (!docRef.current) return
              const nodes = Array.from(selectedIdsRef.current).map(id => docRef.current!.children.find(n => n.id === id)).filter((n): n is SceneNode => n !== undefined)
              setPromoteNodes(nodes)
            }}>Promote to Shape…</ContextMenuPrimitive.Item>

            {/* Symbol-instance: Switch Variant sub-menu */}
            {symbolInstance && shapeOptions.length > 0 && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                    Switch Variant
                  </ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {shapeOptions.map(opt => (
                        <ContextMenuPrimitive.Item
                          key={opt.id}
                          style={itemStyle}
                          onSelect={() => {
                            if (!nodeId || !symbolInstance) return
                            executeCmd(new ChangeShapeVariantCommand(nodeId, opt.id, symbolInstance.shapeRef.variant ?? 'default'))
                          }}
                        >
                          {symbolInstance.shapeRef.variant === opt.id ? `✓ ${opt.label}` : opt.label}
                        </ContextMenuPrimitive.Item>
                      ))}
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>
              </>
            )}

            {/* Symbol-instance: Switch Configuration sub-menu */}
            {symbolInstance && shapeConfigurations.length > 0 && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                    Switch Configuration
                  </ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {shapeConfigurations.map(cfg => (
                        <ContextMenuPrimitive.Item
                          key={cfg.id}
                          style={itemStyle}
                          onSelect={() => {
                            if (!nodeId || !symbolInstance) return
                            executeCmd(new ChangeShapeConfigurationCommand(
                              nodeId,
                              symbolInstance.shapeRef.configuration === cfg.id ? undefined : cfg.id,
                              symbolInstance.shapeRef.configuration,
                            ))
                          }}
                        >
                          {symbolInstance.shapeRef.configuration === cfg.id ? `✓ ${cfg.label}` : cfg.label}
                        </ContextMenuPrimitive.Item>
                      ))}
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>
              </>
            )}

            {/* Symbol-instance: Export Shape SVG, Bind Point, Add Display Element */}
            {symbolInstance && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle} disabled={!shapeEntry?.svg} onSelect={() => {
                  if (!shapeEntry?.svg) return
                  const blob = new Blob([shapeEntry.svg], { type: 'image/svg+xml' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `${symbolInstance.shapeRef.shapeId}.svg`
                  a.click()
                  URL.revokeObjectURL(url)
                }}>Export Shape SVG</ContextMenuPrimitive.Item>

                <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
                  onSelect={() => { if (nodeId) setBindingNodeId(nodeId) }}>
                  Bind Point…
                </ContextMenuPrimitive.Item>

                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                    Add Display Element
                  </ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {(['text_readout', 'analog_bar', 'fill_gauge', 'sparkline', 'alarm_indicator', 'digital_status'] as DisplayElementType[]).map(dtype => (
                        <ContextMenuPrimitive.Item key={dtype} style={itemStyle} disabled={!nodeId} onSelect={() => {
                          if (!nodeId) return
                          const id = crypto.randomUUID()
                          const newEl: DisplayElement = {
                            id,
                            type: 'display_element',
                            displayType: dtype,
                            transform: { position: { x: 0, y: -20 }, rotation: 0, scale: { x: 1, y: 1 }, mirror: 'none' },
                            binding: {},
                            config: makeDefaultDisplayConfig(dtype),
                            opacity: 1,
                            visible: true,
                            locked: false,
                            name: dtype,
                          }
                          executeCmd(new AddDisplayElementCommand(nodeId, newEl))
                        }}>
                          {dtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </ContextMenuPrimitive.Item>
                      ))}
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>
              </>
            )}

            {/* DisplayElement-specific items */}
            {displayElementNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                    Change Type
                  </ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {(['text_readout', 'analog_bar', 'fill_gauge', 'sparkline', 'alarm_indicator', 'digital_status'] as DisplayElementType[]).map(dtype => (
                        <ContextMenuPrimitive.Item
                          key={dtype}
                          style={itemStyle}
                          disabled={displayElementNode.displayType === dtype}
                          onSelect={() => {
                            if (!nodeId || !displayElementNode) return
                            executeCmd(new ChangeDisplayElementTypeCommand(
                              nodeId, dtype, makeDefaultDisplayConfig(dtype),
                              displayElementNode.displayType, displayElementNode.config,
                            ))
                          }}
                        >
                          {displayElementNode.displayType === dtype
                            ? `✓ ${dtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
                            : dtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </ContextMenuPrimitive.Item>
                      ))}
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>

                <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
                  onSelect={() => { if (nodeId) setBindingNodeId(nodeId) }}>
                  Bind Point…
                </ContextMenuPrimitive.Item>

                {displayElementParent && (
                  <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
                    if (!nodeId || !displayElementNode || !displayElementParent) return
                    const parentPos = displayElementParent.transform.position
                    const absX = parentPos.x + displayElementNode.transform.position.x
                    const absY = parentPos.y + displayElementNode.transform.position.y
                    executeCmd(new DetachDisplayElementCommand(
                      nodeId, displayElementParent.id, displayElementNode, { x: absX, y: absY },
                    ))
                  }}>Detach from Shape</ContextMenuPrimitive.Item>
                )}
              </>
            )}

            {/* Pipe-specific items (§6.5) */}
            {pipeNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle} onSelect={() => {
                  if (!nodeId || !pipeNode) return
                  const newMode = pipeNode.routingMode === 'auto' ? 'manual' : 'auto'
                  executeCmd(new ChangePropertyCommand(nodeId, 'routingMode', newMode, pipeNode.routingMode))
                }}>
                  {pipeNode.routingMode === 'auto' ? 'Switch to Manual Routing' : 'Switch to Auto Routing'}
                </ContextMenuPrimitive.Item>

                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>
                    Change Service Type
                  </ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {Object.keys(PIPE_SERVICE_COLORS).map(stype => (
                        <ContextMenuPrimitive.Item
                          key={stype}
                          style={itemStyle}
                          disabled={pipeNode.serviceType === stype}
                          onSelect={() => {
                            if (!nodeId || !pipeNode) return
                            executeCmd(new ChangePropertyCommand(nodeId, 'serviceType', stype, pipeNode.serviceType))
                          }}
                        >
                          {pipeNode.serviceType === stype
                            ? `✓ ${stype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
                            : stype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </ContextMenuPrimitive.Item>
                      ))}
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>

                <ContextMenuPrimitive.Item style={itemStyle}
                  disabled={!pipeNode.startConnection && !pipeNode.endConnection}
                  onSelect={() => {
                    if (!nodeId || !pipeNode) return
                    executeCmd(new CompoundCommand('Reverse Pipe Direction', [
                      new ChangePropertyCommand(nodeId, 'startConnection', pipeNode.endConnection, pipeNode.startConnection),
                      new ChangePropertyCommand(nodeId, 'endConnection', pipeNode.startConnection, pipeNode.endConnection),
                    ]))
                  }}>
                  Reverse Direction
                </ContextMenuPrimitive.Item>
              </>
            )}

            {/* Group-specific items (§6.9) */}
            {groupNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
                  onSelect={() => {
                    if (!nodeId || !groupNode) return
                    setGroupPrompt({ defaultName: '', pendingIds: [], renameNodeId: nodeId, currentName: groupNode.name ?? '' })
                  }}>
                  Rename…
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
                  onSelect={() => {
                    if (!nodeId || !doc) return
                    const children = (doc.children.find(n => n.id === nodeId) as Group | undefined)?.children ?? []
                    const childIds = children.map(c => c.id)
                    executeCmd(new UngroupCommand(nodeId))
                    selectedIdsRef.current = new Set(childIds)
                    useUiStore.getState().setSelectedNodes(childIds)
                  }}>
                  Ungroup (Ctrl+Shift+G)
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
                  onSelect={() => {
                    if (nodeId) {
                      setActiveGroup(nodeId)
                      selectedIdsRef.current = new Set()
                      useUiStore.getState().setSelectedNodes([])
                    }
                  }}>
                  Enter Group
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item
                  style={itemStyle}
                  disabled={!nodeId || !onOpenGroupInTab}
                  onSelect={() => {
                    if (!nodeId || !groupNode || !onOpenGroupInTab) return
                    onOpenGroupInTab(nodeId, groupNode.name ?? 'Group')
                  }}
                >
                  Open in Tab
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId} onSelect={() => {
                  if (!nodeId || !docRef.current) return
                  const node = docRef.current.children.find(n => n.id === nodeId)
                  if (node) {
                    setPromoteSourceType('group')
                    setPromoteSourceNodeId(nodeId)
                    setPromoteNodes([node])
                  }
                }}>
                  Promote to Shape…
                </ContextMenuPrimitive.Item>
              </>
            )}

            {/* TextBlock-specific items (§6.10 RC-DES-10) */}
            {textBlockNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle} disabled={textBlockNode.locked}
                  onSelect={() => { /* text edit mode triggered via double-click UX */ }}>
                  Edit Text
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => { /* TODO: open font picker dialog */ }}>
                  Change Font…
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>Text Alignment</ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {(['start', 'middle', 'end'] as const).map(anchor => {
                        const label = anchor === 'start' ? 'Left' : anchor === 'middle' ? 'Center' : 'Right'
                        return (
                          <ContextMenuPrimitive.Item key={anchor} style={itemStyle}
                            onSelect={() => {
                              if (!nodeId || !textBlockNode) return
                              executeCmd(new ChangePropertyCommand(nodeId, 'textAnchor', anchor, textBlockNode.textAnchor))
                            }}>
                            {textBlockNode.textAnchor === anchor ? `\u2713 ${label}` : label}
                          </ContextMenuPrimitive.Item>
                        )
                      })}
                      <ContextMenuPrimitive.Item style={{ ...itemStyle, opacity: 0.4 }} disabled>
                        Justify
                      </ContextMenuPrimitive.Item>
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>
              </>
            )}

            {/* Widget-specific items (§6.12) */}
            {widgetNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => { /* focuses right panel — already shows widget config when selected */ }}>
                  Configure Widget…
                </ContextMenuPrimitive.Item>
              </>
            )}

            {/* RC-DES-6: ImageNode-specific items */}
            {imageNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    /* TODO: trigger hidden file input to replace the image asset */
                  }}>
                  Replace Image…
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    if (!nodeId || !imageNode) return
                    executeCmd(new CompoundCommand('Reset Image Size', [
                      new ChangePropertyCommand(nodeId, 'displayWidth', imageNode.assetRef.originalWidth, imageNode.displayWidth),
                      new ChangePropertyCommand(nodeId, 'displayHeight', imageNode.assetRef.originalHeight, imageNode.displayHeight),
                    ]))
                  }}>
                  Reset to Original Size
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={{ ...itemStyle, opacity: 0.4 }} disabled>
                  Crop… (coming soon)
                </ContextMenuPrimitive.Item>
              </>
            )}

            {/* RC-DES-7: Stencil-specific items */}
            {stencilNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    if (!doc || !nodeId) return
                    setPromoteNodes([stencilNode])
                  }}>
                  Promote to Shape…
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    /* TODO: trigger file input to replace the stencil SVG */
                  }}>
                  Replace SVG…
                </ContextMenuPrimitive.Item>
              </>
            )}

            {/* RC-DES-8: EmbeddedSvg-specific items */}
            {embeddedSvgNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    /* TODO: implement ExplodeToPrimitivesCommand — parses svgContent into Primitive nodes */
                  }}>
                  Explode to Primitives
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    if (!doc) return
                    setPromoteNodes([embeddedSvgNode])
                  }}>
                  Promote to Shape…
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    if (!doc) return
                    setStencilNodes([embeddedSvgNode])
                  }}>
                  Save as Stencil…
                </ContextMenuPrimitive.Item>
              </>
            )}

            {/* RC-DES-11: Annotation-specific items */}
            {annotationNode && (
              <>
                <ContextMenuPrimitive.Separator style={sepStyle} />
                <ContextMenuPrimitive.Item style={itemStyle}
                  onSelect={() => {
                    /* TODO: open annotation edit dialog */
                  }}>
                  Edit Annotation
                </ContextMenuPrimitive.Item>
                <ContextMenuPrimitive.Sub>
                  <ContextMenuPrimitive.SubTrigger style={itemStyle}>Change Style</ContextMenuPrimitive.SubTrigger>
                  <ContextMenuPrimitive.Portal>
                    <ContextMenuPrimitive.SubContent style={subContentStyle}>
                      {(['callout', 'legend', 'border', 'title_block'] as const).map(atype => {
                        const label = atype === 'title_block' ? 'Title Block' : atype.charAt(0).toUpperCase() + atype.slice(1)
                        return (
                          <ContextMenuPrimitive.Item key={atype} style={itemStyle}
                            onSelect={() => {
                              if (!nodeId) return
                              executeCmd(new ChangePropertyCommand(nodeId, 'annotationType', atype, annotationNode.annotationType))
                            }}>
                            {annotationNode.annotationType === atype ? `\u2713 ${label}` : label}
                          </ContextMenuPrimitive.Item>
                        )
                      })}
                    </ContextMenuPrimitive.SubContent>
                  </ContextMenuPrimitive.Portal>
                </ContextMenuPrimitive.Sub>
              </>
            )}
          </>
        )}

      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )
}
