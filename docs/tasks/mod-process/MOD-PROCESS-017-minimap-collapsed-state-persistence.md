---
id: MOD-PROCESS-017
title: Persist minimap collapsed state to user preferences
unit: MOD-PROCESS
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The minimap's collapsed/expanded state (toggled with the M key or the toggle button) should persist across page loads and sessions via the user preferences API. Currently `ProcessMinimap` uses local React state (`useState(false)`) that resets on every page load.

## Spec Excerpt (verbatim)

> **Collapse/expand:**
> - Small toggle button in the top-left corner of the minimap overlay
> - Keyboard shortcut: `M` to toggle minimap visibility
> - **Collapsed state persisted in user preferences**
> - When collapsed: only the toggle button remains visible (small icon, 24x24px)
> — process-implementation-spec.md, §4.2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/ProcessMinimap.tsx:77` — `const [collapsed, setCollapsed] = useState(false)` — not persisted
- `frontend/src/pages/process/index.tsx:918` — `minimapVisible` state (controls visibility, separate from collapsed)
- `frontend/src/api/` — user preferences API if available

## Verification Checklist

- [ ] Collapsing the minimap (M key or toggle button) persists the state across page reloads.
- [ ] On page load, the minimap opens in the same collapsed/expanded state it was left in.
- [ ] Persistence uses server-side user preferences, not localStorage.

## Assessment

- **Status**: ⚠️ Wrong
- `ProcessMinimap.tsx:77` — `useState(false)` resets on every mount. No persistence anywhere.

## Fix Instructions

Move the collapsed state out of `ProcessMinimap` into `ProcessPage` (index.tsx), where it can be persisted alongside other user preference state.

In `index.tsx`:
1. Add `minimapCollapsed` state initialized from user preferences (or localStorage as fallback):
```typescript
const [minimapCollapsed, setMinimapCollapsed] = useState(() => {
  // Until user preferences API is wired: use localStorage as fallback
  try { return localStorage.getItem('io-process-minimap-collapsed') === 'true' } catch { return false }
})
```

2. Persist on change:
```typescript
useEffect(() => {
  try { localStorage.setItem('io-process-minimap-collapsed', String(minimapCollapsed)) } catch { /* ignore */ }
}, [minimapCollapsed])
```

3. Pass `collapsed` and `onCollapsedChange` props to `ProcessMinimap`:
```tsx
<ProcessMinimap
  ...
  collapsed={minimapCollapsed}
  onCollapsedChange={setMinimapCollapsed}
  visible={minimapVisible}
/>
```

4. In `ProcessMinimap.tsx`, remove internal `collapsed` state; use the prop instead.

When the user preferences API (`PATCH /api/user/preferences`) is available, replace the localStorage fallback with a server call: `PATCH /api/user/preferences { process_minimap_collapsed: true/false }`.

Do NOT:
- Keep the collapsed state local inside ProcessMinimap — it can't be persisted from there without prop-drilling or a ref.
- Use the same localStorage key as sidebar visibility — use a distinct key `io-process-minimap-collapsed`.
