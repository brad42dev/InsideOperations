---
id: MOD-PROCESS-008
title: Replace loading spinner with module-shaped skeleton state
unit: MOD-PROCESS
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When a Process graphic is loading, instead of a centered "Loading…" text, the module should show a skeleton that matches the module's structural layout: a sidebar skeleton on the left, a viewport area skeleton in the center, and a toolbar skeleton at the bottom. This gives users an immediate sense of the layout before content arrives.

## Spec Excerpt (verbatim)

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded. Not a generic shimmer bar or spinner covering the whole area.
>
> Skeleton must appear immediately on navigation (no blank flash before skeleton).
>
> Partial loading is supported: when part of the data loads, that part renders; skeleton remains for still-loading sections.
> — SPEC_MANIFEST.md §CX-LOADING

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:898-903` — current loading state: centered text "Loading…"
- `frontend/src/pages/process/ProcessSidebar.tsx:276-296` — sidebar graphics list shows "Loading…" text when `graphicsLoading`

## Verification Checklist

- [ ] When `selectedId && isLoading`, a skeleton is shown that mirrors the sidebar + viewport + toolbar layout (not a spinner or centered text).
- [ ] The skeleton appears immediately when a graphic ID is selected — no blank flash.
- [ ] The sidebar section renders independently (not blocked by graphic load).
- [ ] Skeleton uses CSS animation (shimmer) via `@keyframes` or equivalent, not a static gray block.
- [ ] Skeleton uses design tokens (`var(--io-surface-secondary)`, `var(--io-border)`) — no hardcoded colors.

## Assessment

- **Status**: ❌ Wrong
- `index.tsx:899-903` — loading state is:
  ```jsx
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
    Loading…
  </div>
  ```
  This is a centered text overlay — the exact "generic shimmer/spinner" anti-pattern the spec calls out.

## Fix Instructions

Replace the loading state in `frontend/src/pages/process/index.tsx:899-903` with a structured skeleton:

```tsx
{selectedId && isLoading && (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'var(--io-surface-primary)' }}>
    {/* Skeleton viewport area */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
      {/* Mimic the graphic area with animated shimmer blocks */}
      <div className="io-skeleton" style={{ width: '85%', height: '60%', borderRadius: 4 }} />
      <div className="io-skeleton" style={{ width: '70%', height: '20%', borderRadius: 4 }} />
    </div>
  </div>
)}
```

Add the skeleton shimmer CSS to `frontend/src/index.css` or a dedicated `skeleton.css`:
```css
.io-skeleton {
  background: linear-gradient(
    90deg,
    var(--io-surface-secondary) 25%,
    var(--io-surface-elevated) 50%,
    var(--io-surface-secondary) 75%
  );
  background-size: 200% 100%;
  animation: io-shimmer 1.5s infinite;
}

@keyframes io-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

The skeleton layout should approximate: left sidebar columns + large central viewport area + thin bottom toolbar band. It does not need to be pixel-perfect — just structurally recognizable as the Process module layout.

Do NOT:
- Use a spinner (`<div>Loading…</div>`) — the spec explicitly prohibits generic loading states.
- Block rendering of the sidebar — the sidebar renders independently of graphic load and should show normally.
- Hardcode colors in the shimmer gradient — use CSS custom properties.
