---
id: MOD-CONSOLE-011
title: Fix kiosk URL parameter from ?mode=kiosk to ?kiosk=true; add corner dwell exit trigger
unit: MOD-CONSOLE
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The kiosk mode URL parameter must be `?kiosk=true` (not `?mode=kiosk`). Exiting kiosk mode must also support a hoverable corner trigger: dwelling the mouse in any screen corner for 1.5 seconds reveals a minimal exit button. The Escape key exit already works.

## Spec Excerpt (verbatim)

> URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
> Exiting kiosk mode: `Escape` key or a hoverable corner trigger (mouse dwell 1.5s on corner) reveals a minimal exit button.
> — SPEC_MANIFEST.md, CX-KIOSK non-negotiables #1 and #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` — line 280: checks `searchParams.get('mode') === 'kiosk'`. Line 256: `params.set('mode', 'kiosk')` when entering kiosk mode. Lines 373-378: Escape key exit is correct.

## Verification Checklist

- [ ] `?kiosk=true` in the URL activates kiosk mode (AppShell reads `searchParams.get('kiosk') === 'true'`).
- [ ] Entering kiosk mode sets `?kiosk=true` in the URL (not `?mode=kiosk`).
- [ ] Corner dwell trigger: dwelling the mouse in any of the 4 screen corners for 1.5s reveals an "Exit Kiosk" button.
- [ ] The corner "Exit Kiosk" button is a small semi-transparent overlay that disappears when the mouse leaves the corner area.
- [ ] Escape key still exits kiosk (already works — preserve this).

## Assessment

- **Status**: ⚠️ Wrong
- AppShell.tsx:280 reads `?mode=kiosk` instead of `?kiosk=true`. Any external URLs or links using `?kiosk=true` (the spec-documented form) would not activate kiosk mode. Also: no corner dwell trigger exists — only the Escape key.

## Fix Instructions

**URL parameter fix** in `frontend/src/shared/layout/AppShell.tsx`:

Line 280: change the check from:
```typescript
searchParams.get('mode') === 'kiosk'
```
to:
```typescript
searchParams.get('kiosk') === 'true'
```

Line 256: change the URL write from:
```typescript
params.set('mode', 'kiosk')
```
to:
```typescript
params.set('kiosk', 'true')
```

Also update the exit code (where `params.delete('mode')` is called — change to `params.delete('kiosk')`).

**Corner dwell trigger:**
Add a fixed overlay `div` at each of the 4 corners of the viewport (20x20px transparent hit areas). When `isKiosk` is true, render these overlays. Use `onMouseEnter`/`onMouseLeave` with a `setTimeout` of 1500ms:

```tsx
{isKiosk && (
  ['tl', 'tr', 'bl', 'br'].map(corner => (
    <CornerTrigger
      key={corner}
      corner={corner as 'tl' | 'tr' | 'bl' | 'br'}
      onDwellComplete={exitKioskRef.current}
    />
  ))
)}
```

`CornerTrigger` is a small functional component:
- Fixed position at the corresponding corner (e.g., `{ top: 0, left: 0 }` for 'tl')
- 32x32px transparent div
- `onMouseEnter`: starts a 1500ms timer; `onMouseLeave`: clears the timer
- On timer complete: shows a semi-transparent "Exit Kiosk" button near the corner. Button click calls `onDwellComplete`.

Do NOT:
- Break the `sessionStorage` kiosk persistence — it reads `io_kiosk` from sessionStorage, which does not depend on the URL parameter format.
- Change the Ctrl+Shift+K toggle behavior — preserve it.
- Add the corner trigger overlays when NOT in kiosk mode — they should only render when `isKiosk` is true.
