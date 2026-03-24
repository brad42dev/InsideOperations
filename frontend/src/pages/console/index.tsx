import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermission } from '../../shared/hooks/usePermission'

import WorkspaceGrid, { presetToGridItems } from './WorkspaceGrid'
import type { GridItem } from './types'
import ConsolePalette, { type ConsoleDragItem } from './ConsolePalette'
import HistoricalPlaybackBar from '../../shared/components/HistoricalPlaybackBar'
import PaneConfigModal from './PaneConfigModal'
import ContextMenu from '../../shared/components/ContextMenu'
import type { WorkspaceLayout, PaneConfig, LayoutPreset } from './types'
import { uuidv4 } from '../../lib/uuid'
import { consoleApi } from '../../api/console'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import { usePlaybackStore } from '../../store/playback'
import { useWorkspaceStore, useWorkspaceTemporal, makeNewWorkspace } from '../../store/workspaceStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useRealtimeStore } from '../../store/realtimeStore'
import { ExportDialog } from '../../shared/components/ExportDialog'
import { exportsApi, type ExportFormat } from '../../api/exports'
import { showToast } from '../../shared/components/Toast'
import { useConsoleWorkspaceFavorites } from '../../shared/hooks/useConsoleWorkspaceFavorites'

// ---------------------------------------------------------------------------
// ConsoleStatusBar
// ---------------------------------------------------------------------------

function ConsoleStatusBar({
  workspaceName,
}: {
  workspaceName: string
}) {
  const { mode } = usePlaybackStore()
  const isHistorical = mode === 'historical'
  const { connectionStatus, subscribedPointCount } = useRealtimeStore()

  return (
    <div
      style={{
        height: 24,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 10px',
        background: 'var(--io-surface-secondary)',
        borderTop: '1px solid var(--io-border)',
        fontSize: 11,
        color: 'var(--io-text-muted)',
        userSelect: 'none',
      }}
    >
      {/* Connection dot */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background:
              connectionStatus === 'connected'
                ? 'var(--io-success)'
                : connectionStatus === 'connecting'
                ? 'var(--io-warning)'
                : 'var(--io-danger)',
            display: 'inline-block',
          }}
        />
        {connectionStatus === 'connected'
          ? 'Connected'
          : connectionStatus === 'connecting'
          ? 'Connecting…'
          : connectionStatus === 'error'
          ? 'Error'
          : 'Disconnected'}
      </span>
      <span style={{ color: 'var(--io-border)' }}>|</span>
      {/* Points */}
      <span>{subscribedPointCount} points subscribed</span>
      <span style={{ color: 'var(--io-border)' }}>|</span>
      {/* Workspace name */}
      {workspaceName && (
        <>
          <span
            style={{
              color: 'var(--io-text-primary)',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspaceName}
          </span>
          <span style={{ color: 'var(--io-border)' }}>|</span>
        </>
      )}
      {/* Mode */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isHistorical ? 'var(--io-warning)' : 'var(--io-success)',
            display: 'inline-block',
          }}
        />
        {isHistorical ? 'Historical' : 'Live'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LocalStorage fallback (used when not authenticated or API unavailable)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'io-console-workspaces'

function loadWorkspacesLocal(): WorkspaceLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WorkspaceLayout[]
  } catch {
    return []
  }
}

function saveWorkspacesLocal(workspaces: WorkspaceLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces))
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Layout preset metadata
// ---------------------------------------------------------------------------

const LAYOUT_PRESETS: { value: LayoutPreset; label: string }[] = [
  // Even grids
  { value: '1x1',  label: '1×1' },
  { value: '2x1',  label: '2×1' },
  { value: '1x2',  label: '1×2' },
  { value: '2x2',  label: '2×2' },
  { value: '3x1',  label: '3×1' },
  { value: '1x3',  label: '1×3' },
  { value: '3x2',  label: '3×2' },
  { value: '2x3',  label: '2×3' },
  { value: '3x3',  label: '3×3' },
  { value: '4x1',  label: '4×1' },
  { value: '1x4',  label: '1×4' },
  { value: '4x2',  label: '4×2' },
  { value: '2x4',  label: '2×4' },
  { value: '4x3',  label: '4×3' },
  { value: '3x4',  label: '3×4' },
  { value: '4x4',  label: '4×4' },
  // Asymmetric
  { value: 'big-left-3-right',    label: 'Big Left + 3 Right' },
  { value: 'big-right-3-left',    label: 'Big Right + 3 Left' },
  { value: 'big-top-3-bottom',    label: 'Big Top + 3 Bottom' },
  { value: 'big-bottom-3-top',    label: 'Big Bottom + 3 Top' },
  { value: '2-big-4-small',       label: '2 Big + 4 Small' },
  { value: 'pip',                 label: 'Picture in Picture' },
  { value: 'featured-sidebar',    label: 'Featured + Sidebar' },
  { value: 'side-by-side-unequal',label: 'Side by Side Unequal' },
]

// ---------------------------------------------------------------------------
// ConsolePage — API-backed workspace persistence with localStorage fallback
// ---------------------------------------------------------------------------

export default function ConsolePage() {
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuthStore()
  const canPublish = user?.permissions.includes('console:workspace_publish') ?? false

  // ---- Kiosk mode -----------------------------------------------------------

  const [searchParams] = useSearchParams()
  const { setKiosk } = useUiStore()

  // Track whether this component instance set kiosk to true, so cleanup
  // doesn't accidentally clear kiosk state set by another module.
  const didSetKioskRef = useRef(false)

  useEffect(() => {
    const kioskParam = searchParams.get('kiosk') === 'true'
    if (kioskParam) {
      didSetKioskRef.current = true
      setKiosk(true)
    }
    return () => {
      if (didSetKioskRef.current) {
        setKiosk(false)
        didSetKioskRef.current = false
      }
    }
  }, [searchParams, setKiosk])

  // ---- Zustand stores ------------------------------------------------------

  const {
    workspaces,
    activeId,
    editMode,
    preserveAspectRatio,
    setWorkspaces,
    setActiveId,
    setEditMode,
    setPreserveAspectRatio,
    updateWorkspace,
    renameWorkspace,
    changeLayout,
    updateGridItems,
    updatePane,
    removePane,
    swapPanes,
    clearPanes,
  } = useWorkspaceStore()

  const temporal = useWorkspaceTemporal()

  const { toggleFavorite, isFavorite } = useConsoleWorkspaceFavorites()

  const {
    selectedPaneIds,
    swapModeSourceId,
    selectPane,
    selectAll,
    clearSelection,
    setSwapModeSourceId,
  } = useSelectionStore()

  // ---- API-backed state (when authenticated) --------------------------------

  const {
    data: apiWorkspaces,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['console-workspaces'],
    queryFn: async () => {
      const result = await consoleApi.listWorkspaces()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: isAuthenticated,
    staleTime: 30_000,
  })

  // Decide which source to use
  const useApi = isAuthenticated && !isError

  // Sync API workspaces → WorkspaceStore when they load
  useEffect(() => {
    if (useApi && apiWorkspaces) {
      setWorkspaces(apiWorkspaces)
      if (apiWorkspaces.length > 0 && (activeId === null || !apiWorkspaces.find((w) => w.id === activeId))) {
        setActiveId(apiWorkspaces[0].id)
      }
    }
  }, [useApi, apiWorkspaces, setWorkspaces, activeId, setActiveId])

  // Sync localStorage workspaces → WorkspaceStore when not using API
  const [localWorkspacesLoaded, setLocalWorkspacesLoaded] = useState(false)
  useEffect(() => {
    if (!useApi && !localWorkspacesLoaded) {
      const local = loadWorkspacesLocal()
      setWorkspaces(local)
      if (local.length > 0) setActiveId(local[0].id)
      setLocalWorkspacesLoaded(true)
    }
  }, [useApi, localWorkspacesLoaded, setWorkspaces, setActiveId])

  // ---- API mutations --------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: (ws: WorkspaceLayout) => consoleApi.saveWorkspace(ws),
    onSuccess: () => {
      saveFailCountRef.current = 0
      setShowSaveBanner(false)
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      void queryClient.invalidateQueries({ queryKey: ['console-workspaces'] })
    },
    onError: (_err, ws) => {
      saveFailCountRef.current += 1
      const next = saveFailCountRef.current
      if (next === 1) {
        showToast({ title: 'Failed to save workspace. Retrying\u2026', variant: 'error' })
      }
      if (next >= 3) {
        setShowSaveBanner(true)
        showToast({ title: 'Workspace save failed after multiple attempts.', variant: 'error' })
      } else {
        // Exponential backoff: 1s after first failure, 2s after second
        const delay = Math.pow(2, next - 1) * 1000
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        retryTimerRef.current = setTimeout(() => {
          saveMutation.mutate(ws)
        }, delay)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => consoleApi.deleteWorkspace(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['console-workspaces'] })
    },
  })

  const publishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      consoleApi.publishWorkspace(id, published),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['console-workspaces'] })
    },
  })

  // ---- Persist helper — routes to API or localStorage ---------------------

  const persistWorkspace = useCallback(
    (ws: WorkspaceLayout) => {
      if (useApi) {
        saveMutation.mutate(ws)
      } else {
        const current = useWorkspaceStore.getState().workspaces
        const exists = current.find((w) => w.id === ws.id)
        const updated = exists ? current.map((w) => (w.id === ws.id ? ws : w)) : [...current, ws]
        saveWorkspacesLocal(updated)
      }
    },
    [useApi, saveMutation],
  )

  // ---- Debounced auto-save (2s after last layout change) -----------------

  const scheduleSave = useCallback(
    (ws: WorkspaceLayout) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
      saveDebounceRef.current = setTimeout(() => {
        persistWorkspace(ws)
        saveDebounceRef.current = null
      }, 2000)
    },
    [persistWorkspace],
  )

  // Clear debounce on unmount to avoid stale saves
  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    }
  }, [])

  // ---- Undo / Redo (via zundo temporal store) ----------------------------

  const handleUndo = useCallback(() => {
    temporal.getState().undo()
  }, [temporal])

  const handleRedo = useCallback(() => {
    temporal.getState().redo()
  }, [temporal])

  // Reactive undo/redo depth for button enabled state
  const [undoDepth, setUndoDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)

  useEffect(() => {
    // Subscribe to temporal store changes to update button states
    const unsub = temporal.subscribe((state) => {
      setUndoDepth(state.pastStates.length)
      setRedoDepth(state.futureStates.length)
    })
    return unsub
  }, [temporal])

  // Reset undo history when switching workspaces
  useEffect(() => {
    temporal.getState().clear()
  }, [activeId, temporal])

  // ---- UI state -----------------------------------------------------------

  const saveFailCountRef = useRef(0)
  const [showSaveBanner, setShowSaveBanner] = useState(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [paletteVisible, setPaletteVisible] = useState(true)
  const [configuringPaneId, setConfiguringPaneId] = useState<string | null>(null)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const canExport = usePermission('console:export')
  const copiedPanesRef = useRef<PaneConfig[]>([])
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number
    y: number
    workspaceId: string
  } | null>(null)
  const [workspaceBgCtxMenu, setWorkspaceBgCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const handleWorkspaceContextMenu = useCallback((x: number, y: number) => {
    setWorkspaceBgCtxMenu({ x, y })
  }, [])

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null

  // ---- Workspace management -----------------------------------------------

  const createWorkspace = () => {
    const name = `Workspace ${workspaces.length + 1}`
    const ws = makeNewWorkspace(name)
    // Add to store
    updateWorkspace(ws.id, () => ws) // won't find it — use setWorkspaces approach
    const currentWorkspaces = useWorkspaceStore.getState().workspaces
    setWorkspaces([...currentWorkspaces, ws])
    setActiveId(ws.id)
    setEditMode(true)
    persistWorkspace(ws)
    if (useApi) {
      queryClient.setQueryData<WorkspaceLayout[]>(['console-workspaces'], (prev) =>
        prev ? [...prev, ws] : [ws],
      )
    }
  }

  const deleteActiveWorkspace = () => {
    if (!activeId) return
    const nextWorkspaces = workspaces.filter((w) => w.id !== activeId)
    setWorkspaces(nextWorkspaces)
    setActiveId(nextWorkspaces[0]?.id ?? null)
    if (useApi) {
      deleteMutation.mutate(activeId)
    } else {
      saveWorkspacesLocal(nextWorkspaces)
    }
  }

  const duplicateWorkspace = (id: string) => {
    const source = workspaces.find((w) => w.id === id)
    if (!source) return
    const copy: WorkspaceLayout = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (copy)`,
      panes: source.panes.map((p) => ({ ...p, id: uuidv4() })),
    }
    const currentWorkspaces = useWorkspaceStore.getState().workspaces
    setWorkspaces([...currentWorkspaces, copy])
    setActiveId(copy.id)
    persistWorkspace(copy)
    if (useApi) {
      queryClient.setQueryData<WorkspaceLayout[]>(['console-workspaces'], (prev) =>
        prev ? [...prev, copy] : [copy],
      )
    }
  }

  const handleTabContextMenu = useCallback((e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault()
    setTabContextMenu({ x: e.clientX, y: e.clientY, workspaceId })
  }, [])

  const handleRenameWorkspace = (id: string, name: string) => {
    renameWorkspace(id, name)
    const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === id)
    if (ws) persistWorkspace({ ...ws, name })
  }

  const handleChangeLayout = (layout: LayoutPreset) => {
    if (!activeId) return
    changeLayout(activeId, layout)
    const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
    if (ws) scheduleSave(ws)
  }

  const handleGridLayoutChange = useCallback(
    (items: GridItem[]) => {
      if (!activeId) return
      updateGridItems(activeId, items)
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (ws) scheduleSave(ws)
    },
    [activeId, updateGridItems, scheduleSave],
  )

  const saveEdit = () => setEditMode(false)

  // ---- Keyboard shortcuts -------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      // Ctrl+S — save active workspace
      if (ctrl && e.key === 's') {
        e.preventDefault()
        if (activeId) {
          const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
          if (ws) persistWorkspace(ws)
        }
        return
      }
      // Undo / redo
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return }
      // Ctrl+A — select all panes in active workspace
      if (ctrl && e.key === 'a' && editMode && activeId) {
        e.preventDefault()
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
        if (ws) selectAll(ws.panes.map((p) => p.id))
        return
      }
      // Ctrl+C — copy selected panes
      if (ctrl && e.key === 'c' && editMode && activeId && selectedPaneIds.size > 0) {
        e.preventDefault()
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
        if (ws) {
          copiedPanesRef.current = ws.panes.filter((p) => selectedPaneIds.has(p.id))
        }
        return
      }
      // Ctrl+V — paste copied panes into active workspace
      if (ctrl && e.key === 'v' && editMode && activeId && copiedPanesRef.current.length > 0) {
        e.preventDefault()
        const pasted = copiedPanesRef.current.map((p) => ({
          ...p,
          id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }))
        updateWorkspace(activeId, (w) => ({ ...w, panes: [...w.panes, ...pasted] }))
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
        if (ws) scheduleSave(ws)
        return
      }
      // Escape — cancel swap mode or clear selection
      if (e.key === 'Escape') {
        if (swapModeSourceId !== null) {
          setSwapModeSourceId(null)
          return
        }
        clearSelection()
        return
      }
      // Delete / Backspace — remove selected panes (edit mode only)
      if ((e.key === 'Delete' || e.key === 'Backspace') && editMode && activeId) {
        const currentSelection = useSelectionStore.getState().selectedPaneIds
        if (currentSelection.size === 0) return
        updateWorkspace(activeId, (w) => ({
          ...w,
          panes: w.panes.filter((p) => !currentSelection.has(p.id)),
        }))
        clearSelection()
        const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
        if (ws) scheduleSave(ws)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, handleRedo, editMode, activeId, selectedPaneIds, swapModeSourceId, updateWorkspace, selectAll, clearSelection, setSwapModeSourceId, persistWorkspace, scheduleSave])

  // ---- Pane management ----------------------------------------------------

  const handlePaneSelect = useCallback((paneId: string, addToSelection: boolean) => {
    selectPane(paneId, addToSelection)
  }, [selectPane])

  const handleConfigurePane = useCallback((paneId: string) => {
    setConfiguringPaneId(paneId)
  }, [])

  const handleRemovePane = useCallback(
    (paneId: string) => {
      if (!activeId) return
      removePane(activeId, paneId)
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (ws) scheduleSave(ws)
    },
    [activeId, removePane, scheduleSave],
  )

  const handleSwapWith = useCallback((paneId: string) => {
    setSwapModeSourceId(paneId)
  }, [setSwapModeSourceId])

  const handleSwapComplete = useCallback(
    (targetId: string) => {
      if (!activeId || !swapModeSourceId) return
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (!ws) return
      const items = ws.gridItems?.length ? ws.gridItems : presetToGridItems(ws.layout, ws.panes)
      swapPanes(activeId, swapModeSourceId, targetId, items)
      setSwapModeSourceId(null)
      const updated = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (updated) scheduleSave(updated)
    },
    [activeId, swapModeSourceId, swapPanes, setSwapModeSourceId, scheduleSave],
  )

  const handleReplacePane = useCallback(
    (paneId: string, graphicId: string, graphicName: string) => {
      if (!activeId) return
      updateWorkspace(activeId, (w) => ({
        ...w,
        panes: w.panes.map((p) =>
          p.id === paneId ? { ...p, type: 'graphic', graphicId, title: graphicName } : p,
        ),
      }))
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (ws) scheduleSave(ws)
    },
    [activeId, updateWorkspace, scheduleSave],
  )

  // ---------------------------------------------------------------------------
  // Export helpers
  // ---------------------------------------------------------------------------

  /** Produces spec-compliant filename: console_workspace_{YYYY-MM-DD_HHmm}.{ext} */
  function exportFilename(ext: string): string {
    const now = new Date()
    const datePart = now.toISOString().slice(0, 10)
    const timePart = now.toTimeString().slice(0, 5).replace(':', '')
    return `console_workspace_${datePart}_${timePart}.${ext}`
  }

  /** Collect all point IDs from all pane types in the active workspace. */
  function collectWorkspacePointIds(ws: WorkspaceLayout): string[] {
    const ids: string[] = []
    for (const pane of ws.panes) {
      if (pane.trendPointIds?.length) ids.push(...pane.trendPointIds)
      if (pane.tablePointIds?.length) ids.push(...pane.tablePointIds)
      // Graphic pane: points are tracked by the realtime store under their graphicId;
      // include them via the subscribed set which covers all graphic bindings.
    }
    return [...new Set(ids)]
  }

  const LARGE_EXPORT_THRESHOLD = 50_000

  /** Quick-format export triggered from dropdown — uses exportsApi for all 6 formats. */
  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportDropdownOpen(false)
    if (!activeWorkspace) return

    const pointIds = collectWorkspacePointIds(activeWorkspace)
    // Columns are the point IDs themselves for a workspace export
    const columns = pointIds.length > 0 ? pointIds : ['tagname', 'value', 'quality', 'timestamp']
    const estimatedRows = pointIds.length

    try {
      if (estimatedRows >= LARGE_EXPORT_THRESHOLD) {
        // Async path: submit job, WebSocket export_complete will notify the user
        const result = await exportsApi.create({
          module: 'console',
          entity: 'workspace',
          format,
          scope: 'all',
          columns,
        })
        if (result.type === 'download') {
          exportsApi.triggerDownload(result.blob, exportFilename(format))
        }
        // If 'queued', the WebSocket export_complete event will show a toast
      } else {
        const result = await exportsApi.create({
          module: 'console',
          entity: 'workspace',
          format,
          scope: 'all',
          columns,
        })
        if (result.type === 'download') {
          // Override server filename with spec-compliant name
          exportsApi.triggerDownload(result.blob, exportFilename(format))
        }
      }
    } catch (err) {
      console.error('[Console] Export failed:', err)
    }
  }, [activeWorkspace])

  const handleSavePane = (updated: PaneConfig) => {
    if (!activeId) return
    updatePane(activeId, updated)
    const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
    if (ws) scheduleSave(ws)
    setConfiguringPaneId(null)
  }

  // ---- Palette drop handler -----------------------------------------------

  const handlePaletteDrop = useCallback(
    (paneId: string, item: ConsoleDragItem) => {
      if (!activeId) return
      updateWorkspace(activeId, (w) => ({
        ...w,
        panes: w.panes.map((p) => {
          if (p.id !== paneId) return p
          switch (item.itemType) {
            case 'trend':
              return {
                ...p,
                type: 'trend' as const,
                trendPointIds: item.pointIds ?? p.trendPointIds ?? [],
                title: item.label ?? p.title,
              }
            case 'point_table':
              return {
                ...p,
                type: 'point_table' as const,
                tablePointIds: item.pointIds ?? p.tablePointIds ?? [],
                title: item.label ?? p.title,
              }
            case 'alarm_list':
              return { ...p, type: 'alarm_list' as const, title: item.label ?? p.title }
            case 'graphic':
              return {
                ...p,
                type: 'graphic' as const,
                graphicId: item.graphicId,
                title: item.label ?? p.title,
              }
            default:
              return p
          }
        }),
      }))
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (ws) scheduleSave(ws)
    },
    [activeId, updateWorkspace, scheduleSave],
  )

  // ---- Palette double-click quick-place (§5.4) ----------------------------

  const handleQuickPlace = useCallback(
    (item: ConsoleDragItem) => {
      if (!activeId) return
      updateWorkspace(activeId, (w) => {
        const applyItem = (p: PaneConfig): PaneConfig => {
          switch (item.itemType) {
            case 'trend':
              return { ...p, type: 'trend' as const, trendPointIds: item.pointIds ?? [], title: item.label ?? p.title }
            case 'point_table':
              return { ...p, type: 'point_table' as const, tablePointIds: item.pointIds ?? [], title: item.label ?? p.title }
            case 'alarm_list':
              return { ...p, type: 'alarm_list' as const, title: item.label ?? p.title }
            case 'graphic':
              return { ...p, type: 'graphic' as const, graphicId: item.graphicId, title: item.label ?? p.title }
            default:
              return p
          }
        }

        const newPane = (): PaneConfig => applyItem({ id: uuidv4(), type: 'blank' as const })

        if (w.panes.length === 0) {
          // No panes: create a 1×1 layout
          const firstPane = newPane()
          return { ...w, panes: [firstPane], gridItems: [{ i: firstPane.id, x: 0, y: 0, w: 12, h: 8 }] }
        }

        // Priority 1: replace first selected pane
        const selIds = [...selectedPaneIds]
        if (selIds.length > 0) {
          return {
            ...w,
            panes: w.panes.map((p) => (p.id === selIds[0] ? applyItem(p) : p)),
          }
        }

        // Priority 2: first blank pane (row-major order by grid item y then x)
        const sorted = [...w.panes].sort((a, b) => {
          const ga = w.gridItems?.find((gi) => gi.i === a.id)
          const gb = w.gridItems?.find((gi) => gi.i === b.id)
          if (!ga || !gb) return 0
          return ga.y !== gb.y ? ga.y - gb.y : ga.x - gb.x
        })
        const blankPane = sorted.find((p) => p.type === 'blank')
        if (blankPane) {
          return {
            ...w,
            panes: w.panes.map((p) => (p.id === blankPane.id ? applyItem(p) : p)),
          }
        }

        // Priority 3: add new pane appended to grid
        const np = newPane()
        const maxRow = Math.max(0, ...(w.gridItems ?? []).map((gi) => gi.y + gi.h))
        const newGridItem = { i: np.id, x: 0, y: maxRow, w: 6, h: 6 }
        return {
          ...w,
          panes: [...w.panes, np],
          gridItems: [...(w.gridItems ?? []), newGridItem],
        }
      })
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
      if (ws) scheduleSave(ws)
    },
    [activeId, updateWorkspace, selectedPaneIds, scheduleSave],
  )

  // ---- Configuring pane object --------------------------------------------

  const configuringPane = configuringPaneId
    ? activeWorkspace?.panes.find((p) => p.id === configuringPaneId) ?? null
    : null

  // ---- Render -------------------------------------------------------------

  if (isLoading && isAuthenticated) {
    return (
      <div style={{ display: 'flex', height: '100%', background: 'var(--io-bg)' }}>
        {/* Left panel skeleton */}
        <div style={{
          width: 280, flexShrink: 0,
          background: 'var(--io-surface-secondary)',
          borderRight: '1px solid var(--io-border)',
          padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              height: 28, borderRadius: 4,
              background: 'var(--io-surface-elevated)',
              animation: 'io-shimmer 1.4s ease-in-out infinite',
            }} />
          ))}
        </div>
        {/* Grid area skeleton */}
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
          gap: 4, padding: 4,
        }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              borderRadius: 4,
              background: 'var(--io-surface-secondary)',
              animation: 'io-shimmer 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 12px',
          height: 48,
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        {/* Title */}
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            marginRight: 16,
            flexShrink: 0,
          }}
        >
          Console
        </span>

        {/* Workspace tabs */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'stretch',
            gap: 2,
            overflow: 'hidden',
          }}
        >
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setActiveId(ws.id)}
              onContextMenu={(e) => handleTabContextMenu(e, ws.id)}
              style={{
                background:
                  ws.id === activeId ? 'var(--io-surface-secondary)' : 'transparent',
                border: 'none',
                borderBottom:
                  ws.id === activeId
                    ? '2px solid var(--io-accent)'
                    : '2px solid transparent',
                padding: '0 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: ws.id === activeId ? 600 : 400,
                color:
                  ws.id === activeId ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
                whiteSpace: 'nowrap',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {ws.published && (
                <span
                  title="Published workspace"
                  style={{ color: 'var(--io-accent)', fontSize: 8, marginRight: 3 }}
                >
                  ●
                </span>
              )}
              {ws.name}
            </button>
          ))}

          {/* + New tab */}
          <button
            onClick={createWorkspace}
            title="New workspace"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0 10px',
              cursor: 'pointer',
              fontSize: 18,
              color: 'var(--io-text-muted)',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>

        {/* Right-side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {editMode && activeWorkspace && (
            <>
              {/* Undo / Redo */}
              <button
                onClick={handleUndo}
                disabled={undoDepth === 0}
                title="Undo (Ctrl+Z)"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: undoDepth === 0 ? 'default' : 'pointer',
                  fontSize: 12,
                  color: undoDepth === 0 ? 'var(--io-text-disabled)' : 'var(--io-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {/* Undo arrow */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={redoDepth === 0}
                title="Redo (Ctrl+Y)"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: redoDepth === 0 ? 'default' : 'pointer',
                  fontSize: 12,
                  color: redoDepth === 0 ? 'var(--io-text-disabled)' : 'var(--io-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Redo
                {/* Redo arrow */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
                </svg>
              </button>

              {/* Layout selector */}
              <select
                value={activeWorkspace.layout}
                onChange={(e) => handleChangeLayout(e.target.value as LayoutPreset)}
                style={{
                  background: 'var(--io-surface-secondary)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--io-text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {LAYOUT_PRESETS.map((lp) => (
                  <option key={lp.value} value={lp.value}>
                    {lp.label}
                  </option>
                ))}
              </select>

              {/* Clear Grid button */}
              <button
                onClick={() => {
                  if (!activeId) return
                  clearPanes(activeId)
                  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
                  if (ws) persistWorkspace(ws)
                }}
                title="Clear all panes"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--io-text-muted)',
                }}
              >
                Clear
              </button>

              {/* Rename button */}
              <button
                onClick={() => {
                  const newName = prompt('Workspace name:', activeWorkspace.name)
                  if (newName && newName.trim()) handleRenameWorkspace(activeWorkspace.id, newName.trim())
                }}
                title="Rename workspace"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--io-border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--io-text-muted)',
                }}
              >
                Rename
              </button>

              {/* Publish toggle — gated by console:workspace_publish permission */}
              {canPublish && (
                <button
                  onClick={() => publishMutation.mutate({ id: activeWorkspace.id, published: !activeWorkspace.published })}
                  title={activeWorkspace.published ? 'Unpublish workspace (visible to all users)' : 'Publish workspace (make visible to all users)'}
                  style={{
                    background: activeWorkspace.published ? 'var(--io-accent-subtle)' : 'transparent',
                    border: '1px solid var(--io-border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: activeWorkspace.published ? 'var(--io-accent)' : 'var(--io-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {activeWorkspace.published ? '● Published' : '○ Publish'}
                </button>
              )}

              {/* Delete workspace */}
              {workspaces.length > 1 && (
                <button
                  onClick={deleteActiveWorkspace}
                  title="Delete workspace"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--io-border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--io-danger)',
                  }}
                >
                  Delete
                </button>
              )}

              {/* Save / Done button */}
              <button
                onClick={saveEdit}
                style={{
                  background: 'var(--io-accent)',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                Done
              </button>
            </>
          )}

          {/* Aspect ratio toggle — always visible when a workspace is active */}
          {activeWorkspace && (
            <button
              onClick={() => setPreserveAspectRatio(!preserveAspectRatio)}
              title={preserveAspectRatio ? 'Preserve aspect ratio (click to stretch to fill pane)' : 'Stretch to fill pane (click to preserve aspect ratio)'}
              style={{
                background: preserveAspectRatio ? 'transparent' : 'var(--io-accent)',
                border: '1px solid var(--io-border)',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
                color: preserveAspectRatio ? 'var(--io-text-muted)' : '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {/* Lock/unlock icon */}
              {preserveAspectRatio ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
              )}
              AR
            </button>
          )}

          {/* Export split button — gated by console:export */}
          {activeWorkspace && !editMode && canExport && (
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              {/* Left: open full Export Dialog */}
              <button
                onClick={() => setExportDialogOpen(true)}
                title="Export workspace data"
                style={{
                  background: 'transparent', border: '1px solid var(--io-border)',
                  borderRight: 'none',
                  borderRadius: '6px 0 0 6px', padding: '5px 10px', cursor: 'pointer',
                  fontSize: 13, color: 'var(--io-text-primary)',
                  display: 'flex', alignItems: 'center', gap: 5,
                  whiteSpace: 'nowrap',
                }}
              >
                Export
              </button>
              {/* Right: chevron opens quick-format dropdown */}
              <button
                onClick={() => setExportDropdownOpen((v) => !v)}
                title="Quick export format"
                style={{
                  background: 'transparent', border: '1px solid var(--io-border)',
                  borderRadius: '0 6px 6px 0', padding: '5px 7px', cursor: 'pointer',
                  fontSize: 11, color: 'var(--io-text-primary)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="2,3 8,3 5,7" />
                </svg>
              </button>
              {exportDropdownOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                    onClick={() => setExportDropdownOpen(false)}
                  />
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, zIndex: 1000,
                    background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)',
                    borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden',
                    minWidth: 140, marginTop: 4,
                  }}>
                    {(
                      [
                        { label: 'CSV',     fmt: 'csv'     },
                        { label: 'XLSX',    fmt: 'xlsx'    },
                        { label: 'JSON',    fmt: 'json'    },
                        { label: 'PDF',     fmt: 'pdf'     },
                        { label: 'Parquet', fmt: 'parquet' },
                        { label: 'HTML',    fmt: 'html'    },
                      ] as { label: string; fmt: ExportFormat }[]
                    ).map(({ label, fmt }) => (
                      <button
                        key={fmt}
                        onClick={() => { void handleExport(fmt) }}
                        style={{
                          display: 'block', width: '100%', padding: '8px 14px',
                          background: 'none', border: 'none', textAlign: 'left',
                          cursor: 'pointer', fontSize: 13, color: 'var(--io-text-primary)',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {/* Full Export Dialog */}
              <ExportDialog
                open={exportDialogOpen}
                onClose={() => setExportDialogOpen(false)}
                module="console"
                entity="workspace"
                filteredRowCount={(activeWorkspace.panes ?? []).reduce((n, p) => {
                  if (p.trendPointIds?.length) return n + p.trendPointIds.length
                  if (p.tablePointIds?.length) return n + p.tablePointIds.length
                  return n
                }, 0)}
                totalRowCount={(activeWorkspace.panes ?? []).reduce((n, p) => {
                  if (p.trendPointIds?.length) return n + p.trendPointIds.length
                  if (p.tablePointIds?.length) return n + p.tablePointIds.length
                  return n
                }, 0)}
                availableColumns={[
                  { id: 'tagname',     label: 'Tag Name'    },
                  { id: 'value',       label: 'Value'       },
                  { id: 'quality',     label: 'Quality'     },
                  { id: 'timestamp',   label: 'Timestamp'   },
                  { id: 'description', label: 'Description' },
                  { id: 'units',       label: 'Units'       },
                ]}
                visibleColumns={['tagname', 'value', 'quality', 'timestamp']}
              />
            </div>
          )}

          {/* Edit toggle */}
          {activeWorkspace && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              title="Edit workspace layout"
              style={{
                background: 'transparent',
                border: '1px solid var(--io-border)',
                borderRadius: 6,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--io-text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {/* Pencil icon */}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
        {/* Left palette */}
        <ConsolePalette
          visible={paletteVisible}
          onToggle={() => setPaletteVisible((v) => !v)}
          onQuickPlace={handleQuickPlace}
          workspaces={workspaces}
          activeWorkspaceId={activeId}
          onSelectWorkspace={setActiveId}
          onRenameWorkspace={(id) => {
            const ws = workspaces.find((w) => w.id === id)
            if (!ws) return
            const newName = prompt('Workspace name:', ws.name)
            if (newName && newName.trim()) handleRenameWorkspace(id, newName.trim())
          }}
          onDuplicateWorkspace={duplicateWorkspace}
          onDeleteWorkspace={(id) => {
            const nextWorkspaces = workspaces.filter((w) => w.id !== id)
            setWorkspaces(nextWorkspaces)
            if (activeId === id) setActiveId(nextWorkspaces[0]?.id ?? null)
            if (useApi) {
              deleteMutation.mutate(id)
            } else {
              saveWorkspacesLocal(nextWorkspaces)
            }
          }}
        />

        {/* Workspace area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Swap mode banner */}
          {swapModeSourceId && (
            <div style={{
              flexShrink: 0,
              padding: '6px 14px',
              background: 'var(--io-warning)',
              color: 'var(--io-text-inverse)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Click another pane to swap positions — press Escape to cancel
              <button
                onClick={() => setSwapModeSourceId(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--io-text-inverse)', cursor: 'pointer', fontSize: 11 }}
              >
                Cancel
              </button>
            </div>
          )}
          {/* Auto-save failure banner — persistent until manually retried or save succeeds */}
          {showSaveBanner && (
            <div
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                background: 'var(--io-alarm-high)',
                color: '#fff',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>Workspace changes not saved. Retry?</span>
              <button
                onClick={() => {
                  if (activeWorkspace) {
                    saveFailCountRef.current = 0
                    setShowSaveBanner(false)
                    saveMutation.mutate(activeWorkspace)
                  }
                }}
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 4,
                  color: '#fff',
                  padding: '2px 10px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Save now
              </button>
            </div>
          )}

          {workspaces.length === 0 ? (
            /* Empty state */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                color: 'var(--io-text-muted)',
              }}
            >
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="12" y1="3" x2="12" y2="17" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <div style={{ textAlign: 'center', fontSize: 15 }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                  No workspaces yet
                </p>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Create your first workspace to start monitoring
                </p>
              </div>
              <button
                onClick={createWorkspace}
                style={{
                  background: 'var(--io-accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '9px 20px',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Create Workspace
              </button>
            </div>
          ) : activeWorkspace ? (
            <WorkspaceGrid
              workspace={activeWorkspace}
              editMode={editMode}
              selectedPaneIds={selectedPaneIds}
              preserveAspectRatio={preserveAspectRatio}
              onConfigurePane={handleConfigurePane}
              onRemovePane={handleRemovePane}
              onSelectPane={handlePaneSelect}
              onPaletteDrop={handlePaletteDrop}
              onGridLayoutChange={handleGridLayoutChange}
              onWorkspaceContextMenu={handleWorkspaceContextMenu}
              swapModeSourceId={swapModeSourceId}
              onSwapWith={handleSwapWith}
              onSwapComplete={handleSwapComplete}
              onReplace={handleReplacePane}
            />
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--io-text-muted)',
                fontSize: 14,
              }}
            >
              Select a workspace above
            </div>
          )}

          {/* Historical Playback Bar — always shown at bottom of workspace area */}
          {workspaces.length > 0 && <HistoricalPlaybackBar />}

          {/* Status bar */}
          {workspaces.length > 0 && (
            <ConsoleStatusBar
              workspaceName={activeWorkspace?.name ?? ''}
            />
          )}
        </div>
      </div>

      {/* Pane config modal */}
      {configuringPane && (
        <PaneConfigModal
          pane={configuringPane}
          onSave={handleSavePane}
          onClose={() => setConfiguringPaneId(null)}
        />
      )}

      {/* Workspace background right-click menu (§14.1) */}
      {workspaceBgCtxMenu && (
        <ContextMenu
          x={workspaceBgCtxMenu.x}
          y={workspaceBgCtxMenu.y}
          onClose={() => setWorkspaceBgCtxMenu(null)}
          items={[
            {
              label: 'Add Pane',
              onClick: () => {
                if (activeId) {
                  updateWorkspace(activeId, (w) => ({
                    ...w,
                    panes: [...w.panes, {
                      id: `pane-${Date.now()}`,
                      type: 'blank' as const,
                      title: 'New Pane',
                    }],
                  }))
                  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
                  if (ws) persistWorkspace(ws)
                }
                setWorkspaceBgCtxMenu(null)
              },
            },
            {
              label: 'Paste',
              disabled: copiedPanesRef.current.length === 0,
              onClick: () => {
                if (activeId && copiedPanesRef.current.length > 0) {
                  const pasted = copiedPanesRef.current.map((p) => ({
                    ...p,
                    id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  }))
                  updateWorkspace(activeId, (w) => ({ ...w, panes: [...w.panes, ...pasted] }))
                  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
                  if (ws) persistWorkspace(ws)
                }
                setWorkspaceBgCtxMenu(null)
              },
            },
            {
              label: 'Select All',
              onClick: () => {
                if (activeId) {
                  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
                  if (ws) selectAll(ws.panes.map((p) => p.id))
                }
                setWorkspaceBgCtxMenu(null)
              },
            },
            {
              label: 'Clear Grid',
              divider: true,
              onClick: () => {
                if (activeId) {
                  updateWorkspace(activeId, (w) => ({ ...w, panes: [] }))
                  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
                  if (ws) persistWorkspace(ws)
                }
                setWorkspaceBgCtxMenu(null)
              },
            },
            {
              label: 'Workspace Properties…',
              onClick: () => {
                setWorkspaceBgCtxMenu(null)
                if (activeId) {
                  const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === activeId)
                  const newName = prompt('Workspace name:', ws?.name ?? '')
                  if (newName?.trim()) {
                    handleRenameWorkspace(activeId, newName.trim())
                  }
                }
              },
            },
          ]}
        />
      )}

      {/* Workspace tab context menu */}
      {tabContextMenu && (() => {
        const ws = workspaces.find((w) => w.id === tabContextMenu.workspaceId)
        if (!ws) return null
        return (
          <ContextMenu
            x={tabContextMenu.x}
            y={tabContextMenu.y}
            onClose={() => setTabContextMenu(null)}
            items={[
              {
                label: 'Switch to Workspace',
                onClick: () => setActiveId(ws.id),
              },
              {
                label: isFavorite(ws.id) ? 'Remove from Favorites' : 'Add to Favorites',
                onClick: () => {
                  toggleFavorite(ws.id)
                  setTabContextMenu(null)
                },
              },
              {
                label: 'Rename…',
                divider: false,
                onClick: () => {
                  const newName = prompt('Workspace name:', ws.name)
                  if (newName && newName.trim()) handleRenameWorkspace(ws.id, newName.trim())
                },
              },
              {
                label: 'Duplicate',
                onClick: () => duplicateWorkspace(ws.id),
              },
              ...(canPublish ? [{
                label: ws.published ? 'Unpublish' : 'Publish',
                divider: false,
                onClick: () => publishMutation.mutate({ id: ws.id, published: !ws.published }),
              }] : []),
              {
                label: 'Delete',
                divider: true,
                disabled: workspaces.length <= 1,
                onClick: () => {
                  const nextWorkspaces = workspaces.filter((w) => w.id !== ws.id)
                  setWorkspaces(nextWorkspaces)
                  if (activeId === ws.id) setActiveId(nextWorkspaces[0]?.id ?? null)
                  if (useApi) {
                    deleteMutation.mutate(ws.id)
                  } else {
                    saveWorkspacesLocal(nextWorkspaces)
                  }
                  setTabContextMenu(null)
                },
              },
            ]}
          />
        )
      })()}
    </div>
  )
}
