---
id: DD-06-008
title: Fix ErrorBoundary button label and add nested boundaries for large modules
unit: DD-06
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The ErrorBoundary component button must be labeled "[Reload Module]" not "Try again." Additionally, large modules (Console, Forensics, Designer) must have nested error boundaries around individual panes and panels so one pane crash does not kill the entire module view.

## Spec Excerpt (verbatim)

> 2. Error UI shows: generic error message + **[Reload Module]** button (remounts the module component, no full page reload).
> 3. Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
> — SPEC_MANIFEST.md, §CX-ERROR

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/ErrorBoundary.tsx` line 48 — button reads "Try again"
- `frontend/src/pages/console/WorkspaceGrid.tsx` — Console grid rendering panes (no per-pane ErrorBoundary)
- `frontend/src/pages/console/PaneWrapper.tsx` — individual pane wrapper (check for ErrorBoundary)
- `frontend/src/pages/designer/index.tsx` — Designer panels
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — Forensics investigation panels

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] ErrorBoundary.tsx button text changed from "Try again" to "Reload Module"
- [ ] PaneWrapper.tsx or WorkspaceGrid.tsx wraps each pane in ErrorBoundary
- [ ] Designer side panels (canvas, right panel, palette) each have independent ErrorBoundary
- [ ] Forensics InvestigationWorkspace has ErrorBoundary around each major section
- [ ] Error boundary reset (setState call) triggers component remount, not window.location.reload()

## Assessment

After checking:
- **Status**: ⚠️ Partial — ErrorBoundary exists and correctly remounts (setState, not reload), but button is labeled "Try again" and no nested boundaries in Console/Designer/Forensics

## Fix Instructions

**1. Fix button label in ErrorBoundary.tsx line 48:**
```tsx
<button onClick={() => this.setState({ hasError: false, error: null })} ...>
  Reload Module
</button>
```

**2. Add per-pane ErrorBoundary in Console WorkspaceGrid.tsx:**

Find where individual panes/PaneWrapper components are rendered and wrap each:
```tsx
import { ErrorBoundary } from '../../shared/components/ErrorBoundary'

// Where pane is rendered:
<ErrorBoundary module={`Console Pane ${pane.id}`}>
  <PaneWrapper pane={pane} ... />
</ErrorBoundary>
```

**3. Add per-panel ErrorBoundary in Designer:**

In `frontend/src/pages/designer/index.tsx`, find the canvas, palette, and right panel sections:
```tsx
<ErrorBoundary module="Designer Canvas">
  <DesignerCanvas ... />
</ErrorBoundary>
<ErrorBoundary module="Designer Properties">
  <DesignerRightPanel ... />
</ErrorBoundary>
```

**4. Add per-section ErrorBoundary in Forensics InvestigationWorkspace:**

Wrap correlation panel, timeline panel, and evidence panel individually.

Do NOT:
- Use `window.location.reload()` in the error boundary (current code correctly uses setState — preserve this)
- Wrap every tiny component in an ErrorBoundary (only major independently-failing sections)
