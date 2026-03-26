---
id: DD-13-007
title: Add date, author, shift, and template filter controls to log search
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The log search must allow filtering by date range, author, shift, tags, and template — not just free-text keyword. The backend API already accepts `shift_id`, `status`, `from`, and `to` parameters; the frontend only exposes the `q` text input. Supervisors need to find logs from a specific shift or by a specific operator to perform handover review.

## Spec Excerpt (verbatim)

> Filter by date, author, shift, tags, template
> — design-docs/13_LOG_MODULE.md, §Search

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/index.tsx:398-400` — search state variables (only `searchQuery` and `searchSubmitted` exist)
- `frontend/src/pages/log/index.tsx:432-440` — search query passes only `{ q: searchQuery }`
- `frontend/src/api/logs.ts:123-130` — `search()` already accepts `shift_id`, `status`, `from`, `to` params

## Verification Checklist

- [ ] A date range picker (from/to) appears in the search panel and its values are passed to `logsApi.search({ from, to })`
- [ ] A template filter dropdown is populated from `logsApi.listTemplates()` and passed to the search query
- [ ] A shift filter input or dropdown exists (can be text input for shift ID in v1)
- [ ] Filters and text query compose correctly — all active filters are passed together to `logsApi.search()`
- [ ] Clearing the search also resets all filter values

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:498-531`: only a single text `<input>` and a "Search" button are rendered in the search area
- `index.tsx:435`: `logsApi.search({ q: searchQuery })` — `shift_id`, `from`, `to` are never populated from UI
- The API client already has the full parameter support — this is purely a UI gap

## Fix Instructions

1. Add filter state to `LogPage` alongside `searchQuery`:
   ```tsx
   const [filterFrom, setFilterFrom] = useState('')
   const [filterTo, setFilterTo] = useState('')
   const [filterTemplateId, setFilterTemplateId] = useState('')
   const [filterShiftId, setFilterShiftId] = useState('')
   ```

2. Expand the search form (`index.tsx:498-531`) to include:
   - Two `<input type="date">` inputs for from/to date range
   - A `<select>` populated with `templatesData` for template filter (reuse the query already in the component)
   - A text `<input>` for shift ID (v1 — can be upgraded to a shift picker later)

3. Update the search query call at `index.tsx:435`:
   ```tsx
   queryFn: async () => {
     const res = await logsApi.search({
       q: searchQuery || undefined,
       from: filterFrom || undefined,
       to: filterTo || undefined,
       template_id: filterTemplateId || undefined,
       shift_id: filterShiftId || undefined,
     })
     …
   },
   ```

4. Add `filterFrom`, `filterTo`, `filterTemplateId`, `filterShiftId` to the `queryKey` array so the query refires when filters change.

5. The "Clear" button at `index.tsx:575-588` must also reset all four filter state values.

Do NOT:
- Add an `author` text filter that is not backed by an API param — the `logsApi.search()` signature does not include author filtering yet; add it to `logs.ts` and document that the backend must support it
- Remove the text search input — it is correctly implemented and should remain
