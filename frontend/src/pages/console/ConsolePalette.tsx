import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { graphicsApi } from '../../api/graphics'
import type { WorkspaceLayout } from './types'
import { useConsoleWorkspaceFavorites } from '../../shared/hooks/useConsoleWorkspaceFavorites'
import * as RadixContextMenu from '@radix-ui/react-context-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Point {
  id: string
  tagname: string
  description?: string
  unit?: string
  source_name?: string
}

// Drag data key used to communicate drops from palette to panes
export const CONSOLE_DRAG_KEY = 'application/io-console-item'

export interface ConsoleDragItem {
  itemType: 'trend' | 'point_table' | 'alarm_list' | 'graphic'
  label?: string
  pointIds?: string[]
  graphicId?: string
}

// ---------------------------------------------------------------------------
// Helper: style constants
// ---------------------------------------------------------------------------

const PANEL_W = 220

const panel: React.CSSProperties = {
  width: PANEL_W,
  minWidth: PANEL_W,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--io-surface-secondary)',
  borderRight: '1px solid var(--io-border)',
  overflow: 'hidden',
  userSelect: 'none',
}

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  height: 36,
  cursor: 'pointer',
  flexShrink: 0,
  borderBottom: '1px solid var(--io-border)',
  gap: 6,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--io-text-muted)',
  flex: 1,
}

const chevron = (open: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  color: 'var(--io-text-muted)',
  transition: 'transform 0.15s',
  transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
  flexShrink: 0,
})

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

const listItem = (dragging?: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--io-text-primary)',
  cursor: 'grab',
  borderRadius: 'var(--io-radius)',
  margin: '1px 4px',
  opacity: dragging ? 0.5 : 1,
  transition: 'background 0.1s',
})

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------

import React from 'react'

interface AccordionSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
}

function AccordionSection({ title, open, onToggle, badge, children }: AccordionSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div
        style={sectionHeader}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle() }}
      >
        <svg style={chevron(open)} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 4 10 8 6 12" />
        </svg>
        <span style={sectionLabel}>{title}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            background: 'var(--io-accent-subtle)',
            color: 'var(--io-accent)',
            borderRadius: 8,
            padding: '1px 5px',
            lineHeight: 1.4,
          }}>
            {badge}
          </span>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable item wrapper — sets dataTransfer on drag start
// ---------------------------------------------------------------------------

function DraggableItem({
  item,
  children,
  onQuickPlace,
}: {
  item: ConsoleDragItem
  children: React.ReactNode
  onQuickPlace?: (item: ConsoleDragItem) => void
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      style={listItem(dragging)}
      onDoubleClick={(e) => { e.stopPropagation(); onQuickPlace?.(item) }}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item))
        e.dataTransfer.effectAllowed = 'copy'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={(e) => {
        if (!dragging) (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Star icon — used in workspace rows to toggle favorites
// ---------------------------------------------------------------------------

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? 'var(--io-warning)' : 'none'}
      stroke={filled ? 'var(--io-warning)' : 'var(--io-text-muted)'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Single workspace row — used in both favorites and full list
// ---------------------------------------------------------------------------

function WorkspaceRow({
  ws,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onDelete,
  canDelete,
}: {
  ws: WorkspaceLayout
  isActive: boolean
  isFavorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  onRename?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  canDelete?: boolean
}) {
  const [hovering, setHovering] = useState(false)

  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>
        <div
          style={{
            display: 'flex', alignItems: 'center',
            background: isActive ? 'color-mix(in srgb, var(--io-accent) 14%, transparent)' : 'transparent',
            padding: '0 4px 0 0',
          }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <button
            onClick={onSelect}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              flex: 1, padding: '5px 6px 5px 10px', border: 'none',
              background: 'transparent',
              cursor: 'pointer', textAlign: 'left',
              minWidth: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--io-text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span style={{
              flex: 1, fontSize: 12, color: isActive ? 'var(--io-accent)' : 'var(--io-text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontWeight: isActive ? 600 : 400,
            }}>
              {ws.name}
            </span>
            {ws.published && (
              <span style={{ fontSize: 9, background: 'var(--io-accent)', color: '#fff', borderRadius: 3, padding: '1px 4px', fontWeight: 600, letterSpacing: '0.03em', flexShrink: 0 }}>
                PUB
              </span>
            )}
          </button>
          {/* Star button — visible on hover or when already favorited. Do not remove. */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
            title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 3, flexShrink: 0,
              opacity: isFavorite || hovering ? 1 : 0,
              transition: 'opacity 0.1s',
            }}
          >
            <StarIcon filled={isFavorite} />
          </button>
        </div>
      </RadixContextMenu.Trigger>

      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          style={{
            zIndex: 2000,
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minWidth: 200,
            paddingTop: 4,
            paddingBottom: 4,
            outline: 'none',
            animation: 'io-context-menu-in 0.08s ease',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <style>{`
            @keyframes io-context-menu-in {
              from { opacity: 0; transform: scale(0.97) translateY(-3px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            [data-radix-context-menu-item]:focus {
              background: var(--io-accent-subtle);
              outline: none;
            }
          `}</style>

          <RadixContextMenu.Item
            onSelect={onSelect}
            style={ctxMenuItemStyle}
          >
            Open
          </RadixContextMenu.Item>

          <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />

          <RadixContextMenu.Item
            onSelect={onToggleFavorite}
            style={ctxMenuItemStyle}
          >
            {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </RadixContextMenu.Item>

          {onRename && (
            <RadixContextMenu.Item
              onSelect={onRename}
              style={ctxMenuItemStyle}
            >
              {'Rename\u2026'}
            </RadixContextMenu.Item>
          )}

          {onDuplicate && (
            <RadixContextMenu.Item
              onSelect={onDuplicate}
              style={ctxMenuItemStyle}
            >
              Duplicate
            </RadixContextMenu.Item>
          )}

          {onDelete && (
            <>
              <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />
              <RadixContextMenu.Item
                onSelect={onDelete}
                disabled={!canDelete}
                style={{
                  ...ctxMenuItemStyle,
                  color: !canDelete ? 'var(--io-text-muted)' : 'var(--io-text-primary)',
                  opacity: !canDelete ? 0.5 : 1,
                  cursor: !canDelete ? 'default' : 'pointer',
                }}
              >
                Delete
              </RadixContextMenu.Item>
            </>
          )}
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}

const ctxMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 14px',
  fontSize: 13,
  color: 'var(--io-text-primary)',
  cursor: 'pointer',
  userSelect: 'none',
  outline: 'none',
}

const ctxMenuSeparatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--io-border)',
  margin: '3px 0',
}

// ---------------------------------------------------------------------------
// Workspaces section — with Favorites group pinned at top
// ---------------------------------------------------------------------------

function WorkspacesSection({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  favoriteIds,
  onToggleFavorite,
  onRenameWorkspace,
  onDuplicateWorkspace,
  onDeleteWorkspace,
}: {
  workspaces: WorkspaceLayout[]
  activeWorkspaceId: string | null
  onSelectWorkspace?: (id: string) => void
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
  onRenameWorkspace?: (id: string) => void
  onDuplicateWorkspace?: (id: string) => void
  onDeleteWorkspace?: (id: string) => void
}) {
  const [favoritesOpen, setFavoritesOpen] = useState(true)

  const favoriteWorkspaces = workspaces.filter((ws) => favoriteIds.has(ws.id))
  const hasFavorites = favoriteWorkspaces.length > 0

  if (workspaces.length === 0) {
    return (
      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
        No saved workspaces.
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Favorites group — pinned at top, only shown when there are favorites */}
      {hasFavorites && (
        <div style={{ marginBottom: 2 }}>
          {/* Favorites sub-header */}
          <button
            onClick={() => setFavoritesOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              width: '100%', padding: '3px 10px', border: 'none',
              background: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <svg
              style={{
                width: 10, height: 10, color: 'var(--io-text-muted)',
                transition: 'transform 0.15s',
                transform: favoritesOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 4 10 8 6 12" />
            </svg>
            <StarIcon filled />
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--io-text-muted)',
            }}>
              Favorites
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: 'var(--io-accent-subtle)', color: 'var(--io-accent)',
              borderRadius: 8, padding: '1px 4px', lineHeight: 1.4, marginLeft: 2,
            }}>
              {favoriteWorkspaces.length}
            </span>
          </button>
          {favoritesOpen && (
            <div>
              {favoriteWorkspaces.map((ws) => (
                <WorkspaceRow
                  key={ws.id}
                  ws={ws}
                  isActive={ws.id === activeWorkspaceId}
                  isFavorite
                  onSelect={() => onSelectWorkspace?.(ws.id)}
                  onToggleFavorite={() => onToggleFavorite(ws.id)}
                  onRename={onRenameWorkspace ? () => onRenameWorkspace(ws.id) : undefined}
                  onDuplicate={onDuplicateWorkspace ? () => onDuplicateWorkspace(ws.id) : undefined}
                  onDelete={onDeleteWorkspace ? () => onDeleteWorkspace(ws.id) : undefined}
                  canDelete={workspaces.length > 1}
                />
              ))}
            </div>
          )}
          {/* Divider between Favorites and full list */}
          <div style={{ height: 1, background: 'var(--io-border)', margin: '4px 10px' }} />
        </div>
      )}

      {/* Full workspace list */}
      {workspaces.map((ws) => (
        <WorkspaceRow
          key={ws.id}
          ws={ws}
          isActive={ws.id === activeWorkspaceId}
          isFavorite={favoriteIds.has(ws.id)}
          onSelect={() => onSelectWorkspace?.(ws.id)}
          onToggleFavorite={() => onToggleFavorite(ws.id)}
          onRename={onRenameWorkspace ? () => onRenameWorkspace(ws.id) : undefined}
          onDuplicate={onDuplicateWorkspace ? () => onDuplicateWorkspace(ws.id) : undefined}
          onDelete={onDeleteWorkspace ? () => onDeleteWorkspace(ws.id) : undefined}
          canDelete={workspaces.length > 1}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widgets section (Trend, Point Table, Alarm List)
// ---------------------------------------------------------------------------

const WIDGET_ITEMS: { itemType: ConsoleDragItem['itemType']; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    itemType: 'trend',
    label: 'Trend',
    desc: 'Live time-series chart',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-accent)" strokeWidth="1.5">
        <polyline points="1 12 4 7 7 9 10 5 15 3" />
        <line x1="1" y1="14" x2="15" y2="14" strokeOpacity="0.4" />
      </svg>
    ),
  },
  {
    itemType: 'point_table',
    label: 'Point Table',
    desc: 'Tabular point values',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5">
        <rect x="1" y="1" width="14" height="14" rx="1" />
        <line x1="1" y1="5" x2="15" y2="5" />
        <line x1="6" y1="1" x2="6" y2="15" />
      </svg>
    ),
  },
  {
    itemType: 'alarm_list',
    label: 'Alarm List',
    desc: 'Active alarms & events',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#f59e0b" strokeWidth="1.5">
        <path d="M8 2L14 13H2L8 2Z" />
        <line x1="8" y1="7" x2="8" y2="10" />
        <circle cx="8" cy="12" r="0.5" fill="#f59e0b" />
      </svg>
    ),
  },
]

function WidgetsSection({ onQuickPlace }: { onQuickPlace?: (item: ConsoleDragItem) => void }) {
  return (
    <div style={{ padding: '6px 4px 4px' }}>
      {WIDGET_ITEMS.map((w) => (
        <DraggableItem key={w.itemType} item={{ itemType: w.itemType, label: w.label }} onQuickPlace={onQuickPlace}>
          {w.icon}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>{w.label}</div>
            <div style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>{w.desc}</div>
          </div>
        </DraggableItem>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Points section
// ---------------------------------------------------------------------------

function PointsSection() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['console-palette-points', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return []
      const r = await api.get<{ data: Point[] }>(`/api/search?q=${encodeURIComponent(debouncedSearch)}&type=point&limit=30`)
      if (!r.success) return []
      return r.data.data ?? []
    },
    staleTime: 30_000,
    enabled: debouncedSearch.length >= 2,
  })

  const points = data ?? []

  return (
    <div style={{ padding: '6px 4px 4px' }}>
      <div style={{ padding: '0 6px 6px' }}>
        <input
          type="search"
          placeholder="Search points (≥2 chars)…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={searchInput}
        />
      </div>
      {search.length > 0 && search.length < 2 && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          Type at least 2 characters
        </div>
      )}
      {isLoading && (
        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          Searching…
        </div>
      )}
      {!isLoading && debouncedSearch.length >= 2 && points.length === 0 && (
        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          No points found
        </div>
      )}
      {debouncedSearch.length < 2 && !isLoading && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          Search to browse points. Drag a point onto a Trend or Table pane to add it.
        </div>
      )}
      {points.map((pt) => (
        <DraggableItem
          key={pt.id}
          item={{ itemType: 'trend', label: pt.tagname, pointIds: [pt.id] }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3" />
            <line x1="8" y1="1" x2="8" y2="4" />
            <line x1="8" y1="12" x2="8" y2="15" />
            <line x1="1" y1="8" x2="4" y2="8" />
            <line x1="12" y1="8" x2="15" y2="8" />
          </svg>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pt.tagname}
            </div>
            {pt.description && (
              <div style={{ fontSize: 10, color: 'var(--io-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pt.description}
              </div>
            )}
          </div>
        </DraggableItem>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graphic thumbnail tile — drag-to-drop onto console pane
// ---------------------------------------------------------------------------

function GraphicTile({ item, name, thumbUrl, onQuickPlace }: { item: ConsoleDragItem; name: string; thumbUrl: string; onQuickPlace?: (item: ConsoleDragItem) => void }) {
  const [dragging, setDragging] = useState(false)
  const [thumbError, setThumbError] = useState(false)

  return (
    <div
      draggable
      onDoubleClick={(e) => { e.stopPropagation(); onQuickPlace?.(item) }}
      style={{
        padding: '5px 6px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        transition: 'background 0.1s',
        border: '1px solid transparent',
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item))
        e.dataTransfer.effectAllowed = 'copy'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Thumbnail */}
      <div style={{
        width: '100%',
        aspectRatio: '16/9',
        background: 'var(--io-surface-sunken)',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid var(--io-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
      }}>
        {!thumbError ? (
          <img
            src={thumbUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.2" opacity={0.4}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: 'var(--io-text-primary)' }}>
        {name}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graphics section — shows available graphics as thumbnail tiles
// ---------------------------------------------------------------------------

function GraphicsSection({ onQuickPlace }: { onQuickPlace?: (item: ConsoleDragItem) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['console-palette-graphics'],
    queryFn: async () => {
      const r = await graphicsApi.list({ scope: 'console' })
      if (!r.success) return []
      return r.data.data ?? []
    },
    staleTime: 60_000,
  })

  const graphics = data ?? []

  if (isLoading) {
    return (
      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
        Loading…
      </div>
    )
  }

  if (graphics.length === 0) {
    return (
      <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
        No graphics. Create one in Designer.
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 6px 4px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {graphics.map((g) => {
        const thumbUrl = graphicsApi.thumbnailUrl(g.id)
        const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }
        return (
          <GraphicTile key={g.id} item={item} name={g.name} thumbUrl={thumbUrl} onQuickPlace={onQuickPlace} />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConsolePalette — main component
// ---------------------------------------------------------------------------

interface ConsolePaletteProps {
  visible: boolean
  onToggle: () => void
  onQuickPlace?: (item: ConsoleDragItem) => void
  workspaces?: WorkspaceLayout[]
  activeWorkspaceId?: string | null
  onSelectWorkspace?: (id: string) => void
  onRenameWorkspace?: (id: string) => void
  onDuplicateWorkspace?: (id: string) => void
  onDeleteWorkspace?: (id: string) => void
}

export default function ConsolePalette({ visible, onToggle, onQuickPlace, workspaces = [], activeWorkspaceId = null, onSelectWorkspace, onRenameWorkspace, onDuplicateWorkspace, onDeleteWorkspace }: ConsolePaletteProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    workspaces: false,
    graphics: true,
    widgets: false,
    points: false,
  })

  const { favoriteIds, toggleFavorite } = useConsoleWorkspaceFavorites()

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  if (!visible) {
    // Collapsed — show a slim toggle button
    return (
      <div
        style={{
          width: 24,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--io-surface-secondary)',
          borderRight: '1px solid var(--io-border)',
          paddingTop: 8,
        }}
      >
        <button
          onClick={onToggle}
          title="Show asset palette"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            padding: '4px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div style={panel}>
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          height: 36,
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
          gap: 6,
        }}
      >
        <span style={{ ...sectionLabel, color: 'var(--io-text-secondary)', fontSize: 12, fontWeight: 700 }}>
          Assets
        </span>
        <button
          onClick={onToggle}
          title="Collapse palette"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 3,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="10 4 6 8 10 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AccordionSection
          title="Workspaces"
          open={openSections.workspaces}
          onToggle={() => toggleSection('workspaces')}
          badge={workspaces.length}
        >
          <WorkspacesSection
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={onSelectWorkspace}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onRenameWorkspace={onRenameWorkspace}
            onDuplicateWorkspace={onDuplicateWorkspace}
            onDeleteWorkspace={onDeleteWorkspace}
          />
        </AccordionSection>

        <AccordionSection
          title="Graphics"
          open={openSections.graphics}
          onToggle={() => toggleSection('graphics')}
        >
          <GraphicsSection onQuickPlace={onQuickPlace} />
        </AccordionSection>

        <AccordionSection
          title="Widgets"
          open={openSections.widgets}
          onToggle={() => toggleSection('widgets')}
        >
          <WidgetsSection onQuickPlace={onQuickPlace} />
        </AccordionSection>

        <AccordionSection
          title="Points"
          open={openSections.points}
          onToggle={() => toggleSection('points')}
        >
          <PointsSection />
        </AccordionSection>
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--io-border)',
          fontSize: 10,
          color: 'var(--io-text-muted)',
          flexShrink: 0,
          lineHeight: 1.5,
        }}
      >
        Drag items onto panes to assign them
      </div>
    </div>
  )
}
