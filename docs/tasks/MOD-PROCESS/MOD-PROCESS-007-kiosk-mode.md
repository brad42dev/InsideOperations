---
id: MOD-PROCESS-007
title: Wire up kiosk mode (?kiosk=true) in Process module
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the Process module URL includes `?kiosk=true`, all application chrome (top bar, sidebar, status bar) is hidden and only the graphic viewport is visible. The user can exit kiosk mode by pressing Escape or dwelling the mouse in a corner for 1.5 seconds. The module continues to function fully in kiosk mode (real-time updates, navigation links, playback all work).

## Spec Excerpt (verbatim)

> URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
>
> Exiting kiosk mode: `Escape` key or a hoverable corner trigger (mouse dwell 1.5s on corner) reveals a minimal exit button.
>
> Module continues to function fully in kiosk mode (real-time updates, navigation links, playback all work).
> — SPEC_MANIFEST.md §CX-KIOSK

**Applies to**: Console, Process, Dashboards
> — SPEC_MANIFEST.md §CX-KIOSK Applies to row

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx` — no `useSearchParams` call present
- `frontend/src/store/ui.ts` — `setKiosk(kiosk: boolean)` exists
- `frontend/src/shared/layout/AppShell.tsx:213` — `isKiosk` from `useUiStore` controls chrome visibility
- `frontend/src/pages/dashboards/DashboardViewer.tsx:155-156` — reference implementation for `?kiosk=true` handling

## Verification Checklist

- [ ] Navigating to `/process?kiosk=true` sets `isKiosk = true` in `useUiStore`.
- [ ] AppShell hides top bar, sidebar, and status bar when `isKiosk` is true.
- [ ] The Process module's own left sidebar is also hidden in kiosk mode.
- [ ] Status bar at the bottom of Process is hidden in kiosk mode.
- [ ] Pressing Escape exits kiosk mode.
- [ ] Mouse dwell (1.5s) in a corner reveals an exit button.
- [ ] Real-time subscriptions continue working in kiosk mode.
- [ ] Kiosk mode survives view navigation within the Process module.

## Assessment

- **Status**: ❌ Missing
- `index.tsx` — no `useSearchParams` import or call. The `?kiosk=true` URL parameter is never read.
- `ui.ts` — `setKiosk()` exists but is never called from the Process module.
- Dashboards (`DashboardViewer.tsx:155`) reads `searchParams.get('kiosk') === 'true'` and sets kiosk state via local variable, but Process has no equivalent.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`:

1. Add `useSearchParams` import and read the kiosk param:
```typescript
import { useNavigate, useSearchParams } from 'react-router-dom'
// ...
const [searchParams] = useSearchParams()
const { setKiosk } = useUiStore()

useEffect(() => {
  const kioskParam = searchParams.get('kiosk') === 'true'
  setKiosk(kioskParam)
  return () => setKiosk(false)  // cleanup on unmount
}, [searchParams, setKiosk])
```

2. Hide the Process-specific left sidebar and status bar in kiosk mode:
```typescript
const { isKiosk } = useUiStore()

// In JSX: conditionally render sidebar:
{!isKiosk && <ProcessSidebar ... />}

// In JSX: conditionally render status bar:
{!isKiosk && <div style={{ /* status bar styles */ }}>...</div>}
```

3. Add kiosk exit handling in the keyboard shortcut useEffect:
```typescript
if (e.key === 'Escape' && isKiosk) { setKiosk(false); return }
```

4. Add corner-hover exit trigger (overlay `div` in bottom-right or top-right corner):
```tsx
{isKiosk && (
  <div
    style={{ position: 'fixed', bottom: 0, right: 0, width: 48, height: 48, zIndex: 9999 }}
    onMouseEnter={() => {
      kioskExitTimerRef.current = setTimeout(() => setKiosk(false), 1500)
    }}
    onMouseLeave={() => {
      if (kioskExitTimerRef.current) clearTimeout(kioskExitTimerRef.current)
    }}
  />
)}
```

Do NOT:
- Show a modal or blocking dialog to exit kiosk mode.
- Disconnect WebSocket subscriptions when entering kiosk mode — real-time updates must continue.
- Call `setKiosk(false)` in the cleanup only if you also protect against setting it false when another module set it true (guard: only clean up if we set it).
