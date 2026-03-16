import { useState, useEffect, useRef, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { searchApi, type SearchResult } from '../../api/search'

interface PaletteCommand {
  id: string
  label: string
  description: string
  path: string
  keywords: string[]
}

const COMMANDS: PaletteCommand[] = [
  { id: 'console', label: 'Console', description: 'Multi-pane real-time process graphics', path: '/console', keywords: ['monitor', 'pane', 'graphics', 'realtime'] },
  { id: 'process', label: 'Process', description: 'Large-scale process view', path: '/process', keywords: ['view', 'pid', 'plant', 'overview'] },
  { id: 'designer', label: 'Designer', description: 'Graphics, dashboard, and report editor', path: '/designer', keywords: ['editor', 'create', 'design', 'build'] },
  { id: 'dashboards', label: 'Dashboards', description: 'Widget-based real-time dashboards', path: '/dashboards', keywords: ['widgets', 'tiles', 'kpi'] },
  { id: 'reports', label: 'Reports', description: 'Canned and custom report generation', path: '/reports', keywords: ['pdf', 'export', 'canned', 'schedule'] },
  { id: 'forensics', label: 'Forensics', description: 'Historical data correlation and investigation', path: '/forensics', keywords: ['history', 'investigate', 'correlation', 'trend'] },
  { id: 'log', label: 'Log', description: 'Operational logbook', path: '/log', keywords: ['logbook', 'shift', 'notes', 'handover'] },
  { id: 'rounds', label: 'Rounds', description: 'Equipment inspection checklists', path: '/rounds', keywords: ['inspection', 'checklist', 'mobile', 'field'] },
  { id: 'alerts', label: 'Alerts', description: 'Emergency notifications and mustering', path: '/alerts', keywords: ['emergency', 'notify', 'muster', 'evacuation'] },
  { id: 'shifts', label: 'Shifts', description: 'Shift management and badge events', path: '/shifts', keywords: ['badge', 'shift', 'schedule', 'presence'] },
  { id: 'settings-users', label: 'Settings: Users', description: 'User account management', path: '/settings/users', keywords: ['accounts', 'people', 'admin'] },
  { id: 'settings-roles', label: 'Settings: Roles', description: 'Role and permission management', path: '/settings/roles', keywords: ['permissions', 'rbac', 'access'] },
  { id: 'settings-opc', label: 'Settings: OPC Sources', description: 'OPC UA data source configuration', path: '/settings/opc-sources', keywords: ['opc', 'datasource', 'ua', 'connection'] },
  { id: 'settings-appearance', label: 'Settings: Appearance', description: 'Theme and display settings', path: '/settings/appearance', keywords: ['theme', 'dark', 'light', 'hphmi', 'color'] },
  { id: 'settings-health', label: 'Settings: System Health', description: 'Service health monitoring', path: '/settings/health', keywords: ['status', 'services', 'monitoring', 'health'] },
  { id: 'settings-certificates', label: 'Settings: Certificates', description: 'TLS certificate management', path: '/settings/certificates', keywords: ['tls', 'ssl', 'cert', 'https'] },
  { id: 'settings-backup', label: 'Settings: Backup & Restore', description: 'Database backup and restore', path: '/settings/backup', keywords: ['backup', 'restore', 'export', 'recovery'] },
  { id: 'settings-about', label: 'Settings: About', description: 'Version and build information', path: '/settings/about', keywords: ['version', 'build', 'info', 'about'] },
]

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  point: 'Point',
  equipment: 'Equipment',
  graphic: 'Graphic',
  dashboard: 'Dashboard',
  report: 'Report',
  user: 'User',
  role: 'Role',
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: 'var(--io-accent-subtle)',
          color: 'var(--io-accent)',
          borderRadius: '2px',
          padding: '0 1px',
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ---------------------------------------------------------------------------
// Unified list item types
// ---------------------------------------------------------------------------

type ListItem =
  | { kind: 'command'; cmd: PaletteCommand }
  | { kind: 'result'; result: SearchResult }

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filtered navigation commands
  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q))
    )
  })

  // Build unified list: search results first (when query >= 3 chars), then nav commands
  const items: ListItem[] = [
    ...searchResults.map((r): ListItem => ({ kind: 'result', result: r })),
    ...filteredCommands.map((c): ListItem => ({ kind: 'command', cmd: c })),
  ]

  // Reset selection when query or open state changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSearchResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced API search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 3) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      searchApi
        .search(query, undefined, 8)
        .then((result) => {
          if (result.success) {
            setSearchResults(result.data.results)
          } else {
            setSearchResults([])
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false))
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelectItem = useCallback(
    (item: ListItem) => {
      onOpenChange(false)
      if (item.kind === 'command') {
        navigate(item.cmd.path)
      } else {
        navigate(item.result.href)
      }
    },
    [navigate, onOpenChange],
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selectedIndex]
      if (item) handleSelectItem(item)
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Derive section boundaries for rendering section headers
  const hasSearchResults = searchResults.length > 0
  const hasNavCommands = filteredCommands.length > 0

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        />
        <Dialog.Content
          aria-label="Command palette"
          style={{
            position: 'fixed',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3001,
            width: '560px',
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: '10px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search input row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--io-border)',
            }}
          >
            <span style={{ color: 'var(--io-text-muted)', fontSize: '16px', flexShrink: 0 }}>
              {isSearching ? '⟳' : '⌕'}
            </span>
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls="cmd-results"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, points, equipment..."
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--io-text-primary)',
                fontSize: '15px',
              }}
            />
            <kbd
              style={{
                fontSize: '11px',
                color: 'var(--io-text-muted)',
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: '4px',
                padding: '2px 6px',
                flexShrink: 0,
              }}
            >
              Esc
            </kbd>
          </div>

          {/* Results list */}
          <div
            ref={listRef}
            role="listbox"
            id="cmd-results"
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '6px',
            }}
          >
            {items.length === 0 && !isSearching && (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--io-text-muted)',
                  fontSize: '13px',
                }}
              >
                {query.trim() ? <>No results for &ldquo;{query}&rdquo;</> : 'No commands found'}
              </div>
            )}

            {/* Search results section */}
            {hasSearchResults && (
              <>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--io-text-muted)',
                    padding: '4px 12px 2px',
                  }}
                >
                  Search Results
                </div>
                {searchResults.map((result, i) => {
                  const globalIdx = i
                  const isSelected = globalIdx === selectedIndex
                  return (
                    <button
                      key={`result-${result.id}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectItem({ kind: 'result', result })}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSelected ? 'var(--io-accent-subtle)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: '2px',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'var(--io-accent)',
                            background: 'var(--io-accent-subtle)',
                            border: '1px solid var(--io-accent-subtle)',
                            borderRadius: '3px',
                            padding: '0 4px',
                          }}
                        >
                          {TYPE_LABELS[result.type] ?? result.type}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: isSelected ? 'var(--io-accent)' : 'var(--io-text-primary)',
                          }}
                        >
                          {highlight(result.name, query)}
                        </span>
                      </div>
                      {result.description && (
                        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)', paddingLeft: 2 }}>
                          {highlight(result.description, query)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </>
            )}

            {/* Navigation commands section */}
            {hasNavCommands && (
              <>
                {hasSearchResults && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--io-text-muted)',
                      padding: '8px 12px 2px',
                    }}
                  >
                    Navigation
                  </div>
                )}
                {filteredCommands.map((cmd, i) => {
                  const globalIdx = searchResults.length + i
                  const isSelected = globalIdx === selectedIndex
                  return (
                    <button
                      key={cmd.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectItem({ kind: 'command', cmd })}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSelected ? 'var(--io-accent-subtle)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        gap: '2px',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: isSelected ? 'var(--io-accent)' : 'var(--io-text-primary)',
                        }}
                      >
                        {highlight(cmd.label, query)}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--io-text-muted)',
                        }}
                      >
                        {highlight(cmd.description, query)}
                      </span>
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--io-border)',
              display: 'flex',
              gap: '16px',
              fontSize: '11px',
              color: 'var(--io-text-muted)',
            }}
          >
            <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> open</span>
            <span><kbd style={{ fontFamily: 'inherit' }}>Esc</kbd> close</span>
            {query.length >= 3 && (
              <span style={{ marginLeft: 'auto' }}>
                {isSearching ? 'Searching…' : `${searchResults.length} results`}
              </span>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
