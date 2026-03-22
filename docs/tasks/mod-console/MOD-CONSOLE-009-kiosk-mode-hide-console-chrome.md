---
id: MOD-CONSOLE-009
title: Hide Console status bar and playback bar in kiosk mode
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the application is in kiosk mode (`?kiosk=true` URL parameter or `isKiosk` store state), the Console module must hide its own chrome: the status bar at the bottom and the playback bar above it. The AppShell already hides the sidebar and topbar, but Console-specific UI elements are not affected by the shell's kiosk state. In kiosk mode, only the workspace grid area should be visible.

## Spec Excerpt (verbatim)

> URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
> — SPEC_MANIFEST.md, §CX-KIOSK Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — status bar at lines 1308-1313; playback bar at line 1306
- `frontend/src/store/ui.ts` — `isKiosk` state and `setKiosk` action
- `frontend/src/shared/layout/AppShell.tsx` — kiosk implementation reference (lines 248-282)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `useUiStore` is imported and `isKiosk` is destructured in `ConsolePage` (`index.tsx`)
- [ ] The `ConsoleStatusBar` render at line 1308-1313 is wrapped in `{!isKiosk && <ConsoleStatusBar ... />}`
- [ ] The `HistoricalPlaybackBar` render at line 1306 is also suppressed in kiosk mode OR remains visible during historical playback (the playback bar may be an exception — check spec intent; it is an operational control, not chrome)
- [ ] The workspace header/tab bar at line 756-1143 is hidden in kiosk mode (it contains Edit/Export/etc. controls that constitute chrome)

## Assessment

Current state: `index.tsx:1306-1313` — both `HistoricalPlaybackBar` and `ConsoleStatusBar` render unconditionally (only gated on `workspaces.length > 0`). The header at line 756 also renders unconditionally. No `isKiosk` import or check in `console/index.tsx`.

## Fix Instructions

1. In `frontend/src/pages/console/index.tsx`, add to the store imports near line 14-18:
   ```typescript
   import { useUiStore } from '../../store/ui'
   ```

2. In `ConsolePage`, destructure the kiosk state near the other store reads (line 177+):
   ```typescript
   const { isKiosk } = useUiStore()
   ```

3. Conditionally hide the status bar (line 1308-1313):
   ```tsx
   {workspaces.length > 0 && !isKiosk && (
     <ConsoleStatusBar workspaceName={activeWorkspace?.name ?? ''} />
   )}
   ```

4. The playback bar (line 1306) — per spec §8.1, in Historical mode the playback bar is the primary control. Decision: hide the bar's permanent chrome but keep it accessible during historical playback via the Live/Historical toggle. For kiosk mode, hide the bar when in live mode; show it when in historical mode (since it's functional, not decorative):
   ```tsx
   {workspaces.length > 0 && (!isKiosk || mode === 'historical') && <HistoricalPlaybackBar />}
   ```

5. The workspace header at line 756 (tabs + Edit/Export controls): wrap in `{!isKiosk && (` ... `)}`

Do NOT:
- Break the workspace grid rendering — the grid must remain visible in kiosk mode
- Remove real-time subscriptions or WebSocket connections in kiosk mode
- Add a kiosk corner-exit trigger in the Console module (that belongs in AppShell, which already handles it at `AppShell.tsx:374`)
