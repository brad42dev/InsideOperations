/**
 * sceneStore.ts
 *
 * Scene graph store — THE single source of truth for the Designer module.
 * Holds the GraphicDocument and exposes methods to execute commands.
 *
 * History management is intentionally NOT done here to avoid circular
 * dependencies. The canvas/main component is responsible for calling
 * historyStore.push() after execute(). Use the executeWithHistory()
 * helper exported from this module for that purpose.
 */

import { create } from 'zustand'
import type { GraphicDocument, LayerDefinition } from '../../shared/types/graphics'
import type { SceneCommand } from '../../shared/graphics/commands'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneStore {
  doc: GraphicDocument | null
  graphicId: string | null
  isDirty: boolean
  designMode: 'graphic' | 'dashboard' | 'report'
  /**
   * Monotonically increasing counter, incremented on every doc mutation.
   * Used by the SVG reconciler to detect when a re-render is needed.
   */
  version: number

  /** Load a graphic from the API. Clears dirty state (caller must also clear history). */
  loadGraphic(id: string, doc: GraphicDocument): void

  /**
   * Execute a command against the current document.
   * Applies the command, marks dirty, and returns the new doc.
   * Does NOT push to history — use the canvas executeAndRecord() helper for that.
   */
  execute(cmd: SceneCommand): GraphicDocument | null

  /**
   * Replace doc directly. Used only by historyStore for undo/redo.
   * Pass isDirty=false when restoring to the saved clean point.
   */
  _setDoc(doc: GraphicDocument, isDirty?: boolean): void

  /** Mark the document as clean (call after a successful save). */
  markClean(): void

  /**
   * Create a new empty document.
   * Canvas defaults:
   *  - graphic:   1920 × 1080
   *  - dashboard: 1920 × 1080
   *  - report:    1240 × 1754 (A4 portrait)
   */
  newDocument(mode: 'graphic' | 'dashboard' | 'report', name: string): void

  /** Switch design mode without creating/loading a document. */
  setDesignMode(mode: 'graphic' | 'dashboard' | 'report'): void

  /** Reset to initial state (close document). */
  reset(): void
}

// ---------------------------------------------------------------------------
// Canvas size defaults per design mode
// ---------------------------------------------------------------------------

const CANVAS_SIZES: Record<'graphic' | 'dashboard' | 'report', { width: number; height: number }> = {
  graphic:   { width: 1920, height: 1080 },
  dashboard: { width: 1920, height: 1080 },
  report:    { width: 1240, height: 1754 },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultLayers(): LayerDefinition[] {
  const names = ['Background', 'Equipment', 'Pipes', 'Annotations', 'Values']
  return names.map((name, order) => ({
    id: crypto.randomUUID(),
    name,
    visible: true,
    locked: false,
    order,
  }))
}

function makeEmptyDocument(
  mode: 'graphic' | 'dashboard' | 'report',
  name: string
): GraphicDocument {
  const { width, height } = CANVAS_SIZES[mode]
  return {
    id: crypto.randomUUID(),
    type: 'graphic_document',
    name,
    transform: {
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: 'none',
    },
    visible: true,
    locked: false,
    opacity: 1,
    canvas: { width, height, backgroundColor: '#09090b' },
    metadata: {
      tags: [],
      designMode: mode,
      graphicScope: 'console',
      gridSize: 8,
      gridVisible: true,
      snapToGrid: true,
    },
    layers: makeDefaultLayers(),
    expressions: {},
    children: [],
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSceneStore = create<SceneStore>((set, get) => ({
  doc: null,
  graphicId: null,
  isDirty: false,
  designMode: 'graphic',
  version: 0,

  loadGraphic(id, doc) {
    set({
      doc,
      graphicId: id,
      isDirty: false,
      designMode: doc.metadata.designMode,
      version: 0,
    })
  },

  execute(cmd) {
    const { doc } = get()
    if (!doc) return null
    const newDoc = cmd.execute(doc)
    set((s) => ({ doc: newDoc, isDirty: true, version: s.version + 1 }))
    return newDoc
  },

  _setDoc(doc, isDirty = true) {
    set((s) => ({ doc, isDirty, version: s.version + 1 }))
  },

  markClean() {
    set({ isDirty: false })
  },

  newDocument(mode, name) {
    set({
      doc: makeEmptyDocument(mode, name),
      graphicId: null,
      isDirty: true,
      designMode: mode,
      version: 0,
    })
  },

  setDesignMode(mode) {
    set({ designMode: mode })
  },

  reset() {
    set({ doc: null, graphicId: null, isDirty: false, designMode: 'graphic', version: 0 })
  },
}))
