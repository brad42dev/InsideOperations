import PaneWrapper from './PaneWrapper'
import type { WorkspaceLayout, PaneConfig } from './types'

export interface WorkspaceGridProps {
  workspace: WorkspaceLayout
  editMode: boolean
  onConfigurePane: (paneId: string) => void
  onRemovePane: (paneId: string) => void
  onGraphicSelected?: (paneId: string, graphicId: string) => void
}

// ---------------------------------------------------------------------------
// CSS grid templates per layout preset
// ---------------------------------------------------------------------------

interface GridTemplate {
  gridTemplateColumns: string
  gridTemplateRows: string
  // For 2x1+1 we need per-cell area overrides
  cellAreas?: string[]
}

function getGridTemplate(layout: WorkspaceLayout['layout']): GridTemplate {
  switch (layout) {
    // ---- Even grids ---------------------------------------------------------
    case '1x1':
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    case '2x1':
      return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr' }
    case '1x2':
      return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(2, 1fr)' }
    case '2x2':
      return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
    case '3x1':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr' }
    case '1x3':
      return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(3, 1fr)' }
    case '3x2':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
    case '2x3':
      return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }
    case '3x3':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }
    case '4x1':
      return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: '1fr' }
    case '1x4':
      return { gridTemplateColumns: '1fr', gridTemplateRows: 'repeat(4, 1fr)' }
    case '4x2':
      return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }
    case '2x4':
      return { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }
    case '4x3':
      return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }
    case '3x4':
      return { gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }
    case '4x4':
      return { gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }

    // ---- Asymmetric ---------------------------------------------------------

    // 1 large pane on the left, 3 stacked small panes on the right
    case 'big-left-3-right':
      return {
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: 'repeat(3, 1fr)',
        cellAreas: [
          '1 / 1 / 4 / 2', // big left — spans all 3 rows
          '1 / 2 / 2 / 3',
          '2 / 2 / 3 / 3',
          '3 / 2 / 4 / 3',
        ],
      }

    // 1 large pane on the right, 3 stacked small panes on the left
    case 'big-right-3-left':
      return {
        gridTemplateColumns: '1fr 2fr',
        gridTemplateRows: 'repeat(3, 1fr)',
        cellAreas: [
          '1 / 1 / 2 / 2',
          '2 / 1 / 3 / 2',
          '3 / 1 / 4 / 2',
          '1 / 2 / 4 / 3', // big right — spans all 3 rows
        ],
      }

    // 1 large pane on top, 3 side-by-side small panes on the bottom
    case 'big-top-3-bottom':
      return {
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: '2fr 1fr',
        cellAreas: [
          '1 / 1 / 2 / 4', // big top — spans all 3 columns
          '2 / 1 / 3 / 2',
          '2 / 2 / 3 / 3',
          '2 / 3 / 3 / 4',
        ],
      }

    // 3 side-by-side small panes on top, 1 large pane on the bottom
    case 'big-bottom-3-top':
      return {
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: '1fr 2fr',
        cellAreas: [
          '1 / 1 / 2 / 2',
          '1 / 2 / 2 / 3',
          '1 / 3 / 2 / 4',
          '2 / 1 / 3 / 4', // big bottom — spans all 3 columns
        ],
      }

    // 2 large panes (top row) + 4 small panes (bottom row)
    case '2-big-4-small':
      return {
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: '2fr 1fr',
        cellAreas: [
          '1 / 1 / 2 / 3', // big left (spans cols 1–2)
          '1 / 3 / 2 / 5', // big right (spans cols 3–4)
          '2 / 1 / 3 / 2',
          '2 / 2 / 3 / 3',
          '2 / 3 / 3 / 4',
          '2 / 4 / 3 / 5',
        ],
      }

    // Main pane filling most of the space; small overlay pane in bottom-right corner
    case 'pip':
      return {
        gridTemplateColumns: '3fr 1fr',
        gridTemplateRows: '3fr 1fr',
        cellAreas: [
          '1 / 1 / 3 / 3', // main — full area
          '2 / 2 / 3 / 3', // pip overlay — bottom-right cell
        ],
      }

    // Large featured pane on the left (2/3 width), narrower sidebar on the right
    case 'featured-sidebar':
      return {
        gridTemplateColumns: '2fr 1fr',
        gridTemplateRows: '1fr',
      }

    // Two panes side by side but unequal (60/40 split)
    case 'side-by-side-unequal':
      return {
        gridTemplateColumns: '3fr 2fr',
        gridTemplateRows: '1fr',
      }

    // ---- Legacy -------------------------------------------------------------
    case '2x1+1':
      // Top row: 2 panes side-by-side; bottom row: 1 pane spanning full width
      return {
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        cellAreas: ['1 / 1 / 2 / 2', '1 / 2 / 2 / 3', '2 / 1 / 3 / 3'],
      }

    default:
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
  }
}

// How many panes the layout expects
function paneCount(layout: WorkspaceLayout['layout']): number {
  switch (layout) {
    // Even grids
    case '1x1': return 1
    case '2x1': return 2
    case '1x2': return 2
    case '2x2': return 4
    case '3x1': return 3
    case '1x3': return 3
    case '3x2': return 6
    case '2x3': return 6
    case '3x3': return 9
    case '4x1': return 4
    case '1x4': return 4
    case '4x2': return 8
    case '2x4': return 8
    case '4x3': return 12
    case '3x4': return 12
    case '4x4': return 16
    // Asymmetric
    case 'big-left-3-right': return 4
    case 'big-right-3-left': return 4
    case 'big-top-3-bottom': return 4
    case 'big-bottom-3-top': return 4
    case '2-big-4-small': return 6
    case 'pip': return 2
    case 'featured-sidebar': return 2
    case 'side-by-side-unequal': return 2
    // Legacy
    case '2x1+1': return 3
    default: return 1
  }
}

// ---------------------------------------------------------------------------
// WorkspaceGrid
// ---------------------------------------------------------------------------

export default function WorkspaceGrid({
  workspace,
  editMode,
  onConfigurePane,
  onRemovePane,
  onGraphicSelected,
}: WorkspaceGridProps) {
  const { gridTemplateColumns, gridTemplateRows, cellAreas } = getGridTemplate(workspace.layout)
  const expectedCount = paneCount(workspace.layout)

  // Pad panes array to expected count with blank placeholders
  const panes: PaneConfig[] = Array.from({ length: expectedCount }, (_, idx) => {
    return (
      workspace.panes[idx] ?? {
        id: `placeholder-${idx}`,
        type: 'blank' as const,
      }
    )
  })

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows,
        gap: 4,
        padding: 4,
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {panes.map((pane, idx) => (
        <div
          key={pane.id}
          style={{
            gridArea: cellAreas ? cellAreas[idx] : undefined,
            minHeight: 0,
            minWidth: 0,
            height: '100%',
          }}
        >
          <PaneWrapper
            config={pane}
            editMode={editMode}
            onConfigure={onConfigurePane}
            onRemove={onRemovePane}
            onGraphicSelected={onGraphicSelected}
          />
        </div>
      ))}
    </div>
  )
}
