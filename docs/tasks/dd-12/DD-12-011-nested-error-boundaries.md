---
id: DD-12-011
title: Add nested error boundaries inside InvestigationWorkspace panels
unit: DD-12
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The InvestigationWorkspace is a large module (points panel, multiple stage cards, correlation results panel). A crash in any single panel — e.g., a malformed ECharts heatmap, a failed evidence renderer — must not kill the entire investigation view. Each major panel needs its own nested error boundary so only the crashing panel is replaced with a recovery UI.

## Spec Excerpt (verbatim)

> Large modules (Console, Forensics, Designer) have **nested error boundaries** around individual panes/panels — a single pane crash must not kill the whole module.
> — SPEC_MANIFEST.md, §CX-ERROR, Non-negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — three major panels: PointsPanel (line 1595), stage list (lines 1607–1657), ResultsPanel (line 1693); none have inner ErrorBoundary wrappers
- `frontend/src/shared/components/ErrorBoundary.tsx` — the shared ErrorBoundary component used in App.tsx; check its props
- `frontend/src/App.tsx` — shows correct usage pattern at lines 455, 465, etc.

## Verification Checklist

- [ ] `PointsPanel` is wrapped in an `<ErrorBoundary>` inside InvestigationWorkspace
- [ ] Each `StageCard` (or the stage list container) is wrapped in an `<ErrorBoundary>`
- [ ] `ResultsPanel` (correlation heatmap + analysis tabs) is wrapped in an `<ErrorBoundary>`
- [ ] A crash in `CorrelationHeatmap` does not crash the entire InvestigationWorkspace
- [ ] Each boundary's error UI shows a "[Reload Panel]" button that remounts only the crashed panel (not a full page reload)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: App.tsx wraps each forensics route in a top-level `<ErrorBoundary module="Forensics">`, but InvestigationWorkspace.tsx has no inner ErrorBoundary wrappers around PointsPanel, StageCard, or ResultsPanel.

## Fix Instructions

In `frontend/src/pages/forensics/InvestigationWorkspace.tsx`:

1. Import `ErrorBoundary` from `../../shared/components/ErrorBoundary`.

2. Wrap `PointsPanel` at line 1595:
   ```tsx
   <ErrorBoundary module="Forensics — Points Panel">
     <PointsPanel ... />
   </ErrorBoundary>
   ```

3. Wrap each `StageCard` at line 1628:
   ```tsx
   {stages.map((stage) => (
     <ErrorBoundary key={stage.id} module={`Forensics — Stage: ${stage.name}`}>
       <StageCard ... />
     </ErrorBoundary>
   ))}
   ```

4. Wrap `ResultsPanel` at line 1693:
   ```tsx
   <ErrorBoundary module="Forensics — Analysis Results">
     <ResultsPanel ... />
   </ErrorBoundary>
   ```

5. Verify that the shared `ErrorBoundary` component accepts a `module` prop for its display label and renders a "[Reload Module]" / "[Reload Panel]" button that calls `this.setState({ hasError: false })` — not `window.location.reload()`.

Do NOT:
- Add error boundaries around every small component — only the three major panels need them
- Implement separate ErrorBoundary classes for forensics — reuse the shared component
