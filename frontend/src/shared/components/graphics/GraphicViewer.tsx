import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../../api/graphics'
import type { GraphicBindings } from '../../types/graphics'
import PointBindingLayer from './PointBindingLayer'
import { TileGraphicViewer } from '../TileGraphicViewer'
import type { TileInfo } from '../TileGraphicViewer'

// ---------------------------------------------------------------------------
// SVG sanitizer
// ---------------------------------------------------------------------------

// Tags that must never appear in user-supplied SVG.
// foreignObject embeds arbitrary HTML and is a common XSS vector in SVG.
const FORBIDDEN_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'foreignobject',   // lower-cased — DOMParser normalises SVG tag names
])

// Attributes that must never appear regardless of tag.
const FORBIDDEN_ATTR_PREFIXES = ['on']  // onclick, onload, onerror, etc.

// Return true if an href/xlink:href/src value is safe for the given tag.
// Rules:
//  <use>   — only fragment refs (#id) are safe; data:/http: can load external SVGs with scripts
//  <image> — fragment refs + image/* data URIs are safe; other data: URIs are not
//  <a>     — block javascript:/vbscript:; allow http/https (browser handles navigation safely)
//  others  — block all data: URIs and javascript:/vbscript:
function isSafeHref(tagName: string, value: string): boolean {
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()

  // Always block these protocols everywhere
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/')
  ) {
    return false
  }

  switch (tagName) {
    case 'use':
      // <use> must only reference local fragments — external/data refs load foreign documents
      return trimmed.startsWith('#')

    case 'image':
      if (trimmed.startsWith('#')) return true
      // Allow standard image data URIs (PNG, JPEG, GIF, WebP, base64-encoded SVG)
      if (/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(trimmed)) return true
      // Block any other data: URI
      return !lower.startsWith('data:')

    default:
      // Block any remaining data: URI on other elements
      return !lower.startsWith('data:')
  }
}

interface SanitizedSvg {
  /** Inner SVG content — safe to set as dangerouslySetInnerHTML on a <svg> element */
  innerHTML: string
  /** viewBox attribute from the original SVG, or null if absent */
  viewBox: string | null
}

function sanitizeSvg(svgString: string): SanitizedSvg {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')

  const walker = document.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT)
  const toRemove: Element[] = []

  let current: Node | null = doc.documentElement
  while (current) {
    if (current instanceof Element) {
      // tagName from DOMParser is case-sensitive in SVG namespace — normalise to lower-case
      const tagName = current.tagName.toLowerCase().replace(/^svg:/, '')

      if (FORBIDDEN_TAGS.has(tagName)) {
        toRemove.push(current)
        current = walker.nextNode()
        continue
      }

      const attrsToRemove: string[] = []
      for (let i = 0; i < current.attributes.length; i++) {
        const attr = current.attributes[i]
        const attrLower = attr.name.toLowerCase()

        // Remove all event handlers (onclick, onload, onerror, onfocus, …)
        if (FORBIDDEN_ATTR_PREFIXES.some((p) => attrLower.startsWith(p))) {
          attrsToRemove.push(attr.name)
          continue
        }

        // Validate href / xlink:href / src on every element
        if (attrLower === 'href' || attrLower === 'xlink:href' || attrLower === 'src') {
          if (!isSafeHref(tagName, attr.value)) {
            attrsToRemove.push(attr.name)
          }
        }
      }
      attrsToRemove.forEach((name) => (current as Element).removeAttribute(name))
    }
    current = walker.nextNode()
  }

  toRemove.forEach((el) => el.parentNode?.removeChild(el))

  // Return innerHTML (not outerHTML) — the caller places this inside its own <svg>.
  // Also return the viewBox so the caller can apply the correct coordinate system.
  return {
    innerHTML: doc.documentElement.innerHTML,
    viewBox: doc.documentElement.getAttribute('viewBox'),
  }
}

// ---------------------------------------------------------------------------
// Count SVG elements
// ---------------------------------------------------------------------------

function countSvgElements(innerHTML: string): number {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${innerHTML}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement.querySelectorAll('*').length
}

// ---------------------------------------------------------------------------
// Pan/zoom state
// ---------------------------------------------------------------------------

interface Transform {
  x: number
  y: number
  scale: number
}

// ---------------------------------------------------------------------------
// Hybrid mode: render static elements to canvas, dynamic as SVG overlay
// ---------------------------------------------------------------------------

function HybridGraphic({
  svgData,
  bindings,
  width,
  height,
  viewBox,
  svgRef,
  onPointClick,
}: {
  /** Inner SVG content (no outer <svg> tag) */
  svgData: string
  bindings: GraphicBindings
  width: number
  height: number
  viewBox: string
  svgRef: React.RefObject<SVGSVGElement>
  onPointClick?: (pointId: string, position: { x: number; y: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Render static SVG layer to canvas — wrap inner HTML in a full SVG for the Blob
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">${svgData}</svg>`
    const blob = new Blob([fullSvg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [svgData, viewBox, width, height])

  // Identify dynamic element IDs from bindings
  const dynamicIds = new Set(Object.keys(bindings))

  // Parse inner SVG content for dynamic elements
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgData}</svg>`,
    'image/svg+xml',
  )

  const dynamicElements: Element[] = []
  dynamicIds.forEach((id) => {
    const el = doc.getElementById(id)
    if (el) dynamicElements.push(el)
  })

  // Build overlay SVG content (dynamic elements only)
  const overlayInner = dynamicElements.map((el) => el.outerHTML).join('')

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />
      <svg
        ref={svgRef}
        viewBox={viewBox}
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
        dangerouslySetInnerHTML={{ __html: overlayInner }}
      />
      <PointBindingLayer svgRef={svgRef} bindings={bindings} viewBox={viewBox} width={width} height={height} onPointClick={onPointClick} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphicViewer
// ---------------------------------------------------------------------------

interface GraphicViewerProps {
  graphicId?: string
  svgData?: string
  bindings?: GraphicBindings
  width?: number
  height?: number
  className?: string
  onPointClick?: (pointId: string, position: { x: number; y: number }) => void
  allowPanZoom?: boolean
  initialZoom?: number
  /** Controlled zoom (overrides internal state when provided) */
  zoom?: number
  /** Controlled pan X offset (overrides internal state when provided) */
  panX?: number
  /** Controlled pan Y offset (overrides internal state when provided) */
  panY?: number
  /** Called whenever the internal transform changes (zoom, panX, panY) */
  onTransformChange?: (zoom: number, panX: number, panY: number) => void
}

const HYBRID_THRESHOLD = 3000

// ---------------------------------------------------------------------------
// useTileInfo — fetch tile pyramid metadata for a graphic
// ---------------------------------------------------------------------------

function useTileInfo(graphicId: string | undefined): TileInfo | null {
  const { data } = useQuery<TileInfo | null>({
    queryKey: ['tile-info', graphicId],
    queryFn: async () => {
      if (!graphicId) return null
      try {
        const token = localStorage.getItem('io_access_token') ?? ''
        const res = await fetch(`/api/graphics/${graphicId}/tile-info`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return null
        const json = await res.json()
        return (json?.data as TileInfo) ?? null
      } catch {
        return null
      }
    },
    enabled: !!graphicId,
    staleTime: 60_000,
    // Don't throw — tile info is optional; missing tiles just fall back to SVG
    throwOnError: false,
  })
  return data ?? null
}

export default function GraphicViewer({
  graphicId,
  svgData: propSvgData,
  bindings: propBindings,
  width,
  height,
  className,
  onPointClick,
  allowPanZoom = true,
  initialZoom = 1,
  zoom: controlledZoom,
  panX: controlledPanX,
  panY: controlledPanY,
  onTransformChange,
}: GraphicViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isControlled = controlledZoom !== undefined

  const [transform, setTransformInternal] = useState<Transform>({
    x: controlledPanX ?? 0,
    y: controlledPanY ?? 0,
    scale: controlledZoom ?? initialZoom,
  })

  // Track the last transform we reported via onTransformChange to avoid echo loops
  const lastReportedRef = useRef<Transform | null>(null)

  // When controlled props change from outside (not echoed back from our own report),
  // sync internal state.
  useEffect(() => {
    if (!isControlled) return
    const incoming: Transform = {
      x: controlledPanX ?? 0,
      y: controlledPanY ?? 0,
      scale: controlledZoom ?? initialZoom,
    }
    const last = lastReportedRef.current
    // Skip if this matches what we just reported (echo prevention)
    if (
      last &&
      Math.abs(last.scale - incoming.scale) < 1e-9 &&
      Math.abs(last.x - incoming.x) < 1e-9 &&
      Math.abs(last.y - incoming.y) < 1e-9
    ) {
      return
    }
    setTransformInternal(incoming)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledZoom, controlledPanX, controlledPanY, isControlled])

  const setTransform = useCallback(
    (updater: Transform | ((prev: Transform) => Transform)) => {
      setTransformInternal((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        lastReportedRef.current = next
        onTransformChange?.(next.scale, next.x, next.y)
        return next
      })
    },
    [onTransformChange],
  )

  const isPanning = useRef(false)
  const lastPan = useRef({ x: 0, y: 0 })

  // Fetch graphic from API if graphicId provided
  const { data: apiGraphic, isLoading, isError, error } = useQuery({
    queryKey: ['graphic', graphicId],
    queryFn: async () => {
      if (!graphicId) return null
      const result = await graphicsApi.get(graphicId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!graphicId,
    staleTime: 60_000,
  })

  const svgData = propSvgData ?? apiGraphic?.svg_data ?? null
  const bindings: GraphicBindings = propBindings ?? apiGraphic?.bindings ?? {}
  const viewerWidth = width ?? apiGraphic?.metadata?.width ?? 800
  const viewerHeight = height ?? apiGraphic?.metadata?.height ?? 600

  // Fetch tile info (only relevant when graphicId is provided; null when unavailable)
  const tileInfo = useTileInfo(graphicId)

  // Sanitize SVG — returns { innerHTML, viewBox } so we parse once and inject cleanly
  const sanitized = svgData ? sanitizeSvg(svgData) : null

  // Hybrid mode threshold check (count elements in inner HTML)
  const elementCount = sanitized ? countSvgElements(sanitized.innerHTML) : 0
  const useHybrid = elementCount >= HYBRID_THRESHOLD

  // Tile viewer: activate for large graphics that have a ready tile pyramid
  const useTileViewer = useHybrid && tileInfo !== null && !!graphicId

  // Use viewBox from the SVG; fall back to pane dimensions
  const viewBox = sanitized?.viewBox ?? `0 0 ${viewerWidth} ${viewerHeight}`

  // Pan/zoom handlers
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!allowPanZoom) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      setTransform((prev) => {
        const newScale = Math.max(0.1, Math.min(10, prev.scale * delta))
        const scaleChange = newScale / prev.scale
        return {
          scale: newScale,
          x: mouseX - scaleChange * (mouseX - prev.x),
          y: mouseY - scaleChange * (mouseY - prev.y),
        }
      })
    },
    [allowPanZoom, setTransform],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!allowPanZoom) return
      if (e.button !== 0) return
      isPanning.current = true
      lastPan.current = { x: e.clientX, y: e.clientY }
    },
    [allowPanZoom],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return
      const dx = e.clientX - lastPan.current.x
      const dy = e.clientY - lastPan.current.y
      lastPan.current = { x: e.clientX, y: e.clientY }
      setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    },
    [setTransform],
  )

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // Attach wheel listener (non-passive to allow preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !allowPanZoom) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [allowPanZoom, handleWheel])

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          width: viewerWidth,
          height: viewerHeight,
          background: '#111827',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '60%',
            height: '40%',
            background: 'linear-gradient(90deg, #1F2937 25%, #374151 50%, #1F2937 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            borderRadius: 8,
          }}
        />
      </div>
    )
  }

  if (isError || (!svgData && graphicId)) {
    const reason = isError
      ? (error instanceof Error ? error.message : 'API error')
      : 'Graphic has no SVG content'
    console.error('[GraphicViewer] failed to load graphic', graphicId, reason, { isError, svgData, apiGraphic })
    return (
      <div
        className={className}
        style={{
          width: viewerWidth,
          height: viewerHeight,
          background: '#111827',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          color: '#EF4444',
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        <span>Failed to load graphic</span>
        <span style={{ fontSize: 11, color: '#9CA3AF', maxWidth: '80%', textAlign: 'center', wordBreak: 'break-word' }}>{reason}</span>
      </div>
    )
  }

  if (!sanitized) return null

  // For large graphics with a generated tile pyramid, use the Leaflet tile viewer
  // instead of rendering a potentially tens-of-thousands-node SVG DOM.
  if (useTileViewer && tileInfo) {
    return (
      <div
        className={className}
        style={{
          position: 'relative',
          width: viewerWidth,
          height: viewerHeight,
          overflow: 'hidden',
        }}
      >
        <TileGraphicViewer
          graphicId={graphicId!}
          tileInfo={tileInfo}
          style={{ width: viewerWidth, height: viewerHeight }}
        />
      </div>
    )
  }

  const transformStyle: React.CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
    willChange: 'transform',
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: viewerWidth,
        height: viewerHeight,
        overflow: 'hidden',
        background: '#111827',
        cursor: allowPanZoom ? (isPanning.current ? 'grabbing' : 'grab') : 'default',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div style={transformStyle}>
        {useHybrid ? (
          <HybridGraphic
            svgData={sanitized.innerHTML}
            bindings={bindings}
            width={viewerWidth}
            height={viewerHeight}
            viewBox={viewBox}
            svgRef={svgRef}
            onPointClick={onPointClick}
          />
        ) : (
          // Pure SVG mode — PointBindingLayer is a sibling, not a child, because
          // dangerouslySetInnerHTML and children cannot coexist on the same element.
          // The position:relative wrapper lets the overlay SVG align correctly.
          <div style={{ position: 'relative', width: viewerWidth, height: viewerHeight }}>
            <svg
              ref={svgRef}
              viewBox={viewBox}
              width={viewerWidth}
              height={viewerHeight}
              style={{ display: 'block' }}
              dangerouslySetInnerHTML={{ __html: sanitized.innerHTML }}
            />
            <PointBindingLayer
              svgRef={svgRef}
              bindings={bindings}
              viewBox={viewBox}
              width={viewerWidth}
              height={viewerHeight}
              onPointClick={onPointClick}
            />
          </div>
        )}
      </div>
    </div>
  )
}
