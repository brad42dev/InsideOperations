import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import LockOverlay from '../components/LockOverlay'
import EmergencyAlert from '../components/EmergencyAlert'
import CommandPalette from '../components/CommandPalette'
import { SystemHealthDot } from '../components/SystemHealthDot'

const IDLE_TIMEOUT_MS = 60_000

interface NavItem {
  path: string
  label: string
  icon: string
  permission: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/console', label: 'Console', icon: '⬛', permission: 'console:read' },
  { path: '/process', label: 'Process', icon: '⚙', permission: 'process:read' },
  { path: '/designer', label: 'Designer', icon: '✏', permission: 'designer:read' },
  { path: '/dashboards', label: 'Dashboards', icon: '▦', permission: 'dashboards:read' },
  { path: '/reports', label: 'Reports', icon: '📄', permission: 'reports:read' },
  { path: '/forensics', label: 'Forensics', icon: '🔍', permission: 'forensics:read' },
  { path: '/log', label: 'Log', icon: '📝', permission: 'log:read' },
  { path: '/rounds', label: 'Rounds', icon: '✓', permission: 'rounds:read' },
  { path: '/alerts', label: 'Alerts', icon: '🔔', permission: 'alerts:read' },
  { path: '/shifts', label: 'Shifts', icon: '🕐', permission: 'shifts:read' },
  { path: '/settings', label: 'Settings', icon: '⚙', permission: 'settings:read' },
]

function getPageTitle(pathname: string): string {
  const item = NAV_ITEMS.find((n) => pathname === n.path || pathname.startsWith(n.path + '/'))
  if (item) return item.label
  if (pathname === '/') return 'Inside/Operations'
  return 'Inside/Operations'
}

export default function AppShell() {
  const { user, logout } = useAuthStore()
  const { isKiosk, lock } = useUiStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

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

  // Global Ctrl+K / Cmd+K listener for command palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  )

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const pageTitle = getPageTitle(location.pathname)

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
        <aside
          style={{
            width: 'var(--io-sidebar-width)',
            background: 'var(--io-surface-secondary)',
            borderRight: '1px solid var(--io-border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 50,
            overflow: 'hidden',
          }}
          className="sidebar"
        >
          {/* Logo */}
          <div
            style={{
              height: 'var(--io-topbar-height)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid var(--io-border)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          </div>

          {/* Nav items */}
          <nav role="navigation" aria-label="Main navigation" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {visibleItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                aria-current={location.pathname === item.path || location.pathname.startsWith(item.path + '/') ? 'page' : undefined}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: 'var(--io-radius)',
                  marginBottom: '2px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                  background: isActive ? 'var(--io-accent-subtle)' : 'transparent',
                  transition: 'background 0.1s, color 0.1s',
                })}
              >
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Sidebar footer — system health dot */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--io-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <SystemHealthDot />
            <span
              style={{
                fontSize: '11px',
                color: 'var(--io-text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Inside/Operations
            </span>
          </div>
        </aside>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header
          style={{
            height: 'var(--io-topbar-height)',
            background: 'var(--io-surface-secondary)',
            borderBottom: '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
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

            {/* User menu */}
            {!isKiosk && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
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
                      style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 6px)',
                        minWidth: '180px',
                        background: 'var(--io-surface-elevated)',
                        border: '1px solid var(--io-border)',
                        borderRadius: 'var(--io-radius)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        zIndex: 99,
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
        >
          <Outlet />
        </main>
      </div>

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
        }
      `}</style>
    </div>
  )
}
