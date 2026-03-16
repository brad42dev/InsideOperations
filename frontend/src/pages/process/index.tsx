import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import GraphicViewer from '../../shared/components/graphics/GraphicViewer'
import GraphicBrowser from './GraphicBrowser'
import Minimap from './Minimap'
import { graphicsApi } from '../../api/graphics'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const ZOOM_STEP = 0.1

export default function ProcessPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [graphicId, setGraphicId] = useState<string | null>(
    searchParams.get('graphic'),
  )
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [showBrowser, setShowBrowser] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 })

  // Sync graphicId → query param
  useEffect(() => {
    if (graphicId) {
      setSearchParams({ graphic: graphicId }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [graphicId, setSearchParams])

  // Measure container for minimap viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    obs.observe(el)
    setViewportSize({ width: el.clientWidth, height: el.clientHeight })
    return () => obs.disconnect()
  }, [])

  // Fetch graphic metadata for dimensions and minimap
  const { data: apiGraphic } = useQuery({
    queryKey: ['graphic', graphicId],
    queryFn: async () => {
      if (!graphicId) return null
      const res = await graphicsApi.get(graphicId)
      if (!res.success) throw new Error(res.error.message)
      return res.data
    },
    enabled: !!graphicId,
    staleTime: 60_000,
  })

  const graphicWidth = apiGraphic?.metadata?.width ?? 1920
  const graphicHeight = apiGraphic?.metadata?.height ?? 1080

  function handleSelect(id: string) {
    setGraphicId(id)
    setPan({ x: 0, y: 0 })
    setZoom(1)
    setShowBrowser(false)
  }

  function handleFitToScreen() {
    const scaleX = viewportSize.width / graphicWidth
    const scaleY = viewportSize.height / graphicHeight
    const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM)
    const newPanX = (viewportSize.width - graphicWidth * newZoom) / 2
    const newPanY = (viewportSize.height - graphicHeight * newZoom) / 2
    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }

  function handleZoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2))))
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2))))
  }

  function handleZoomReset() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleMinimapClick = useCallback(
    (position: { x: number; y: number }) => {
      // Center the viewport on the clicked graphic coordinate
      const newPanX = viewportSize.width / 2 - position.x * zoom
      const newPanY = viewportSize.height / 2 - position.y * zoom
      setPan({ x: newPanX, y: newPanY })
    },
    [viewportSize, zoom],
  )

  const zoomPct = Math.round(zoom * 100)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--io-bg)',
      }}
    >
      {/* Graphic viewer — fills all space */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        {graphicId ? (
          <GraphicViewer
            graphicId={graphicId}
            width={viewportSize.width}
            height={viewportSize.height}
            allowPanZoom
            initialZoom={zoom}
          />
        ) : (
          <EmptyState onBrowse={() => setShowBrowser(true)} />
        )}
      </div>

      {/* Top toolbar overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          background: 'rgba(17, 24, 39, 0.82)',
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--io-space-2)',
          padding: '0 var(--io-space-3)',
          zIndex: 30,
        }}
      >
        {/* Browse button */}
        <ToolbarButton
          onClick={() => setShowBrowser((v) => !v)}
          title="Browse Graphics"
          active={showBrowser}
        >
          <FolderIcon />
        </ToolbarButton>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

        {/* Graphic name */}
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {apiGraphic?.name ?? (graphicId ? 'Loading…' : 'No graphic selected')}
        </span>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToolbarButton onClick={handleZoomOut} title="Zoom out" disabled={zoom <= MIN_ZOOM}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>−</span>
          </ToolbarButton>
          <button
            onClick={handleZoomReset}
            title="Reset zoom (100%)"
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              color: 'var(--io-text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 6px',
              minWidth: 44,
              textAlign: 'center',
            }}
          >
            {zoomPct}%
          </button>
          <ToolbarButton onClick={handleZoomIn} title="Zoom in" disabled={zoom >= MAX_ZOOM}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          </ToolbarButton>
        </div>

        {/* Fit to screen */}
        <ToolbarButton onClick={handleFitToScreen} title="Fit to screen" disabled={!graphicId}>
          <FitIcon />
        </ToolbarButton>

        {/* Minimap toggle */}
        <ToolbarButton
          onClick={() => setShowMinimap((v) => !v)}
          title={showMinimap ? 'Hide minimap' : 'Show minimap'}
          active={showMinimap}
          disabled={!graphicId}
        >
          <MapIcon />
        </ToolbarButton>
      </div>

      {/* Graphic browser slide-in */}
      {showBrowser && (
        <GraphicBrowser
          currentGraphicId={graphicId}
          onSelect={handleSelect}
          onClose={() => setShowBrowser(false)}
        />
      )}

      {/* Minimap */}
      {graphicId && showMinimap && (
        <Minimap
          svgViewBox={{ width: graphicWidth, height: graphicHeight }}
          viewportSize={viewportSize}
          pan={pan}
          zoom={zoom}
          thumbnailSvg={apiGraphic?.svg_data ?? undefined}
          onClick={handleMinimapClick}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--io-space-3)',
        color: 'var(--io-text-secondary)',
      }}
    >
      <div style={{ fontSize: 40, opacity: 0.3 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--io-text-primary)' }}>
        Select a graphic to display
      </p>
      <p style={{ margin: 0, fontSize: 13 }}>
        Choose a process graphic from the browser to view it full screen.
      </p>
      <button
        onClick={onBrowse}
        style={{
          marginTop: 8,
          background: 'var(--io-color-accent)',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          padding: '8px 20px',
        }}
      >
        Browse Graphics
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarButton({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: active ? 'rgba(255,255,255,0.12)' : 'none',
        border: '1px solid',
        borderColor: active ? 'rgba(255,255,255,0.25)' : 'transparent',
        borderRadius: 4,
        color: disabled ? 'var(--io-text-disabled)' : 'var(--io-text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 28,
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Icon components
// ---------------------------------------------------------------------------

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FitIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}
