import { useMemo, useState, useRef, useEffect, useCallback } from 'react'

import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../../api/graphics'
import { pointsApi } from '../../../api/points'
import { SceneRenderer } from '../../../shared/graphics/SceneRenderer'
import type { PointValue as ScenePointValue } from '../../../shared/graphics/SceneRenderer'
import { useWebSocketRaf, wsManager, detectDeviceType } from '../../../shared/hooks/useWebSocket'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import type { PointValue as WsPointValue } from '../../../shared/hooks/useWebSocket'
import { useHistoricalValues } from '../../../shared/hooks/useHistoricalValues'
import { usePlaybackStore } from '../../../store/playback'
import TileGraphicViewer from '../../../shared/components/TileGraphicViewer'
import PointContextMenu from '../../../shared/components/PointContextMenu'
import PointDetailPanel from '../../../shared/components/PointDetailPanel'
import type { SceneNode, GraphicDocument, ViewportState } from '../../../shared/types/graphics'

// ── Tooltip state shape ──────────────────────────────────────────────────────

interface PointTooltip {
  x: number
  y: number
  pointId: string
  value: string
  units: string
  quality: string
  timestamp: string
}

// ── Walk up the DOM tree to find the nearest ancestor with data-point-id ─────

function findPointId(target: EventTarget | null): string | null {
  let el = target as HTMLElement | null
  while (el) {
    if (el.dataset?.pointId) return el.dataset.pointId
    // Also handle SVG elements (which may use getAttribute)
    const attr = el.getAttribute?.('data-point-id')
    if (attr) return attr
    el = el.parentElement
  }
  return null
}

interface Props {
  graphicId: string
  onNavigate?: (targetGraphicId: string) => void
  preserveAspectRatio?: boolean
}

/** Walk a SceneNode tree and collect every bound pointId or expressionId. */
function extractPointIds(nodes: SceneNode[]): string[] {
  const ids = new Set<string>()

  function walk(n: SceneNode) {
    // Direct binding (DisplayElement, TextBlock, AnalogBar, etc.)
    // Also picks up expressionId — the broker treats expression results as virtual points
    if ('binding' in n && n.binding && typeof n.binding === 'object') {
      const b = n.binding as { pointId?: string; expressionId?: string }
      if (b.pointId) ids.add(b.pointId)
      if (b.expressionId) ids.add(b.expressionId)
    }
    // Series bindings (TrendWidget)
    if ('series' in n && Array.isArray(n.series)) {
      for (const s of n.series as { binding?: { pointId?: string; expressionId?: string } }[]) {
        if (s.binding?.pointId) ids.add(s.binding.pointId)
        if (s.binding?.expressionId) ids.add(s.binding.expressionId)
      }
    }
    // Slice bindings (PieChart)
    if ('slices' in n && Array.isArray(n.slices)) {
      for (const s of n.slices as { binding?: { pointId?: string; expressionId?: string } }[]) {
        if (s.binding?.pointId) ids.add(s.binding.pointId)
        if (s.binding?.expressionId) ids.add(s.binding.expressionId)
      }
    }
    // Recurse into child nodes
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode)
    }
  }

  for (const n of nodes) walk(n)
  return Array.from(ids)
}

/** Walk a SceneNode tree and collect pointIds for sparkline display elements. */
function extractSparklinePointIds(nodes: SceneNode[]): string[] {
  const ids = new Set<string>()
  function walk(n: SceneNode) {
    if (
      n.type === 'display_element' &&
      'displayType' in n &&
      (n as { displayType: string }).displayType === 'sparkline' &&
      'binding' in n
    ) {
      const pid = (n.binding as { pointId?: string }).pointId
      if (pid) ids.add(pid)
    }
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode)
    }
  }
  for (const n of nodes) walk(n)
  return Array.from(ids)
}

const isPhone = detectDeviceType() === 'phone'
const isTablet = detectDeviceType() === 'tablet'

/** Extract point bindings with fractional positions for TileGraphicViewer overlays. */
function extractTileBindings(doc: GraphicDocument) {
  const { width, height } = doc.canvas
  const out: Array<{ pointId: string; label?: string; x: number; y: number }> = []

  function walk(n: SceneNode) {
    if ('binding' in n && n.binding && typeof n.binding === 'object') {
      const pid = (n.binding as { pointId?: string }).pointId
      if (pid) {
        out.push({
          pointId: pid,
          label: n.name,
          x: n.transform.position.x / width,
          y: n.transform.position.y / height,
        })
      }
    }
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) walk(child as SceneNode)
    }
  }

  for (const n of doc.children) walk(n)
  return out
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export default function GraphicPane({ graphicId, onNavigate, preserveAspectRatio = true }: Props) {
  const [statusView, setStatusView] = useState(false)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['graphic', graphicId],
    queryFn: async () => {
      const result = await graphicsApi.get(graphicId)
      if (result.success) return result.data.data
      throw new Error('Failed to load graphic')
    },
    staleTime: 30_000,
  })

  // Derive the list of point IDs once the graphic is loaded
  const pointIds = useMemo(
    () => (data ? extractPointIds(data.scene_data.children ?? []) : []),
    [data],
  )

  // Derive sparkline point IDs for history fetching
  const sparklinePointIds = useMemo(
    () => (data ? extractSparklinePointIds(data.scene_data.children ?? []) : []),
    [data],
  )

  // Fetch sparkline history — last 30 minutes, 14 samples, refresh every 60s
  const { data: sparklineHistories } = useQuery({
    queryKey: ['sparkline-history', sparklinePointIds],
    queryFn: async () => {
      if (sparklinePointIds.length === 0) return new Map<string, number[]>()
      const end = new Date().toISOString()
      const start = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const result = await pointsApi.historyBatch(sparklinePointIds, { start, end, limit: 14 })
      if (!result.success) return new Map<string, number[]>()
      const map = new Map<string, number[]>()
      for (const r of result.data) {
        const values = r.rows.map((row) => row.value ?? row.avg).filter((v): v is number => typeof v === 'number')
        map.set(r.point_id, values)
      }
      return map
    },
    staleTime: 60_000,
    enabled: sparklinePointIds.length > 0,
  })

  const { mode: playbackMode, timestamp: playbackTs } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  // Phone path only: RAF-coalesced subscription feeding TileGraphicViewer (React prop)
  // Desktop live path: SceneRenderer subscribes to wsManager directly (liveSubscribe=true)
  const { values: wsValues } = useWebSocketRaf(isPhone && !isHistorical ? pointIds : [])

  // Fetch historical values at playback timestamp (only when in historical mode)
  const historicalValues = useHistoricalValues(isHistorical ? pointIds : [], isHistorical ? playbackTs : undefined)

  // Adapt wire-format PointValue → SceneRenderer PointValue (used by phone path + historical)
  const pointValues = useMemo(() => {
    const source = isHistorical ? historicalValues : wsValues
    const out = new Map<string, ScenePointValue>()
    for (const [id, pv] of source) {
      out.set(id, {
        pointId: pv.pointId,
        value: pv.value,
        quality: (pv.quality === 'good' || pv.quality === 'bad' || pv.quality === 'uncertain')
          ? pv.quality
          : undefined,
      })
    }
    return out
  }, [isHistorical, wsValues, historicalValues])

  // Tooltip value ref — updated by direct wsManager subscription (no React state → no re-renders)
  // Used by handleSvgMouseMove for desktop live mode. Historical mode reads from pointValues.
  const tooltipValuesRef = useRef<Map<string, WsPointValue>>(new Map())

  useEffect(() => {
    if (isPhone || isHistorical || pointIds.length === 0) return
    const handler = (pv: WsPointValue) => { tooltipValuesRef.current.set(pv.pointId, pv) }
    pointIds.forEach(id => wsManager.subscribe(id, handler))
    return () => { pointIds.forEach(id => wsManager.unsubscribe(id, handler)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone, isHistorical, pointIds.join(',')])

  // Phone: derive tile overlay bindings from scene node positions
  const tileBindings = useMemo(
    () => (isPhone && data ? extractTileBindings(data.scene_data) : []),
    [data],
  )

  // ── Hover tooltip state ──────────────────────────────────────────────────────

  const [tooltip, setTooltip] = useState<PointTooltip | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Point context menu state ─────────────────────────────────────────────────

  const [pointCtxMenu, setPointCtxMenu] = useState<{
    x: number
    y: number
    pointId: string
    tagName: string
    isAlarm: boolean
    isAlarmElement: boolean
  } | null>(null)

  // ── Point Detail floating panels (up to 3 concurrent per spec §7.2) ──────────

  const MAX_POINT_DETAIL_PANELS = 3
  const [pointDetailPanels, setPointDetailPanels] = useState<Array<{ id: string; pointId: string; x: number; y: number }>>([])

  function openPointDetail(pointId: string, x: number, y: number) {
    setPointDetailPanels(prev => {
      // Don't open duplicate for same point
      if (prev.some(p => p.pointId === pointId)) return prev
      const entry = { id: crypto.randomUUID(), pointId, x, y }
      // Enforce max 3 concurrent — evict oldest
      const next = prev.length >= MAX_POINT_DETAIL_PANELS ? prev.slice(1) : prev
      return [...next, entry]
    })
  }

  function closePointDetail(id: string) {
    setPointDetailPanels(prev => prev.filter(p => p.id !== id))
  }

  // ── Zoom / Pan state ────────────────────────────────────────────────────────

  const [zoom, setZoom] = useState(1.0)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [screenWidth, setScreenWidth] = useState(0)
  const [screenHeight, setScreenHeight] = useState(0)

  // Middle-click pan tracking
  const panDragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  // Measure container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScreenWidth(entry.contentRect.width)
        setScreenHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    setScreenWidth(el.clientWidth)
    setScreenHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // ── Point hover tooltip handlers ─────────────────────────────────────────────

  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target)
      if (!pointId) {
        // Moved off a point-bound element — cancel pending tooltip but don't hide existing
        if (tooltipTimerRef.current) {
          clearTimeout(tooltipTimerRef.current)
          tooltipTimerRef.current = null
        }
        return
      }
      // Reset timer if we're already hovering a point
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
      const clientX = e.clientX
      const clientY = e.clientY
      tooltipTimerRef.current = setTimeout(() => {
        // Live mode: read from the ref (no re-render dependency)
        // Historical mode: read from the React state pointValues map
        const livePv = !isHistorical ? tooltipValuesRef.current.get(pointId) : undefined
        const reactPv = isHistorical ? pointValues.get(pointId) : undefined
        const value = livePv?.value ?? reactPv?.value
        const quality = livePv?.quality ?? reactPv?.quality
        setTooltip({
          x: clientX,
          y: clientY,
          pointId,
          value: value !== null && value !== undefined ? String(value) : '---',
          units: '',
          quality: quality ?? 'unknown',
          timestamp: new Date().toLocaleTimeString(),
        })
      }, 500)
    },
    // pointValues only needed for historical mode; live mode reads from ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHistorical, pointValues],
  )

  // Note: Per-element mouse-leave is handled at the container level via handleContainerMouseLeave.
  // Individual element leave could be hooked here if needed in future.

  const handleContainerMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
    setTooltip(null)
  }, [])

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    }
  }, [])

  // ── Point right-click context menu handler ───────────────────────────────────

  const handleSvgContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target)
      if (!pointId) return
      // Point found — show point context menu instead of pane context menu
      e.preventDefault()
      e.stopPropagation()
      // Resolve alarm state from cached tooltip values; tagName falls back to pointId
      // (WsPointValue does not carry tagName — the server sends pointId as the canonical identifier)
      const pv = tooltipValuesRef.current.get(pointId)
      const tagName = pointId
      const isAlarm = pv?.quality === 'alarm'
      setPointCtxMenu({ x: e.clientX, y: e.clientY, pointId, tagName, isAlarm, isAlarmElement: false })
    },
    [],
  )

  // ── Double-click on point element → open Point Detail (spec §7.2) ────────────

  const handleSvgDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target)
      if (!pointId) return
      e.preventDefault()
      e.stopPropagation()
      openPointDetail(pointId, e.clientX, e.clientY)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── Ctrl+I → open Point Detail for hovered point (spec §7.2) ─────────────────

  const lastHoveredPointRef = useRef<string | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'i' && lastHoveredPointRef.current) {
        e.preventDefault()
        openPointDetail(lastHoveredPointRef.current, window.innerWidth / 2, window.innerHeight / 2)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
      setZoom((prevZoom) => {
        const newZoom = clamp(prevZoom * zoomFactor, 0.25, 4.0)
        const canvasX = e.nativeEvent.offsetX / prevZoom + panX
        const canvasY = e.nativeEvent.offsetY / prevZoom + panY
        const newPanX = canvasX - e.nativeEvent.offsetX / newZoom
        const newPanY = canvasY - e.nativeEvent.offsetY / newZoom
        setPanX(newPanX)
        setPanY(newPanY)
        return newZoom
      })
    },
    [panX, panY],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Middle-click or Ctrl+left-click to pan
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault()
      panDragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY }
    }
  }, [panX, panY])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panDragRef.current) return
    const dx = (e.clientX - panDragRef.current.startX) / zoom
    const dy = (e.clientY - panDragRef.current.startY) / zoom
    setPanX(panDragRef.current.startPanX - dx)
    setPanY(panDragRef.current.startPanY - dy)
  }, [zoom])

  const handleMouseUp = useCallback(() => {
    panDragRef.current = null
  }, [])

  const zoomToFit = useCallback(() => {
    if (!data) return
    const cw = data.scene_data.canvas.width
    const ch = data.scene_data.canvas.height
    if (cw === 0 || ch === 0 || screenWidth === 0 || screenHeight === 0) return
    const newZoom = clamp(Math.min(screenWidth / cw, screenHeight / ch), 0.25, 4.0)
    setZoom(newZoom)
    setPanX(0)
    setPanY(0)
  }, [data, screenWidth, screenHeight])

  const resetZoom = useCallback(() => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }, [])

  const viewport: ViewportState = useMemo(() => ({
    panX,
    panY,
    zoom,
    canvasWidth: data?.scene_data.canvas.width ?? 0,
    canvasHeight: data?.scene_data.canvas.height ?? 0,
    screenWidth,
    screenHeight,
  }), [panX, panY, zoom, data, screenWidth, screenHeight])

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090B', color: '#71717A', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090B', color: '#71717A', fontSize: 13 }}>
        Failed to load graphic
      </div>
    )
  }

  // Phone: render tile-based viewer with status view toggle
  if (isPhone) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Status/Tile toggle bar */}
        <div style={{ display: 'flex', gap: 1, padding: '4px 8px', background: 'var(--io-surface-secondary)', borderBottom: '1px solid var(--io-border)', flexShrink: 0 }}>
          <button
            onClick={() => setStatusView(false)}
            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !statusView ? 'var(--io-accent)' : 'transparent', color: !statusView ? '#fff' : 'var(--io-text-muted)' }}
          >
            Map
          </button>
          <button
            onClick={() => setStatusView(true)}
            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: statusView ? 'var(--io-accent)' : 'transparent', color: statusView ? '#fff' : 'var(--io-text-muted)' }}
          >
            Status
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <TileGraphicViewer
            graphicId={graphicId}
            graphicWidth={data.scene_data.canvas.width}
            graphicHeight={data.scene_data.canvas.height}
            pointValues={pointValues}
            pointBindings={tileBindings}
            statusView={statusView}
          />
        </div>
      </div>
    )
  }

  const zoomPct = Math.round(zoom * 100)

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: panDragRef.current ? 'grabbing' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => {
        handleMouseMove(e)
        handleSvgMouseMove(e)
        // Track last hovered point for Ctrl+I shortcut
        const hovered = findPointId(e.target)
        lastHoveredPointRef.current = hovered
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp()
        handleContainerMouseLeave()
      }}
      onContextMenu={handleSvgContextMenu}
      onDoubleClick={handleSvgDoubleClick}
    >
      {isTablet ? (
        <TransformWrapper
          minScale={0.5}
          maxScale={5}
          velocityAnimation={{ sensitivity: 1, animationTime: 200 }}
          panning={{ velocityDisabled: false }}
        >
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            <SceneRenderer
              document={data.scene_data}
              pointValues={isHistorical ? pointValues : undefined}
              liveSubscribe={!isHistorical}
              sparklineHistories={sparklineHistories ?? undefined}
              onNavigate={onNavigate}
              viewport={viewport}
              preserveAspectRatio={preserveAspectRatio ? 'xMidYMid meet' : 'none'}
              style={{ width: '100%', height: '100%' }}
            />
          </TransformComponent>
        </TransformWrapper>
      ) : (
        <SceneRenderer
          document={data.scene_data}
          // Historical mode: pass REST-fetched point values for React rendering
          // Live mode: SceneRenderer subscribes to wsManager directly (liveSubscribe=true)
          pointValues={isHistorical ? pointValues : undefined}
          liveSubscribe={!isHistorical}
          sparklineHistories={sparklineHistories ?? undefined}
          onNavigate={onNavigate}
          viewport={viewport}
          preserveAspectRatio={preserveAspectRatio ? 'xMidYMid meet' : 'none'}
          style={{ width: '100%', height: '100%' }}
        />
      )}

      {/* Zoom overlay — bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          fontSize: 10,
          color: 'var(--io-text-muted)',
          background: 'rgba(0,0,0,0.4)',
          padding: '2px 5px',
          borderRadius: 3,
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span>{zoomPct}%</span>
        <button
          onClick={zoomToFit}
          title="Zoom to fit"
          style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', fontSize: 9, cursor: 'pointer', padding: '0 2px' }}
        >
          Fit
        </button>
        <button
          onClick={resetZoom}
          title="Reset zoom"
          style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', fontSize: 9, cursor: 'pointer', padding: '0 2px' }}
        >
          1:1
        </button>
      </div>

      {/* Point hover tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top: tooltip.y - 8,
            zIndex: 1500,
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 6,
            padding: '7px 11px',
            fontSize: 12,
            color: 'var(--io-text-primary)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            minWidth: 160,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 11, color: 'var(--io-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {tooltip.pointId}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 16, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {tooltip.value}
            </span>
            {tooltip.units && (
              <span style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>{tooltip.units}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: 'var(--io-text-muted)' }}>
            <span
              style={{
                color: tooltip.quality === 'good' ? '#22C55E' : tooltip.quality === 'bad' ? '#EF4444' : '#F59E0B',
              }}
            >
              {tooltip.quality}
            </span>
            <span>{tooltip.timestamp}</span>
          </div>
        </div>
      )}

      {/* Point right-click context menu — shared PointContextMenu component (spec CX-POINT-CONTEXT) */}
      {pointCtxMenu && (
        <PointContextMenu
          pointId={pointCtxMenu.pointId}
          tagName={pointCtxMenu.tagName}
          isAlarm={pointCtxMenu.isAlarm}
          isAlarmElement={pointCtxMenu.isAlarmElement}
          onPointDetail={(pid) => {
            openPointDetail(pid, pointCtxMenu.x, pointCtxMenu.y)
            setPointCtxMenu(null)
          }}
        >
          {/* Invisible fixed-position portal anchor — PointContextMenu opens at this location */}
          <span style={{ position: 'fixed', top: pointCtxMenu.y, left: pointCtxMenu.x, width: 0, height: 0 }} />
        </PointContextMenu>
      )}

      {/* Point Detail floating panels (up to 3 concurrent per spec §7.2) */}
      {pointDetailPanels.map(panel => (
        <PointDetailPanel
          key={panel.id}
          pointId={panel.pointId}
          onClose={() => closePointDetail(panel.id)}
          anchorPosition={{ x: panel.x, y: panel.y }}
        />
      ))}
    </div>
  )
}
