/**
 * Designer store barrel export.
 *
 * Import stores and utilities from this file rather than their individual
 * modules to keep import paths stable and to make tree-shaking straightforward.
 *
 * Example usage:
 *   import { useSceneStore, useUiStore, snapToGridValue } from '@/store/designer'
 */

export { useSceneStore } from './sceneStore'
export type { SceneStore } from './sceneStore'

export { useHistoryStore } from './historyStore'
export type { HistoryStore, HistoryEntry } from './historyStore'

export { useUiStore, snapToGridValue } from './uiStore'
export type {
  UiStore,
  DrawingTool,
  DesignerViewport,
  DragState,
  ResizeState,
  RotateState,
  TextEditState,
  PipeDrawState,
  GuideDefinition,
  SmartGuide,
  PanelState,
  DrawPreview,
  MarqueeState,
} from './uiStore'

export { useLibraryStore } from './libraryStore'
export type {
  LibraryStore,
  ShapeEntry,
  ShapeSidecar,
  ConnectionPoint,
  TextZone,
  ValueAnchor,
  ShapeIndexItem,
} from './libraryStore'

export { useTabStore, MAX_TABS } from './tabStore'
export type {
  TabStore,
  DesignerTab,
  SavedTabState,
} from './tabStore'
