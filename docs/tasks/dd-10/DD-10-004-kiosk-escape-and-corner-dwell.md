---
id: DD-10-004
title: Add Escape key exit and corner-dwell reveal to kiosk mode in DashboardViewer
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a dashboard is in kiosk mode (`?kiosk=true`), pressing Escape must exit kiosk mode. Additionally, hovering the mouse in any corner for 1.5 seconds must reveal a minimal exit strip (currently the strip reveals on any mouse movement, not on corner dwell). The PlaylistPlayer already implements Escape correctly; DashboardViewer does not.

## Spec Excerpt (verbatim)

> "Exiting kiosk mode: Escape key or a hoverable corner trigger (mouse dwell 1.5s on corner) reveals a minimal exit button."
> — docs/SPEC_MANIFEST.md, §CX-KIOSK Non-negotiables #3

> "Exit: Escape key or hover-to-reveal exit button"
> — design-docs/10_DASHBOARDS_MODULE.md, §Kiosk Display

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — kiosk strip logic at lines 290–443; `onMouseMove` on the outer div at line 291–293 triggers strip unconditionally; no keydown listener
- `frontend/src/pages/dashboards/PlaylistPlayer.tsx` — lines 73–101 — correct Escape implementation to reference

## Verification Checklist

- [ ] Pressing Escape when in kiosk mode (`isKiosk === true`) exits kiosk mode (removes `?kiosk=true` from URL)
- [ ] `onMouseMove` on the outer div does NOT unconditionally set `showKioskStrip = true`
- [ ] Moving mouse to any corner and dwelling there for 1.5 seconds sets `showKioskStrip = true`
- [ ] Moving mouse away from corner before 1.5 seconds cancels the dwell timer (strip does not appear)
- [ ] Strip auto-hides after the mouse leaves the corner (or after a short timeout)
- [ ] Escape key listener is cleaned up in the `useEffect` return (no leak)

## Assessment

- **Status**: ❌ Missing — DashboardViewer.tsx has no keydown listener; strip shows on any mouse move, not on 1.5s corner dwell

## Fix Instructions

In `frontend/src/pages/dashboards/DashboardViewer.tsx`:

1. Add a `useEffect` for the Escape key (add after the existing `useEffect` at line 185):
   ```tsx
   useEffect(() => {
     if (!isKiosk) return
     function handleKeyDown(e: KeyboardEvent) {
       if (e.code === 'Escape') {
         const newParams = new URLSearchParams(searchParams)
         newParams.delete('kiosk')
         setSearchParams(newParams)
       }
     }
     window.addEventListener('keydown', handleKeyDown)
     return () => window.removeEventListener('keydown', handleKeyDown)
   }, [isKiosk, searchParams, setSearchParams])
   ```

2. Replace the current `onMouseMove` strip logic with corner-dwell logic. Add a ref:
   ```tsx
   const cornerDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   ```

3. Change the outer div's `onMouseMove` to a `handleMouseMove` that checks whether the cursor is within 60px of any corner, and starts a 1500ms timer on entering a corner zone (clearing it on leaving):
   ```tsx
   function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
     if (!isKiosk) return
     const el = e.currentTarget
     const rect = el.getBoundingClientRect()
     const x = e.clientX - rect.left
     const y = e.clientY - rect.top
     const ZONE = 60
     const inCorner =
       (x < ZONE || x > rect.width - ZONE) &&
       (y < ZONE || y > rect.height - ZONE)
     if (inCorner) {
       if (!cornerDwellTimerRef.current) {
         cornerDwellTimerRef.current = setTimeout(() => {
           setShowKioskStrip(true)
         }, 1500)
       }
     } else {
       if (cornerDwellTimerRef.current) {
         clearTimeout(cornerDwellTimerRef.current)
         cornerDwellTimerRef.current = null
       }
       setShowKioskStrip(false)
     }
   }
   ```

4. Clean up the timer in the kiosk useEffect cleanup or add a dedicated cleanup effect.

5. The `onMouseLeave` at line 294 can remain to clear the strip when the mouse leaves the viewport.

Do NOT:
- Remove the existing hover-strip behavior for non-kiosk mode (the toolbar is always shown when !isKiosk).
- Add Escape handling when `isKiosk === false` — Escape has no kiosk meaning outside kiosk mode.
