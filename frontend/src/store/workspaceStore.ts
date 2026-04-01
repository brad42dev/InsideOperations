/**
 * WorkspaceStore — Console module workspace state with undo/redo via zundo.
 *
 * Spec: console-implementation-spec.md §1.4
 * - Only store with undo/redo (zundo temporal middleware, limit 50).
 * - Holds workspace layouts, active workspace ID, edit mode.
 * - Does NOT hold selection state (→ SelectionStore) or point values (→ RealtimeStore).
 */

import { create } from "zustand";
import { temporal } from "zundo";
import type {
  WorkspaceLayout,
  LayoutPreset,
  PaneConfig,
  GridItem,
} from "../pages/console/types";
import { uuidv4 } from "../lib/uuid";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlankPanes(count: number): PaneConfig[] {
  return Array.from({ length: count }, () => ({
    id: uuidv4(),
    type: "blank" as const,
  }));
}

function layoutPaneCount(layout: LayoutPreset): number {
  switch (layout) {
    case "1x1":
      return 1;
    case "2x1":
      return 2;
    case "1x2":
      return 2;
    case "2x2":
      return 4;
    case "3x1":
      return 3;
    case "1x3":
      return 3;
    case "3x2":
      return 6;
    case "2x3":
      return 6;
    case "3x3":
      return 9;
    case "4x1":
      return 4;
    case "1x4":
      return 4;
    case "4x2":
      return 8;
    case "2x4":
      return 8;
    case "4x3":
      return 12;
    case "3x4":
      return 12;
    case "4x4":
      return 16;
    case "big-left-3-right":
      return 4;
    case "big-right-3-left":
      return 4;
    case "big-top-3-bottom":
      return 4;
    case "big-bottom-3-top":
      return 4;
    case "2-big-4-small":
      return 6;
    case "pip":
      return 2;
    case "featured-sidebar":
      return 2;
    case "side-by-side-unequal":
      return 2;
    case "2x1+1":
      return 3;
    default:
      return 1;
  }
}

export function makeNewWorkspace(
  name: string,
  layout: LayoutPreset = "2x2",
  description?: string,
): WorkspaceLayout {
  return {
    id: uuidv4(),
    name,
    layout,
    panes: makeBlankPanes(layoutPaneCount(layout)),
    ...(description ? { description } : {}),
  };
}

// Re-export helpers for ConsolePage use
export { layoutPaneCount, makeBlankPanes };

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface WorkspaceState {
  workspaces: WorkspaceLayout[];
  activeId: string | null;
  editMode: boolean;
  preserveAspectRatio: boolean;
  /** Session-only workspace-level toggle: when true all pane title bars are hidden
   *  regardless of per-pane showTitle setting. Not persisted to the server. */
  hideTitles: boolean;

  // Workspace CRUD
  setWorkspaces: (workspaces: WorkspaceLayout[]) => void;
  setActiveId: (id: string | null) => void;
  setEditMode: (editMode: boolean) => void;
  setPreserveAspectRatio: (value: boolean) => void;
  setHideTitles: (value: boolean) => void;

  createWorkspace: (name?: string, layout?: LayoutPreset) => WorkspaceLayout;
  deleteWorkspace: (id: string) => void;
  duplicateWorkspace: (id: string) => WorkspaceLayout | null;

  updateWorkspace: (
    id: string,
    updater: (w: WorkspaceLayout) => WorkspaceLayout,
  ) => void;
  setWorkspace: (ws: WorkspaceLayout) => void;
  renameWorkspace: (id: string, name: string) => void;
  changeLayout: (id: string, layout: LayoutPreset) => void;
  updateGridItems: (id: string, gridItems: GridItem[]) => void;
  updatePane: (workspaceId: string, pane: PaneConfig) => void;
  removePane: (workspaceId: string, paneId: string) => void;
  swapPanes: (
    workspaceId: string,
    sourceId: string,
    targetId: string,
    gridItems: GridItem[],
  ) => void;
  clearPanes: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Store — temporal middleware wraps the state creator
// ---------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceState>()(
  temporal(
    (set, get) => ({
      workspaces: [],
      activeId: null,
      editMode: false,
      preserveAspectRatio: true,
      hideTitles: false,

      setWorkspaces: (workspaces) => set({ workspaces }),
      setActiveId: (activeId) => set({ activeId }),
      setEditMode: (editMode) => set({ editMode }),
      setPreserveAspectRatio: (preserveAspectRatio) =>
        set({ preserveAspectRatio }),
      setHideTitles: (hideTitles) => set({ hideTitles }),

      createWorkspace: (name, layout = "2x2") => {
        const count = get().workspaces.length;
        const ws = makeNewWorkspace(name ?? `Workspace ${count + 1}`, layout);
        set((s) => ({
          workspaces: [...s.workspaces, ws],
          activeId: ws.id,
          editMode: true,
        }));
        return ws;
      },

      deleteWorkspace: (id) =>
        set((s) => {
          const updated = s.workspaces.filter((w) => w.id !== id);
          const nextActive =
            s.activeId === id ? (updated[0]?.id ?? null) : s.activeId;
          return { workspaces: updated, activeId: nextActive };
        }),

      duplicateWorkspace: (id) => {
        const source = get().workspaces.find((w) => w.id === id);
        if (!source) return null;
        const copy: WorkspaceLayout = {
          ...source,
          id: uuidv4(),
          name: `${source.name} (copy)`,
          panes: source.panes.map((p) => ({ ...p, id: uuidv4() })),
        };
        set((s) => ({
          workspaces: [...s.workspaces, copy],
          activeId: copy.id,
        }));
        return copy;
      },

      updateWorkspace: (id, updater) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? updater(w) : w)),
        })),

      setWorkspace: (ws) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === ws.id ? ws : w)),
        })),

      renameWorkspace: (id, name) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, name } : w,
          ),
        })),

      changeLayout: (id, layout) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== id) return w;
            const needed = layoutPaneCount(layout);
            const currentPanes = w.panes;
            const currentOverflow = w.overflowPanes ?? [];

            // Active panes that still fit in the new template
            const activePanes = currentPanes.slice(0, needed);
            // Panes that no longer fit — move to overflow (not discarded)
            const newlyOverflowing = currentPanes.slice(needed);

            // Pull from overflow to fill any remaining slots
            const slotsRemaining = needed - activePanes.length;
            const fromOverflow = currentOverflow.slice(0, slotsRemaining);
            const leftoverOverflow = currentOverflow.slice(slotsRemaining);

            // Blank panes for any slots still unfilled
            const blankCount = Math.max(
              0,
              slotsRemaining - fromOverflow.length,
            );
            const blanks = makeBlankPanes(blankCount);

            return {
              ...w,
              layout,
              panes: [...activePanes, ...fromOverflow, ...blanks],
              gridItems: undefined,
              overflowPanes: [...newlyOverflowing, ...leftoverOverflow],
            };
          }),
        })),

      updateGridItems: (id, gridItems) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, gridItems } : w,
          ),
        })),

      updatePane: (workspaceId, pane) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  panes: w.panes.map((p) => (p.id === pane.id ? pane : p)),
                }
              : w,
          ),
        })),

      removePane: (workspaceId, paneId) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  panes: w.panes.map((p) =>
                    p.id === paneId
                      ? { id: uuidv4(), type: "blank" as const }
                      : p,
                  ),
                }
              : w,
          ),
        })),

      swapPanes: (workspaceId, sourceId, targetId, gridItems) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => {
            if (w.id !== workspaceId) return w;
            const srcItem = gridItems.find((gi) => gi.i === sourceId);
            const tgtItem = gridItems.find((gi) => gi.i === targetId);
            if (!srcItem || !tgtItem) return w;
            return {
              ...w,
              gridItems: gridItems.map((gi) => {
                if (gi.i === sourceId)
                  return {
                    ...gi,
                    x: tgtItem.x,
                    y: tgtItem.y,
                    w: tgtItem.w,
                    h: tgtItem.h,
                  };
                if (gi.i === targetId)
                  return {
                    ...gi,
                    x: srcItem.x,
                    y: srcItem.y,
                    w: srcItem.w,
                    h: srcItem.h,
                  };
                return gi;
              }),
            };
          }),
        })),

      clearPanes: (id) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id
              ? {
                  ...w,
                  panes: w.panes.map(() => ({
                    id: uuidv4(),
                    type: "blank" as const,
                  })),
                }
              : w,
          ),
        })),
    }),
    { limit: 50 },
  ),
);

/**
 * Access the temporal store for undo/redo.
 * Usage: const temporal = useWorkspaceStore.temporal.getState()
 *        temporal.undo()
 *        temporal.redo()
 */
export const useWorkspaceTemporal = () => useWorkspaceStore.temporal;
