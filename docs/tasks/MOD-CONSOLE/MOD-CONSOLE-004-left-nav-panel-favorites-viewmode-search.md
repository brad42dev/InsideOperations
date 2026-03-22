---
id: MOD-CONSOLE-004
title: Add favorites group, view-mode selector, and per-section search to left nav panel; make panel resizable
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each accordion section in the Console left-nav panel must have: (1) a favorites group pinned at the top showing starred items, (2) a view-mode selector (list / thumbnails / grid) with three small icon buttons at the top-right of the section header, and (3) a search/filter input. The panel itself must be resizable (drag the right edge) within 200-400px and its width must be persisted in user preferences. Default width is 280px per spec.

## Spec Excerpt (verbatim)

> **Favorites group**: Collapsible group pinned at the top of each section. Users star items (hover reveals star icon, click to toggle). Favorites appear in all view modes. Starred state is per-user, persisted server-side in user preferences.
>
> **View mode selector**: Three small icons at the top-right of each section header: List, Thumbnails + Name, Grid/Palette.
>
> **Search/filter**: Text input at the top of each section. Keystroke-by-keystroke filtering. Matches against name, description, and tags.
>
> Panel width: 280px default, resizable 200-400px, width persisted
> — console-implementation-spec.md, §2.3 Left Navigation Panel

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/ConsolePalette.tsx` — line 33: `PANEL_W = 220` (wrong default width). Lines 518-641: ConsolePalette component renders 4 AccordionSections. No favorites, no view-mode selector, no section-level search (except Points has a search).
- `frontend/src/pages/console/index.tsx` — lines 320: `paletteVisible` state. No panel width state or resize logic.

## Verification Checklist

- [ ] PANEL_W default is 280px (not 220px), and panel is resizable by dragging the right edge.
- [ ] Panel width is saved to localStorage (or server preferences) and restored on page load.
- [ ] Each accordion section header has three view-mode icon buttons (list/thumbnails/grid).
- [ ] Each accordion section has a search/filter text input below its header.
- [ ] Each section has a "Favorites" collapsible sub-group at the top showing starred items.
- [ ] Hovering an item reveals a star icon; clicking it toggles favorite state.

## Assessment

- **Status**: ⚠️ Wrong
- ConsolePalette.tsx:33 PANEL_W is 220 (spec says 280px default). Panel width is a hardcoded CSS constant — not resizable and not persisted. No favorites group, no view-mode selector, no section-level search in Workspaces, Graphics, or Widgets sections.

## Fix Instructions

**Panel width:**
1. Change `PANEL_W = 220` to `280` at ConsolePalette.tsx:33.
2. Make the panel width state-driven: add `panelWidth` state (initialized from `localStorage.getItem('io-console-palette-width') ?? 280`).
3. Add a resize handle: a 4px-wide `div` on the right edge of the panel with a `mousedown` listener that tracks drag position and updates `panelWidth`, clamped to [200, 400]. On `mouseup`, `localStorage.setItem('io-console-palette-width', String(panelWidth))`.

**View-mode selector:**
Add to the `AccordionSection` component (ConsolePalette.tsx:116) a `viewMode` prop and three small icon buttons in the section header right side. Section content components (WorkspacesSection, GraphicsSection, WidgetsSection) accept `viewMode: 'list' | 'thumbnails' | 'grid'` and render accordingly. View mode per section is held in `openSections` state or a separate `sectionViewModes` state map.

**Per-section search:**
Add a `searchQuery` prop to each section content component. In `AccordionSection`, render a search `<input>` below the header when the section is open. Pass the search value down and filter the list accordingly. GraphicsSection and WorkspacesSection filter by name. PointsSection already has search — migrate it into the AccordionSection-level pattern.

**Favorites:**
Add a `favorites` Set in ConsolePalette state (initialized from localStorage). In each section's item list, render a star button on hover. Items in the favorites Set are rendered in a "Favorites" sub-group at the top of the section list. Persist favorites to localStorage key `'io-console-favorites'` as a JSON array per section type.

Do NOT:
- Persist favorites to server-side API in this task — localStorage is sufficient for now.
- Remove the existing section collapse behavior when adding the view-mode selector.
- Break the drag-drop functionality when making the panel resizable.
