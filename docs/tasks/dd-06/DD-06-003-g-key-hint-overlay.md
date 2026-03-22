---
id: DD-06-003
title: Add visual hint overlay for G-key navigation
unit: DD-06
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When the user presses `G` (with no modifier keys, outside a text input), a small visual overlay appears near the sidebar listing the available module shortcuts (e.g., "C — Console", "P — Process"). This hint auto-dismisses after 2 seconds if no second key is pressed. Currently the G-key navigation works, but the hint overlay is completely absent — there is no visual feedback that the user has entered G-key mode.

## Spec Excerpt (verbatim)

> On `G` press, a visual hint overlay appears near the sidebar showing available targets with their key bindings. The overlay auto-dismisses after 2 seconds if no second key is pressed, or immediately on second key press or Escape.
> — 06_FRONTEND_SHELL.md, §G-Key Navigation

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` lines 280–354 — G-key logic sets `gKeyPending.current = true` but renders no UI for it

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] State variable `gKeyHintVisible` (or similar) added to AppShell component
- [ ] Set to true when G key pressed, false when second key pressed, Escape pressed, or 2-second timeout fires
- [ ] Overlay renders as a small fixed panel near the sidebar (bottom-left corner or beside sidebar)
- [ ] Overlay lists all 11 module shortcuts with their key letter and module name
- [ ] Overlay dismisses immediately on second key (navigate) or Escape
- [ ] Overlay not shown when a text input is focused (already guarded by the existing input check)

## Assessment

After checking:
- **Status**: ❌ Missing — gKeyPending tracked in ref but no state drives any UI rendering

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`:

1. Add state:
   ```typescript
   const [gKeyHintVisible, setGKeyHintVisible] = useState(false)
   ```

2. In the G key handler (around line 335), add:
   ```typescript
   gKeyPending.current = true
   setGKeyHintVisible(true)  // show the overlay
   if (gKeyTimerRef.current) clearTimeout(gKeyTimerRef.current)
   gKeyTimerRef.current = setTimeout(() => {
     gKeyPending.current = false
     setGKeyHintVisible(false)  // auto-dismiss after 2s (spec says 2s, code uses 1.5s — update to 2000ms)
   }, 2000)
   ```

3. In the second-key handler (around line 345), add `setGKeyHintVisible(false)`.

4. Add the hint overlay JSX before the closing `</div>` of the AppShell return:
   ```tsx
   {gKeyHintVisible && (
     <div style={{
       position: 'fixed',
       bottom: '80px',
       left: isKiosk ? '12px' : (sidebarHidden ? '12px' : sidebarCollapsed ? 'calc(48px + 8px)' : 'calc(240px + 8px)'),
       background: 'var(--io-surface-elevated)',
       border: '1px solid var(--io-border)',
       borderRadius: 'var(--io-radius)',
       boxShadow: 'var(--io-shadow-lg)',
       padding: '8px 12px',
       zIndex: 'var(--io-z-dropdown)',
       fontSize: '12px',
       color: 'var(--io-text-secondary)',
       minWidth: '160px',
     }}>
       <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--io-text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Go to…</div>
       {Object.entries(G_KEY_MAP).map(([key, path]) => {
         const label = NAV_ITEMS.find(n => n.path === path)?.label ?? path
         return (
           <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '2px 0' }}>
             <span>{label}</span>
             <kbd style={{ background: 'var(--io-surface-sunken)', border: '1px solid var(--io-border)', borderRadius: '3px', padding: '0 4px', fontFamily: 'inherit' }}>
               {key.toUpperCase()}
             </kbd>
           </div>
         )
       })}
     </div>
   )}
   ```

Do NOT:
- Show the overlay when a text input is focused (the existing guard at line 303 prevents G from firing in inputs)
- Keep the gKeyTimerRef timeout at 1500ms (spec says 2 seconds — update to 2000ms)
