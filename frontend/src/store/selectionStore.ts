/**
 * SelectionStore — Console module ephemeral pane selection state.
 *
 * Spec: console-implementation-spec.md §1.4
 * - No temporal middleware (ephemeral — not undone/redone).
 * - Never persisted.
 * - Holds selectedPaneIds and selectionRect.
 */

import { create } from "zustand";
import { useGlobalSelectionStore } from "./globalSelectionStore";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionState {
  /** Set of currently selected pane IDs. */
  selectedPaneIds: Set<string>;
  /** Rubber-band selection rectangle (null when no drag-select in progress). */
  selectionRect: SelectionRect | null;
  /** ID of pane being swapped (source of the swap). */
  swapModeSourceId: string | null;

  // Actions
  selectPane: (paneId: string, addToSelection?: boolean) => void;
  selectAll: (paneIds: string[]) => void;
  clearSelection: () => void;
  setSelectionRect: (rect: SelectionRect | null) => void;
  setSwapModeSourceId: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedPaneIds: new Set<string>(),
  selectionRect: null,
  swapModeSourceId: null,

  selectPane: (paneId, addToSelection = false) =>
    set((s) => {
      const gs = useGlobalSelectionStore.getState();
      gs.setActiveZone("console");
      const entity = { id: paneId, zoneId: "console" as const, kind: "pane" as const };

      if (addToSelection) {
        const next = new Set(s.selectedPaneIds);
        if (next.has(paneId)) {
          next.delete(paneId);
          gs.select("console", entity, "remove");
        } else {
          next.add(paneId);
          gs.select("console", entity, "add");
        }
        return { selectedPaneIds: next };
      }
      // Single-select: toggle off if already the only selected
      if (s.selectedPaneIds.size === 1 && s.selectedPaneIds.has(paneId)) {
        gs.clearZone("console");
        return { selectedPaneIds: new Set<string>() };
      }
      gs.select("console", entity, "replace");
      return { selectedPaneIds: new Set([paneId]) };
    }),

  selectAll: (paneIds) => {
    const gs = useGlobalSelectionStore.getState();
    gs.setActiveZone("console");
    gs.selectMany(
      "console",
      paneIds.map((id) => ({ id, zoneId: "console" as const, kind: "pane" as const })),
      "replace",
    );
    set({ selectedPaneIds: new Set(paneIds) });
  },

  clearSelection: () => {
    useGlobalSelectionStore.getState().clearZone("console");
    set({ selectedPaneIds: new Set<string>() });
  },

  setSelectionRect: (selectionRect) => set({ selectionRect }),

  setSwapModeSourceId: (swapModeSourceId) => set({ swapModeSourceId }),
}));
