---
id: MOD-CONSOLE-006
title: Wrap each Console pane in a nested error boundary
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

A crash in any single pane (e.g., a GraphicPane with a malformed scene graph) must not take down the entire Console module. Each pane must be wrapped in its own error boundary so that the rest of the workspace continues to function when one pane fails. The pane's error state must show a recovery UI with a "Reload Pane" button that remounts just that pane component.

## Spec Excerpt (verbatim)

> Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
> — SPEC_MANIFEST.md, §CX-ERROR Non-negotiables #3
>
> Error UI shows: generic error message + **[Reload Module]** button (remounts the module component, no full page reload).
> — SPEC_MANIFEST.md, §CX-ERROR Non-negotiables #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/PaneWrapper.tsx` — the per-pane wrapper component; no `ErrorBoundary` present
- `frontend/src/shared/components/ErrorBoundary.tsx` — the shared error boundary class component
- `frontend/src/App.tsx` — module-level boundary exists at lines 147, 157, 167 for Console routes

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `ErrorBoundary` is imported in `PaneWrapper.tsx`
- [ ] The pane content area (the `div` at line 400 containing the pane type renders) is wrapped in `<ErrorBoundary>`
- [ ] The error boundary's fallback shows "Pane failed to load" + a "Reload Pane" button that resets the boundary state
- [ ] A crash in `GraphicPane` does not propagate to the module-level boundary in `App.tsx`
- [ ] The `module` prop on the `ErrorBoundary` identifies the pane type (e.g., `"Graphic Pane"`)

## Assessment

Current state: no `ErrorBoundary` anywhere in `frontend/src/pages/console/`. The `PaneWrapper.tsx` renders pane content directly. A React error in `SceneRenderer` or `GraphicPane` will propagate to the module boundary at `App.tsx:147` and kill the whole Console module.

## Fix Instructions

1. In `frontend/src/pages/console/PaneWrapper.tsx`:
   - Add import: `import { ErrorBoundary } from '../../shared/components/ErrorBoundary'`
   - Wrap the content `div` at line 400 in `<ErrorBoundary module={`${title} Pane`}>`:
     ```tsx
     <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
       <ErrorBoundary
         module={`${title} Pane`}
         fallback={
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--io-text-muted)', fontSize: 13 }}>
             <span>Pane failed to load</span>
             {/* ErrorBoundary's own reset button handles reload */}
           </div>
         }
       >
         {/* existing pane content renders */}
       </ErrorBoundary>
     </div>
     ```

2. The existing `ErrorBoundary` component already has a "Try again" button that calls `this.setState({ hasError: false })`. This is acceptable as the per-pane recovery mechanism. Do NOT change `ErrorBoundary.tsx`.

3. Verify by intentionally throwing an error in `GraphicPane` in development — confirm other panes remain functional.

Do NOT:
- Remove the module-level boundary in `App.tsx` — it remains as the outer fallback
- Change the error message to "Reload Module" — that label is for the module-level boundary; per-pane should say "Reload Pane" or keep "Try again"
- Wrap PaneWrapper itself (only the content area) — the pane header/drag handle must remain functional even when content errors
