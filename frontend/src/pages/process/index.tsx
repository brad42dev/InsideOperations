import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../api/graphics'
import { SceneRenderer } from '../../shared/graphics/SceneRenderer'
import type { ViewportState } from '../../shared/types/graphics'
import type { DesignObjectSummary } from '../../api/graphics'

const DEFAULT_GRAPHIC_ID_KEY = 'io-process-last-graphic'

export default function ProcessPage() {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return localStorage.getItem(DEFAULT_GRAPHIC_ID_KEY)
  })
  const [viewport, setViewport] = useState<ViewportState>({
    panX: 0, panY: 0, zoom: 1,
    canvasWidth: 1920, canvasHeight: 1080,
    screenWidth: 1920, screenHeight: 1080,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })

  const { data: graphicsList } = useQuery({
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

  // Update viewport dimensions on container resize
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    setViewport((vp) => {
      const newZoom = Math.max(0.1, Math.min(10, vp.zoom * zoomFactor))
      const canvasX = mouseX / vp.zoom + vp.panX
      const canvasY = mouseY / vp.zoom + vp.panY
      return { ...vp, zoom: newZoom, panX: canvasX - mouseX / newZoom, panY: canvasY - mouseY / newZoom }
    })
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 1 && !(e.button === 0 && e.altKey)) return
    isPanning.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return
    const dx = (e.clientX - lastPointer.current.x) / viewport.zoom
    const dy = (e.clientY - lastPointer.current.y) / viewport.zoom
    lastPointer.current = { x: e.clientX, y: e.clientY }
    setViewport((vp) => ({ ...vp, panX: vp.panX - dx, panY: vp.panY - dy }))
  }, [viewport.zoom])

  const handlePointerUp = useCallback(() => { isPanning.current = false }, [])

  const handleNavigate = useCallback((targetId: string) => {
    setSelectedId(targetId)
    localStorage.setItem(DEFAULT_GRAPHIC_ID_KEY, targetId)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--io-bg)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', height: 40, flexShrink: 0,
        background: 'var(--io-surface)', borderBottom: '1px solid var(--io-border)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--io-text-muted)', marginRight: 4 }}>Graphic:</span>
        <select
          value={selectedId ?? ''}
          onChange={(e) => {
            const val = e.target.value || null
            setSelectedId(val)
            if (val) localStorage.setItem(DEFAULT_GRAPHIC_ID_KEY, val)
          }}
          style={{
            background: 'var(--io-surface-elevated)', color: 'var(--io-text-primary)',
            border: '1px solid var(--io-border)', borderRadius: 4, padding: '2px 6px',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          <option value="">— Select graphic —</option>
          {graphicsList?.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        {graphic && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--io-border)', margin: '0 4px' }} />
            <span style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>
              {Math.round(viewport.zoom * 100)}%
            </span>
            <button
              onClick={() => setViewport((vp) => ({ ...vp, zoom: 1, panX: 0, panY: 0 }))}
              style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}
            >
              Reset
            </button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>Scroll to zoom · Alt+drag to pan</span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {!selectedId && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--io-text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.4}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--io-text-primary)' }}>Process Module</p>
            <p style={{ margin: 0, fontSize: 12 }}>Select a graphic to view</p>
          </div>
        )}
        {selectedId && isLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
            Loading…
          </div>
        )}
        {graphic?.scene_data && (
          <SceneRenderer
            document={graphic.scene_data}
            viewport={viewport}
            onNavigate={handleNavigate}
            style={{ position: 'absolute', inset: 0 }}
          />
        )}
      </div>
    </div>
  )
}
