---
id: MOD-CONSOLE-005
title: Add nested error boundaries around individual panes to isolate crashes
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

A crash in a single graphic pane (e.g., a bad scene graph, a rendering error in an SVG display element) should be contained to that pane only. The rest of the workspace — other panes, the toolbar, the status bar — should continue working normally. The crashed pane shows an inline error state with a "Reload pane" button.

## Spec Excerpt (verbatim)

> **Nested error boundaries around individual panes**: Each pane in the workspace grid is wrapped in its own React error boundary. If a pane component throws, only that pane shows the error state. Other panes continue rendering.
>
> **Error UI**: generic message + [Reload Module] button
> — docs/SPEC_MANIFEST.md, CX-ERROR contract §Nested error boundaries

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/PaneWrapper.tsx` — per-pane chrome wrapper; this is where the error boundary should wrap the pane content
- `frontend/src/shared/components/ErrorBoundary.tsx` — existing module-level error boundary (reuse or adapt for pane-level)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `PaneWrapper.tsx` wraps its children in an `ErrorBoundary` (or equivalent class component with `componentDidCatch`)
- [ ] When a pane throws, only that pane shows the error; other panes continue rendering normally
- [ ] The per-pane error state shows a "Reload pane" (or similar) button that resets the error boundary for that pane
- [ ] Pane error is logged to observability (structured log or tracing call), not only `console.error`

## Assessment

After checking:
- **Status**: ❌ Missing — `PaneWrapper.tsx` has no error boundary. Any uncaught error in `GraphicPane`, `TrendPane`, `PointTablePane`, or `AlarmListPane` bubbles to the module-level `ErrorBoundary` in `App.tsx:147`, taking down the entire Console module.

## Fix Instructions (if needed)

1. **Create `PaneErrorBoundary`** as a class component (error boundaries require class components in React):
   ```tsx
   // frontend/src/pages/console/PaneErrorBoundary.tsx
   import React from 'react'

   interface State { hasError: boolean; error: Error | null }

   export class PaneErrorBoundary extends React.Component<
     { paneId: string; children: React.ReactNode },
     State
   > {
     state: State = { hasError: false, error: null }

     static getDerivedStateFromError(error: Error): State {
       return { hasError: true, error }
     }

     componentDidCatch(error: Error, info: React.ErrorInfo) {
       // TODO: route to structured observability when tracing hook is available
       console.error('[PaneError]', this.props.paneId, error, info)
     }

     render() {
       if (this.state.hasError) {
         return (
           <div style={{ /* error state styles using CSS vars */ }}>
             <p>Pane error</p>
             <button onClick={() => this.setState({ hasError: false, error: null })}>
               Reload pane
             </button>
           </div>
         )
       }
       return this.props.children
     }
   }
   ```

2. **Wrap content in `PaneWrapper.tsx`**: Wherever the pane content (children) is rendered, wrap with `<PaneErrorBoundary paneId={paneId}>`.

3. **Error state styling**: Use `var(--io-surface-sunken)` background, `var(--io-alarm-high)` for error icon, `var(--io-text-muted)` for text. No hardcoded hex.

Do NOT:
- Use a functional component for the error boundary — React requires class components for `componentDidCatch`.
- Re-use the module-level `ErrorBoundary` directly without adaptation — the pane-level one needs a "Reload pane" reset mechanism and should not show the "Reload Module" text.
