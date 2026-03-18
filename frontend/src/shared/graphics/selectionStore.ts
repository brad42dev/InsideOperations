import { create } from 'zustand'
import type { NodeId } from '../types/graphics'

export type SelectionScope = 'root' | 'group' | 'symbol'

interface SelectionState {
  selectedNodeIds: Set<NodeId>
  selectionScope: SelectionScope
  /** ID of the group or symbol currently entered (double-clicked into) */
  scopeContainerId: NodeId | null
  /** Marquee drag state */
  marquee: { startX: number; startY: number; endX: number; endY: number } | null

  // Actions
  select: (ids: NodeId[], scope?: SelectionScope) => void
  toggle: (id: NodeId) => void
  addToSelection: (ids: NodeId[]) => void
  clear: () => void
  enterScope: (containerId: NodeId, scopeType: SelectionScope) => void
  exitScope: () => void
  setMarquee: (marquee: { startX: number; startY: number; endX: number; endY: number } | null) => void
  isSelected: (id: NodeId) => boolean
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedNodeIds: new Set(),
  selectionScope: 'root',
  scopeContainerId: null,
  marquee: null,

  select(ids, scope) {
    set({ selectedNodeIds: new Set(ids), selectionScope: scope ?? get().selectionScope })
  },

  toggle(id) {
    set((state) => {
      const next = new Set(state.selectedNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedNodeIds: next }
    })
  },

  addToSelection(ids) {
    set((state) => {
      const next = new Set(state.selectedNodeIds)
      for (const id of ids) next.add(id)
      return { selectedNodeIds: next }
    })
  },

  clear() {
    set({ selectedNodeIds: new Set() })
  },

  enterScope(containerId, scopeType) {
    set({ scopeContainerId: containerId, selectionScope: scopeType, selectedNodeIds: new Set() })
  },

  exitScope() {
    set({ scopeContainerId: null, selectionScope: 'root', selectedNodeIds: new Set() })
  },

  setMarquee(marquee) {
    set({ marquee })
  },

  isSelected(id) {
    return get().selectedNodeIds.has(id)
  },
}))
