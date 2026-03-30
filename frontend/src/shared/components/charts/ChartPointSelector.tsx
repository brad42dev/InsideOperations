// ---------------------------------------------------------------------------
// ChartPointSelector — filterable point list + drag-to-slot assignment UI
// Used inside ChartConfigPanel.
// ---------------------------------------------------------------------------

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PointMeta } from '../../../api/points'
import { pointsApi } from '../../../api/points'
import {
  type ChartPointSlot,
  type SlotDefinition,
  autoColor,
  makeSlotId,
} from './chart-config-types'

interface ChartPointSelectorProps {
  slotDefs: SlotDefinition[]
  points: ChartPointSlot[]
  /** No longer required — component fetches its own list server-side. */
  allPoints?: PointMeta[]
  onChange: (points: ChartPointSlot[]) => void
}

function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <span
      onClick={() => inputRef.current?.click()}
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 2,
        background: color,
        cursor: 'pointer',
        flexShrink: 0,
        border: '1px solid rgba(0,0,0,0.3)',
      }}
      title="Click to change color"
    >
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
      />
    </span>
  )
}

export default function ChartPointSelector({ slotDefs, points, onChange }: ChartPointSelectorProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dragPointId, setDragPointId] = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  // Debounce search input so we don't fire a query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Server-side search: fetch up to 100 matching points. When no search term is
  // entered we show the first 100 points as suggestions.
  const { data: listResult, isFetching: isSearching } = useQuery({
    queryKey: ['chart-point-search', debouncedSearch],
    queryFn: () => pointsApi.list({ search: debouncedSearch || undefined, limit: 100 }),
    staleTime: 30_000,
  })
  const allPoints: PointMeta[] = listResult?.success ? listResult.data.data : []
  const filtered = allPoints

  function assignPoint(role: string, pointId: string) {
    const slotDef = slotDefs.find((s) => s.id === role)
    if (!slotDef) return

    // Resolve human-readable label — never show the UUID in charts
    const meta = filtered.find((p) => p.id === pointId)
    const label = meta?.display_name ?? meta?.tagname

    if (!slotDef.multi) {
      // Replace the single slot for this role
      const without = points.filter((p) => p.role !== role)
      const colorIdx = without.length
      onChange([...without, { slotId: role, role, pointId, label, color: autoColor(colorIdx) }])
    } else {
      // Don't add if already present in this role
      if (points.some((p) => p.role === role && p.pointId === pointId)) return
      // Enforce per-slot max (default 12)
      const maxPoints = slotDef.maxPoints ?? 12
      if (points.filter((p) => p.role === role).length >= maxPoints) return
      const slotId = makeSlotId(role, points)
      const colorIdx = points.length
      onChange([...points, { slotId, role, pointId, label, color: autoColor(colorIdx) }])
    }
  }

  function removePoint(slotId: string) {
    const updated = points.filter((p) => p.slotId !== slotId)
    // Re-color remaining points
    onChange(updated.map((p, i) => ({ ...p, color: p.color ?? autoColor(i) })))
  }

  function updateColor(slotId: string, color: string) {
    onChange(points.map((p) => p.slotId === slotId ? { ...p, color } : p))
  }

  function handleDragStart(pointId: string) {
    setDragPointId(pointId)
  }

  function handleDrop(role: string) {
    if (dragPointId) assignPoint(role, dragPointId)
    setDragPointId(null)
    setDragOverSlot(null)
  }

  function handleContextMenu(e: React.MouseEvent, pointId: string) {
    e.preventDefault()
    // Build context menu items — one per role
    const menu = document.createElement('div')
    menu.style.cssText = `
      position:fixed; left:${e.clientX}px; top:${e.clientY}px;
      background:var(--io-surface-elevated); border:1px solid var(--io-border);
      border-radius:6px; padding:4px 0; z-index:9999; min-width:160px;
      box-shadow:0 4px 16px rgba(0,0,0,0.4); font-size:12px;
    `
    slotDefs.forEach((slot) => {
      const item = document.createElement('div')
      item.textContent = `Add to ${slot.label}`
      item.style.cssText = `
        padding:6px 12px; cursor:pointer; color:var(--io-text-primary);
      `
      item.addEventListener('mouseenter', () => { item.style.background = 'var(--io-surface-hover)' })
      item.addEventListener('mouseleave', () => { item.style.background = '' })
      item.addEventListener('click', () => {
        assignPoint(slot.id, pointId)
        document.body.removeChild(menu)
      })
      menu.appendChild(item)
    })
    document.body.appendChild(menu)
    const dismiss = () => { if (document.body.contains(menu)) document.body.removeChild(menu); document.removeEventListener('click', dismiss) }
    setTimeout(() => document.addEventListener('click', dismiss), 0)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 26,
    background: 'var(--io-input-bg)',
    border: '1px solid var(--io-input-border)',
    color: 'var(--io-text-primary)',
    fontSize: '1em',
    padding: '0 8px',
    borderRadius: 4,
    outline: 'none',
    boxSizing: 'border-box',
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
      {/* ── Left: filterable point list ─────────────────────────────────── */}
      <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <div style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
          Available Points
        </div>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid var(--io-border)',
            borderRadius: 4,
            background: 'var(--io-surface)',
            minHeight: 0,
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: 12, color: 'var(--io-text-muted)', fontSize: 12 }}>
              {isSearching ? 'Searching…' : search ? 'No matches' : 'Loading…'}
            </div>
          )}
          {filtered.map((pt) => (
            <div
              key={pt.id}
              draggable
              onDragStart={() => handleDragStart(pt.id)}
              onContextMenu={(e) => handleContextMenu(e, pt.id)}
              onDoubleClick={() => {
                // Double-click: add to first slot
                const firstRole = slotDefs[0]?.id
                if (firstRole) assignPoint(firstRole, pt.id)
              }}
              title={pt.display_name ? `${pt.tagname}\n${pt.display_name}` : pt.tagname}
              style={{
                padding: '4px 8px',
                fontSize: '0.9em',
                cursor: 'grab',
                borderBottom: '1px solid var(--io-border)',
                color: 'var(--io-text-primary)',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--io-surface-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
            >
              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pt.tagname}
              </div>
              {pt.display_name && (
                <div style={{ color: 'var(--io-text-muted)', fontSize: '0.8em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pt.display_name}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.75em', color: 'var(--io-text-muted)', flexShrink: 0 }}>
          Drag to slot · Double-click to add · Right-click for options
        </div>
      </div>

      {/* ── Right: slot boxes ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
        {slotDefs.map((slot) => {
          const slotPoints = points.filter((p) => p.role === slot.id)
          const isOver = dragOverSlot === slot.id
          const maxPoints = slot.maxPoints ?? 12
          const isFull = slot.multi && slotPoints.length >= maxPoints
          return (
            <div key={slot.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {slot.label}
                  {slot.required && <span style={{ color: 'var(--io-accent)', marginLeft: 4 }}>*</span>}
                </div>
                {slot.multi && (
                  <span style={{ fontSize: '0.75em', color: isFull ? 'var(--io-accent)' : 'var(--io-text-muted)', fontWeight: 400 }}>
                    {isFull ? `${slotPoints.length}/${maxPoints} — full` : `${slotPoints.length}/${maxPoints} · add up to ${maxPoints}`}
                  </span>
                )}
              </div>
              <div
                onDragOver={(e) => { if (!isFull) { e.preventDefault(); setDragOverSlot(slot.id) } }}
                onDragLeave={() => setDragOverSlot(null)}
                onDrop={() => handleDrop(slot.id)}
                style={{
                  border: `1px dashed ${isOver ? 'var(--io-accent)' : isFull ? 'var(--io-border)' : 'var(--io-border)'}`,
                  borderRadius: 4,
                  padding: '6px 8px',
                  minHeight: 36,
                  background: isOver ? 'var(--io-surface-hover)' : 'var(--io-surface)',
                  opacity: isFull ? 0.7 : 1,
                  transition: 'border-color 0.1s, background 0.1s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {slotPoints.length === 0 && (
                  <div style={{ fontSize: '0.85em', color: 'var(--io-text-muted)', padding: '2px 0' }}>
                    {slot.multi ? `Drop points here (up to ${maxPoints})…` : 'Drop point here…'}
                  </div>
                )}
                {slotPoints.map((sp) => {
                  const meta = filtered.find((p) => p.id === sp.pointId)
                  return (
                    <div
                      key={sp.slotId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.9em',
                        background: 'var(--io-surface-secondary)',
                        border: '1px solid var(--io-border)',
                        borderRadius: 3,
                        padding: '3px 6px',
                      }}
                    >
                      <ColorSwatch
                        color={sp.color ?? autoColor(0)}
                        onChange={(c) => updateColor(sp.slotId, c)}
                      />
                      <span style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {meta?.tagname ?? sp.pointId}
                        </div>
                        {meta?.display_name && (
                          <div style={{ fontSize: '0.8em', color: 'var(--io-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {meta.display_name}
                          </div>
                        )}
                      </span>
                      <button
                        onClick={() => removePoint(sp.slotId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--io-text-muted)',
                          padding: '0 2px',
                          fontSize: '1.1em',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

