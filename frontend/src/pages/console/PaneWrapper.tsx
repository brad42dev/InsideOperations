import { useState } from 'react'
import GraphicPane from './panes/GraphicPane'
import TrendPane from './panes/TrendPane'
import PointTablePane from './panes/PointTablePane'
import AlarmListPane from './panes/AlarmListPane'
import ContextMenu from '../../shared/components/ContextMenu'
import { CONSOLE_DRAG_KEY, type ConsoleDragItem } from './ConsolePalette'
import type { PaneConfig } from './types'

export interface PaneWrapperProps {
  config: PaneConfig
  editMode: boolean
  onConfigure: (paneId: string) => void
  onRemove: (paneId: string) => void
  onGraphicSelected?: (paneId: string, graphicId: string) => void
  onPaletteDrop?: (paneId: string, item: ConsoleDragItem) => void
}

const PANE_TYPE_LABELS: Record<string, string> = {
  graphic: 'Graphic',
  trend: 'Trend',
  point_table: 'Point Table',
  alarm_list: 'Alarm List',
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
  onConfigure,
  onRemove,
  onGraphicSelected,
  onPaletteDrop,
}: PaneWrapperProps) {
  const title = config.title ?? PANE_TYPE_LABELS[config.type] ?? config.type
  const [paneCtxMenu, setPaneCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--io-surface)',
        border: dragOver ? '2px solid var(--io-accent)' : '1px solid var(--io-border)',
        borderRadius: 4,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        onContextMenu={(e) => {
          e.preventDefault()
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
          cursor: 'context-menu',
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
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {config.type === 'graphic' && (
          <GraphicPane
            config={config}
            editMode={editMode}
            onGraphicSelected={onGraphicSelected}
          />
        )}
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
        {config.type === 'blank' && (
          <BlankPane editMode={editMode} onConfigure={onConfigure} paneId={config.id} />
        )}
      </div>

      {/* Pane header context menu */}
      {paneCtxMenu && (
        <ContextMenu
          x={paneCtxMenu.x}
          y={paneCtxMenu.y}
          onClose={() => setPaneCtxMenu(null)}
          items={[
            {
              label: 'Configure Pane…',
              onClick: () => onConfigure(config.id),
            },
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
