---
id: DD-10-001
title: Propagate kiosk mode to AppShell via UI store
unit: DD-10
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When a user navigates to a dashboard with `?kiosk=true` in the URL, the entire app chrome (sidebar, topbar, status bar) must be hidden — not just the dashboard's own toolbar. The AppShell reads `isKiosk` from the global `useUiStore`. Currently `DashboardViewer` derives its own local `isKiosk` from the URL parameter but never writes it to the store, so the AppShell keeps the sidebar and topbar visible.

## Spec Excerpt (verbatim)

> URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
> — CX-KIOSK contract, docs/SPEC_MANIFEST.md §Wave 0

> Full viewport: Hides I/O navigation (sidebar, top bar, module switcher, dashboard toolbar) — dashboard fills the entire viewport
> — design-docs/10_DASHBOARDS_MODULE.md §Kiosk Mode

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — lines 148–160: `kioskParam` and `isKiosk` derived locally, `useUiStore` not imported
- `frontend/src/store/ui.ts` — lines 12, 18, 38: `isKiosk` state + `setKiosk()` action
- `frontend/src/shared/layout/AppShell.tsx` — line 213: reads `isKiosk` from `useUiStore`; lines 397, 779 hide chrome when true

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `DashboardViewer.tsx` imports `useUiStore` and calls `setKiosk(true)` in a `useEffect` when `isKiosk` is true
- [ ] The same effect calls `setKiosk(false)` in its cleanup function (on unmount or when kiosk becomes false)
- [ ] AppShell.tsx sidebar is absent when `?kiosk=true` is in the URL while viewing a dashboard
- [ ] AppShell.tsx topbar collapses to height 0 when `?kiosk=true` is in the URL
- [ ] Navigating away from the dashboard (e.g., back to `/dashboards`) restores the sidebar/topbar

## Assessment

- **Status**: ❌ Missing
- `DashboardViewer.tsx` has a local `isKiosk` boolean that controls only the dashboard's own toolbar. `useUiStore` is imported only for `user` (via `useAuthStore`). `setKiosk` is never called. The AppShell's chrome remains visible in `?kiosk=true` mode.

## Fix Instructions

In `frontend/src/pages/dashboards/DashboardViewer.tsx`:

1. Add import: `import { useUiStore } from '../../store/ui'`
2. Destructure `setKiosk` from the store: `const { setKiosk } = useUiStore()`
3. Add a `useEffect` that propagates kiosk state to the store:

```ts
useEffect(() => {
  setKiosk(isKiosk)
  return () => setKiosk(false)
}, [isKiosk, setKiosk])
```

Place this effect near the existing `isKiosk` derivation (around line 157).

The same pattern must be applied to `PlaylistPlayer.tsx`, which always runs in kiosk mode (`<DashboardViewer kiosk />`) but also never calls `setKiosk`.

Do NOT:
- Remove the local `isKiosk` variable — it is still needed to control the dashboard's own toolbar visibility
- Call `setKiosk` inside the render (use `useEffect` to avoid the "update during render" warning)
- Forget the cleanup `() => setKiosk(false)` — without it, navigating away while in kiosk mode leaves the AppShell chrome permanently hidden
