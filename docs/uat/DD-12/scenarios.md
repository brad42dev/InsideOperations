# UAT Scenarios — DD-12

## Forensics Module

Scenario 1: [DD-12-012] Forensics page renders without error — navigate to /forensics → page loads, no error boundary
Scenario 2: [DD-12-012] Empty state CTA — navigate to /forensics with no investigations → CTA button visible (gated by permission)
Scenario 3: [DD-12-010] Historical Playback Bar for graphic snapshot — open forensics with graphic snapshot area → playback bar (not datetime-local input) present for setting timestamp
Scenario 4: [DD-12-012] Heatmap uses design token colors — any heatmap visualization → colors should use CSS variables not hardcoded hex
