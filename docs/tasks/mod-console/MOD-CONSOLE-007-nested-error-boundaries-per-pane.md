---
id: MOD-CONSOLE-007
title: Add nested React ErrorBoundary around each individual pane
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

A crash in one graphic pane (e.g., a malformed scene graph, an uncaught SVG rendering error) must not kill the entire Console view. Each pane must be wrapped in its own ErrorBoundary so that the error is contained to that pane. The crashed pane shows its own recovery UI; all other panes continue operating normally. Currently, a crash in GraphicPane takes down the entire ConsolePage.

## Spec Excerpt (verbatim)

> Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
> — docs/SPEC_MANIFEST.md, CX-ERROR non-negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/PaneWrapper.tsx` — renders TrendPane, PointTablePane, AlarmListPane, GraphicPane — no ErrorBoundary here
- `frontend/src/shared/components/ErrorBoundary.tsx` — existing ErrorBoundary component to reuse
- `frontend/src/pages/console/WorkspaceGrid.tsx` — line 453: renders `<PaneWrapper …>` inside the grid item div

## Verification Checklist

- [ ] `PaneWrapper.tsx` wraps its pane content in `<ErrorBoundary>` (or each pane type is individually wrapped)
- [ ] ErrorBoundary shows a pane-sized recovery UI with a "Reload Pane" button (not "Reload Module")
- [ ] Other panes continue to render and update when one pane crashes
- [ ] The module-level ErrorBoundary in `App.tsx` is NOT the only boundary (pane-level boundary is distinct)
- [ ] Error is logged to console with pane context info

## Assessment

- **Status**: ❌ Missing
- `PaneWrapper.tsx` imports: no `ErrorBoundary` import
- `WorkspaceGrid.tsx:453` — `<PaneWrapper …>` is rendered bare inside the grid item div
- A crash in `GraphicPane` (e.g., from `SceneRenderer` throwing on a malformed node) would propagate to the top-level `ErrorBoundary` at `App.tsx:147`, killing the entire Console

## Fix Instructions

**Step 1 — Import `ErrorBoundary` in `PaneWrapper.tsx`:**
```typescript
import { ErrorBoundary } from '../../shared/components/ErrorBoundary'
```

**Step 2 — Wrap the pane content switch statement** in `PaneWrapper.tsx` with a nested boundary. Find the section that renders the actual pane component (around where `GraphicPane`, `TrendPane`, etc. are rendered) and wrap it:
```tsx
<ErrorBoundary
  fallback={
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, color: 'var(--io-text-muted)', fontSize: 12,
      padding: 16, textAlign: 'center',
    }}>
      <span>Pane error</span>
      <button
        onClick={() => window.location.reload()}  // remount pane — see below
        style={{ fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
      >
        Reload Pane
      </button>
    </div>
  }
  module={`Pane (${config.type})`}
>
  {/* existing pane content switch */}
</ErrorBoundary>
```

Note: The `ErrorBoundary` `fallback` prop is already supported per `ErrorBoundary.tsx:4`. The "Reload Pane" button should reset only the boundary state, not reload the full page. The current `ErrorBoundary` "Try again" button already does this (`this.setState({ hasError: false, error: null })`), so using the default fallback (without the `fallback` prop) would also work — just customize the message to say "Pane error" rather than "Console failed to load".

Do NOT:
- Replace the module-level boundary in `App.tsx` — both levels are needed
- Use `window.location.reload()` in the pane-level boundary button (it should remount the pane, not reload the page)
- Wrap the entire `PaneWrapper` return value including the drag/resize chrome — only wrap the content area
