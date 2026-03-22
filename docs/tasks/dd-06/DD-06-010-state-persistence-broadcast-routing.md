---
id: DD-06-010
title: Implement sidebar state persistence, BroadcastChannel sync, lazy module loading, and detached window routes
unit: DD-06
status: pending
priority: medium
depends-on: [DD-06-002]
---

## What This Feature Should Do

Four related infrastructure gaps:
1. Sidebar state (expanded/collapsed/hidden) must persist in `user_preferences` JSONB so it survives page refresh
2. A BroadcastChannel `io-app-sync` must sync theme changes, auth refreshes, density changes, and session lock/unlock across browser windows
3. All 11 module components must be lazily loaded via React.lazy() with Suspense for code splitting (initial load optimization)
4. Detached window routes (`/detached/console/:workspaceId`, `/detached/process/:viewId`, `/detached/dashboard/:dashboardId`) must exist for multi-monitor setups

## Spec Excerpt (verbatim)

> **Persistence:** Sidebar state stored in `user_preferences` JSONB, key `sidebar_state`. Per-window independence — each browser window maintains its own state. BroadcastChannel syncs the preference but windows can override locally.
> — 06_FRONTEND_SHELL.md, §Sidebar (3-State)

> | Message Type | Purpose |
> |---|---|
> | `auth:refresh` | Token refresh propagates to all windows |
> | `theme:change` | Theme change propagates to detached windows |
> | `density:change` | Density mode propagates |
> | `session:lock` | Lock all windows |
> | `session:unlock` | Unlock all windows |
> — 06_FRONTEND_SHELL.md, §BroadcastChannel State Sync

> - Lazy loading for all 11 modules (code splitting)
> — 06_FRONTEND_SHELL.md, §Routing

> `/detached/console/:workspaceId` — Console workspace grid only
> — 06_FRONTEND_SHELL.md, §Detached Window Routes

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` line 218 — sidebarState useState (no persistence)
- `frontend/src/App.tsx` lines 1–55 — all module imports are static (not lazy)
- `frontend/src/App.tsx` lines 107–1021 — no /detached/* routes
- `frontend/src/store/ui.ts` — no BroadcastChannel code
- `frontend/src/store/auth.ts` — token refresh (no BroadcastChannel publish)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] AppShell reads sidebar state from `user_preferences` API on mount and persists on change
- [ ] BroadcastChannel `io-app-sync` created in a shared module (e.g., `src/lib/broadcastSync.ts`)
- [ ] Theme changes call `channel.postMessage({ type: 'theme:change', theme })`
- [ ] Auth token refresh publishes `auth:refresh` and all windows receive + apply it
- [ ] Session lock/unlock publishes to all windows via `session:lock` / `session:unlock`
- [ ] At least the largest module components (Console, Designer, Forensics) use `React.lazy()`
- [ ] `/detached/console/:workspaceId` route exists in App.tsx
- [ ] `/detached/process/:viewId` route exists in App.tsx
- [ ] `/detached/dashboard/:dashboardId` route exists in App.tsx

## Assessment

After checking:
- **Status**: ❌ Missing across all four areas — useState only for sidebar (line 218); all imports are static top-level (no lazy); no BroadcastChannel in store/ui.ts or store/auth.ts; no /detached routes in App.tsx

## Fix Instructions

**1. Sidebar persistence** — In AppShell.tsx, after state init:
```typescript
// Load from localStorage (fast) as proxy for user_preferences until backend prefs API is ready
const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>(() => {
  const stored = localStorage.getItem('io_sidebar_state')
  return (stored === 'expanded' || stored === 'collapsed' || stored === 'hidden') ? stored : 'expanded'
})

// Persist on change
useEffect(() => {
  localStorage.setItem('io_sidebar_state', sidebarState)
}, [sidebarState])
```
When user_preferences API is available (Phase 15), replace localStorage with `PATCH /api/users/me/preferences`.

**2. BroadcastChannel sync** — Create `frontend/src/lib/broadcastSync.ts`:
```typescript
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('io-app-sync') : null
export function publishThemeChange(theme: string) { chan?.postMessage({ type: 'theme:change', theme }) }
export function publishSessionLock() { chan?.postMessage({ type: 'session:lock' }) }
export function publishSessionUnlock() { chan?.postMessage({ type: 'session:unlock' }) }
export function subscribeToSync(handler: (msg: MessageEvent) => void) {
  chan?.addEventListener('message', handler)
  return () => chan?.removeEventListener('message', handler)
}
```
Call `publishThemeChange(theme)` in `ui.ts#setTheme`. Call `publishSessionLock/Unlock` in `ui.ts#lock/unlock`. Subscribe in App.tsx `useEffect` to receive and apply incoming changes.

**3. Lazy loading** — In App.tsx, convert the largest module imports:
```typescript
const ConsolePage = lazy(() => import('./pages/console/index'))
const DesignerPage = lazy(() => import('./pages/designer/index'))
const ForensicsPage = lazy(() => import('./pages/forensics/index'))
// ... etc for all 11 top-level module pages
```
Wrap `<AppRoutes />` in `<Suspense fallback={<AppLoadingState />}>`.

**4. Detached window routes** — In App.tsx, add before the 404 route:
```tsx
// Detached window routes — minimal shell, no sidebar/topbar
<Route path="/detached/console/:workspaceId" element={
  <PermissionGuard permission="console:read">
    <WorkspaceView detached />
  </PermissionGuard>
} />
<Route path="/detached/process/:viewId" element={
  <PermissionGuard permission="process:read">
    <ProcessView detached />
  </PermissionGuard>
} />
<Route path="/detached/dashboard/:dashboardId" element={
  <PermissionGuard permission="dashboards:read">
    <DashboardViewer kiosk />
  </PermissionGuard>
} />
```
These routes render outside the AppShell layout (no sidebar/topbar) — either as a separate top-level Route or by passing a `detached` prop that hides chrome.

Do NOT:
- Use sessionStorage for sidebar preference (spec says user_preferences JSONB, use localStorage as interim)
- Lazy-load tiny utility components (only module-level page components)
- Break the BroadcastChannel code if SharedWorker is already connected on the same channel (use a distinct channel name `io-app-sync` separate from the WebSocket worker)
