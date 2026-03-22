import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { GridLayout, noCompactor, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import PaneWrapper from './PaneWrapper'
import type { ConsoleDragItem } from './ConsolePalette'
import type { WorkspaceLayout, PaneConfig, LayoutPreset, GridItem } from './types'

// ---------------------------------------------------------------------------
// AABB overlap ratio helper — returns the fraction of rectA's area that
// overlaps with rectB.
// ---------------------------------------------------------------------------

function overlapRatio(
  aX: number, aY: number, aW: number, aH: number,
  bX: number, bY: number, bW: number, bH: number,
): number {
  const ix = Math.max(0, Math.min(aX + aW, bX + bW) - Math.max(aX, bX))
  const iy = Math.max(0, Math.min(aY + aH, bY + bH) - Math.max(aY, bY))
  const area = aW * aH
  if (area === 0) return 0
  return (ix * iy) / area
}

// ---------------------------------------------------------------------------
// Preset → default grid items (12-column × 12-row coordinate system)
// ---------------------------------------------------------------------------

export function presetToGridItems(layout: LayoutPreset, panes: PaneConfig[]): GridItem[] {
  const slots = defaultSlots(layout)
  return panes.slice(0, slots.length).map((p, idx) => ({
    i: p.id,
    x: slots[idx]?.x ?? 0,
    y: slots[idx]?.y ?? 0,
    w: slots[idx]?.w ?? 12,
    h: slots[idx]?.h ?? 12,
  }))
}

type Slot = { x: number; y: number; w: number; h: number }

function defaultSlots(layout: LayoutPreset): Slot[] {
  switch (layout) {
    case '1x1':   return [s(0, 0, 12, 12)]
    case '2x1':   return [s(0, 0, 6, 12), s(6, 0, 6, 12)]
    case '1x2':   return [s(0, 0, 12, 6), s(0, 6, 12, 6)]
    case '2x2':   return [s(0,0,6,6), s(6,0,6,6), s(0,6,6,6), s(6,6,6,6)]
    case '3x1':   return [s(0,0,4,12), s(4,0,4,12), s(8,0,4,12)]
    case '1x3':   return [s(0,0,12,4), s(0,4,12,4), s(0,8,12,4)]
    case '3x2':   return [s(0,0,4,6), s(4,0,4,6), s(8,0,4,6), s(0,6,4,6), s(4,6,4,6), s(8,6,4,6)]
    case '2x3':   return [s(0,0,6,4), s(6,0,6,4), s(0,4,6,4), s(6,4,6,4), s(0,8,6,4), s(6,8,6,4)]
    case '3x3':   return evenGrid(3, 3)
    case '4x1':   return [s(0,0,3,12), s(3,0,3,12), s(6,0,3,12), s(9,0,3,12)]
    case '1x4':   return [s(0,0,12,3), s(0,3,12,3), s(0,6,12,3), s(0,9,12,3)]
    case '4x2':   return evenGrid(4, 2)
    case '2x4':   return evenGrid(2, 4)
    case '4x3':   return evenGrid(4, 3)
    case '3x4':   return evenGrid(3, 4)
    case '4x4':   return evenGrid(4, 4)
    case 'big-left-3-right':
      return [s(0,0,8,12), s(8,0,4,4), s(8,4,4,4), s(8,8,4,4)]
    case 'big-right-3-left':
      return [s(0,0,4,4), s(0,4,4,4), s(0,8,4,4), s(4,0,8,12)]
    case 'big-top-3-bottom':
      return [s(0,0,12,8), s(0,8,4,4), s(4,8,4,4), s(8,8,4,4)]
    case 'big-bottom-3-top':
      return [s(0,0,4,4), s(4,0,4,4), s(8,0,4,4), s(0,4,12,8)]
    case '2-big-4-small':
      return [s(0,0,6,8), s(6,0,6,8), s(0,8,3,4), s(3,8,3,4), s(6,8,3,4), s(9,8,3,4)]
    case 'pip':
      return [s(0,0,12,12), s(9,9,3,3)]
    case 'featured-sidebar':
      return [s(0,0,8,12), s(8,0,4,12)]
    case 'side-by-side-unequal':
      return [s(0,0,7,12), s(7,0,5,12)]
    case '2x1+1':
      return [s(0,0,6,6), s(6,0,6,6), s(0,6,12,6)]
    default:
      return [s(0, 0, 12, 12)]
  }
}

function s(x: number, y: number, w: number, h: number): Slot {
  return { x, y, w, h }
}

function evenGrid(cols: number, rows: number): Slot[] {
  const w = Math.floor(12 / cols)
  const h = Math.floor(12 / rows)
  const slots: Slot[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      slots.push(s(col * w, row * h, w, h))
    }
  }
  return slots
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkspaceGridProps {
  workspace: WorkspaceLayout
  editMode: boolean
  selectedPaneIds?: Set<string>
  preserveAspectRatio?: boolean
  onConfigurePane: (paneId: string) => void
  onRemovePane: (paneId: string) => void
  onSelectPane?: (paneId: string, addToSelection: boolean) => void
  onPaletteDrop?: (paneId: string, item: ConsoleDragItem) => void
  onGridLayoutChange?: (items: GridItem[]) => void
  /** Called when user right-clicks the workspace background (not on a pane) */
  onWorkspaceContextMenu?: (x: number, y: number) => void
  /** Pane ID that initiated "Swap With..." mode */
  swapModeSourceId?: string | null
  /** Called when user clicks "Swap With..." on a pane */
  onSwapWith?: (paneId: string) => void
  /** Called when user clicks a swap target pane */
  onSwapComplete?: (targetId: string) => void
  /** Called when user selects a new graphic in the Replace dialog */
  onReplace?: (paneId: string, graphicId: string, graphicName: string) => void
}

// ---------------------------------------------------------------------------
// WorkspaceGrid — react-grid-layout (12-col drag-resize, doc 07)
// ---------------------------------------------------------------------------

const GRID_COLS = 12
const GRID_ROWS = 12
const MIN_ITEM_W = 2
const MIN_ITEM_H = 2

export default function WorkspaceGrid({
  workspace,
  editMode,
  selectedPaneIds,
  preserveAspectRatio = true,
  onConfigurePane,
  onWorkspaceContextMenu,
  onRemovePane,
  onSelectPane,
  onPaletteDrop,
  onGridLayoutChange,
  swapModeSourceId,
  onSwapWith,
  onSwapComplete,
  onReplace,
}: WorkspaceGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [containerHeight, setContainerHeight] = useState(600)

  // ── Swap target visual indicator ─────────────────────────────────────────
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null)

  // ── Fullscreen state ─────────────────────────────────────────────────────
  const [fullscreenPaneId, setFullscreenPaneId] = useState<string | null>(null)

  const toggleFullscreen = useCallback((paneId: string) => {
    setFullscreenPaneId((prev) => (prev === paneId ? null : paneId))
  }, [])

  // F11 keyboard shortcut: toggle fullscreen on single selected pane
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F11') {
        e.preventDefault()
        // If already fullscreen, exit
        if (fullscreenPaneId !== null) {
          setFullscreenPaneId(null)
          return
        }
        // If exactly one pane is selected, enter fullscreen on it
        if (selectedPaneIds && selectedPaneIds.size === 1) {
          const [paneId] = selectedPaneIds
          setFullscreenPaneId(paneId)
        }
      }
      // Escape exits fullscreen
      if (e.key === 'Escape' && fullscreenPaneId !== null) {
        setFullscreenPaneId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreenPaneId, selectedPaneIds])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    setContainerHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const gridItems: GridItem[] = workspace.gridItems?.length
    ? workspace.gridItems
    : presetToGridItems(workspace.layout, workspace.panes)

  const paneById = useMemo(
    () => new Map<string, PaneConfig>(workspace.panes.map((p) => [p.id, p])),
    [workspace.panes],
  )

  // rowHeight fills the container: subtract gap between rows (margin=4 per gap, GRID_ROWS+1 gaps)
  const rowHeight = Math.max(40, Math.floor((containerHeight - (GRID_ROWS + 1) * 4) / GRID_ROWS))

  const handleLayoutChange = useCallback(
    (layout: readonly LayoutItem[]) => {
      if (!editMode || !onGridLayoutChange) return
      onGridLayoutChange(layout.map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h })))
    },
    [editMode, onGridLayoutChange],
  )

  // ── Pane swap on drag stop ────────────────────────────────────────────────
  // When a dragged pane overlaps another pane by >50%, swap their grid positions.

  const handleDragStop = useCallback(
    (layout: readonly LayoutItem[], _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (!editMode || !onGridLayoutChange) return
      setSwapTargetId(null)

      if (!newItem) {
        onGridLayoutChange(layout.map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h })))
        return
      }

      // Find if the dragged item overlaps another pane by more than 50%
      let swapCandidate: LayoutItem | null = null
      for (const other of layout) {
        if (other.i === newItem.i) continue
        const ratio = overlapRatio(
          newItem.x, newItem.y, newItem.w, newItem.h,
          other.x, other.y, other.w, other.h,
        )
        if (ratio > 0.5) {
          swapCandidate = other
          break
        }
      }

      if (!swapCandidate) {
        // No swap — just emit the normal layout
        onGridLayoutChange(layout.map((item) => ({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h })))
        return
      }

      // Perform swap: the dragged pane takes candidate's slot, candidate takes dragged pane's original slot
      const candidateId = swapCandidate.i
      const swapped = layout.map((item): GridItem => {
        if (item.i === newItem.i) {
          // Dragged pane goes to where the candidate was
          return { i: item.i, x: swapCandidate!.x, y: swapCandidate!.y, w: swapCandidate!.w, h: swapCandidate!.h }
        }
        if (item.i === candidateId) {
          // Candidate goes to where the dragged pane now is (newItem position)
          return { i: item.i, x: newItem.x, y: newItem.y, w: newItem.w, h: newItem.h }
        }
        return { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }
      })
      onGridLayoutChange(swapped)
    },
    [editMode, onGridLayoutChange],
  )

  // During drag, update visual swap indicator
  const handleDrag = useCallback(
    (layout: readonly LayoutItem[], _oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      if (!editMode) return
      if (!newItem) { setSwapTargetId(null); return }
      let candidateId: string | null = null
      for (const other of layout) {
        if (other.i === newItem.i) continue
        const ratio = overlapRatio(
          newItem.x, newItem.y, newItem.w, newItem.h,
          other.x, other.y, other.w, other.h,
        )
        if (ratio > 0.5) {
          candidateId = other.i
          break
        }
      }
      setSwapTargetId(candidateId)
    },
    [editMode],
  )

  // Augment grid items with min size constraints
  const layoutWithConstraints: LayoutItem[] = gridItems.map((item) => ({
    ...item,
    minW: MIN_ITEM_W,
    minH: MIN_ITEM_H,
  }))

  // ── Box selection ──────────────────────────────────────────────────────────

  const [boxRect, setBoxRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const boxStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!editMode || !onSelectPane) return
      // Only start box-select when clicking on empty grid background (not on a pane)
      const target = e.target as HTMLElement
      if (target.closest('[data-pane-id]')) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      boxStartRef.current = { x, y }
      setBoxRect({ x1: x, y1: y, x2: x, y2: y })
    },
    [editMode, onSelectPane],
  )

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!boxStartRef.current) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setBoxRect({ x1: boxStartRef.current.x, y1: boxStartRef.current.y, x2: x, y2: y })
    },
    [],
  )

  const handleGridPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      if (!boxStartRef.current || !boxRect || !onSelectPane) {
        boxStartRef.current = null
        setBoxRect(null)
        return
      }
      boxStartRef.current = null

      // Normalize the selection rect to min/max
      const selLeft   = Math.min(boxRect.x1, boxRect.x2)
      const selTop    = Math.min(boxRect.y1, boxRect.y2)
      const selRight  = Math.max(boxRect.x1, boxRect.x2)
      const selBottom = Math.max(boxRect.y1, boxRect.y2)

      // Only select if dragged at least 6px
      if (selRight - selLeft < 6 && selBottom - selTop < 6) {
        setBoxRect(null)
        return
      }

      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) { setBoxRect(null); return }

      // Collect all pane elements and check overlap
      const paneEls = containerRef.current?.querySelectorAll<HTMLElement>('[data-pane-id]')
      paneEls?.forEach((el) => {
        const paneId = el.dataset.paneId
        if (!paneId) return
        const r = el.getBoundingClientRect()
        const paneLeft   = r.left - containerRect.left
        const paneTop    = r.top  - containerRect.top
        const paneRight  = paneLeft + r.width
        const paneBottom = paneTop  + r.height
        // AABB overlap
        const overlaps = paneLeft < selRight && paneRight > selLeft && paneTop < selBottom && paneBottom > selTop
        if (overlaps) {
          onSelectPane(paneId, true)
        }
      })

      setBoxRect(null)
    },
    [boxRect, onSelectPane],
  )

  const handleGridContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only fire for clicks on the grid background, not on pane elements
      const target = e.target as HTMLElement
      const isPaneArea = !!target.closest('[data-pane-id]')
      if (!isPaneArea && onWorkspaceContextMenu) {
        e.preventDefault()
        onWorkspaceContextMenu(e.clientX, e.clientY)
      }
    },
    [onWorkspaceContextMenu],
  )

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}
      onPointerDown={handleGridPointerDown}
      onPointerMove={handleGridPointerMove}
      onPointerUp={handleGridPointerUp}
      onContextMenu={handleGridContextMenu}
    >
      <GridLayout
        layout={layoutWithConstraints}
        width={containerWidth}
        gridConfig={{
          cols: GRID_COLS,
          rowHeight,
          margin: [4, 4],
          containerPadding: [4, 4],
          maxRows: Infinity,
        }}
        dragConfig={{
          enabled: editMode,
          handle: '.io-pane-drag-handle',
          bounded: false,
          threshold: 3,
        }}
        resizeConfig={{
          enabled: editMode,
          handles: ['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's'],
        }}
        compactor={noCompactor}
        autoSize={false}
        style={{ height: '100%' }}
        onLayoutChange={handleLayoutChange}
        onDragStop={handleDragStop}
        onDrag={handleDrag}
        className="io-workspace-grid"
      >
        {layoutWithConstraints.map((item) => {
          const pane = paneById.get(item.i)
          if (!pane) return null
          const isPaneFullscreen = fullscreenPaneId === pane.id
          // When another pane is fullscreen, hide this one
          const isHidden = fullscreenPaneId !== null && !isPaneFullscreen
          const isSwapTarget = swapTargetId === pane.id
          return (
            <div
              key={pane.id}
              data-pane-id={pane.id}
              data-swap-target={isSwapTarget ? 'true' : undefined}
              style={{
                overflow: 'hidden',
                display: isHidden ? 'none' : undefined,
                outline: isSwapTarget ? '2px dashed var(--io-accent)' : undefined,
                outlineOffset: isSwapTarget ? '-2px' : undefined,
              }}
            >
              <PaneWrapper
                config={pane}
                editMode={editMode}
                isSelected={selectedPaneIds?.has(pane.id) ?? false}
                isFullscreen={isPaneFullscreen}
                onToggleFullscreen={() => toggleFullscreen(pane.id)}
                onConfigure={onConfigurePane}
                onRemove={onRemovePane}
                onSelect={onSelectPane}
                onPaletteDrop={onPaletteDrop}
                preserveAspectRatio={preserveAspectRatio}
                swapModeSourceId={swapModeSourceId}
                onSwapWith={onSwapWith}
                onSwapComplete={onSwapComplete}
                onReplace={onReplace}
              />
            </div>
          )
        })}
      </GridLayout>

      {/* Box selection rect */}
      {boxRect && editMode && (
        <div
          style={{
            position: 'absolute',
            left:   Math.min(boxRect.x1, boxRect.x2),
            top:    Math.min(boxRect.y1, boxRect.y2),
            width:  Math.abs(boxRect.x2 - boxRect.x1),
            height: Math.abs(boxRect.y2 - boxRect.y1),
            border: '1px solid var(--io-accent)',
            background: 'var(--io-accent-subtle)',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}
    </div>
  )
}
