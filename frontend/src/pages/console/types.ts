// Console module type definitions

import type { ChartConfig } from "../../shared/components/charts/chart-config-types";

export type PaneType =
  | "trend"
  | "point_table"
  | "alarm_list"
  | "graphic"
  | "blank";

export interface PaneConfig {
  id: string;
  type: PaneType;
  title?: string;
  /** When true, other panes cannot displace this pane during drag/resize. */
  pinned?: boolean;
  /** When true, the pane title bar is shown in live mode. Default absent = false (hidden). */
  showTitle?: boolean;
  // trend pane — legacy fields kept for backward compat, superseded by chartConfig
  trendPointIds?: string[];
  trendDuration?: number; // minutes, default 60
  /** Full chart configuration — replaces trendPointIds/trendDuration when present */
  chartConfig?: ChartConfig;
  /** When true, TrendPane opens Configure Chart on mount (set when dropped from palette). Cleared after first render. */
  promptConfig?: boolean;
  // point_table pane
  tablePointIds?: string[];
  // alarm_list pane
  alarmFilter?: "all" | "active" | "unacknowledged";
  // graphic pane
  graphicId?: string;
}

export type LayoutPreset =
  // Even grids
  | "1x1"
  | "2x1"
  | "1x2"
  | "2x2"
  | "3x1"
  | "1x3"
  | "3x2"
  | "2x3"
  | "3x3"
  | "4x1"
  | "1x4"
  | "4x2"
  | "2x4"
  | "4x3"
  | "3x4"
  | "4x4"
  // Asymmetric
  | "big-left-3-right"
  | "big-right-3-left"
  | "big-top-3-bottom"
  | "big-bottom-3-top"
  | "2-big-4-small"
  | "pip"
  | "featured-sidebar"
  | "side-by-side-unequal"
  // Legacy (keep for backwards compat)
  | "2x1+1";

/** One cell in the react-grid-layout 12-column coordinate system. `i` matches a PaneConfig.id. */
export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  layout: LayoutPreset;
  panes: PaneConfig[];
  /** Free-form pane positions. When present, overrides the static `layout` preset for rendering. */
  gridItems?: GridItem[];
  /** Panes that no longer fit the current template are parked here, not deleted.
   *  When switching to a larger template, overflow panes fill the new empty slots in order. */
  overflowPanes?: PaneConfig[];
  /** Whether this workspace is published (visible to all users with console:read) */
  published?: boolean;
  /** ID of the user who owns this workspace */
  owner_id?: string;
  /** Optional user-provided description */
  description?: string;
  /** When true, the workspace is fully frozen: no drag, resize, pin, or × interactions. */
  locked?: boolean;
}

export interface ConsoleState {
  workspaces: WorkspaceLayout[];
  activeWorkspaceId: string | null;
}
