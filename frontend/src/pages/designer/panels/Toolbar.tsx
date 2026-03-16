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
  zoom: number
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
}

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  background: 'var(--io-border)',
  margin: '0 4px',
}

const zoomLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--io-text-secondary)',
  minWidth: '40px',
  textAlign: 'center',
  userSelect: 'none',
}

function ToolBtn({
  label,
  title,
  active,
  onClick,
}: {
  label: string
  title: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        border: active ? '1px solid var(--io-accent)' : '1px solid transparent',
        borderRadius: 'var(--io-radius)',
        background: active ? 'var(--io-accent-subtle)' : 'transparent',
        color: active ? 'var(--io-accent)' : 'var(--io-text-secondary)',
        transition: 'background 0.1s, color 0.1s, border-color 0.1s',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  )
}

function ToggleBtn({
  label,
  title,
  active,
  onClick,
}: {
  label: string
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: '12px',
        cursor: 'pointer',
        border: active ? '1px solid var(--io-accent)' : '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        background: active ? 'var(--io-accent-subtle)' : 'transparent',
        color: active ? 'var(--io-accent)' : 'var(--io-text-muted)',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  )
}

function IconBtn({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: '4px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        border: '1px solid transparent',
        borderRadius: 'var(--io-radius)',
        background: 'transparent',
        color: 'var(--io-text-secondary)',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  )
}

const TOOLS: { tool: DrawingTool; label: string; title: string }[] = [
  { tool: 'select', label: 'S', title: 'Select (S)' },
  { tool: 'rect', label: 'R', title: 'Rectangle (R)' },
  { tool: 'ellipse', label: 'E', title: 'Ellipse (E)' },
  { tool: 'text', label: 'T', title: 'Text (T)' },
  { tool: 'line', label: 'L', title: 'Line (L)' },
  { tool: 'pipe', label: 'P', title: 'Pipe (P)' },
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
  zoom,
}: ToolbarProps) {
  return (
    <div style={toolbarStyle}>
      {TOOLS.map(({ tool, label, title }) => (
        <ToolBtn
          key={tool}
          label={label}
          title={title}
          active={activeTool === tool}
          onClick={() => onToolChange(tool)}
        />
      ))}

      <div style={separatorStyle} />

      <ToggleBtn label="Grid" title="Toggle grid" active={gridEnabled} onClick={onGridToggle} />
      <ToggleBtn label="Snap" title="Toggle snap to grid" active={snapEnabled} onClick={onSnapToggle} />

      <div style={separatorStyle} />

      <IconBtn label="−" title="Zoom out" onClick={onZoomOut} />
      <span style={zoomLabelStyle}>{Math.round(zoom * 100)}%</span>
      <IconBtn label="+" title="Zoom in" onClick={onZoomIn} />
      <IconBtn label="Fit" title="Zoom to fit" onClick={onZoomFit} />
    </div>
  )
}
