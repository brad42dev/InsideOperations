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

export type LayoutPreset = '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '2x1+1'

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
