---
id: MOD-CONSOLE-001
title: Add favorites group, view-mode selector, and section-height resize to left nav panel
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each of the four accordion sections in the left navigation panel (Workspaces, Graphics, Widgets, Points) should have: a collapsible "Favorites" group pinned at the top (items can be starred), a three-icon view-mode selector (List / Thumbnails / Grid) in the section header, and a drag handle at the bottom edge to resize the section's height. The panel width should be resizable 200–400px and the panel itself should fully collapse via a single toggle.

## Spec Excerpt (verbatim)

> **Favorites group**: Collapsible group pinned at the top of each section. Users star items (hover reveals star icon, click to toggle). Favorites appear in all view modes. Starred state is per-user, persisted server-side in user preferences.
>
> **View mode selector**: Three small icons at the top-right of each section header:
> - **List**: Names only, compact vertical list, maximum density.
> - **Thumbnails + Name**: Preview thumbnail (48x36px) with up to 2 lines of name text.
> - **Grid/Palette**: Thumbnail grid arranged in tiled pattern. Thumbnail (80x60px) with single-line name below.
>
> **Search/filter**: Text input at the top of each section. Keystroke-by-keystroke filtering (no debounce needed for local lists).
>
> Panel width: 280px default, resizable 200-400px, width persisted.
> — console-implementation-spec.md, §2.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/ConsolePalette.tsx` — entire left panel; `AccordionSection` component at line 116; all four section components
- `frontend/src/api/preferences.ts` (or similar) — server-side user preferences for starred state

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Each accordion section header has three view-mode icon buttons (list, thumbnails, grid) at the top-right
- [ ] Each section has a collapsible "Favorites" group at the top with star toggle on hover
- [ ] Starred state is persisted to server via user preferences API (not just `localStorage`)
- [ ] Each section has a search/filter input that filters in real-time (no debounce)
- [ ] A drag handle exists at the bottom edge of each section for height resizing
- [ ] Panel width is resizable (drag right edge, clamped 200–400px) and width is persisted in user preferences

## Assessment

After checking:
- **Status**: ⚠️ Partial — All 4 sections exist but all section-level features are missing.
- `ConsolePalette.tsx:116-150` — `AccordionSection` has only title, chevron, badge. No view-mode selector. No favorites group. No search input (except Points section which has its own separate search). No section-height drag handle. Panel width is hardcoded at `PANEL_W = 220` at line 33.

## Fix Instructions (if needed)

1. **AccordionSection** (`ConsolePalette.tsx:108-151`): Add a `viewMode` prop (`'list' | 'thumbnails' | 'grid'`), three icon buttons in the header's right side, and an `onViewModeChange` callback.

2. **Favorites group**: Add a `FavoritesGroup` component rendered above each section's item list. Items in `WorkspacesSection`, `GraphicsSection`, `WidgetsSection` need a hover-revealed star icon that calls a favorites toggle action. Starred state should be saved to `PUT /api/users/me/preferences` under a `console.favorites.{section}` key.

3. **Search in all sections** (not just Points): Each section renders a search `<input>` that filters its item list in real-time on `onChange` (no debounce needed — lists are local).

4. **Panel width resize**: Wrap the palette `<div>` in a resize container. Add a drag handle on the right edge. On `pointermove`, update panel width clamped to [200, 400]px. Persist the chosen width to `localStorage` key `io-console-palette-width`.

5. **Section-height resize**: Add a drag handle (4px tall, `cursor: ns-resize`) at the bottom of each accordion section's content area. On drag, update that section's height. Min height: 80px.

Do NOT:
- Store starred state only in localStorage — it must sync server-side so preferences persist across devices.
- Use debounce on the per-section search — it filters a local (already-fetched) list, so real-time filtering is correct.
- Break the existing 4-section structure or the existing `AccordionSection` collapse/expand behavior.
