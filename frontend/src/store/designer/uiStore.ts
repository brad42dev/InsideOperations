/**
 * uiStore.ts
 *
 * All transient UI state for the Designer module.
 *
 * This store NEVER touches the scene graph. It holds:
 *  - The active drawing tool
 *  - Viewport position and zoom
 *  - Grid / snap / guide configuration
 *  - Live interaction state (drag, resize, rotate, text-edit)
 *  - Hover target
 *  - Smart guides (snap feedback during drag/resize)
 *  - Test mode toggle
 *  - Panel dimensions and collapse state
 *  - Phone preview flag
 *  - Draw preview (shape being drawn before mouse-up)
 *  - Marquee selection rectangle
 */

import { create } from 'zustand'
import type { Transform } from '../../shared/types/graphics'
import type { NodeId } from '../../shared/types/graphics'

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

export type DrawingTool =
  | 'select'
  | 'pen'
  | 'freehand'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'text'
  | 'pipe'
  | 'image'
  | 'annotation'
  | 'pan'

/**
 * Viewport pan/zoom state for the Designer canvas.
 * Named DesignerViewport to avoid collision with ViewportState in shared/types/graphics.ts
 * (which includes canvas/screen dimensions).
 */
export interface DesignerViewport {
  panX: number
  panY: number
  /** Zoom level — 0.1 (10%) to 8.0 (800%). Default 1.0 */
  zoom: number
}

/** Non-null when a drag interaction is in progress. Null = inactive. */
export interface DragState {
  startCanvasX: number
  startCanvasY: number
  /** nodeId → original {x, y} position at drag start */
  originalPositions: Map<string, { x: number; y: number }>
}

/** Non-null when a resize interaction is in progress. Null = inactive. */
export interface ResizeState {
  handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  originalBBox: { x: number; y: number; width: number; height: number }
  /** nodeId → original Transform at resize start */
  originalTransforms: Map<string, Transform>
}

/** Non-null when a rotate interaction is in progress. Null = inactive. */
export interface RotateState {
  center: { x: number; y: number }
  /** nodeId → original rotation (degrees) at rotate start */
  originalRotations: Map<string, number>
  startAngle: number
}

/** Non-null when in-place text editing is active. Null = inactive. */
export interface TextEditState {
  nodeId: string
  x: number
  y: number
  width: number
  height: number
  currentText: string
}

/**
 * Non-null while the user is drawing a pipe (click-to-add-waypoint mode).
 * Committed to the scene graph on double-click or Enter.
 */
export interface PipeDrawState {
  /** Waypoints accumulated so far, in canvas coordinates. */
  waypoints: Array<{ x: number; y: number }>
  /** Current cursor position (for live preview of the next segment). */
  cursorX: number
  cursorY: number
}

export interface GuideDefinition {
  id: string
  axis: 'h' | 'v'
  position: number
  locked?: boolean
}

export interface SmartGuide {
  axis: 'h' | 'v'
  position: number
  sourceNodeId: string | null
}

export interface PanelState {
  leftCollapsed: boolean
  rightCollapsed: boolean
  /** Left panel width in pixels. Default 240. */
  leftWidth: number
  /** Right panel width in pixels. Default 300. */
  rightWidth: number
}

// ---------------------------------------------------------------------------
// Draw preview type
// ---------------------------------------------------------------------------

export interface DrawPreview {
  type: 'rect' | 'ellipse' | 'line' | 'pipe'
  startX: number
  startY: number
  endX: number
  endY: number
}

// ---------------------------------------------------------------------------
// Marquee type
// ---------------------------------------------------------------------------

export interface MarqueeState {
  startX: number
  startY: number
  endX: number
  endY: number
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface UiStore {
  // ----- Tool -----
  activeTool: DrawingTool

  // ----- Viewport -----
  viewport: DesignerViewport

  // ----- Grid & snap -----
  gridVisible: boolean
  /** Grid cell size in canvas units. Typical values: 4, 8, 10, 16, 32. */
  gridSize: number
  snapToGrid: boolean
  guidesVisible: boolean
  guides: GuideDefinition[]

  // ----- Interaction state (mutually exclusive) -----
  dragState: DragState | null
  resizeState: ResizeState | null
  rotateState: RotateState | null
  textEditState: TextEditState | null

  // ----- Hover -----
  hoveredNodeId: string | null

  // ----- Smart guides -----
  smartGuides: SmartGuide[]

  // ----- Test mode -----
  testMode: boolean

  // ----- Panels -----
  panels: PanelState

  // ----- Phone preview -----
  phonePreviewActive: boolean

  // ----- Draw preview -----
  drawPreview: DrawPreview | null

  // ----- Pipe draw -----
  pipeDrawState: PipeDrawState | null

  // ----- Marquee -----
  marquee: MarqueeState | null

  // ----- Active group scope (double-click into group) -----
  /** Node ID of the group currently being edited in-scope. null = top-level. */
  activeGroupId: string | null

  // ----- Selection -----
  /** Set of currently selected node IDs. Ephemeral; never persisted. */
  selectedNodeIds: Set<NodeId>

  // ----- Actions -----
  setSelectedNodes(ids: NodeId[]): void
  clearSelection(): void
  setTool(tool: DrawingTool): void
  setViewport(vp: Partial<DesignerViewport>): void
  /**
   * Zoom to a specific level, optionally centered on a canvas-space point.
   * If cx/cy are omitted the zoom is centered on the current viewport center.
   */
  zoomTo(zoom: number, cx?: number, cy?: number): void
  /**
   * Compute panX/panY so the canvas fills the screen with a small margin.
   */
  fitToCanvas(canvasW: number, canvasH: number, screenW: number, screenH: number): void
  setGrid(visible: boolean, size?: number): void
  setSnap(enabled: boolean): void
  addGuide(axis: 'h' | 'v', position: number): void
  removeGuide(id: string): void
  toggleGuideLock(id: string): void
  clearGuides(): void
  setActiveGroup(id: string | null): void

  startDrag(
    startX: number,
    startY: number,
    originalPositions: Map<string, { x: number; y: number }>
  ): void
  updateDrag(x: number, y: number): void
  endDrag(): void

  startResize(
    handle: ResizeState['handle'],
    bbox: ResizeState['originalBBox'],
    transforms: Map<string, Transform>
  ): void
  endResize(): void

  startRotate(
    center: { x: number; y: number },
    startAngle: number,
    originalRotations: Map<string, number>
  ): void
  endRotate(): void

  startTextEdit(
    nodeId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string
  ): void
  endTextEdit(): void

  setHover(nodeId: string | null): void
  setSmartGuides(guides: SmartGuide[]): void
  setTestMode(active: boolean): void
  setPanel(updates: Partial<PanelState>): void
  setPhonePreview(active: boolean): void
  setDrawPreview(preview: DrawPreview | null): void
  setPipeDrawState(state: PipeDrawState | null): void
  addPipeWaypoint(x: number, y: number): void
  setMarquee(m: MarqueeState | null): void

  // ----- Coordinate helpers -----
  /**
   * Convert a screen-space point (e.g. MouseEvent.clientX/Y) to canvas space.
   */
  screenToCanvas(sx: number, sy: number, containerRect: DOMRect): { x: number; y: number }
  /**
   * Convert a canvas-space point to screen space (for overlay rendering).
   */
  canvasToScreen(cx: number, cy: number, containerRect: DOMRect): { x: number; y: number }
}

// ---------------------------------------------------------------------------
// Snap-to-grid utility (exported so consumers can use it without the store)
// ---------------------------------------------------------------------------

export function snapToGridValue(v: number, size: number, enabled: boolean): number {
  if (!enabled) return v
  return Math.round(v / size) * size
}

// ---------------------------------------------------------------------------
// Zoom limits
// ---------------------------------------------------------------------------

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8.0

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useUiStore = create<UiStore>((set, get) => ({
  // ----- Initial state -----

  activeTool: 'select',

  viewport: {
    panX: 0,
    panY: 0,
    zoom: 1,
  },

  gridVisible: true,
  gridSize: 10,
  snapToGrid: true,
  guidesVisible: true,
  guides: [],

  dragState: null,
  resizeState: null,
  rotateState: null,
  textEditState: null,

  hoveredNodeId: null,
  smartGuides: [],

  testMode: false,

  panels: {
    leftCollapsed: false,
    rightCollapsed: false,
    leftWidth: 240,
    rightWidth: 300,
  },

  phonePreviewActive: false,
  drawPreview: null,
  pipeDrawState: null,
  marquee: null,
  activeGroupId: null,
  selectedNodeIds: new Set<NodeId>(),

  // ----- Actions -----

  setSelectedNodes(ids) {
    set({ selectedNodeIds: new Set(ids) })
  },

  clearSelection() {
    set({ selectedNodeIds: new Set() })
  },

  setTool(tool) {
    // Switching tools cancels any ongoing interaction
    set({
      activeTool: tool,
      dragState: null,
      resizeState: null,
      rotateState: null,
      textEditState: null,
      drawPreview: null,
      pipeDrawState: null,
      marquee: null,
    })
  },

  setViewport(vp) {
    set((state) => ({
      viewport: {
        ...state.viewport,
        ...vp,
        zoom: vp.zoom !== undefined ? clampZoom(vp.zoom) : state.viewport.zoom,
      },
    }))
  },

  zoomTo(zoom, cx, cy) {
    set((state) => {
      const clampedZoom = clampZoom(zoom)
      const { panX, panY, zoom: oldZoom } = state.viewport

      if (cx === undefined || cy === undefined) {
        // Zoom toward the current viewport center — keep panX/panY unchanged
        // relative to the canvas origin; just update zoom.
        // This is a simple zoom-about-origin; callers that want canvas-center
        // zoom should pass cx/cy.
        return { viewport: { panX, panY, zoom: clampedZoom } }
      }

      // Zoom centered on canvas point (cx, cy):
      // screen position of cx,cy before zoom: sx = cx * oldZoom + panX
      // after zoom: new panX = sx - cx * newZoom
      const sx = cx * oldZoom + panX
      const sy = cy * oldZoom + panY
      const newPanX = sx - cx * clampedZoom
      const newPanY = sy - cy * clampedZoom

      return { viewport: { panX: newPanX, panY: newPanY, zoom: clampedZoom } }
    })
  },

  fitToCanvas(canvasW, canvasH, screenW, screenH) {
    const MARGIN = 32
    const scaleX = (screenW - MARGIN * 2) / canvasW
    const scaleY = (screenH - MARGIN * 2) / canvasH
    const zoom = clampZoom(Math.min(scaleX, scaleY))
    const panX = (screenW - canvasW * zoom) / 2
    const panY = (screenH - canvasH * zoom) / 2
    set({ viewport: { panX, panY, zoom } })
  },

  setGrid(visible, size) {
    set((state) => ({
      gridVisible: visible,
      gridSize: size !== undefined ? size : state.gridSize,
    }))
  },

  setSnap(enabled) {
    set({ snapToGrid: enabled })
  },

  addGuide(axis, position) {
    set((state) => ({
      guides: [...state.guides, { id: crypto.randomUUID(), axis, position }],
    }))
  },

  removeGuide(id) {
    set((state) => ({
      guides: state.guides.filter((g) => g.id !== id),
    }))
  },

  toggleGuideLock(id) {
    set((state) => ({
      guides: state.guides.map((g) => g.id === id ? { ...g, locked: !g.locked } : g),
    }))
  },

  clearGuides() {
    set({ guides: [] })
  },

  setActiveGroup(id) {
    set({ activeGroupId: id })
  },

  // ----- Drag -----

  startDrag(startX, startY, originalPositions) {
    set({
      dragState: {
        startCanvasX: startX,
        startCanvasY: startY,
        originalPositions,
      },
      // Cancel any conflicting state
      resizeState: null,
      rotateState: null,
      textEditState: null,
    })
  },

  updateDrag(_x, _y) {
    // The drag delta is computed externally (mouse position - start position).
    // This action exists for symmetry and for stores that want to track the
    // current drag endpoint; callers may use setViewport or direct scene
    // manipulations during drag. Nothing to update in this store for now.
    // If real-time smart guide feedback is needed, callers invoke setSmartGuides.
  },

  endDrag() {
    set({ dragState: null, smartGuides: [] })
  },

  // ----- Resize -----

  startResize(handle, bbox, transforms) {
    set({
      resizeState: {
        handle,
        originalBBox: bbox,
        originalTransforms: transforms,
      },
      dragState: null,
      rotateState: null,
      textEditState: null,
    })
  },

  endResize() {
    set({ resizeState: null, smartGuides: [] })
  },

  // ----- Rotate -----

  startRotate(center, startAngle, originalRotations) {
    set({
      rotateState: {
        center,
        originalRotations,
        startAngle,
      },
      dragState: null,
      resizeState: null,
      textEditState: null,
    })
  },

  endRotate() {
    set({ rotateState: null })
  },

  // ----- Text edit -----

  startTextEdit(nodeId, x, y, w, h, text) {
    set({
      textEditState: {
        nodeId,
        x,
        y,
        width: w,
        height: h,
        currentText: text,
      },
      dragState: null,
      resizeState: null,
      rotateState: null,
    })
  },

  endTextEdit() {
    set({ textEditState: null })
  },

  // ----- Hover -----

  setHover(nodeId) {
    set({ hoveredNodeId: nodeId })
  },

  // ----- Smart guides -----

  setSmartGuides(guides) {
    set({ smartGuides: guides })
  },

  // ----- Test mode -----

  setTestMode(active) {
    set({
      testMode: active,
      // Leaving interactions active in test mode is meaningless — clear them
      dragState: null,
      resizeState: null,
      rotateState: null,
      textEditState: null,
      drawPreview: null,
      marquee: null,
    })
  },

  // ----- Panels -----

  setPanel(updates) {
    set((state) => ({ panels: { ...state.panels, ...updates } }))
  },

  // ----- Phone preview -----

  setPhonePreview(active) {
    set({ phonePreviewActive: active })
  },

  // ----- Draw preview -----

  setDrawPreview(preview) {
    set({ drawPreview: preview })
  },

  // ----- Pipe draw -----

  setPipeDrawState(state) {
    set({ pipeDrawState: state })
  },

  addPipeWaypoint(x, y) {
    set((state) => {
      if (!state.pipeDrawState) return state
      return {
        pipeDrawState: {
          ...state.pipeDrawState,
          waypoints: [...state.pipeDrawState.waypoints, { x, y }],
        },
      }
    })
  },

  // ----- Marquee -----

  setMarquee(m) {
    set({ marquee: m })
  },

  // ----- Coordinate helpers -----

  screenToCanvas(sx, sy, containerRect) {
    const { panX, panY, zoom } = get().viewport
    return {
      x: (sx - containerRect.left - panX) / zoom,
      y: (sy - containerRect.top  - panY) / zoom,
    }
  },

  canvasToScreen(cx, cy, containerRect) {
    const { panX, panY, zoom } = get().viewport
    return {
      x: cx * zoom + panX + containerRect.left,
      y: cy * zoom + panY + containerRect.top,
    }
  },
}))
