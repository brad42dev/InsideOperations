/**
 * Designer page — main orchestrator.
 *
 * Route: /designer/graphics/:graphicId/edit  (edit existing)
 *        /designer/graphics/new              (create new)
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  DesignerToolbar (44px)                             │
 *   ├──────────┬──────────────────────────────────────────┤
 *   │  Left    │  DesignerCanvas (flex 1)                 │ Right
 *   │  Palette │                                          │ Panel
 *   │  240px   │                                          │ 300px
 *   └──────────┴──────────────────────────────────────────┘
 *
 * State management: Zustand (sceneStore, historyStore, uiStore)
 * API: graphicsApi from ../../api/graphics
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSceneStore, useHistoryStore } from '../../store/designer'
import { graphicsApi } from '../../api/graphics'
import { wsManager } from '../../shared/hooks/useWebSocket'
import DesignerToolbar from './DesignerToolbar'
import DesignerModeTabs from './DesignerModeTabs'
import DesignerStatusBar from './DesignerStatusBar'
import DesignerLeftPalette from './DesignerLeftPalette'
import DesignerRightPanel from './DesignerRightPanel'
import DesignerCanvas from './DesignerCanvas'
import VersionHistoryDialog from './components/VersionHistoryDialog'
import ValidateBindingsDialog from './components/ValidateBindingsDialog'
import IographicImportWizard from './components/IographicImportWizard'
import IographicExportDialog from './components/IographicExportDialog'

// ---------------------------------------------------------------------------
// New Graphic dialog
// ---------------------------------------------------------------------------

interface NewGraphicDialogProps {
  onConfirm: (name: string, mode: 'graphic' | 'dashboard' | 'report') => void
  onCancel: () => void
}

function NewGraphicDialog({ onConfirm, onCancel }: NewGraphicDialogProps) {
  const [name, setName] = useState('Untitled Graphic')
  const [mode, setMode] = useState<'graphic' | 'dashboard' | 'report'>('graphic')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed, mode)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: 24,
          width: 380,
          maxWidth: '90%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--io-text-primary)' }}>
          New Graphic
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '6px 8px',
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Type
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['graphic', 'dashboard', 'report'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  background: mode === m ? 'var(--io-accent)' : 'var(--io-surface)',
                  color: mode === m ? '#09090b' : 'var(--io-text-secondary)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  fontSize: 12,
                  fontWeight: mode === m ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              color: 'var(--io-text-secondary)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              padding: '6px 14px',
              background: name.trim() ? 'var(--io-accent)' : 'var(--io-surface-elevated)',
              color: name.trim() ? '#09090b' : 'var(--io-text-muted)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              fontSize: 12,
              fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resizable divider
// ---------------------------------------------------------------------------

interface DividerProps {
  onDrag: (dx: number) => void
}

function VerticalDivider({ onDrag }: DividerProps) {
  const startX = useRef(0)
  const active = useRef(false)

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    active.current = true
    startX.current = e.clientX

    const onMove = (ev: MouseEvent) => {
      if (!active.current) return
      const dx = ev.clientX - startX.current
      startX.current = ev.clientX
      onDrag(dx)
    }
    const onUp = () => {
      active.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 4,
        cursor: 'col-resize',
        flexShrink: 0,
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--io-accent)'; e.currentTarget.style.opacity = '0.4' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0b',
      color: 'var(--io-text-muted)',
      fontSize: 13,
    }}>
      Loading graphic…
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0b',
      gap: 12,
    }}>
      <div style={{ color: '#ef4444', fontSize: 14 }}>Failed to load graphic</div>
      <div style={{ color: 'var(--io-text-muted)', fontSize: 12 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          padding: '6px 16px',
          background: 'var(--io-accent)',
          color: '#09090b',
          border: 'none',
          borderRadius: 'var(--io-radius)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DesignerPage() {
  const { graphicId } = useParams<{ graphicId?: string }>()
  const isNew = !graphicId || graphicId === 'new'

  // Store actions
  const loadGraphic   = useSceneStore(s => s.loadGraphic)
  const newDocument   = useSceneStore(s => s.newDocument)
  const markClean     = useSceneStore(s => s.markClean)
  const historyMarkClean = useHistoryStore(s => s.markClean)
  const historyClear  = useHistoryStore(s => s.clear)

  const graphicIdInStore = useSceneStore(s => s.graphicId)
  const doc = useSceneStore(s => s.doc)

  // Panel widths
  const [leftWidth, setLeftWidth]   = useState(240)
  const [rightWidth, setRightWidth] = useState(300)
  const [leftCollapsed, setLeftCollapsed]   = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Load/save state
  const [loading, setLoading]   = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // New doc dialog
  const [showNewDialog, setShowNewDialog] = useState(false)

  // Crash recovery
  const [crashRecovery, setCrashRecovery] = useState<{ id: string; savedAt: number } | null>(null)

  // Dialogs
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showValidateBindings, setShowValidateBindings] = useState(false)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  // Auto-save timestamp (updated whenever IndexedDB auto-save fires)
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null)

  // WebSocket connection state for status bar
  const [wsConnected, setWsConnected] = useState(wsManager.getState() === 'connected')
  useEffect(() => {
    return wsManager.onStateChange(s => setWsConnected(s === 'connected'))
  }, [])

  // -------------------------------------------------------------------------
  // Load graphic on mount
  // -------------------------------------------------------------------------

  const loadDoc = useCallback(async () => {
    if (isNew) {
      setShowNewDialog(true)
      return
    }
    if (!graphicId) return
    // Already loaded
    if (graphicIdInStore === graphicId && doc) return

    const gid: string = graphicId

    setLoading(true)
    setLoadError(null)
    try {
      const resp = await graphicsApi.get(gid)
      if (!resp.success) {
        setLoadError(resp.error.message)
        return
      }
      const record = resp.data.data
      loadGraphic(record.id, record.scene_data)
      historyClear()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [graphicId, isNew, graphicIdInStore, doc, loadGraphic, historyClear])

  useEffect(() => {
    loadDoc()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId])

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    const currentDoc = useSceneStore.getState().doc
    const currentId  = useSceneStore.getState().graphicId
    if (!currentDoc || isSaving) return

    setIsSaving(true)
    try {
      const docName = currentDoc.name ?? 'Untitled'
      if (currentId) {
        // Update existing
        const result = await graphicsApi.update(currentId, {
          name: docName,
          scene_data: currentDoc,
        })
        if (!result.success) {
          console.error('[DesignerPage] Update failed:', result.error.message)
          return
        }
      } else {
        // Create new
        const resp = await graphicsApi.create({
          name: docName,
          scene_data: currentDoc,
        })
        if (!resp.success) {
          console.error('[DesignerPage] Create failed:', resp.error.message)
          return
        }
        // Update graphicId in store via loadGraphic (sets graphicId in scene state)
        loadGraphic(resp.data.data.id, currentDoc)
      }
      markClean()
      historyMarkClean()
    } catch (err) {
      console.error('[DesignerPage] Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, markClean, historyMarkClean, loadGraphic])

  // -------------------------------------------------------------------------
  // Ctrl+S global save
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  // -------------------------------------------------------------------------
  // Auto-save to IndexedDB (every 60s when dirty)
  // -------------------------------------------------------------------------

  const isDirty = useSceneStore(s => s.isDirty)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.indexedDB) return

    const STORE = 'designer-autosave'
    const DB_NAME = 'io-designer'
    const DB_VERSION = 1

    // Open/upgrade IndexedDB
    const openReq = indexedDB.open(DB_NAME, DB_VERSION)
    openReq.onupgradeneeded = () => {
      openReq.result.createObjectStore(STORE)
    }

    let db: IDBDatabase | null = null
    openReq.onsuccess = () => {
      db = openReq.result

      // Check for crash recovery on first open
      const key = graphicId ?? '__new__'
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => {
        if (req.result) {
          const { doc: savedDoc, savedAt } = req.result as { doc: unknown; savedAt: number }
          // Only offer recovery if there's something meaningful
          if (savedDoc && !doc && !isNew) {
            setCrashRecovery({ id: key, savedAt })
          }
        }
      }
    }

    const interval = setInterval(() => {
      if (!isDirty || !db) return
      const currentDoc = useSceneStore.getState().doc
      if (!currentDoc) return
      const key = graphicId ?? '__new__'
      try {
        const now = Date.now()
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put({ doc: currentDoc, savedAt: now }, key)
        setLastAutoSave(now)
      } catch {
        // Silently ignore IDB errors
      }
    }, 60_000)

    return () => {
      clearInterval(interval)
      if (db) db.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId, isNew])

  // -------------------------------------------------------------------------
  // New graphic dialog confirm
  // -------------------------------------------------------------------------

  function handleNewConfirm(name: string, mode: 'graphic' | 'dashboard' | 'report') {
    newDocument(mode, name)
    historyClear()
    setShowNewDialog(false)
  }

  function handleNewCancel() {
    setShowNewDialog(false)
    // Navigate back (no-op if no router history)
    if (typeof window !== 'undefined') window.history.back()
  }

  // -------------------------------------------------------------------------
  // Panel resize handlers
  // -------------------------------------------------------------------------

  const handleLeftDividerDrag = useCallback((dx: number) => {
    setLeftWidth(w => Math.max(160, Math.min(480, w + dx)))
  }, [])

  const handleRightDividerDrag = useCallback((dx: number) => {
    setRightWidth(w => Math.max(200, Math.min(520, w - dx)))
  }, [])

  // -------------------------------------------------------------------------
  // Collapse toggle buttons
  // -------------------------------------------------------------------------

  function CollapseBtn({ side, collapsed, onToggle }: { side: 'left' | 'right'; collapsed: boolean; onToggle: () => void }) {
    const label = side === 'left'
      ? (collapsed ? '▶' : '◀')
      : (collapsed ? '◀' : '▶')
    return (
      <button
        onClick={onToggle}
        title={collapsed ? `Expand ${side} panel` : `Collapse ${side} panel`}
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          ...(side === 'left' ? { right: -10 } : { left: -10 }),
          zIndex: 20,
          width: 14,
          height: 32,
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: side === 'left' ? '0 4px 4px 0' : '4px 0 0 4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          color: 'var(--io-text-muted)',
          padding: 0,
        }}
      >
        {label}
      </button>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--io-surface-primary)',
    }}>
      {/* New graphic dialog */}
      {showNewDialog && (
        <NewGraphicDialog onConfirm={handleNewConfirm} onCancel={handleNewCancel} />
      )}

      {/* Crash recovery banner */}
      {crashRecovery && (
        <div style={{
          position: 'fixed',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13,
          color: 'var(--io-text-primary)',
        }}>
          <span>⚠ Unsaved work from {new Date(crashRecovery.savedAt).toLocaleTimeString()} was recovered.</span>
          <button
            onClick={() => {
              // Dismiss — clear the auto-save
              setCrashRecovery(null)
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: 12 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Version history dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        graphicId={graphicId ?? null}
        onPreview={() => {}}
        onRestore={() => {}}
      />

      {/* Validate bindings dialog */}
      <ValidateBindingsDialog
        open={showValidateBindings}
        onClose={() => setShowValidateBindings(false)}
        unresolvedBindings={[]}
        totalBound={0}
        resolvedCount={0}
      />

      {/* Import wizard */}
      {showImportWizard && (
        <IographicImportWizard
          onClose={() => setShowImportWizard(false)}
        />
      )}

      {/* Export dialog */}
      {showExportDialog && doc && (
        <IographicExportDialog
          graphicId={graphicIdInStore ?? ''}
          graphicName={doc.name ?? 'Untitled'}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Mode tabs */}
      <DesignerModeTabs
        onSave={handleSave}
        onShowVersionHistory={() => setShowVersionHistory(true)}
        onValidateBindings={() => setShowValidateBindings(true)}
        onImport={() => setShowImportWizard(true)}
        onExport={() => setShowExportDialog(true)}
      />

      {/* Toolbar */}
      <DesignerToolbar
        onSave={handleSave}
        isSaving={isSaving}
        onShowVersionHistory={() => setShowVersionHistory(true)}
        onValidateBindings={() => setShowValidateBindings(true)}
      />

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left palette */}
        {!leftCollapsed && (
          <div style={{ width: leftWidth, flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DesignerLeftPalette collapsed={false} width={leftWidth} />
            <CollapseBtn side="left" collapsed={false} onToggle={() => setLeftCollapsed(true)} />
          </div>
        )}

        {/* Left divider */}
        {!leftCollapsed && <VerticalDivider onDrag={handleLeftDividerDrag} />}

        {/* Collapsed left re-expand tab */}
        {leftCollapsed && (
          <button
            onClick={() => setLeftCollapsed(false)}
            title="Expand left panel"
            style={{
              width: 16,
              flexShrink: 0,
              background: 'var(--io-surface)',
              border: 'none',
              borderRight: '1px solid var(--io-border)',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ▶
          </button>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 200 }}>
          {loading && <LoadingSkeleton />}
          {loadError && <ErrorState message={loadError} onRetry={loadDoc} />}
          {!loading && !loadError && <DesignerCanvas style={{ flex: 1 }} />}
        </div>

        {/* Right divider */}
        {!rightCollapsed && <VerticalDivider onDrag={handleRightDividerDrag} />}

        {/* Collapsed right re-expand tab */}
        {rightCollapsed && (
          <button
            onClick={() => setRightCollapsed(false)}
            title="Expand right panel"
            style={{
              width: 16,
              flexShrink: 0,
              background: 'var(--io-surface)',
              border: 'none',
              borderLeft: '1px solid var(--io-border)',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ◀
          </button>
        )}

        {/* Right panel */}
        {!rightCollapsed && (
          <div style={{ width: rightWidth, flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DesignerRightPanel collapsed={false} width={rightWidth} />
            <CollapseBtn side="right" collapsed={false} onToggle={() => setRightCollapsed(true)} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <DesignerStatusBar
        wsConnected={wsConnected}
        lastAutoSave={lastAutoSave}
        onValidateBindings={() => setShowValidateBindings(true)}
      />
    </div>
  )
}
