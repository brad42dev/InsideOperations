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

import { create } from "zustand";
import type {
  GraphicDocument,
  LayerDefinition,
} from "../../shared/types/graphics";
import type { SceneCommand } from "../../shared/graphics/commands";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneStore {
  doc: GraphicDocument | null;
  graphicId: string | null;
  isDirty: boolean;
  designMode: "graphic" | "dashboard" | "report";
  /**
   * Monotonically increasing counter, incremented on every doc mutation.
   * Used by the SVG reconciler to detect when a re-render is needed.
   */
  version: number;

  /** Load a graphic from the API. Clears dirty state (caller must also clear history). */
  loadGraphic(id: string, doc: GraphicDocument): void;

  /**
   * Execute a command against the current document.
   * Applies the command, marks dirty, and returns the new doc.
   * Does NOT push to history — use the canvas executeAndRecord() helper for that.
   */
  execute(cmd: SceneCommand): GraphicDocument | null;

  /**
   * Replace doc directly. Used only by historyStore for undo/redo.
   * Pass isDirty=false when restoring to the saved clean point.
   */
  _setDoc(doc: GraphicDocument, isDirty?: boolean): void;

  /** Mark the document as clean (call after a successful save). */
  markClean(): void;

  /**
   * Create a new empty document.
   * Canvas defaults:
   *  - graphic:   1920 × 1080
   *  - dashboard: 1920 × 1080
   *  - report:    794 × 1123 (A4 portrait), autoHeight=true
   *
   * Optional width/height/autoHeight override the mode defaults (set from the dialog).
   */
  newDocument(
    mode: "graphic" | "dashboard" | "report",
    name: string,
    width?: number,
    height?: number,
    autoHeight?: boolean,
  ): void;

  /** Switch design mode without creating/loading a document. */
  setDesignMode(mode: "graphic" | "dashboard" | "report"): void;

  /** Reset to initial state (close document). */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Canvas size defaults per design mode
// ---------------------------------------------------------------------------

const CANVAS_SIZES: Record<
  "graphic" | "dashboard" | "report",
  { width: number; height: number; autoHeight?: boolean }
> = {
  graphic: { width: 1920, height: 1080 },
  dashboard: { width: 1920, height: 1080 },
  report: { width: 1240, height: 1754, autoHeight: true },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultLayers(): LayerDefinition[] {
  const names = ["Background", "Equipment", "Instruments", "Labels"];
  return names.map((name, order) => ({
    id: crypto.randomUUID(),
    name,
    visible: true,
    locked: name === "Background", // Background layer is locked by default (spec §15)
    order,
  }));
}

function makeEmptyDocument(
  mode: "graphic" | "dashboard" | "report",
  name: string,
  widthOverride?: number,
  heightOverride?: number,
  autoHeightOverride?: boolean,
): GraphicDocument {
  const defaults = CANVAS_SIZES[mode];
  const width = widthOverride ?? defaults.width;
  const height = heightOverride ?? defaults.height;
  const autoHeight = autoHeightOverride ?? defaults.autoHeight ?? false;
  return {
    id: crypto.randomUUID(),
    type: "graphic_document",
    name,
    transform: {
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      mirror: "none",
    },
    visible: true,
    locked: false,
    opacity: 1,
    canvas: { width, height, backgroundColor: "var(--io-surface)", autoHeight },
    metadata: {
      tags: [],
      designMode: mode,
      graphicScope: "console",
      gridSize: 10,
      gridVisible: true,
      snapToGrid: true,
    },
    layers: makeDefaultLayers(),
    expressions: {},
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSceneStore = create<SceneStore>((set, get) => ({
  doc: null,
  graphicId: null,
  isDirty: false,
  designMode: "graphic",
  version: 0,

  loadGraphic(id, doc) {
    // Migrate legacy hardcoded background colors to the theme token so
    // graphics respond to theme switching instead of being locked to dark.
    const LEGACY_BG = new Set([
      "#09090b",
      "#09090B",
      "#1E1E2E",
      "#1e1e2e",
      "#0d0d0d",
      "#27272A",
      "#27272a",
      "var(--io-surface-primary)",
    ]);
    const migratedDoc = LEGACY_BG.has(doc.canvas.backgroundColor)
      ? {
          ...doc,
          canvas: { ...doc.canvas, backgroundColor: "var(--io-surface)" },
        }
      : doc;
    set({
      doc: migratedDoc,
      graphicId: id,
      isDirty: false,
      designMode: doc.metadata.designMode,
      version: 0,
    });
  },

  execute(cmd) {
    const { doc } = get();
    if (!doc) return null;
    const newDoc = cmd.execute(doc);
    set((s) => ({ doc: newDoc, isDirty: true, version: s.version + 1 }));
    return newDoc;
  },

  _setDoc(doc, isDirty = true) {
    set((s) => ({ doc, isDirty, version: s.version + 1 }));
  },

  markClean() {
    set({ isDirty: false });
  },

  newDocument(mode, name, width, height, autoHeight) {
    set({
      doc: makeEmptyDocument(mode, name, width, height, autoHeight),
      graphicId: null,
      isDirty: true,
      designMode: mode,
      version: 0,
    });
  },

  setDesignMode(mode) {
    set({ designMode: mode });
  },

  reset() {
    set({
      doc: null,
      graphicId: null,
      isDirty: false,
      designMode: "graphic",
      version: 0,
    });
  },
}));
