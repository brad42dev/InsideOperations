import { useRef, useCallback, useState } from 'react'

interface MinimapProps {
  svgViewBox: { width: number; height: number }
  viewportSize: { width: number; height: number }
  pan: { x: number; y: number }
  zoom: number
  thumbnailSvg?: string
  onClick: (position: { x: number; y: number }) => void
}

const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 120

export default function Minimap({
  svgViewBox,
  viewportSize,
  pan,
  zoom,
  thumbnailSvg,
  onClick,
}: MinimapProps) {
  const [visible, setVisible] = useState(true)
  const minimapRef = useRef<HTMLDivElement>(null)

  // Scale factor: how much the minimap shrinks the full graphic
  const scaleX = MINIMAP_WIDTH / svgViewBox.width
  const scaleY = MINIMAP_HEIGHT / svgViewBox.height
  const scale = Math.min(scaleX, scaleY)

  // Actual rendered size of the full graphic in the minimap
  const renderedW = svgViewBox.width * scale
  const renderedH = svgViewBox.height * scale

  // Offset to center the rendered area within the minimap box
  const offsetX = (MINIMAP_WIDTH - renderedW) / 2
  const offsetY = (MINIMAP_HEIGHT - renderedH) / 2

  // Viewport rectangle position and size in minimap coordinates:
  // The current viewport (in graphic coords) is: origin = (-pan.x/zoom, -pan.y/zoom), size = viewportSize/zoom
  const vpW = Math.min(renderedW, (viewportSize.width / zoom) * scale)
  const vpH = Math.min(renderedH, (viewportSize.height / zoom) * scale)
  const vpX = offsetX + (-pan.x / zoom) * scale
  const vpY = offsetY + (-pan.y / zoom) * scale

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = minimapRef.current?.getBoundingClientRect()
      if (!rect) return
      const localX = e.clientX - rect.left
      const localY = e.clientY - rect.top

      // Convert click position in minimap to graphic coords
      const graphicX = (localX - offsetX) / scale
      const graphicY = (localY - offsetY) / scale

      onClick({ x: graphicX, y: graphicY })
    },
    [offsetX, offsetY, scale, onClick],
  )

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--io-space-4)',
        right: 'var(--io-space-4)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--io-space-1)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setVisible((v) => !v)}
        title={visible ? 'Hide minimap' : 'Show minimap'}
        style={{
          pointerEvents: 'auto',
          background: 'rgba(17, 24, 39, 0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4,
          color: 'var(--io-text-secondary)',
          fontSize: 10,
          padding: '2px 6px',
          cursor: 'pointer',
          lineHeight: 1.5,
        }}
      >
        {visible ? 'Hide map' : 'Map'}
      </button>

      {/* Minimap panel */}
      {visible && (
        <div
          ref={minimapRef}
          onClick={handleClick}
          title="Click to navigate"
          style={{
            pointerEvents: 'auto',
            width: MINIMAP_WIDTH,
            height: MINIMAP_HEIGHT,
            background: 'rgba(17, 24, 39, 0.88)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'crosshair',
          }}
        >
          {/* Thumbnail SVG or gray fill */}
          {thumbnailSvg ? (
            <svg
              viewBox={`0 0 ${svgViewBox.width} ${svgViewBox.height}`}
              width={renderedW}
              height={renderedH}
              style={{
                position: 'absolute',
                left: offsetX,
                top: offsetY,
                opacity: 0.5,
              }}
              dangerouslySetInnerHTML={{
                __html: thumbnailSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''),
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                left: offsetX,
                top: offsetY,
                width: renderedW,
                height: renderedH,
                background: 'rgba(55, 65, 81, 0.6)',
                borderRadius: 2,
              }}
            />
          )}

          {/* Viewport indicator */}
          <div
            style={{
              position: 'absolute',
              left: Math.max(offsetX, Math.min(vpX, offsetX + renderedW - 4)),
              top: Math.max(offsetY, Math.min(vpY, offsetY + renderedH - 4)),
              width: Math.min(vpW, renderedW),
              height: Math.min(vpH, renderedH),
              border: '1.5px solid rgba(255,255,255,0.75)',
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}
