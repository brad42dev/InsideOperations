import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { graphicsApi } from '../../api/graphics'
import type { GraphicBindings } from '../../shared/types/graphics'
import type { DesignerState, DesignerMode, DrawingTool } from './types'
import DesignerCanvas from './DesignerCanvas'
import Toolbar from './panels/Toolbar'
import SymbolLibrary from './panels/SymbolLibrary'
import PropertyPanel from './panels/PropertyPanel'

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------
const IDB_NAME = 'io-designer'
const IDB_STORE = 'drafts'
const IDB_VERSION = 1

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
}

async function idbGet(key: string): Promise<string | undefined> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as string | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const req = tx.objectStore(IDB_STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------
const DEFAULT_STATE: DesignerState = {
  mode: 'graphic',
  activeTool: 'select',
  selectedElementIds: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  isDirty: false,
  documentId: null,
  documentName: 'Untitled Graphic',
  gridEnabled: true,
  gridSize: 20,
  snapEnabled: true,
  undoStack: [],
  redoStack: [],
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '0 12px',
  height: '48px',
  background: 'var(--io-surface-elevated)',
  borderBottom: '1px solid var(--io-border)',
  flexShrink: 0,
}

const modeBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  fontSize: '12px',
  fontWeight: active ? 600 : 400,
  background: active ? 'var(--io-accent-subtle)' : 'transparent',
  border: active ? '1px solid var(--io-accent)' : '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: active ? 'var(--io-accent)' : 'var(--io-text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.1s',
})

const titleInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '14px',
  fontWeight: 500,
  padding: '4px 8px',
  outline: 'none',
  minWidth: '160px',
  maxWidth: '300px',
}

const saveBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--io-accent)',
  color: '#09090b',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
}

const publishBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '12px',
  cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// Recovery dialog
// ---------------------------------------------------------------------------
function RecoveryDialog({
  onRecover,
  onDiscard,
}: {
  onRecover: () => void
  onDiscard: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '24px',
          maxWidth: '380px',
          width: '90%',
        }}
      >
        <div
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--io-text-primary)',
            marginBottom: '8px',
          }}
        >
          Unsaved Draft Found
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--io-text-secondary)',
            marginBottom: '20px',
          }}
        >
          An unsaved draft was found from a previous session. Would you like to recover it?
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onDiscard} style={publishBtnStyle}>
            Discard
          </button>
          <button onClick={onRecover} style={saveBtnStyle}>
            Recover Draft
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Designer page
// ---------------------------------------------------------------------------
export default function DesignerPage() {
  const { id: graphicId } = useParams<{ id: string }>()

  // Load existing graphic when opened by ID
  const { data: existingGraphic, isLoading: isLoadingGraphic } = useQuery({
    queryKey: ['graphic-edit', graphicId],
    queryFn: async () => {
      if (!graphicId || graphicId === 'new') return null
      const r = await graphicsApi.get(graphicId)
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
    enabled: !!graphicId && graphicId !== 'new',
    staleTime: Infinity,
  })

  const [state, setState] = useState<DesignerState>(DEFAULT_STATE)
  const [bindings, setBindings] = useState<GraphicBindings>({})
  const existingGraphicLoadedRef = useRef(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draftXml, setDraftXml] = useState<string | null>(null)
  const [showRecovery, setShowRecovery] = useState(false)

  const getContentRef = useRef<(() => string) | null>(null)
  const svgElRef = useRef<SVGSVGElement | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSavedUndoRef = useRef<number>(0)

  const idbKey = `io-designer-draft-${state.documentId ?? 'new'}`

  // Check for draft on mount
  useEffect(() => {
    idbGet(idbKey).then((draft) => {
      if (draft) {
        setDraftXml(draft)
        setShowRecovery(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save every 60s when dirty
  useEffect(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setInterval(() => {
      if (state.isDirty && getContentRef.current) {
        const xml = getContentRef.current()
        idbSet(idbKey, xml)
      }
    }, 60_000)
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current)
    }
  }, [state.isDirty, idbKey])

  // Sync loaded graphic data into state (runs once when existingGraphic arrives)
  useEffect(() => {
    if (!existingGraphic || existingGraphicLoadedRef.current) return
    existingGraphicLoadedRef.current = true
    setState((prev) => ({
      ...prev,
      documentId: existingGraphic.id,
      documentName: existingGraphic.name,
      isDirty: false,
    }))
    if (existingGraphic.bindings) {
      setBindings(existingGraphic.bindings)
    }
  }, [existingGraphic])

  // Ctrl+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const pushUndo = useCallback(
    (xml: string) => {
      setState((prev) => {
        const stack = [...prev.undoStack, xml].slice(-20)
        return { ...prev, undoStack: stack, redoStack: [], isDirty: true }
      })
    },
    [],
  )

  const handleContentChange = useCallback(
    (xml: string) => {
      pushUndo(xml)
    },
    [pushUndo],
  )

  const handleSelectionChange = useCallback((ids: string[]) => {
    setState((prev) => ({ ...prev, selectedElementIds: ids }))
  }, [])

  const handleStateChange = useCallback((partial: Partial<DesignerState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleSave = async () => {
    if (isSaving || !getContentRef.current) return
    setIsSaving(true)
    try {
      const svgData = getContentRef.current()
      if (state.documentId) {
        await graphicsApi.update(state.documentId, {
          name: state.documentName,
          svg_data: svgData,
          bindings,
        })
      } else {
        const result = await graphicsApi.create({
          name: state.documentName,
          type: 'graphic',
          svg_data: svgData,
          bindings,
        })
        if (result.success) {
          setState((prev) => ({ ...prev, documentId: result.data.id, isDirty: false }))
          await idbDelete(`io-designer-draft-new`)
          return
        }
      }
      setState((prev) => ({ ...prev, isDirty: false }))
      await idbDelete(idbKey)
    } finally {
      setIsSaving(false)
    }
  }

  const handleModeChange = (mode: DesignerMode) => {
    setState((prev) => ({ ...prev, mode }))
  }

  const handleToolChange = (tool: DrawingTool) => {
    setState((prev) => ({ ...prev, activeTool: tool }))
  }

  const handleZoomIn = () =>
    setState((prev) => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }))
  const handleZoomOut = () =>
    setState((prev) => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }))
  const handleZoomFit = () =>
    setState((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 }))

  const handleRecoverDraft = () => {
    setShowRecovery(false)
    // Draft will be loaded when canvas mounts and calls getContentRef
    // For now just set dirty flag
    setState((prev) => ({ ...prev, isDirty: true }))
    setDraftXml(null)
  }

  const handleDiscardDraft = async () => {
    setShowRecovery(false)
    setDraftXml(null)
    await idbDelete(idbKey)
  }

  const modes: { id: DesignerMode; label: string }[] = [
    { id: 'graphic', label: 'Graphic' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'report', label: 'Report' },
  ]

  // Suppress unused draft xml warning
  void draftXml
  void lastSavedUndoRef

  if (isLoadingGraphic) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '13px',
          background: 'var(--io-surface-primary)',
        }}
      >
        Loading graphic…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--io-surface-primary)',
      }}
    >
      {showRecovery && (
        <RecoveryDialog onRecover={handleRecoverDraft} onDiscard={handleDiscardDraft} />
      )}

      {/* Header */}
      <div style={headerStyle}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {modes.map(({ id, label }) => (
            <button
              key={id}
              style={modeBtnStyle(state.mode === id)}
              onClick={() => handleModeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Document name */}
        <input
          value={state.documentName}
          onChange={(e) =>
            setState((prev) => ({ ...prev, documentName: e.target.value, isDirty: true }))
          }
          style={{
            ...titleInputStyle,
            borderColor: state.isDirty ? 'var(--io-border)' : 'transparent',
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = 'var(--io-accent)')
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = state.isDirty ? 'var(--io-border)' : 'transparent')
          }
        />

        {state.isDirty && (
          <span
            style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginLeft: '4px' }}
          >
            ●
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <button onClick={handleSave} disabled={isSaving} style={saveBtnStyle}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={async () => {
            await handleSave()
          }}
          disabled={isSaving}
          style={publishBtnStyle}
        >
          Publish
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Symbol library */}
        <SymbolLibrary
          mode={state.mode}
          onSymbolDrop={() => {
            // Canvas handles drop events directly
          }}
        />

        {/* Center: toolbar + canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Toolbar
            activeTool={state.activeTool}
            onToolChange={handleToolChange}
            gridEnabled={state.gridEnabled}
            onGridToggle={() =>
              setState((prev) => ({ ...prev, gridEnabled: !prev.gridEnabled }))
            }
            snapEnabled={state.snapEnabled}
            onSnapToggle={() =>
              setState((prev) => ({ ...prev, snapEnabled: !prev.snapEnabled }))
            }
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomFit={handleZoomFit}
            zoom={state.zoom}
          />

          <DesignerCanvas
            mode={state.mode}
            activeTool={state.activeTool}
            gridEnabled={state.gridEnabled}
            gridSize={state.gridSize}
            snapEnabled={state.snapEnabled}
            zoom={state.zoom}
            panX={state.panX}
            panY={state.panY}
            onSelectionChange={handleSelectionChange}
            onStateChange={handleStateChange}
            onContentChange={handleContentChange}
            getContentRef={getContentRef}
            initialSvg={existingGraphic?.svg_data ?? null}
          />
        </div>

        {/* Property panel */}
        <PropertyPanel
          selectedIds={state.selectedElementIds}
          svgRef={svgElRef}
          bindings={bindings}
          onBindingsChange={setBindings}
          mode={state.mode}
        />
      </div>
    </div>
  )
}
