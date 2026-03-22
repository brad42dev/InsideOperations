---
id: DD-32-006
title: Add PointPicker Favorites tab, Recent points list, and hover preview with sparkline
unit: DD-32
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The PointPicker modal has Browse and Search tabs but is missing Favorites (star frequently used points, persisted per user) and Recent (last 20 selected points quick-access list). Hovering a point row should show a preview panel with its current value, quality, timestamp, engineering unit, and a sparkline — there is currently no preview at all.

## Spec Excerpt (verbatim)

> **Favorites**: Star frequently used points. Persisted per user.
> **Recent**: Last 20 selected points shown in a quick-access list.
> **Preview**: Hovering a point shows current value, quality, timestamp, engineering unit, and sparkline.
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Point Picker

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/PointPicker.tsx` — main component; Browse/Search tabs defined here
- `frontend/src/shared/graphics/displayElements/index.ts` — exports Sparkline for the hover preview
- `frontend/src/api/points.ts` — `getLatest()` and `getHistory()` methods for preview data

## Verification Checklist

- [ ] A "Favorites" tab exists in the picker UI alongside Browse and Search
- [ ] A star icon on each PointRow allows toggling a point as a favorite; favorites are persisted (localStorage or user preferences API)
- [ ] A "Recent" tab (or section at the top) shows the last 20 selected points, stored in localStorage
- [ ] When hovering or focusing a point row, a preview panel appears to the right (or in a fixed right column) showing: tag name, current value, quality badge, last-update timestamp, engineering unit, and a small sparkline
- [ ] Preview panel makes no network call until the user has hovered for at least 300ms (debounced) to avoid hammering the API on fast mouseover

## Assessment

- **Status**: ❌ Missing — PointPicker.tsx has only Browse and Search tabs; no favorites, no recent, no hover preview

## Fix Instructions

1. **Favorites tab**: Add a third tab "Favorites". Store favorite IDs in localStorage under `io:point-picker:favorites`. In each `PointRow`, render a star button (`★`/`☆`) that toggles the ID in/out of the favorites list. The Favorites tab shows a flat list of all starred points (same PointRow component, subset filtered by favorites set).

2. **Recent points**: Track the last 20 selected point IDs in localStorage under `io:point-picker:recent`. When a point is selected (checkbox/radio toggled to checked), prepend its ID to the recent list and trim to 20. Add a "Recent" tab or a section above Browse that shows these recent points.

3. **Hover preview**: Split the picker layout into left (point list, full width or ~60%) and right (preview panel, ~40%) when a point is hovered. In `PointRow`, pass `onMouseEnter={()=>onHoverPoint(point.id)}` and `onMouseLeave={()=>onHoverPoint(null)}` props. The parent manages `hoveredPointId` state.

   Add a `PointPreview` sub-component that:
   - Debounces the `hoveredPointId` (300ms)
   - Fetches current value via `pointsApi.getLatest(id)` and history via `pointsApi.getHistory(id, {start: -1h, end: now, limit: 20})`
   - Renders: tag name, large current value text, quality badge, timestamp, engineering unit, and a `<TimeSeriesChart>` (or the Sparkline display element) at small size (~100px tall)

Do NOT:
- Call the API on every mouseover without debouncing — this will cause excessive requests
- Store favorites in the database at this stage — localStorage is sufficient for the initial implementation
- Break existing Browse and Search tab behaviour when adding Favorites/Recent
