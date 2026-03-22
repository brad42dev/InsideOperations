---
id: MOD-CONSOLE-009
title: Fix kiosk URL param mismatch, add corner-hover exit, and permission-gate empty state CTA
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Three related gaps: (1) Console kiosk mode is activated by `?mode=kiosk` but the spec requires `?kiosk=true`. The AppShell needs to accept both. (2) Exiting kiosk mode requires Escape or Ctrl+Shift+K — the spec also requires a corner-hover (1.5s mouse dwell on any corner) to reveal a minimal exit button. (3) The "Create Workspace" CTA in the empty state is shown to all users regardless of whether they have `console:write` permission.

## Spec Excerpt (verbatim)

> URL parameter `?kiosk=true` hides all chrome: top bar, sidebar, status bar, breadcrumbs. Only the module content area is visible.
> Exiting kiosk mode: `Escape` key or a hoverable corner trigger (mouse dwell 1.5s on corner) reveals a minimal exit button.
> — docs/SPEC_MANIFEST.md, CX-KIOSK non-negotiables #1, #3

> **Empty-state CTAs are permission-aware**: if the CTA requires a permission the user lacks, show the description but omit the action button entirely.
> — docs/SPEC_MANIFEST.md, CX-RBAC non-negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx` — line 280: kiosk activation check (`searchParams.get('mode') === 'kiosk'`)
- `frontend/src/shared/layout/AppShell.tsx` — lines 374-389: keyboard handlers for kiosk exit (Escape, Ctrl+Shift+K)
- `frontend/src/pages/console/index.tsx` — lines 1195-1209: "Create Workspace" CTA button without permission check

## Verification Checklist

- [ ] `AppShell.tsx` kiosk activation also accepts `?kiosk=true` URL parameter (in addition to existing `?mode=kiosk`)
- [ ] A corner-hover overlay triggers after 1.5s mouse dwell on any corner and shows a small "Exit Kiosk" button
- [ ] Console empty state "Create Workspace" button is hidden when user lacks `console:write` permission
- [ ] The empty state description text ("Create your first workspace to start monitoring") remains visible even without the CTA

## Assessment

- **Status**: ⚠️ Partial / ❌ Missing (three separate issues)
- `AppShell.tsx:280` — checks `searchParams.get('mode') === 'kiosk'` only; does not check `searchParams.get('kiosk') === 'true'`
- No corner-hover dwell mechanism anywhere in `AppShell.tsx`
- `index.tsx:1195-1209` — "Create Workspace" `<button>` rendered unconditionally; `canExport` is used but no `canWrite` check exists for the CTA

## Fix Instructions

**Fix 1 — Accept `?kiosk=true` in AppShell** (`AppShell.tsx` around line 279):
```typescript
const isKioskParam =
  searchParams.get('mode') === 'kiosk' ||
  searchParams.get('kiosk') === 'true' ||   // add this line
  sessionStorage.getItem('io_kiosk') === '1'
```

**Fix 2 — Add corner-hover kiosk exit** to `AppShell.tsx`. In the `AppShell` component render, add 4 invisible corner targets that track mouse dwell:
```tsx
{isKiosk && (
  <>
    {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
      <KioskCornerExit key={corner} corner={corner} onExit={exitKiosk} />
    ))}
  </>
)}
```

`KioskCornerExit` is a small component that:
1. Renders a 60x60px transparent absolute div at the specified corner
2. On `pointerenter`, starts a 1500ms timer
3. On `pointerleave`, clears the timer
4. After 1500ms without leaving, shows a small "Exit Kiosk" pill button (e.g., `position: fixed, background: rgba(0,0,0,0.7), color: white, z-index: 1000`)

**Fix 3 — Permission-gate the empty state CTA** in `index.tsx` around line 1195:
```typescript
const canWrite = usePermission('console:write')
```
Then in the empty state render:
```tsx
{canWrite && (
  <button onClick={createWorkspace} style={…}>
    Create Workspace
  </button>
)}
```
The description paragraph ("Create your first workspace…") should remain visible for all users.

Do NOT:
- Remove the existing Escape key handler — it must be kept alongside the corner-hover
- Block access to the Console module for users without `console:write` (they can view published workspaces)
- Show a "you need permission" tooltip on the hidden CTA — just hide it completely (spec says hidden, not grayed)
