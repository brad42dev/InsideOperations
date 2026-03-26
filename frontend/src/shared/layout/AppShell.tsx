import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { NavLink, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Monitor,
  Layers,
  LayoutDashboard,
  Bell,
  Settings as SettingsIcon,
  CheckSquare,
  BookOpen,
  MoreHorizontal,
  Download,
  Info,
  Lock,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useUiStore } from '../../store/ui'
import { showToast, useToastStore } from '../components/Toast'
import NotificationHistoryPanel from '../components/NotificationHistoryPanel'
import LockOverlay from '../components/LockOverlay'
import EmergencyAlert from '../components/EmergencyAlert'
import CommandPalette from '../components/CommandPalette'
import KeyboardHelpOverlay from '../components/KeyboardHelpOverlay'
import PopupBlockedBanner, {
  PopupBlockedIndicator,
  usePopupBlockedState,
} from '../components/PopupBlockedBanner'
import { SystemHealthDot, SystemHealthDotRow } from '../components/SystemHealthDot'
import { authApi } from '../../api/auth'
import { wsManager } from '../hooks/useWebSocket'
import { ROUTE_REGISTRY, getSidebarGroups, type NavGroup } from '../routes/registry'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes per spec

// G-key navigation map: single letter → route path (e.g. 'c' → '/console').
// Derived from ROUTE_REGISTRY at module level so it can be used for rendering.
const G_KEY_MAP: Record<string, string> = Object.fromEntries(
  ROUTE_REGISTRY.filter((r) => r.g_key)
    .map((r) => [r.g_key.split(' ')[1].toLowerCase(), r.path]),
)

// G-key state at module level so React Strict Mode double-mount does not reset it.
// React 18 Strict Mode unmounts + remounts components in development; a useRef
// declared inside the component is reset to its initial value on remount, which
// causes gKeyPending to be false when the second letter arrives.  Moving these
// outside the component ensures they survive the remount cycle.
const _gKeyPending = { current: false }
const _gKeyTimerRef: { current: ReturnType<typeof setTimeout> | null } = { current: null }
// Setter ref: the live component instance registers its setGKeyHintVisible here
// so the module-level keyboard handler always calls the active setter.
const _setGKeyHintVisible: { current: ((v: boolean) => void) | null } = { current: null }
// Navigate ref: the live component instance registers the React Router navigate
// function here so the module-level keyboard handler can call it without
// capturing a stale component-level useRef in a closed-over effect.
// Updated directly in the render body so it is never null when a keydown fires.
const _navigateRef: { current: ((path: string) => void) | null } = { current: null }

// Bare modifier key names — used by the G-key handler to ignore isolated
// modifier presses (Shift, CapsLock, etc.) without cancelling the pending state.
const _GKEY_MODIFIER_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'FnLock',
  'Hyper', 'Super', 'Symbol', 'SymbolLock', 'NumLock', 'ScrollLock',
])

function getPageTitle(pathname: string): string {
  const route = ROUTE_REGISTRY.find(
    (r) => pathname === r.path || pathname.startsWith(r.path + '/'),
  )
  if (route) return route.sidebar_label
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

interface Crumb { label: string; path: string }

function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/' || pathname === '') return [{ label: 'Inside/Operations', path: '/' }]
  const parts = pathname.split('/').filter(Boolean)
  return parts.map((seg, idx) => ({
    label: segmentLabel(seg),
    path: '/' + parts.slice(0, idx + 1).join('/'),
  }))
}

/** Fetch unacknowledged alert count for sidebar badge.
 *
 * Strategy (spec: "Real-time count updates via WebSocket subscription"):
 * 1. Bootstrap the initial count via REST on mount.
 * 2. Subscribe to WS alarm events so the count updates within 1-2 seconds
 *    of a new alarm arriving or an existing one being acknowledged.
 * 3. No polling interval — the badge is kept current by the WS subscription.
 */
function useUnacknowledgedAlertCount(): number {
  const { data: bootstrapCount } = useQuery<number>({
    queryKey: ['alerts-unacknowledged-count'],
    queryFn: async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        try {
          const res = await fetch('/api/alarms/active?unacknowledged=true', {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` },
          })
          clearTimeout(timeoutId)
          if (!res.ok) return 0
          const json = await res.json()
          if (typeof json?.count === 'number') return json.count
          if (Array.isArray(json?.data)) return json.data.length
          return 0
        } catch (err) {
          clearTimeout(timeoutId)
          throw err
        }
      } catch {
        return 0
      }
    },
    // No refetchInterval — WS subscription keeps the count current.
    staleTime: Infinity,
  })

  // Live count is seeded from the REST bootstrap and then updated by WS events.
  const [liveCount, setLiveCount] = useState<number | undefined>(undefined)

  // Seed liveCount from the REST response on first successful fetch.
  useEffect(() => {
    if (bootstrapCount !== undefined && liveCount === undefined) {
      setLiveCount(bootstrapCount)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapCount])

  // Subscribe to WS alarm events and update the count in real time.
  useEffect(() => {
    // alarm_count_update carries an absolute count — use it directly.
    const offCount = wsManager.onAlarmCountUpdate((event) => {
      setLiveCount(event.unacknowledged)
    })

    // alarm_created: broker may include the new absolute count, or we increment.
    const offCreated = wsManager.onAlarmCreated((event) => {
      if (typeof event.unacknowledged_count === 'number') {
        setLiveCount(event.unacknowledged_count)
      } else {
        setLiveCount((prev) => (prev ?? 0) + 1)
      }
    })

    // alarm_acknowledged: broker may include the new absolute count, or we decrement.
    const offAcknowledged = wsManager.onAlarmAcknowledged((event) => {
      if (typeof event.unacknowledged_count === 'number') {
        setLiveCount(event.unacknowledged_count)
      } else {
        setLiveCount((prev) => Math.max(0, (prev ?? 0) - 1))
      }
    })

    return () => {
      offCount()
      offCreated()
      offAcknowledged()
    }
  }, [])

  return liveCount ?? bootstrapCount ?? 0
}

/** Fetch active (in-progress) rounds count for sidebar badge. */
function useActiveRoundsCount(): number {
  // TODO(DD-06-024): rounds count wired to GET /api/v1/rounds?status=in_progress
  const { data } = useQuery<number>({
    queryKey: ['rounds-active-count'],
    queryFn: async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        try {
          const res = await fetch('/api/v1/rounds?status=in_progress&limit=1', {
            signal: controller.signal,
            headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` },
          })
          clearTimeout(timeoutId)
          if (!res.ok) return 0
          const json = await res.json()
          if (typeof json?.total === 'number') return json.total
          if (Array.isArray(json?.data)) return json.data.length
          return 0
        } catch (err) {
          clearTimeout(timeoutId)
          throw err
        }
      } catch {
        return 0
      }
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  })
  return data ?? 0
}

// Severity sort order for alert dropdown panel
const SEVERITY_ORDER: Record<string, number> = {
  EMERGENCY: 0,
  CRITICAL: 1,
  WARNING: 2,
  INFO: 3,
}

interface AlertRow {
  id: string
  severity: string
  title: string
  created_at?: string
  timestamp?: string
  acknowledged?: boolean
}

const SEVERITY_ICONS: Record<string, string> = {
  EMERGENCY: '🔴',
  CRITICAL: '🟠',
  WARNING: '🟡',
  INFO: '🔵',
}

function formatRelative(ts?: string): string {
  if (!ts) return ''
  const ms = Date.now() - new Date(ts).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

function AlertBell() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 })
  const count = useUnacknowledgedAlertCount()
  const canAcknowledge = user?.permissions.includes('alerts:acknowledge') ?? false

  // Fetch recent alerts when panel opens
  const { data: recentAlertsRaw } = useQuery<AlertRow[]>({
    queryKey: ['alerts-recent-panel'],
    queryFn: () =>
      fetch('/api/alarms/active?limit=20', {
        headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` },
      }).then((r) => r.json()).then((json) => {
        if (Array.isArray(json)) return json as AlertRow[]
        if (Array.isArray(json?.data)) return json.data as AlertRow[]
        return []
      }),
    enabled: panelOpen,
  })

  const recentAlerts = (recentAlertsRaw ?? [])
    .slice()
    .sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity?.toUpperCase() ?? ''] ?? 99
      const sb = SEVERITY_ORDER[b.severity?.toUpperCase() ?? ''] ?? 99
      return sa - sb
    })

  function handleOpen() {
    if (!panelOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPanelPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setPanelOpen((v) => !v)
  }

  function handleAcknowledge(alertId: string) {
    const token = localStorage.getItem('io_access_token') ?? ''
    fetch(`/api/alarms/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }).catch(() => {/* best-effort */})
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
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
              background: 'var(--io-alarm-critical)',
              color: 'var(--io-text-inverse)',
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
      {panelOpen && (
        <>
          {/* Click-away backdrop */}
          <div
            onClick={() => setPanelOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          />
          {/* Dropdown panel */}
          <div
            style={{
              position: 'fixed',
              top: panelPos.top,
              right: panelPos.right,
              width: '360px',
              maxHeight: '480px',
              overflowY: 'auto',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              boxShadow: 'var(--io-shadow-lg)',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Panel header */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--io-border)',
                fontWeight: 600,
                fontSize: '13px',
                color: 'var(--io-text-primary)',
                flexShrink: 0,
              }}
            >
              Recent Alerts
            </div>

            {/* Alert rows */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {recentAlerts.length === 0 ? (
                <div
                  style={{
                    padding: '24px 14px',
                    textAlign: 'center',
                    color: 'var(--io-text-muted)',
                    fontSize: '13px',
                  }}
                >
                  No unacknowledged alerts
                </div>
              ) : (
                recentAlerts.map((alert) => {
                  const sev = alert.severity?.toUpperCase() ?? 'INFO'
                  const icon = SEVERITY_ICONS[sev] ?? '⚪'
                  const ts = alert.created_at ?? alert.timestamp
                  return (
                    <div
                      key={alert.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--io-border)',
                        fontSize: '13px',
                      }}
                    >
                      {/* Severity icon */}
                      <span style={{ flexShrink: 0, fontSize: '14px' }} title={sev}>
                        {icon}
                      </span>

                      {/* Title + timestamp */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: 'var(--io-text-primary)',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {alert.title}
                        </div>
                        <div style={{ color: 'var(--io-text-muted)', fontSize: '11px', marginTop: '2px' }}>
                          {formatRelative(ts)}
                        </div>
                      </div>

                      {/* Acknowledge button — hidden when user lacks permission */}
                      {canAcknowledge && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          style={{
                            flexShrink: 0,
                            fontSize: '11px',
                            padding: '3px 8px',
                            background: 'none',
                            border: '1px solid var(--io-border)',
                            borderRadius: 'var(--io-radius)',
                            color: 'var(--io-text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          Ack
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer: View all alerts */}
            <div
              style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--io-border)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => { setPanelOpen(false); navigate('/alerts') }}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--io-accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                View all alerts
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// CornerTrigger — detects mouse dwell in a 48×48px screen corner zone.
// Uses a global document mousemove listener (not onMouseEnter on a div) so that
// it works reliably regardless of element stacking order and in automated tests
// that dispatch synthetic mousemove events.  Dwelling for 1500ms reveals a
// semi-transparent "Exit Kiosk" button positioned near the corner.
// Only rendered when isKiosk is true.
type CornerPosition = 'tl' | 'tr' | 'bl' | 'br'

// Corner zone size in pixels — cursor must stay within this square of the corner.
const CORNER_ZONE = 48

interface CornerTriggerProps {
  corner: CornerPosition
  onDwellComplete: () => void
}

function CornerTrigger({ corner, onDwellComplete }: CornerTriggerProps) {
  const [showButton, setShowButton] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inZoneRef = useRef(false)

  useEffect(() => {
    function isInCorner(x: number, y: number): boolean {
      const w = window.innerWidth
      const h = window.innerHeight
      switch (corner) {
        case 'tl': return x <= CORNER_ZONE && y <= CORNER_ZONE
        case 'tr': return x >= w - CORNER_ZONE && y <= CORNER_ZONE
        case 'bl': return x <= CORNER_ZONE && y >= h - CORNER_ZONE
        case 'br': return x >= w - CORNER_ZONE && y >= h - CORNER_ZONE
      }
    }

    function handleMouseMove(e: MouseEvent) {
      const inside = isInCorner(e.clientX, e.clientY)
      if (inside && !inZoneRef.current) {
        // Entered corner zone — start dwell timer
        inZoneRef.current = true
        timerRef.current = setTimeout(() => setShowButton(true), 1500)
      } else if (!inside && inZoneRef.current) {
        // Left corner zone — cancel timer and hide button
        inZoneRef.current = false
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setShowButton(false)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [corner])

  const containerStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    pointerEvents: 'none',
    ...(corner === 'tl' ? { top: 0, left: 0 } : {}),
    ...(corner === 'tr' ? { top: 0, right: 0 } : {}),
    ...(corner === 'bl' ? { bottom: 0, left: 0 } : {}),
    ...(corner === 'br' ? { bottom: 0, right: 0 } : {}),
  }

  const buttonStyle: CSSProperties = {
    pointerEvents: 'auto',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'block',
    margin: 4,
  }

  return (
    <div
      style={containerStyle}
      data-testid={`kiosk-corner-trigger-${corner}`}
    >
      {showButton && (
        <button
          style={buttonStyle}
          data-testid="kiosk-exit-button"
          onClick={onDwellComplete}
        >
          Exit Kiosk
        </button>
      )}
    </div>
  )
}

export default function AppShell() {
  const { user, logout } = useAuthStore()
  const { isKiosk, isLocked, lock, unlock, setLockMeta, setKiosk, theme, setTheme } = useUiStore()

  // Derive sidebar groups from the central route registry, filtered by user permissions
  const navGroups: NavGroup[] = getSidebarGroups(user?.permissions ?? [])
  const navigate = useNavigate()
  // Update the module-level navigate ref on every render so the keyboard handler
  // always calls the live navigate function even after Strict Mode double-mounts.
  // Assigned in render body (not a useEffect) so it is never null when a keydown
  // fires between the simulated unmount and the second mount's effect execution.
  _navigateRef.current = navigate
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // 3-state sidebar: 'expanded' | 'collapsed' | 'hidden'
  // Read from localStorage on first mount as the interim persistence mechanism
  // (user_preferences API replaces this in Phase 15 — key: 'sidebar_state' in JSONB)
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>(() => {
    try {
      const stored = localStorage.getItem('io_sidebar_state')
      if (stored === 'expanded' || stored === 'collapsed' || stored === 'hidden') return stored
    } catch {
      // ignore localStorage errors (e.g. private browsing restrictions)
    }
    return 'expanded'
  })
  const sidebarCollapsed = sidebarState === 'collapsed'
  // sidebarHidden drives the edge-reveal strip
  const sidebarHidden = sidebarState === 'hidden'
  const [sidebarPeek, setSidebarPeek] = useState(false)
  // Hidden sidebar floating overlay (opens on chevron click, retracts after 400ms mouse-leave)
  const [sidebarHiddenPeekOpen, setSidebarHiddenPeekOpen] = useState(false)
  const sidebarHiddenPeekOpenRef = useRef(false)
  sidebarHiddenPeekOpenRef.current = sidebarHiddenPeekOpen
  const sidebarEdgeDwellRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sidebarHiddenRetractRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Collapsed sidebar hover-to-expand overlay (300ms dwell, 200ms retract)
  const [collapsedPeek, setCollapsedPeek] = useState(false)
  const collapsedPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When collapsed but peeking, or hidden overlay is open, show full sidebar content
  const sidebarShowFull = !sidebarCollapsed || collapsedPeek || sidebarHiddenPeekOpen
  // Top bar hidden state (Ctrl+Shift+T)
  const [topbarHidden, setTopbarHidden] = useState(false)
  const [topbarPeek, setTopbarPeek] = useState(false)
  const topbarPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuBtnRef = useRef<HTMLButtonElement>(null)
  const [userMenuPos, setUserMenuPos] = useState({ top: 0, right: 0 })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Popup detection — runs at app init (post-auth). Not shown in kiosk mode.
  const popupBlockedState = usePopupBlockedState()

  // Refs to save pre-kiosk sidebar/topbar state for restoration on exit
  const preKioskSidebarRef = useRef<'expanded' | 'collapsed' | 'hidden'>('expanded')
  const preKioskTopbarRef = useRef(false)

  // Browser fullscreen tracking — driven by fullscreenchange listener.
  // Used to auto-dismiss the fullscreen prompt and drive Escape two-step logic.
  const isBrowserFullscreenRef = useRef(false)
  // When kiosk is entered but browser fullscreen was denied, show the prompt
  const [needsFullscreenPrompt, setNeedsFullscreenPrompt] = useState(false)

  // Refs to hold kiosk helpers — avoids stale closures in the keyboard effect
  const isKioskRef = useRef(isKiosk)
  isKioskRef.current = isKiosk

  // Persist sidebar state to localStorage whenever it changes.
  // Kiosk mode forces 'hidden' — we do not persist that transient state
  // so that exiting kiosk restores the user's preferred sidebar state.
  useEffect(() => {
    if (!isKiosk) {
      try {
        localStorage.setItem('io_sidebar_state', sidebarState)
      } catch {
        // ignore
      }
    }
  }, [sidebarState, isKiosk])

  function enterKiosk() {
    preKioskSidebarRef.current = sidebarState
    preKioskTopbarRef.current = topbarHidden
    setKiosk(true)
    setSidebarState('hidden')
    setTopbarHidden(true)
    sessionStorage.setItem('io_kiosk', '1')
    const params = new URLSearchParams(searchParams)
    params.set('mode', 'kiosk')
    setSearchParams(params, { replace: true })
    showToast({ title: 'Kiosk mode active. Press Escape to exit.', variant: 'info', duration: 2000 })
    // Attempt to enter browser fullscreen.
    // Keyboard shortcut (Ctrl+Shift+K) counts as a user gesture so requestFullscreen
    // is likely to succeed. URL-param and UI-button paths may not have a gesture;
    // we attempt anyway and fall back to the in-content prompt if rejected.
    // On success, the fullscreenchange listener fires and needsFullscreenPrompt
    // stays false (or is reset to false). On rejection, show the prompt.
    document.documentElement.requestFullscreen().catch(() => {
      setNeedsFullscreenPrompt(true)
    })
  }

  function exitKiosk() {
    setNeedsFullscreenPrompt(false)
    setKiosk(false)
    setSidebarState(preKioskSidebarRef.current)
    setTopbarHidden(preKioskTopbarRef.current)
    sessionStorage.removeItem('io_kiosk')
    const params = new URLSearchParams(searchParams)
    params.delete('mode')
    setSearchParams(params, { replace: true })
    // Exit browser fullscreen if it is currently active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
    }
  }

  // Stable refs so the keyboard handler effect never needs these in its dep array
  const enterKioskRef = useRef(enterKiosk)
  enterKioskRef.current = enterKiosk
  const exitKioskRef = useRef(exitKiosk)
  exitKioskRef.current = exitKiosk

  // Activate kiosk on mount if URL param or sessionStorage says so
  useEffect(() => {
    const isKioskParam =
      searchParams.get('mode') === 'kiosk' || sessionStorage.getItem('io_kiosk') === '1'
    if (isKioskParam) {
      setKiosk(true)
      setSidebarState('hidden')
      setTopbarHidden(true)
      // Attempt fullscreen on URL/session restore — may lack a user gesture so
      // show the in-content prompt if rejected.
      document.documentElement.requestFullscreen().catch(() => {
        setNeedsFullscreenPrompt(true)
      })
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const isKioskRef2 = useRef(isKiosk)
  isKioskRef2.current = isKiosk
  // Used by keyboard handler to suppress kiosk-exit while lock overlay is visible
  const isLockedRef = useRef(isLocked)
  isLockedRef.current = isLocked

  // Per-session idle timeout — default is IDLE_TIMEOUT_MS; boot sync may override.
  const idleTimeoutRef = useRef(IDLE_TIMEOUT_MS)

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = setTimeout(() => {
      // Kiosk sessions never auto-lock on idle (spec DD-29-010 §kiosk).
      if (isKioskRef2.current) return
      lockRef.current()
      // Persist lock state server-side so it survives page refresh.
      authApi.lockSession().catch(() => {
        // Best-effort — UI is already locked even if the API call fails.
      })
    }, idleTimeoutRef.current)
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

  // ---------------------------------------------------------------------------
  // Boot-time lock state sync
  // On app load, query GET /api/auth/me to check if the session is locked
  // server-side (e.g. user locked in another tab, or page refreshed while locked).
  // If is_locked = true: set lock state in store WITHOUT showing the overlay.
  // The overlay only appears on the next user interaction.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    async function bootSyncLock() {
      try {
        const result = await authApi.sessionCheck()
        if (cancelled) return
        if (!result.success) return

        const session = result.data
        // Apply per-session idle timeout if provided
        if (typeof session.idle_timeout_ms === 'number' && session.idle_timeout_ms > 0) {
          idleTimeoutRef.current = session.idle_timeout_ms
          // Restart idle timer with the new value
          resetIdleTimer()
        }

        // Sync lock meta regardless of lock state (for correct unlock card on next lock)
        setLockMeta({
          authProvider: session.auth_provider,
          authProviderName: session.auth_provider_name ?? '',
          hasPin: session.has_pin,
        })

        // Persist auth provider so the profile page can read it without props
        sessionStorage.setItem('io_auth_provider', session.auth_provider)

        if (session.is_locked) {
          // Lock immediately — overlay will NOT show until next interaction
          lock({
            authProvider: session.auth_provider,
            authProviderName: session.auth_provider_name ?? '',
            hasPin: session.has_pin,
          })
        }
      } catch {
        // Non-critical — if this fails, session stays unlocked until WS event
        // or the idle timer fires.
      }
    }
    void bootSyncLock()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // WebSocket session lock/unlock event listeners
  // The wsWorker already calls useUiStore.getState().lock/unlock() on these
  // events. Here we register explicit component-level listeners so AppShell
  // can reset the idle timer on unlock and re-sync lock meta on lock.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const offLock = wsManager.onSessionLock(() => {
      // wsWorker already called lock() — just ensure idle timer is still running
      // (it is, since data keeps flowing). No additional action needed here;
      // the LockOverlay will show on next user interaction.
    })

    const offUnlock = wsManager.onSessionUnlock(() => {
      // wsWorker already called unlock() — reset idle timer so the user gets
      // a fresh window of inactivity after unlocking from another tab.
      unlock()
      resetIdleTimer()
    })

    return () => {
      offLock()
      offUnlock()
    }
  }, [unlock, resetIdleTimer])

  // Track browser fullscreen state via fullscreenchange event.
  // This drives the Escape two-step logic and auto-dismisses the fullscreen prompt.
  useEffect(() => {
    function onFullscreenChange() {
      const isFs = !!document.fullscreenElement
      isBrowserFullscreenRef.current = isFs
      // Auto-dismiss the fullscreen prompt once fullscreen becomes active
      if (isFs) {
        setNeedsFullscreenPrompt(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  // G-key hint visibility state — backed by module-level ref to survive React
  // Strict Mode's double-mount cycle (useRef resets on remount; module vars do not).
  const [gKeyHintVisible, setGKeyHintVisible] = useState(false)

  // Keep the module-level setter ref pointing at the live setter on every render.
  // Assigned directly in render body so it is never null when the keyboard handler
  // fires — a useEffect would leave it null between Strict Mode's simulated
  // unmount and the second mount's effect execution.
  _setGKeyHintVisible.current = setGKeyHintVisible

  // Aliases so the handler below reads identically to the original.
  const gKeyPending = _gKeyPending
  const gKeyTimerRef = _gKeyTimerRef

  // Global keyboard shortcuts
  useEffect(() => {
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

      // Escape — dismiss G-key hint if visible, then handle kiosk exit with
      // two-step fullscreen sequence.
      // IMPORTANT: When the lock overlay is visible it handles Escape in capture
      // phase (dismiss overlay only, no unlock). We must not also exit kiosk here.
      // Check isLocked so AppShell's handler is a no-op while the overlay is up.
      if (e.key === 'Escape') {
        if (gKeyPending.current) {
          gKeyPending.current = false
          if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
          _setGKeyHintVisible.current?.(false)
          return
        }
        if (sidebarHiddenPeekOpenRef.current) {
          setSidebarHiddenPeekOpen(false)
          return
        }
        if (isKioskRef.current && !isLockedRef.current) {
          e.preventDefault()
          // Two-step Escape sequence:
          // - If browser is in fullscreen: first Escape exits fullscreen only;
          //   kiosk chrome stays hidden. Second Escape exits kiosk fully.
          // - If not in fullscreen: single Escape exits kiosk directly.
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => undefined)
          } else {
            exitKioskRef.current()
          }
          return
        }
      }

      // Ctrl+K / Cmd+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }

      // Ctrl+Shift+K — toggle kiosk mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault()
        if (isKioskRef.current) {
          exitKioskRef.current()
        } else {
          enterKioskRef.current()
        }
        return
      }

      // Ctrl+\ — toggle Expanded ↔ Collapsed (if hidden, transitions to collapsed first)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '\\') {
        e.preventDefault()
        setSidebarState(s => s === 'hidden' ? 'collapsed' : s === 'collapsed' ? 'expanded' : 'collapsed')
        return
      }

      // Ctrl+Shift+\ — toggle Hidden ↔ collapsed
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '\\') {
        e.preventDefault()
        setSidebarState(s => s === 'hidden' ? 'collapsed' : 'hidden')
        setCollapsedPeek(false)
        return
      }

      // Ctrl+Shift+T — toggle top bar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 't') {
        e.preventDefault()
        setTopbarHidden(v => !v)
        setTopbarPeek(false)
        return
      }

      // ? — open keyboard shortcut help overlay
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?') {
        e.preventDefault()
        setHelpOpen((v) => !v)
        return
      }

      // F8 — toggle notification history panel
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'F8') {
        e.preventDefault()
        useToastStore.getState().toggleNotifPanel()
        return
      }

      // Ctrl+L — lock screen (immediate, shows overlay right away)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'l') {
        e.preventDefault()
        lockRef.current(undefined, true)
        authApi.lockSession().catch(() => {
          // Best-effort — UI is already locked even if API fails
        })
        return
      }

      // G-key sequence: press G, then a letter within 2000ms (spec §G-Key Navigation)
      // Match both 'g' and 'G' so CapsLock does not prevent the shortcut.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        gKeyPending.current = true
        _setGKeyHintVisible.current?.(true)
        if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
        gKeyTimerRef.current = setTimeout(() => {
          gKeyPending.current = false
          _setGKeyHintVisible.current?.(false)
        }, 2000)
        return
      }

      if (gKeyPending.current && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Ignore bare modifier key presses (Shift, CapsLock, etc.) — they do
        // not constitute a navigation intent and should not cancel the sequence.
        if (_GKEY_MODIFIER_KEYS.has(e.key)) return

        // Always prevent default while in G-key pending state — we own all
        // keyboard input at this point and must not let any key reach the
        // browser's native handler (e.g. Enter triggering form submit, or any
        // key causing unexpected navigation in Playwright / headless contexts).
        e.preventDefault()
        const path = G_KEY_MAP[e.key.toLowerCase()]
        if (path) {
          gKeyPending.current = false
          if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
          _setGKeyHintVisible.current?.(false)
          _navigateRef.current?.(path)
        } else {
          // Unrecognised key while pending — cancel the sequence so the user
          // is not left stranded waiting for the 2000ms timer.
          gKeyPending.current = false
          if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
          _setGKeyHintVisible.current?.(false)
        }
        return
      }
    }

    // Register on document (not window) per spec checklist — document is always
    // reachable and avoids stopPropagation interference from window-level handlers.
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                width: 8,
                flexShrink: 0,
                zIndex: 60,
                background: 'transparent',
              }}
              onMouseEnter={() => {
                if (sidebarEdgeDwellRef.current) clearTimeout(sidebarEdgeDwellRef.current)
                if (sidebarHiddenRetractRef.current) clearTimeout(sidebarHiddenRetractRef.current)
                sidebarEdgeDwellRef.current = setTimeout(() => setSidebarPeek(true), 200)
              }}
              onMouseLeave={() => {
                if (sidebarEdgeDwellRef.current) clearTimeout(sidebarEdgeDwellRef.current)
                setSidebarPeek(false)
              }}
            >
              {sidebarPeek && (
                <button
                  style={{
                    position: 'absolute',
                    left: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 24,
                    height: 48,
                    background: 'var(--io-surface-elevated, var(--io-surface))',
                    border: '1px solid var(--io-border)',
                    borderRadius: '0 6px 6px 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: 0.85,
                    zIndex: 61,
                    padding: 0,
                    color: 'var(--io-text-primary)',
                    fontSize: 16,
                  }}
                  onClick={() => {
                    if (sidebarHiddenRetractRef.current) clearTimeout(sidebarHiddenRetractRef.current)
                    setSidebarHiddenPeekOpen(true)
                    setSidebarPeek(false)
                  }}
                  title="Show sidebar"
                >
                  ›
                </button>
              )}
            </div>
          )}
        <aside
          style={{
            width: (sidebarHidden && !sidebarHiddenPeekOpen) ? 0 : sidebarCollapsed ? 'var(--io-sidebar-collapsed, 48px)' : 'var(--io-sidebar-width, 240px)',
            // When collapsed+peeking or hidden+peekOpen: fixed overlay, no content reflow
            position: (sidebarCollapsed && collapsedPeek) || sidebarHiddenPeekOpen ? 'fixed' : 'relative',
            left: 0,
            top: 0,
            bottom: 0,
            // Override width for the floating overlay
            ...(sidebarCollapsed && collapsedPeek ? {
              width: 'var(--io-sidebar-width, 240px)',
              zIndex: 200,
              boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
            } : {}),
            ...(sidebarHiddenPeekOpen ? {
              width: 'var(--io-sidebar-width, 240px)',
              zIndex: 200,
              boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
            } : {}),
            background: 'var(--io-surface-secondary)',
            borderRight: (sidebarHidden && !sidebarHiddenPeekOpen) ? 'none' : '1px solid var(--io-border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: (sidebarCollapsed && collapsedPeek) || sidebarHiddenPeekOpen ? 200 : 50,
            overflow: 'hidden',
            transition: 'width 0.18s ease',
          }}
          className="sidebar"
          onMouseEnter={() => {
            if (sidebarCollapsed) {
              if (collapsedPeekTimerRef.current) clearTimeout(collapsedPeekTimerRef.current)
              collapsedPeekTimerRef.current = setTimeout(() => setCollapsedPeek(true), 300)
            }
            if (sidebarHiddenPeekOpen) {
              if (sidebarHiddenRetractRef.current) clearTimeout(sidebarHiddenRetractRef.current)
            }
          }}
          onMouseLeave={() => {
            if (sidebarCollapsed) {
              if (collapsedPeekTimerRef.current) clearTimeout(collapsedPeekTimerRef.current)
              collapsedPeekTimerRef.current = setTimeout(() => setCollapsedPeek(false), 200)
            }
            if (sidebarHiddenPeekOpen) {
              sidebarHiddenRetractRef.current = setTimeout(() => setSidebarHiddenPeekOpen(false), 400)
            }
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
            {/* Pin button — visible only in hidden-overlay mode; pins sidebar to Collapsed state */}
            {sidebarHiddenPeekOpen && (
              <button
                onClick={() => {
                  setSidebarState('collapsed')
                  setSidebarHiddenPeekOpen(false)
                }}
                title="Pin sidebar (switch to Collapsed)"
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
                  fontSize: '11px',
                  padding: 0,
                }}
              >
                ⊢
              </button>
            )}
            {/* Collapse toggle button — toggles expanded ↔ collapsed (Ctrl+\) */}
            <button
              onClick={() => {
                setCollapsedPeek(false)
                setSidebarState(s => s === 'hidden' ? 'collapsed' : s === 'collapsed' ? 'expanded' : 'collapsed')
              }}
              title={sidebarShowFull ? 'Collapse sidebar (Ctrl+\\)' : 'Expand sidebar (Ctrl+\\)'}
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
            {navGroups.map((group, groupIdx) => {
              // navGroups is already filtered by user permissions via getSidebarGroups
              const visibleGroupItems = group.items
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
            z-index values modules use internally.
            Hidden when: kiosk mode is active (isKiosk) OR user has manually hidden the topbar. */}
        <header
          style={{
            height: (isKiosk || topbarHidden) ? 0 : 'var(--io-topbar-height)',
            overflow: 'hidden',
            background: 'var(--io-surface-secondary)',
            borderBottom: (isKiosk || topbarHidden) ? 'none' : '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: (isKiosk || topbarHidden) ? 0 : '0 20px',
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
                      {idx < breadcrumbs.length - 1 ? (
                        <NavLink
                          to={crumb.path}
                          style={{ color: 'var(--io-text-muted)', textDecoration: 'none' }}
                        >
                          {crumb.label}
                        </NavLink>
                      ) : (
                        <span style={{ color: 'var(--io-text-muted)' }}>{crumb.label}</span>
                      )}
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

            {/* Popup blocked compact indicator — shown when full banner is dismissed */}
            {!isKiosk && <PopupBlockedIndicator state={popupBlockedState} />}

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
                      {/* Theme switcher */}
                      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--io-border)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '6px' }}>Theme</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {(['light', 'dark', 'hphmi'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setTheme(t)}
                              style={{
                                flex: 1,
                                padding: '4px',
                                border: '1px solid var(--io-border)',
                                borderRadius: 'var(--io-radius)',
                                fontSize: '11px',
                                background: theme === t ? 'var(--io-accent-subtle)' : 'transparent',
                                color: theme === t ? 'var(--io-accent)' : 'var(--io-text-muted)',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }}
                            >
                              {t === 'hphmi' ? 'HPHMI' : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Navigation items */}
                      <NavLink
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          textDecoration: 'none',
                          color: 'var(--io-text-secondary)',
                          fontSize: '13px',
                        }}
                      >
                        <SettingsIcon size={14} /> Profile &amp; PIN Setup
                      </NavLink>

                      <NavLink
                        to="/my-exports"
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          textDecoration: 'none',
                          color: 'var(--io-text-secondary)',
                          fontSize: '13px',
                        }}
                      >
                        <Download size={14} /> My Exports
                      </NavLink>

                      <NavLink
                        to="/settings/about"
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          textDecoration: 'none',
                          color: 'var(--io-text-secondary)',
                          fontSize: '13px',
                        }}
                      >
                        <Info size={14} /> About Inside/Operations
                      </NavLink>

                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          if (isKiosk) {
                            exitKiosk()
                          } else {
                            enterKiosk()
                          }
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--io-text-secondary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Monitor size={14} /> {isKiosk ? 'Exit Kiosk Mode' : 'Enter Kiosk Mode'}
                      </button>

                      {/* Lock screen */}
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          lock(undefined, true)
                          authApi.lockSession().catch(() => {
                            // Best-effort — UI is already locked even if API fails
                          })
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--io-text-secondary)',
                          fontSize: '13px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Lock size={14} /> Lock Screen
                      </button>

                      <div style={{ height: '1px', background: 'var(--io-border)' }} />

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

        {/* Popup blocked banner — below top bar, above content, pushes layout down.
            Not shown in kiosk mode (top bar is hidden in kiosk). */}
        {!isKiosk && <PopupBlockedBanner state={popupBlockedState} />}

        {/* Kiosk fullscreen prompt — shown when kiosk is active but browser fullscreen
            was denied (e.g. no user gesture during URL-param or UI-button entry).
            Rendered as a non-blocking ribbon at the top of the content area.
            Does NOT block module content. Pointer-events enabled even when locked
            so the user can still click "Enter fullscreen" or "Skip". */}
        {isKiosk && needsFullscreenPrompt && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9000,
              background: 'var(--io-surface-elevated, #1e1e2e)',
              borderBottom: '1px solid var(--io-border, rgba(255,255,255,0.1))',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--io-text-primary)',
            }}
            data-testid="kiosk-fullscreen-prompt"
          >
            <span style={{ flex: 1 }}>
              For the best experience, click to enter fullscreen.
            </span>
            <button
              onClick={() => {
                document.documentElement.requestFullscreen().catch(() => undefined)
              }}
              style={{
                padding: '5px 12px',
                background: 'var(--io-accent)',
                color: 'var(--io-accent-foreground, #fff)',
                border: 'none',
                borderRadius: 'var(--io-radius, 4px)',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              data-testid="kiosk-fullscreen-enter-btn"
            >
              Enter fullscreen
            </button>
            <button
              onClick={() => setNeedsFullscreenPrompt(false)}
              style={{
                padding: '5px 10px',
                background: 'transparent',
                color: 'var(--io-text-secondary)',
                border: '1px solid var(--io-border, rgba(255,255,255,0.15))',
                borderRadius: 'var(--io-radius, 4px)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
              data-testid="kiosk-fullscreen-skip-btn"
            >
              Skip
            </button>
          </div>
        )}

        {/* Content — pointer-events disabled when locked so data renders but interaction is blocked */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--io-surface-primary)',
            pointerEvents: isLocked ? 'none' : undefined,
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
            height: '64px',
            background: 'var(--io-surface-secondary)',
            borderTop: '1px solid var(--io-border)',
            zIndex: 60,
            alignItems: 'stretch',
          }}
        >
          {/* Monitor tab — active when on console, process, or dashboards */}
          {(() => {
            const monitorActive =
              location.pathname.startsWith('/console') ||
              location.pathname.startsWith('/process') ||
              location.pathname.startsWith('/dashboards')
            return (
              <NavLink
                to="/console"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px',
                  gap: '3px',
                  textDecoration: 'none',
                  color: monitorActive ? 'var(--io-accent)' : 'var(--io-text-muted)',
                  fontSize: '10px',
                  fontWeight: monitorActive ? 600 : 400,
                  padding: '6px 0',
                  borderTop: monitorActive ? '2px solid var(--io-accent)' : '2px solid transparent',
                  background: 'none',
                }}
              >
                <Monitor size={20} />
                Monitor
              </NavLink>
            )
          })()}

          {/* Rounds tab */}
          {(() => {
            const active =
              location.pathname === '/rounds' || location.pathname.startsWith('/rounds/')
            return (
              <NavLink
                to="/rounds"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px',
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
                <CheckSquare size={20} />
                Rounds
              </NavLink>
            )
          })()}

          {/* Log tab */}
          {(() => {
            const active =
              location.pathname === '/log' || location.pathname.startsWith('/log/')
            return (
              <NavLink
                to="/log"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px',
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
                <BookOpen size={20} />
                Log
              </NavLink>
            )
          })()}

          {/* Alerts tab */}
          {(() => {
            const active =
              location.pathname === '/alerts' || location.pathname.startsWith('/alerts/')
            return (
              <NavLink
                to="/alerts"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px',
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
                <Bell size={20} />
                Alerts
              </NavLink>
            )
          })()}

          {/* More tab — opens bottom sheet */}
          {(() => {
            const moreActive =
              location.pathname.startsWith('/shifts') ||
              location.pathname.startsWith('/reports')
            return (
              <button
                onClick={() => setMoreOpen(true)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60px',
                  gap: '3px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: moreActive ? 'var(--io-accent)' : 'var(--io-text-muted)',
                  fontSize: '10px',
                  fontWeight: moreActive ? 600 : 400,
                  padding: '6px 0',
                  borderTop: moreActive ? '2px solid var(--io-accent)' : '2px solid transparent',
                }}
              >
                <MoreHorizontal size={20} />
                More
              </button>
            )
          })()}
        </nav>
      )}

      {/* More bottom sheet — secondary nav items on mobile */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 200,
            }}
          />
          {/* Sheet */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--io-surface-elevated)',
              borderTop: '1px solid var(--io-border)',
              borderRadius: '12px 12px 0 0',
              zIndex: 201,
              padding: '12px 0 calc(12px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                background: 'var(--io-border)',
                borderRadius: '2px',
                margin: '0 auto 16px',
              }}
            />
            {[
              { path: '/shifts', label: 'Shifts', icon: Layers },
              { path: '/reports', label: 'Reports', icon: LayoutDashboard },
              { path: '/dashboards', label: 'Dashboards', icon: LayoutDashboard },
              { path: '/settings', label: 'Settings', icon: SettingsIcon },
            ].map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 24px',
                  textDecoration: 'none',
                  color: 'var(--io-text-primary)',
                  fontSize: '15px',
                }}
              >
                <Icon size={20} />
                {label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      {/* Overlays — mounted at the AppShell level */}
      <LockOverlay />
      <EmergencyAlert />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <KeyboardHelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
      <NotificationHistoryPanel />

      {/* Corner dwell triggers — only in kiosk mode */}
      {isKiosk && (['tl', 'tr', 'bl', 'br'] as CornerPosition[]).map((corner) => (
        <CornerTrigger
          key={corner}
          corner={corner}
          onDwellComplete={exitKioskRef.current}
        />
      ))}

      <style>{`
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); transition: transform 0.2s; }
          .sidebar.open { transform: translateX(0); }
          .hamburger { display: flex !important; }
          .mobile-overlay { display: block !important; }
          .mobile-bottom-bar { display: flex !important; }
          .main-content { padding-bottom: 64px; }
        }
      `}</style>

      {/* G-key hint overlay — shows available module shortcuts after G is pressed */}
      {gKeyHintVisible && (
        <div className="gkey-hint-overlay" role="tooltip" aria-label="Go to — keyboard navigation shortcuts" style={{
          position: 'fixed',
          bottom: '80px',
          left: isKiosk ? '12px' : (sidebarHidden ? '12px' : sidebarCollapsed ? 'calc(48px + 8px)' : 'calc(240px + 8px)'),
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          boxShadow: 'var(--io-shadow-lg)',
          padding: '8px 12px',
          zIndex: 'var(--io-z-dropdown)' as React.CSSProperties['zIndex'],
          fontSize: '12px',
          color: 'var(--io-text-secondary)',
          minWidth: '160px',
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--io-text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Go to…</div>
          {Object.entries(G_KEY_MAP).map(([key, path]) => {
            const label = ROUTE_REGISTRY.find((r) => r.path === path)?.sidebar_label ?? path
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '2px 0' }}>
                <span>{label}</span>
                <kbd style={{ background: 'var(--io-surface-sunken)', border: '1px solid var(--io-border)', borderRadius: '3px', padding: '0 4px', fontFamily: 'inherit' }}>
                  {key.toUpperCase()}
                </kbd>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
