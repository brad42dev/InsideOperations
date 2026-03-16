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
    case '1x1':
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    case '2x1':
      return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' }
    case '1x2':
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }
    case '2x2':
      return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
    case '3x1':
      return { gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr' }
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
    case '1x1': return 1
    case '2x1': return 2
    case '1x2': return 2
    case '2x2': return 4
    case '3x1': return 3
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
