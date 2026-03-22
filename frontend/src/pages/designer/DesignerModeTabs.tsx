/**
 * DesignerModeTabs.tsx
 *
 * 36px mode-tab bar that sits above the toolbar in the Designer layout.
 * Contains Graphic / Dashboard / Report tabs and a File dropdown menu.
 *
 * Layout:
 *   ┌──────────────┬──────────────┬──────────────┬─────────────────────────────┐
 *   │  ◆ Graphic   │  ▦ Dashboard │  📄 Report   │                  [File ▾]   │
 *   └──────────────┴──────────────┴──────────────┴─────────────────────────────┘
 */

import { useEffect, useRef, useState } from 'react'
import { useSceneStore } from '../../store/designer'
import { useDesignerPermissions } from '../../shared/hooks/usePermission'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerModeTabsProps {
  canPublish?: boolean
  onSave?: () => void
  onShowVersionHistory?: () => void
  onValidateBindings?: () => void
  onImport?: () => void
  onExport?: () => void
  onPublish?: () => void
  onNew?: () => void
  onOpen?: () => void
  onProperties?: () => void
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type DesignMode = 'graphic' | 'dashboard' | 'report'

interface TabDef {
  mode: DesignMode
  icon: string
  label: string
}

const TABS: TabDef[] = [
  { mode: 'graphic',   icon: '◆', label: 'Graphic'   },
  { mode: 'dashboard', icon: '▦', label: 'Dashboard' },
  { mode: 'report',    icon: '📄', label: 'Report'    },
]

// ---------------------------------------------------------------------------
// File menu item type
// ---------------------------------------------------------------------------

interface MenuItemDef {
  label: string
  shortcut?: string
  action?: () => void
  accent?: boolean
  divider?: false
}

interface MenuDividerDef {
  divider: true
}

type MenuItem = MenuItemDef | MenuDividerDef

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DesignerModeTabs({
  canPublish = false,
  onSave,
  onShowVersionHistory,
  onValidateBindings,
  onImport,
  onExport,
  onPublish,
  onNew,
  onOpen,
  onProperties,
}: DesignerModeTabsProps) {
  const designMode    = useSceneStore(s => s.designMode)
  const setDesignMode = useSceneStore(s => s.setDesignMode)
  const perms = useDesignerPermissions()

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close file menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [fileMenuOpen])

  const menuItems: MenuItem[] = [
    { label: 'New Graphic…',       action: () => { onNew?.(); setFileMenuOpen(false) } },
    { label: 'Open…',              action: () => { onOpen?.(); setFileMenuOpen(false) } },
    { label: 'Save',               shortcut: 'Ctrl+S', action: perms.canWrite ? () => { onSave?.(); setFileMenuOpen(false) } : undefined },
    { divider: true },
    { label: 'Properties…',        action: () => { onProperties?.(); setFileMenuOpen(false) } },
    { divider: true },
    { label: 'Import .iographic…', action: perms.canImport ? () => { onImport?.(); setFileMenuOpen(false) } : undefined },
    { label: 'Export .iographic',  action: perms.canExport ? () => { onExport?.(); setFileMenuOpen(false) } : undefined },
    { divider: true },
    { label: 'Version History…',   action: () => { onShowVersionHistory?.(); setFileMenuOpen(false) } },
    { label: 'Validate Bindings…', action: () => { onValidateBindings?.(); setFileMenuOpen(false) } },
    ...(canPublish && perms.canPublish
      ? [{ divider: true as const }, { label: 'Publish…', action: () => { onPublish?.(); setFileMenuOpen(false) }, accent: true }]
      : []),
  ]

  return (
    <div style={{
      height: 36,
      background: 'var(--io-surface)',
      borderBottom: '1px solid var(--io-border)',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
    }}>

      {/* Tabs */}
      {TABS.map(({ mode, icon, label }) => {
        const isActive = designMode === mode
        return (
          <button
            key={mode}
            onClick={() => setDesignMode(mode)}
            style={{
              minWidth: 120,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 16px',
              background: isActive ? 'var(--io-surface-elevated)' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--io-accent)' : '2px solid transparent',
              color: isActive ? 'var(--io-text-primary)' : 'var(--io-text-secondary)',
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              transition: 'color 0.12s, background 0.12s',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-elevated)'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }
            }}
          >
            <span style={{ fontSize: mode === 'report' ? 13 : 11 }}>{icon}</span>
            <span>{label}</span>
          </button>
        )
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* File dropdown */}
      <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }} ref={menuRef}>
        <button
          onClick={() => setFileMenuOpen(v => !v)}
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 16px',
            background: fileMenuOpen ? 'var(--io-surface-elevated)' : 'transparent',
            border: 'none',
            borderBottom: '2px solid transparent',
            color: 'var(--io-text-secondary)',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'color 0.12s, background 0.12s',
            boxSizing: 'border-box',
          }}
          onMouseEnter={e => {
            if (!fileMenuOpen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-elevated)'
          }}
          onMouseLeave={e => {
            if (!fileMenuOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          File
          <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
        </button>

        {fileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            zIndex: 300,
            minWidth: 200,
            overflow: 'hidden',
          }}>
            {menuItems.map((item, idx) => {
              if ('divider' in item && item.divider) {
                return (
                  <div
                    key={`divider-${idx}`}
                    style={{
                      height: 1,
                      background: 'var(--io-border)',
                      margin: '2px 0',
                    }}
                  />
                )
              }
              const mi = item as MenuItemDef
              return (
                <div
                  key={mi.label}
                  onClick={mi.action}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 14px',
                    fontSize: 13,
                    color: mi.accent ? 'var(--io-accent)' : 'var(--io-text-primary)',
                    cursor: 'pointer',
                    gap: 24,
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--io-surface)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span>{mi.label}</span>
                  {mi.shortcut && (
                    <span style={{ fontSize: 11, color: 'var(--io-text-muted)', flexShrink: 0 }}>
                      {mi.shortcut}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
