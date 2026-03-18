import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { GridLayout, noCompactor, type LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import PaneWrapper from './PaneWrapper'
import type { ConsoleDragItem } from './ConsolePalette'
import type { WorkspaceLayout, PaneConfig, LayoutPreset, GridItem } from './types'

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
  onConfigurePane: (paneId: string) => void
  onRemovePane: (paneId: string) => void
  onSelectPane?: (paneId: string, addToSelection: boolean) => void
  onPaletteDrop?: (paneId: string, item: ConsoleDragItem) => void
  onGridLayoutChange?: (items: GridItem[]) => void
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
  onConfigurePane,
  onRemovePane,
  onSelectPane,
  onPaletteDrop,
  onGridLayoutChange,
}: WorkspaceGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [containerHeight, setContainerHeight] = useState(600)

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

  // Augment grid items with min size constraints
  const layoutWithConstraints: LayoutItem[] = gridItems.map((item) => ({
    ...item,
    minW: MIN_ITEM_W,
    minH: MIN_ITEM_H,
  }))

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}
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
        className="io-workspace-grid"
      >
        {layoutWithConstraints.map((item) => {
          const pane = paneById.get(item.i)
          if (!pane) return null
          return (
            <div key={pane.id} style={{ overflow: 'hidden' }}>
              <PaneWrapper
                config={pane}
                editMode={editMode}
                isSelected={selectedPaneIds?.has(pane.id) ?? false}
                onConfigure={onConfigurePane}
                onRemove={onRemovePane}
                onSelect={onSelectPane}
                onPaletteDrop={onPaletteDrop}
              />
            </div>
          )
        })}
      </GridLayout>
    </div>
  )
}
