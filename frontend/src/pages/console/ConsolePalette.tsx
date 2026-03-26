import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { graphicsApi } from '../../api/graphics'
import type { WorkspaceLayout } from './types'
import { useConsoleWorkspaceFavorites } from '../../shared/hooks/useConsoleWorkspaceFavorites'
import { useConsoleFavorites, CONSOLE_FAVORITES_KEYS } from '../../shared/hooks/useConsoleFavorites'
import { useConsoleSectionViewMode, type SectionViewMode } from '../../shared/hooks/useConsoleSectionViewMode'
import * as RadixContextMenu from '@radix-ui/react-context-menu'

// ---------------------------------------------------------------------------
// View mode — persisted per section in localStorage
// ---------------------------------------------------------------------------

export type SectionViewMode = 'list' | 'thumbnails' | 'grid'

const LS_VIEW_MODE_KEY = 'io-console-section-view-modes'

function loadViewModes(): Record<string, SectionViewMode> {
  try {
    const raw = localStorage.getItem(LS_VIEW_MODE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, SectionViewMode>
    return {}
  } catch {
    return {}
  }
}

function saveViewModes(modes: Record<string, SectionViewMode>): void {
  try {
    localStorage.setItem(LS_VIEW_MODE_KEY, JSON.stringify(modes))
  } catch {
    // ignore quota errors
  }
}

function useConsoleSectionViewMode(sectionKey: string, defaultMode: SectionViewMode = 'list') {
  const [modes, setModes] = useState<Record<string, SectionViewMode>>(() => loadViewModes())

  const viewMode: SectionViewMode = modes[sectionKey] ?? defaultMode

  const setViewMode = useCallback((mode: SectionViewMode) => {
    setModes((prev) => {
      const next = { ...prev, [sectionKey]: mode }
      saveViewModes(next)
      return next
    })
  }, [sectionKey])

  return { viewMode, setViewMode }
}

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

// ---------------------------------------------------------------------------
// View mode icon components — List, Thumbnails, Grid
// ---------------------------------------------------------------------------

function ViewModeListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="1" y1="3" x2="11" y2="3" />
      <line x1="1" y1="6" x2="11" y2="6" />
      <line x1="1" y1="9" x2="11" y2="9" />
    </svg>
  )
}

function ViewModeThumbnailsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="4" height="3" rx="0.5" />
      <line x1="6.5" y1="2" x2="11" y2="2" />
      <line x1="6.5" y1="3.5" x2="9" y2="3.5" />
      <rect x="1" y="6" width="4" height="3" rx="0.5" />
      <line x1="6.5" y1="7" x2="11" y2="7" />
      <line x1="6.5" y1="8.5" x2="9" y2="8.5" />
    </svg>
  )
}

function ViewModeGridIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="4" height="4" rx="0.5" />
      <rect x="7" y="1" width="4" height="4" rx="0.5" />
      <rect x="1" y="7" width="4" height="4" rx="0.5" />
      <rect x="7" y="7" width="4" height="4" rx="0.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ViewModeSelector — three icon buttons shown in accordion section header
// ---------------------------------------------------------------------------

const VIEW_MODE_BUTTONS: { mode: SectionViewMode; label: string; Icon: React.FC }[] = [
  { mode: 'list',       label: 'List view',       Icon: ViewModeListIcon },
  { mode: 'thumbnails', label: 'Thumbnails view',  Icon: ViewModeThumbnailsIcon },
  { mode: 'grid',       label: 'Grid view',        Icon: ViewModeGridIcon },
]

function ViewModeSelector({
  current,
  onChange,
}: {
  current: SectionViewMode
  onChange: (mode: SectionViewMode) => void
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {VIEW_MODE_BUTTONS.map(({ mode, label, Icon }) => {
        const active = current === mode
        return (
          <button
            key={mode}
            title={label}
            onClick={(e) => { e.stopPropagation(); onChange(mode) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              padding: 0,
              background: active ? 'var(--io-accent-subtle)' : 'transparent',
              color: active ? 'var(--io-accent)' : 'var(--io-text-muted)',
              transition: 'background 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--io-text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--io-text-muted)'
              }
            }}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------

interface AccordionSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  badge?: number
  children: React.ReactNode
  viewMode?: SectionViewMode
  onViewModeChange?: (mode: SectionViewMode) => void
}

function AccordionSection({ title, open, onToggle, badge, children, viewMode, onViewModeChange }: AccordionSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div
        style={{ ...sectionHeader, paddingRight: 4 }}
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
        {viewMode !== undefined && onViewModeChange !== undefined && (
          <ViewModeSelector current={viewMode} onChange={onViewModeChange} />
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

function ViewModeButton({ mode: _mode, active, title, onClick, children }: {
  mode: SectionViewMode
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: active ? 'var(--io-accent-subtle)' : 'none',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--io-accent)' : 'var(--io-text-muted)',
        padding: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        transition: 'background 0.1s, color 0.1s',
        width: 20,
        height: 20,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Star icon — used in rows to toggle favorites
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
// FavoritesSubGroup — collapsible "Favorites" group pinned at the top of a
// section. Always rendered (shows "No favorites yet" when the list is empty)
// so users know the feature exists.
// ---------------------------------------------------------------------------

interface FavoritesSubGroupProps {
  items: React.ReactNode[]
  emptyLabel?: string
}

function FavoritesSubGroup({ items, emptyLabel = 'No favorites yet' }: FavoritesSubGroupProps) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{ marginBottom: 2 }}>
      {/* Sub-header */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
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
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
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
        {items.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            background: 'var(--io-accent-subtle)', color: 'var(--io-accent)',
            borderRadius: 8, padding: '1px 4px', lineHeight: 1.4, marginLeft: 2,
          }}>
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div>
          {items.length > 0 ? (
            items
          ) : (
            <div style={{
              padding: '4px 10px 6px 26px',
              fontSize: 11,
              color: 'var(--io-text-muted)',
              fontStyle: 'italic',
            }}>
              {emptyLabel}
            </div>
          )}
        </div>
      )}

      {/* Divider separating Favorites from main list */}
      <div style={{ height: 1, background: 'var(--io-border)', margin: '4px 10px' }} />
    </div>
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
          {/* Star button — visible on hover or when already favorited */}
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
// WorkspaceThumbnailCard — for thumbnails (48×36) and grid (80×60) view modes
// ---------------------------------------------------------------------------

function WorkspaceThumbnailCard({
  ws,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
  thumbW,
  thumbH,
  singleLine,
}: {
  ws: WorkspaceLayout
  isActive: boolean
  isFavorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  thumbW: number
  thumbH: number
  singleLine: boolean
}) {
  return (
    <RadixContextMenu.Root>
      <RadixContextMenu.Trigger asChild>
        <button
          onClick={onSelect}
          title={ws.name}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            padding: '5px 4px',
            border: '1px solid',
            borderColor: isActive ? 'var(--io-accent)' : 'transparent',
            borderRadius: 'var(--io-radius)',
            background: isActive ? 'color-mix(in srgb, var(--io-accent) 10%, transparent)' : 'transparent',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.1s, border-color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
          }}
          onMouseLeave={(e) => {
            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
          }}
        >
          {/* Mini layout thumbnail — gray rectangles representing panes */}
          <div style={{
            width: thumbW,
            height: thumbH,
            background: 'var(--io-surface-sunken)',
            borderRadius: 2,
            border: '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Generic 2-pane grid preview */}
            <svg width={thumbW - 4} height={thumbH - 4} viewBox="0 0 40 30" fill="none">
              <rect x="1" y="1" width="17" height="28" rx="1" fill="var(--io-border)" opacity="0.6" />
              <rect x="22" y="1" width="17" height="13" rx="1" fill="var(--io-border)" opacity="0.6" />
              <rect x="22" y="16" width="17" height="13" rx="1" fill="var(--io-border)" opacity="0.6" />
            </svg>
          </div>
          {/* Name */}
          <span style={{
            fontSize: 10,
            color: isActive ? 'var(--io-accent)' : 'var(--io-text-primary)',
            fontWeight: isActive ? 600 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: singleLine ? 'nowrap' : undefined,
            display: singleLine ? 'block' : '-webkit-box',
            WebkitLineClamp: singleLine ? undefined : 2,
            WebkitBoxOrient: singleLine ? undefined : 'vertical',
            lineHeight: 1.3,
            maxWidth: thumbW + 8,
            textAlign: 'center',
          }}>
            {ws.name}
          </span>
          {/* Favorite star overlay */}
          {isFavorite && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              color: 'var(--io-warning)', lineHeight: 1,
            }}>
              <StarIcon filled />
            </span>
          )}
        </button>
      </RadixContextMenu.Trigger>
      <RadixContextMenu.Portal>
        <RadixContextMenu.Content
          style={{
            zIndex: 2000,
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minWidth: 160,
            paddingTop: 4,
            paddingBottom: 4,
            outline: 'none',
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <RadixContextMenu.Item onSelect={onSelect} style={ctxMenuItemStyle}>Open</RadixContextMenu.Item>
          <RadixContextMenu.Separator style={ctxMenuSeparatorStyle} />
          <RadixContextMenu.Item onSelect={onToggleFavorite} style={ctxMenuItemStyle}>
            {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          </RadixContextMenu.Item>
        </RadixContextMenu.Content>
      </RadixContextMenu.Portal>
    </RadixContextMenu.Root>
  )
}

// ---------------------------------------------------------------------------
// Workspaces section — with Favorites group pinned at top (always visible)
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
  viewMode,
}: {
  workspaces: WorkspaceLayout[]
  activeWorkspaceId: string | null
  onSelectWorkspace?: (id: string) => void
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
  onRenameWorkspace?: (id: string) => void
  onDuplicateWorkspace?: (id: string) => void
  onDeleteWorkspace?: (id: string) => void
  viewMode: SectionViewMode
}) {
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [search, setSearch] = useState('')

  const filteredWorkspaces = search
    ? workspaces.filter((ws) => ws.name.toLowerCase().includes(search.toLowerCase()))
    : workspaces

  const favoriteWorkspaces = filteredWorkspaces.filter((ws) => favoriteIds.has(ws.id))
  const hasFavorites = favoriteWorkspaces.length > 0

  if (workspaces.length === 0) {
    return (
      <div style={{ padding: '4px 0' }}>
        <FavoritesSubGroup items={[]} />
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          No saved workspaces.
        </div>
      </div>
    )
  }

  // Thumbnail dimensions by view mode
  const thumbW = viewMode === 'grid' ? 80 : 48
  const thumbH = viewMode === 'grid' ? 60 : 36
  const isGrid = viewMode === 'grid'

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Search input */}
      <div style={{ padding: '4px 6px 6px' }}>
        <input
          type="search"
          placeholder="Filter workspaces…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
      </div>

      {filteredWorkspaces.length === 0 && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          No matching workspaces
        </div>
      )}

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
            viewMode === 'list' ? (
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
            ) : (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                padding: isGrid ? '4px 6px' : '4px 8px',
              }}>
                {favoriteWorkspaces.map((ws) => (
                  <WorkspaceThumbnailCard
                    key={ws.id}
                    ws={ws}
                    isActive={ws.id === activeWorkspaceId}
                    isFavorite
                    onSelect={() => onSelectWorkspace?.(ws.id)}
                    onToggleFavorite={() => onToggleFavorite(ws.id)}
                    thumbW={thumbW}
                    thumbH={thumbH}
                    singleLine={isGrid}
                  />
                ))}
              </div>
            )
          )}
          {/* Divider between Favorites and full list */}
          <div style={{ height: 1, background: 'var(--io-border)', margin: '4px 10px' }} />
        </div>
      )}

      {/* Full workspace list */}
      {viewMode === 'list' ? (
        filteredWorkspaces.map((ws) => (
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
        ))
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: isGrid ? '4px 6px' : '4px 8px',
        }}>
          {filteredWorkspaces.map((ws) => (
            <WorkspaceThumbnailCard
              key={ws.id}
              ws={ws}
              isActive={ws.id === activeWorkspaceId}
              isFavorite={favoriteIds.has(ws.id)}
              onSelect={() => onSelectWorkspace?.(ws.id)}
              onToggleFavorite={() => onToggleFavorite(ws.id)}
              thumbW={thumbW}
              thumbH={thumbH}
              singleLine={isGrid}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widgets section (Trend, Point Table, Alarm List)
// ---------------------------------------------------------------------------

const WIDGET_ITEMS: { id: string; itemType: ConsoleDragItem['itemType']; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: 'trend',
    itemType: 'trend',
    label: 'Trend',
    desc: 'Live time-series chart',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--io-accent)" strokeWidth="1.5">
        <polyline points="1 12 4 7 7 9 10 5 15 3" />
        <line x1="1" y1="14" x2="15" y2="14" strokeOpacity="0.4" />
      </svg>
    ),
    iconLarge: (
      <svg width="28" height="21" viewBox="0 0 28 21" fill="none" stroke="var(--io-accent)" strokeWidth="1.5">
        <polyline points="2 17 7 10 11 13 16 7 23 4" />
        <line x1="2" y1="19" x2="24" y2="19" strokeOpacity="0.4" />
      </svg>
    ),
  },
  {
    id: 'point_table',
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
    iconLarge: (
      <svg width="28" height="21" viewBox="0 0 28 21" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5">
        <rect x="2" y="2" width="24" height="17" rx="1" />
        <line x1="2" y1="8" x2="26" y2="8" />
        <line x1="11" y1="2" x2="11" y2="19" />
      </svg>
    ),
  },
  {
    id: 'alarm_list',
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
    iconLarge: (
      <svg width="28" height="21" viewBox="0 0 28 21" fill="none" stroke="#f59e0b" strokeWidth="1.5">
        <path d="M14 3L23 18H5L14 3Z" />
        <line x1="14" y1="9" x2="14" y2="13" />
        <circle cx="14" cy="15.5" r="0.8" fill="#f59e0b" />
      </svg>
    ),
  },
]

// ---------------------------------------------------------------------------
// Widget thumbnail card — for thumbnails and grid view modes
// ---------------------------------------------------------------------------

function WidgetThumbnailCard({
  w,
  thumbW,
  thumbH,
  singleLine,
  onQuickPlace,
}: {
  w: typeof WIDGET_ITEMS[number]
  thumbW: number
  thumbH: number
  singleLine: boolean
  onQuickPlace?: (item: ConsoleDragItem) => void
}) {
  const [dragging, setDragging] = useState(false)
  const item: ConsoleDragItem = { itemType: w.itemType, label: w.label }

  return (
    <div
      draggable
      title={w.desc}
      onDoubleClick={(e) => { e.stopPropagation(); onQuickPlace?.(item) }}
      onDragStart={(e) => {
        e.dataTransfer.setData(CONSOLE_DRAG_KEY, JSON.stringify(item))
        e.dataTransfer.effectAllowed = 'copy'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '5px 4px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        transition: 'background 0.1s',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Thumbnail placeholder with icon */}
      <div style={{
        width: thumbW,
        height: thumbH,
        background: 'var(--io-surface-sunken)',
        borderRadius: 3,
        border: '1px solid var(--io-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {/* Scale up the icon for the thumbnail */}
        <span style={{ transform: `scale(${thumbW / 20})`, transformOrigin: 'center', display: 'flex' }}>
          {w.icon}
        </span>
      </div>
      <span style={{
        fontSize: 10,
        color: 'var(--io-text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: singleLine ? 'nowrap' : undefined,
        display: singleLine ? 'block' : '-webkit-box',
        WebkitLineClamp: singleLine ? undefined : 2,
        WebkitBoxOrient: singleLine ? undefined : 'vertical',
        lineHeight: 1.3,
        maxWidth: thumbW + 8,
        textAlign: 'center',
      }}>
        {w.label}
      </span>
    </div>
  )
}

function WidgetsSection({
  onQuickPlace,
  viewMode,
  favoriteIds,
  onToggleFavorite,
}: {
  onQuickPlace?: (item: ConsoleDragItem) => void
  viewMode: SectionViewMode
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [favoritesOpen, setFavoritesOpen] = useState(true)

  const filteredWidgets = search
    ? WIDGET_ITEMS.filter((w) => w.label.toLowerCase().includes(search.toLowerCase()))
    : WIDGET_ITEMS

  const favoriteWidgets = filteredWidgets.filter((w) => favoriteIds.has(w.itemType))
  const hasFavorites = favoriteWidgets.length > 0

  const thumbW = viewMode === 'grid' ? 80 : 48
  const thumbH = viewMode === 'grid' ? 60 : 36
  const isGrid = viewMode === 'grid'

  // Helper: render a widget in list mode with a star toggle button
  function WidgetListRow({ w }: { w: typeof WIDGET_ITEMS[number] }) {
    const [hovering, setHovering] = useState(false)
    const fav = favoriteIds.has(w.itemType)
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '0 4px 0 0' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <DraggableItem item={{ itemType: w.itemType, label: w.label }} onQuickPlace={onQuickPlace}>
          {w.icon}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>{w.label}</div>
            <div style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>{w.desc}</div>
          </div>
        </DraggableItem>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(w.itemType) }}
          title={fav ? 'Remove from Favorites' : 'Add to Favorites'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 3, flexShrink: 0,
            opacity: fav || hovering ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
        >
          <StarIcon filled={fav} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '6px 4px 4px' }}>
      <div style={{ padding: '0 2px 6px' }}>
        <input
          type="search"
          placeholder="Filter widgets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
      </div>

      {filteredWidgets.length === 0 && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          No matching widgets
        </div>
      )}

      {/* Favorites group — pinned at top, only shown when there are favorites */}
      {hasFavorites && (
        <div style={{ marginBottom: 2 }}>
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
              {favoriteWidgets.length}
            </span>
          </button>
          {favoritesOpen && (
            viewMode === 'list' ? (
              <div>
                {favoriteWidgets.map((w) => <WidgetListRow key={w.itemType} w={w} />)}
              </div>
            ) : (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 4,
                padding: isGrid ? '4px 6px' : '4px 8px',
              }}>
                {favoriteWidgets.map((w) => (
                  <WidgetThumbnailCard
                    key={w.itemType} w={w}
                    thumbW={thumbW} thumbH={thumbH} singleLine={isGrid}
                    onQuickPlace={onQuickPlace}
                  />
                ))}
              </div>
            )
          )}
          <div style={{ height: 1, background: 'var(--io-border)', margin: '4px 10px' }} />
        </div>
      )}

      {/* Full widget list */}
      {viewMode === 'list' ? (
        filteredWidgets.map((w) => <WidgetListRow key={w.itemType} w={w} />)
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: isGrid ? '2px 4px' : '2px 6px',
        }}>
          {filteredWidgets.map((w) => (
            <WidgetThumbnailCard
              key={w.itemType}
              w={w}
              thumbW={thumbW}
              thumbH={thumbH}
              singleLine={isGrid}
              onQuickPlace={onQuickPlace}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Points section
// ---------------------------------------------------------------------------

function PointsSection({
  favoriteIds,
  onToggleFavorite,
}: {
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [favoritesOpen, setFavoritesOpen] = useState(true)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }, [])

  const { data: allPoints, isLoading } = useQuery({
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

  // Fetch favorites by IDs so they display even without an active search
  const { data: favPointsData } = useQuery({
    queryKey: ['console-palette-fav-points', [...favoriteIds].sort().join(',')],
    queryFn: async () => {
      if (favoriteIds.size === 0) return []
      const ids = [...favoriteIds].join(',')
      const r = await api.get<{ data: Point[] }>(`/api/points?ids=${encodeURIComponent(ids)}&limit=50`)
      if (!r.success) return []
      return r.data.data ?? []
    },
    staleTime: 60_000,
    enabled: favoriteIds.size > 0,
  })

  const points = allPoints ?? []
  const favPoints = favPointsData ?? []

  const PointRow = ({ pt, inFavGroup }: { pt: Point; inFavGroup?: boolean }) => {
    const [hovering, setHovering] = useState(false)
    const [dragging, setDragging] = useState(false)
    const isFav = favoriteIds.has(pt.id)
    const item: ConsoleDragItem = { itemType: 'trend', label: pt.tagname, pointIds: [pt.id] }

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '0 4px 0 0' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div
          draggable
          style={{ ...listItem(dragging), flex: 1, margin: 0, paddingLeft: inFavGroup ? 14 : 10 }}
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
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(pt.id) }}
          title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 3, flexShrink: 0,
            opacity: isFav || hovering ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
        >
          <StarIcon filled={isFav} />
        </button>
      </div>
    )
  }

  const favoriteItems = favPoints.map((pt) => (
    <PointRow key={`fav-${pt.id}`} pt={pt} inFavGroup />
  ))

  const hasFavorites = favoriteIds.size > 0

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Favorites group always visible */}
      <FavoritesSubGroup items={favoriteItems} />

      {/* Search input */}
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
      {debouncedSearch.length < 2 && !isLoading && !hasFavorites && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          Search to browse points. Drag a point onto a Trend or Table pane to add it.
        </div>
      )}
      {debouncedSearch.length < 2 && !isLoading && hasFavorites && (
        <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          Search to browse more points.
        </div>
      )}

      {/* Search results */}
      {points.map((pt) => (
        <PointRow key={pt.id} pt={pt} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graphic thumbnail tile — drag-to-drop onto console pane
// ---------------------------------------------------------------------------

function GraphicTile({
  item,
  name,
  thumbUrl,
  isFavorite,
  onToggleFavorite,
  onQuickPlace,
}: {
  item: ConsoleDragItem
  name: string
  thumbUrl: string
  isFavorite: boolean
  onToggleFavorite: () => void
  onQuickPlace?: (item: ConsoleDragItem) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  const [hovering, setHovering] = useState(false)

  return (
    <div
      draggable
      onDoubleClick={(e) => { e.stopPropagation(); onQuickPlace?.(item) }}
      style={{
        position: 'relative',
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
      onMouseEnter={(e) => {
        setHovering(true)
        ;(e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)'
      }}
      onMouseLeave={(e) => {
        setHovering(false)
        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
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
      {/* Star overlay — shown on hover or when favorited */}
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleFavorite() }}
        title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
          padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4, flexShrink: 0,
          opacity: isFavorite || hovering ? 1 : 0,
          transition: 'opacity 0.1s',
        }}
      >
        <StarIcon filled={isFavorite} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphicListRow — compact list-view row for a graphic item
// ---------------------------------------------------------------------------

function GraphicListRow({
  item,
  name,
  onQuickPlace,
}: {
  item: ConsoleDragItem
  name: string
  onQuickPlace?: (item: ConsoleDragItem) => void
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      draggable
      onDoubleClick={(e) => { e.stopPropagation(); onQuickPlace?.(item) }}
      style={listItem(dragging)}
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      <span style={{ flex: 1, fontSize: 12, color: 'var(--io-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GraphicThumbnailRow — 48×36 thumbnail + name, for thumbnails view
// ---------------------------------------------------------------------------

function GraphicThumbnailRow({
  item,
  name,
  thumbUrl,
  onQuickPlace,
}: {
  item: ConsoleDragItem
  name: string
  thumbUrl: string
  onQuickPlace?: (item: ConsoleDragItem) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [thumbError, setThumbError] = useState(false)

  return (
    <div
      draggable
      onDoubleClick={(e) => { e.stopPropagation(); onQuickPlace?.(item) }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '4px 6px',
        borderRadius: 'var(--io-radius)',
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        border: '1px solid transparent',
        transition: 'background 0.1s',
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
      {/* 48×36 thumbnail */}
      <div style={{
        width: 48, height: 36, flexShrink: 0,
        background: 'var(--io-surface-sunken)',
        borderRadius: 3,
        border: '1px solid var(--io-border)',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!thumbError ? (
          <img
            src={thumbUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.2" opacity={0.4}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        )}
      </div>
      {/* Name — up to 2 lines */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 11, color: 'var(--io-text-primary)', lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}>
          {name}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graphics section — shows available graphics as thumbnail tiles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Graphic list row — for list view mode
// ---------------------------------------------------------------------------

function GraphicListRow({ g, onQuickPlace }: { g: { id: string; name: string }; onQuickPlace?: (item: ConsoleDragItem) => void }) {
  const [dragging, setDragging] = useState(false)
  const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }

  return (
    <div
      draggable
      style={listItem(dragging)}
      title={g.name}
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--io-text-muted)" strokeWidth="1.2" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {g.name}
      </span>
    </div>
  )
}

function GraphicsSection({
  onQuickPlace,
  viewMode,
  favoriteIds,
  onToggleFavorite,
}: {
  onQuickPlace?: (item: ConsoleDragItem) => void
  viewMode: SectionViewMode
  favoriteIds: Set<string>
  onToggleFavorite: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [favoritesOpen, setFavoritesOpen] = useState(true)
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
  const filteredGraphics = search
    ? graphics.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : graphics

  const favoriteGraphics = filteredGraphics.filter((g) => favoriteIds.has(g.id))
  const hasFavorites = favoriteGraphics.length > 0

  if (isLoading) {
    return (
      <div style={{ padding: '4px 0' }}>
        <FavoritesSubGroup items={[]} />
        <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          Loading…
        </div>
      </div>
    )
  }

  const favoriteItems = favoriteGraphics.map((g) => {
    const thumbUrl = graphicsApi.thumbnailUrl(g.id)
    const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }
    return (
      <GraphicTile
        key={`fav-${g.id}`}
        item={item}
        name={g.name}
        thumbUrl={thumbUrl}
        isFavorite
        onToggleFavorite={() => onToggleFavorite(g.id)}
        onQuickPlace={onQuickPlace}
      />
    )
  })

  if (graphics.length === 0) {
    return (
      <div style={{ padding: '4px 0' }}>
        <FavoritesSubGroup items={[]} />
        <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.5 }}>
          No graphics. Create one in Designer.
        </div>
      </div>
    )
  }

  const isGrid = viewMode === 'grid'

  // Render a single graphic in list mode with an inline star toggle
  function GraphicListRowWithStar({ g }: { g: { id: string; name: string } }) {
    const [hovering, setHovering] = useState(false)
    const fav = favoriteIds.has(g.id)
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '0 4px 0 0' }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <GraphicListRow g={g} onQuickPlace={onQuickPlace} />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(g.id) }}
          title={fav ? 'Remove from Favorites' : 'Add to Favorites'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 3, flexShrink: 0,
            opacity: fav || hovering ? 1 : 0,
            transition: 'opacity 0.1s',
          }}
        >
          <StarIcon filled={fav} />
        </button>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div style={{ padding: '4px' }}>
        {graphics.map((g) => {
          const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }
          return <GraphicListRow key={g.id} item={item} name={g.name} onQuickPlace={onQuickPlace} />
        })}
      </div>
    )
  }

  if (viewMode === 'thumbnails') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 6px' }}>
        {graphics.map((g) => {
          const thumbUrl = graphicsApi.thumbnailUrl(g.id)
          const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }
          return <GraphicThumbnailRow key={g.id} item={item} name={g.name} thumbUrl={thumbUrl} onQuickPlace={onQuickPlace} />
        })}
      </div>
    )
  }

  // Grid view — 80×60 tiles, 2 columns
  return (
    <div style={{ padding: '6px 6px 4px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ padding: '0 0 4px' }}>
        <input
          type="search"
          placeholder="Filter graphics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
      </div>
      {filteredGraphics.length === 0 && (
        <div style={{ padding: '4px 4px', fontSize: 12, color: 'var(--io-text-muted)' }}>
          No matching graphics
        </div>
      )}

      {/* Favorites group — pinned at top, only shown when there are favorites */}
      {hasFavorites && (
        <div style={{ marginBottom: 2 }}>
          <button
            onClick={() => setFavoritesOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              width: '100%', padding: '3px 4px', border: 'none',
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
              {favoriteGraphics.length}
            </span>
          </button>
          {favoritesOpen && (
            viewMode === 'list' ? (
              <div style={{ padding: '0 0 2px' }}>
                {favoriteGraphics.map((g) => <GraphicListRowWithStar key={g.id} g={g} />)}
              </div>
            ) : (
              <div style={{
                display: isGrid ? 'grid' : 'flex',
                gridTemplateColumns: isGrid ? 'repeat(auto-fill, minmax(88px, 1fr))' : undefined,
                flexDirection: isGrid ? undefined : 'column',
                gap: isGrid ? 6 : 3,
                padding: '0 0 2px',
              }}>
                {favoriteGraphics.map((g) => {
                  const thumbUrl = graphicsApi.thumbnailUrl(g.id)
                  const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }
                  return (
                    <GraphicTile key={g.id} item={item} name={g.name} thumbUrl={thumbUrl} onQuickPlace={onQuickPlace} />
                  )
                })}
              </div>
            )
          )}
          <div style={{ height: 1, background: 'var(--io-border)', margin: '4px 4px' }} />
        </div>
      )}

      {/* Full graphics list */}
      {viewMode === 'list' ? (
        <div style={{ padding: '0 0 2px' }}>
          {filteredGraphics.map((g) => (
            <GraphicListRowWithStar key={g.id} g={g} />
          ))}
        </div>
      ) : (
        // Thumbnails (48×36) or Grid (80×60)
        <div style={{
          display: isGrid ? 'grid' : 'flex',
          gridTemplateColumns: isGrid ? 'repeat(auto-fill, minmax(88px, 1fr))' : undefined,
          flexDirection: isGrid ? undefined : 'column',
          gap: isGrid ? 6 : 3,
          padding: '0 0 2px',
        }}>
          {filteredGraphics.map((g) => {
            const thumbUrl = graphicsApi.thumbnailUrl(g.id)
            const item: ConsoleDragItem = { itemType: 'graphic', graphicId: g.id, label: g.name }
            return (
              <GraphicTile key={g.id} item={item} name={g.name} thumbUrl={thumbUrl} onQuickPlace={onQuickPlace} />
            )
          })}
        </div>
      )}
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
    workspaces: true,
    graphics: true,
    widgets: false,
    points: false,
  })

  // Workspace favorites — uses legacy hook for backward-compat with existing LS key
  const { favoriteIds: workspaceFavoriteIds, toggleFavorite: toggleWorkspaceFavorite } = useConsoleWorkspaceFavorites()

  // Graphic, widget, and point favorites — generic hook
  const { favoriteIds: graphicFavoriteIds, toggleFavorite: toggleGraphicFavorite } = useConsoleFavorites(CONSOLE_FAVORITES_KEYS.graphics)
  const { favoriteIds: widgetFavoriteIds, toggleFavorite: toggleWidgetFavorite } = useConsoleFavorites(CONSOLE_FAVORITES_KEYS.widgets)
  const { favoriteIds: pointFavoriteIds, toggleFavorite: togglePointFavorite } = useConsoleFavorites(CONSOLE_FAVORITES_KEYS.points)

  // Per-section view modes — persisted in localStorage
  const { viewMode: workspacesViewMode, setViewMode: setWorkspacesViewMode } = useConsoleSectionViewMode('workspaces', 'list')
  const { viewMode: graphicsViewMode, setViewMode: setGraphicsViewMode } = useConsoleSectionViewMode('graphics', 'thumbnails')
  const { viewMode: widgetsViewMode, setViewMode: setWidgetsViewMode } = useConsoleSectionViewMode('widgets', 'list')

  // Per-section view mode — persisted in localStorage
  const workspacesVM = useConsoleSectionViewMode('workspaces', 'list')
  const graphicsVM = useConsoleSectionViewMode('graphics', 'grid')
  const widgetsVM = useConsoleSectionViewMode('widgets', 'list')

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
          viewMode={workspacesViewMode}
          onViewModeChange={setWorkspacesViewMode}
        >
          <WorkspacesSection
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={onSelectWorkspace}
            favoriteIds={workspaceFavoriteIds}
            onToggleFavorite={toggleWorkspaceFavorite}
            onRenameWorkspace={onRenameWorkspace}
            onDuplicateWorkspace={onDuplicateWorkspace}
            onDeleteWorkspace={onDeleteWorkspace}
            viewMode={workspacesViewMode}
          />
        </AccordionSection>

        <AccordionSection
          title="Graphics"
          open={openSections.graphics}
          onToggle={() => toggleSection('graphics')}
          viewMode={graphicsViewMode}
          onViewModeChange={setGraphicsViewMode}
        >
          <GraphicsSection
            onQuickPlace={onQuickPlace}
            viewMode={graphicsViewMode}
            favoriteIds={graphicFavoriteIds}
            onToggleFavorite={toggleGraphicFavorite}
          />
        </AccordionSection>

        <AccordionSection
          title="Widgets"
          open={openSections.widgets}
          onToggle={() => toggleSection('widgets')}
          viewMode={widgetsViewMode}
          onViewModeChange={setWidgetsViewMode}
        >
          <WidgetsSection
            onQuickPlace={onQuickPlace}
            viewMode={widgetsViewMode}
            favoriteIds={widgetFavoriteIds}
            onToggleFavorite={toggleWidgetFavorite}
          />
        </AccordionSection>

        <AccordionSection
          title="Points"
          open={openSections.points}
          onToggle={() => toggleSection('points')}
          allowAllViewModes={false}
        >
          <PointsSection
            favoriteIds={pointFavoriteIds}
            onToggleFavorite={togglePointFavorite}
          />
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
