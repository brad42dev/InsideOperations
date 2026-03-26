---
id: DD-06-022
title: Implement kiosk restricted mode in command palette
unit: DD-06
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the app is in kiosk mode and the user is not authenticated (visual lock is active), the command palette opens in restricted mode: only read-only navigation commands are available (switch graphic, go to module, search points for display). No create, edit, delete, export, or acknowledge actions are shown. The palette header displays a "Kiosk Mode — Limited" badge so the operator knows they are in restricted mode.

## Spec Excerpt (verbatim)

> `Ctrl+K` works in kiosk mode. When not authenticated, the palette opens in **restricted mode**: only read-only navigation commands (switch graphic, go to module, search points for display). No create/edit/delete actions. Palette header shows "Kiosk Mode — Limited" badge. This lets operators quickly change what's on screen without full login.
> — design-docs/06_FRONTEND_SHELL.md, §Command Palette in Kiosk

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/CommandPalette.tsx` — add `isKiosk` and `isAuthenticated` props; add restricted mode filter and header badge
- `frontend/src/shared/layout/AppShell.tsx:1947` — `<CommandPalette>` invocation; pass kiosk/auth state
- `frontend/src/store/ui.ts` — `isKiosk`, `isLocked` state
- `frontend/src/store/auth.ts` — `user` (null when unauthenticated)

## Verification Checklist

- [ ] `CommandPalette` accepts an `isKiosk` prop (or reads from store)
- [ ] When `isKiosk=true` and session is locked, palette shows "Kiosk Mode — Limited" badge in header
- [ ] When `isKiosk=true` and locked, only read-only navigation commands are displayed (no create/edit/delete/acknowledge actions)
- [ ] When `isKiosk=true` and authenticated (lock not active), palette shows full command set
- [ ] Ctrl+K in kiosk mode opens the palette regardless of lock state (spec: "always")

## Assessment

- **Status**: ❌ Missing — `CommandPalette` has no kiosk awareness; no restricted mode; no badge

## Fix Instructions

1. In `frontend/src/shared/components/CommandPalette.tsx`:
   - Add props: `isKiosk?: boolean` and `isLocked?: boolean` (or read `useUiStore()` directly inside the component).
   - Add a `kioskRestricted` computed value: `const kioskRestricted = isKiosk && isLocked`.
   - When `kioskRestricted`, add a header badge below the input: `<span style="...">Kiosk Mode — Limited</span>`.
   - When `kioskRestricted`, filter `COMMANDS` to only read-only navigation items (modules: console, process, dashboards, etc.) and exclude any commands that create/edit/delete/export/acknowledge.

2. In `frontend/src/shared/layout/AppShell.tsx:1947`, pass kiosk/lock state to CommandPalette:
   ```tsx
   <CommandPalette
     open={paletteOpen}
     onOpenChange={setPaletteOpen}
     isKiosk={isKiosk}
     isLocked={isLocked}
   />
   ```

3. The `kioskRestricted` filter must only affect the displayed command list — the search input, keyboard navigation, and API search should still work (for point lookups by operators).

Do NOT:
- Block Ctrl+K from opening the palette in kiosk mode — the spec explicitly says it "works in kiosk mode. Always"
- Show a completely blank palette — show nav commands and search
- Apply the restriction when `isKiosk=true` but `isLocked=false` (authenticated kiosk sessions get full palette)
