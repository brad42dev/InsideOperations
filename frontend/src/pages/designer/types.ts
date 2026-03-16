export type DesignerMode = 'graphic' | 'dashboard' | 'report'
export type DrawingTool = 'select' | 'rect' | 'ellipse' | 'path' | 'text' | 'line' | 'pipe'

export interface DesignerState {
  mode: DesignerMode
  activeTool: DrawingTool
  selectedElementIds: string[]
  zoom: number
  panX: number
  panY: number
  isDirty: boolean          // unsaved changes
  documentId: string | null
  documentName: string
  gridEnabled: boolean
  gridSize: number          // pixels
  snapEnabled: boolean
  undoStack: string[]       // serialized SVG snapshots, max 20
  redoStack: string[]
}
