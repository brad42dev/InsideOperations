---
id: MOD-PROCESS-019
title: Hide breadcrumb nav bar and view toolbar in kiosk mode
unit: MOD-PROCESS
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When `?kiosk=true` is active, all module chrome must be hidden — including the breadcrumb navigation bar (shown when history depth > 1) and the view toolbar. Currently only the sidebar and status bar are hidden; breadcrumbs and toolbar remain visible in kiosk mode.

## Spec Excerpt (verbatim)

> URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
> — SPEC_MANIFEST.md, §CX-KIOSK Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:1096-1150` — breadcrumb nav bar (`navHistory.length > 0 &&` condition, no `isKiosk` guard)
- `frontend/src/pages/process/index.tsx:1347-1525` — view toolbar (no `isKiosk` guard)
- `frontend/src/pages/process/index.tsx:1075` — sidebar (correctly hidden: `!isKiosk &&`)
- `frontend/src/pages/process/index.tsx:1531` — status bar (correctly hidden: `!isKiosk &&`)

## Verification Checklist

- [ ] Breadcrumb nav bar is not rendered when `isKiosk === true`.
- [ ] View toolbar (zoom controls, Live/Historical, Export, etc.) is not rendered when `isKiosk === true`.
- [ ] Sidebar continues to be hidden in kiosk mode (already correct — do not break).
- [ ] Status bar continues to be hidden in kiosk mode (already correct — do not break).
- [ ] Real-time updates, minimap, and all functionality continue working without the toolbar.

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:1096` — breadcrumb bar renders conditionally on `navHistory.length > 0` but has no `isKiosk` guard.
- `index.tsx:1347-1525` — view toolbar has no `isKiosk` guard at all.
- Sidebar (`index.tsx:1075`) and status bar (`index.tsx:1531`) are already correctly hidden.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`:

**1. Breadcrumb bar** (around line 1096):
```tsx
{!isKiosk && navHistory.length > 0 && (
  <div style={{ /* breadcrumb bar styles */ }}>
    {/* ... breadcrumb content ... */}
  </div>
)}
```

**2. View toolbar** (around line 1347):
```tsx
{!isKiosk && (
  <div style={{ height: 40, /* ... toolbar styles ... */ }}>
    {/* ... toolbar content ... */}
  </div>
)}
```

Both changes follow the same `!isKiosk &&` pattern already used for the sidebar and status bar.

Do NOT:
- Remove kiosk mode handling from the sidebar or status bar — those are correct.
- Hide the Minimap in kiosk mode — the spec does not say to hide it (operators need the minimap for navigation in kiosk displays).
- Break zoom controls for non-kiosk mode — the only change is the conditional render.
