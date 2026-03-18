/**
 * DesignerCanvas.tsx
 *
 * The main SVG canvas for the Designer module.
 * Renders the scene graph as React SVG elements.
 * Handles mouse interaction for select, draw, pan, and pipe tools.
 * Dispatches io:selection-change CustomEvents so DesignerRightPanel can react.
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
import {
  useSceneStore,
  useUiStore,
  useHistoryStore,
  useLibraryStore,
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
  Transform,
  WidgetNode,
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
  ResizePrimitiveCommand,
} from '../../shared/graphics/commands'
import type { SceneCommand } from '../../shared/graphics/commands'
import { PIPE_SERVICE_COLORS } from '../../shared/types/graphics'
import { routePipe } from '../../shared/graphics/pipeRouter'
import { usePointValues } from '../../shared/hooks/usePointValues'
import type { PointValue } from '../../shared/hooks/usePointValues'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerCanvasProps {
  className?: string
  style?: React.CSSProperties
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
// Module-level clipboard (survives across renders)
// ---------------------------------------------------------------------------

let _clipboard: SceneNode[] = []

// ---------------------------------------------------------------------------
// Selection state — local module-level set (avoids uiStore extension)
// ---------------------------------------------------------------------------

function emitSelection(ids: NodeId[]) {
  document.dispatchEvent(new CustomEvent('io:selection-change', { detail: { ids } }))
}

// ---------------------------------------------------------------------------
// Node bounding box (canvas coordinates)
// ---------------------------------------------------------------------------

function getNodeBounds(node: SceneNode): { x: number; y: number; w: number; h: number } {
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
  if (node.type === 'text_block') return { x, y, w: 120, h: 20 }
  if (node.type === 'pipe') {
    const pipe = node as Pipe
    if (pipe.waypoints && pipe.waypoints.length >= 2) {
      const xs = pipe.waypoints.map(p => p.x)
      const ys = pipe.waypoints.map(p => p.y)
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) || 4, h: Math.max(...ys) - Math.min(...ys) || 4 }
    }
  }
  // Default generous bbox for symbols, display elements, etc.
  return { x, y, w: 64, h: 64 }
}

function boundsOverlap(
  b: { x: number; y: number; w: number; h: number },
  rx: number, ry: number, rw: number, rh: number
): boolean {
  return b.x < rx + rw && b.x + b.w > rx && b.y < ry + rh && b.y + b.h > ry
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

  // ── Design mode (static) placeholder ─────────────────────────────────────
  return (
    <g transform={tx} data-node-id={de.id} opacity={de.opacity}>
      <rect x={0} y={0} width={80} height={24} fill="var(--io-surface-elevated)" stroke="var(--io-border)" rx={2}/>
      <text x={4} y={16} fontSize={9} fill="var(--io-text-muted)">{de.displayType.replace(/_/g, ' ')}</text>
      {de.binding.pointId && (
        <text x={4} y={8} fontSize={7} fill="rgba(99,102,241,0.6)">⬤</text>
      )}
    </g>
  )
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
      }
      if (pipe.routingMode === 'auto' && pipe.waypoints.length >= 2) {
        const [start, ...rest] = pipe.waypoints
        const end = rest[rest.length - 1]
        const midWaypoints = rest.slice(0, -1)
        const pathD = routePipe(start, end, new Set(), midWaypoints)
        return (
          <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
            <path d={pathD} {...commonStrokeProps} />
          </g>
        )
      }
      const pts = pipe.waypoints.map(p => `${p.x},${p.y}`).join(' ')
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          <polyline points={pts} {...commonStrokeProps} />
        </g>
      )
    }

    case 'text_block': {
      const tb = node as TextBlock
      return (
        <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
          <text
            x={0}
            y={0}
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
      const svgStr = getShapeSvg(si.shapeRef.shapeId)
      if (!svgStr) {
        // Placeholder box while shape loads
        return (
          <g key={node.id} transform={tx} data-node-id={node.id} opacity={node.opacity}>
            <rect x={0} y={0} width={64} height={64} fill="none" stroke="var(--io-border)" strokeDasharray="4 2"/>
            <text x={32} y={36} textAnchor="middle" fontSize={9} fill="var(--io-text-muted)">{si.shapeRef.shapeId}</text>
          </g>
        )
      }
      return (
        <g
          key={node.id}
          transform={tx}
          data-node-id={node.id}
          opacity={node.opacity}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svgStr }}
        />
      )
    }

    case 'display_element': {
      const de = node as DisplayElement
      return <DisplayElementRenderer key={node.id} node={de} tx={tx} />
    }

    case 'image': {
      const img = node as ImageNode
      const url = `/api/v1/image-assets/${img.assetRef.hash}`
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

    case 'annotation':
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
}: {
  nodeIds: Set<NodeId>
  doc: GraphicDocument
  zoom: number
  onRotateStart?: (nodeId: NodeId, center: { x: number; y: number }, initialTransform: Transform) => void
  onResizeStart?: (nodeId: NodeId, handle: ResizeHandle, bounds: { x: number; y: number; w: number; h: number }, transform: Transform, startX: number, startY: number) => void
}) {
  if (nodeIds.size === 0) return null

  const isSingle = nodeIds.size === 1
  const showRotateHandle = isSingle && !!onRotateStart
  const showResizeHandles = isSingle && !!onResizeStart

  return (
    <g className="io-selection-overlay" style={{ pointerEvents: 'none' }}>
      {Array.from(nodeIds).map(id => {
        function findNode(nodes: SceneNode[]): SceneNode | null {
          for (const n of nodes) {
            if (n.id === id) return n
            if ('children' in n && Array.isArray(n.children)) {
              const found = findNode(n.children as SceneNode[])
              if (found) return found
            }
          }
          return null
        }
        const node = findNode(doc.children)
        if (!node) return null

        const bounds = getNodeBounds(node)
        const { x, y, w, h } = bounds
        const cx = x + w / 2
        const cy = y + h / 2
        const pad = 3 / zoom
        const rot = node.transform.rotation
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

            {/* Resize handles — 8 squares at corners and edge midpoints (single selection) */}
            {showResizeHandles && RESIZE_HANDLES.map(rh => {
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
            })}
          </g>
        )
      })}
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
// Main canvas component
// ---------------------------------------------------------------------------

export default function DesignerCanvas({ className, style }: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Store subscriptions
  const doc         = useSceneStore(s => s.doc)
  const version     = useSceneStore(s => s.version)
  const sceneExecute = useSceneStore(s => s.execute)

  const activeTool      = useUiStore(s => s.activeTool)
  const viewport        = useUiStore(s => s.viewport)
  const gridVisible     = useUiStore(s => s.gridVisible)
  const gridSize        = useUiStore(s => s.gridSize)
  const snapToGrid      = useUiStore(s => s.snapToGrid)
  const setViewport     = useUiStore(s => s.setViewport)
  const zoomTo          = useUiStore(s => s.zoomTo)
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

  // Smart alignment guides — cleared on drag end
  const [alignGuides, setAlignGuides] = useState<Array<{ axis: 'h' | 'v'; pos: number }>>([])

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number; y: number; nodeId: NodeId | null
  } | null>(null)

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
  ) => {
    const inter = interactionRef.current
    inter.type = 'resize'
    inter.resizeNodeId = nodeId
    inter.resizeHandle = handle
    inter.resizeOrigBounds = { ...bounds }
    inter.resizeOrigTransform = { ...initialTransform }
    inter.startCanvasX = startX
    inter.startCanvasY = startY
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

  function snap(v: number): number {
    return snapToGridValue(v, gridSize, snapToGrid)
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
        // Simple bounding box check using transform position
        const tx = n.transform.position.x
        const ty = n.transform.position.y
        // Use a generous 64x64 bounding box as placeholder
        if (canvasX >= tx && canvasX <= tx + 64 && canvasY >= ty && canvasY <= ty + 64) {
          return n.id
        }
        if ('children' in n && Array.isArray(n.children)) {
          const found = search(n.children as SceneNode[])
          if (found) return found
        }
      }
      return null
    }
    return search(d.children)
  }

  // -------------------------------------------------------------------------
  // Mouse events
  // -------------------------------------------------------------------------

  // Track interaction state in refs to avoid stale closures
  const interactionRef = useRef<{
    type: 'none' | 'drag' | 'draw' | 'pan' | 'pipe' | 'marquee' | 'rotate' | 'resize'
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
      const hitId = hitTest(cx, cy)
      if (hitId) {
        // Select node
        const newSelection = e.shiftKey
          ? new Set([...selectedIdsRef.current, hitId])
          : new Set([hitId])
        selectedIdsRef.current = newSelection
        emitSelection(Array.from(newSelection))

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
          emitSelection([])
        }
        inter.type = 'marquee'
        setMarquee({ startX: cx, startY: cy, endX: cx, endY: cy })
      }
      return
    }

    if (tool === 'pipe') {
      if (!pipeDrawState) {
        setPipeDrawState({ waypoints: [{ x: snap(cx), y: snap(cy) }], cursorX: snap(cx), cursorY: snap(cy) })
      } else {
        addPipeWaypoint(snap(cx), snap(cy))
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
      emitSelection([newNode.id])
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
  }, [snap, pipeDrawState, setPipeDrawState, addPipeWaypoint, setMarquee, startDrag, setDrawPreview])

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
      void dx; void dy // Applied on mouseup
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
  }, [drawPreview, pipeDrawState, snap, setAlignGuides, setDrawPreview, setMarquee, setPipeDrawState, setViewport])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const inter = interactionRef.current
    const rect = getRect()
    if (!rect) return
    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const d = docRef.current

    if (inter.type === 'drag' && d) {
      const dx = cx - inter.startCanvasX
      const dy = cy - inter.startCanvasY
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

        // Find the node and build new geometry
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
        if (target?.type === 'primitive') {
          const prim = target as Primitive
          const prevT = inter.resizeOrigTransform
          const newT: Transform = { ...prevT, position: { x: nx, y: ny } }
          let newGeom: Primitive['geometry']
          if (prim.geometry.type === 'rect') {
            newGeom = { ...prim.geometry, width: nw, height: nh }
          } else if (prim.geometry.type === 'ellipse') {
            newGeom = { ...prim.geometry, rx: nw / 2, ry: nh / 2 }
          } else if (prim.geometry.type === 'circle') {
            newGeom = { ...prim.geometry, r: Math.min(nw, nh) / 2 }
          } else {
            newGeom = prim.geometry
          }
          executeCmd(new ResizePrimitiveCommand(
            inter.resizeNodeId,
            newT, newGeom,
            prevT, prim.geometry,
          ))
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
        emitSelection([prim.id])
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
          // Collect all root-level nodes whose bounds overlap the marquee rect
          const hit: NodeId[] = []
          for (const node of d.children) {
            if (!node.visible || node.locked) continue
            if (boundsOverlap(getNodeBounds(node), rx, ry, rw, rh)) hit.push(node.id)
          }
          if (hit.length > 0) {
            const newSel = e.shiftKey
              ? new Set([...selectedIdsRef.current, ...hit])
              : new Set(hit)
            selectedIdsRef.current = newSel
            emitSelection(Array.from(newSel))
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

    inter.type = 'none'
  }, [drawPreview, snap, endDrag, setAlignGuides, setDrawPreview, setMarquee, setTool])

  // -------------------------------------------------------------------------
  // Double-click — commit pipe draw
  // -------------------------------------------------------------------------

  const handleDoubleClick = useCallback((_e: React.MouseEvent) => {
    const d = docRef.current
    if (!d) return

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
      emitSelection([pipe.id])
      setPipeDrawState(null)
      setTool('select')
    }
  }, [pipeDrawState, setPipeDrawState, setTool])

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
        emitSelection(allIds)
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
        emitSelection([])
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
          emitSelection(pastedIds)
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

    // Ctrl+G — group; Ctrl+Shift+G — ungroup
    if (ctrl && e.key === 'g' && !e.shiftKey) {
      e.preventDefault()
      const ids = Array.from(selectedIdsRef.current)
      if (ids.length > 1 && docRef.current) executeCmd(new GroupNodesCommand(ids))
      return
    }
    if (ctrl && e.key === 'G' && e.shiftKey) {
      e.preventDefault()
      // Ungroup all selected group nodes
      for (const id of Array.from(selectedIdsRef.current)) {
        const d = docRef.current
        if (!d) break
        const node = d.children.find(n => n.id === id)
        if (node?.type === 'group') executeCmd(new UngroupCommand(id))
      }
      selectedIdsRef.current = new Set()
      emitSelection([])
      return
    }

    if (isInput) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ids = Array.from(selectedIdsRef.current)
      if (ids.length > 0 && docRef.current) {
        executeCmd(new DeleteNodesCommand(ids))
        selectedIdsRef.current = new Set()
        emitSelection([])
      }
      return
    }

    if (e.key === 'Escape') {
      selectedIdsRef.current = new Set()
      emitSelection([])
      setPipeDrawState(null)
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

    if (!ctrl) {
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break
        case 'r': setTool('rect'); break
        case 'e': setTool('ellipse'); break
        case 't': setTool('text'); break
        case 'h': setTool('pan'); break
        case 'p': setTool('pen'); break
        case 'l': setTool('line'); break
        case 'i': setTool('pipe'); break
      }
    }
  }, [historyUndo, historyRedo, setTool, setPipeDrawState, setDrawPreview, setMarquee])

  // -------------------------------------------------------------------------
  // Right-click context menu
  // -------------------------------------------------------------------------

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect = getRect()
    if (!rect) return
    const vp = viewportRef.current
    const cx = (e.clientX - rect.left - vp.panX) / vp.zoom
    const cy = (e.clientY - rect.top  - vp.panY) / vp.zoom
    const hitId = hitTest(cx, cy)
    if (hitId && !selectedIdsRef.current.has(hitId)) {
      selectedIdsRef.current = new Set([hitId])
      emitSelection([hitId])
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: hitId })
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
      executeCmd(new AddNodeCommand(si, null))
      selectedIdsRef.current = new Set([si.id])
      emitSelection([si.id])

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
      executeCmd(new AddNodeCommand(node, null))
      selectedIdsRef.current = new Set([node.id])
      emitSelection([node.id])
    }

    document.addEventListener('io:stencil-drop', onStencilDrop)
    return () => document.removeEventListener('io:stencil-drop', onStencilDrop)
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
    text: 'text',
    pipe: 'crosshair',
    image: 'copy',
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const { panX, panY, zoom } = viewport
  const canvasW = doc?.canvas.width  ?? 1920
  const canvasH = doc?.canvas.height ?? 1080
  const bgColor = doc?.canvas.backgroundColor ?? '#09090b'

  // Stable shape SVG getter that re-evaluates when the library cache changes (version triggers re-render)
  const getShapeSvgMemo = useCallback((id: string) => getShapeSvg(id), [getShapeSvg])
  void version // consumed to trigger re-render when doc changes

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={0}
      onMouseDown={(e) => { if (ctxMenu) setCtxMenu(null); handleMouseDown(e) }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
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
          <TestModeContext.Provider value={testModeValues}>
            {doc?.children.map(node => (
              <RenderNode
                key={node.id}
                node={node}
                getShapeSvg={getShapeSvgMemo}
                selectedIds={selectedIdsRef.current}
              />
            ))}
          </TestModeContext.Provider>

          {/* Selection overlay */}
          {doc && (
            <SelectionOverlay
              nodeIds={selectedIdsRef.current}
              doc={doc}
              zoom={zoom}
              onRotateStart={startRotate}
              onResizeStart={startResize}
            />
          )}

          {/* Lock indicators */}
          {doc && <LockOverlay doc={doc} zoom={zoom} />}

          {/* Smart alignment guides */}
          <AlignmentGuidesOverlay guides={alignGuides} canvasW={canvasW} canvasH={canvasH} zoom={zoom} />

          {/* Draw preview */}
          <DrawPreviewOverlay zoom={zoom} />

          {/* Marquee */}
          <MarqueeOverlay zoom={zoom} />

          {/* Pipe draw preview */}
          <PipeDrawOverlay zoom={zoom} />
        </g>
      </svg>

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

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          nodeId={ctxMenu.nodeId}
          selectedIds={selectedIdsRef.current}
          doc={doc}
          onClose={() => setCtxMenu(null)}
          onExec={(cmd) => { executeCmd(cmd); setCtxMenu(null) }}
          onSelectAll={() => {
            if (!doc) return
            const allIds = doc.children.filter(n => n.visible && !n.locked).map(n => n.id)
            selectedIdsRef.current = new Set(allIds)
            emitSelection(allIds)
            setCtxMenu(null)
          }}
          onCopy={() => {
            if (!doc) return
            _clipboard = Array.from(selectedIdsRef.current)
              .map(id => doc.children.find(n => n.id === id))
              .filter((n): n is SceneNode => n !== undefined)
            setCtxMenu(null)
          }}
          onPaste={() => {
            if (!docRef.current || _clipboard.length === 0) return
            const cmd = new PasteNodesCommand(_clipboard)
            const oldIds = new Set(docRef.current.children.map(n => n.id))
            executeCmd(cmd)
            const d2 = docRef.current
            if (d2) {
              const pastedIds = d2.children.filter(n => !oldIds.has(n.id)).map(n => n.id)
              selectedIdsRef.current = new Set(pastedIds)
              emitSelection(pastedIds)
            }
            setCtxMenu(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Context menu component
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  x: number
  y: number
  nodeId: NodeId | null
  selectedIds: Set<NodeId>
  doc: GraphicDocument | null
  onClose: () => void
  onExec: (cmd: import('../../shared/graphics/commands').SceneCommand) => void
  onSelectAll: () => void
  onCopy: () => void
  onPaste: () => void
}

function ContextMenu({ x, y, nodeId, selectedIds, doc, onClose, onExec, onSelectAll, onCopy, onPaste }: ContextMenuProps) {
  const hasSelection = selectedIds.size > 0
  const hasDoc = !!doc

  const menuItems: Array<{ label: string; disabled: boolean; onClick: () => void } | 'sep'> = [
    { label: 'Select All', disabled: !hasDoc, onClick: onSelectAll },
    'sep',
    { label: 'Copy', disabled: !hasSelection, onClick: onCopy },
    { label: 'Paste', disabled: _clipboard.length === 0, onClick: onPaste },
    'sep',
    {
      label: 'Duplicate',
      disabled: !hasSelection || !hasDoc,
      onClick: () => onExec(new DuplicateNodesCommand(Array.from(selectedIds))),
    },
    {
      label: 'Delete',
      disabled: !hasSelection || !hasDoc,
      onClick: () => onExec(new DeleteNodesCommand(Array.from(selectedIds))),
    },
    'sep',
    {
      label: 'Group',
      disabled: selectedIds.size < 2 || !hasDoc,
      onClick: () => onExec(new GroupNodesCommand(Array.from(selectedIds))),
    },
    {
      label: 'Ungroup',
      disabled: !nodeId || !doc?.children.find(n => n.id === nodeId && n.type === 'group'),
      onClick: () => { if (nodeId) onExec(new UngroupCommand(nodeId)) },
    },
    'sep',
    {
      label: 'Bring to Front',
      disabled: !nodeId || !hasDoc,
      onClick: () => { if (nodeId && doc) onExec(new ReorderNodeCommand(doc.children.length - 1, doc.children.findIndex(n => n.id === nodeId), null)) },
    },
    {
      label: 'Send to Back',
      disabled: !nodeId || !hasDoc,
      onClick: () => { if (nodeId && doc) onExec(new ReorderNodeCommand(0, doc.children.findIndex(n => n.id === nodeId), null)) },
    },
  ]

  return (
    <>
      {/* Click-away overlay */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onMouseDown={onClose}
        onContextMenu={e => { e.preventDefault(); onClose() }}
      />
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 1000,
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          minWidth: 160,
          overflow: 'hidden',
          fontSize: 12,
        }}
      >
        {menuItems.map((item, i) =>
          item === 'sep' ? (
            <div key={i} style={{ height: 1, background: 'var(--io-border)', margin: '2px 0' }} />
          ) : (
            <button
              key={i}
              onClick={item.disabled ? undefined : item.onClick}
              disabled={item.disabled}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 14px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: item.disabled ? 'var(--io-text-muted)' : 'var(--io-text-primary)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                fontSize: 12,
                opacity: item.disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'var(--io-surface-elevated)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  )
}
