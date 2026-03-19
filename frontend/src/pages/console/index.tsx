import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import WorkspaceGrid from './WorkspaceGrid'
import type { GridItem } from './types'
import ConsolePalette, { type ConsoleDragItem } from './ConsolePalette'
import HistoricalPlaybackBar from '../../shared/components/HistoricalPlaybackBar'
import PaneConfigModal from './PaneConfigModal'
import ContextMenu from '../../shared/components/ContextMenu'
import type { WorkspaceLayout, PaneConfig, LayoutPreset } from './types'
import { uuidv4 } from '../../lib/uuid'
import { consoleApi } from '../../api/console'
import { useAuthStore } from '../../store/auth'
import { usePlaybackStore } from '../../store/playback'

// ---------------------------------------------------------------------------
// ConsoleStatusBar
// ---------------------------------------------------------------------------

function ConsoleStatusBar({
  workspaceName,
  subscribedPoints,
}: {
  workspaceName: string
  subscribedPoints: number
}) {
  const { mode } = usePlaybackStore()
  const isHistorical = mode === 'historical'

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
            background: '#22C55E',
            display: 'inline-block',
          }}
        />
        Connected
      </span>
      <span style={{ color: 'var(--io-border)' }}>|</span>
      {/* Points */}
      <span>{subscribedPoints} points subscribed</span>
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
            background: isHistorical ? '#F59E0B' : '#22C55E',
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
// Helpers
// ---------------------------------------------------------------------------

function makeBlankPanes(count: number): PaneConfig[] {
  return Array.from({ length: count }, () => ({ id: uuidv4(), type: 'blank' as const }))
}

function layoutPaneCount(layout: LayoutPreset): number {
  switch (layout) {
    // Even grids
    case '1x1': return 1
    case '2x1': return 2
    case '1x2': return 2
    case '2x2': return 4
    case '3x1': return 3
    case '1x3': return 3
    case '3x2': return 6
    case '2x3': return 6
    case '3x3': return 9
    case '4x1': return 4
    case '1x4': return 4
    case '4x2': return 8
    case '2x4': return 8
    case '4x3': return 12
    case '3x4': return 12
    case '4x4': return 16
    // Asymmetric
    case 'big-left-3-right': return 4
    case 'big-right-3-left': return 4
    case 'big-top-3-bottom': return 4
    case 'big-bottom-3-top': return 4
    case '2-big-4-small': return 6
    case 'pip': return 2
    case 'featured-sidebar': return 2
    case 'side-by-side-unequal': return 2
    // Legacy
    case '2x1+1': return 3
    default: return 1
  }
}

function makeNewWorkspace(name: string, layout: LayoutPreset = '2x2'): WorkspaceLayout {
  return {
    id: uuidv4(),
    name,
    layout,
    panes: makeBlankPanes(layoutPaneCount(layout)),
  }
}

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

  // ---- Local fallback state (when not authenticated or API fails) -----------

  const [localWorkspaces, setLocalWorkspaces] = useState<WorkspaceLayout[]>(() =>
    loadWorkspacesLocal(),
  )

  // Decide which source to use
  const useApi = isAuthenticated && !isError
  const workspaces: WorkspaceLayout[] = useApi
    ? (apiWorkspaces ?? [])
    : localWorkspaces

  // ---- Active workspace tracking -------------------------------------------

  const [activeId, setActiveId] = useState<string | null>(null)

  // Set active to first workspace once data loads
  useEffect(() => {
    if (workspaces.length > 0 && activeId === null) {
      setActiveId(workspaces[0].id)
    }
    // Clear active if the active workspace was deleted
    if (activeId !== null && !workspaces.find((w) => w.id === activeId)) {
      setActiveId(workspaces[0]?.id ?? null)
    }
  }, [workspaces, activeId])

  // ---- API mutations --------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: (ws: WorkspaceLayout) => consoleApi.saveWorkspace(ws),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['console-workspaces'] })
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
        setLocalWorkspaces((prev) => {
          const exists = prev.find((w) => w.id === ws.id)
          const updated = exists ? prev.map((w) => (w.id === ws.id ? ws : w)) : [...prev, ws]
          saveWorkspacesLocal(updated)
          return updated
        })
      }
    },
    [useApi, saveMutation],
  )

  const deleteWorkspace = useCallback(
    (id: string) => {
      if (useApi) {
        deleteMutation.mutate(id)
      } else {
        setLocalWorkspaces((prev) => {
          const updated = prev.filter((w) => w.id !== id)
          saveWorkspacesLocal(updated)
          return updated
        })
      }
      if (activeId === id) {
        setActiveId(workspaces.find((w) => w.id !== id)?.id ?? null)
      }
    },
    [useApi, deleteMutation, activeId, workspaces],
  )

  // ---- Undo/Redo stacks (scoped to active workspace) ----------------------

  const MAX_UNDO = 50
  // Refs for stacks so we can read them synchronously in callbacks
  const undoStackRef = useRef<WorkspaceLayout[]>([])
  const redoStackRef = useRef<WorkspaceLayout[]>([])
  // State shadows for reactive UI (canUndo/canRedo buttons)
  const [undoDepth, setUndoDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)

  // Reset stacks when switching workspaces
  useEffect(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    setUndoDepth(0)
    setRedoDepth(0)
  }, [activeId])

  const pushUndo = useCallback((snapshot: WorkspaceLayout) => {
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-MAX_UNDO)
    redoStackRef.current = []
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(0)
  }, [])

  // Apply an update function to the workspace list and persist the changed workspace
  const updateWorkspace = useCallback(
    (id: string, updater: (w: WorkspaceLayout) => WorkspaceLayout, skipUndo = false) => {
      const target = workspaces.find((w) => w.id === id)
      if (!target) return
      // Snapshot current state for undo (unless this IS an undo/redo restore)
      if (!skipUndo) pushUndo(target)
      const updated = updater(target)
      persistWorkspace(updated)
      // Optimistically update local list (API will re-fetch via invalidation)
      if (useApi) {
        queryClient.setQueryData<WorkspaceLayout[]>(['console-workspaces'], (prev) =>
          prev ? prev.map((w) => (w.id === id ? updated : w)) : prev,
        )
      }
    },
    [workspaces, persistWorkspace, useApi, queryClient, pushUndo],
  )

  // ---- UI state -----------------------------------------------------------

  const [editMode, setEditMode] = useState(false)
  const [paletteVisible, setPaletteVisible] = useState(true)
  const [configuringPaneId, setConfiguringPaneId] = useState<string | null>(null)
  const [selectedPaneIds, setSelectedPaneIds] = useState<Set<string>>(new Set())
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(true)
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
    persistWorkspace(ws)
    // Optimistically add to local list for API mode
    if (useApi) {
      queryClient.setQueryData<WorkspaceLayout[]>(['console-workspaces'], (prev) =>
        prev ? [...prev, ws] : [ws],
      )
    }
    setActiveId(ws.id)
    setEditMode(true)
  }

  const deleteActiveWorkspace = () => {
    if (!activeId) return
    deleteWorkspace(activeId)
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
    persistWorkspace(copy)
    if (useApi) {
      queryClient.setQueryData<WorkspaceLayout[]>(['console-workspaces'], (prev) =>
        prev ? [...prev, copy] : [copy],
      )
    }
    setActiveId(copy.id)
  }

  const handleTabContextMenu = useCallback((e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault()
    setTabContextMenu({ x: e.clientX, y: e.clientY, workspaceId })
  }, [])

  const renameWorkspace = (id: string, name: string) => {
    updateWorkspace(id, (w) => ({ ...w, name }))
  }

  const changeLayout = (layout: LayoutPreset) => {
    if (!activeId) return
    updateWorkspace(activeId, (w) => {
      const needed = layoutPaneCount(layout)
      const existing = w.panes.slice(0, needed)
      const extra = makeBlankPanes(Math.max(0, needed - existing.length))
      // Clear saved grid positions so the new preset's defaults take effect
      return { ...w, layout, panes: [...existing, ...extra], gridItems: undefined }
    })
  }

  const handleGridLayoutChange = useCallback(
    (items: GridItem[]) => {
      if (!activeId) return
      updateWorkspace(activeId, (w) => ({ ...w, gridItems: items }))
    },
    [activeId, updateWorkspace],
  )

  const saveEdit = () => setEditMode(false)

  // ---- Undo / Redo ---------------------------------------------------------

  const handleUndo = useCallback(() => {
    if (!activeId || undoStackRef.current.length === 0) return
    const stack = [...undoStackRef.current]
    const snapshot = stack.pop()!
    const current = workspaces.find((w) => w.id === activeId)
    if (current) {
      redoStackRef.current = [...redoStackRef.current, current]
      setRedoDepth(redoStackRef.current.length)
    }
    undoStackRef.current = stack
    setUndoDepth(stack.length)
    // Restore snapshot without pushing a new undo entry
    updateWorkspace(activeId, () => snapshot, true)
  }, [activeId, workspaces, updateWorkspace])

  const handleRedo = useCallback(() => {
    if (!activeId || redoStackRef.current.length === 0) return
    const stack = [...redoStackRef.current]
    const snapshot = stack.pop()!
    const current = workspaces.find((w) => w.id === activeId)
    if (current) {
      undoStackRef.current = [...undoStackRef.current, current]
      setUndoDepth(undoStackRef.current.length)
    }
    redoStackRef.current = stack
    setRedoDepth(stack.length)
    updateWorkspace(activeId, () => snapshot, true)
  }, [activeId, workspaces, updateWorkspace])

  // Keyboard shortcuts: undo/redo, pane selection ops
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      // Ctrl+S — save active workspace
      if (ctrl && e.key === 's') {
        e.preventDefault()
        if (activeId) {
          const ws = workspaces.find((w) => w.id === activeId)
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
        const ws = workspaces.find((w) => w.id === activeId)
        if (ws) setSelectedPaneIds(new Set(ws.panes.map((p) => p.id)))
        return
      }
      // Ctrl+C — copy selected panes
      if (ctrl && e.key === 'c' && editMode && activeId && selectedPaneIds.size > 0) {
        e.preventDefault()
        const ws = workspaces.find((w) => w.id === activeId)
        if (ws) {
          copiedPanesRef.current = ws.panes.filter((p) => selectedPaneIds.has(p.id))
        }
        return
      }
      // Ctrl+V — paste copied panes into active workspace
      if (ctrl && e.key === 'v' && editMode && activeId && copiedPanesRef.current.length > 0) {
        e.preventDefault()
        updateWorkspace(activeId, (w) => ({
          ...w,
          panes: [
            ...w.panes,
            ...copiedPanesRef.current.map((p) => ({
              ...p,
              id: `pane-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            })),
          ],
        }))
        return
      }
      // Escape — clear selection
      if (e.key === 'Escape') {
        setSelectedPaneIds(new Set())
        return
      }
      // Delete / Backspace — remove selected panes (edit mode only)
      if ((e.key === 'Delete' || e.key === 'Backspace') && editMode && activeId) {
        setSelectedPaneIds((prev) => {
          if (prev.size === 0) return prev
          updateWorkspace(activeId, (w) => ({
            ...w,
            panes: w.panes.filter((p) => !prev.has(p.id)),
          }))
          return new Set()
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleUndo, handleRedo, editMode, activeId, workspaces, updateWorkspace, selectedPaneIds, persistWorkspace])

  // ---- Pane management ----------------------------------------------------

  const handlePaneSelect = useCallback((paneId: string, addToSelection: boolean) => {
    setSelectedPaneIds((prev) => {
      if (addToSelection) {
        const next = new Set(prev)
        if (next.has(paneId)) next.delete(paneId)
        else next.add(paneId)
        return next
      }
      // Single-select: toggle off if already the only selected
      if (prev.size === 1 && prev.has(paneId)) return new Set()
      return new Set([paneId])
    })
  }, [])

  const handleConfigurePane = useCallback((paneId: string) => {
    setConfiguringPaneId(paneId)
  }, [])

  const handleRemovePane = useCallback(
    (paneId: string) => {
      if (!activeId) return
      updateWorkspace(activeId, (w) => ({
        ...w,
        panes: w.panes.map((p) =>
          p.id === paneId ? { id: uuidv4(), type: 'blank' as const } : p,
        ),
      }))
    },
    [activeId, updateWorkspace],
  )

  const handleSavePane = (updated: PaneConfig) => {
    if (!activeId) return
    updateWorkspace(activeId, (w) => ({
      ...w,
      panes: w.panes.map((p) => (p.id === updated.id ? updated : p)),
    }))
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
    },
    [activeId, updateWorkspace],
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
    },
    [activeId, updateWorkspace, selectedPaneIds],
  )

  // ---- Configuring pane object --------------------------------------------

  const configuringPane = configuringPaneId
    ? activeWorkspace?.panes.find((p) => p.id === configuringPaneId) ?? null
    : null

  // ---- Render -------------------------------------------------------------

  if (isLoading && isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--io-text-muted)',
          fontSize: 14,
        }}
      >
        Loading workspaces…
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
                onChange={(e) => changeLayout(e.target.value as LayoutPreset)}
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
                  updateWorkspace(activeId, (w) => ({
                    ...w,
                    panes: w.panes.map(() => ({ id: uuidv4(), type: 'blank' as const })),
                  }))
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
                  if (newName && newName.trim()) renameWorkspace(activeWorkspace.id, newName.trim())
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
                    color: '#EF4444',
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
              onClick={() => setPreserveAspectRatio((v) => !v)}
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
        <ConsolePalette visible={paletteVisible} onToggle={() => setPaletteVisible((v) => !v)} onQuickPlace={handleQuickPlace} />

        {/* Workspace area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
              subscribedPoints={0}
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
                }
                setWorkspaceBgCtxMenu(null)
              },
            },
            {
              label: 'Select All',
              onClick: () => {
                if (activeId) {
                  const ws = workspaces.find((w) => w.id === activeId)
                  if (ws) setSelectedPaneIds(new Set(ws.panes.map((p) => p.id)))
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
                }
                setWorkspaceBgCtxMenu(null)
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
                label: 'Rename…',
                divider: false,
                onClick: () => {
                  const newName = prompt('Workspace name:', ws.name)
                  if (newName && newName.trim()) renameWorkspace(ws.id, newName.trim())
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
                onClick: () => deleteWorkspace(ws.id),
              },
            ]}
          />
        )
      })()}
    </div>
  )
}
