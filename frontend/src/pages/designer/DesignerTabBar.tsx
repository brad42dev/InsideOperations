/**
 * DesignerTabBar.tsx
 *
 * Horizontal tab bar placed between the toolbar and the canvas area.
 * Shows one tab per open graphic. Supports:
 *   - Modified dot (●) when isModified
 *   - Close button (×)
 *   - Active tab highlight
 *   - Horizontal scroll when tabs overflow
 *   - Right-click context menu: Close, Close Others, Close All, Copy Name
 */

import React, { useRef, useCallback, useEffect, useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import type { DesignerTab } from '../../store/designer/tabStore'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignerTabBarProps {
  tabs: DesignerTab[]
  activeTabId: string | null
  onSwitchTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onCloseOthers: (keepTabId: string) => void
  onCloseAll: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(name: string, max = 20): string {
  if (name.length <= max) return name
  return name.slice(0, max) + '\u2026'
}

/** Build the display label for a tab. Group sub-tabs show "Graphic › Group" (truncated). */
function tabLabel(tab: DesignerTab): string {
  if (tab.type === 'group' && tab.groupName) {
    const g = tab.graphicName.length > 12 ? tab.graphicName.slice(0, 12) + '\u2026' : tab.graphicName
    const n = tab.groupName.length > 12 ? tab.groupName.slice(0, 12) + '\u2026' : tab.groupName
    return `${g} \u203a ${n}`
  }
  return truncate(tab.graphicName)
}

// ---------------------------------------------------------------------------
// Single tab item
// ---------------------------------------------------------------------------

interface TabItemProps {
  tab: DesignerTab
  active: boolean
  onSwitch: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
}

function TabItem({ tab, active, onSwitch, onClose, onCloseOthers, onCloseAll }: TabItemProps) {
  const [hovered, setHovered] = useState(false)

  const displayLabel = tabLabel(tab)
  const fullTitle = tab.type === 'group' && tab.groupName
    ? `${tab.graphicName} › ${tab.groupName}`
    : tab.graphicName

  const handleCopyName = useCallback(() => {
    navigator.clipboard.writeText(fullTitle).catch(() => {/* best-effort */})
  }, [fullTitle])

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }, [onClose])

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          role="tab"
          aria-selected={active}
          title={fullTitle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onSwitch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 10px 0 12px',
            height: '100%',
            flexShrink: 0,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontWeight: active ? 600 : 400,
            color: active ? 'var(--io-text-primary)' : 'var(--io-text-secondary)',
            background: active ? 'var(--io-surface-elevated)' : hovered ? 'var(--io-surface-elevated)' : 'var(--io-surface)',
            borderRight: '1px solid var(--io-border)',
            borderBottom: active ? '2px solid var(--io-accent)' : '2px solid transparent',
            transition: 'background 0.1s ease',
            position: 'relative',
            userSelect: 'none',
          }}
        >
          {/* Modified dot */}
          {tab.isModified && (
            <span
              aria-label="unsaved changes"
              style={{
                color: 'var(--io-warning, #f59e0b)',
                fontSize: 14,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              &#9679;
            </span>
          )}

          {/* Label */}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {displayLabel}
          </span>

          {/* Close button — always visible on active, visible on hover otherwise */}
          {(active || hovered) && (
            <button
              onClick={handleClose}
              title="Close tab"
              aria-label={`Close ${fullTitle}`}
              style={{
                flexShrink: 0,
                marginLeft: 4,
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                color: 'var(--io-text-muted)',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
                e.currentTarget.style.color = '#f87171'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--io-text-muted)'
              }}
            >
              &times;
            </button>
          )}

          {/* Placeholder to keep layout stable when close button is hidden */}
          {!active && !hovered && (
            <span style={{ width: 20, flexShrink: 0 }} />
          )}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          style={{
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '4px 0',
            minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 2000,
            fontSize: 13,
          }}
        >
          <ContextMenu.Item
            onSelect={onClose}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'var(--io-text-primary)',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--io-accent)'; e.currentTarget.style.color = '#000' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--io-text-primary)' }}
          >
            Close
            <span style={{ float: 'right', fontSize: 11, opacity: 0.5 }}>Ctrl+W</span>
          </ContextMenu.Item>

          <ContextMenu.Item
            onSelect={onCloseOthers}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'var(--io-text-primary)',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--io-accent)'; e.currentTarget.style.color = '#000' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--io-text-primary)' }}
          >
            Close Others
          </ContextMenu.Item>

          <ContextMenu.Item
            onSelect={onCloseAll}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'var(--io-text-primary)',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--io-accent)'; e.currentTarget.style.color = '#000' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--io-text-primary)' }}
          >
            Close All
          </ContextMenu.Item>

          <ContextMenu.Separator
            style={{
              height: 1,
              background: 'var(--io-border)',
              margin: '4px 0',
            }}
          />

          <ContextMenu.Item
            onSelect={handleCopyName}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              color: 'var(--io-text-primary)',
              outline: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--io-accent)'; e.currentTarget.style.color = '#000' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--io-text-primary)' }}
          >
            Copy Name
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

// ---------------------------------------------------------------------------
// Scroll arrow button
// ---------------------------------------------------------------------------

function ScrollArrow({ direction, onClick, visible }: { direction: 'left' | 'right'; onClick: () => void; visible: boolean }) {
  if (!visible) return null
  return (
    <button
      onClick={onClick}
      aria-label={direction === 'left' ? 'Scroll tabs left' : 'Scroll tabs right'}
      style={{
        flexShrink: 0,
        width: 24,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--io-surface)',
        border: 'none',
        borderRight: direction === 'left' ? '1px solid var(--io-border)' : 'none',
        borderLeft: direction === 'right' ? '1px solid var(--io-border)' : 'none',
        cursor: 'pointer',
        color: 'var(--io-text-muted)',
        fontSize: 12,
        padding: 0,
        zIndex: 1,
      }}
    >
      {direction === 'left' ? '‹' : '›'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// DesignerTabBar
// ---------------------------------------------------------------------------

export default function DesignerTabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
}: DesignerTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Check scroll position
  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll])

  // Re-check when tabs change
  useEffect(() => {
    checkScroll()
  }, [tabs, checkScroll])

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return
    const activeEl = scrollRef.current.querySelector(`[aria-selected="true"]`) as HTMLElement | null
    if (activeEl) {
      activeEl.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
  }, [activeTabId])

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  if (tabs.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Open graphics"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 36,
        flexShrink: 0,
        background: 'var(--io-surface)',
        borderBottom: '1px solid var(--io-border)',
        overflow: 'hidden',
      }}
    >
      {/* Left scroll arrow */}
      <ScrollArrow
        direction="left"
        visible={canScrollLeft}
        onClick={() => scrollBy(-120)}
      />

      {/* Scrollable tab strip */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          // Hide webkit scrollbar
        }}
      >
        <style>{`
          .designer-tab-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="designer-tab-scroll"
          style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}
        >
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              onSwitch={() => onSwitchTab(tab.id)}
              onClose={() => onCloseTab(tab.id)}
              onCloseOthers={() => onCloseOthers(tab.id)}
              onCloseAll={onCloseAll}
            />
          ))}
        </div>
      </div>

      {/* Right scroll arrow */}
      <ScrollArrow
        direction="right"
        visible={canScrollRight}
        onClick={() => scrollBy(120)}
      />
    </div>
  )
}
