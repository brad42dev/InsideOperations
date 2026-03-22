---
id: DD-06-002
title: Wire kiosk mode to URL parameter and keyboard shortcut in AppShell
unit: DD-06
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Kiosk mode hides the sidebar and top bar, giving full viewport to module content. It must activate automatically when the URL contains `?mode=kiosk` (for bookmarkable control-room displays), via `Ctrl+Shift+K`, and from the user menu. The AppShell currently reads `isKiosk` from the store to conditionally hide chrome, but nothing in AppShell ever sets `isKiosk` to true. The store state is never written.

## Spec Excerpt (verbatim)

> | Method | Details |
> |--------|---------|
> | URL parameter | `?mode=kiosk` — enters kiosk on page load. Bookmarkable for control room displays. |
> | Keyboard shortcut | `Ctrl+Shift+K` (toggle) |
> | Command palette | `>Enter kiosk mode` |
> | UI button | User profile dropdown: "Enter Kiosk Mode" |
>
> What Happens on Entry:
> 1. Sidebar state saved to memory, transitions to Hidden (0px)
> 2. Top bar state saved to memory, transitions to Hidden (0px)
> 3. Content area expands to fill the full viewport
> 4. URL parameter `?mode=kiosk` added (refresh stays in kiosk)
> 5. Also stored in `sessionStorage` (survives in-app navigation)
> 6. Brief toast (2s): "Kiosk mode active. Press Escape to exit."
> — 06_FRONTEND_SHELL.md, §Kiosk Mode

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` lines 211–215 — where isKiosk is read but never set from URL
- `frontend/src/store/ui.ts` lines 18,38 — setKiosk function exists, not called from AppShell
- `frontend/src/shared/layout/AppShell.tsx` lines 284–362 — keyboard handler where Ctrl+Shift+K is missing

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] AppShell reads `?mode=kiosk` from `useSearchParams()` and calls `setKiosk(true)` on mount if present
- [ ] `Ctrl+Shift+K` handler present in AppShell keyboard handler, calls `setKiosk(!isKiosk)`
- [ ] On kiosk entry: sidebarState set to 'hidden', topbarHidden set to true, URL param added
- [ ] On kiosk exit: previous sidebar/topbar states restored, `?mode=kiosk` removed from URL
- [ ] `sessionStorage` used to persist kiosk state across in-app navigation
- [ ] Brief toast shown on kiosk entry (2 seconds)
- [ ] Escape key exits kiosk (in AppShell keyboard handler)

## Assessment

After checking:
- **Status**: ❌ Missing — `setKiosk()` exists in ui store but AppShell never calls it. URL param `?mode=kiosk` is never read. No Ctrl+Shift+K handler.

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`:

1. **Read URL param on mount** — Add near the top of AppShell component body:
   ```typescript
   const [searchParams, setSearchParams] = useSearchParams()
   const { setKiosk } = useUiStore()

   useEffect(() => {
     const isKioskParam = searchParams.get('mode') === 'kiosk' || sessionStorage.getItem('io_kiosk') === '1'
     if (isKioskParam) {
       setKiosk(true)
       setSidebarState('hidden')
       setTopbarHidden(true)
     }
   }, []) // run once on mount
   ```

2. **Save pre-kiosk state and enter kiosk** — Add helper:
   ```typescript
   const preKioskSidebarRef = useRef<'expanded' | 'collapsed' | 'hidden'>('expanded')
   const preKioskTopbarRef = useRef(false)

   function enterKiosk() {
     preKioskSidebarRef.current = sidebarState
     preKioskTopbarRef.current = topbarHidden
     setKiosk(true)
     setSidebarState('hidden')
     setTopbarHidden(true)
     sessionStorage.setItem('io_kiosk', '1')
     const params = new URLSearchParams(searchParams)
     params.set('mode', 'kiosk')
     setSearchParams(params)
     // show toast "Kiosk mode active. Press Escape to exit."
   }

   function exitKiosk() {
     setKiosk(false)
     setSidebarState(preKioskSidebarRef.current)
     setTopbarHidden(preKioskTopbarRef.current)
     sessionStorage.removeItem('io_kiosk')
     const params = new URLSearchParams(searchParams)
     params.delete('mode')
     setSearchParams(params)
   }
   ```

3. **Add Ctrl+Shift+K to keyboard handler** (in handleKeyDown, around line 320):
   ```typescript
   if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
     e.preventDefault()
     if (isKiosk) { exitKiosk() } else { enterKiosk() }
     return
   }
   ```

4. **Add Escape handling for kiosk exit** at the top of the Escape key logic.

Do NOT:
- Use `?kiosk=true` as the param key — spec says `?mode=kiosk`
- Trigger browser fullscreen automatically on Ctrl+Shift+K (spec: "Keyboard shortcut does NOT auto-fullscreen")
- Change the server-side auth logic (kiosk is purely frontend chrome hiding)
