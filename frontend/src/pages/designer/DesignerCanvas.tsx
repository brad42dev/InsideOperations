import React, { useRef, useEffect, useCallback, useState } from 'react'
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
  onZoomChange: (zoom: number, panX: number, panY: number) => void
  getContentRef: React.MutableRefObject<(() => string) | null>
  imageImportTriggerRef?: React.MutableRefObject<(() => void) | null>
  initialSvg?: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const HANDLE_SIZE = 8
const ROTATION_HANDLE_OFFSET = 24
const BG_COLOR = '#09090b'
const STROKE_DEFAULT = 'var(--io-accent)'
const FILL_DEFAULT = 'rgba(45,212,191,0.15)'
const SELECTION_COLOR = 'var(--io-accent)'

let elementCounter = 0
function nextId() {
  return `el-${++elementCounter}-${Date.now()}`
}

function snapToGrid(v: number, gridSize: number, enabled: boolean): number {
  if (!enabled) return v
  return Math.round(v / gridSize) * gridSize
}

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------
interface ContextMenuState {
  x: number
  y: number
  type: 'object' | 'canvas'
  elementId?: string
  /** Number of selected elements at the time the menu opened */
  selectionCount?: number
  /** Whether the single selected element is already a group */
  isGroup?: boolean
}

interface ContextMenuProps {
  menu: ContextMenuState
  onClose: () => void
  onAction: (action: string) => void
}

function ContextMenu({ menu, onClose, onAction }: ContextMenuProps) {
  useEffect(() => {
    const handler = () => onClose()
    document.addEventListener('mousedown', handler, { once: true })
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const menuItemStyle: React.CSSProperties = {
    padding: '6px 16px',
    fontSize: '12px',
    color: 'var(--io-text-primary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const separatorItemStyle: React.CSSProperties = {
    height: '1px',
    background: 'var(--io-border)',
    margin: '3px 0',
  }

  const kbdStyle: React.CSSProperties = {
    marginLeft: 'auto',
    fontSize: '10px',
    color: 'var(--io-text-muted)',
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: '3px',
    padding: '1px 4px',
  }

  function Item({ label, action, kbd }: { label: string; action: string; kbd?: string }) {
    return (
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--io-accent-subtle)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        onMouseDown={(e) => { e.stopPropagation(); onAction(action); onClose() }}
      >
        <span>{label}</span>
        {kbd && <kbd style={kbdStyle}>{kbd}</kbd>}
      </div>
    )
  }

  const selCount = menu.selectionCount ?? 0
  const canGroup = selCount >= 2
  const canUngroup = menu.isGroup === true

  const objectItems = (
    <>
      <Item label="Cut" action="cut" kbd="Ctrl+X" />
      <Item label="Copy" action="copy" kbd="Ctrl+C" />
      <Item label="Paste" action="paste" kbd="Ctrl+V" />
      <Item label="Delete" action="delete" kbd="Del" />
      <div style={separatorItemStyle} />
      <Item label="Bring to Front" action="front" />
      <Item label="Send to Back" action="back" />
      <Item label="Bring Forward" action="forward" />
      <Item label="Send Backward" action="backward" />
      <div style={separatorItemStyle} />
      <Item label="Rotate 90° CW" action="rotate-cw" />
      <Item label="Rotate 90° CCW" action="rotate-ccw" />
      <Item label="Flip Horizontal" action="flip-h" />
      <Item label="Flip Vertical" action="flip-v" />
      <div style={separatorItemStyle} />
      {canGroup && <Item label="Group" action="group" kbd="Ctrl+G" />}
      {canUngroup && <Item label="Ungroup" action="ungroup" kbd="Ctrl+Shift+G" />}
      {(canGroup || canUngroup) && <div style={separatorItemStyle} />}
      <Item label="Properties / Bind to Point…" action="properties" />
    </>
  )

  const canvasItems = (
    <>
      <Item label="Select All" action="select-all" kbd="Ctrl+A" />
      <Item label="Paste" action="paste" kbd="Ctrl+V" />
      <Item label="Zoom to Fit" action="zoom-fit" kbd="Ctrl+0" />
    </>
  )

  return (
    <div
      style={{
        position: 'fixed',
        left: menu.x,
        top: menu.y,
        zIndex: 1000,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        minWidth: '200px',
        paddingTop: '4px',
        paddingBottom: '4px',
        overflow: 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menu.type === 'object' ? objectItems : canvasItems}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Handle management
// ---------------------------------------------------------------------------
interface HandleSet {
  group: ReturnType<SVGRoot['group']>
  handles: Array<{ el: SVGElement; pos: string }>
  rotationHandle: SVGElement | null
  target: SVGElement
}

function buildHandles(draw: SVGRoot, el: SVGElement): HandleSet {
  const bbox = el.bbox()
  const { x, y, width: w, height: h } = bbox
  const hs = HANDLE_SIZE

  const positions = [
    { cx: x,       cy: y,       pos: 'nw', cursor: 'nw-resize' },
    { cx: x + w/2, cy: y,       pos: 'n',  cursor: 'n-resize'  },
    { cx: x + w,   cy: y,       pos: 'ne', cursor: 'ne-resize' },
    { cx: x + w,   cy: y + h/2, pos: 'e',  cursor: 'e-resize'  },
    { cx: x + w,   cy: y + h,   pos: 'se', cursor: 'se-resize' },
    { cx: x + w/2, cy: y + h,   pos: 's',  cursor: 's-resize'  },
    { cx: x,       cy: y + h,   pos: 'sw', cursor: 'sw-resize' },
    { cx: x,       cy: y + h/2, pos: 'w',  cursor: 'w-resize'  },
  ]

  const group = draw.group().attr({ id: 'io-handles', 'data-handles': '1' })

  // Selection border
  group
    .rect(w + 2, h + 2)
    .move(x - 1, y - 1)
    .fill('none')
    .stroke({ color: SELECTION_COLOR, width: 1, dasharray: '4,2' })

  // Resize handles
  const handles: Array<{ el: SVGElement; pos: string }> = []
  positions.forEach(({ cx, cy, pos, cursor }) => {
    const handle = group
      .rect(hs, hs)
      .move(cx - hs / 2, cy - hs / 2)
      .fill('var(--io-surface-elevated)')
      .stroke({ color: SELECTION_COLOR, width: 1.5 })
      .attr({ cursor, 'data-handle': pos, 'data-handle-type': 'resize' })
    handles.push({ el: handle as unknown as SVGElement, pos })
  })

  // Rotation handle (circle above top-center)
  const rotY = y - ROTATION_HANDLE_OFFSET
  const rotCX = x + w / 2

  // Line from top-center to rotation handle
  group
    .line(rotCX, y, rotCX, rotY + 6)
    .stroke({ color: SELECTION_COLOR, width: 1 })

  const rotHandle = group
    .circle(10)
    .move(rotCX - 5, rotY - 5)
    .fill('var(--io-surface-elevated)')
    .stroke({ color: SELECTION_COLOR, width: 1.5 })
    .attr({ cursor: 'grab', 'data-handle-type': 'rotate' })

  return {
    group,
    handles,
    rotationHandle: rotHandle as unknown as SVGElement,
    target: el,
  }
}

function removeHandleGroup(handleSetRef: React.MutableRefObject<HandleSet | null>) {
  if (handleSetRef.current) {
    handleSetRef.current.group.remove()
    handleSetRef.current = null
  }
}

// ---------------------------------------------------------------------------
// Marquee (rubber-band selection)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SVGRectEl = any

interface MarqueeState {
  startX: number
  startY: number
  rect: SVGRectEl
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
  onZoomChange,
  getContentRef,
  imageImportTriggerRef,
  initialSvg,
}: DesignerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawRef = useRef<SVGRoot | null>(null)
  const gridGroupRef = useRef<SVGElement | null>(null)
  const contentGroupRef = useRef<SVGElement | null>(null)
  const handleSetRef = useRef<HandleSet | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  // Tool state refs
  const activeToolRef = useRef<DrawingTool>(activeTool)
  const gridEnabledRef = useRef(gridEnabled)
  const gridSizeRef = useRef(gridSize)
  const snapEnabledRef = useRef(snapEnabled)
  const selectedIdsRef = useRef<string[]>([])
  const zoomRef = useRef(zoom)
  const panXRef = useRef(panX)
  const panYRef = useRef(panY)

  activeToolRef.current = activeTool
  gridEnabledRef.current = gridEnabled
  gridSizeRef.current = gridSize
  snapEnabledRef.current = snapEnabled
  zoomRef.current = zoom
  panXRef.current = panX
  panYRef.current = panY

  // Drawing state refs
  const isDrawingRef = useRef(false)
  const drawStartRef = useRef({ x: 0, y: 0 })
  const currentShapeRef = useRef<SVGElement | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)
  const pencilPathRef = useRef<string>('')

  // Drag/move state
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const dragElementRef = useRef<SVGElement | null>(null)
  const dragOrigPosRef = useRef({ x: 0, y: 0 })
  const dragMultiRef = useRef<Array<{ el: SVGElement; origX: number; origY: number }>>([])

  // Resize state
  const isResizingRef = useRef(false)
  const resizeHandlePosRef = useRef('')
  const resizeStartRef = useRef({ x: 0, y: 0 })
  const resizeOrigBboxRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Rotation state
  const isRotatingRef = useRef(false)
  const rotateCenterRef = useRef({ x: 0, y: 0 })
  const rotateStartAngleRef = useRef(0)
  const rotateOrigAngleRef = useRef(0)

  // Marquee state
  const marqueeRef = useRef<MarqueeState>({ startX: 0, startY: 0, rect: null })
  const isMarqueeRef = useRef(false)

  // Pan state
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panOrigRef = useRef({ x: 0, y: 0 })
  const spaceHeldRef = useRef(false)

  // Copy/paste clipboard
  const clipboardRef = useRef<string | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ---------------------------------------------------------------------------
  // Emit SVG content
  // ---------------------------------------------------------------------------
  const emitContent = useCallback(() => {
    if (!drawRef.current) return
    onContentChange(drawRef.current.node.outerHTML)
  }, [onContentChange])

  // ---------------------------------------------------------------------------
  // Grid rendering
  // ---------------------------------------------------------------------------
  const renderGrid = useCallback(() => {
    if (!drawRef.current) return
    if (gridGroupRef.current) {
      gridGroupRef.current.clear()
    } else {
      gridGroupRef.current = drawRef.current.group().attr({ id: 'io-grid' }) as unknown as SVGElement
      ;(gridGroupRef.current as unknown as ReturnType<SVGRoot['group']>).back()
    }
    if (!gridEnabledRef.current) return

    const W = containerRef.current?.clientWidth ?? 1200
    const H = containerRef.current?.clientHeight ?? 800
    const gs = gridSizeRef.current

    const g = gridGroupRef.current as unknown as ReturnType<SVGRoot['group']>
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
    removeHandleGroup(handleSetRef)
    const set = buildHandles(drawRef.current, el)
    handleSetRef.current = set
  }, [])

  const refreshHandles = useCallback(() => {
    if (handleSetRef.current && drawRef.current) {
      const target = handleSetRef.current.target
      removeHandleGroup(handleSetRef)
      handleSetRef.current = buildHandles(drawRef.current, target)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Select element
  // ---------------------------------------------------------------------------
  const selectElement = useCallback(
    (el: SVGElement | null, addToSelection = false) => {
      if (!drawRef.current) return
      removeHandleGroup(handleSetRef)

      if (!el) {
        selectedIdsRef.current = []
        onSelectionChange([])
        return
      }

      const id = el.attr('data-id') as string
      if (!id) return

      if (addToSelection) {
        if (selectedIdsRef.current.includes(id)) {
          // Deselect
          selectedIdsRef.current = selectedIdsRef.current.filter((x) => x !== id)
        } else {
          selectedIdsRef.current = [...selectedIdsRef.current, id]
        }
      } else {
        selectedIdsRef.current = [id]
      }

      onSelectionChange([...selectedIdsRef.current])

      // Show handles on primary (last selected)
      if (selectedIdsRef.current.length > 0) {
        const primaryId = selectedIdsRef.current[selectedIdsRef.current.length - 1]
        const primaryNode = drawRef.current.node.querySelector(`[data-id="${primaryId}"]`)
        if (primaryNode) {
          showHandles(SVG(primaryNode) as unknown as SVGElement)
        }
      }
    },
    [onSelectionChange, showHandles],
  )

  const selectAll = useCallback(() => {
    if (!drawRef.current || !contentGroupRef.current) return
    removeHandleGroup(handleSetRef)
    const all = Array.from(
      (contentGroupRef.current as unknown as HTMLElement).querySelectorAll('[data-id]'),
    ) as SVGGraphicsElement[]
    const ids = all.map((n) => n.getAttribute('data-id')!).filter(Boolean)
    selectedIdsRef.current = ids
    onSelectionChange(ids)
    if (ids.length > 0) {
      const last = drawRef.current.node.querySelector(`[data-id="${ids[ids.length - 1]}"]`)
      if (last) showHandles(SVG(last) as unknown as SVGElement)
    }
  }, [onSelectionChange, showHandles])

  // ---------------------------------------------------------------------------
  // Delete selected
  // ---------------------------------------------------------------------------
  const deleteSelected = useCallback(() => {
    if (!drawRef.current) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) SVG(node).remove()
    }
    removeHandleGroup(handleSetRef)
    selectedIdsRef.current = []
    onSelectionChange([])
    emitContent()
  }, [onSelectionChange, emitContent])

  // ---------------------------------------------------------------------------
  // Copy / paste
  // ---------------------------------------------------------------------------
  const copySelected = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    const fragments: string[] = []
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) fragments.push((node as Element).outerHTML)
    }
    clipboardRef.current = fragments.join('\n')
  }, [])

  const pasteClipboard = useCallback(() => {
    if (!clipboardRef.current || !contentGroupRef.current) return
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<svg>${clipboardRef.current}</svg>`, 'image/svg+xml')
    const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>
    const newIds: string[] = []
    Array.from(doc.documentElement.children).forEach((child) => {
      const newId = nextId()
      child.setAttribute('data-id', newId)
      // Offset pasted elements by 10px
      const el = child as SVGGraphicsElement
      const transform = el.getAttribute('transform') ?? ''
      el.setAttribute('transform', `translate(10, 10) ${transform}`.trim())
      const clone = document.importNode(child, true)
      cg.node.appendChild(clone)
      newIds.push(newId)
    })
    // Select newly pasted elements
    removeHandleGroup(handleSetRef)
    selectedIdsRef.current = newIds
    onSelectionChange(newIds)
    if (newIds.length > 0 && drawRef.current) {
      const last = drawRef.current.node.querySelector(`[data-id="${newIds[newIds.length - 1]}"]`)
      if (last) showHandles(SVG(last) as unknown as SVGElement)
    }
    emitContent()
  }, [onSelectionChange, showHandles, emitContent])

  // ---------------------------------------------------------------------------
  // Z-order
  // ---------------------------------------------------------------------------
  const bringToFront = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) SVG(node).front()
    }
    emitContent()
  }, [emitContent])

  const sendToBack = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) SVG(node).back()
    }
    emitContent()
  }, [emitContent])

  const bringForward = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) SVG(node).forward()
    }
    emitContent()
  }, [emitContent])

  const sendBackward = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) SVG(node).backward()
    }
    emitContent()
  }, [emitContent])

  // ---------------------------------------------------------------------------
  // Rotate / flip
  // ---------------------------------------------------------------------------
  const rotateCW = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) {
        const el = SVG(node) as unknown as ReturnType<SVGRoot['rect']>
        const bbox = (el as unknown as SVGElement).bbox()
        const cx = bbox.x + bbox.width / 2
        const cy = bbox.y + bbox.height / 2
        el.rotate(90, cx, cy)
      }
    }
    refreshHandles()
    emitContent()
  }, [refreshHandles, emitContent])

  const rotateCCW = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) {
        const el = SVG(node) as unknown as ReturnType<SVGRoot['rect']>
        const bbox = (el as unknown as SVGElement).bbox()
        const cx = bbox.x + bbox.width / 2
        const cy = bbox.y + bbox.height / 2
        el.rotate(-90, cx, cy)
      }
    }
    refreshHandles()
    emitContent()
  }, [refreshHandles, emitContent])

  const flipH = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) {
        const el = SVG(node) as unknown as ReturnType<SVGRoot['rect']>
        const bbox = (el as unknown as SVGElement).bbox()
        const cx = bbox.x + bbox.width / 2
        const cy = bbox.y + bbox.height / 2
        el.flip('x', cx)
        void cy
      }
    }
    refreshHandles()
    emitContent()
  }, [refreshHandles, emitContent])

  const flipV = useCallback(() => {
    if (!drawRef.current || selectedIdsRef.current.length === 0) return
    for (const id of selectedIdsRef.current) {
      const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
      if (node) {
        const el = SVG(node) as unknown as ReturnType<SVGRoot['rect']>
        const bbox = (el as unknown as SVGElement).bbox()
        const cx = bbox.x + bbox.width / 2
        const cy = bbox.y + bbox.height / 2
        el.flip('y', cy)
        void cx
      }
    }
    refreshHandles()
    emitContent()
  }, [refreshHandles, emitContent])

  // ---------------------------------------------------------------------------
  // Group / Ungroup
  // ---------------------------------------------------------------------------
  const groupSelected = useCallback(() => {
    if (!drawRef.current || !contentGroupRef.current || selectedIdsRef.current.length < 2) return
    const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>
    const groupId = nextId()
    const newGroup = cg.group().attr({ 'data-id': groupId })

    // Move each selected element into the group (preserving DOM order)
    const allNodes = Array.from(
      (contentGroupRef.current as unknown as HTMLElement).querySelectorAll('[data-id]'),
    ) as SVGGraphicsElement[]
    for (const node of allNodes) {
      const id = node.getAttribute('data-id')
      if (id && selectedIdsRef.current.includes(id)) {
        newGroup.node.appendChild(node)
      }
    }

    removeHandleGroup(handleSetRef)
    selectedIdsRef.current = [groupId]
    onSelectionChange([groupId])
    showHandles(newGroup as unknown as SVGElement)
    emitContent()
  }, [onSelectionChange, showHandles, emitContent])

  const ungroupSelected = useCallback(() => {
    if (!drawRef.current || !contentGroupRef.current || selectedIdsRef.current.length !== 1) return
    const id = selectedIdsRef.current[0]
    const node = drawRef.current.node.querySelector(`[data-id="${id}"]`) as SVGGraphicsElement | null
    if (!node || node.tagName.toLowerCase() !== 'g') return

    const cg = contentGroupRef.current as unknown as HTMLElement
    const children = Array.from(node.children) as SVGGraphicsElement[]
    const newIds: string[] = []
    for (const child of children) {
      // Ensure each child has a data-id
      if (!child.getAttribute('data-id')) {
        child.setAttribute('data-id', nextId())
      }
      newIds.push(child.getAttribute('data-id')!)
      cg.insertBefore(child, node)
    }
    // Remove the now-empty group
    node.remove()

    removeHandleGroup(handleSetRef)
    selectedIdsRef.current = newIds
    onSelectionChange(newIds)
    if (newIds.length > 0 && drawRef.current) {
      const last = drawRef.current.node.querySelector(`[data-id="${newIds[newIds.length - 1]}"]`)
      if (last) showHandles(SVG(last) as unknown as SVGElement)
    }
    emitContent()
  }, [onSelectionChange, showHandles, emitContent])

  // ---------------------------------------------------------------------------
  // Context menu actions
  // ---------------------------------------------------------------------------
  const handleContextAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'cut':
          copySelected()
          deleteSelected()
          break
        case 'copy':
          copySelected()
          break
        case 'paste':
          pasteClipboard()
          break
        case 'delete':
          deleteSelected()
          break
        case 'front':
          bringToFront()
          break
        case 'back':
          sendToBack()
          break
        case 'forward':
          bringForward()
          break
        case 'backward':
          sendBackward()
          break
        case 'rotate-cw':
          rotateCW()
          break
        case 'rotate-ccw':
          rotateCCW()
          break
        case 'flip-h':
          flipH()
          break
        case 'flip-v':
          flipV()
          break
        case 'group':
          groupSelected()
          break
        case 'ungroup':
          ungroupSelected()
          break
        case 'select-all':
          selectAll()
          break
        case 'zoom-fit':
          onZoomChange(1, 0, 0)
          break
        case 'properties':
          // Signal parent to open property panel binding tab
          if (selectedIdsRef.current.length > 0) {
            onSelectionChange([...selectedIdsRef.current])
          }
          break
      }
    },
    [
      copySelected, deleteSelected, pasteClipboard,
      bringToFront, sendToBack, bringForward, sendBackward,
      rotateCW, rotateCCW, flipH, flipV,
      groupSelected, ungroupSelected,
      selectAll, onZoomChange, onSelectionChange,
    ],
  )

  // ---------------------------------------------------------------------------
  // SVG coordinate conversion
  // ---------------------------------------------------------------------------
  const getSVGCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const rawX = (clientX - rect.left - panXRef.current) / zoomRef.current
      const rawY = (clientY - rect.top - panYRef.current) / zoomRef.current
      return {
        x: snapToGrid(rawX, gridSizeRef.current, snapEnabledRef.current),
        y: snapToGrid(rawY, gridSizeRef.current, snapEnabledRef.current),
      }
    },
    [],
  )

  const getSVGCoordsRaw = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (clientX - rect.left - panXRef.current) / zoomRef.current,
        y: (clientY - rect.top - panYRef.current) / zoomRef.current,
      }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Hit testing
  // ---------------------------------------------------------------------------
  function getHitElement(clientX: number, clientY: number): { el: SVGElement | null; handleType: string | null; handlePos: string | null } {
    const hitEl = document.elementFromPoint(clientX, clientY)
    if (!hitEl) return { el: null, handleType: null, handlePos: null }

    // Check if it's a handle
    const handleEl = hitEl.closest('[data-handle-type]') as SVGGraphicsElement | null
    if (handleEl) {
      const type = handleEl.getAttribute('data-handle-type')
      const pos = handleEl.getAttribute('data-handle') ?? null
      return { el: null, handleType: type, handlePos: pos }
    }

    // Check if it's a canvas element
    const dataEl = hitEl.closest('[data-id]') as SVGGraphicsElement | null
    if (dataEl) {
      return { el: SVG(dataEl) as unknown as SVGElement, handleType: null, handlePos: null }
    }

    return { el: null, handleType: null, handlePos: null }
  }

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
      const parsed = new DOMParser().parseFromString(initialSvg, 'image/svg+xml')
      const savedSvg = parsed.documentElement

      // Check for a parse error
      const parseError = savedSvg.querySelector('parsererror')
      if (parseError) {
        console.error('[Designer] SVG parse error in initialSvg')
      }

      const vb = savedSvg.getAttribute('viewBox')
      if (vb) {
        draw.node.setAttribute('viewBox', vb)
      } else {
        const svgW = savedSvg.getAttribute('width')
        const svgH = savedSvg.getAttribute('height')
        if (svgW && svgH) {
          draw.node.setAttribute('viewBox', `0 0 ${parseFloat(svgW)} ${parseFloat(svgH)}`)
        } else {
          draw.node.setAttribute('viewBox', `0 0 ${W} ${H}`)
        }
      }

      // Check whether this SVG was previously saved by the designer
      // (has the structural groups io-bg, io-grid, io-content with data-id elements)
      const hasContentGroup = !!savedSvg.querySelector('#io-content')
      const contentGroupNode = hasContentGroup ? savedSvg.querySelector('#io-content') : null
      const elementsHaveDataId = contentGroupNode
        ? contentGroupNode.querySelector('[data-id]') !== null ||
          contentGroupNode.childElementCount === 0
        : false

      if (hasContentGroup && elementsHaveDataId) {
        // Previously saved designer document — restore innerHTML directly
        draw.node.innerHTML = savedSvg.innerHTML
        const gridEl = draw.findOne('#io-grid')
        const contentEl = draw.findOne('#io-content')
        if (gridEl) gridGroupRef.current = gridEl as unknown as SVGElement
        if (contentEl) contentGroupRef.current = contentEl as unknown as SVGElement
        if (!draw.findOne('#io-bg')) {
          draw.rect('100%', '100%').fill(BG_COLOR).attr({ id: 'io-bg' }).back()
        }
      } else {
        // Flat SVG or designer document where elements lack data-id.
        // Build the standard structure and import each element, assigning data-id.
        draw.rect('100%', '100%').fill(BG_COLOR).attr({ id: 'io-bg' })
        gridGroupRef.current = draw.group().attr({ id: 'io-grid' }) as unknown as SVGElement
        const contentGroup = draw.group().attr({ id: 'io-content' })
        contentGroupRef.current = contentGroup as unknown as SVGElement

        // Determine source children — if there is an #io-content group, import its
        // children; otherwise import all children of the SVG root.
        let sourceParent: Element = savedSvg
        if (hasContentGroup && contentGroupNode) {
          sourceParent = contentGroupNode
        }

        // Import each element as an individually selectable shape
        for (const child of Array.from(sourceParent.children)) {
          const tag = child.tagName.toLowerCase()

          // Skip designer infrastructure elements
          if (
            child.id === 'io-bg' ||
            child.id === 'io-grid' ||
            child.id === 'io-content' ||
            child.id === 'io-handles' ||
            child.getAttribute('data-handles') === '1' ||
            child.getAttribute('data-marquee') === '1'
          ) continue

          if (tag === 'defs') {
            // Copy defs into the draw element's defs
            for (const def of Array.from(child.children)) {
              const imported = document.importNode(def, true)
              draw.defs().node.appendChild(imported)
            }
            continue
          }

          // Determine existing data-id or assign a new one
          const existingDataId = child.getAttribute('data-id')
          const dataId = existingDataId || nextId()

          // Clone the element into the content group
          const clone = document.importNode(child, true)
          clone.setAttribute('data-id', dataId)

          // Preserve original element ID in data-original-id if present and different
          if (child.id && child.id !== dataId) {
            clone.setAttribute('data-original-id', child.id)
            // Keep the original id attribute so point bindings referencing it still work
          }

          contentGroup.node.appendChild(clone)
        }
      }
    } else {
      draw.node.setAttribute('viewBox', `0 0 ${W} ${H}`)
      draw.rect('100%', '100%').fill(BG_COLOR).attr({ id: 'io-bg' })
      gridGroupRef.current = draw.group().attr({ id: 'io-grid' }) as unknown as SVGElement
      contentGroupRef.current = draw.group().attr({ id: 'io-content' }) as unknown as SVGElement
    }

    getContentRef.current = () => draw.node.outerHTML
    renderGrid()

    // Create hidden file input for image import
    const imgInput = document.createElement('input')
    imgInput.type = 'file'
    imgInput.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'
    imgInput.style.display = 'none'
    imgInput.addEventListener('change', () => {
      const file = imgInput.files?.[0]
      if (!file || !contentGroupRef.current) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUri = ev.target?.result as string
        if (!dataUri) return
        const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>
        const W2 = containerRef.current?.clientWidth ?? 800
        const H2 = containerRef.current?.clientHeight ?? 600
        const imgW = 200
        const imgH = 150
        const cx = (W2 / 2 - panXRef.current) / zoomRef.current - imgW / 2
        const cy = (H2 / 2 - panYRef.current) / zoomRef.current - imgH / 2
        cg.image(dataUri)
          .size(imgW, imgH)
          .move(cx, cy)
          .attr({ 'data-id': nextId() })
        if (getContentRef.current) onContentChange(draw.node.outerHTML)
      }
      reader.readAsDataURL(file)
      imgInput.value = ''
    })
    document.body.appendChild(imgInput)
    imageInputRef.current = imgInput

    return () => {
      if (textInputRef.current) {
        textInputRef.current.remove()
        textInputRef.current = null
      }
      if (imageInputRef.current) {
        imageInputRef.current.remove()
        imageInputRef.current = null
      }
      removeHandleGroup(handleSetRef)
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
    ;(contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>).transform({
      scale: zoom,
      translateX: panX,
      translateY: panY,
    })
  }, [zoom, panX, panY])

  // ---------------------------------------------------------------------------
  // Wheel zoom
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.05), 10)

      // Zoom toward mouse position
      const newPanX = mouseX - (mouseX - panXRef.current) * (newZoom / zoomRef.current)
      const newPanY = mouseY - (mouseY - panYRef.current) * (newZoom / zoomRef.current)

      onZoomChange(newZoom, newPanX, newPanY)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [onZoomChange])

  // ---------------------------------------------------------------------------
  // Space key for temporary pan
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spaceHeldRef.current) {
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        spaceHeldRef.current = true
        if (containerRef.current) containerRef.current.style.cursor = 'grab'
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        if (containerRef.current) {
          containerRef.current.style.cursor =
            activeToolRef.current === 'select' ? 'default' : 'crosshair'
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Trigger image import (called by toolbar)
  // ---------------------------------------------------------------------------
  const triggerImageImport = useCallback(() => {
    imageInputRef.current?.click()
  }, [])

  // Expose triggerImageImport via ref so parent can call it
  const triggerImageImportRef = useRef(triggerImageImport)
  triggerImageImportRef.current = triggerImageImport

  // Also expose to parent via imageImportTriggerRef prop
  useEffect(() => {
    if (imageImportTriggerRef) {
      imageImportTriggerRef.current = () => triggerImageImportRef.current()
    }
  }, [imageImportTriggerRef])

  // ---------------------------------------------------------------------------
  // Pointer events
  // ---------------------------------------------------------------------------
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drawRef.current || !contentGroupRef.current) return
      if (e.button !== 0) return // only left button

      const tool = activeToolRef.current
      const { x, y } = getSVGCoords(e.clientX, e.clientY)

      // Space-held pan or explicit pan tool
      if (spaceHeldRef.current || tool === 'pan') {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX, y: e.clientY }
        panOrigRef.current = { x: panXRef.current, y: panYRef.current }
        e.currentTarget.setPointerCapture(e.pointerId)
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
        return
      }

      if (tool === 'select') {
        const { el, handleType, handlePos } = getHitElement(e.clientX, e.clientY)

        if (handleType === 'resize' && handlePos && handleSetRef.current) {
          // Start resize
          isResizingRef.current = true
          resizeHandlePosRef.current = handlePos
          const raw = getSVGCoordsRaw(e.clientX, e.clientY)
          resizeStartRef.current = raw
          const bbox = handleSetRef.current.target.bbox()
          resizeOrigBboxRef.current = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }

        if (handleType === 'rotate' && handleSetRef.current) {
          // Start rotation
          isRotatingRef.current = true
          const bbox = handleSetRef.current.target.bbox()
          rotateCenterRef.current = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
          const raw = getSVGCoordsRaw(e.clientX, e.clientY)
          rotateStartAngleRef.current = Math.atan2(
            raw.y - rotateCenterRef.current.y,
            raw.x - rotateCenterRef.current.x,
          ) * (180 / Math.PI)
          // Get current rotation from transform
          const transformStr = handleSetRef.current.target.attr('transform') as string ?? ''
          const rotMatch = transformStr.match(/rotate\(([^)]+)\)/)
          rotateOrigAngleRef.current = rotMatch ? parseFloat(rotMatch[1].split(',')[0]) : 0
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }

        if (el) {
          const addToSel = e.ctrlKey || e.metaKey || e.shiftKey
          selectElement(el, addToSel)
          if (!addToSel) {
            // Start drag
            isDraggingRef.current = true
            dragStartRef.current = { x: e.clientX, y: e.clientY }
            dragElementRef.current = el
            const bbox = el.bbox()
            dragOrigPosRef.current = { x: bbox.x, y: bbox.y }

            // Also set up multi-drag for all selected
            dragMultiRef.current = selectedIdsRef.current.map((id) => {
              const node = drawRef.current!.node.querySelector(`[data-id="${id}"]`)
              if (!node) return null
              const svgEl = SVG(node) as unknown as SVGElement
              const b = svgEl.bbox()
              return { el: svgEl, origX: b.x, origY: b.y }
            }).filter(Boolean) as Array<{ el: SVGElement; origX: number; origY: number }>

            e.currentTarget.setPointerCapture(e.pointerId)
          }
        } else {
          // Start marquee
          selectElement(null)
          isMarqueeRef.current = true
          const rawCoords = getSVGCoordsRaw(e.clientX, e.clientY)
          marqueeRef.current.startX = rawCoords.x
          marqueeRef.current.startY = rawCoords.y
          const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>
          marqueeRef.current.rect = cg
            .rect(0, 0)
            .move(rawCoords.x, rawCoords.y)
            .fill('rgba(45,212,191,0.05)')
            .stroke({ color: SELECTION_COLOR, width: 1, dasharray: '4,2' })
            .attr({ 'data-marquee': '1' })
          e.currentTarget.setPointerCapture(e.pointerId)
        }
        return
      }

      if (tool === 'text') {
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
          const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>
          const textEl = cg
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

      if (tool === 'image') {
        triggerImageImportRef.current()
        return
      }

      // Drawing tools
      isDrawingRef.current = true
      drawStartRef.current = { x, y }
      e.currentTarget.setPointerCapture(e.pointerId)

      const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>

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
      } else if (tool === 'pencil') {
        pencilPathRef.current = `M ${x} ${y}`
        currentShapeRef.current = cg
          .path(pencilPathRef.current)
          .fill('none')
          .stroke({ color: STROKE_DEFAULT, width: 1.5, linecap: 'round', linejoin: 'round' })
          .attr({ 'data-id': nextId() }) as unknown as SVGElement
      }
    },
    [getSVGCoords, getSVGCoordsRaw, selectElement, emitContent],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drawRef.current) return

      // Pan
      if (isPanningRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        onZoomChange(zoomRef.current, panOrigRef.current.x + dx, panOrigRef.current.y + dy)
        return
      }

      // Resize
      if (isResizingRef.current && handleSetRef.current) {
        const raw = getSVGCoordsRaw(e.clientX, e.clientY)
        const orig = resizeOrigBboxRef.current
        const pos = resizeHandlePosRef.current
        const target = handleSetRef.current.target
        const el = target as unknown as ReturnType<SVGRoot['rect']>

        let nx = orig.x
        let ny = orig.y
        let nw = orig.width
        let nh = orig.height
        const dx = raw.x - resizeStartRef.current.x
        const dy = raw.y - resizeStartRef.current.y
        const MIN = 4

        if (pos === 'nw') { nx = orig.x + dx; ny = orig.y + dy; nw = Math.max(MIN, orig.width - dx); nh = Math.max(MIN, orig.height - dy) }
        else if (pos === 'n')  { ny = orig.y + dy; nh = Math.max(MIN, orig.height - dy) }
        else if (pos === 'ne') { ny = orig.y + dy; nw = Math.max(MIN, orig.width + dx); nh = Math.max(MIN, orig.height - dy) }
        else if (pos === 'e')  { nw = Math.max(MIN, orig.width + dx) }
        else if (pos === 'se') { nw = Math.max(MIN, orig.width + dx); nh = Math.max(MIN, orig.height + dy) }
        else if (pos === 's')  { nh = Math.max(MIN, orig.height + dy) }
        else if (pos === 'sw') { nx = orig.x + dx; nw = Math.max(MIN, orig.width - dx); nh = Math.max(MIN, orig.height + dy) }
        else if (pos === 'w')  { nx = orig.x + dx; nw = Math.max(MIN, orig.width - dx) }

        nx = snapToGrid(nx, gridSizeRef.current, snapEnabledRef.current)
        ny = snapToGrid(ny, gridSizeRef.current, snapEnabledRef.current)
        nw = snapToGrid(nw, gridSizeRef.current, snapEnabledRef.current) || MIN
        nh = snapToGrid(nh, gridSizeRef.current, snapEnabledRef.current) || MIN

        el.move(nx, ny).size(nw, nh)
        refreshHandles()
        return
      }

      // Rotation
      if (isRotatingRef.current && handleSetRef.current) {
        const raw = getSVGCoordsRaw(e.clientX, e.clientY)
        const cx = rotateCenterRef.current.x
        const cy = rotateCenterRef.current.y
        const angle = Math.atan2(raw.y - cy, raw.x - cx) * (180 / Math.PI)
        const delta = angle - rotateStartAngleRef.current
        const newAngle = rotateOrigAngleRef.current + delta
        const el = handleSetRef.current.target as unknown as ReturnType<SVGRoot['rect']>
        el.rotate(newAngle, cx, cy)
        refreshHandles()
        return
      }

      // Drag
      if (isDraggingRef.current && dragElementRef.current) {
        const dx = (e.clientX - dragStartRef.current.x) / zoomRef.current
        const dy = (e.clientY - dragStartRef.current.y) / zoomRef.current

        if (dragMultiRef.current.length > 1) {
          // Move all selected
          for (const item of dragMultiRef.current) {
            const newX = snapToGrid(item.origX + dx, gridSizeRef.current, snapEnabledRef.current)
            const newY = snapToGrid(item.origY + dy, gridSizeRef.current, snapEnabledRef.current)
            ;(item.el as unknown as ReturnType<SVGRoot['rect']>).move(newX, newY)
          }
        } else {
          const newX = snapToGrid(dragOrigPosRef.current.x + dx, gridSizeRef.current, snapEnabledRef.current)
          const newY = snapToGrid(dragOrigPosRef.current.y + dy, gridSizeRef.current, snapEnabledRef.current)
          ;(dragElementRef.current as unknown as ReturnType<SVGRoot['rect']>).move(newX, newY)
        }
        refreshHandles()
        return
      }

      // Marquee
      if (isMarqueeRef.current && marqueeRef.current.rect) {
        const raw = getSVGCoordsRaw(e.clientX, e.clientY)
        const sx = marqueeRef.current.startX
        const sy = marqueeRef.current.startY
        const rx = Math.min(raw.x, sx)
        const ry = Math.min(raw.y, sy)
        const rw = Math.abs(raw.x - sx)
        const rh = Math.abs(raw.y - sy)
        marqueeRef.current.rect.move(rx, ry).size(rw, rh)
        return
      }

      if (!isDrawingRef.current || !currentShapeRef.current) return

      const { x, y } = getSVGCoords(e.clientX, e.clientY)
      const sx = drawStartRef.current.x
      const sy = drawStartRef.current.y
      const tool = activeToolRef.current
      const minX = Math.min(x, sx)
      const minY = Math.min(y, sy)
      const w = Math.abs(x - sx)
      const h = Math.abs(y - sy)

      if (tool === 'rect') {
        ;(currentShapeRef.current as unknown as ReturnType<SVGRoot['rect']>).move(minX, minY).size(w, h)
      } else if (tool === 'ellipse') {
        ;(currentShapeRef.current as unknown as ReturnType<SVGRoot['ellipse']>).move(minX, minY).size(w, h)
      } else if (tool === 'line' || tool === 'pipe') {
        ;(currentShapeRef.current as unknown as ReturnType<SVGRoot['line']>).plot(sx, sy, x, y)
      } else if (tool === 'pencil') {
        pencilPathRef.current += ` L ${x} ${y}`
        ;(currentShapeRef.current as unknown as ReturnType<SVGRoot['path']>).plot(pencilPathRef.current)
      }
    },
    [getSVGCoords, getSVGCoordsRaw, refreshHandles, onZoomChange],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId)

      if (isPanningRef.current) {
        isPanningRef.current = false
        if (containerRef.current) {
          containerRef.current.style.cursor =
            activeToolRef.current === 'pan' ? 'grab' : activeToolRef.current === 'select' ? 'default' : 'crosshair'
        }
        return
      }

      if (isResizingRef.current) {
        isResizingRef.current = false
        emitContent()
        return
      }

      if (isRotatingRef.current) {
        isRotatingRef.current = false
        emitContent()
        return
      }

      if (isDraggingRef.current) {
        isDraggingRef.current = false
        dragElementRef.current = null
        dragMultiRef.current = []
        emitContent()
        return
      }

      // Marquee select — find all elements within the marquee rect
      if (isMarqueeRef.current) {
        isMarqueeRef.current = false
        if (marqueeRef.current.rect && contentGroupRef.current && drawRef.current) {
          const marqueeBbox = marqueeRef.current.rect.bbox()
          marqueeRef.current.rect.remove()
          marqueeRef.current.rect = null

          if (marqueeBbox.width > 4 && marqueeBbox.height > 4) {
            // Find all data-id elements that intersect the marquee
            const allEls = Array.from(
              (contentGroupRef.current as unknown as HTMLElement).querySelectorAll('[data-id]'),
            ) as SVGGraphicsElement[]

            const hitIds: string[] = []
            for (const node of allEls) {
              try {
                const el = SVG(node) as unknown as SVGElement
                const bbox = el.bbox()
                const hit =
                  bbox.x < marqueeBbox.x + marqueeBbox.width &&
                  bbox.x + bbox.width > marqueeBbox.x &&
                  bbox.y < marqueeBbox.y + marqueeBbox.height &&
                  bbox.y + bbox.height > marqueeBbox.y
                if (hit) {
                  const id = node.getAttribute('data-id')
                  if (id) hitIds.push(id)
                }
              } catch {
                // skip
              }
            }

            selectedIdsRef.current = hitIds
            onSelectionChange(hitIds)
            if (hitIds.length > 0) {
              const last = drawRef.current.node.querySelector(`[data-id="${hitIds[hitIds.length - 1]}"]`)
              if (last) showHandles(SVG(last) as unknown as SVGElement)
            }
          } else {
            if (marqueeRef.current.rect) {
              marqueeRef.current.rect.remove()
              marqueeRef.current.rect = null
            }
          }
        }
        return
      }

      if (!isDrawingRef.current || !currentShapeRef.current) return
      isDrawingRef.current = false

      const shape = currentShapeRef.current
      currentShapeRef.current = null
      pencilPathRef.current = ''

      // Remove degenerate shapes
      const bbox = shape.bbox()
      if (bbox.width < 2 && bbox.height < 2) {
        shape.remove()
        return
      }

      selectElement(shape)
      emitContent()
    },
    [selectElement, emitContent, onSelectionChange, showHandles],
  )

  // ---------------------------------------------------------------------------
  // Right-click context menu
  // ---------------------------------------------------------------------------
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const { el } = getHitElement(e.clientX, e.clientY)
      if (el) {
        // Select element if not already selected
        const id = el.attr('data-id') as string
        if (!selectedIdsRef.current.includes(id)) {
          selectElement(el)
        }
        // After possibly selecting, check if the element is a group (<g> with data-id children)
        const domNode = drawRef.current?.node.querySelector(`[data-id="${id}"]`)
        const isGroup = domNode?.tagName.toLowerCase() === 'g' &&
          domNode.querySelectorAll('[data-id]').length > 0
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          type: 'object',
          elementId: id,
          selectionCount: selectedIdsRef.current.includes(id)
            ? selectedIdsRef.current.length
            : 1,
          isGroup: !!isGroup,
        })
      } else {
        setContextMenu({ x: e.clientX, y: e.clientY, type: 'canvas' })
      }
    },
    [selectElement],
  )

  // ---------------------------------------------------------------------------
  // Keyboard events
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!drawRef.current || !contentGroupRef.current) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
        return
      }

      // Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
        return
      }

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        copySelected()
        return
      }

      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        pasteClipboard()
        return
      }

      // Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault()
        copySelected()
        deleteSelected()
        return
      }

      // Undo — signal parent
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        _onStateChange({ undoStack: [] })
        return
      }

      // Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault()
        _onStateChange({ redoStack: [] })
        return
      }

      // Zoom in/out
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        onZoomChange(Math.min(zoomRef.current * 1.2, 10), panXRef.current, panYRef.current)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        onZoomChange(Math.max(zoomRef.current / 1.2, 0.05), panXRef.current, panYRef.current)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        onZoomChange(1, 0, 0)
        return
      }

      // Nudge with arrow keys
      const NUDGE = e.shiftKey ? 10 : 1
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const dx = e.key === 'ArrowLeft' ? -NUDGE : e.key === 'ArrowRight' ? NUDGE : 0
        const dy = e.key === 'ArrowUp' ? -NUDGE : e.key === 'ArrowDown' ? NUDGE : 0
        for (const id of selectedIdsRef.current) {
          const node = drawRef.current.node.querySelector(`[data-id="${id}"]`)
          if (!node) continue
          const el = SVG(node) as unknown as SVGElement
          const bbox = el.bbox()
          ;(el as unknown as ReturnType<SVGRoot['rect']>).move(bbox.x + dx, bbox.y + dy)
        }
        refreshHandles()
        emitContent()
        return
      }

      // Rotate shortcuts (no modifier key)
      if (e.key === '[' && !e.ctrlKey && !e.metaKey) { rotateCCW(); return }
      if (e.key === ']' && !e.ctrlKey && !e.metaKey) { rotateCW(); return }

      // Group / Ungroup
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'g') {
        e.preventDefault()
        groupSelected()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        ungroupSelected()
        return
      }
    },
    [
      deleteSelected, selectAll, copySelected, pasteClipboard,
      _onStateChange, onZoomChange, refreshHandles, emitContent,
      rotateCW, rotateCCW, groupSelected, ungroupSelected,
    ],
  )

  // Drop from Symbol Library
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const svgData = e.dataTransfer.getData('symbol-svg')
      if (!svgData || !contentGroupRef.current) return

      const { x, y } = getSVGCoords(e.clientX, e.clientY)
      const cg = contentGroupRef.current as unknown as ReturnType<SVGRoot['group']>
      const group = cg.group().attr({ 'data-id': nextId() })
      group.svg(svgData).move(x, y)
      selectElement(group as unknown as SVGElement)
      emitContent()
    },
    [getSVGCoords, selectElement, emitContent],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // Determine cursor
  const getCursor = () => {
    if (activeToolRef.current === 'pan') return 'grab'
    if (activeToolRef.current === 'select') return 'default'
    return 'crosshair'
  }

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          flex: 1,
          overflow: 'hidden',
          background: BG_COLOR,
          cursor: getCursor(),
          outline: 'none',
          position: 'relative',
        }}
      />
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </>
  )
}

// Export the trigger function type for the parent to call
export type { DesignerCanvasProps }
