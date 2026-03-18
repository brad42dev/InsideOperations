import { useEffect, useRef, useCallback, useState } from 'react'
import type {
  GraphicDocument, SceneNode, SymbolInstance, DisplayElement, Primitive,
  Pipe, TextBlock, Group, Annotation, ImageNode, EmbeddedSvgNode,
  WidgetNode, ViewportState, LayerDefinition,
  TextReadoutConfig, AnalogBarConfig, FillGaugeConfig, DigitalStatusConfig,
  NumericIndicatorConfig,
} from '../types/graphics'
import { PIPE_SERVICE_COLORS, canvasToScreen } from '../types/graphics'
import { fetchShapes } from './shapeCache'
import { graphicsApi } from '../../api/graphics'
import './alarmFlash.css'
import './operationalState.css'

// ---- Point value types received from WebSocket ----

export interface PointValue {
  pointId: string
  value: string | number | null
  units?: string
  tag?: string
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  unacknowledged?: boolean
  quality?: 'good' | 'bad' | 'uncertain'
}

// ---- Props ----

export interface SceneRendererProps {
  /** The graphic document to render */
  document: GraphicDocument
  /** Viewport state for pan/zoom */
  viewport?: ViewportState
  /** Live point values keyed by pointId */
  pointValues?: Map<string, PointValue>
  /** Called when a node with a navigationLink is clicked */
  onNavigate?: (targetGraphicId: string, targetUrl?: string) => void
  /** Designer mode — show selection handles, grid, locked indicators */
  designerMode?: boolean
  /** Selected node IDs (designer mode only) */
  selectedNodeIds?: Set<string>
  /** Callback when a node is clicked (designer mode) */
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void
  className?: string
  style?: React.CSSProperties
}

// ---- Main renderer ----

export function SceneRenderer({
  document,
  viewport,
  pointValues = new Map(),
  onNavigate,
  designerMode = false,
  selectedNodeIds = new Set(),
  onNodeClick,
  className,
  style,
}: SceneRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [shapeMap, setShapeMap] = useState<Map<string, { svg: string; sidecar: Record<string, unknown> }>>(new Map())

  const { canvas, layers, children } = document
  const vp = viewport ?? {
    panX: 0, panY: 0, zoom: 1,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    screenWidth: canvas.width,
    screenHeight: canvas.height,
  }

  // Build layer lookup
  const layerMap = new Map<string, LayerDefinition>()
  for (const l of layers) layerMap.set(l.id, l)

  // Check if node is visible (respects layer visibility)
  function isNodeVisible(node: SceneNode): boolean {
    if (!node.visible) return false
    if (node.layerId) {
      const layer = layerMap.get(node.layerId)
      if (layer && !layer.visible) return false
    }
    return true
  }

  // Collect all shapeIds needed
  const collectShapeIds = useCallback((nodes: SceneNode[]): string[] => {
    const ids: string[] = []
    function walk(n: SceneNode) {
      if (n.type === 'symbol_instance') {
        const si = n as SymbolInstance
        ids.push(si.shapeRef.shapeId)
        if (si.composableParts) {
          for (const p of si.composableParts) ids.push(p.partId)
        }
      }
      if ('children' in n && Array.isArray(n.children)) {
        for (const c of n.children) walk(c as SceneNode)
      }
    }
    for (const n of nodes) walk(n)
    return [...new Set(ids)]
  }, [])

  // Fetch shapes on mount / document change
  useEffect(() => {
    const shapeIds = collectShapeIds(children)
    if (shapeIds.length === 0) return
    fetchShapes(shapeIds, async (ids) => {
      const result = await graphicsApi.batchShapes(ids)
      if (result.success && result.data) return result.data as Record<string, { svg: string; sidecar: Record<string, unknown> }>
      return {}
    }).then(setShapeMap).catch(console.error)
  }, [document.id, children, collectShapeIds])

  // SVG transform for viewport pan/zoom
  const svgTransform = `translate(${-vp.panX * vp.zoom}, ${-vp.panY * vp.zoom}) scale(${vp.zoom})`

  // ---- Render functions ----

  function handleNodeClick(node: SceneNode, e: React.MouseEvent) {
    if (node.navigationLink) {
      if (node.navigationLink.targetGraphicId) {
        onNavigate?.(node.navigationLink.targetGraphicId, node.navigationLink.targetUrl)
      } else if (node.navigationLink.targetUrl) {
        window.open(node.navigationLink.targetUrl, '_blank', 'noopener')
      }
    }
    onNodeClick?.(node.id, e)
  }

  function getTransformAttr(node: SceneNode): string {
    const { position, rotation, scale, mirror } = node.transform
    const parts: string[] = []
    parts.push(`translate(${position.x},${position.y})`)
    if (rotation !== 0) parts.push(`rotate(${rotation})`)
    if (scale.x !== 1 || scale.y !== 1) parts.push(`scale(${scale.x},${scale.y})`)
    if (mirror === 'horizontal') parts.push('scale(-1,1)')
    else if (mirror === 'vertical') parts.push('scale(1,-1)')
    else if (mirror === 'both') parts.push('scale(-1,-1)')
    return parts.join(' ')
  }

  function renderPrimitive(node: Primitive): React.ReactElement | null {
    const { geometry, style } = node
    const styleProps = {
      fill: style.fill,
      fillOpacity: style.fillOpacity,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      strokeDasharray: style.strokeDasharray,
      strokeLinecap: style.strokeLinecap,
      strokeLinejoin: style.strokeLinejoin,
    }
    let shape: React.ReactElement | null = null
    switch (geometry.type) {
      case 'rect':
        shape = <rect width={geometry.width} height={geometry.height} rx={geometry.rx} ry={geometry.ry} {...styleProps} />
        break
      case 'circle':
        shape = <circle r={geometry.r} {...styleProps} />
        break
      case 'ellipse':
        shape = <ellipse rx={geometry.rx} ry={geometry.ry} {...styleProps} />
        break
      case 'line':
        shape = <line x1={geometry.x1} y1={geometry.y1} x2={geometry.x2} y2={geometry.y2} {...styleProps} />
        break
      case 'polyline':
        shape = <polyline points={geometry.points.map((p) => `${p.x},${p.y}`).join(' ')} {...styleProps} />
        break
      case 'polygon':
        shape = <polygon points={geometry.points.map((p) => `${p.x},${p.y}`).join(' ')} {...styleProps} />
        break
      case 'path':
        shape = <path d={geometry.d} {...styleProps} />
        break
    }
    if (!shape) return null
    return (
      <g
        key={node.id}
        transform={getTransformAttr(node)}
        opacity={node.opacity}
        data-node-id={node.id}
        onClick={(e) => handleNodeClick(node, e)}
        style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
      >
        {shape}
      </g>
    )
  }

  function renderPipe(node: Pipe): React.ReactElement {
    const color = PIPE_SERVICE_COLORS[node.serviceType] ?? '#6B8CAE'
    return (
      <g key={node.id} data-node-id={node.id} opacity={node.opacity}>
        <path
          d={node.pathData}
          stroke={color}
          strokeWidth={node.strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {node.label && (
          <text fill="#71717A" fontSize={9} fontFamily="Inter">
            <textPath href={`#pipe-path-${node.id}`} startOffset="50%" textAnchor="middle">
              {node.label}
            </textPath>
          </text>
        )}
      </g>
    )
  }

  function renderTextBlock(node: TextBlock): React.ReactElement {
    const { content, fontFamily, fontSize, fontWeight, fontStyle, textAnchor, fill } = node
    return (
      <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id}>
        {node.background && (
          <rect
            x={0} y={0} width={200} height={fontSize + node.background.padding * 2}
            fill={node.background.fill}
            stroke={node.background.stroke}
            strokeWidth={node.background.strokeWidth}
            rx={node.background.borderRadius}
          />
        )}
        <text
          fontFamily={fontFamily}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontStyle={fontStyle}
          textAnchor={textAnchor}
          fill={fill}
        >
          {content}
        </text>
      </g>
    )
  }

  function renderImage(node: ImageNode): React.ReactElement {
    const url = graphicsApi.imageUrl(node.assetRef.hash)
    return (
      <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id}>
        <image
          href={url}
          width={node.displayWidth}
          height={node.displayHeight}
          preserveAspectRatio={node.preserveAspectRatio ? 'xMidYMid meet' : 'none'}
          imageRendering={node.imageRendering}
        />
      </g>
    )
  }

  function renderEmbeddedSvg(node: EmbeddedSvgNode): React.ReactElement {
    return (
      <g
        key={node.id}
        transform={getTransformAttr(node)}
        opacity={node.opacity}
        data-node-id={node.id}
        dangerouslySetInnerHTML={{ __html: node.svgContent }}
      />
    )
  }

  function renderDisplayElement(node: DisplayElement): React.ReactElement | null {
    const pv = node.binding.pointId ? pointValues.get(node.binding.pointId) : undefined
    const { x, y } = node.transform.position

    switch (node.displayType) {
      case 'text_readout': {
        const cfg = node.config as TextReadoutConfig
        const alarmPriority = (pv?.alarmPriority ?? null) as 1 | 2 | 3 | 4 | 5 | null
        const unacked = pv?.unacknowledged ?? false
        const valueStr = formatValue(pv?.value ?? null, cfg.valueFormat)
        const unitStr = cfg.showUnits && pv?.units ? ` ${pv.units}` : ''
        const label = cfg.showLabel ? (cfg.labelText ?? pv?.tag ?? '') : ''
        const alarmColor = alarmPriority ? ALARM_COLORS[alarmPriority] : null
        const boxFill = alarmColor ? `${alarmColor}33` : '#27272A'
        const boxStroke = alarmColor ?? '#3F3F46'
        const strokeWidth = alarmColor ? 2 : 1
        const valueColor = alarmColor ? '#F9FAFB' : '#A1A1AA'
        const charWidth = 7
        const w = Math.max(cfg.minWidth, (valueStr.length + unitStr.length) * charWidth + 10)
        const h = cfg.showLabel && label ? 36 : 24
        const valueY = cfg.showLabel && label ? h * 0.65 : h / 2
        const flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''
        return (
          <g key={node.id} className={`io-display-element ${flashClass}`} transform={`translate(${x},${y})`} opacity={node.opacity} data-node-id={node.id} data-point-id={node.binding.pointId}>
            {cfg.showBox && <rect x={0} y={0} width={w} height={h} rx={2} fill={boxFill} stroke={boxStroke} strokeWidth={strokeWidth} />}
            {cfg.showLabel && label && <text x={w/2} y={6} textAnchor="middle" dominantBaseline="hanging" fontFamily="Inter" fontSize={8} fill="#71717A">{label}</text>}
            <text x={w/2} y={valueY} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={11} fill={valueColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {valueStr}{unitStr && <tspan fontFamily="Inter" fontSize={9} fill="#71717A">{unitStr}</tspan>}
            </text>
          </g>
        )
      }

      case 'alarm_indicator': {
        const active = !!pv?.alarmPriority
        if (!active && !designerMode) return null
        const priority = (pv?.alarmPriority ?? 1) as 1 | 2 | 3 | 4 | 5
        const unacked = pv?.unacknowledged ?? false
        const isGhost = !active && designerMode
        const color = isGhost ? '#808080' : (ALARM_COLORS[priority] ?? '#EF4444')
        const flashClass = unacked && !isGhost ? `io-alarm-flash-${ALARM_PRIORITY_NAMES[priority]}` : ''
        const label = isGhost ? '—' : String(priority)
        const shapeEl = renderAlarmShape(priority, isGhost, color)
        return (
          <g key={node.id} className={`io-alarm-indicator ${flashClass}`} data-node-id={node.id} opacity={isGhost ? 0.25 : node.opacity} transform={`translate(${x},${y})`}>
            {shapeEl}
            <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={9} fontWeight={600} fill={color}>{label}</text>
          </g>
        )
      }

      case 'digital_status': {
        const cfg = node.config as DigitalStatusConfig
        const rawVal = pv?.value !== undefined && pv.value !== null ? String(pv.value) : null
        const label = rawVal !== null ? (cfg.stateLabels[rawVal] ?? rawVal) : '---'
        const isNormal = rawVal === null || cfg.normalStates.includes(rawVal)
        const fill = isNormal ? '#3F3F46' : (ALARM_COLORS[cfg.abnormalPriority] ?? '#EF4444')
        const textColor = isNormal ? '#A1A1AA' : '#F9FAFB'
        const w = Math.max(40, label.length * 7.5 + 12)
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} opacity={node.opacity} transform={`translate(${x},${y})`}>
            <rect x={0} y={0} width={w} height={18} rx={2} fill={fill} />
            <text x={w/2} y={9} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={9} fill={textColor}>{label}</text>
          </g>
        )
      }

      case 'analog_bar': {
        const cfg = node.config as AnalogBarConfig
        const value = typeof pv?.value === 'number' ? pv.value : null
        const alarmPriority = pv?.alarmPriority as (1|2|3|4|5) | null | undefined
        const range = cfg.rangeHi - cfg.rangeLo || 1
        const pct = value !== null ? Math.max(0, Math.min(1, (value - cfg.rangeLo) / range)) : 0
        const { barWidth: bw, barHeight: bh, thresholds } = cfg
        const hhH = thresholds?.hh !== undefined ? ((cfg.rangeHi - thresholds.hh) / range) * bh : bh * 0.1
        const hH = thresholds?.h !== undefined && thresholds?.hh !== undefined ? ((thresholds.hh - thresholds.h) / range) * bh : bh * 0.18
        const llH = thresholds?.ll !== undefined ? ((thresholds.ll - cfg.rangeLo) / range) * bh : bh * 0.1
        const lH = thresholds?.l !== undefined && thresholds?.ll !== undefined ? ((thresholds.l - thresholds.ll) / range) * bh : bh * 0.18
        const normalH = bh - hhH - hH - llH - lH
        const pointerY = (1 - pct) * bh
        const zones = [
          { fill: '#5C3A3A', y: 0, h: hhH, label: 'HH' },
          { fill: '#5C4A32', y: hhH, h: hH, label: 'H' },
          { fill: '#404048', y: hhH + hH, h: normalH, label: '' },
          { fill: '#32445C', y: hhH + hH + normalH, h: lH, label: 'L' },
          { fill: '#2E3A5C', y: hhH + hH + normalH + lH, h: llH, label: 'LL' },
        ]
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} opacity={node.opacity} transform={`translate(${x},${y})`}>
            <rect x={0} y={0} width={bw} height={bh} fill="#27272A" stroke="#52525B" strokeWidth={0.5} />
            {zones.map((z, i) => <rect key={i} x={1} y={z.y} width={bw-2} height={Math.max(0,z.h)} fill={z.fill} stroke="#52525B" strokeWidth={0.5} />)}
            {cfg.showZoneLabels && zones.filter(z => z.label).map((z, i) => (
              <text key={i} x={-3} y={z.y + z.h/2} textAnchor="end" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={7} fill="#71717A">{z.label}</text>
            ))}
            {cfg.showPointer && value !== null && <>
              <polygon points={`${bw},${pointerY-3} ${bw+6},${pointerY} ${bw},${pointerY+3}`} fill={alarmPriority ? (ALARM_COLORS[alarmPriority] ?? '#A1A1AA') : '#A1A1AA'} />
              <line x1={1} y1={pointerY} x2={bw-1} y2={pointerY} stroke={alarmPriority ? (ALARM_COLORS[alarmPriority] ?? '#A1A1AA') : '#A1A1AA'} strokeWidth={1} />
            </>}
          </g>
        )
      }

      case 'sparkline': {
        const W = 110, H = 18
        const alarmPriority = pv?.alarmPriority as number | null | undefined
        const strokeColor = alarmPriority ? (ALARM_COLORS[alarmPriority] ?? '#A1A1AA') : '#A1A1AA'
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} opacity={node.opacity} transform={`translate(${x},${y})`}>
            <rect x={0} y={0} width={W} height={H} rx={1} fill="#27272A" />
            <line x1={3} y1={H/2} x2={W-3} y2={H/2} stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" />
          </g>
        )
      }

      case 'fill_gauge': {
        const cfg = node.config as FillGaugeConfig
        const value = typeof pv?.value === 'number' ? pv.value : null
        const alarmPriority = pv?.alarmPriority as number | null | undefined
        const range = cfg.rangeHi - cfg.rangeLo || 1
        const pct = value !== null ? Math.max(0, Math.min(1, (value - cfg.rangeLo) / range)) : 0
        const bw = cfg.barWidth ?? 22
        const bh = cfg.barHeight ?? 90
        const fillColor = alarmPriority ? `${ALARM_COLORS[alarmPriority]}4D` : 'rgba(71,85,105,0.6)'
        const fillH = pct * (bh - 2)
        const fillY = bh - 1 - fillH
        const fmtPct = `${(pct * 100).toFixed(0)}%`
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} opacity={node.opacity} transform={`translate(${x},${y})`}>
            <rect x={0} y={0} width={bw} height={bh} rx={2} fill="none" stroke="#52525B" strokeWidth={0.5} />
            <rect x={1} y={fillY} width={bw-2} height={fillH} rx={1} fill={fillColor} />
            {cfg.showLevelLine && fillH > 0 && <line x1={1} y1={fillY} x2={bw-1} y2={fillY} stroke="#64748B" strokeWidth={1} strokeDasharray="5 3" />}
            {cfg.showValue && <text x={bw/2} y={fillY + fillH/2} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={10} fill="#A1A1AA">{fmtPct}</text>}
          </g>
        )
      }

      case 'numeric_indicator': {
        const cfg = node.config as NumericIndicatorConfig
        const raw = pv?.value ?? null
        const priority = pv?.alarmPriority as (1|2|3|4|5) | null | undefined
        const unacked = pv?.unacknowledged ?? false
        let displayValue = '---'
        if (raw !== null) {
          const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
          displayValue = isNaN(num) ? String(raw) : num.toFixed(cfg.decimalPlaces)
        }
        const alarmColor = priority ? ALARM_COLORS[priority] : null
        const valueColor = alarmColor ?? '#F9FAFB'
        const flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''
        const label = cfg.showLabel ? (cfg.labelText ?? pv?.tag ?? '') : null
        const unitStr = cfg.showUnit && pv?.units ? pv.units : null
        const labelH = label ? 14 : 0
        const unitH = unitStr ? 14 : 0
        const cy = labelH + cfg.fontSize / 2 + 3
        return (
          <g key={node.id} className={`io-display-element ${flashClass}`} data-node-id={node.id} opacity={node.opacity} transform={`translate(${x},${y})`}>
            {label && <text x={cfg.width/2} y={10} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter" fontSize={9} fill="#71717A" style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</text>}
            <text x={cfg.width/2} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={cfg.fontSize} fontWeight="600" fill={valueColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{displayValue}</text>
            {unitStr && <text x={cfg.width/2} y={labelH + cfg.fontSize + unitH/2 + 3} textAnchor="middle" dominantBaseline="middle" fontFamily="Inter" fontSize={10} fill="#71717A">{unitStr}</text>}
          </g>
        )
      }

      default:
        return null
    }
  }

  function renderSymbolInstance(node: SymbolInstance): React.ReactElement {
    const shapeData = shapeMap.get(node.shapeRef.shapeId)
    const svgContent = shapeData?.svg ?? ''
    // Derive operational state CSS class from stateBinding point value
    let stateClass = ''
    if (node.stateBinding?.pointId) {
      const statePv = pointValues.get(node.stateBinding.pointId)
      const stateVal = statePv?.value !== undefined ? String(statePv.value).toLowerCase() : ''
      if (stateVal === 'running' || stateVal === '1' || stateVal === 'true' || stateVal === 'on') {
        stateClass = 'io-running'
      } else if (stateVal === 'fault' || stateVal === 'error' || stateVal === 'fail') {
        stateClass = 'io-fault'
      } else if (stateVal === 'transitioning' || stateVal === 'starting' || stateVal === 'stopping') {
        stateClass = 'io-transitioning'
      } else if (stateVal === 'oos' || stateVal === 'maintenance') {
        stateClass = 'io-oos'
      }
    }
    const isSelected = designerMode && selectedNodeIds.has(node.id)
    return (
      <g
        key={node.id}
        transform={getTransformAttr(node)}
        opacity={node.opacity}
        data-node-id={node.id}
        className={[stateClass, isSelected ? 'io-selected' : ''].filter(Boolean).join(' ')}
        onClick={(e) => handleNodeClick(node, e)}
        style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
      >
        {svgContent && (
          <g dangerouslySetInnerHTML={{ __html: svgContent }} />
        )}
        {node.children.map((child) => renderDisplayElement(child))}
      </g>
    )
  }

  function renderAnnotation(node: Annotation): React.ReactElement | null {
    const { config } = node
    if (config.annotationType === 'border') {
      return (
        <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id}>
          <rect
            x={0} y={0}
            width={config.width} height={config.height}
            fill="none"
            stroke={config.strokeColor}
            strokeWidth={config.strokeWidth}
            strokeDasharray={config.strokeDasharray}
            rx={config.cornerStyle === 'rounded' ? (config.cornerRadius ?? 4) : 0}
          />
          {config.titleBlock && (
            <text x={10} y={config.height - 10} fontFamily="Inter" fontSize={10} fill="#A1A1AA">
              {config.titleBlock.title} — {config.titleBlock.drawingNumber} Rev {config.titleBlock.revision}
            </text>
          )}
        </g>
      )
    }
    if (config.annotationType === 'callout') {
      return (
        <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id}>
          <text fontFamily="Inter" fontSize={config.fontSize} fill={config.fill}>{config.text}</text>
        </g>
      )
    }
    return null
  }

  function renderGroup(node: Group): React.ReactElement {
    return (
      <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id}>
        {node.children.map((child) => renderNode(child as SceneNode))}
      </g>
    )
  }

  function renderNode(node: SceneNode): React.ReactElement | null {
    if (!isNodeVisible(node)) return null
    switch (node.type) {
      case 'symbol_instance': return renderSymbolInstance(node as SymbolInstance)
      case 'display_element': return renderDisplayElement(node as DisplayElement)
      case 'primitive': return renderPrimitive(node as Primitive)
      case 'pipe': return renderPipe(node as Pipe)
      case 'text_block': return renderTextBlock(node as TextBlock)
      case 'image': return renderImage(node as ImageNode)
      case 'embedded_svg': return renderEmbeddedSvg(node as EmbeddedSvgNode)
      case 'annotation': return renderAnnotation(node as Annotation)
      case 'group': return renderGroup(node as Group)
      case 'stencil': return null // Stencil rendering TBD with stencil library
      case 'widget': return null // Widgets render in HTML overlay
      case 'graphic_document': return null
      default: return null
    }
  }

  // Collect widget nodes for HTML overlay
  const widgetNodes: WidgetNode[] = []
  function collectWidgets(nodes: SceneNode[]) {
    for (const n of nodes) {
      if (n.type === 'widget') widgetNodes.push(n as WidgetNode)
      if ('children' in n && Array.isArray(n.children)) collectWidgets(n.children as SceneNode[])
    }
  }
  collectWidgets(children)

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: canvas.backgroundColor,
        ...style,
      }}
    >
      {/* SVG Layer */}
      <svg
        ref={svgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox={`0 0 ${canvas.width} ${canvas.height}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={svgTransform}>
          {/* Grid (designer mode only) */}
          {designerMode && document.metadata.gridVisible && (
            <g opacity={0.15}>
              {Array.from({ length: Math.ceil(canvas.width / document.metadata.gridSize) }, (_, i) => (
                <line key={`gv${i}`} x1={i * document.metadata.gridSize} y1={0} x2={i * document.metadata.gridSize} y2={canvas.height} stroke="#71717A" strokeWidth={0.5} />
              ))}
              {Array.from({ length: Math.ceil(canvas.height / document.metadata.gridSize) }, (_, i) => (
                <line key={`gh${i}`} x1={0} y1={i * document.metadata.gridSize} x2={canvas.width} y2={i * document.metadata.gridSize} stroke="#71717A" strokeWidth={0.5} />
              ))}
            </g>
          )}

          {/* Scene nodes */}
          {children.map((node) => renderNode(node))}

          {/* Selection highlights (designer mode) */}
          {designerMode && selectedNodeIds.size > 0 && (
            <g className="io-selection-overlay" pointerEvents="none">
              {/* Selection rings are rendered by the designer, not here */}
            </g>
          )}
        </g>
      </svg>

      {/* HTML Overlay Layer (widgets) */}
      <div
        ref={overlayRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      >
        {widgetNodes.map((node) => {
          const screenPos = canvasToScreen(node.transform.position, vp)
          const w = node.width * vp.zoom
          const h = node.height * vp.zoom
          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: screenPos.x,
                top: screenPos.y,
                width: w,
                height: h,
                pointerEvents: 'auto',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--io-text-muted)',
                fontSize: 12,
              }}
            >
              {node.config.widgetType}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Helpers ----

const ALARM_COLORS: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#06B6D4', 5: '#7C3AED',
}
const ALARM_PRIORITY_NAMES: Record<number, string> = {
  1: 'critical', 2: 'high', 3: 'medium', 4: 'advisory', 5: 'custom',
}

function formatValue(raw: string | number | null, fmt: string): string {
  if (raw === null || raw === undefined) return '---'
  if (typeof raw === 'number') {
    const match = fmt.match(/^%\.(\d+)f/)
    if (match) return raw.toFixed(parseInt(match[1]))
    if (/^%\.?0?d$|^%d$/.test(fmt)) return Math.round(raw).toString()
  }
  return String(raw)
}

function renderAlarmShape(priority: number, isGhost: boolean, color: string): React.ReactElement {
  if (isGhost || priority === 1) {
    return <rect x={-12} y={-9} width={24} height={18} rx={2} fill="none" stroke={color} strokeWidth={1.8} />
  }
  if (priority === 2) return <polygon points="0,-12 12,8 -12,8" fill="none" stroke={color} strokeWidth={1.8} />
  if (priority === 3) return <polygon points="0,12 12,-8 -12,-8" fill="none" stroke={color} strokeWidth={1.8} />
  if (priority === 4) return <ellipse rx={14} ry={10} fill="none" stroke={color} strokeWidth={1.8} />
  return <polygon points="0,-12 12,0 0,12 -12,0" fill="none" stroke={color} strokeWidth={1.8} />
}
