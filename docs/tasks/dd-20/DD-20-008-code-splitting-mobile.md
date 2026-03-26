---
id: DD-20-008
title: Implement code splitting to exclude Designer/Forensics/Settings from mobile initial bundle
unit: DD-20
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

On mobile devices, the Designer, Forensics, and Settings modules should never be loaded — they are not usable on touch and must be excluded from the initial bundle to meet the <200 KB gzipped initial load target. Currently `App.tsx` statically imports all modules at the top of the file, meaning every module's code is bundled into the initial load regardless of device type.

## Spec Excerpt (verbatim)

> Modules not available on a given device form factor are never loaded — code splitting ensures Designer, Forensics, and Settings bundles are excluded from the mobile build entirely.
>
> Never load on mobile:
> - **Designer module** — complex SVG editor, not usable on touch
> - **Forensics module** — multi-source correlation, desktop-only analysis
> - **Settings module** — admin functions, desktop only
>
> Each mobile module has a separate lazy-loaded chunk.
> — design-docs/20_MOBILE_ARCHITECTURE.md, §Performance Budgets > Code Splitting

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` — lines 6-79: all page components are statically imported at the top
- `frontend/vite.config.ts` — Vite build config; may need `manualChunks` configuration

## Verification Checklist

- [ ] `DesignerPage` and all Designer sub-pages are imported via `React.lazy(() => import('./pages/designer/...'))`
- [ ] `ForensicsPage` and all Forensics sub-pages are imported via `React.lazy()`
- [ ] Settings sub-pages are imported via `React.lazy()`
- [ ] On mobile (detectDeviceType returns 'phone' or 'tablet'), routes for Designer/Forensics/Settings render a "Not available on mobile" fallback instead of the lazy chunk
- [ ] `<Suspense fallback={<ModuleSkeleton />}>` wraps the lazy-loaded routes

## Assessment

- **Status**: ❌ Missing — `App.tsx` has 80+ static imports at the top of the file; no `React.lazy()` calls anywhere; no code splitting

## Fix Instructions

### 1. Convert module imports in `App.tsx` to lazy:

```typescript
// Replace static imports with lazy:
// import DesignerPage from './pages/designer/index'
const DesignerPage = React.lazy(() => import('./pages/designer/index'))
const DesignerHome = React.lazy(() => import('./pages/designer/DesignerHome'))
// ... etc for all Designer sub-pages

const ForensicsPage = React.lazy(() => import('./pages/forensics/index'))
const InvestigationWorkspace = React.lazy(() => import('./pages/forensics/InvestigationWorkspace'))
// ... etc

const SettingsShell = React.lazy(() => import('./pages/settings/index'))
// ... etc for all Settings sub-pages
```

### 2. Wrap the entire `<Routes>` in a `<Suspense>`:

```tsx
import React, { Suspense } from 'react'
import ModuleLoadingSkeleton from './shared/components/ModuleLoadingSkeleton'

// In the App component return:
<Suspense fallback={<ModuleLoadingSkeleton />}>
  <Routes>
    ...
  </Routes>
</Suspense>
```

### 3. Add a mobile guard for Designer, Forensics, Settings routes:

```tsx
import { detectDeviceType } from './shared/hooks/useWebSocket'

const isMobile = detectDeviceType() !== 'desktop'

// In the Route element:
<Route path="/designer/*" element={
  isMobile
    ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--io-text-muted)' }}>
        Designer is not available on mobile devices.
      </div>
    : <PermissionGuard permission="designer:read"><DesignerPage /></PermissionGuard>
} />
```

### 4. Optionally configure Vite manual chunks:

In `vite.config.ts`, add `build.rollupOptions.output.manualChunks` to group Designer, Forensics, and Settings into separate chunks. This ensures they are fetched as separate network requests even if `React.lazy` doesn't already do it.

Do NOT:
- Remove the routes for Designer/Forensics/Settings entirely — desktop users still need them
- Lazy-load core shared components (AppShell, auth, routing) — those must be in the initial chunk
- Use dynamic `import()` without `React.lazy` — always pair with React.lazy for component-level splitting
