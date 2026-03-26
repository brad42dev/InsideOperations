---
id: DD-12-013
title: Historical Playback Bar missing from forensics investigation workspace
unit: DD-12
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-12/CURRENT.md
---

## What to Build

UAT Scenario [DD-12-010]: The forensics investigation workspace at `/forensics/:id` shows no `HistoricalPlaybackBar`. Console, Process, and Dashboards all render a playback bar so users can scrub through historical time; the investigation workspace is missing this component. Without it, investigators have no global time-context control while reviewing stage evidence.

The `ForensicsPlaybackBar` is already correctly used inside the per-stage snapshot dialog (DD-12-010 was implemented). This task is about adding the shared `HistoricalPlaybackBar` to the top of the investigation workspace view — the same component Console renders via `{workspaces.length > 0 && <HistoricalPlaybackBar />}`.

## Acceptance Criteria

- [ ] `InvestigationWorkspace` renders a `HistoricalPlaybackBar` when investigation data is loaded
- [ ] The playback bar appears at the top of the workspace (below the toolbar, above the main panels)
- [ ] No TypeScript errors introduced

## Files to Create or Modify

- `frontend/src/pages/forensics/InvestigationWorkspace.tsx` — import and render `HistoricalPlaybackBar`

## Verification Checklist

- [ ] Navigate to `/forensics/:id` with an active investigation
- [ ] Confirm `HistoricalPlaybackBar` is visible at the top of the workspace
- [ ] Confirm Console-style playback controls are functional (live/historical toggle + time scrub)
- [ ] TypeScript build passes: `pnpm --filter frontend tsc --noEmit`

## Do NOT

- Do not modify `ForensicsPlaybackBar` — it's already correct for per-stage snapshot dialogs
- Do not add playback bar to the investigations list page (`/forensics`) — only the workspace

## Dev Notes

UAT failure from 2026-03-23: Investigation workspace has no HistoricalPlaybackBar. `HistoricalPlaybackBar` is at `frontend/src/shared/components/HistoricalPlaybackBar.tsx`. Console pattern: `{workspaces.length > 0 && <HistoricalPlaybackBar />}` at `frontend/src/pages/console/index.tsx:1435`.
