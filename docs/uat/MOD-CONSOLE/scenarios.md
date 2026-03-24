# UAT Scenarios — MOD-CONSOLE

Tasks under test: MOD-CONSOLE-007

Note: MOD-CONSOLE-007 title = "Make PointDetailPanel resizable, pinnable, minimizable, and session-position-persisted"
No matching spec file; scenarios synthesized from task title.

---

## Page Baseline

Scenario 1: [MOD-CONSOLE-007] Console page renders without error — navigate to /console → page loads with console UI, no error boundary ("Something went wrong"), no blank page

## PointDetailPanel — Existence and Controls

Scenario 2: [MOD-CONSOLE-007] PointDetailPanel accessible from console — navigate to /console, look for a Point Detail panel, Detail panel button, or trigger in workspace header or pane header → panel or trigger exists

Scenario 3: [MOD-CONSOLE-007] PointDetailPanel has a resize affordance — open PointDetailPanel (via any available method) → a draggable resize handle or resize border visible on panel edge

Scenario 4: [MOD-CONSOLE-007] PointDetailPanel has a pin button — with panel open → pin/unpin icon button visible in panel header controls

Scenario 5: [MOD-CONSOLE-007] PointDetailPanel has a minimize button — with panel open → minimize/collapse icon button visible in panel header controls

## Panel Interaction

Scenario 6: [MOD-CONSOLE-007] PointDetailPanel can be closed — with panel open → close/dismiss button exists in panel header and clicking it hides the panel
