import React, { useRef, useEffect, useCallback } from 'react'
import { SVG } from '@svgdotjs/svg.js'
import type { Svg as SVGRoot, Element as SVGElement } from '@svgdotjs/svg.js'
import type { DesignerMode, DrawingTool, DesignerState } from './types'

interface DesignerCanvasProps {
  mode: DesignerMode
  activeTool: DrawingTool
  gridEnabled: boolean
  gridSize: number
  snapEnabled: boolean
  zoom: number
  panX: number
  panY: number
  onSelectionChange: (ids: string[]) => void
  onStateChange: (partial: Partial<DesignerState>) => void
  onContentChange: (svgXml: string) => void
  getContentRef: React.MutableRefObject<(() => string) | null>
  initialSvg?: string | null
}

const HANDLE_SIZE = 6
const BG_COLOR = '#09090b'
const STROKE_DEFAULT = 'var(--io-accent)'
const FILL_DEFAULT = 'rgba(45,212,191,0.15)'

let elementCounter = 0
function nextId() {
  return `el-${++elementCounter}-${Date.now()}`
}

function snapToGrid(v: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return v
  return Math.round(v / gridSize) * gridSize
}

// ---------------------------------------------------------------------------
// Handle management
// ---------------------------------------------------------------------------
interface HandleSet {
  group: SVGElement
  handles: SVGElement[]
  target: SVGElement
}

function removeHandles(handleSetRef: React.MutableRefObject<HandleSet | null>) {
  if (handleSetRef.current) {
    handleSetRef.current.group.remove()
    handleSetRef.current = null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DesignerCanvas({
  mode: _mode,
  activeTool,
  gridEnabled,
  gridSize,
  snapEnabled,
  zoom,
  panX,
  panY,
  onSelectionChange,
  onStateChange: _onStateChange,
  onContentChange,
  getContentRef,
  initialSvg,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawRef = useRef<SVGRoot | null>(null)
  const gridGroupRef = useRef<SVGElement | null>(null)
  const contentGroupRef = useRef<SVGElement | null>(null)
  const handleSetRef = useRef<HandleSet | null>(null)

  // Tool state refs (avoid stale closures in event handlers)
  const activeToolRef = useRef<DrawingTool>(activeTool)
  const gridEnabledRef = useRef(gridEnabled)
  const gridSizeRef = useRef(gridSize)
  const snapEnabledRef = useRef(snapEnabled)
  const selectedIdsRef = useRef<string[]>([])

  activeToolRef.current = activeTool
  gridEnabledRef.current = gridEnabled
  gridSizeRef.current = gridSize
  snapEnabledRef.current = snapEnabled

  // Drawing state refs
  const isDrawingRef = useRef(false)
  const drawStartRef = useRef({ x: 0, y: 0 })
  const currentShapeRef = useRef<SVGElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)

  // Drag/move state
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const dragElementRef = useRef<SVGElement | null>(null)
  const dragOrigPosRef = useRef({ x: 0, y: 0 })

  // Emit SVG content
  const emitContent = useCallback(() => {
    if (!drawRef.current) return
    onContentChange(drawRef.current.svg())
  }, [onContentChange])

  // ---------------------------------------------------------------------------
  // Grid rendering
  // ---------------------------------------------------------------------------
  const renderGrid = useCallback(() => {
    if (!drawRef.current) return
    if (gridGroupRef.current) {
      gridGroupRef.current.clear()
    } else {
      gridGroupRef.current = drawRef.current.group().attr({ id: 'io-grid' })
      gridGroupRef.current.back()
    }
    if (!gridEnabledRef.current) return

    const W = containerRef.current?.clientWidth ?? 1200
    const H = containerRef.current?.clientHeight ?? 800
    const gs = gridSizeRef.current

    const g = gridGroupRef.current as ReturnType<SVGRoot['group']>
    for (let x = 0; x <= W; x += gs) {
      g.line(x, 0, x, H).stroke({ color: '#27272a', width: 0.5, dasharray: '2,4' })
    }
    for (let y = 0; y <= H; y += gs) {
      g.line(0, y, W, y).stroke({ color: '#27272a', width: 0.5, dasharray: '2,4' })
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Selection handles
  // ---------------------------------------------------------------------------
  const showHandles = useCallback((el: SVGElement) => {
    if (!drawRef.current) return
    removeHandles(handleSetRef)

    const bbox = el.bbox()
    const { x, y, width: w, height: h } = bbox
    const hs = HANDLE_SIZE

    const positions = [
      { cx: x, cy: y },
      { cx: x + w / 2, cy: y },
      { cx: x + w, cy: y },
      { cx: x + w, cy: y + h / 2 },
      { cx: x + w, cy: y + h },
      { cx: x + w / 2, cy: y + h },
      { cx: x, cy: y + h },
      { cx: x, cy: y + h / 2 },
    ]

    const draw = drawRef.current
    const group = draw.group()
    const handles: SVGElement[] = []

    // Selection border
    group
      .rect(w + 2, h + 2)
      .move(x - 1, y - 1)
      .fill('none')
      .stroke({ color: 'var(--io-accent)', width: 1, dasharray: '4,2' })

    // Handles
    positions.forEach(({ cx, cy }) => {
      const handle = group
        .rect(hs, hs)
        .move(cx - hs / 2, cy - hs / 2)
        .fill('var(--io-surface-elevated)')
        .stroke({ color: 'var(--io-accent)', width: 1 })
        .attr({ cursor: 'nwse-resize' })
      handles.push(handle as unknown as SVGElement)
    })

    handleSetRef.current = {
      group: group as unknown as SVGElement,
      handles,
      target: el,
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Select element
  // ---------------------------------------------------------------------------
  const selectElement = useCallback(
    (el: SVGElement | null) => {
      removeHandles(handleSetRef)
      if (!el) {
        selectedIdsRef.current = []
        onSelectionChange([])
        return
      }
      const id = el.attr('data-id') as string
      if (!id) return
      selectedIdsRef.current = [id]
      onSelectionChange([id])
      showHandles(el)
    },
    [onSelectionChange, showHandles],
  )

  // ---------------------------------------------------------------------------
  // SVG.js init
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return
    const W = containerRef.current.clientWidth || 1200
    const H = containerRef.current.clientHeight || 800
    const draw = SVG().addTo(containerRef.current).size('100%', '100%')
    drawRef.current = draw

    if (initialSvg) {
      // draw.svg() getter returns outerHTML (full <svg>…</svg> string).
      // draw.svg(str) setter calls innerHTML, so passing the full string
      // creates a nested <svg> inside <svg>.  Parse and load inner content only.
      const parsed = new DOMParser().parseFromString(initialSvg, 'image/svg+xml')
      const savedSvg = parsed.documentElement

      // Restore coordinate system from saved viewBox, fall back to container size
      const vb = savedSvg.getAttribute('viewBox')
      if (vb) {
        draw.node.setAttribute('viewBox', vb)
      } else {
        draw.node.setAttribute('viewBox', `0 0 ${W} ${H}`)
      }

      // Load inner content directly — avoids SVG.js wrapping it in another <svg>
      draw.node.innerHTML = savedSvg.innerHTML

      const gridEl = draw.findOne('#io-grid')
      const contentEl = draw.findOne('#io-content')
      if (gridEl) gridGroupRef.current = gridEl as unknown as SVGElement
      if (contentEl) contentGroupRef.current = contentEl as unknown as SVGElement
      if (!draw.findOne('#io-bg')) {
        draw.rect('100%', '100%').fill(BG_COLOR).attr({ id: 'io-bg' }).back()
      }
    } else {
      // Fresh canvas — use container dimensions as coordinate system
      draw.node.setAttribute('viewBox', `0 0 ${W} ${H}`)
      draw.rect('100%', '100%').fill(BG_COLOR).attr({ id: 'io-bg' })
      gridGroupRef.current = draw.group().attr({ id: 'io-grid' }) as unknown as SVGElement
      contentGroupRef.current = draw.group().attr({ id: 'io-content' }) as unknown as SVGElement
    }

    // getContentRef returns the full SVG including viewBox — used for saving
    getContentRef.current = () => draw.node.outerHTML

    renderGrid()

    return () => {
      if (textInputRef.current) {
        textInputRef.current.remove()
        textInputRef.current = null
      }
      removeHandles(handleSetRef)
      draw.remove()
      drawRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render grid when settings change
  useEffect(() => {
    renderGrid()
  }, [gridEnabled, gridSize, renderGrid])

  // Apply zoom + pan to content group
  useEffect(() => {
    if (!contentGroupRef.current) return
    contentGroupRef.current.transform({ scale: zoom, translateX: panX, translateY: panY })
  }, [zoom, panX, panY])

  // ---------------------------------------------------------------------------
  // Pointer events on the SVG container
  // ---------------------------------------------------------------------------
  const getSVGCoords = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const rawX = (e.clientX - rect.left - panX) / zoom
      const rawY = (e.clientY - rect.top - panY) / zoom
      return {
        x: snapToGrid(rawX, gridSizeRef.current, snapEnabledRef.current),
        y: snapToGrid(rawY, gridSizeRef.current, snapEnabledRef.current),
      }
    },
    [panX, panY, zoom],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drawRef.current || !contentGroupRef.current) return
      const tool = activeToolRef.current
      const { x, y } = getSVGCoords(e)

      if (tool === 'select') {
        // Hit test — find element at point
        const svgEl = drawRef.current.node
        const pt = svgEl.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const hitEl = document.elementFromPoint(e.clientX, e.clientY)
        const dataEl = hitEl?.closest('[data-id]') as SVGGraphicsElement | null

        if (dataEl) {
          const wrappedEl = SVG(dataEl) as unknown as SVGElement
          selectElement(wrappedEl)
          // Start drag
          isDraggingRef.current = true
          dragStartRef.current = { x: e.clientX, y: e.clientY }
          dragElementRef.current = wrappedEl
          const bbox = wrappedEl.bbox()
          dragOrigPosRef.current = { x: bbox.x, y: bbox.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        } else {
          selectElement(null)
        }
        return
      }

      if (tool === 'text') {
        // Place a text input at click location
        if (textInputRef.current) {
          textInputRef.current.remove()
          textInputRef.current = null
        }
        const rect2 = containerRef.current!.getBoundingClientRect()
        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = 'Type text…'
        input.style.cssText = `
          position: absolute;
          left: ${e.clientX - rect2.left}px;
          top: ${e.clientY - rect2.top}px;
          background: rgba(9,9,11,0.8);
          border: 1px solid var(--io-accent);
          color: var(--io-text-primary);
          font-size: 14px;
          padding: 2px 6px;
          outline: none;
          z-index: 999;
          border-radius: 3px;
          min-width: 120px;
        `
        containerRef.current!.appendChild(input)
        textInputRef.current = input
        input.focus()
        const finalize = () => {
          const val = input.value.trim()
          input.remove()
          textInputRef.current = null
          if (!val || !contentGroupRef.current) return
          const textEl = (contentGroupRef.current as ReturnType<SVGRoot['group']>)
            .text(val)
            .move(x, y)
            .font({ size: 14, family: 'inherit' })
            .fill('var(--io-text-primary)')
            .attr({ 'data-id': nextId() })
          selectElement(textEl as unknown as SVGElement)
          emitContent()
        }
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') finalize()
          if (ev.key === 'Escape') {
            input.remove()
            textInputRef.current = null
          }
        })
        input.addEventListener('blur', finalize)
        return
      }

      // Drawing tools (rect, ellipse, line, pipe)
      isDrawingRef.current = true
      drawStartRef.current = { x, y }
      e.currentTarget.setPointerCapture(e.pointerId)

      const cg = contentGroupRef.current as ReturnType<SVGRoot['group']>

      if (tool === 'rect') {
        currentShapeRef.current = cg
          .rect(1, 1)
          .move(x, y)
          .fill(FILL_DEFAULT)
          .stroke({ color: STROKE_DEFAULT, width: 1 })
          .attr({ 'data-id': nextId() }) as unknown as SVGElement
      } else if (tool === 'ellipse') {
        currentShapeRef.current = cg
          .ellipse(1, 1)
          .move(x, y)
          .fill(FILL_DEFAULT)
          .stroke({ color: STROKE_DEFAULT, width: 1 })
          .attr({ 'data-id': nextId() }) as unknown as SVGElement
      } else if (tool === 'line' || tool === 'pipe') {
        const strokeWidth = tool === 'pipe' ? 3 : 1
        currentShapeRef.current = cg
          .line(x, y, x, y)
          .stroke({ color: STROKE_DEFAULT, width: strokeWidth })
          .attr({ 'data-id': nextId() }) as unknown as SVGElement
      }
    },
    [getSVGCoords, selectElement, emitContent],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const { x, y } = getSVGCoords(e)
      const sx = drawStartRef.current.x
      const sy = drawStartRef.current.y

      // Drag selected element
      if (isDraggingRef.current && dragElementRef.current) {
        const dx = (e.clientX - dragStartRef.current.x) / zoom
        const dy = (e.clientY - dragStartRef.current.y) / zoom
        const newX = snapToGrid(dragOrigPosRef.current.x + dx, gridSizeRef.current, snapEnabledRef.current)
        const newY = snapToGrid(dragOrigPosRef.current.y + dy, gridSizeRef.current, snapEnabledRef.current)
        ;(dragElementRef.current as ReturnType<SVGRoot['rect']>).move(newX, newY)
        if (handleSetRef.current) {
          showHandles(dragElementRef.current)
        }
        return
      }

      if (!isDrawingRef.current || !currentShapeRef.current) return

      const tool = activeToolRef.current
      const minX = Math.min(x, sx)
      const minY = Math.min(y, sy)
      const w = Math.abs(x - sx)
      const h = Math.abs(y - sy)

      if (tool === 'rect') {
        ;(currentShapeRef.current as ReturnType<SVGRoot['rect']>).move(minX, minY).size(w, h)
      } else if (tool === 'ellipse') {
        ;(currentShapeRef.current as ReturnType<SVGRoot['ellipse']>).move(minX, minY).size(w, h)
      } else if (tool === 'line' || tool === 'pipe') {
        ;(currentShapeRef.current as ReturnType<SVGRoot['line']>).plot(sx, sy, x, y)
      }
    },
    [getSVGCoords, zoom, showHandles],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId)

      if (isDraggingRef.current) {
        isDraggingRef.current = false
        dragElementRef.current = null
        emitContent()
        return
      }

      if (!isDrawingRef.current || !currentShapeRef.current) return
      isDrawingRef.current = false

      const shape = currentShapeRef.current
      currentShapeRef.current = null

      // Remove degenerate shapes (too small)
      const bbox = shape.bbox()
      if (bbox.width < 2 && bbox.height < 2) {
        shape.remove()
        return
      }

      selectElement(shape)
      emitContent()
    },
    [selectElement, emitContent],
  )

  // ---------------------------------------------------------------------------
  // Keyboard events
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!drawRef.current || !contentGroupRef.current) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        for (const id of selectedIdsRef.current) {
          const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
          if (node) SVG(node).remove()
        }
        removeHandles(handleSetRef)
        selectedIdsRef.current = []
        onSelectionChange([])
        emitContent()
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        // Undo handled in parent via undoStack
        _onStateChange({ undoStack: [] }) // signal parent — parent manages undo state
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault()
        _onStateChange({ redoStack: [] })
      }
    },
    [onSelectionChange, emitContent, _onStateChange],
  )

  // Drop from Symbol Library
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const svgData = e.dataTransfer.getData('symbol-svg')
      if (!svgData || !contentGroupRef.current) return

      const rect = containerRef.current!.getBoundingClientRect()
      const rawX = (e.clientX - rect.left - panX) / zoom
      const rawY = (e.clientY - rect.top - panY) / zoom
      const x = snapToGrid(rawX, gridSizeRef.current, snapEnabledRef.current)
      const y = snapToGrid(rawY, gridSizeRef.current, snapEnabledRef.current)

      const cg = contentGroupRef.current as ReturnType<SVGRoot['group']>
      const group = cg.group().attr({ 'data-id': nextId() })
      group.svg(svgData).move(x, y)
      selectElement(group as unknown as SVGElement)
      emitContent()
    },
    [panX, panY, zoom, selectElement, emitContent],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: BG_COLOR,
        cursor: activeTool === 'select' ? 'default' : 'crosshair',
        outline: 'none',
        position: 'relative',
      }}
    />
  )
}
