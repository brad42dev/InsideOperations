---
id: DD-06-005
title: Replace alert bell navigation with dropdown panel showing recent alerts
unit: DD-06
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The bell icon in the top bar must open a dropdown slide-out panel showing recent unacknowledged alerts sorted by severity (EMERGENCY → CRITICAL → WARNING → INFO). Each row shows severity icon, title, timestamp, and an "Acknowledge" button (requires `alerts:acknowledge` permission). Currently the bell navigates to the /alerts page on click instead of opening an inline panel.

## Spec Excerpt (verbatim)

> **Alert Notification Indicator:** Bell icon with unacknowledged alert count badge. Clicking opens an alert panel (dropdown slide-out) showing recent alerts sorted by severity (EMERGENCY → CRITICAL → WARNING → INFO). Each alert row shows severity icon, title, timestamp, and an "Acknowledge" button (requires `alerts:acknowledge` permission). Badge hides when count is zero. Real-time count updates via WebSocket subscription.
> — 06_FRONTEND_SHELL.md, §Top Bar (2-State)

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` lines 160–209 — AlertBell component that currently navigates on click
- `frontend/src/api/notifications.ts` — likely contains alert fetch functions
- `frontend/src/shared/components/PermissionGuard.tsx` — for acknowledge button permission check

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Bell click opens a dropdown panel (not navigate to /alerts)
- [ ] Panel shows recent alerts sorted by severity order (EMERGENCY first, INFO last)
- [ ] Each row: severity icon + title + timestamp + Acknowledge button
- [ ] Acknowledge button hidden (not disabled) when user lacks `alerts:acknowledge`
- [ ] Panel closes on outside click (click-away backdrop)
- [ ] Badge hides when count is zero (existing behavior — verify preserved)
- [ ] "View all alerts" link at bottom navigates to /alerts

## Assessment

After checking:
- **Status**: ❌ Wrong — AlertBell.tsx line 161 `onClick={() => navigate('/alerts')}` navigates instead of opening dropdown

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`, replace the AlertBell component:

```typescript
function AlertBell() {
  const { user } = useAuthStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 })
  const count = useUnacknowledgedAlertCount()
  const canAcknowledge = user?.permissions.includes('alerts:acknowledge') ?? false

  // Fetch recent alerts when panel opens
  const { data: recentAlerts } = useQuery({
    queryKey: ['alerts-recent-panel'],
    queryFn: () => fetch('/api/alarms/active?limit=20', { headers: { Authorization: `Bearer ${localStorage.getItem('io_access_token') ?? ''}` } }).then(r => r.json()),
    enabled: panelOpen,
  })

  function handleOpen() {
    if (!panelOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPanelPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setPanelOpen(v => !v)
  }

  return (
    <>
      <button ref={btnRef} onClick={handleOpen} title="Alerts">
        <Bell size={16} />
        {count > 0 && <span style={{ /* existing badge styles */ }}>{count > 99 ? '99+' : count}</span>}
      </button>
      {panelOpen && (
        <>
          <div onClick={() => setPanelOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{ position: 'fixed', top: panelPos.top, right: panelPos.right,
            width: '360px', maxHeight: '480px', overflowY: 'auto',
            background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)', boxShadow: 'var(--io-shadow-lg)',
            zIndex: 'var(--io-z-dropdown)' }}>
            {/* Header */}
            {/* Alert rows sorted by severity */}
            {/* Each row: icon + title + timestamp + (canAcknowledge ? <AckButton /> : null) */}
            {/* Footer: View all alerts link */}
          </div>
        </>
      )}
    </>
  )
}
```

Sort order for severity: define a numeric severity map `{ EMERGENCY: 0, CRITICAL: 1, WARNING: 2, INFO: 3 }` and sort ascending.

Do NOT:
- Remove the navigate-to-alerts behavior entirely — keep it as a "View all alerts" footer link in the dropdown
- Show the Acknowledge button to users lacking `alerts:acknowledge` permission (hide, don't disable)
