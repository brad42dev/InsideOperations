---
id: MOD-CONSOLE-009
title: Fix ErrorBoundary button label to "[Reload Module]" and add nested per-pane boundaries
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The React error boundary recovery button must say "[Reload Module]" (not "Try again"). Additionally, large modules like Console require nested error boundaries around individual panes so that a crash in one pane (e.g., a malformed graphic) does not take down the entire Console workspace.

## Spec Excerpt (verbatim)

> Error UI shows: generic error message + **[Reload Module]** button (remounts the module component, no full page reload).
> Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
> — SPEC_MANIFEST.md, CX-ERROR non-negotiables #2 and #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/ErrorBoundary.tsx` — line 49: button says "Try again". Line 42: `onClick` resets the boundary state (remounts child) which is correct behavior.
- `frontend/src/pages/console/WorkspaceGrid.tsx` — renders PaneWrapper components. No ErrorBoundary around individual panes.
- `frontend/src/pages/console/PaneWrapper.tsx` — no ErrorBoundary wrapping the pane content.

## Verification Checklist

- [ ] ErrorBoundary.tsx button text is "[Reload Module]" (with brackets, as specified).
- [ ] WorkspaceGrid.tsx wraps each PaneWrapper in an ErrorBoundary.
- [ ] A crash in one pane's GraphicPane (e.g., rendering an invalid SVG) does not unmount other panes.
- [ ] The per-pane ErrorBoundary fallback shows a pane-shaped error state (not a full-page error).

## Assessment

- **Status**: ⚠️ Wrong
- ErrorBoundary.tsx:49 says "Try again". WorkspaceGrid.tsx and PaneWrapper.tsx have no nested ErrorBoundary. A crash in any single pane component would propagate up through WorkspaceGrid and crash the entire Console.

## Fix Instructions

**Fix button text** in `frontend/src/shared/components/ErrorBoundary.tsx`, line 49:
Change `Try again` to `Reload Module`.

**Add nested boundaries in WorkspaceGrid.tsx.**
In the JSX where each `PaneWrapper` is rendered, wrap it:
```tsx
import { ErrorBoundary } from '../../shared/components/ErrorBoundary'

// Inside the grid item render:
<ErrorBoundary
  key={pane.id}
  module={`Pane ${pane.id.slice(0, 8)}`}
  fallback={
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13,
      background: 'var(--io-surface-secondary)',
    }}>
      Pane failed to render.{' '}
      <button onClick={() => {/* boundary reset via key change */}}>Retry</button>
    </div>
  }
>
  <PaneWrapper ... />
</ErrorBoundary>
```

Note: to allow the fallback button to reset the boundary, use a `key` prop on `ErrorBoundary` tied to a retry counter. When the user clicks retry, increment the counter to remount the boundary.

Do NOT:
- Rename the button to "Try again" elsewhere — the spec requires "[Reload Module]" with brackets at the module level.
- Wrap the entire WorkspaceGrid in a single boundary — the nested boundary must be per-pane.
- Use `window.location.reload()` in any recovery button — the spec requires remounting only the component, not a full page reload.
