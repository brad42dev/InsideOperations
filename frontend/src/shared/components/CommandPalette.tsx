import { useState, useEffect, useRef, useCallback } from 'react'
import { Command, defaultFilter } from 'cmdk'
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

// ─── Prefix scope parsing ────────────────────────────────────────────────────

type PrefixScope = 'commands' | 'points' | 'graphics' | 'entities' | null

interface ParsedQuery {
  scope: PrefixScope
  term: string
  prefix: string
}

function parseQuery(raw: string): ParsedQuery {
  if (raw.startsWith('>')) return { scope: 'commands',  term: raw.slice(1).trimStart(), prefix: '>' }
  if (raw.startsWith('@')) return { scope: 'points',    term: raw.slice(1).trimStart(), prefix: '@' }
  if (raw.startsWith('/')) return { scope: 'graphics',  term: raw.slice(1).trimStart(), prefix: '/' }
  if (raw.startsWith('#')) return { scope: 'entities',  term: raw.slice(1).trimStart(), prefix: '#' }
  return { scope: null, term: raw, prefix: '' }
}

const SCOPE_PLACEHOLDER: Record<NonNullable<PrefixScope>, string> = {
  commands: 'Search navigation commands…',
  points:   'Search point tagnames and descriptions…',
  graphics: 'Search graphics and process views…',
  entities: 'Search dashboards, reports, workspaces, templates…',
}

const SCOPE_TYPES: Partial<Record<NonNullable<PrefixScope>, string[]>> = {
  points:   ['point'],
  graphics: ['graphic'],
  entities: ['dashboard', 'report'],
}

const SCOPE_HINTS: Array<{ prefix: string; label: string }> = [
  { prefix: '>', label: 'commands' },
  { prefix: '@', label: 'points' },
  { prefix: '/', label: 'graphics' },
  { prefix: '#', label: 'entities' },
]

// Prefix used in cmdk item values to mark server-side search results
// so the custom filter can always show them (they're already ranked by the server).
const RESULT_VALUE_PREFIX = '__result__'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { scope, term } = parseQuery(query)

  // Whether to show nav commands for this scope
  const showNavCommands = scope === null || scope === 'commands'

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSearchResults([])
    }
  }, [open])

  // Debounced API search — skipped for command scope (nav-only)
  const apiSearchEnabled = scope !== 'commands'

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!apiSearchEnabled || term.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const types = scope ? (SCOPE_TYPES[scope] ?? undefined) : undefined
    debounceRef.current = setTimeout(() => {
      searchApi
        .search(term, types, 8)
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
  }, [query, term, scope, apiSearchEnabled])

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      onOpenChange(false)
      navigate(result.href)
    },
    [navigate, onOpenChange],
  )

  const handleSelectCommand = useCallback(
    (cmd: PaletteCommand) => {
      onOpenChange(false)
      navigate(cmd.path)
    },
    [navigate, onOpenChange],
  )

  // Custom filter: server results are always shown (ranked by server);
  // nav commands use command-score fuzzy matching.
  const customFilter = useCallback(
    (value: string, search: string, keywords?: string[]) => {
      if (value.startsWith(RESULT_VALUE_PREFIX)) return 1
      return defaultFilter(value, search, keywords)
    },
    [],
  )

  const sectionLabel =
    scope === 'points' ? 'Points' :
    scope === 'graphics' ? 'Graphics' :
    scope === 'entities' ? 'Entities' :
    'Search Results'

  const hasSearchResults = searchResults.length > 0

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command Palette"
      filter={customFilter}
      loop
      style={
        // Command.Dialog renders as a Radix Dialog — set overlay and content
        // z-index via CSS custom properties injected on the cmdk elements.
        // The overlay and content styles are applied via the style tag below.
        undefined
      }
    >
      {/*
        cmdk's Command.Dialog renders:
          <RadixDialog.Portal>
            <RadixDialog.Overlay cmdk-overlay />
            <RadixDialog.Content cmdk-dialog>
              <Command (the root) />
            </RadixDialog.Content>
          </RadixDialog.Portal>

        We target these elements via [cmdk-overlay] and [cmdk-dialog] attribute
        selectors injected via a <style> tag scoped to this component.
      */}
      <style>{`
        [cmdk-overlay] {
          position: fixed;
          inset: 0;
          z-index: 3000;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        [cmdk-dialog] {
          position: fixed;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 3001;
          width: 560px;
          max-width: calc(100vw - 32px);
          background: var(--io-surface-elevated);
          border: 1px solid var(--io-border);
          border-radius: 10px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
      `}</style>

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
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={scope ? SCOPE_PLACEHOLDER[scope] : 'Search pages, points, equipment…'}
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
      <Command.List
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '6px',
        }}
      >
        <Command.Empty
          style={{
            padding: '24px',
            textAlign: 'center',
            color: 'var(--io-text-muted)',
            fontSize: '13px',
          }}
        >
          {term.trim()
            ? <>No results for &ldquo;{term}&rdquo;</>
            : scope
              ? `Type to search ${SCOPE_PLACEHOLDER[scope].toLowerCase().replace('…', '')}`
              : 'No commands found'}
        </Command.Empty>

        {/* Server search results section — always shown when present */}
        {hasSearchResults && (
          <Command.Group
            heading={sectionLabel}
            style={{
              // Group heading style
            }}
          >
            {searchResults.map((result) => (
              <Command.Item
                key={`result-${result.id}`}
                value={`${RESULT_VALUE_PREFIX}${result.id}`}
                onSelect={() => handleSelectResult(result)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '2px',
                }}
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
                      color: 'var(--io-text-primary)',
                    }}
                  >
                    {result.name}
                  </span>
                </div>
                {result.description && (
                  <span style={{ fontSize: '12px', color: 'var(--io-text-muted)', paddingLeft: 2 }}>
                    {result.description}
                  </span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Navigation commands section — fuzzy-matched by cmdk */}
        {showNavCommands && (
          <Command.Group
            heading={hasSearchResults ? 'Navigation' : undefined}
          >
            {COMMANDS.map((cmd) => (
              <Command.Item
                key={cmd.id}
                value={`${cmd.label} ${cmd.description}`}
                keywords={cmd.keywords}
                onSelect={() => handleSelectCommand(cmd)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '2px',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--io-text-primary)',
                  }}
                >
                  {cmd.label}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                  }}
                >
                  {cmd.description}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      {/* Footer hint */}
      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--io-border)',
          display: 'flex',
          gap: '16px',
          fontSize: '11px',
          color: 'var(--io-text-muted)',
          flexWrap: 'wrap',
        }}
      >
        <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate</span>
        <span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> open</span>
        <span><kbd style={{ fontFamily: 'inherit' }}>Esc</kbd> close</span>
        {!scope && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {SCOPE_HINTS.map(({ prefix, label }) => (
              <span key={prefix}>
                <kbd
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 11,
                    background: 'var(--io-surface-secondary)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 3,
                    padding: '0 4px',
                  }}
                >
                  {prefix}
                </kbd>{' '}
                {label}
              </span>
            ))}
          </span>
        )}
        {scope && apiSearchEnabled && term.length >= 2 && (
          <span style={{ marginLeft: 'auto' }}>
            {isSearching ? 'Searching…' : `${searchResults.length} results`}
          </span>
        )}
      </div>
    </Command.Dialog>
  )
}
