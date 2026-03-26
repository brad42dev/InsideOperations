import { useRef, useEffect, useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SceneChild {
  type: string
  transform: { position: { x: number; y: number } }
  visible: boolean
}

interface SceneData {
  children: Array<SceneChild>
}

export interface ProcessMinimapProps {
  /** Graphic canvas dimensions */
  canvasWidth: number
  canvasHeight: number
  /** Current viewport state */
  panX: number
  panY: number
  zoom: number
  /** Screen dimensions of the viewport container */
  screenWidth: number
  screenHeight: number
  /** Called when user clicks/drags to navigate */
  onViewportChange: (panX: number, panY: number) => void
  /** Optional: simplified scene data for rendering minimap content */
  sceneData?: SceneData | null
  /** Whether the minimap is visible (M key toggles) */
  visible?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_W = 250
const MAX_H = 188
const MIN_W = 120
const MIN_H = 90

function getNodeColor(type: string): string {
  switch (type) {
    case 'symbol_instance':
      return '#059669'
    case 'display_element':
      return '#2563EB'
    case 'pipe':
    case 'line':
      return '#6B7280'
    case 'group':
      return '#8B5CF6'
    default:
      return '#4B5563'
  }
}

// ---------------------------------------------------------------------------
// ProcessMinimap
// ---------------------------------------------------------------------------

export default function ProcessMinimap({
  canvasWidth,
  canvasHeight,
  panX,
  panY,
  zoom,
  screenWidth,
  screenHeight,
  onViewportChange,
  sceneData,
  visible = true,
}: ProcessMinimapProps) {
  const [collapsed, setCollapsed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Compute minimap dimensions preserving canvas aspect ratio
  const canvasAspect = canvasWidth > 0 && canvasHeight > 0 ? canvasWidth / canvasHeight : 16 / 9
  let mmW: number
  let mmH: number
  if (canvasAspect >= MAX_W / MAX_H) {
    mmW = MAX_W
    mmH = Math.max(MIN_H, Math.round(MAX_W / canvasAspect))
  } else {
    mmH = MAX_H
    mmW = Math.max(MIN_W, Math.round(MAX_H * canvasAspect))
  }

  // Scale factor: canvas coords → minimap pixel coords
  const scaleX = mmW / (canvasWidth || 1)
  const scaleY = mmH / (canvasHeight || 1)

  // Viewport rect in minimap pixels
  const vpW = Math.min(mmW, (screenWidth / (zoom || 1)) * scaleX)
  const vpH = Math.min(mmH, (screenHeight / (zoom || 1)) * scaleY)
  const vpX = Math.max(0, Math.min(mmW - vpW, panX * scaleX))
  const vpY = Math.max(0, Math.min(mmH - vpH, panY * scaleY))

  // Draw minimap canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || collapsed) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = mmW
    canvas.height = mmH

    // Background — resolve via CSS custom property so it follows the active theme
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--io-surface-primary').trim() || '#09090B'
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, mmW, mmH)

    // Draw scene nodes as colored rects
    if (sceneData?.children) {
      for (const child of sceneData.children) {
        if (!child.visible) continue
        const { x, y } = child.transform.position
        const nx = x * scaleX
        const ny = y * scaleY
        const nw = Math.max(2, 200 * scaleX)
        const nh = Math.max(2, 200 * scaleY)
        ctx.fillStyle = getNodeColor(child.type)
        ctx.globalAlpha = 0.6
        ctx.fillRect(nx, ny, nw, nh)
      }
      ctx.globalAlpha = 1
    } else {
      // Draw placeholder grid lines
      ctx.strokeStyle = '#2d3348'
      ctx.lineWidth = 0.5
      const step = Math.max(20, mmW / 8)
      for (let x = step; x < mmW; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, mmH); ctx.stroke()
      }
      const stepY = Math.max(20, mmH / 6)
      for (let y = stepY; y < mmH; y += stepY) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mmW, y); ctx.stroke()
      }
    }

    // Viewport rect
    ctx.strokeStyle = '#2DD4BF'
    ctx.lineWidth = 2
    ctx.fillStyle = 'rgba(45,212,191,0.15)'
    ctx.fillRect(vpX, vpY, vpW, vpH)
    ctx.strokeRect(vpX, vpY, vpW, vpH)
  }, [collapsed, mmW, mmH, scaleX, scaleY, sceneData, vpX, vpY, vpW, vpH])

  // Convert a minimap-local click/drag position to canvas pan coords
  const minimapPosToViewport = useCallback(
    (localX: number, localY: number): { panX: number; panY: number } => {
      const canvasX = localX / scaleX
      const canvasY = localY / scaleY
      // Center the viewport on this canvas position
      const newPanX = canvasX - screenWidth / (zoom || 1) / 2
      const newPanY = canvasY - screenHeight / (zoom || 1) / 2
      return { panX: newPanX, panY: newPanY }
    },
    [scaleX, scaleY, screenWidth, screenHeight, zoom],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      isDragging.current = true
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const { panX: nx, panY: ny } = minimapPosToViewport(localX, localY)
      onViewportChange(nx, ny)
    },
    [minimapPosToViewport, onViewportChange],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDragging.current) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top
      const { panX: nx, panY: ny } = minimapPosToViewport(localX, localY)
      onViewportChange(nx, ny)
    },
    [minimapPosToViewport, onViewportChange],
  )

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Keyboard shortcut M to toggle minimap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'm' || e.key === 'M') {
        // Only when no input is focused
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return
        setCollapsed((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Show minimap (M)"
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 10,
          width: 28,
          height: 28,
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: 4,
          color: 'var(--io-text-muted)',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ⊞
      </button>
    )
  }

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 10,
        background: 'var(--io-surface-secondary)',
        border: '1px solid var(--io-border)',
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        userSelect: 'none',
      }}
    >
      {/* Toggle button — top-left corner */}
      <button
        onClick={() => setCollapsed(true)}
        title="Hide minimap (M)"
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          zIndex: 1,
          width: 18,
          height: 18,
          background: 'rgba(0,0,0,0.5)',
          border: 'none',
          borderRadius: 3,
          color: 'var(--io-text-muted)',
          cursor: 'pointer',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
        }}
      >
        {/* Chevron down (pointing toward collapse) */}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4l3 3 3-3" />
        </svg>
      </button>

      <canvas
        ref={canvasRef}
        width={mmW}
        height={mmH}
        style={{ display: 'block', cursor: 'crosshair', width: mmW, height: mmH }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  )
}
