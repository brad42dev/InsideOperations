/**
 * tabStore.ts
 *
 * Tab state management for the Designer module.
 *
 * Each open graphic occupies one DesignerTab. Switching tabs saves the current
 * scene graph into the outgoing tab's savedScene slot and restores the incoming
 * tab's savedScene (or fetches from server on first open).
 *
 * Max 10 simultaneous tabs. Opening an 11th replaces the LRU tab (oldest
 * lastFocusedAt) after auto-saving if modified. A toast is shown.
 *
 * Scene graph save/restore is handled by the DesignerPage (tabStore stores
 * the raw saved scene data but does not import sceneStore to avoid circular deps).
 */

import { create } from 'zustand'
import type { GraphicDocument } from '../../shared/types/graphics'
import type { DesignerViewport } from './uiStore'

// ---------------------------------------------------------------------------
// Max tabs constant
// ---------------------------------------------------------------------------

export const MAX_TABS = 10

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Saved state for an individual tab (stored while that tab is not active). */
export interface SavedTabState {
  scene: GraphicDocument
}

export interface DesignerTab {
  /** Stable tab UUID (not the graphic ID). */
  id: string
  /** The graphic's database ID. */
  graphicId: string
  /** Cached display name (from server, updated on load). */
  graphicName: string
  /** True if this tab has unsaved changes. */
  isModified: boolean
  /** Per-tab viewport (pan/zoom), saved and restored on tab switch. */
  viewport: DesignerViewport
  /** Discriminator — 'group' tabs are added in MOD-DESIGNER-024. */
  type: 'graphic'
  /** Unix timestamp (ms) of the last time this tab was focused. */
  lastFocusedAt: number
  /**
   * Saved scene graph for this tab (populated when switching away from the tab).
   * Null means the tab is currently active (scene is in sceneStore) or not yet loaded.
   */
  savedScene: SavedTabState | null
}

export interface TabStore {
  tabs: DesignerTab[]
  activeTabId: string | null

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Open a graphic in a new tab, or focus the existing tab if already open.
   * Returns { tabId, isNew } so callers know whether to load the graphic.
   */
  openTab(graphicId: string, graphicName: string): { tabId: string; isNew: boolean }

  /** Switch to an existing tab by tab ID. Does NOT load the scene — caller handles that. */
  setActiveTab(tabId: string): void

  /** Close a tab by tab ID. Returns the new activeTabId (may be null). */
  closeTab(tabId: string): string | null

  /** Mark a tab as modified or clean. */
  setTabModified(tabId: string, modified: boolean): void

  /** Save the current viewport into a tab's viewport slot. */
  saveTabViewport(tabId: string, viewport: DesignerViewport): void

  /** Save the scene graph snapshot into a tab's savedScene slot. */
  saveTabScene(tabId: string, scene: GraphicDocument): void

  /** Update a tab's graphic name (e.g. after a rename). */
  setTabName(tabId: string, name: string): void

  /**
   * Close all tabs except the one specified.
   * Returns array of closed tab IDs so caller can handle save prompts.
   */
  closeOtherTabs(keepTabId: string): DesignerTab[]

  /** Close all tabs. Returns array of closed tabs. */
  closeAllTabs(): DesignerTab[]

  /**
   * Evict the LRU tab (oldest lastFocusedAt, excluding active tab) to make
   * room for a new one. Returns the evicted tab or null if not needed.
   */
  evictLruTab(): DesignerTab | null

  /** Find a tab by graphicId. Returns null if not found. */
  findTabByGraphicId(graphicId: string): DesignerTab | null

  /** Get a tab by its tab ID. */
  getTab(tabId: string): DesignerTab | null

  /** Reset all tabs (e.g. on logout or page unload). */
  reset(): void
}

// ---------------------------------------------------------------------------
// Default viewport
// ---------------------------------------------------------------------------

const DEFAULT_VIEWPORT: DesignerViewport = { panX: 0, panY: 0, zoom: 1 }

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab(graphicId, graphicName) {
    const { tabs, evictLruTab } = get()

    // Idempotency: if graphic already open, focus it
    const existing = tabs.find(t => t.graphicId === graphicId)
    if (existing) {
      set((state) => ({
        activeTabId: existing.id,
        tabs: state.tabs.map(t =>
          t.id === existing.id ? { ...t, lastFocusedAt: Date.now() } : t
        ),
      }))
      return { tabId: existing.id, isNew: false }
    }

    // Evict LRU if at capacity
    if (tabs.length >= MAX_TABS) {
      evictLruTab()
    }

    // Create new tab
    const tabId = crypto.randomUUID()
    const newTab: DesignerTab = {
      id: tabId,
      graphicId,
      graphicName,
      isModified: false,
      viewport: { ...DEFAULT_VIEWPORT },
      type: 'graphic',
      lastFocusedAt: Date.now(),
      savedScene: null,
    }

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
    }))

    return { tabId, isNew: true }
  },

  setActiveTab(tabId) {
    set((state) => ({
      activeTabId: tabId,
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, lastFocusedAt: Date.now() } : t
      ),
    }))
  },

  closeTab(tabId) {
    const state = get()
    const idx = state.tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return state.activeTabId

    const newTabs = state.tabs.filter(t => t.id !== tabId)

    let newActiveId: string | null = null
    if (state.activeTabId !== tabId) {
      // Not closing the active tab — keep current
      newActiveId = state.activeTabId
    } else if (newTabs.length > 0) {
      // Closing the active tab — pick the most recently focused remaining tab
      const sorted = [...newTabs].sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)
      newActiveId = sorted[0].id
    }
    // else newActiveId remains null (no tabs left)

    set({ tabs: newTabs, activeTabId: newActiveId })
    return newActiveId
  },

  setTabModified(tabId, modified) {
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, isModified: modified } : t
      ),
    }))
  },

  saveTabViewport(tabId, viewport) {
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, viewport } : t
      ),
    }))
  },

  saveTabScene(tabId, scene) {
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, savedScene: { scene } } : t
      ),
    }))
  },

  setTabName(tabId, name) {
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, graphicName: name } : t
      ),
    }))
  },

  closeOtherTabs(keepTabId) {
    const { tabs } = get()
    const toClose = tabs.filter(t => t.id !== keepTabId)
    set({
      tabs: tabs.filter(t => t.id === keepTabId),
      activeTabId: keepTabId,
    })
    return toClose
  },

  closeAllTabs() {
    const { tabs } = get()
    set({ tabs: [], activeTabId: null })
    return tabs
  },

  evictLruTab() {
    const { tabs, activeTabId } = get()
    // Evict the tab with the oldest lastFocusedAt, excluding the active tab
    const candidates = tabs.filter(t => t.id !== activeTabId)
    if (candidates.length === 0) return null

    candidates.sort((a, b) => a.lastFocusedAt - b.lastFocusedAt)
    const lru = candidates[0]

    set((state) => ({
      tabs: state.tabs.filter(t => t.id !== lru.id),
    }))

    return lru
  },

  findTabByGraphicId(graphicId) {
    return get().tabs.find(t => t.graphicId === graphicId) ?? null
  },

  getTab(tabId) {
    return get().tabs.find(t => t.id === tabId) ?? null
  },

  reset() {
    set({ tabs: [], activeTabId: null })
  },
}))
