import React from 'react'
import type { DrawingTool } from '../types'

interface ToolbarProps {
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  gridEnabled: boolean
  onGridToggle: () => void
  snapEnabled: boolean
  onSnapToggle: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  onImageImport: () => void
  zoom: number
  focusMode: boolean
  onFocusModeToggle: () => void
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  padding: '4px 8px',
  background: 'var(--io-surface-elevated)',
  borderBottom: '1px solid var(--io-border)',
  flexShrink: 0,
  height: '40px',
  userSelect: 'none',
}

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  background: 'var(--io-border)',
  margin: '0 4px',
  flexShrink: 0,
}

const zoomLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--io-text-secondary)',
  minWidth: '40px',
  textAlign: 'center',
  userSelect: 'none',
  fontVariantNumeric: 'tabular-nums',
}

// SVG icon components inline — no external dependencies
function IconSelect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2L3 12L6.5 9.5L8.5 14L10 13.3L8 8.5L12 8L3 2Z" fill="currentColor"/>
    </svg>
  )
}

function IconRect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}

function IconEllipse() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="8" cy="8" rx="6" ry="4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}

function IconLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3.5H14M8 3.5V13M5.5 13H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconPipe() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="3" cy="13" r="1.5" fill="currentColor"/>
      <circle cx="13" cy="3" r="1.5" fill="currentColor"/>
      <line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <line x1="9" y1="4" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="5.5" cy="6" r="1.5" fill="currentColor"/>
      <path d="M1.5 11L5 7.5L8 10.5L11 7.5L14.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function IconPan() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2V5M8 11V14M14 8H11M5 8H2M11.5 4.5L9.5 6.5M6.5 9.5L4.5 11.5M11.5 11.5L9.5 9.5M6.5 6.5L4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7"/>
      <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7"/>
      <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7"/>
      <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7"/>
    </svg>
  )
}

function IconSnap() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <rect x="9" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
      <circle cx="11.5" cy="11.5" r="1" fill="currentColor"/>
      <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
    </svg>
  )
}

function IconFocus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 5V2H5M11 2H14V5M14 11V14H11M5 14H2V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconZoomIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconZoomOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconFit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 6V2H6M10 2H14V6M14 10V14H10M6 14H2V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="5" y="5" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  )
}

function ToolBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: active ? '1px solid var(--io-accent)' : '1px solid transparent',
        borderRadius: 'var(--io-radius)',
        background: active ? 'var(--io-accent-subtle)' : 'transparent',
        color: active ? 'var(--io-accent)' : 'var(--io-text-secondary)',
        transition: 'background 0.1s, color 0.1s, border-color 0.1s',
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-primary)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--io-text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--io-text-secondary)'
        }
      }}
    >
      {icon}
    </button>
  )
}

function ToggleBtn({
  icon,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: active ? '1px solid var(--io-accent)' : '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        background: active ? 'var(--io-accent-subtle)' : 'transparent',
        color: active ? 'var(--io-accent)' : 'var(--io-text-muted)',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  )
}

function IconBtn({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        border: '1px solid transparent',
        borderRadius: 'var(--io-radius)',
        background: 'transparent',
        color: 'var(--io-text-secondary)',
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-primary)'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--io-text-primary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLElement).style.color = 'var(--io-text-secondary)'
      }}
    >
      {icon}
    </button>
  )
}

const DRAW_TOOLS: { tool: DrawingTool; icon: React.ReactNode; title: string }[] = [
  { tool: 'select', icon: <IconSelect />, title: 'Select (V) — Click, Ctrl+click multi-select, drag to marquee' },
  { tool: 'rect', icon: <IconRect />, title: 'Rectangle (R) — Click and drag to draw' },
  { tool: 'ellipse', icon: <IconEllipse />, title: 'Ellipse (E) — Click and drag to draw' },
  { tool: 'line', icon: <IconLine />, title: 'Line (L) — Click and drag to draw' },
  { tool: 'pipe', icon: <IconPipe />, title: 'Pipe (P) — Click and drag to draw thick pipe' },
  { tool: 'pencil', icon: <IconPencil />, title: 'Freehand Draw (F) — Click and drag to draw freely' },
  { tool: 'text', icon: <IconText />, title: 'Text (T) — Click to place text' },
  { tool: 'image', icon: <IconImage />, title: 'Image (I) — Import a raster image' },
  { tool: 'pan', icon: <IconPan />, title: 'Pan (Space) — Click and drag to pan canvas' },
]

export default function Toolbar({
  activeTool,
  onToolChange,
  gridEnabled,
  onGridToggle,
  snapEnabled,
  onSnapToggle,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onImageImport,
  zoom,
  focusMode,
  onFocusModeToggle,
}: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      {DRAW_TOOLS.map(({ tool, icon, title }) => (
        <ToolBtn
          key={tool}
          icon={icon}
          title={title}
          active={activeTool === tool}
          onClick={() => {
            if (tool === 'image') {
              onImageImport()
            } else {
              onToolChange(tool)
            }
          }}
        />
      ))}

      <div style={separatorStyle} />

      <ToggleBtn icon={<IconGrid />} title="Toggle grid (G)" active={gridEnabled} onClick={onGridToggle} />
      <ToggleBtn icon={<IconSnap />} title="Toggle snap to grid (Shift+S)" active={snapEnabled} onClick={onSnapToggle} />

      <div style={separatorStyle} />

      <IconBtn icon={<IconZoomOut />} title="Zoom out (Ctrl+−)" onClick={onZoomOut} />
      <span style={zoomLabelStyle}>{Math.round(zoom * 100)}%</span>
      <IconBtn icon={<IconZoomIn />} title="Zoom in (Ctrl++)" onClick={onZoomIn} />
      <IconBtn icon={<IconFit />} title="Fit to screen (Ctrl+0)" onClick={onZoomFit} />

      <div style={{ flex: 1 }} />

      <IconBtn
        icon={<IconFocus />}
        title={focusMode ? 'Exit focus mode' : 'Focus mode — hide sidebar and nav (Ctrl+Shift+F)'}
        onClick={onFocusModeToggle}
      />
    </div>
  )
}
