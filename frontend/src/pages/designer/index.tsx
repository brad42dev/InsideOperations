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
import { useParams, useNavigate } from 'react-router-dom'
import { useSceneStore, useHistoryStore } from '../../store/designer'
import { graphicsApi } from '../../api/graphics'
import { pointsApi } from '../../api/points'
import type { SceneNode, DisplayElement, SymbolInstance } from '../../shared/types/graphics'
import { wsManager } from '../../shared/hooks/useWebSocket'
import { useDesignerPermissions } from '../../shared/hooks/usePermission'
import DesignerToolbar from './DesignerToolbar'
import DesignerModeTabs from './DesignerModeTabs'
import DesignerStatusBar from './DesignerStatusBar'
import DesignerLeftPalette from './DesignerLeftPalette'
import DesignerRightPanel from './DesignerRightPanel'
import DesignerCanvas from './DesignerCanvas'
import { SceneRenderer } from '../../shared/graphics/SceneRenderer'
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
  const navigate = useNavigate()
  const isNew = !graphicId || graphicId === 'new'

  // Store actions
  const loadGraphic   = useSceneStore(s => s.loadGraphic)
  const newDocument   = useSceneStore(s => s.newDocument)
  const markClean     = useSceneStore(s => s.markClean)
  const historyMarkClean = useHistoryStore(s => s.markClean)
  const historyClear  = useHistoryStore(s => s.clear)

  const graphicIdInStore = useSceneStore(s => s.graphicId)
  const doc = useSceneStore(s => s.doc)
  const { canPublish } = useDesignerPermissions()

  // Panel widths
  const [leftWidth, setLeftWidth]   = useState(240)
  const [rightWidth, setRightWidth] = useState(300)
  const [leftCollapsed, setLeftCollapsed]   = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Load/save state
  const [loading, setLoading]   = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Pessimistic lock state — non-null means WE do NOT hold the lock
  const [lockState, setLockState] = useState<{ lockedByName: string; lockedAt: string } | null>(null)
  const lockHeldRef = useRef(false) // true when this session holds the lock

  // New doc dialog
  const [showNewDialog, setShowNewDialog] = useState(false)

  // Crash recovery — includes the saved doc so Recover action can load it
  const [crashRecovery, setCrashRecovery] = useState<{ id: string; savedAt: number; savedDoc: unknown } | null>(null)
  const [showCrashPreview, setShowCrashPreview] = useState(false)

  // Dialogs
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showValidateBindings, setShowValidateBindings] = useState(false)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  // Validate bindings results
  const [bindingValidation, setBindingValidation] = useState<{
    unresolvedBindings: { elementId: string; tag: string; reason: string }[]
    totalBound: number
    resolvedCount: number
  }>({ unresolvedBindings: [], totalBound: 0, resolvedCount: 0 })

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

      // Try to acquire the pessimistic edit lock
      const lockResp = await graphicsApi.acquireLock(gid).catch(() => null)
      if (lockResp?.success) {
        if (lockResp.data.data.acquired) {
          lockHeldRef.current = true
          setLockState(null)
        } else {
          // Lock held by another user — open read-only
          lockHeldRef.current = false
          setLockState({
            lockedByName: lockResp.data.data.locked_by_name ?? 'another user',
            lockedAt: lockResp.data.data.locked_at ?? new Date().toISOString(),
          })
        }
      } else if (record.locked_by && record.locked_by_name) {
        // Fallback: use info from the GET response
        lockHeldRef.current = false
        setLockState({
          lockedByName: record.locked_by_name,
          lockedAt: record.locked_at ?? new Date().toISOString(),
        })
      } else {
        lockHeldRef.current = true
      }
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

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (lockHeldRef.current && graphicId && graphicId !== 'new') {
        graphicsApi.releaseLock(graphicId).catch(() => {/* best-effort */})
        lockHeldRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId])

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    const currentDoc = useSceneStore.getState().doc
    const currentId  = useSceneStore.getState().graphicId
    if (!currentDoc || isSaving || lockHeldRef.current === false) return

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
      // Re-acquire lock after save to confirm we still hold it (release + re-acquire cycle)
      const gid = useSceneStore.getState().graphicId
      if (gid && lockHeldRef.current) {
        graphicsApi.releaseLock(gid).catch(() => {/* best-effort */})
        const relock = await graphicsApi.acquireLock(gid).catch(() => null)
        if (relock?.success && relock.data.data.acquired) {
          lockHeldRef.current = true
        }
      }
    } catch (err) {
      console.error('[DesignerPage] Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, markClean, historyMarkClean, loadGraphic])

  // -------------------------------------------------------------------------
  // Publish — create permanent version snapshot
  // -------------------------------------------------------------------------

  const handlePublish = useCallback(async () => {
    const currentId = useSceneStore.getState().graphicId
    if (!currentId || isPublishing || lockHeldRef.current === false) return
    if (!window.confirm('Publish this graphic? This creates a permanent, immutable snapshot that cannot be deleted.')) return

    setIsPublishing(true)
    try {
      // Save first to ensure the snapshot captures the latest content
      await handleSave()
      const result = await graphicsApi.publishGraphic(currentId)
      if (result.success) {
        // Show brief success indication via the version history panel
        setShowVersionHistory(true)
      } else {
        console.error('[DesignerPage] Publish failed:', (result as { error: { message: string } }).error?.message)
      }
    } catch (err) {
      console.error('[DesignerPage] Publish failed:', err)
    } finally {
      setIsPublishing(false)
    }
  }, [isPublishing, handleSave])

  // -------------------------------------------------------------------------
  // Version history — preview and restore
  // -------------------------------------------------------------------------

  const handlePreviewVersion = useCallback((_versionId: string, doc: import('../../shared/types/graphics').GraphicDocument) => {
    // Load the version content into the scene for preview (non-destructive — user can still close without saving)
    loadGraphic(useSceneStore.getState().graphicId ?? '', doc)
  }, [loadGraphic])

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    const currentId = useSceneStore.getState().graphicId
    if (!currentId) return
    // Restore creates a new draft server-side; reload the graphic to show the restored content
    const result = await graphicsApi.restoreVersion(currentId, versionId).catch(() => null)
    if (result?.success) {
      const fresh = await graphicsApi.get(currentId).catch(() => null)
      if (fresh?.success && fresh.data.data.scene_data) {
        loadGraphic(currentId, fresh.data.data.scene_data)
      }
    }
  }, [loadGraphic])

  // -------------------------------------------------------------------------
  // Validate bindings — scan scene graph, check point resolution
  // -------------------------------------------------------------------------

  const handleValidateBindings = useCallback(async () => {
    const currentDoc = useSceneStore.getState().doc
    if (!currentDoc) { setShowValidateBindings(true); return }

    // Collect all point IDs from the scene graph
    type BindingEntry = { elementId: string; pointId: string; elementName: string }
    const bindings: BindingEntry[] = []

    function walk(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === 'display_element') {
          const de = n as DisplayElement
          if (de.binding.pointId) {
            bindings.push({ elementId: de.id, pointId: de.binding.pointId, elementName: de.name ?? de.id })
          }
        }
        if (n.type === 'symbol_instance') {
          const si = n as SymbolInstance
          if (si.stateBinding?.pointId) {
            bindings.push({ elementId: si.id, pointId: si.stateBinding.pointId, elementName: si.name ?? si.id })
          }
          if (si.children) walk(si.children as SceneNode[])
        }
        if ('children' in n && Array.isArray(n.children)) {
          walk(n.children as SceneNode[])
        }
      }
    }
    walk(currentDoc.children)

    if (bindings.length === 0) {
      setBindingValidation({ unresolvedBindings: [], totalBound: 0, resolvedCount: 0 })
      setShowValidateBindings(true)
      return
    }

    // Check unique point IDs in batch via search
    const uniqueIds = [...new Set(bindings.map(b => b.pointId))]
    const resolvedIds = new Set<string>()

    await Promise.all(uniqueIds.map(async (pid) => {
      const result = await pointsApi.list({ search: pid, limit: 5 }).catch(() => null)
      if (result?.success) {
        const exact = result.data.data.find(p => p.id === pid || p.tagname === pid)
        if (exact) resolvedIds.add(pid)
      }
    }))

    const unresolvedBindings = bindings
      .filter(b => !resolvedIds.has(b.pointId))
      .map(b => ({ elementId: b.elementName || b.elementId, tag: b.pointId, reason: 'Not found' }))

    setBindingValidation({
      unresolvedBindings,
      totalBound: bindings.length,
      resolvedCount: bindings.filter(b => resolvedIds.has(b.pointId)).length,
    })
    setShowValidateBindings(true)
  }, [])

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
            setCrashRecovery({ id: key, savedAt, savedDoc })
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
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 2100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            padding: '24px 28px',
            maxWidth: 460,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--io-text-primary)' }}>
              Recover Unsaved Changes?
            </div>
            <div style={{ fontSize: 13, color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
              Auto-saved changes were found from{' '}
              <strong>{new Date(crashRecovery.savedAt).toLocaleTimeString()}</strong>{' '}
              ({new Date(crashRecovery.savedAt).toLocaleDateString()}).
              Would you like to recover them?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCrashPreview(true)}
                style={{ padding: '6px 14px', fontSize: 12, background: 'transparent', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-secondary)', cursor: 'pointer' }}
              >
                Preview
              </button>
              <button
                onClick={() => {
                  // Discard — delete the auto-save from IndexedDB and load normally
                  const STORE = 'designer-autosave'
                  const openReq = indexedDB.open('io-designer', 1)
                  openReq.onsuccess = () => {
                    try {
                      const db = openReq.result
                      const tx = db.transaction(STORE, 'readwrite')
                      tx.objectStore(STORE).delete(crashRecovery.id)
                      db.close()
                    } catch { /* best-effort */ }
                  }
                  setCrashRecovery(null)
                }}
                style={{ padding: '6px 14px', fontSize: 12, background: 'transparent', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-secondary)', cursor: 'pointer' }}
              >
                Discard
              </button>
              <button
                onClick={() => {
                  // Recover — load the auto-saved doc into the editor
                  if (crashRecovery.savedDoc) {
                    try {
                      const savedSceneGraph = crashRecovery.savedDoc
                      if (graphicId) {
                        loadGraphic(graphicId, savedSceneGraph as Parameters<typeof loadGraphic>[1])
                      }
                    } catch { /* ignore parse errors */ }
                    // Delete auto-save after recovery
                    const STORE = 'designer-autosave'
                    const openReq = indexedDB.open('io-designer', 1)
                    openReq.onsuccess = () => {
                      try {
                        const db = openReq.result
                        const tx = db.transaction(STORE, 'readwrite')
                        tx.objectStore(STORE).delete(crashRecovery.id)
                        db.close()
                      } catch { /* best-effort */ }
                    }
                  }
                  setCrashRecovery(null)
                }}
                style={{ padding: '6px 14px', fontSize: 12, background: 'var(--io-accent)', border: 'none', borderRadius: 'var(--io-radius)', color: '#000', cursor: 'pointer', fontWeight: 600 }}
              >
                Recover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crash recovery split-view preview overlay (spec §18 [Preview]) */}
      {crashRecovery && showCrashPreview && (() => {
        const currentDoc = useSceneStore.getState().doc
        const savedDoc = crashRecovery.savedDoc as import('../../shared/types/graphics').GraphicDocument | null
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 2200,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '10px 16px', background: 'var(--io-surface)', borderBottom: '1px solid var(--io-border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--io-text-primary)' }}>
                Preview: Compare Versions
              </span>
              <span style={{ fontSize: 12, color: 'var(--io-text-secondary)' }}>
                Left: Current server version — Right: Auto-saved {new Date(crashRecovery.savedAt).toLocaleTimeString()}
              </span>
              <button
                onClick={() => setShowCrashPreview(false)}
                style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 12, background: 'transparent', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-secondary)', cursor: 'pointer' }}
              >
                Close Preview
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, borderRight: '2px solid var(--io-border)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, fontWeight: 600, color: 'var(--io-text-secondary)', background: 'var(--io-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--io-border)' }}>Server version</div>
                {currentDoc && <SceneRenderer document={currentDoc} />}
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, fontWeight: 600, color: 'var(--io-accent)', background: 'var(--io-surface)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--io-accent)', zIndex: 1 }}>Auto-saved version</div>
                {savedDoc && <SceneRenderer document={savedDoc} />}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Pessimistic lock banner — shown when the graphic is locked by someone else */}
      {lockState && (
        <div style={{
          background: '#7c3aed22',
          borderBottom: '1px solid #7c3aed55',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
          color: 'var(--io-text-primary)',
          flexShrink: 0,
        }}>
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>Read-only</span>
          <span style={{ color: 'var(--io-text-muted)' }}>
            Locked by <strong style={{ color: 'var(--io-text-primary)' }}>{lockState.lockedByName}</strong> since{' '}
            {new Date(lockState.lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                // Fork: Save As — create a copy the current user can edit
                const currentDoc = useSceneStore.getState().doc
                if (!currentDoc) return
                const copyName = `${currentDoc.name ?? 'Untitled'} (copy)`
                const resp = await graphicsApi.create({ name: copyName, scene_data: currentDoc }).catch(() => null)
                if (resp?.success) {
                  navigate(`/designer/graphics/${resp.data.data.id}/edit`)
                }
              }}
              style={{
                padding: '3px 10px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Fork (Save As)
            </button>
          </div>
        </div>
      )}

      {/* Version history dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        graphicId={graphicId ?? null}
        onPreview={handlePreviewVersion}
        onRestore={handleRestoreVersion}
      />

      {/* Validate bindings dialog */}
      <ValidateBindingsDialog
        open={showValidateBindings}
        onClose={() => setShowValidateBindings(false)}
        unresolvedBindings={bindingValidation.unresolvedBindings}
        totalBound={bindingValidation.totalBound}
        resolvedCount={bindingValidation.resolvedCount}
      />

      {/* Import wizard */}
      {showImportWizard && (
        <IographicImportWizard
          onClose={() => setShowImportWizard(false)}
          onImported={(result) => {
            setShowImportWizard(false)
            // Navigate to the first imported graphic so it can be edited
            if (result.graphic_ids.length > 0) {
              navigate(`/designer/graphics/${result.graphic_ids[0]}/edit`)
            }
          }}
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
        onValidateBindings={handleValidateBindings}
        onImport={() => setShowImportWizard(true)}
        onExport={() => setShowExportDialog(true)}
        onNew={() => setShowNewDialog(true)}
        onOpen={() => navigate('/designer/graphics')}
      />

      {/* Toolbar */}
      <DesignerToolbar
        onSave={handleSave}
        isSaving={isSaving}
        onPublish={canPublish ? handlePublish : undefined}
        isPublishing={isPublishing}
        onShowVersionHistory={() => setShowVersionHistory(true)}
        onValidateBindings={handleValidateBindings}
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
        onValidateBindings={handleValidateBindings}
      />
    </div>
  )
}
