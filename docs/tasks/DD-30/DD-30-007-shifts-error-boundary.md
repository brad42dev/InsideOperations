---
id: DD-30-007
title: Add React error boundary to Shifts module
unit: DD-30
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The Shifts module must be wrapped in a React error boundary that catches render-time exceptions, shows a module-specific recovery UI with a "Reload Module" button, and prevents the rest of the application from crashing. This is a Wave 0 CX-ERROR requirement that applies to all frontend modules.

## Spec Excerpt (verbatim)

> CX-ERROR: React error boundary per module with [Reload Module] recovery UI
> — docs/SPEC_MANIFEST.md, §WAVE 0 — Cross-Cutting Contracts / CX-ERROR

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/shifts/index.tsx` — `ShiftsPage` default export (line 1418) — wrap with ErrorBoundary here
- `frontend/src/shared/components/` — check if a shared `ErrorBoundary` component already exists

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] An `ErrorBoundary` component (class component with `componentDidCatch`) wraps `ShiftsPage` or is applied at the route level for `/shifts`
- [ ] The fallback UI contains a "Reload Module" button that calls `window.location.reload()` or resets the boundary state
- [ ] The fallback UI is specific to the Shifts module (not a generic "Something went wrong")
- [ ] Other modules' error boundaries are not affected by this change

## Assessment

- **Status**: ❌ Missing
- No `ErrorBoundary` component wraps `ShiftsPage` or any sub-component in `frontend/src/pages/shifts/`. If a render exception occurs (e.g., a null reference in `MusterTab` or `PresenceTab`), the entire app tree crashes.

## Fix Instructions

Check if a shared ErrorBoundary already exists at `frontend/src/shared/components/ErrorBoundary.tsx`. If it does, import it and wrap `ShiftsPage`. If not, create a minimal one.

In `frontend/src/pages/shifts/index.tsx`, wrap the return:

```tsx
// At the top of the file, import or define:
import { ErrorBoundary } from '../../shared/components/ErrorBoundary'

// In the default export, wrap ShiftsPage content:
export default function ShiftsPage() {
  return (
    <ErrorBoundary moduleName="Shifts">
      <ShiftsPageInner />
    </ErrorBoundary>
  )
}

function ShiftsPageInner() {
  // ... existing ShiftsPage body
}
```

The ErrorBoundary fallback should render something like:
```tsx
<div style={{ padding: 48, textAlign: 'center' }}>
  <h2>Shifts module encountered an error</h2>
  <p>An unexpected error occurred. Your data is safe.</p>
  <button onClick={() => window.location.reload()}>Reload Module</button>
</div>
```

Do NOT:
- Use a try/catch in a function component — React error boundaries must be class components with `componentDidCatch` / `getDerivedStateFromError`
- Wrap individual sub-tabs — wrap the entire `ShiftsPage` so all four tabs are covered
