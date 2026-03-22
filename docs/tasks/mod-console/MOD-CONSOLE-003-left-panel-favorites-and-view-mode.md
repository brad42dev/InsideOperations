---
id: MOD-CONSOLE-003
title: Add favorites group and view mode selector to each left panel section
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every section of the Console left nav panel (Workspaces, Graphics, Widgets, Points) must have two features: (1) a favorites group pinned at the top where users can star items, and (2) a view mode selector with three modes — List (compact names), Thumbnails + Name (48x36px preview), and Grid/Palette (80x60px tiled). Starred state is persisted server-side in user preferences. Currently all sections use a flat list with no favorites and no view mode toggle.

## Spec Excerpt (verbatim)

> **Favorites group**: Collapsible group pinned at the top of each section. Users star items (hover reveals star icon, click to toggle). Favorites appear in all view modes. Starred state is per-user, persisted server-side in user preferences.
> **View mode selector**: Three small icons at the top-right of each section header: List (names only), Thumbnails + Name (48x36px), Grid/Palette (80x60px tiled).
> — console-implementation-spec.md, §2.3.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/ConsolePalette.tsx` — lines 116–150: `AccordionSection` component (add view mode icons to header)
- `frontend/src/pages/console/ConsolePalette.tsx` — lines 195–248: `WorkspacesSection` (add favorites group)
- `frontend/src/pages/console/ConsolePalette.tsx` — lines 463–502: `GraphicsSection` (add favorites group and view mode rendering)
- `frontend/src/pages/console/ConsolePalette.tsx` — lines 312–393: `PointsSection` (add favorites group)
- `frontend/src/api/` — look for user preferences API for starred state persistence

## Verification Checklist

- [ ] `AccordionSection` header renders three small view mode icon buttons (list/thumbnails/grid) at the top-right
- [ ] Hovering a list item reveals a star icon; clicking it toggles favorite state
- [ ] Favorites appear as a collapsible group pinned at the top of each section, above non-favorites
- [ ] Starred state is saved to the server (not localStorage) via user preferences API
- [ ] List view: names only, compact, single-line with truncation
- [ ] Thumbnails view: 48x36px preview + up to 2 lines of name
- [ ] Grid view: 80x60px tiled thumbnails with single-line name below
- [ ] All three view modes work for Graphics section; List mode works for Points section (no thumbnails)

## Assessment

- **Status**: ❌ Missing
- `AccordionSection` at `ConsolePalette.tsx:116-150` renders only a title, badge, and chevron — no view mode icons
- `WorkspacesSection` at `ConsolePalette.tsx:195-248` renders a flat `workspaces.map(…)` — no favorites group
- `GraphicsSection` at `ConsolePalette.tsx:463-502` renders a flat column of `GraphicTile` — no favorites, no view mode toggle
- `PointsSection` at `ConsolePalette.tsx:312-393` renders flat search results — no favorites group

## Fix Instructions

**Step 1 — Extend `AccordionSection`** to accept a `viewMode` prop and render the three mode icons:
```typescript
interface AccordionSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  badge?: number
  viewMode?: 'list' | 'thumbnails' | 'grid'
  onViewModeChange?: (mode: 'list' | 'thumbnails' | 'grid') => void
  children: React.ReactNode
}
```
Add three small SVG icon buttons (list lines, thumbnail grid 2x2, large grid 3x3) in the section header, right-aligned. Use `pointer-events: all` and stop propagation on the icon clicks to avoid toggling the section.

**Step 2 — Add favorites state** to `ConsolePalette`. Track which items are starred in local state (optimistic) and persist via a user preferences API call on toggle:
```typescript
const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
// On mount: fetch /api/user/preferences?key=console_starred_items
// On star toggle: PATCH /api/user/preferences { key: 'console_starred_items', value: [...starredIds] }
```

**Step 3 — Split each section's item list** into a "Favorites" collapsible group at the top (items where id is in `starredIds`) and an "All" group below. The favorites group renders with the same view mode as the main section.

**Step 4 — Add hover star reveal** to each item. On `onMouseEnter`, show a star SVG at the right edge of the row. On click, toggle the star:
```tsx
<div style={{ position: 'relative' }} onMouseEnter={() => setHoveredId(item.id)} onMouseLeave={() => setHoveredId(null)}>
  {children}
  {(hoveredId === item.id || starredIds.has(item.id)) && (
    <button onClick={(e) => { e.stopPropagation(); toggleStar(item.id) }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', …}}>
      {starredIds.has(item.id) ? '★' : '☆'}
    </button>
  )}
</div>
```

Do NOT:
- Store starred state only in localStorage (spec requires server-side persistence)
- Apply view mode to the Points section thumbnail/grid mode (points are data-only, list mode is sufficient)
- Add the favorites group to the Widgets section — there are only 2-3 widgets, favorites would add no value and the spec only mentions it for items with many entries
