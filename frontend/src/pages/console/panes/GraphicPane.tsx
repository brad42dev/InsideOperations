import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import GraphicViewer from '../../../shared/components/graphics/GraphicViewer'
import { graphicsApi } from '../../../api/graphics'
import type { PaneConfig } from '../types'

interface GraphicPaneProps {
  config: PaneConfig
  editMode: boolean
  onGraphicSelected?: (paneId: string, graphicId: string) => void
}

// ---------------------------------------------------------------------------
// Graphic selector modal (shown in edit mode when no graphic chosen)
// ---------------------------------------------------------------------------

function GraphicSelectorModal({
  onSelect,
  onClose,
}: {
  onSelect: (graphicId: string) => void
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['graphics-list'],
    queryFn: async () => {
      const result = await graphicsApi.list()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 30_000,
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 8,
          padding: 24,
          minWidth: 360,
          maxWidth: 480,
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--io-text-primary)',
          }}
        >
          Select Graphic
        </h3>

        {isLoading && (
          <div style={{ color: 'var(--io-text-muted)', fontSize: 13 }}>Loading graphics…</div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div style={{ color: 'var(--io-text-muted)', fontSize: 13 }}>
            No graphics available. Create one in the Designer module.
          </div>
        )}

        <div
          style={{
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {data?.map((graphic) => (
            <button
              key={graphic.id}
              onClick={() => onSelect(graphic.id)}
              style={{
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 6,
                padding: '10px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--io-text-primary)',
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <span style={{ fontWeight: 500 }}>{graphic.name}</span>
              <span style={{ color: 'var(--io-text-muted)', fontSize: 11 }}>
                {graphic.type} · {graphic.bindings_count} bindings
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--io-border)',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'var(--io-text-primary)',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphicPane
// ---------------------------------------------------------------------------

export default function GraphicPane({ config, editMode, onGraphicSelected }: GraphicPaneProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [paneSize, setPaneSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setPaneSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleSelect = (graphicId: string) => {
    setSelectorOpen(false)
    onGraphicSelected?.(config.id, graphicId)
  }

  if (!config.graphicId) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--io-text-muted)',
          fontSize: 13,
          background: 'var(--io-surface)',
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span>No graphic selected</span>
        {editMode && (
          <button
            onClick={() => setSelectorOpen(true)}
            style={{
              background: 'var(--io-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '7px 14px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Select Graphic
          </button>
        )}
        {selectorOpen && (
          <GraphicSelectorModal onSelect={handleSelect} onClose={() => setSelectorOpen(false)} />
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {paneSize.width > 0 && (
        <GraphicViewer
          graphicId={config.graphicId}
          width={paneSize.width}
          height={paneSize.height}
          allowPanZoom
          className="console-graphic-viewer"
        />
      )}
      {editMode && (
        <>
          <button
            onClick={() => setSelectorOpen(true)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: 12,
              zIndex: 10,
            }}
          >
            Change Graphic
          </button>
          {selectorOpen && (
            <GraphicSelectorModal onSelect={handleSelect} onClose={() => setSelectorOpen(false)} />
          )}
        </>
      )}
    </div>
  )
}
