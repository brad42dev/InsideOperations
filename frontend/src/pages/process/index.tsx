import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { graphicsApi } from '../../api/graphics'
import { SceneRenderer } from '../../shared/graphics/SceneRenderer'
import type { PointValue as ScenePointValue } from '../../shared/graphics/SceneRenderer'
import { useWebSocket } from '../../shared/hooks/useWebSocket'
import { useHistoricalValues } from '../../shared/hooks/useHistoricalValues'
import { usePlaybackStore } from '../../store/playback'
import { bookmarksApi } from '../../api/bookmarks'
import type { ViewportState, SceneNode, DisplayElement, SymbolInstance } from '../../shared/types/graphics'
import type { DesignObjectSummary } from '../../api/graphics'
import HistoricalPlaybackBar from '../../shared/components/HistoricalPlaybackBar'
import ContextMenu from '../../shared/components/ContextMenu'
import ProcessMinimap from './ProcessMinimap'
import ProcessSidebar from './ProcessSidebar'
import type { ViewportBookmark } from './ProcessSidebar'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_GRAPHIC_ID_KEY = 'io-process-last-graphic'
const RECENT_VIEWS_KEY = 'io-process-recent-views'
const SIDEBAR_VISIBLE_KEY = 'io-process-sidebar-visible'
const MAX_RECENT = 10

// ---------------------------------------------------------------------------
// DOM walker — find nearest ancestor with data-point-id
// ---------------------------------------------------------------------------

function findPointId(target: EventTarget | null): string | null {
  let el = target as HTMLElement | null
  while (el) {
    if (el.dataset?.pointId) return el.dataset.pointId
    const attr = el.getAttribute?.('data-point-id')
    if (attr) return attr
    el = el.parentElement
  }
  return null
}

// ---------------------------------------------------------------------------
// Navigation history entry
// ---------------------------------------------------------------------------

interface NavEntry {
  graphicId: string
  name: string
  panX: number
  panY: number
  zoom: number
}

// ---------------------------------------------------------------------------
// Hover tooltip shape
// ---------------------------------------------------------------------------

interface PointTooltip {
  x: number
  y: number
  pointId: string
  value: string
  quality: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// LOD helpers
// ---------------------------------------------------------------------------

type LodLevel = 0 | 1 | 2 | 3
const LOD_NAMES: Record<LodLevel, string> = {
  0: 'Overview',
  1: 'Area',
  2: 'Unit',
  3: 'Detail',
}

function zoomToLod(zoom: number): LodLevel {
  if (zoom < 0.15) return 0
  if (zoom < 0.4) return 1
  if (zoom < 0.8) return 2
  return 3
}

// ---------------------------------------------------------------------------
// Recent views helpers
// ---------------------------------------------------------------------------

interface RecentView { id: string; name: string }

function loadRecentViews(): RecentView[] {
  try { return JSON.parse(localStorage.getItem(RECENT_VIEWS_KEY) ?? '[]') } catch { return [] }
}

function pushRecentView(id: string, name: string) {
  const views = loadRecentViews().filter((v) => v.id !== id)
  views.unshift({ id, name })
  localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(views.slice(0, MAX_RECENT)))
}

// ---------------------------------------------------------------------------
// Sidebar visibility helpers
// ---------------------------------------------------------------------------

function loadSidebarVisible(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_VISIBLE_KEY)
    return v === null ? true : v === 'true'
  } catch { return true }
}

// ---------------------------------------------------------------------------
// Viewport-visible point extraction
// ---------------------------------------------------------------------------

/** Return [width, height] estimate for a display element based on its config. */
function displayElementSize(node: DisplayElement): [number, number] {
  const cfg = node.config as unknown as Record<string, number> | undefined
  switch (node.displayType) {
    case 'text_readout': return [Math.max(cfg?.minWidth ?? 60, 80), 36]
    case 'analog_bar':   return [cfg?.barWidth ?? 20, cfg?.barHeight ?? 100]
    case 'fill_gauge':   return [cfg?.barWidth ?? 22, cfg?.barHeight ?? 90]
    case 'sparkline':    return [110, 18]
    case 'alarm_indicator': return [20, 20]
    case 'digital_status':  return [80, 18]
    default:             return [60, 24]
  }
}

function getVisiblePointIds(
  doc: { children: SceneNode[] },
  vp: ViewportState,
): string[] {
  const visible = new Set<string>()
  // 10% pre-fetch buffer (spec §4.2)
  const buf = Math.max(vp.screenWidth, vp.screenHeight) * 0.1 / vp.zoom
  const vLeft = vp.panX - buf
  const vTop = vp.panY - buf
  const vRight = vp.panX + vp.screenWidth / vp.zoom + buf
  const vBottom = vp.panY + vp.screenHeight / vp.zoom + buf

  function scanNode(node: SceneNode) {
    if (!node.visible) return
    const { x, y } = node.transform.position

    if (node.type === 'display_element') {
      const de = node as DisplayElement
      const [w, h] = displayElementSize(de)
      if (x < vRight && x + w > vLeft && y < vBottom && y + h > vTop) {
        if (de.binding?.pointId) visible.add(de.binding.pointId)
      }
    } else if (node.type === 'symbol_instance') {
      // No size info without fetching the shape SVG — use 200px estimate
      const si = node as SymbolInstance
      if (x < vRight && x + 200 > vLeft && y < vBottom && y + 200 > vTop) {
        if (si.stateBinding?.pointId) visible.add(si.stateBinding.pointId)
        // Also collect display element children
        for (const child of si.children) scanNode(child as SceneNode)
      }
      return // children already handled above
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode)
    }
  }

  for (const node of doc.children) scanNode(node)
  return Array.from(visible)
}

// ---------------------------------------------------------------------------
// Count total bound points in a graphic
// ---------------------------------------------------------------------------

function countTotalPoints(doc: { children: SceneNode[] }): number {
  const seen = new Set<string>()

  function scanNode(node: SceneNode) {
    if (node.type === 'display_element') {
      const de = node as DisplayElement
      if (de.binding?.pointId) seen.add(de.binding.pointId)
    }
    if (node.type === 'symbol_instance') {
      const si = node as SymbolInstance
      if (si.stateBinding?.pointId) seen.add(si.stateBinding.pointId)
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode)
    }
  }

  for (const node of doc.children) scanNode(node)
  return seen.size
}

// ---------------------------------------------------------------------------
// ProcessPage
// ---------------------------------------------------------------------------

export default function ProcessPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ---- View selection -------------------------------------------------------

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return localStorage.getItem(DEFAULT_GRAPHIC_ID_KEY)
  })
  const [recentViews, setRecentViews] = useState<RecentView[]>(loadRecentViews)

  // ---- Sidebar & UI state ---------------------------------------------------

  const [sidebarVisible, setSidebarVisible] = useState<boolean>(loadSidebarVisible)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const next = !v
      localStorage.setItem(SIDEBAR_VISIBLE_KEY, String(next))
      return next
    })
  }, [])

  // ---- Viewport state -------------------------------------------------------

  const [viewport, setViewport] = useState<ViewportState>({
    panX: 0, panY: 0, zoom: 1,
    canvasWidth: 1920, canvasHeight: 1080,
    screenWidth: 1920, screenHeight: 1080,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })

  // ---- Graphics data --------------------------------------------------------

  const { data: graphicsList, isLoading: graphicsLoading } = useQuery({
    queryKey: ['design-objects', 'process'],
    queryFn: async () => {
      const result = await graphicsApi.list({ scope: 'process' })
      if (result.success) return result.data.data
      return [] as DesignObjectSummary[]
    },
  })

  const { data: graphic, isLoading } = useQuery({
    queryKey: ['graphic', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const result = await graphicsApi.get(selectedId)
      if (result.success) return result.data.data
      return null
    },
    enabled: !!selectedId,
  })

  // ---- Viewport bookmarks ---------------------------------------------------

  const { data: rawBookmarks = [] } = useQuery({
    queryKey: ['bookmarks', 'viewport'],
    queryFn: async () => {
      const result = await bookmarksApi.list()
      if (result.success) return result.data.filter((b) => b.entity_type === 'viewport')
      return []
    },
  })

  // Decode viewport bookmarks from metadata stored in the name as JSON
  const viewportBookmarks = useMemo((): ViewportBookmark[] => {
    return rawBookmarks
      .map((b) => {
        try {
          const meta = JSON.parse(b.name) as { label?: string; panX?: number; panY?: number; zoom?: number }
          return {
            id: b.id,
            name: meta.label ?? b.id,
            panX: meta.panX ?? 0,
            panY: meta.panY ?? 0,
            zoom: meta.zoom ?? 1,
          }
        } catch {
          return { id: b.id, name: b.name, panX: 0, panY: 0, zoom: 1 }
        }
      })
  }, [rawBookmarks])

  const addViewportBookmarkMutation = useMutation({
    mutationFn: (args: { panX: number; panY: number; zoom: number }) => {
      const label = `Viewport @ ${Math.round(args.zoom * 100)}%`
      const name = JSON.stringify({ label, ...args })
      return bookmarksApi.add({
        entity_type: 'viewport',
        entity_id: selectedId ?? 'process',
        name,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks', 'viewport'] }),
  })

  function handleAddBookmark() {
    addViewportBookmarkMutation.mutate({
      panX: viewport.panX,
      panY: viewport.panY,
      zoom: viewport.zoom,
    })
  }

  function handleSelectBookmark(bm: { panX: number; panY: number; zoom: number }) {
    setViewport((vp) => ({ ...vp, panX: bm.panX, panY: bm.panY, zoom: bm.zoom }))
  }

  const deleteViewportBookmarkMutation = useMutation({
    mutationFn: (id: string) => bookmarksApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks', 'viewport'] }),
  })

  const renameViewportBookmarkMutation = useMutation({
    mutationFn: ({ id, name, bm }: { id: string; name: string; bm: ViewportBookmark }) => {
      const newData = JSON.stringify({ label: name, panX: bm.panX, panY: bm.panY, zoom: bm.zoom })
      // Bookmarks API doesn't support update — delete + re-add
      return bookmarksApi.remove(id).then(() =>
        bookmarksApi.add({ entity_type: 'viewport', entity_id: selectedId ?? 'process', name: newData }),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks', 'viewport'] }),
  })

  function handleDeleteBookmark(id: string) {
    deleteViewportBookmarkMutation.mutate(id)
  }

  function handleRenameBookmark(id: string, newName: string) {
    const bm = viewportBookmarks.find((b) => b.id === id)
    if (!bm) return
    renameViewportBookmarkMutation.mutate({ id, name: newName, bm })
  }

  // ---- View selection handler -----------------------------------------------

  const handleSelectView = useCallback(
    (id: string, name: string) => {
      setSelectedId(id)
      localStorage.setItem(DEFAULT_GRAPHIC_ID_KEY, id)
      pushRecentView(id, name)
      setRecentViews(loadRecentViews())
    },
    [],
  )

  // ---- Viewport resize observer --------------------------------------------

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setViewport((vp) => ({ ...vp, screenWidth: width, screenHeight: height }))
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Update canvas size when graphic loads
  useEffect(() => {
    if (!graphic?.scene_data) return
    const { width, height } = graphic.scene_data.canvas
    setViewport((vp) => ({ ...vp, canvasWidth: width, canvasHeight: height, panX: 0, panY: 0, zoom: 1 }))
  }, [graphic?.scene_data])

  // ---- Zoom / pan handlers -------------------------------------------------

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    setViewport((vp) => {
      const newZoom = Math.max(0.05, Math.min(10, vp.zoom * zoomFactor))
      const canvasX = mouseX / vp.zoom + vp.panX
      const canvasY = mouseY / vp.zoom + vp.panY
      return { ...vp, zoom: newZoom, panX: canvasX - mouseX / newZoom, panY: canvasY - mouseY / newZoom }
    })
  }, [])

  // Active touch pointers tracked for pinch-to-zoom (§4.1)
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchBaseZoom = useRef<number | null>(null)
  const pinchBaseDist = useRef<number>(0)
  const pinchMidCanvas = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Pinch-to-zoom: activate when 2 touch pointers are down (60px+ apart)
    if (e.pointerType === 'touch' && activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      if (dist >= 60) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top
          setViewport((vp) => {
            pinchBaseZoom.current = vp.zoom
            pinchBaseDist.current = dist
            pinchMidCanvas.current = { x: midX / vp.zoom + vp.panX, y: midY / vp.zoom + vp.panY }
            return vp
          })
        }
      }
      return
    }
    // Middle-click, Alt+left-click, or left-click on background canvas (not interactive elements)
    const target = e.target as HTMLElement
    const isBackground = target === containerRef.current || target.tagName === 'DIV'
    if (e.button !== 1 && !(e.button === 0 && e.altKey) && !(e.button === 0 && isBackground)) return
    isPanning.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Pinch-to-zoom gesture (§4.1)
    if (e.pointerType === 'touch' && activePointers.current.size === 2 && pinchBaseZoom.current !== null) {
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
      const ratio = dist / pinchBaseDist.current
      const newZoom = Math.max(0.05, Math.min(10, pinchBaseZoom.current * ratio))
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top
        setViewport((vp) => ({
          ...vp,
          zoom: newZoom,
          panX: pinchMidCanvas.current.x - midX / newZoom,
          panY: pinchMidCanvas.current.y - midY / newZoom,
        }))
      }
      return
    }
    if (!isPanning.current) return
    const dx = (e.clientX - lastPointer.current.x) / viewport.zoom
    const dy = (e.clientY - lastPointer.current.y) / viewport.zoom
    lastPointer.current = { x: e.clientX, y: e.clientY }
    setViewport((vp) => ({ ...vp, panX: vp.panX - dx, panY: vp.panY - dy }))
  }, [viewport.zoom])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size < 2) pinchBaseZoom.current = null
    isPanning.current = false
  }, [])

  const handleMinimapViewportChange = useCallback((panX: number, panY: number) => {
    setViewport((vp) => ({ ...vp, panX, panY }))
  }, [])

  // ---- Zoom controls -------------------------------------------------------

  function zoomIn() {
    setViewport((vp) => ({ ...vp, zoom: Math.min(10, vp.zoom * 1.25) }))
  }
  function zoomOut() {
    setViewport((vp) => ({ ...vp, zoom: Math.max(0.05, vp.zoom / 1.25) }))
  }
  function zoomFit() {
    if (!graphic?.scene_data) return
    const { width, height } = graphic.scene_data.canvas
    const fitZoom = Math.min(viewport.screenWidth / width, viewport.screenHeight / height, 1)
    setViewport((vp) => ({ ...vp, zoom: fitZoom, panX: 0, panY: 0 }))
  }
  function zoom100() {
    setViewport((vp) => ({ ...vp, zoom: 1, panX: 0, panY: 0 }))
  }

  // ---- Fullscreen ----------------------------------------------------------

  function toggleFullscreen() {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => undefined)
    } else {
      document.exitFullscreen?.().catch(() => undefined)
    }
    setIsFullscreen((v) => !v)
  }

  // ---- Navigation history + breadcrumbs (§6.4) ----------------------------

  const [navHistory, setNavHistory] = useState<NavEntry[]>([])
  const [navHistoryIndex, setNavHistoryIndex] = useState(-1)

  // Navigate with history tracking (used for in-graphic navigation links)
  const handleNavigateWithHistory = useCallback(
    (targetId: string) => {
      const name = graphicsList?.find((g) => g.id === targetId)?.name ?? targetId
      setNavHistory((prev) => {
        const current: NavEntry = {
          graphicId: selectedId ?? '',
          name: graphicsList?.find((g) => g.id === selectedId)?.name ?? selectedId ?? '',
          panX: viewport.panX,
          panY: viewport.panY,
          zoom: viewport.zoom,
        }
        // Truncate forward history beyond current index, then append current + move to new
        const base = navHistoryIndex >= 0 ? prev.slice(0, navHistoryIndex + 1) : prev
        const next = [...base, current].slice(-20)
        setNavHistoryIndex(next.length - 1)
        return next
      })
      handleSelectView(targetId, name)
    },
    [graphicsList, handleSelectView, selectedId, viewport, navHistoryIndex],
  )

  // Navigate from scene renderer navigation links
  const handleNavigate = handleNavigateWithHistory

  function navBack() {
    if (navHistoryIndex < 0) return
    const entry = navHistory[navHistoryIndex]
    if (!entry) return
    setNavHistoryIndex((i) => i - 1)
    handleSelectView(entry.graphicId, entry.name)
    setViewport((vp) => ({ ...vp, panX: entry.panX, panY: entry.panY, zoom: entry.zoom }))
  }

  function navForward() {
    if (navHistoryIndex >= navHistory.length - 1) return
    const entry = navHistory[navHistoryIndex + 1]
    if (!entry) return
    setNavHistoryIndex((i) => i + 1)
    handleSelectView(entry.graphicId, entry.name)
    setViewport((vp) => ({ ...vp, panX: entry.panX, panY: entry.panY, zoom: entry.zoom }))
  }

  // ---- Hover tooltip (§7.3) -----------------------------------------------

  const [tooltip, setTooltip] = useState<PointTooltip | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref so tooltip callback always reads latest point values without ordering constraint
  const pointValuesRef = useRef<Map<string, ScenePointValue>>(new Map())

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pointId = findPointId(e.target)
      if (!pointId) {
        if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null }
        return
      }
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
      const clientX = e.clientX
      const clientY = e.clientY
      tooltipTimerRef.current = setTimeout(() => {
        const pv = pointValuesRef.current.get(pointId)
        setTooltip({
          x: clientX, y: clientY,
          pointId,
          value: pv?.value !== null && pv?.value !== undefined ? String(pv.value) : '---',
          quality: pv?.quality ?? 'unknown',
          timestamp: new Date().toLocaleTimeString(),
        })
      }, 500)
    },
    [],
  )

  const handleContainerMouseLeave = useCallback(() => {
    if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null }
    setTooltip(null)
  }, [])

  useEffect(() => () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current) }, [])

  // ---- Context menus (§13) -------------------------------------------------

  const [canvasCtxMenu, setCanvasCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [pointCtxMenu, setPointCtxMenu] = useState<{ x: number; y: number; pointId: string } | null>(null)

  const handleContainerContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const pointId = findPointId(e.target)
      if (pointId) {
        setPointCtxMenu({ x: e.clientX, y: e.clientY, pointId })
      } else {
        setCanvasCtxMenu({ x: e.clientX, y: e.clientY })
      }
    },
    [],
  )

  // ---- Keyboard shortcuts (§12.1) ------------------------------------------

  const [minimapVisible, setMinimapVisible] = useState(true)
  // Ref so keyboard handler always reads latest isHistorical without ordering constraint
  const isHistoricalRef = useRef(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const ctrl = e.ctrlKey || e.metaKey
      const alt = e.altKey
      const PAN_STEP = e.shiftKey ? 500 : 100
      // Alt+Left — navigate back
      if (alt && e.key === 'ArrowLeft') { e.preventDefault(); navBack(); return }
      // Alt+Right — navigate forward
      if (alt && e.key === 'ArrowRight') { e.preventDefault(); navForward(); return }
      // Arrow key pan (no modifier)
      if (!ctrl && !alt) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setViewport((vp) => ({ ...vp, panX: vp.panX - PAN_STEP / vp.zoom })); return }
        if (e.key === 'ArrowRight') { e.preventDefault(); setViewport((vp) => ({ ...vp, panX: vp.panX + PAN_STEP / vp.zoom })); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); setViewport((vp) => ({ ...vp, panY: vp.panY - PAN_STEP / vp.zoom })); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setViewport((vp) => ({ ...vp, panY: vp.panY + PAN_STEP / vp.zoom })); return }
        // M — toggle minimap
        if (e.key === 'm' || e.key === 'M') { setMinimapVisible((v) => !v); return }
        // + / = — zoom in
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); return }
        // - — zoom out
        if (e.key === '-') { e.preventDefault(); zoomOut(); return }
        // [ — toggle sidebar (not in historical mode per §12.2)
        if (e.key === '[' && !isHistoricalRef.current) { e.preventDefault(); toggleSidebar(); return }
        // Escape — close context menus and tooltip
        if (e.key === 'Escape') {
          setCanvasCtxMenu(null); setPointCtxMenu(null); setTooltip(null)
          return
        }
      }
      // Ctrl+0 — zoom to fit
      if (ctrl && e.key === '0') { e.preventDefault(); zoomFit(); return }
      // Ctrl+1 — zoom to 100%
      if (ctrl && e.key === '1') { e.preventDefault(); zoom100(); return }
      // Ctrl+Shift+B — add bookmark
      if (ctrl && e.shiftKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); handleAddBookmark(); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomFit, zoom100, handleAddBookmark, toggleSidebar, navBack, navForward])

  // ---- Debounced viewport for point subscriptions ─────────────────────────

  const [debouncedVp, setDebouncedVp] = useState(viewport)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedVp(viewport), 200)
    return () => clearTimeout(id)
  }, [viewport])

  const visiblePointIds = useMemo(() => {
    if (!graphic?.scene_data) return []
    return getVisiblePointIds(graphic.scene_data, debouncedVp)
  }, [graphic?.scene_data, debouncedVp])

  const totalPoints = useMemo(() => {
    if (!graphic?.scene_data) return 0
    return countTotalPoints(graphic.scene_data)
  }, [graphic?.scene_data])

  // ---- Playback mode -------------------------------------------------------

  const { mode: playbackMode, timestamp: playbackTs, setMode: setPlaybackMode } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  // ---- Real-time / historical values ---------------------------------------

  const { values: wsValues, connectionState } = useWebSocket(isHistorical ? [] : visiblePointIds)
  const historicalValues = useHistoricalValues(
    isHistorical ? visiblePointIds : [],
    isHistorical ? playbackTs : undefined,
  )

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

  // Keep refs in sync so handlers defined earlier always read current values
  isHistoricalRef.current = isHistorical
  pointValuesRef.current = pointValues

  // ---- Derived display values ----------------------------------------------

  const lodLevel = zoomToLod(viewport.zoom)
  const lodName = LOD_NAMES[lodLevel]
  const zoomPct = Math.round(viewport.zoom * 100)
  const viewName = selectedId ? (graphicsList?.find((g) => g.id === selectedId)?.name ?? '') : ''

  const connectedDot = connectionState === 'connected'
    ? { color: '#22C55E', label: 'Connected' }
    : connectionState === 'connecting'
      ? { color: '#EAB308', label: 'Connecting' }
      : { color: '#EF4444', label: 'Disconnected' }

  // ---- Render --------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--io-bg)', overflow: 'hidden' }}>

      {/* Main content row: sidebar + viewport */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row', minHeight: 0 }}>

        {/* Left sidebar */}
        <ProcessSidebar
          visible={sidebarVisible}
          onToggle={toggleSidebar}
          selectedId={selectedId}
          onSelectView={handleSelectView}
          bookmarks={viewportBookmarks}
          onSelectBookmark={handleSelectBookmark}
          onAddBookmark={handleAddBookmark}
          onDeleteBookmark={handleDeleteBookmark}
          onRenameBookmark={handleRenameBookmark}
          recentViews={recentViews}
          graphicsList={graphicsList}
          graphicsLoading={graphicsLoading}
        />

        {/* Viewport area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Breadcrumb navigation bar (§6.4) — only when history depth > 1 */}
          {navHistory.length > 0 && (
            <div style={{
              height: 28,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 10px',
              background: 'var(--io-surface-secondary)',
              borderBottom: '1px solid var(--io-border)',
              fontSize: 11,
              color: 'var(--io-text-muted)',
              userSelect: 'none',
              overflowX: 'auto',
            }}>
              <button
                onClick={navBack}
                disabled={navHistoryIndex < 0}
                title="Navigate back (Alt+Left)"
                style={{ background: 'none', border: 'none', cursor: navHistoryIndex >= 0 ? 'pointer' : 'default', color: navHistoryIndex >= 0 ? 'var(--io-text-primary)' : 'var(--io-border)', padding: '0 4px', fontSize: 12 }}
              >
                ‹
              </button>
              {navHistory.map((entry, i) => (
                <span key={`${entry.graphicId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      setNavHistoryIndex(i - 1)
                      handleSelectView(entry.graphicId, entry.name)
                      setViewport((vp) => ({ ...vp, panX: entry.panX, panY: entry.panY, zoom: entry.zoom }))
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: i === navHistoryIndex ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                      fontWeight: i === navHistoryIndex ? 600 : 400,
                      fontSize: 11, padding: '0 2px',
                    }}
                  >
                    {entry.name || entry.graphicId}
                  </button>
                  {i < navHistory.length - 1 && <span style={{ color: 'var(--io-border)' }}>›</span>}
                </span>
              ))}
              {viewName && <span style={{ color: 'var(--io-border)' }}>›</span>}
              {viewName && <span style={{ color: 'var(--io-accent)', fontWeight: 600 }}>{viewName}</span>}
              <button
                onClick={navForward}
                disabled={navHistoryIndex >= navHistory.length - 1}
                title="Navigate forward (Alt+Right)"
                style={{ background: 'none', border: 'none', cursor: navHistoryIndex < navHistory.length - 1 ? 'pointer' : 'default', color: navHistoryIndex < navHistory.length - 1 ? 'var(--io-text-primary)' : 'var(--io-border)', padding: '0 4px', fontSize: 12, marginLeft: 'auto' }}
              >
                ›
              </button>
            </div>
          )}

          {/* Canvas */}
          <div
            ref={containerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onMouseMove={handleContainerMouseMove}
            onMouseLeave={handleContainerMouseLeave}
            onContextMenu={handleContainerContextMenu}
          >
            {/* Empty state */}
            {!selectedId && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--io-text-muted)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.4}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--io-text-primary)' }}>Process Module</p>
                <p style={{ margin: 0, fontSize: 12 }}>Select a graphic from the sidebar</p>
              </div>
            )}

            {/* Loading */}
            {selectedId && isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
                Loading…
              </div>
            )}

            {/* Scene renderer */}
            {graphic?.scene_data && (
              <SceneRenderer
                document={graphic.scene_data}
                viewport={viewport}
                pointValues={pointValues}
                onNavigate={handleNavigate}
                style={{ position: 'absolute', inset: 0 }}
              />
            )}

            {/* Minimap overlay */}
            {graphic?.scene_data && (
              <ProcessMinimap
                canvasWidth={viewport.canvasWidth}
                canvasHeight={viewport.canvasHeight}
                panX={viewport.panX}
                panY={viewport.panY}
                zoom={viewport.zoom}
                screenWidth={viewport.screenWidth}
                screenHeight={viewport.screenHeight}
                onViewportChange={handleMinimapViewportChange}
                sceneData={graphic.scene_data}
                visible={minimapVisible}
              />
            )}

            {/* Hover tooltip (§7.3) */}
            {tooltip && (
              <div style={{
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
              }}>
                <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 11, color: 'var(--io-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {tooltip.pointId}
                </div>
                <div style={{ fontSize: 15, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                  {tooltip.value}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: 'var(--io-text-muted)' }}>
                  <span style={{ color: tooltip.quality === 'good' ? '#22C55E' : tooltip.quality === 'bad' ? '#EF4444' : '#F59E0B' }}>
                    {tooltip.quality}
                  </span>
                  <span>{tooltip.timestamp}</span>
                </div>
              </div>
            )}
          </div>

          {/* Canvas background right-click menu (§13.1) */}
          {canvasCtxMenu && (
            <ContextMenu
              x={canvasCtxMenu.x}
              y={canvasCtxMenu.y}
              onClose={() => setCanvasCtxMenu(null)}
              items={[
                { label: 'Zoom to Fit', onClick: () => { zoomFit(); setCanvasCtxMenu(null) } },
                { label: 'Zoom to 100%', onClick: () => { zoom100(); setCanvasCtxMenu(null) } },
                { label: 'Bookmark This View…', onClick: () => { handleAddBookmark(); setCanvasCtxMenu(null) } },
                { label: 'Open in Designer', onClick: () => { if (selectedId) navigate(`/designer/graphics/${selectedId}/edit`) } },
              ]}
            />
          )}

          {/* Point right-click menu (§13.3) */}
          {pointCtxMenu && (
            <ContextMenu
              x={pointCtxMenu.x}
              y={pointCtxMenu.y}
              onClose={() => setPointCtxMenu(null)}
              items={[
                {
                  label: 'Point Detail',
                  onClick: () => {
                    const pv = pointValuesRef.current.get(pointCtxMenu.pointId)
                    setTooltip({
                      x: pointCtxMenu.x,
                      y: pointCtxMenu.y,
                      pointId: pointCtxMenu.pointId,
                      value: pv?.value !== null && pv?.value !== undefined ? String(pv.value) : '---',
                      quality: pv?.quality ?? 'unknown',
                      timestamp: new Date().toLocaleTimeString(),
                    })
                    setPointCtxMenu(null)
                  },
                },
                {
                  label: 'Trend Point',
                  onClick: () => { console.log('[Process] Trend point:', pointCtxMenu.pointId); setPointCtxMenu(null) },
                },
                {
                  label: 'Investigate Point',
                  onClick: () => { console.log('[Process] Investigate:', pointCtxMenu.pointId); setPointCtxMenu(null) },
                },
                {
                  label: 'Report on Point',
                  onClick: () => { console.log('[Process] Report:', pointCtxMenu.pointId); setPointCtxMenu(null) },
                },
              ]}
            />
          )}

          {/* View toolbar */}
          <div style={{
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 10px',
            background: 'var(--io-surface)',
            borderTop: '1px solid var(--io-border)',
          }}>
            {/* Zoom controls */}
            <span style={{ fontSize: 11, color: 'var(--io-text-muted)', minWidth: 40, textAlign: 'right' }}>
              {zoomPct}%
            </span>
            <button
              onClick={zoomOut}
              title="Zoom out"
              style={toolbarBtnStyle}
            >
              −
            </button>
            <button
              onClick={zoomIn}
              title="Zoom in"
              style={toolbarBtnStyle}
            >
              +
            </button>
            <button
              onClick={zoomFit}
              title="Fit to window"
              style={toolbarBtnStyle}
            >
              Fit
            </button>
            <button
              onClick={zoom100}
              title="100% zoom"
              style={toolbarBtnStyle}
            >
              100%
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: 'var(--io-border)', margin: '0 4px' }} />

            {/* LIVE / HISTORICAL toggle */}
            <button
              onClick={() => setPlaybackMode('live')}
              style={{
                ...toolbarBtnStyle,
                background: !isHistorical ? 'var(--io-accent-subtle)' : undefined,
                color: !isHistorical ? 'var(--io-accent)' : 'var(--io-text-muted)',
                borderColor: !isHistorical ? 'var(--io-accent)' : 'var(--io-border)',
              }}
            >
              ● Live
            </button>
            <button
              onClick={() => setPlaybackMode('historical')}
              style={{
                ...toolbarBtnStyle,
                background: isHistorical ? '#78350f22' : undefined,
                color: isHistorical ? '#F59E0B' : 'var(--io-text-muted)',
                borderColor: isHistorical ? '#F59E0B' : 'var(--io-border)',
              }}
            >
              ◷ Historical
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Bookmark button */}
            <button
              onClick={handleAddBookmark}
              title="Save viewport as bookmark"
              style={{
                ...toolbarBtnStyle,
                color: 'var(--io-accent)',
                fontSize: 14,
                padding: '2px 6px',
              }}
            >
              ★
            </button>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              title="Toggle fullscreen"
              style={toolbarBtnStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                ) : (
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                )}
              </svg>
            </button>
          </div>

          {/* Historical Playback Bar (only in historical mode) */}
          {isHistorical && <HistoricalPlaybackBar />}

          {/* Status bar */}
          <div style={{
            height: 24,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 10px',
            background: 'var(--io-surface-secondary)',
            borderTop: '1px solid var(--io-border)',
            fontSize: 11,
            color: 'var(--io-text-muted)',
            userSelect: 'none',
          }}>
            {/* Connection status */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: connectedDot.color, display: 'inline-block' }} />
              {connectedDot.label}
            </span>
            <span style={{ color: 'var(--io-border)' }}>|</span>
            {/* Points subscribed */}
            <span>{visiblePointIds.length}/{totalPoints} points</span>
            <span style={{ color: 'var(--io-border)' }}>|</span>
            {/* View name */}
            {viewName && (
              <>
                <span style={{ color: 'var(--io-text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewName}</span>
                <span style={{ color: 'var(--io-border)' }}>|</span>
              </>
            )}
            {/* LOD */}
            <span>LOD {lodLevel} – {lodName}</span>
            <span style={{ color: 'var(--io-border)' }}>|</span>
            {/* Zoom */}
            <span>{zoomPct}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared toolbar button style
// ---------------------------------------------------------------------------

const toolbarBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--io-border)',
  borderRadius: 4,
  padding: '2px 8px',
  cursor: 'pointer',
  fontSize: 11,
  color: 'var(--io-text-muted)',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  lineHeight: 1.5,
  flexShrink: 0,
}
