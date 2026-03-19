import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TrendPane from './panes/TrendPane'
import PointTablePane from './panes/PointTablePane'
import AlarmListPane from './panes/AlarmListPane'
import GraphicPane from './panes/GraphicPane'
import ContextMenu from '../../shared/components/ContextMenu'
import { CONSOLE_DRAG_KEY, type ConsoleDragItem } from './ConsolePalette'
import type { PaneConfig } from './types'

export interface PaneWrapperProps {
  config: PaneConfig
  editMode: boolean
  isSelected?: boolean
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onConfigure: (paneId: string) => void
  onRemove: (paneId: string) => void
  onSelect?: (paneId: string, addToSelection: boolean) => void
  onPaletteDrop?: (paneId: string, item: ConsoleDragItem) => void
  preserveAspectRatio?: boolean
  /** Called with a deep copy of the pane config when user selects Copy */
  onCopy?: (pane: PaneConfig) => void
  /** Called when user selects Duplicate */
  onDuplicate?: (paneId: string) => void
  /** Called when user selects Zoom to Fit (graphic panes only) */
  onZoomToFit?: (paneId: string) => void
  /** Called when user selects Reset Zoom (graphic panes only) */
  onResetZoom?: (paneId: string) => void
}

const PANE_TYPE_LABELS: Record<string, string> = {
  trend: 'Trend',
  point_table: 'Point Table',
  alarm_list: 'Alarm List',
  graphic: 'Graphic',
  blank: 'Blank',
}

function PaneTypeBadge({ type }: { type: string }) {
  return (
    <span
      style={{
        padding: '1px 7px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: 'var(--io-surface-secondary)',
        color: 'var(--io-text-muted)',
        border: '1px solid var(--io-border)',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {PANE_TYPE_LABELS[type] ?? type}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Blank pane
// ---------------------------------------------------------------------------

function BlankPane({ editMode, onConfigure, paneId }: {
  editMode: boolean
  onConfigure: (id: string) => void
  paneId: string
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--io-text-muted)',
        fontSize: 13,
        background: 'var(--io-surface)',
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
      </svg>
      <span>Empty pane</span>
      {editMode && (
        <button
          onClick={() => onConfigure(paneId)}
          style={{
            background: 'var(--io-accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '7px 14px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Configure Pane
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PaneWrapper
// ---------------------------------------------------------------------------

export default function PaneWrapper({
  config,
  editMode,
  isSelected = false,
  isFullscreen = false,
  onToggleFullscreen,
  onConfigure,
  onRemove,
  onSelect,
  onPaletteDrop,
  preserveAspectRatio = true,
  onCopy,
  onDuplicate,
  onZoomToFit,
  onResetZoom,
}: PaneWrapperProps) {
  const navigate = useNavigate()
  const title = config.title ?? PANE_TYPE_LABELS[config.type] ?? config.type
  const [paneCtxMenu, setPaneCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [hovered, setHovered] = useState(false)

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(CONSOLE_DRAG_KEY)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the pane itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    setDragOver(false)
    const raw = e.dataTransfer.getData(CONSOLE_DRAG_KEY)
    if (!raw) return
    try {
      const item = JSON.parse(raw) as ConsoleDragItem
      onPaletteDrop?.(config.id, item)
    } catch {
      // ignore malformed
    }
  }

  function handlePaneClick(e: React.MouseEvent) {
    // Ignore clicks on buttons / context menus
    if ((e.target as HTMLElement).closest('button, [role="menu"]')) return
    onSelect?.(config.id, e.ctrlKey || e.metaKey || e.shiftKey)
  }

  // Fullscreen wrapper style — fixed overlay when fullscreen
  const fullscreenStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        transition: 'all 200ms ease',
      }
    : {
        height: '100%',
        transition: 'all 200ms ease',
      }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handlePaneClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => {
        // Only show pane context menu if the target is not an SVG element with a
        // data-point-id (point context menus are handled inside GraphicPane).
        const target = e.target as HTMLElement
        if (target.closest('[data-point-id]')) return
        e.preventDefault()
        e.stopPropagation()
        setPaneCtxMenu({ x: e.clientX, y: e.clientY })
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-surface)',
        border: dragOver
          ? '2px dashed var(--io-accent)'
          : isSelected
            ? '2px solid var(--io-accent)'
            : hovered
              ? '1px solid var(--io-border)'
              : '1px solid transparent',
        borderRadius: 4,
        overflow: 'hidden',
        boxSizing: 'border-box',
        outline: isSelected ? '1px solid var(--io-accent)' : undefined,
        outlineOffset: isSelected ? '-1px' : undefined,
        ...fullscreenStyle,
      }}
    >
      {/* Header — io-pane-drag-handle is the react-grid-layout drag target in edit mode */}
      <div
        className={editMode ? 'io-pane-drag-handle' : undefined}
        onContextMenu={(e) => {
          // Header context menu — always show regardless of target
          e.preventDefault()
          e.stopPropagation()
          setPaneCtxMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          height: 36,
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
          borderBottom: '1px solid var(--io-border)',
          cursor: editMode ? 'grab' : 'context-menu',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>

        <PaneTypeBadge type={config.type} />

        {/* Fullscreen toggle button (always shown for non-edit mode, or when fullscreen) */}
        {!editMode && (
          <button
            onClick={() => onToggleFullscreen?.()}
            title={isFullscreen ? 'Exit full screen' : 'Full screen (F11)'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              padding: '3px 5px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isFullscreen ? (
              /* Compress icon */
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              /* Expand icon */
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        )}

        {editMode && (
          <>
            {/* Configure button */}
            <button
              onClick={() => onConfigure(config.id)}
              title="Configure pane"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--io-text-muted)',
                padding: '3px 5px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Settings / gear icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Remove button */}
            <button
              onClick={() => onRemove(config.id)}
              title="Remove pane"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--io-text-muted)',
                padding: '3px 5px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {config.type === 'trend' && (
          <TrendPane
            config={config}
            editMode={editMode}
            onConfigurePoints={onConfigure}
          />
        )}
        {config.type === 'point_table' && (
          <PointTablePane
            config={config}
            editMode={editMode}
            onConfigurePoints={onConfigure}
          />
        )}
        {config.type === 'alarm_list' && <AlarmListPane config={config} />}
        {config.type === 'graphic' && config.graphicId && (
          <GraphicPane
            graphicId={config.graphicId}
            preserveAspectRatio={preserveAspectRatio}
          />
        )}
        {config.type === 'graphic' && !config.graphicId && (
          <BlankPane editMode={editMode} onConfigure={onConfigure} paneId={config.id} />
        )}
        {config.type === 'blank' && (
          <BlankPane editMode={editMode} onConfigure={onConfigure} paneId={config.id} />
        )}

        {/* Exit Full Screen button — absolute overlay when fullscreen */}
        {isFullscreen && (
          <button
            onClick={() => onToggleFullscreen?.()}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 501,
              background: 'rgba(9,9,11,0.85)',
              border: '1px solid var(--io-border)',
              borderRadius: 6,
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--io-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Exit Full Screen
          </button>
        )}
      </div>

      {/* Pane context menu */}
      {paneCtxMenu && (
        <ContextMenu
          x={paneCtxMenu.x}
          y={paneCtxMenu.y}
          onClose={() => setPaneCtxMenu(null)}
          items={[
            {
              label: isFullscreen ? 'Exit Full Screen' : 'Full Screen',
              onClick: () => onToggleFullscreen?.(),
            },
            {
              label: 'Copy',
              onClick: () => {
                if (onCopy) {
                  onCopy({ ...config })
                } else {
                  console.log('[Console] Copy pane', config.id)
                }
              },
            },
            {
              label: 'Duplicate',
              onClick: () => {
                if (onDuplicate) {
                  onDuplicate(config.id)
                } else {
                  console.log('[Console] Duplicate pane', config.id)
                }
              },
            },
            {
              label: 'Configure Pane…',
              divider: true,
              onClick: () => onConfigure(config.id),
            },
            ...(config.type === 'graphic' ? [
              {
                label: 'Zoom to Fit',
                onClick: () => {
                  if (onZoomToFit) {
                    onZoomToFit(config.id)
                  } else {
                    console.log('[Console] Zoom to fit pane', config.id)
                  }
                },
              },
              {
                label: 'Reset Zoom',
                onClick: () => {
                  if (onResetZoom) {
                    onResetZoom(config.id)
                  } else {
                    console.log('[Console] Reset zoom pane', config.id)
                  }
                },
              },
              ...(config.graphicId ? [{
                label: 'Open in Designer',
                divider: true,
                onClick: () => {
                  navigate(`/designer/graphics/${config.graphicId}/edit`)
                },
              }] : []),
            ] : []),
            {
              label: 'Remove Pane',
              divider: true,
              onClick: () => onRemove(config.id),
            },
          ]}
        />
      )}
    </div>
  )
}
