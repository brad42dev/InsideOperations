import { useEffect, useRef, useCallback, useState } from 'react'
import type {
  GraphicDocument, SceneNode, SymbolInstance, DisplayElement, Primitive,
  Pipe, TextBlock, Group, Annotation, ImageNode, EmbeddedSvgNode,
  WidgetNode, ViewportState, LayerDefinition,
  TextReadoutConfig, AnalogBarConfig, FillGaugeConfig, SparklineConfig, DigitalStatusConfig,
  Stencil,
  DimensionLineConfig, NorthArrowConfig, LegendConfig,
  SectionBreakConfig, HeaderConfig, FooterConfig,
} from '../types/graphics'
import { PIPE_SERVICE_COLORS, canvasToScreen } from '../types/graphics'
import { ALARM_COLORS, ZONE_FILLS, DE_COLORS } from './displayElementColors'
import { fetchShapes } from './shapeCache'
import { graphicsApi } from '../../api/graphics'
import './alarmFlash.css'
import './operationalState.css'
import './lod.css'
import { wsManager } from '../hooks/useWebSocket'
import type { PointValue as WsPointValue } from '../hooks/useWebSocket'
import { wsWorkerConnector } from '../hooks/useWsWorker'
import type { AlarmStateUpdate } from '../hooks/useWsWorker'

// ---- Point value types received from WebSocket ----

export interface PointValue {
  pointId: string
  value: string | number | null
  units?: string
  tag?: string
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  unacknowledged?: boolean
  /** OPC UA quality: 'good' | 'bad' | 'uncertain' | 'comm_fail' | string */
  quality?: string
  /** True when no update received within stale timeout */
  stale?: boolean
  /** True when point is in manual/forced override */
  manual?: boolean
  description?: string
}

// ---- Props ----

export interface SceneRendererProps {
  /** The graphic document to render */
  document: GraphicDocument
  /** Viewport state for pan/zoom */
  viewport?: ViewportState
  /** Live point values keyed by pointId */
  pointValues?: Map<string, PointValue>
  /** Sparkline history data keyed by pointId — array of numeric values, oldest first */
  sparklineHistories?: Map<string, number[]>
  /** Called when a node with a navigationLink is clicked */
  onNavigate?: (targetGraphicId: string, targetUrl?: string) => void
  /** Designer mode — show selection handles, grid, locked indicators */
  designerMode?: boolean
  /** Selected node IDs (designer mode only) */
  selectedNodeIds?: Set<string>
  /** Callback when a node is clicked (designer mode) */
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void
  /** SVG preserveAspectRatio attribute — 'xMidYMid meet' (default) or 'none' to stretch */
  preserveAspectRatio?: string
  /**
   * When true, SceneRenderer subscribes to wsManager directly and applies point-value
   * updates via direct SVG DOM mutation (bypassing React re-renders on the hot path).
   * Set false for designer mode and historical/playback mode (those pass pointValues prop).
   */
  liveSubscribe?: boolean
  className?: string
  style?: React.CSSProperties
}

// ---- Main renderer ----

export function SceneRenderer({
  document,
  viewport,
  pointValues = new Map(),
  sparklineHistories = new Map(),
  onNavigate,
  designerMode = false,
  selectedNodeIds = new Set(),
  onNodeClick,
  preserveAspectRatio = 'xMidYMid meet',
  liveSubscribe = false,
  className,
  style,
}: SceneRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [shapeMap, setShapeMap] = useState<Map<string, { svg: string; sidecar: Record<string, unknown> }>>(new Map())
  const [stencilMap, setStencilMap] = useState<Map<string, string>>(new Map())
  // Tag-to-UUID resolution for PortablePointBinding (pointTag) bindings
  const [resolvedTagMap, setResolvedTagMap] = useState<Map<string, string>>(new Map())

  const { canvas, layers, children } = document
  const vp = viewport ?? {
    panX: 0, panY: 0, zoom: 1,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    screenWidth: canvas.width,
    screenHeight: canvas.height,
  }

  // LOD level from zoom (process-implementation-spec §4.3)
  const lodLevel = vp.zoom < 0.15 ? 0 : vp.zoom < 0.4 ? 1 : vp.zoom < 0.8 ? 2 : 3

  // Apply LOD class to container div (process-implementation-spec §4.3.3)
  const containerDivRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerDivRef.current
    if (!el) return
    el.classList.remove('lod-0', 'lod-1', 'lod-2', 'lod-3')
    el.classList.add(`lod-${lodLevel}`)
  }, [lodLevel])

  // ---- Live DOM mutation path (spec §5.1 Real-Time Update Pipeline) ----
  // nodeId → {displayType, config, binding} for applyPointValue lookups
  type NodeConfig = { displayType: string; config: unknown; binding: { pointId?: string; expressionId?: string } }
  const nodeConfigMapRef = useRef<Map<string, NodeConfig>>(new Map())
  // pointId → SVGGElement[] for O(1) element lookup
  const pointToElementsRef = useRef<Map<string, SVGGElement[]>>(new Map())
  // Mutable update buffer — incoming WS messages accumulate here, drained each rAF
  const pendingDomRef = useRef<Map<string, WsPointValue>>(new Map())
  const domRafPendingRef = useRef(false)
  // Last-known PV per point — used to re-apply when alarm state changes independently
  const lastPvRef = useRef<Map<string, WsPointValue>>(new Map())
  // Current alarm state per point — merged into PV on each DOM apply
  const alarmStateRef = useRef<Map<string, AlarmStateUpdate>>(new Map())

  // Build node config map whenever the scene graph changes
  useEffect(() => {
    if (!liveSubscribe) return
    const map = new Map<string, NodeConfig>()
    function walkForConfigs(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === 'display_element') {
          const de = n as DisplayElement
          map.set(de.id, { displayType: de.displayType, config: de.config, binding: de.binding })
        }
        if (n.type === 'symbol_instance') {
          const si = n as SymbolInstance
          if (si.stateBinding?.pointId || si.stateBinding?.expressionId || si.stateBinding?.pointTag) {
            map.set(si.id, {
              displayType: 'symbol_state',
              config: {},
              binding: { pointId: si.stateBinding.pointId, expressionId: si.stateBinding.expressionId },
            })
          }
          for (const child of si.children) {
            const de = child as DisplayElement
            map.set(de.id, { displayType: de.displayType, config: de.config, binding: de.binding })
          }
        }
        if ('children' in n && n.type !== 'symbol_instance' && Array.isArray(n.children)) {
          walkForConfigs(n.children as SceneNode[])
        }
      }
    }
    walkForConfigs(children)
    nodeConfigMapRef.current = map
  }, [document.id, children, liveSubscribe])

  // After each render: rebuild pointToElements map from DOM and subscribe to wsManager
  useEffect(() => {
    if (!liveSubscribe || !svgRef.current) return

    if (wsManager.getState() === 'disconnected') {
      void wsManager.connect()
    }

    // Query all point-bound elements and build the lookup map
    const map = new Map<string, SVGGElement[]>()
    const elements = svgRef.current.querySelectorAll<SVGGElement>('[data-point-id]')
    for (const el of elements) {
      const pointId = el.getAttribute('data-point-id')
      if (!pointId) continue
      if (!map.has(pointId)) map.set(pointId, [])
      map.get(pointId)!.push(el)
    }
    pointToElementsRef.current = map

    const pointIds = Array.from(map.keys())
    if (pointIds.length === 0) return

    const handler = (pv: WsPointValue) => {
      // Merge current alarm state into pv before buffering
      const alarm = alarmStateRef.current.get(pv.pointId)
      const pvWithAlarm: WsPointValue = alarm
        ? { ...pv, alarmPriority: (alarm.active || alarm.unacknowledged ? alarm.priority : null) as (1|2|3|4|5|null) }
        : pv
      lastPvRef.current.set(pv.pointId, pvWithAlarm)
      pendingDomRef.current.set(pv.pointId, pvWithAlarm)
      if (!domRafPendingRef.current) {
        domRafPendingRef.current = true
        requestAnimationFrame(() => {
          domRafPendingRef.current = false
          const pending = pendingDomRef.current
          if (pending.size === 0) return
          const updates = new Map(pending)
          pending.clear()
          for (const [pid, update] of updates) {
            const els = pointToElementsRef.current.get(pid)
            if (!els) continue
            for (const el of els) {
              const nodeId = el.getAttribute('data-node-id')
              if (!nodeId) continue
              const conf = nodeConfigMapRef.current.get(nodeId)
              if (!conf) continue
              applyPointValue(el, conf.displayType, conf.config, update)
            }
          }
        })
      }
    }

    // Alarm state changes arrive independently of point value updates.
    // Re-apply the last-known PV merged with the new alarm state so visual
    // alarm indicators update immediately without waiting for the next data tick.
    const alarmHandler = (alarm: AlarmStateUpdate) => {
      alarmStateRef.current.set(alarm.point_id, alarm)
      const lastPv = lastPvRef.current.get(alarm.point_id)
      const els = pointToElementsRef.current.get(alarm.point_id)
      if (!els || !lastPv) return
      const pvWithAlarm: WsPointValue = {
        ...lastPv,
        alarmPriority: (alarm.active || alarm.unacknowledged ? alarm.priority : null) as (1|2|3|4|5|null),
      }
      lastPvRef.current.set(alarm.point_id, pvWithAlarm)
      for (const el of els) {
        const nodeId = el.getAttribute('data-node-id')
        if (!nodeId) continue
        const conf = nodeConfigMapRef.current.get(nodeId)
        if (!conf) continue
        applyPointValue(el, conf.displayType, conf.config, pvWithAlarm)
      }
    }

    pointIds.forEach(id => wsManager.subscribe(id, handler))
    const unsubAlarm = wsWorkerConnector.onAlarmStateChange(alarmHandler)
    return () => {
      pointIds.forEach(id => wsManager.unsubscribe(id, handler))
      unsubAlarm()
      pendingDomRef.current.clear()
      lastPvRef.current.clear()
    }
  }, [document.id, children, liveSubscribe, resolvedTagMap])

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
          for (const p of si.composableParts) {
            // DB may store partId as snake_case (part_id) — handle both
            const pid = p.partId ?? (p as unknown as Record<string, string>)['part_id']
            if (pid) ids.push(pid)
          }
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

  // Collect stencil IDs and fetch their SVG on mount / document change
  useEffect(() => {
    const stencilIds: string[] = []
    function walkForStencils(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === 'stencil') stencilIds.push((n as Stencil).stencilRef.stencilId)
        if ('children' in n && Array.isArray(n.children)) walkForStencils(n.children as SceneNode[])
      }
    }
    walkForStencils(children)
    const unique = [...new Set(stencilIds)]
    if (unique.length === 0) return

    Promise.all(
      unique.map(async (id) => {
        try {
          const resp = await fetch(`/api/v1/design-objects/${id}`)
          if (!resp.ok) return null
          const data = await resp.json() as { data?: { svg_data?: string } }
          return data.data?.svg_data ? { id, svg: data.data.svg_data } : null
        } catch {
          return null
        }
      })
    ).then(results => {
      const m = new Map<string, string>()
      for (const r of results) { if (r) m.set(r.id, r.svg) }
      if (m.size > 0) setStencilMap(prev => new Map([...prev, ...m]))
    }).catch(console.error)
  }, [document.id, children])

  // Resolve tag-based (PortablePointBinding) bindings to UUIDs.
  // Runs once per document load; populates resolvedTagMap so renderDisplayElement
  // can set correct data-point-id values for the live DOM-mutation subscription.
  useEffect(() => {
    const tags: string[] = []
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    function collectTags(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === 'display_element') {
          const de = n as DisplayElement
          if (de.binding.pointTag) tags.push(de.binding.pointTag)
          // Also handle legacy graphics where a tag name was saved into pointId by mistake
          else if (de.binding.pointId && !UUID_RE.test(de.binding.pointId)) tags.push(de.binding.pointId)
        }
        if (n.type === 'symbol_instance') {
          const si = n as SymbolInstance
          if (si.stateBinding?.pointTag) tags.push(si.stateBinding.pointTag)
          else if (si.stateBinding?.pointId && !UUID_RE.test(si.stateBinding.pointId)) tags.push(si.stateBinding.pointId)
        }
        if ('children' in n && Array.isArray(n.children)) collectTags(n.children as SceneNode[])
      }
    }
    collectTags(children)
    const unique = [...new Set(tags)]
    if (unique.length === 0) return
    graphicsApi.resolveTags(unique).then(result => {
      if (result.success && result.data) {
        const resolved = result.data as unknown as Record<string, string>
        setResolvedTagMap(new Map(Object.entries(resolved)))
      }
    }).catch(console.error)
  }, [document.id, children])

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
        data-lod="1"
        onClick={(e) => handleNodeClick(node, e)}
        style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
      >
        {shape}
      </g>
    )
  }

  function renderPipe(node: Pipe): React.ReactElement {
    const color = PIPE_SERVICE_COLORS[node.serviceType] ?? '#6B8CAE'
    const gapColor = canvas.backgroundColor ?? '#1E1E2E'
    const commonProps = {
      d: node.pathData,
      fill: 'none' as const,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      strokeDasharray: node.dashPattern,
    }
    const paths = node.insulated
      ? (
        <>
          <path {...commonProps} stroke={color} strokeWidth={node.strokeWidth * 4} />
          <path {...commonProps} stroke={gapColor} strokeWidth={node.strokeWidth * 2} />
          <path {...commonProps} stroke={color} strokeWidth={node.strokeWidth * 0.5} />
        </>
      )
      : (
        <path {...commonProps} stroke={color} strokeWidth={node.strokeWidth} />
      )
    return (
      <g key={node.id} data-node-id={node.id} data-lod="0" opacity={node.opacity} onClick={(e) => handleNodeClick(node, e)} style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}>
        {paths}
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
    const textLod = fontSize >= 24 ? 0 : fontSize >= 14 ? 1 : 2
    return (
      <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id} data-lod={String(textLod)} onClick={(e) => handleNodeClick(node, e)} style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}>
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
      <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id} data-lod="0" onClick={(e) => handleNodeClick(node, e)} style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}>
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
        data-lod="0"
        onClick={(e) => handleNodeClick(node, e)}
        style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
        dangerouslySetInnerHTML={{ __html: node.svgContent }}
      />
    )
  }

  function renderStencil(node: Stencil): React.ReactElement {
    const svgContent = stencilMap.get(node.stencilRef.stencilId)
    const w = node.size?.width ?? 48
    const h = node.size?.height ?? 48
    if (!svgContent) {
      // Placeholder while loading
      return (
        <g key={node.id} transform={getTransformAttr(node)} opacity={node.opacity} data-node-id={node.id} data-lod="0" onClick={(e) => handleNodeClick(node, e)} style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}>
          <rect width={w} height={h} fill="none" stroke="var(--io-border, #3F3F46)" strokeWidth={1} strokeDasharray="4 2" />
          <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize={8} fill="var(--io-text-muted, #71717A)">
            {node.name || 'Stencil'}
          </text>
        </g>
      )
    }
    return (
      <g
        key={node.id}
        transform={getTransformAttr(node)}
        opacity={node.opacity}
        data-node-id={node.id}
        data-lod="0"
        onClick={(e) => handleNodeClick(node, e)}
        style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    )
  }

  // parentOffset: displacement of this element from parent SymbolInstance origin (in parent space).
  // Used to draw the signal line back toward the parent shape.
  // vesselInteriorPath: SVG path string from parent SymbolInstance's sidecar, used for vessel_overlay fill_gauge clip.
  function renderDisplayElement(node: DisplayElement, parentOffset?: { x: number; y: number }, vesselInteriorPath?: string): React.ReactElement | null {
    // Resolve binding: UUID pointId wins; fall back to resolved tag (pointTag or legacy
    // pointId-stored-as-tag); then expressionId.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const rawPointId = node.binding.pointId
    const isTagInPointId = rawPointId && !UUID_RE.test(rawPointId)
    const pvKey = (rawPointId && !isTagInPointId ? rawPointId : undefined)
      ?? (node.binding.pointTag ? resolvedTagMap.get(node.binding.pointTag) : undefined)
      ?? (isTagInPointId ? resolvedTagMap.get(rawPointId!) : undefined)
      ?? node.binding.expressionId
    const pv = pvKey ? pointValues.get(pvKey) : undefined
    // Human-readable tag for tooltip — prefer explicit pointTag, fall back to legacy tag-in-pointId
    const pointTag = node.binding.pointTag ?? (isTagInPointId ? rawPointId : undefined)
    const deTransform = getTransformAttr(node)

    switch (node.displayType) {
      case 'text_readout': {
        const cfg = node.config as TextReadoutConfig
        const alarmPriority = (pv?.alarmPriority ?? null) as 1 | 2 | 3 | 4 | 5 | null
        const unacked = pv?.unacknowledged ?? false
        const quality = pv?.quality ?? 'good'
        const isStale = pv?.stale ?? false
        const isCommFail = quality === 'comm_fail'
        const isBad = quality === 'bad' && !isCommFail
        const isManual = pv?.manual ?? false
        // Display value: spec-defined replacements for bad quality states
        const rawValueStr = isCommFail ? 'COMM' : isBad ? '????' : formatValue(pv?.value ?? null, cfg.valueFormat)
        const valueStr = rawValueStr
        const unitStr = cfg.showUnits && pv?.units && !isCommFail && !isBad ? ` ${pv.units}` : ''
        const label = cfg.showLabel ? (cfg.labelText ?? pv?.tag ?? '') : ''
        const alarmColor = alarmPriority ? ALARM_COLORS[alarmPriority] : null
        // Box styling per quality state
        const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : alarmColor ? `${alarmColor}33` : DE_COLORS.surfaceElevated
        const boxStroke = isBad ? ALARM_COLORS[1] : isCommFail ? DE_COLORS.borderStrong : alarmColor ?? DE_COLORS.border
        const strokeWidth = (isBad || alarmColor) ? 2 : 1
        const strokeDash = isStale ? '4 2' : isBad ? '4 2' : undefined
        const opacity = isStale ? 0.6 : node.opacity
        const strokeDotted = quality === 'uncertain' ? '2 2' : undefined
        const effectiveDash = strokeDash ?? strokeDotted
        const valueColor = isCommFail ? DE_COLORS.textMuted : isBad ? ALARM_COLORS[1] : alarmColor ? DE_COLORS.textPrimary : DE_COLORS.textSecondary
        const charWidth = 7
        const w = Math.max(cfg.minWidth, (valueStr.length + unitStr.length) * charWidth + 10)
        const h = cfg.showLabel && label ? 36 : 24
        const valueY = cfg.showLabel && label ? h * 0.65 : h / 2
        const flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''
        return (
          <g key={node.id} className={`io-display-element ${flashClass}`} transform={deTransform} opacity={opacity} data-node-id={node.id} data-lod="1" data-point-id={pvKey} data-point-tag={pointTag} data-display-type="text_readout">
            {cfg.showBox && <rect data-role="box" x={0} y={0} width={w} height={h} rx={2} fill={boxFill} stroke={boxStroke} strokeWidth={strokeWidth} strokeDasharray={effectiveDash} />}
            {cfg.showLabel && label && <text x={w/2} y={6} textAnchor="middle" dominantBaseline="hanging" fontFamily="Inter" fontSize={8} fill={DE_COLORS.textMuted}>{label}</text>}
            <text data-role="value" x={w/2} y={valueY} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={11} fill={valueColor} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {valueStr}{unitStr && <tspan fontFamily="Inter" fontSize={9} fill={DE_COLORS.textMuted}>{unitStr}</tspan>}
            </text>
            {/* Manual/forced override badge — spec: cyan 'M' badge */}
            {isManual && (
              <text data-role="manual-badge" x={w - 2} y={2} textAnchor="end" dominantBaseline="hanging" fontFamily="Inter" fontSize={7} fontWeight={700} fill={DE_COLORS.manualBadge}>M</text>
            )}
            {cfg.showSignalLine && parentOffset && (() => {
              const ex = -parentOffset.x
              const ey = -parentOffset.y
              return (
                <line
                  x1={0} y1={h / 2}
                  x2={ex} y2={ey}
                  stroke="#52525B"
                  strokeWidth={0.75}
                  strokeDasharray="3 2"
                />
              )
            })()}
          </g>
        )
      }

      case 'alarm_indicator': {
        const active = !!pv?.alarmPriority
        if (!active && !designerMode) return null
        const priority = (pv?.alarmPriority ?? 1) as 1 | 2 | 3 | 4 | 5
        const unacked = pv?.unacknowledged ?? false
        const isGhost = !active && designerMode
        const color = isGhost ? DE_COLORS.equipStroke : (ALARM_COLORS[priority] ?? ALARM_COLORS[1])
        const flashClass = unacked && !isGhost ? `io-alarm-flash-${ALARM_PRIORITY_NAMES[priority]}` : ''
        const label = isGhost ? '—' : String(priority)
        const shapeEl = renderAlarmShape(priority, isGhost, color)
        return (
          <g key={node.id} className={`io-alarm-indicator ${flashClass}`} data-node-id={node.id} data-lod="1" opacity={isGhost ? 0.25 : node.opacity} transform={deTransform} data-point-tag={pointTag} data-display-type="alarm_indicator" data-point-id={pvKey}>
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
        const fill = isNormal ? DE_COLORS.displayZoneInactive : (ALARM_COLORS[cfg.abnormalPriority] ?? ALARM_COLORS[1])
        const textColor = isNormal ? DE_COLORS.textSecondary : DE_COLORS.textPrimary
        const w = Math.max(40, label.length * 7.5 + 12)
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} data-lod="2" opacity={node.opacity} transform={deTransform} data-point-tag={pointTag} data-display-type="digital_status" data-point-id={pvKey}>
            <rect data-role="bg" x={0} y={0} width={w} height={22} rx={2} fill={fill} />
            <text data-role="value" x={w/2} y={11} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={9} fill={textColor}>{label}</text>
            {cfg.showSignalLine && parentOffset && (() => {
              const h = 22
              const ex = -parentOffset.x
              const ey = -parentOffset.y
              return (
                <line
                  x1={0} y1={h / 2}
                  x2={ex} y2={ey}
                  stroke="#52525B"
                  strokeWidth={0.75}
                  strokeDasharray="3 2"
                />
              )
            })()}
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

        // Determine which zone the current value falls in
        const valueZone = (() => {
          if (value === null) return null
          const { hh, h, l, ll } = cfg.thresholds ?? {}
          if (hh !== undefined && value >= hh) return 'hh'
          if (h  !== undefined && value >= h)  return 'h'
          if (ll !== undefined && value < ll)  return 'll'
          if (l  !== undefined && value < l)   return 'l'
          return 'normal'
        })()

        // Zone fill with alarm replacement — only the zone containing the current value
        // and only when that zone has a configured alarm priority that matches an active alarm
        const zoneFills = {
          hh: (valueZone === 'hh' && alarmPriority && cfg.thresholds?.hhAlarmPriority)
              ? ALARM_COLORS[cfg.thresholds.hhAlarmPriority] : ZONE_FILLS.hh,
          h:  (valueZone === 'h'  && alarmPriority && cfg.thresholds?.hAlarmPriority)
              ? ALARM_COLORS[cfg.thresholds.hAlarmPriority]  : ZONE_FILLS.h,
          normal: ZONE_FILLS.normal,
          l:  (valueZone === 'l'  && alarmPriority && cfg.thresholds?.lAlarmPriority)
              ? ALARM_COLORS[cfg.thresholds.lAlarmPriority]  : ZONE_FILLS.l,
          ll: (valueZone === 'll' && alarmPriority && cfg.thresholds?.llAlarmPriority)
              ? ALARM_COLORS[cfg.thresholds.llAlarmPriority] : ZONE_FILLS.ll,
        }
        const zones = [
          { fill: zoneFills.hh,     y: 0,                       h: hhH,    label: 'HH', role: 'zone-hh'     },
          { fill: zoneFills.h,      y: hhH,                     h: hH,     label: 'H',  role: 'zone-h'      },
          { fill: zoneFills.normal, y: hhH + hH,                h: normalH, label: '',  role: 'zone-normal'  },
          { fill: zoneFills.l,      y: hhH + hH + normalH,      h: lH,     label: 'L',  role: 'zone-l'      },
          { fill: zoneFills.ll,     y: hhH + hH + normalH + lH, h: llH,    label: 'LL', role: 'zone-ll'     },
        ]
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} data-lod="2" opacity={node.opacity} transform={deTransform} data-point-tag={pointTag} data-display-type="analog_bar" data-point-id={pvKey}>
            <rect x={0} y={0} width={bw} height={bh} fill={DE_COLORS.surfaceElevated} stroke={DE_COLORS.borderStrong} strokeWidth={0.5} />
            {zones.map((z, i) => <rect key={i} data-role={z.role} x={1} y={z.y} width={bw-2} height={Math.max(0,z.h)} fill={z.fill} stroke={DE_COLORS.borderStrong} strokeWidth={0.5} />)}
            {cfg.showZoneLabels && zones.filter(z => z.label).map((z, i) => (
              <text key={i} x={-3} y={z.y + z.h/2} textAnchor="end" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={7} fill={DE_COLORS.textMuted}>{z.label}</text>
            ))}
            {cfg.showPointer && value !== null && <>
              <polygon data-role="pointer" points={`${bw},${pointerY-3} ${bw+6},${pointerY} ${bw},${pointerY+3}`} fill={alarmPriority ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary} />
              <line data-role="pointer-line" x1={1} y1={pointerY} x2={bw-1} y2={pointerY} stroke={alarmPriority ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary} strokeWidth={1} />
            </>}
            {cfg.showSetpoint && (() => {
              const spKey = cfg.setpointBinding?.pointId ?? cfg.setpointBinding?.expressionId
              const spPv = spKey ? pointValues.get(spKey) : undefined
              const spVal = typeof spPv?.value === 'number' ? spPv.value : null
              if (spVal === null) return null
              const spPct = Math.max(0, Math.min(1, (spVal - cfg.rangeLo) / range))
              const spY = (1 - spPct) * bh
              // Diamond marker — 5px wide, 4px tall, teal stroke, no fill
              return <polygon points={`${bw},${spY-4} ${bw+5},${spY} ${bw},${spY+4} ${bw-5},${spY}`} fill="none" stroke={DE_COLORS.accent} strokeWidth={1} />
            })()}
            {cfg.showNumericReadout && value !== null && (
              <text data-role="numeric" x={bw/2} y={bh+10} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={11} fill={alarmPriority ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary}>
                {value.toFixed(1)}
              </text>
            )}
            {cfg.showSignalLine && parentOffset && (() => {
              // Dashed line from bar left-center back toward parent shape origin
              // In display element local space, parent origin is at (-parentOffset.x, -parentOffset.y)
              const ex = -parentOffset.x
              const ey = -parentOffset.y
              return (
                <line
                  x1={0} y1={bh / 2}
                  x2={ex} y2={ey}
                  stroke={DE_COLORS.borderStrong}
                  strokeWidth={0.75}
                  strokeDasharray="3 2"
                />
              )
            })()}
          </g>
        )
      }

      case 'sparkline': {
        const cfg = node.config as SparklineConfig
        const W = cfg.sparkWidth ?? 110
        const H = cfg.sparkHeight ?? 18
        const targetPoints = cfg.dataPoints ?? 60
        const alarmPriority = pv?.alarmPriority as number | null | undefined
        const strokeColor = alarmPriority ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary
        const rawHistory = pvKey ? sparklineHistories.get(pvKey) : undefined
        // Trim to time window, then downsample to targetPoints
        let polylinePoints = ''
        if (rawHistory && rawHistory.length >= 2) {
          const nums = rawHistory.filter((v) => typeof v === 'number' && isFinite(v))
          // Downsample: pick evenly spaced samples if more than targetPoints
          const sampled = nums.length <= targetPoints ? nums : (() => {
            const out: number[] = []
            for (let i = 0; i < targetPoints; i++) {
              out.push(nums[Math.round(i * (nums.length - 1) / (targetPoints - 1))])
            }
            return out
          })()
          if (sampled.length >= 2) {
            const lo = Math.min(...sampled)
            const hi = Math.max(...sampled)
            const range = hi - lo || 1
            const pad = 2
            polylinePoints = sampled.map((v, i) => {
              const px = pad + (i / (sampled.length - 1)) * (W - pad * 2)
              const py = pad + (1 - (v - lo) / range) * (H - pad * 2)
              return `${px.toFixed(1)},${py.toFixed(1)}`
            }).join(' ')
          }
        }
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} data-lod="2" opacity={node.opacity} transform={deTransform} data-point-tag={pointTag} data-display-type="sparkline" data-point-id={pvKey}>
            <rect x={0} y={0} width={W} height={H} rx={1} fill={DE_COLORS.surfaceElevated} />
            {polylinePoints ? (
              <polyline points={polylinePoints} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ) : (
              <line x1={3} y1={H/2} x2={W-3} y2={H/2} stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" opacity={0.3} />
            )}
            {cfg.showSignalLine && parentOffset && (() => {
              const ex = -parentOffset.x
              const ey = -parentOffset.y
              return (
                <line
                  x1={0} y1={H / 2}
                  x2={ex} y2={ey}
                  stroke="#52525B"
                  strokeWidth={0.75}
                  strokeDasharray="3 2"
                />
              )
            })()}
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
        const fillColor = alarmPriority ? `${ALARM_COLORS[alarmPriority]}4D` : 'rgba(71,85,105,0.6)' // rgba fallback intentional — no token for translucent fill
        const fmtPct = `${(pct * 100).toFixed(0)}%`
        const clipId = `fg-clip-${node.id.replace(/[^a-z0-9]/gi, '')}`

        if (cfg.mode === 'vessel_overlay') {
          // Vessel-interior mode: fill clips to vessel shape interior using sidecar vesselInteriorPath.
          // Falls back to a rect path if no sidecar path is available.
          const fillH = pct * bh
          const fillY = bh - fillH
          const clipPathData = vesselInteriorPath ?? `M0,0 H${bw} V${bh} H0 Z`
          return (
            <g key={node.id} className="io-display-element" data-node-id={node.id} data-lod="2" opacity={node.opacity} transform={deTransform} data-point-tag={pointTag} data-display-type="fill_gauge" data-point-id={pvKey}>
              <defs>
                <clipPath id={clipId}>
                  <path d={clipPathData} />
                </clipPath>
              </defs>
              <rect data-role="fill" x={0} y={fillY} width={bw} height={fillH + 20} fill={fillColor} clipPath={`url(#${clipId})`} />
              {cfg.showLevelLine && fillH > 0 && <line x1={0} y1={fillY} x2={bw} y2={fillY} stroke={DE_COLORS.borderStrong} strokeWidth={1} strokeDasharray="5 3" />}
              {cfg.showValue && fillH > 0 && <text data-role="value" x={bw/2} y={fillY + fillH/2} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={10} fill={DE_COLORS.textSecondary}>{fmtPct}</text>}
              {cfg.showSignalLine && parentOffset && (() => {
                const ex = -parentOffset.x
                const ey = -parentOffset.y
                return (
                  <line
                    x1={0} y1={bh / 2}
                    x2={ex} y2={ey}
                    stroke="#52525B"
                    strokeWidth={0.75}
                    strokeDasharray="3 2"
                  />
                )
              })()}
            </g>
          )
        }

        // Standalone bar mode
        const fillH = pct * (bh - 2)
        const fillY = bh - 1 - fillH
        return (
          <g key={node.id} className="io-display-element" data-node-id={node.id} data-lod="2" opacity={node.opacity} transform={deTransform} data-point-tag={pointTag} data-display-type="fill_gauge" data-point-id={pvKey}>
            <rect x={0} y={0} width={bw} height={bh} rx={2} fill="none" stroke={DE_COLORS.borderStrong} strokeWidth={0.5} />
            <rect data-role="fill" x={1} y={fillY} width={bw-2} height={fillH} rx={1} fill={fillColor} />
            {cfg.showLevelLine && fillH > 0 && <line x1={1} y1={fillY} x2={bw-1} y2={fillY} stroke={DE_COLORS.borderStrong} strokeWidth={1} strokeDasharray="5 3" />}
            {cfg.showValue && <text data-role="value" x={bw/2} y={fillY + fillH/2} textAnchor="middle" dominantBaseline="central" fontFamily="JetBrains Mono" fontSize={10} fill={DE_COLORS.textSecondary}>{fmtPct}</text>}
            {cfg.showSignalLine && parentOffset && (() => {
              const ex = -parentOffset.x
              const ey = -parentOffset.y
              return (
                <line
                  x1={0} y1={bh / 2}
                  x2={ex} y2={ey}
                  stroke="#52525B"
                  strokeWidth={0.75}
                  strokeDasharray="3 2"
                />
              )
            })()}
          </g>
        )
      }

      default:
        return null
    }
  }

  function renderSymbolInstance(node: SymbolInstance): React.ReactElement {
    const shapeData = shapeMap.get(node.shapeRef.shapeId)
    const sidecar = shapeData?.sidecar as {
      textZones?: Array<{ id: string; x: number; y: number; width?: number; anchor?: string; fontSize?: number }>
      vesselInteriorPath?: string
      geometry?: { viewBox: string; width: number; height: number }
      valueAnchors?: Array<{ nx: number; ny: number; preferredElement?: string }>
      alarmAnchor?: { nx: number; ny: number }
    } | undefined

    // Shape SVG files include a full <svg> wrapper without explicit width/height.
    // Inject geometry dimensions so nested SVGs don't default to 300×150.
    // Fall back to parsing the SVG's own viewBox when sidecar.geometry is absent.
    let svgContent = shapeData?.svg ?? ''
    if (svgContent) {
      let w: number | undefined = sidecar?.geometry?.width
      let h: number | undefined = sidecar?.geometry?.height
      if (w == null || h == null) {
        const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/)
        if (vbMatch) {
          const parts = vbMatch[1].trim().split(/[\s,]+/)
          if (parts.length >= 4) { w = parseFloat(parts[2]); h = parseFloat(parts[3]) }
        }
      }
      if (w != null && h != null) {
        svgContent = svgContent.replace(/(<svg\b[^>]*?)>/, `$1 width="${w}" height="${h}">`)
      }
    }

    // Derive operational state CSS class from stateBinding point value
    let stateClass = ''
    const rawStateId = node.stateBinding?.pointId
    const UUID_RE_SI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isTagInStateId = rawStateId && !UUID_RE_SI.test(rawStateId)
    const statePvKey = (rawStateId && !isTagInStateId ? rawStateId : undefined)
      ?? (node.stateBinding?.pointTag ? resolvedTagMap.get(node.stateBinding.pointTag) : undefined)
      ?? (isTagInStateId ? resolvedTagMap.get(rawStateId!) : undefined)
      ?? node.stateBinding?.expressionId
    const statePv = statePvKey ? pointValues.get(statePvKey) : undefined
    if (statePv) {
      const stateVal = statePv.value !== undefined ? String(statePv.value).toLowerCase() : ''
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

    // Render text zones from shape sidecar (spec §Shape Library: Text Zones)
    const textZoneElements = (sidecar?.textZones ?? []).map((zone) => {
      const override = node.textZoneOverrides?.[zone.id]
      if (override?.visible === false) return null
      // Determine text content: static override > tag from bound point > empty
      const text = override?.staticText ?? statePv?.tag ?? ''
      if (!text && !designerMode) return null
      const displayText = text || (designerMode ? `[${zone.id}]` : '')

      // Instrument designation zones (spec §Shape Library: Typography):
      // Use Arial 12px weight 600 with textLength auto-fit when zone.width is defined.
      const isDesignation = zone.id === 'designation'
      const fontFamily = isDesignation ? 'Arial' : 'Inter'
      const fontSize = override?.fontSize ?? zone.fontSize ?? (isDesignation ? 12 : 10)
      const fontWeight = isDesignation ? 600 : undefined

      // Apply textLength + lengthAdjust="spacingAndGlyphs" whenever zone.width is set
      const autoFitProps = zone.width != null
        ? { textLength: zone.width, lengthAdjust: 'spacingAndGlyphs' as const }
        : {}

      return (
        <text
          key={`tz-${zone.id}`}
          x={zone.x}
          y={zone.y}
          textAnchor={(zone.anchor as 'start' | 'middle' | 'end') ?? 'middle'}
          dominantBaseline="auto"
          fontFamily={fontFamily}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill="#71717A"
          data-lod="2"
          {...autoFitProps}
        >
          {displayText}
        </text>
      )
    })

    // Render composable parts (actuators, supports, etc.) — spec §Shape Library: Composable Parts
    const composablePartElements = (node.composableParts ?? []).map((part) => {
      // DB may store partId as snake_case (part_id) — handle both
      const pid = part.partId ?? (part as unknown as Record<string, string>)['part_id']
      if (!pid) return null
      const partData = shapeMap.get(pid)
      if (!partData?.svg) return null
      return (
        <g key={`part-${pid}`} dangerouslySetInnerHTML={{ __html: partData.svg }} />
      )
    })

    // Sidecar auto-overlays — value text and alarm indicator driven by stateBinding point.
    // Always rendered (even when statePv is null) so DOM-mutation path can update them.
    // Scale-compensation group (scale 1/sx, 1/sy) cancels parent transform so overlays
    // render at consistent visual size regardless of symbol scale.
    const sx = node.transform.scale.x || 1
    const sy = node.transform.scale.y || 1
    const geoW = sidecar?.geometry?.width ?? 40
    const geoH = sidecar?.geometry?.height ?? 40
    const firstValueAnchor = sidecar?.valueAnchors?.[0]
    const alarmAnchorPos = sidecar?.alarmAnchor

    const sidecarValueOverlay = statePvKey && firstValueAnchor ? (() => {
      const ax = firstValueAnchor.nx * geoW
      const ay = firstValueAnchor.ny * geoH
      const rawVal = statePv?.value ?? null
      const alarmPri = statePv?.alarmPriority as (1|2|3|4|5) | undefined
      const valueColor = alarmPri ? (ALARM_COLORS[alarmPri] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary
      const valueStr = rawVal === null ? '---' : formatValue(rawVal, '%auto')
      return (
        <g key="sv" transform={`translate(${ax},${ay}) scale(${1/sx},${1/sy})`}>
          <text data-role="sidecar-value" x={0} y={0} textAnchor="middle" dominantBaseline="hanging"
            fontFamily="JetBrains Mono" fontSize={11} fill={valueColor}
            style={{ fontVariantNumeric: 'tabular-nums' as const }}>
            {valueStr}
          </text>
        </g>
      )
    })() : null

    const sidecarAlarmOverlay = statePvKey && alarmAnchorPos ? (() => {
      const ax = alarmAnchorPos.nx * geoW
      const ay = alarmAnchorPos.ny * geoH
      const alarmPri = (statePv?.alarmPriority ?? 0) as 0 | 1 | 2 | 3 | 4 | 5
      const visible = alarmPri > 0
      const priority = (alarmPri || 1) as 1 | 2 | 3 | 4 | 5
      const unacked = statePv?.unacknowledged ?? false
      const color = ALARM_COLORS[priority] ?? ALARM_COLORS[1]
      const flashClass = visible && unacked ? `io-alarm-flash-${ALARM_PRIORITY_NAMES[priority]}` : ''
      return (
        <g key="sa" data-role="sidecar-alarm" className={`io-alarm-indicator ${flashClass}`}
          transform={`translate(${ax},${ay}) scale(${1/sx},${1/sy})`}
          style={{ display: visible ? '' : 'none' }}>
          {renderAlarmShape(priority, false, color)}
          <text x={0} y={0} textAnchor="middle" dominantBaseline="central"
            fontFamily="JetBrains Mono" fontSize={9} fontWeight={600} fill={color}>
            {String(priority)}
          </text>
        </g>
      )
    })() : null

    const isSelected = designerMode && selectedNodeIds.has(node.id)
    return (
      <g
        key={node.id}
        transform={getTransformAttr(node)}
        opacity={node.opacity}
        data-node-id={node.id}
        data-lod="0"
        // stateBinding point drives operational state CSS class (io-running, io-fault, etc.)
        // data-point-id enables DOM mutation when liveSubscribe is true
        data-point-id={statePvKey || undefined}
        className={[stateClass, isSelected ? 'io-selected' : ''].filter(Boolean).join(' ')}
        onClick={(e) => handleNodeClick(node, e)}
        style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
      >
        {svgContent && (
          <g dangerouslySetInnerHTML={{ __html: svgContent }} />
        )}
        {composablePartElements}
        {textZoneElements}
        {sidecarValueOverlay}
        {sidecarAlarmOverlay}
        {node.children.map((child) => renderDisplayElement(child, child.transform.position, sidecar?.vesselInteriorPath))}
      </g>
    )
  }

  function renderAnnotation(node: Annotation): React.ReactElement | null {
    const { config } = node
    const clickProps = {
      onClick: (e: React.MouseEvent) => handleNodeClick(node, e),
      style: { cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined } as React.CSSProperties,
    }
    const gBase = {
      key: node.id,
      transform: getTransformAttr(node),
      opacity: node.opacity,
      'data-node-id': node.id,
      'data-lod': '0',
    }

    if (config.annotationType === 'border') {
      return (
        <g {...gBase} {...clickProps}>
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
        <g {...gBase} {...clickProps}>
          <text fontFamily="Inter" fontSize={config.fontSize} fill={config.fill}>{config.text}</text>
        </g>
      )
    }

    if (config.annotationType === 'dimension_line') {
      const cfg = config as DimensionLineConfig
      const sx = cfg.startPoint.x
      const sy = cfg.startPoint.y
      const ex = cfg.endPoint.x
      const ey = cfg.endPoint.y
      // Determine if primarily horizontal or vertical
      const isHoriz = Math.abs(ex - sx) >= Math.abs(ey - sy)
      // The dimension line is offset perpendicularly from the measured object
      const off = cfg.offset ?? 0
      // For a horizontal dimension: offset in Y; for vertical: offset in X
      const dlx1 = isHoriz ? sx : sx + off
      const dly1 = isHoriz ? sy + off : sy
      const dlx2 = isHoriz ? ex : ex + off
      const dly2 = isHoriz ? ey + off : ey
      // Extension lines (short perpendicular lines from object to dimension line)
      const extLen = 6
      const ext1x1 = isHoriz ? sx : sx
      const ext1y1 = isHoriz ? sy : sy
      const ext1x2 = isHoriz ? dlx1 : dlx1
      const ext1y2 = isHoriz ? dly1 + extLen : dly1
      const ext2x1 = isHoriz ? ex : ex
      const ext2y1 = isHoriz ? ey : ey
      const ext2x2 = isHoriz ? dlx2 : dlx2
      const ext2y2 = isHoriz ? dly2 + extLen : dly2
      // Arrow tick marks at ends of dimension line
      const tickLen = 4
      const midX = (dlx1 + dlx2) / 2
      const midY = (dly1 + dly2) / 2
      return (
        <g {...gBase} {...clickProps}>
          {/* Extension lines */}
          <line x1={ext1x1} y1={ext1y1} x2={ext1x2} y2={ext1y2} stroke={cfg.color} strokeWidth={1} />
          <line x1={ext2x1} y1={ext2y1} x2={ext2x2} y2={ext2y2} stroke={cfg.color} strokeWidth={1} />
          {/* Main dimension line */}
          <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke={cfg.color} strokeWidth={1} />
          {/* Tick marks at ends */}
          {isHoriz
            ? <>
                <line x1={dlx1} y1={dly1 - tickLen} x2={dlx1} y2={dly1 + tickLen} stroke={cfg.color} strokeWidth={1} />
                <line x1={dlx2} y1={dly2 - tickLen} x2={dlx2} y2={dly2 + tickLen} stroke={cfg.color} strokeWidth={1} />
              </>
            : <>
                <line x1={dlx1 - tickLen} y1={dly1} x2={dlx1 + tickLen} y2={dly1} stroke={cfg.color} strokeWidth={1} />
                <line x1={dlx2 - tickLen} y1={dly2} x2={dlx2 + tickLen} y2={dly2} stroke={cfg.color} strokeWidth={1} />
              </>
          }
          {/* Optional label */}
          {cfg.label && (
            <text
              x={midX}
              y={isHoriz ? midY - 4 : midY}
              textAnchor="middle"
              dominantBaseline={isHoriz ? 'auto' : 'central'}
              fontFamily="Inter"
              fontSize={cfg.fontSize ?? 10}
              fill={cfg.color}
            >
              {cfg.label}
            </text>
          )}
        </g>
      )
    }

    if (config.annotationType === 'north_arrow') {
      const cfg = config as NorthArrowConfig
      const sz = cfg.size ?? 40
      const cx = sz / 2
      const cy = sz / 2
      const r = sz / 2 - 2
      if (cfg.style === 'compass') {
        // Compass rose: circle outline + N/S/E/W labels + cardinal tick marks
        return (
          <g {...gBase} {...clickProps}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={cfg.color} strokeWidth={1} />
            {/* Cardinal ticks */}
            <line x1={cx} y1={cy - r} x2={cx} y2={cy - r + 6} stroke={cfg.color} strokeWidth={1.5} />
            <line x1={cx} y1={cy + r} x2={cx} y2={cy + r - 6} stroke={cfg.color} strokeWidth={1.5} />
            <line x1={cx - r} y1={cy} x2={cx - r + 6} y2={cy} stroke={cfg.color} strokeWidth={1.5} />
            <line x1={cx + r} y1={cy} x2={cx + r - 6} y2={cy} stroke={cfg.color} strokeWidth={1.5} />
            {/* N/S/E/W labels */}
            <text x={cx} y={cy - r - 3} textAnchor="middle" dominantBaseline="auto" fontFamily="Inter" fontSize={Math.max(8, sz * 0.2)} fontWeight="bold" fill={cfg.color}>N</text>
            <text x={cx} y={cy + r + 3} textAnchor="middle" dominantBaseline="hanging" fontFamily="Inter" fontSize={Math.max(8, sz * 0.18)} fill={cfg.color}>S</text>
            <text x={cx + r + 3} y={cy} textAnchor="start" dominantBaseline="central" fontFamily="Inter" fontSize={Math.max(8, sz * 0.18)} fill={cfg.color}>E</text>
            <text x={cx - r - 3} y={cy} textAnchor="end" dominantBaseline="central" fontFamily="Inter" fontSize={Math.max(8, sz * 0.18)} fill={cfg.color}>W</text>
          </g>
        )
      }
      // Simple: upward-pointing arrow (triangle + stem)
      const arrowH = sz * 0.55
      const arrowW = sz * 0.28
      const stemW = sz * 0.1
      const stemH = sz * 0.3
      const tipY = cy - arrowH / 2
      const baseY = tipY + arrowH
      return (
        <g {...gBase} {...clickProps}>
          {/* Triangle head */}
          <polygon
            points={`${cx},${tipY} ${cx - arrowW / 2},${baseY} ${cx + arrowW / 2},${baseY}`}
            fill={cfg.color}
            stroke={cfg.color}
            strokeWidth={1}
          />
          {/* Stem */}
          <rect
            x={cx - stemW / 2}
            y={baseY}
            width={stemW}
            height={stemH}
            fill={cfg.color}
          />
          {/* N label above arrow tip */}
          <text x={cx} y={tipY - 3} textAnchor="middle" dominantBaseline="auto" fontFamily="Inter" fontSize={Math.max(8, sz * 0.2)} fontWeight="bold" fill={cfg.color}>N</text>
        </g>
      )
    }

    if (config.annotationType === 'legend') {
      const cfg = config as LegendConfig
      const padding = 8
      const rowH = (cfg.fontSize ?? 12) + 6
      const symbolW = 20
      const symbolH = cfg.fontSize ?? 12
      const textOffset = symbolW + 6
      const boxH = padding * 2 + cfg.entries.length * rowH
      const boxW = node.width ?? 160
      return (
        <g {...gBase} {...clickProps}>
          {/* Background box */}
          <rect
            x={0} y={0}
            width={boxW} height={boxH}
            rx={4}
            fill={cfg.backgroundColor ?? '#1E1E2E'}
            stroke={cfg.borderColor ?? '#3F3F46'}
            strokeWidth={1}
          />
          {/* Legend entries */}
          {cfg.entries.map((entry, i) => {
            const rowY = padding + i * rowH
            const symY = rowY + rowH / 2
            return (
              <g key={i}>
                {entry.symbol === 'line' && (
                  <line x1={padding} y1={symY} x2={padding + symbolW} y2={symY} stroke={entry.color} strokeWidth={2} />
                )}
                {entry.symbol === 'rect' && (
                  <rect x={padding} y={symY - symbolH / 2} width={symbolW} height={symbolH} fill={entry.color} />
                )}
                {entry.symbol === 'circle' && (
                  <circle cx={padding + symbolW / 2} cy={symY} r={symbolH / 2} fill={entry.color} />
                )}
                <text
                  x={padding + textOffset}
                  y={symY}
                  dominantBaseline="central"
                  fontFamily="Inter"
                  fontSize={cfg.fontSize ?? 12}
                  fill="#E4E4E7"
                >
                  {entry.label}
                </text>
              </g>
            )
          })}
        </g>
      )
    }

    if (config.annotationType === 'section_break') {
      const cfg = config as SectionBreakConfig
      const w = canvas.width
      const dashArray = cfg.style === 'dotted' ? '2 4' : undefined
      if (cfg.style === 'space') {
        // Two lighter lines with a gap between them
        return (
          <g {...gBase} {...clickProps}>
            <line x1={0} y1={0} x2={w} y2={0} stroke={cfg.color} strokeWidth={cfg.thickness ?? 1} opacity={0.5} />
            <line x1={0} y1={cfg.thickness ?? 4} x2={w} y2={cfg.thickness ?? 4} stroke={cfg.color} strokeWidth={cfg.thickness ?? 1} opacity={0.5} />
          </g>
        )
      }
      return (
        <g {...gBase} {...clickProps}>
          <line
            x1={0} y1={0} x2={w} y2={0}
            stroke={cfg.color}
            strokeWidth={cfg.thickness ?? 1}
            strokeDasharray={dashArray}
          />
        </g>
      )
    }

    if (config.annotationType === 'page_break') {
      const w = canvas.width
      return (
        <g {...gBase} {...clickProps}>
          <line
            x1={0} y1={0} x2={w} y2={0}
            stroke="#6B7280"
            strokeWidth={1}
            strokeDasharray="8 4"
          />
          <text x={w / 2} y={-4} textAnchor="middle" dominantBaseline="auto" fontFamily="Inter" fontSize={9} fill="#6B7280" opacity={0.7}>
            page break
          </text>
        </g>
      )
    }

    if (config.annotationType === 'header') {
      const cfg = config as HeaderConfig
      const w = canvas.width
      const h = cfg.height ?? 40
      const textX = cfg.textAlign === 'left' ? 12 : cfg.textAlign === 'right' ? w - 12 : w / 2
      const anchor = cfg.textAlign === 'left' ? 'start' : cfg.textAlign === 'right' ? 'end' : 'middle'
      return (
        <g {...gBase} {...clickProps}>
          <rect x={0} y={0} width={w} height={h} fill="var(--io-surface-raised, #27272A)" stroke="var(--io-border, #3F3F46)" strokeWidth={1} />
          <text
            x={textX}
            y={h / 2}
            textAnchor={anchor}
            dominantBaseline="central"
            fontFamily="Inter"
            fontSize={cfg.fontSize ?? 13}
            fill="#E4E4E7"
          >
            {cfg.content}
          </text>
        </g>
      )
    }

    if (config.annotationType === 'footer') {
      const cfg = config as FooterConfig
      const w = canvas.width
      const h = cfg.height ?? 40
      const footerY = canvas.height - h
      const textX = cfg.textAlign === 'left' ? 12 : cfg.textAlign === 'right' ? w - 12 : w / 2
      const anchor = cfg.textAlign === 'left' ? 'start' : cfg.textAlign === 'right' ? 'end' : 'middle'
      return (
        <g {...gBase} {...clickProps}>
          <rect x={0} y={footerY} width={w} height={h} fill="var(--io-surface-raised, #27272A)" stroke="var(--io-border, #3F3F46)" strokeWidth={1} />
          <text
            x={textX}
            y={footerY + h / 2}
            textAnchor={anchor}
            dominantBaseline="central"
            fontFamily="Inter"
            fontSize={cfg.fontSize ?? 13}
            fill="#E4E4E7"
          >
            {cfg.content}
          </text>
        </g>
      )
    }

    // Fallback: visible placeholder for any unrecognized annotation type
    return (
      <g {...gBase} {...clickProps}>
        <rect x={0} y={0} width={node.width ?? 80} height={node.height ?? 24} rx={2} fill="none" stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 2" />
        <text x={4} y={12} fontFamily="Inter" fontSize={9} fill="#F59E0B">{node.annotationType}</text>
      </g>
    )
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
    let el: React.ReactElement | null
    switch (node.type) {
      case 'symbol_instance': el = renderSymbolInstance(node as SymbolInstance); break
      case 'display_element': el = renderDisplayElement(node as DisplayElement); break
      case 'primitive': el = renderPrimitive(node as Primitive); break
      case 'pipe': el = renderPipe(node as Pipe); break
      case 'text_block': el = renderTextBlock(node as TextBlock); break
      case 'image': el = renderImage(node as ImageNode); break
      case 'embedded_svg': el = renderEmbeddedSvg(node as EmbeddedSvgNode); break
      case 'annotation': el = renderAnnotation(node as Annotation); break
      case 'group': el = renderGroup(node as Group); break
      case 'stencil': el = renderStencil(node as Stencil); break
      case 'widget': return null  // Widgets render in HTML overlay
      case 'graphic_document': return null
      default: return null
    }
    // Wrap with LOD attribute if specified so CSS can hide low-detail elements
    if (el && node.lodLevel && node.lodLevel > 1) {
      return <g key={`lod-${node.id}`} data-lod={node.lodLevel}>{el}</g>
    }
    return el
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
      ref={containerDivRef}
      className={['io-canvas-container', `lod-${lodLevel}`, className].filter(Boolean).join(' ')}
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
        preserveAspectRatio={preserveAspectRatio}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shared pattern definitions — OOS hatch (spec §Shape Library: Operational State CSS) */}
        <defs>
          <pattern id="io-hatch-pattern" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#52525B" strokeWidth="2" />
          </pattern>
        </defs>
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

const ALARM_PRIORITY_NAMES: Record<number, string> = {
  1: 'critical', 2: 'high', 3: 'medium', 4: 'advisory', 5: 'custom',
}

function formatValue(raw: string | number | null, fmt: string): string {
  if (raw === null || raw === undefined) return '---'
  if (typeof raw === 'number') {
    if (fmt === '%auto') {
      const abs = Math.abs(raw)
      if (!isFinite(raw)) return String(raw)
      if (abs === 0) return '0'
      if (abs >= 10000) return raw.toFixed(0)
      if (abs >= 1000) return raw.toFixed(1)
      if (abs >= 100) return raw.toFixed(2)
      if (abs >= 10) return raw.toFixed(3)
      if (abs >= 1) return raw.toFixed(3)
      return parseFloat(raw.toPrecision(3)).toString()
    }
    const fMatch = fmt.match(/^%\.(\d+)f/)
    if (fMatch) return raw.toFixed(parseInt(fMatch[1]))
    if (/^%\.?0?d$|^%d$/.test(fmt)) return Math.round(raw).toString()
    const gMatch = fmt.match(/^%\.(\d+)g/)
    if (gMatch) return parseFloat(raw.toPrecision(parseInt(gMatch[1]))).toString()
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

// ---- Direct DOM mutation (spec §5.1 Real-Time Update Pipeline) ----
// Called from the rAF drain loop — no React involved.
// Updates SVG child elements in-place using data-role attributes as anchors.

function applyPointValue(
  el: SVGGElement,
  displayType: string,
  config: unknown,
  pv: WsPointValue,
): void {
  const value = pv.value
  const quality = pv.quality
  const isStale = pv.stale ?? false
  const isCommFail = quality === 'comm_fail'
  const isBad = quality === 'bad' && !isCommFail

  switch (displayType) {
    case 'text_readout': {
      const cfg = config as TextReadoutConfig
      const isUncertain = quality === 'uncertain'
      const isManual = pv.manual ?? false

      // Value text
      const rawValueStr = isCommFail ? 'COMM' : isBad ? '????' : formatValue(value, cfg.valueFormat)
      const valueColor = isCommFail ? DE_COLORS.textMuted : isBad ? ALARM_COLORS[1] : DE_COLORS.textSecondary
      const textEl = el.querySelector<SVGTextElement>('[data-role="value"]')
      if (textEl) {
        textEl.textContent = rawValueStr
        textEl.setAttribute('fill', valueColor)
      }

      // Box rect (fill, stroke, strokeDasharray, strokeWidth)
      const boxFill = isCommFail ? DE_COLORS.displayZoneInactive : DE_COLORS.surfaceElevated
      const boxStroke = isBad ? ALARM_COLORS[1] : isCommFail ? DE_COLORS.borderStrong : DE_COLORS.border
      const strokeDash = (isBad || isStale) ? '4 2' : isUncertain ? '2 2' : ''
      const strokeWidth = (isBad || isCommFail) ? '2' : '1'
      const rectEl = el.querySelector<SVGRectElement>('[data-role="box"]')
      if (rectEl) {
        rectEl.setAttribute('fill', boxFill)
        rectEl.setAttribute('stroke', boxStroke)
        rectEl.setAttribute('stroke-width', strokeWidth)
        if (strokeDash) {
          rectEl.setAttribute('stroke-dasharray', strokeDash)
        } else {
          rectEl.removeAttribute('stroke-dasharray')
        }
      }

      // Opacity (stale = 60%)
      el.style.opacity = isStale ? '0.6' : ''

      // Manual badge — find or create
      let badge = el.querySelector<SVGTextElement>('[data-role="manual-badge"]')
      if (isManual) {
        if (!badge) {
          badge = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          badge.setAttribute('data-role', 'manual-badge')
          badge.setAttribute('text-anchor', 'end')
          badge.setAttribute('dominant-baseline', 'hanging')
          badge.setAttribute('font-family', 'Inter')
          badge.setAttribute('font-size', '7')
          badge.setAttribute('font-weight', '700')
          badge.setAttribute('fill', DE_COLORS.manualBadge)
          el.appendChild(badge)
        }
        // Position at top-right — read width from box rect
        const w = rectEl ? Number(rectEl.getAttribute('width') ?? 60) : 60
        badge.setAttribute('x', String(w - 2))
        badge.setAttribute('y', '2')
        badge.textContent = 'M'
        badge.style.display = ''
      } else if (badge) {
        badge.style.display = 'none'
      }
      break
    }

    case 'analog_bar': {
      const cfg = config as AnalogBarConfig
      const numValue = typeof value === 'number' ? value : null
      const alarmPri = pv.alarmPriority as (1|2|3|4|5) | null | undefined
      const { barWidth: bw, barHeight: bh } = cfg
      const range = cfg.rangeHi - cfg.rangeLo || 1
      const pct = numValue !== null ? Math.max(0, Math.min(1, (numValue - cfg.rangeLo) / range)) : 0
      const pointerY = (1 - pct) * bh
      const pointer = el.querySelector<SVGPolygonElement>('[data-role="pointer"]')
      if (pointer) {
        if (numValue !== null) {
          pointer.setAttribute('points', `${bw},${pointerY - 3} ${bw + 6},${pointerY} ${bw},${pointerY + 3}`)
          pointer.style.display = ''
        } else {
          pointer.style.display = 'none'
        }
      }
      const pointerLine = el.querySelector<SVGLineElement>('[data-role="pointer-line"]')
      if (pointerLine) {
        if (numValue !== null) {
          pointerLine.setAttribute('y1', String(pointerY))
          pointerLine.setAttribute('y2', String(pointerY))
          pointerLine.style.display = ''
        } else {
          pointerLine.style.display = 'none'
        }
      }
      const numericText = el.querySelector<SVGTextElement>('[data-role="numeric"]')
      if (numericText) {
        if (numValue !== null) {
          numericText.textContent = numValue.toFixed(1)
          numericText.style.display = ''
        } else {
          numericText.style.display = 'none'
        }
      }

      // Determine which zone the current value falls in
      const { hh, h, l, ll } = cfg.thresholds ?? {}
      const valueZone = (() => {
        if (numValue === null) return null
        if (hh !== undefined && numValue >= hh) return 'hh'
        if (h  !== undefined && numValue >= h)  return 'h'
        if (ll !== undefined && numValue < ll)  return 'll'
        if (l  !== undefined && numValue < l)   return 'l'
        return 'normal'
      })()

      // Update zone fill colors via DOM mutation
      const zoneRoles: Array<{ role: string; key: keyof typeof ZONE_FILLS; priKey: 'hhAlarmPriority' | 'hAlarmPriority' | 'lAlarmPriority' | 'llAlarmPriority' | null }> = [
        { role: 'zone-hh',     key: 'hh',     priKey: 'hhAlarmPriority' },
        { role: 'zone-h',      key: 'h',      priKey: 'hAlarmPriority'  },
        { role: 'zone-normal', key: 'normal', priKey: null               },
        { role: 'zone-l',      key: 'l',      priKey: 'lAlarmPriority'  },
        { role: 'zone-ll',     key: 'll',     priKey: 'llAlarmPriority' },
      ]
      for (const { role, key, priKey } of zoneRoles) {
        const zoneEl = el.querySelector<SVGRectElement>(`[data-role="${role}"]`)
        if (!zoneEl) continue
        let fill = ZONE_FILLS[key]
        if (priKey && valueZone === key && alarmPri && cfg.thresholds?.[priKey]) {
          fill = ALARM_COLORS[cfg.thresholds[priKey]!] ?? fill
        }
        zoneEl.setAttribute('fill', fill)
      }
      break
    }

    case 'digital_status': {
      const cfg = config as DigitalStatusConfig
      const rawVal = value !== null ? String(value) : null
      const label = rawVal !== null ? (cfg.stateLabels[rawVal] ?? rawVal) : '---'
      const isNormal = rawVal === null || cfg.normalStates.includes(rawVal)
      const fill = isNormal ? DE_COLORS.displayZoneInactive : (ALARM_COLORS[cfg.abnormalPriority] ?? ALARM_COLORS[1])
      const textColor = isNormal ? DE_COLORS.textSecondary : DE_COLORS.textPrimary
      const bgRect = el.querySelector<SVGRectElement>('[data-role="bg"]')
      if (bgRect) bgRect.setAttribute('fill', fill)
      const textEl = el.querySelector<SVGTextElement>('[data-role="value"]')
      if (textEl) {
        textEl.textContent = label
        textEl.setAttribute('fill', textColor)
      }
      break
    }

    case 'fill_gauge': {
      const cfg = config as FillGaugeConfig
      const numValue = typeof value === 'number' ? value : null
      const range = cfg.rangeHi - cfg.rangeLo || 1
      const pct = numValue !== null ? Math.max(0, Math.min(1, (numValue - cfg.rangeLo) / range)) : 0
      const bh = cfg.barHeight ?? 90
      if (cfg.mode === 'vessel_overlay') {
        const fillH = pct * bh
        const fillY = bh - fillH
        const fillRect = el.querySelector<SVGRectElement>('[data-role="fill"]')
        if (fillRect) {
          fillRect.setAttribute('y', String(fillY))
          fillRect.setAttribute('height', String(fillH))
        }
      } else {
        const fillH = pct * (bh - 2)
        const fillY = bh - 1 - fillH
        const fillRect = el.querySelector<SVGRectElement>('[data-role="fill"]')
        if (fillRect) {
          fillRect.setAttribute('y', String(fillY))
          fillRect.setAttribute('height', String(fillH))
        }
      }
      const textEl = el.querySelector<SVGTextElement>('[data-role="value"]')
      if (textEl) textEl.textContent = `${(pct * 100).toFixed(0)}%`
      break
    }

    case 'sparkline': {
      const cfg = config as SparklineConfig
      const numVal = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : NaN)
      if (!isFinite(numVal)) break

      // Rolling history stored on the DOM element as [timestamp_ms, value] pairs.
      // Time-windowed: entries older than timeWindowMinutes are evicted on each update.
      type SparkEntry = [number, number]
      const elAny = el as unknown as { _sparkHistory?: SparkEntry[]; _sparkLastDraw?: number }
      if (!elAny._sparkHistory) elAny._sparkHistory = []
      const history = elAny._sparkHistory
      const now = pv.timestamp ? new Date(pv.timestamp).getTime() : Date.now()
      history.push([now, numVal])

      // Evict entries outside the configured time window
      const windowMs = (cfg.timeWindowMinutes ?? 30) * 60 * 1000
      const cutoff = now - windowMs
      let evictTo = 0
      while (evictTo < history.length && history[evictTo][0] < cutoff) evictTo++
      if (evictTo > 0) history.splice(0, evictTo)

      // Throttle redraws to one per slot — only update the polyline when enough
      // time has passed that a new slot boundary has been crossed.
      const slotMs = windowMs / (cfg.dataPoints ?? 60)
      const lastDraw = elAny._sparkLastDraw ?? 0
      if (now - lastDraw < slotMs) break
      elAny._sparkLastDraw = now

      const W = cfg.sparkWidth ?? 110
      const H = cfg.sparkHeight ?? 18
      const targetPoints = cfg.dataPoints ?? 60
      const pad = 2

      // Downsample to targetPoints using uniform time-based index selection
      const nums = history.map(([, v]) => v).filter((v) => isFinite(v))
      const sampled = nums.length <= targetPoints ? nums : (() => {
        const out: number[] = []
        for (let i = 0; i < targetPoints; i++) {
          out.push(nums[Math.round(i * (nums.length - 1) / (targetPoints - 1))])
        }
        return out
      })()

      const polyline = el.querySelector<SVGPolylineElement>('polyline')
      const flatLine = el.querySelector<SVGLineElement>('line')

      if (sampled.length >= 2) {
        let lo: number, hi: number
        if (cfg.scaleMode === 'fixed' && cfg.fixedRangeLo !== undefined && cfg.fixedRangeHi !== undefined) {
          lo = cfg.fixedRangeLo; hi = cfg.fixedRangeHi
        } else {
          lo = Math.min(...sampled); hi = Math.max(...sampled)
        }
        const range = hi - lo || 1
        const pts = sampled.map((v, i) => {
          const px = pad + (i / (sampled.length - 1)) * (W - pad * 2)
          const py = pad + (1 - (v - lo) / range) * (H - pad * 2)
          return `${px.toFixed(1)},${py.toFixed(1)}`
        }).join(' ')

        const alarmPri = pv.alarmPriority as (1|2|3|4|5) | null | undefined
        const strokeColor = alarmPri ? (ALARM_COLORS[alarmPri] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary

        if (polyline) {
          polyline.setAttribute('points', pts)
          polyline.setAttribute('stroke', strokeColor)
          polyline.style.display = ''
        }
        if (flatLine) flatLine.style.display = 'none'
      }
      break
    }

    case 'symbol_state': {
      // Update operational state CSS class on the symbol instance g element
      const stateVal = String(value).toLowerCase()
      let newClass = ''
      if (['running', '1', 'true', 'on'].includes(stateVal)) newClass = 'io-running'
      else if (['fault', 'error', 'fail'].includes(stateVal)) newClass = 'io-fault'
      else if (['transitioning', 'starting', 'stopping'].includes(stateVal)) newClass = 'io-transitioning'
      else if (['oos', 'maintenance'].includes(stateVal)) newClass = 'io-oos'
      el.classList.remove('io-running', 'io-fault', 'io-transitioning', 'io-oos')
      if (newClass) el.classList.add(newClass)

      // Update sidecar value overlay text
      const sidecarValueText = el.querySelector<SVGTextElement>('[data-role="sidecar-value"]')
      if (sidecarValueText) {
        const alarmPri = pv.alarmPriority as (1|2|3|4|5) | undefined
        const valueStr = isCommFail ? 'COMM' : isBad ? '????' : formatValue(value, '%auto')
        sidecarValueText.textContent = valueStr
        sidecarValueText.setAttribute('fill', alarmPri ? (ALARM_COLORS[alarmPri] ?? DE_COLORS.textSecondary) : DE_COLORS.textSecondary)
      }

      // Update sidecar alarm indicator overlay
      const sidecarAlarmG = el.querySelector<SVGGElement>('[data-role="sidecar-alarm"]')
      if (sidecarAlarmG) {
        const alarmPri = pv.alarmPriority as (1|2|3|4|5) | undefined
        if (alarmPri) {
          sidecarAlarmG.style.display = ''
          const color = ALARM_COLORS[alarmPri] ?? ALARM_COLORS[1]
          const numText = sidecarAlarmG.querySelector<SVGTextElement>('text')
          if (numText) { numText.textContent = String(alarmPri); numText.setAttribute('fill', color) }
        } else {
          sidecarAlarmG.style.display = 'none'
        }
      }
      break
    }
  }
}
