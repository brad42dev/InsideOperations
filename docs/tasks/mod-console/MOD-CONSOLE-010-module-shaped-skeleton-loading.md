---
id: MOD-CONSOLE-010
title: Replace "Loading workspaces…" text with module-shaped skeleton loading state
unit: MOD-CONSOLE
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When the Console module is loading its workspace list from the API, it must show a skeleton that matches the Console layout structure — not a centered text string. The skeleton should approximate the three-column layout: a left nav panel with shimmer rows for workspace items, and a main grid area with shimmer pane rectangles.

## Spec Excerpt (verbatim)

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
> Skeleton must appear immediately on navigation (no blank flash before skeleton).
> — SPEC_MANIFEST.md, CX-LOADING non-negotiables #1 and #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 705-720: the loading state renders `<div>Loading workspaces…</div>` centered in the full area.

## Verification Checklist

- [ ] Loading state renders a skeleton that resembles the Console layout (left panel + grid area).
- [ ] Left panel skeleton shows 3-4 shimmer rows approximating workspace list items.
- [ ] Grid area skeleton shows 4 shimmer rectangles approximating a 2x2 grid of panes.
- [ ] Skeleton uses CSS animation (`@keyframes io-shimmer`) matching the design system pattern.
- [ ] No generic spinner or blank white flash before the skeleton appears.

## Assessment

- **Status**: ❌ Wrong
- index.tsx:705-720: loading state is `<div>Loading workspaces…</div>` — plain centered text. Not module-shaped.

## Fix Instructions

Replace the loading return block (index.tsx lines 705-720) with a Console-shaped skeleton:

```tsx
if (isLoading && isAuthenticated) {
  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--io-bg)' }}>
      {/* Left panel skeleton */}
      <div style={{
        width: 280, flexShrink: 0,
        background: 'var(--io-surface-secondary)',
        borderRight: '1px solid var(--io-border)',
        padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: 28, borderRadius: 4,
            background: 'var(--io-surface-elevated)',
            animation: 'io-shimmer 1.4s ease-in-out infinite',
          }} />
        ))}
      </div>
      {/* Grid area skeleton */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
        gap: 4, padding: 4,
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            borderRadius: 4,
            background: 'var(--io-surface-secondary)',
            animation: 'io-shimmer 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    </div>
  )
}
```

Add the shimmer keyframe to `frontend/src/shared/theme/theme-colors.ts` or a global CSS file if not already present:
```css
@keyframes io-shimmer {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}
```

Do NOT:
- Use a spinner (`<Spinner />`) — the spec requires a structural skeleton.
- Make all skeleton panes identical size — the 2x2 grid approximation is sufficient.
- Block rendering with the skeleton once the API resolves — the skeleton is only shown during the initial load.
