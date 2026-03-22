---
id: MOD-CONSOLE-008
title: Replace plain-text loading state with module-shaped skeleton for Console
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

While workspaces are loading from the server, the Console must display a structural skeleton that matches the Console layout: a left panel shape + a grid area with placeholder pane rectangles. Currently, a centered "Loading workspaces…" text is shown — this is a plain text loader, not a structural skeleton, and it violates the CX-LOADING contract.

## Spec Excerpt (verbatim)

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area. Skeleton must appear immediately on navigation (no blank flash before skeleton).
> — docs/SPEC_MANIFEST.md, CX-LOADING non-negotiables #1-#2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 705–719: current plain-text loading guard

## Verification Checklist

- [ ] Loading state renders immediately when `isLoading && isAuthenticated` is true
- [ ] The skeleton shows a left panel placeholder (same width as the ConsolePalette)
- [ ] The skeleton shows a grid area with 2-4 pulsing gray pane rectangles
- [ ] The skeleton uses CSS animation (pulse/shimmer) rather than static gray
- [ ] The skeleton does not show any text like "Loading…" as the primary element

## Assessment

- **Status**: ❌ Missing
- `index.tsx:705-719` — returns a centered `<div>Loading workspaces…</div>` with `alignItems: center, justifyContent: center` — does not match the Console layout structure

## Fix Instructions

Replace the early return at `index.tsx:705-719` with a structural skeleton component:

```tsx
if (isLoading && isAuthenticated) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--io-bg)', overflow: 'hidden' }}>
      {/* Skeleton header bar */}
      <div style={{ height: 48, flexShrink: 0, background: 'var(--io-surface)', borderBottom: '1px solid var(--io-border)' }} />
      {/* Skeleton body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
        {/* Skeleton left panel */}
        <div style={{ width: 280, flexShrink: 0, background: 'var(--io-surface-secondary)', borderRight: '1px solid var(--io-border)' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 36, margin: '8px 10px', borderRadius: 'var(--io-radius)', background: 'var(--io-surface-elevated)', animation: 'io-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        {/* Skeleton grid area — 2x2 panes */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, padding: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ borderRadius: 'var(--io-radius)', background: 'var(--io-surface-secondary)', animation: 'io-pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
      {/* Skeleton status bar */}
      <div style={{ height: 24, flexShrink: 0, background: 'var(--io-surface-secondary)', borderTop: '1px solid var(--io-border)' }} />
    </div>
  )
}
```

Add the `io-pulse` keyframe animation to `frontend/src/index.css` if not already present:
```css
@keyframes io-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

Do NOT:
- Use a generic spinner or overlay instead of a structural skeleton
- Add "Loading…" text as a primary element (the pulsing structure communicates loading without text)
- Use inline `@keyframes` — put it in `index.css`
