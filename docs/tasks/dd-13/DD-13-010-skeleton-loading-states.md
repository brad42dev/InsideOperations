---
id: DD-13-010
title: Replace plain text "Loading..." with module-shaped skeleton states (CX-LOADING)
unit: DD-13
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When log data is loading, the module must display a skeleton that matches the shape of the content being loaded — not a plain text spinner. For the log list (index.tsx), the skeleton should look like a column of 3-4 instance cards with placeholder blocks. For the log editor (LogEditor.tsx), the skeleton should match the header + segment-card structure.

## Spec Excerpt (verbatim)

> Each module provides a module-shaped skeleton that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
> Skeleton must appear immediately on navigation (no blank flash before skeleton).
> — docs/SPEC_MANIFEST.md, §CX-LOADING

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/index.tsx:602-603` — `<div style=...>Loading...</div>` for active logs
- `frontend/src/pages/log/index.tsx:636-638` — plain loading text for completed tab
- `frontend/src/pages/log/index.tsx:647-649` — plain loading text for templates tab
- `frontend/src/pages/log/LogEditor.tsx:687-701` — plain "Loading..." or "Instance not found." for editor
- `frontend/src/pages/log/TemplateEditor.tsx:540-542` — plain "Loading..." for template edit

## Verification Checklist

- [ ] Active-logs list loading shows 3-4 skeleton cards matching `InstanceCard` shape (title block + status pill placeholder)
- [ ] Completed table loading shows skeleton table rows (5 columns, 3-4 rows of placeholder blocks)
- [ ] LogEditor loading shows skeleton of: header bar with title placeholder, 2-3 skeleton segment cards
- [ ] Skeleton uses CSS animation (pulse or shimmer) with `--io-surface-secondary` as base color
- [ ] No raw text "Loading..." or "Loading…" appears in any loading state

## Assessment

- **Status**: ❌ Missing
- `index.tsx:602`: `<div style={{ color: 'var(--io-text-muted)', fontSize: '14px' }}>Loading...</div>` — plain text
- `LogEditor.tsx:699`: `{isLoading ? 'Loading...' : 'Instance not found.'}` inside a centered flex div — plain text
- All 5 loading locations listed above use plain text or inline loading messages

## Fix Instructions

1. Check if a shared `SkeletonBlock` or `SkeletonPulse` component exists at `frontend/src/shared/components/`. If it exists, use it. If not, create a minimal one:
   ```tsx
   // frontend/src/shared/components/Skeleton.tsx
   export function SkeletonBlock({ width = '100%', height = '16px', borderRadius = '4px' }: { width?: string, height?: string, borderRadius?: string }) {
     return (
       <div style={{
         width, height, borderRadius,
         background: 'var(--io-surface-secondary)',
         animation: 'skeleton-pulse 1.5s ease-in-out infinite',
       }} />
     )
   }
   ```
   Add the `@keyframes skeleton-pulse` animation to the global CSS.

2. Create a `LogInstanceCardSkeleton` component in `index.tsx`:
   ```tsx
   function LogInstanceCardSkeleton() {
     return (
       <div style={{ background: 'var(--io-surface)', border: '1px solid var(--io-border)', borderRadius: '8px', padding: '16px' }}>
         <SkeletonBlock height="18px" width="60%" />
         <SkeletonBlock height="13px" width="30%" style={{ marginTop: '8px' }} />
       </div>
     )
   }
   ```

3. Replace `index.tsx:602-603` with:
   ```tsx
   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
     {[1, 2, 3].map(i => <LogInstanceCardSkeleton key={i} />)}
   </div>
   ```

4. For `LogEditor.tsx:687-701` loading state, replace with a skeleton that mirrors the editor structure:
   - A header bar skeleton (height 60px)
   - Two segment card skeletons (height 120px each)

Do NOT:
- Use a spinner (`<Spinner />`) — the spec explicitly requires structural skeletons, not spinners
- Make all loading skeletons identical across modules — the shape must match this module's content
