// Console module type definitions

export type PaneType = 'graphic' | 'trend' | 'point_table' | 'alarm_list' | 'blank'

export interface PaneConfig {
  id: string
  type: PaneType
  title?: string
  // graphic pane
  graphicId?: string
  // trend pane
  trendPointIds?: string[]
  trendDuration?: number // minutes, default 60
  // point_table pane
  tablePointIds?: string[]
  // alarm_list pane
  alarmFilter?: 'all' | 'active' | 'unacknowledged'
}

export type LayoutPreset =
  // Even grids
  | '1x1' | '2x1' | '1x2' | '2x2'
  | '3x1' | '1x3' | '3x2' | '2x3' | '3x3'
  | '4x1' | '1x4' | '4x2' | '2x4' | '4x3' | '3x4' | '4x4'
  // Asymmetric
  | 'big-left-3-right'
  | 'big-right-3-left'
  | 'big-top-3-bottom'
  | 'big-bottom-3-top'
  | '2-big-4-small'
  | 'pip'
  | 'featured-sidebar'
  | 'side-by-side-unequal'
  // Legacy (keep for backwards compat)
  | '2x1+1'

export interface WorkspaceLayout {
  id: string
  name: string
  layout: LayoutPreset
  panes: PaneConfig[]
}

export interface ConsoleState {
  workspaces: WorkspaceLayout[]
  activeWorkspaceId: string | null
  editMode: boolean
}
