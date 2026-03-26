---
id: MOD-CONSOLE-015
title: Replace GraphicPane "Loading…" text with pane-shaped skeleton loader
unit: MOD-CONSOLE
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

When a graphic is loading inside a Console pane (fetching from `GET /api/console/graphics/:id`), the pane must display a pulsing gray rectangle skeleton that fills the pane area — not a centered "Loading…" text string. Panes load independently, so a fast graphic displays immediately while adjacent panes still show their skeleton.

## Spec Excerpt (verbatim)

> **Loading state:** Each pane shows a skeleton loader (pulsing gray rectangle) until its graphic renders. Panes load independently — a fast graphic displays while others are still loading.
> — console-implementation-spec.md, §3.6

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/panes/GraphicPane.tsx` — lines 464–470: the `isLoading` return block renders a centered `<div>Loading…</div>`

## Verification Checklist

- [ ] The `isLoading` return block in `GraphicPane.tsx` renders a full-size pulsing skeleton, not text
- [ ] Skeleton fills the entire pane area (width: 100%, height: 100%)
- [ ] Skeleton uses `animation: 'io-shimmer 1.4s ease-in-out infinite'` consistent with the design system
- [ ] No blank flash — skeleton appears immediately when GraphicPane mounts with a new `graphicId`

## Assessment

- **Status**: ❌ Wrong
- `GraphicPane.tsx:464–470`: `isLoading` block returns a flex-centered div with `"Loading…"` text. No skeleton animation. Not pane-shaped.

## Fix Instructions

Replace lines 464–470 in `frontend/src/pages/console/panes/GraphicPane.tsx`:

```tsx
if (isLoading) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--io-surface-secondary)',
        animation: 'io-shimmer 1.4s ease-in-out infinite',
        borderRadius: 0,
      }}
    />
  )
}
```

The `io-shimmer` keyframe is already defined globally in the design system. No new CSS needed.

Do NOT:
- Use a spinner component — the spec requires a structural skeleton rectangle.
- Shrink the skeleton below pane bounds — it must fill the full pane area.
- Keep the `isError` block as-is if it also just shows text — but that block is intentional (error is not loading, and an error state is different from a loading state). Do not change the error block as part of this fix.
