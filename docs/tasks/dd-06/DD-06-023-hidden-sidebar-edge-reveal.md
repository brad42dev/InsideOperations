---
id: DD-06-023
title: Fix hidden sidebar edge-reveal: 8px strip, 200ms dwell, floating overlay on click
unit: DD-06
status: done
priority: medium
depends-on: []
---

## What This Feature Should Do

When the sidebar is in the Hidden state, a transparent 8px hit area at the left edge of the viewport detects mouse proximity. After a 200ms dwell on that strip, a translucent chevron handle (24×48px) fades in over 150ms. Clicking the handle slides the sidebar in as a full 240px floating overlay (position:fixed, no content reflow), with a drop shadow on its right edge. The overlay slides out after a 400ms delay when the mouse leaves, or immediately on Escape. Currently the implementation has a 4px strip with no dwell timer and clicking transitions to the `expanded` state (causing content reflow) rather than opening a floating overlay.

## Spec Excerpt (verbatim)

> **Hidden edge-hover behavior:** Mouse within 8px of left viewport edge → after 200ms dwell, a translucent chevron handle (24x48px) fades in at 150ms → clicking the handle slides the sidebar in as a full overlay (240px, 250ms ease-out). Subtle drop shadow on right edge, no backdrop scrim. Mouse leaving sidebar area → slides out after 400ms delay. `Escape` slides out immediately. "Pin" icon in overlay header → transitions from Hidden to Collapsed.
> — design-docs/06_FRONTEND_SHELL.md, §Sidebar (3-State)

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx:898–938` — the current edge-reveal strip implementation (4px wide, immediate tooltip, click→expanded)
- `frontend/src/shared/layout/AppShell.tsx:481–514` — `sidebarHidden`, `sidebarPeek`, `sidebarState` state declarations

## Verification Checklist

- [x] Edge-reveal hit area is 8px wide (currently 4px at line 907)
- [x] A 200ms dwell timer fires before the handle appears (currently no dwell — `onMouseEnter` immediately sets `sidebarPeek`)
- [x] Handle is a 24×48px semi-transparent chevron element, not a tooltip strip
- [x] Clicking the handle opens the sidebar as a floating overlay (`position: fixed`, no flex layout change, content does not reflow)
- [x] Mouse leaving the sidebar overlay triggers a 400ms retract delay before closing
- [x] Escape key closes the sidebar overlay immediately when it is open in this mode
- [x] A "Pin" button in the overlay header transitions from Hidden → Collapsed (persisting the sidebar in layout)

## Assessment

- **Status**: ⚠️ Partial — strip exists but wrong width (4px not 8px), no dwell timer, click causes full state transition with reflow rather than floating overlay, 400ms retract/Pin/Escape behaviors absent

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`:

1. **Widen strip to 8px**: at the hidden edge strip div (line ~907), change `width: 4` → `width: 8`.

2. **Add dwell timer**: Replace the immediate `onMouseEnter={() => setSidebarPeek(true)}` with a timer:
   ```tsx
   const sidebarEdgeDwellRef = useRef<ReturnType<typeof setTimeout> | null>(null)
   // onMouseEnter:
   sidebarEdgeDwellRef.current = setTimeout(() => setSidebarPeek(true), 200)
   // onMouseLeave: clearTimeout(sidebarEdgeDwellRef.current); setSidebarPeek(false)
   ```

3. **Chevron handle**: Replace the tooltip `<div>` with a styled 24×48px semi-transparent handle:
   ```tsx
   {sidebarPeek && (
     <div style={{
       position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
       width: 24, height: 48,
       background: 'var(--io-surface-elevated)',
       border: '1px solid var(--io-border)',
       borderRadius: '0 6px 6px 0',
       display: 'flex', alignItems: 'center', justifyContent: 'center',
       cursor: 'pointer', opacity: 0.85,
       animation: 'fadeIn 150ms ease-out',
     }} onClick={openHiddenSidebarOverlay}>›</div>
   )}
   ```

4. **Floating overlay mode**: Introduce a new state `sidebarHiddenPeekOpen` (distinct from `sidebarState`). When the chevron is clicked, set `sidebarHiddenPeekOpen = true` — this renders the sidebar as `position: fixed, left: 0, width: 240px` without changing `sidebarState`. Do NOT call `setSidebarState('expanded')` — that reflows content.

5. **400ms retract on mouse-leave**: The floating overlay's `onMouseLeave` should set a 400ms timer to set `sidebarHiddenPeekOpen = false`.

6. **Escape closes overlay**: In the keyboard handler (line ~759), add a check: if `sidebarHiddenPeekOpen`, close it on Escape before checking kiosk exit.

7. **Pin button**: Add a pin icon in the floating overlay header. Clicking it calls `setSidebarState('collapsed')` and `setSidebarHiddenPeekOpen(false)`.

Do NOT:
- Change `sidebarState` from `'hidden'` when the overlay opens — that would reflow content
- Remove the existing collapsed sidebar hover-to-expand logic — that's separate behavior
- Set `sidebarHiddenPeekOpen = true` immediately on edge-hover — the dwell timer must fire first
