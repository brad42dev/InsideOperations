import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Monitor,
  Layers,
  PenTool,
  LayoutDashboard,
  FileText,
  Search,
  BookOpen,
  CheckSquare,
  Bell,
  Users,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import LockOverlay from '../components/LockOverlay'
import EmergencyAlert from '../components/EmergencyAlert'
import CommandPalette from '../components/CommandPalette'
import { SystemHealthDot, SystemHealthDotRow } from '../components/SystemHealthDot'

const IDLE_TIMEOUT_MS = 60_000

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  permission: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Monitoring',
    items: [
      { path: '/console', label: 'Console', icon: Monitor, permission: 'console:read' },
      { path: '/process', label: 'Process', icon: Layers, permission: 'process:read' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard, permission: 'dashboards:read' },
      { path: '/reports', label: 'Reports', icon: FileText, permission: 'reports:read' },
      { path: '/forensics', label: 'Forensics', icon: Search, permission: 'forensics:read' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/log', label: 'Log', icon: BookOpen, permission: 'log:read' },
      { path: '/rounds', label: 'Rounds', icon: CheckSquare, permission: 'rounds:read' },
      { path: '/alerts', label: 'Alerts', icon: Bell, permission: 'alerts:read' },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/shifts', label: 'Shifts', icon: Users, permission: 'shifts:read' },
      { path: '/settings', label: 'Settings', icon: SettingsIcon, permission: 'settings:read' },
      { path: '/designer', label: 'Designer', icon: PenTool, permission: 'designer:read' },
    ],
  },
]

// Flat list derived from groups for compatibility
const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

function getPageTitle(pathname: string): string {
  const item = NAV_ITEMS.find((n) => pathname === n.path || pathname.startsWith(n.path + '/'))
  if (item) return item.label
  if (pathname === '/') return 'Inside/Operations'
  return 'Inside/Operations'
}

// Regex to detect UUID-like segments (uuid v4 or 24-char hex IDs)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_ID_RE = /^[0-9a-f]{20,}$/i

// Map URL path segment → human-readable label
const SEGMENT_LABELS: Record<string, string> = {
  console:     'Console',
  process:     'Process',
  designer:    'Designer',
  dashboards:  'Dashboards',
  reports:     'Reports',
  forensics:   'Forensics',
  log:         'Log',
  rounds:      'Rounds',
  alerts:      'Alerts',
  shifts:      'Shifts',
  settings:    'Settings',
  // Settings sub-pages
  users:       'Users',
  roles:       'Roles',
  sources:     'Sources',
  connections: 'Connections',
  certificates:'Certificates',
  backup:      'Backup',
  system:      'System',
  opc:         'OPC',
  email:       'Email',
  auth:        'Auth',
  // Common sub-pages
  new:         'New',
  edit:        'Edit',
  view:        'View',
  create:      'Create',
  import:      'Import',
  export:      'Export',
}

function segmentLabel(seg: string): string {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg]
  if (UUID_RE.test(seg) || HEX_ID_RE.test(seg)) return 'Detail'
  // Capitalise first letter of unknown segments
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

function buildBreadcrumbs(pathname: string): string[] {
  if (pathname === '/' || pathname === '') return ['Inside/Operations']
  const parts = pathname.split('/').filter(Boolean)
  return parts.map(segmentLabel)
}

/** Fetch unacknowledged alert count for sidebar badge */
function useUnacknowledgedAlertCount(): number {
  const { data } = useQuery<number>({
    queryKey: ['alerts-unacknowledged-count'],
    queryFn: async () => {
      const res = await fetch('/api/alarms/active?unacknowledged=true', {
        headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` },
      })
      if (!res.ok) return 0
      const json = await res.json()
      if (typeof json?.count === 'number') return json.count
      if (Array.isArray(json?.data)) return json.data.length
      return 0
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  })
  return data ?? 0
}

/** Fetch active (in-progress) rounds count for sidebar badge.
 *  Disabled until the Rounds module backend is implemented (Phase 13). */
function useActiveRoundsCount(): number {
  // TODO: enable when /api/v1/rounds is implemented
  return 0
}

function AlertBell() {
  const navigate = useNavigate()
  const count = useUnacknowledgedAlertCount()

  return (
    <button
      onClick={() => navigate('/alerts')}
      title="Alerts"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        color: 'var(--io-text-muted)',
        cursor: 'pointer',
        padding: '6px',
        width: '34px',
        height: '34px',
      }}
    >
      <Bell size={16} />
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            minWidth: '14px',
            height: '14px',
            background: '#ef4444',
            color: '#fff',
            borderRadius: '7px',
            fontSize: '9px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

export default function AppShell() {
  const { user, logout } = useAuthStore()
  const { isKiosk, lock } = useUiStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // 3-state sidebar: 'expanded' | 'collapsed' | 'hidden'
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded')
  const sidebarCollapsed = sidebarState === 'collapsed'
  // sidebarHidden drives the edge-reveal strip
  const sidebarHidden = sidebarState === 'hidden'
  const [sidebarPeek, setSidebarPeek] = useState(false)
  // Collapsed sidebar hover-to-expand overlay (300ms dwell, 200ms retract)
  const [collapsedPeek, setCollapsedPeek] = useState(false)
  const collapsedPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When collapsed but peeking, show full sidebar content as floating overlay
  const sidebarShowFull = !sidebarCollapsed || collapsedPeek
  // Top bar hidden state (Ctrl+Shift+T)
  const [topbarHidden, setTopbarHidden] = useState(false)
  const [topbarPeek, setTopbarPeek] = useState(false)
  const topbarPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuBtnRef = useRef<HTMLButtonElement>(null)
  const [userMenuPos, setUserMenuPos] = useState({ top: 0, right: 0 })
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Sidebar badge counts
  const alertBadgeCount = useUnacknowledgedAlertCount()
  const roundsBadgeCount = useActiveRoundsCount()
  const sidebarBadges: Record<string, number> = {
    '/alerts': alertBadgeCount,
    '/rounds': roundsBadgeCount,
  }

  // Use a ref for the idle timer so the callback is always stable and never stale
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockRef = useRef(lock)
  lockRef.current = lock

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = setTimeout(() => {
      lockRef.current()
    }, IDLE_TIMEOUT_MS)
  }, [])

  // Set up idle detection
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

    function onActivity() {
      resetIdleTimer()
    }

    events.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }))

    // Start the initial timer
    resetIdleTimer()

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onActivity))
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current)
      }
    }
  }, [resetIdleTimer])

  // G-key navigation state (tracks whether 'g' was pressed first)
  const gKeyPending = useRef(false)
  const gKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Global keyboard shortcuts
  useEffect(() => {
    // G-key navigation map: G then <key> → path
    const G_KEY_MAP: Record<string, string> = {
      c: '/console',
      p: '/process',
      b: '/dashboards',
      r: '/reports',
      f: '/forensics',
      l: '/log',
      o: '/rounds',
      a: '/alerts',
      h: '/shifts',
      s: '/settings',
      d: '/designer',
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if inside an input, textarea, or editable element
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+K / Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      // Ctrl+Shift+B — cycle sidebar: expanded → collapsed → hidden → expanded
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'b') {
        e.preventDefault()
        setSidebarState(s => s === 'expanded' ? 'collapsed' : s === 'collapsed' ? 'hidden' : 'expanded')
        return
      }

      // Ctrl+Shift+T — toggle top bar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 't') {
        e.preventDefault()
        setTopbarHidden(v => !v)
        setTopbarPeek(false)
        return
      }

      // G-key sequence: press G, then a letter within 1500ms
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'g') {
        e.preventDefault()
        gKeyPending.current = true
        if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
        gKeyTimerRef.current = setTimeout(() => {
          gKeyPending.current = false
        }, 1500)
        return
      }

      if (gKeyPending.current && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const path = G_KEY_MAP[e.key.toLowerCase()]
        if (path) {
          e.preventDefault()
          gKeyPending.current = false
          if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
          navigate(path)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
    }
  }, [navigate])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const pageTitle = getPageTitle(location.pathname)
  const breadcrumbs = buildBreadcrumbs(location.pathname)

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--io-surface-primary)',
      }}
    >
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar — hidden in kiosk mode */}
      {!isKiosk && (
        <>
          {/* Edge-hover reveal strip when sidebar is hidden */}
          {sidebarHidden && (
            <div
              style={{
                position: 'relative',
                width: 4,
                flexShrink: 0,
                zIndex: 60,
                cursor: 'pointer',
                background: sidebarPeek ? 'var(--io-accent)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={() => setSidebarPeek(true)}
              onMouseLeave={() => setSidebarPeek(false)}
              onClick={() => setSidebarState('expanded')}
              title="Show sidebar"
            >
              {sidebarPeek && (
                <div style={{
                  position: 'absolute',
                  left: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'var(--io-surface)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '0 4px 4px 0',
                  padding: '4px 6px',
                  fontSize: 10,
                  color: 'var(--io-text-muted)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 61,
                }}>
                  › Show sidebar
                </div>
              )}
            </div>
          )}
        <aside
          style={{
            width: sidebarHidden ? 0 : sidebarCollapsed ? 'var(--io-sidebar-collapsed, 48px)' : 'var(--io-sidebar-width, 240px)',
            // When collapsed+peeking: fixed overlay, no flex participation change (content doesn't reflow)
            position: (sidebarCollapsed && collapsedPeek) ? 'fixed' : 'relative',
            left: 0,
            top: 0,
            bottom: 0,
            // Override width for the floating overlay
            ...(sidebarCollapsed && collapsedPeek ? {
              width: 'var(--io-sidebar-width, 240px)',
              zIndex: 200,
              boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
            } : {}),
            background: 'var(--io-surface-secondary)',
            borderRight: sidebarHidden ? 'none' : '1px solid var(--io-border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: sidebarCollapsed && collapsedPeek ? 200 : 50,
            overflow: 'hidden',
            transition: 'width 0.18s ease',
          }}
          className="sidebar"
          onMouseEnter={() => {
            if (!sidebarCollapsed) return
            if (collapsedPeekTimerRef.current) clearTimeout(collapsedPeekTimerRef.current)
            collapsedPeekTimerRef.current = setTimeout(() => setCollapsedPeek(true), 300)
          }}
          onMouseLeave={() => {
            if (!sidebarCollapsed) return
            if (collapsedPeekTimerRef.current) clearTimeout(collapsedPeekTimerRef.current)
            collapsedPeekTimerRef.current = setTimeout(() => setCollapsedPeek(false), 200)
          }}
        >
          {/* Logo / collapse button row */}
          <div
            style={{
              height: 'var(--io-topbar-height)',
              display: 'flex',
              alignItems: 'center',
              padding: sidebarShowFull ? '0 8px 0 16px' : '0 0 0 10px',
              borderBottom: '1px solid var(--io-border)',
              flexShrink: 0,
              gap: '8px',
            }}
          >
            {sidebarShowFull && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'var(--io-accent-subtle)',
                    border: '1px solid var(--io-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--io-accent)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '-0.3px',
                    }}
                  >
                    I/O
                  </span>
                </div>
                <span
                  style={{
                    color: 'var(--io-text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Inside/Operations
                </span>
              </div>
            )}
            {!sidebarShowFull && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'var(--io-accent-subtle)',
                  border: '1px solid var(--io-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: 'var(--io-accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                  I/O
                </span>
              </div>
            )}
            {/* Collapse toggle button — cycles expanded → collapsed → hidden */}
            <button
              onClick={() => {
                setCollapsedPeek(false)
                setSidebarState(s => s === 'expanded' ? 'collapsed' : s === 'collapsed' ? 'hidden' : 'expanded')
              }}
              title={sidebarShowFull ? 'Collapse sidebar (Ctrl+Shift+B)' : 'Expand sidebar'}
              style={{
                flexShrink: 0,
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: '1px solid var(--io-border)',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--io-text-muted)',
                fontSize: '10px',
                marginLeft: sidebarShowFull ? 'auto' : '0',
                padding: 0,
              }}
            >
              {sidebarShowFull ? '‹' : '›'}
            </button>
          </div>

          {/* Nav items — grouped */}
          <nav
            role="navigation"
            aria-label="Main navigation"
            style={{ flex: 1, overflowY: 'auto', padding: sidebarShowFull ? '8px 6px' : '8px 4px' }}
          >
            {NAV_GROUPS.map((group, groupIdx) => {
              const visibleGroupItems = group.items.filter(
                (item) => !item.permission || user?.permissions.includes(item.permission),
              )
              if (visibleGroupItems.length === 0) return null
              return (
                <div key={group.label}>
                  {/* Group separator + label (hidden when not showing full) */}
                  {groupIdx > 0 && (
                    <div
                      style={{
                        height: '1px',
                        background: 'var(--io-border-subtle)',
                        margin: sidebarShowFull ? '6px 8px' : '6px 4px',
                      }}
                    />
                  )}
                  {sidebarShowFull && (
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        color: 'var(--io-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '4px 10px 2px',
                      }}
                    >
                      {group.label}
                    </div>
                  )}
                  {visibleGroupItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={sidebarShowFull ? undefined : item.label}
                      onClick={() => collapsedPeek && setCollapsedPeek(false)}
                      aria-current={
                        location.pathname === item.path ||
                        location.pathname.startsWith(item.path + '/')
                          ? 'page'
                          : undefined
                      }
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: sidebarShowFull ? '10px' : '0',
                        padding: sidebarShowFull ? '7px 10px' : '8px 0',
                        borderRadius: 'var(--io-radius)',
                        marginBottom: '1px',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                        background: isActive ? 'var(--io-accent-subtle)' : 'transparent',
                        transition: 'background var(--io-duration-fast), color var(--io-duration-fast)',
                        justifyContent: sidebarShowFull ? 'flex-start' : 'center',
                        borderLeft: isActive && sidebarShowFull
                          ? '2px solid var(--io-accent)'
                          : '2px solid transparent',
                      })}
                    >
                      <span style={{ width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                        <item.icon size={18} />
                        {!sidebarShowFull && (sidebarBadges[item.path] ?? 0) > 0 && (
                          <span style={{
                            position: 'absolute', top: -3, right: -3,
                            background: 'var(--io-alarm-critical, #ef4444)',
                            color: '#fff', borderRadius: '50%',
                            minWidth: 14, height: 14, fontSize: 9, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1, padding: '0 2px',
                          }}>
                            {(sidebarBadges[item.path] ?? 0) > 99 ? '99+' : sidebarBadges[item.path]}
                          </span>
                        )}
                      </span>
                      {sidebarShowFull && <span style={{ flex: 1 }}>{item.label}</span>}
                      {sidebarShowFull && (sidebarBadges[item.path] ?? 0) > 0 && (
                        <span style={{
                          background: 'var(--io-alarm-critical, #ef4444)',
                          color: '#fff', borderRadius: 10,
                          minWidth: 18, height: 18, fontSize: 10, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px', flexShrink: 0,
                        }}>
                          {(sidebarBadges[item.path] ?? 0) > 99 ? '99+' : sidebarBadges[item.path]}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )
            })}
          </nav>

          {/* Sidebar footer — system health dots */}
          <div
            style={{
              padding: sidebarShowFull ? '10px 12px' : '10px 6px',
              borderTop: '1px solid var(--io-border)',
              display: 'flex',
              flexDirection: sidebarShowFull ? 'column' : 'row',
              alignItems: sidebarShowFull ? 'flex-start' : 'center',
              justifyContent: sidebarShowFull ? 'flex-start' : 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            {!sidebarShowFull ? (
              <SystemHealthDot />
            ) : (
              <>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Services
                </span>
                <SystemHealthDotRow />
              </>
            )}
          </div>
        </aside>
        </>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Edge-hover strip for hidden topbar */}
        {topbarHidden && !isKiosk && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: sidebarHidden ? 0 : sidebarCollapsed ? 'var(--io-sidebar-collapsed, 48px)' : 'var(--io-sidebar-width, 240px)',
              right: 0,
              height: 8,
              zIndex: 200,
              cursor: 'pointer',
            }}
            onMouseEnter={() => {
              if (topbarPeekTimerRef.current) clearTimeout(topbarPeekTimerRef.current)
              topbarPeekTimerRef.current = setTimeout(() => setTopbarPeek(true), 200)
            }}
            onMouseLeave={() => {
              if (topbarPeekTimerRef.current) clearTimeout(topbarPeekTimerRef.current)
              topbarPeekTimerRef.current = setTimeout(() => setTopbarPeek(false), 400)
            }}
          />
        )}
        {/* Peek overlay when topbar is hidden but mouse is at top edge */}
        {topbarHidden && topbarPeek && !isKiosk && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: sidebarHidden ? 0 : sidebarCollapsed ? 'var(--io-sidebar-collapsed, 48px)' : 'var(--io-sidebar-width, 240px)',
              right: 0,
              zIndex: 200,
              background: 'var(--io-surface-secondary)',
              borderBottom: '1px solid var(--io-border)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
            onMouseEnter={() => {
              if (topbarPeekTimerRef.current) clearTimeout(topbarPeekTimerRef.current)
            }}
            onMouseLeave={() => {
              if (topbarPeekTimerRef.current) clearTimeout(topbarPeekTimerRef.current)
              topbarPeekTimerRef.current = setTimeout(() => setTopbarPeek(false), 400)
            }}
          >
            <button
              onClick={() => { setTopbarHidden(false); setTopbarPeek(false) }}
              title="Show top bar (Ctrl+Shift+T)"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 6,
                background: 'var(--io-accent-subtle)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                color: 'var(--io-accent)',
              }}
            >
              ▼
            </button>
          </div>
        )}
        {/* Topbar — must form its own stacking context (position+zIndex) so that
            dropdown menus appear above module workspace content regardless of what
            z-index values modules use internally. */}
        <header
          style={{
            height: (!isKiosk && topbarHidden) ? 0 : 'var(--io-topbar-height)',
            overflow: 'hidden',
            background: 'var(--io-surface-secondary)',
            borderBottom: (!isKiosk && topbarHidden) ? 'none' : '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: (!isKiosk && topbarHidden) ? 0 : '0 20px',
            flexShrink: 0,
            position: 'relative',
            zIndex: 3000,
            transition: 'height 0.25s ease',
          }}
        >
          {/* Hamburger for mobile */}
          {!isKiosk && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="hamburger"
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: 'var(--io-text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '18px',
                marginRight: '12px',
              }}
            >
              ☰
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            {breadcrumbs.length > 1 ? (
              <>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--io-text-primary)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {pageTitle}
                </h1>
                <div
                  aria-label="Breadcrumb"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--io-text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {breadcrumbs.map((crumb, idx) => (
                    <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {idx > 0 && <span style={{ opacity: 0.5 }}>›</span>}
                      <span>{crumb}</span>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <h1
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--io-text-primary)',
                }}
              >
                {pageTitle}
              </h1>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Command palette trigger button */}
            {!isKiosk && (
              <button
                onClick={() => setPaletteOpen(true)}
                title="Command palette (Ctrl+K)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-muted)',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontSize: '14px' }}>⌕</span>
                <span>Search</span>
                <kbd
                  style={{
                    fontSize: '10px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontFamily: 'inherit',
                  }}
                >
                  ⌃K
                </kbd>
              </button>
            )}

            {/* Alert notification bell */}
            {!isKiosk && <AlertBell />}

            {/* Hide top bar button */}
            {!isKiosk && (
              <button
                onClick={() => setTopbarHidden(true)}
                title="Hide top bar (Ctrl+Shift+T)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  width: '34px',
                  height: '34px',
                  fontSize: '12px',
                }}
              >
                ▲
              </button>
            )}

            {/* User menu */}
            {!isKiosk && (
              <div style={{ position: 'relative' }}>
                <button
                  ref={userMenuBtnRef}
                  onClick={() => {
                    if (!userMenuOpen && userMenuBtnRef.current) {
                      const r = userMenuBtnRef.current.getBoundingClientRect()
                      setUserMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
                    }
                    setUserMenuOpen((v) => !v)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'none',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    color: 'var(--io-text-secondary)',
                    cursor: 'pointer',
                    padding: '5px 10px',
                    fontSize: '13px',
                  }}
                >
                  <span
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--io-accent-subtle)',
                      border: '1px solid var(--io-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--io-accent)',
                      fontSize: '11px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {(user?.username ?? 'U').charAt(0).toUpperCase()}
                  </span>
                  <span>{user?.username ?? 'User'}</span>
                  <span style={{ fontSize: '10px' }}>▾</span>
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      onClick={() => setUserMenuOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 2999 }}
                    />
                    <div
                      style={{
                        position: 'fixed',
                        top: userMenuPos.top,
                        right: userMenuPos.right,
                        minWidth: '180px',
                        background: 'var(--io-surface-elevated)',
                        border: '1px solid var(--io-border)',
                        borderRadius: 'var(--io-radius)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        zIndex: 3000,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid var(--io-border)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--io-text-primary)',
                          }}
                        >
                          {user?.full_name ?? user?.username}
                        </div>
                        {user?.full_name && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--io-text-muted)',
                              marginTop: '2px',
                            }}
                          >
                            {user.email}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleLogout}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--io-text-secondary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>↩</span> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--io-surface-primary)',
          }}
          className="main-content"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar — 5 primary nav items, visible only on mobile */}
      {!isKiosk && (
        <nav
          className="mobile-bottom-bar"
          style={{
            display: 'none', // shown via CSS media query
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '56px',
            background: 'var(--io-surface-secondary)',
            borderTop: '1px solid var(--io-border)',
            zIndex: 60,
            alignItems: 'stretch',
          }}
        >
          {[
            { path: '/console', label: 'Console', icon: Monitor },
            { path: '/process', label: 'Process', icon: Layers },
            { path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
            { path: '/alerts', label: 'Alerts', icon: Bell },
            { path: '/settings', label: 'Settings', icon: SettingsIcon },
          ].map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + '/')
            return (
              <NavLink
                key={path}
                to={path}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  textDecoration: 'none',
                  color: active ? 'var(--io-accent)' : 'var(--io-text-muted)',
                  fontSize: '10px',
                  fontWeight: active ? 600 : 400,
                  padding: '6px 0',
                  borderTop: active ? '2px solid var(--io-accent)' : '2px solid transparent',
                  background: 'none',
                }}
              >
                <Icon size={20} />
                {label}
              </NavLink>
            )
          })}
        </nav>
      )}

      {/* Overlays — mounted at the AppShell level */}
      <LockOverlay />
      <EmergencyAlert />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      <style>{`
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform 0.2s; }
          .sidebar.open { transform: translateX(0); }
          .hamburger { display: flex !important; }
          .mobile-overlay { display: block !important; }
          .mobile-bottom-bar { display: flex !important; }
          .main-content { padding-bottom: 56px; }
        }
      `}</style>
    </div>
  )
}
