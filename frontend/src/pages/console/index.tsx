import { useState, useCallback } from 'react'
import WorkspaceGrid from './WorkspaceGrid'
import PaneConfigModal from './PaneConfigModal'
import type { WorkspaceLayout, PaneConfig, LayoutPreset } from './types'
import { uuidv4 } from '../../lib/uuid'

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'io-console-workspaces'

function loadWorkspaces(): WorkspaceLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WorkspaceLayout[]
  } catch {
    return []
  }
}

function saveWorkspaces(workspaces: WorkspaceLayout[]): void {
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
    case '1x1': return 1
    case '2x1': return 2
    case '1x2': return 2
    case '2x2': return 4
    case '3x1': return 3
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
  { value: '1x1', label: '1×1' },
  { value: '2x1', label: '2×1' },
  { value: '1x2', label: '1×2' },
  { value: '2x2', label: '2×2' },
  { value: '3x1', label: '3×1' },
  { value: '2x1+1', label: '2+1' },
]

// ---------------------------------------------------------------------------
// ConsolePage
// ---------------------------------------------------------------------------

export default function ConsolePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceLayout[]>(() => loadWorkspaces())
  const [activeId, setActiveId] = useState<string | null>(
    () => loadWorkspaces()[0]?.id ?? null,
  )
  const [editMode, setEditMode] = useState(false)
  const [configuringPaneId, setConfiguringPaneId] = useState<string | null>(null)

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null

  const persist = (updated: WorkspaceLayout[]) => {
    setWorkspaces(updated)
    saveWorkspaces(updated)
  }

  // ---- Workspace management -----------------------------------------------

  const createWorkspace = () => {
    const name = `Workspace ${workspaces.length + 1}`
    const ws = makeNewWorkspace(name)
    const updated = [...workspaces, ws]
    persist(updated)
    setActiveId(ws.id)
    setEditMode(true)
  }

  const deleteActiveWorkspace = () => {
    if (!activeId) return
    const updated = workspaces.filter((w) => w.id !== activeId)
    persist(updated)
    setActiveId(updated[0]?.id ?? null)
  }

  const renameWorkspace = (id: string, name: string) => {
    const updated = workspaces.map((w) => (w.id === id ? { ...w, name } : w))
    persist(updated)
  }

  const changeLayout = (layout: LayoutPreset) => {
    if (!activeId) return
    const updated = workspaces.map((w) => {
      if (w.id !== activeId) return w
      const needed = layoutPaneCount(layout)
      const existing = w.panes.slice(0, needed)
      const extra = makeBlankPanes(Math.max(0, needed - existing.length))
      return { ...w, layout, panes: [...existing, ...extra] }
    })
    persist(updated)
  }

  const saveEdit = () => setEditMode(false)

  // ---- Pane management ----------------------------------------------------

  const handleConfigurePane = useCallback((paneId: string) => {
    setConfiguringPaneId(paneId)
  }, [])

  const handleRemovePane = useCallback((paneId: string) => {
    if (!activeId) return
    setWorkspaces((prev) => {
      const updated = prev.map((w) => {
        if (w.id !== activeId) return w
        const panes = w.panes.map((p) =>
          p.id === paneId ? { id: uuidv4(), type: 'blank' as const } : p,
        )
        return { ...w, panes }
      })
      saveWorkspaces(updated)
      return updated
    })
  }, [activeId])

  const handleGraphicSelected = useCallback(
    (paneId: string, graphicId: string) => {
      if (!activeId) return
      setWorkspaces((prev) => {
        const updated = prev.map((w) => {
          if (w.id !== activeId) return w
          const panes = w.panes.map((p) =>
            p.id === paneId ? { ...p, type: 'graphic' as const, graphicId } : p,
          )
          return { ...w, panes }
        })
        saveWorkspaces(updated)
        return updated
      })
    },
    [activeId],
  )

  const handleSavePane = (updated: PaneConfig) => {
    if (!activeId) return
    setWorkspaces((prev) => {
      const next = prev.map((w) => {
        if (w.id !== activeId) return w
        const panes = w.panes.map((p) => (p.id === updated.id ? updated : p))
        return { ...w, panes }
      })
      saveWorkspaces(next)
      return next
    })
    setConfiguringPaneId(null)
  }

  // ---- Configuring pane object --------------------------------------------

  const configuringPane = configuringPaneId
    ? activeWorkspace?.panes.find((p) => p.id === configuringPaneId) ?? null
    : null

  // ---- Render -------------------------------------------------------------

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
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
            onConfigurePane={handleConfigurePane}
            onRemovePane={handleRemovePane}
            onGraphicSelected={handleGraphicSelected}
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
      </div>

      {/* Pane config modal */}
      {configuringPane && (
        <PaneConfigModal
          pane={configuringPane}
          onSave={handleSavePane}
          onClose={() => setConfiguringPaneId(null)}
        />
      )}
    </div>
  )
}
