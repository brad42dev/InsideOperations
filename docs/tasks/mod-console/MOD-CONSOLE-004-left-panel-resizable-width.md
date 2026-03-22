---
id: MOD-CONSOLE-004
title: Make left nav panel resizable (200–400px) with persisted width
unit: MOD-CONSOLE
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The Console left navigation panel must be resizable between 200px and 400px by dragging its right edge. The user's chosen width must persist across sessions (server-side in user preferences or localStorage). Currently the panel is hardcoded at 220px with no resize handle.

## Spec Excerpt (verbatim)

> Panel width: 280px default, resizable 200-400px, width persisted
> — console-implementation-spec.md, §2.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/ConsolePalette.tsx` — line 34: `PANEL_W = 220` hardcoded constant used for width
- `frontend/src/pages/console/ConsolePalette.tsx` — lines 36-45: `panel` style object that sets `width` and `minWidth` from `PANEL_W`

## Verification Checklist

- [ ] Panel width is controlled by a state variable with default 280px (not a hardcoded constant)
- [ ] A drag handle (vertical divider) exists on the right edge of the panel
- [ ] Dragging the handle resizes the panel; minimum 200px, maximum 400px
- [ ] Width is persisted (localStorage or user preferences API) and restored on next session
- [ ] Panel width change does not cause layout reflow outside the panel

## Assessment

- **Status**: ❌ Missing
- `ConsolePalette.tsx:34` — `const PANEL_W = 220` — hardcoded, no state
- `ConsolePalette.tsx:36-45` — `panel` style has `width: PANEL_W, minWidth: PANEL_W` — no resize handle

## Fix Instructions

**Step 1 — Lift panel width into state** in the parent `ConsolePage` (or inside `ConsolePalette`):
```typescript
const [panelWidth, setPanelWidth] = useState(() => {
  const stored = localStorage.getItem('io-console-panel-width')
  return stored ? Math.max(200, Math.min(400, Number(stored))) : 280
})
```

**Step 2 — Add a resize handle** as a `<div>` on the right edge of the panel:
```tsx
<div
  style={{ width: 4, cursor: 'ew-resize', background: 'transparent', flexShrink: 0, zIndex: 1 }}
  onPointerDown={(e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = panelWidth
    const onMove = (mv: PointerEvent) => {
      const newW = Math.max(200, Math.min(400, startW + (mv.clientX - startX)))
      setPanelWidth(newW)
    }
    const onUp = () => {
      localStorage.setItem('io-console-panel-width', String(panelWidth))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }}
/>
```

**Step 3 — Pass `panelWidth` to `ConsolePalette`** as a prop and use it in the `panel` style object instead of `PANEL_W`.

Do NOT:
- Use a library for this (pointer event resize is simple enough inline)
- Persist width in a Zustand store (localStorage is sufficient for this preference)
- Allow width below 200px or above 400px
